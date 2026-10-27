import { Link, useParams } from 'react-router-dom'
import { ClipboardList, FileText, Truck } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, KeyValue } from '@/components/ui/misc'
import { ProgressSteps, type StepItem } from '@/components/data-display/Timeline'
import { ProductImage } from '@/components/data-display/ProductImage'
import { SapSourceBar, SapState } from '@/components/sap/SapParts'
import { date, money, num } from '@/utils/format'
import type { GoodsReceiptAck, SalesOrderRequest } from '@/types/domain'
import type { SapDeliveryView, SapInvoiceView, SapSalesOrder } from '@/types/sap'

export function lifecycleSteps(so: SapSalesOrder | undefined, request: SalesOrderRequest | undefined, deliveries: SapDeliveryView[], invoices: SapInvoiceView[], receipts: GoodsReceiptAck[]): StepItem[] {
  const issued = deliveries.filter((d) => d.status === 'Goods Issued' || d.status === 'Delivered')
  const acked = issued.filter((d) => receipts.some((g) => g.deliveryNumber === d.deliveryNumber))
  const bills = invoices.filter((i) => i.type === 'Invoice' && i.status !== 'Cancelled')
  const paid = bills.filter((i) => i.status === 'Paid')
  const st = (done: boolean, started: boolean): StepItem['state'] => (done ? 'done' : started ? 'current' : 'upcoming')
  const failed = !so && request?.sap?.status === 'SAP Creation Failed'
  return [
    { label: request ? 'Request submitted' : 'Order entered in SAP', state: 'done', sub: request ? date(request.createdAt) : undefined },
    { label: 'Approved', state: so || request?.status === 'Approved' ? 'done' : request?.status === 'Rejected' || request?.status === 'Cancelled' ? 'blocked' : 'current', sub: request && !so && request.status !== 'Approved' ? request.status : undefined },
    { label: 'Sales order created', state: so ? 'done' : failed ? 'blocked' : request?.status === 'Approved' ? 'current' : 'upcoming', sub: so ? so.soNumber : undefined },
    { label: 'Delivered', state: !so ? 'upcoming' : st(so.deliveryStatus === 'Fully Delivered', issued.length > 0 || deliveries.length > 0), sub: so && deliveries.length ? `${deliveries.length} deliver${deliveries.length === 1 ? 'y' : 'ies'}` : undefined },
    { label: 'Receipt confirmed', state: !issued.length ? 'upcoming' : st(acked.length === issued.length && so?.deliveryStatus === 'Fully Delivered', acked.length > 0 || issued.length > 0), sub: issued.length ? `${acked.length}/${issued.length}` : undefined },
    { label: 'Invoiced', state: !so ? 'upcoming' : st(so.billingStatus === 'Fully Billed', bills.length > 0), sub: bills.length ? `${bills.length} invoice${bills.length === 1 ? '' : 's'}` : undefined },
    { label: 'Paid', state: !bills.length ? 'upcoming' : st(paid.length === bills.length && so?.billingStatus === 'Fully Billed', paid.length > 0 || bills.some((b) => b.amountPaid > 0)), sub: bills.length ? `${paid.length}/${bills.length}` : undefined },
  ]
}

