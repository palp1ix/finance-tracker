import type { Currency, Rates } from './types';

export const CURRENCIES: Currency[] = ['BYN', 'USD', 'EUR', 'RUB'];

export const SYMBOL: Record<Currency, string> = {
  BYN: 'Br',
  USD: '$',
  EUR: '€',
  RUB: '₽',
};

export const DEFAULT_RATES: Rates = {
  USD: 3.0207,
  EUR: 3.4309,
  RUB: 3.5962, // BYN за 100 RUB
};

/** BYN за 1 единицу валюты. */
export function rateToByn(currency: Currency, rates: Rates): number {
  switch (currency) {
    case 'BYN':
      return 1;
    case 'USD':
      return rates.USD;
    case 'EUR':
      return rates.EUR;
    case 'RUB':
      return rates.RUB / 100;
  }
}

export function toByn(amount: number, currency: Currency, rates: Rates): number {
  return amount * rateToByn(currency, rates);
}

export function fromByn(byn: number, currency: Currency, rates: Rates): number {
  return byn / rateToByn(currency, rates);
}

/** Формат суммы: «12,50 Br» */
export function formatMoney(amount: number, currency: Currency): string {
  return (
    amount.toLocaleString('ru', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    ' ' +
    SYMBOL[currency]
  );
}
