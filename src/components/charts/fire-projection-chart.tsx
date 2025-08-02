'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartDataPoint } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface FireProjectionChartProps {
  data: ChartDataPoint[];
  targetAmount?: number;
  className?: string;
}

export default function FireProjectionChart({ 
  data, 
  targetAmount,
  className = "w-full h-96" 
}: FireProjectionChartProps) {
  const formatTooltip = (value: number, name: string) => {
    if (name === '資産' || name === '支出' || name === '純資産') {
      return [formatCurrency(value), name];
    }
    return [value, name];
  };

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000000) {
      return `${(tickItem / 100000000).toFixed(0)}億`;
    }
    if (tickItem >= 10000) {
      return `${(tickItem / 10000).toFixed(0)}万`;
    }
    return tickItem.toString();
  };

  // FIRE達成年を特定
  const fireAchievedYear = data.find(point => point.fireAchieved)?.year;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="year" 
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value) => `${value}年`}
          />
          <YAxis 
            tickFormatter={formatYAxis}
            domain={[0, 'auto']}
          />
          <Tooltip 
            formatter={formatTooltip}
            labelFormatter={(value) => `${value}年 (${data.find(d => d.year === value)?.age || 0}歳)`}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #ccc',
              borderRadius: '8px'
            }}
          />
          <Legend />
          
          {/* 資産の推移 */}
          <Line
            type="monotone"
            dataKey="assets"
            stroke="#2563eb"
            strokeWidth={3}
            name="資産"
            dot={false}
            activeDot={{ r: 6 }}
          />
          
          {/* 年間支出の推移 */}
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#dc2626"
            strokeWidth={2}
            name="年間支出"
            dot={false}
            strokeDasharray="5 5"
          />

          {/* 純資産の推移 */}
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke="#059669"
            strokeWidth={2}
            name="純資産"
            dot={false}
          />

          {/* FIRE目標額のライン */}
          {targetAmount && (
            <ReferenceLine 
              y={targetAmount} 
              stroke="#f59e0b"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{ value: "FIRE目標額", position: "top" }}
            />
          )}

          {/* FIRE達成年のライン */}
          {fireAchievedYear && (
            <ReferenceLine 
              x={fireAchievedYear} 
              stroke="#10b981"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{ value: "FIRE達成", position: "topLeft" }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}