/**
 * Customer-application workflow engine (pure functions).
 *
 * All decision rules live here: which actions a user may take, mandatory remarks,
 * eligible return destinations, assignment and resubmission routing. Screens call
 * `availableActions` to render buttons and the store calls `applyReviewerAction` /
 * `applyApplicantAction` to change state — so the same rules gate both the UI and
 * the state change. In production these rules must be re-enforced server-side.
 */
import type {
  ApplicationContent,
  ApplicationSection,
  ApplicationStatus,
  DemoUser,
  RegistrationApplication,
  Role,
  Territory,
  WorkflowActionType,
  WorkflowDef,
  WorkflowEvent,
  WorkflowStageDef,
} from '@/types/domain'
import { uid } from '@/utils/time'

export interface WorkflowCtx {
  workflow: WorkflowDef
  users: DemoUser[]
  roles: Role[]
  territories: Territory[]
  regions: { id: string; managerId: string }[]
}

export type ReviewerAction = 'start_review' | 'approve' | 'reject' | 'return_to_requester' | 'request_clarification' | 'return_to_previous'

export interface ActionAvailability {
  action: ReviewerAction
  label: string
  permission: string
  allowed: boolean
  reason?: string
  tone: 'primary' | 'success' | 'danger' | 'secondary'
}

export interface ReviewerInput {
  remarks?: string
  publicRemarks?: string
  editableSections?: ApplicationSection[]
  targetStageId?: string
  targetUserId?: string
}

export interface NotificationDraft {
  title: string
  body: string
  link: string
  userIds?: string[]
  audience?: string[]
}

export type TransitionResult =
  | { ok: true; notifications: NotificationDraft[]; finalApproved?: boolean }
  | { ok: false; error: string }

export const MIN_REASON = 10
const IN_WORKFLOW: ApplicationStatus[] = ['Submitted', 'Under Review', 'Resubmitted', 'Pending Approval']

// ─── Stage helpers ─────────────────────────────────────────────────────────

export const activeStages = (def: WorkflowDef) => def.stages.filter((s) => s.active)
export const stageById = (def: WorkflowDef, id?: string) => def.stages.find((s) => s.id === id)
export const activeIndex = (def: WorkflowDef, id?: string) => activeStages(def).findIndex((s) => s.id === id)
/** True when no active stage follows `id` (approving here completes the workflow). */
export const isLastStage = (def: WorkflowDef, id?: string) => {
  const pos = def.stages.findIndex((s) => s.id === id)
  return pos >= 0 && !def.stages.slice(pos + 1).some((s) => s.active)
}
/** Status that represents "being worked on" at a given stage. */
export const workingStatusFor = (def: WorkflowDef, stageId: string): ApplicationStatus => (activeIndex(def, stageId) <= 0 ? 'Under Review' : 'Pending Approval')

const hasRole = (u: DemoUser, roleId: string) => u.roleIds.includes(roleId)

/** Pick the user who should work a stage for this application. */
export function resolveAssignee(ctx: WorkflowCtx, stage: WorkflowStageDef, app: RegistrationApplication): string | undefined {
  const eligible = ctx.users.filter((u) => u.active && hasRole(u, stage.roleId))
  const territory = ctx.territories.find((t) => t.id === app.territoryId)
  if (stage.assignment === 'territory_sales_manager') {
    const tm = eligible.find((u) => u.id === territory?.managerId) ?? eligible.find((u) => u.territoryIds?.includes(app.territoryId))
    return tm?.id
  }
  if (stage.assignment === 'review_region') {
    return (eligible.find((u) => territory && u.reviewRegionIds?.includes(territory.regionId)) ?? eligible[0])?.id
  }
  return eligible[0]?.id
}

/** Is `user` responsible for the application's current stage? */
export function isStageResponsible(ctx: WorkflowCtx, user: DemoUser, app: RegistrationApplication) {
  const stage = stageById(ctx.workflow, app.currentStageId)
  if (!stage || !hasRole(user, stage.roleId)) return false
  if (app.assignedToUserId) return app.assignedToUserId === user.id
  return stage.assignment === 'role_queue'
}

