import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, ShoppingCart, PiggyBank, AlertCircle,
} from 'lucide-react';
import type { AppData } from '../types';
import { formatYen, formatYenShort, getCurrentYear, formatPercent } from '../utils/formatters';
import { calcNetIncome, calcAnnualSummary, calcFurusatoLimit, calcFurusatoUsed } from '../utils/taxCalculations';
import { EXPENSE_CATEGORY_COLORS } from '../types';

interface Props {
  data: AppData;
}

export default function Dashboard({ data }: Props) {
  const currentYear = getCurrentYear();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  // 今月の収入
  const currentIncome = useMemo(() =>
    data.incomes.find(i => i.year === currentYear && i.month === currentMonth),
    [data.incomes, currentYear, currentMonth]
  );

  // 今月の支出
  const currentMonthExpenses = useMemo(() => {
    const ym = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return data.expenses.filter(e => e.date.startsWith(ym));
  }, [data.expenses, currentYear, currentMonth]);

  const currentExpenseTotal = currentMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // 今月の手取り
  const currentNetIncome = currentIncome ? calcNetIncome(currentIncome) : 0;

  // 今月の収支
  const currentBalance = currentNetIncome - currentExpenseTotal;

  // 年間サマリー
  const annualSummary = useMemo(() =>
    calcAnnualSummary(data.incomes, currentYear),
    [data.incomes, currentYear]
  );

  // 投資総評価額
  const totalAccumulationValue = useMemo(() =>
    data.accumulationInvestments.reduce((s, i) => s + i.currentValue, 0),
    [data.accumulationInvestments]
  );

  const totalStockValue = useMemo(() => {
    const rate = data.settings.usdJpyRate || 150;
    return data.individualStocks.reduce((s, stock) => {
      const value = stock.currentPrice * stock.quantity;
      return s + (stock.currency === 'USD' ? value * rate : value);
    }, 0);
  }, [data.individualStocks, data.settings.usdJpyRate]);

  const totalInvestmentValue = totalAccumulationValue + totalStockValue;

  // 投資損益
  const totalStockCost = useMemo(() => {
    const rate = data.settings.usdJpyRate || 150;
    return data.individualStocks.reduce((s, stock) => {
      const cost = stock.purchasePrice * stock.quantity;
      return s + (stock.currency === 'USD' ? cost * rate : cost);
    }, 0);
  }, [data.individualStocks, data.settings.usdJpyRate]);

  const totalAccumulationContributed = useMemo(() =>
    data.accumulationInvestments.reduce((s, i) => s + i.totalContributed, 0),
    [data.accumulationInvestments]
  );

  const totalInvestmentCost = totalStockCost + totalAccumulationContributed;
  const totalInvestmentProfit = totalInvestmentValue - totalInvestmentCost;
  const profitPercent = totalInvestmentCost > 0
    ? (totalInvestmentProfit / totalInvestmentCost) * 100 : 0;

  // ふるさと納税
  const furusatoUsed = useMemo(() =>
    calcFurusatoUsed(data.furusatoRecords, currentYear),
    [data.furusatoRecords, currentYear]
  );

  const furusatoLimit = useMemo(() =>
    calcFurusatoLimit(
      annualSummary.totalGrossSalary + annualSummary.totalBonus,
      data.settings.userProfile,
      annualSummary.annualSocialInsurance,
    ),
    [annualSummary, data.settings.userProfile]
  );

  const furusatoRemaining = furusatoLimit - furusatoUsed;

  // 直近6ヶ月の収支チャート
  const monthlyChartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m <= 0) { m += 12; y -= 1; }
      const income = data.incomes.find(inc => inc.year === y && inc.month === m);
      const expKey = `${y}-${String(m).padStart(2, '0')}`;
      const expenses = data.expenses
        .filter(e => e.date.startsWith(expKey))
        .reduce((s, e) => s + e.amount, 0);
      const net = income ? calcNetIncome(income) : 0;
      months.push({
        label: `${m}月`,
        手取り: net,
        支出: expenses,
        収支: net - expenses,
      });
    }
    return months;
  }, [data.incomes, data.expenses, currentYear, currentMonth]);

  // 今月の支出カテゴリ円グラフ
  const expensePieData = useMemo(() => {
    const catMap: Record<string, number> = {};
    currentMonthExpenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [currentMonthExpenses]);

  const summaryCards = [
    {
      label: '今月の手取り',
      value: formatYenShort(currentNetIncome),
      sub: currentIncome ? `額面: ${formatYenShort(currentIncome.grossSalary)}` : '未入力',
      icon: Wallet,
      color: 'blue',
    },
    {
      label: '今月の支出',
      value: formatYenShort(currentExpenseTotal),
      sub: `${currentMonthExpenses.length}件`,
      icon: ShoppingCart,
      color: 'orange',
    },
    {
      label: '今月の収支',
      value: formatYenShort(currentBalance),
      sub: currentBalance >= 0 ? '黒字' : '赤字',
      icon: currentBalance >= 0 ? TrendingUp : TrendingDown,
      color: currentBalance >= 0 ? 'emerald' : 'red',
    },
    {
      label: '投資総評価額',
      value: formatYenShort(totalInvestmentValue),
      sub: totalInvestmentCost > 0
        ? `損益: ${totalInvestmentProfit >= 0 ? '+' : ''}${formatYenShort(totalInvestmentProfit)} (${formatPercent(profitPercent)})`
        : '未入力',
      icon: PiggyBank,
      color: 'purple',
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-0.5">{currentYear}年{currentMonth}月の状況</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                <div className={`p-1.5 rounded-lg ${colorMap[card.color]}`}>
                  <Icon size={16} />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-800">{card.value}</p>
              <p className={`text-xs mt-1 ${
                card.label === '今月の収支'
                  ? currentBalance >= 0 ? 'text-emerald-600' : 'text-red-500'
                  : 'text-gray-400'
              }`}>{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Chart */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">直近6ヶ月の収支推移</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyChartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => formatYenShort(v)}
              />
              <Tooltip
                formatter={(v: number, name: string) => [formatYen(v), name]}
                contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #E2E8F0' }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="手取り" stroke="#3B82F6" fill="url(#netGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="支出" stroke="#F97316" fill="url(#expGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Pie */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">今月の支出内訳</h3>
          {expensePieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {expensePieData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={EXPENSE_CATEGORY_COLORS[entry.name as keyof typeof EXPENSE_CATEGORY_COLORS] || '#94A3B8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [formatYen(v)]}
                    contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {expensePieData.slice(0, 5).map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[item.name as keyof typeof EXPENSE_CATEGORY_COLORS] || '#94A3B8' }}
                      />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-700">{formatYenShort(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <ShoppingCart size={28} className="mb-2 opacity-30" />
              <p className="text-xs">支出データなし</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Furusato status */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">ふるさと納税 {currentYear}年</h3>
            {furusatoRemaining > 0 && (
              <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
                まだ寄付できます
              </span>
            )}
          </div>
          {furusatoLimit > 0 ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>利用済み: {formatYen(furusatoUsed)}</span>
                  <span>上限: {formatYen(furusatoLimit)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-blue-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min((furusatoUsed / furusatoLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-gray-500">残り寄付可能額</p>
                  <p className={`text-lg font-bold ${furusatoRemaining > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {formatYen(Math.max(furusatoRemaining, 0))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">自己負担額</p>
                  <p className="text-lg font-bold text-gray-700">¥2,000</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <AlertCircle size={16} />
              <span>収入データを入力するとふるさと納税の上限額が計算されます</span>
            </div>
          )}
        </div>

        {/* Annual Income Summary */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{currentYear}年 年間収入サマリー</h3>
          {annualSummary.totalGrossIncome > 0 ? (
            <div className="space-y-2">
              {[
                { label: '年収（額面合計）', value: annualSummary.totalGrossIncome, bold: true },
                { label: '　うち給与', value: annualSummary.totalGrossSalary },
                { label: '　うちボーナス', value: annualSummary.totalBonus },
                { label: '社会保険料合計', value: -annualSummary.annualSocialInsurance, negative: true },
                { label: '所得税・住民税', value: -(annualSummary.totalIncomeTax + annualSummary.totalResidentTax), negative: true },
                { label: '年間手取り', value: annualSummary.totalNetIncome, bold: true, highlight: true },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className={`text-xs ${item.bold ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                  <span className={`text-sm font-semibold ${
                    item.highlight ? 'text-blue-600' :
                    item.negative ? 'text-red-500' : 'text-gray-700'
                  }`}>
                    {item.negative && item.value < 0 ? '' : ''}{formatYen(Math.abs(item.value))}
                    {item.negative ? '（控除）' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Wallet size={16} />
              <span>収入データを入力すると年間サマリーが表示されます</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
