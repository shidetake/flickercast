import { NextResponse } from 'next/server';
import { AlphaVantageAPI } from '@/lib/external-apis';
import { promises as fs } from 'fs';
import path from 'path';

interface CachedExchangeRate {
  rate: number;
  lastUpdated: string; // ISOString形式で保存
}

const CACHE_DURATION = 60 * 60 * 1000; // 1時間
const CACHE_FILE_PATH = path.join(process.cwd(), '.next', 'cache', 'exchange-rate.json');

// ファイルからキャッシュを読み込む
async function loadCacheFromFile(): Promise<CachedExchangeRate | null> {
  try {
    const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    const cache = JSON.parse(data) as CachedExchangeRate;
    return cache;
  } catch (error) {
    // ファイルが存在しない、または読み込みエラーの場合はnullを返す
    return null;
  }
}

// ファイルにキャッシュを保存する
async function saveCacheToFile(cache: CachedExchangeRate): Promise<void> {
  try {
    // .next/cache ディレクトリが存在しない場合は作成
    const cacheDir = path.dirname(CACHE_FILE_PATH);
    await fs.mkdir(cacheDir, { recursive: true });

    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save cache to file:', error);
  }
}

export async function GET() {
  try {
    // ファイルからキャッシュを読み込む
    const cache = await loadCacheFromFile();

    // キャッシュが有効かチェック
    if (cache && (Date.now() - new Date(cache.lastUpdated).getTime()) < CACHE_DURATION) {
      return NextResponse.json({
        rate: cache.rate,
        cached: true,
        lastUpdated: cache.lastUpdated,
      });
    }

    // Alpha Vantage APIからUSD/JPY為替レートを取得
    const rate = await AlphaVantageAPI.getForexRate('USD', 'JPY');

    if (rate === null) {
      // API呼び出しが失敗した場合
      if (cache) {
        // 古いキャッシュがある場合はそれを返す
        return NextResponse.json({
          rate: cache.rate,
          cached: true,
          lastUpdated: cache.lastUpdated,
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

    // 新しい為替レートをファイルに保存
    const now = new Date().toISOString();
    const newCache: CachedExchangeRate = {
      rate,
      lastUpdated: now,
    };
    await saveCacheToFile(newCache);

    return NextResponse.json({
      rate,
      cached: false,
      lastUpdated: now,
    });

  } catch (error) {
    console.error('Exchange rate API error:', error);

    // エラーが発生した場合、ファイルから古いキャッシュを読み込んで返す
    const cache = await loadCacheFromFile();
    if (cache) {
      return NextResponse.json({
        rate: cache.rate,
        cached: true,
        lastUpdated: cache.lastUpdated,
        warning: 'API呼び出し中にエラーが発生したため、キャッシュされた為替レートを返しています',
      });
    }

    return NextResponse.json(
      { error: '為替レートの取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}