'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { AssetWithNumbers } from '@/lib/types';
import { formatCurrency, formatPercentage } from '@/lib/utils';

interface AssetAllocationChartProps {
  assets: AssetWithNumbers[];
  className?: string;
}

const ASSET_TYPE_COLORS = {
  STOCK: '#3b82f6',
  BOND: '#10b981',
  REAL_ESTATE: '#f59e0b',
  CASH: '#6b7280',
  CRYPTO: '#8b5cf6',
  COMMODITY: '#ef4444',
  OTHER: '#84cc16',
};

const ASSET_TYPE_LABELS = {
  STOCK: '株式',
  BOND: '債券',
  REAL_ESTATE: '不動産',
  CASH: '現金・預金',
  CRYPTO: '暗号資産',
  COMMODITY: 'コモディティ',
  OTHER: 'その他',
};

export default function AssetAllocationChart({ 
  assets, 
  className = "w-full h-96" 
}: AssetAllocationChartProps) {
  // 資産タイプ別の合計を計算
  const assetsByType = assets.reduce((acc, asset) => {
    const existing = acc.find(item => item.type === asset.type);
    if (existing) {
      existing.value += asset.currentValue;
    } else {
      acc.push({
        type: asset.type,
        value: asset.currentValue,
        name: ASSET_TYPE_LABELS[asset.type],
        color: ASSET_TYPE_COLORS[asset.type],
      });
    }
    return acc;
  }, [] as Array<{ type: string; value: number; name: string; color: string }>);

  const totalValue = assetsByType.reduce((sum, item) => sum + item.value, 0);

  // パーセンテージを追加
  const chartData = assetsByType.map(item => ({
    ...item,
    percentage: (item.value / totalValue) * 100,
  }));

  const formatTooltip = (value: number, name: string) => {
    const percentage = (value / totalValue) * 100;
    return [
      `${formatCurrency(value)} (${formatPercentage(percentage)})`,
      name
    ];
  };

  const renderCustomLabel = (entry: any) => {
    const percentage = (entry.value / totalValue) * 100;
    return percentage > 5 ? `${percentage.toFixed(1)}%` : '';
  };

  if (assetsByType.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center`}>
        <p className="text-gray-500">資産データがありません</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={formatTooltip} />
          <Legend 
            formatter={(value, entry) => {
              const item = chartData.find(d => d.name === value);
              const percentage = item ? (item.value / totalValue) * 100 : 0;
              return `${value} (${percentage.toFixed(1)}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* 詳細テーブル */}
      <div className="mt-4 space-y-2">
        <h4 className="font-semibold text-sm text-gray-700">資産配分詳細</h4>
        <div className="grid gap-2">
          {chartData.map((item) => (
            <div key={item.type} className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatCurrency(item.value)}</div>
                <div className="text-gray-500 text-xs">
                  {formatPercentage(item.percentage)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center font-semibold text-sm">
            <span>合計</span>
            <span>{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}