import { AssetHolding, Loan, PensionPlan, SalaryPlan, SpecialExpense, SpecialIncome, ExpenseSegment } from './types';
import { calculateTotalAssets, convertPensionToJPY, convertSalaryToJPY } from './asset-calculator';

// 計算中の資産残高追跡用
interface AssetBalance {
  id: string;
  currentValue: number; // 現在価値（円）
  originalRatio: number; // 初期構成比
  expectedReturn: number; // 個別利回り
}

export interface FireCalculationInput {
  currentAge: number;
  assetHoldings: AssetHolding[]; // 銘柄保有情報
  loans: Loan[]; // ローン情報
  pensionPlans: PensionPlan[]; // 年金プラン情報
  salaryPlans: SalaryPlan[]; // 給与プラン情報
  specialExpenses: SpecialExpense[]; // 特別支出情報
  specialIncomes: SpecialIncome[]; // 臨時収入情報
  expenseSegments: ExpenseSegment[]; // 年齢区分別月間支出
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
 * 年齢に応じた月間支出額を取得
 */
function getMonthlyExpensesForAge(
  age: number,
  segments: ExpenseSegment[]
): number {
  const segment = segments.find(
    s => age >= s.startAge && age <= s.endAge
  );
  return segment?.monthlyExpenses ?? 0;
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
    const monthlyRate = (loan.interestRate ?? 0) / 100 / 12;
    
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
   * 最大給与で働く期間の資産推移をシミュレーション
   * @returns 働き終えた時点での資産額
   */
  private static simulateWorkingPeriod(
    input: FireCalculationInput,
    adjustedSalaryPlans: SalaryPlan[],
    workingYears: number
  ): number {
    const {
      currentAge,
      assetHoldings,
      loans,
      pensionPlans,
      specialExpenses,
      specialIncomes,
      expenseSegments,
      inflationRate,
      exchangeRate
    } = input;

    // 各資産の初期残高と構成比を計算
    const totalAssetValue = calculateTotalAssets(assetHoldings, exchangeRate, 'yen');
    let assetBalances: AssetBalance[] = assetHoldings.map(holding => {
      const value = holding.quantity * holding.pricePerUnit;
      const jpyValue = holding.currency === 'USD' && exchangeRate ? value * exchangeRate : value;
      return {
        id: holding.id,
        currentValue: jpyValue,
        originalRatio: totalAssetValue > 0 ? jpyValue / totalAssetValue : 0,
        expectedReturn: holding.expectedReturn ?? 0
      };
    });

    // 各種スケジュールを事前計算
    const loanSchedules = new Map<string, number[]>();
    loans.forEach(loan => {
      const schedule = this.calculateLoanPaymentSchedule(loan, workingYears);
      loanSchedules.set(loan.id, schedule);
    });

    // 働く期間のシミュレーション
    for (let year = 0; year < workingYears; year++) {
      const age = currentAge + year;

      // 利回り適用
      assetBalances = assetBalances.map(asset => ({
        ...asset,
        currentValue: asset.currentValue > 0 ? asset.currentValue * (1 + asset.expectedReturn / 100) : asset.currentValue
      }));

      // 収支計算
      const yearlySalary = adjustedSalaryPlans.reduce((total, plan) => {
        if (age >= plan.startAge && age <= plan.endAge) {
          return total + convertSalaryToJPY(plan);
        }
        return total;
      }, 0);

      const yearlyPension = pensionPlans.reduce((total, plan) => {
        if (age >= plan.startAge && age <= plan.endAge) {
          return total + convertPensionToJPY(plan, exchangeRate);
        }
        return total;
      }, 0);

      const monthlyExpenses = getMonthlyExpensesForAge(age, expenseSegments);
      const annualExpenses = monthlyExpenses * 12;
      const yearlyExpenses = this.adjustForInflation(annualExpenses, inflationRate, year);

      const yearlyLoanPayments = Array.from(loanSchedules.values())
        .reduce((total, schedule) => total + (schedule[year] || 0), 0);

      const yearlySpecialExpenses = specialExpenses.reduce((total, expense) => {
        if (expense.targetAge !== undefined && age === expense.targetAge) {
          return total + this.adjustForInflation(expense.amount, inflationRate, year);
        }
        return total;
      }, 0);

      const yearlySpecialIncomes = specialIncomes.reduce((total, income) => {
        if (income.targetAge !== undefined && age === income.targetAge) {
          return total + this.adjustForInflation(income.amount, inflationRate, year);
        }
        return total;
      }, 0);

      const totalIncome = yearlySalary + yearlyPension + yearlySpecialIncomes;
      const totalExpenses = yearlyExpenses + yearlyLoanPayments + yearlySpecialExpenses;
      const netCashFlow = totalIncome - totalExpenses;

      // 資産調整
      if (netCashFlow < 0) {
        const totalCurrentAssets = assetBalances.reduce((sum, asset) => sum + asset.currentValue, 0);
        const withdrawalAmount = Math.abs(netCashFlow);
        if (totalCurrentAssets > 0) {
          assetBalances = assetBalances.map(asset => {
            const currentRatio = asset.currentValue / totalCurrentAssets;
            return {
              ...asset,
              currentValue: Math.max(0, asset.currentValue - (withdrawalAmount * currentRatio))
            };
          });
        }
      } else if (netCashFlow > 0) {
        const totalOriginalRatio = assetBalances.reduce((sum, asset) => sum + asset.originalRatio, 0);
        if (totalOriginalRatio > 0) {
          assetBalances = assetBalances.map(asset => ({
            ...asset,
            currentValue: asset.currentValue + (netCashFlow * asset.originalRatio)
          }));
        } else {
          assetBalances = assetBalances.map((asset, index) => ({
            ...asset,
            currentValue: index === 0 ? asset.currentValue + netCashFlow : asset.currentValue
          }));
        }
      }
    }

    return assetBalances.reduce((sum, asset) => sum + asset.currentValue, 0);
  }

  /**
   * FIRE後の期間（給与なし）の資産推移をシミュレーション
   * @returns 推定寿命時点での資産残高
   */
  private static simulateRetirementPeriod(
    input: FireCalculationInput,
    startingAssets: number,
    retirementAge: number
  ): number {
    const {
      assetHoldings,
      loans,
      pensionPlans,
      specialExpenses,
      specialIncomes,
      expenseSegments,
      inflationRate,
      lifeExpectancy,
      exchangeRate
    } = input;

    // 平均利回りを計算
    const avgReturn = assetHoldings.length > 0
      ? assetHoldings.reduce((sum, h) => sum + (h.expectedReturn ?? 0), 0) / assetHoldings.length
      : 0;

    let currentAssets = startingAssets;
    const retirementYears = lifeExpectancy - retirementAge;

    // 各種スケジュールを事前計算
    const loanSchedules = new Map<string, number[]>();
    loans.forEach(loan => {
      const schedule = this.calculateLoanPaymentSchedule(loan, retirementYears);
      loanSchedules.set(loan.id, schedule);
    });

    // FIRE後のシミュレーション
    for (let year = 0; year < retirementYears; year++) {
      const age = retirementAge + year;

      // 利回り適用
      currentAssets = currentAssets * (1 + avgReturn / 100);

      // 収支計算（給与なし）
      const yearlyPension = pensionPlans.reduce((total, plan) => {
        if (age >= plan.startAge && age <= plan.endAge) {
          return total + convertPensionToJPY(plan, exchangeRate);
        }
        return total;
      }, 0);

      const monthlyExpenses = getMonthlyExpensesForAge(age, expenseSegments);
      const annualExpenses = monthlyExpenses * 12;
      const yearsFromStart = (retirementAge - input.currentAge) + year;
      const yearlyExpenses = this.adjustForInflation(annualExpenses, inflationRate, yearsFromStart);

      const yearlyLoanPayments = Array.from(loanSchedules.values())
        .reduce((total, schedule) => total + (schedule[year] || 0), 0);

      const yearlySpecialExpenses = specialExpenses.reduce((total, expense) => {
        if (expense.targetAge !== undefined && age === expense.targetAge) {
          return total + this.adjustForInflation(expense.amount, inflationRate, yearsFromStart);
        }
        return total;
      }, 0);

      const yearlySpecialIncomes = specialIncomes.reduce((total, income) => {
        if (income.targetAge !== undefined && age === income.targetAge) {
          return total + this.adjustForInflation(income.amount, inflationRate, yearsFromStart);
        }
        return total;
      }, 0);

      const totalIncome = yearlyPension + yearlySpecialIncomes;
      const totalExpenses = yearlyExpenses + yearlyLoanPayments + yearlySpecialExpenses;
      const netCashFlow = totalIncome - totalExpenses;

      currentAssets += netCashFlow;
    }

    return currentAssets;
  }

  /**
   * 現在の資産から、最大給与で働いて到達すべき目標資産額を計算
   *
   * 最も高い年収の給与プランの退職年齢を延長しながら働き、
   * 到達した資産額から推定寿命まで資産が持続する最小の「到達目標額」を求める。
   */
  static calculateMinimalRequiredAssets(input: FireCalculationInput): number {
    const {
      salaryPlans,
      lifeExpectancy,
      currentAge,
      expenseSegments,
    } = input;

    // 給与プランがない場合、4%ルールで計算
    if (salaryPlans.length === 0) {
      const currentSegment = expenseSegments.find(
        s => currentAge >= s.startAge && currentAge < s.endAge
      );
      const monthlyExpenses = currentSegment?.monthlyExpenses ?? 0;
      const annualExpenses = monthlyExpenses * 12;
      return annualExpenses * 25; // 4%ルール
    }

    // 最も高い年収の給与プランを特定
    const highestSalaryPlan = salaryPlans.reduce((highest, plan) => {
      const currentAmount = convertSalaryToJPY(plan);
      const highestAmount = convertSalaryToJPY(highest);
      return currentAmount > highestAmount ? plan : highest;
    }, salaryPlans[0]);

    // 最大延長可能年数を計算（推定寿命まで、最低0年）
    const maxExtensionYears = Math.max(0, lifeExpectancy - highestSalaryPlan.endAge);

    // 延長年数ごとにシミュレーション
    for (let extensionYears = 0; extensionYears <= maxExtensionYears; extensionYears++) {
      // 給与プランを調整
      const adjustedSalaryPlans = salaryPlans.map(plan => {
        if (plan.id === highestSalaryPlan.id) {
          return {
            ...plan,
            endAge: plan.endAge + extensionYears,
          };
        } else {
          if (plan.startAge > highestSalaryPlan.endAge) {
            const newStartAge = highestSalaryPlan.endAge + extensionYears + 1;
            if (newStartAge > plan.endAge) {
              return {
                ...plan,
                startAge: plan.endAge + 1,
                endAge: plan.endAge,
              };
            }
            return {
              ...plan,
              startAge: newStartAge,
            };
          }
        }
        return plan;
      });

      const workingYears = (highestSalaryPlan.endAge + extensionYears) - currentAge;
      const retirementAge = currentAge + workingYears;

      // ステップ1: この延長年数働いた後の資産額を計算
      const assetsAfterWorking = this.simulateWorkingPeriod(
        input,
        adjustedSalaryPlans,
        workingYears
      );

      // ステップ2: その資産額から推定寿命まで持続するかチェック
      const assetsAtLifeEnd = this.simulateRetirementPeriod(
        input,
        assetsAfterWorking,
        retirementAge
      );

      // 資産が枯渇せず持続した場合、この到達資産額がFIRE目標額
      if (assetsAtLifeEnd >= 0) {
        return assetsAfterWorking;
      }
    }

    // どの延長年数でも持続しない場合、4%ルールでフォールバック
    const currentSegment = expenseSegments.find(
      s => currentAge >= s.startAge && currentAge < s.endAge
    );
    const monthlyExpenses = currentSegment?.monthlyExpenses ?? 0;
    const annualExpenses = monthlyExpenses * 12;
    return annualExpenses * 25; // 4%ルール
  }

  /**
   * 推定寿命時点での資産残高をシミュレーション（メインのcalculateFire用）
   */
  private static simulateAssetBalance(input: FireCalculationInput): number {
    const {
      currentAge,
      assetHoldings,
      loans,
      pensionPlans,
      salaryPlans,
      specialExpenses,
      specialIncomes,
      expenseSegments,
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
        expectedReturn: holding.expectedReturn ?? 0
      };
    });

