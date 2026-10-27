import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Plus } from 'lucide-react'
import { useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { DataTable } from '@/components/data-display/DataTable'
import { stageById } from '@/workflow/engine'
import { STATUS_COPY } from '@/workflow/publicView'
import { date, relative } from '@/utils/format'
import type { RegistrationApplication } from '@/types/domain'

/** Applicant view: only the applications this user owns. */
export default function MyApplicationsPage() {
  const { state } = useStore()
  const { myApplications } = useScope()
  const navigate = useNavigate()
  const rows = [...myApplications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const actionNeeded = rows.filter((a) => a.status === 'Returned for Information' || a.status === 'Draft').length

  return (
    <>
      <PageHeader
        title="My customer applications"
        description={actionNeeded ? `${actionNeeded} application${actionNeeded > 1 ? 's need' : ' needs'} your action.` : 'Track the progress of your Customer Application.'}
        breadcrumbs={[{ label: 'My Applications' }]}
      />
      <Card>
        <DataTable<RegistrationApplication>
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate(`/app/my-applications/${a.id}`)}
          caption="My customer applications"
          columns={[
            { key: 'ref', header: 'Reference', primary: true, cell: (a) => <span className="font-mono text-[13px] font-medium">{a.ref}</span>, sortValue: (a) => a.ref },
            { key: 'company', header: 'Company', cell: (a) => a.companyName || <span className="text-muted">Untitled draft</span> },
            { key: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} />, sortValue: (a) => a.status },
            {
              key: 'stage',
              header: 'Current step',
              hideOnMobile: true,
              cell: (a) =>
                a.status === 'Returned for Information' ? (
                  <span className="font-medium text-warning-700">{a.returnInfo?.type === 'clarification' ? 'Answer clarification' : 'Correct and resubmit'}</span>
                ) : a.status === 'Draft' ? (
                  <span className="font-medium text-primary">Complete and submit</span>
                ) : ['Approved', 'Rejected'].includes(a.status) ? (
                  STATUS_COPY[a.status].headline
                ) : (
                  stageById(state.onboardingWorkflow, a.currentStageId)?.publicLabel ?? '—'
                ),
            },
            { key: 'submitted', header: 'Submitted', hideOnMobile: true, cell: (a) => (a.submittedAt ? date(a.submittedAt) : '—'), sortValue: (a) => a.submittedAt ?? '' },
            { key: 'updated', header: 'Last update', cell: (a) => relative(a.updatedAt), sortValue: (a) => a.updatedAt },
          ]}
          initialSort={{ key: 'updated', dir: 'desc' }}
          empty={
            <EmptyState
              icon={<BadgeCheck className="size-5" />}
              title="No customer applications"
              description="Applications you submit appear here. Your account has no applications yet."
              action={<ButtonLink to="/register" icon={<Plus className="size-4" />}>Start a customer registration</ButtonLink>}
            />
          }
        />
      </Card>
    </>
  )
}
