import { AssetHolding, Loan, PensionPlan, SalaryPlan, SpecialExpense, SpecialIncome, ExpenseSegment } from './types';
import { calculateTotalAssets, convertPensionToJPY, convertSalaryToJPY } from './asset-calculator';

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

// 年次詳細データ（デバッグ用）
export interface YearlyDetailData {
  year: number;
  age: number;
  salaries: { [key: string]: number }; // 給与項目別（key: 項目名, value: 年収）
  pensions: { [key: string]: number }; // 年金項目別
  specialIncomes: { [key: string]: number }; // 臨時収入
  expenses: number; // 生活費（負数）
  loanPayments: number; // ローン返済（負数）
  loanBalances: { [key: string]: number }; // ローン残高（ローン名別）
  specialExpenses: { [key: string]: number }; // 特別支出（負数）
  annualNetCashFlow: number; // 年間収支（収入 - 支出）
  cash: number; // 現金累計（給与・年金の累計）
  assets: { [key: string]: number }; // 金融資産銘柄別（利回り計算後）
  withdrawnAssets: Set<string>; // 取り崩された資産名のセット
  investedAssets: Set<string>; // 黒字分を投資した資産名のセット
  totalAssets: number; // 合計資産
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
   * FIRE目標額を計算
   *
   * 最も高い手取り年収の給与プランの退職年齢を調整し、
   * 想定寿命時点で資産が1円以上残る最適な退職年齢を見つける。
   *
   * @returns 目標資産額、FIRE達成までの年数、FIRE達成年齢
   */
  static calculateMinimalRequiredAssets(input: FireCalculationInput): {
    targetAssets: number;
    yearsToFire: number;
    fireAge: number;
  } {
    const {
      salaryPlans,
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
      return {
        targetAssets: annualExpenses * 25,
        yearsToFire: 0,
        fireAge: currentAge
      };
    }

    // 最も高い手取り年収の給与プランを見つける
    const highestSalaryPlan = salaryPlans.reduce((highest, plan) => {
      const currentAmount = convertSalaryToJPY(plan);
      const highestAmount = convertSalaryToJPY(highest);
      return currentAmount > highestAmount ? plan : highest;
    }, salaryPlans[0]);

    // 特定の退職年齢でFIRE達成可能かチェックする関数
    const canAchieveFire = (retirementAge: number): boolean => {
      // 給与プランを調整（最大年収プランの退職年齢を変更）
      const adjustedSalaryPlans = salaryPlans.map(plan => {
        if (plan.id === highestSalaryPlan.id) {
          return { ...plan, endAge: retirementAge };
        }
        return plan;
      });

      // 調整された給与プランでシミュレーション
      const yearlyDetails = this.calculateYearlyDetails({
        ...input,
        salaryPlans: adjustedSalaryPlans
      });

      // 想定寿命時点での資産をチェック（最後の要素）
      const finalAssets = yearlyDetails[yearlyDetails.length - 1]?.totalAssets ?? 0;
      return finalAssets >= 1;
    };

    // 現在の退職年齢でFIRE達成可能かチェック
    const currentRetirementAge = highestSalaryPlan.endAge;

    // 60歳を超える場合は、60歳でチェック
    const checkAge = Math.min(currentRetirementAge, 60);
    const canAchieveNow = canAchieveFire(checkAge);

    let fireAge: number = checkAge; // デフォルトはcheckAge

    if (!canAchieveNow) {
      // ケース1: 60歳時点で達成できない → 退職年齢を後ろにずらす（最大60歳まで）
      let found = false;

      // checkAge が60未満の場合のみ、後ろにずらす余地がある
      if (checkAge < 60) {
        for (let age = checkAge + 1; age <= 60; age++) {
          if (canAchieveFire(age)) {
            fireAge = age;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // 60歳までずらしてもダメ → FIRE不可能
        const currentSegment = expenseSegments.find(
          s => currentAge >= s.startAge && currentAge < s.endAge
        );
        const monthlyExpenses = currentSegment?.monthlyExpenses ?? 0;
        const annualExpenses = monthlyExpenses * 12;
        return {
          targetAssets: annualExpenses * 25,
          yearsToFire: -1, // -1で不可能を示す
          fireAge: currentAge
        };
      }
    } else {
      // ケース2: 現時点で達成可能 → 退職年齢を前にずらす（最小は開始年齢まで）
      for (let age = checkAge - 1; age >= highestSalaryPlan.startAge; age--) {
        if (canAchieveFire(age)) {
          fireAge = age;
        } else {
          break;
        }
      }
    }

    // FIRE達成年齢での資産額を計算
    const adjustedSalaryPlans = salaryPlans.map(plan => {
      if (plan.id === highestSalaryPlan.id) {
        return { ...plan, endAge: fireAge };
      }
      return plan;
    });

    const yearlyDetails = this.calculateYearlyDetails({
      ...input,
      salaryPlans: adjustedSalaryPlans
    });

    // FIRE達成年齢時点の資産額（その年のインデックスを計算）
    const fireYearIndex = fireAge - currentAge;
    const targetAssets = yearlyDetails[fireYearIndex]?.totalAssets ?? 0;

    return {
      targetAssets,
      yearsToFire: fireAge - currentAge,
      fireAge
    };
  }

  /**
   * メインのFIRE計算関数
   */
  static calculateFire(input: FireCalculationInput): FireCalculationResult {
    const {
      assetHoldings,
      exchangeRate,
      expenseSegments
    } = input;

    // 各資産の初期残高と構成比を計算（FIRE目標額計算用）
    const totalAssetValue = calculateTotalAssets(assetHoldings, exchangeRate, 'yen');

    // 年次詳細データを計算（これが唯一の資産推移計算処理）
    const yearlyDetails = this.calculateYearlyDetails(input);

    // 年次詳細データから projections を生成（マッピング変換）
    const projections: YearlyProjection[] = yearlyDetails.map((detail, index) => {
      // 現在の年齢での月間支出（表示用、インフレ調整なし）
      const currentMonthlyExpenses = getMonthlyExpensesForAge(detail.age, expenseSegments);
      const currentAnnualExpenses = currentMonthlyExpenses * 12;

      // ローン返済額の合計
      const totalLoanPayments = Math.abs(detail.loanPayments);

      // 特別支出の合計
      const totalSpecialExpenses = Math.abs(Object.values(detail.specialExpenses).reduce((sum, val) => sum + val, 0));

      // 生活費（インフレ調整なし）+ ローン返済 + 特別支出
      const displayExpenses = currentAnnualExpenses + totalLoanPayments + totalSpecialExpenses;

      // 実際の支出（インフレ調整済み）
      const realExpenses = Math.abs(detail.expenses) + totalLoanPayments + totalSpecialExpenses;

      return {
        year: index,
        age: detail.age,
        assets: detail.totalAssets,
        expenses: displayExpenses,
        realExpenses: realExpenses,
        netWorth: detail.totalAssets,
        fireAchieved: false,
        yearsToFire: index
      };
    });

    // FIRE目標額：推定寿命まで資産が持続する最小初期資産額を計算
    // （最も高い年収の仕事を延長できると仮定した場合）
    const fireTargetResult = this.calculateMinimalRequiredAssets(input);
    const requiredAssets = fireTargetResult.targetAssets;
    const yearsToFire = fireTargetResult.yearsToFire;
    const fireAge = fireTargetResult.fireAge;

    // 予測資産は最終年の総資産額
    const projectedAssets = projections.length > 0 ? projections[projections.length - 1].assets : totalAssetValue;

    // FIRE達成可能かどうか（現在の資産がFIRE目標額以上か）
    const isFireAchievable = totalAssetValue >= requiredAssets;

    // 不足額計算（月次）
    const monthlyShortfall = isFireAchievable
      ? 0
      : Math.max(0, (requiredAssets - totalAssetValue) / Math.max(1, yearsToFire * 12));

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

  /**
   * 年次詳細データを計算（デバッグ用）
   */
  static calculateYearlyDetails(input: FireCalculationInput): YearlyDetailData[] {
    const details: YearlyDetailData[] = [];
    const years = input.lifeExpectancy - input.currentAge + 1;
    const inflationRate = input.inflationRate / 100;

    // 初期資産の計算
    const initialTotalAssets = calculateTotalAssets(input.assetHoldings, input.exchangeRate, 'yen');
    const currentExchangeRate = input.exchangeRate ?? 150;

    // 資産残高の追跡（各銘柄ごと、IDをキーとして使用）
    const assetBalances: { [key: string]: number } = {};
    input.assetHoldings.forEach(holding => {
      const value = holding.quantity * holding.pricePerUnit;
      const valueInYen = holding.currency === 'USD'
        ? value * currentExchangeRate
        : value;
      assetBalances[holding.id] = valueInYen;
    });

    // 初期構成比を計算（既存のinitialTotalAssetsを使用）
    const initialRatios: { [key: string]: number } = {};
    if (initialTotalAssets > 0) {
      Object.keys(assetBalances).forEach(id => {
        initialRatios[id] = assetBalances[id] / initialTotalAssets;
      });
    }

    // 現金残高の追跡（給与・年金の累計）
    let cashBalance = 0;

    // ローン残高の追跡（各ローンごと）
    const loanBalances: { [key: string]: number } = {};
    input.loans.forEach(loan => {
      const name = loan.name || `ローン${loan.id}`;
      loanBalances[name] = loan.balance;
    });

    for (let yearOffset = 0; yearOffset < years; yearOffset++) {
      const age = input.currentAge + yearOffset;
      const year = new Date().getFullYear() + yearOffset;

      // 給与収入
      const salaries: { [key: string]: number } = {};
      input.salaryPlans.forEach(plan => {
        if (age >= plan.startAge && age <= plan.endAge && plan.annualAmount) {
          const name = plan.name || `給与${plan.id}`;
          const inflationAdjusted = plan.annualAmount * Math.pow(1 + inflationRate, yearOffset);
          salaries[name] = inflationAdjusted;
        }
      });

      // 年金収入
      const pensions: { [key: string]: number } = {};
      input.pensionPlans.forEach(plan => {
        if (age >= plan.startAge && age <= plan.endAge && plan.annualAmount) {
          const name = plan.name || `年金${plan.id}`;
          const amountInYen = convertPensionToJPY(plan, input.exchangeRate);
          const inflationAdjusted = amountInYen * Math.pow(1 + inflationRate, yearOffset);
          pensions[name] = inflationAdjusted;
        }
      });

      // 臨時収入
      const specialIncomes: { [key: string]: number } = {};
      input.specialIncomes.forEach(income => {
        if (income.targetAge === age && income.amount) {
          const name = income.name || `臨時収入${income.id}`;
          const inflationAdjusted = income.amount * Math.pow(1 + inflationRate, yearOffset);
          specialIncomes[name] = inflationAdjusted;
        }
      });

      // 生活費（負数）
      const monthlyExpenses = getMonthlyExpensesForAge(age, input.expenseSegments);
      const annualExpenses = monthlyExpenses * 12;
      const inflationAdjustedExpenses = annualExpenses * Math.pow(1 + inflationRate, yearOffset);
      const expenses = -inflationAdjustedExpenses;

      // ローン返済（負数）と残高更新（月次複利計算）
      let totalLoanPayment = 0;
      input.loans.forEach(loan => {
        const name = loan.name || `ローン${loan.id}`;
        let remainingBalance = loanBalances[name];

        if (remainingBalance > 0 && loan.monthlyPayment > 0) {
          // 月次金利
          const monthlyRate = (loan.interestRate ?? 0) / 100 / 12;
          let yearlyPayment = 0;

          // 月ごとに金利適用と返済を繰り返す
          for (let month = 0; month < 12; month++) {
            if (remainingBalance <= 0) break;

            // 金利分だけ残高が増える（月次複利）
            remainingBalance *= (1 + monthlyRate);

            // 月次返済額を引く（残高を超えない範囲で）
            const payment = Math.min(loan.monthlyPayment, remainingBalance);
            remainingBalance -= payment;
            yearlyPayment += payment;
          }

          totalLoanPayment += yearlyPayment;
          loanBalances[name] = remainingBalance;
        }
      });
      const loanPayments = -totalLoanPayment;

      // 特別支出（負数）
      const specialExpenses: { [key: string]: number } = {};
      input.specialExpenses.forEach(expense => {
        if (expense.targetAge === age && expense.amount) {
          const name = expense.name || `特別支出${expense.id}`;
          const inflationAdjusted = expense.amount * Math.pow(1 + inflationRate, yearOffset);
          specialExpenses[name] = -inflationAdjusted;
        }
      });

      // 合計収入
      const totalIncome =
        Object.values(salaries).reduce((sum, val) => sum + val, 0) +
        Object.values(pensions).reduce((sum, val) => sum + val, 0) +
        Object.values(specialIncomes).reduce((sum, val) => sum + val, 0);

      // 合計支出
      const totalExpense =
        expenses +
        loanPayments +
        Object.values(specialExpenses).reduce((sum, val) => sum + val, 0);

      // 年間収支
      const netCashFlow = totalIncome + totalExpense;

      // 資産残高の更新（利回り適用のみ）
      input.assetHoldings.forEach(holding => {
        const returnRate = (holding.expectedReturn ?? 5) / 100;

        // 利回り適用
        assetBalances[holding.id] = assetBalances[holding.id] * (1 + returnRate);
      });

      // 現金累計の更新（年間収支を累積）
      cashBalance += netCashFlow;

      // 投資・取り崩し記録用
      const investedAssets = new Set<string>();
      const withdrawnAssets = new Set<string>();

      // 年間収支に応じて資産を調整（netCashFlowで判断）
      if (netCashFlow < 0) {
        // 赤字：利回りの低い順に取り崩し
        const deficit = Math.abs(netCashFlow);
        let remaining = deficit;

        // 利回りの低い順に資産をソート
        const sortedAssets = input.assetHoldings
          .map(holding => ({
            id: holding.id,
            name: holding.name || `資産${holding.id}`,
            returnRate: (holding.expectedReturn ?? 5) / 100,
            balance: assetBalances[holding.id] || 0
          }))
          .filter(asset => asset.balance > 0) // 残高がある資産のみ
          .sort((a, b) => a.returnRate - b.returnRate); // 利回りの低い順

        // 取り崩し処理
        let totalWithdrawn = 0;
        for (const asset of sortedAssets) {
          if (remaining <= 0) break;

          const withdrawAmount = Math.min(asset.balance, remaining);
          assetBalances[asset.id] -= withdrawAmount;
          totalWithdrawn += withdrawAmount;
          remaining -= withdrawAmount;

          if (withdrawAmount > 0) {
            withdrawnAssets.add(asset.name); // 取り崩し記録（表示名）
          }
        }
        // 取り崩した分を現金に追加
        cashBalance += totalWithdrawn;
      } else if (netCashFlow > 0) {
        // 黒字：初期構成比で資産に投資
        const totalInitialRatio = Object.values(initialRatios).reduce((sum, val) => sum + val, 0);
        if (totalInitialRatio > 0) {
          input.assetHoldings.forEach(holding => {
            const investAmount = netCashFlow * initialRatios[holding.id];
            if (investAmount > 0) {
              assetBalances[holding.id] += investAmount;
              const name = holding.name || `資産${holding.id}`;
              investedAssets.add(name); // 投資記録（表示名）
            }
          });
          // 黒字分は資産に投資したので現金累計から減算
          cashBalance -= netCashFlow;
        }
      }

      // 資産評価額（利回り適用後）
      // 入力順に表示名を付与（同名でも区別できるようインデックスを追加）
      const assets: { [key: string]: number } = {};
      input.assetHoldings.forEach((holding, index) => {
        const baseName = holding.name || `資産${holding.id}`;
        const displayName = `${baseName} [${index + 1}]`;
        assets[displayName] = assetBalances[holding.id];
      });

      // 合計資産（金融資産 + 現金残高）
      const totalAssets = Math.max(0, Object.values(assetBalances).reduce((sum, val) => sum + val, 0) + cashBalance);

      // ローン残高のコピー（現時点での残高）
      const currentLoanBalances: { [key: string]: number } = {};
      Object.keys(loanBalances).forEach(name => {
        currentLoanBalances[name] = loanBalances[name];
      });

      details.push({
        year,
        age,
        salaries,
        pensions,
        specialIncomes,
        expenses,
        loanPayments,
        loanBalances: currentLoanBalances,
        specialExpenses,
        annualNetCashFlow: netCashFlow,
        cash: cashBalance,
        assets,
        withdrawnAssets,
        investedAssets,
        totalAssets,
      });
    }

    return details;
  }
}