export default function SalesOrderDetailPage() {
  const { so: soNumber = '' } = useParams()
  const { state, user } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const q = useSapQuery((ctx) => services.sapData.getSalesOrder(ctx, soNumber), [soNumber])
  const internal = user.kind === 'internal'

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{soNumber}</span>}
        meta={q.data && <span className="flex flex-wrap gap-1.5"><StatusBadge status={q.data.order.status === 'Open' ? 'Sales Order Created' : q.data.order.status} /></span>}
        description={q.data ? <>SAP sales order · {lookups.customer(q.data.order.customerId)?.name} · created {date(q.data.order.createdAt)}</> : 'SAP sales order'}
        breadcrumbs={[{ label: 'Sales orders', to: '/app/orders' }, { label: soNumber }]}
      />
      <SapState q={q} rows={8}>
        {({ order: so, deliveries, invoices, mode, syncedAt }) => {
          const request = so.requestRef ? scope.requests.find((r) => r.ref === so.requestRef) : undefined
          const receipts = state.goodsReceipts.filter((g) => g.soNumber === so.soNumber)
          return (
            <div className="space-y-4">
              <SapSourceBar mode={mode} syncedAt={syncedAt} onRefresh={q.reload} loading={q.loading} />
              <Card><CardBody><ProgressSteps steps={lifecycleSteps(so, request, deliveries, invoices, receipts)} /></CardBody></Card>
              <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
                <div className="min-w-0 space-y-4">
                  <Card>
                    <CardHeader title="Items" description="Ordered, confirmed, delivered and billed quantities as recorded in SAP" />
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="border-b border-line bg-canvas/70 text-left text-[11px] uppercase tracking-wide text-muted">
                            <th className="px-4 py-2">Product</th><th className="px-3 py-2 text-right">Ordered</th><th className="px-3 py-2 text-right">Confirmed</th><th className="px-3 py-2 text-right">Delivered</th><th className="px-3 py-2 text-right">Billed</th><th className="px-3 py-2 text-right">Net price</th><th className="px-4 py-2 text-right">Net value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {so.items.map((it) => {
                            const p = lookups.product(it.productId)
                            return (
                              <tr key={it.itemNo} className="border-b border-line">
                                <td className="px-4 py-2"><span className="flex items-center gap-2.5">{p && <ProductImage product={p} size="xs" />}<span><span className="font-medium">{it.description}</span><span className="block font-mono text-[11px] text-muted">{p?.sku} · SAP {it.material}</span></span></span></td>
                                <td className="px-3 py-2 text-right tabular">{num(it.orderedQty)} <span className="text-[11px] text-muted">{it.uom}</span></td>
                                <td className={`px-3 py-2 text-right tabular ${it.confirmedQty < it.orderedQty ? 'text-warning-700' : ''}`}>{num(it.confirmedQty)}</td>
                                <td className="px-3 py-2 text-right tabular">{num(it.deliveredQty)}</td>
                                <td className="px-3 py-2 text-right tabular">{num(it.billedQty)}</td>
                                <td className="px-3 py-2 text-right tabular">{money(it.netPrice, so.currency)}</td>
                                <td className="px-4 py-2 text-right font-medium tabular">{money(it.netValue, so.currency)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="Deliveries" description="Outbound deliveries posted in SAP" icon={<Truck className="size-4" />} />
                    {deliveries.length === 0 ? (
                      <EmptyState icon={<Truck className="size-5" />} title="No delivery yet" description="Deliveries appear here once SAP creates them for this order." />
                    ) : (
                      <ul className="divide-y divide-line">
                        {deliveries.map((d) => {
                          const ack = receipts.find((g) => g.deliveryNumber === d.deliveryNumber)
                          return (
                            <li key={d.deliveryNumber}>
                              <Link to={`/app/deliveries/${d.deliveryNumber}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 hover:bg-canvas">
                                <span className="w-36 font-mono text-[12px] font-semibold">{d.deliveryNumber}</span>
                                <span className="flex-1 text-xs text-muted">{d.items.reduce((s, i) => s + i.qty, 0).toLocaleString()} units · {d.goodsIssueDate ? `goods issued ${date(d.goodsIssueDate)}` : `planned ${date(d.plannedDate)}`}</span>
                                <StatusBadge status={d.status} />
                                <StatusBadge status={ack ? ack.outcome : d.status === 'In Picking' ? 'Not yet shipped' : 'Awaiting confirmation'} />
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </Card>
                  <Card>
                    <CardHeader title="Invoices" description="Billing documents created in SAP" icon={<FileText className="size-4" />} />
                    {invoices.length === 0 ? (
                      <EmptyState icon={<FileText className="size-5" />} title="Not invoiced yet" description="SAP creates invoices according to the billing process; they appear here when posted." />
                    ) : (
                      <ul className="divide-y divide-line">
                        {invoices.map((i) => (
                          <li key={i.invoiceNumber}>
                            <Link to={`/app/finance/invoices/${i.invoiceNumber}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 hover:bg-canvas">
                              <span className="w-36 font-mono text-[12px] font-semibold">{i.invoiceNumber}</span>
                              <span className="flex-1 text-xs text-muted">{i.type} · {date(i.invoiceDate)}{i.type === 'Invoice' ? ` · due ${date(i.dueDate)}` : ''}</span>
                              <span className="text-[13px] font-medium tabular">{money(i.grossValue, i.currency)}</span>
                              <StatusBadge status={i.status} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
                <div className="space-y-4">
                  <Card>
                    <CardHeader title="Order" />
                    <CardBody>
                      <KeyValue
                        cols={1}
                        items={[
                          { label: 'TradeFlow request', value: request ? <Link className="font-mono text-primary hover:underline" to={`/app/requests/${request.id}`}>{request.ref}</Link> : so.requestRef ?? 'Entered directly in SAP' },
                          { label: 'Request approval', value: request ? <StatusBadge status={request.status === 'Pending Approval' ? 'Pending Approval' : 'Approved'} /> : '—' },
                          { label: 'SAP sales order', value: <span className="font-mono">{so.soNumber}</span> },
                          { label: 'SAP order status', value: <StatusBadge status={so.status === 'Open' ? 'Sales Order Created' : so.status} /> },
                          { label: 'Created in SAP', value: date(so.createdAt) },
                          { label: 'Customer reference / PO', value: so.customerReference ?? '—' },
                          { label: 'Ship-to', value: so.shipTo },
                          { label: 'Payment terms', value: so.paymentTerms },
                          ...(internal ? [{ label: 'Sold-to BP (SAP)', value: <span className="font-mono">{so.soldTo}</span> }, { label: 'Idempotency key', value: <span className="font-mono text-xs">{so.idempotencyKey ?? '—'}</span> }] : []),
                        ]}
                      />
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader title="Order value (SAP)" />
                    <CardBody className="space-y-1.5 text-[13px]">
                      <div className="flex justify-between"><span className="text-muted">Net value</span><span className="tabular">{money(so.netValue, so.currency)}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Tax</span><span className="tabular">{money(so.taxValue, so.currency)}</span></div>
                      <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Total</span><span className="tabular">{money(so.netValue + so.taxValue, so.currency)}</span></div>
                    </CardBody>
                  </Card>
                  {request && <ButtonLink to={`/app/requests/${request.id}`} variant="secondary" icon={<ClipboardList className="size-4" />}>Open TradeFlow request</ButtonLink>}
                </div>
              </div>
            </div>
          )
        }}
      </SapState>
    </>
  )
}
