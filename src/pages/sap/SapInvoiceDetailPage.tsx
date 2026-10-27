import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FileDown } from 'lucide-react'
import { useLookups } from '@/app/store'
import { useSapAccess, useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { KeyValue, Notice } from '@/components/ui/misc'
import { SapSourceBar, SapState } from '@/components/sap/SapParts'
import { date, money, num } from '@/utils/format'

export default function SapInvoiceDetailPage() {
  const { inv = '' } = useParams()
  const lookups = useLookups()
  const ctx = useSapAccess()
  const q = useSapQuery((c) => services.sapData.getInvoice(c, inv), [inv])
  const [doc, setDoc] = useState<string>()
  const [docBusy, setDocBusy] = useState(false)

  const openDocument = async () => {
    setDocBusy(true)
    try {
      const r = await services.sapData.getInvoiceDocument(ctx, inv)
      if (r.available) window.open(r.url, '_blank', 'noopener')
      else setDoc(r.reason)
    } catch (e) {
      setDoc(e instanceof Error ? e.message : 'The document could not be retrieved.')
    } finally {
      setDocBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{inv}</span>}
        meta={q.data && <StatusBadge status={q.data.invoice.status} />}
        description={q.data ? <>{q.data.invoice.type} · {lookups.customer(q.data.invoice.customerId)?.name} · {date(q.data.invoice.invoiceDate)}</> : 'SAP billing document'}
        breadcrumbs={[{ label: 'Invoices', to: '/app/finance/invoices' }, { label: inv }]}
        actions={<Button variant="secondary" icon={<FileDown className="size-4" />} loading={docBusy} onClick={openDocument}>Official document (PDF)</Button>}
      />
      {doc && <Notice tone="info" className="mb-4" title="Official document not available">{doc}</Notice>}
      <SapState q={q} rows={6}>
        {({ invoice: i, mode, syncedAt }) => (
          <div className="space-y-4">
            <SapSourceBar mode={mode} syncedAt={syncedAt} onRefresh={q.reload} loading={q.loading} />
            <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
              <div className="min-w-0 space-y-4">
                <Card>
                  <CardHeader title="Line items" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-line bg-canvas/70 text-left text-[11px] uppercase tracking-wide text-muted"><th className="px-4 py-2">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit price</th><th className="px-3 py-2 text-right">Net</th><th className="px-3 py-2 text-right">Tax</th><th className="px-4 py-2 text-right">Total</th></tr>
                      </thead>
                      <tbody>
                        {i.items.map((it) => (
                          <tr key={it.itemNo} className="border-b border-line">
                            <td className="px-4 py-2"><span className="font-medium">{it.description}</span>{it.material && <span className="block font-mono text-[11px] text-muted">SAP {it.material}</span>}</td>
                            <td className="px-3 py-2 text-right tabular">{num(it.qty)} <span className="text-[11px] text-muted">{it.uom}</span></td>
                            <td className="px-3 py-2 text-right tabular">{money(it.unitPrice, i.currency)}</td>
                            <td className="px-3 py-2 text-right tabular">{money(it.netValue, i.currency)}</td>
                            <td className="px-3 py-2 text-right tabular text-muted">{money(it.taxValue, i.currency)}<span className="block text-[10.5px]">{it.taxRate}%</span></td>
                            <td className="px-4 py-2 text-right font-medium tabular">{money(it.netValue + it.taxValue, i.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="text-[13px]">
                        <tr><td colSpan={5} className="px-4 pt-2 text-right text-muted">Net</td><td className="px-4 pt-2 text-right tabular">{money(i.netValue, i.currency)}</td></tr>
                        <tr><td colSpan={5} className="px-4 text-right text-muted">Tax</td><td className="px-4 text-right tabular">{money(i.taxValue, i.currency)}</td></tr>
                        <tr><td colSpan={5} className="px-4 pb-2 text-right font-semibold">Invoice total</td><td className="px-4 pb-2 text-right font-semibold tabular">{money(i.grossValue, i.currency)}</td></tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
                <Card>
                  <CardHeader title={i.type === 'Invoice' ? 'Payments and credits applied' : 'Applied to'} description="Clearing recorded in SAP accounting" />
                  {i.allocations.length === 0 ? (
                    <p className="px-4 py-4 text-[13px] text-muted">{i.status === 'Cancelled' ? `Cancelled in SAP by ${i.cancelledBy} on ${date(i.cancelledAt)}.` : 'No payment has been allocated to this invoice yet. Payments you sent appear here once SAP posts and allocates them.'}</p>
                  ) : (
                    <ul className="divide-y divide-line text-[13px]">
                      {i.allocations.map((a) => (
                        <li key={a.document} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                          <span>
                            {a.type === 'Payment' ? <Link to={`/app/finance/payments/${a.document}`} className="font-mono text-primary hover:underline">{a.document}</Link> : <Link to={`/app/finance/invoices/${a.document}`} className="font-mono text-primary hover:underline">{a.document}</Link>}
                            <span className="ml-2 text-xs text-muted">{a.type} · {date(a.date)}</span>
                          </span>
                          <span className="tabular">{money(a.amount, i.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
              <div className="space-y-4">
                <Card>
                  <CardHeader title="Amounts" />
                  <CardBody className="space-y-1.5 text-[13px]">
                    <div className="flex justify-between"><span className="text-muted">Invoice amount</span><span className="tabular">{money(i.grossValue, i.currency)}</span></div>
                    {i.type === 'Invoice' && (
                      <>
                        <div className="flex justify-between"><span className="text-muted">Paid</span><span className="tabular">{money(i.amountPaid, i.currency)}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Credits applied</span><span className="tabular">{money(i.creditsApplied, i.currency)}</span></div>
                        <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Outstanding</span><span className="tabular">{money(i.outstanding, i.currency)}</span></div>
                        {i.daysOverdue > 0 && <p className="text-xs font-medium text-danger-700">{i.daysOverdue} days overdue</p>}
                      </>
                    )}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Details" />
                  <CardBody>
                    <KeyValue
                      cols={1}
                      items={[
                        { label: 'Invoice date', value: date(i.invoiceDate) },
                        { label: 'Due date', value: i.type === 'Invoice' ? date(i.dueDate) : '—' },
                        { label: 'Payment terms', value: i.paymentTerms },
                        { label: 'Currency', value: i.currency },
                        { label: 'Sales order', value: i.soNumber ? <Link className="font-mono text-primary hover:underline" to={`/app/orders/${i.soNumber}`}>{i.soNumber}</Link> : '—' },
                        { label: 'Delivery', value: i.deliveryNumber ? <Link className="font-mono text-primary hover:underline" to={`/app/deliveries/${i.deliveryNumber}`}>{i.deliveryNumber}</Link> : '—' },
                        { label: 'Reference', value: i.customerReference ?? '—' },
                      ]}
                    />
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        )}
      </SapState>
    </>
  )
}
