import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ShoppingCart } from 'lucide-react'
import { requestTotal, useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { useSapQuery } from '@/hooks/useSap'
import { services } from '@/services'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/misc'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { KpiStrip } from '@/components/data-display/KpiStrip'
import { SapError, SapSourceBar } from '@/components/sap/SapParts'
import { orderStatus } from '@/utils/orderLifecycle'
import { date, money } from '@/utils/format'
import type { SalesOrderRequest } from '@/types/domain'
import type { SapSalesOrder } from '@/types/sap'

interface Row {
  key: string
  request?: SalesOrderRequest
  so?: SapSalesOrder
  customerId: string
  date: string
  value: number
  currency: SalesOrderRequest['currency']
  status: string
  delivery: string
  billing: string
}

const STATUSES = ['Pending Approval', 'Returned for Clarification', 'Pending SAP Creation', 'SAP Creation Failed', 'Sales Order Created', 'In Process', 'Partially Delivered', 'Fully Delivered', 'Completed', 'Cancelled']

/**
 * Sales Orders: every order of the accounts in scope — portal requests on their way to SAP,
 * and SAP sales orders (including orders entered directly in SAP). SAP is the source for order,
 * delivery and billing status once an order exists there.
 */
export default function SalesOrdersPage() {
  const { user } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const navigate = useNavigate()
  const internal = user.kind === 'internal'
  const q = useSapQuery((ctx) => services.sapData.listSalesOrders(ctx), [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [customer, setCustomer] = useState('')
  const [kpi, setKpi] = useState('')

  const rows = useMemo<Row[]>(() => {
    const sos = q.data?.items ?? []
    const byRef = new Map(sos.filter((s) => s.requestRef).map((s) => [s.requestRef!, s]))
    const fromRequests: Row[] = scope.requests
      .filter((r) => !['Draft', 'Rejected'].includes(r.status))
      .map((r) => {
        const so = byRef.get(r.ref)
        return {
          key: r.id, request: r, so, customerId: r.customerId, date: so?.createdAt ?? r.createdAt, value: so ? so.netValue : requestTotal(r), currency: r.currency,
          status: orderStatus(r, so, internal), delivery: so?.deliveryStatus ?? '—', billing: so?.billingStatus ?? '—',
        }
      })
    const sapOnly: Row[] = sos
      .filter((s) => !s.requestRef || !scope.requests.some((r) => r.ref === s.requestRef))
      .map((s) => ({ key: s.soNumber, so: s, customerId: s.customerId, date: s.createdAt, value: s.netValue, currency: s.currency, status: orderStatus(undefined, s, internal), delivery: s.deliveryStatus, billing: s.billingStatus }))
    return [...fromRequests, ...sapOnly]
  }, [q.data, scope.requests, internal])

  const KPI: Record<string, (r: Row) => boolean> = {
    approval: (r) => r.status === 'Pending Approval' || r.status === 'Returned for Clarification',
    sap: (r) => r.status === 'Pending SAP Creation' || r.status === 'SAP Creation Failed',
    active: (r) => ['Sales Order Created', 'In Process', 'Partially Delivered'].includes(r.status),
    awaiting: (r) => !!r.so && r.so.deliveryStatus !== 'Fully Delivered' && r.so.status !== 'Cancelled',
    completed: (r) => r.status === 'Completed' || r.status === 'Fully Delivered',
  }
  const filtered = rows.filter(
    (r) =>
      (!kpi || KPI[kpi]!(r)) &&
      (!status || r.status === status) &&
      (!customer || r.customerId === customer) &&
      (!search || `${r.request?.ref ?? ''} ${r.so?.soNumber ?? ''} ${r.request?.customerPo ?? r.so?.customerReference ?? ''} ${lookups.customer(r.customerId)?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())),
  )
  const open = (r: Row) => navigate(r.so ? `/app/orders/${r.so.soNumber}` : `/app/requests/${r.request!.id}`)

  const columns: Column<Row>[] = [
    { key: 'ref', header: 'TradeFlow request', primary: true, sortValue: (r) => r.request?.ref ?? '', cell: (r) => (r.request ? <span className="whitespace-nowrap font-mono text-[12px] font-semibold">{r.request.ref}</span> : <span className="text-[12px] text-muted">Entered in SAP</span>) },
    { key: 'so', header: 'SAP sales order', sortValue: (r) => r.so?.soNumber ?? '', cell: (r) => (r.so ? <span className="whitespace-nowrap font-mono text-[12px]">{r.so.soNumber}</span> : <span className="text-muted">—</span>) },
    ...(internal ? [{ key: 'customer', header: 'Customer', sortValue: (r: Row) => lookups.customer(r.customerId)?.name ?? '', cell: (r: Row) => <span className="font-medium">{lookups.customer(r.customerId)?.name}</span> } as Column<Row>] : []),
    { key: 'date', header: 'Order date', sortValue: (r) => r.date, cell: (r) => <span className="whitespace-nowrap">{date(r.date)}</span> },
    { key: 'status', header: 'Order status', sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'value', header: 'Order value', align: 'right', sortValue: (r) => r.value, cell: (r) => <span className="whitespace-nowrap font-medium tabular">{money(r.value, r.currency)}<span className="block text-[10.5px] font-normal text-muted">{r.so ? 'net · SAP' : 'estimated'}</span></span> },
    { key: 'delivery', header: 'Delivery', hideOnMobile: true, cell: (r) => (r.so ? <StatusBadge status={r.delivery} /> : <span className="text-muted">—</span>) },
    { key: 'billing', header: 'Invoice', hideOnMobile: true, cell: (r) => (r.so ? <StatusBadge status={r.billing} /> : <span className="text-muted">—</span>) },
    { key: 'go', header: <span className="sr-only">Actions</span>, align: 'right', cell: () => <span className="inline-flex items-center text-[12px] font-medium text-primary">Open<ChevronRight className="size-3.5" /></span> },
  ]

  const count = (k: string) => rows.filter(KPI[k]!).length
  return (
    <>
      <PageHeader
        title="Sales orders"
        description={internal ? 'Orders of the customer accounts in your scope — from approval through SAP order, delivery and billing.' : 'Your orders from approval through SAP order, delivery and invoicing.'}
        breadcrumbs={[{ label: 'Sales' }, { label: 'Sales orders' }]}
        meta={<SapSourceBar mode={q.data?.mode} syncedAt={q.data?.syncedAt} onRefresh={q.reload} loading={q.loading} />}
      />
      <KpiStrip
        active={kpi}
        onSelect={setKpi}
        className="lg:grid-cols-5"
        items={[
          { key: 'approval', label: 'Pending approval', value: count('approval'), tone: 'warning' },
          { key: 'sap', label: 'Pending SAP creation', value: count('sap'), tone: 'info' },
          { key: 'active', label: 'Active sales orders', value: count('active'), tone: 'primary' },
          { key: 'awaiting', label: 'Awaiting delivery', value: count('awaiting'), tone: 'neutral' },
          { key: 'completed', label: 'Delivered / completed', value: count('completed'), tone: 'success' },
        ]}
      />
      <Card>
        <FilterBar active={!!(search || status || customer || kpi)} onReset={() => { setSearch(''); setStatus(''); setCustomer(''); setKpi('') }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Request, SAP order or PO…" className="w-full sm:w-64" label="Search orders" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUSES.filter((s) => internal || s !== 'SAP Creation Failed').map((s) => ({ value: s, label: s }))} />
          {internal && <FilterSelect label="Customer" value={customer} onChange={setCustomer} options={scope.customers.map((c) => ({ value: c.id, label: c.name }))} />}
        </FilterBar>
        {q.error && <SapError error={q.error} onRetry={q.reload} />}
        <DataTable
          key={kpi}
          rows={filtered}
          columns={columns}
          rowKey={(r) => r.key}
          onRowClick={open}
          pageSize={12}
          initialSort={{ key: 'date', dir: 'desc' }}
          caption="Sales orders"
          empty={<EmptyState icon={<ShoppingCart className="size-5" />} title={q.loading ? 'Loading orders…' : 'No orders'} description={search || status || kpi ? 'Try clearing the filters.' : 'Approved sales requests and SAP orders appear here.'} />}
        />
      </Card>
    </>
  )
}
