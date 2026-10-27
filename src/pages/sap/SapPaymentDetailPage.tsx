import { Link, useParams } from 'react-router-dom'
import { useLookups } from '@/app/store'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { KeyValue } from '@/components/ui/misc'
import { SapSourceBar, SapState } from '@/components/sap/SapParts'
import { date, money } from '@/utils/format'

export default function SapPaymentDetailPage() {
  const { doc = '' } = useParams()
  const lookups = useLookups()
  const q = useSapQuery((ctx) => services.sapData.getPayment(ctx, doc), [doc])
  return (
    <>
      <PageHeader
        title={<span className="font-mono">{doc}</span>}
        meta={q.data && <StatusBadge status={q.data.payment.status} />}
        description={q.data ? <>Payment posted in SAP · {lookups.customer(q.data.payment.customerId)?.name}</> : 'SAP payment'}
        breadcrumbs={[{ label: 'Payments', to: '/app/finance/payments' }, { label: doc }]}
      />
      <SapState q={q} rows={5}>
        {({ payment: p, invoices, mode, syncedAt }) => (
          <div className="space-y-4">
            <SapSourceBar mode={mode} syncedAt={syncedAt} onRefresh={q.reload} loading={q.loading} />
            <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
              <Card>
                <CardHeader title="Applied to invoices" description="Allocation (clearing) recorded in SAP" />
                {p.allocations.length === 0 ? (
                  <p className="px-4 py-4 text-[13px] text-muted">This payment has not been allocated to an invoice yet. It reduces your account balance but no specific invoice shows it as paid until SAP clears it.</p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead><tr className="border-b border-line bg-canvas/70 text-left text-[11px] uppercase tracking-wide text-muted"><th className="px-4 py-2">Invoice</th><th className="px-3 py-2 text-right">Allocated</th><th className="px-3 py-2 text-right">Invoice outstanding now</th><th className="px-4 py-2">Invoice status</th></tr></thead>
                    <tbody>
                      {p.allocations.map((a) => {
                        const inv = invoices.find((i) => i.invoiceNumber === a.invoiceNumber)
                        return (
                          <tr key={a.invoiceNumber} className="border-b border-line">
                            <td className="px-4 py-2"><Link to={`/app/finance/invoices/${a.invoiceNumber}`} className="font-mono text-[12px] text-primary hover:underline">{a.invoiceNumber}</Link></td>
                            <td className="px-3 py-2 text-right tabular">{money(a.amount, p.currency)}</td>
                            <td className="px-3 py-2 text-right tabular">{inv ? money(inv.outstanding, p.currency) : '—'}</td>
                            <td className="px-4 py-2">{inv && <StatusBadge status={inv.status} />}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
              <Card>
                <CardHeader title="Payment" />
                <CardBody>
                  <KeyValue cols={1} items={[
                    { label: 'Amount', value: <span className="font-semibold tabular">{money(p.amount, p.currency)}</span> },
                    { label: 'Allocated', value: money(p.allocated, p.currency) },
                    { label: 'Unallocated', value: money(p.unallocated, p.currency) },
                    { label: 'Payment date', value: date(p.paymentDate) },
                    { label: 'Posting date (SAP)', value: date(p.postingDate) },
                    { label: 'Reference', value: p.reference },
                    { label: 'Method', value: p.method },
                  ]} />
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </SapState>
    </>
  )
}
