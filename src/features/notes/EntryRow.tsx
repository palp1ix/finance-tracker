import { useRef, useState, type PointerEvent } from 'react';
import type { Entry, Settings } from '../../domain/types';
import { categoryById } from '../../domain/categories';
import { formatMoney, toByn } from '../../domain/currency';

interface EntryRowProps {
  entry: Entry;
  settings: Settings;
  onOpen: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}

function timeOf(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 5);
}

export function EntryRow({ entry, settings, onOpen, onDelete }: EntryRowProps) {
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const setOff = (v: number) => {
    offsetRef.current = v;
    setOffset(v);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!start.current.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      start.current.moved = true;
    }
    if (start.current.moved) {
      setOff(Math.max(-96, Math.min(0, dx)));
    }
  };

  const onPointerUp = () => {
    if (!start.current) return;
    const moved = start.current.moved;
    start.current = null;
    if (moved) {
      if (offsetRef.current < -60) {
        onDelete(entry);
      }
      setOff(0);
    } else {
      onOpen(entry);
    }
  };

  const p = entry.parsed;
  const cat = p ? categoryById(settings.categories, p.categoryId) : null;
  const converted = p && p.currency !== 'BYN' ? formatMoney(toByn(p.amount, p.currency, settings.rates), 'BYN') : null;

  let icon = '⏳';
  let title = entry.rawText;
  let sub: string;
  let right: React.ReactNode;
  let extraClass = ' pend';

  if (entry.status === 'error') {
    icon = '⚠️';
    extraClass = ' err';
    sub = entry.error ?? 'Ошибка обработки';
    right = <span className="pill err">Ошибка</span>;
  } else if (p && cat) {
    icon = cat.emoji;
    extraClass = '';
    title = p.title || entry.rawText;
    sub = cat.name + (converted ? ` · ≈ ${converted}` : '');
    right = <div className="am">{formatMoney(p.amount, p.currency)}</div>;
  } else {
    sub = timeOf(entry.createdAt);
    right = <span className="pill">В очереди</span>;
  }

  return (
    <div className="swipe">
      <div className="swipe-bg">Удалить</div>
      <div
        className={'swipe-body it' + extraClass}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setOff(0);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(entry);
          }
        }}
      >
        <div className="ic">{icon}</div>
        <div className="tx">
          <b>{title}</b>
          <span>{sub}</span>
        </div>
        {right}
      </div>
    </div>
  );
}
