import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState, ProgressBar } from '@/components/ui/misc'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { SHIPMENT_FLOW, type Shipment } from '@/types/domain'
import { num, relative } from '@/utils/format'

const GROUPS = {
  active: ['Approved', 'Awaiting Payment', 'Payment Verified', 'Ready for Warehouse Preparation', 'Documents in Progress', 'Ready for Collection'],
  warehouse: ['Payment Verified', 'Ready for Warehouse Preparation', 'Documents in Progress'],
  ready: ['Ready for Collection'],
  done: ['Collected'],
} as const

export default function ShipmentsPage() {
  const scope = useScope()
  const { user, can } = useStore()
  const lookups = useLookups()
  const navigate = useNavigate()
  const [tab, setTab] = useState<keyof typeof GROUPS>(can('shipment.update') && user.kind === 'internal' ? 'warehouse' : 'active')
  const [q, setQ] = useState('')
  const [warehouse, setWarehouse] = useState('')

  const filtered = scope.shipments.filter(
    (s) => (!q || `${s.ref} ${s.collectionRef ?? ''} ${lookups.customer(s.customerId)?.name} ${lookups.request(s.requestId)?.ref}`.toLowerCase().includes(q.toLowerCase())) && (!warehouse || s.warehouse === warehouse),
  )
  const inGroup = (g: keyof typeof GROUPS) => filtered.filter((s) => (GROUPS[g] as readonly string[]).includes(s.status))

  const columns: Column<Shipment>[] = [
    { key: 'ref', header: 'Shipment', primary: true, sortValue: (s) => s.ref, cell: (s) => <span><span className="block font-mono text-[12px] font-semibold">{s.ref}</span><span className="block text-[11px] text-muted">{lookups.request(s.requestId)?.ref}</span></span> },
    ...(user.kind !== 'external' ? [{ key: 'customer', header: 'Customer', sortValue: (s: Shipment) => lookups.customer(s.customerId)?.name ?? '', cell: (s: Shipment) => <span className="font-medium">{lookups.customer(s.customerId)?.name}</span> } as Column<Shipment>] : []),
    { key: 'mode', header: 'Mode', hideOnMobile: true, cell: (s) => <span className="text-muted">{s.mode}</span> },
    { key: 'wh', header: 'Warehouse', hideOnMobile: true, cell: (s) => <span className="text-muted">{s.warehouse}</span> },
    { key: 'pack', header: 'Cartons · weight', align: 'right', hideOnMobile: true, cell: (s) => <span className="tabular">{s.cartons} · {num(s.grossWeightKg)} kg</span> },
    {
      key: 'progress', header: 'Progress', sortValue: (s) => SHIPMENT_FLOW.indexOf(s.status),
      cell: (s) => (
        <span className="block min-w-32">
          <ProgressBar value={((SHIPMENT_FLOW.indexOf(s.status) + 1) / SHIPMENT_FLOW.length) * 100} tone={s.status === 'Collected' ? 'success' : 'primary'} />
          <span className="mt-1 block text-[11px] text-muted">Step {SHIPMENT_FLOW.indexOf(s.status) + 1} of {SHIPMENT_FLOW.length}</span>
        </span>
      ),
    },
    { key: 'updated', header: 'Updated', sortValue: (s) => s.history.at(-1)!.at, cell: (s) => relative(s.history.at(-1)?.at) },
    { key: 'status', header: 'Status', sortValue: (s) => s.status, cell: (s) => <StatusBadge status={s.status} /> },
  ]

  return (
    <>
      <PageHeader title="Warehouse coordination" description="Internal coordination of advance-payment orders (payment → warehouse preparation → documents → collection). Official delivery documents and goods issue are recorded in SAP — see Deliveries." breadcrumbs={[{ label: 'Deliveries' }, { label: 'Warehouse coordination' }]} />
      <Card>
        <Tabs
          className="px-3"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'active', label: 'Active', count: inGroup('active').length },
            { key: 'warehouse', label: 'In warehouse', count: inGroup('warehouse').length },
            { key: 'ready', label: 'Ready for collection', count: inGroup('ready').length },
            { key: 'done', label: 'Collected', count: inGroup('done').length },
          ]}
        />
        <FilterBar active={!!(q || warehouse)} onReset={() => { setQ(''); setWarehouse('') }}>
          <SearchInput value={q} onChange={setQ} placeholder="Shipment, collection ref, customer…" className="w-full sm:w-72" />
          <FilterSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={[...new Set(scope.shipments.map((s) => s.warehouse))].map((w) => ({ value: w, label: w }))} />
        </FilterBar>
        <DataTable
          key={tab}
          rows={inGroup(tab)}
          columns={columns}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/app/shipments/${s.id}`)}
          initialSort={{ key: 'updated', dir: 'desc' }}
          empty={<EmptyState icon={<Truck className="size-5" />} title="No shipments in this stage" />}
        />
      </Card>
    </>
  )
}
