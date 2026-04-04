import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import type { AppData, AccumulationInvestment, IndividualStock, AccumulationType, StockMarket, StockType, Currency } from '../types';
import { formatYen, formatYenShort, formatPercent, getProfitLossColor, getProfitLossSign, getCurrentDateString } from '../utils/formatters';
import { generateId } from '../utils/storage';

interface Props {
  data: AppData;
  onChange: (data: AppData) => void;
}

const ACCUMULATION_TYPES: AccumulationType[] = ['新NISA(つみたて枠)', '新NISA(成長投資枠)', 'iDeCo', 'その他積立'];
const MARKETS: StockMarket[] = ['東証', '米国株', 'その他'];
const STOCK_TYPES: StockType[] = ['株式', 'ETF', '投資信託', 'REIT'];

const TYPE_COLORS: Record<string, string> = {
  '新NISA(つみたて枠)': '#3B82F6',
  '新NISA(成長投資枠)': '#6366F1',
  'iDeCo': '#8B5CF6',
  'その他積立': '#A78BFA',
  '東証': '#10B981',
  '米国株': '#F59E0B',
  'その他': '#94A3B8',
};

const NISA_LIMITS = {
  '新NISA(つみたて枠)': 1_200_000,   // 年間120万円
  '新NISA(成長投資枠)': 2_400_000,   // 年間240万円
  'iDeCo': 276_000,                  // 会社員:月2.3万×12
  'その他積立': null,
};

