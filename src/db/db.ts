import Dexie, { type Table } from 'dexie';
import type { Entry, Settings } from '../domain/types';
import { DEFAULT_CATEGORIES } from '../domain/categories';
import { DEFAULT_RATES } from '../domain/currency';

class TratyDB extends Dexie {
  entries!: Table<Entry, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('traty');
    this.version(1).stores({
      entries: 'id, createdAt, status, updatedAt',
      settings: 'id',
    });
  }
}

export const db = new TratyDB();

export function defaultSettings(): Settings {
  return {
    id: 'main',
    openRouterKey: '',
    modelId: 'fast',
    defaultCurrency: 'BYN',
    rates: { ...DEFAULT_RATES },
    categories: [...DEFAULT_CATEGORIES],
    themeMode: 'system',
    accent: 'violet',
  };
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('main');
  if (existing) return existing;
  const fresh = defaultSettings();
  await db.settings.put(fresh);
  return fresh;
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put(s);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function addEntry(rawText: string): Promise<Entry> {
  const now = new Date().toISOString();
  const entry: Entry = {
    id: newId(),
    rawText,
    createdAt: now,
    updatedAt: now,
    status: 'pending',
  };
  await db.entries.add(entry);
  return entry;
}

export async function updateEntry(id: string, patch: Partial<Entry>): Promise<void> {
  await db.entries.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}
