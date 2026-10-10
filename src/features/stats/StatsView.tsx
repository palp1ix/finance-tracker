import { useEffect, useMemo, useState } from 'react';
import { computeStats } from './stats';
import { getInsight, localInsight } from '../../ai/insight';
import { categoryById } from '../../domain/categories';
import { CURRENCIES, formatMoney, fromByn } from '../../domain/currency';
import { monthKey, monthLabel, shiftMonth } from '../../domain/date';
import type { Currency, Entry, Settings } from '../../domain/types';

interface StatsViewProps {
  entries: Entry[];
  settings: Settings;
}

const CIRC = 251.3;

export function StatsView({ entries, settings }: StatsViewProps) {
  const [currency, setCurrency] = useState<Currency>('BYN');
  const [offset, setOffset] = useState(0);
  const [insight, setInsight] = useState<string>('');

  const now = monthKey(new Date());
  const period = useMemo(() => shiftMonth(now, offset), [now.year, now.month, offset]);

  const monthEntries = useMemo(
    () =>
      entries.filter((e) => {
        if (e.status !== 'processed' || !e.parsed) return false;
        const d = new Date(e.parsed.occurredAt);
        return d.getFullYear() === period.year && d.getMonth() === period.month;
      }),
    [entries, period.year, period.month],
  );

  const res = useMemo(() => computeStats(entries, settings, period), [entries, settings, period]);

  useEffect(() => {
    let cancelled = false;
    setInsight(localInsight(monthEntries, settings));
    getInsight(monthEntries, settings).then((text) => {
      if (!cancelled) setInsight(text);
    });
    return () => {
      cancelled = true;
    };
  }, [monthEntries, settings]);

  const donutData = res.byCategory.filter((c) => c.value > 0);
  const denom = donutData.reduce((s, c) => s + c.value, 0);
  let dashOffset = 0;

  const maxDay = Math.max(...res.byDay, 1);

  return (
    <>
      <h1>Статистика</h1>
      <p className="sub">
        {monthLabel(period.year, period.month)} · {res.days} дн.
      </p>

      <div className="bar">
        <button className="btn2" style={{ flex: '0 0 auto', width: 44 }} onClick={() => setOffset((o) => o - 1)} aria-label="Предыдущий месяц">
          ‹
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>
          {monthLabel(period.year, period.month)}
        </div>
        <button
          className="btn2"
          style={{ flex: '0 0 auto', width: 44 }}
          disabled={offset >= 0}
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>

      <div className="seg" id="cur">
        {CURRENCIES.map((c) => (
          <button key={c} className={c === currency ? 'on' : ''} onClick={() => setCurrency(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="card">
        <small style={{ color: 'var(--mut)' }}>Потрачено</small>
        <div className="big">{formatMoney(fromByn(res.totalByn, currency, settings.rates), currency)}</div>
        <div className="oth">
          {CURRENCIES.filter((c) => c !== currency).map((c) => (
            <span key={c}>≈ {formatMoney(fromByn(res.totalByn, c, settings.rates), c)}</span>
          ))}
        </div>
        {res.refundByn > 0 && (
          <div className="oth" style={{ marginTop: 6 }}>
            <span>
              Возвраты: −{formatMoney(fromByn(res.refundByn, currency, settings.rates), currency)}
            </span>
          </div>
        )}
      </div>

      <div className="grid" id="kpi">
        {(
          [
            ['В среднем в день', fromByn(res.days ? res.totalByn / res.days : 0, currency, settings.rates)],
            ['Покупок', res.count],
            ['Средний чек', fromByn(res.avgCheckByn, currency, settings.rates)],
            ['Самая крупная', fromByn(res.maxByn, currency, settings.rates)],
          ] as Array<[string, number]>
        ).map(([label, value]) => (
          <div className="card" key={label}>
            <small>{label}</small>
            <b>{typeof value === 'number' && label !== 'Покупок' ? formatMoney(value, currency) : value}</b>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>По категориям</h3>
        <div className="don">
          <svg width="132" height="132" viewBox="0 0 100 100">
            {donutData.length === 0 ? (
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--line)" strokeWidth="14" />
            ) : (
              donutData.map((c) => {
                const color = categoryById(settings.categories, c.id).color;
                const len = denom > 0 ? (c.value / denom) * CIRC : 0;
                const el = (
                  <circle
                    key={c.id}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={color}
                    strokeWidth="14"
                    strokeDasharray={`${len} ${CIRC}`}
                    strokeDashoffset={-dashOffset}
                    transform="rotate(-90 50 50)"
                  />
                );
                dashOffset += len;
                return el;
              })
            )}
          </svg>
          <div className="lg">
            {donutData.length === 0 ? (
              <div>Нет расходов за этот период</div>
            ) : (
              donutData.slice(0, 5).map((c) => {
                const cat = categoryById(settings.categories, c.id);
                return (
                  <div key={c.id}>
                    <i style={{ background: cat.color }} />
                    {cat.name}
                    <span>{denom > 0 ? Math.round((c.value / denom) * 100) : 0}%</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>По дням</h3>
        <div className="bars" style={res.days > 20 ? { gap: 3 } : undefined}>
          {res.byDay.map((v, i) => (
            <div key={i} title={`${i + 1} ${monthLabel(period.year, period.month)}`}>
              <u style={{ height: `${Math.max(4, Math.max(v, 0) / maxDay * 88)}px` }} />
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="card ai">
        <h3>✨ Вывод ИИ</h3>
        <p>{insight || 'Загружаю инсайт…'}</p>
      </div>
    </>
  );
}
