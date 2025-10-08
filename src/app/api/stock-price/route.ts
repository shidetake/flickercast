import { NextResponse } from 'next/server';
import { YahooFinanceAPI } from '@/lib/external-apis';
import * as cheerio from 'cheerio';

interface StockPriceData {
  symbol: string;
  price: number;
  currency: 'JPY' | 'USD';
}

interface CachedStockPrices {
  prices: StockPriceData[];
  lastUpdated: Date;
}

interface MutualFundConfig {
  url: string;
  method: 'nikkei';
}

let stockPricesCache: CachedStockPrices | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1時間（株式・ETF）
const MUTUAL_FUND_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間（投資信託）

// 投資信託のスクレイピング設定（協会コード → URL/メソッドマッピング）
const MUTUAL_FUND_SCRAPING_CONFIG: Record<string, MutualFundConfig> = {
  '89311199': { // SBI・V・S&P500インデックス・ファンド
    url: 'https://www.nikkei.com/nkd/fund/?fcode=89311199',
    method: 'nikkei'
  },
  // 他の投資信託も追加可能
};

// ティッカーシンボル（英字のみ）かどうかを判定
function isTickerSymbol(symbol: string): boolean {
  const baseSymbol = symbol.replace(/\.[A-Z]+$/i, '');
  return /^[A-Z]+$/i.test(baseSymbol);
}

// 投資信託かどうかを判定（協会コード: 8桁の数字）
function isMutualFund(symbol: string): boolean {
  return /^\d{8}$/.test(symbol);
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
  const config = MUTUAL_FUND_SCRAPING_CONFIG[symbol];
  if (!config) {
    console.log('Mutual fund config not found:', symbol);
    return null;
  }

  let price: number | null = null;

  if (config.method === 'nikkei') {
    price = await scrapeNikkeiMutualFund(config.url);
  }

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

    // キャッシュが有効かチェック
    if (stockPricesCache &&
        (Date.now() - stockPricesCache.lastUpdated.getTime()) < CACHE_DURATION) {
      // キャッシュされた銘柄のみをフィルタリング
      const cachedPrices = stockPricesCache.prices.filter(p =>
        symbols.includes(p.symbol) || symbols.some(s => p.symbol.includes(s))
      );

      // 全ての要求された銘柄がキャッシュにある場合
      if (cachedPrices.length === symbols.length) {
        return NextResponse.json({
          prices: cachedPrices,
          cached: true,
          lastUpdated: stockPricesCache.lastUpdated,
        });
      }
    }

    // 銘柄を投資信託と株式に分類
    const mutualFundSymbols = symbols.filter(s => isMutualFund(s));
    const stockSymbols = symbols.filter(s => !isMutualFund(s));

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

        const currency = isTickerSymbol(originalSymbol) ? 'USD' : 'JPY';

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

    // キャッシュを更新
    const now = new Date();
    stockPricesCache = {
      prices,
      lastUpdated: now,
    };

    return NextResponse.json({
      prices,
      cached: false,
      lastUpdated: now,
    });

  } catch (error) {
    console.error('Stock price API error:', error);

    // エラーが発生した場合、古いキャッシュがあれば返す
    if (stockPricesCache) {
      return NextResponse.json({
        prices: stockPricesCache.prices,
        cached: true,
        lastUpdated: stockPricesCache.lastUpdated,
        warning: 'API呼び出し中にエラーが発生したため、キャッシュされた株価を返しています',
      });
    }

    return NextResponse.json(
      { error: '株価の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
