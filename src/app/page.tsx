'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Label } from '@/components/ui/label';
import { Tooltip } from '@/components/ui/tooltip';
import { FireCalculator, FireCalculationInput } from '@/lib/fire-calculator';
import FireProjectionChart from '@/components/charts/fire-projection-chart';
import FireSummary from '@/components/dashboard/fire-summary';
import { YearlyDetailTable } from '@/components/dashboard/yearly-detail-table';
import { ChartDataPoint, FireMetrics, AssetHolding, Loan, PensionPlan, SalaryPlan, SpecialExpense, SpecialIncome, ExpenseSegment, Child, MultiYearEducationExpense } from '@/lib/types';
import { ExpenseTimeline } from '@/components/expense/expense-timeline';
import { formatCurrency } from '@/lib/utils';
import { saveToLocalStorage, loadFromLocalStorage, exportToJson, importFromJson } from '@/lib/storage';
import { useToast, ToastProvider } from '@/lib/toast-context';
import { calculateTotalAssets as calculateTotalAssetsUnified } from '@/lib/asset-calculator';
import { generateEducationExpenses, generateEducationMultiYearExpenses, expandAllChildrenMultiYearExpenses, calculateParentAgeFromChildAge } from '@/lib/education-cost';

interface StockSymbol {
  symbol: string;
  name: string;
}

// ティッカーシンボル（英字のみ）かどうかを判定
function isTickerSymbol(symbol: string): boolean {
  // .T などのサフィックスを除去
  const baseSymbol = symbol.replace(/\.[A-Z]+$/i, '');
  // 英字のみで構成されているか
  return /^[A-Z]+$/i.test(baseSymbol);
}

