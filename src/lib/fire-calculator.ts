import { AssetHolding, Loan, PensionPlan, SpecialExpense, SpecialIncome } from './types';
import { calculateTotalAssets, convertPensionToJPY } from './asset-calculator';

// 計算中の資産残高追跡用
interface AssetBalance {
  id: string;
  currentValue: number; // 現在価値（円）
  originalRatio: number; // 初期構成比
  expectedReturn: number; // 個別利回り
}

export interface FireCalculationInput {
  currentAge: number;
  retirementAge: number;
  assetHoldings: AssetHolding[]; // 銘柄保有情報
  loans: Loan[]; // ローン情報
  pensionPlans: PensionPlan[]; // 年金プラン情報
  specialExpenses: SpecialExpense[]; // 特別支出情報
  specialIncomes: SpecialIncome[]; // 臨時収入情報
  monthlyExpenses: number;
  annualNetIncome: number; // 手取り年収（円）
  postRetirementAnnualIncome: number; // 退職後年収（円）
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
      pensionPlans,
      specialExpenses,
      specialIncomes,
      monthlyExpenses,
      annualNetIncome,
      postRetirementAnnualIncome,
      inflationRate,
      lifeExpectancy,
      exchangeRate
    } = input;

    // 各資産の初期残高と構成比を計算
    const totalAssetValue = calculateTotalAssets(assetHoldings, exchangeRate, 'yen');
    const assetBalances: AssetBalance[] = assetHoldings.map(holding => {
      const value = holding.quantity * holding.pricePerUnit;
      const jpyValue = holding.currency === 'USD' && exchangeRate ? value * exchangeRate : value;
      return {
        id: holding.id,
        currentValue: jpyValue,
        originalRatio: totalAssetValue > 0 ? jpyValue / totalAssetValue : 0,
        expectedReturn: holding.expectedReturn
      };
    });

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

    // 複数年金プランの統合スケジュールを年ごとに事前計算（通貨換算含む）
    const pensionSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return pensionPlans.reduce((total, plan) => {
        const isPensionActive = age >= plan.startAge && age <= plan.endAge;
        if (isPensionActive) {
          // 通貨換算して円ベースで統一
          const convertedAmount = convertPensionToJPY(plan, exchangeRate);
          return total + convertedAmount;
        }
        return total;
      }, 0);
    });

    // 特別支出スケジュールを年ごとに事前計算（インフレ調整含む）
    const specialExpenseSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return specialExpenses.reduce((total, expense) => {
        if (age === expense.targetAge) {
          // インフレ調整：現在価値 → 将来価値
          const inflationAdjustedAmount = this.adjustForInflation(expense.amount, inflationRate, year);
          return total + inflationAdjustedAmount;
        }
        return total;
      }, 0);
    });

    // 臨時収入スケジュールを年ごとに事前計算（インフレ調整含む）
    const specialIncomeSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return specialIncomes.reduce((total, income) => {
        if (age === income.targetAge) {
          // インフレ調整：現在価値 → 将来価値
          const inflationAdjustedAmount = this.adjustForInflation(income.amount, inflationRate, year);
          return total + inflationAdjustedAmount;
        }
        return total;
      }, 0);
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
    let currentAssetBalances = [...assetBalances];
    
    for (let year = 0; year <= maxYearsToLife; year++) {
      const age = currentAge + year;
      
      // 事前計算済みスケジュールから各年の値を取得
      const yearlyWorkingIncome = workingIncomeSchedule[year];
      const yearlyPostRetirementIncome = postRetirementIncomeSchedule[year];
      const yearlyPension = pensionSchedule[year];
      const yearlyExpenses = expensesSchedule[year];
      const yearlyLoanPayments = Array.from(loanSchedules.values())
        .reduce((total, schedule) => total + (schedule[year] || 0), 0);
      const yearlySpecialExpenses = specialExpenseSchedule[year];
      const yearlySpecialIncomes = specialIncomeSchedule[year];
      
      // 1. 各資産に個別利回りを適用
      currentAssetBalances = currentAssetBalances.map(asset => ({
        ...asset,
        currentValue: asset.currentValue > 0 ? asset.currentValue * (1 + asset.expectedReturn / 100) : asset.currentValue
      }));
      
      // 2. 年間収支計算
      const totalIncome = yearlyWorkingIncome + yearlyPostRetirementIncome + yearlyPension + yearlySpecialIncomes;
      const totalExpenses = yearlyExpenses + yearlyLoanPayments + yearlySpecialExpenses;
      const netCashFlow = totalIncome - totalExpenses;
      
      // 3. 収支に応じて資産を調整
      if (netCashFlow < 0) {
        // 支出超過：各資産を初期構成比に応じて取り崩し
        const totalCurrentAssets = currentAssetBalances.reduce((sum, asset) => sum + asset.currentValue, 0);
        const withdrawalAmount = Math.abs(netCashFlow);
        
        if (totalCurrentAssets > 0) {
          currentAssetBalances = currentAssetBalances.map(asset => ({
            ...asset,
            currentValue: Math.max(0, asset.currentValue - (withdrawalAmount * asset.originalRatio))
          }));
        }
      } else if (netCashFlow > 0) {
        // 収入超過：各資産を初期構成比に応じて増加
        currentAssetBalances = currentAssetBalances.map(asset => ({
          ...asset,
          currentValue: asset.currentValue + (netCashFlow * asset.originalRatio)
        }));
      }
      
      const futureAssets = currentAssetBalances.reduce((sum, asset) => sum + asset.currentValue, 0);
      
      // FIRE達成判定: 資産が退職後の残り人生の支出を賄えるかチェック
      const yearsInRetirement = lifeExpectancy - retirementAge;
      const totalAnnualExpenses = yearlyExpenses + yearlyLoanPayments + yearlySpecialExpenses;
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
        expenses: annualExpenses + yearlyLoanPayments + yearlySpecialExpenses,
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
    const finalSpecialExpenses = specialExpenseSchedule[yearsToFire] || 0;
    // 退職後の残り人生の支出を賄える資産が必要
    const yearsInRetirement = lifeExpectancy - retirementAge;
    const requiredAssets = (finalExpenses + finalLoanPayments + finalSpecialExpenses) * yearsInRetirement;
    
    // 予測資産は最終年の総資産額
    const projectedAssets = projections.length > 0 ? projections[projections.length - 1].assets : totalAssetValue;

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
      // 全資産の利回りを一律で変更
      const updatedAssetHoldings = baseInput.assetHoldings.map(holding => ({
        ...holding,
        expectedReturn: holding.expectedReturn + change
      }));
      return this.calculateFire({
        ...baseInput,
        assetHoldings: updatedAssetHoldings
      });
    });
  }
}
