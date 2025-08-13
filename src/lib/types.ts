import { FireCalculationResult } from './fire-calculator';

// ローカル型定義（旧Prisma型の置き換え）
export enum AssetType {
  STOCK = 'STOCK',
  BOND = 'BOND',
  REAL_ESTATE = 'REAL_ESTATE',
  CASH = 'CASH',
  CRYPTO = 'CRYPTO',
  COMMODITY = 'COMMODITY',
  OTHER = 'OTHER'
}

export enum ExpenseCategory {
  HOUSING = 'HOUSING',
  FOOD = 'FOOD',
  TRANSPORTATION = 'TRANSPORTATION',
  HEALTHCARE = 'HEALTHCARE',
  EDUCATION = 'EDUCATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  UTILITIES = 'UTILITIES',
  INSURANCE = 'INSURANCE',
  OTHER = 'OTHER'
}

export enum Frequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY'
}

// 基本データ型
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  symbol?: string;
  amount: number;
  currentValue: number;
  targetAllocation?: number;
  isAutoUpdate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  name: string;
  amount: number;
  frequency: Frequency;
  isEssential: boolean;
  retirementMultiplier: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LifeEvent {
  id: string;
  name: string;
  targetYear: number;
  estimatedCost: number;
  isPaid: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Scenario {
  id: string;
  name: string;
  inflationRate: number;
  expectedReturn: number;
  withdrawalRate: number;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Projection {
  id: string;
  scenarioId: string;
  year: number;
  age: number;
  totalAssets: number;
  annualExpenses: number;
  netWorth: number;
  fireAchieved: boolean;
  confidenceLevel?: number;
  createdAt: Date;
}

export interface EconomicIndicator {
  id: string;
  type: string;
  name: string;
  value: number;
  date: Date;
  source: string;
  createdAt: Date;
}

// フロントエンド用の型定義
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
}

export interface AssetSummary {
  totalValue: number;
  byType: Record<AssetType, number>;
  monthlyGrowth: number;
  yearlyGrowth: number;
}

export interface ExpenseSummary {
  monthlyTotal: number;
  annualTotal: number;
  byCategory: Record<ExpenseCategory, number>;
  essentialVsDiscretionary: {
    essential: number;
    discretionary: number;
  };
}

export interface FireMetrics {
  currentFireNumber: number; // 現在のFIRE数値（年間支出の何倍の資産があるか）
  requiredFireNumber: number; // 必要なFIRE数値（通常25倍）
  fireProgress: number; // FIRE達成度（%）
  yearsToFire: number;
  monthlyDeficit: number; // 月間不足額
}

export interface ScenarioComparison {
  scenarios: Scenario[];
  results: FireCalculationResult[];
  bestCase: FireCalculationResult;
  worstCase: FireCalculationResult;
  averageCase: FireCalculationResult;
}

// API レスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// フォーム型定義
export interface AssetFormData {
  type: AssetType;
  name: string;
  symbol?: string;
  amount: number;
  currentValue: number;
  targetAllocation?: number;
  isAutoUpdate: boolean;
}

export interface ExpenseFormData {
  category: ExpenseCategory;
  name: string;
  amount: number;
  frequency: Frequency;
  isEssential: boolean;
  retirementMultiplier: number;
}

export interface LifeEventFormData {
  name: string;
  targetYear: number;
  estimatedCost: number;
  description?: string;
}

export interface ScenarioFormData {
  name: string;
  inflationRate: number;
  expectedReturn: number;
  withdrawalRate: number;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
}

// 外部API関連の型
export interface YahooFinanceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdate: Date;
}

export interface BojInflationData {
  date: Date;
  cpi: number;
  coreInflation: number;
  source: string;
}

export interface AlphaVantageData {
  symbol: string;
  price: number;
  volume: number;
  marketCap?: number;
  lastUpdate: Date;
}

// 銘柄保有情報
export interface AssetHolding {
  id: string;
  name: string;
  quantity: number;
  pricePerUnit: number; // 万円単位
}

// チャート用データ型
export interface ChartDataPoint {
  year: number;
  age: number;
  assets: number;
  expenses: number;
  netWorth: number;
  fireAchieved: boolean;
}

export interface MonteCarloResult {
  percentile: number;
  projections: ChartDataPoint[];
  successProbability: number;
}

// 通知・アラート型
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// 設定関連
export interface UserSettings {
  currency: 'JPY' | 'USD' | 'EUR';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    browser: boolean;
    fireUpdates: boolean;
    marketAlerts: boolean;
  };
  privacy: {
    dataSharing: boolean;
    analytics: boolean;
  };
}

// 既にnumber型なので、型変換は不要
export type AssetWithNumbers = Asset;
export type ExpenseWithNumbers = Expense;
export type ProjectionWithNumbers = Projection;