import { Child, SpecialExpense, MultiYearEducationExpense } from './types';

/**
 * 教育費の年間費用
 * 金額は円単位
 */

// 幼稚園（年間費用、3年保育想定）
const KINDERGARTEN_ANNUAL_COST = {
  public: 200000, // 公立: 年間20万円
  private: 350000, // 私立: 年間35万円
};

// 小学校（年間費用、6年間）
const ELEMENTARY_ANNUAL_COST = {
  public: 350000, // 公立: 年間35万円
  private: 1800000, // 私立: 年間180万円
};

// 中学校（年間費用、3年間）
const JUNIOR_HIGH_ANNUAL_COST = {
  public: 550000, // 公立: 年間55万円
  private: 1600000, // 私立: 年間160万円
};

// 高校（年間費用、3年間）
const HIGH_SCHOOL_ANNUAL_COST = {
  public: 600000, // 公立: 年間60万円
  private: 1000000, // 私立: 年間100万円
};

// 大学（年間費用、4年間）
const UNIVERSITY_ANNUAL_COST = {
  public: 550000, // 公立: 年間55万円
  private: 1000000, // 私立: 年間100万円
};

// 大学入学金（初年度のみ、私立・公立共通）
const UNIVERSITY_ENTRANCE_FEE = 300000; // 30万円

/**
 * 子供の誕生年から、各教育段階に到達する年齢（ユーザーの年齢）を計算
 */
function calculateEducationMilestones(
  childBirthYear: number,
  userBirthYear: number
): {
  kindergartenAge: number; // 幼稚園入園時のユーザー年齢
  elementaryAge: number; // 小学校入学時のユーザー年齢
  juniorHighAge: number; // 中学校入学時のユーザー年齢
  highSchoolAge: number; // 高校入学時のユーザー年齢
  universityAge: number; // 大学入学時のユーザー年齢
  juniorHighExamAge: number; // 中学受験準備開始時のユーザー年齢
  highSchoolExamAge: number; // 高校受験準備開始時のユーザー年齢
  universityExamAge: number; // 大学受験準備開始時のユーザー年齢
} {
  const ageDifference = childBirthYear - userBirthYear;

  return {
    kindergartenAge: ageDifference + 3, // 子供が3歳のとき
    elementaryAge: ageDifference + 6, // 子供が6歳のとき
    juniorHighAge: ageDifference + 12, // 子供が12歳のとき
    highSchoolAge: ageDifference + 15, // 子供が15歳のとき
    universityAge: ageDifference + 18, // 子供が18歳のとき
    juniorHighExamAge: ageDifference + 9, // 子供が9歳のとき（小4から塾）
    highSchoolExamAge: ageDifference + 12, // 子供が12歳のとき（中1から塾）
    universityExamAge: ageDifference + 15, // 子供が15歳のとき（高1から塾）
  };
}

/**
 * 子供の複数年教育費を自動生成
 * @param child 子供情報
 * @param currentYear 現在の年（例: 2025）
 * @param currentAge ユーザーの現在年齢
 * @returns 生成された複数年教育費の配列
 */
export function generateEducationMultiYearExpenses(
  child: Child,
  currentYear: number,
  currentAge: number
): MultiYearEducationExpense[] {
  const expenses: MultiYearEducationExpense[] = [];

  // ユーザーの誕生年を計算
  const userBirthYear = currentYear - currentAge;
  // 親子の年齢差を計算
  const ageDifference = child.birthYear - userBirthYear;

  // 幼稚園（3歳から3年間）
  const kindergartenAnnualCost = child.kindergartenPrivate
    ? KINDERGARTEN_ANNUAL_COST.private
    : KINDERGARTEN_ANNUAL_COST.public;

  const kindergartenStartAge = ageDifference + 3;
  if (kindergartenStartAge >= currentAge || kindergartenStartAge + 2 >= currentAge) {
    expenses.push({
      id: `${child.id}-kindergarten-multiyear`,
      name: '幼稚園',
      annualAmount: kindergartenAnnualCost,
      childAge: 3,
      years: 3,
    });
  }

  // 小学校（6歳から6年間）
  const elementaryAnnualCost = child.elementaryPrivate
    ? ELEMENTARY_ANNUAL_COST.private
    : ELEMENTARY_ANNUAL_COST.public;

  const elementaryStartAge = ageDifference + 6;
  if (elementaryStartAge >= currentAge || elementaryStartAge + 5 >= currentAge) {
    expenses.push({
      id: `${child.id}-elementary-multiyear`,
      name: '小学校',
      annualAmount: elementaryAnnualCost,
      childAge: 6,
      years: 6,
    });
  }

  // 中学（12歳から3年間）
  const juniorHighAnnualCost = child.juniorHighPrivate
    ? JUNIOR_HIGH_ANNUAL_COST.private
    : JUNIOR_HIGH_ANNUAL_COST.public;

  const juniorHighStartAge = ageDifference + 12;
  if (juniorHighStartAge >= currentAge || juniorHighStartAge + 2 >= currentAge) {
    expenses.push({
      id: `${child.id}-juniorhigh-multiyear`,
      name: '中学',
      annualAmount: juniorHighAnnualCost,
      childAge: 12,
      years: 3,
    });
  }

  // 高校（15歳から3年間）
  const highSchoolAnnualCost = child.highSchoolPrivate
    ? HIGH_SCHOOL_ANNUAL_COST.private
    : HIGH_SCHOOL_ANNUAL_COST.public;

  const highSchoolStartAge = ageDifference + 15;
  if (highSchoolStartAge >= currentAge || highSchoolStartAge + 2 >= currentAge) {
    expenses.push({
      id: `${child.id}-highschool-multiyear`,
      name: '高校',
      annualAmount: highSchoolAnnualCost,
      childAge: 15,
      years: 3,
    });
  }

  // 大学（18歳から4年間）
  const universityAnnualCost = child.universityPrivate
    ? UNIVERSITY_ANNUAL_COST.private
    : UNIVERSITY_ANNUAL_COST.public;

  const universityStartAge = ageDifference + 18;
  if (universityStartAge >= currentAge || universityStartAge + 3 >= currentAge) {
    expenses.push({
      id: `${child.id}-university-multiyear`,
      name: '大学',
      annualAmount: universityAnnualCost,
      childAge: 18,
      years: 4,
    });
  }

  return expenses;
}

