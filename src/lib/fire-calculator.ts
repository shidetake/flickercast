export interface FireCalculationInput {
  currentAge: number;
  retirementAge: number;
  currentAssets: number;
  monthlyExpenses: number;
  annualNetIncome: number; // 手取り年収（円）
  expectedAnnualReturn: number; // パーセント（例: 5 = 5%）
  inflationRate: number; // パーセント（例: 2 = 2%）
  withdrawalRate: number; // パーセント（例: 4 = 4%）
  lifeExpectancy: number;
}

export interface FireCalculationResult {
  yearsToFire: number;
  fireAge: number;
  requiredAssets: number;
  projectedAssets: number;
  isFireAchievable: boolean;
  monthlyShortfall: number;
  projections: YearlyProjection[];
}

export interface YearlyProjection {
  year: number;
  age: number;
  assets: number;
  expenses: number;
  realExpenses: number; // インフレ調整後
  fireAchieved: boolean;
  yearsToFire: number;
}

/**
 * FIRE（Financial Independence, Retire Early）の計算を行う
 */
export class FireCalculator {
  /**
   * 4%ルールに基づいてFIRE達成に必要な資産額を計算
   */
  static calculateRequiredAssets(
    annualExpenses: number,
    withdrawalRate: number = 4
  ): number {
    return (annualExpenses * 100) / withdrawalRate;
  }

  /**
   * 複利計算で将来資産を予測
   */
  static calculateFutureValue(
    presentValue: number,
    monthlyContribution: number,
    annualRate: number,
    years: number
  ): number {
    const monthlyRate = annualRate / 100 / 12;
    const months = years * 12;
    
    // 年利回りが0%の場合は単純累積計算
    if (monthlyRate === 0) {
      return presentValue + (monthlyContribution * months);
    }
    
    // 元本の複利計算
    const futureValuePrincipal = presentValue * Math.pow(1 + monthlyRate, months);
    
    // 毎月の積立の将来価値
    const futureValueAnnuity = monthlyContribution * 
      ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    
    return futureValuePrincipal + futureValueAnnuity;
  }

  /**
   * インフレ調整後の実質価値を計算
   */
  static adjustForInflation(
    nominalValue: number,
    inflationRate: number,
    years: number
  ): number {
    return nominalValue * Math.pow(1 + inflationRate / 100, years);
  }

  /**
   * メインのFIRE計算関数
   */
  static calculateFire(input: FireCalculationInput): FireCalculationResult {
    const {
      currentAge,
      retirementAge,
      currentAssets,
      monthlyExpenses,
      annualNetIncome,
      expectedAnnualReturn,
      inflationRate,
      withdrawalRate,
      lifeExpectancy
    } = input;

    const annualExpenses = monthlyExpenses * 12;
    const maxYearsToRetirement = retirementAge - currentAge;
    const projections: YearlyProjection[] = [];
    
    let fireAge = retirementAge;
    let yearsToFire = maxYearsToRetirement;
    let isFireAchievable = false;

    // 手取り年収から月間収入を計算し、実質月間貯蓄額を算出
    const monthlyNetIncome = annualNetIncome / 12;
    const netMonthlySavings = monthlyNetIncome - monthlyExpenses;

    // 年次計算
    for (let year = 0; year <= maxYearsToRetirement; year++) {
      const age = currentAge + year;
      const futureAssets = this.calculateFutureValue(
        currentAssets,
        netMonthlySavings,
        expectedAnnualReturn,
        year
      );
      
      // その年のインフレ調整後の年間支出
      const realAnnualExpenses = this.adjustForInflation(
        annualExpenses,
        inflationRate,
        year
      );
      
      // FIRE達成に必要な資産額（その年のインフレ調整後）
      const requiredAssets = this.calculateRequiredAssets(
        realAnnualExpenses,
        withdrawalRate
      );
      
      const fireAchieved = futureAssets >= requiredAssets;
      
      // 初回のFIRE達成年を記録
      if (fireAchieved && !isFireAchievable) {
        isFireAchievable = true;
        fireAge = age;
        yearsToFire = year;
      }

      projections.push({
        year: year,
        age: age,
        assets: futureAssets,
        expenses: annualExpenses,
        realExpenses: realAnnualExpenses,
        fireAchieved: fireAchieved,
        yearsToFire: fireAchieved ? 0 : (year === 0 ? yearsToFire : year)
      });
    }

    // 最終的なFIRE達成時の必要資産と予測資産
    const finalRealExpenses = this.adjustForInflation(
      annualExpenses,
      inflationRate,
      yearsToFire
    );
    const requiredAssets = this.calculateRequiredAssets(
      finalRealExpenses,
      withdrawalRate
    );
    const projectedAssets = this.calculateFutureValue(
      currentAssets,
      netMonthlySavings,
      expectedAnnualReturn,
      yearsToFire
    );

    // 不足額計算（月次）
    const monthlyShortfall = isFireAchievable 
      ? 0 
      : Math.max(0, (requiredAssets - projectedAssets) / (yearsToFire * 12));

    return {
      yearsToFire,
      fireAge,
      requiredAssets,
      projectedAssets,
      isFireAchievable,
      monthlyShortfall,
      projections
    };
  }

  /**
   * 異なるシナリオでの比較計算
   */
  static compareScenarios(scenarios: FireCalculationInput[]): FireCalculationResult[] {
    return scenarios.map(scenario => this.calculateFire(scenario));
  }

  /**
   * 貯蓄率変更のインパクト分析
   */
  static analyzeSavingsRateImpact(
    baseInput: FireCalculationInput,
    savingsRateChanges: number[]
  ): FireCalculationResult[] {
    return savingsRateChanges.map(change => {
      const newAnnualNetIncome = baseInput.annualNetIncome * (1 + change / 100);
      return this.calculateFire({
        ...baseInput,
        annualNetIncome: newAnnualNetIncome
      });
    });
  }

  /**
   * 期待リターン変更のインパクト分析
   */
  static analyzeReturnImpact(
    baseInput: FireCalculationInput,
    returnChanges: number[]
  ): FireCalculationResult[] {
    return returnChanges.map(change => {
      const newExpectedReturn = baseInput.expectedAnnualReturn + change;
      return this.calculateFire({
        ...baseInput,
        expectedAnnualReturn: newExpectedReturn
      });
    });
  }
}