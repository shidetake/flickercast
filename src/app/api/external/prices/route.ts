import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AssetPriceUpdateService, YahooFinanceAPI } from '@/lib/external-apis';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (symbol) {
      // 単一の銘柄価格を取得
      const priceData = await YahooFinanceAPI.getStockPrice(symbol);
      return NextResponse.json({ priceData });
    }

    // ユーザーの全ての自動更新対象資産を取得
    const assets = await prisma.asset.findMany({
      where: {
        userId: session.user.id,
        isAutoUpdate: true,
        symbol: { not: null }
      },
      select: {
        id: true,
        symbol: true,
        type: true,
      }
    });

    if (assets.length === 0) {
      return NextResponse.json({ 
        message: '自動更新対象の資産がありません',
        updatedAssets: []
      });
    }

    // 価格データを取得
    const priceUpdates = await AssetPriceUpdateService.updateAssetPrices(assets);

    // データベースを更新
    const updatePromises = priceUpdates.map(async (priceData) => {
      const asset = assets.find(a => 
        a.symbol && priceData.symbol.includes(a.symbol)
      );
      
      if (asset) {
        return prisma.asset.update({
          where: { id: asset.id },
          data: { 
            currentValue: priceData.price,
            updatedAt: new Date()
          }
        });
      }
      return null;
    });

    const updatedAssets = await Promise.all(updatePromises);
    const filteredUpdates = updatedAssets.filter(asset => asset !== null);

    return NextResponse.json({
      message: `${filteredUpdates.length}件の資産価格を更新しました`,
      updatedAssets: filteredUpdates,
      priceData: priceUpdates
    });

  } catch (error) {
    console.error('Price update error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { symbols } = body;

    if (!Array.isArray(symbols)) {
      return NextResponse.json(
        { error: 'symbols配列が必要です' },
        { status: 400 }
      );
    }

    // 指定された銘柄の価格を取得
    const priceUpdates = await YahooFinanceAPI.getMultipleStockPrices(symbols);

    return NextResponse.json({
      message: `${symbols.length}件の銘柄価格を取得しました`,
      priceData: priceUpdates
    });

  } catch (error) {
    console.error('Manual price fetch error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}