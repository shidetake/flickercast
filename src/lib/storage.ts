import { FireCalculationInput } from './fire-calculator';

const STORAGE_KEY = 'flickercast-data';

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
    const filename = `flickercast-${dateString}_${timeString}.json`;
    
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
    console.error('バリデーションエラー: データがオブジェクトではありません', data);
    return false;
  }
  
  // 必須フィールドの存在チェック
  const requiredFields = [
    'currentAge',
    'assetHoldings',
    'loans',
    'pensionPlans',
    'salaryPlans',
    'specialExpenses',
    'specialIncomes',
    'expenseSegments',
    'inflationRate',
    'lifeExpectancy'
  ];
  
  for (const field of requiredFields) {
    if (!(field in data)) {
      console.error(`バリデーションエラー: 必須フィールド '${field}' が見つかりません`);
      return false;
    }
  }
  
  // 型チェック
  const numberFields = [
    'currentAge',
    'inflationRate',
    'lifeExpectancy'
  ];
  
  for (const field of numberFields) {
    if (typeof data[field] !== 'number') {
      console.error(`バリデーションエラー: フィールド '${field}' は数値である必要があります (実際の値: ${data[field]}, 型: ${typeof data[field]})`);
      return false;
    }
  }
  
  // assetHoldingsの配列チェック
  if (!Array.isArray(data.assetHoldings)) {
    console.error('バリデーションエラー: assetHoldingsは配列である必要があります', data.assetHoldings);
    return false;
  }
  
  // 各assetHoldingの構造チェック
  for (let i = 0; i < data.assetHoldings.length; i++) {
    const holding = data.assetHoldings[i];
    if (!holding || typeof holding !== 'object') {
      console.error(`バリデーションエラー: assetHoldings[${i}]がオブジェクトではありません`, holding);
      return false;
    }
    
    const requiredHoldingFields = ['id', 'name', 'quantity', 'pricePerUnit', 'currency'];
    for (const field of requiredHoldingFields) {
      if (!(field in holding)) {
        console.error(`バリデーションエラー: assetHoldings[${i}].${field} が見つかりません`);
        return false;
      }
    }

    if (typeof holding.id !== 'string' ||
        typeof holding.name !== 'string' ||
        typeof holding.quantity !== 'number' ||
        typeof holding.pricePerUnit !== 'number' ||
        typeof holding.currency !== 'string') {
      console.error(`バリデーションエラー: assetHoldings[${i}]のフィールド型が不正です`, {
        id: `${holding.id} (${typeof holding.id})`,
        name: `${holding.name} (${typeof holding.name})`,
        quantity: `${holding.quantity} (${typeof holding.quantity})`,
        pricePerUnit: `${holding.pricePerUnit} (${typeof holding.pricePerUnit})`,
        currency: `${holding.currency} (${typeof holding.currency})`
      });
      return false;
    }

    // expectedReturnはオプショナル、存在する場合は数値チェック
    if ('expectedReturn' in holding && typeof holding.expectedReturn !== 'number') {
      console.error(`バリデーションエラー: assetHoldings[${i}].expectedReturn は数値である必要があります (実際の値: ${holding.expectedReturn}, 型: ${typeof holding.expectedReturn})`);
      return false;
    }
    
    if (!['JPY', 'USD'].includes(holding.currency)) {
      console.error(`バリデーションエラー: assetHoldings[${i}].currency は 'JPY' または 'USD' である必要があります (実際の値: ${holding.currency})`);
      return false;
    }
  }
  
  // loansの配列チェック
  if (!Array.isArray(data.loans)) {
    console.error('バリデーションエラー: loansは配列である必要があります', data.loans);
    return false;
  }
  
  // 各loanの構造チェック
  for (let i = 0; i < data.loans.length; i++) {
    const loan = data.loans[i];
    if (!loan || typeof loan !== 'object') {
      console.error(`バリデーションエラー: loans[${i}]がオブジェクトではありません`, loan);
      return false;
    }
    
    const requiredLoanFields = ['id', 'name', 'balance', 'monthlyPayment'];
    for (const field of requiredLoanFields) {
      if (!(field in loan)) {
        console.error(`バリデーションエラー: loans[${i}].${field} が見つかりません`);
        return false;
      }
    }

    if (typeof loan.id !== 'string' ||
        typeof loan.name !== 'string' ||
        typeof loan.balance !== 'number' ||
        typeof loan.monthlyPayment !== 'number') {
      console.error(`バリデーションエラー: loans[${i}]のフィールド型が不正です`, {
        id: `${loan.id} (${typeof loan.id})`,
        name: `${loan.name} (${typeof loan.name})`,
        balance: `${loan.balance} (${typeof loan.balance})`,
        monthlyPayment: `${loan.monthlyPayment} (${typeof loan.monthlyPayment})`
      });
      return false;
    }

    // interestRateはオプショナル、存在する場合は数値チェック
    if ('interestRate' in loan && typeof loan.interestRate !== 'number') {
      console.error(`バリデーションエラー: loans[${i}].interestRate は数値である必要があります (実際の値: ${loan.interestRate}, 型: ${typeof loan.interestRate})`);
      return false;
    }
  }
  
  // pensionPlansの配列チェック
  if (!Array.isArray(data.pensionPlans)) {
    console.error('バリデーションエラー: pensionPlansは配列である必要があります', data.pensionPlans);
    return false;
  }

  // 各pensionPlanの構造チェック
  for (let i = 0; i < data.pensionPlans.length; i++) {
    const pension = data.pensionPlans[i];
    if (!pension || typeof pension !== 'object') {
      console.error(`バリデーションエラー: pensionPlans[${i}]がオブジェクトではありません`, pension);
      return false;
    }

    const requiredPensionFields = ['id', 'name', 'startAge', 'endAge'];
    for (const field of requiredPensionFields) {
      if (!(field in pension)) {
        console.error(`バリデーションエラー: pensionPlans[${i}].${field} が見つかりません`);
        return false;
      }
    }

    if (typeof pension.id !== 'string' ||
        typeof pension.name !== 'string' ||
        typeof pension.startAge !== 'number' ||
        typeof pension.endAge !== 'number') {
      console.error(`バリデーションエラー: pensionPlans[${i}]のフィールド型が不正です`, {
        id: `${pension.id} (${typeof pension.id})`,
        name: `${pension.name} (${typeof pension.name})`,
        startAge: `${pension.startAge} (${typeof pension.startAge})`,
        endAge: `${pension.endAge} (${typeof pension.endAge})`
      });
      return false;
    }

    // annualAmountはオプショナル、存在する場合は数値チェック
    if ('annualAmount' in pension && typeof pension.annualAmount !== 'number') {
      console.error(`バリデーションエラー: pensionPlans[${i}].annualAmount は数値である必要があります (実際の値: ${pension.annualAmount}, 型: ${typeof pension.annualAmount})`);
      return false;
    }
  }

  // salaryPlansの配列チェック
  if (!Array.isArray(data.salaryPlans)) {
    console.error('バリデーションエラー: salaryPlansは配列である必要があります', data.salaryPlans);
    return false;
  }

  // 各salaryPlanの構造チェック
  for (let i = 0; i < data.salaryPlans.length; i++) {
    const salary = data.salaryPlans[i];
    if (!salary || typeof salary !== 'object') {
      console.error(`バリデーションエラー: salaryPlans[${i}]がオブジェクトではありません`, salary);
      return false;
    }

    const requiredSalaryFields = ['id', 'name', 'startAge', 'endAge'];
    for (const field of requiredSalaryFields) {
      if (!(field in salary)) {
        console.error(`バリデーションエラー: salaryPlans[${i}].${field} が見つかりません`);
        return false;
      }
    }

    if (typeof salary.id !== 'string' ||
        typeof salary.name !== 'string' ||
        typeof salary.startAge !== 'number' ||
        typeof salary.endAge !== 'number') {
      console.error(`バリデーションエラー: salaryPlans[${i}]のフィールド型が不正です`, {
        id: `${salary.id} (${typeof salary.id})`,
        name: `${salary.name} (${typeof salary.name})`,
        startAge: `${salary.startAge} (${typeof salary.startAge})`,
        endAge: `${salary.endAge} (${typeof salary.endAge})`
      });
      return false;
    }

    // annualAmountはオプショナル、存在する場合は数値チェック
    if ('annualAmount' in salary && typeof salary.annualAmount !== 'number') {
      console.error(`バリデーションエラー: salaryPlans[${i}].annualAmount は数値である必要があります (実際の値: ${salary.annualAmount}, 型: ${typeof salary.annualAmount})`);
      return false;
    }
  }

  // specialExpensesの配列チェック
  if (!Array.isArray(data.specialExpenses)) {
    console.error('バリデーションエラー: specialExpensesは配列である必要があります', data.specialExpenses);
    return false;
  }
  
  // 各specialExpenseの構造チェック
  for (let i = 0; i < data.specialExpenses.length; i++) {
    const expense = data.specialExpenses[i];
    if (!expense || typeof expense !== 'object') {
      console.error(`バリデーションエラー: specialExpenses[${i}]がオブジェクトではありません`, expense);
      return false;
    }
    
    const requiredExpenseFields = ['id', 'name', 'amount'];
    for (const field of requiredExpenseFields) {
      if (!(field in expense)) {
        console.error(`バリデーションエラー: specialExpenses[${i}].${field} が見つかりません`);
        return false;
      }
    }

    if (typeof expense.id !== 'string' ||
        typeof expense.name !== 'string' ||
        typeof expense.amount !== 'number') {
      console.error(`バリデーションエラー: specialExpenses[${i}]のフィールド型が不正です`, {
        id: `${expense.id} (${typeof expense.id})`,
        name: `${expense.name} (${typeof expense.name})`,
        amount: `${expense.amount} (${typeof expense.amount})`
      });
      return false;
    }

    // targetAgeはオプショナル、存在する場合は数値チェック
    if ('targetAge' in expense && typeof expense.targetAge !== 'number') {
      console.error(`バリデーションエラー: specialExpenses[${i}].targetAge は数値である必要があります (実際の値: ${expense.targetAge}, 型: ${typeof expense.targetAge})`);
      return false;
    }
  }
  
  // specialIncomesの配列チェック
  if (!Array.isArray(data.specialIncomes)) {
    console.error('バリデーションエラー: specialIncomesは配列である必要があります', data.specialIncomes);
    return false;
  }
  
  // 各specialIncomeの構造チェック
  for (let i = 0; i < data.specialIncomes.length; i++) {
    const income = data.specialIncomes[i];
    if (!income || typeof income !== 'object') {
      console.error(`バリデーションエラー: specialIncomes[${i}]がオブジェクトではありません`, income);
      return false;
    }

    const requiredIncomeFields = ['id', 'name', 'amount'];
    for (const field of requiredIncomeFields) {
      if (!(field in income)) {
        console.error(`バリデーションエラー: specialIncomes[${i}].${field} が見つかりません`);
        return false;
      }
    }

    if (typeof income.id !== 'string' ||
        typeof income.name !== 'string' ||
        typeof income.amount !== 'number') {
      console.error(`バリデーションエラー: specialIncomes[${i}]のフィールド型が不正です`, {
        id: `${income.id} (${typeof income.id})`,
        name: `${income.name} (${typeof income.name})`,
        amount: `${income.amount} (${typeof income.amount})`
      });
      return false;
    }

    // targetAgeはオプショナル、存在する場合は数値チェック
    if ('targetAge' in income && typeof income.targetAge !== 'number') {
      console.error(`バリデーションエラー: specialIncomes[${i}].targetAge は数値である必要があります (実際の値: ${income.targetAge}, 型: ${typeof income.targetAge})`);
      return false;
    }
  }

  // expenseSegmentsの配列チェック
  if (!Array.isArray(data.expenseSegments)) {
    console.error('バリデーションエラー: expenseSegmentsは配列である必要があります', data.expenseSegments);
    return false;
  }

  // 各expenseSegmentの構造チェック
  for (let i = 0; i < data.expenseSegments.length; i++) {
    const segment = data.expenseSegments[i];
    if (!segment || typeof segment !== 'object') {
      console.error(`バリデーションエラー: expenseSegments[${i}]がオブジェクトではありません`, segment);
      return false;
    }

    const requiredSegmentFields = ['id', 'startAge', 'endAge', 'monthlyExpenses'];
    for (const field of requiredSegmentFields) {
      if (!(field in segment)) {
        console.error(`バリデーションエラー: expenseSegments[${i}].${field} が見つかりません`);
        return false;
      }
    }

    if (typeof segment.id !== 'string' ||
        typeof segment.startAge !== 'number' ||
        typeof segment.endAge !== 'number' ||
        typeof segment.monthlyExpenses !== 'number') {
      console.error(`バリデーションエラー: expenseSegments[${i}]のフィールド型が不正です`, {
        id: `${segment.id} (${typeof segment.id})`,
        startAge: `${segment.startAge} (${typeof segment.startAge})`,
        endAge: `${segment.endAge} (${typeof segment.endAge})`,
        monthlyExpenses: `${segment.monthlyExpenses} (${typeof segment.monthlyExpenses})`
      });
      return false;
    }
  }

  console.log('バリデーション成功: データ形式は正しいです');
  return true;
}