export default function InvestmentManager({ data, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<'accumulation' | 'stocks'>('accumulation');
  const [showAccumForm, setShowAccumForm] = useState(false);
  const [showStockForm, setShowStockForm] = useState(false);
  const [editingAccumId, setEditingAccumId] = useState<string | null>(null);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [inlinePriceId, setInlinePriceId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState('');
  const [inlineAccumValueId, setInlineAccumValueId] = useState<string | null>(null);
  const [inlineAccumValue, setInlineAccumValue] = useState('');

  const [accumForm, setAccumForm] = useState<Omit<AccumulationInvestment, 'id'>>({
    type: '新NISA(つみたて枠)',
    name: '',
    monthlyAmount: 0,
    startDate: getCurrentDateString(),
    currentValue: 0,
    totalContributed: 0,
    isActive: true,
  });

  const [stockForm, setStockForm] = useState<Omit<IndividualStock, 'id'>>({
    name: '',
    ticker: '',
    market: '東証',
    type: '株式',
    purchaseDate: getCurrentDateString(),
    purchasePrice: 0,
    quantity: 0,
    currentPrice: 0,
    currency: 'JPY',
    usdJpyRate: data.settings.usdJpyRate || 150,
    nisaType: null,
    memo: '',
  });

  const usdJpy = data.settings.usdJpyRate || 150;

  // Portfolio totals
  const accumulationTotal = useMemo(() =>
    data.accumulationInvestments.reduce((s, i) => s + i.currentValue, 0),
    [data.accumulationInvestments]
  );

  const accumulationContributed = useMemo(() =>
    data.accumulationInvestments.reduce((s, i) => s + i.totalContributed, 0),
    [data.accumulationInvestments]
  );

  const stocksTotal = useMemo(() =>
    data.individualStocks.reduce((s, stock) => {
      const val = stock.currentPrice * stock.quantity;
      return s + (stock.currency === 'USD' ? val * usdJpy : val);
    }, 0),
    [data.individualStocks, usdJpy]
  );

  const stocksCost = useMemo(() =>
    data.individualStocks.reduce((s, stock) => {
      const cost = stock.purchasePrice * stock.quantity;
      return s + (stock.currency === 'USD' ? cost * usdJpy : cost);
    }, 0),
    [data.individualStocks, usdJpy]
  );

  const grandTotal = accumulationTotal + stocksTotal;
  const grandCost = accumulationContributed + stocksCost;
  const grandProfit = grandTotal - grandCost;

  // Pie data
  const pieData = useMemo(() => {
    const items: { name: string; value: number }[] = [];
    data.accumulationInvestments.forEach(i => {
      if (i.currentValue > 0) {
        const existing = items.find(p => p.name === i.type);
        if (existing) existing.value += i.currentValue;
        else items.push({ name: i.type, value: i.currentValue });
      }
    });
    data.individualStocks.forEach(s => {
      const val = s.currentPrice * s.quantity;
      const jpyVal = s.currency === 'USD' ? val * usdJpy : val;
      if (jpyVal > 0) {
        const key = s.market;
        const existing = items.find(p => p.name === key);
        if (existing) existing.value += jpyVal;
        else items.push({ name: key, value: jpyVal });
      }
    });
    return items.filter(i => i.value > 0);
  }, [data.accumulationInvestments, data.individualStocks, usdJpy]);

  // NISA annual usage
  const nisaUsage = useMemo(() => {
    const result: Record<string, number> = {};
    data.accumulationInvestments.forEach(i => {
      result[i.type] = (result[i.type] || 0) + i.monthlyAmount * 12;
    });
    // 個別株の成長投資枠を加算（購入コストベース）
    data.individualStocks.forEach(s => {
      if (s.nisaType === '新NISA(成長投資枠)') {
        const cost = s.purchasePrice * s.quantity;
        const costJpy = s.currency === 'USD' ? cost * (s.usdJpyRate || usdJpy) : cost;
        result['新NISA(成長投資枠)'] = (result['新NISA(成長投資枠)'] || 0) + costJpy;
      }
    });
    return result;
  }, [data.accumulationInvestments, data.individualStocks, usdJpy]);

  // Accumulation handlers
  function saveAccumulation() {
    if (!accumForm.name) return;
    if (editingAccumId) {
      onChange({
        ...data,
        accumulationInvestments: data.accumulationInvestments.map(i =>
          i.id === editingAccumId ? { ...accumForm, id: editingAccumId } : i
        ),
      });
    } else {
      onChange({
        ...data,
        accumulationInvestments: [...data.accumulationInvestments, { ...accumForm, id: generateId() }],
      });
    }
    setShowAccumForm(false);
    setEditingAccumId(null);
    setAccumForm({ type: '新NISA(つみたて枠)', name: '', monthlyAmount: 0, startDate: getCurrentDateString(), currentValue: 0, totalContributed: 0, isActive: true });
  }

  function editAccumulation(inv: AccumulationInvestment) {
    setAccumForm({ ...inv });
    setEditingAccumId(inv.id);
    setShowAccumForm(true);
  }

  function deleteAccumulation(id: string) {
    if (!confirm('削除しますか？')) return;
    onChange({ ...data, accumulationInvestments: data.accumulationInvestments.filter(i => i.id !== id) });
  }

  // Stock handlers
  function saveStock() {
    if (!stockForm.name) return;
    if (editingStockId) {
      onChange({
        ...data,
        individualStocks: data.individualStocks.map(s =>
          s.id === editingStockId ? { ...stockForm, id: editingStockId } : s
        ),
      });
    } else {
      onChange({
        ...data,
        individualStocks: [...data.individualStocks, { ...stockForm, id: generateId() }],
      });
    }
    setShowStockForm(false);
    setEditingStockId(null);
    setStockForm({ name: '', ticker: '', market: '東証', type: '株式', purchaseDate: getCurrentDateString(), purchasePrice: 0, quantity: 0, currentPrice: 0, currency: 'JPY', usdJpyRate: usdJpy, nisaType: null, memo: '' });
  }

  function editStock(stock: IndividualStock) {
    setStockForm({ ...stock });
    setEditingStockId(stock.id);
    setShowStockForm(true);
  }

  function deleteStock(id: string) {
    if (!confirm('削除しますか？')) return;
    onChange({ ...data, individualStocks: data.individualStocks.filter(s => s.id !== id) });
  }

  function commitInlinePrice(id: string) {
    const val = parseFloat(inlinePriceValue);
    if (!isNaN(val) && val >= 0) {
      onChange({
        ...data,
        individualStocks: data.individualStocks.map(s =>
          s.id === id ? { ...s, currentPrice: val } : s
        ),
      });
    }
    setInlinePriceId(null);
  }

  function commitInlineAccumValue(id: string) {
    const val = parseFloat(inlineAccumValue);
    if (!isNaN(val) && val >= 0) {
      onChange({
        ...data,
        accumulationInvestments: data.accumulationInvestments.map(i =>
          i.id === id ? { ...i, currentValue: val } : i
        ),
      });
    }
    setInlineAccumValueId(null);
  }

  function stockProfitJpy(stock: IndividualStock): number {
    const profit = (stock.currentPrice - stock.purchasePrice) * stock.quantity;
    return stock.currency === 'USD' ? profit * usdJpy : profit;
  }

  function stockProfitPercent(stock: IndividualStock): number {
    if (stock.purchasePrice === 0) return 0;
    return ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800">投資管理</h1>

      {/* Portfolio Overview */}
      <div className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Pie */}
          <div className="flex flex-col items-center">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={TYPE_COLORS[entry.name] || '#94A3B8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatYen(v)]} contentStyle={{ fontSize: 11, borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1 mt-1">
                  {pieData.map(item => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[item.name] || '#94A3B8' }} />
                        <span className="text-gray-500">{item.name}</span>
                      </div>
                      <span className="text-gray-700 font-medium">{formatPercent((item.value / grandTotal) * 100)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-300 text-xs">データなし</div>
            )}
          </div>

          {/* Summary */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            {[
              { label: '総資産評価額', value: grandTotal, color: 'text-gray-800', bold: true },
              { label: '総投資コスト', value: grandCost, color: 'text-gray-600' },
              {
                label: '評価損益',
                value: grandProfit,
                color: grandProfit >= 0 ? 'text-emerald-600' : 'text-red-500',
                prefix: grandProfit >= 0 ? '+' : '',
              },
              {
                label: '損益率',
                value: grandCost > 0 ? (grandProfit / grandCost) * 100 : 0,
                color: grandProfit >= 0 ? 'text-emerald-600' : 'text-red-500',
                isPercent: true,
                prefix: grandProfit >= 0 ? '+' : '',
              },
              { label: '積立投資評価額', value: accumulationTotal, color: 'text-blue-600' },
              { label: '個別株評価額', value: stocksTotal, color: 'text-indigo-600' },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className={`text-lg font-bold mt-0.5 ${item.color}`}>
                  {item.isPercent
                    ? `${item.prefix || ''}${formatPercent(item.value as number)}`
                    : `${item.prefix || ''}${formatYenShort(item.value as number)}`
                  }
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['accumulation', 'stocks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab === 'accumulation' ? '積立投資' : '個別株・ETF'}
          </button>
        ))}
      </div>

      {/* Accumulation Tab */}
      {activeTab === 'accumulation' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">積立投資一覧</h2>
            <button className="btn-primary flex items-center gap-1.5" onClick={() => { setEditingAccumId(null); setShowAccumForm(true); }}>
              <Plus size={14} /> 追加
            </button>
          </div>

          {/* NISA Limits */}
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700 mb-2">新NISA年間投資枠</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: '新NISA(つみたて枠)', limit: 1_200_000, label: 'つみたて枠' },
                { key: '新NISA(成長投資枠)', limit: 2_400_000, label: '成長投資枠' },
              ] as const).map(item => {
                const used = (nisaUsage[item.key] || 0);
                const pct = Math.min((used / item.limit) * 100, 100);
                return (
                  <div key={item.key}>
                    <div className="flex justify-between text-xs text-blue-600 mb-1">
                      <span>{item.label}</span>
                      <span>{formatYenShort(used)} / {formatYenShort(item.limit)}</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {showAccumForm && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">種類</label>
                  <select className="input-field" value={accumForm.type} onChange={e => setAccumForm({ ...accumForm, type: e.target.value as AccumulationType })}>
                    {ACCUMULATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">ファンド名</label>
                  <input type="text" className="input-field" value={accumForm.name} onChange={e => setAccumForm({ ...accumForm, name: e.target.value })} placeholder="eMAXIS Slim 全世界株式" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">毎月積立額</label>
                  <input type="number" className="input-field" value={accumForm.monthlyAmount || ''} onChange={e => setAccumForm({ ...accumForm, monthlyAmount: Number(e.target.value) })} placeholder="¥0" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">現在評価額</label>
                  <input type="number" className="input-field" value={accumForm.currentValue || ''} onChange={e => setAccumForm({ ...accumForm, currentValue: Number(e.target.value) })} placeholder="¥0" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">累計拠出額</label>
                  <input type="number" className="input-field" value={accumForm.totalContributed || ''} onChange={e => setAccumForm({ ...accumForm, totalContributed: Number(e.target.value) })} placeholder="¥0" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">開始日</label>
                  <input type="date" className="input-field" value={accumForm.startDate} onChange={e => setAccumForm({ ...accumForm, startDate: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={accumForm.isActive} onChange={e => setAccumForm({ ...accumForm, isActive: e.target.checked })} />
                  積立中
                </label>
                <div className="flex gap-2 ml-auto">
                  <button className="btn-primary" onClick={saveAccumulation}>保存</button>
                  <button className="btn-secondary" onClick={() => { setShowAccumForm(false); setEditingAccumId(null); }}>キャンセル</button>
                </div>
              </div>
            </div>
          )}

          {data.accumulationInvestments.length > 0 ? (
            <div className="space-y-3">
              {data.accumulationInvestments.map(inv => {
                const profit = inv.currentValue - inv.totalContributed;
                const profitPct = inv.totalContributed > 0 ? (profit / inv.totalContributed) * 100 : 0;
                return (
                  <div key={inv.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLORS[inv.type]}20`, color: TYPE_COLORS[inv.type] }}>
                            {inv.type}
                          </span>
                          {!inv.isActive && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">停止中</span>}
                        </div>
                        <p className="text-sm font-semibold text-gray-700 mt-1">{inv.name}</p>
                        <p className="text-xs text-gray-400">月額: {formatYen(inv.monthlyAmount)}</p>
                      </div>
                      <div className="text-right">
                        {inlineAccumValueId === inv.id ? (
                          <input
                            type="number"
                            className="input-field w-32 text-sm py-1 text-right"
                            value={inlineAccumValue}
                            onChange={e => setInlineAccumValue(e.target.value)}
                            onBlur={() => commitInlineAccumValue(inv.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitInlineAccumValue(inv.id);
                              if (e.key === 'Escape') setInlineAccumValueId(null);
                            }}
                            autoFocus
                            min="0"
                          />
                        ) : (
                          <button
                            className="text-right group flex items-center gap-1 hover:text-blue-600 transition-colors"
                            onClick={() => {
                              setInlineAccumValueId(inv.id);
                              setInlineAccumValue(String(inv.currentValue));
                            }}
                            title="クリックして評価額を更新"
                          >
                            <Edit2 size={10} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0" />
                            <span className="text-base font-bold text-gray-800">{formatYenShort(inv.currentValue)}</span>
                          </button>
                        )}
                        {inv.totalContributed > 0 && (
                          <p className={`text-xs font-semibold ${getProfitLossColor(profit)}`}>
                            {getProfitLossSign(profit)}{formatYenShort(profit)} ({getProfitLossSign(profitPct)}{formatPercent(profitPct)})
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 justify-end">
                      <button className="text-gray-400 hover:text-blue-500 transition-colors" onClick={() => editAccumulation(inv)}><Edit2 size={13} /></button>
                      <button className="text-gray-300 hover:text-red-400 transition-colors" onClick={() => deleteAccumulation(inv.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">積立投資データなし</p>
          )}
        </div>
      )}

      {/* Stocks Tab */}
      {activeTab === 'stocks' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">個別株・ETF・投資信託</h2>
            <button className="btn-primary flex items-center gap-1.5" onClick={() => { setEditingStockId(null); setShowStockForm(true); }}>
              <Plus size={14} /> 追加
            </button>
          </div>

          {showStockForm && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">銘柄名</label>
                  <input type="text" className="input-field" value={stockForm.name} onChange={e => setStockForm({ ...stockForm, name: e.target.value })} placeholder="トヨタ自動車" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">ティッカー/証券コード</label>
                  <input type="text" className="input-field" value={stockForm.ticker} onChange={e => setStockForm({ ...stockForm, ticker: e.target.value })} placeholder="7203 / AAPL" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">市場</label>
                  <select className="input-field" value={stockForm.market} onChange={e => setStockForm({ ...stockForm, market: e.target.value as StockMarket })}>
                    {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">種類</label>
                  <select className="input-field" value={stockForm.type} onChange={e => setStockForm({ ...stockForm, type: e.target.value as StockType })}>
                    {STOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">通貨</label>
                  <select className="input-field" value={stockForm.currency} onChange={e => setStockForm({ ...stockForm, currency: e.target.value as Currency })}>
                    <option value="JPY">JPY（円）</option>
                    <option value="USD">USD（ドル）</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">購入日</label>
                  <input type="date" className="input-field" value={stockForm.purchaseDate} onChange={e => setStockForm({ ...stockForm, purchaseDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">購入単価 ({stockForm.currency})</label>
                  <input type="number" className="input-field" value={stockForm.purchasePrice || ''} onChange={e => setStockForm({ ...stockForm, purchasePrice: Number(e.target.value) })} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">保有数量</label>
                  <input type="number" className="input-field" value={stockForm.quantity || ''} onChange={e => setStockForm({ ...stockForm, quantity: Number(e.target.value) })} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">現在値 ({stockForm.currency})</label>
                  <input type="number" className="input-field" value={stockForm.currentPrice || ''} onChange={e => setStockForm({ ...stockForm, currentPrice: Number(e.target.value) })} placeholder="0" />
                </div>
                {stockForm.currency === 'USD' && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ドル円レート</label>
                    <input type="number" className="input-field" value={stockForm.usdJpyRate || ''} onChange={e => setStockForm({ ...stockForm, usdJpyRate: Number(e.target.value) })} placeholder="150" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">NISA口座</label>
                  <select
                    className="input-field"
                    value={stockForm.nisaType ?? ''}
                    onChange={e => setStockForm({ ...stockForm, nisaType: e.target.value === '新NISA(成長投資枠)' ? '新NISA(成長投資枠)' : null })}
                  >
                    <option value="">なし（特定口座）</option>
                    <option value="新NISA(成長投資枠)">新NISA（成長投資枠）</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">メモ</label>
                  <input type="text" className="input-field" value={stockForm.memo || ''} onChange={e => setStockForm({ ...stockForm, memo: e.target.value })} placeholder="購入理由など" />
                </div>
              </div>
              <div className="flex gap-2 mt-3 justify-end">
                <button className="btn-primary" onClick={saveStock}>保存</button>
                <button className="btn-secondary" onClick={() => { setShowStockForm(false); setEditingStockId(null); }}>キャンセル</button>
              </div>
            </div>
          )}

          {data.individualStocks.length > 0 ? (<>
            {/* PC: テーブル表示 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['銘柄', '種類', '購入価格', '現在値', '保有数', '評価額', '損益', ''].map(h => (
                      <th key={h} className="text-left py-2 px-2 text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.individualStocks.map(stock => {
                    const profitJpy = stockProfitJpy(stock);
                    const profitPct = stockProfitPercent(stock);
                    const currentValueJpy = stock.currency === 'USD'
                      ? stock.currentPrice * stock.quantity * (stock.usdJpyRate || usdJpy)
                      : stock.currentPrice * stock.quantity;
                    return (
                      <tr key={stock.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <p className="font-semibold text-gray-700">{stock.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-gray-400">{stock.ticker} · {stock.market}</span>
                            {stock.nisaType && (
                              <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">NISA</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-gray-500">{stock.type}</td>
                        <td className="py-2 px-2 text-gray-600">
                          {stock.currency === 'USD' ? `$${stock.purchasePrice.toLocaleString()}` : formatYen(stock.purchasePrice)}
                        </td>
                        <td className="py-2 px-2">
                          {inlinePriceId === stock.id ? (
                            <input
                              type="number"
                              className="input-field w-28 text-xs py-1"
                              value={inlinePriceValue}
                              onChange={e => setInlinePriceValue(e.target.value)}
                              onBlur={() => commitInlinePrice(stock.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitInlinePrice(stock.id);
                                if (e.key === 'Escape') setInlinePriceId(null);
                              }}
                              autoFocus
                              min="0"
                              step="0.01"
                            />
                          ) : (
                            <button
                              className="text-left group flex items-center gap-1 hover:text-blue-600 transition-colors"
                              onClick={() => { setInlinePriceId(stock.id); setInlinePriceValue(String(stock.currentPrice)); }}
                              title="クリックして現在値を更新"
                            >
                              <span className="text-gray-600">
                                {stock.currency === 'USD' ? `$${stock.currentPrice.toLocaleString()}` : formatYen(stock.currentPrice)}
                              </span>
                              <Edit2 size={10} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0" />
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-2 text-gray-600">{stock.quantity.toLocaleString()}</td>
                        <td className="py-2 px-2 font-semibold text-gray-700">{formatYenShort(currentValueJpy)}</td>
                        <td className="py-2 px-2">
                          <p className={`font-semibold ${getProfitLossColor(profitJpy)}`}>
                            {getProfitLossSign(profitJpy)}{formatYenShort(profitJpy)}
                          </p>
                          <p className={getProfitLossColor(profitPct)}>
                            {getProfitLossSign(profitPct)}{formatPercent(profitPct)}
                          </p>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1.5">
                            <button className="text-gray-300 hover:text-blue-500 transition-colors" onClick={() => editStock(stock)}><Edit2 size={13} /></button>
                            <button className="text-gray-300 hover:text-red-400 transition-colors" onClick={() => deleteStock(stock.id)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* スマホ: カード表示 */}
            <div className="md:hidden space-y-3">
              {data.individualStocks.map(stock => {
                const profitJpy = stockProfitJpy(stock);
                const profitPct = stockProfitPercent(stock);
                const currentValueJpy = stock.currency === 'USD'
                  ? stock.currentPrice * stock.quantity * (stock.usdJpyRate || usdJpy)
                  : stock.currentPrice * stock.quantity;
                return (
                  <div key={stock.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">{stock.name}</p>
                          {stock.nisaType && (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">NISA</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{stock.ticker} · {stock.market} · {stock.type}</p>
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button className="text-gray-300 hover:text-blue-500 transition-colors p-1" onClick={() => editStock(stock)}><Edit2 size={15} /></button>
                        <button className="text-gray-300 hover:text-red-400 transition-colors p-1" onClick={() => deleteStock(stock.id)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-400 mb-0.5">購入単価 × 数量</p>
                        <p className="text-gray-700">
                          {stock.currency === 'USD' ? `$${stock.purchasePrice.toLocaleString()}` : formatYen(stock.purchasePrice)} × {stock.quantity}
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-gray-400 mb-0.5">現在値（タップで更新）</p>
                        {inlinePriceId === stock.id ? (
                          <input
                            type="number"
                            className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-sm"
                            value={inlinePriceValue}
                            onChange={e => setInlinePriceValue(e.target.value)}
                            onBlur={() => commitInlinePrice(stock.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitInlinePrice(stock.id);
                              if (e.key === 'Escape') setInlinePriceId(null);
                            }}
                            autoFocus
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          <button
                            className="text-left w-full font-semibold text-blue-700"
                            onClick={() => { setInlinePriceId(stock.id); setInlinePriceValue(String(stock.currentPrice)); }}
                          >
                            {stock.currency === 'USD' ? `$${stock.currentPrice.toLocaleString()}` : formatYen(stock.currentPrice)}
                          </button>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-400 mb-0.5">評価額</p>
                        <p className="font-semibold text-gray-700">{formatYenShort(currentValueJpy)}</p>
                      </div>
                      <div className={`rounded-lg p-2 ${profitJpy >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className="text-gray-400 mb-0.5">評価損益</p>
                        <p className={`font-semibold ${getProfitLossColor(profitJpy)}`}>
                          {getProfitLossSign(profitJpy)}{formatYenShort(profitJpy)}
                        </p>
                        <p className={`text-xs ${getProfitLossColor(profitPct)}`}>
                          {getProfitLossSign(profitPct)}{formatPercent(profitPct)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>) : (
            <p className="text-sm text-gray-400 text-center py-6">個別株データなし</p>
          )}
        </div>
      )}
    </div>
  );
}
