import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = 'JPY',
  locale: string = 'ja-JP'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(
  number: number,
  locale: string = 'ja-JP'
): string {
  return new Intl.NumberFormat(locale).format(number);
}

export function formatPercentage(
  decimal: number,
  locale: string = 'ja-JP'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(decimal / 100);
}

export function calculateAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

export function yearsFromNow(years: number): number {
  return new Date().getFullYear() + years;
}