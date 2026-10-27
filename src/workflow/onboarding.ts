/**
 * Default customer-onboarding workflow (conceptually the `workflow_stages` table).
 * Editable at runtime in Administration › Workflow Rules › Customer onboarding.
 * Default: a single approval stage owned by the Customer Onboarding Approver. The optional
 * stages can be switched on (their roles first need the application approval permission).
 */
import type { WorkflowDef } from '@/types/domain'

export const ONBOARDING_WORKFLOW_ID = 'customer_onboarding'

export const defaultOnboardingWorkflow: WorkflowDef = {
  id: ONBOARDING_WORKFLOW_ID,
  name: 'Customer onboarding',
  resubmitRouting: 'returning_stage',
  allowReturnToAnyPrevious: true,
  stages: [
    {
      id: 'initial_review',
      name: 'Onboarding review & approval',
      publicLabel: 'Onboarding review',
      kind: 'approval',
      roleId: 'onboarding_approver',
      assignment: 'review_region',
      slaHours: 48,
      active: true,
    },
    {
      id: 'credit_check',
      name: 'Credit & compliance check (optional)',
      publicLabel: 'Credit check',
      kind: 'approval',
      roleId: 'finance',
      assignment: 'role_queue',
      slaHours: 48,
      active: false,
    },
    {
      id: 'commercial_approval',
      name: 'Commercial approval (optional)',
      publicLabel: 'Commercial approval',
      kind: 'approval',
      roleId: 'territory_sales_manager',
      assignment: 'territory_sales_manager',
      slaHours: 48,
      active: false,
    },
    {
      id: 'final_approval',
      name: 'Final approval (optional)',
      publicLabel: 'Final approval',
      kind: 'approval',
      roleId: 'head_of_sales',
      assignment: 'role_queue',
      slaHours: 72,
      active: false,
    },
  ],
}

export const SECTION_LABELS = {
  company: 'Company details',
  contact: 'Contact & territory',
  brands: 'Requested brands',
  addresses: 'Billing & delivery addresses',
  documents: 'Supporting documents',
} as const
