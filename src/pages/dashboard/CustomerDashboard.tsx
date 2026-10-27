import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, ClipboardList, FileText, ShoppingCart, Truck } from 'lucide-react'
import { requestTotal, useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/Tabs'
import { SapError, SapSourceBar } from '@/components/sap/SapParts'
import { ProductImage } from '@/components/data-display/ProductImage'
import { StockSourceNote } from '@/components/data-display/StockSourceNote'
import { receiptStatus } from '@/pages/sap/DeliveriesPage'
import { orderStatus } from '@/utils/orderLifecycle'
import { displayStatus } from '@/utils/requestStatus'
import { fromUsd } from '@/utils/fx'
import { date, money, num, relative } from '@/utils/format'
import { cn } from '@/utils/cn'

/** One compact metric inside an overview panel. Links go to the filtered list behind the figure. */
function Metric({ label, value, to, tone, loading }: { label: string; value: ReactNode; to: string; tone?: 'warning' | 'danger' | 'success'; loading?: boolean }) {
  return (
    <Link to={to} className="rounded-md px-2.5 py-2 hover:bg-canvas">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {loading ? <Skeleton className="mt-1 h-5 w-16" /> : <span className={cn('block text-[17px] font-semibold tabular leading-tight', tone === 'warning' && 'text-warning-700', tone === 'danger' && 'text-danger-700', tone === 'success' && 'text-success-700')}>{value}</span>}
    </Link>
  )
}

function Panel({ title, icon, children, footer }: { title: string; icon: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2 text-[13px] font-semibold"><span className="text-muted">{icon}</span>{title}</div>
      <div className="grid grid-cols-2 gap-0.5 p-1.5">{children}</div>
      {footer && <div className="border-t border-line px-3.5 py-1.5 text-[11.5px] text-muted">{footer}</div>}
    </Card>
  )
}

type Recent = 'requests' | 'orders' | 'deliveries' | 'invoices' | 'payments'

export function CustomerDashboard() {
  const scope = useScope()
  const { state } = useStore()
  const lookups = useLookups()
  const customer = scope.customers[0]
  const orders = useSapQuery((ctx) => services.sapData.listSalesOrders(ctx), [])
  const deliveries = useSapQuery((ctx) => services.sapData.listDeliveries(ctx), [])
  const fin = useSapQuery((ctx) => (customer ? services.sapData.getFinancialSummary(ctx, customer.id) : Promise.reject(new Error('no account'))), [customer?.id])
  const invoices = useSapQuery((ctx) => services.sapData.listInvoices(ctx, { pageSize: 5 }), [])
  const payments = useSapQuery((ctx) => services.sapData.listPayments(ctx, { pageSize: 5 }), [])
  const [tab, setTab] = useState<Recent>('requests')
  if (!customer) return null

  const reqs = scope.requests.filter((r) => r.status !== 'Draft')
  const sos = orders.data?.items ?? []
  const dls = deliveries.data?.items ?? []
  const pendingReq = reqs.filter((r) => r.status === 'Pending Approval' || r.status === 'Returned for Clarification').length
  const approvedNoSo = reqs.filter((r) => r.status === 'Approved' && !r.sap?.documentNumber).length
  const activeSo = sos.filter((s) => s.status !== 'Completed' && s.status !== 'Cancelled').length
  const awaitingDelivery = sos.filter((s) => s.deliveryStatus !== 'Fully Delivered' && s.status !== 'Cancelled').length
  const inProcess = dls.filter((d) => d.status === 'In Picking' || d.status === 'Goods Issued').length
  const partial = sos.filter((s) => s.deliveryStatus === 'Partially Delivered').length
  const toConfirm = dls.filter((d) => receiptStatus(d, state.goodsReceipts) === 'Awaiting confirmation').length
  const f = fin.data
  const m = (v: number) => money(v, f?.currency ?? customer.currency, { compact: v >= 100_000 })
  const terr = state.territories.find((t) => t.id === customer.territoryId)
  const products = state.products
    .filter((p) => customer.brandIds.includes(p.brandId) && terr?.visibleBrandIds.includes(p.brandId))
    .sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew) || a.availableQty - b.availableQty)
    .slice(0, 6)

  const recentRows: Record<Recent, { key: string; to: string; ref: ReactNode; meta: string; amount?: string; status: string }[]> = {
    requests: [...reqs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5).map((r) => ({ key: r.id, to: `/app/requests/${r.id}`, ref: r.ref, meta: `${r.lines.length} product(s) · updated ${relative(r.updatedAt)}`, amount: money(requestTotal(r), r.currency), status: displayStatus(r) })),
    orders: sos.slice(0, 5).map((s) => ({ key: s.soNumber, to: `/app/orders/${s.soNumber}`, ref: s.soNumber, meta: `${s.requestRef ?? 'Entered in SAP'} · ${date(s.createdAt)}`, amount: money(s.netValue, s.currency), status: orderStatus(undefined, s, false) })),
    deliveries: dls.slice(0, 5).map((d) => ({ key: d.deliveryNumber, to: `/app/deliveries/${d.deliveryNumber}`, ref: d.deliveryNumber, meta: `${d.soNumber} · ${num(d.items.reduce((s, i) => s + i.qty, 0))} units`, status: receiptStatus(d, state.goodsReceipts) === 'Awaiting confirmation' ? 'Awaiting confirmation' : d.status })),
    invoices: (invoices.data?.items ?? []).map((i) => ({ key: i.invoiceNumber, to: `/app/finance/invoices/${i.invoiceNumber}`, ref: i.invoiceNumber, meta: `${i.type} · ${date(i.invoiceDate)}`, amount: money(i.grossValue, i.currency), status: i.status })),
    payments: (payments.data?.items ?? []).map((p) => ({ key: p.paymentDoc, to: `/app/finance/payments/${p.paymentDoc}`, ref: p.paymentDoc, meta: `${p.reference} · ${date(p.postingDate)}`, amount: money(p.amount, p.currency), status: p.status })),
  }
  const sapError = orders.error ?? deliveries.error

  return (
    <div className="space-y-3">
      <SapSourceBar mode={orders.data?.mode} syncedAt={orders.data?.syncedAt} onRefresh={() => { orders.reload(); deliveries.reload(); fin.reload(); invoices.reload(); payments.reload() }} loading={orders.loading} />
      {sapError && <Card><SapError error={sapError} onRetry={orders.reload} /></Card>}
      <div className="grid gap-3 md:grid-cols-3">
        <Panel title="Sales" icon={<ShoppingCart className="size-4" />} footer={<Link to="/app/requests/new" className="font-medium text-primary hover:underline">Create sales request</Link>}>
          <Metric label="Pending requests" value={pendingReq} to="/app/requests" tone={pendingReq ? 'warning' : undefined} />
          <Metric label="Approved, awaiting SAP" value={approvedNoSo} to="/app/orders" />
          <Metric label="Active sales orders" value={activeSo} to="/app/orders" loading={orders.loading && !orders.data} />
          <Metric label="Awaiting delivery" value={awaitingDelivery} to="/app/orders" loading={orders.loading && !orders.data} />
        </Panel>
        <Panel title="Deliveries" icon={<Truck className="size-4" />} footer={toConfirm ? <Link to="/app/deliveries" className="font-medium text-primary hover:underline">Confirm {toConfirm} receipt(s)</Link> : 'All delivered goods confirmed'}>
          <Metric label="In process" value={inProcess} to="/app/deliveries" loading={deliveries.loading && !deliveries.data} />
          <Metric label="Partially delivered orders" value={partial} to="/app/orders" loading={orders.loading && !orders.data} />
          <Metric label="Receipts to confirm" value={toConfirm} to="/app/deliveries" tone={toConfirm ? 'warning' : undefined} loading={deliveries.loading && !deliveries.data} />
          <Metric label="Delivered (all time)" value={dls.filter((d) => d.status === 'Delivered').length} to="/app/deliveries" loading={deliveries.loading && !deliveries.data} />
        </Panel>
        <Panel title="Finance" icon={<Banknote className="size-4" />} footer={f ? <>Read from SAP {relative(f.syncedAt)}{f.unallocatedPayments > 0 && <> · {m(f.unallocatedPayments)} received, not yet allocated</>}</> : fin.error ? fin.error.message : 'Loading…'}>
          <Metric label="Total outstanding" value={f ? m(f.totalOutstanding) : '—'} to="/app/finance/outstanding" loading={fin.loading && !f} />
          <Metric label="Overdue" value={f ? m(f.totalOverdue) : '—'} to="/app/finance/aging" tone={f?.totalOverdue ? 'danger' : 'success'} loading={fin.loading && !f} />
          <Metric label="Open invoices" value={f ? `${f.openInvoices}${f.partiallyPaidInvoices ? ` · ${f.partiallyPaidInvoices} part-paid` : ''}` : '—'} to="/app/finance/open-invoices" loading={fin.loading && !f} />
          <Metric label={`Payments (${f?.recentPayments.days ?? 30} days)`} value={f ? m(f.recentPayments.amount) : '—'} to="/app/finance/payments" loading={fin.loading && !f} />
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <Tabs<Recent>
            className="px-3"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'requests', label: 'Sales requests' },
              { key: 'orders', label: 'Sales orders' },
              { key: 'deliveries', label: 'Deliveries' },
              { key: 'invoices', label: 'Invoices' },
              { key: 'payments', label: 'Payments' },
            ]}
          />
          {recentRows[tab].length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{tab === 'requests' ? 'No sales requests yet' : `No ${tab} yet`}</p>
              <p className="mt-1 text-xs text-muted">{tab === 'requests' ? 'Browse the catalogue and create your first request.' : tab === 'orders' ? 'Approved requests become SAP sales orders.' : tab === 'deliveries' ? 'Deliveries appear when SAP ships an order.' : tab === 'invoices' ? 'SAP invoices appear after billing.' : 'Payments appear once SAP posts them.'}</p>
              {tab === 'requests' && <ButtonLink to="/app/requests/new" size="sm" className="mt-3">Create sales request</ButtonLink>}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recentRows[tab].map((r) => (
                <li key={r.key}>
                  <Link to={r.to} className="block px-4 py-2 hover:bg-canvas">
                    <span className="flex items-center justify-between gap-3"><span className="font-mono text-[12px] font-semibold">{r.ref}</span><StatusBadge status={r.status} /></span>
                    <span className="mt-0.5 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-muted">{r.meta}</span>{r.amount && <span className="shrink-0 text-[13px] font-semibold tabular text-ink">{r.amount}</span>}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={customer.name} description={`${customer.code} · ${terr?.name ?? ''}`} />
          <div className="space-y-1.5 px-4 pb-3 pt-2 text-[13px]">
            <div className="flex justify-between gap-3"><span className="text-muted">Account manager</span><span className="text-right">{lookups.user(terr?.managerId)?.name ?? '—'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Payment terms</span><span className="text-right">{customer.paymentTerms}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Currency</span><span>{customer.currency}</span></div>
            {f?.credit && <div className="flex justify-between gap-3"><span className="text-muted">Available credit (SAP)</span><span className="tabular">{m(f.credit.available)}</span></div>}
            <div className="flex justify-between gap-3"><span className="text-muted">SAP account</span><span className="font-mono text-xs">{customer.sapBusinessPartner ?? 'Not linked yet'}</span></div>
            <Link to="/app/account" className="inline-block pt-1 text-[13px] font-medium text-primary hover:underline">Business profile</Link>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Catalogue & stock" description="Your authorised brands" actions={<span className="flex items-center gap-3"><StockSourceNote /><Link to="/app/catalog" className="text-[13px] font-medium text-primary hover:underline">Open catalogue</Link></span>} />
        <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-3">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-line px-4 py-2 sm:border-b">
              <ProductImage product={p} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{p.name}</span>
                <span className="block text-[11px] text-muted"><span className="font-mono">{p.sku}</span> · {money(fromUsd(p.unitPriceUsd, customer.currency), customer.currency)} / {p.uom}</span>
              </span>
              <span className="text-right"><StatusBadge status={p.stockStatus} /><span className="block text-[11px] text-muted tabular">{num(p.availableQty)} {p.stockUom}</span></span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted"><ClipboardList className="size-3.5" />Sales requests are TradeFlow records; orders, deliveries, invoices and payments are read from SAP. <FileText className="size-3.5" />Proforma requests and payment advice remain under Finance.</p>
    </div>
  )
}
