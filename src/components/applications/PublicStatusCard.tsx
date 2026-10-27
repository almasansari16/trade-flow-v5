/**
 * Renders the applicant-safe projection of a customer application.
 * Used by the public tracking page and the applicant's own portal — it can only
 * show what `toPublicView` exposes (no internal remarks, no staff names).
 */
import type { ReactNode } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, FileText, MessageSquareText, XCircle } from 'lucide-react'
import type { PublicApplicationView } from '@/workflow/publicView'
import { SECTION_LABELS } from '@/workflow/onboarding'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Notice } from '@/components/ui/misc'
import { ProgressSteps, type StepItem } from '@/components/data-display/Timeline'
import { cn } from '@/utils/cn'
import { date, dateTime } from '@/utils/format'

export function publicProgress(v: PublicApplicationView): StepItem[] {
  const n = v.stage?.number ?? 0
  const steps: StepItem[] = [{ label: 'Submitted', state: v.status === 'Draft' ? 'current' : 'done', sub: v.submittedAt ? date(v.submittedAt) : undefined }]
  v.stageLabels.forEach((label, i) => {
    const pos = i + 1
    let state: StepItem['state'] = 'upcoming'
    if (v.status === 'Approved') state = 'done'
    else if (v.status !== 'Draft' && pos < n) state = 'done'
    else if (pos === n) state = v.status === 'Returned for Information' || v.status === 'Rejected' ? 'blocked' : 'current'
    steps.push({ label, state, sub: pos === n && v.status === 'Returned for Information' ? 'Waiting for you' : undefined })
  })
  steps.push({
    label: v.status === 'Rejected' ? 'Not approved' : 'Decision',
    state: v.status === 'Approved' ? 'done' : v.status === 'Rejected' ? 'blocked' : 'upcoming',
    sub: v.decision ? date(v.decision.at) : undefined,
  })
  return steps
}

const TONE: Record<string, string> = {
  done: 'bg-slate-300',
  current: 'bg-primary',
  warning: 'bg-warning',
  danger: 'bg-danger',
  success: 'bg-success',
}

export function PublicTimeline({ view }: { view: PublicApplicationView }) {
  const items = [...view.timeline].reverse()
  if (items.length === 0) return <p className="text-[13px] text-muted">No activity yet.</p>
  return (
    <ol className="relative space-y-4" aria-label="Application history">
      {items.map((t, i) => (
        <li key={`${t.at}-${i}`} className="relative flex gap-3">
          {i < items.length - 1 && <span className="absolute left-[5px] top-4 -bottom-4 w-px bg-line" aria-hidden />}
          <span className={cn('relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-surface', TONE[t.tone])} aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">{t.label}</p>
            <p className="text-xs text-muted">{dateTime(t.at)}</p>
            {t.detail && <p className="mt-1.5 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink/90">{t.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function PublicStatusCard({ view, actions, footer }: { view: PublicApplicationView; actions?: ReactNode; footer?: ReactNode }) {
  const icon =
    view.status === 'Approved' ? <CheckCircle2 className="size-5 text-success" /> : view.status === 'Rejected' ? <XCircle className="size-5 text-danger" /> : view.status === 'Returned for Information' ? <AlertTriangle className="size-5 text-warning" /> : <Clock className="size-5 text-primary" />
  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5">{icon}</span>
              <div>
                <p className="font-mono text-xs text-muted">{view.ref}</p>
                <h2 className="text-lg font-semibold tracking-tight">{view.headline}</h2>
                <p className="mt-0.5 text-[13px] text-muted">{view.companyName} · {view.explanation}</p>
              </div>
            </div>
            <StatusBadge status={view.status} />
          </div>

          <dl className="grid gap-3 text-[13px] sm:grid-cols-4">
            {[
              ['Submitted', view.submittedAt ? date(view.submittedAt) : 'Not yet'],
              ['Last updated', dateTime(view.updatedAt)],
              ['Current stage', view.stage ? `${view.stage.label} (${view.stage.number} of ${view.stage.total})` : view.status === 'Approved' ? 'Completed' : '—'],
              ['Revision', `${view.revision}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-canvas px-3 py-2 ring-1 ring-line">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{k}</dt>
                <dd className="mt-0.5 font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <ProgressSteps steps={publicProgress(view)} />

          {view.actionRequired && (
            <Notice tone="warning" icon={<AlertTriangle className="size-4" />} title={view.actionRequired.type === 'clarification' ? 'Clarification requested' : view.actionRequired.type === 'draft' ? 'Not submitted yet' : 'Action required: corrections requested'}>
              <p className="whitespace-pre-line">{view.actionRequired.instructions}</p>
              {view.actionRequired.sections.length > 0 && (
                <p className="mt-2 text-xs">Sections you can edit: <strong>{view.actionRequired.sections.map((s) => SECTION_LABELS[s]).join(', ')}</strong></p>
              )}
            </Notice>
          )}
          {view.decision && (
            <Notice tone={view.decision.outcome === 'Approved' ? 'success' : 'danger'} icon={view.decision.outcome === 'Approved' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} title={view.decision.outcome === 'Approved' ? `Approved on ${date(view.decision.at)}` : `Not approved — ${date(view.decision.at)}`}>
              {view.decision.message ?? (view.decision.outcome === 'Approved' ? 'Welcome aboard. Sign in to start ordering.' : undefined)}
            </Notice>
          )}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,360px)]">
        <Card>
          <CardHeader title="Timeline" description="Only events that have happened are shown." icon={<CalendarClock className="size-4" />} />
          <CardBody><PublicTimeline view={view} /></CardBody>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Reviewer remarks" description="Messages addressed to you." icon={<MessageSquareText className="size-4" />} />
            <CardBody>
              {view.remarks.length === 0 ? (
                <p className="text-[13px] text-muted">No remarks have been shared with you.</p>
              ) : (
                <ul className="space-y-3">
                  {[...view.remarks].reverse().map((r, i) => (
                    <li key={i} className="rounded-lg border border-line bg-canvas px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{r.label} · {date(r.at)}</p>
                      <p className="mt-1 text-[13px]">{r.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3 text-[13px]">
              <FileText className="size-4 text-muted" />
              <span><strong>{view.documentCount}</strong> current supporting document{view.documentCount === 1 ? '' : 's'} on file</span>
            </CardBody>
          </Card>
          {footer}
        </div>
      </div>
    </div>
  )
}