/** Earlier active stages the application may be returned to, with the suggested recipient. */
export function eligiblePreviousStages(ctx: WorkflowCtx, app: RegistrationApplication) {
  const st = activeStages(ctx.workflow)
  const idx = st.findIndex((s) => s.id === app.currentStageId)
  if (idx <= 0) return []
  const candidates = ctx.workflow.allowReturnToAnyPrevious ? st.slice(0, idx) : [st[idx - 1]!]
  return candidates.map((stage) => {
    const lastApprover = [...app.history].reverse().find((e) => e.action === 'approve' && e.fromStageId === stage.id)?.actorId
    const lastOk = ctx.users.find((u) => u.id === lastApprover && u.active && hasRole(u, stage.roleId))
    return { stage, userId: lastOk?.id ?? resolveAssignee(ctx, stage, app) }
  })
}

// ─── Availability ──────────────────────────────────────────────────────────

export function availableActions(ctx: WorkflowCtx, user: DemoUser, can: (p: string) => boolean, app: RegistrationApplication): ActionAvailability[] {
  if (!IN_WORKFLOW.includes(app.status)) return []
  const stage = stageById(ctx.workflow, app.currentStageId)
  if (!stage || !isStageResponsible(ctx, user, app)) return []
  const last = isLastStage(ctx.workflow, stage.id)
  const decidePerm = stage.kind === 'review' ? 'application.review' : 'application.approve'
  const waiting = app.status === 'Submitted' || app.status === 'Resubmitted'
  const needStart = waiting ? 'Start the review first.' : undefined
  const prev = eligiblePreviousStages(ctx, app)
  const list: ActionAvailability[] = [
    { action: 'start_review', label: 'Start review', permission: decidePerm, allowed: waiting, tone: 'primary' },
    { action: 'approve', label: stage.kind === 'review' ? 'Recommend & forward' : last ? 'Approve registration' : 'Approve', permission: decidePerm, allowed: !waiting, reason: needStart, tone: 'success' },
    { action: 'return_to_requester', label: 'Return to requester', permission: 'application.return_to_requester', allowed: !waiting, reason: needStart, tone: 'secondary' },
    { action: 'request_clarification', label: 'Request clarification', permission: 'application.request_clarification', allowed: !waiting, reason: needStart, tone: 'secondary' },
    {
      action: 'return_to_previous',
      label: 'Return to previous approver',
      permission: 'application.return_to_previous_approver',
      allowed: !waiting && prev.length > 0,
      reason: waiting ? needStart : prev.length === 0 ? 'This is the first stage — there is no previous approver.' : undefined,
      tone: 'secondary',
    },
    { action: 'reject', label: 'Reject', permission: 'application.reject', allowed: !waiting, reason: needStart, tone: 'danger' },
  ]
  return list.filter((a) => can(a.permission) && (a.action !== 'start_review' || waiting))
}

// ─── Transitions ───────────────────────────────────────────────────────────

function push(app: RegistrationApplication, e: Omit<WorkflowEvent, 'id' | 'at' | 'revision'> & { at?: string }) {
  app.history.push({ id: uid('wf'), at: e.at ?? new Date().toISOString(), revision: app.revision, ...e })
}

function enterStage(ctx: WorkflowCtx, app: RegistrationApplication, stage: WorkflowStageDef, status: ApplicationStatus, preferredUserId?: string) {
  const preferred = ctx.users.find((u) => u.id === preferredUserId && u.active && hasRole(u, stage.roleId))
  const assignee = preferred?.id ?? resolveAssignee(ctx, stage, app)
  const from = app.currentStageId
  app.currentStageId = stage.id
  app.assignedToUserId = assignee
  app.stageEnteredAt = new Date().toISOString()
  app.status = status
  push(app, { actorId: 'system', action: 'assign', fromStatus: status, toStatus: status, fromStageId: from, toStageId: stage.id, toUserId: assignee, visibility: 'public' })
  return assignee
}

const link = (app: RegistrationApplication) => `/app/applications/${app.id}`
const ownerLink = (app: RegistrationApplication) => `/app/my-applications/${app.id}`

