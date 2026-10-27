import { useState } from 'react'
import { CalendarCheck, CheckCircle2, Clock, MapPin } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/data-display/StatCard'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { TextField } from '@/components/forms/Field'
import { ACTIVITY_TYPES, ActivityList, LogActivityButton } from '@/components/customers/Activities'

/** Visits, calls and follow-ups across the customers the user may see. */
export default function ActivitiesPage() {
  const { state, can } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const [q, setQ] = useState('')
  const [territory, setTerritory] = useState('')
  const [owner, setOwner] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const rows = scope.activities.filter(
    (a) =>
      (!q || `${a.subject} ${a.notes ?? ''} ${lookups.customer(a.customerId)?.name ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
      (!territory || a.territoryId === territory) &&
      (!owner || a.ownerId === owner) &&
      (!type || a.type === type) &&
      (!status || (status === 'Overdue' ? a.status === 'Planned' && new Date(a.at).getTime() < Date.now() : a.status === status)) &&
      (!from || a.at >= new Date(from).toISOString()) &&
      (!to || a.at <= new Date(`${to}T23:59:59`).toISOString()),
  )
  const owners = [...new Set(scope.activities.map((a) => a.ownerId))].map((id) => ({ value: id, label: lookups.user(id)?.name ?? id }))
  const terrs = state.territories.filter((t) => scope.territoryIds.has(t.id))
  const monthAgo = Date.now() - 30 * 86_400_000

  return (
    <>
      <PageHeader
        title="Visits & activities"
        description={can('activity.view_all') ? 'Customer visits, calls and follow-ups across all territories.' : 'Customer visits, calls and follow-ups for your assigned territories.'}
        breadcrumbs={[{ label: 'Customer Management' }, { label: 'Visits & Activities' }]}
        actions={<LogActivityButton />}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visits (last 30 days)" value={scope.activities.filter((a) => a.type === 'Visit' && a.status === 'Completed' && new Date(a.at).getTime() > monthAgo).length} icon={<MapPin className="size-4" />} />
        <StatCard label="Completed activities" value={scope.activities.filter((a) => a.status === 'Completed').length} icon={<CheckCircle2 className="size-4" />} tone="success" />
        <StatCard label="Planned" value={scope.activities.filter((a) => a.status === 'Planned').length} icon={<CalendarCheck className="size-4" />} tone="neutral" />
        <StatCard label="Overdue follow-ups" value={scope.activities.filter((a) => a.status === 'Planned' && new Date(a.at).getTime() < Date.now()).length} icon={<Clock className="size-4" />} tone="danger" />
      </div>
      <Card>
        <FilterBar active={!!(q || territory || owner || type || status || from || to)} onReset={() => { setQ(''); setTerritory(''); setOwner(''); setType(''); setStatus(''); setFrom(''); setTo('') }}>
          <SearchInput value={q} onChange={setQ} placeholder="Subject, notes or customer…" label="Search activities" className="w-full sm:w-60" />
          {terrs.length > 1 && <FilterSelect label="Territory" value={territory} onChange={setTerritory} options={terrs.map((t) => ({ value: t.id, label: t.name }))} />}
          {owners.length > 1 && <FilterSelect label="Manager" value={owner} onChange={setOwner} options={owners} />}
          <FilterSelect label="Type" value={type} onChange={setType} options={ACTIVITY_TYPES.map((t) => ({ value: t, label: t }))} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={['Completed', 'Planned', 'Overdue'].map((s) => ({ value: s, label: s }))} />
          <TextField aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto text-[13px]" />
          <TextField aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto text-[13px]" />
        </FilterBar>
        <ActivityList activities={rows} showCustomer />
      </Card>
    </>
  )
}
