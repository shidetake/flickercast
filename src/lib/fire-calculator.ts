import { AssetHolding, Loan } from './types';
import { calculateTotalAssets } from './asset-calculator';

export interface FireCalculationInput {
  currentAge: number;
  retirementAge: number;
  assetHoldings: AssetHolding[]; // 銘柄保有情報
  loans: Loan[]; // ローン情報
  monthlyExpenses: number;
  annualNetIncome: number; // 手取り年収（円）
  postRetirementAnnualIncome: number; // 退職後年収（円）
  annualPensionAmount: number; // 年間年金受給額（円）
  expectedAnnualReturn: number; // パーセント（例: 5 = 5%）
  inflationRate: number; // パーセント（例: 2 = 2%）
  lifeExpectancy: number;
  exchangeRate?: number | null; // USD/JPY為替レート
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
   * ローンの完済時期（年数）を計算
   */
  static calculateLoanPayoffYears(loan: Loan): number {
    const { balance, monthlyPayment, interestRate } = loan;
    
    // 金利が0%または月次返済額が残高以上の場合
    if (interestRate === 0) {
      return Math.ceil(balance / monthlyPayment / 12);
    }
    
    if (monthlyPayment >= balance) {
      return 0; // 即座に完済可能
    }
    
    const monthlyRate = interestRate / 100 / 12;
    
    // 元利均等返済の完済月数計算
    // n = -log(1 - (P×r)/M) / log(1+r)
    const numerator = 1 - (balance * monthlyRate) / monthlyPayment;
    
    // 数学的に返済不可能（利息 > 返済額）
    if (numerator <= 0) {
      return 999; // 実質的に完済不可能として扱う
    }
    
    const months = -Math.log(numerator) / Math.log(1 + monthlyRate);
    return Math.ceil(months / 12); // 年数に変換（切り上げ）
  }

  /**
   * メインのFIRE計算関数
   */
  static calculateFire(input: FireCalculationInput): FireCalculationResult {
    const {
      currentAge,
      retirementAge,
      assetHoldings,
      loans,
      monthlyExpenses,
      annualNetIncome,
      postRetirementAnnualIncome,
      annualPensionAmount,
      expectedAnnualReturn,
      inflationRate,
      lifeExpectancy,
      exchangeRate
    } = input;

    // 銘柄保有情報から総資産額を計算（統一関数を使用、円単位）
    const currentAssets = calculateTotalAssets(assetHoldings, exchangeRate, 'yen');

    // 各ローンの完済時期を事前計算
    const loanPayoffYears = new Map<string, number>();
    loans.forEach(loan => {
      loanPayoffYears.set(loan.id, this.calculateLoanPayoffYears(loan));
    });

    const annualExpenses = monthlyExpenses * 12;
    const maxYearsToRetirement = retirementAge - currentAge;
    const maxYearsToLife = lifeExpectancy - currentAge;
    const projections: YearlyProjection[] = [];
    
    let fireAge = retirementAge;
    let yearsToFire = maxYearsToRetirement;
    let isFireAchievable = false;

    // 手取り年収から月間収入を計算し、実質月間貯蓄額を算出
    const monthlyNetIncome = annualNetIncome / 12;
    const initialLoanPayments = loans.reduce((total, loan) => total + loan.monthlyPayment, 0);
    const netMonthlySavings = monthlyNetIncome - monthlyExpenses - initialLoanPayments;

    // 年次計算（想定寿命まで）
    let currentYearAssets = currentAssets;
    
    for (let year = 0; year <= maxYearsToLife; year++) {
      const age = currentAge + year;
      
      // 退職後は貯蓄停止、支出のみ（退職希望年齢の年はまだ現役）
      const isAfterRetirement = age > retirementAge;
      
      // その年のアクティブなローン返済額を計算
      const yearlyLoanPayments = loans
        .filter(loan => year < (loanPayoffYears.get(loan.id) || 0))
        .reduce((total, loan) => total + loan.monthlyPayment, 0) * 12;
      
      // 年間の資産変動を計算
      if (year === 0) {
        // 初年度は現在の資産をそのまま使用
        // futureAssets = currentYearAssets のままにする処理は削除
      } else {
        // 前年資産に年利を適用
        currentYearAssets = currentYearAssets * (1 + expectedAnnualReturn / 100);
        
        // インフレ調整後の年間支出を計算
        const adjustedAnnualExpenses = this.adjustForInflation(annualExpenses, inflationRate, year);
        const adjustedLoanPayments = this.adjustForInflation(yearlyLoanPayments, inflationRate, year);
        
        // 収入/支出を加減
        if (isAfterRetirement) {
          // 退職後: 退職後年収と年金を加算し、インフレ調整後の年間支出とローン返済を差し引く
          const pensionIncome = age >= 65 ? annualPensionAmount : 0; // 65歳から年金受給開始
          currentYearAssets += postRetirementAnnualIncome + pensionIncome - adjustedAnnualExpenses - adjustedLoanPayments;
        } else {
          // 退職前: インフレ調整後の支出とローン返済を考慮した貯蓄額を加算
          currentYearAssets += annualNetIncome - adjustedAnnualExpenses - adjustedLoanPayments;
        }
      }
      
      const futureAssets = currentYearAssets;
      
      // その年のインフレ調整後の年間支出
      const realAnnualExpenses = this.adjustForInflation(
        annualExpenses,
        inflationRate,
        year
      );
      
      // その年のインフレ調整後のローン返済額
      const realLoanPayments = this.adjustForInflation(
        yearlyLoanPayments,
        inflationRate,
        year
      );
      
      // FIRE達成判定: 資産が退職後の残り人生の支出を賄えるかチェック
      const yearsInRetirement = lifeExpectancy - retirementAge;
      const totalAnnualExpenses = realAnnualExpenses + realLoanPayments;
      const fireAchieved = futureAssets >= (totalAnnualExpenses * yearsInRetirement);
      
      // 初回のFIRE達成年を記録（退職年齢以内の場合のみ）
      if (fireAchieved && !isFireAchievable && age <= retirementAge) {
        isFireAchievable = true;
        fireAge = age;
        yearsToFire = year;
      }

      projections.push({
        year: year,
        age: age,
        assets: futureAssets,
        expenses: annualExpenses + yearlyLoanPayments,
        realExpenses: totalAnnualExpenses,
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
    // FIRE達成時のアクティブなローン返済額を計算
    const finalLoanPayments = loans
      .filter(loan => yearsToFire < (loanPayoffYears.get(loan.id) || 0))
      .reduce((total, loan) => total + loan.monthlyPayment, 0) * 12;
    const finalRealLoanPayments = this.adjustForInflation(
      finalLoanPayments,
      inflationRate,
      yearsToFire
    );
    // 退職後の残り人生の支出を賄える資産が必要
    const yearsInRetirement = lifeExpectancy - retirementAge;
    const requiredAssets = (finalRealExpenses + finalRealLoanPayments) * yearsInRetirement;
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