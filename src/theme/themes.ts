import type { AccentId } from '../domain/types';

export interface AccentDef {
  id: AccentId;
  name: string;
  color: string; // светлая тема
  darkColor: string; // тёмная тема
}

export const ACCENTS: AccentDef[] = [
  { id: 'violet', name: 'Фиолетовый', color: '#5B5BF0', darkColor: '#7C7CFF' },
  { id: 'blue', name: 'Синий', color: '#2563EB', darkColor: '#60A5FA' },
  { id: 'emerald', name: 'Изумрудный', color: '#059669', darkColor: '#34D399' },
  { id: 'rose', name: 'Розовый', color: '#DB2777', darkColor: '#F472B6' },
  { id: 'amber', name: 'Янтарный', color: '#D97706', darkColor: '#FBBF24' },
  { id: 'teal', name: 'Бирюзовый', color: '#0891B2', darkColor: '#22D3EE' },
];

export const THEME_MODES = [
  { id: 'system', name: 'Системная' },
  { id: 'light', name: 'Светлая' },
  { id: 'dark', name: 'Тёмная' },
] as const;

export const THEME_STORAGE_KEY = 'traty:theme';

export function applyTheme(mode: string, accent: string): void {
  const root = document.documentElement;
  const dark =
    mode === 'dark' ||
    (mode === 'system' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-accent', accent);
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0E1020' : '#5B5BF0');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode, accent }));
  } catch {
    /* ignore quota/private-mode errors */
  }
}
