import type { MonthlyIncome, UserProfile, FurusatoNozeiRecord } from '../types';

// ==================== 給与所得控除 ====================
export function calcSalaryIncomeDeduction(annualGross: number): number {
  if (annualGross <= 1_625_000) return 550_000;
  if (annualGross <= 1_800_000) return Math.floor(annualGross * 0.4) - 100_000;
  if (annualGross <= 3_600_000) return Math.floor(annualGross * 0.3) + 80_000;
  if (annualGross <= 6_600_000) return Math.floor(annualGross * 0.2) + 440_000;
  if (annualGross <= 8_500_000) return Math.floor(annualGross * 0.1) + 1_100_000;
  return 1_950_000;
}

// ==================== 基礎控除 ====================
export function calcBasicDeduction(annualGross: number): number {
  if (annualGross <= 24_000_000) return 480_000;
  if (annualGross <= 24_500_000) return 320_000;
  if (annualGross <= 25_000_000) return 160_000;
  return 0;
}

// ==================== 所得税率 ====================
export function calcIncomeTaxRate(taxableIncome: number): number {
  if (taxableIncome <= 1_950_000) return 0.05;
  if (taxableIncome <= 3_300_000) return 0.10;
  if (taxableIncome <= 6_950_000) return 0.20;
  if (taxableIncome <= 9_000_000) return 0.23;
  if (taxableIncome <= 18_000_000) return 0.33;
  if (taxableIncome <= 40_000_000) return 0.40;
  return 0.45;
}

// ==================== 所得税額計算 ====================
function calcIncomeTax(taxableIncome: number): number {
  const brackets = [
    { limit: 1_950_000, rate: 0.05, deduction: 0 },
    { limit: 3_300_000, rate: 0.10, deduction: 97_500 },
    { limit: 6_950_000, rate: 0.20, deduction: 427_500 },
    { limit: 9_000_000, rate: 0.23, deduction: 636_000 },
    { limit: 18_000_000, rate: 0.33, deduction: 1_536_000 },
    { limit: 40_000_000, rate: 0.40, deduction: 2_796_000 },
    { limit: Infinity, rate: 0.45, deduction: 4_796_000 },
  ];
  for (const b of brackets) {
    if (taxableIncome <= b.limit) {
      return Math.floor(taxableIncome * b.rate - b.deduction);
    }
  }
  return 0;
}

// ==================== ふるさと納税上限額 ====================
// 住民税所得割の20%が上限（ワンストップ特例・確定申告どちらも同じ上限）
export function calcFurusatoLimit(
  annualGross: number,
  profile: UserProfile,
  annualSocialInsurance: number,
): number {
  const salaryDeduction = calcSalaryIncomeDeduction(annualGross);
  const netIncome = annualGross - salaryDeduction;

  // 控除合計
  const basicDeduction = calcBasicDeduction(annualGross);
  const spouseDeduction = profile.hasSpouse ? 380_000 : 0;
  const dependentDeduction = profile.dependentCount * 380_000;
  const socialInsuranceDeduction = annualSocialInsurance;
  const lifeInsuranceDeduction = Math.min(profile.lifeInsuranceDeduction, 120_000);
  const earthquakeDeduction = Math.min(profile.earthquakeInsuranceDeduction, 50_000);
  const otherDeductions = profile.otherDeductions;

  const totalDeductions = basicDeduction + spouseDeduction + dependentDeduction
    + socialInsuranceDeduction + lifeInsuranceDeduction + earthquakeDeduction + otherDeductions;

  const taxableIncome = Math.max(netIncome - totalDeductions, 0);

  // 所得税率（復興特別所得税込み）
  const incomeTaxRate = calcIncomeTaxRate(taxableIncome) * 1.021;

  // 住民税所得割（10%）
  const residentTaxBase = Math.max(netIncome - totalDeductions, 0);
  const residentTaxRatio = 0.10;

  // 上限額 = 住民税所得割額 × 20% ÷ (90% - 所得税率×1.021) + 2,000
  const denominator = 0.9 - incomeTaxRate;
  if (denominator <= 0) return 0;

  const residentTaxAmount = residentTaxBase * residentTaxRatio;
  const limit = Math.floor((residentTaxAmount * 0.2) / denominator + 2_000);

  return Math.max(limit, 0);
}

// ==================== 年間収入サマリー計算 ====================
export interface AnnualSummary {
  year: number;
  totalGrossSalary: number;
  totalBonus: number;
  totalOtherIncome: number;
  totalGrossIncome: number;
  totalIncomeTax: number;
  totalResidentTax: number;
  totalHealthInsurance: number;
  totalWelfarePension: number;
  totalEmploymentInsurance: number;
  totalLongTermCareInsurance: number;
  totalOtherDeductions: number;
  totalDeductions: number;
  totalNetIncome: number;
  annualSocialInsurance: number;
}