export function applyReviewerAction(ctx: WorkflowCtx, app: RegistrationApplication, actor: DemoUser, can: (p: string) => boolean, action: ReviewerAction, input: ReviewerInput): TransitionResult {
  // Re-validate on every transition (defence in depth; production: server-side).
  const avail = availableActions(ctx, actor, can, app).find((a) => a.action === action)
  if (!avail) return { ok: false, error: 'You are not authorised to take this action at the current stage.' }
  if (!avail.allowed) return { ok: false, error: avail.reason ?? 'Action not available.' }
  const stage = stageById(ctx.workflow, app.currentStageId)!
  const from = app.status
  const remarks = input.remarks?.trim() || undefined
  const publicRemarks = input.publicRemarks?.trim() || undefined
  const notes: NotificationDraft[] = []
  const owner = app.applicantUserId ? [app.applicantUserId] : []
  app.updatedAt = new Date().toISOString()

  switch (action) {
    case 'start_review': {
      app.status = workingStatusFor(ctx.workflow, stage.id)
      app.assignedToUserId = actor.id
      push(app, { actorId: actor.id, action, fromStatus: from, toStatus: app.status, fromStageId: stage.id, toStageId: stage.id, toUserId: actor.id, visibility: 'public', remarks })
      notes.push({ title: `${app.ref}: ${stage.publicLabel} in progress`, body: 'Your customer application is being reviewed.', link: ownerLink(app), userIds: owner })
      return { ok: true, notifications: notes }
    }
    case 'approve': {
      // Next ACTIVE stage after the current one (the current stage may since have been deactivated).
      const pos = ctx.workflow.stages.findIndex((s) => s.id === stage.id)
      const next = ctx.workflow.stages.slice(pos + 1).find((s) => s.active)
      if (!next) {
        app.status = 'Approved'
        app.assignedToUserId = undefined
        push(app, { actorId: actor.id, action, fromStatus: from, toStatus: 'Approved', fromStageId: stage.id, remarks, publicRemarks, visibility: 'public' })
        app.currentStageId = undefined
        notes.push({ title: `${app.ref} approved`, body: 'Your customer application has been approved.', link: ownerLink(app), userIds: owner })
        notes.push({ title: `${app.companyName} approved`, body: `${app.ref} received final approval.`, link: link(app), audience: ['onboarding_approver', 'admin'] })
        return { ok: true, notifications: notes, finalApproved: true }
      }
      push(app, { actorId: actor.id, action, fromStatus: from, toStatus: 'Pending Approval', fromStageId: stage.id, toStageId: next.id, remarks, publicRemarks, visibility: 'public' })
      const assignee = enterStage(ctx, app, next, 'Pending Approval')
      notes.push({ title: `${app.ref} awaits your approval`, body: `${app.companyName} · ${next.name}`, link: link(app), userIds: assignee ? [assignee] : undefined, audience: assignee ? undefined : [next.roleId] })
      notes.push({ title: `${app.ref}: moved to ${next.publicLabel}`, body: `${stage.publicLabel} completed.`, link: ownerLink(app), userIds: owner })
      return { ok: true, notifications: notes }
    }
    case 'reject': {
      if (!publicRemarks || publicRemarks.length < MIN_REASON) return { ok: false, error: `A rejection reason of at least ${MIN_REASON} characters is required.` }
      app.status = 'Rejected'
      app.assignedToUserId = undefined
      push(app, { actorId: actor.id, action, fromStatus: from, toStatus: 'Rejected', fromStageId: stage.id, remarks, publicRemarks, visibility: 'public' })
      notes.push({ title: `${app.ref} was not approved`, body: publicRemarks, link: ownerLink(app), userIds: owner })
      return { ok: true, notifications: notes }
    }
    case 'return_to_requester':
    case 'request_clarification': {
      const type = action === 'return_to_requester' ? 'correction' : 'clarification'
      if (!publicRemarks || publicRemarks.length < MIN_REASON) return { ok: false, error: `Please describe what the applicant must ${type === 'correction' ? 'correct' : 'clarify'} (at least ${MIN_REASON} characters).` }
      const sections = type === 'correction' ? input.editableSections ?? [] : []
      if (type === 'correction' && sections.length === 0) return { ok: false, error: 'Select at least one section the applicant may edit.' }
      app.status = 'Returned for Information'
      app.assignedToUserId = undefined
      app.returnInfo = { type, fromStageId: stage.id, byUserId: actor.id, at: new Date().toISOString(), instructions: publicRemarks, editableSections: sections }
      push(app, { actorId: actor.id, action, fromStatus: from, toStatus: app.status, fromStageId: stage.id, toUserId: app.applicantUserId, remarks, publicRemarks, visibility: 'public' })
      notes.push({ title: type === 'correction' ? `${app.ref} returned for correction` : `${app.ref}: clarification requested`, body: publicRemarks, link: ownerLink(app), userIds: owner })
      return { ok: true, notifications: notes }
    }
    case 'return_to_previous': {
      if (!remarks || remarks.length < MIN_REASON) return { ok: false, error: `Findings of at least ${MIN_REASON} characters are required when returning to a previous approver.` }
      const target = eligiblePreviousStages(ctx, app).find((c) => c.stage.id === input.targetStageId)
      if (!target) return { ok: false, error: 'Choose an eligible previous stage.' }
      const toUser = ctx.users.find((u) => u.id === (input.targetUserId ?? target.userId) && u.active && hasRole(u, target.stage.roleId))?.id ?? target.userId
      const status = workingStatusFor(ctx.workflow, target.stage.id)
      push(app, { actorId: actor.id, action, fromStatus: from, toStatus: status, fromStageId: stage.id, toStageId: target.stage.id, toUserId: toUser, remarks, visibility: 'internal' })
      app.currentStageId = target.stage.id
      app.assignedToUserId = toUser
      app.stageEnteredAt = new Date().toISOString()
      app.status = status
      // Applicant-safe event: no internal findings, no staff names.
      push(app, { actorId: 'system', action: 'assign', fromStatus: status, toStatus: status, fromStageId: stage.id, toStageId: target.stage.id, toUserId: toUser, visibility: 'public' })
      notes.push({ title: `${app.ref} returned to you`, body: `${actor.name} (${stage.name}): ${remarks}`, link: link(app), userIds: toUser ? [toUser] : undefined, audience: toUser ? undefined : [target.stage.roleId] })
      return { ok: true, notifications: notes }
    }
  }
}

