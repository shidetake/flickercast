'use client';

import { FireMetrics } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

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
    </div>
  );
}