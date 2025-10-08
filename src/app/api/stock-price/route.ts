import { NextResponse } from 'next/server';
import { YahooFinanceAPI } from '@/lib/external-apis';

interface StockPriceData {
  symbol: string;
  price: number;
  currency: 'JPY' | 'USD';
}

interface CachedStockPrices {
  prices: StockPriceData[];
  lastUpdated: Date;
}

let stockPricesCache: CachedStockPrices | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1時間

// ティッカーシンボル（英字のみ）かどうかを判定
function isTickerSymbol(symbol: string): boolean {
  const baseSymbol = symbol.replace(/\.[A-Z]+$/i, '');
  return /^[A-Z]+$/i.test(baseSymbol);
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

    // Yahoo Finance APIから株価を取得
    const results = await YahooFinanceAPI.getMultipleStockPrices(symbols);

    // 通貨を自動判定して変換
    const prices: StockPriceData[] = results.map(result => {
      // 元のシンボルを探す（.Tなどのサフィックスを除去して比較）
      const originalSymbol = symbols.find(s =>
        result.symbol.includes(s) || s.includes(result.symbol.replace(/\.[A-Z]+$/i, ''))
      ) || result.symbol;

      const currency = isTickerSymbol(originalSymbol) ? 'USD' : 'JPY';

      return {
        symbol: originalSymbol,
        price: result.price,
        currency,
      };
    });

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
