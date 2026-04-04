import type { AppData } from '../types';
import { formatYen, formatYenShort, formatPercent } from './formatters';
import { calcNetIncome, calcAnnualSummary } from './taxCalculations';

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const DATE_STR = `${CURRENT_YEAR}年${now.getMonth() + 1}月${now.getDate()}日`;

function yen(n: number) { return formatYen(n); }
function yenS(n: number) { return formatYenShort(n); }
function pct(n: number) { return formatPercent(n); }
function sign(n: number) { return n >= 0 ? '+' : ''; }

// ──────────────────────────────────────────────
// 共通計算ヘルパー
// ──────────────────────────────────────────────
function calcInvestmentTotals(data: AppData) {
  const usdJpy = data.settings.usdJpyRate || 150;
  const accumValue = data.accumulationInvestments.reduce((s, i) => s + i.currentValue, 0);
  const accumCost = data.accumulationInvestments.reduce((s, i) => s + i.totalContributed, 0);
  const stockValue = data.individualStocks.reduce((s, st) => {
    const v = st.currentPrice * st.quantity;
    return s + (st.currency === 'USD' ? v * (st.usdJpyRate || usdJpy) : v);
  }, 0);
  const stockCost = data.individualStocks.reduce((s, st) => {
    const c = st.purchasePrice * st.quantity;
    return s + (st.currency === 'USD' ? c * (st.usdJpyRate || usdJpy) : c);
  }, 0);
  const total = accumValue + stockValue;
  const cost = accumCost + stockCost;
  const profit = total - cost;
  return { accumValue, accumCost, stockValue, stockCost, total, cost, profit };
}

// ──────────────────────────────────────────────
// テキストレポート
// ──────────────────────────────────────────────
export function generateTextReport(data: AppData): string {
  const lines: string[] = [];
  const hr = '─'.repeat(50);
  const h = (title: string) => { lines.push('', hr, `■ ${title}`, hr); };
  const row = (label: string, value: string) => {
    lines.push(`  ${label.padEnd(20)}${value}`);
  };

  lines.push('資産管理レポート');
  lines.push(`作成日: ${DATE_STR}`);

  // ── 投資資産概要 ──
  h('投資資産概要');
  const inv = calcInvestmentTotals(data);
  row('総資産評価額', yenS(inv.total));
  row('総投資コスト', yenS(inv.cost));
  row('評価損益', `${sign(inv.profit)}${yenS(inv.profit)}  (${sign(inv.profit)}${pct(inv.cost > 0 ? (inv.profit / inv.cost) * 100 : 0)})`);
  row('積立投資評価額', yenS(inv.accumValue));
  row('個別株評価額', yenS(inv.stockValue));

  // ── 今年の収入サマリー ──
  const annualSummary = calcAnnualSummary(data.incomes, CURRENT_YEAR);
  if (annualSummary.totalGrossIncome > 0) {
    h(`${CURRENT_YEAR}年 収入サマリー`);
    row('年収（額面）', yen(annualSummary.totalGrossIncome));
    row('  給与', yen(annualSummary.totalGrossSalary));
    if (annualSummary.totalBonus > 0) row('  ボーナス', yen(annualSummary.totalBonus));
    if (annualSummary.totalOtherIncome > 0) row('  その他収入', yen(annualSummary.totalOtherIncome));
    row('控除合計', `-${yen(annualSummary.totalDeductions)}`);
    row('  所得税', `-${yen(annualSummary.totalIncomeTax)}`);
    row('  住民税', `-${yen(annualSummary.totalResidentTax)}`);
    row('  健康保険料', `-${yen(annualSummary.totalHealthInsurance)}`);
    row('  厚生年金', `-${yen(annualSummary.totalWelfarePension)}`);
    row('  雇用保険', `-${yen(annualSummary.totalEmploymentInsurance)}`);
    row('年間手取り', yen(annualSummary.totalNetIncome));
  }

  // ── 積立投資一覧 ──
  if (data.accumulationInvestments.length > 0) {
    h('積立投資一覧');
    data.accumulationInvestments.forEach(inv => {
      lines.push(`  【${inv.type}】 ${inv.name}`);
      row('    月額', yen(inv.monthlyAmount));
      row('    現在評価額', yen(inv.currentValue));
      if (inv.totalContributed > 0) {
        const p = inv.currentValue - inv.totalContributed;
        row('    評価損益', `${sign(p)}${yen(p)}`);
      }
    });
  }

  // ── 個別株一覧 ──
  if (data.individualStocks.length > 0) {
    const usdJpy = data.settings.usdJpyRate || 150;
    h('個別株・ETF一覧');
    data.individualStocks.forEach(st => {
      const val = st.currentPrice * st.quantity;
      const valJpy = st.currency === 'USD' ? val * (st.usdJpyRate || usdJpy) : val;
      const cost = st.purchasePrice * st.quantity;
      const costJpy = st.currency === 'USD' ? cost * (st.usdJpyRate || usdJpy) : cost;
      const profit = valJpy - costJpy;
      const label = st.nisaType ? `${st.name} [NISA]` : st.name;
      lines.push(`  ${label}  (${st.ticker || '-'} / ${st.market})`);
      row('    評価額', yenS(valJpy));
      row('    評価損益', `${sign(profit)}${yenS(profit)}`);
    });
  }

  // ── 今年の支出 ──
  const yearExpenses = data.expenses.filter(e => e.date.startsWith(String(CURRENT_YEAR)));
  if (yearExpenses.length > 0) {
    h(`${CURRENT_YEAR}年 支出サマリー`);
    const total = yearExpenses.reduce((s, e) => s + e.amount, 0);
    row('年間支出合計', yen(total));
    const catMap: Record<string, number> = {};
    yearExpenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    Object.entries(catMap).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
      row(`  ${cat}`, yen(amt));
    });
  }

  // ── ふるさと納税 ──
  const thisYearFurusato = data.furusatoRecords.filter(r => r.date.startsWith(String(CURRENT_YEAR)));
  if (thisYearFurusato.length > 0) {
    h(`${CURRENT_YEAR}年 ふるさと納税`);
    const total = thisYearFurusato.reduce((s, r) => s + r.amount, 0);
    row('寄付合計', yen(total));
    thisYearFurusato.forEach(r => {
      lines.push(`  ${r.date}  ${r.prefecture}  ${yen(r.amount)}  ${r.returnGift || ''}`);
    });
  }

  lines.push('', hr);
  lines.push('※ このレポートは資産管理アプリから自動生成されました');
  return lines.join('\n');
}

