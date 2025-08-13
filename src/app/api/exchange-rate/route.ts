import { NextResponse } from 'next/server';
import { AlphaVantageAPI } from '@/lib/external-apis';

interface CachedExchangeRate {
  rate: number;
  lastUpdated: Date;
}

let exchangeRateCache: CachedExchangeRate | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1時間

export async function GET() {
  try {
    // キャッシュが有効かチェック
    if (exchangeRateCache && 
        (Date.now() - exchangeRateCache.lastUpdated.getTime()) < CACHE_DURATION) {
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

    // 新しい為替レートをキャッシュに保存
    const now = new Date();
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
    
    // エラーが発生した場合、古いキャッシュがあれば返す
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