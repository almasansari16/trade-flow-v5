import { Link } from 'react-router-dom'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { KpiStrip } from '@/components/data-display/KpiStrip'
import { SapSourceBar, SapState } from '@/components/sap/SapParts'
import { date, money } from '@/utils/format'
import { AccountReport } from './AccountReport'

export default function OutstandingPage() {
  return (
    <AccountReport title="Outstanding report" crumb="Outstanding report" description="Amounts currently payable on the account, per invoice, from SAP open items.">
      {(customerId) => <Outstanding customerId={customerId} />}
    </AccountReport>
  )
}

function Outstanding({ customerId }: { customerId: string }) {
  const q = useSapQuery((ctx) => services.sapData.getOutstanding(ctx, customerId), [customerId])
  return (
    <SapState q={q} rows={6}>
      {(r) => {
        const m = (v: number) => money(v, r.currency)
        return (
          <div className="space-y-3">
            <SapSourceBar mode={r.mode} syncedAt={r.syncedAt} onRefresh={q.reload} loading={q.loading} extra={<span>Reporting date {date(r.asOf)}</span>} />
            <KpiStrip
              className="lg:grid-cols-5"
              items={[
                { key: 'out', label: 'Total outstanding', value: m(r.totals.outstanding), tone: 'primary', hint: `${r.lines.length} open invoice(s)` },
                { key: 'cur', label: 'Current (not yet due)', value: m(r.totals.current), tone: 'success' },
                { key: 'over', label: 'Overdue', value: m(r.totals.overdue), tone: 'danger' },
                { key: 'un', label: 'Unallocated payments', value: m(r.unallocatedPayments), tone: 'neutral', hint: 'Received, not yet applied' },
                { key: 'net', label: 'Net balance', value: m(r.netBalance), tone: 'info', hint: 'Matches the ledger balance' },
              ]}
            />
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <caption className="sr-only">Outstanding invoices</caption>
                  <thead>
                    <tr className="border-b border-line bg-canvas/70 text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-4 py-2">Invoice</th><th className="px-3 py-2">Invoice date</th><th className="px-3 py-2">Due date</th><th className="px-3 py-2 text-right">Original</th><th className="px-3 py-2 text-right">Payments & credits</th><th className="px-3 py-2 text-right">Outstanding</th><th className="px-3 py-2 text-right">Days outstanding</th><th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Nothing outstanding on this account.</td></tr>}
                    {r.lines.map((l) => (
                      <tr key={l.invoiceNumber} className="border-b border-line">
                        <td className="px-4 py-2"><Link to={`/app/finance/invoices/${l.invoiceNumber}`} className="font-mono text-[12px] font-semibold text-primary hover:underline">{l.invoiceNumber}</Link></td>
                        <td className="whitespace-nowrap px-3 py-2">{date(l.invoiceDate)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{date(l.dueDate)}</td>
                        <td className="px-3 py-2 text-right tabular">{m(l.original)}</td>
                        <td className="px-3 py-2 text-right tabular text-muted">{m(l.applied)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular">{m(l.outstanding)}</td>
                        <td className="px-3 py-2 text-right tabular">{l.daysOutstanding}</td>
                        <td className="px-4 py-2"><StatusBadge status={l.overdue ? 'Overdue' : 'Current'} /></td>
                      </tr>
                    ))}
                  </tbody>
                  {r.lines.length > 0 && (
                    <tfoot className="font-semibold">
                      <tr className="bg-canvas/60">
                        <td className="px-4 py-2" colSpan={3}>Total ({r.currency})</td>
                        <td className="px-3 py-2 text-right tabular">{m(r.totals.original)}</td>
                        <td className="px-3 py-2 text-right tabular">{m(r.totals.applied)}</td>
                        <td className="px-3 py-2 text-right tabular">{m(r.totals.outstanding)}</td>
                        <td colSpan={2} />
                      </tr>
                      {r.unallocatedPayments > 0 && (
                        <tr className="font-normal text-muted">
                          <td className="px-4 py-1.5" colSpan={5}>Less payments on account not yet allocated to invoices</td>
                          <td className="px-3 py-1.5 text-right tabular">−{m(r.unallocatedPayments)}</td>
                          <td colSpan={2} />
                        </tr>
                      )}
                      <tr><td className="px-4 py-2" colSpan={5}>Net balance</td><td className="px-3 py-2 text-right tabular">{m(r.netBalance)}</td><td colSpan={2} /></tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </div>
        )
      }}
    </SapState>
  )
}