// ──────────────────────────────────────────────
// HTMLレポート（印刷 / PDF用）
// ──────────────────────────────────────────────
export function printHTMLReport(data: AppData): void {
  const inv = calcInvestmentTotals(data);
  const annualSummary = calcAnnualSummary(data.incomes, CURRENT_YEAR);
  const usdJpy = data.settings.usdJpyRate || 150;
  const name = data.settings.userProfile.name || '';

  const yearExpenses = data.expenses.filter(e => e.date.startsWith(String(CURRENT_YEAR)));
  const expenseTotal = yearExpenses.reduce((s, e) => s + e.amount, 0);
  const catMap: Record<string, number> = {};
  yearExpenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });

  const profitPct = inv.cost > 0 ? (inv.profit / inv.cost) * 100 : 0;

  function section(title: string, content: string) {
    return `
      <div class="section">
        <h2>${title}</h2>
        ${content}
      </div>`;
  }

  function kv(label: string, value: string, cls = '') {
    return `<tr><td class="label">${label}</td><td class="value ${cls}">${value}</td></tr>`;
  }

  function table(rows: string) {
    return `<table class="kv-table">${rows}</table>`;
  }

  // 投資概要
  const invSection = section('投資資産概要', table([
    kv('総資産評価額', yenS(inv.total), 'bold'),
    kv('総投資コスト', yenS(inv.cost)),
    kv('評価損益', `${sign(inv.profit)}${yenS(inv.profit)}　(${sign(inv.profit)}${pct(profitPct)})`, inv.profit >= 0 ? 'green' : 'red'),
    kv('積立投資評価額', yenS(inv.accumValue)),
    kv('個別株評価額', yenS(inv.stockValue)),
  ].join('')));

  // 収入サマリー
  let incomeSection = '';
  if (annualSummary.totalGrossIncome > 0) {
    const incomeRows = [
      kv('年収（額面）', yen(annualSummary.totalGrossIncome)),
      kv('　給与', yen(annualSummary.totalGrossSalary)),
      annualSummary.totalBonus > 0 ? kv('　ボーナス', yen(annualSummary.totalBonus)) : '',
      annualSummary.totalOtherIncome > 0 ? kv('　その他収入', yen(annualSummary.totalOtherIncome)) : '',
      `<tr><td colspan="2" class="divider"></td></tr>`,
      kv('所得税', `-${yen(annualSummary.totalIncomeTax)}`, 'red'),
      kv('住民税', `-${yen(annualSummary.totalResidentTax)}`, 'red'),
      kv('健康保険料', `-${yen(annualSummary.totalHealthInsurance)}`, 'red'),
      kv('厚生年金保険料', `-${yen(annualSummary.totalWelfarePension)}`, 'red'),
      kv('雇用保険料', `-${yen(annualSummary.totalEmploymentInsurance)}`, 'red'),
      annualSummary.totalLongTermCareInsurance > 0 ? kv('介護保険料', `-${yen(annualSummary.totalLongTermCareInsurance)}`, 'red') : '',
      `<tr><td colspan="2" class="divider"></td></tr>`,
      kv('年間手取り', yen(annualSummary.totalNetIncome), 'bold blue'),
    ].join('');
    incomeSection = section(`${CURRENT_YEAR}年 収入サマリー`, table(incomeRows));
  }

  // 積立投資
  let accumSection = '';
  if (data.accumulationInvestments.length > 0) {
    const rows = data.accumulationInvestments.map(i => {
      const p = i.currentValue - i.totalContributed;
      const pp = i.totalContributed > 0 ? (p / i.totalContributed) * 100 : 0;
      return `
        <tr>
          <td><span class="badge">${i.type}</span></td>
          <td>${i.name}</td>
          <td class="num">${yen(i.monthlyAmount)}/月</td>
          <td class="num bold">${yen(i.currentValue)}</td>
          <td class="num ${p >= 0 ? 'green' : 'red'}">${sign(p)}${yenS(p)} (${sign(pp)}${pct(pp)})</td>
        </tr>`;
    }).join('');
    accumSection = section('積立投資一覧', `
      <table class="list-table">
        <thead><tr><th>種類</th><th>ファンド名</th><th>月額</th><th>評価額</th><th>損益</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  // 個別株
  let stockSection = '';
  if (data.individualStocks.length > 0) {
    const rows = data.individualStocks.map(st => {
      const val = st.currentPrice * st.quantity;
      const valJpy = st.currency === 'USD' ? val * (st.usdJpyRate || usdJpy) : val;
      const cost = st.purchasePrice * st.quantity;
      const costJpy = st.currency === 'USD' ? cost * (st.usdJpyRate || usdJpy) : cost;
      const p = valJpy - costJpy;
      const pp = costJpy > 0 ? (p / costJpy) * 100 : 0;
      return `
        <tr>
          <td>${st.name}${st.nisaType ? ' <span class="badge nisa">NISA</span>' : ''}</td>
          <td>${st.ticker || '-'}</td>
          <td>${st.market}</td>
          <td class="num">${st.currency === 'USD' ? `$${st.currentPrice.toLocaleString()}` : yen(st.currentPrice)}</td>
          <td class="num">${st.quantity.toLocaleString()}</td>
          <td class="num bold">${yenS(valJpy)}</td>
          <td class="num ${p >= 0 ? 'green' : 'red'}">${sign(p)}${yenS(p)} (${sign(pp)}${pct(pp)})</td>
        </tr>`;
    }).join('');
    stockSection = section('個別株・ETF一覧', `
      <table class="list-table">
        <thead><tr><th>銘柄</th><th>コード</th><th>市場</th><th>現在値</th><th>数量</th><th>評価額</th><th>損益</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  // 支出
  let expenseSection = '';
  if (yearExpenses.length > 0) {
    const catRows = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => kv(cat, yen(amt))).join('');
    expenseSection = section(`${CURRENT_YEAR}年 支出サマリー`, table([
      kv('年間支出合計', yen(expenseTotal), 'bold'),
      `<tr><td colspan="2" class="divider"></td></tr>`,
      catRows,
    ].join('')));
  }

  // ふるさと納税
  const furusatoRecords = data.furusatoRecords.filter(r => r.date.startsWith(String(CURRENT_YEAR)));
  let furusatoSection = '';
  if (furusatoRecords.length > 0) {
    const total = furusatoRecords.reduce((s, r) => s + r.amount, 0);
    const rows = furusatoRecords.map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.prefecture}</td>
        <td class="num">${yen(r.amount)}</td>
        <td>${r.returnGift || '-'}</td>
        <td>${r.isOneStopException ? 'ワンストップ' : r.isConfirmed ? '確定申告済' : '未処理'}</td>
      </tr>`).join('');
    furusatoSection = section(`${CURRENT_YEAR}年 ふるさと納税`, `
      ${table(kv('寄付合計', yen(total), 'bold'))}
      <table class="list-table" style="margin-top:8px">
        <thead><tr><th>日付</th><th>自治体</th><th>金額</th><th>返礼品</th><th>状態</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>資産管理レポート ${DATE_STR}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 24px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 11px; margin-bottom: 24px; }
    .section { margin-bottom: 24px; page-break-inside: avoid; }
    h2 { font-size: 13px; font-weight: 700; color: #1e40af; border-left: 4px solid #3b82f6; padding-left: 8px; margin-bottom: 10px; }
    .kv-table { width: 100%; border-collapse: collapse; }
    .kv-table td { padding: 4px 8px; }
    .kv-table td.label { color: #64748b; width: 50%; }
    .kv-table td.value { text-align: right; font-variant-numeric: tabular-nums; }
    .kv-table td.divider { border-top: 1px solid #e2e8f0; padding: 2px 0; }
    .list-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .list-table th { background: #f8fafc; color: #64748b; font-weight: 600; padding: 6px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    .list-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
    .list-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    .blue { color: #2563eb; }
    .green { color: #059669; }
    .red { color: #dc2626; }
    .badge { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 99px; background: #eff6ff; color: #2563eb; font-weight: 600; }
    .badge.nisa { background: #eef2ff; color: #4338ca; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; text-align: center; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <h1>資産管理レポート</h1>
  <p class="meta">作成日: ${DATE_STR}${name ? `　氏名: ${name}` : ''}</p>
  ${invSection}
  ${incomeSection}
  ${accumSection}
  ${stockSection}
  ${expenseSection}
  ${furusatoSection}
  <p class="footer">※ このレポートは資産管理アプリから自動生成されました</p>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('ポップアップがブロックされました。ブラウザの設定を確認してください。'); return; }
  win.document.write(html);
  win.document.close();
}
