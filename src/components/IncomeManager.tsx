import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { AppData, MonthlyIncome } from '../types';
import { INCOME_FIELD_LABELS } from '../types';
import { formatYen, formatYenShort, getCurrentYear, formatYearMonth } from '../utils/formatters';
import { calcNetIncome, calcAnnualSummary } from '../utils/taxCalculations';
import { generateId } from '../utils/storage';

interface Props {
  data: AppData;
  onChange: (data: AppData) => void;
}

const CURRENT_YEAR = getCurrentYear();

function emptyIncome(year: number, month: number): MonthlyIncome {
  return {
    id: generateId(),
    year, month,
    grossSalary: 0, incomeTax: 0, residentTax: 0,
    healthInsurance: 0, welfarePension: 0, employmentInsurance: 0,
    longTermCareInsurance: 0, otherDeductions: 0, bonus: 0, otherIncome: 0,
    workingDays: 0, workingHours: 0,
  };
}

interface FormField {
  key: keyof Omit<MonthlyIncome, 'id' | 'year' | 'month'>;
  label: string;
  group: 'income' | 'deduction' | 'other';
}

const FORM_FIELDS: FormField[] = [
  { key: 'grossSalary', label: '額面給与', group: 'income' },
  { key: 'bonus', label: 'ボーナス', group: 'income' },
  { key: 'otherIncome', label: 'その他収入（副業等）', group: 'income' },
  { key: 'incomeTax', label: '所得税', group: 'deduction' },
  { key: 'residentTax', label: '住民税', group: 'deduction' },
  { key: 'healthInsurance', label: '健康保険料', group: 'deduction' },
  { key: 'welfarePension', label: '厚生年金保険料', group: 'deduction' },
  { key: 'employmentInsurance', label: '雇用保険料', group: 'deduction' },
  { key: 'longTermCareInsurance', label: '介護保険料（40歳以上）', group: 'deduction' },
  { key: 'otherDeductions', label: 'その他控除', group: 'deduction' },
];

