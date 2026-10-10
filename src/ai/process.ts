import { chatCompletion, extractJson, AiError } from './client';
import { AiBatchSchema, type AiResult } from './schema';
import { modelById } from './models';
import type { Entry, ParsedEntry, Settings } from '../domain/types';

export interface ProcessedItem {
  entry: Entry;
  parsed: ParsedEntry;
}

export interface ErroredItem {
  entry: Entry;
  error: string;
}

export interface ProcessOutcome {
  processed: ProcessedItem[];
  errors: ErroredItem[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function buildSystemPrompt(settings: Settings): string {
  const now = new Date();
  const date = now.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const cats = settings.categories.map((c) => `${c.id} (${c.name})`).join(', ');
  return [
    'Ты — парсер заметок о тратах. Разбери заметки пользователя в структуру. Отвечай строго JSON.',
    `Сегодня: ${date} (таймзона ${tz}).`,
    `Валюта по умолчанию: ${settings.defaultCurrency}.`,
    `Категории (id — название): ${cats}.`,
    '',
    'Правила:',
    '1. «р», «руб», «₽», «br» или отсутствие валюты = BYN; «€»/«eur» = EUR, «$»/«usd» = USD, «₽»/«rub» = RUB.',
    '2. Если в записи перечислено несколько покупок с одной общей суммой — это одна запись (например «макароны, сосиски 14.74»).',
    '3. «вернул долг», «возврат», «вернули деньги» — тип refund (сумма всё равно положительная).',
    '4. Если сумму понять нельзя — верни error для этой записи, parsed не заполняй.',
    '5. occurredAt — ISO-дата. Если в тексте «вчера»/«позавчера»/конкретная дата — вычисли её относительно createdAt этой записи; иначе occurredAt = createdAt.',
    '6. amount — положительное число, currency — одна из BYN/USD/EUR/RUB.',
    '7. title — короткое название покупки (без суммы).',
    '8. categoryId — наиболее подходящий id из списка; если не подходит — "other".',
    '',
    'Формат ответа (без пояснений):',
    '{"results":[{"index":0,"parsed":{"title":"…","amount":0,"currency":"BYN","categoryId":"…","occurredAt":"ISO","type":"expense","note":"…"}},{"index":1,"error":"нет суммы"}]}',
  ].join('\n');
}

export function buildUserMessage(entries: Entry[]): string {
  const lines = entries.map((e, i) => `${i}. "${e.rawText}" (createdAt: ${e.createdAt})`);
  return 'Заметки:\n' + lines.join('\n');
}

function isRetryable(e: unknown): boolean {
  if (e instanceof AiError) {
    if (e.code === 'timeout' || e.code === 'network' || e.code === 'empty' || e.code === 'parse') {
      return true;
    }
    if (e.code === 'http' && e.status && (e.status === 429 || e.status >= 500)) return true;
  }
  return false;
}

async function processOnce(
  entries: Entry[],
  settings: Settings,
  signal?: AbortSignal,
): Promise<ProcessOutcome> {
  const model = modelById(settings.modelId);
  const content = await chatCompletion(
    settings.openRouterKey,
    model.model,
    [
      { role: 'system', content: buildSystemPrompt(settings) },
      { role: 'user', content: buildUserMessage(entries) },
    ],
    { signal },
  );

  let json: unknown;
  try {
    json = extractJson(content);
  } catch (e) {
    throw e instanceof AiError ? e : new AiError('parse', 'Не удалось разобрать ответ модели (не JSON).');
  }

  const parsed = AiBatchSchema.safeParse(json);
  if (!parsed.success) {
    throw new AiError('parse', 'Ответ модели не прошёл валидацию схемы. Попробуй ещё раз.');
  }

  const byIndex = new Map<number, AiResult>();
  for (const r of parsed.data.results) byIndex.set(r.index, r);

  const outcome: ProcessOutcome = { processed: [], errors: [] };
  const knownCats = new Set(settings.categories.map((c) => c.id));

  entries.forEach((entry, i) => {
    const result = byIndex.get(i);
    if (!result) {
      outcome.errors.push({ entry, error: 'Модель не вернула результат для этой записи.' });
      return;
    }
    if (result.error || !result.parsed) {
      outcome.errors.push({ entry, error: result.error ?? 'Неизвестная ошибка разбора.' });
      return;
    }
    const p = result.parsed;
    const categoryId = knownCats.has(p.categoryId) ? p.categoryId : 'other';
    outcome.processed.push({
      entry,
      parsed: {
        title: p.title,
        amount: p.amount,
        currency: p.currency,
        categoryId,
        occurredAt: p.occurredAt,
        type: p.type,
        note: p.note,
      },
    });
  });

  return outcome;
}

/** Обработка пачки с ретраями и экспоненциальным backoff. */
export async function processEntries(
  entries: Entry[],
  settings: Settings,
  signal?: AbortSignal,
): Promise<ProcessOutcome> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(400 * 2 ** (attempt - 1));
    try {
      return await processOnce(entries, settings, signal);
    } catch (e) {
      if (!isRetryable(e)) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Ошибка обработки');
}
