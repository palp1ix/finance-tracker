import { chatCompletion, AiError } from './client';
import { modelById } from './models';
import type { Entry, Settings } from '../domain/types';
import { toByn } from '../domain/currency';
import { categoryById } from '../domain/categories';

/** Локальный инсайт без сети/ключа — как в прототипе. */
export function localInsight(entries: Entry[], settings: Settings): string {
  const ps = entries.filter((e) => e.status === 'processed' && e.parsed);
  if (ps.length === 0) return 'Пока нет обработанных записей.';
  const byCat = new Map<string, number>();
  for (const e of ps) {
    const p = e.parsed!;
    const sign = p.type === 'refund' ? -1 : 1;
    const val = toByn(p.amount, p.currency, settings.rates) * sign;
    byCat.set(p.categoryId, (byCat.get(p.categoryId) ?? 0) + val);
  }
  let top: string | null = null;
  let topVal = 0;
  for (const [k, v] of byCat) if (v > topVal) (topVal = v), (top = k);
  if (!top) return 'Пока нет обработанных записей.';
  const total = Math.max(
    0,
    [...byCat.values()].reduce((s, v) => s + Math.max(0, v), 0),
  );
  const share = total > 0 ? Math.round((topVal / total) * 100) : 0;
  const cat = categoryById(settings.categories, top);
  return `Больше всего ушло на «${cat.name.toLowerCase()}» — ${share}% расходов. Попробуй поставить недельный лимит на эту категорию.`;
}

export async function getInsight(
  entries: Entry[],
  settings: Settings,
  signal?: AbortSignal,
): Promise<string> {
  const fallback = localInsight(entries, settings);
  const ps = entries.filter((e) => e.status === 'processed' && e.parsed);
  if (ps.length === 0 || !settings.openRouterKey.trim()) return fallback;

  const rows = ps
    .map((e) => {
      const p = e.parsed!;
      return `${e.rawText} → ${p.title} ${p.amount} ${p.currency} (${p.categoryId}, ${p.type})`;
    })
    .join('\n');

  const model = modelById(settings.modelId);
  try {
    return await chatCompletion(
      settings.openRouterKey,
      model.model,
      [
        {
          role: 'system',
          content:
            'Ты — финансовый аналитик. Дай ОДИН короткий практичный инсайт (1-2 предложения, на русском) по этим тратам: где перерасход и что сделать. Без разметки.',
        },
        { role: 'user', content: rows },
      ],
      { signal, timeoutMs: 12_000 },
    );
  } catch (e) {
    if (e instanceof AiError && e.code === 'http' && e.status === 401) {
      return fallback;
    }
    return fallback;
  }
}
