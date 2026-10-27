import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/utils/cn'

export function StatCard({
  label,
  value,
  icon,
  delta,
  hint,
  to,
  tone = 'primary',
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  delta?: { value: string; positive: boolean }
  hint?: ReactNode
  to?: string
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary ring-primary-100',
    success: 'bg-success-50 text-success-700 ring-teal-100',
    warning: 'bg-warning-50 text-warning-700 ring-amber-100',
    danger: 'bg-danger-50 text-danger-700 ring-red-100',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  }
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-muted">{label}</p>
        <span className={cn('flex size-7 items-center justify-center rounded-md ring-1 [&_svg]:size-3.5', tones[tone])}>{icon}</span>
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight text-ink tabular">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        {delta && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', delta.positive ? 'text-success-700' : 'text-danger-700')}>
            {delta.positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {delta.value}
          </span>
        )}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
    </>
  )
  const cls = 'card block px-3.5 py-3'
  return to ? (
    <Link to={to} className={cn(cls, 'transition-colors hover:border-primary/40')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
