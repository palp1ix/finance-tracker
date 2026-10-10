import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings, saveSettings } from '../db/db';
import { applyTheme } from '../theme/themes';
import type { Settings } from '../domain/types';

interface SettingsCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const live = useLiveQuery(() => db.settings.get('main'), []);
  const [fallback, setFallback] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled) setFallback(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const settings = live ?? fallback;

  const update = useCallback(async (patch: Partial<Settings>) => {
    const current = await getSettings();
    await saveSettings({ ...current, ...patch });
  }, []);

  // Применение темы (светлая/тёмная + акцент) — реактивно и без мигания.
  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.themeMode, settings.accent);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(settings.themeMode, settings.accent);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings?.themeMode, settings?.accent]);

  const value = useMemo<SettingsCtx | null>(
    () => (settings ? { settings, update } : null),
    [settings, update],
  );

  if (!value) return null;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
