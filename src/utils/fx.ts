import type { CurrencyCode } from '@/types/domain'

/**
 * Illustrative, static FX rates (1 USD = x). Demo only — a real implementation
 * would read condition records / exchange rates from the ERP.
 */
export const FX_PER_USD: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  SGD: 1.34,
}

export const fromUsd = (usd: number, to: CurrencyCode) => usd * FX_PER_USD[to]
export const toUsd = (amount: number, from: CurrencyCode) => amount / FX_PER_USD[from]
export const roundMoney = (v: number) => Math.round(v * 100) / 100