export function calcAnnualSummary(incomes: MonthlyIncome[], year: number): AnnualSummary {
  const yearIncomes = incomes.filter(i => i.year === year);

  const sum = (key: keyof Omit<MonthlyIncome, 'id' | 'year' | 'month'>) =>
    yearIncomes.reduce((acc, i) => acc + (i[key] as number), 0);

  const totalGrossSalary = sum('grossSalary');
  const totalBonus = sum('bonus');
  const totalOtherIncome = sum('otherIncome');
  const totalGrossIncome = totalGrossSalary + totalBonus + totalOtherIncome;

  const totalIncomeTax = sum('incomeTax');
  const totalResidentTax = sum('residentTax');
  const totalHealthInsurance = sum('healthInsurance');
  const totalWelfarePension = sum('welfarePension');
  const totalEmploymentInsurance = sum('employmentInsurance');
  const totalLongTermCareInsurance = sum('longTermCareInsurance');
  const totalOtherDeductions = sum('otherDeductions');

  const totalDeductions = totalIncomeTax + totalResidentTax + totalHealthInsurance
    + totalWelfarePension + totalEmploymentInsurance + totalLongTermCareInsurance
    + totalOtherDeductions;

  const annualSocialInsurance = totalHealthInsurance + totalWelfarePension
    + totalEmploymentInsurance + totalLongTermCareInsurance;

  return {
    year,
    totalGrossSalary,
    totalBonus,
    totalOtherIncome,
    totalGrossIncome,
    totalIncomeTax,
    totalResidentTax,
    totalHealthInsurance,
    totalWelfarePension,
    totalEmploymentInsurance,
    totalLongTermCareInsurance,
    totalOtherDeductions,
    totalDeductions,
    totalNetIncome: totalGrossIncome - totalDeductions,
    annualSocialInsurance,
  };
}

// ==================== 月次手取り計算 ====================
export function calcNetIncome(income: MonthlyIncome): number {
  const totalDeductions = income.incomeTax + income.residentTax
    + income.healthInsurance + income.welfarePension
    + income.employmentInsurance + income.longTermCareInsurance
    + income.otherDeductions;
  return income.grossSalary + income.bonus + income.otherIncome - totalDeductions;
}

// ==================== ふるさと納税計算根拠（内訳付き） ====================
export interface FurusatoBreakdown {
  annualGross: number;
  salaryDeduction: number;
  netIncome: number;
  basicDeduction: number;
  spouseDeduction: number;
  dependentDeduction: number;
  socialInsuranceDeduction: number;
  lifeInsuranceDeduction: number;
  earthquakeDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  taxableIncome: number;
  incomeTaxRateRaw: number;   // 復興税前
  incomeTaxRate: number;      // 復興税込み
  residentTaxAmount: number;
  limit: number;
}

export function calcFurusatoBreakdown(
  annualGross: number,
  profile: UserProfile,
  annualSocialInsurance: number,
): FurusatoBreakdown {
  const salaryDeduction = calcSalaryIncomeDeduction(annualGross);
  const netIncome = annualGross - salaryDeduction;

  const basicDeduction = calcBasicDeduction(annualGross);
  const spouseDeduction = profile.hasSpouse ? 380_000 : 0;
  const dependentDeduction = profile.dependentCount * 380_000;
  const socialInsuranceDeduction = annualSocialInsurance;
  const lifeInsuranceDeduction = Math.min(profile.lifeInsuranceDeduction, 120_000);
  const earthquakeDeduction = Math.min(profile.earthquakeInsuranceDeduction, 50_000);
  const otherDeductions = profile.otherDeductions;

  const totalDeductions = basicDeduction + spouseDeduction + dependentDeduction
    + socialInsuranceDeduction + lifeInsuranceDeduction + earthquakeDeduction + otherDeductions;

  const taxableIncome = Math.max(netIncome - totalDeductions, 0);
  const incomeTaxRateRaw = calcIncomeTaxRate(taxableIncome);
  const incomeTaxRate = incomeTaxRateRaw * 1.021;
  const residentTaxAmount = taxableIncome * 0.10;

  const denominator = 0.9 - incomeTaxRate;
  const limit = denominator > 0
    ? Math.max(Math.floor((residentTaxAmount * 0.2) / denominator + 2_000), 0)
    : 0;

  return {
    annualGross, salaryDeduction, netIncome,
    basicDeduction, spouseDeduction, dependentDeduction,
    socialInsuranceDeduction, lifeInsuranceDeduction, earthquakeDeduction, otherDeductions,
    totalDeductions, taxableIncome,
    incomeTaxRateRaw, incomeTaxRate, residentTaxAmount, limit,
  };
}

// ==================== ふるさと納税利用済み金額 ====================
export function calcFurusatoUsed(records: FurusatoNozeiRecord[], year: number): number {
  return records
    .filter(r => r.date.startsWith(String(year)))
    .reduce((acc, r) => acc + r.amount, 0);
}

// ==================== 実効負担額（2000円を除く） ====================
export function calcFurusatoActualBurden(totalDonated: number): number {
  return Math.min(totalDonated, 2_000);
}
