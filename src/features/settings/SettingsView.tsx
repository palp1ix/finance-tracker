import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../state/settings';
import { useToast } from '../../components/Toast';
import { db } from '../../db/db';
import { MODELS } from '../../ai/models';
import { CURRENCIES } from '../../domain/currency';
import { ACCENTS, THEME_MODES } from '../../theme/themes';
import {
  downloadCsv,
  downloadJson,
  importCsv,
  importJson,
  markBackupDone,
  shouldRemindBackup,
} from '../../lib/importExport';
import type { Category, Currency, Entry } from '../../domain/types';

interface SettingsViewProps {
  entries: Entry[];
}

export function SettingsView({ entries }: SettingsViewProps) {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [key, setKey] = useState(settings.openRouterKey);
  const [rates, setRates] = useState(settings.rates);
  const [cats, setCats] = useState<Category[]>(settings.categories);

  useEffect(() => {
    setKey(settings.openRouterKey);
    setRates(settings.rates);
    setCats(settings.categories);
  }, [settings]);

  const commitKey = () => {
    const v = key.trim();
    if (v !== settings.openRouterKey) void update({ openRouterKey: v });
  };
  const commitRates = () => {
    void update({ rates: { ...rates } });
  };
  const commitCats = (next: Category[]) => {
    setCats(next);
    void update({ categories: next });
  };

  const patchCat = (id: string, patch: Partial<Category>) => {
    commitCats(cats.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addCat = () => {
    commitCats([
      ...cats,
      { id: 'cat-' + Date.now().toString(36), emoji: '🏷️', name: 'Новая', color: '#64748B' },
    ]);
  };

  const delCat = (id: string) => {
    if (id === 'other') return;
    commitCats(cats.filter((c) => c.id !== id));
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const existingIds = new Set(entries.map((x) => x.id));
    const knownCats = new Set(settings.categories.map((c) => c.id));
    try {
      const result = text.trim().startsWith('{')
        ? importJson(text, existingIds, knownCats)
        : importCsv(text, existingIds, knownCats);
      if (result.entries.length > 0) await db.entries.bulkAdd(result.entries);
      toast(`Импорт: добавлено ${result.added}, пропущено ${result.skipped}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось импортировать файл');
    }
  };

  const remind = shouldRemindBackup();

  return (
    <>
      <h1>Настройки</h1>
      <p className="sub">Данные хранятся только на этом устройстве</p>

      <div className="card">
        <h3>Тема</h3>
        <div className="seg">
          {THEME_MODES.map((m) => (
            <button
              key={m.id}
              className={settings.themeMode === m.id ? 'on' : ''}
              onClick={() => void update({ themeMode: m.id })}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className="row">
          <label>Цвет акцента</label>
        </div>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              className={'swatch' + (settings.accent === a.id ? ' on' : '')}
              style={{ background: a.color }}
              title={a.name}
              onClick={() => void update({ accent: a.id })}
            >
              {settings.accent === a.id ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>ИИ (OpenRouter)</h3>
        <input
          className="fld"
          type="password"
          placeholder="API-ключ sk-or-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={commitKey}
          autoComplete="off"
        />
        <div className="row">
          <label>Модель</label>
          <select
            className="fld"
            style={{ width: '60%' }}
            value={settings.modelId}
            onChange={(e) => void update({ modelId: e.target.value })}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <label>Валюта по умолчанию</label>
          <select
            className="fld"
            style={{ width: '40%' }}
            value={settings.defaultCurrency}
            onChange={(e) => void update({ defaultCurrency: e.target.value as Currency })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <p className="tip">Ключ хранится только на этом устройстве и отправляется напрямую в OpenRouter.</p>
      </div>

      <div className="card">
        <h3>Курсы валют</h3>
        <div className="row">
          <label>1 USD</label>
          <input
            className="fld"
            style={{ width: '50%' }}
            inputMode="decimal"
            value={String(rates.USD)}
            onChange={(e) => setRates({ ...rates, USD: Number(e.target.value.replace(',', '.')) })}
            onBlur={commitRates}
          />
        </div>
        <div className="row">
          <label>1 EUR</label>
          <input
            className="fld"
            style={{ width: '50%' }}
            inputMode="decimal"
            value={String(rates.EUR)}
            onChange={(e) => setRates({ ...rates, EUR: Number(e.target.value.replace(',', '.')) })}
            onBlur={commitRates}
          />
        </div>
        <div className="row">
          <label>100 RUB</label>
          <input
            className="fld"
            style={{ width: '50%' }}
            inputMode="decimal"
            value={String(rates.RUB)}
            onChange={(e) => setRates({ ...rates, RUB: Number(e.target.value.replace(',', '.')) })}
            onBlur={commitRates}
          />
        </div>
        <p className="tip">Курсы к BYN. RUB указывается за 100 ₽.</p>
      </div>

      <div className="card">
        <h3>Категории</h3>
        {cats.map((c) => (
          <div className="catrow" key={c.id}>
            <span className="ic" style={{ background: c.color + '22' }}>
              {c.emoji}
            </span>
            <input
              type="text"
              value={c.emoji}
              style={{ width: 40, textAlign: 'center' }}
              onChange={(e) => patchCat(c.id, { emoji: e.target.value })}
              aria-label="Эмодзи"
            />
            <div className="tx">
              <input
                type="text"
                className="fld"
                value={c.name}
                onChange={(e) => patchCat(c.id, { name: e.target.value })}
                aria-label="Название"
              />
            </div>
            <input
              type="color"
              value={c.color}
              onChange={(e) => patchCat(c.id, { color: e.target.value })}
              aria-label="Цвет"
            />
            <button className="del" onClick={() => delCat(c.id)} aria-label="Удалить">
              ✕
            </button>
          </div>
        ))}
        <div className="row">
          <button className="btn2" onClick={addCat}>
            ＋ Добавить категорию
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Импорт и экспорт</h3>
        {remind && (
          <p className="tip" style={{ color: 'var(--warn)', fontWeight: 600 }}>
            ⚠️ Давно не делал бэкап — сохрани копию данных.
          </p>
        )}
        <div className="row">
          <button
            className="btn2"
            onClick={() => {
              downloadJson(settings, entries);
              markBackupDone();
              toast('Экспорт JSON — файл сохранён');
            }}
          >
            Экспорт JSON
          </button>
          <button
            className="btn2"
            onClick={() => {
              downloadCsv(entries, settings);
              markBackupDone();
              toast('Экспорт CSV — файл сохранён');
            }}
          >
            Экспорт CSV
          </button>
        </div>
        <div className="row">
          <button className="btn2" onClick={() => fileRef.current?.click()}>
            Импорт из файла
          </button>
          <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={onImportFile} />
        </div>
        <p className="tip">Сохраняй копию раз в неделю: iOS может очистить данные браузера.</p>
      </div>

      <div className="card">
        <h3>📲 Как приложение</h3>
        <p className="tip" style={{ margin: 0 }}>
          Safari → «Поделиться» → «На экран Домой». Откроется во весь экран, как обычное приложение.
        </p>
      </div>
    </>
  );
}
