import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SapSourceBar, SapState } from '@/components/sap/SapParts'
import { date, money } from '@/utils/format'
import { AccountReport } from './AccountReport'

export default function LedgerPage() {
  return (
    <AccountReport title="Customer ledger" crumb="Customer ledger" description="Chronological postings on the account in SAP: invoices, credit memos, cancellations and payments.">
      {(customerId) => <Ledger customerId={customerId} />}
    </AccountReport>
  )
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

function Ledger({ customerId }: { customerId: string }) {
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 180 * 86_400_000)))
  const [to, setTo] = useState(() => iso(new Date()))
  const [page, setPage] = useState(1)
  const q = useSapQuery((ctx) => services.sapData.getLedger(ctx, customerId, { from, to, page, pageSize: 15 }), [customerId, from, to, page])
  const docLink = (no: string, type: string) =>
    type === 'Payment' ? `/app/finance/payments/${no}` : type === 'Invoice' || type === 'Credit Memo' ? `/app/finance/invoices/${no}` : undefined
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[12px] font-medium">From<input type="date" aria-label="Ledger from" className="input mt-1 h-8 w-38" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></label>
        <label className="text-[12px] font-medium">To<input type="date" aria-label="Ledger to" className="input mt-1 h-8 w-38" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></label>
      </div>
      <SapState q={q} rows={8}>
        {(l) => {
          const m = (v: number) => money(v, l.currency)
          const pages = Math.max(1, Math.ceil(l.total / l.pageSize))
          return (
            <>
              <SapSourceBar mode={l.mode} syncedAt={l.syncedAt} onRefresh={q.reload} loading={q.loading} extra={<span>SAP account <span className="font-mono">{l.soldTo}</span> · {l.currency}</span>} />
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <caption className="sr-only">Customer ledger</caption>
                    <thead>
                      <tr className="border-b border-line bg-canvas/70 text-left text-[11px] uppercase tracking-wide text-muted">
                        <th className="px-4 py-2">Posting date</th><th className="px-3 py-2">Document date</th><th className="px-3 py-2">Document</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-4 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-line bg-canvas/40 font-medium"><td className="px-4 py-2" colSpan={8}>Opening balance at {date(new Date(l.from).toISOString())}</td><td className="px-4 py-2 text-right tabular">{m(l.openingBalance)}</td></tr>
                      {l.entries.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-muted">No postings in this period.</td></tr>}
                      {l.entries.map((e) => {
                        const link = docLink(e.documentNumber, e.type)
                        return (
                          <tr key={e.documentNumber + e.type} className="border-b border-line">
                            <td className="whitespace-nowrap px-4 py-1.5">{date(e.postingDate)}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-muted">{date(e.documentDate)}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[12px]">{link ? <Link to={link} className="text-primary hover:underline">{e.documentNumber}</Link> : e.documentNumber}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11.5px] text-muted">{e.reference || '—'}</td>
                            <td className="px-3 py-1.5">{e.type}</td>
                            <td className="px-3 py-1.5 text-muted">{e.description}</td>
                            <td className="px-3 py-1.5 text-right tabular">{e.debit ? m(e.debit) : ''}</td>
                            <td className="px-3 py-1.5 text-right tabular">{e.credit ? m(e.credit) : ''}</td>
                            <td className="px-4 py-1.5 text-right font-medium tabular">{m(e.balance)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="font-semibold">
                      <tr className="bg-canvas/60"><td className="px-4 py-2" colSpan={6}>Period totals</td><td className="px-3 py-2 text-right tabular">{m(l.totalDebit)}</td><td className="px-3 py-2 text-right tabular">{m(l.totalCredit)}</td><td /></tr>
                      <tr><td className="px-4 py-2" colSpan={8}>Closing balance at {date(new Date(l.to).toISOString())}</td><td className="px-4 py-2 text-right tabular">{m(l.closingBalance)}</td></tr>
                    </tfoot>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12px] text-muted">
                  <span>{l.total} posting(s) · positive balance = amount owed</span>
                  <span className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" icon={<ChevronLeft className="size-4" />} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page" />
                    <span className="px-1 tabular">Page {l.page} of {pages}</span>
                    <Button size="sm" variant="ghost" icon={<ChevronRight className="size-4" />} disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page" />
                  </span>
                </div>
              </Card>
            </>
          )
        }}
      </SapState>
    </div>
  )
}