function HomeContent() {
  const { showSuccess, showError } = useToast();

  // 銘柄データの状態管理
  const [stockSymbols, setStockSymbols] = useState<StockSymbol[]>([]);

  // 統計データに基づく想定寿命計算
  const calculateLifeExpectancy = (currentAge: number): number => {
    const baseLifeExpectancy = 84.12; // 2023年平均
    const currentGrowthRate = 0.05; // 現在の年間伸び率
    const declineRate = 0.0003; // 年間鈍化率（さらに小さく調整）
    
    // 若い人ほど将来の医療技術進歩の恩恵を受ける期間が長い
    const yearsOfBenefit = Math.max(0, baseLifeExpectancy - currentAge);
    
    let totalIncrease = 0;
    // 現在から将来にかけての医療技術進歩を積算
    for (let year = 0; year < yearsOfBenefit; year++) {
      const yearlyGrowthRate = Math.max(0, currentGrowthRate - (year * declineRate));
      totalIncrease += yearlyGrowthRate;
    }
    
    return Math.round(baseLifeExpectancy + totalIncrease);
  };

  // デフォルト値を生成する関数
  const createDefaultInput = (): FireCalculationInput => ({
    currentAge: 38,
    assetHoldings: [
      { id: '1', name: '', quantity: 0, pricePerUnit: 0, currency: 'JPY' },
    ], // デフォルトは1つの空の銘柄
    loans: [
      { id: '1', name: '', balance: 0, monthlyPayment: 0 },
    ], // デフォルトは1つの空のローン
    pensionPlans: [
      { id: '1', name: '', currency: 'JPY', startAge: 65, endAge: calculateLifeExpectancy(38) },
    ], // デフォルトは1つの空の年金
    salaryPlans: [
      { id: '1', name: '', startAge: 38, endAge: 60 },
    ], // デフォルトは1つの空の給与
    specialExpenses: [
      { id: '1', name: '', amount: 0 },
    ], // デフォルトは1つの空の特別支出
    specialIncomes: [
      { id: '1', name: '', amount: 0 },
    ], // デフォルトは1つの空の臨時収入
    expenseSegments: [
      { id: '1', startAge: 38, endAge: calculateLifeExpectancy(38), monthlyExpenses: 0 },
    ], // デフォルトは1つの区間
    inflationRate: 2,
    lifeExpectancy: calculateLifeExpectancy(38),
    children: [], // 子供情報（デフォルトは空）
  });

  const [input, setInput] = useState<FireCalculationInput>(createDefaultInput());
  const [nextAssetId, setNextAssetId] = useState(2); // 次に使用するAsset ID（デフォルトは1なので2から開始）
  const [nextLoanId, setNextLoanId] = useState(2); // 次に使用するLoan ID（デフォルトは1なので2から開始）
  const [nextPensionId, setNextPensionId] = useState(2); // 次に使用するPension ID（デフォルトは1なので2から開始）
  const [nextSalaryId, setNextSalaryId] = useState(2); // 次に使用するSalary ID（デフォルトは1なので2から開始）
  const [nextSpecialExpenseId, setNextSpecialExpenseId] = useState(2); // 次に使用するSpecialExpense ID（デフォルトは1なので2から開始）
  const [nextSpecialIncomeId, setNextSpecialIncomeId] = useState(2); // 次に使用するSpecialIncome ID（デフォルトは1なので2から開始）
  const [nextChildId, setNextChildId] = useState(1); // 次に使用するChild ID
  const [nextChildExpenseId, setNextChildExpenseId] = useState(1); // 次に使用する子供の支出ID
  const [nextMultiYearExpenseId, setNextMultiYearExpenseId] = useState(1); // 次に使用する複数年支出ID
  const [isDeleteMode, setIsDeleteMode] = useState(false); // 削除モード状態
  const [isLoanDeleteMode, setIsLoanDeleteMode] = useState(false); // ローン削除モード状態
  const [isPensionDeleteMode, setIsPensionDeleteMode] = useState(false); // 年金削除モード状態
  const [isSalaryDeleteMode, setIsSalaryDeleteMode] = useState(false); // 給与削除モード状態
  const [isSpecialExpenseDeleteMode, setIsSpecialExpenseDeleteMode] = useState(false); // 特別支出削除モード状態
  const [isSpecialIncomeDeleteMode, setIsSpecialIncomeDeleteMode] = useState(false); // 臨時収入削除モード状態
  const [isChildDeleteMode, setIsChildDeleteMode] = useState(false); // 子供削除モード状態
  const [childExpenseDeleteModes, setChildExpenseDeleteModes] = useState<Record<string, boolean>>({}); // 子供ごとの支出削除モード状態
  const [childMultiYearExpenseDeleteModes, setChildMultiYearExpenseDeleteModes] = useState<Record<string, boolean>>({}); // 子供ごとの複数年支出削除モード状態

  // 子供情報変更時の確認ダイアログ関連の状態
  const [childUpdateDialog, setChildUpdateDialog] = useState<{
    childId: string;
    field: keyof Child;
    value: string | number | boolean;
  } | null>(null);

  // USD/JPY為替レート関連の状態
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(true);
  const [exchangeRateFetchFailed, setExchangeRateFetchFailed] = useState(false);

  // 年次詳細データ表示の状態
  const [showYearlyDetails, setShowYearlyDetails] = useState(false);

  // 既存の銘柄IDから次のIDを計算
  const calculateNextAssetId = (assetHoldings: AssetHolding[]): number => {
    if (assetHoldings.length === 0) return 1;
    const maxId = Math.max(...assetHoldings.map(holding => parseInt(holding.id) || 0));
    return maxId + 1;
  };

  // 既存のローンIDから次のIDを計算
  const calculateNextLoanId = (loans: Loan[]): number => {
    if (loans.length === 0) return 1;
    const maxId = Math.max(...loans.map(loan => parseInt(loan.id) || 0));
    return maxId + 1;
  };

  // 既存の年金IDから次のIDを計算
  const calculateNextPensionId = (pensionPlans: PensionPlan[]): number => {
    if (pensionPlans.length === 0) return 1;
    const maxId = Math.max(...pensionPlans.map(plan => parseInt(plan.id) || 0));
    return maxId + 1;
  };

  // 既存の給与IDから次のIDを計算
  const calculateNextSalaryId = (salaryPlans: SalaryPlan[]): number => {
    if (salaryPlans.length === 0) return 1;
    const maxId = Math.max(...salaryPlans.map(plan => parseInt(plan.id) || 0));
    return maxId + 1;
  };

  // 既存の特別支出IDから次のIDを計算
  const calculateNextSpecialExpenseId = (specialExpenses: SpecialExpense[]): number => {
    if (specialExpenses.length === 0) return 1;
    const maxId = Math.max(...specialExpenses.map(expense => parseInt(expense.id) || 0));
    return maxId + 1;
  };

  // 既存の臨時収入IDから次のIDを計算
  const calculateNextSpecialIncomeId = (specialIncomes: SpecialIncome[]): number => {
    if (specialIncomes.length === 0) return 1;
    const maxId = Math.max(...specialIncomes.map(income => parseInt(income.id) || 0));
    return maxId + 1;
  };

  // 既存の子供IDから次のIDを計算
  const calculateNextChildId = (children: Child[]): number => {
    if (children.length === 0) return 1;
    const maxId = Math.max(...children.map(child => parseInt(child.id) || 0));
    return maxId + 1;
  };

  // 為替レート取得関数
  const fetchExchangeRate = async () => {
    try {
      const response = await fetch('/api/exchange-rate');
      if (!response.ok) {
        throw new Error('為替レートの取得に失敗しました');
      }
      const data = await response.json();
      setExchangeRate(data.rate);
    } catch (error) {
      console.error('Exchange rate fetch error:', error);
      // APIエラー時はデフォルト値150円を設定
      setExchangeRate(150);
      setExchangeRateFetchFailed(true);
    } finally {
      setExchangeRateLoading(false);
    }
  };

  // ページ読み込み時にlocalStorageからデータを復元
  useEffect(() => {
    const savedData = loadFromLocalStorage();
    if (savedData) {
      // 古いデータにmultiYearExpensesやmanuallyEditedフィールドがない場合は初期化
      if (savedData.children) {
        savedData.children = savedData.children.map(child => ({
          ...child,
          multiYearExpenses: child.multiYearExpenses || [],
          manuallyEdited: child.manuallyEdited ?? false
        }));
      }

      setInput(savedData);

      // nextAssetIdを適切に設定
      setNextAssetId(calculateNextAssetId(savedData.assetHoldings));
      // nextLoanIdを適切に設定
      setNextLoanId(calculateNextLoanId(savedData.loans || []));
      // nextPensionIdを適切に設定
      setNextPensionId(calculateNextPensionId(savedData.pensionPlans || []));
      // nextSalaryIdを適切に設定
      setNextSalaryId(calculateNextSalaryId(savedData.salaryPlans || []));
      // nextSpecialExpenseIdを適切に設定
      setNextSpecialExpenseId(calculateNextSpecialExpenseId(savedData.specialExpenses || []));
      // nextSpecialIncomeIdを適切に設定
      setNextSpecialIncomeId(calculateNextSpecialIncomeId(savedData.specialIncomes || []));
      // nextChildIdを適切に設定
      setNextChildId(calculateNextChildId(savedData.children || []));

      // 株価自動取得（localStorageロード完了後）
      const symbolsToFetch = savedData.assetHoldings
        .filter(h => h.symbol)
        .map(h => h.symbol!);

      if (symbolsToFetch.length > 0) {
        // 共通化した関数を使用（ただしこの時点では定義されていないので、直接実装）
        const fetchInitialPrices = async () => {
          try {
            const response = await fetch(`/api/stock-price?symbols=${symbolsToFetch.join(',')}`);
            if (!response.ok) {
              console.log('株価取得失敗:', response.status);
              return;
            }

            const data = await response.json();
            if (data.prices && data.prices.length > 0) {
              setInput(prev => ({
                ...prev,
                assetHoldings: prev.assetHoldings.map(holding => {
                  if (!holding.symbol) return holding;

                  const priceData = data.prices.find((p: { symbol: string }) => p.symbol === holding.symbol);
                  if (priceData) {
                    return {
                      ...holding,
                      pricePerUnit: priceData.price,
                      currency: priceData.currency,
                    };
                  }
                  return holding;
                })
              }));
            }
          } catch (error) {
            console.log('株価取得エラー:', error);
          }
        };

        fetchInitialPrices();
      }
    }
  }, []);

  // 為替レート取得
  useEffect(() => {
    fetchExchangeRate();
  }, []);

  // 銘柄データ取得
  useEffect(() => {
    const loadStockSymbols = async () => {
      try {
        const response = await fetch('/data/stock-symbols.json');
        if (response.ok) {
          const data = await response.json();
          setStockSymbols(data);
        }
      } catch (error) {
        console.error('銘柄データの読み込みに失敗:', error);
      }
    };
    loadStockSymbols();
  }, []);

  // マイグレーション: stockSymbols読み込み後、既存データのnameにsymbolが入っている場合に変換
  useEffect(() => {
    if (stockSymbols.length === 0) return;

    let needsUpdate = false;
    const updatedHoldings = input.assetHoldings.map(holding => {
      // symbolフィールドが既に存在する場合はスキップ
      if (holding.symbol) return holding;

      // nameにsymbolっぽい値（JSONに存在する）が入っている場合
      const found = stockSymbols.find(s => s.symbol === holding.name);
      if (found) {
        needsUpdate = true;
        // ティッカーシンボルの場合はnameにsymbolを、それ以外はnameに会社名を保存
        const displayName = isTickerSymbol(found.symbol) ? found.symbol : found.name;
        return { ...holding, name: displayName, symbol: found.symbol };
      }

      return holding;
    });

    if (needsUpdate) {
      setInput(prev => ({ ...prev, assetHoldings: updatedHoldings }));
    }
  }, [stockSymbols]); // inputは依存から除外（無限ループ防止）

  // データ変更時にlocalStorageへ自動保存
  useEffect(() => {
    saveToLocalStorage(input);
  }, [input]);

  // 株価取得関数（共通化）
  const fetchStockPricesForSymbols = async (symbols: string[]) => {
    if (symbols.length === 0) return;

    try {
      const response = await fetch(`/api/stock-price?symbols=${symbols.join(',')}`);
      if (!response.ok) {
        console.log('株価取得失敗:', response.status);
        return;
      }

      const data = await response.json();
      if (data.prices && data.prices.length > 0) {
        // 取得した株価で更新
        setInput(prev => ({
          ...prev,
          assetHoldings: prev.assetHoldings.map(holding => {
            if (!holding.symbol) return holding;

            const priceData = data.prices.find((p: { symbol: string }) => p.symbol === holding.symbol);
            if (priceData) {
              return {
                ...holding,
                pricePerUnit: priceData.price,
                currency: priceData.currency,
              };
            }
            return holding;
          })
        }));
      }
    } catch (error) {
      console.log('株価取得エラー:', error);
    }
  };

  // 金融資産管理のヘルパー関数
  const addAssetHolding = () => {
    const newHolding: AssetHolding = {
      id: nextAssetId.toString(),
      name: '',
      quantity: 0,
      pricePerUnit: 0,
      currency: 'JPY',
    };
    setInput(prev => ({
      ...prev,
      assetHoldings: [...prev.assetHoldings, newHolding]
    }));
    setNextAssetId(prev => prev + 1);
  };

  const updateAssetHolding = (id: string, field: keyof AssetHolding, value: string | number) => {
    setInput(prev => ({
      ...prev,
      assetHoldings: prev.assetHoldings.map(holding =>
        holding.id === id ? { ...holding, [field]: value } : holding
      )
    }));
  };

  // サジェストから銘柄を選択した時のハンドラー
  const handleStockSelect = async (id: string, stock: { symbol: string; name: string }) => {
    // ティッカーシンボル（英字）の場合はnameにsymbolを、それ以外はnameに会社名を保存
    const displayName = isTickerSymbol(stock.symbol) ? stock.symbol : stock.name;

    setInput(prev => ({
      ...prev,
      assetHoldings: prev.assetHoldings.map(holding =>
        holding.id === id ? { ...holding, name: displayName, symbol: stock.symbol } : holding
      )
    }));

    // 株価を自動取得
    await fetchStockPricesForSymbols([stock.symbol]);
  };

  // 入力欄からフォーカスが外れた時、自由記述をチェック
  const handleStockNameBlur = async (id: string, inputValue: string) => {
    // JSONに存在するか検索（symbol or name で完全一致）
    const found = stockSymbols.find(
      s => s.symbol.toLowerCase() === inputValue.toLowerCase() ||
           s.name.toLowerCase() === inputValue.toLowerCase()
    );

    if (found) {
      // 見つかった場合、nameとsymbolの両方を設定
      // ティッカーシンボルの場合はnameにsymbolを、それ以外はnameに会社名を保存
      const displayName = isTickerSymbol(found.symbol) ? found.symbol : found.name;

      setInput(prev => ({
        ...prev,
        assetHoldings: prev.assetHoldings.map(holding =>
          holding.id === id ? { ...holding, name: displayName, symbol: found.symbol } : holding
        )
      }));

      // 株価を自動取得
      await fetchStockPricesForSymbols([found.symbol]);
    }
    // 見つからない場合は何もしない（カスタム銘柄として扱う）
  };

  const removeAssetHolding = (id: string) => {
    setInput(prev => ({
      ...prev,
      assetHoldings: prev.assetHoldings.filter(holding => holding.id !== id)
    }));
  };


  // 年金管理のヘルパー関数
  const addPensionPlan = () => {
    const newPensionPlan: PensionPlan = {
      id: nextPensionId.toString(),
      name: '',
      currency: 'JPY',
      startAge: 65,
      endAge: calculateLifeExpectancy(input.currentAge),
    };
    setInput(prev => ({
      ...prev,
      pensionPlans: [...prev.pensionPlans, newPensionPlan]
    }));
    setNextPensionId(prev => prev + 1);
  };

  const updatePensionPlan = (id: string, field: keyof PensionPlan, value: string | number) => {
    setInput(prev => ({
      ...prev,
      pensionPlans: prev.pensionPlans.map(plan =>
        plan.id === id ? { ...plan, [field]: value } : plan
      )
    }));
  };

  const removePensionPlan = (id: string) => {
    setInput(prev => ({
      ...prev,
      pensionPlans: prev.pensionPlans.filter(plan => plan.id !== id)
    }));
  };

  // 給与管理のヘルパー関数
  const addSalaryPlan = () => {
    const newSalaryPlan: SalaryPlan = {
      id: nextSalaryId.toString(),
      name: '',
      startAge: input.currentAge,
      endAge: 60,
    };
    setInput(prev => ({
      ...prev,
      salaryPlans: [...prev.salaryPlans, newSalaryPlan]
    }));
    setNextSalaryId(prev => prev + 1);
  };

  const updateSalaryPlan = (id: string, field: keyof SalaryPlan, value: string | number) => {
    setInput(prev => ({
      ...prev,
      salaryPlans: prev.salaryPlans.map(plan =>
        plan.id === id ? { ...plan, [field]: value } : plan
      )
    }));
  };

  const removeSalaryPlan = (id: string) => {
    setInput(prev => ({
      ...prev,
      salaryPlans: prev.salaryPlans.filter(plan => plan.id !== id)
    }));
  };

  // ローン管理のヘルパー関数
  const addLoan = () => {
    const newLoan: Loan = {
      id: nextLoanId.toString(),
      name: '',
      balance: 0,
      monthlyPayment: 0,
    };
    setInput(prev => ({
      ...prev,
      loans: [...prev.loans, newLoan]
    }));
    setNextLoanId(prev => prev + 1);
  };

  const updateLoan = (id: string, field: keyof Loan, value: string | number) => {
    setInput(prev => ({
      ...prev,
      loans: prev.loans.map(loan =>
        loan.id === id ? { ...loan, [field]: value } : loan
      )
    }));
  };

  const removeLoan = (id: string) => {
    setInput(prev => ({
      ...prev,
      loans: prev.loans.filter(loan => loan.id !== id)
    }));
  };

  // 特別支出管理のヘルパー関数
  const addSpecialExpense = () => {
    const newSpecialExpense: SpecialExpense = {
      id: nextSpecialExpenseId.toString(),
      name: '',
      amount: 0,
    };
    setInput(prev => ({
      ...prev,
      specialExpenses: [...prev.specialExpenses, newSpecialExpense]
    }));
    setNextSpecialExpenseId(prev => prev + 1);
  };

  const updateSpecialExpense = (id: string, field: keyof SpecialExpense, value: string | number) => {
    setInput(prev => ({
      ...prev,
      specialExpenses: prev.specialExpenses.map(expense =>
        expense.id === id ? { ...expense, [field]: value } : expense
      )
    }));
  };

  const removeSpecialExpense = (id: string) => {
    setInput(prev => ({
      ...prev,
      specialExpenses: prev.specialExpenses.filter(expense => expense.id !== id)
    }));
  };

  // 臨時収入管理のヘルパー関数
  const addSpecialIncome = () => {
    const newSpecialIncome: SpecialIncome = {
      id: nextSpecialIncomeId.toString(),
      name: '',
      amount: 0,
    };
    setInput(prev => ({
      ...prev,
      specialIncomes: [...prev.specialIncomes, newSpecialIncome]
    }));
    setNextSpecialIncomeId(prev => prev + 1);
  };

  const updateSpecialIncome = (id: string, field: keyof SpecialIncome, value: string | number) => {
    setInput(prev => ({
      ...prev,
      specialIncomes: prev.specialIncomes.map(income =>
        income.id === id ? { ...income, [field]: value } : income
      )
    }));
  };

  const removeSpecialIncome = (id: string) => {
    setInput(prev => ({
      ...prev,
      specialIncomes: prev.specialIncomes.filter(income => income.id !== id)
    }));
  };

  // 子供管理のヘルパー関数
  const addChild = () => {
    const currentYear = new Date().getFullYear();
    const newChild: Child = {
      id: nextChildId.toString(),
      birthYear: currentYear,
      kindergartenPrivate: false,
      elementaryPrivate: false,
      juniorHighPrivate: false,
      highSchoolPrivate: false,
      universityPrivate: true,
      expenses: [], // 初期は空の配列
      multiYearExpenses: [], // 初期は空の配列
      manuallyEdited: false, // 初期は未編集
    };

    // デフォルト教育費を生成（共通関数を使用）
    const costs = generateChildEducationCosts(newChild, input.currentAge);
    Object.assign(newChild, costs);

    setInput(prev => ({
      ...prev,
      children: [...(prev.children || []), newChild]
    }));
    setNextChildId(prev => prev + 1);
  };

  const updateChild = (id: string, field: keyof Child, value: string | number | boolean) => {
    // 誕生年または教育段階の変更の場合、手動編集フラグをチェック
    const isEducationRelatedField =
      field === 'birthYear' ||
      field === 'kindergartenPrivate' ||
      field === 'elementaryPrivate' ||
      field === 'juniorHighPrivate' ||
      field === 'highSchoolPrivate' ||
      field === 'universityPrivate';

    if (isEducationRelatedField) {
      const child = input.children?.find(c => c.id === id);
      if (child?.manuallyEdited) {
        // 手動編集済みの場合、確認ダイアログを表示
        setChildUpdateDialog({ childId: id, field, value });
        return;
      }

      // 手動編集なしの場合、教育費を再計算
      const currentYear = new Date().getFullYear();
      setInput(prev => ({
        ...prev,
        children: (prev.children || []).map(child => {
          if (child.id !== id) return child;

          // 設定を更新し、教育費を再生成
          const updated = { ...child, [field]: value, manuallyEdited: false };
          const newMultiYearExpenses = generateEducationMultiYearExpenses(updated, currentYear, prev.currentAge);
          const newExpenses = generateEducationExpenses(updated, currentYear, prev.currentAge);

          return {
            ...updated,
            multiYearExpenses: newMultiYearExpenses,
            expenses: newExpenses
          };
        })
      }));
    } else {
      // 教育関連以外のフィールドの場合、そのまま更新
      setInput(prev => ({
        ...prev,
        children: (prev.children || []).map(child =>
          child.id === id ? { ...child, [field]: value } : child
        )
      }));
    }
  };

  // 子供の教育費を生成するヘルパー関数
  const generateChildEducationCosts = (child: Child, currentAge: number) => {
    const currentYear = new Date().getFullYear();
    const newMultiYearExpenses = generateEducationMultiYearExpenses(child, currentYear, currentAge);
    const newExpenses = generateEducationExpenses(child, currentYear, currentAge);

    return {
      multiYearExpenses: newMultiYearExpenses,
      expenses: newExpenses
    };
  };

  // ダイアログで「変更する」を選択した時の処理
  const regenerateChildEducationCosts = (childId: string, field: keyof Child, value: string | number | boolean) => {
    setInput(prev => ({
      ...prev,
      children: (prev.children || []).map(child => {
        if (child.id !== childId) return child;

        // 設定を更新
        const updated = { ...child, [field]: value, manuallyEdited: false };

        // 教育費を生成（共通関数を使用）
        const costs = generateChildEducationCosts(updated, prev.currentAge);

        return {
          ...updated,
          ...costs
        };
      })
    }));
  };

  const removeChild = (id: string) => {
    setInput(prev => ({
      ...prev,
      children: (prev.children || []).filter(child => child.id !== id),
    }));
  };

  // 子供の教育費管理のヘルパー関数
  const addChildExpense = (childId: string) => {
    const newExpense: SpecialExpense = {
      id: `child-${childId}-expense-${nextChildExpenseId}`,
      name: '',
      amount: 0,
      autoGenerated: false,
      childId: childId,
    };
    setInput(prev => ({
      ...prev,
      children: (prev.children || []).map(child =>
        child.id === childId
          ? {
              ...child,
              expenses: [...child.expenses, newExpense],
              manuallyEdited: true
            }
          : child
      )
    }));
    setNextChildExpenseId(prev => prev + 1);
  };

  const updateChildExpense = (childId: string, expenseId: string, field: keyof SpecialExpense, value: string | number) => {
    setInput(prev => ({
      ...prev,
      children: (prev.children || []).map(child =>
        child.id === childId
          ? {
              ...child,
              expenses: child.expenses.map(expense =>
                expense.id === expenseId ? { ...expense, [field]: value } : expense
              ),
              manuallyEdited: true
            }
          : child
      )
    }));
  };

  const removeChildExpense = (childId: string, expenseId: string) => {
    setInput(prev => ({
      ...prev,
      children: (prev.children || []).map(child =>
        child.id === childId
          ? {
              ...child,
              expenses: child.expenses.filter(expense => expense.id !== expenseId),
              manuallyEdited: true
            }
          : child
      )
    }));
  };

  // 複数年支出管理のヘルパー関数
  const addMultiYearExpense = (childId: string) => {
    const newExpense: MultiYearEducationExpense = {
      id: `child-${childId}-multiyear-${nextMultiYearExpenseId}`,
      name: '',
      annualAmount: 0,
      childAge: undefined as any,
      years: undefined as any,
    };
    setInput(prev => ({
      ...prev,
      children: (prev.children || []).map(child =>
        child.id === childId
          ? {
              ...child,
              multiYearExpenses: [...child.multiYearExpenses, newExpense],
              manuallyEdited: true
            }
          : child
      )
    }));
    setNextMultiYearExpenseId(prev => prev + 1);
  };

  const updateMultiYearExpense = (childId: string, expenseId: string, field: keyof MultiYearEducationExpense, value: string | number) => {
    setInput(prev => ({
      ...prev,
      children: (prev.children || []).map(child =>
        child.id === childId
          ? {
              ...child,
              multiYearExpenses: child.multiYearExpenses.map(expense =>
                expense.id === expenseId ? { ...expense, [field]: value } : expense
              ),
              manuallyEdited: true
            }
          : child
      )
    }));
  };

  const removeMultiYearExpense = (childId: string, expenseId: string) => {
    setInput(prev => ({
      ...prev,
      children: (prev.children || []).map(child =>
        child.id === childId
          ? {
              ...child,
              multiYearExpenses: child.multiYearExpenses.filter(expense => expense.id !== expenseId),
              manuallyEdited: true
            }
          : child
      )
    }));
  };

  const toggleChildMultiYearExpenseDeleteMode = (childId: string) => {
    setChildMultiYearExpenseDeleteModes(prev => ({
      ...prev,
      [childId]: !prev[childId]
    }));
  };

  const toggleChildExpenseDeleteMode = (childId: string) => {
    setChildExpenseDeleteModes(prev => ({
      ...prev,
      [childId]: !prev[childId]
    }));
  };

  // 総資産額を計算（統一関数を使用）
  const calculateTotalAssets = () => {
    return calculateTotalAssetsUnified(input.assetHoldings, exchangeRate, 'manyen');
  };

  // 総月間返済額を計算（万円単位で返す）
  const calculateTotalMonthlyPayments = () => {
    const totalPayments = input.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
    return totalPayments / 10000; // 円から万円に変換
  };

  const handleInputChange = (field: keyof FireCalculationInput, value: number) => {
    setInput(prev => {
      const updated = {
        ...prev,
        [field]: value
      };

      // 現在年齢が変更された場合、想定寿命も自動更新
      if (field === 'currentAge') {
        updated.lifeExpectancy = calculateLifeExpectancy(value);

        // 範囲外になった区間を調整（年齢は固定のまま）
        updated.expenseSegments = prev.expenseSegments
          .filter(seg => seg.endAge > value) // 終了年齢が新現在年齢より後の区間のみ残す
          .map((seg, index, arr) => {
            const adjustedSeg = { ...seg };
            // 最初の区間の開始年齢を常に新現在年齢に調整
            if (index === 0) {
              adjustedSeg.startAge = value;
            }
            // 最後の区間の終了年齢を新寿命に調整
            if (index === arr.length - 1) {
              adjustedSeg.endAge = updated.lifeExpectancy;
            }
            return adjustedSeg;
          });

        // 区間が空になった場合はデフォルト区間を追加
        if (updated.expenseSegments.length === 0) {
          updated.expenseSegments = [
            { id: Date.now().toString(), startAge: value, endAge: updated.lifeExpectancy, monthlyExpenses: 0 }
          ];
        }

        // 給与プランの調整
        updated.salaryPlans = prev.salaryPlans
          .filter(plan => plan.endAge >= value) // 終了年齢が新現在年齢以上のもの
          .map(plan => ({
            ...plan,
            startAge: Math.max(plan.startAge, value), // 開始年齢を新現在年齢以上に
          }));

        // 年金プランの調整
        updated.pensionPlans = prev.pensionPlans
          .filter(plan => plan.endAge >= value) // 終了年齢が新現在年齢以上のもの
          .map(plan => ({
            ...plan,
            startAge: Math.max(plan.startAge, value), // 開始年齢を新現在年齢以上に
          }));

        // 臨時収入の調整（範囲外のものを削除）
        updated.specialIncomes = prev.specialIncomes.filter(
          income => !income.targetAge || income.targetAge >= value
        );

        // 特別支出の調整（範囲外のものを削除）
        updated.specialExpenses = prev.specialExpenses.filter(
          expense => !expense.targetAge || expense.targetAge >= value
        );
      }

      // 想定寿命が変更された場合、expenseSegments を調整
      if (field === 'lifeExpectancy') {
        updated.expenseSegments = prev.expenseSegments
          .filter(seg => seg.startAge < value) // 範囲外を除外
          .map((seg, index, arr) => {
            // 最後の区間は新しい lifeExpectancy で終了
            if (index === arr.length - 1) {
              seg.endAge = value;
            }
            // 終了年齢が新しい寿命を超える場合は調整
            if (seg.endAge > value) {
              seg.endAge = value;
            }
            return seg;
          });

        // 区間が空になった場合はデフォルト区間を追加
        if (updated.expenseSegments.length === 0) {
          updated.expenseSegments = [
            { id: Date.now().toString(), startAge: prev.currentAge, endAge: value, monthlyExpenses: 0 }
          ];
        }

        // 給与プランの調整
        updated.salaryPlans = prev.salaryPlans
          .filter(plan => plan.startAge <= value) // 開始年齢が新推定寿命以下のもの
          .map(plan => ({
            ...plan,
            endAge: Math.min(plan.endAge, value), // 終了年齢を新推定寿命以下に
          }));

        // 年金プランの調整
        updated.pensionPlans = prev.pensionPlans
          .filter(plan => plan.startAge <= value) // 開始年齢が新推定寿命以下のもの
          .map(plan => ({
            ...plan,
            endAge: Math.min(plan.endAge, value), // 終了年齢を新推定寿命以下に
          }));

        // 臨時収入の調整（範囲外のものを削除）
        updated.specialIncomes = prev.specialIncomes.filter(
          income => !income.targetAge || income.targetAge <= value
        );

        // 特別支出の調整（範囲外のものを削除）
        updated.specialExpenses = prev.specialExpenses.filter(
          expense => !expense.targetAge || expense.targetAge <= value
        );
      }

      return updated;
    });
  };


  // エクスポート機能
  const handleExport = () => {
    try {
      exportToJson(input);
      showSuccess('データをエクスポートしました');
    } catch (error) {
      console.error('エクスポートエラー:', error);
      showError('エクスポートに失敗しました');
    }
  };

  // インポート機能
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedData = await importFromJson(file);

      // 古いデータにmultiYearExpensesフィールドがない場合は初期化
      if (importedData.children) {
        importedData.children = importedData.children.map(child => ({
          ...child,
          multiYearExpenses: child.multiYearExpenses || []
        }));
      }

      setInput(importedData);

      // nextAssetIdを適切に設定
      setNextAssetId(calculateNextAssetId(importedData.assetHoldings));
      // nextLoanIdを適切に設定
      setNextLoanId(calculateNextLoanId(importedData.loans || []));
      // nextPensionIdを適切に設定
      setNextPensionId(calculateNextPensionId(importedData.pensionPlans || []));
      // nextSalaryIdを適切に設定
      setNextSalaryId(calculateNextSalaryId(importedData.salaryPlans || []));
      // nextSpecialExpenseIdを適切に設定
      setNextSpecialExpenseId(calculateNextSpecialExpenseId(importedData.specialExpenses || []));
      // nextSpecialIncomeIdを適切に設定
      setNextSpecialIncomeId(calculateNextSpecialIncomeId(importedData.specialIncomes || []));
      // nextChildIdを適切に設定
      setNextChildId(calculateNextChildId(importedData.children || []));


      showSuccess('データを正常にインポートしました');
    } catch (error) {
      console.error('インポートエラー:', error);
      showError(`インポートに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
    
    // ファイル選択をリセット
    event.target.value = '';
  };

  // リアルタイム計算：入力値が変更されたら自動的に再計算
  const results = useMemo(() => {
    // 為替レート読み込み中はnullを返す
    if (exchangeRateLoading) return null;

    try {
      // 子供の支出を統合し、childAgeをtargetAgeに変換
      const currentYear = new Date().getFullYear();
      const allChildExpenses = (input.children || []).flatMap(child =>
        child.expenses.map(expense => {
          // childAgeが設定されている場合は親の年齢に変換
          if (expense.childAge !== undefined && expense.childId) {
            const parentAge = calculateParentAgeFromChildAge(
              expense.childAge,
              child.birthYear,
              currentYear,
              input.currentAge
            );
            return { ...expense, targetAge: parentAge };
          }
          return expense;
        })
      );

      // 複数年支出を展開して統合（こちらも同様に変換される）
      const expandedMultiYearExpenses = expandAllChildrenMultiYearExpenses(
        input.children || [],
        currentYear,
        input.currentAge
      ).map(expense => {
        // childAgeが設定されている場合は親の年齢に変換
        if (expense.childAge !== undefined && expense.childId) {
          const child = input.children?.find(c => c.id === expense.childId);
          if (child) {
            const parentAge = calculateParentAgeFromChildAge(
              expense.childAge,
              child.birthYear,
              currentYear,
              input.currentAge
            );
            return { ...expense, targetAge: parentAge };
          }
        }
        return expense;
      });

      const combinedExpenses = [...input.specialExpenses, ...allChildExpenses, ...expandedMultiYearExpenses];

      // FIRE計算実行（為替レートを含む）
      const fireResult = FireCalculator.calculateFire({
        ...input,
        specialExpenses: combinedExpenses,
        exchangeRate: exchangeRate
      });

      // チャート用データに変換
      const chartData: ChartDataPoint[] = fireResult.projections.map(projection => ({
        year: projection.year + new Date().getFullYear(),
        age: projection.age,
        assets: projection.assets,
        expenses: projection.expenses,
        netWorth: projection.assets,
        fireAchieved: projection.fireAchieved,
      }));

      // メトリクス計算
      // 現在年齢での月間支出を取得
      const currentSegment = input.expenseSegments.find(
        s => input.currentAge >= s.startAge && input.currentAge <= s.endAge
      );
      const currentMonthlyExpenses = currentSegment?.monthlyExpenses ?? 0;
      const annualExpenses = currentMonthlyExpenses * 12;
      const currentAssets = calculateTotalAssets() * 10000; // 万円 → 円に変換
      const requiredAssets = fireResult.requiredAssets; // FIRE目標額（円）
      const fireProgress = requiredAssets > 0
        ? Math.min((currentAssets / requiredAssets) * 100, 100)
        : 0;

      const metrics: FireMetrics = {
        currentAssets,
        requiredAssets,
        fireProgress,
        yearsToFire: fireResult.yearsToFire,
        monthlyDeficit: fireResult.monthlyShortfall,
      };

      // 年次詳細データを計算
      const yearlyDetails = FireCalculator.calculateYearlyDetails({
        ...input,
        specialExpenses: combinedExpenses,
        exchangeRate: exchangeRate
      });

      return {
        chartData,
        metrics,
        requiredAssets: fireResult.yearsToFire < 0 ? undefined : fireResult.requiredAssets,
        yearlyDetails,
      };
    } catch (error) {
      console.error('Calculation error:', error);
      return null;
    }
  }, [input, exchangeRate, exchangeRateLoading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🔥 flickercast
          </h1>
        </div>
      </header>

      <main className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 入力フォーム */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              
              <div className="space-y-6">
                {/* 基本設定セクション */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    ⚙️ 基本設定
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="currentAge">現在年齢</Label>
                      <div className="relative">
                        <Input
                          id="currentAge"
                          type="number"
                          value={input.currentAge}
                          onChange={(e) => handleInputChange('currentAge', Number(e.target.value))}
                          min="18"
                          max="100"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                          歳
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="lifeExpectancy">想定寿命</Label>
                      <div className="relative">
                        <Input
                          id="lifeExpectancy"
                          type="number"
                          value={input.lifeExpectancy}
                          onChange={(e) => handleInputChange('lifeExpectancy', Number(e.target.value))}
                          min="70"
                          max="120"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                          歳
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 h-6">
                        <Label htmlFor="inflationRate">インフレ率</Label>
                        <Tooltip content="将来の支出・収入・資産がインフレ率に応じて増減します。下げると楽観的な想定に、上げると厳しめの想定になります。" position="left">
                          <span className="w-4 h-4 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs cursor-help">?</span>
                        </Tooltip>
                      </div>
                      <div className="relative">
                        <Input
                          id="inflationRate"
                          type="number"
                          value={input.inflationRate}
                          onChange={(e) => handleInputChange('inflationRate', Number(e.target.value))}
                          min="0"
                          max="15"
                          step="0.1"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 子供情報 */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-3">
                      <Label>子供情報</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={addChild}
                          size="sm"
                          variant="outline"
                          disabled={isChildDeleteMode}
                        >
                          追加
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setIsChildDeleteMode(!isChildDeleteMode)}
                          size="sm"
                          variant={isChildDeleteMode ? "default" : "outline"}
                          disabled={!isChildDeleteMode && (!input.children || input.children.length === 0)}
                        >
                          {isChildDeleteMode ? '完了' : '削除'}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {/* ヘッダー行（子供が存在し、削除モードでない場合のみ表示） */}
                      {input.children && input.children.length > 0 && !isChildDeleteMode && (
                        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 mb-2 items-center">
                          <Label className="text-sm font-medium mr-2">誕生年</Label>
                          <Label className="text-sm font-medium text-center w-8">幼</Label>
                          <Label className="text-sm font-medium text-center w-8">小</Label>
                          <Label className="text-sm font-medium text-center w-8">中</Label>
                          <Label className="text-sm font-medium text-center w-8">高</Label>
                          <Label className="text-sm font-medium text-center w-8">大</Label>
                        </div>
                      )}

                      {input.children && input.children.map((child) =>
                        isChildDeleteMode ? (
                          // 削除モード: 誕生年のみ表示、左側に赤い削除ボタン
                          <div key={child.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                            <Button
                              type="button"
                              onClick={() => removeChild(child.id)}
                              size="sm"
                              className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                            >
                              <span className="text-sm font-bold">−</span>
                            </Button>
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {child.birthYear}年生まれ
                            </span>
                          </div>
                        ) : (
                          // 通常モード: 誕生年 + 5つのトグルボタン
                          <div key={child.id} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 items-center">
                            <Input
                              type="number"
                              placeholder="2020"
                              value={child.birthYear}
                              onChange={(e) => updateChild(child.id, 'birthYear', Number(e.target.value))}
                              min="1900"
                              max="2100"
                              step="1"
                              className="w-24 mr-2"
                            />
                            <button
                              type="button"
                              onClick={() => updateChild(child.id, 'kindergartenPrivate', !child.kindergartenPrivate)}
                              className={`w-8 h-8 text-sm font-medium cursor-pointer transition-colors border ${
                                child.kindergartenPrivate
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-600'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-600'
                              }`}
                            >
                              {child.kindergartenPrivate ? '私' : '公'}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateChild(child.id, 'elementaryPrivate', !child.elementaryPrivate)}
                              className={`w-8 h-8 text-sm font-medium cursor-pointer transition-colors border ${
                                child.elementaryPrivate
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-600'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-600'
                              }`}
                            >
                              {child.elementaryPrivate ? '私' : '公'}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateChild(child.id, 'juniorHighPrivate', !child.juniorHighPrivate)}
                              className={`w-8 h-8 text-sm font-medium cursor-pointer transition-colors border ${
                                child.juniorHighPrivate
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-600'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-600'
                              }`}
                            >
                              {child.juniorHighPrivate ? '私' : '公'}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateChild(child.id, 'highSchoolPrivate', !child.highSchoolPrivate)}
                              className={`w-8 h-8 text-sm font-medium cursor-pointer transition-colors border ${
                                child.highSchoolPrivate
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-600'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-600'
                              }`}
                            >
                              {child.highSchoolPrivate ? '私' : '公'}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateChild(child.id, 'universityPrivate', !child.universityPrivate)}
                              className={`w-8 h-8 text-sm font-medium cursor-pointer transition-colors border ${
                                child.universityPrivate
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-600'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-600'
                              }`}
                            >
                              {child.universityPrivate ? '私' : '公'}
                            </button>
                          </div>
                        )
                      )}

                      {(!input.children || input.children.length === 0) && (
                        <p className="text-sm text-gray-500">
                          子供を追加すると子育て費用が自動的に追加されます
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 資産・収入セクション */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                    💰 資産・収入
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label>給与管理</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={addSalaryPlan}
                        size="sm"
                        variant="outline"
                        disabled={isSalaryDeleteMode}
                      >
                        追加
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setIsSalaryDeleteMode(!isSalaryDeleteMode)}
                        size="sm"
                        variant={isSalaryDeleteMode ? "default" : "outline"}
                      >
                        {isSalaryDeleteMode ? '完了' : '削除'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {/* ヘッダー行（給与プランが存在し、削除モードでない場合のみ表示） */}
                    {input.salaryPlans.length > 0 && !isSalaryDeleteMode && (
                      <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr] gap-3 mb-2">
                        <Label className="text-sm font-medium">会社名</Label>
                        <Label className="text-sm font-medium">手取り年収[万円]</Label>
                        <Label className="text-sm font-medium">開始年齢</Label>
                        <Label className="text-sm font-medium">退職年齢</Label>
                      </div>
                    )}

                    {input.salaryPlans.map((plan) =>
                      isSalaryDeleteMode ? (
                        // 削除モード: 会社名のみ表示、左側に赤い削除ボタン
                        <div key={plan.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                          <Button
                            type="button"
                            onClick={() => removeSalaryPlan(plan.id)}
                            size="sm"
                            className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                          >
                            <span className="text-sm font-bold">−</span>
                          </Button>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {plan.name || '未設定'}
                          </span>
                        </div>
                      ) : (
                        // 通常モード: すべての入力フィールドを表示（ラベルなし）
                        <div key={plan.id} className="grid grid-cols-[2fr_1.2fr_1fr_1fr] gap-3">
                          <Input
                            placeholder="トヨタ自動車"
                            value={plan.name}
                            onChange={(e) => updateSalaryPlan(plan.id, 'name', e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="1000"
                            value={plan.annualAmount ? (plan.annualAmount / 10000) : ''}
                            onChange={(e) => updateSalaryPlan(plan.id, 'annualAmount', Number(e.target.value) * 10000)}
                            min="0"
                            step="1"
                            noSpinner
                          />
                          <Input
                            type="number"
                            placeholder="38"
                            value={plan.startAge}
                            onChange={(e) => updateSalaryPlan(plan.id, 'startAge', Number(e.target.value))}
                            min="0"
                            max={plan.endAge}
                            step="1"
                          />
                          <Input
                            type="number"
                            placeholder="65"
                            value={plan.endAge}
                            onChange={(e) => updateSalaryPlan(plan.id, 'endAge', Number(e.target.value))}
                            min={plan.startAge}
                            max={input.lifeExpectancy}
                            step="1"
                          />
                        </div>
                      )
                    )}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-3">
                        <Label>年金管理</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        onClick={addPensionPlan}
                        size="sm"
                        variant="outline"
                        disabled={isPensionDeleteMode}
                      >
                        追加
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => setIsPensionDeleteMode(!isPensionDeleteMode)}
                        size="sm"
                        variant={isPensionDeleteMode ? "default" : "outline"}
                      >
                        {isPensionDeleteMode ? '完了' : '削除'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {/* ヘッダー行（年金プランが存在し、削除モードでない場合のみ表示） */}
                    {input.pensionPlans.length > 0 && !isPensionDeleteMode && (
                      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-3 mb-2">
                        <Label className="text-sm font-medium">年金名</Label>
                        <Label className="text-sm font-medium">年受給額</Label>
                        <Label className="text-sm font-medium"></Label>
                        <Label className="text-sm font-medium">開始年齢</Label>
                        <Label className="text-sm font-medium">終了年齢</Label>
                      </div>
                    )}
                    
                    {input.pensionPlans.map((plan) =>
                      isPensionDeleteMode ? (
                        // 削除モード: 年金名のみ表示、左側に赤い削除ボタン
                        <div key={plan.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                          <Button 
                            type="button"
                            onClick={() => removePensionPlan(plan.id)}
                            size="sm"
                            className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                          >
                            <span className="text-sm font-bold">−</span>
                          </Button>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {plan.name || '未設定'}
                          </span>
                        </div>
                      ) : (
                        // 通常モード: すべての入力フィールドを表示（ラベルなし）
                        <div key={plan.id} className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-3">
                          <Input
                            placeholder="国民年金"
                            value={plan.name}
                            onChange={(e) => updatePensionPlan(plan.id, 'name', e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="1800000"
                            value={plan.annualAmount ?? ''}
                            onChange={(e) => updatePensionPlan(plan.id, 'annualAmount', Number(e.target.value))}
                            min="0"
                            step="1"
                            noSpinner
                          />
                          <select
                            value={plan.currency || 'JPY'}
                            onChange={(e) => updatePensionPlan(plan.id, 'currency', e.target.value)}
                            className="h-10 px-1 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-0"
                          >
                            <option value="JPY">JPY</option>
                            <option value="USD">USD</option>
                          </select>
                          <Input
                            type="number"
                            placeholder="65"
                            value={plan.startAge}
                            onChange={(e) => updatePensionPlan(plan.id, 'startAge', Number(e.target.value))}
                            min="0"
                            max={plan.endAge}
                            step="1"
                          />
                          <Input
                            type="number"
                            placeholder="84"
                            value={plan.endAge}
                            onChange={(e) => updatePensionPlan(plan.id, 'endAge', Number(e.target.value))}
                            min={plan.startAge}
                            max={input.lifeExpectancy}
                            step="1"
                          />
                        </div>
                      )
                    )}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-3">
                        <Label>金融資産管理</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        onClick={addAssetHolding}
                        size="sm"
                        variant="outline"
                        disabled={isDeleteMode}
                      >
                        追加
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => setIsDeleteMode(!isDeleteMode)}
                        size="sm"
                        variant={isDeleteMode ? "default" : "outline"}
                      >
                        {isDeleteMode ? '完了' : '削除'}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {/* ヘッダー行（金融資産が存在し、削除モードでない場合のみ表示） */}
                    {input.assetHoldings.length > 0 && !isDeleteMode && (
                      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-2 mb-2">
                        <Label className="text-sm font-medium">銘柄名</Label>
                        <Label className="text-sm font-medium">数量</Label>
                        <Label className="text-sm font-medium">単価</Label>
                        <Label className="text-sm font-medium"></Label>
                        <Label className="text-sm font-medium">利回り</Label>
                      </div>
                    )}
                    
                    {input.assetHoldings.map((holding) => (
                      isDeleteMode ? (
                        // 削除モード: 銘柄名のみ表示、左側に赤い削除ボタン
                        <div key={holding.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                          <Button 
                            type="button"
                            onClick={() => removeAssetHolding(holding.id)}
                            size="sm"
                            className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                          >
                            <span className="text-sm font-bold">−</span>
                          </Button>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {holding.name || '未設定'}
                          </span>
                        </div>
                      ) : (
                        // 通常モード: 全ての入力欄を表示
                        <div key={holding.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-2 items-center">
                          <AutocompleteInput
                            placeholder="AAPL"
                            value={holding.name}
                            onChange={(value) => updateAssetHolding(holding.id, 'name', value)}
                            onSelect={(stock) => handleStockSelect(holding.id, stock)}
                            onBlur={() => handleStockNameBlur(holding.id, holding.name)}
                            symbols={stockSymbols}
                          />
                          <Input
                            type="number"
                            placeholder="100"
                            value={holding.quantity || ''}
                            onChange={(e) => updateAssetHolding(holding.id, 'quantity', Number(e.target.value))}
                            min="0"
                            noSpinner
                          />
                          <Input
                            type="number"
                            placeholder="150"
                            value={holding.pricePerUnit || ''}
                            onChange={(e) => updateAssetHolding(holding.id, 'pricePerUnit', Number(e.target.value))}
                            min="0"
                            step="0.1"
                            noSpinner
                          />
                          <select
                            value={holding.currency || 'JPY'}
                            onChange={(e) => updateAssetHolding(holding.id, 'currency', e.target.value)}
                            className="h-10 px-1 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-0"
                          >
                            <option value="JPY">JPY</option>
                            <option value="USD">USD</option>
                          </select>
                          <div className="relative">
                            <Input
                              type="number"
                              placeholder="5"
                              value={holding.expectedReturn ?? ''}
                              onChange={(e) => updateAssetHolding(holding.id, 'expectedReturn', Number(e.target.value))}
                              min="0"
                              max="30"
                              step="0.1"
                              className="pr-8"
                              noSpinner
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                              %
                            </span>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                  
                  <div className="mt-3 p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">
                      合計資産額: {calculateTotalAssets().toFixed(1)}万円
                    </span>
                    <br />
                    <span className="text-xs text-gray-500">
                      {exchangeRateLoading ? (
                        '(USD/JPY: 読み込み中...)'
                      ) : exchangeRateFetchFailed ? (
                        `(USD/JPY: ${exchangeRate?.toFixed(2) || '150'} - 取得失敗 デフォルト値使用)`
                      ) : exchangeRate ? (
                        `(USD/JPY: ${exchangeRate.toFixed(2)})`
                      ) : (
                        '(USD/JPY: 取得失敗)'
                      )}
                    </span>
                      </div>
                    </div>


                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-3">
                        <Label>臨時収入管理</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        onClick={addSpecialIncome}
                        size="sm"
                        variant="outline"
                        disabled={isSpecialIncomeDeleteMode}
                      >
                        追加
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => setIsSpecialIncomeDeleteMode(!isSpecialIncomeDeleteMode)}
                        size="sm"
                        variant={isSpecialIncomeDeleteMode ? "default" : "outline"}
                      >
                        {isSpecialIncomeDeleteMode ? '完了' : '削除'}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {/* ヘッダー行（臨時収入が存在し、削除モードでない場合のみ表示） */}
                    {input.specialIncomes.length > 0 && !isSpecialIncomeDeleteMode && (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <Label className="text-sm font-medium">収入名</Label>
                        <Label className="text-sm font-medium">収入額 [万円]</Label>
                        <Label className="text-sm font-medium">年齢</Label>
                      </div>
                    )}
                    
                    {input.specialIncomes.map((income) => (
                      isSpecialIncomeDeleteMode ? (
                        // 削除モード: 収入名のみ表示、左側に赤い削除ボタン
                        <div key={income.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                          <Button 
                            type="button"
                            onClick={() => removeSpecialIncome(income.id)}
                            size="sm"
                            className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                          >
                            <span className="text-sm font-bold">−</span>
                          </Button>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {income.name || '未設定'}
                          </span>
                        </div>
                      ) : (
                        // 通常モード: 全ての入力欄を表示
                        <div key={income.id} className="grid grid-cols-3 gap-2 items-center">
                          <Input
                            placeholder="退職金"
                            value={income.name}
                            onChange={(e) => updateSpecialIncome(income.id, 'name', e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="500"
                            value={income.amount ? (income.amount / 10000) : ''}
                            onChange={(e) => updateSpecialIncome(income.id, 'amount', Number(e.target.value) * 10000)}
                            min="0"
                            step="1"
                            noSpinner
                          />
                          <div className="relative">
                            <Input
                              type="number"
                              placeholder={input.currentAge > 0 ? input.currentAge.toString() : "50"}
                              value={income.targetAge ?? ''}
                              onChange={(e) => updateSpecialIncome(income.id, 'targetAge', Number(e.target.value))}
                              min={input.currentAge}
                              max={input.lifeExpectancy}
                              step="1"
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                              歳
                            </span>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                    </div>
                  </div>
                </div>

                {/* 支出・負債セクション */}
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                    💸 支出・負債
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <ExpenseTimeline
                        segments={input.expenseSegments}
                        currentAge={input.currentAge}
                        lifeExpectancy={input.lifeExpectancy}
                        onSegmentsChange={(segments) => setInput(prev => ({ ...prev, expenseSegments: segments }))}
                      />
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-3">
                        <Label>ローン管理</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        onClick={addLoan}
                        size="sm"
                        variant="outline"
                        disabled={isLoanDeleteMode}
                      >
                        追加
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => setIsLoanDeleteMode(!isLoanDeleteMode)}
                        size="sm"
                        variant={isLoanDeleteMode ? "default" : "outline"}
                      >
                        {isLoanDeleteMode ? '完了' : '削除'}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {/* ヘッダー行（ローンが存在し、削除モードでない場合のみ表示） */}
                    {input.loans.length > 0 && !isLoanDeleteMode && (
                      <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_1.1fr] gap-2 mb-2">
                        <Label className="text-sm font-medium">ローン名</Label>
                        <Label className="text-sm font-medium">残高 [万円]</Label>
                        <Label className="text-sm font-medium">金利</Label>
                        <Label className="text-sm font-medium">月返済 [万円]</Label>
                      </div>
                    )}
                    
                    {input.loans.map((loan) => (
                      isLoanDeleteMode ? (
                        // 削除モード: ローン名のみ表示、左側に赤い削除ボタン
                        <div key={loan.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                          <Button 
                            type="button"
                            onClick={() => removeLoan(loan.id)}
                            size="sm"
                            className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                          >
                            <span className="text-sm font-bold">−</span>
                          </Button>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {loan.name || '未設定'}
                          </span>
                        </div>
                      ) : (
                        // 通常モード: 全ての入力欄を表示
                        <div key={loan.id} className="grid grid-cols-[1.5fr_0.9fr_0.9fr_1fr] gap-2 items-center">
                          <Input
                            placeholder="住宅ローン"
                            value={loan.name}
                            onChange={(e) => updateLoan(loan.id, 'name', e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="2000"
                            value={loan.balance ? (loan.balance / 10000) : ''}
                            onChange={(e) => updateLoan(loan.id, 'balance', Number(e.target.value) * 10000)}
                            min="0"
                            step="1"
                            noSpinner
                          />
                          <div className="relative">
                            <Input
                              type="number"
                              placeholder="0.1"
                              value={loan.interestRate ?? ''}
                              onChange={(e) => updateLoan(loan.id, 'interestRate', Number(e.target.value))}
                              min="0"
                              max="30"
                              step="0.01"
                              className="pr-8"
                              noSpinner
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                              %
                            </span>
                          </div>
                          <Input
                            type="number"
                            placeholder="10"
                            value={loan.monthlyPayment ? (loan.monthlyPayment / 10000) : ''}
                            onChange={(e) => updateLoan(loan.id, 'monthlyPayment', Number(e.target.value) * 10000)}
                            min="0"
                            step="0.1"
                            noSpinner
                          />
                        </div>
                      )
                    ))}
                  </div>
                  
                      <div className="mt-3 p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">
                          総月間返済額: {calculateTotalMonthlyPayments().toFixed(1)}万円
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-3">
                        <Label>特別支出管理</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={addSpecialExpense}
                        size="sm"
                        variant="outline"
                        disabled={isSpecialExpenseDeleteMode}
                      >
                        追加
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setIsSpecialExpenseDeleteMode(!isSpecialExpenseDeleteMode)}
                        size="sm"
                        variant={isSpecialExpenseDeleteMode ? "default" : "outline"}
                      >
                        {isSpecialExpenseDeleteMode ? '完了' : '削除'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* ヘッダー行（特別支出が存在し、削除モードでない場合のみ表示） */}
                    {input.specialExpenses.length > 0 && !isSpecialExpenseDeleteMode && (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <Label className="text-sm font-medium">支出名</Label>
                        <Label className="text-sm font-medium">支出額 [万円]</Label>
                        <Label className="text-sm font-medium">年齢</Label>
                      </div>
                    )}

                    {input.specialExpenses.map((expense) => (
                      isSpecialExpenseDeleteMode ? (
                        // 削除モード: 支出名のみ表示、左側に赤い削除ボタン
                        <div key={expense.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                          <Button
                            type="button"
                            onClick={() => removeSpecialExpense(expense.id)}
                            size="sm"
                            className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                          >
                            <span className="text-sm font-bold">−</span>
                          </Button>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {expense.name || '未設定'}
                          </span>
                        </div>
                      ) : (
                        // 通常モード: 全ての入力欄を表示
                        <div key={expense.id} className="grid grid-cols-3 gap-2 items-center">
                          <Input
                            placeholder="結婚式"
                            value={expense.name}
                            onChange={(e) => updateSpecialExpense(expense.id, 'name', e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="100"
                            value={expense.amount ? (expense.amount / 10000) : ''}
                            onChange={(e) => updateSpecialExpense(expense.id, 'amount', Number(e.target.value) * 10000)}
                            min="0"
                            step="1"
                            noSpinner
                          />
                          <div className="relative">
                            <Input
                              type="number"
                              placeholder={input.currentAge > 0 ? input.currentAge.toString() : "50"}
                              value={expense.targetAge ?? ''}
                              onChange={(e) => updateSpecialExpense(expense.id, 'targetAge', Number(e.target.value))}
                              min={input.currentAge}
                              max={input.lifeExpectancy}
                              step="1"
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                              歳
                            </span>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                    </div>

                    {/* 子供ごとの支出セクション */}
                    {input.children && input.children.length > 0 && input.children.map((child, index) => {
                      // 私立の教育段階をリスト化
                      const privateStages = [];
                      if (child.kindergartenPrivate) privateStages.push('幼');
                      if (child.elementaryPrivate) privateStages.push('小');
                      if (child.juniorHighPrivate) privateStages.push('中');
                      if (child.highSchoolPrivate) privateStages.push('高');
                      if (child.universityPrivate) privateStages.push('大');

                      const educationLabel = privateStages.length === 0
                        ? '全て公立'
                        : privateStages.length === 5
                        ? '全て私立'
                        : `私立: ${privateStages.join('・')}`;

                      const childNumber = ['第一子', '第二子', '第三子', '第四子', '第五子'][index] || `第${index + 1}子`;

                      const isDeleteMode = childExpenseDeleteModes[child.id] || false;

                      return (
                        <div key={child.id} className="mt-6">
                          <div className="mb-3">
                            <Label className="text-sm font-semibold">
                              子育て（{childNumber}） - {child.birthYear}年生まれ、{educationLabel}
                            </Label>
                          </div>

                          {/* 単年支出セクション */}
                          <div className="flex justify-between items-center mb-3">
                            <Label className="text-sm font-medium text-gray-700">
                              単年支出
                            </Label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                onClick={() => addChildExpense(child.id)}
                                size="sm"
                                variant="outline"
                                disabled={isDeleteMode}
                              >
                                追加
                              </Button>
                              <Button
                                type="button"
                                onClick={() => toggleChildExpenseDeleteMode(child.id)}
                                size="sm"
                                variant={isDeleteMode ? "default" : "outline"}
                                disabled={child.expenses.length === 0}
                              >
                                {isDeleteMode ? '完了' : '削除'}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {/* ヘッダー行（削除モードでない場合のみ表示） */}
                            {child.expenses.length > 0 && !isDeleteMode && (
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                <Label className="text-sm font-medium">支出名</Label>
                                <Label className="text-sm font-medium">支出額 [万円]</Label>
                                <Label className="text-sm font-medium">子供年齢</Label>
                              </div>
                            )}

                            {child.expenses.map((expense) =>
                              isDeleteMode ? (
                                // 削除モード: 支出名のみ表示、左側に赤い削除ボタン
                                <div key={expense.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                                  <Button
                                    type="button"
                                    onClick={() => removeChildExpense(child.id, expense.id)}
                                    size="sm"
                                    className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                                  >
                                    <span className="text-sm font-bold">−</span>
                                  </Button>
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {expense.name || '未設定'}
                                  </span>
                                </div>
                              ) : (
                                // 通常モード: 全ての入力欄を表示
                                <div key={expense.id} className="grid grid-cols-3 gap-2 items-center">
                                  <Input
                                    placeholder="七五三"
                                    value={expense.name}
                                    onChange={(e) => updateChildExpense(child.id, expense.id, 'name', e.target.value)}
                                  />
                                  <Input
                                    type="number"
                                    placeholder="10"
                                    value={expense.amount ? (expense.amount / 10000) : ''}
                                    onChange={(e) => updateChildExpense(child.id, expense.id, 'amount', Number(e.target.value) * 10000)}
                                    min="0"
                                    step="1"
                                    noSpinner
                                  />
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      placeholder="7"
                                      value={expense.childAge ?? ''}
                                      onChange={(e) => updateChildExpense(child.id, expense.id, 'childAge', Number(e.target.value))}
                                      min={0}
                                      max={30}
                                      step="1"
                                      className="pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                                      歳
                                    </span>
                                  </div>
                                </div>
                              )
                            )}

                            {child.expenses.length === 0 && (
                              <p className="text-sm text-gray-500 py-2">
                                教育費が自動生成されます
                              </p>
                            )}
                          </div>

                          {/* 複数年支出セクション */}
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                              <Label className="text-sm font-medium text-gray-700">
                                複数年支出（学費・習い事等）
                              </Label>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  onClick={() => addMultiYearExpense(child.id)}
                                  size="sm"
                                  variant="outline"
                                  disabled={childMultiYearExpenseDeleteModes[child.id] || false}
                                >
                                  追加
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => toggleChildMultiYearExpenseDeleteMode(child.id)}
                                  size="sm"
                                  variant={childMultiYearExpenseDeleteModes[child.id] ? "default" : "outline"}
                                  disabled={child.multiYearExpenses.length === 0}
                                >
                                  {childMultiYearExpenseDeleteModes[child.id] ? '完了' : '削除'}
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              {/* ヘッダー行（削除モードでない場合のみ表示） */}
                              {child.multiYearExpenses.length > 0 && !childMultiYearExpenseDeleteModes[child.id] && (
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                  <Label className="text-sm font-medium">支出名</Label>
                                  <Label className="text-sm font-medium">年間支出額 [万円]</Label>
                                  <Label className="text-sm font-medium">子供年齢</Label>
                                  <Label className="text-sm font-medium">年数</Label>
                                </div>
                              )}

                              {child.multiYearExpenses.map((expense) =>
                                childMultiYearExpenseDeleteModes[child.id] ? (
                                  // 削除モード
                                  <div key={expense.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                                    <Button
                                      type="button"
                                      onClick={() => removeMultiYearExpense(child.id, expense.id)}
                                      size="sm"
                                      className="w-5 h-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                                    >
                                      <span className="text-sm font-bold">−</span>
                                    </Button>
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {expense.name || '未設定'} ({expense.childAge}歳から{expense.years}年間、年{(expense.annualAmount / 10000).toFixed(0)}万円)
                                    </span>
                                  </div>
                                ) : (
                                  // 通常モード
                                  <div key={expense.id} className="grid grid-cols-4 gap-2 items-center">
                                    <Input
                                      placeholder="ピアノレッスン"
                                      value={expense.name}
                                      onChange={(e) => updateMultiYearExpense(child.id, expense.id, 'name', e.target.value)}
                                    />
                                    <Input
                                      type="number"
                                      placeholder="10"
                                      value={expense.annualAmount ? (expense.annualAmount / 10000) : ''}
                                      onChange={(e) => updateMultiYearExpense(child.id, expense.id, 'annualAmount', Number(e.target.value) * 10000)}
                                      min="0"
                                      step="1"
                                      noSpinner
                                    />
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        placeholder="5"
                                        value={expense.childAge ?? ''}
                                        onChange={(e) => updateMultiYearExpense(child.id, expense.id, 'childAge', Number(e.target.value))}
                                        min="0"
                                        max="30"
                                        step="1"
                                        className="pr-8"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                                        歳
                                      </span>
                                    </div>
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        placeholder="5"
                                        value={expense.years ?? ''}
                                        onChange={(e) => updateMultiYearExpense(child.id, expense.id, 'years', Number(e.target.value))}
                                        min="1"
                                        max="25"
                                        step="1"
                                        className="pr-8"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-sm">
                                        年
                                      </span>
                                    </div>
                                  </div>
                                )
                              )}

                              {child.multiYearExpenses.length === 0 && (
                                <p className="text-sm text-gray-500 py-2">
                                  学費や習い事など、複数年に渡る支出を追加できます
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* データ管理セクション */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">データ管理</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleExport}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      エクスポート
                    </Button>
                    <div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        style={{ display: 'none' }}
                        id="import-file"
                      />
                      <Button
                        onClick={() => document.getElementById('import-file')?.click()}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        インポート
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    設定データをJSONファイルで保存・読み込みできます<br />
                    データはお使いの端末にのみ保存されます。定期的にエクスポートしてバックアップを保存してください
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 結果表示 */}
          <div className="lg:col-span-2 space-y-8">
            {results ? (
              <>
                {/* サマリー */}
                <FireSummary metrics={results.metrics} />

                {/* チャート */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    資産推移予測
                  </h2>
                  <FireProjectionChart
                    data={results.chartData}
                    targetAmount={results.requiredAssets}
                    className="w-full h-96"
                  />
                </div>

                {/* 年次詳細データ */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      年次詳細データ
                    </h2>
                    <Button
                      onClick={() => setShowYearlyDetails(!showYearlyDetails)}
                      variant="outline"
                      size="sm"
                    >
                      {showYearlyDetails ? '📊 詳細を非表示' : '📊 詳細を表示'}
                    </Button>
                  </div>

                  {showYearlyDetails && results.yearlyDetails && (
                    <YearlyDetailTable data={results.yearlyDetails} />
                  )}

                  {!showYearlyDetails && (
                    <p className="text-gray-500 text-sm">
                      年齢ごとの収入・支出・資産の詳細を表形式で確認できます。「詳細を表示」ボタンをクリックしてください。
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-6xl mb-4">⏳</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  データ読み込み中...
                </h2>
                <p className="text-gray-600">
                  為替レート情報を取得しています
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-600">
              © 2025 flickercast.
            </p>
          </div>
        </div>
      </footer>

      {/* 子供情報変更時の確認ダイアログ */}
      {childUpdateDialog && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 min-w-96">
            <h3 className="text-lg font-semibold mb-3">子育て費用の再計算</h3>
            <p className="text-sm text-gray-700 mb-4">
              この子供の情報を変更しました。子育て費用を再計算すると、この子供に関する手動で追加・編集した費用が全てリセットされ、自動計算された費用に置き換わります。再計算しますか？
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  // 再計算しない: 設定は変更するが教育費は再生成しない、フラグは維持
                  setInput(prev => ({
                    ...prev,
                    children: (prev.children || []).map(child =>
                      child.id === childUpdateDialog.childId
                        ? { ...child, [childUpdateDialog.field]: childUpdateDialog.value, manuallyEdited: true }
                        : child
                    )
                  }));
                  setChildUpdateDialog(null);
                }}
                variant="outline"
              >
                再計算しない
              </Button>
              <Button
                onClick={() => {
                  // 変更する: 教育費を再生成
                  regenerateChildEducationCosts(
                    childUpdateDialog.childId,
                    childUpdateDialog.field,
                    childUpdateDialog.value
                  );
                  setChildUpdateDialog(null);
                }}
              >
                再計算する
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <HomeContent />
    </ToastProvider>
  );
}
