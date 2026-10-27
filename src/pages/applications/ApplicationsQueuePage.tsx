import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, FileCheck2, Inbox } from 'lucide-react'
import { KpiStrip } from '@/components/data-display/KpiStrip'
import { useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/misc'
import { DataTable } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { activeStages, stageById } from '@/workflow/engine'
import { APPLICATION_STATUSES, type RegistrationApplication } from '@/types/domain'
import { date, hoursBetween, relative } from '@/utils/format'

type QueueTab = 'action' | 'progress' | 'returned' | 'approved' | 'rejected' | 'all'
const IN_FLIGHT = ['Submitted', 'Under Review', 'Resubmitted', 'Pending Approval']

/**
 * Reviewer / approver work queue. Every list and count is limited to the
 * applications this user may see (assigned, stage-responsible, or view_all).
 */
export default function ApplicationsQueuePage() {
  const { state, can } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as QueueTab) || (scope.applicationQueue.length ? 'action' : 'progress')
  const [q, setQ] = useState('')
  const [stageF, setStageF] = useState('')
  const [statusF, setStatusF] = useState('')
  const [kpi, setKpi] = useState('')

  const actionIds = new Set(scope.applicationQueue.map((a) => a.id))
  const buckets: Record<QueueTab, RegistrationApplication[]> = useMemo(
    () => ({
      action: scope.applicationQueue,
      progress: scope.applications.filter((a) => IN_FLIGHT.includes(a.status)),
      returned: scope.applications.filter((a) => a.status === 'Returned for Information'),
      approved: scope.applications.filter((a) => a.status === 'Approved'),
      rejected: scope.applications.filter((a) => a.status === 'Rejected'),
      all: scope.applications,
    }),
    [scope],
  )

  const KPI_FILTER: Record<string, (a: RegistrationApplication) => boolean> = {
    total: () => true,
    pending: (a) => a.status === 'Submitted' || a.status === 'Resubmitted',
    review: (a) => a.status === 'Under Review' || a.status === 'Pending Approval',
    approved: (a) => a.status === 'Approved',
    rejected: (a) => a.status === 'Rejected',
    returned: (a) => a.status === 'Returned for Information',
  }
  const kpiCount = (k: string) => scope.applications.filter(KPI_FILTER[k]!).length
  const source = kpi ? scope.applications.filter(KPI_FILTER[kpi]!) : buckets[tab]
  const rows = source.filter(
    (a) =>
      (!q || `${a.ref} ${a.companyName} ${a.city} ${a.country} ${a.contact.name} ${a.contact.email}`.toLowerCase().includes(q.toLowerCase())) &&
      (!stageF || a.currentStageId === stageF) &&
      (!statusF || a.status === statusF),
  )

  return (
    <>
      <PageHeader
        title="Customer onboarding"
        description={can('application.approve') ? 'Review registrations, return for information, approve (activates the customer account) or reject.' : can('application.view_all') ? 'Read-only view of submitted registrations. Onboarding decisions are made by the Customer Onboarding Approver.' : 'Registrations from your territories (read-only).'}
        breadcrumbs={[{ label: 'Customer onboarding' }]}
      />
      <KpiStrip
        active={kpi}
        onSelect={setKpi}
        items={[
          { key: 'total', label: 'Total registrations', value: kpiCount('total'), tone: 'neutral' },
          { key: 'pending', label: 'Pending review', value: kpiCount('pending'), tone: 'warning', hint: 'Submitted / resubmitted' },
          { key: 'review', label: 'Under review', value: kpiCount('review'), tone: 'info' },
          { key: 'returned', label: 'Returned for info', value: kpiCount('returned'), tone: 'warning' },
          { key: 'approved', label: 'Approved', value: kpiCount('approved'), tone: 'success' },
          { key: 'rejected', label: 'Rejected', value: kpiCount('rejected'), tone: 'danger' },
        ]}
      />
      <Card>
        <div className="px-5 pt-2">
          <Tabs<QueueTab>
            value={tab}
            onChange={(k) => { setKpi(''); setParams({ tab: k }, { replace: true }) }}
            items={[
              { key: 'action', label: 'Requiring my action', count: buckets.action.length },
              { key: 'progress', label: 'In progress', count: buckets.progress.length },
              { key: 'returned', label: 'Returned for information', count: buckets.returned.length },
              { key: 'approved', label: 'Approved', count: buckets.approved.length },
              { key: 'rejected', label: 'Rejected', count: buckets.rejected.length },
              { key: 'all', label: 'All in my scope', count: buckets.all.length },
            ]}
          />
        </div>
        {kpi && <p className="px-5 pt-3 text-xs text-muted">Filtered by KPI — {rows.length} shown. <button type="button" className="font-medium text-primary hover:underline" onClick={() => setKpi('')}>Clear</button></p>}
        <FilterBar active={!!(q || stageF || statusF || kpi)} onReset={() => { setQ(''); setStageF(''); setStatusF(''); setKpi('') }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search reference, company, city…" label="Search applications" />
          {activeStages(state.onboardingWorkflow).length > 1 && <FilterSelect label="Stage" value={stageF} onChange={setStageF} options={activeStages(state.onboardingWorkflow).map((s) => ({ value: s.id, label: s.name }))} />}
          <FilterSelect label="Status" value={statusF} onChange={setStatusF} options={APPLICATION_STATUSES.filter((s) => s !== 'Draft').map((s) => ({ value: s, label: s }))} />
        </FilterBar>
        <DataTable<RegistrationApplication>
          key={tab + kpi}
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate(`/app/applications/${a.id}`)}
          caption="Customer applications"
          initialSort={{ key: 'updated', dir: 'desc' }}
          columns={[
            {
              key: 'ref',
              header: 'Ref',
              primary: true,
              sortValue: (a) => a.ref,
              cell: (a) => (
                <span className="flex flex-col items-start gap-0.5">
                  <span className="whitespace-nowrap font-mono text-[12px] font-semibold">{a.ref}</span>
                  {actionIds.has(a.id) && <Badge tone="primary">Your action</Badge>}
                </span>
              ),
            },
            { key: 'company', header: 'Company', sortValue: (a) => a.companyName, cell: (a) => <span><span className="block font-medium">{a.companyName}</span><span className="text-xs text-muted">{a.city}, {a.country}</span></span> },
            { key: 'contact', header: 'Contact person', hideOnMobile: true, sortValue: (a) => a.contact.name, cell: (a) => a.contact.name },
            { key: 'email', header: 'Business email', hideOnMobile: true, sortValue: (a) => a.contact.email, cell: (a) => <span className="text-muted">{a.contact.email}</span> },
            { key: 'submitted', header: 'Submitted', sortValue: (a) => a.submittedAt ?? '', cell: (a) => (a.submittedAt ? <span title={relative(a.submittedAt)} className="whitespace-nowrap">{date(a.submittedAt)}</span> : '—') },
            { key: 'status', header: 'Status', sortValue: (a) => a.status, cell: (a) => <StatusBadge status={a.status} /> },
            {
              key: 'reviewer', header: 'Assigned reviewer', hideOnMobile: true,
              cell: (a) => {
                const who = a.status === 'Returned for Information' ? 'With applicant' : ['Approved', 'Rejected'].includes(a.status) ? lookups.user([...a.history].reverse().find((e) => e.action === 'approve' || e.action === 'reject')?.actorId)?.name ?? '—' : lookups.user(a.assignedToUserId)?.name ?? 'Unassigned'
                const sla = stageById(state.onboardingWorkflow, a.currentStageId)?.slaHours ?? 48
                const overdue = IN_FLIGHT.includes(a.status) && a.stageEnteredAt && hoursBetween(a.stageEnteredAt) > sla
                return <span className="whitespace-nowrap">{who}{overdue && <span className="block text-[11px] font-semibold text-danger-700">SLA overdue</span>}</span>
              },
            },
            { key: 'updated', header: 'Updated', hideOnMobile: true, sortValue: (a) => a.updatedAt, cell: (a) => <span className="whitespace-nowrap text-muted">{relative(a.updatedAt)}</span> },
            { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: (a) => <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[12px] font-medium text-primary">{actionIds.has(a.id) ? 'Review' : 'View'}<ChevronRight className="size-3.5" /></span> },
          ]}
          empty={
            <EmptyState
              icon={tab === 'action' ? <Inbox className="size-5" /> : <FileCheck2 className="size-5" />}
              title={tab === 'action' ? 'Nothing needs your action' : 'No applications here'}
              description={tab === 'action' ? 'Applications assigned to your stage will appear here.' : 'Only applications within your access scope are listed.'}
            />
          }
        />
      </Card>
    </>
  )
}
