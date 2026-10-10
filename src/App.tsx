import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addEntry, updateEntry, deleteEntry } from './db/db';
import { processEntries } from './ai/process';
import { SettingsProvider, useSettings } from './state/settings';
import { ToastProvider, useToast } from './components/Toast';
import { NotesView } from './features/notes/NotesView';
import { StatsView } from './features/stats/StatsView';
import { SettingsView } from './features/settings/SettingsView';
import type { Entry } from './domain/types';

type View = 'notes' | 'stats' | 'set';

function Shell() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const entries = useLiveQuery(() => db.entries.toArray(), []) ?? [];

  const [view, setView] = useState<View>('notes');
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');

  const pendingCount = useMemo(() => entries.filter((e) => e.status === 'pending').length, [entries]);

  const add = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await addEntry(text);
  };

  const process = async () => {
    const pending = entries.filter((e) => e.status === 'pending');
    if (busy || pending.length === 0) return;
    if (!settings.openRouterKey.trim()) {
      toast('Добавь API-ключ OpenRouter в настройках ⚙️');
      setView('set');
      return;
    }
    setBusy(true);
    try {
      const outcome = await processEntries(pending, settings);
      await db.transaction('rw', db.entries, async () => {
        for (const p of outcome.processed) {
          await db.entries.update(p.entry.id, {
            status: 'processed' as const,
            parsed: p.parsed,
            error: undefined,
            updatedAt: new Date().toISOString(),
          });
        }
        for (const er of outcome.errors) {
          await db.entries.update(er.entry.id, {
            status: 'error' as const,
            error: er.error,
            updatedAt: new Date().toISOString(),
          });
        }
      });
      if (outcome.errors.length > 0) {
        toast(`Готово: +${outcome.processed.length}, ошибок: ${outcome.errors.length}`);
      } else {
        toast(`Готово: +${outcome.processed.length} в статистике`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ошибка обработки');
    } finally {
      setBusy(false);
    }
  };

  const remove = (entry: Entry) => {
    void deleteEntry(entry.id);
    toast('Запись удалена', {
      label: 'Отменить',
      onClick: () => {
        void db.entries.add(entry);
      },
    });
  };

  const saveEdit = (entry: Entry, patch: Partial<Entry>) => {
    void updateEntry(entry.id, patch);
  };

  const retry = (entry: Entry) => {
    void updateEntry(entry.id, { status: 'pending', error: undefined });
    toast('Вернул в очередь');
  };

  return (
    <div className="app">
      <section className={'view' + (view === 'notes' ? ' on' : '')} id="v-notes">
        <h1>Заметки</h1>
        <p className="sub">
          {entries.length} записей · {pendingCount} ждут обработки
        </p>
        <NotesView
          entries={entries}
          settings={settings}
          onEdit={saveEdit}
          onDelete={remove}
          onRetry={retry}
        />
      </section>

      <section className={'view' + (view === 'stats' ? ' on' : '')} id="v-stats">
        <StatsView entries={entries} settings={settings} />
      </section>

      <section className={'view' + (view === 'set' ? ' on' : '')} id="v-set">
        <SettingsView entries={entries} />
      </section>

      <div className="dock" id="dock" style={{ display: view === 'notes' ? '' : 'none' }}>
        <div className="bar">
          <div className={'cnt' + (pendingCount === 0 ? ' zero' : '')}>
            <i />
            {pendingCount > 0 ? `${pendingCount} не в статистике` : 'Всё в статистике'}
          </div>
          <button className="go" id="go" onClick={process} disabled={pendingCount === 0 || busy}>
            {busy ? 'Обрабатываю…' : pendingCount > 0 ? 'Обработать ✨' : 'Готово ✓'}
          </button>
        </div>
        <div className="cmp">
          <input
            id="inp"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Что купил? Например: кофе 4.5"
            aria-label="Что купил?"
          />
          <button className="snd" id="snd" onClick={add} aria-label="Добавить">
            ↑
          </button>
        </div>
      </div>

      <nav id="nav">
        <button className={view === 'notes' ? 'on' : ''} data-v="notes" onClick={() => setView('notes')}>
          <em>📝</em>Заметки
        </button>
        <button className={view === 'stats' ? 'on' : ''} data-v="stats" onClick={() => setView('stats')}>
          <em>📊</em>Статистика
        </button>
        <button className={view === 'set' ? 'on' : ''} data-v="set" onClick={() => setView('set')}>
          <em>⚙️</em>Настройки
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </SettingsProvider>
  );
}