    // 各ローンの年次返済スケジュールを事前計算
    const maxYearsToLife = lifeExpectancy - currentAge;
    const loanSchedules = new Map<string, number[]>();
    loans.forEach(loan => {
      const schedule = this.calculateLoanPaymentSchedule(loan, maxYearsToLife);
      loanSchedules.set(loan.id, schedule);
    });

    // 複数給与プランの統合スケジュールを年ごとに事前計算
    const salarySchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return salaryPlans.reduce((total, plan) => {
        const isSalaryActive = age >= plan.startAge && age <= plan.endAge;
        if (isSalaryActive) {
          const amount = convertSalaryToJPY(plan);
          return total + amount;
        }
        return total;
      }, 0);
    });

    // 複数年金プランの統合スケジュールを年ごとに事前計算
    const pensionSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return pensionPlans.reduce((total, plan) => {
        const isPensionActive = age >= plan.startAge && age <= plan.endAge;
        if (isPensionActive) {
          const convertedAmount = convertPensionToJPY(plan, exchangeRate);
          return total + convertedAmount;
        }
        return total;
      }, 0);
    });

    // 特別支出スケジュール
    const specialExpenseSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return specialExpenses.reduce((total, expense) => {
        if (expense.targetAge !== undefined && age === expense.targetAge) {
          const inflationAdjustedAmount = this.adjustForInflation(expense.amount, inflationRate, year);
          return total + inflationAdjustedAmount;
        }
        return total;
      }, 0);
    });

    // 臨時収入スケジュール
    const specialIncomeSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return specialIncomes.reduce((total, income) => {
        if (income.targetAge !== undefined && age === income.targetAge) {
          const inflationAdjustedAmount = this.adjustForInflation(income.amount, inflationRate, year);
          return total + inflationAdjustedAmount;
        }
        return total;
      }, 0);
    });

    // インフレ調整済みの年間支出
    const expensesSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      const monthlyExpenses = getMonthlyExpensesForAge(age, expenseSegments);
      const annualExpenses = monthlyExpenses * 12;
      return this.adjustForInflation(annualExpenses, inflationRate, year);
    });

    // 年次シミュレーション
    let currentAssetBalances = [...assetBalances];

    for (let year = 0; year <= maxYearsToLife; year++) {
      // 各資産に個別利回りを適用
      currentAssetBalances = currentAssetBalances.map(asset => ({
        ...asset,
        currentValue: asset.currentValue > 0 ? asset.currentValue * (1 + asset.expectedReturn / 100) : asset.currentValue
      }));

      // 年間収支計算
      const yearlySalary = salarySchedule[year];
      const yearlyPension = pensionSchedule[year];
      const yearlyExpenses = expensesSchedule[year];
      const yearlyLoanPayments = Array.from(loanSchedules.values())
        .reduce((total, schedule) => total + (schedule[year] || 0), 0);
      const yearlySpecialExpenses = specialExpenseSchedule[year];
      const yearlySpecialIncomes = specialIncomeSchedule[year];

      const totalIncome = yearlySalary + yearlyPension + yearlySpecialIncomes;
      const totalExpenses = yearlyExpenses + yearlyLoanPayments + yearlySpecialExpenses;
      const netCashFlow = totalIncome - totalExpenses;

      // 収支に応じて資産を調整
      if (netCashFlow < 0) {
        // 支出超過：各資産を現在の構成比に応じて取り崩し
        const totalCurrentAssets = currentAssetBalances.reduce((sum, asset) => sum + asset.currentValue, 0);
        const withdrawalAmount = Math.abs(netCashFlow);

        if (totalCurrentAssets > 0) {
          currentAssetBalances = currentAssetBalances.map(asset => {
            const currentRatio = asset.currentValue / totalCurrentAssets;
            return {
              ...asset,
              currentValue: Math.max(0, asset.currentValue - (withdrawalAmount * currentRatio))
            };
          });
        }
      } else if (netCashFlow > 0) {
        // 収入超過：各資産を初期構成比に応じて増加
        const totalOriginalRatio = assetBalances.reduce((sum, asset) => sum + asset.originalRatio, 0);

        if (totalOriginalRatio > 0) {
          currentAssetBalances = currentAssetBalances.map(asset => ({
            ...asset,
            currentValue: asset.currentValue + (netCashFlow * asset.originalRatio)
          }));
        } else {
          currentAssetBalances = currentAssetBalances.map((asset, index) => ({
            ...asset,
            currentValue: index === 0 ? asset.currentValue + netCashFlow : asset.currentValue
          }));
        }
      }
    }

    // 推定寿命時点での資産残高を返す
    return currentAssetBalances.reduce((sum, asset) => sum + asset.currentValue, 0);
  }

  /**
   * メインのFIRE計算関数
   */
  static calculateFire(input: FireCalculationInput): FireCalculationResult {
    const {
      currentAge,
      assetHoldings,
      loans,
      pensionPlans,
      salaryPlans,
      specialExpenses,
      specialIncomes,
      expenseSegments,
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
        expectedReturn: holding.expectedReturn ?? 0
      };
    });

    // 各ローンの年次返済スケジュールを事前計算
    const maxYearsToLife = lifeExpectancy - currentAge;
    const loanSchedules = new Map<string, number[]>();
    loans.forEach(loan => {
      const schedule = this.calculateLoanPaymentSchedule(loan, maxYearsToLife);
      loanSchedules.set(loan.id, schedule);
    });

    // 複数給与プランの統合スケジュールを年ごとに事前計算
    const salarySchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      return salaryPlans.reduce((total, plan) => {
        const isSalaryActive = age >= plan.startAge && age <= plan.endAge;
        if (isSalaryActive) {
          const amount = convertSalaryToJPY(plan);
          return total + amount;
        }
        return total;
      }, 0);
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
        if (expense.targetAge !== undefined && age === expense.targetAge) {
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
        if (income.targetAge !== undefined && age === income.targetAge) {
          // インフレ調整：現在価値 → 将来価値
          const inflationAdjustedAmount = this.adjustForInflation(income.amount, inflationRate, year);
          return total + inflationAdjustedAmount;
        }
        return total;
      }, 0);
    });

    // インフレ調整済みの年間支出を年ごとに事前計算（年齢別支出を考慮）
    const expensesSchedule: number[] = new Array(maxYearsToLife + 1).fill(0).map((_, year) => {
      const age = currentAge + year;
      const monthlyExpenses = getMonthlyExpensesForAge(age, expenseSegments);
      const annualExpenses = monthlyExpenses * 12;
      return this.adjustForInflation(annualExpenses, inflationRate, year);
    });
    const projections: YearlyProjection[] = [];

    const fireAge = 0; // FIRE達成判定は削除
    const yearsToFire = 0; // FIRE達成判定は削除
    const isFireAchievable = false; // FIRE達成判定は削除

    // 年次計算（想定寿命まで）
    let currentAssetBalances = [...assetBalances];
    
    for (let year = 0; year <= maxYearsToLife; year++) {
      const age = currentAge + year;

      // 事前計算済みスケジュールから各年の値を取得
      const yearlySalary = salarySchedule[year];
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
      const totalIncome = yearlySalary + yearlyPension + yearlySpecialIncomes;
      const totalExpenses = yearlyExpenses + yearlyLoanPayments + yearlySpecialExpenses;
      const netCashFlow = totalIncome - totalExpenses;
      
      // 3. 収支に応じて資産を調整
      if (netCashFlow < 0) {
        // 支出超過：各資産を現在の構成比に応じて取り崩し
        const totalCurrentAssets = currentAssetBalances.reduce((sum, asset) => sum + asset.currentValue, 0);
        const withdrawalAmount = Math.abs(netCashFlow);

        if (totalCurrentAssets > 0) {
          // 現在の資産構成比を計算
          currentAssetBalances = currentAssetBalances.map(asset => {
            const currentRatio = asset.currentValue / totalCurrentAssets;
            return {
              ...asset,
              currentValue: Math.max(0, asset.currentValue - (withdrawalAmount * currentRatio))
            };
          });
        }
      } else if (netCashFlow > 0) {
        // 収入超過：各資産を初期構成比に応じて増加
        const totalOriginalRatio = assetBalances.reduce((sum, asset) => sum + asset.originalRatio, 0);

        if (totalOriginalRatio > 0) {
          // 通常ケース：初期資産がある場合、構成比に応じて分配
          currentAssetBalances = currentAssetBalances.map(asset => ({
            ...asset,
            currentValue: asset.currentValue + (netCashFlow * asset.originalRatio)
          }));
        } else {
          // 初期資産がない場合：最初の資産に全額追加（現金として扱う）
          currentAssetBalances = currentAssetBalances.map((asset, index) => ({
            ...asset,
            currentValue: index === 0 ? asset.currentValue + netCashFlow : asset.currentValue
          }));
        }
      }
      
      const futureAssets = currentAssetBalances.reduce((sum, asset) => sum + asset.currentValue, 0);

      // FIRE達成判定は削除（目標額ラインのみで判断）
      const totalAnnualExpenses = yearlyExpenses + yearlyLoanPayments + yearlySpecialExpenses;

      // 現在の年齢での月間支出（表示用、インフレ調整なし）
      const currentMonthlyExpenses = getMonthlyExpensesForAge(age, expenseSegments);
      const currentAnnualExpenses = currentMonthlyExpenses * 12;

      projections.push({
        year: year,
        age: age,
        assets: futureAssets,
        expenses: currentAnnualExpenses + yearlyLoanPayments + yearlySpecialExpenses,
        realExpenses: totalAnnualExpenses,
        netWorth: futureAssets,
        fireAchieved: false, // FIRE達成判定は削除
        yearsToFire: year === 0 ? yearsToFire : year
      });
    }

    // FIRE目標額：推定寿命まで資産が持続する最小初期資産額を計算
    // （最も高い年収の仕事を延長できると仮定した場合）
    const requiredAssets = this.calculateMinimalRequiredAssets(input);
    
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
   * Note: 給与プランベースに変更されたため、この関数は廃止予定
   */
  static analyzeSavingsRateImpact(
    baseInput: FireCalculationInput,
    savingsRateChanges: number[]
  ): FireCalculationResult[] {
    return savingsRateChanges.map(change => {
      // 全ての給与プランの金額を一律で変更
      const updatedSalaryPlans = baseInput.salaryPlans.map(plan => ({
        ...plan,
        annualAmount: (plan.annualAmount ?? 0) * (1 + change / 100)
      }));
      return this.calculateFire({
        ...baseInput,
        salaryPlans: updatedSalaryPlans
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
        expectedReturn: (holding.expectedReturn ?? 0) + change
      }));
      return this.calculateFire({
        ...baseInput,
        assetHoldings: updatedAssetHoldings
      });
    });
  }
}
