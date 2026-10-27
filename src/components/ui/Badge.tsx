import type { ReactNode } from 'react'
import { FlaskConical } from 'lucide-react'
import { cn } from '@/utils/cn'

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'dark'

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  primary: 'bg-primary-50 text-primary-700 ring-primary-100',
  success: 'bg-success-50 text-success-700 ring-teal-200/70',
  warning: 'bg-warning-50 text-warning-700 ring-amber-200/80',
  danger: 'bg-danger-50 text-danger-700 ring-red-200/80',
  info: 'bg-info-50 text-info-700 ring-blue-200/70',
  dark: 'bg-midnight text-white ring-midnight',
}

const dots: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  dark: 'bg-white',
}

export function Badge({ tone = 'neutral', dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', tones[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} aria-hidden />}
      {children}
    </span>
  )
}

const STATUS_TONES: Record<string, Tone> = {
  // requests
  Draft: 'neutral',
  Submitted: 'info',
  'Pending Approval': 'warning',
  'Returned for Clarification': 'warning',
  Approved: 'success',
  Rejected: 'danger',
  'Awaiting Payment': 'warning',
  'Payment Verified': 'success',
  'In Fulfillment': 'primary',
  'Ready for Collection': 'primary',
  Collected: 'success',
  Cancelled: 'neutral',
  // SAP submission (separate from internal approval)
  'Pending SAP Creation': 'warning',
  'Submitted to SAP': 'info',
  'SAP Creation Failed': 'danger',
  'Sales Order Created': 'success',
  'Not Submitted': 'neutral',
  'Accepted for processing': 'info',
  // SAP order / delivery / billing
  'In Process': 'primary',
  'Partially Delivered': 'warning',
  'Fully Delivered': 'success',
  Completed: 'success',
  'Not Delivered': 'neutral',
  'Not Billed': 'neutral',
  'Partially Billed': 'warning',
  'Fully Billed': 'success',
  'In Picking': 'info',
  'Goods Issued': 'primary',
  Delivered: 'success',
  'Not yet shipped': 'neutral',
  'Awaiting confirmation': 'warning',
  'Received in full': 'success',
  'Received with discrepancy': 'warning',
  'Discrepancy open': 'danger',
  Paid: 'success',
  Current: 'success',
  'Fully Allocated': 'success',
  'Partially Allocated': 'warning',
  Unallocated: 'warning',
  Reversed: 'neutral',
  // approvals
  Pending: 'warning',
  Waiting: 'neutral',
  // customers / applications
  Active: 'success',
  'Pending Review': 'warning',
  'On Hold': 'warning',
  Blocked: 'danger',
  'Under Review': 'info',
  'Returned for Information': 'warning',
  Resubmitted: 'info',
  Returned: 'warning',
  Inactive: 'neutral',
  // finance
  Issued: 'info',
  'Receipt Uploaded': 'primary',
  'Partially Paid': 'warning',
  Overdue: 'danger',
  'Awaiting Receipt': 'neutral',
  'Under Verification': 'info',
  Verified: 'success',
  // logistics
  'Ready for Warehouse Preparation': 'info',
  'Documents in Progress': 'primary',
  // documents
  Final: 'success',
  Expired: 'danger',
  // follow-up
  Open: 'info',
  'Due Today': 'warning',
  Done: 'success',
  None: 'neutral',
  // integration
  Synced: 'success',
  Failed: 'danger',
  Retrying: 'info',
  Operational: 'success',
  Degraded: 'warning',
  Down: 'danger',
  // stock
  'In Stock': 'success',
  'Low Stock': 'warning',
  'Out of Stock': 'danger',
  'Pre-order': 'info',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'} dot className={className}>
      {status}
    </Badge>
  )
}

/** Clear marker for values or actions that are illustrative only. */
export function DemoTag({ children = 'Demo data', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary-50/60 px-1.5 py-0.5 text-[11px] font-medium text-primary-700', className)}>
      <FlaskConical className="size-3" aria-hidden />
      {children}
    </span>
  )
}