/** Internal review comment. Requires `application.comment`; recorded as an internal-only history event (no status change). */
export function addInternalComment(app: RegistrationApplication, actor: DemoUser, can: (p: string) => boolean, text: string): TransitionResult {
  if (!can('application.comment')) return { ok: false, error: 'You are not authorised to comment on applications.' }
  const remarks = text.trim()
  if (remarks.length < 3) return { ok: false, error: 'Enter a comment.' }
  if (app.status === 'Draft') return { ok: false, error: 'Drafts cannot be commented on.' }
  push(app, { actorId: actor.id, action: 'comment', fromStatus: app.status, toStatus: app.status, fromStageId: app.currentStageId, toStageId: app.currentStageId, remarks, visibility: 'internal' })
  return { ok: true, notifications: [] }
}

// ─── Applicant transitions ─────────────────────────────────────────────────

export function applicantCanEdit(app: RegistrationApplication, user: DemoUser, can: (p: string) => boolean) {
  if (app.applicantUserId !== user.id || !can('application.edit_own')) return false
  return app.status === 'Draft' || (app.status === 'Returned for Information' && app.returnInfo?.type === 'correction')
}

/** Submit a draft for the first time. */
export function submitDraft(ctx: WorkflowCtx, app: RegistrationApplication, actor: DemoUser): TransitionResult {
  if (app.status !== 'Draft') return { ok: false, error: 'Only drafts can be submitted.' }
  const first = activeStages(ctx.workflow)[0]
  if (!first) return { ok: false, error: 'No active workflow stage is configured. Contact the administrator.' }
  const now = new Date().toISOString()
  app.submittedAt = now
  app.updatedAt = now
  app.revisions.push({ revision: app.revision, submittedAt: now, content: contentOf(app) })
  push(app, { actorId: actor.id, action: 'submit', fromStatus: 'Draft', toStatus: 'Submitted', toStageId: first.id, visibility: 'public' })
  const assignee = enterStage(ctx, app, first, 'Submitted')
  return {
    ok: true,
    notifications: [{ title: 'New customer application', body: `${app.companyName} (${app.city}) submitted ${app.ref}.`, link: link(app), userIds: assignee ? [assignee] : undefined, audience: assignee ? undefined : [first.roleId] }],
  }
}

