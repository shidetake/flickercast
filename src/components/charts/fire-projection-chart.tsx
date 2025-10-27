'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartDataPoint } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';

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
  const isMobile = useIsMobile();

  const formatTooltip = (value: number, name: string) => {
    if (name === '資産') {
      return [formatCurrency(value), name];
    }
    return [value, name];
  };

  const formatYAxis = (tickItem: number) => {
    const amountInManYen = tickItem / 10000;
    // モバイル時は「円」を省略
    const suffix = isMobile ? '' : '円';

    // 1000万以上は常に億単位で表示(FIREシミュレーションでは億単位が標準)
    if (amountInManYen >= 1000) {
      return `${(amountInManYen / 10000).toFixed(1)}億${suffix}`;
    }

    // 1000万未満は万円単位
    if (amountInManYen >= 1) {
      return `${amountInManYen.toFixed(0)}万${suffix}`;
    }
    return `${amountInManYen.toFixed(1)}万${suffix}`;
  };

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: isMobile ? 5 : 10,
            left: 0,
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
            tick={{ fontSize: isMobile ? 11 : 12 }}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: isMobile ? 11 : 12 }}
            width={isMobile ? 45 : 55}
            domain={[
              0,
              (dataMax: number) => {
                // データの最大値とFIRE目標額のうち、大きい方を縦軸の最大値とする
                const maxValue = targetAmount ? Math.max(dataMax, targetAmount) : dataMax;
                // 少し余裕を持たせる（10%上乗せ）
                return Math.ceil(maxValue * 1.1);
              }
            ]}
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
          

          {/* FIRE目標額のライン */}
          {targetAmount && (
            <ReferenceLine
              y={targetAmount}
              stroke="#f59e0b"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: "FIRE目標額",
                position: "top",
                fontSize: isMobile ? 11 : 12
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}