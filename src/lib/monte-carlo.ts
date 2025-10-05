import { FireCalculationInput, YearlyProjection } from './fire-calculator';
import { MonteCarloResult } from './types';
import { calculateTotalAssets } from './asset-calculator';

export interface MonteCarloParameters {
  simulations: number; // シミュレーション回数
  returnVolatility: number; // リターンの変動率（標準偏差）
  inflationVolatility: number; // インフレ率の変動率
  sequenceOfReturnsRisk: boolean; // リターン順序リスク考慮
}

export interface MonteCarloSimulation {
  currentAge: number;
  retirementAge: number;
  currentAssets: number;
  monthlyExpenses: number;
  monthlySavings: number;
  expectedAnnualReturn: number;
  returnVolatility: number;
  inflationRate: number;
  inflationVolatility: number;
  lifeExpectancy: number;
  simulations: number;
}

export class MonteCarloSimulator {
  /**
   * 正規分布に従う乱数を生成（Box-Muller変換）
   */
  private static generateNormalRandom(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // 0を回避
    while(v === 0) v = Math.random();
    
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return z * stdDev + mean;
  }

  /**
   * 単一シミュレーションの実行
   */
  private static runSingleSimulation(params: MonteCarloSimulation): YearlyProjection[] {
    const {
      currentAge,
      retirementAge,
      currentAssets,
      monthlyExpenses,
      monthlySavings,
      expectedAnnualReturn,
      returnVolatility,
      inflationRate,
      inflationVolatility,
      lifeExpectancy
    } = params;

    const projections: YearlyProjection[] = [];
    let assets = currentAssets;
    const annualExpenses = monthlyExpenses * 12;
    const annualSavings = monthlySavings * 12;

    for (let year = 0; year <= (lifeExpectancy - currentAge); year++) {
      const age = currentAge + year;
      
      // その年のリターン率（確率的）
      const yearlyReturn = this.generateNormalRandom(
        expectedAnnualReturn / 100,
        returnVolatility / 100
      );
      
      // その年のインフレ率（確率的）
      const yearlyInflation = this.generateNormalRandom(
        inflationRate / 100,
        inflationVolatility / 100
      );
      
      // インフレ調整後の支出
      const realAnnualExpenses = annualExpenses * Math.pow(1 + yearlyInflation, year);
      
      // FIRE達成判定: 資産が退職後の残り人生の支出を賐えるかチェック
      const yearsInRetirement = lifeExpectancy - retirementAge;
      const requiredAssets = realAnnualExpenses * yearsInRetirement;
      
      // 退職前：貯蓄フェーズ
      if (age < retirementAge) {
        // 資産成長 + 年間貯蓄
        assets = assets * (1 + yearlyReturn) + annualSavings;
      } else {
        // 退職後：引き出しフェーズ
        assets = assets * (1 + yearlyReturn) - realAnnualExpenses;
      }

      const fireAchieved = assets >= requiredAssets;

      projections.push({
        year,
        age,
        assets: Math.max(0, assets), // 資産は0を下回らない
        expenses: realAnnualExpenses,
        realExpenses: realAnnualExpenses,
        netWorth: Math.max(0, assets),
        fireAchieved,
        yearsToFire: fireAchieved ? year : 0
      });

      // 資産が枯渇した場合は終了
      if (assets <= 0) {
        break;
      }
    }

    return projections;
  }

  /**
   * モンテカルロシミュレーションの実行
   */
  static runSimulation(
    baseInput: FireCalculationInput,
    parameters: MonteCarloParameters
  ): MonteCarloResult[] {
    const {
      simulations,
      returnVolatility,
      inflationVolatility,
    } = parameters;

    const simulationParams: MonteCarloSimulation = {
      currentAge: baseInput.currentAge,
      retirementAge: baseInput.retirementAge,
      currentAssets: calculateTotalAssets(baseInput.assetHoldings, baseInput.exchangeRate),
      monthlyExpenses: baseInput.monthlyExpenses,
      monthlySavings: (baseInput.annualNetIncome - baseInput.monthlyExpenses * 12) / 12,
      expectedAnnualReturn: 0, // 個別利回り対応のため無効化
      returnVolatility,
      inflationRate: baseInput.inflationRate,
      inflationVolatility,
      lifeExpectancy: baseInput.lifeExpectancy,
      simulations,
    };

    // 全シミュレーションを実行
    const allSimulations: YearlyProjection[][] = [];
    for (let i = 0; i < simulations; i++) {
      const simulation = this.runSingleSimulation(simulationParams);
      allSimulations.push(simulation);
    }

    // パーセンタイル分析
    const percentiles = [10, 25, 50, 75, 90];
    const results: MonteCarloResult[] = [];

    percentiles.forEach(percentile => {
      const percentileData = this.calculatePercentile(allSimulations, percentile);
      results.push({
        percentile,
        projections: percentileData,
        successProbability: this.calculateSuccessProbability(allSimulations, baseInput.retirementAge - baseInput.currentAge)
      });
    });

    return results;
  }

