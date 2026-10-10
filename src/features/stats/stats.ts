import type { Entry, Settings } from '../../domain/types';
import { toByn } from '../../domain/currency';
import { elapsedDaysInMonth } from '../../domain/date';

export interface StatsResult {
  /** Расходы минус возвраты, в BYN. */
  totalByn: number;
  /** Только расходы (без вычета возвратов), в BYN. */
  expenseByn: number;
  /** Сумма возвратов, в BYN (положительная). */
  refundByn: number;
  /** Число покупок (расходов). */
  count: number;
  avgCheckByn: number;
  maxByn: number;
  /** Чистые траты по категориям, отсортированы по убыванию. */
  byCategory: Array<{ id: string; value: number }>;
  /** Траты по дням месяца (индекс = день-1). */
  byDay: number[];
  days: number;
}

export function computeStats(
  entries: Entry[],
  settings: Settings,
  period: { year: number; month: number },
): StatsResult {
  const days = elapsedDaysInMonth(period.year, period.month);
  const byDay = new Array(days).fill(0);
  const byCat = new Map<string, number>();
  let expenseByn = 0;
  let refundByn = 0;
  let count = 0;
  let maxByn = 0;

  for (const e of entries) {
    if (e.status !== 'processed' || !e.parsed) continue;
    const p = e.parsed;
    const d = new Date(p.occurredAt);
    if (d.getFullYear() !== period.year || d.getMonth() !== period.month) continue;

    const value = toByn(p.amount, p.currency, settings.rates);
    const dayIndex = d.getDate() - 1;

    if (p.type === 'refund') {
      refundByn += value;
      byDay[dayIndex] = (byDay[dayIndex] ?? 0) - value;
      byCat.set(p.categoryId, (byCat.get(p.categoryId) ?? 0) - value);
    } else {
      expenseByn += value;
      count += 1;
      byDay[dayIndex] = (byDay[dayIndex] ?? 0) + value;
      byCat.set(p.categoryId, (byCat.get(p.categoryId) ?? 0) + value);
      if (value > maxByn) maxByn = value;
    }
  }

  const byCategory = [...byCat.entries()]
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalByn: expenseByn - refundByn,
    expenseByn,
    refundByn,
    count,
    avgCheckByn: count > 0 ? expenseByn / count : 0,
    maxByn,
    byCategory,
    byDay,
    days,
  };
}
