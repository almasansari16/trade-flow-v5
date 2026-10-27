import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Truck } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
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
import { date, num } from '@/utils/format'
import type { GoodsReceiptAck } from '@/types/domain'
import type { SapDeliveryView } from '@/types/sap'

/** Receipt status of a delivery from the customer's side (TradeFlow acknowledgement). */
export function receiptStatus(d: SapDeliveryView, acks: GoodsReceiptAck[]) {
  const ack = acks.find((g) => g.deliveryNumber === d.deliveryNumber)
  if (ack) return ack.discrepancy?.status === 'Open' ? 'Discrepancy open' : ack.outcome
  if (d.status === 'Goods Issued' || d.status === 'Delivered') return 'Awaiting confirmation'
  return d.status === 'Cancelled' ? '—' : 'Not yet shipped'
}

export default function DeliveriesPage() {
  const { state, user } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const navigate = useNavigate()
  const internal = user.kind === 'internal'
  const q = useSapQuery((ctx) => services.sapData.listDeliveries(ctx), [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [kpi, setKpi] = useState('')
  const acks = state.goodsReceipts

  const rows = useMemo(() => q.data?.items ?? [], [q.data])
  const KPI: Record<string, (d: SapDeliveryView) => boolean> = {
    process: (d) => d.status === 'In Picking' || d.status === 'Goods Issued',
    awaiting: (d) => receiptStatus(d, acks) === 'Awaiting confirmation',
    discrepancy: (d) => receiptStatus(d, acks) === 'Discrepancy open' || receiptStatus(d, acks) === 'Received with discrepancy',
    delivered: (d) => d.status === 'Delivered',
  }
  const filtered = rows.filter((d) => (!kpi || KPI[kpi]!(d)) && (!status || d.status === status) && (!search || `${d.deliveryNumber} ${d.soNumber} ${lookups.customer(d.customerId)?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())))

  const columns: Column<SapDeliveryView>[] = [
    { key: 'dn', header: 'SAP delivery', primary: true, sortValue: (d) => d.deliveryNumber, cell: (d) => <span className="whitespace-nowrap font-mono text-[12px] font-semibold">{d.deliveryNumber}</span> },
    { key: 'so', header: 'Sales order', sortValue: (d) => d.soNumber, cell: (d) => <span className="whitespace-nowrap font-mono text-[12px]">{d.soNumber}</span> },
    ...(internal ? [{ key: 'customer', header: 'Customer', cell: (d: SapDeliveryView) => <span className="font-medium">{lookups.customer(d.customerId)?.name}</span> } as Column<SapDeliveryView>] : []),
    { key: 'date', header: 'Delivery date', sortValue: (d) => d.goodsIssueDate ?? d.plannedDate, cell: (d) => <span className="whitespace-nowrap">{date(d.deliveredDate ?? d.goodsIssueDate ?? d.plannedDate)}<span className="block text-[10.5px] text-muted">{d.deliveredDate ? 'delivered' : d.goodsIssueDate ? 'goods issued' : 'planned'}</span></span> },
    { key: 'products', header: 'Products', hideOnMobile: true, cell: (d) => <span className="text-[12px]">{d.items.length} line{d.items.length === 1 ? '' : 's'}<span className="block text-muted" title={d.items.map((i) => i.description).join(', ')}>{d.items[0]?.description}{d.items.length > 1 ? ` +${d.items.length - 1}` : ''}</span></span> },
    { key: 'qty', header: 'Delivered', align: 'right', sortValue: (d) => d.items.reduce((s, i) => s + i.qty, 0), cell: (d) => <span className="tabular">{num(d.items.reduce((s, i) => s + i.qty, 0))}</span> },
    { key: 'pending', header: 'Pending on order', align: 'right', hideOnMobile: true, cell: (d) => { const p = Object.values(d.pendingQty).reduce((s, x) => s + x, 0); return <span className={p ? 'tabular text-warning-700' : 'tabular text-muted'}>{num(p)}</span> } },
    { key: 'status', header: 'Delivery status', sortValue: (d) => d.status, cell: (d) => <StatusBadge status={d.status} /> },
    { key: 'gr', header: 'Receipt', cell: (d) => <StatusBadge status={receiptStatus(d, acks)} /> },
    { key: 'go', header: <span className="sr-only">Actions</span>, align: 'right', cell: (d) => <span className="inline-flex items-center whitespace-nowrap text-[12px] font-medium text-primary">{!internal && receiptStatus(d, acks) === 'Awaiting confirmation' ? 'Confirm receipt' : 'Open'}<ChevronRight className="size-3.5" /></span> },
  ]
  const count = (k: string) => rows.filter(KPI[k]!).length

  return (
    <>
      <PageHeader
        title="Deliveries"
        description={internal ? 'SAP outbound deliveries for the accounts in your scope, with customer receipt confirmations.' : 'Deliveries SAP has created for your orders. Confirm receipt when goods arrive.'}
        breadcrumbs={[{ label: 'Deliveries' }]}
        meta={<SapSourceBar mode={q.data?.mode} syncedAt={q.data?.syncedAt} onRefresh={q.reload} loading={q.loading} />}
      />
      <KpiStrip
        active={kpi}
        onSelect={setKpi}
        className="lg:grid-cols-4"
        items={[
          { key: 'process', label: 'In process', value: count('process'), tone: 'info', hint: 'Picking or on the way' },
          { key: 'awaiting', label: 'Awaiting receipt confirmation', value: count('awaiting'), tone: 'warning' },
          { key: 'discrepancy', label: 'With discrepancy', value: count('discrepancy'), tone: 'danger' },
          { key: 'delivered', label: 'Delivered', value: count('delivered'), tone: 'success' },
        ]}
      />
      <Card>
        <FilterBar active={!!(search || status || kpi)} onReset={() => { setSearch(''); setStatus(''); setKpi('') }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Delivery or sales order…" className="w-full sm:w-60" label="Search deliveries" />
          <FilterSelect label="Delivery status" value={status} onChange={setStatus} options={['In Picking', 'Goods Issued', 'Delivered', 'Cancelled'].map((s) => ({ value: s, label: s }))} />
        </FilterBar>
        {q.error && <SapError error={q.error} onRetry={q.reload} />}
        <DataTable
          key={kpi}
          rows={filtered}
          columns={columns}
          rowKey={(d) => d.deliveryNumber}
          onRowClick={(d) => navigate(`/app/deliveries/${d.deliveryNumber}`)}
          pageSize={12}
          initialSort={{ key: 'date', dir: 'desc' }}
          caption="Deliveries"
          empty={<EmptyState icon={<Truck className="size-5" />} title={q.loading ? 'Loading deliveries…' : 'No deliveries'} description={scope.customers.length ? 'Deliveries appear once SAP creates them for a sales order.' : 'No customer accounts in scope.'} />}
        />
      </Card>
    </>
  )
}
