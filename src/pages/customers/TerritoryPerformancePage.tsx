import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, CalendarCheck, GitBranch, Receipt, Users } from 'lucide-react'
import { requestTotal, useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatCard } from '@/components/data-display/StatCard'
import { FilterBar, FilterSelect } from '@/components/data-display/FilterBar'
import { TextField } from '@/components/forms/Field'
import { Avatar, Notice } from '@/components/ui/misc'
import { ChartCard, SimpleBars } from '@/pages/dashboard/widgets'
import { toUsd } from '@/utils/fx'
import { hoursBetween, money, num } from '@/utils/format'

const CONFIRMED = ['Approved', 'Awaiting Payment', 'Payment Verified', 'In Fulfillment', 'Ready for Collection', 'Collected']
const PRESETS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
]

/**
 * Sales KPIs by territory. Account Managers see only their assigned territories;
 * the Head of Sales sees and compares all territories and managers.
 * Orders are attributed to the territory recorded on the order (history is not rewritten when a customer moves).
 */
export default function TerritoryPerformancePage() {
  const { state, can } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const all = can('performance.view_all')
  const allowed = state.territories.filter((t) => all || scope.territoryIds.has(t.id))
  const [preset, setPreset] = useState('90')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [territory, setTerritory] = useState('')
  const [manager, setManager] = useState('')

  const range = useMemo(() => {
    if (preset === 'custom') return { start: from ? new Date(from).getTime() : 0, end: to ? new Date(`${to}T23:59:59`).getTime() : Date.now() }
    return { start: Date.now() - Number(preset) * 86_400_000, end: Date.now() }
  }, [preset, from, to])
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime()
    return t >= range.start && t <= range.end
  }

  const rows = allowed
    .filter((t) => (!territory || t.id === territory) && (!manager || t.managerId === manager))
    .map((t) => {
      const customers = state.customers.filter((c) => c.territoryId === t.id)
      const reqs = state.requests.filter((r) => r.territoryId === t.id && r.status !== 'Draft')
      const periodReqs = reqs.filter((r) => inRange(r.createdAt))
      const confirmed = periodReqs.filter((r) => CONFIRMED.includes(r.status))
      const value = confirmed.reduce((s, r) => s + toUsd(requestTotal(r), r.currency), 0)
      const pending = reqs.filter((r) => r.status === 'Pending Approval')
      const breached = pending.filter((r) => {
        const st = r.approvalSteps.find((x) => x.status === 'Pending')
        return st?.enteredAt && hoursBetween(st.enteredAt) > st.slaHours
      })
      const custIds = new Set(customers.map((c) => c.id))
      const outstanding = state.invoices.filter((i) => custIds.has(i.customerId) && ['Issued', 'Receipt Uploaded'].includes(i.status)).reduce((s, i) => s + toUsd(i.total, i.currency), 0)
      const acts = state.activities.filter((a) => a.territoryId === t.id && a.status === 'Completed' && inRange(a.at))
      const apps = state.applications.filter((a) => a.territoryId === t.id && ['Submitted', 'Under Review', 'Resubmitted', 'Pending Approval', 'Returned for Information'].includes(a.status))
      return {
        t,
        manager: lookups.user(t.managerId),
        customers: customers.length,
        activeCustomers: customers.filter((c) => c.status === 'Active').length,
        requests: periodReqs.length,
        orders: confirmed.length,
        value,
        avgOrder: confirmed.length ? value / confirmed.length : 0,
        pending: pending.length,
        breached: breached.length,
        outstanding,
        activities: acts.length,
        visits: acts.filter((a) => a.type === 'Visit').length,
        applications: apps.length,
      }
    })
    .sort((a, b) => b.value - a.value)

  const total = rows.reduce(
    (s, r) => ({ value: s.value + r.value, orders: s.orders + r.orders, pending: s.pending + r.pending, breached: s.breached + r.breached, outstanding: s.outstanding + r.outstanding, activities: s.activities + r.activities, customers: s.customers + r.customers }),
    { value: 0, orders: 0, pending: 0, breached: 0, outstanding: 0, activities: 0, customers: 0 },
  )

  const byManager = Object.values(
    rows.reduce<Record<string, { id: string; name: string; territories: string[]; value: number; orders: number; customers: number; activities: number; pending: number }>>((acc, r) => {
      const id = r.t.managerId
      acc[id] ??= { id, name: r.manager?.name ?? id, territories: [], value: 0, orders: 0, customers: 0, activities: 0, pending: 0 }
      acc[id].territories.push(r.t.name)
      acc[id].value += r.value
      acc[id].orders += r.orders
      acc[id].customers += r.customers
      acc[id].activities += r.activities
      acc[id].pending += r.pending
      return acc
    }, {}),
  ).sort((a, b) => b.value - a.value)

  const managers = [...new Set(allowed.map((t) => t.managerId))].map((id) => ({ value: id, label: lookups.user(id)?.name ?? id }))

  return (
    <>
      <PageHeader
        title="Territory performance"
        description={all ? 'Consolidated sales performance across all territories and Account Managers.' : `Your territories: ${allowed.map((t) => t.name).join(', ') || '—'}`}
        breadcrumbs={[{ label: 'Customer Management' }, { label: 'Territory Performance' }]}
      />
      <Card className="mb-4">
        <FilterBar active={preset !== '90' || !!(territory || manager)} onReset={() => { setPreset('90'); setFrom(''); setTo(''); setTerritory(''); setManager('') }}>
          <FilterSelect label="Period" value={preset} onChange={(v) => setPreset(v || '90')} options={PRESETS} />
          {preset === 'custom' && (
            <>
              <TextField aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto text-[13px]" />
              <TextField aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto text-[13px]" />
            </>
          )}
          {allowed.length > 1 && <FilterSelect label="Territory" value={territory} onChange={setTerritory} options={allowed.map((t) => ({ value: t.id, label: t.name }))} />}
          {all && <FilterSelect label="Manager" value={manager} onChange={setManager} options={managers} />}
        </FilterBar>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Confirmed order value" value={money(total.value, 'USD', { compact: true })} icon={<BarChart3 className="size-4" />} hint={`${total.orders} confirmed orders · USD equiv.`} />
        <StatCard label="Awaiting approval" value={total.pending} icon={<GitBranch className="size-4" />} tone="warning" hint={`${total.breached} over SLA`} to="/app/approvals" />
        <StatCard label="Outstanding receivables" value={money(total.outstanding, 'USD', { compact: true })} icon={<Receipt className="size-4" />} tone="neutral" hint="Issued proformas not yet verified" />
        <StatCard label="Customer activities" value={total.activities} icon={<CalendarCheck className="size-4" />} tone="success" hint={`${total.customers} customers in scope`} to="/app/activities" />
      </div>

      {total.breached > 0 && <Notice tone="warning" className="mb-4" icon={<AlertTriangle className="size-4" />} title="Approval exceptions">{total.breached} request(s) have waited longer than the approval SLA. <Link to="/app/approvals" className="font-medium underline">Open the approval workbench</Link></Notice>}

      {rows.length > 1 && (
        <ChartCard title="Confirmed order value by territory" description="USD equivalent · selected period" demo={false} className="mb-4">
          <SimpleBars data={rows.map((r) => ({ label: r.t.name, value: Math.round(r.value) }))} valueLabel="Order value" currency="USD" horizontal />
        </ChartCard>
      )}

      <Card className="mb-4">
        <CardHeader title="By territory" description="Orders are attributed to the territory recorded on each order." />
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <caption className="sr-only">Territory performance</caption>
            <thead>
              <tr className="border-b border-line bg-canvas/70 text-left text-[11px] uppercase tracking-wide text-muted">
                {['Territory', 'Manager', 'Customers', 'Requests', 'Confirmed', 'Order value', 'Avg. order', 'Awaiting approval', 'Outstanding', 'Activities', 'Open applications'].map((h, i) => (
                  <th key={h} scope="col" className={i > 1 ? 'px-3 py-2.5 text-right' : 'px-4 py-2.5'}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.t.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium"><Link to={`/app/customers?territory=${r.t.id}`} className="text-primary hover:underline">{r.t.name}</Link></th>
                  <td className="px-4 py-3">{r.manager?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-right tabular">{r.activeCustomers}/{r.customers}</td>
                  <td className="px-3 py-3 text-right tabular">{r.requests}</td>
                  <td className="px-3 py-3 text-right tabular">{r.orders}</td>
                  <td className="px-3 py-3 text-right font-medium tabular">{money(r.value, 'USD', { compact: true })}</td>
                  <td className="px-3 py-3 text-right tabular">{r.avgOrder ? money(r.avgOrder, 'USD', { compact: true }) : '—'}</td>
                  <td className="px-3 py-3 text-right tabular">{r.pending}{r.breached ? <span className="ml-1 text-danger-700">({r.breached} late)</span> : null}</td>
                  <td className="px-3 py-3 text-right tabular">{money(r.outstanding, 'USD', { compact: true })}</td>
                  <td className="px-3 py-3 text-right tabular">{r.activities} <span className="text-muted">({r.visits} visits)</span></td>
                  <td className="px-3 py-3 text-right tabular">{r.applications}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-muted">No territories match the filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {all && (
        <Card>
          <CardHeader title="Account Managers" description="Monitor managers across their assigned territories." icon={<Users className="size-4" />} />
          <ul className="divide-y divide-line">
            {byManager.map((m) => (
              <li key={m.id} className="grid gap-2 px-5 py-3 text-[13px] sm:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] sm:items-center">
                <span className="flex items-center gap-3"><Avatar name={m.name} size="sm" /><span><span className="block font-medium">{m.name}</span><span className="block text-xs text-muted">{m.territories.join(', ')}</span></span></span>
                <span><span className="text-xs text-muted">Value </span><span className="font-medium tabular">{money(m.value, 'USD', { compact: true })}</span></span>
                <span><span className="text-xs text-muted">Orders </span><span className="tabular">{num(m.orders)}</span></span>
                <span><span className="text-xs text-muted">Activities </span><span className="tabular">{num(m.activities)}</span></span>
                <span><span className="text-xs text-muted">Pending </span><span className="tabular">{num(m.pending)}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
