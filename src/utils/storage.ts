import type { AppData, AppSettings, UserProfile } from '../types';

const STORAGE_KEY = 'asset-manager-data';

const defaultUserProfile: UserProfile = {
  name: '',
  age: 30,
  prefecture: '東京都',
  hasSpouse: false,
  dependentCount: 0,
  lifeInsuranceDeduction: 0,
  earthquakeInsuranceDeduction: 0,
  otherDeductions: 0,
};

const defaultSettings: AppSettings = {
  userProfile: defaultUserProfile,
  usdJpyRate: 150,
};

const defaultData: AppData = {
  incomes: [],
  expenses: [],
  accumulationInvestments: [],
  individualStocks: [],
  furusatoRecords: [],
  settings: defaultSettings,
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultData };
    const parsed = JSON.parse(raw) as AppData;
    // Merge with defaults to handle missing fields
    return {
      ...defaultData,
      ...parsed,
      settings: {
        ...defaultSettings,
        ...parsed.settings,
        userProfile: {
          ...defaultUserProfile,
          ...parsed.settings?.userProfile,
        },
      },
    };
  } catch {
    return { ...defaultData };
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
