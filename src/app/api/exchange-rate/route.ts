import { NextResponse } from 'next/server';
import { AlphaVantageAPI } from '@/lib/external-apis';

interface CachedExchangeRate {
  rate: number;
  lastUpdated: string; // ISOString形式で保存
}

const CACHE_DURATION = 60 * 60 * 1000; // 1時間

// メモリベースのキャッシュ（Vercel対応）
let exchangeRateCache: CachedExchangeRate | null = null;

export async function GET() {
  try {
    // メモリキャッシュをチェック
    if (exchangeRateCache && (Date.now() - new Date(exchangeRateCache.lastUpdated).getTime()) < CACHE_DURATION) {
      return NextResponse.json({
        rate: exchangeRateCache.rate,
        cached: true,
        lastUpdated: exchangeRateCache.lastUpdated,
      });
    }

    // Alpha Vantage APIからUSD/JPY為替レートを取得
    const rate = await AlphaVantageAPI.getForexRate('USD', 'JPY');

    if (rate === null) {
      // API呼び出しが失敗した場合
      if (exchangeRateCache) {
        // 古いキャッシュがある場合はそれを返す
        return NextResponse.json({
          rate: exchangeRateCache.rate,
          cached: true,
          lastUpdated: exchangeRateCache.lastUpdated,
          warning: 'API呼び出しに失敗したため、キャッシュされた為替レートを返しています',
        });
      } else {
        // キャッシュもない場合はエラーを返す
        return NextResponse.json(
          { error: '為替レートの取得に失敗しました' },
          { status: 500 }
        );
      }
    }

    // 新しい為替レートをメモリに保存
    const now = new Date().toISOString();
    exchangeRateCache = {
      rate,
      lastUpdated: now,
    };

    return NextResponse.json({
      rate,
      cached: false,
      lastUpdated: now,
    });

  } catch (error) {
    console.error('Exchange rate API error:', error);

    // エラーが発生した場合、メモリキャッシュを返す
    if (exchangeRateCache) {
      return NextResponse.json({
        rate: exchangeRateCache.rate,
        cached: true,
        lastUpdated: exchangeRateCache.lastUpdated,
        warning: 'API呼び出し中にエラーが発生したため、キャッシュされた為替レートを返しています',
      });
    }

    return NextResponse.json(
      { error: '為替レートの取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}