import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Users } from 'lucide-react'
import { requestTotal, useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { useSimulatedLoading } from '@/hooks/misc'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Avatar, EmptyState, SkeletonRows } from '@/components/ui/misc'
import { ButtonLink } from '@/components/ui/Button'
import { toUsd } from '@/utils/fx'
import { money, relative } from '@/utils/format'
import type { Customer } from '@/types/domain'

/** Customer accounts in the user's scope (all, or assigned territories). Applications live in Customer Applications. */
export default function CustomersPage() {
  const scope = useScope()
  const { can } = useStore()
  const loading = useSimulatedLoading(350)
  const pendingApps = scope.applications.filter((a) => ['Submitted', 'Under Review', 'Resubmitted', 'Pending Approval'].includes(a.status)).length

  return (
    <>
      <PageHeader
        title="Customer management"
        description={can('customer.view_all') ? 'All existing customer accounts, their territories, activity and sales history.' : 'Existing customers in your assigned territories.'}
        breadcrumbs={[{ label: 'Customer Management' }, { label: 'Customers' }]}
        actions={
          can('application.view_assigned') || can('application.view_territory') || can('application.view_all') ? (
            <ButtonLink to="/app/applications" variant="secondary" icon={<BadgeCheck className="size-4" />}>
              Customer applications{pendingApps ? ` (${pendingApps} in progress)` : ''}
            </ButtonLink>
          ) : undefined
        }
      />
      <Card>{loading ? <SkeletonRows rows={7} /> : <CustomerTable />}</Card>
    </>
  )
}

function CustomerTable() {
  const scope = useScope()
  const { state } = useStore()
  const lookups = useLookups()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [params] = useSearchParams()
  const [territory, setTerritory] = useState(params.get('territory') ?? '')
  const [status, setStatus] = useState('')
  const [manager, setManager] = useState('')

  const rows = useMemo(
    () =>
      scope.customers.filter(
        (c) =>
          (!q || `${c.name} ${c.code} ${c.city} ${c.country}`.toLowerCase().includes(q.toLowerCase())) &&
          (!territory || c.territoryId === territory) &&
          (!manager || lookups.territory(c.territoryId)?.managerId === manager) &&
          (!status || c.status === status),
      ),
    [scope.customers, q, territory, status, manager, lookups],
  )

  const lastActivity = (id: string) => scope.activities.filter((a) => a.customerId === id && a.status === 'Completed').map((a) => a.at).sort().at(-1)
  const stats = (c: Customer) => {
    const reqs = state.requests.filter((r) => r.customerId === c.id)
    return {
      open: reqs.filter((r) => ['Pending Approval', 'Returned for Clarification', 'Approved', 'Awaiting Payment', 'Payment Verified', 'In Fulfillment', 'Ready for Collection'].includes(r.status)).length,
      value: reqs.filter((r) => !['Draft', 'Rejected', 'Cancelled'].includes(r.status)).reduce((s, r) => s + toUsd(requestTotal(r), r.currency), 0),
    }
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name', header: 'Customer', primary: true, sortValue: (c) => c.name,
      cell: (c) => (
        <span className="flex items-center gap-3">
          <Avatar name={c.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{c.name}</span>
            <span className="block text-xs text-muted">{c.code}</span>
          </span>
        </span>
      ),
    },
    { key: 'territory', header: 'Territory', sortValue: (c) => lookups.territory(c.territoryId)?.name ?? '', cell: (c) => <span><span className="block">{lookups.territory(c.territoryId)?.name}</span><span className="block text-xs text-muted">{lookups.user(lookups.territory(c.territoryId)?.managerId)?.name}</span></span> },
    { key: 'last', header: 'Last activity', hideOnMobile: true, sortValue: (c) => lastActivity(c.id) ?? '', cell: (c) => { const l = lastActivity(c.id); return l ? <span className="text-muted">{relative(l)}</span> : <span className="text-muted">—</span> } },
    { key: 'location', header: 'Location', hideOnMobile: true, cell: (c) => <span className="text-muted">{c.city}, {c.country}</span> },
    { key: 'tier', header: 'Tier', sortValue: (c) => c.tier, cell: (c) => <Badge tone={c.tier === 'Platinum' ? 'dark' : c.tier === 'Gold' ? 'warning' : c.tier === 'New' ? 'primary' : 'neutral'}>{c.tier}</Badge> },
    { key: 'open', header: 'Open requests', align: 'right', sortValue: (c) => stats(c).open, cell: (c) => <span className="tabular">{stats(c).open}</span> },
    { key: 'value', header: 'Order value (USD)', align: 'right', sortValue: (c) => stats(c).value, cell: (c) => <span className="font-medium tabular">{money(stats(c).value, 'USD', { compact: true })}</span> },
    { key: 'status', header: 'Status', sortValue: (c) => c.status, cell: (c) => <StatusBadge status={c.status} /> },
  ]

  return (
    <>
      <FilterBar active={!!(q || territory || status || manager)} onReset={() => { setQ(''); setTerritory(''); setStatus(''); setManager('') }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, code, city…" className="w-full sm:w-72" />
        <FilterSelect label="Territory" value={territory} onChange={setTerritory} options={state.territories.filter((t) => scope.customers.some((c) => c.territoryId === t.id)).map((t) => ({ value: t.id, label: t.name }))} />
        {new Set(scope.customers.map((c) => lookups.territory(c.territoryId)?.managerId)).size > 1 && (
          <FilterSelect label="Manager" value={manager} onChange={setManager} options={[...new Set(scope.customers.map((c) => lookups.territory(c.territoryId)?.managerId ?? ''))].filter(Boolean).map((id) => ({ value: id, label: lookups.user(id)?.name ?? id }))} />
        )}
        <FilterSelect label="Status" value={status} onChange={setStatus} options={['Active', 'Pending Review', 'On Hold', 'Blocked'].map((s) => ({ value: s, label: s }))} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/app/customers/${c.id}`)}
        initialSort={{ key: 'value', dir: 'desc' }}
        caption="Customer accounts"
        empty={<EmptyState icon={<Users className="size-5" />} title="No customers match" description="Try a different search or clear the filters." />}
      />
    </>
  )
}
