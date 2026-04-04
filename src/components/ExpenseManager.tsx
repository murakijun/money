import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { Plus, Trash2, Filter } from 'lucide-react';
import type { AppData, Expense, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_COLORS } from '../types';
import { formatYen, formatYenShort, getCurrentYear, getCurrentDateString } from '../utils/formatters';
import { generateId } from '../utils/storage';

interface Props {
  data: AppData;
  onChange: (data: AppData) => void;
}

const CURRENT_YEAR = getCurrentYear();

export default function ExpenseManager({ data, onChange }: Props) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{
    date: string;
    category: ExpenseCategory;
    amount: string;
    description: string;
    isRecurring: boolean;
  }>({
    date: getCurrentDateString(),
    category: '食費',
    amount: '',
    description: '',
    isRecurring: false,
  });

  const ym = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const monthExpenses = useMemo(() => {
    return data.expenses
      .filter(e => e.date.startsWith(ym))
      .filter(e => filterCategory === 'all' || e.category === filterCategory)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.expenses, ym, filterCategory]);

  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);

  // Category breakdown for current month (all categories, no filter)
  const allMonthExpenses = useMemo(() =>
    data.expenses.filter(e => e.date.startsWith(ym)),
    [data.expenses, ym]
  );

  const categoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    allMonthExpenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allMonthExpenses]);

  // Monthly trend (last 6 months)
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let m = selectedMonth - i;
      let y = selectedYear;
      if (m <= 0) { m += 12; y -= 1; }
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const total = data.expenses
        .filter(e => e.date.startsWith(key))
        .reduce((s, e) => s + e.amount, 0);
      months.push({ label: `${m}月`, 支出合計: total });
    }
    return months;
  }, [data.expenses, selectedYear, selectedMonth]);

  function handleAdd() {
    if (!form.amount || !form.date) return;
    const expense: Expense = {
      id: generateId(),
      date: form.date,
      category: form.category,
      amount: parseInt(form.amount.replace(/,/g, ''), 10) || 0,
      description: form.description,
      isRecurring: form.isRecurring,
    };
    onChange({ ...data, expenses: [...data.expenses, expense] });
    setForm({
      date: form.date, category: form.category,
      amount: '', description: '', isRecurring: false,
    });
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('この支出を削除しますか？')) return;
    onChange({ ...data, expenses: data.expenses.filter(e => e.id !== id) });
  }

  const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">支出管理</h1>
        <div className="flex gap-2">
          <select className="input-field w-28" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select className="input-field w-20" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {months.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">支出推移（直近6ヶ月）</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => formatYenShort(v)} />
              <Tooltip
                formatter={(v: number) => [formatYen(v), '支出合計']}
                contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #E2E8F0' }}
              />
              <Bar dataKey="支出合計" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">カテゴリ別内訳</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={2} dataKey="value">
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={EXPENSE_CATEGORY_COLORS[entry.name as ExpenseCategory] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [formatYen(v), name]}
                    contentStyle={{ fontSize: 11, borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1">
                {categoryData.slice(0, 4).map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[item.name as ExpenseCategory] || '#94A3B8' }} />
                      <span className="text-gray-500">{item.name}</span>
                    </div>
                    <span className="text-gray-700 font-medium">{formatYenShort(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-300 text-xs">データなし</div>
          )}
        </div>
      </div>

      {/* Add expense */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              {selectedYear}年{selectedMonth}月の支出
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">合計: <span className="text-orange-500 font-semibold">{formatYen(monthTotal)}</span>（{allMonthExpenses.length}件）</p>
          </div>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} />
            追加
          </button>
        </div>

        {showForm && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">日付</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">カテゴリ</label>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">金額</label>
                <input
                  type="number"
                  className="input-field"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="¥0"
                  min="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">メモ</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="例: スーパー"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                  className="rounded"
                />
                毎月の固定費
              </label>
              <div className="flex gap-2 ml-auto">
                <button className="btn-primary" onClick={handleAdd}>追加</button>
                <button className="btn-secondary" onClick={() => setShowForm(false)}>キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterCategory === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            onClick={() => setFilterCategory('all')}
          >
            すべて
          </button>
          {categoryData.map(c => (
            <button
              key={c.name}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterCategory === c.name ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              onClick={() => setFilterCategory(c.name as ExpenseCategory)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* List */}
        {monthExpenses.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {monthExpenses.map(expense => (
              <div key={expense.id} className="flex items-center py-2.5 gap-3 group">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[expense.category] || '#94A3B8' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{expense.date.slice(5).replace('-', '/')}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{expense.category}</span>
                    {expense.isRecurring && <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">固定費</span>}
                  </div>
                  {expense.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{expense.description}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                  {formatYen(expense.amount)}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                  onClick={() => handleDelete(expense.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">支出データなし</p>
        )}
      </div>
    </div>
  );
}
