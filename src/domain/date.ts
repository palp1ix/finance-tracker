const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function todayStart(): Date {
  return startOfDay(new Date());
}

/** Целые дни от начала сегодняшнего дня до даты (0 = сегодня, 1 = вчера). */
export function daysAgo(iso: string): number {
  const d = startOfDay(new Date(iso));
  return Math.round((todayStart().getTime() - d.getTime()) / DAY_MS);
}

export function dayLabel(iso: string): string {
  const ago = daysAgo(iso);
  if (ago === 0) return 'Сегодня';
  if (ago === 1) return 'Вчера';
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'short' });
}

export function monthKey(d: Date): { year: number; month: number } {
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('ru', { month: 'long', year: 'numeric' });
}

/** Сдвиг месяца на offset (в прошлое — отрицательное). */
export function shiftMonth(
  base: { year: number; month: number },
  offset: number,
): { year: number; month: number } {
  const d = new Date(base.year, base.month + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Количество дней, «прошедших» в месяце (для текущего месяца — до сегодняшнего дня). */
export function elapsedDaysInMonth(year: number, month: number): number {
  const now = new Date();
  const cur = monthKey(now);
  if (year === cur.year && month === cur.month) {
    return now.getDate();
  }
  return new Date(year, month + 1, 0).getDate();
}

/** Порядковый номер дня месяца (1..31). */
export function dayOfMonth(iso: string): number {
  return new Date(iso).getDate();
}

export function weekdayShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { weekday: 'short' });
}
