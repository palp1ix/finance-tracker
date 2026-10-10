import type { Entry, EntryStatus, EntryType, ParsedEntry, Settings } from '../domain/types';
import { newId } from '../db/db';
import { categoryById } from '../domain/categories';

const BACKUP_KEY = 'traty:last-backup';

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export interface ImportResult {
  entries: Entry[];
  added: number;
  skipped: number;
}

// ---------- Экспорт ----------

export function exportJson(settings: Settings, entries: Entry[]): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), settings, entries },
    null,
    2,
  );
}

export function exportCsv(entries: Entry[], settings: Settings): string {
  const header = [
    'id',
    'rawText',
    'createdAt',
    'updatedAt',
    'status',
    'title',
    'amount',
    'currency',
    'category',
    'categoryId',
    'occurredAt',
    'type',
    'note',
    'error',
  ];
  const rows = entries.map((e) => {
    const p = e.parsed;
    const cat = p ? categoryById(settings.categories, p.categoryId) : null;
    return [
      e.id,
      e.rawText,
      e.createdAt,
      e.updatedAt,
      e.status,
      p?.title ?? '',
      p?.amount ?? '',
      p?.currency ?? '',
      cat?.name ?? '',
      p?.categoryId ?? '',
      p?.occurredAt ?? '',
      p?.type ?? '',
      p?.note ?? '',
      e.error ?? '',
    ]
      .map(csvCell)
      .join(',');
  });
  return [header.map(csvCell).join(','), ...rows].join('\n');
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(settings: Settings, entries: Entry[]): void {
  download(`traty-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJson(settings, entries), 'application/json');
}

export function downloadCsv(entries: Entry[], settings: Settings): void {
  download(`traty-${new Date().toISOString().slice(0, 10)}.csv`, exportCsv(entries, settings), 'text/csv;charset=utf-8');
}

// ---------- Импорт ----------

function sanitizeEntry(raw: Partial<Entry> & { rawText: string }, knownCategories: Set<string>): Entry {
  const now = new Date().toISOString();
  const createdAt = raw.createdAt && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : now;
  let parsed: ParsedEntry | undefined = raw.parsed;
  if (parsed && !knownCategories.has(parsed.categoryId)) {
    parsed = { ...parsed, categoryId: 'other' };
  }
  const status: EntryStatus =
    raw.status === 'processed' || raw.status === 'error' || raw.status === 'pending'
      ? raw.status
      : raw.parsed
        ? 'processed'
        : 'pending';
  return {
    id: raw.id || newId(),
    rawText: String(raw.rawText ?? ''),
    createdAt,
    updatedAt: raw.updatedAt || now,
    status,
    error: raw.error,
    parsed,
  };
}

export function importJson(text: string, existingIds: Set<string>, knownCategories: Set<string>): ImportResult {
  const data = JSON.parse(text) as {
    entries?: Array<Partial<Entry> & { rawText?: string }>;
  };
  const list = Array.isArray(data?.entries) ? data.entries : [];
  const entries: Entry[] = [];
  let added = 0;
  let skipped = 0;
  for (const item of list) {
    if (!item || typeof item.rawText !== 'string') continue;
    const id = item.id as string | undefined;
    if (id && existingIds.has(id)) {
      skipped++;
      continue;
    }
    entries.push(sanitizeEntry(item as Partial<Entry> & { rawText: string }, knownCategories));
    added++;
  }
  return { entries, added, skipped };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export function importCsv(text: string, existingIds: Set<string>, knownCategories: Set<string>): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV пустой или без заголовка.');
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const iId = col('id');
  const iRaw = col('rawText');
  if (iRaw < 0) throw new Error('В CSV нет колонки rawText.');

  const get = (r: string[], name: string) => {
    const i = col(name);
    return i >= 0 ? r[i] : undefined;
  };

  const entries: Entry[] = [];
  let added = 0;
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rawText = (cells[iRaw] ?? '').trim();
    if (!rawText) continue;
    const id = iId >= 0 ? cells[iId] : undefined;
    if (id && existingIds.has(id)) {
      skipped++;
      continue;
    }
    const statusRaw = get(cells, 'status');
    const typeRaw = get(cells, 'type');
    const parsed =
      get(cells, 'amount') || get(cells, 'currency')
        ? {
            title: get(cells, 'title') ?? rawText,
            amount: Number(get(cells, 'amount')) || 0,
            currency: ((get(cells, 'currency') ?? 'BYN') as ParsedEntry['currency']),
            categoryId: knownCategories.has(get(cells, 'categoryId') ?? '') ? get(cells, 'categoryId')! : 'other',
            occurredAt: get(cells, 'occurredAt') ?? new Date().toISOString(),
            type: (typeRaw === 'refund' ? 'refund' : 'expense') as EntryType,
            note: get(cells, 'note'),
          }
        : undefined;
    const entry: Entry = {
      id: id || newId(),
      rawText,
      createdAt: get(cells, 'createdAt') ?? new Date().toISOString(),
      updatedAt: get(cells, 'updatedAt') ?? new Date().toISOString(),
      status: (statusRaw === 'processed' || statusRaw === 'error' ? statusRaw : parsed ? 'processed' : 'pending') as EntryStatus,
      error: get(cells, 'error'),
      parsed,
    };
    entries.push(entry);
    added++;
  }
  return { entries, added, skipped };
}

// ---------- Напоминание о бэкапе ----------

export function shouldRemindBackup(): boolean {
  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw) return true;
  const last = Number(raw);
  if (Number.isNaN(last)) return true;
  return Date.now() - last > 7 * 24 * 60 * 60 * 1000;
}

export function markBackupDone(): void {
  localStorage.setItem(BACKUP_KEY, String(Date.now()));
}
