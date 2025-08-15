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
  pensionStartAge: number; // 年金受給開始年齢
  pensionEndAge: number; // 年金受給終了年齢
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
  netWorth: number;
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
   * ローンの年次返済スケジュールを計算
   */
  static calculateLoanPaymentSchedule(loan: Loan, maxYears: number): number[] {
    const schedule: number[] = new Array(maxYears).fill(0);
    let remainingBalance = loan.balance;
    const monthlyRate = loan.interestRate / 100 / 12;
    
    for (let year = 0; year < maxYears; year++) {
      // 残高がゼロになったら以降の年は0円
      if (remainingBalance <= 0) break;
      
      let yearlyPayment = 0;
      
      for (let month = 0; month < 12; month++) {
        if (remainingBalance <= 0) break;
        
        // 金利分だけ残高が増える
        remainingBalance *= (1 + monthlyRate);
        
        // 月次返済額を引く（残高を超えない範囲で）
        const payment = Math.min(loan.monthlyPayment, remainingBalance);
        remainingBalance -= payment;
        yearlyPayment += payment;
      }
      
      schedule[year] = yearlyPayment;
    }
    
    return schedule;
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

    // 各ローンの年次返済スケジュールを事前計算
    const maxYearsToLife = lifeExpectancy - currentAge;
    const loanSchedules = new Map<string, number[]>();
    loans.forEach(loan => {
      const schedule = this.calculateLoanPaymentSchedule(loan, maxYearsToLife);
      loanSchedules.set(loan.id, schedule);
    });

    // 現役時代の年収を年ごとに事前計算
    const workingIncomeSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return age <= retirementAge ? annualNetIncome : 0;
    });

    // 退職後の年収を年ごとに事前計算
    const postRetirementIncomeSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return age > retirementAge ? postRetirementAnnualIncome : 0;
    });

    // 65歳からの年金受給を年ごとに事前計算
    const pensionSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return age >= 65 ? annualPensionAmount : 0;
    });

    const annualExpenses = monthlyExpenses * 12;

    // インフレ調整済みの年間支出を年ごとに事前計算
    const expensesSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      return this.adjustForInflation(annualExpenses, inflationRate, year);
    });
    const maxYearsToRetirement = retirementAge - currentAge;
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
      
      // 事前計算済みスケジュールから各年の値を取得
      const yearlyWorkingIncome = workingIncomeSchedule[year];
      const yearlyPostRetirementIncome = postRetirementIncomeSchedule[year];
      const yearlyPension = pensionSchedule[year];
      const yearlyExpenses = expensesSchedule[year];
      const yearlyLoanPayments = Array.from(loanSchedules.values())
        .reduce((total, schedule) => total + (schedule[year] || 0), 0);
      
      // 年間の資産変動を計算
      // 前年資産に年利を適用
      currentYearAssets = currentYearAssets * (1 + expectedAnnualReturn / 100);
      
      // 年間収支計算（統一ロジック）
      const totalIncome = yearlyWorkingIncome + yearlyPostRetirementIncome + yearlyPension;
      const totalExpenses = yearlyExpenses + yearlyLoanPayments;
      currentYearAssets += totalIncome - totalExpenses;
      
      const futureAssets = currentYearAssets;
      
      // FIRE達成判定: 資産が退職後の残り人生の支出を賄えるかチェック
      const yearsInRetirement = lifeExpectancy - retirementAge;
      const totalAnnualExpenses = yearlyExpenses + yearlyLoanPayments;
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
        netWorth: futureAssets,
        fireAchieved: fireAchieved,
        yearsToFire: fireAchieved ? 0 : (year === 0 ? yearsToFire : year)
      });
    }

    // 最終的なFIRE達成時の必要資産と予測資産
    const finalExpenses = expensesSchedule[yearsToFire] || expensesSchedule[expensesSchedule.length - 1];
    const finalLoanPayments = Array.from(loanSchedules.values())
      .reduce((total, schedule) => total + (schedule[yearsToFire] || 0), 0);
    // 退職後の残り人生の支出を賄える資産が必要
    const yearsInRetirement = lifeExpectancy - retirementAge;
    const requiredAssets = (finalExpenses + finalLoanPayments) * yearsInRetirement;
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
