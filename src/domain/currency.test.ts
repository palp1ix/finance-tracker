import { describe, expect, it } from 'vitest';
import { DEFAULT_RATES, formatMoney, fromByn, rateToByn, toByn } from './currency';

describe('валюты', () => {
  it('курсы к BYN', () => {
    expect(rateToByn('BYN', DEFAULT_RATES)).toBe(1);
    expect(rateToByn('USD', DEFAULT_RATES)).toBeCloseTo(3.0207);
    expect(rateToByn('EUR', DEFAULT_RATES)).toBeCloseTo(3.4309);
    // RUB хранится как «BYN за 100 RUB»
    expect(rateToByn('RUB', DEFAULT_RATES)).toBeCloseTo(0.035962);
  });

  it('пересчёт в BYN', () => {
    expect(toByn(10, 'USD', DEFAULT_RATES)).toBeCloseTo(30.207);
    expect(toByn(100, 'RUB', DEFAULT_RATES)).toBeCloseTo(3.5962);
    expect(toByn(5, 'BYN', DEFAULT_RATES)).toBe(5);
  });

  it('пересчёт из BYN и обратно', () => {
    const byn = 50;
    for (const c of ['BYN', 'USD', 'EUR', 'RUB'] as const) {
      expect(toByn(fromByn(byn, c, DEFAULT_RATES), c, DEFAULT_RATES)).toBeCloseTo(byn, 5);
    }
  });

  it('форматирование сумм', () => {
    expect(formatMoney(12.5, 'BYN')).toBe('12,50 Br');
    expect(formatMoney(4.99, 'EUR')).toBe('4,99 €');
  });
});
