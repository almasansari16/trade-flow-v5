import type { ApprovalRule, NotificationPreference, PromoRules } from '@/types/domain'

/** Illustrative tester/sample policy — editable in Administration › Workflow Rules. */
export const defaultPromoRules: PromoRules = {
  enabled: true,
  version: 'Draft v0.3 (illustrative)',
  testerPerUnits: 6,
  samplesPerBlock: 4,
  sampleBlockUnits: 12,
  sampleSizeMl: 1.2,
  eligibleCategories: ['Eau de Parfum', 'Extrait de Parfum', 'Eau de Toilette'],
}

/** Value bands decide how many approval levels a request needs (values in USD). */
export const defaultApprovalRules: ApprovalRule[] = [
  { id: 'ar-1', name: 'Standard request', minValueUsd: 0, maxValueUsd: 25_000, stages: ['Account Manager'], slaHours: 24, active: true },
  { id: 'ar-2', name: 'Elevated value', minValueUsd: 25_000, maxValueUsd: 100_000, stages: ['Account Manager', 'Head of Sales'], slaHours: 24, active: true },
  { id: 'ar-3', name: 'Strategic order', minValueUsd: 100_000, maxValueUsd: null, stages: ['Account Manager', 'Head of Sales'], slaHours: 48, active: true },
]

export const defaultNotificationPrefs: NotificationPreference[] = [
  { id: 'np-1', event: 'Request awaiting my approval', description: 'A sales order request enters an approval stage assigned to you.', inApp: true, email: true, roles: ['territory_sales_manager', 'regional_manager', 'head_of_sales'] },
  { id: 'np-2', event: 'Approval SLA breached', description: 'A request has waited longer than the configured SLA.', inApp: true, email: true, roles: ['territory_sales_manager', 'regional_manager', 'head_of_sales', 'operations_reviewer'] },
  { id: 'np-3', event: 'Request status changed', description: 'Approved, rejected or changes requested on a request you created.', inApp: true, email: true, roles: ['customer', 'operations_reviewer'] },
  { id: 'np-4', event: 'Proforma invoice issued', description: 'A proforma invoice is ready for payment.', inApp: true, email: true, roles: ['customer', 'finance'] },
  { id: 'np-5', event: 'Payment receipt uploaded', description: 'A customer uploaded proof of payment for verification.', inApp: true, email: false, roles: ['finance'] },
  { id: 'np-6', event: 'Ready for collection', description: 'Goods and documents are ready at the warehouse.', inApp: true, email: true, roles: ['customer', 'logistics'] },
  { id: 'np-7', event: 'New customer application', description: 'A new registration was submitted through the portal.', inApp: true, email: false, roles: ['onboarding_approver'] },
  { id: 'np-8', event: 'Integration failure', description: 'A record failed to synchronise with the ERP (simulated).', inApp: true, email: true, roles: ['admin', 'finance'] },
  { id: 'np-9', event: 'Customer application assigned to me', description: 'An application enters a workflow stage assigned to you (submitted, moved to next stage, resubmitted or returned to you).', inApp: true, email: true, roles: ['onboarding_approver'] },
  { id: 'np-10', event: 'Application returned to previous approver', description: 'A later approver sent the application back to your stage with findings.', inApp: true, email: true, roles: ['onboarding_approver'] },
  { id: 'np-11', event: 'Application progress (applicant)', description: 'Review started, moved to the next stage, approved or not approved.', inApp: true, email: true, roles: ['applicant'] },
  { id: 'np-12', event: 'Application returned for correction (applicant)', description: 'The reviewer needs corrections or a clarification from the applicant.', inApp: true, email: true, roles: ['applicant'] },
]
