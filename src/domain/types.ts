export type Currency = 'BYN' | 'USD' | 'EUR' | 'RUB';

export type EntryStatus = 'pending' | 'processed' | 'error';

export type EntryType = 'expense' | 'refund';

export interface Category {
  id: string;
  emoji: string;
  name: string;
  color: string;
}

export interface ParsedEntry {
  title: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  occurredAt: string; // ISO
  type: EntryType;
  note?: string;
}

export interface Entry {
  id: string;
  rawText: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  status: EntryStatus;
  error?: string;
  parsed?: ParsedEntry;
}

/** Курсы к BYN. RUB хранится как «BYN за 100 RUB» (как в интерфейсе). */
export interface Rates {
  USD: number;
  EUR: number;
  RUB: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export type AccentId = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber' | 'teal';

export interface Settings {
  id: 'main';
  openRouterKey: string;
  modelId: string;
  defaultCurrency: Currency;
  rates: Rates;
  categories: Category[];
  themeMode: ThemeMode;
  accent: AccentId;
}