/**
 * 子供の単年教育費を自動生成（大学入学金のみ）
 * @param child 子供情報
 * @param currentYear 現在の年（例: 2025）
 * @param currentAge ユーザーの現在年齢
 * @returns 生成された特別支出の配列
 */
export function generateEducationExpenses(
  child: Child,
  currentYear: number,
  currentAge: number
): SpecialExpense[] {
  const expenses: SpecialExpense[] = [];

  // ユーザーの誕生年を計算
  const userBirthYear = currentYear - currentAge;

  // 各教育段階に到達するユーザーの年齢を計算
  const milestones = calculateEducationMilestones(child.birthYear, userBirthYear);

  // 大学入学金のみ（18歳時、私立・公立共通で30万円）
  if (milestones.universityAge >= currentAge) {
    expenses.push({
      id: `${child.id}-university-entrance`,
      name: '大学入学金',
      amount: UNIVERSITY_ENTRANCE_FEE,
      targetAge: milestones.universityAge,
      autoGenerated: true,
      childId: child.id,
    });
  }

  return expenses;
}

/**
 * 複数の子供の複数年教育費を一括生成
 */
export function generateAllEducationMultiYearExpenses(
  children: Child[],
  currentYear: number,
  currentAge: number
): MultiYearEducationExpense[] {
  return children.flatMap(child =>
    generateEducationMultiYearExpenses(child, currentYear, currentAge)
  );
}

/**
 * 複数の子供の単年教育費を一括生成（大学入学金のみ）
 */
export function generateAllEducationExpenses(
  children: Child[],
  currentYear: number,
  currentAge: number
): SpecialExpense[] {
  return children.flatMap(child =>
    generateEducationExpenses(child, currentYear, currentAge)
  );
}


/**
 * 複数年教育費を各年のSpecialExpenseに展開
 * @param multiYearExpense 複数年教育費
 * @param child 子供情報
 * @param currentYear 現在の年（例: 2025）
 * @param currentAge ユーザーの現在年齢
 * @returns 展開されたSpecialExpenseの配列
 */
export function expandMultiYearExpense(
  multiYearExpense: MultiYearEducationExpense,
  child: Child,
  currentYear: number,
  currentAge: number
): SpecialExpense[] {
  const expenses: SpecialExpense[] = [];

  // ユーザーの誕生年を計算
  const userBirthYear = currentYear - currentAge;

  // 親子の年齢差を計算
  const ageDifference = child.birthYear - userBirthYear;

  // 各年の支出を生成
  for (let i = 0; i < multiYearExpense.years; i++) {
    const childAge = multiYearExpense.childAge + i;
    const parentAge = ageDifference + childAge;

    // 現在の年齢より前の支出はスキップ
    if (parentAge < currentAge) {
      continue;
    }

    expenses.push({
      id: `${multiYearExpense.id}-year-${i}`,
      name: multiYearExpense.name,
      amount: multiYearExpense.annualAmount,
      targetAge: parentAge,
      autoGenerated: false, // ユーザー入力なので自動生成ではない
      childId: child.id,
    });
  }

  return expenses;
}

/**
 * 子供の複数年教育費を全て展開
 * @param child 子供情報
 * @param currentYear 現在の年（例: 2025）
 * @param currentAge ユーザーの現在年齢
 * @returns 展開されたSpecialExpenseの配列
 */
export function expandAllMultiYearExpenses(
  child: Child,
  currentYear: number,
  currentAge: number
): SpecialExpense[] {
  return child.multiYearExpenses.flatMap(expense =>
    expandMultiYearExpense(expense, child, currentYear, currentAge)
  );
}

/**
 * 複数の子供の複数年教育費を一括展開
 */
export function expandAllChildrenMultiYearExpenses(
  children: Child[],
  currentYear: number,
  currentAge: number
): SpecialExpense[] {
  return children.flatMap(child =>
    expandAllMultiYearExpenses(child, currentYear, currentAge)
  );
}
