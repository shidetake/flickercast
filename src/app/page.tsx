'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip } from '@/components/ui/tooltip';
import { FireCalculator, FireCalculationInput } from '@/lib/fire-calculator';
import FireProjectionChart from '@/components/charts/fire-projection-chart';
import FireSummary from '@/components/dashboard/fire-summary';
import { ChartDataPoint, FireMetrics, AssetHolding, Loan, PensionPlan, SpecialExpense, SpecialIncome } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { saveToLocalStorage, loadFromLocalStorage, exportToJson, importFromJson } from '@/lib/storage';
import { useToast, ToastProvider } from '@/lib/toast-context';
import { calculateTotalAssets as calculateTotalAssetsUnified } from '@/lib/asset-calculator';

function HomeContent() {
  const { showSuccess, showError } = useToast();

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
    retirementAge: 65,
    assetHoldings: [
      { id: '1', name: '', quantity: 0, pricePerUnit: 0, currency: 'JPY' },
    ], // デフォルトは1つの空の銘柄
    loans: [
      { id: '1', name: '', balance: 0, interestRate: 0, monthlyPayment: 0 },
    ], // デフォルトは1つの空のローン
    pensionPlans: [
      { id: '1', name: '', annualAmount: 0, currency: 'JPY', startAge: 65, endAge: calculateLifeExpectancy(38) },
    ], // デフォルトは1つの空の年金
    specialExpenses: [
      { id: '1', name: '', amount: 0, targetAge: 40 },
    ], // デフォルトは1つの空の特別支出
    specialIncomes: [
      { id: '1', name: '', amount: 0, targetAge: 50 },
    ], // デフォルトは1つの空の臨時収入
    monthlyExpenses: 300000, // 内部では円のまま
    annualNetIncome: 10000000, // 内部では円のまま（1000万円）
    postRetirementAnnualIncome: 0, // 内部では円のまま（0円）
    expectedAnnualReturn: 5,
    inflationRate: 2,
    lifeExpectancy: calculateLifeExpectancy(38),
  });

  const [input, setInput] = useState<FireCalculationInput>(createDefaultInput());
  const [nextAssetId, setNextAssetId] = useState(2); // 次に使用するAsset ID（デフォルトは1なので2から開始）
  const [nextLoanId, setNextLoanId] = useState(2); // 次に使用するLoan ID（デフォルトは1なので2から開始）
  const [nextPensionId, setNextPensionId] = useState(2); // 次に使用するPension ID（デフォルトは1なので2から開始）
  const [nextSpecialExpenseId, setNextSpecialExpenseId] = useState(2); // 次に使用するSpecialExpense ID（デフォルトは1なので2から開始）
  const [nextSpecialIncomeId, setNextSpecialIncomeId] = useState(2); // 次に使用するSpecialIncome ID（デフォルトは1なので2から開始）
  const [isDeleteMode, setIsDeleteMode] = useState(false); // 削除モード状態
  const [isLoanDeleteMode, setIsLoanDeleteMode] = useState(false); // ローン削除モード状態
  const [isPensionDeleteMode, setIsPensionDeleteMode] = useState(false); // 年金削除モード状態
  const [isSpecialExpenseDeleteMode, setIsSpecialExpenseDeleteMode] = useState(false); // 特別支出削除モード状態
  const [isSpecialIncomeDeleteMode, setIsSpecialIncomeDeleteMode] = useState(false); // 臨時収入削除モード状態

  // 万円単位での表示用の値
  const [displayValues, setDisplayValues] = useState({
    monthlyExpenses: 30, // 30万円
    annualNetIncome: 1000, // 1000万円
    postRetirementAnnualIncome: 0, // 0万円
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<{
    chartData: ChartDataPoint[];
    metrics: FireMetrics;
    requiredAssets: number;
  } | null>(null);
  
  // USD/JPY為替レート関連の状態
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(true);

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
      setExchangeRate(null);
    } finally {
      setExchangeRateLoading(false);
    }
  };

  // ページ読み込み時にlocalStorageからデータを復元
  useEffect(() => {
    const savedData = loadFromLocalStorage();
    if (savedData) {
      setInput(savedData);
      
      // nextAssetIdを適切に設定
      setNextAssetId(calculateNextAssetId(savedData.assetHoldings));
      // nextLoanIdを適切に設定
      setNextLoanId(calculateNextLoanId(savedData.loans || []));
      // nextPensionIdを適切に設定
      setNextPensionId(calculateNextPensionId(savedData.pensionPlans || []));
      // nextSpecialExpenseIdを適切に設定
      setNextSpecialExpenseId(calculateNextSpecialExpenseId(savedData.specialExpenses || []));
      // nextSpecialIncomeIdを適切に設定
      setNextSpecialIncomeId(calculateNextSpecialIncomeId(savedData.specialIncomes || []));
      
      // 表示値も更新
      setDisplayValues({
        monthlyExpenses: savedData.monthlyExpenses / 10000,
        annualNetIncome: savedData.annualNetIncome / 10000,
        postRetirementAnnualIncome: savedData.postRetirementAnnualIncome / 10000,
      });
    }
  }, []);

  // 為替レート取得
  useEffect(() => {
    fetchExchangeRate();
  }, []);

  // データ変更時にlocalStorageへ自動保存
  useEffect(() => {
    saveToLocalStorage(input);
  }, [input]);

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
      annualAmount: 0,
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

  // ローン管理のヘルパー関数
  const addLoan = () => {
    const newLoan: Loan = {
      id: nextLoanId.toString(),
      name: '',
      balance: 0,
      interestRate: 0,
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
      targetAge: input.currentAge + 5,
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
      targetAge: input.currentAge + 10,
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
      }
      
      return updated;
    });
  };

  const handleDisplayValueChange = (field: keyof typeof displayValues, value: number) => {
    setDisplayValues(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 金額フィールドは万円 → 円に変換
    const actualValue = value * 10000;
    
    setInput(prev => ({
      ...prev,
      [field]: actualValue
    }));
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
      setInput(importedData);
      
      // nextAssetIdを適切に設定
      setNextAssetId(calculateNextAssetId(importedData.assetHoldings));
      // nextLoanIdを適切に設定
      setNextLoanId(calculateNextLoanId(importedData.loans || []));
      // nextPensionIdを適切に設定
      setNextPensionId(calculateNextPensionId(importedData.pensionPlans || []));
      // nextSpecialExpenseIdを適切に設定
      setNextSpecialExpenseId(calculateNextSpecialExpenseId(importedData.specialExpenses || []));
      // nextSpecialIncomeIdを適切に設定
      setNextSpecialIncomeId(calculateNextSpecialIncomeId(importedData.specialIncomes || []));
      
      // 表示値も更新
      setDisplayValues({
        monthlyExpenses: importedData.monthlyExpenses / 10000,
        annualNetIncome: importedData.annualNetIncome / 10000,
        postRetirementAnnualIncome: importedData.postRetirementAnnualIncome / 10000,
      });
      
      showSuccess('データを正常にインポートしました');
    } catch (error) {
      console.error('インポートエラー:', error);
      showError(`インポートに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
    
    // ファイル選択をリセット
    event.target.value = '';
  };

  const calculateFire = async () => {
    setIsCalculating(true);
    
    try {
      // FIRE計算実行（為替レートを含む）
      const fireResult = FireCalculator.calculateFire({
        ...input,
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
      const annualExpenses = input.monthlyExpenses * 12;
      const currentAssets = calculateTotalAssets() * 10000; // 万円 → 円に変換
      const currentFireNumber = currentAssets / annualExpenses;
      const requiredFireNumber = 25; // 4%ルール
      const fireProgress = Math.min((currentFireNumber / requiredFireNumber) * 100, 100);

      const metrics: FireMetrics = {
        currentFireNumber,
        requiredFireNumber,
        fireProgress,
        yearsToFire: fireResult.yearsToFire,
        monthlyDeficit: fireResult.monthlyShortfall,
      };

      setResults({
        chartData,
        metrics,
        requiredAssets: fireResult.requiredAssets,
      });
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

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
                {/* 個人情報セクション */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    👤 個人情報
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="currentAge">現在年齢</Label>
                      <Input
                        id="currentAge"
                        type="number"
                        value={input.currentAge}
                        onChange={(e) => handleInputChange('currentAge', Number(e.target.value))}
                        min="18"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="retirementAge">退職希望年齢</Label>
                      <Input
                        id="retirementAge"
                        type="number"
                        value={input.retirementAge}
                        onChange={(e) => handleInputChange('retirementAge', Number(e.target.value))}
                        min="30"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lifeExpectancy">想定寿命</Label>
                      <Input
                        id="lifeExpectancy"
                        type="number"
                        value={input.lifeExpectancy}
                        onChange={(e) => handleInputChange('lifeExpectancy', Number(e.target.value))}
                        min="70"
                        max="120"
                      />
                    </div>
                  </div>
                </div>

                {/* 資産・収入セクション */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                    💰 資産・収入
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="annualNetIncome">手取り年収 [万円]</Label>
                        <Input
                          id="annualNetIncome"
                          type="number"
                          value={displayValues.annualNetIncome}
                          onChange={(e) => handleDisplayValueChange('annualNetIncome', Number(e.target.value))}
                          min="0"
                          step="10"
                        />
                      </div>
                      <div>
                        <Label htmlFor="postRetirementAnnualIncome">退職後年収 [万円]</Label>
                        <Input
                          id="postRetirementAnnualIncome"
                          type="number"
                          value={displayValues.postRetirementAnnualIncome}
                          onChange={(e) => handleDisplayValueChange('postRetirementAnnualIncome', Number(e.target.value))}
                          min="0"
                          step="10"
                        />
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
                        <Label className="text-sm font-medium">受給額 [円・ドル/年]</Label>
                        <Label className="text-sm font-medium">通貨</Label>
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
                            placeholder={plan.currency === 'USD' ? '20000' : '2000000'}
                            value={plan.annualAmount}
                            onChange={(e) => updatePensionPlan(plan.id, 'annualAmount', Number(e.target.value))}
                            min="0"
                            step="1"
                          />
                          <select
                            value={plan.currency || 'JPY'}
                            onChange={(e) => updatePensionPlan(plan.id, 'currency', e.target.value)}
                            className="h-10 px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            step="1"
                          />
                          <Input
                            type="number"
                            placeholder="84"
                            value={plan.endAge}
                            onChange={(e) => updatePensionPlan(plan.id, 'endAge', Number(e.target.value))}
                            min="0"
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
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <Label className="text-sm font-medium">銘柄名</Label>
                        <Label className="text-sm font-medium">数量</Label>
                        <Label className="text-sm font-medium">単価</Label>
                        <Label className="text-sm font-medium">通貨</Label>
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
                        <div key={holding.id} className="grid grid-cols-4 gap-2 items-center">
                          <Input
                            placeholder="AAPL"
                            value={holding.name}
                            onChange={(e) => updateAssetHolding(holding.id, 'name', e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="100"
                            value={holding.quantity || ''}
                            onChange={(e) => updateAssetHolding(holding.id, 'quantity', Number(e.target.value))}
                            min="0"
                          />
                          <Input
                            type="number"
                            placeholder="150"
                            value={holding.pricePerUnit || ''}
                            onChange={(e) => updateAssetHolding(holding.id, 'pricePerUnit', Number(e.target.value))}
                            min="0"
                            step="0.1"
                          />
                          <select
                            value={holding.currency || 'JPY'}
                            onChange={(e) => updateAssetHolding(holding.id, 'currency', e.target.value)}
                            className="h-10 px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="JPY">JPY</option>
                            <option value="USD">USD</option>
                          </select>
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
                      ) : exchangeRate ? (
                        `(USD/JPY: ${exchangeRate.toFixed(2)})`
                      ) : (
                        '(USD/JPY: 取得失敗)'
                      )}
                    </span>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="expectedReturn">期待年利回り [%]</Label>
                      <Input
                        id="expectedReturn"
                        type="number"
                        value={input.expectedAnnualReturn}
                        onChange={(e) => handleInputChange('expectedAnnualReturn', Number(e.target.value))}
                        min="0"
                        max="30"
                        step="0.1"
                      />
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
                          />
                          <Input
                            type="number"
                            placeholder="60"
                            value={income.targetAge ?? ''}
                            onChange={(e) => updateSpecialIncome(income.id, 'targetAge', Number(e.target.value))}
                            min="18"
                            max="100"
                            step="1"
                          />
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 h-6">
                          <Label htmlFor="monthlyExpenses">月間支出 [万円]</Label>
                        </div>
                        <Input
                          id="monthlyExpenses"
                          type="number"
                          value={displayValues.monthlyExpenses}
                          onChange={(e) => handleDisplayValueChange('monthlyExpenses', Number(e.target.value))}
                          min="0"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 h-6">
                          <Label htmlFor="inflationRate">インフレ率 [%]</Label>
                          <Tooltip content="将来の支出がインフレ率に応じて増減します。下げると楽観的な想定に、上げると厳しめの想定になります。">
                            <span className="w-4 h-4 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs cursor-help">?</span>
                          </Tooltip>
                        </div>
                        <Input
                          id="inflationRate"
                          type="number"
                          value={input.inflationRate}
                          onChange={(e) => handleInputChange('inflationRate', Number(e.target.value))}
                          min="0"
                          max="15"
                          step="0.1"
                        />
                      </div>
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
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <Label className="text-sm font-medium">ローン名</Label>
                        <Label className="text-sm font-medium">残高 [万円]</Label>
                        <Label className="text-sm font-medium">金利 [%]</Label>
                        <Label className="text-sm font-medium">返済額 [万円/月]</Label>
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
                        <div key={loan.id} className="grid grid-cols-4 gap-2 items-center">
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
                          />
                          <Input
                            type="number"
                            placeholder="3.5"
                            value={loan.interestRate ?? ''}
                            onChange={(e) => updateLoan(loan.id, 'interestRate', Number(e.target.value))}
                            min="0"
                            max="30"
                            step="0.01"
                          />
                          <Input
                            type="number"
                            placeholder="10"
                            value={loan.monthlyPayment ? (loan.monthlyPayment / 10000) : ''}
                            onChange={(e) => updateLoan(loan.id, 'monthlyPayment', Number(e.target.value) * 10000)}
                            min="0"
                            step="0.1"
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
                          />
                          <Input
                            type="number"
                            placeholder="40"
                            value={expense.targetAge ?? ''}
                            onChange={(e) => updateSpecialExpense(expense.id, 'targetAge', Number(e.target.value))}
                            min="18"
                            max="100"
                            step="1"
                          />
                        </div>
                      )
                    ))}
                  </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={calculateFire}
                  disabled={isCalculating}
                  className="w-full"
                  size="lg"
                >
                  {isCalculating ? '計算中...' : 'FIRE達成度を計算'}
                </Button>

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
                    設定データをJSONファイルで保存・読み込みできます
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

                {/* 詳細情報 */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    計算結果詳細
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">基本情報</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>現在年齢:</span>
                          <span>{input.currentAge}歳</span>
                        </div>
                        <div className="flex justify-between">
                          <span>退職希望年齢:</span>
                          <span>{input.retirementAge}歳</span>
                        </div>
                        <div className="flex justify-between">
                          <span>現在の資産:</span>
                          <span>{formatCurrency(calculateTotalAssets() * 10000)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>年間支出:</span>
                          <span>{formatCurrency(input.monthlyExpenses * 12)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">FIRE達成条件</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>必要資産額:</span>
                          <span>{formatCurrency(results.requiredAssets)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>達成までの年数:</span>
                          <span>{results.metrics.yearsToFire}年</span>
                        </div>
                        <div className="flex justify-between">
                          <span>期待年利回り:</span>
                          <span>{input.expectedAnnualReturn}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  FIRE計算を実行してください
                </h2>
                <p className="text-gray-600">
                  左側のフォームに情報を入力して、「FIRE達成度を計算」ボタンをクリックしてください。
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
