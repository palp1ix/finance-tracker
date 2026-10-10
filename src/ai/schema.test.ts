import { describe, expect, it } from 'vitest';
import { AiBatchSchema } from './schema';
import { extractJson } from './client';
import { buildSystemPrompt, buildUserMessage } from './process';
import { defaultSettings } from '../db/db';
import type { Entry } from '../domain/types';

describe('парсинг ответа ИИ', () => {
  it('валидирует корректный ответ', () => {
    const json = {
      results: [
        {
          index: 0,
          parsed: {
            title: 'Кофе',
            amount: 4.5,
            currency: 'BYN',
            categoryId: 'cafe',
            occurredAt: '2026-10-10T12:00:00.000Z',
            type: 'expense',
          },
        },
        { index: 1, error: 'нет суммы' },
      ],
    };
    const res = AiBatchSchema.parse(json);
    expect(res.results).toHaveLength(2);
    expect(res.results[0].parsed?.amount).toBe(4.5);
    expect(res.results[1].error).toBe('нет суммы');
  });

  it('отклоняет запись с parsed и error одновременно', () => {
    const json = {
      results: [
        {
          index: 0,
          error: 'нет суммы',
          parsed: { title: 'x', amount: 1, currency: 'BYN', categoryId: 'other', occurredAt: '2026-01-01', type: 'expense' },
        },
      ],
    };
    expect(AiBatchSchema.safeParse(json).success).toBe(false);
  });

  it('extractJson достаёт JSON из fenced-блока', () => {
    const text = '```json\n{"results": []}\n```';
    expect(extractJson(text)).toEqual({ results: [] });
  });

  it('extractJson достаёт JSON с текстом вокруг', () => {
    const text = 'Вот результат: {"results": []} конец';
    expect(extractJson(text)).toEqual({ results: [] });
  });
});

describe('промпт', () => {
  const entry: Entry = {
    id: '1',
    rawText: 'кофе 4.5',
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
    status: 'pending',
  };

  it('содержит категории и валюту по умолчанию', () => {
    const s = defaultSettings();
    const p = buildSystemPrompt(s);
    expect(p).toContain('BYN');
    expect(p).toContain('food');
    expect(p).toContain('Другое');
    expect(p).toContain('refund');
  });

  it('содержит записи с createdAt', () => {
    const u = buildUserMessage([entry]);
    expect(u).toContain('кофе 4.5');
    expect(u).toContain('createdAt');
  });
});
