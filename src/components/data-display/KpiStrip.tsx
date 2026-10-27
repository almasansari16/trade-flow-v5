import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface KpiItem {
  key: string
  label: string
  value: ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  hint?: string
}

const bar: Record<NonNullable<KpiItem['tone']>, string> = {
  neutral: 'bg-slate-300',
  primary: 'bg-primary',
  info: 'bg-sky-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/**
 * Compact KPI row. When `onSelect` is given each KPI is a real filter toggle
 * (aria-pressed); otherwise KPIs are plain read-only figures — never decorative buttons.
 */
export function KpiStrip({ items, active, onSelect, className }: { items: KpiItem[]; active?: string; onSelect?: (key: string) => void; className?: string }) {
  return (
    <div className={cn('mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6', className)} role={onSelect ? 'group' : undefined} aria-label={onSelect ? 'Filter by KPI' : undefined}>
      {items.map((k) => {
        const inner = (
          <>
            <span className={cn('absolute inset-y-2 left-0 w-[3px] rounded-r', bar[k.tone ?? 'neutral'])} aria-hidden />
            <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-muted">{k.label}</span>
            <span className="mt-0.5 block text-xl font-semibold leading-tight tabular text-ink">{k.value}</span>
            {k.hint && <span className="block truncate text-[11px] text-muted">{k.hint}</span>}
          </>
        )
        const cls = cn('relative rounded-lg border border-line bg-surface py-2 pl-3.5 pr-3 text-left', onSelect && 'transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary', active === k.key && 'border-primary ring-1 ring-primary/30 bg-primary-50/40')
        return onSelect ? (
          <button key={k.key} type="button" aria-pressed={active === k.key} className={cls} onClick={() => onSelect(active === k.key ? '' : k.key)}>{inner}</button>
        ) : (
          <div key={k.key} className={cls}>{inner}</div>
        )
      })}
    </div>
  )
}
