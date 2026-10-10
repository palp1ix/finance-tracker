import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { CURRENCIES, SYMBOL } from '../../domain/currency';
import type { Currency, Entry, EntryType, Settings } from '../../domain/types';

interface EditSheetProps {
  entry: Entry | null;
  settings: Settings;
  onClose: () => void;
  onSave: (entry: Entry, patch: Partial<Entry>) => void;
  onDelete: (entry: Entry) => void;
  onRetry: (entry: Entry) => void;
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function dateInputToIso(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toISOString();
}

export function EditSheet({ entry, settings, onClose, onSave, onDelete, onRetry }: EditSheetProps) {
  const [rawText, setRawText] = useState('');
  const [categoryId, setCategoryId] = useState('other');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('BYN');
  const [date, setDate] = useState('');
  const [type, setType] = useState<EntryType>('expense');

  useEffect(() => {
    if (!entry) return;
    setRawText(entry.rawText);
    const p = entry.parsed;
    setCategoryId(p?.categoryId ?? 'other');
    setAmount(p ? String(p.amount) : '');
    setCurrency(p?.currency ?? settings.defaultCurrency);
    setDate(toDateInput(p?.occurredAt ?? entry.createdAt));
    setType(p?.type ?? 'expense');
  }, [entry, settings.defaultCurrency]);

  const open = entry !== null;
  if (!entry) return null;

  const isProcessed = entry.status === 'processed' && entry.parsed;

  const save = () => {
    const text = rawText.trim() || entry.rawText;
    const patch: Partial<Entry> = { rawText: text };
    if (isProcessed) {
      const amt = parseFloat(amount.replace(',', '.'));
      patch.parsed = {
        ...entry.parsed!,
        title: text,
        amount: Number.isFinite(amt) ? amt : entry.parsed!.amount,
        currency,
        categoryId,
        occurredAt: dateInputToIso(date),
        type,
      };
    }
    onSave(entry, patch);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="hrow">
        <b>{isProcessed ? 'Редактировать' : 'Запись'}</b>
        <button className="x" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </div>

      <div className="row">
        <input
          className="fld"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Что купил?"
          style={{ fontSize: 16 }}
        />
      </div>

      {isProcessed && (
        <>
          <h3>Категория</h3>
          <div className="catgrid">
            {settings.categories.map((c) => (
              <button
                key={c.id}
                className={c.id === categoryId ? 'on' : ''}
                onClick={() => setCategoryId(c.id)}
              >
                <em>{c.emoji}</em>
                {c.name}
              </button>
            ))}
          </div>

          <div className="row">
            <label>Сумма</label>
            <input
              className="fld"
              style={{ width: '45%' }}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="row">
            <label>Валюта</label>
            <select className="fld" style={{ width: '45%' }} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} ({SYMBOL[c]})
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label>Дата</label>
            <input className="fld" style={{ width: '50%' }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="row">
            <label>Тип</label>
            <div className="seg" style={{ margin: 0, flex: 1 }}>
              <button className={type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}>
                Расход
              </button>
              <button className={type === 'refund' ? 'on' : ''} onClick={() => setType('refund')}>
                Возврат
              </button>
            </div>
          </div>
        </>
      )}

      {entry.status === 'error' && <p className="tip">Ошибка: {entry.error}</p>}

      <div className="row">
        <button className="go" style={{ flex: 1 }} onClick={save}>
          Сохранить
        </button>
      </div>
      <div className="row">
        {isProcessed && (
          <button className="btn2" onClick={() => { onRetry(entry); onClose(); }}>
            Вернуть в очередь
          </button>
        )}
        {entry.status === 'error' && (
          <button className="btn2" onClick={() => { onRetry(entry); onClose(); }}>
            Повторить
          </button>
        )}
        <button className="btn2" style={{ color: 'var(--err)' }} onClick={() => { onDelete(entry); onClose(); }}>
          Удалить
        </button>
      </div>
    </Sheet>
  );
}
