'use client';

import { FireMetrics } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface FireSummaryProps {
  metrics: FireMetrics;
  className?: string;
}

export default function FireSummary({ metrics, className = "" }: FireSummaryProps) {
  const {
    currentAssets,
    requiredAssets,
    fireProgress,
    yearsToFire,
    monthlyDeficit
  } = metrics;

  const progressBarWidth = Math.min(fireProgress, 100);
  const remainingAmount = Math.max(0, requiredAssets - currentAssets);

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">FIRE達成状況</h2>
      
      {/* メインメトリクス */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {Math.round(fireProgress)}%
          </div>
          <div className="text-sm text-gray-600 mt-1">FIRE達成率</div>
          <div className="text-xs text-gray-500">
            目標額に対する現在資産の割合
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(Math.round(remainingAmount / 10000) * 10000)}
          </div>
          <div className="text-sm text-gray-600 mt-1">FIRE目標額まで</div>
          <div className="text-xs text-gray-500">
            {remainingAmount === 0 ? '達成済み！' : 'あと必要な金額'}
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-orange-600">
            {yearsToFire}年
          </div>
          <div className="text-sm text-gray-600 mt-1">FIRE達成まで</div>
          <div className="text-xs text-gray-500">
            現在のペースで継続した場合
          </div>
        </div>
      </div>

      {/* 進捗バー */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">FIRE達成度</span>
          <span className="text-sm font-medium text-gray-700">
            {Math.round(fireProgress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-300"
            style={{ width: `${progressBarWidth}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      {/* 詳細情報 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2">現在の状況</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">FIRE進捗率:</span>
              <span className="font-medium">{Math.round(fireProgress)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">目標額まで:</span>
              <span className="font-medium">
                {formatCurrency(Math.round(remainingAmount / 10000) * 10000)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2">改善提案</h3>
          <div className="space-y-2 text-sm">
            {monthlyDeficit > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">月間不足額:</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(monthlyDeficit)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  貯蓄を月額{formatCurrency(monthlyDeficit)}増やすと目標達成できます
                </div>
              </>
            ) : (
              <div className="text-green-600 font-medium">
                順調にFIRE達成に向かっています！
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ステータスメッセージ */}
      <div className="mt-6 p-4 rounded-lg bg-blue-50 border-l-4 border-blue-400">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-800">
              {fireProgress >= 100 ? (
                <span className="font-semibold">🎉 FIRE達成おめでとうございます！</span>
              ) : fireProgress >= 75 ? (
                <span>もう少しでFIRE達成です。最後のスパートを頑張りましょう！</span>
              ) : fireProgress >= 50 ? (
                <span>FIRE達成の中間地点を通過しました。着実に進歩しています。</span>
              ) : fireProgress >= 25 ? (
                <span>FIRE達成に向けて順調に進んでいます。継続が重要です。</span>
              ) : (
                <span>FIRE達成に向けた旅が始まりました。長期的な視点で取り組みましょう。</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}