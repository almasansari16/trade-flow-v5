import type { SalesOrderRequest } from '@/types/domain'

/**
 * Status shown in lists. Keeps the internal-approval status and the SAP status distinct:
 * - "Under Review" = pending at an escalated (second or later) approval level
 * - an Approved request shows its SAP submission status until a proforma is issued.
 */
export function displayStatus(r: SalesOrderRequest): string {
  if (r.status === 'Pending Approval') {
    const idx = r.approvalSteps.findIndex((s) => s.status === 'Pending')
    return idx > 0 ? 'Under Review' : 'Pending Approval'
  }
  if (r.status === 'Approved' && r.sap) return r.sap.status
  return r.status
}

/** Has SAP accepted the order (a sales document exists)? */
export const sentToSap = (r: SalesOrderRequest) => !!r.sap?.documentNumber

export const APPROVED_OR_LATER = ['Approved', 'Awaiting Payment', 'Payment Verified', 'In Fulfillment', 'Ready for Collection', 'Collected'] as const
