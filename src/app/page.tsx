'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FireCalculator, FireCalculationInput } from '@/lib/fire-calculator';
import FireProjectionChart from '@/components/charts/fire-projection-chart';
import FireSummary from '@/components/dashboard/fire-summary';
import { ChartDataPoint, FireMetrics, AssetHolding, Currency } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { saveToLocalStorage, loadFromLocalStorage, exportToJson, importFromJson } from '@/lib/storage';
import { useToast, ToastProvider } from '@/lib/toast-context';

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
    monthlyExpenses: 300000, // 内部では円のまま
    annualNetIncome: 10000000, // 内部では円のまま（1000万円）
    postRetirementAnnualIncome: 0, // 内部では円のまま（0円）
    annualPensionAmount: 0, // 内部では円のまま（0円）
    expectedAnnualReturn: 5,
    inflationRate: 2,
    withdrawalRate: 4,
    lifeExpectancy: calculateLifeExpectancy(38),
  });

  const [input, setInput] = useState<FireCalculationInput>(createDefaultInput());
  const [nextAssetId, setNextAssetId] = useState(2); // 次に使用するAsset ID（デフォルトは1なので2から開始）

  // 万円単位での表示用の値
  const [displayValues, setDisplayValues] = useState({
    monthlyExpenses: 30, // 30万円
    annualNetIncome: 1000, // 1000万円
    postRetirementAnnualIncome: 0, // 0万円
    annualPensionAmount: 0, // 0万円
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<{
    chartData: ChartDataPoint[];
    metrics: FireMetrics;
    requiredAssets: number;
  } | null>(null);

  // 既存の銘柄IDから次のIDを計算
  const calculateNextAssetId = (assetHoldings: AssetHolding[]): number => {
    if (assetHoldings.length === 0) return 1;
    const maxId = Math.max(...assetHoldings.map(holding => parseInt(holding.id) || 0));
    return maxId + 1;
  };

  // ページ読み込み時にlocalStorageからデータを復元
  useEffect(() => {
    const savedData = loadFromLocalStorage();
    if (savedData) {
      setInput(savedData);
      
      // nextAssetIdを適切に設定
      setNextAssetId(calculateNextAssetId(savedData.assetHoldings));
      
      // 表示値も更新
      setDisplayValues({
        monthlyExpenses: savedData.monthlyExpenses / 10000,
        annualNetIncome: savedData.annualNetIncome / 10000,
        postRetirementAnnualIncome: savedData.postRetirementAnnualIncome / 10000,
        annualPensionAmount: savedData.annualPensionAmount / 10000,
      });
    }
  }, []);

  // データ変更時にlocalStorageへ自動保存
  useEffect(() => {
    saveToLocalStorage(input);
  }, [input]);

  // 銘柄管理のヘルパー関数
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

  // 総資産額を計算
  const calculateTotalAssets = () => {
    return input.assetHoldings.reduce(
      (total, holding) => total + (holding.quantity * holding.pricePerUnit), 
      0
    );
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
    
    // 内部計算用の値を更新（万円 → 円に変換）
    const yenValue = value * 10000;
    setInput(prev => ({
      ...prev,
      [field]: yenValue
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
      
      // 表示値も更新
      setDisplayValues({
        monthlyExpenses: importedData.monthlyExpenses / 10000,
        annualNetIncome: importedData.annualNetIncome / 10000,
        postRetirementAnnualIncome: importedData.postRetirementAnnualIncome / 10000,
        annualPensionAmount: importedData.annualPensionAmount / 10000,
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
      // FIRE計算実行
      const fireResult = FireCalculator.calculateFire(input);
      
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🔥 FIRE Simulator
          </h1>
          <p className="text-gray-600 mt-1">
            経済的自立・早期退職（FIRE）をシミュレートしましょう
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 入力フォーム */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                基本情報入力
              </h2>
              
              <div className="space-y-4">
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

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>銘柄管理</Label>
                    <Button 
                      type="button" 
                      onClick={addAssetHolding}
                      size="sm"
                      variant="outline"
                    >
                      + 銘柄を追加
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {input.assetHoldings.map((holding) => (
                      <div key={holding.id} className="grid grid-cols-5 gap-2 items-center">
                        <Input
                          placeholder="銘柄名"
                          value={holding.name}
                          onChange={(e) => updateAssetHolding(holding.id, 'name', e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="数量"
                          value={holding.quantity || ''}
                          onChange={(e) => updateAssetHolding(holding.id, 'quantity', Number(e.target.value))}
                          min="0"
                        />
                        <Input
                          type="number"
                          placeholder="単価（万円）"
                          value={holding.pricePerUnit || ''}
                          onChange={(e) => updateAssetHolding(holding.id, 'pricePerUnit', Number(e.target.value))}
                          min="0"
                          step="0.1"
                        />
                        <select
                          value={holding.currency || 'JPY'}
                          onChange={(e) => updateAssetHolding(holding.id, 'currency', e.target.value)}
                          className="h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="JPY">JPY</option>
                          <option value="USD">USD</option>
                        </select>
                        <Button 
                          type="button"
                          onClick={() => removeAssetHolding(holding.id)}
                          size="sm"
                          variant="destructive"
                        >
                          削除
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">
                      合計資産額: {calculateTotalAssets().toFixed(1)}万円
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="annualNetIncome">手取り年収（万円）</Label>
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
                    <Label htmlFor="postRetirementAnnualIncome">退職後年収（万円）</Label>
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

                <div>
                  <Label htmlFor="annualPensionAmount">年間年金受給額（万円）</Label>
                  <Input
                    id="annualPensionAmount"
                    type="number"
                    value={displayValues.annualPensionAmount}
                    onChange={(e) => handleDisplayValueChange('annualPensionAmount', Number(e.target.value))}
                    min="0"
                    step="10"
                  />
                </div>

                <div>
                  <Label htmlFor="monthlyExpenses">月間支出（万円）</Label>
                  <Input
                    id="monthlyExpenses"
                    type="number"
                    value={displayValues.monthlyExpenses}
                    onChange={(e) => handleDisplayValueChange('monthlyExpenses', Number(e.target.value))}
                    min="0"
                    step="0.1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expectedReturn">期待年利回り（%）</Label>
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
                  <div>
                    <Label htmlFor="inflationRate">インフレ率（%）</Label>
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

                <div>
                  <Label htmlFor="withdrawalRate">引き出し率（%）</Label>
                  <Input
                    id="withdrawalRate"
                    type="number"
                    value={input.withdrawalRate}
                    onChange={(e) => handleInputChange('withdrawalRate', Number(e.target.value))}
                    min="1"
                    max="10"
                    step="0.1"
                  />
                  <p className="text-sm text-foreground mt-1">
                    4%が一般的な安全な引き出し率とされています
                  </p>
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
                        <div className="flex justify-between">
                          <span>引き出し率:</span>
                          <span>{input.withdrawalRate}%</span>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-600">
              © 2024 FIRE Simulator. 投資判断は自己責任でお願いします。
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
