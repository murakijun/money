// ==================== 収入 ====================
export interface MonthlyIncome {
  id: string;
  year: number;
  month: number;
  grossSalary: number;           // 額面給与
  incomeTax: number;             // 所得税
  residentTax: number;           // 住民税
  healthInsurance: number;       // 健康保険料
  welfarePension: number;        // 厚生年金保険料
  employmentInsurance: number;   // 雇用保険料
  longTermCareInsurance: number; // 介護保険料 (40歳以上)
  otherDeductions: number;       // その他控除
  bonus: number;                 // ボーナス
  otherIncome: number;           // その他収入（副業等）
  workingDays?: number;          // 就業日数
  workingHours?: number;         // 勤務時間（月合計）
}

export const INCOME_FIELD_LABELS: Record<keyof Omit<MonthlyIncome, 'id' | 'year' | 'month'>, string> = {
  grossSalary: '額面給与',
  incomeTax: '所得税',
  residentTax: '住民税',
  healthInsurance: '健康保険料',
  welfarePension: '厚生年金保険料',
  employmentInsurance: '雇用保険料',
  longTermCareInsurance: '介護保険料',
  otherDeductions: 'その他控除',
  bonus: 'ボーナス',
  otherIncome: 'その他収入',
  workingDays: '就業日数',
  workingHours: '勤務時間',
};

// ==================== 支出 ====================
export type ExpenseCategory =
  | '食費'
  | '住居費'
  | '光熱費・水道'
  | '通信費'
  | '交通費'
  | '医療費'
  | '教育費'
  | '娯楽・趣味'
  | '衣服・美容'
  | '保険料'
  | '日用品'
  | '外食・飲み会'
  | 'その他';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  '食費', '住居費', '光熱費・水道', '通信費', '交通費',
  '医療費', '教育費', '娯楽・趣味', '衣服・美容', '保険料',
  '日用品', '外食・飲み会', 'その他',
];

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  '食費': '#3B82F6',
  '住居費': '#8B5CF6',
  '光熱費・水道': '#F59E0B',
  '通信費': '#10B981',
  '交通費': '#6366F1',
  '医療費': '#EF4444',
  '教育費': '#14B8A6',
  '娯楽・趣味': '#F97316',
  '衣服・美容': '#EC4899',
  '保険料': '#84CC16',
  '日用品': '#06B6D4',
  '外食・飲み会': '#A855F7',
  'その他': '#94A3B8',
};

export interface Expense {
  id: string;
  date: string;         // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  description: string;
  isRecurring: boolean;
  recurringDay?: number; // 毎月X日
}

// ==================== 投資 ====================
export type AccumulationType = '新NISA(つみたて枠)' | '新NISA(成長投資枠)' | 'iDeCo' | 'その他積立';

export interface AccumulationInvestment {
  id: string;
  type: AccumulationType;
  name: string;            // ファンド名
  monthlyAmount: number;   // 毎月積立額
  startDate: string;       // 開始日 YYYY-MM-DD
  currentValue: number;    // 現在評価額
  totalContributed: number; // 累計拠出額
  isActive: boolean;
}

export type StockMarket = '東証' | '米国株' | 'その他';
export type StockType = '株式' | 'ETF' | '投資信託' | 'REIT';
export type Currency = 'JPY' | 'USD';

export interface IndividualStock {
  id: string;
  name: string;
  ticker: string;
  market: StockMarket;
  type: StockType;
  purchaseDate: string;   // YYYY-MM-DD
  purchasePrice: number;  // 購入単価
  quantity: number;       // 保有数量
  currentPrice: number;   // 現在値
  currency: Currency;
  usdJpyRate?: number;    // 米国株の場合の為替レート
  nisaType?: '新NISA(成長投資枠)' | null; // NISA口座区分
  memo?: string;
}

// ==================== ふるさと納税 ====================
export interface FurusatoNozeiRecord {
  id: string;
  date: string;           // YYYY-MM-DD
  prefecture: string;     // 自治体名
  amount: number;         // 寄付額
  returnGift: string;     // 返礼品
  isOneStopException: boolean; // ワンストップ特例
  isConfirmed: boolean;   // 確定申告済み
}

// ==================== ユーザー設定 ====================
export interface UserProfile {
  name: string;
  age: number;
  prefecture: string;
  hasSpouse: boolean;
  dependentCount: number;   // 扶養家族数（配偶者除く）
  lifeInsuranceDeduction: number;   // 生命保険料控除
  earthquakeInsuranceDeduction: number; // 地震保険料控除
  otherDeductions: number;  // その他所得控除
}

export interface AppSettings {
  userProfile: UserProfile;
  usdJpyRate: number;  // ドル円レート
}

// ==================== ストレージ ====================
export interface AppData {
  incomes: MonthlyIncome[];
  expenses: Expense[];
  accumulationInvestments: AccumulationInvestment[];
  individualStocks: IndividualStock[];
  furusatoRecords: FurusatoNozeiRecord[];
  settings: AppSettings;
}
