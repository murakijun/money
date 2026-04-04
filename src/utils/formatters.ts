export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function formatYenShort(amount: number): string {
  if (Math.abs(amount) >= 100_000_000) {
    return `¥${(amount / 100_000_000).toFixed(1)}億`;
  }
  if (Math.abs(amount) >= 10_000) {
    return `¥${(amount / 10_000).toFixed(1)}万`;
  }
  return formatYen(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${year}年${parseInt(month)}月${parseInt(day)}日`;
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getCurrentDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getProfitLossColor(value: number): string {
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-red-500';
  return 'text-gray-600';
}

export function getProfitLossSign(value: number): string {
  if (value > 0) return '+';
  return '';
}
