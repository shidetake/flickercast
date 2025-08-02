import { YahooFinanceData, BojInflationData, AlphaVantageData } from './types';

// Yahoo Finance API (無料版)
export class YahooFinanceAPI {
  private static readonly BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

  static async getStockPrice(symbol: string): Promise<YahooFinanceData | null> {
    try {
      // 日本株の場合は .T を追加
      const formattedSymbol = symbol.includes('.T') ? symbol : `${symbol}.T`;
      
      const response = await fetch(`${this.BASE_URL}/${formattedSymbol}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.chart?.result?.[0]) {
        return null;
      }
      
      const result = data.chart.result[0];
      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];
      
      if (!meta || !quote) {
        return null;
      }
      
      const currentPrice = meta.regularMarketPrice || quote.close?.[quote.close.length - 1];
      const previousClose = meta.previousClose;
      
      return {
        symbol: formattedSymbol,
        price: currentPrice,
        change: currentPrice - previousClose,
        changePercent: ((currentPrice - previousClose) / previousClose) * 100,
        lastUpdate: new Date(),
      };
    } catch (error) {
      console.error('Yahoo Finance API error:', error);
      return null;
    }
  }

  static async getMultipleStockPrices(symbols: string[]): Promise<YahooFinanceData[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol => this.getStockPrice(symbol))
    );
    
    return results
      .filter((result): result is PromiseFulfilledResult<YahooFinanceData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }
}

// 日本銀行 API
export class BankOfJapanAPI {
  private static readonly BASE_URL = 'https://www.stat-search.boj.or.jp/ssi/mtshtml/csv_dl.html';
  
  // 実際のBOJ APIは複雑なので、簡単な例として実装
  // 実際の実装では、BOJの統計データAPIを使用
  static async getInflationData(): Promise<BojInflationData | null> {
    try {
      // これは例のデータです。実際はBOJのAPIエンドポイントを使用
      // 現在、BOJは直接的なREST APIを提供していないため、
      // CSVダウンロードまたはスクレイピングが必要
      
      // 仮のデータを返す（実際の実装では適切なAPIまたはデータソースを使用）
      return {
        date: new Date(),
        cpi: 103.2, // 消費者物価指数
        coreInflation: 2.1, // コアインフレ率
        source: 'BOJ',
      };
    } catch (error) {
      console.error('Bank of Japan API error:', error);
      return null;
    }
  }
}

// Alpha Vantage API
export class AlphaVantageAPI {
  private static readonly BASE_URL = 'https://www.alphavantage.co/query';
  private static readonly API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

  static async getStockPrice(symbol: string): Promise<AlphaVantageData | null> {
    if (!this.API_KEY) {
      console.error('Alpha Vantage API key not found');
      return null;
    }

    try {
      const response = await fetch(
        `${this.BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const quote = data['Global Quote'];
      
      if (!quote) {
        return null;
      }
      
      return {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        volume: parseInt(quote['06. volume']),
        lastUpdate: new Date(),
      };
    } catch (error) {
      console.error('Alpha Vantage API error:', error);
      return null;
    }
  }

  static async getForexRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
    if (!this.API_KEY) {
      console.error('Alpha Vantage API key not found');
      return null;
    }

    try {
      const response = await fetch(
        `${this.BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${this.API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const exchangeRate = data['Realtime Currency Exchange Rate'];
      
      if (!exchangeRate) {
        return null;
      }
      
      return parseFloat(exchangeRate['5. Exchange Rate']);
    } catch (error) {
      console.error('Alpha Vantage forex API error:', error);
      return null;
    }
  }
}

// 経済指標の統合取得
export class EconomicDataService {
  static async updateAllIndicators() {
    const results = await Promise.allSettled([
      BankOfJapanAPI.getInflationData(),
      // 他の経済指標も追加可能
    ]);
    
    return results
      .filter((result): result is PromiseFulfilledResult<any> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  static async getJPYUSDRate(): Promise<number | null> {
    // USD/JPY レートを取得
    return AlphaVantageAPI.getForexRate('USD', 'JPY');
  }
}

// 資産価格の自動更新サービス
export class AssetPriceUpdateService {
  static async updateAssetPrices(assets: Array<{ symbol?: string; type: string }>) {
    const stockAssets = assets.filter(asset => 
      asset.type === 'STOCK' && asset.symbol
    );
    
    if (stockAssets.length === 0) {
      return [];
    }
    
    const symbols = stockAssets.map(asset => asset.symbol!);
    
    // Yahoo Finance APIを優先的に使用（無料のため）
    const yahooResults = await YahooFinanceAPI.getMultipleStockPrices(symbols);
    
    // Yahoo Financeで取得できなかった銘柄はAlpha Vantageで試行
    const failedSymbols = symbols.filter(symbol => 
      !yahooResults.some(result => result.symbol.includes(symbol))
    );
    
    const alphaVantageResults = await Promise.allSettled(
      failedSymbols.map(symbol => AlphaVantageAPI.getStockPrice(symbol))
    );
    
    const additionalResults = alphaVantageResults
      .filter((result): result is PromiseFulfilledResult<AlphaVantageData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
    
    return [...yahooResults, ...additionalResults];
  }
}