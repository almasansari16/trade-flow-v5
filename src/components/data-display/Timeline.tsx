import type { ReactNode } from 'react'
import { Check, CircleDot, MessageSquare, RotateCcw, Truck, Undo2, Wallet, X, Zap } from 'lucide-react'
import type { ActivityEntry } from '@/types/domain'
import { cn } from '@/utils/cn'
import { dateTime, relative } from '@/utils/format'

const KIND: Record<ActivityEntry['kind'], { icon: ReactNode; cls: string }> = {
  system: { icon: <Zap className="size-3.5" />, cls: 'bg-slate-100 text-slate-600' },
  user: { icon: <MessageSquare className="size-3.5" />, cls: 'bg-primary-50 text-primary' },
  approval: { icon: <Check className="size-3.5" />, cls: 'bg-success-50 text-success-700' },
  rejection: { icon: <X className="size-3.5" />, cls: 'bg-danger-50 text-danger-700' },
  change: { icon: <RotateCcw className="size-3.5" />, cls: 'bg-warning-50 text-warning-700' },
  finance: { icon: <Wallet className="size-3.5" />, cls: 'bg-info-50 text-info-700' },
  logistics: { icon: <Truck className="size-3.5" />, cls: 'bg-violet-50 text-violet-700' },
  return: { icon: <Undo2 className="size-3.5" />, cls: 'bg-warning-50 text-warning-700' },
}

export function ActivityTimeline({ entries, nameOf }: { entries: ActivityEntry[]; nameOf: (id: string) => string }) {
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <ol className="relative space-y-5">
      {sorted.map((e, i) => {
        const k = KIND[e.kind]
        return (
          <li key={e.id} className="relative flex gap-3">
            {i < sorted.length - 1 && <span className="absolute left-3.5 top-8 -bottom-5 w-px bg-line" aria-hidden />}
            <span className={cn('relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-surface', k.cls)}>{k.icon}</span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px]">
                <span className="font-semibold text-ink">{nameOf(e.actorId)}</span> <span className="text-muted">·</span>{' '}
                <span className="text-ink">{e.action}</span>
              </p>
              <p className="text-xs text-muted" title={dateTime(e.at)}>{relative(e.at)}</p>
              {e.comment && <p className="mt-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink/90">{e.comment}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export interface StepItem {
  label: string
  sub?: ReactNode
  state: 'done' | 'current' | 'upcoming' | 'blocked'
}

/** Horizontal progress tracker (wraps to vertical on small screens). */
export function ProgressSteps({ steps, className }: { steps: StepItem[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col gap-4 md:flex-row md:gap-0', className)}>
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex flex-1 items-start gap-3 md:flex-col md:items-center md:text-center">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                'absolute hidden md:block md:left-[calc(50%+16px)] md:right-[calc(-50%+16px)] md:top-3.5 md:h-0.5',
                s.state === 'done' ? 'bg-success' : 'bg-line',
              )}
            />
          )}
          <span
            className={cn(
              'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-surface',
              s.state === 'done' && 'bg-success text-white',
              s.state === 'current' && 'bg-primary text-white',
              s.state === 'upcoming' && 'bg-slate-100 text-muted',
              s.state === 'blocked' && 'bg-warning text-white',
            )}
          >
            {s.state === 'done' ? <Check className="size-4" /> : s.state === 'current' ? <CircleDot className="size-4" /> : i + 1}
          </span>
          <div className="md:mt-2 md:px-2">
            <p className={cn('text-[13px] font-medium', s.state === 'upcoming' ? 'text-muted' : 'text-ink')}>{s.label}</p>
            {s.sub && <div className="mt-0.5 text-xs text-muted">{s.sub}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
