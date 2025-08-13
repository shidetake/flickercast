'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AssetType } from '@prisma/client';
import { AssetFormData } from '@/lib/types';

interface AssetFormProps {
  onSubmit: (data: AssetFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<AssetFormData>;
}

const assetTypeOptions = [
  { value: 'STOCK', label: '株式' },
  { value: 'BOND', label: '債券' },
  { value: 'REAL_ESTATE', label: '不動産' },
  { value: 'CASH', label: '現金・預金' },
  { value: 'CRYPTO', label: '暗号資産' },
  { value: 'COMMODITY', label: 'コモディティ' },
  { value: 'OTHER', label: 'その他' },
];

export default function AssetForm({ onSubmit, onCancel, initialData }: AssetFormProps) {
  const [formData, setFormData] = useState<AssetFormData>({
    type: initialData?.type || 'STOCK',
    name: initialData?.name || '',
    symbol: initialData?.symbol || '',
    amount: initialData?.amount || 0,
    currentValue: initialData?.currentValue || 0,
    targetAllocation: initialData?.targetAllocation || undefined,
    isAutoUpdate: initialData?.isAutoUpdate || false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Asset form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof AssetFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="type">資産タイプ</Label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => handleInputChange('type', e.target.value as AssetType)}
            className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {assetTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="name">資産名</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="例: 日経225インデックス"
            required
          />
        </div>

        {formData.type === 'STOCK' && (
          <div>
            <Label htmlFor="symbol">銘柄コード（オプション）</Label>
            <Input
              id="symbol"
              value={formData.symbol}
              onChange={(e) => handleInputChange('symbol', e.target.value)}
              placeholder="例: 1321"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="amount">保有量</Label>
            <Input
              id="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', Number(e.target.value))}
              placeholder="例: 100"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <Label htmlFor="currentValue">現在価値（円）</Label>
            <Input
              id="currentValue"
              type="number"
              value={formData.currentValue}
              onChange={(e) => handleInputChange('currentValue', Number(e.target.value))}
              placeholder="例: 1000000"
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="targetAllocation">目標配分率（%）</Label>
          <Input
            id="targetAllocation"
            type="number"
            value={formData.targetAllocation || ''}
            onChange={(e) => handleInputChange('targetAllocation', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="例: 30"
            min="0"
            max="100"
            step="0.1"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            id="isAutoUpdate"
            type="checkbox"
            checked={formData.isAutoUpdate}
            onChange={(e) => handleInputChange('isAutoUpdate', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <Label htmlFor="isAutoUpdate">自動価格更新を有効にする</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  );
}