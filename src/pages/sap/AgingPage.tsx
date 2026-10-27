import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { Card, CardHeader } from '@/components/ui/Card'
import { SapSourceBar, SapState } from '@/components/sap/SapParts'
import { date, money } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { AgingBucketKey } from '@/types/sap'
import { AccountReport } from './AccountReport'

const TONE: Record<AgingBucketKey, string> = { current: 'bg-success', d1_30: 'bg-warning', d31_60: 'bg-orange-500', d61_90: 'bg-danger', d90_plus: 'bg-red-800' }

export default function AgingPage() {
  return (
    <AccountReport title="Invoice aging" crumb="Invoice aging" description="Outstanding invoice balances grouped by days past due.">
      {(customerId) => <Aging customerId={customerId} />}
    </AccountReport>
  )
}

function Aging({ customerId }: { customerId: string }) {
  const q = useSapQuery((ctx) => services.sapData.getAging(ctx, customerId), [customerId])
  const [bucket, setBucket] = useState<AgingBucketKey | ''>('')
  return (
    <SapState q={q} rows={6}>
      {(r) => {
        const m = (v: number) => money(v, r.currency)
        const lines = r.lines.filter((l) => !bucket || l.bucket === bucket)
        const label = (k: AgingBucketKey) => r.buckets.find((b) => b.key === k)!.label
        return (
          <div className="space-y-3">
            <SapSourceBar mode={r.mode} syncedAt={r.syncedAt} onRefresh={q.reload} loading={q.loading} extra={<span>Reporting date {date(r.asOf)}</span>} />
            <Card>
              <CardHeader title={`Total outstanding ${m(r.total)}`} description={r.basis} />
              <div className="px-4 py-3">
                {r.total > 0 && (
                  <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    {r.buckets.filter((b) => b.amount > 0).map((b) => <span key={b.key} className={TONE[b.key]} style={{ width: `${(b.amount / r.total) * 100}%` }} />)}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Aging buckets">
                  {r.buckets.map((b) => (
                    <button key={b.key} type="button" aria-pressed={bucket === b.key} onClick={() => setBucket(bucket === b.key ? '' : b.key)} className={cn('rounded-md border border-line px-3 py-2 text-left hover:border-primary/40', bucket === b.key && 'border-primary bg-primary-50/40 ring-1 ring-primary/30')}>
                      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted"><span className={cn('size-2 rounded-full', TONE[b.key])} />{b.label}</span>
                      <span className="block text-[17px] font-semibold tabular">{m(b.amount)}</span>
                      <span className="text-[11px] text-muted">{b.count} invoice(s)</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <caption className="sr-only">Aging by invoice</caption>
                  <thead>
                    <tr className="border-b border-line bg-canvas/70 text-left text-[11px] uppercase tracking-wide text-muted"><th className="px-4 py-2">Invoice</th><th className="px-3 py-2">Invoice date</th><th className="px-3 py-2">Due date</th><th className="px-3 py-2 text-right">Outstanding</th><th className="px-3 py-2 text-right">Days overdue</th><th className="px-4 py-2">Aging category</th></tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No outstanding invoices{bucket ? ' in this category' : ''}.</td></tr>}
                    {lines.map((l) => (
                      <tr key={l.invoiceNumber} className="border-b border-line">
                        <td className="px-4 py-2"><Link to={`/app/finance/invoices/${l.invoiceNumber}`} className="font-mono text-[12px] font-semibold text-primary hover:underline">{l.invoiceNumber}</Link></td>
                        <td className="whitespace-nowrap px-3 py-2">{date(l.invoiceDate)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{date(l.dueDate)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular">{m(l.outstanding)}</td>
                        <td className={cn('px-3 py-2 text-right tabular', l.daysOverdue && 'font-semibold text-danger-700')}>{l.daysOverdue || '—'}</td>
                        <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5"><span className={cn('size-2 rounded-full', TONE[l.bucket])} />{label(l.bucket)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      }}
    </SapState>
  )
}
