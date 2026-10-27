import { Check, Clock, Hourglass, RotateCcw, Undo2, X } from 'lucide-react'
import type { ApprovalStep } from '@/types/domain'
import { useLookups } from '@/app/store'
import { StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/misc'
import { cn } from '@/utils/cn'
import { dateTime, hoursBetween, num } from '@/utils/format'

export function SlaIndicator({ step, compact }: { step: ApprovalStep; compact?: boolean }) {
  if (!step.enteredAt) return null
  const waited = hoursBetween(step.enteredAt, step.actedAt ?? Date.now())
  const ratio = waited / step.slaHours
  const tone = ratio > 1 ? 'danger' : ratio > 0.6 ? 'warning' : 'success'
  const cls = { danger: 'text-danger-700 bg-danger-50 ring-red-200', warning: 'text-warning-700 bg-warning-50 ring-amber-200', success: 'text-success-700 bg-success-50 ring-teal-200' }[tone]
  const label = step.actedAt
    ? `Decided in ${num(waited, 1)}h`
    : ratio > 1
      ? `${num(waited - step.slaHours, 0)}h over SLA`
      : `${num(step.slaHours - waited, 0)}h left`
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', cls)} title={`SLA ${step.slaHours}h · waited ${num(waited, 1)}h`}>
      <Clock className="size-3" />
      {compact ? (ratio > 1 && !step.actedAt ? 'Breached' : label) : label}
    </span>
  )
}

const ICON = {
  Approved: <Check className="size-4" />,
  Rejected: <X className="size-4" />,
  'Returned for Clarification': <RotateCcw className="size-3.5" />,
  Pending: <Hourglass className="size-3.5" />,
  Waiting: <Clock className="size-3.5" />,
  Returned: <Undo2 className="size-3.5" />,
}

export function ApprovalChain({ steps }: { steps: ApprovalStep[] }) {
  const lookups = useLookups()
  if (steps.length === 0) return <p className="text-[13px] text-muted">Approval starts once the request is submitted.</p>
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => {
        const approver = lookups.user(s.approverId)
        const actor = lookups.user(s.actedById)
        return (
          <li key={s.stage} className="relative flex gap-4">
            {i < steps.length - 1 && <span aria-hidden className={cn('absolute left-4 top-9 -bottom-4 w-0.5', s.status === 'Approved' ? 'bg-success' : 'bg-line')} />}
            <span
              className={cn(
                'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full',
                s.status === 'Approved' && 'bg-success text-white',
                s.status === 'Rejected' && 'bg-danger text-white',
                s.status === 'Returned for Clarification' && 'bg-warning text-white',
                s.status === 'Pending' && 'bg-primary text-white ring-4 ring-primary-100',
                s.status === 'Waiting' && 'bg-slate-100 text-muted',
              )}
            >
              {ICON[s.status]}
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-line p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">Level {i + 1} · {s.stage}</p>
                <span className="flex items-center gap-2">
                  {(s.status === 'Pending' || s.actedAt) && <SlaIndicator step={s} />}
                  <StatusBadge status={s.status} />
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                {approver && <Avatar name={approver.name} size="xs" />}
                <span>
                  Assigned to <span className="font-medium text-ink">{approver?.name}</span>
                  {s.enteredAt && ` · entered ${dateTime(s.enteredAt)}`}
                </span>
              </div>
              {s.actedAt && (
                <p className="mt-1 text-xs text-muted">
                  {s.status} by <span className="font-medium text-ink">{actor?.name}</span> on {dateTime(s.actedAt)}
                </p>
              )}
              {s.comment && <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-[13px]">“{s.comment}”</p>}
              {s.history && s.history.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium text-muted hover:text-ink">Earlier decisions at this level ({s.history.length})</summary>
                  <ul className="mt-2 space-y-1.5">
                    {s.history.map((h, j) => (
                      <li key={j} className="rounded-lg border border-line px-2.5 py-1.5">
                        <span className="font-medium">{h.status === 'Returned' ? 'Returned to previous level' : h.status}</span>
                        {h.actedById && <> by {lookups.user(h.actedById)?.name}</>}
                        {h.actedAt && <> · {dateTime(h.actedAt)}</>}
                        {h.status !== 'Returned' && <> — re-opened {dateTime(h.reopenedAt)} by {lookups.user(h.reopenedById)?.name}</>}
                        {h.comment && <p className="mt-0.5 text-[12px] text-ink/80">“{h.comment}”</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
