import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BankOfJapanAPI, EconomicDataService } from '@/lib/external-apis';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 最新のインフレ率データを取得
    const inflationData = await BankOfJapanAPI.getInflationData();
    
    if (!inflationData) {
      return NextResponse.json(
        { error: 'インフレ率データの取得に失敗しました' },
        { status: 500 }
      );
    }

    // データベースに保存
    await prisma.economicIndicator.upsert({
      where: {
        type_name_date: {
          type: 'inflation',
          name: '日本 消費者物価指数',
          date: inflationData.date
        }
      },
      update: {
        value: inflationData.cpi,
      },
      create: {
        type: 'inflation',
        name: '日本 消費者物価指数',
        value: inflationData.cpi,
        date: inflationData.date,
        source: inflationData.source,
      }
    });

    // コアインフレ率も保存
    await prisma.economicIndicator.upsert({
      where: {
        type_name_date: {
          type: 'inflation',
          name: '日本 コアインフレ率',
          date: inflationData.date
        }
      },
      update: {
        value: inflationData.coreInflation,
      },
      create: {
        type: 'inflation',
        name: '日本 コアインフレ率',
        value: inflationData.coreInflation,
        date: inflationData.date,
        source: inflationData.source,
      }
    });

    return NextResponse.json({
      message: 'インフレ率データを更新しました',
      data: inflationData
    });

  } catch (error) {
    console.error('Inflation data update error:', error);
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

    // 全ての経済指標を更新
    const indicators = await EconomicDataService.updateAllIndicators();

    // 為替レートも取得
    const usdJpyRate = await EconomicDataService.getJPYUSDRate();

    if (usdJpyRate) {
      await prisma.economicIndicator.upsert({
        where: {
          type_name_date: {
            type: 'exchange_rate',
            name: 'USD/JPY',
            date: new Date()
          }
        },
        update: {
          value: usdJpyRate,
        },
        create: {
          type: 'exchange_rate',
          name: 'USD/JPY',
          value: usdJpyRate,
          date: new Date(),
          source: 'Alpha Vantage',
        }
      });
    }

    return NextResponse.json({
      message: '経済指標データを更新しました',
      indicators,
      usdJpyRate
    });

  } catch (error) {
    console.error('Economic indicators update error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}