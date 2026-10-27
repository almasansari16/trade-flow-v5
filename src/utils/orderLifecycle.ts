import type { SalesOrderRequest } from '@/types/domain'
import type { SapSalesOrder } from '@/types/sap'

/**
 * One status per stage — never a single field for the whole cycle.
 * The order status combines the TradeFlow request (before SAP) with SAP's own order status (after).
 */
export function orderStatus(r: SalesOrderRequest | undefined, so: SapSalesOrder | undefined, internal: boolean): string {
  if (so) return so.status === 'Open' ? 'Sales Order Created' : so.status
  if (!r) return '—'
  if (r.status === 'Pending Approval' || r.status === 'Submitted') return 'Pending Approval'
  if (r.status === 'Returned for Clarification' || r.status === 'Cancelled' || r.status === 'Rejected') return r.status
  if (r.sap?.documentNumber) return 'Sales Order Created'
  if (r.sap?.status === 'SAP Creation Failed') return internal ? 'SAP Creation Failed' : 'Pending SAP Creation'
  if (r.sap) return 'Pending SAP Creation'
  return r.status === 'Approved' ? 'Approved' : r.status
}

export const LIFECYCLE = ['Request submitted', 'Approved', 'Sales order created', 'Delivered', 'Receipt confirmed', 'Invoiced', 'Paid'] as const