  /**
   * 指定されたパーセンタイルのデータを計算
   */
  private static calculatePercentile(
    simulations: YearlyProjection[][],
    percentile: number
  ): YearlyProjection[] {
    if (simulations.length === 0) return [];

    const maxYears = Math.max(...simulations.map(sim => sim.length));
    const percentileData: YearlyProjection[] = [];

    for (let year = 0; year < maxYears; year++) {
      const assetsAtYear = simulations
        .map(sim => sim[year]?.assets || 0)
        .filter(assets => assets > 0)
        .sort((a, b) => a - b);

      if (assetsAtYear.length === 0) break;

      const index = Math.floor((percentile / 100) * (assetsAtYear.length - 1));
      const percentileAssets = assetsAtYear[index];

      // 代表的なシミュレーションから他のデータを取得
      const referenceSimulation = simulations.find(sim => 
        sim[year] && Math.abs(sim[year].assets - percentileAssets) < percentileAssets * 0.1
      );

      if (referenceSimulation && referenceSimulation[year]) {
        percentileData.push({
          ...referenceSimulation[year],
          assets: percentileAssets
        });
      }
    }

    return percentileData;
  }

  /**
   * FIRE成功確率を計算
   */
  private static calculateSuccessProbability(
    simulations: YearlyProjection[][],
    retirementYears: number
  ): number {
    const successfulSimulations = simulations.filter(simulation => {
      const retirementPoint = simulation[retirementYears];
      if (!retirementPoint) return false;

      // 退職時点でFIRE達成かつ、その後10年間資産が枯渇しない
      const tenYearsLater = Math.min(retirementYears + 10, simulation.length - 1);
      const stillSolvent = simulation[tenYearsLater]?.assets > 0;

      return retirementPoint.fireAchieved && stillSolvent;
    });

    return (successfulSimulations.length / simulations.length) * 100;
  }

  /**
   * シナリオ分析：異なる市場条件での比較
   */
  static runScenarioAnalysis(
    baseInput: FireCalculationInput,
    scenarios: Array<{
      name: string;
      returnAdjustment: number; // 期待リターンの調整（%）
      volatilityMultiplier: number; // ボラティリティの倍率
    }>
  ): Array<{
    scenario: string;
    results: MonteCarloResult[];
  }> {
    const baseParameters: MonteCarloParameters = {
      simulations: 1000,
      returnVolatility: 15, // 基本ボラティリティ15%
      inflationVolatility: 1, // インフレ率ボラティリティ1%
      sequenceOfReturnsRisk: true,
    };

    return scenarios.map(scenario => {
      const adjustedInput = {
        ...baseInput,
        expectedAnnualReturn: 0 // 個別利回り対応のため無効化
      };

      const adjustedParameters = {
        ...baseParameters,
        returnVolatility: baseParameters.returnVolatility * scenario.volatilityMultiplier
      };

      const results = this.runSimulation(adjustedInput, adjustedParameters);

      return {
        scenario: scenario.name,
        results
      };
    });
  }

  /**
   * 早期退職リスク分析
   */
  static analyzeEarlyRetirementRisk(
    baseInput: FireCalculationInput,
    retirementAges: number[]
  ): Array<{
    retirementAge: number;
    successProbability: number;
    medianAssets: number;
  }> {
    const baseParameters: MonteCarloParameters = {
      simulations: 1000,
      returnVolatility: 15,
      inflationVolatility: 1,
      sequenceOfReturnsRisk: true,
    };

    return retirementAges.map(retirementAge => {
      const adjustedInput = {
        ...baseInput,
        retirementAge
      };

      const results = this.runSimulation(adjustedInput, baseParameters);
      const medianResult = results.find(r => r.percentile === 50);
      const retirementPoint = medianResult?.projections.find(p => p.age === retirementAge);

      return {
        retirementAge,
        successProbability: medianResult?.successProbability || 0,
        medianAssets: retirementPoint?.assets || 0
      };
    });
  }
}