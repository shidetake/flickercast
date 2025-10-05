#!/usr/bin/env tsx

/**
 * 銘柄データ更新スクリプト
 * ビルド時に実行され、主要な株式銘柄のリストを更新します
 *
 * 使用方法:
 * - npm run update-symbols (手動実行)
 * - npm run build (自動実行 - prebuildフックで呼ばれる)
 */

import fs from 'fs';
import path from 'path';

interface StockSymbol {
  symbol: string;
  name: string;
}

// 主要な米国株式シンボル（S&P 100の一部 + 人気銘柄）
const US_STOCKS: StockSymbol[] = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor Manufacturing' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'PG', name: 'Procter & Gamble Co.' },
  { symbol: 'HD', name: 'The Home Depot Inc.' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  { symbol: 'KO', name: 'The Coca-Cola Company' },
  { symbol: 'PEP', name: 'PepsiCo Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'MCD', name: "McDonald's Corporation" },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.' },
  { symbol: 'ACN', name: 'Accenture plc' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'NKE', name: 'NIKE Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.' },
  { symbol: 'QCOM', name: 'QUALCOMM Inc.' },
  { symbol: 'BA', name: 'The Boeing Company' },
  { symbol: 'GE', name: 'General Electric Company' },
  { symbol: 'IBM', name: 'International Business Machines' },
  { symbol: 'UBER', name: 'Uber Technologies Inc.' },
  { symbol: 'SHOP', name: 'Shopify Inc.' },
  { symbol: 'SQ', name: 'Block Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global Inc.' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.' },
  { symbol: 'SNOW', name: 'Snowflake Inc.' },
  { symbol: 'RBLX', name: 'Roblox Corporation' },
  { symbol: 'ABNB', name: 'Airbnb Inc.' },
];

// 主要なETF
const ETFS: StockSymbol[] = [
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'VT', name: 'Vanguard Total World Stock ETF' },
  { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF' },
  { symbol: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF' },
  { symbol: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF' },
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF' },
];

// 主要な日本株式（日経225の一部）
const JP_STOCKS: StockSymbol[] = [
  { symbol: '7203.T', name: 'トヨタ自動車' },
  { symbol: '9984.T', name: 'ソフトバンクグループ' },
  { symbol: '6758.T', name: 'ソニーグループ' },
  { symbol: '6861.T', name: 'キーエンス' },
  { symbol: '8306.T', name: '三菱UFJフィナンシャル・グループ' },
  { symbol: '9433.T', name: 'KDDI' },
  { symbol: '9432.T', name: '日本電信電話' },
  { symbol: '4502.T', name: '武田薬品工業' },
  { symbol: '6902.T', name: 'デンソー' },
  { symbol: '8035.T', name: '東京エレクトロン' },
  { symbol: '6594.T', name: '日本電産' },
  { symbol: '4568.T', name: '第一三共' },
  { symbol: '6367.T', name: 'ダイキン工業' },
  { symbol: '4063.T', name: '信越化学工業' },
  { symbol: '8058.T', name: '三菱商事' },
  { symbol: '2914.T', name: 'JT (日本たばこ産業)' },
  { symbol: '7974.T', name: '任天堂' },
  { symbol: '9983.T', name: 'ファーストリテイリング' },
  { symbol: '6098.T', name: 'リクルートホールディングス' },
  { symbol: '4503.T', name: 'アステラス製薬' },
];

/**
 * 外部APIから銘柄データを取得（将来的な拡張用）
 * 現在は静的データを返すが、必要に応じてAPIコールを追加可能
 */
async function fetchStockSymbols(): Promise<StockSymbol[]> {
  // TODO: 将来的にはAlpha Vantage等のAPIから取得
  // 現在は静的データを使用
  return [...US_STOCKS, ...ETFS, ...JP_STOCKS];
}

/**
 * JSONファイルにデータを保存
 */
function saveToFile(data: StockSymbol[], outputPath: string): void {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`✅ 銘柄データを保存しました: ${outputPath}`);
  console.log(`   合計 ${data.length} 銘柄`);
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('🔄 銘柄データを更新中...');

    // データ取得
    const symbols = await fetchStockSymbols();

    // 保存先パス
    const outputPath = path.join(process.cwd(), 'public', 'data', 'stock-symbols.json');

    // ディレクトリ作成（存在しない場合）
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // ファイル保存
    saveToFile(symbols, outputPath);

    console.log('✨ 銘柄データの更新が完了しました');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main();