export default function IncomeManager({ data, onChange }: Props) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MonthlyIncome | null>(null);
  const [showChart, setShowChart] = useState(true);

  const currentIncome = useMemo(() =>
    data.incomes.find(i => i.year === selectedYear && i.month === selectedMonth),
    [data.incomes, selectedYear, selectedMonth]
  );

  const annualSummary = useMemo(() =>
    calcAnnualSummary(data.incomes, selectedYear),
    [data.incomes, selectedYear]
  );

  // Monthly chart data
  const chartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const income = data.incomes.find(inc => inc.year === selectedYear && inc.month === month);
      return {
        label: `${month}月`,
        手取り: income ? calcNetIncome(income) : 0,
        額面: income ? income.grossSalary + income.bonus + income.otherIncome : 0,
        控除合計: income ? income.incomeTax + income.residentTax + income.healthInsurance
          + income.welfarePension + income.employmentInsurance + income.longTermCareInsurance
          + income.otherDeductions : 0,
      };
    });
  }, [data.incomes, selectedYear]);

  function startEdit() {
    const existing = currentIncome;
    if (existing) {
      setFormData({ ...existing });
      setEditingId(existing.id);
    } else {
      const fresh = emptyIncome(selectedYear, selectedMonth);
      setFormData(fresh);
      setEditingId('new');
    }
  }

  function handleSave() {
    if (!formData) return;
    let newIncomes: MonthlyIncome[];
    if (editingId === 'new') {
      newIncomes = [...data.incomes, formData];
    } else {
      newIncomes = data.incomes.map(i => i.id === editingId ? formData : i);
    }
    onChange({ ...data, incomes: newIncomes });
    setEditingId(null);
    setFormData(null);
  }

  function handleDelete(id: string) {
    if (!confirm('この収入データを削除しますか？')) return;
    onChange({ ...data, incomes: data.incomes.filter(i => i.id !== id) });
  }

  function updateField(key: keyof Omit<MonthlyIncome, 'id' | 'year' | 'month'>, value: string) {
    if (!formData) return;
    setFormData({ ...formData, [key]: parseInt(value.replace(/,/g, ''), 10) || 0 });
  }

  const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const netIncome = currentIncome ? calcNetIncome(currentIncome) : 0;

  function formatWorkingHours(h: number): string {
    const hours = Math.floor(h);
    const mins = h % 1 >= 0.5 ? 30 : 0;
    return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">収入管理</h1>
        <div className="flex gap-2">
          <select
            className="input-field w-28"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select
            className="input-field w-20"
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
          >
            {months.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* 月次入力フォーム or 表示 */}
      {editingId ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {formatYearMonth(selectedYear, selectedMonth)} の給与入力
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 収入 */}
            <div>
              <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">収入</h3>
              <div className="space-y-3">
                {FORM_FIELDS.filter(f => f.group === 'income').map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                    <input
                      type="number"
                      className="input-field"
                      value={formData?.[field.key] || ''}
                      onChange={e => updateField(field.key, e.target.value)}
                      placeholder="¥0"
                      min="0"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* 控除 */}
            <div>
              <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">控除（給与から引かれる金額）</h3>
              <div className="space-y-3">
                {FORM_FIELDS.filter(f => f.group === 'deduction').map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                    <input
                      type="number"
                      className="input-field"
                      value={formData?.[field.key] || ''}
                      onChange={e => updateField(field.key, e.target.value)}
                      placeholder="¥0"
                      min="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 勤務情報 */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">勤務情報（日割り・時給計算用）</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">就業日数（日）</label>
                <input
                  type="number"
                  className="input-field"
                  value={formData?.workingDays || ''}
                  onChange={e => updateField('workingDays', e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">勤務時間（例: 8.5 = 8時間30分）</label>
                <input
                  type="number"
                  className="input-field"
                  value={formData?.workingHours || ''}
                  onChange={e => {
                    if (!formData) return;
                    setFormData({ ...formData, workingHours: parseFloat(e.target.value) || 0 });
                  }}
                  placeholder="0"
                  min="0"
                  step="0.5"
                />
              </div>
            </div>
          </div>

          {formData && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg flex flex-wrap gap-4">
              <div>
                <p className="text-xs text-gray-500">総収入</p>
                <p className="text-base font-bold text-gray-800">
                  {formatYen(formData.grossSalary + formData.bonus + formData.otherIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">控除合計</p>
                <p className="text-base font-bold text-red-500">
                  -{formatYen(formData.incomeTax + formData.residentTax + formData.healthInsurance
                    + formData.welfarePension + formData.employmentInsurance
                    + formData.longTermCareInsurance + formData.otherDeductions)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">手取り</p>
                <p className="text-base font-bold text-blue-600">
                  {formatYen(calcNetIncome(formData))}
                </p>
              </div>
              {(formData.workingDays ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-gray-500">日割り（手取り）</p>
                  <p className="text-base font-bold text-emerald-600">
                    {formatYen(Math.round(calcNetIncome(formData) / formData.workingDays!))} / 日
                  </p>
                </div>
              )}
              {(formData.workingHours ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-gray-500">時給換算（手取り）</p>
                  <p className="text-base font-bold text-emerald-600">
                    {formatYen(Math.round(calcNetIncome(formData) / formData.workingHours!))} <span className="text-xs font-normal text-gray-400">/ 時間 ({formatWorkingHours(formData.workingHours!)})</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={handleSave}>保存</button>
            <button className="btn-secondary" onClick={() => { setEditingId(null); setFormData(null); }}>
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {formatYearMonth(selectedYear, selectedMonth)}
            </h2>
            <button className="btn-primary flex items-center gap-1.5" onClick={startEdit}>
              <Plus size={14} />
              {currentIncome ? '編集' : '入力'}
            </button>
          </div>

          {currentIncome ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-3 border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">総収入（額面）</p>
                  <p className="text-lg font-bold text-gray-800">
                    {formatYen(currentIncome.grossSalary + currentIncome.bonus + currentIncome.otherIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">控除合計</p>
                  <p className="text-lg font-bold text-red-500">
                    -{formatYen(currentIncome.incomeTax + currentIncome.residentTax
                      + currentIncome.healthInsurance + currentIncome.welfarePension
                      + currentIncome.employmentInsurance + currentIncome.longTermCareInsurance
                      + currentIncome.otherDeductions)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">手取り</p>
                  <p className="text-lg font-bold text-blue-600">{formatYen(netIncome)}</p>
                </div>
                {(currentIncome.workingDays ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">日割り（手取り）</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatYen(Math.round(netIncome / currentIncome.workingDays!))} <span className="text-xs font-normal text-gray-400">/ 日 ({currentIncome.workingDays}日)</span>
                    </p>
                  </div>
                )}
                {(currentIncome.workingHours ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">時給換算（手取り）</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatYen(Math.round(netIncome / currentIncome.workingHours!))} <span className="text-xs font-normal text-gray-400">/ 時間 ({formatWorkingHours(currentIncome.workingHours!)})</span>
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {FORM_FIELDS.map(f => {
                  const val = currentIncome[f.key] as number;
                  if (val === 0) return null;
                  return (
                    <div key={f.key} className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">{f.label}</p>
                      <p className={`text-sm font-semibold ${f.group === 'deduction' ? 'text-red-500' : 'text-gray-700'}`}>
                        {f.group === 'deduction' ? '-' : ''}{formatYen(val)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button className="btn-danger flex items-center gap-1" onClick={() => handleDelete(currentIncome.id)}>
                  <Trash2 size={12} /> 削除
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">この月のデータはありません</p>
              <p className="text-xs mt-1">「入力」ボタンから給与明細を入力してください</p>
            </div>
          )}
        </div>
      )}

      {/* Annual Summary */}
      <div className="card p-5">
        <button
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
          onClick={() => setShowChart(!showChart)}
        >
          {selectedYear}年 年間収入チャート
          {showChart ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showChart && (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
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
                <Bar dataKey="手取り" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="控除合計" fill="#FCA5A5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {annualSummary.totalGrossIncome > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '年収（額面）', value: annualSummary.totalGrossIncome, color: 'text-gray-700' },
                  { label: '年間手取り', value: annualSummary.totalNetIncome, color: 'text-blue-600' },
                  { label: '年間所得税', value: annualSummary.totalIncomeTax, color: 'text-red-500' },
                  { label: '社会保険料', value: annualSummary.annualSocialInsurance, color: 'text-orange-500' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${item.color}`}>{formatYenShort(item.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Income List */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">入力済みデータ一覧（{selectedYear}年）</h2>
        {data.incomes.filter(i => i.year === selectedYear).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">月</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">額面</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">控除計</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">手取り</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.incomes
                  .filter(i => i.year === selectedYear)
                  .sort((a, b) => a.month - b.month)
                  .map(income => {
                    const net = calcNetIncome(income);
                    const gross = income.grossSalary + income.bonus + income.otherIncome;
                    const deductions = gross - net;
                    return (
                      <tr key={income.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium text-gray-700">{income.month}月</td>
                        <td className="py-2 px-2 text-right text-gray-700">{formatYenShort(gross)}</td>
                        <td className="py-2 px-2 text-right text-red-400">-{formatYenShort(deductions)}</td>
                        <td className="py-2 px-2 text-right font-semibold text-blue-600">{formatYenShort(net)}</td>
                        <td className="py-2 px-2 text-right">
                          <button
                            className="text-gray-300 hover:text-red-400 transition-colors"
                            onClick={() => handleDelete(income.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">データなし</p>
        )}
      </div>
    </div>
  );
}
