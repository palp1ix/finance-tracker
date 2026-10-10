import { useMemo, useState } from 'react';
import { EntryRow } from './EntryRow';
import { EditSheet } from './EditSheet';
import { dayLabel, todayStart } from '../../domain/date';
import type { Entry, Settings } from '../../domain/types';

interface NotesViewProps {
  entries: Entry[];
  settings: Settings;
  onEdit: (entry: Entry, patch: Partial<Entry>) => void;
  onDelete: (entry: Entry) => void;
  onRetry: (entry: Entry) => void;
}

type StatusFilter = 'all' | 'pending' | 'processed' | 'error';
type PeriodFilter = '7' | '30' | 'all';

function dayKeyOf(e: Entry): string {
  const iso = e.parsed?.occurredAt ?? e.createdAt;
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function NotesView({ entries, settings, onEdit, onDelete, onRetry }: NotesViewProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [editing, setEditing] = useState<Entry | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff =
      period === 'all' ? 0 : todayStart().getTime() - Number(period) * 24 * 60 * 60 * 1000;
    const list = entries.filter((e) => {
      if (status === 'pending' && e.status !== 'pending') return false;
      if (status === 'processed' && e.status !== 'processed') return false;
      if (status === 'error' && e.status !== 'error') return false;
      if (category !== 'all' && e.parsed?.categoryId !== category) return false;
      if (period !== 'all' && new Date(e.createdAt).getTime() < cutoff) return false;
      if (q) {
        const hay = (e.rawText + ' ' + (e.parsed?.title ?? '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return list.sort(
      (a, b) =>
        new Date(b.parsed?.occurredAt ?? b.createdAt).getTime() -
        new Date(a.parsed?.occurredAt ?? a.createdAt).getTime(),
    );
  }, [entries, query, status, period, category]);

  const groups = useMemo(() => {
    const out: Array<{ label: string; entries: Entry[] }> = [];
    let lastKey = '';
    for (const e of filtered) {
      const key = dayKeyOf(e);
      if (key !== lastKey) {
        out.push({ label: dayLabel(e.parsed?.occurredAt ?? e.createdAt), entries: [] });
        lastKey = key;
      }
      out[out.length - 1].entries.push(e);
    }
    return out;
  }, [filtered]);

  const segBtn = (active: boolean) => (active ? ' on' : '');

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <input
            placeholder="Поиск по заметкам…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="seg">
          <button className={segBtn(status === 'all')} onClick={() => setStatus('all')}>
            Все
          </button>
          <button className={segBtn(status === 'pending')} onClick={() => setStatus('pending')}>
            В очереди
          </button>
          <button className={segBtn(status === 'processed')} onClick={() => setStatus('processed')}>
            Готово
          </button>
          <button className={segBtn(status === 'error')} onClick={() => setStatus('error')}>
            Ошибки
          </button>
        </div>
        <div className="seg">
          <button className={segBtn(period === 'all')} onClick={() => setPeriod('all')}>
            Всё время
          </button>
          <button className={segBtn(period === '30')} onClick={() => setPeriod('30')}>
            30 дней
          </button>
          <button className={segBtn(period === '7')} onClick={() => setPeriod('7')}>
            7 дней
          </button>
        </div>
        <div className="chips">
          <button className={'chip' + (category === 'all' ? ' on' : '')} onClick={() => setCategory('all')}>
            Все
          </button>
          {settings.categories.map((c) => (
            <button
              key={c.id}
              className={'chip' + (category === c.id ? ' on' : '')}
              onClick={() => setCategory(c.id)}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="skel">
          <em>🗒️</em>
          Нет записей. Добавь первую покупку внизу.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <div className="day">{g.label}</div>
            {g.entries.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                settings={settings}
                onOpen={setEditing}
                onDelete={onDelete}
              />
            ))}
          </div>
        ))
      )}

      <EditSheet
        entry={editing}
        settings={settings}
        onClose={() => setEditing(null)}
        onSave={onEdit}
        onDelete={onDelete}
        onRetry={onRetry}
      />
    </>
  );
}
