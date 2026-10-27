/**
 * SAP-side documents as TradeFlow receives them through the integration layer.
 *
 * SAP is the system of record for sales orders, outbound deliveries, billing
 * documents (invoices / credit memos), posted payments and the customer
 * account (open items, ledger, aging). TradeFlow only displays these records;
 * it never creates or edits them locally. Field names are integration-neutral
 * so the BFF can map whichever released SAP API the SAP team selects.
 */
import type { CurrencyCode, ID, ISODate } from './domain'

/** Where a record came from — shown in the UI so mock data is never presented as live SAP. */
export type SapSourceMode = 'mock' | 'live'

export interface SapEnvelope {
  mode: SapSourceMode
  /** When the integration layer last read this data from SAP. */
  syncedAt: ISODate
}

// ─── Sales orders ─────────────────────────────────────────────────────────

/** Overall SAP sales order status (derived by SAP from delivery and billing progress). */
export type SapOrderStatus = 'Open' | 'In Process' | 'Partially Delivered' | 'Fully Delivered' | 'Completed' | 'Cancelled'
export type SapDeliveryProgress = 'Not Delivered' | 'Partially Delivered' | 'Fully Delivered'
export type SapBillingProgress = 'Not Billed' | 'Partially Billed' | 'Fully Billed'

export interface SapSalesOrderItem {
  itemNo: number
  productId: ID
  /** SAP material number (mapped from the TradeFlow product). */
  material: string
  description: string
  uom: string
  orderedQty: number
  confirmedQty: number
  deliveredQty: number
  billedQty: number
  netPrice: number
  netValue: number
}

export interface SapSalesOrder {
  soNumber: string
  /** SAP sold-to business partner. */
  soldTo: string
  customerId: ID
  /** TradeFlow request reference — absent for orders created directly in SAP. */
  requestRef?: string
  requestId?: ID
  idempotencyKey?: string
  createdAt: ISODate
  requestedDeliveryDate?: ISODate
  customerReference?: string
  currency: CurrencyCode
  netValue: number
  taxValue: number
  paymentTerms: string
  shipTo: string
  status: SapOrderStatus
  deliveryStatus: SapDeliveryProgress
  billingStatus: SapBillingProgress
  items: SapSalesOrderItem[]
}

// ─── Deliveries ──────────────────────────────────────────────────────────

/** Outbound delivery status: picking/packing → goods issue posted → proof of delivery. */
export type SapDeliveryStatus = 'In Picking' | 'Goods Issued' | 'Delivered' | 'Cancelled'

export interface SapDeliveryItem {
  itemNo: number
  soItemNo: number
  productId: ID
  material: string
  description: string
  qty: number
  uom: string
}

export interface SapDelivery {
  deliveryNumber: string
  soNumber: string
  soldTo: string
  customerId: ID
  createdAt: ISODate
  plannedDate: ISODate
  goodsIssueDate?: ISODate
  deliveredDate?: ISODate
  status: SapDeliveryStatus
  shipTo: string
  carrier?: string
  trackingRef?: string
  items: SapDeliveryItem[]
}

/** Delivery as listed for a customer: SAP fields + quantities still open on the order. */
export interface SapDeliveryView extends SapDelivery {
  /** Per sales-order item: quantity ordered but not yet delivered (across all deliveries). */
  pendingQty: Record<number, number>
}

// ─── Billing documents ───────────────────────────────────────────────────

export type SapBillingType = 'Invoice' | 'Credit Memo'
export type SapInvoiceStatus = 'Open' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled'

export interface SapInvoiceItem {
  itemNo: number
  productId?: ID
  material?: string
  description: string
  qty: number
  uom: string
  unitPrice: number
  netValue: number
  taxRate: number
  taxValue: number
}

export interface SapInvoice {
  invoiceNumber: string
  type: SapBillingType
  soldTo: string
  customerId: ID
  invoiceDate: ISODate
  dueDate: ISODate
  soNumber?: string
  deliveryNumber?: string
  customerReference?: string
  currency: CurrencyCode
  netValue: number
  taxValue: number
  grossValue: number
  paymentTerms: string
  items: SapInvoiceItem[]
  /** Set when SAP reversed/cancelled the document. */
  cancelledBy?: string
  cancelledAt?: ISODate
  /** Whether SAP exposes an official PDF output for this document. */
  hasOfficialDocument: boolean
}

