import type { ReactNode } from 'react'
import { AlertTriangle, CloudOff, Database, RefreshCw, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { relative, dateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { SapQuery } from '@/hooks/useSap'

/** Data-source line: where figures come from and when they were read. Mock data is always labelled. */
export function SapSourceBar({ mode, syncedAt, onRefresh, loading, className, extra }: { mode?: 'mock' | 'live'; syncedAt?: string; onRefresh?: () => void; loading?: boolean; className?: string; extra?: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Database className="size-3.5" />
        {mode === 'live' ? 'Source: SAP' : 'Source: SAP development mock — not connected to SAP'}
      </span>
      {syncedAt && <span title={dateTime(syncedAt)}>Read {relative(syncedAt)}</span>}
      {extra}
      {onRefresh && (
        <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50">
          <RefreshCw className={cn('size-3', loading && 'animate-spin')} /> Refresh
        </button>
      )}
    </div>
  )
}

/** Loading / error wrapper for SAP-backed sections. */
export function SapState<T>({ q, children, rows = 5, empty }: { q: SapQuery<T>; children: (data: T) => ReactNode; rows?: number; empty?: (data: T) => ReactNode | false }) {
  if (q.error) return <SapError error={q.error} onRetry={q.reload} />
  if (!q.data) return <div className="space-y-2 p-4" role="status" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
  const e = empty?.(q.data)
  if (e) return <>{e}</>
  return <>{children(q.data)}</>
}

export function SapError({ error, onRetry }: { error: { code: string; message: string }; onRetry?: () => void }) {
  const icon = error.code === 'SAP_UNAVAILABLE' ? <CloudOff className="size-5" /> : error.code === 'NOT_MAPPED' ? <Unlink className="size-5" /> : <AlertTriangle className="size-5" />
  const title = error.code === 'SAP_UNAVAILABLE' ? 'SAP is not reachable right now' : error.code === 'NOT_MAPPED' ? 'Account not linked to SAP yet' : error.code === 'NOT_FOUND' ? 'Not available' : error.code === 'NOT_AUTHORIZED' ? 'Not authorised' : 'Could not load'
  return <EmptyState icon={icon} title={title} description={error.message} action={onRetry && error.code === 'SAP_UNAVAILABLE' ? <Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" />} onClick={onRetry}>Try again</Button> : undefined} />
}

/** Account picker for staff (customers always see their own account). */
export function AccountPicker({ customerId, options, onPick }: { customerId: string; options: { id: string; name: string; code: string }[]; onPick: (id: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-muted">
      Customer account
      <select aria-label="Customer account" value={customerId} onChange={(e) => onPick(e.target.value)} className="input h-8 w-60">
        {options.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
      </select>
    </label>
  )
}
