import { YearlyDetailData } from '@/lib/fire-calculator';

interface YearlyDetailTableProps {
  data: YearlyDetailData[];
}

export function YearlyDetailTable({ data }: YearlyDetailTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        データがありません
      </div>
    );
  }

  // 全ての列名を収集
  const allSalaryKeys = new Set<string>();
  const allPensionKeys = new Set<string>();
  const allSpecialIncomeKeys = new Set<string>();
  const allAssetKeys = new Set<string>();
  const allSpecialExpenseKeys = new Set<string>();

  data.forEach(row => {
    Object.keys(row.salaries).forEach(key => allSalaryKeys.add(key));
    Object.keys(row.pensions).forEach(key => allPensionKeys.add(key));
    Object.keys(row.specialIncomes).forEach(key => allSpecialIncomeKeys.add(key));
    Object.keys(row.assets).forEach(key => allAssetKeys.add(key));
    Object.keys(row.specialExpenses).forEach(key => allSpecialExpenseKeys.add(key));
  });

  const salaryColumns = Array.from(allSalaryKeys);
  const pensionColumns = Array.from(allPensionKeys);
  const specialIncomeColumns = Array.from(allSpecialIncomeKeys);
  const assetColumns = Array.from(allAssetKeys);
  const specialExpenseColumns = Array.from(allSpecialExpenseKeys);

  const formatCurrency = (value: number) => {
    const manyen = value / 10000;
    return manyen.toFixed(1);
  };

  return (
    <div className="overflow-auto max-h-[1200px]">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-300">
            <th className="sticky top-0 left-0 z-20 bg-gray-100 px-3 py-2 text-left font-semibold border-r border-gray-300">
              年齢
            </th>
            <th className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-left font-semibold border-r border-gray-300">
              西暦
            </th>

            {/* 給与列 */}
            {salaryColumns.map(col => (
              <th key={`salary-${col}`} className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-right font-semibold border-r border-gray-200">
                給与<br />{col}
              </th>
            ))}

            {/* 年金列 */}
            {pensionColumns.map(col => (
              <th key={`pension-${col}`} className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-right font-semibold border-r border-gray-200">
                年金<br />{col}
              </th>
            ))}

            {/* 臨時収入列 */}
            {specialIncomeColumns.map(col => (
              <th key={`special-income-${col}`} className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-right font-semibold border-r border-gray-200">
                臨時収入<br />{col}
              </th>
            ))}

            {/* 支出列 */}
            <th className="sticky top-0 z-10 bg-red-50 px-3 py-2 text-right font-semibold border-r border-gray-200">
              生活費
            </th>

            {/* ローン返済列 */}
            <th className="sticky top-0 z-10 bg-red-50 px-3 py-2 text-right font-semibold border-r border-gray-200">
              ローン返済
            </th>

            {/* 特別支出列 */}
            {specialExpenseColumns.map(col => (
              <th key={`special-expense-${col}`} className="sticky top-0 z-10 bg-red-50 px-3 py-2 text-right font-semibold border-r border-gray-200">
                特別支出<br />{col}
              </th>
            ))}

            {/* 年間収支列 */}
            <th className="sticky top-0 z-10 bg-yellow-50 px-3 py-2 text-right font-semibold border-r border-gray-200">
              年間収支
            </th>

            {/* 現金列 */}
            <th className="sticky top-0 z-10 bg-green-50 px-3 py-2 text-right font-semibold border-r border-gray-200">
              現金資産
            </th>

            {/* 資産列 */}
            {assetColumns.map(col => (
              <th key={`asset-${col}`} className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-right font-semibold border-r border-gray-200">
                資産<br />{col}
              </th>
            ))}

            {/* 合計資産列 */}
            <th className="sticky top-0 z-10 bg-blue-50 px-3 py-2 text-right font-semibold">
              合計資産
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={`${row.year}-${row.age}`}
              className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              <td className="sticky left-0 z-10 px-3 py-2 font-medium border-r border-gray-300 bg-inherit">
                {row.age}
              </td>
              <td className="px-3 py-2 border-r border-gray-300">
                {row.year}
              </td>

              {/* 給与データ */}
              {salaryColumns.map(col => (
                <td key={`salary-${col}-${idx}`} className="px-3 py-2 text-right border-r border-gray-200">
                  {row.salaries[col] ? formatCurrency(row.salaries[col]) : ''}
                </td>
              ))}

              {/* 年金データ */}
              {pensionColumns.map(col => (
                <td key={`pension-${col}-${idx}`} className="px-3 py-2 text-right border-r border-gray-200">
                  {row.pensions[col] ? formatCurrency(row.pensions[col]) : ''}
                </td>
              ))}

              {/* 臨時収入データ */}
              {specialIncomeColumns.map(col => (
                <td key={`special-income-${col}-${idx}`} className="px-3 py-2 text-right border-r border-gray-200">
                  {row.specialIncomes[col] ? formatCurrency(row.specialIncomes[col]) : ''}
                </td>
              ))}

              {/* 生活費（負数） */}
              <td className="px-3 py-2 text-right border-r border-gray-200 text-red-600">
                {formatCurrency(row.expenses)}
              </td>

              {/* ローン返済（負数） */}
              <td className="px-3 py-2 text-right border-r border-gray-200 text-red-600">
                {row.loanPayments !== 0 ? formatCurrency(row.loanPayments) : ''}
              </td>

              {/* 特別支出データ（負数） */}
              {specialExpenseColumns.map(col => (
                <td key={`special-expense-${col}-${idx}`} className="px-3 py-2 text-right border-r border-gray-200 text-red-600">
                  {row.specialExpenses[col] ? formatCurrency(row.specialExpenses[col]) : ''}
                </td>
              ))}

              {/* 年間収支 */}
              <td className={`px-3 py-2 text-right border-r border-gray-200 bg-yellow-50 font-semibold ${row.annualNetCashFlow < 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(row.annualNetCashFlow)}
              </td>

              {/* 現金累計 */}
              <td className={`px-3 py-2 text-right border-r border-gray-200 bg-green-50 font-semibold ${row.cash < 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(row.cash)}
              </td>

              {/* 資産データ */}
              {assetColumns.map(col => (
                <td
                  key={`asset-${col}-${idx}`}
                  className={`px-3 py-2 text-right border-r border-gray-200 ${
                    row.withdrawnAssets.has(col) ? 'bg-red-100' :
                    row.investedAssets.has(col) ? 'bg-green-100' : ''
                  }`}
                >
                  {row.assets[col] ? formatCurrency(row.assets[col]) : ''}
                </td>
              ))}

              {/* 合計資産 */}
              <td className="px-3 py-2 text-right font-semibold bg-blue-50">
                {formatCurrency(row.totalAssets)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-xs text-gray-500">
        ※ 金額は万円単位で表示されています
      </div>
    </div>
  );
}
