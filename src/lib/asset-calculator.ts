import { AssetHolding } from './types';

/**
 * 資産保有情報から総資産額を計算する統一関数
 * @param assetHoldings - 資産保有情報の配列
 * @param exchangeRate - USD/JPY為替レート（nullの場合はデフォルト値150を使用）
 * @param outputUnit - 出力単位 ('yen': 円, 'manyen': 万円)
 * @returns 指定単位での総資産額
 */
export function calculateTotalAssets(
  assetHoldings: AssetHolding[],
  exchangeRate: number | null = null,
  outputUnit: 'yen' | 'manyen' = 'yen'
): number {
  // デフォルト為替レート（APIが利用できない場合の代替値）
  const defaultExchangeRate = 150;
  const currentExchangeRate = exchangeRate ?? defaultExchangeRate;
  
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