import { AssetHolding, PensionPlan, SalaryPlan } from './types';

/**
 * 資産保有情報から総資産額を計算する統一関数
 * @param assetHoldings - 資産保有情報の配列
 * @param exchangeRate - USD/JPY為替レート
 * @param outputUnit - 出力単位 ('yen': 円, 'manyen': 万円)
 * @returns 指定単位での総資産額
 */
export function calculateTotalAssets(
  assetHoldings: AssetHolding[],
  exchangeRate: number | null | undefined,
  outputUnit: 'yen' | 'manyen' = 'yen'
): number {
  // exchangeRateがnullの場合はデフォルト値を使用
  const currentExchangeRate = exchangeRate ?? 150;
  
  const totalInYen = assetHoldings.reduce((total, holding) => {
    const assetValue = holding.quantity * holding.pricePerUnit;
    
    // 通貨に応じて円換算
    if (holding.currency === 'USD') {
      return total + (assetValue * currentExchangeRate);
    } else {
      // JPY銘柄の場合、pricePerUnitは円単位
      return total + assetValue;
    }
  }, 0);
  
  // 出力単位に応じて変換
  return outputUnit === 'manyen' ? totalInYen / 10000 : totalInYen;
}

/**
 * 年金受給額を円に換算する関数
 * @param pensionPlan - 年金プラン情報
 * @param exchangeRate - USD/JPY為替レート
 * @returns 円換算された年間受給額
 */
export function convertPensionToJPY(
  pensionPlan: PensionPlan,
  exchangeRate: number | null | undefined
): number {
  // exchangeRateがnullの場合はデフォルト値を使用
  const currentExchangeRate = exchangeRate ?? 150;

  const amount = pensionPlan.annualAmount ?? 0;

  // 通貨に応じて円換算
  if (pensionPlan.currency === 'USD') {
    return amount * currentExchangeRate;
  } else {
    // JPY年金の場合、そのまま返す
    return amount;
  }
}

/**
 * 給与支給額を取得する関数
 * @param salaryPlan - 給与プラン情報
 * @returns 年間支給額（円）
 */
export function convertSalaryToJPY(
  salaryPlan: SalaryPlan
): number {
  return salaryPlan.annualAmount ?? 0;
}