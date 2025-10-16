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
  currentAge: number;
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
  currentAssets: number; // 現在の資産額（円）
  requiredAssets: number; // FIRE目標額（円）
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
  currentAge: number;
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

// 通貨タイプ
export type Currency = 'JPY' | 'USD';

// 銘柄保有情報
export interface AssetHolding {
  id: string;
  name: string; // 表示用銘柄名（例: "DCダイワ外国株式"）
  symbol?: string; // API用銘柄コード（例: "04313031"）、オプショナル
  quantity: number;
  pricePerUnit: number; // JPY: 円単位, USD: ドル単位
  currency: Currency; // 通貨種別
  expectedReturn?: number; // 期待年利回り（%）
}

// ローン情報
export interface Loan {
  id: string;
  name: string; // ローン名（住宅ローン、車のローン等）
  balance: number; // 残高（円）
  interestRate?: number; // 金利（%）
  monthlyPayment: number; // 月々返済額（円）
}

// 特別支出情報
export interface SpecialExpense {
  id: string;
  name: string; // 特別支出名（結婚式、出産等）
  amount: number; // 支出額（円、現在価値）
  targetAge?: number; // 支出予定年齢
}

// 臨時収入情報
export interface SpecialIncome {
  id: string;
  name: string; // 臨時収入名（ボーナス、相続、退職金等）
  amount: number; // 収入額（円、現在価値）
  targetAge?: number; // 収入予定年齢
}

// 年金プラン情報
export interface PensionPlan {
  id: string;
  name: string; // 年金名（国民年金、厚生年金、企業年金等）
  annualAmount?: number; // 年間受給額（通貨単位）
  currency: Currency; // 通貨種別
  startAge: number; // 受給開始年齢
  endAge: number; // 受給終了年齢
}

// 給与プラン情報
export interface SalaryPlan {
  id: string;
  name: string; // 給与名（基本給、副業等）
  annualAmount?: number; // 年間支給額（円）
  startAge: number; // 支給開始年齢
  endAge: number; // 支給終了年齢
}

// 支出区間情報（年齢別月間支出）
export interface ExpenseSegment {
  id: string;
  startAge: number; // 開始年齢
  endAge: number; // 終了年齢
  monthlyExpenses: number; // 月間支出額（円単位）
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

// 為替レートAPI関連の型
export interface ExchangeRateResponse {
  rate: number;
  cached: boolean;
  lastUpdated: Date;
  warning?: string;
}

// 既にnumber型なので、型変換は不要
export type AssetWithNumbers = Asset;
export type ExpenseWithNumbers = Expense;
export type ProjectionWithNumbers = Projection;