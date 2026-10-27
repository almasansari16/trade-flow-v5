import type { CurrencyCode, ISODate } from '@/types/domain'

const moneyCache = new Map<string, Intl.NumberFormat>()

export function money(value: number, currency: CurrencyCode, opts: { compact?: boolean; decimals?: number } = {}) {
  const key = `${currency}-${opts.compact ? 'c' : 'f'}-${opts.decimals ?? 'd'}`
  let fmt = moneyCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: opts.decimals ?? (opts.compact ? 1 : 2),
      minimumFractionDigits: opts.compact ? 0 : opts.decimals ?? 2,
    })
    moneyCache.set(key, fmt)
  }
  return fmt.format(value)
}

export const num = (value: number, decimals = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value)

export const pct = (value: number, decimals = 0) => `${num(value, decimals)}%`

export function date(iso: ISODate | undefined, style: 'short' | 'medium' | 'long' = 'medium') {
  if (!iso) return '—'
  const d = new Date(iso)
  if (style === 'short') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  if (style === 'long') return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function dateTime(iso: ISODate | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export function relative(iso: ISODate | undefined, now = Date.now()) {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const min = 60_000
  const hr = 60 * min
  const day = 24 * hr
  if (abs < min) return 'just now'
  if (abs < hr) return rtf.format(Math.round(diff / min), 'minute')
  if (abs < day) return rtf.format(Math.round(diff / hr), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day')
  return date(iso)
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

export const fileSize = (kb: number) => (kb >= 1024 ? `${num(kb / 1024, 1)} MB` : `${num(kb)} KB`)

export const hoursBetween = (a: ISODate, b: ISODate | number = Date.now()) =>
  ((typeof b === 'number' ? b : new Date(b).getTime()) - new Date(a).getTime()) / 3_600_000