/** Resubmit after correction, or answer a clarification. */
export function resubmit(ctx: WorkflowCtx, app: RegistrationApplication, actor: DemoUser, note: string): TransitionResult {
  if (app.status !== 'Returned for Information' || !app.returnInfo) return { ok: false, error: 'This application is not waiting for your response.' }
  const ret = app.returnInfo
  const clarification = ret.type === 'clarification'
  if (clarification && note.trim().length < 5) return { ok: false, error: 'Please write your answer to the clarification request.' }
  const stage =
    ctx.workflow.resubmitRouting === 'first_stage' ? activeStages(ctx.workflow)[0] : stageById(ctx.workflow, ret.fromStageId)?.active ? stageById(ctx.workflow, ret.fromStageId) : activeStages(ctx.workflow)[0]
  if (!stage) return { ok: false, error: 'No active workflow stage is configured.' }
  const now = new Date().toISOString()
  if (!clarification) {
    app.revision += 1
    app.revisions.push({ revision: app.revision, submittedAt: now, content: contentOf(app) })
  }
  app.updatedAt = now
  push(app, { actorId: actor.id, action: clarification ? 'respond_clarification' : 'resubmit', fromStatus: 'Returned for Information', toStatus: 'Resubmitted', toStageId: stage.id, publicRemarks: note.trim() || undefined, visibility: 'public' })
  app.returnInfo = undefined
  const preferred = ctx.workflow.resubmitRouting === 'returning_stage' ? ret.byUserId : undefined
  const assignee = enterStage(ctx, app, stage, 'Resubmitted', preferred)
  return {
    ok: true,
    notifications: [{ title: `${app.ref} ${clarification ? 'clarification received' : `resubmitted (revision ${app.revision})`}`, body: note.trim() || `${app.companyName} responded to your request.`, link: link(app), userIds: assignee ? [assignee] : undefined, audience: assignee ? undefined : [stage.roleId] }],
  }
}

export function contentOf(app: ApplicationContent): ApplicationContent {
  const { companyName, legalName, crNumber, taxNumber, country, city, territoryId, website, businessType, annualVolumeBand, contact, requestedBrandIds, billingAddress, deliveryAddress } = app
  return structuredClone({ companyName, legalName, crNumber, taxNumber, country, city, territoryId, website, businessType, annualVolumeBand, contact, requestedBrandIds, billingAddress, deliveryAddress })
}

/** Human-readable list of fields that changed between two revisions. */
export function diffContent(a: ApplicationContent, b: ApplicationContent) {
  const flat = (c: ApplicationContent): Record<string, string> => ({
    'Trading name': c.companyName,
    'Legal name': c.legalName,
    'Commercial registration no.': c.crNumber,
    'Tax / VAT number': c.taxNumber,
    'Business type': c.businessType,
    'Annual volume': c.annualVolumeBand,
    Website: c.website ?? '',
    'Country / city': `${c.city}, ${c.country}`,
    Contact: `${c.contact.name} · ${c.contact.role} · ${c.contact.email} · ${c.contact.phone}`,
    'Requested brands': [...c.requestedBrandIds].sort().join(','),
    'Billing address': `${c.billingAddress.line1}, ${c.billingAddress.city}`,
    'Delivery address': `${c.deliveryAddress.line1}, ${c.deliveryAddress.city}`,
  })
  const fa = flat(a)
  const fb = flat(b)
  return Object.keys(fa).filter((k) => fa[k] !== fb[k]).map((k) => ({ field: k, before: fa[k]!, after: fb[k]! }))
}

export const ACTION_LABEL: Record<WorkflowActionType, string> = {
  save_draft: 'Draft saved',
  submit: 'Submitted',
  assign: 'Assigned',
  start_review: 'Review started',
  approve: 'Approved',
  reject: 'Rejected',
  return_to_requester: 'Returned to requester',
  request_clarification: 'Clarification requested',
  return_to_previous: 'Returned to previous approver',
  resubmit: 'Resubmitted',
  respond_clarification: 'Clarification provided',
  account_created: 'Customer account created',
  comment: 'Internal comment',
}
