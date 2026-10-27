import { useMemo } from 'react'
import { canActOn, canFor, customerScope, notificationsFor, territoriesInScope, useStore, visibleApplications, workflowCtx } from '@/app/store'
import type { DemoState } from '@/app/store'
import type { DemoUser } from '@/types/domain'
import { hoursBetween } from '@/utils/format'
import { availableActions, isStageResponsible, stageById } from '@/workflow/engine'

/** Records the signed-in user may see — derived from permissions + assignments + ownership. */
export function useScope() {
  const { state, user } = useStore()
  return useMemo(() => scopeFor(state, user), [state, user])
}

export function scopeFor(state: DemoState, user: DemoUser) {
  const can = canFor(state, user)
  const ids = customerScope(state, user, can)
  const inScope = <T extends { customerId: string }>(xs: T[]) => xs.filter((x) => ids.has(x.customerId))
  const external = user.kind === 'external'
  const ctx = workflowCtx(state)
  const applications = visibleApplications(state, user, can)
  return {
    can,
    customerIds: ids,
    /** Territories whose performance and customers the user may see. */
    territoryIds: new Set(can('performance.view_all') || can('customer.view_all') ? state.territories.map((t) => t.id) : territoriesInScope(state, user, can)),
    /** Visits, calls and follow-ups visible to the user. */
    activities: can('activity.view_all')
      ? state.activities
      : can('activity.view_assigned')
        ? state.activities.filter((a) => ids.has(a.customerId) || a.ownerId === user.id)
        : [],
    customers: state.customers.filter((c) => ids.has(c.id)),
    requests: can('order.view_all') || can('order.view_assigned') || can('order.view_own') ? inScope(state.requests).filter((r) => r.status !== 'Draft' || r.createdById === user.id || !external) : [],
    invoices: can('invoice.view') ? inScope(state.invoices) : [],
    payments: can('payment.view') ? inScope(state.payments) : [],
    shipments: can('shipment.view') ? inScope(state.shipments) : [],
    threads: can('email.view') ? inScope(state.threads) : [],
    documents: can('document.view') ? state.documents.filter((d) => (d.customerId ? ids.has(d.customerId) : !external)) : [],
    notifications: notificationsFor(state, user),
    /** Customer applications the user may open. */
    applications,
    /** Applications the user owns (applicant view). */
    myApplications: state.applications.filter((a) => a.applicantUserId === user.id),
    /** Applications at a stage this user is responsible for, with at least one available action. */
    applicationQueue: applications.filter((a) => isStageResponsible(ctx, user, a) && availableActions(ctx, user, can, a).length > 0),
    approvalQueue: state.requests.filter((r) => canActOn(state, user, r, can)),
  }
}

export interface Task {
  id: string
  title: string
  description: string
  link: string
  priority: 'high' | 'medium' | 'low'
  category: 'Approval' | 'Order' | 'Finance' | 'Logistics' | 'Customer' | 'Application' | 'Follow-up' | 'System'
  dueAt?: string
}

