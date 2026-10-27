import type { ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { initials } from '@/utils/format'

const AVATAR_COLORS = ['bg-primary', 'bg-teal-600', 'bg-amber-600', 'bg-rose-600', 'bg-sky-600', 'bg-violet-700', 'bg-emerald-700', 'bg-slate-700']

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
  const sizes = { xs: 'size-6 text-[10px]', sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' }
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', color, sizes[size], className)}>
      {initials(name)}
    </span>
  )
}

export function EmptyState({ icon, title, description, action, className }: { icon: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-50 text-primary ring-1 ring-primary-100">{icon}</div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export function QuantityStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  label = 'Quantity',
  size = 'md',
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  label?: string
  size?: 'sm' | 'md'
}) {
  const clamp = (v: number) => Math.max(min, max !== undefined ? Math.min(max, v) : v)
  const h = size === 'sm' ? 'h-8' : 'h-9'
  return (
    <div className={cn('inline-flex items-stretch overflow-hidden rounded-lg border border-line bg-surface', h)}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))} className="px-2 text-muted hover:bg-canvas hover:text-ink disabled:opacity-40">
        <Minus className="size-3.5" />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10)
          onChange(clamp(n))
        }}
        className="w-14 border-x border-line text-center text-sm font-medium tabular focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30"
      />
      <button type="button" aria-label={`Increase ${label}`} disabled={max !== undefined && value >= max} onClick={() => onChange(clamp(value + step))} className="px-2 text-muted hover:bg-canvas hover:text-ink disabled:opacity-40">
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

export function KeyValue({ items, cols = 2, className }: { items: { label: ReactNode; value: ReactNode }[]; cols?: 1 | 2 | 3 | 4; className?: string }) {
  const grid = { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', grid[cols], className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="eyebrow">{it.label}</dt>
          <dd className="mt-1 text-[13px] font-medium text-ink break-words">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Notice({ tone = 'info', icon, title, children, className, action }: { tone?: 'info' | 'warning' | 'danger' | 'success' | 'demo'; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  const tones = {
    info: 'bg-info-50 border-blue-200 text-info-700',
    warning: 'bg-warning-50 border-amber-200 text-warning-700',
    danger: 'bg-danger-50 border-red-200 text-danger-700',
    success: 'bg-success-50 border-teal-200 text-success-700',
    demo: 'bg-primary-50/70 border-primary-100 text-primary-700',
  }
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px]', tones[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function ProgressBar({ value, tone = 'primary', className }: { value: number; tone?: 'primary' | 'success' | 'warning' | 'danger'; className?: string }) {
  const tones = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}
