import { NextResponse } from 'next/server';
import { YahooFinanceAPI } from '@/lib/external-apis';
import * as cheerio from 'cheerio';

interface StockPriceData {
  symbol: string;
  price: number;
  currency: 'JPY' | 'USD';
}

interface CachedPriceData {
  symbol: string;
  price: number;
  currency: 'JPY' | 'USD';
  cachedAt: string;  // ISOString形式で保存
}

interface CachedStockPrices {
  prices: CachedPriceData[];
}

const CACHE_DURATION = 60 * 60 * 1000; // 1時間（株式・ETF）
const MUTUAL_FUND_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間（投資信託）

// メモリベースのキャッシュ（Vercel対応）
let stockPricesCache: CachedStockPrices = { prices: [] };

// ティッカーシンボル（英字のみ）かどうかを判定
function isTickerSymbol(symbol: string): boolean {
  const baseSymbol = symbol.replace(/\.[A-Z]+$/i, '');
  return /^[A-Z]+$/i.test(baseSymbol);
}

// 投資信託かどうかを判定（協会コード: 8桁の英数字）
function isMutualFundCode(symbol: string): boolean {
  return /^[0-9A-F]{8}$/i.test(symbol);
}

// 日経のページから投資信託の基準価額をスクレイピング
async function scrapeNikkeiMutualFund(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error('Nikkei fetch failed:', response.status);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 基準価額を探す（複数のセレクタを試す）
    let priceText = '';

    // パターン1: .m-fundDetail_price
    const priceElement = $('.m-fundDetail_price');
    if (priceElement.length > 0) {
      priceText = priceElement.text().trim();
    }

    // パターン2: テキストから「基準価格」を含む部分を探す
    if (!priceText) {
      $('*').each((_, element) => {
        const text = $(element).text();
        if (text.includes('基準価格') && text.includes('円')) {
          // 「基準価格(10/8): 34,128円」のような形式
          const match = text.match(/[\d,]+円/);
          if (match) {
            priceText = match[0];
            return false; // ループを抜ける
          }
        }
      });
    }

    if (!priceText) {
      console.error('Price text not found in HTML');
      return null;
    }

    // カンマと「円」を除去して数値に変換
    const price = parseFloat(priceText.replace(/[,円]/g, ''));

    if (isNaN(price)) {
      console.error('Failed to parse price:', priceText);
      return null;
    }

    return price;
  } catch (error) {
    console.error('Scraping error:', error);
    return null;
  }
}

// 投資信託の価格を取得（スクレイピング）
async function getMutualFundPrice(symbol: string): Promise<StockPriceData | null> {
  // URL動的生成（マッピングテーブル不要）
  const url = `https://www.nikkei.com/nkd/fund/?fcode=${symbol}`;
  const price = await scrapeNikkeiMutualFund(url);

  if (price === null) {
    return null;
  }

  return {
    symbol,
    price,
    currency: 'JPY',
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json(
        { error: 'symbols parameter is required' },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(',').filter(s => s.trim());

    if (symbols.length === 0) {
      return NextResponse.json({
        prices: [],
        cached: false,
        lastUpdated: new Date(),
      });
    }

    // メモリキャッシュが有効かチェック（銘柄ごとに個別判定）
    const now = Date.now();
    const validCachedPrices = stockPricesCache.prices.filter(p => {
      // リクエストされた銘柄に含まれるか
      const isRequested = symbols.includes(p.symbol) || symbols.some(s => p.symbol.includes(s));
      if (!isRequested) return false;

      // キャッシュ有効期限判定（投資信託は24時間、株式は1時間）
      const isMutualFund = isMutualFundCode(p.symbol);
      const duration = isMutualFund ? MUTUAL_FUND_CACHE_DURATION : CACHE_DURATION;
      return (now - new Date(p.cachedAt).getTime()) < duration;
    });

    // 全ての要求された銘柄が有効なキャッシュにある場合
    if (validCachedPrices.length === symbols.length) {
      return NextResponse.json({
        prices: validCachedPrices.map(({ symbol, price, currency }) => ({ symbol, price, currency })),
        cached: true,
        lastUpdated: new Date(),
      });
    }

    // 銘柄を投資信託と株式に分類（事前に判定して無駄なAPI呼び出しを回避）
    const mutualFundSymbols = symbols.filter(s => isMutualFundCode(s));
    const stockSymbols = symbols.filter(s => !isMutualFundCode(s));

    const prices: StockPriceData[] = [];

    // 株式・ETFの価格を取得（Yahoo Finance API）
    if (stockSymbols.length > 0) {
      const results = await YahooFinanceAPI.getMultipleStockPrices(stockSymbols);

      // 通貨を自動判定して変換
      const stockPrices = results.map(result => {
        // 元のシンボルを探す（.Tなどのサフィックスを除去して比較）
        const originalSymbol = stockSymbols.find(s =>
          result.symbol.includes(s) || s.includes(result.symbol.replace(/\.[A-Z]+$/i, ''))
        ) || result.symbol;

        const currency: 'JPY' | 'USD' = isTickerSymbol(originalSymbol) ? 'USD' : 'JPY';

        return {
          symbol: originalSymbol,
          price: result.price,
          currency,
        };
      });

      prices.push(...stockPrices);
    }

    // 投資信託の価格を取得（スクレイピング）
    if (mutualFundSymbols.length > 0) {
      const mutualFundResults = await Promise.allSettled(
        mutualFundSymbols.map(symbol => getMutualFundPrice(symbol))
      );

      const mutualFundPrices = mutualFundResults
        .filter((result): result is PromiseFulfilledResult<StockPriceData | null> =>
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value!);

      prices.push(...mutualFundPrices);
    }

    // キャッシュを更新（個別タイムスタンプ付き）
    const updateTime = new Date();
    const nowISO = updateTime.toISOString();
    const cachedPrices: CachedPriceData[] = prices.map(p => ({
      ...p,
      cachedAt: nowISO,
    }));

    // 既存キャッシュと統合（古いデータを保持しつつ、新しいデータで上書き）
    const existingPrices = stockPricesCache.prices.filter(
      existing => !prices.some(newPrice => newPrice.symbol === existing.symbol)
    );
    stockPricesCache = {
      prices: [...existingPrices, ...cachedPrices],
    };

    return NextResponse.json({
      prices,
      cached: false,
      lastUpdated: updateTime,
    });

  } catch (error) {
    console.error('Stock price API error:', error);

    // エラーが発生した場合、メモリキャッシュを返す
    if (stockPricesCache.prices.length > 0) {
      return NextResponse.json({
        prices: stockPricesCache.prices,
        cached: true,
        lastUpdated: new Date(),
        warning: 'API呼び出し中にエラーが発生したため、キャッシュされた株価を返しています',
      });
    }

    return NextResponse.json(
      { error: '株価の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