export function useTasks(): Task[] {
  const { state, user } = useStore()
  const scope = useScope()
  return useMemo(() => {
    const { can } = scope
    const tasks: Task[] = []
    const cname = (id: string) => state.customers.find((c) => c.id === id)?.name ?? ''

    for (const r of scope.approvalQueue) {
      const step = r.approvalSteps.find((s) => s.status === 'Pending')!
      const waited = step.enteredAt ? hoursBetween(step.enteredAt) : 0
      tasks.push({
        id: `t-ap-${r.id}`,
        title: `Review ${r.ref}`,
        description: `${cname(r.customerId)} · ${step.stage} approval`,
        link: `/app/approvals/${r.id}`,
        priority: waited > step.slaHours ? 'high' : waited > step.slaHours * 0.6 ? 'medium' : 'low',
        category: 'Approval',
        dueAt: step.enteredAt ? new Date(new Date(step.enteredAt).getTime() + step.slaHours * 3_600_000).toISOString() : undefined,
      })
    }

    for (const a of scope.applicationQueue) {
      const stage = stageById(state.onboardingWorkflow, a.currentStageId)
      const waited = a.stageEnteredAt ? hoursBetween(a.stageEnteredAt) : 0
      const sla = stage?.slaHours ?? 48
      tasks.push({
        id: `t-app-${a.id}`,
        title: `${stage?.kind === 'review' ? 'Review' : 'Approve'} customer application ${a.ref}`,
        description: `${a.companyName} · ${stage?.name ?? ''} · ${a.status}`,
        link: `/app/applications/${a.id}`,
        priority: waited > sla ? 'high' : a.status === 'Resubmitted' || waited > sla * 0.6 ? 'medium' : 'low',
        category: 'Application',
        dueAt: a.stageEnteredAt ? new Date(new Date(a.stageEnteredAt).getTime() + sla * 3_600_000).toISOString() : undefined,
      })
    }

    for (const a of scope.myApplications) {
      if (a.status === 'Returned for Information')
        tasks.push({ id: `t-my-${a.id}`, title: a.returnInfo?.type === 'clarification' ? `Answer clarification for ${a.ref}` : `Correct and resubmit ${a.ref}`, description: a.returnInfo?.instructions ?? '', link: `/app/my-applications/${a.id}`, priority: 'high', category: 'Application' })
      if (a.status === 'Draft')
        tasks.push({ id: `t-myd-${a.id}`, title: `Complete and submit ${a.ref}`, description: 'Your customer application is saved as a draft.', link: `/app/my-applications/${a.id}/edit`, priority: 'medium', category: 'Application' })
    }

    if (can('activity.manage')) {
      for (const a of scope.activities)
        if (a.status === 'Planned' && a.ownerId === user.id)
          tasks.push({ id: `t-act-${a.id}`, title: `${a.type}: ${a.subject}`, description: cname(a.customerId), link: `/app/customers/${a.customerId}?tab=activities`, priority: new Date(a.at).getTime() < Date.now() ? 'high' : 'low', category: 'Customer', dueAt: a.at })
    }

    if (can('order.create') || can('order.create_on_behalf')) {
      for (const r of scope.requests) {
        if (r.status === 'Returned for Clarification')
          tasks.push({ id: `t-cr-${r.id}`, title: `Revise ${r.ref}`, description: r.approvalSteps.find((s) => s.status === 'Returned for Clarification')?.comment ?? 'Changes requested by approver', link: `/app/requests/${r.id}`, priority: 'high', category: 'Order' })
        if (r.status === 'Draft' && r.createdById === user.id)
          tasks.push({ id: `t-dr-${r.id}`, title: `Complete draft ${r.ref}`, description: `${cname(r.customerId)} · ${r.lines.length} line(s)`, link: `/app/requests/new?from=${r.id}`, priority: 'low', category: 'Order' })
      }
    }

    if (can('payment.upload_receipt')) {
      for (const inv of scope.invoices) {
        const pay = state.payments.find((p) => p.invoiceId === inv.id)
        if (inv.status === 'Issued' || pay?.status === 'Rejected')
          tasks.push({ id: `t-pay-${inv.id}`, title: `Pay ${inv.number} and upload receipt`, description: pay?.status === 'Rejected' ? `Receipt rejected: ${pay.note ?? ''}` : 'Proforma invoice awaiting payment', link: `/app/invoices/${inv.id}`, priority: 'high', category: 'Finance', dueAt: inv.dueAt })
      }
    }
    if (user.kind === 'external' && can('collection.view')) {
      for (const s of scope.shipments)
        if (s.status === 'Ready for Collection')
          tasks.push({ id: `t-col-${s.id}`, title: `Arrange collection for ${s.ref}`, description: `Reference ${s.collectionRef} · ${s.warehouse}`, link: `/app/shipments/${s.id}`, priority: 'medium', category: 'Logistics' })
    }

    if (can('followup.manage')) {
      for (const t of scope.threads)
        if (t.followUp.status === 'Overdue' || t.followUp.status === 'Due Today')
          tasks.push({ id: `t-fu-${t.id}`, title: `Follow up: ${t.subject}`, description: t.followUp.note ?? cname(t.customerId), link: `/app/email?thread=${t.id}`, priority: t.followUp.status === 'Overdue' ? 'high' : 'medium', category: 'Follow-up', dueAt: t.followUp.dueAt })
    }

    if (can('invoice.issue')) {
      for (const r of scope.requests)
        if (r.status === 'Approved' && !r.invoiceId)
          tasks.push({ id: `t-pi-${r.id}`, title: `Issue proforma for ${r.ref}`, description: cname(r.customerId), link: `/app/requests/${r.id}`, priority: 'high', category: 'Finance' })
    }
    if (can('payment.verify')) {
      for (const p of scope.payments)
        if (p.status === 'Receipt Uploaded' || p.status === 'Under Verification')
          tasks.push({ id: `t-vp-${p.id}`, title: `Verify payment ${p.ref}`, description: `${cname(p.customerId)} · receipt uploaded`, link: `/app/payments?verify=${p.id}`, priority: 'high', category: 'Finance' })
    }

    if (can('shipment.update')) {
      for (const s of scope.shipments) {
        if (['Payment Verified', 'Ready for Warehouse Preparation', 'Documents in Progress'].includes(s.status))
          tasks.push({ id: `t-sh-${s.id}`, title: `Advance ${s.ref}`, description: `${cname(s.customerId)} · currently ${s.status}`, link: `/app/shipments/${s.id}`, priority: s.status === 'Payment Verified' ? 'high' : 'medium', category: 'Logistics' })
        if (s.status === 'Ready for Collection')
          tasks.push({ id: `t-cc-${s.id}`, title: `Confirm collection of ${s.ref}`, description: `${cname(s.customerId)} · ${s.collectionRef}`, link: `/app/shipments/${s.id}`, priority: 'low', category: 'Logistics' })
      }
    }

    if (can('integration.retry')) {
      for (const e of state.integrationEvents)
        if (e.status === 'Failed')
          tasks.push({ id: `t-ie-${e.id}`, title: `Resolve sync failure: ${e.objectRef}`, description: e.message, link: `/app/admin/integration?event=${e.id}`, priority: 'medium', category: 'System' })
    }

    const order = { high: 0, medium: 1, low: 2 }
    return tasks.sort((a, b) => order[a.priority] - order[b.priority])
  }, [state, user, scope])
}
