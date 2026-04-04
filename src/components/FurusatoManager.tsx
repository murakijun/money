import { useState, useMemo } from 'react';
import { Plus, Trash2, Gift, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { AppData, FurusatoNozeiRecord } from '../types';
import { formatYen, formatPercent, getCurrentYear, getCurrentDateString } from '../utils/formatters';
import { calcFurusatoLimit, calcFurusatoBreakdown, calcFurusatoUsed, calcAnnualSummary } from '../utils/taxCalculations';
import { generateId } from '../utils/storage';

interface Props {
  data: AppData;
  onChange: (data: AppData) => void;
}

const CURRENT_YEAR = getCurrentYear();

export default function FurusatoManager({ data, onChange }: Props) {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [showForm, setShowForm] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [form, setForm] = useState({
    date: getCurrentDateString(),
    prefecture: '',
    amount: '',
    returnGift: '',
    isOneStopException: true,
    isConfirmed: false,
  });

  const annualSummary = useMemo(() =>
    calcAnnualSummary(data.incomes, selectedYear),
    [data.incomes, selectedYear]
  );

  const annualGross = annualSummary.totalGrossSalary + annualSummary.totalBonus;

  const breakdown = useMemo(() =>
    calcFurusatoBreakdown(annualGross, data.settings.userProfile, annualSummary.annualSocialInsurance),
    [annualGross, data.settings.userProfile, annualSummary.annualSocialInsurance]
  );

  const furusatoLimit = breakdown.limit;

  const yearRecords = useMemo(() =>
    data.furusatoRecords
      .filter(r => r.date.startsWith(String(selectedYear)))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [data.furusatoRecords, selectedYear]
  );

  const totalDonated = yearRecords.reduce((s, r) => s + r.amount, 0);
  const remaining = furusatoLimit - totalDonated;
  const effectiveBenefit = Math.max(totalDonated - 2_000, 0);

  function handleAdd() {
    if (!form.prefecture || !form.amount) return;
    const record: FurusatoNozeiRecord = {
      id: generateId(),
      date: form.date,
      prefecture: form.prefecture,
      amount: parseInt(form.amount.replace(/,/g, ''), 10) || 0,
      returnGift: form.returnGift,
      isOneStopException: form.isOneStopException,
      isConfirmed: form.isConfirmed,
    };
    onChange({ ...data, furusatoRecords: [...data.furusatoRecords, record] });
    setForm({ date: form.date, prefecture: '', amount: '', returnGift: '', isOneStopException: true, isConfirmed: false });
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('削除しますか？')) return;
    onChange({ ...data, furusatoRecords: data.furusatoRecords.filter(r => r.id !== id) });
  }

  function toggleConfirmed(id: string) {
    onChange({
      ...data,
      furusatoRecords: data.furusatoRecords.map(r =>
        r.id === id ? { ...r, isConfirmed: !r.isConfirmed } : r
      ),
    });
  }

  const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
  const pct = furusatoLimit > 0 ? Math.min((totalDonated / furusatoLimit) * 100, 100) : 0;
  const oneStopCount = yearRecords.filter(r => r.isOneStopException).length;
  const oneStopWarning = oneStopCount > 5;
  const hasIncomeData = annualGross > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">ふるさと納税管理</h1>
        <select className="input-field w-28" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">寄付上限額（試算）</p>
          {hasIncomeData ? (
            <p className="text-2xl font-bold text-gray-800">{formatYen(furusatoLimit)}</p>
          ) : (
            <p className="text-sm text-gray-400">収入データを入力してください</p>
          )}
          <p className="text-xs text-gray-400 mt-1">自己負担 ¥2,000 のみ</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">今年の寄付済み合計</p>
          <p className="text-2xl font-bold text-blue-600">{formatYen(totalDonated)}</p>
          <p className="text-xs text-gray-400 mt-1">{yearRecords.length}件 · {yearRecords.filter(r => r.isConfirmed).length}件確定</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">残り寄付可能額</p>
          <p className={`text-2xl font-bold ${remaining > 0 ? 'text-emerald-600' : furusatoLimit > 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {hasIncomeData ? formatYen(Math.max(remaining, 0)) : '—'}
          </p>
          {remaining < 0 && (
            <p className="text-xs text-red-400 mt-1">⚠️ 上限を {formatYen(Math.abs(remaining))} 超過</p>
          )}
        </div>
      </div>

      {/* 計算根拠パネル */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={() => setShowBreakdown(!showBreakdown)}
        >
          <span>📊 上限額の計算根拠（収入データから自動計算）</span>
          {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showBreakdown && (
          <div className="px-5 pb-5 border-t border-gray-100">
            {!hasIncomeData ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <AlertCircle size={16} />
                <span>「収入管理」に給与データを入力すると、ここに計算根拠が表示されます。</span>
              </div>
            ) : (
              <div className="mt-4 space-y-0">
                {/* ステップ形式で計算過程を表示 */}
                <div className="space-y-2 text-sm">

                  {/* 収入 */}
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">① 年収（給与 + ボーナス）</span>
                    <span className="font-semibold text-gray-800">{formatYen(breakdown.annualGross)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50 pl-4">
                    <span className="text-gray-400 text-xs">✗ 給与所得控除</span>
                    <span className="text-red-400 text-xs">- {formatYen(breakdown.salaryDeduction)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 bg-gray-50 px-3 rounded-lg">
                    <span className="text-gray-600 font-medium">② 給与所得</span>
                    <span className="font-bold text-gray-800">{formatYen(breakdown.netIncome)}</span>
                  </div>

                  {/* 所得控除 */}
                  <div className="mt-2 mb-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">所得控除</span>
                  </div>
                  {[
                    { label: '基礎控除', value: breakdown.basicDeduction },
                    { label: '社会保険料控除', value: breakdown.socialInsuranceDeduction },
                    breakdown.spouseDeduction > 0 ? { label: '配偶者控除', value: breakdown.spouseDeduction } : null,
                    breakdown.dependentDeduction > 0 ? { label: `扶養控除（${data.settings.userProfile.dependentCount}人）`, value: breakdown.dependentDeduction } : null,
                    breakdown.lifeInsuranceDeduction > 0 ? { label: '生命保険料控除', value: breakdown.lifeInsuranceDeduction } : null,
                    breakdown.earthquakeDeduction > 0 ? { label: '地震保険料控除', value: breakdown.earthquakeDeduction } : null,
                    breakdown.otherDeductions > 0 ? { label: 'その他控除', value: breakdown.otherDeductions } : null,
                  ].filter(Boolean).map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 pl-4 border-b border-gray-50">
                      <span className="text-gray-400 text-xs">✗ {item!.label}</span>
                      <span className="text-red-400 text-xs">- {formatYen(item!.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-1.5 pl-4 border-b border-gray-50">
                    <span className="text-gray-400 text-xs font-medium">所得控除 合計</span>
                    <span className="text-red-400 text-xs font-medium">- {formatYen(breakdown.totalDeductions)}</span>
                  </div>

                  {/* 課税所得 */}
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 bg-gray-50 px-3 rounded-lg">
                    <span className="text-gray-600 font-medium">③ 課税所得</span>
                    <span className="font-bold text-gray-800">{formatYen(breakdown.taxableIncome)}</span>
                  </div>

                  {/* 税率・住民税 */}
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">所得税率（復興税込み）</span>
                    <span className="font-semibold text-gray-700">{formatPercent(breakdown.incomeTaxRate * 100)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">④ 住民税所得割（10%）</span>
                    <span className="font-semibold text-gray-700">{formatYen(breakdown.residentTaxAmount)}</span>
                  </div>

                  {/* 計算式 */}
                  <div className="mt-3 bg-blue-50 rounded-xl p-3">
                    <p className="text-xs text-blue-600 font-semibold mb-2">⑤ ふるさと納税 上限額の計算式</p>
                    <p className="text-xs text-blue-700 font-mono bg-white rounded p-2 border border-blue-100">
                      住民税所得割 × 20% ÷ (90% - 所得税率) + 2,000円
                    </p>
                    <p className="text-xs text-blue-700 font-mono bg-white rounded p-2 border border-blue-100 mt-1">
                      {formatYen(breakdown.residentTaxAmount)} × 20% ÷ (90% - {formatPercent(breakdown.incomeTaxRate * 100)}) + 2,000円
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-blue-800">= 寄付上限額</span>
                      <span className="text-xl font-bold text-blue-700">{formatYen(furusatoLimit)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    ※ この計算は概算です。正確な上限額は各ふるさと納税サイトのシミュレーターや税理士にご確認ください。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {furusatoLimit > 0 && (
        <div className="card p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>利用状況: {totalDonated > 0 ? `${Math.round(pct)}%` : '未利用'}</span>
            <span>上限: {formatYen(furusatoLimit)}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-yellow-400' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <div>
              <p className="text-gray-400">税控除見込み額</p>
              <p className="text-emerald-600 font-bold text-sm">{formatYen(effectiveBenefit)}</p>
              <p className="text-gray-400">（寄付額 - ¥2,000）</p>
            </div>
            <div>
              <p className="text-gray-400">実質自己負担</p>
              <p className="text-gray-700 font-bold text-sm">{formatYen(Math.min(totalDonated, 2_000))}</p>
            </div>
            <div>
              <p className="text-gray-400">ワンストップ特例申請数</p>
              <p className={`font-bold text-sm ${oneStopWarning ? 'text-red-500' : 'text-gray-700'}`}>
                {oneStopCount} / 5自治体
              </p>
            </div>
          </div>
          {oneStopWarning && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600">
                ワンストップ特例は年間5自治体まで。6自治体以上は確定申告が必要です。
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">ふるさと納税について</h3>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>• 寄付額から <strong>¥2,000</strong> を引いた金額が住民税・所得税から控除されます</li>
          <li>• 上限額は<strong>年収・家族構成・社会保険料</strong>等により変わります（当アプリの計算は概算です）</li>
          <li>• <strong>ワンストップ特例</strong>：確定申告不要（給与所得者で5自治体以内の場合）</li>
          <li>• <strong>確定申告</strong>：医療費控除等がある場合や6自治体以上の場合は確定申告を選択</li>
        </ul>
      </div>

      {/* Add form */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">寄付記録（{selectedYear}年）</h2>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> 追加
          </button>
        </div>

        {showForm && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">寄付日</label>
                <input type="date" className="input-field" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">自治体名</label>
                <input type="text" className="input-field" value={form.prefecture} onChange={e => setForm({ ...form, prefecture: e.target.value })} placeholder="北海道余市町" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">寄付金額</label>
                <input type="number" className="input-field" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="¥0" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">返礼品</label>
                <input type="text" className="input-field" value={form.returnGift} onChange={e => setForm({ ...form, returnGift: e.target.value })} placeholder="ウニ・いくら セット 500g" />
              </div>
            </div>
            <div className="flex items-center gap-5 mt-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={form.isOneStopException} onChange={e => setForm({ ...form, isOneStopException: e.target.checked })} className="rounded" />
                ワンストップ特例申請済み
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={form.isConfirmed} onChange={e => setForm({ ...form, isConfirmed: e.target.checked })} className="rounded" />
                確定申告済み
              </label>
              <div className="flex gap-2 ml-auto">
                <button className="btn-primary" onClick={handleAdd}>追加</button>
                <button className="btn-secondary" onClick={() => setShowForm(false)}>キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {yearRecords.length > 0 ? (
          <div className="space-y-2">
            {yearRecords.map(record => (
              <div key={record.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 group">
                <Gift size={16} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-700">{record.prefecture}</span>
                    <span className="text-xs text-gray-400">{record.date}</span>
                    {record.isOneStopException && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">ワンストップ</span>
                    )}
                    {record.isConfirmed && (
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> 確定申告済
                      </span>
                    )}
                  </div>
                  {record.returnGift && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">返礼品: {record.returnGift}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-700">{formatYen(record.amount)}</p>
                  <button
                    className="text-xs text-gray-300 hover:text-blue-500 transition-colors mt-0.5"
                    onClick={() => toggleConfirmed(record.id)}
                  >
                    {record.isConfirmed ? '確定取消' : '確定申告済にする'}
                  </button>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                  onClick={() => handleDelete(record.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Gift size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">寄付記録なし</p>
          </div>
        )}
      </div>
    </div>
  );
}
