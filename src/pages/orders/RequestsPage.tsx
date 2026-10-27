import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { pendingStep, requestTotal, useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { useSimulatedLoading } from '@/hooks/misc'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { StatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, SkeletonRows } from '@/components/ui/misc'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { toUsd } from '@/utils/fx'
import { displayStatus } from '@/utils/requestStatus'
import { date, money } from '@/utils/format'
import type { RequestStatus, SalesOrderRequest } from '@/types/domain'

const GROUPS: Record<string, RequestStatus[] | null> = {
  all: null,
  approval: ['Pending Approval'],
  changes: ['Returned for Clarification'],
  fulfilment: ['Approved', 'Awaiting Payment', 'Payment Verified', 'In Fulfillment', 'Ready for Collection'],
  drafts: ['Draft'],
  closed: ['Collected', 'Rejected', 'Cancelled'],
}

const VALUE_BANDS = [
  { value: '0-25000', label: 'Under USD 25k' },
  { value: '25000-100000', label: 'USD 25k – 100k' },
  { value: '100000-', label: 'Over USD 100k' },
]

export default function RequestsPage() {
  const scope = useScope()
  const { state, user, canAny } = useStore()
  const lookups = useLookups()
  const navigate = useNavigate()
  const loading = useSimulatedLoading(350)
  const [group, setGroup] = useState<keyof typeof GROUPS>('all')
  const [q, setQ] = useState('')
  const [territory, setTerritory] = useState('')
  const [customer, setCustomer] = useState('')
  const [band, setBand] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(() => {
    const [min, max] = band ? band.split('-').map((x) => (x ? Number(x) : undefined)) : [undefined, undefined]
    return scope.requests.filter((r) => {
      const usd = toUsd(requestTotal(r), r.currency)
      return (
        (!q || `${r.ref} ${r.customerPo ?? ''} ${lookups.customer(r.customerId)?.name}`.toLowerCase().includes(q.toLowerCase())) &&
        (!territory || r.territoryId === territory) &&
        (!customer || r.customerId === customer) &&
        (min === undefined || usd >= min) &&
        (max === undefined || usd < max) &&
        (!from || r.createdAt.slice(0, 10) >= from) &&
        (!to || r.createdAt.slice(0, 10) <= to)
      )
    })
  }, [scope.requests, q, territory, customer, band, from, to, lookups])

  const inGroup = (g: keyof typeof GROUPS) => filtered.filter((r) => !GROUPS[g] || GROUPS[g]!.includes(r.status))
  const rows = inGroup(group)
  const isCustomer = user.kind === 'external'

  const columns: Column<SalesOrderRequest>[] = [
    {
      key: 'ref', header: 'Request', primary: true, sortValue: (r) => r.ref,
      cell: (r) => (
        <span>
          <span className="block font-mono text-[12px] font-semibold">{r.ref}</span>
          {r.customerPo && <span className="block text-[11px] text-muted">PO {r.customerPo}</span>}
        </span>
      ),
    },
    ...(!isCustomer
      ? [{ key: 'customer', header: 'Customer', sortValue: (r: SalesOrderRequest) => lookups.customer(r.customerId)?.name ?? '', cell: (r: SalesOrderRequest) => <span className="font-medium">{lookups.customer(r.customerId)?.name}</span> } as Column<SalesOrderRequest>]
      : []),
    { key: 'territory', header: 'Territory', hideOnMobile: true, sortValue: (r) => lookups.territory(r.territoryId)?.name ?? '', cell: (r) => <span className="text-muted">{lookups.territory(r.territoryId)?.name}</span> },
    { key: 'created', header: 'Created', sortValue: (r) => r.createdAt, cell: (r) => date(r.createdAt) },
    { key: 'value', header: 'Value', align: 'right', sortValue: (r) => toUsd(requestTotal(r), r.currency), cell: (r) => <span className="font-medium tabular">{money(requestTotal(r), r.currency)}</span> },
    {
      key: 'stage', header: 'Current stage', hideOnMobile: true,
      cell: (r) => {
        const s = pendingStep(r)
        return s ? <span className="text-[12px]"><span className="font-medium">{s.stage}</span><span className="block text-muted">{lookups.user(s.approverId)?.name}</span></span> : <span className="text-muted">—</span>
      },
    },
    { key: 'status', header: 'Status', sortValue: (r) => displayStatus(r), cell: (r) => <StatusBadge status={displayStatus(r)} /> },
  ]

  const active = !!(q || territory || customer || band || from || to)

  return (
    <>
      <PageHeader
        title="Sales requests"
        description={isCustomer ? 'Requests submitted by your company, from draft through collection.' : 'Requests across your territories with live approval status.'}
        breadcrumbs={[{ label: 'Sales' }, { label: 'Sales Requests' }]}
        actions={canAny('order.create', 'order.create_on_behalf') && <ButtonLink to="/app/requests/new" icon={<Plus className="size-4" />}>New request</ButtonLink>}
      />
      <Card>
        <Tabs
          className="px-3"
          value={group}
          onChange={setGroup}
          items={[
            { key: 'all', label: 'All', count: inGroup('all').length },
            { key: 'approval', label: 'In approval', count: inGroup('approval').length },
            { key: 'changes', label: 'Returned for clarification', count: inGroup('changes').length },
            { key: 'fulfilment', label: 'Approved · SAP · fulfilment', count: inGroup('fulfilment').length },
            { key: 'drafts', label: 'Drafts', count: inGroup('drafts').length },
            { key: 'closed', label: 'Closed', count: inGroup('closed').length },
          ]}
        />
        <FilterBar active={active} onReset={() => { setQ(''); setTerritory(''); setCustomer(''); setBand(''); setFrom(''); setTo('') }}>
          <SearchInput value={q} onChange={setQ} placeholder="Ref, PO or customer…" className="w-full sm:w-60" />
          {!isCustomer && <FilterSelect label="Territory" value={territory} onChange={setTerritory} options={state.territories.filter((t) => scope.requests.some((r) => r.territoryId === t.id)).map((t) => ({ value: t.id, label: t.name }))} />}
          {!isCustomer && <FilterSelect label="Customer" value={customer} onChange={setCustomer} options={scope.customers.map((c) => ({ value: c.id, label: c.name }))} />}
          <FilterSelect label="Value" value={band} onChange={setBand} options={VALUE_BANDS} />
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            <input type="date" aria-label="Created from" value={from} onChange={(e) => setFrom(e.target.value)} className="input h-9 w-36" />
            –
            <input type="date" aria-label="Created to" value={to} onChange={(e) => setTo(e.target.value)} className="input h-9 w-36" />
          </span>
        </FilterBar>
        {loading ? (
          <SkeletonRows rows={8} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(r.status === 'Draft' ? `/app/requests/new?from=${r.id}` : `/app/requests/${r.id}`)}
            initialSort={{ key: 'created', dir: 'desc' }}
            caption="Sales order requests"
            empty={<EmptyState icon={<ClipboardList className="size-5" />} title="No requests here" description={active ? 'Try clearing filters.' : 'Requests you create will appear here.'} />}
          />
        )}
      </Card>
    </>
  )
}
