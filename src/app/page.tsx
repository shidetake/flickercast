'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FireCalculator, FireCalculationInput } from '@/lib/fire-calculator';
import FireProjectionChart from '@/components/charts/fire-projection-chart';
import FireSummary from '@/components/dashboard/fire-summary';
import { ChartDataPoint, FireMetrics } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function Home() {
  const [input, setInput] = useState<FireCalculationInput>({
    currentAge: 38,
    retirementAge: 65,
    currentAssets: 1000000, // 内部では円のまま
    monthlyExpenses: 300000, // 内部では円のまま
    annualNetIncome: 10000000, // 内部では円のまま（1000万円）
    expectedAnnualReturn: 5,
    inflationRate: 2,
    withdrawalRate: 4,
    lifeExpectancy: 85,
  });

  // 万円単位での表示用の値
  const [displayValues, setDisplayValues] = useState({
    currentAssets: 100, // 100万円
    monthlyExpenses: 30, // 30万円
    annualNetIncome: 1000, // 1000万円
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<{
    chartData: ChartDataPoint[];
    metrics: FireMetrics;
    requiredAssets: number;
  } | null>(null);

  const handleInputChange = (field: keyof FireCalculationInput, value: number) => {
    setInput(prev => ({
      ...prev,
      [field]: value
    }));
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
      const currentFireNumber = input.currentAssets / annualExpenses;
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
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div>
                  <Label htmlFor="currentAssets">現在の資産額（万円）</Label>
                  <Input
                    id="currentAssets"
                    type="number"
                    value={displayValues.currentAssets}
                    onChange={(e) => handleDisplayValueChange('currentAssets', Number(e.target.value))}
                    min="0"
                    step="1"
                  />
                </div>

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
                          <span>{formatCurrency(input.currentAssets)}</span>
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