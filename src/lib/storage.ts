import { FireCalculationInput } from './fire-calculator';

const STORAGE_KEY = 'fire-simulator-data';

/**
 * ローカルストレージにデータを保存
 */
export function saveToLocalStorage(data: FireCalculationInput): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
  }
}

/**
 * ローカルストレージからデータを読み込み
 */
export function loadFromLocalStorage(): FireCalculationInput | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return null;
    }
    
    const data = JSON.parse(serialized) as FireCalculationInput;
    return validateFireCalculationInput(data) ? data : null;
  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
    return null;
  }
}

/**
 * ローカルストレージのデータを削除
 */
export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('データの削除に失敗しました:', error);
  }
}

/**
 * JSONファイルとしてエクスポート
 */
export function exportToJson(data: FireCalculationInput): void {
  try {
    const serialized = JSON.stringify(data, null, 2);
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateString = now.toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const timeString = now.toLocaleTimeString('sv-SE').replace(/:/g, '-'); // HH-mm-ss
    const filename = `fire-simulator-${dateString}_${timeString}.json`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('エクスポートに失敗しました:', error);
    throw new Error('エクスポートに失敗しました');
  }
}

/**
 * JSONファイルからインポート
 */
export function importFromJson(file: File): Promise<FireCalculationInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text) as FireCalculationInput;
        
        if (validateFireCalculationInput(data)) {
          resolve(data);
        } else {
          reject(new Error('無効なデータ形式です'));
        }
      } catch {
        reject(new Error('ファイルの読み込みに失敗しました'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * FireCalculationInputの型バリデーション
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateFireCalculationInput(data: any): data is FireCalculationInput {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // 必須フィールドの存在チェック
  const requiredFields = [
    'currentAge',
    'retirementAge',
    'assetHoldings',
    'loans',
    'monthlyExpenses',
    'annualNetIncome',
    'postRetirementAnnualIncome',
    'annualPensionAmount',
    'expectedAnnualReturn',
    'inflationRate',
    'lifeExpectancy'
  ];
  
  for (const field of requiredFields) {
    if (!(field in data)) {
      return false;
    }
  }
  
  // 型チェック
  if (typeof data.currentAge !== 'number' ||
      typeof data.retirementAge !== 'number' ||
      typeof data.monthlyExpenses !== 'number' ||
      typeof data.annualNetIncome !== 'number' ||
      typeof data.postRetirementAnnualIncome !== 'number' ||
      typeof data.annualPensionAmount !== 'number' ||
      typeof data.expectedAnnualReturn !== 'number' ||
      typeof data.inflationRate !== 'number' ||
      typeof data.lifeExpectancy !== 'number') {
    return false;
  }
  
  // assetHoldingsの配列チェック
  if (!Array.isArray(data.assetHoldings)) {
    return false;
  }
  
  // 各assetHoldingの構造チェック
  for (const holding of data.assetHoldings) {
    if (!holding ||
        typeof holding.id !== 'string' ||
        typeof holding.name !== 'string' ||
        typeof holding.quantity !== 'number' ||
        typeof holding.pricePerUnit !== 'number' ||
        typeof holding.currency !== 'string' ||
        !['JPY', 'USD'].includes(holding.currency)) {
      return false;
    }
  }
  
  // loansの配列チェック
  if (!Array.isArray(data.loans)) {
    return false;
  }
  
  // 各loanの構造チェック
  for (const loan of data.loans) {
    if (!loan ||
        typeof loan.id !== 'string' ||
        typeof loan.name !== 'string' ||
        typeof loan.balance !== 'number' ||
        typeof loan.interestRate !== 'number' ||
        typeof loan.monthlyPayment !== 'number') {
      return false;
    }
  }
  
  return true;
}