export interface SapAllocation {
  /** Clearing document (payment or credit memo) that reduced this invoice. */
  document: string
  type: 'Payment' | 'Credit Memo'
  date: ISODate
  amount: number
}

/** Invoice enriched with open-item information from SAP accounting. */
export interface SapInvoiceView extends SapInvoice {
  amountPaid: number
  creditsApplied: number
  outstanding: number
  status: SapInvoiceStatus
  daysOverdue: number
  allocations: SapAllocation[]
}

// ─── Payments ────────────────────────────────────────────────────────────

export interface SapPayment {
  paymentDoc: string
  soldTo: string
  customerId: ID
  paymentDate: ISODate
  postingDate: ISODate
  reference: string
  method: 'Bank Transfer' | 'Cheque' | 'Letter of Credit' | 'Card'
  amount: number
  currency: CurrencyCode
  allocations: { invoiceNumber: string; amount: number }[]
  reversed?: boolean
}

export type SapPaymentStatus = 'Fully Allocated' | 'Partially Allocated' | 'Unallocated' | 'Reversed'

export interface SapPaymentView extends SapPayment {
  allocated: number
  unallocated: number
  status: SapPaymentStatus
}

// ─── Customer account ────────────────────────────────────────────────────

export type LedgerEntryType = 'Invoice' | 'Credit Memo' | 'Payment' | 'Invoice Cancellation' | 'Payment Reversal'

export interface LedgerEntry {
  postingDate: ISODate
  documentDate: ISODate
  documentNumber: string
  reference: string
  type: LedgerEntryType
  description: string
  debit: number
  credit: number
  /** Running balance after this entry (debit positive = customer owes). */
  balance: number
}

export interface LedgerPage extends SapEnvelope {
  customerId: ID
  soldTo: string
  currency: CurrencyCode
  from: ISODate
  to: ISODate
  openingBalance: number
  closingBalance: number
  totalDebit: number
  totalCredit: number
  entries: LedgerEntry[]
  total: number
  page: number
  pageSize: number
}

export type AgingBucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus'

export interface AgingLine {
  invoiceNumber: string
  invoiceDate: ISODate
  dueDate: ISODate
  outstanding: number
  daysOverdue: number
  bucket: AgingBucketKey
}

export interface AgingReport extends SapEnvelope {
  customerId: ID
  currency: CurrencyCode
  /** Reference date the days overdue are measured against. */
  asOf: ISODate
  /** How the integration layer obtained the buckets. */
  basis: string
  buckets: { key: AgingBucketKey; label: string; amount: number; count: number }[]
  total: number
  lines: AgingLine[]
}

export interface OutstandingLine {
  invoiceNumber: string
  type: SapBillingType
  invoiceDate: ISODate
  dueDate: ISODate
  original: number
  applied: number
  outstanding: number
  daysOutstanding: number
  overdue: boolean
}

export interface OutstandingReport extends SapEnvelope {
  customerId: ID
  currency: CurrencyCode
  asOf: ISODate
  lines: OutstandingLine[]
  totals: { original: number; applied: number; outstanding: number; current: number; overdue: number }
  /** Payments on account not yet allocated to an invoice (reduce the net balance). */
  unallocatedPayments: number
  /** Ledger balance = open items − unallocated payments. */
  netBalance: number
}

export interface FinancialSummary extends SapEnvelope {
  customerId: ID
  currency: CurrencyCode
  totalOutstanding: number
  totalOverdue: number
  openInvoices: number
  partiallyPaidInvoices: number
  recentPayments: { count: number; amount: number; days: number }
  unallocatedPayments: number
  /** Only when SAP credit management exposes it and the viewer may see it. */
  credit?: { limit: number; exposure: number; available: number }
}

export interface Paged<T> extends SapEnvelope {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Errors the integration layer can return. Messages are customer-safe; codes are for internal users. */
export type SapErrorCode = 'SAP_UNAVAILABLE' | 'NOT_FOUND' | 'NOT_AUTHORIZED' | 'NOT_MAPPED' | 'VALIDATION'

export class SapServiceError extends Error {
  code: SapErrorCode
  constructor(code: SapErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'SapServiceError'
  }
}
