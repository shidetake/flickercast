'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExpenseCategory, Frequency } from '@/lib/types';
import { ExpenseFormData } from '@/lib/types';

interface ExpenseFormProps {
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<ExpenseFormData>;
}

const expenseCategoryOptions = [
  { value: 'HOUSING', label: '住居費' },
  { value: 'FOOD', label: '食費' },
  { value: 'TRANSPORTATION', label: '交通費' },
  { value: 'HEALTHCARE', label: '医療費' },
  { value: 'EDUCATION', label: '教育費' },
  { value: 'ENTERTAINMENT', label: '娯楽費' },
  { value: 'UTILITIES', label: '光熱費' },
  { value: 'INSURANCE', label: '保険料' },
  { value: 'OTHER', label: 'その他' },
];

const frequencyOptions = [
  { value: 'MONTHLY', label: '月次' },
  { value: 'QUARTERLY', label: '四半期' },
  { value: 'ANNUALLY', label: '年次' },
];

export default function ExpenseForm({ onSubmit, onCancel, initialData }: ExpenseFormProps) {
  const [formData, setFormData] = useState<ExpenseFormData>({
    category: initialData?.category || ExpenseCategory.HOUSING,
    name: initialData?.name || '',
    amount: initialData?.amount || 0,
    frequency: initialData?.frequency || Frequency.MONTHLY,
    isEssential: initialData?.isEssential ?? true,
    retirementMultiplier: initialData?.retirementMultiplier || 1.0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Expense form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ExpenseFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="category">支出カテゴリ</Label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value as ExpenseCategory)}
            className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {expenseCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="name">支出項目名</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="例: 家賃"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="amount">金額（万円）</Label>
            <Input
              id="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', Number(e.target.value))}
              placeholder="例: 100000"
              min="0"
              step="1"
              required
            />
          </div>

          <div>
            <Label htmlFor="frequency">頻度</Label>
            <select
              id="frequency"
              value={formData.frequency}
              onChange={(e) => handleInputChange('frequency', e.target.value as Frequency)}
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {frequencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="retirementMultiplier">退職後の支出倍率</Label>
          <Input
            id="retirementMultiplier"
            type="number"
            value={formData.retirementMultiplier}
            onChange={(e) => handleInputChange('retirementMultiplier', Number(e.target.value))}
            placeholder="例: 0.8（退職後は80%に減少）"
            min="0"
            max="2"
            step="0.1"
            required
          />
          <p className="text-sm text-foreground mt-1">
            1.0 = 現在と同額、0.8 = 現在の80%、1.2 = 現在の120%
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            id="isEssential"
            type="checkbox"
            checked={formData.isEssential}
            onChange={(e) => handleInputChange('isEssential', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <Label htmlFor="isEssential">必需品の支出</Label>
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