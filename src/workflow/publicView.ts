/**
 * Applicant-safe projection of a customer application.
 *
 * This is the ONLY shape the public tracking page and the applicant portal timeline
 * receive. It deliberately excludes internal remarks, reviewer names, assignment
 * details, other applicants' data and document contents. In production this
 * projection must be produced by the server (the browser must never receive the
 * full record).
 */
import type { ApplicationSection, ApplicationStatus, RegistrationApplication, WorkflowDef } from '@/types/domain'
import { activeIndex, activeStages, stageById } from './engine'

export interface PublicTimelineItem {
  at: string
  label: string
  detail?: string
  tone: 'done' | 'current' | 'warning' | 'danger' | 'success'
}

export interface PublicApplicationView {
  ref: string
  companyName: string
  createdAt: string
  submittedAt?: string
  updatedAt: string
  status: ApplicationStatus
  headline: string
  explanation: string
  stage?: { label: string; number: number; total: number }
  /** Applicant-facing labels of the active workflow stages, in order. */
  stageLabels: string[]
  actionRequired?: { type: 'correction' | 'clarification' | 'draft'; instructions: string; sections: ApplicationSection[] }
  decision?: { outcome: 'Approved' | 'Rejected'; at: string; message?: string }
  remarks: { at: string; label: string; text: string }[]
  timeline: PublicTimelineItem[]
  documentCount: number
  revision: number
}

export const STATUS_COPY: Record<ApplicationStatus, { headline: string; explanation: string }> = {
  Draft: { headline: 'Draft — not yet submitted', explanation: 'The application has been saved but not submitted. Sign in to complete and submit it.' },
  Submitted: { headline: 'Submitted — waiting for review', explanation: 'Your application has been received and is queued for initial review.' },
  'Under Review': { headline: 'Under review', explanation: 'Our onboarding team is reviewing your information and documents.' },
  'Returned for Information': { headline: 'Action required — returned to you', explanation: 'The reviewer needs corrections or more information before the review can continue.' },
  Resubmitted: { headline: 'Resubmitted — waiting for review', explanation: 'Thank you. Your response has been received and is queued for review.' },
  'Pending Approval': { headline: 'Pending approval', explanation: 'Your application has passed review and is with the approval team.' },
  Approved: { headline: 'Approved', explanation: 'Your customer account has been approved. You can sign in to start ordering.' },
  Rejected: { headline: 'Not approved', explanation: 'Your application was not approved. See the reason below.' },
}

export function toPublicView(def: WorkflowDef, app: RegistrationApplication): PublicApplicationView {
  const stages = activeStages(def)
  const label = (id?: string) => stageById(def, id)?.publicLabel ?? 'Review'
  const timeline: PublicTimelineItem[] = []
  const remarks: PublicApplicationView['remarks'] = []

  for (const e of app.history) {
    if (e.visibility !== 'public') continue
    switch (e.action) {
      case 'save_draft':
        timeline.push({ at: e.at, label: 'Draft created', tone: 'done' })
        break
      case 'submit':
        timeline.push({ at: e.at, label: 'Application submitted', tone: 'done' })
        break
      case 'assign':
        timeline.push({ at: e.at, label: `Assigned for ${label(e.toStageId).toLowerCase()}`, tone: 'done' })
        break
      case 'start_review':
        timeline.push({ at: e.at, label: `${label(e.toStageId)} started`, tone: 'done' })
        break
      case 'approve':
        timeline.push({ at: e.at, label: e.toStatus === 'Approved' ? 'Final approval granted' : `${label(e.fromStageId)} completed`, tone: e.toStatus === 'Approved' ? 'success' : 'done' })
        if (e.publicRemarks) remarks.push({ at: e.at, label: label(e.fromStageId), text: e.publicRemarks })
        break
      case 'reject':
        timeline.push({ at: e.at, label: 'Application not approved', detail: e.publicRemarks, tone: 'danger' })
        break
      case 'return_to_requester':
        timeline.push({ at: e.at, label: 'Returned for correction', detail: e.publicRemarks, tone: 'warning' })
        if (e.publicRemarks) remarks.push({ at: e.at, label: 'Correction requested', text: e.publicRemarks })
        break
      case 'request_clarification':
        timeline.push({ at: e.at, label: 'Clarification requested', detail: e.publicRemarks, tone: 'warning' })
        if (e.publicRemarks) remarks.push({ at: e.at, label: 'Clarification requested', text: e.publicRemarks })
        break
      case 'resubmit':
        timeline.push({ at: e.at, label: `Application resubmitted (revision ${e.revision})`, detail: e.publicRemarks, tone: 'done' })
        break
      case 'respond_clarification':
        timeline.push({ at: e.at, label: 'Clarification provided', detail: e.publicRemarks, tone: 'done' })
        break
      case 'account_created':
        timeline.push({ at: e.at, label: 'Customer account activated', tone: 'success' })
        break
    }
  }
  const last = timeline[timeline.length - 1]
  if (last && ['Submitted', 'Under Review', 'Resubmitted', 'Pending Approval'].includes(app.status)) last.tone = 'current'

  const idx = activeIndex(def, app.currentStageId)
  const finalEvent = [...app.history].reverse().find((e) => e.action === 'reject' || (e.action === 'approve' && e.toStatus === 'Approved'))
  const copy = STATUS_COPY[app.status]

  return {
    ref: app.ref,
    companyName: app.companyName,
    createdAt: app.createdAt,
    submittedAt: app.submittedAt,
    updatedAt: app.updatedAt,
    status: app.status,
    headline: app.status === 'Returned for Information' && app.returnInfo?.type === 'clarification' ? 'Action required — clarification requested' : copy.headline,
    explanation: copy.explanation,
    stage: idx >= 0 && !['Approved', 'Draft'].includes(app.status) ? { label: label(app.currentStageId), number: idx + 1, total: stages.length } : undefined,
    stageLabels: stages.map((s) => s.publicLabel),
    actionRequired:
      app.status === 'Returned for Information' && app.returnInfo
        ? { type: app.returnInfo.type, instructions: app.returnInfo.instructions, sections: app.returnInfo.editableSections }
        : app.status === 'Draft'
          ? { type: 'draft', instructions: 'Complete the remaining steps and submit your application.', sections: [] }
          : undefined,
    decision: finalEvent && (app.status === 'Approved' || app.status === 'Rejected') ? { outcome: app.status, at: finalEvent.at, message: finalEvent.publicRemarks } : undefined,
    remarks,
    timeline,
    documentCount: app.documents.filter((d) => !d.supersededAt).length,
    revision: app.revision,
  }
}
