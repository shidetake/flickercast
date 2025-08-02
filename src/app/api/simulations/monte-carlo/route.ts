import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MonteCarloSimulator, MonteCarloParameters } from '@/lib/monte-carlo';
import { FireCalculationInput } from '@/lib/fire-calculator';
import { z } from 'zod';

const monteCarloRequestSchema = z.object({
  input: z.object({
    currentAge: z.number().min(18).max(100),
    retirementAge: z.number().min(30).max(100),
    currentAssets: z.number().min(0),
    monthlyExpenses: z.number().min(0),
    monthlySavings: z.number().min(0),
    expectedAnnualReturn: z.number().min(-10).max(30),
    inflationRate: z.number().min(-5).max(15),
    withdrawalRate: z.number().min(1).max(10),
    lifeExpectancy: z.number().min(50).max(120),
  }),
  parameters: z.object({
    simulations: z.number().min(100).max(10000).default(1000),
    returnVolatility: z.number().min(0).max(50).default(15),
    inflationVolatility: z.number().min(0).max(10).default(1),
    sequenceOfReturnsRisk: z.boolean().default(true),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { input, parameters } = monteCarloRequestSchema.parse(body);

    const defaultParameters: MonteCarloParameters = {
      simulations: 1000,
      returnVolatility: 15,
      inflationVolatility: 1,
      sequenceOfReturnsRisk: true,
    };

    const finalParameters = { ...defaultParameters, ...parameters };

    // モンテカルロシミュレーション実行
    const results = MonteCarloSimulator.runSimulation(input, finalParameters);

    // シナリオ分析も実行
    const scenarios = [
      { name: '楽観的', returnAdjustment: 2, volatilityMultiplier: 0.8 },
      { name: '基本', returnAdjustment: 0, volatilityMultiplier: 1.0 },
      { name: '悲観的', returnAdjustment: -2, volatilityMultiplier: 1.2 },
      { name: '不況', returnAdjustment: -4, volatilityMultiplier: 1.5 },
    ];

    const scenarioResults = MonteCarloSimulator.runScenarioAnalysis(input, scenarios);

    // 早期退職リスク分析
    const retirementAges = [50, 55, 60, 65];
    const earlyRetirementAnalysis = MonteCarloSimulator.analyzeEarlyRetirementRisk(
      input,
      retirementAges
    );

    return NextResponse.json({
      results,
      scenarioResults,
      earlyRetirementAnalysis,
      parameters: finalParameters,
      metadata: {
        simulationsRun: finalParameters.simulations,
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'リクエストデータが不正です', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Monte Carlo simulation error:', error);
    return NextResponse.json(
      { error: 'シミュレーション実行中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// シンプルなモンテカルロシミュレーション（パラメータ少なめ）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // クエリパラメータから基本的な入力値を取得
    const basicInput: FireCalculationInput = {
      currentAge: Number(searchParams.get('currentAge')) || 30,
      retirementAge: Number(searchParams.get('retirementAge')) || 65,
      currentAssets: Number(searchParams.get('currentAssets')) || 1000000,
      monthlyExpenses: Number(searchParams.get('monthlyExpenses')) || 300000,
      monthlySavings: Number(searchParams.get('monthlySavings')) || 100000,
      expectedAnnualReturn: Number(searchParams.get('expectedReturn')) || 5,
      inflationRate: Number(searchParams.get('inflationRate')) || 2,
      withdrawalRate: Number(searchParams.get('withdrawalRate')) || 4,
      lifeExpectancy: Number(searchParams.get('lifeExpectancy')) || 85,
    };

    // 簡易的なパラメータでシミュレーション実行
    const simpleParameters: MonteCarloParameters = {
      simulations: 500, // 高速化のため少なめ
      returnVolatility: 15,
      inflationVolatility: 1,
      sequenceOfReturnsRisk: true,
    };

    const results = MonteCarloSimulator.runSimulation(basicInput, simpleParameters);

    return NextResponse.json({
      results,
      input: basicInput,
      parameters: simpleParameters,
    });

  } catch (error) {
    console.error('Simple Monte Carlo simulation error:', error);
    return NextResponse.json(
      { error: 'シミュレーション実行中にエラーが発生しました' },
      { status: 500 }
    );
  }
}