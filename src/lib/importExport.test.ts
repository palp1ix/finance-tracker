import { describe, expect, it } from 'vitest';
import { exportCsv, exportJson, importCsv, importJson } from './importExport';
import { defaultSettings } from '../db/db';
import type { Entry } from '../domain/types';

function makeEntry(id: string, rawText: string, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    rawText,
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
    status: 'processed',
    parsed: {
      title: rawText,
      amount: 10,
      currency: 'BYN',
      categoryId: 'food',
      occurredAt: '2026-10-10T10:00:00.000Z',
      type: 'expense',
    },
    ...overrides,
  };
}

describe('импорт/экспорт', () => {
  it('JSON: roundtrip с дедупликацией по id', () => {
    const s = defaultSettings();
    const entries = [makeEntry('a', 'кофе'), makeEntry('b', 'чай')];
    const text = exportJson(s, entries);

    const res = importJson(text, new Set(['a']), new Set(s.categories.map((c) => c.id)));
    expect(res.added).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.entries[0].id).toBe('b');
    expect(res.entries[0].rawText).toBe('чай');
  });

  it('CSV: roundtrip с сохранением полей', () => {
    const s = defaultSettings();
    const entries = [makeEntry('a', 'кофе, с молоком'), makeEntry('b', 'возврат', {
      parsed: { title: 'возврат', amount: 5, currency: 'EUR', categoryId: 'other', occurredAt: '2026-10-09T10:00:00.000Z', type: 'refund' },
    })];
    const text = exportCsv(entries, s);

    const res = importCsv(text, new Set(), new Set(s.categories.map((c) => c.id)));
    expect(res.added).toBe(2);
    const a = res.entries.find((e) => e.id === 'a');
    expect(a?.rawText).toBe('кофе, с молоком');
    expect(a?.parsed?.categoryId).toBe('food');
    const b = res.entries.find((e) => e.id === 'b');
    expect(b?.parsed?.type).toBe('refund');
    expect(b?.parsed?.currency).toBe('EUR');
  });

  it('CSV: парсит кавычки и запятые в тексте', () => {
    const s = defaultSettings();
    const text = exportCsv([makeEntry('x', 'кофе "на вынос", 2 шт')], s);
    const res = importCsv(text, new Set(), new Set(s.categories.map((c) => c.id)));
    expect(res.entries[0].rawText).toBe('кофе "на вынос", 2 шт');
  });
});
