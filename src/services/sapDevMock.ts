/**
 * DEVELOPMENT-MODE STAND-IN FOR SAP (via the future integration layer / BFF).
 *
 * Nothing here talks to SAP. This module plays the role of "SAP + the integration
 * layer" so every portal screen can be built and tested against realistic documents:
 * sales orders, outbound deliveries, billing documents, posted payments and the
 * customer account (open items, ledger, aging).
 *
 * Rules it follows so the UI behaves exactly as it must with the real integration:
 *  - Every read takes an access context (the customers the signed-in principal may see).
 *    Records are filtered by SAP sold-to BP, resolved through the customer ↔ BP mapping.
 *    Production: the BFF derives this from the server session — never from a client parameter.
 *  - Document numbers are prefixed MOCK- so they can never be mistaken for SAP numbers.
 *  - Sales-order creation is idempotent on the TradeFlow request id.
 *  - Open items, ledger, outstanding and aging are all derived from the same documents,
 *    so they reconcile with each other (the BFF must do the same with SAP data, or use
 *    SAP's own aging output).
 *  - Records live in this browser's localStorage under a key separate from TradeFlow's
 *    own state, to keep "SAP" and "TradeFlow" data visibly apart.
 */
import type { Customer, CurrencyCode, Product } from '@/types/domain'
import {
  SapServiceError,
  type AgingBucketKey,
  type AgingReport,
  type FinancialSummary,
  type LedgerEntry,
  type LedgerPage,
  type OutstandingReport,
  type Paged,
  type SapAllocation,
  type SapDelivery,
  type SapDeliveryView,
  type SapInvoice,
  type SapInvoiceView,
  type SapPayment,
  type SapPaymentView,
  type SapSalesOrder,
  type SapSalesOrderItem,
} from '@/types/sap'
import { customers as seedCustomers } from '@/data/customers'
import { products as seedProducts } from '@/data/catalog'
import { salesOrderRequests } from '@/data/transactions'
import { fromUsd, roundMoney } from '@/utils/fx'

// ─── Configuration (wired to TradeFlow state by the store) ──────────────

let getCustomers: () => Customer[] = () => seedCustomers
let getProducts: () => Product[] = () => seedProducts
export function configureSapDevMock(cfg: { customers: () => Customer[]; products: () => Product[] }) {
  getCustomers = cfg.customers
  getProducts = cfg.products
}

/** The customers the current principal may see. Built by the caller from the authenticated session. */
export interface SapAccessContext {
  customerIds: string[]
}

// ─── Storage ─────────────────────────────────────────────────────────────

interface Db {
  version: number
  salesOrders: SapSalesOrder[]
  deliveries: SapDelivery[]
  invoices: (SapInvoice & { appliesTo?: string })[]
  payments: SapPayment[]
  /** Idempotency registry: TradeFlow request id → SAP sales order number. */
  idempotency: Record<string, string>
  credit: Record<string, number>
  seq: { so: number; dl: number; inv: number; pay: number }
  available: boolean
  failNext: null | 'timeout' | 'timeout_after_commit'
}

const KEY = 'tradeflow-sap-devmock'
const VERSION = 1
const DAY = 86_400_000
const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const dayIso = (offset: number) => new Date(startOfToday() + offset * DAY + 9 * 3_600_000).toISOString()
const r2 = (n: number) => Math.round(n * 100) / 100

const TAX_BY_COUNTRY: Record<string, number> = {
  'United Arab Emirates': 5, Oman: 5, 'Saudi Arabia': 15, Qatar: 0, Kuwait: 0, Bahrain: 10,
  'United Kingdom': 20, France: 20, Germany: 19, Netherlands: 21, Singapore: 9, Pakistan: 18, Kenya: 16,
}
const termsDays = (terms: string) => Number(/Net (\d+)/i.exec(terms)?.[1] ?? 0)

let memory: Db | null = null
function load(): Db {
  if (memory) return memory
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed.version === VERSION) return (memory = parsed)
    }
  } catch {
    /* unavailable storage — fall back to seed */
  }
  memory = seed()
  save()
  return memory
}
function save() {
  try {
    if (memory && typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    /* ignore */
  }
}
export function resetSapDevMock() {
  memory = seed()
  save()
}

// ─── Seed ────────────────────────────────────────────────────────────────

function seed(): Db {
  const db: Db = { version: VERSION, salesOrders: [], deliveries: [], invoices: [], payments: [], idempotency: {}, credit: { '0010021': 1_500_000, '0010034': 2_000_000 }, seq: { so: 7000, dl: 8000, inv: 9000, pay: 5000 }, available: true, failNext: null }
  const cust = (id: string) => seedCustomers.find((c) => c.id === id)!
  const prod = (id: string) => seedProducts.find((p) => p.id === id)!

  const order = (customerId: string, daysAgo: number, lines: [string, number][], opts: { soNumber?: string; requestRef?: string; requestId?: string; prices?: Record<string, number> } = {}) => {
    const c = cust(customerId)
    const items: SapSalesOrderItem[] = lines.map(([pid, qty], i) => {
      const p = prod(pid)
      const price = opts.prices?.[pid] ?? roundMoney(fromUsd(p.unitPriceUsd, c.currency))
      return { itemNo: (i + 1) * 10, productId: pid, material: p.sapMaterial, description: p.name, uom: p.uom, orderedQty: qty, confirmedQty: qty, deliveredQty: 0, billedQty: 0, netPrice: price, netValue: r2(price * qty) }
    })
    const net = r2(items.reduce((s, i) => s + i.netValue, 0))
    const so: SapSalesOrder = {
      soNumber: opts.soNumber ?? `MOCK-SO-${++db.seq.so}`, soldTo: c.sapBusinessPartner!, customerId, requestRef: opts.requestRef, requestId: opts.requestId, idempotencyKey: opts.requestId,
      createdAt: dayIso(-daysAgo), requestedDeliveryDate: dayIso(-daysAgo + 14), currency: c.currency, netValue: net, taxValue: r2((net * (TAX_BY_COUNTRY[c.country] ?? 0)) / 100),
      paymentTerms: c.paymentTerms, shipTo: `${c.deliveryAddress.line1}, ${c.deliveryAddress.city}`, status: 'Open', deliveryStatus: 'Not Delivered', billingStatus: 'Not Billed', items,
    }
    db.salesOrders.push(so)
    if (opts.requestId) db.idempotency[opts.requestId] = so.soNumber
    return so
  }
  const deliver = (so: SapSalesOrder, daysAgo: number, portion: 'rest' | number, status: SapDelivery['status'] = 'Delivered') => {
    const d = createDelivery(db, so, portion === 'rest' ? 1 : portion, dayIso(-daysAgo))
    if (!d) return undefined
    d.status = status
    if (status !== 'In Picking') d.goodsIssueDate = dayIso(-daysAgo)
    if (status === 'Delivered') d.deliveredDate = dayIso(-daysAgo + 2)
    recalcOrder(db, so)
    return d
  }
  const bill = (so: SapSalesOrder, d: SapDelivery | undefined, daysAgo: number) => createInvoice(db, so, d, dayIso(-daysAgo))!
  const pay = (customerId: string, daysAgo: number, amount: number, alloc: [SapInvoice | undefined, number][], reference: string, method: SapPayment['method'] = 'Bank Transfer') => {
    const c = cust(customerId)
    db.payments.push({ paymentDoc: `MOCK-PAY-${++db.seq.pay}`, soldTo: c.sapBusinessPartner!, customerId, paymentDate: dayIso(-daysAgo - 1), postingDate: dayIso(-daysAgo), reference, method, amount, currency: c.currency, allocations: alloc.filter(([i]) => i).map(([i, a]) => ({ invoiceNumber: i!.invoiceNumber, amount: a })) })
  }
  const gross = (i: SapInvoice) => i.grossValue

  // ── Gulf Horizon Trading (c-001): orders created directly in SAP before the portal, plus portal orders
  const a = order('c-001', 175, [['p-01', 240], ['p-05', 120]])
  const ia = bill(a, deliver(a, 170, 'rest'), 168)
  pay('c-001', 140, gross(ia), [[ia, gross(ia)]], 'GHT TT 0412')

  const b = order('c-001', 135, [['p-10', 180], ['p-18', 120], ['p-22', 120]])
  const ib = bill(b, deliver(b, 130, 'rest'), 128)
  pay('c-001', 90, 20_000, [[ib, 20_000]], 'GHT TT 0533')

  const c = order('c-001', 100, [['p-04', 600], ['p-12', 240]])
  const ic = bill(c, deliver(c, 97, 'rest'), 95)
  const cm = creditMemo(db, ic, 'Damaged cartons on delivery — 30 × Solstice', 30, 'p-12', dayIso(-80))

  const d = order('c-001', 62, [['p-14', 144], ['p-16', 96]])
  const dd = deliver(d, 58, 'rest')
  const idWrong = bill(d, dd, 56)
  cancelInvoice(db, idWrong, dayIso(-55)) // wrong price on first billing → cancelled and re-billed
  const idRight = createInvoice(db, d, dd, dayIso(-55), true)!
  pay('c-001', 30, gross(idRight), [[idRight, gross(idRight)]], 'GHT TT 0611')

  const e = order('c-001', 82, [['p-09', 160], ['p-21', 60]])
  bill(e, deliver(e, 78, 'rest'), 76)

  // Portal request SOR-2026-0118 (collected): two partial deliveries, two invoices, partial payment
  const r118 = salesOrderRequests.find((r) => r.id === 'r-118')!
  const s118 = order('c-001', 40, r118.lines.map((l) => [l.productId, l.quantity]), { soNumber: r118.sap!.documentNumber, requestRef: r118.ref, requestId: r118.id, prices: Object.fromEntries(r118.lines.map((l) => [l.productId, l.unitPrice])) })
  const d118a = deliver(s118, 36, 0.6)
  const i118a = bill(s118, d118a, 35)
  const d118b = deliver(s118, 29, 'rest')
  bill(s118, d118b, 29)
  pay('c-001', 20, r2(gross(i118a) * 0.5), [[i118a, r2(gross(i118a) * 0.5)]], 'GHT TT 0702')
  pay('c-001', 6, 10_000, [], 'GHT TT 0745 (on account)') // payment on account, not yet allocated
  void cm

  // Remaining portal requests that SAP accepted: open orders with partial progress
  const portal = (id: string) => {
    const r = salesOrderRequests.find((x) => x.id === id)!
    return order(r.customerId, Math.max(1, Math.round((Date.now() - new Date(r.createdAt).getTime()) / DAY) - 1), r.lines.map((l) => [l.productId, l.quantity]), { soNumber: r.sap!.documentNumber, requestRef: r.ref, requestId: r.id, prices: Object.fromEntries(r.lines.map((l) => [l.productId, l.unitPrice])) })
  }
  portal('r-131')
  const s124 = portal('r-124')
  deliver(s124, 4, 'rest', 'In Picking')
  const s126 = portal('r-126')
  deliver(s126, 6, 0.5, 'Goods Issued')
  portal('r-129')
  portal('r-133')

  // ── Al Noor (c-002): history in SAP — used to prove customer isolation
  const n1 = order('c-002', 90, [['p-05', 300], ['p-07', 120]])
  const in1 = bill(n1, deliver(n1, 85, 'rest'), 84)
  pay('c-002', 40, gross(in1), [[in1, gross(in1)]], 'ANP-RIY-2207')
  const n2 = order('c-002', 50, [['p-01', 240]])
  bill(n2, deliver(n2, 46, 'rest'), 45)

  for (const so of db.salesOrders) recalcOrder(db, so)
  return db
}

// ─── Document mechanics (shared by seed and simulator) ───────────────────

function recalcOrder(db: Db, so: SapSalesOrder) {
  const dls = db.deliveries.filter((d) => d.soNumber === so.soNumber && d.status !== 'Cancelled')
  const bills = db.invoices.filter((i) => i.soNumber === so.soNumber && i.type === 'Invoice' && !i.cancelledBy)
  for (const it of so.items) {
    it.deliveredQty = dls.filter((d) => d.status !== 'In Picking').flatMap((d) => d.items).filter((x) => x.soItemNo === it.itemNo).reduce((s, x) => s + x.qty, 0)
    it.billedQty = bills.flatMap((b) => b.items).filter((x) => x.productId === it.productId).reduce((s, x) => s + x.qty, 0)
  }
  if (so.status === 'Cancelled') return
  const ordered = so.items.reduce((s, i) => s + i.confirmedQty, 0)
  const delivered = so.items.reduce((s, i) => s + Math.min(i.deliveredQty, i.confirmedQty), 0)
  const billed = so.items.reduce((s, i) => s + Math.min(i.billedQty, i.confirmedQty), 0)
  so.deliveryStatus = delivered === 0 ? 'Not Delivered' : delivered >= ordered ? 'Fully Delivered' : 'Partially Delivered'
  so.billingStatus = billed === 0 ? 'Not Billed' : billed >= ordered ? 'Fully Billed' : 'Partially Billed'
  so.status =
    so.deliveryStatus === 'Fully Delivered' && so.billingStatus === 'Fully Billed' ? 'Completed'
      : so.deliveryStatus === 'Fully Delivered' ? 'Fully Delivered'
      : so.deliveryStatus === 'Partially Delivered' ? 'Partially Delivered'
      : dls.length ? 'In Process'
      : 'Open'
}

/** Creates a delivery for `share` (0–1) of every item's undelivered, confirmed quantity. */
function createDelivery(db: Db, so: SapSalesOrder, share: number, at: string): SapDelivery | undefined {
  const already = (itemNo: number) => db.deliveries.filter((d) => d.soNumber === so.soNumber && d.status !== 'Cancelled').flatMap((d) => d.items).filter((x) => x.soItemNo === itemNo).reduce((s, x) => s + x.qty, 0)
  const items = so.items
    .map((it) => {
      const open = it.confirmedQty - already(it.itemNo)
      const qty = share >= 1 ? open : Math.min(open, Math.max(1, Math.round((open * share) / 6) * 6))
      return { itemNo: it.itemNo, soItemNo: it.itemNo, productId: it.productId, material: it.material, description: it.description, qty, uom: it.uom }
    })
    .filter((x) => x.qty > 0)
  if (!items.length) return undefined
  const d: SapDelivery = { deliveryNumber: `MOCK-DL-${++db.seq.dl}`, soNumber: so.soNumber, soldTo: so.soldTo, customerId: so.customerId, createdAt: at, plannedDate: new Date(new Date(at).getTime() + 2 * DAY).toISOString(), status: 'In Picking', shipTo: so.shipTo, carrier: 'Customer forwarder', items }
  db.deliveries.push(d)
  return d
}

/** Bills the goods-issued, not-yet-billed quantity (of one delivery, or of the whole order). */
function createInvoice(db: Db, so: SapSalesOrder, d: SapDelivery | undefined, at: string, rebill = false): SapInvoice | undefined {
  const c = getCustomers().find((x) => x.id === so.customerId) ?? seedCustomers.find((x) => x.id === so.customerId)!
  const rate = TAX_BY_COUNTRY[c.country] ?? 0
  const source = d ? [d] : db.deliveries.filter((x) => x.soNumber === so.soNumber && (x.status === 'Goods Issued' || x.status === 'Delivered'))
  const billedFor = (dn: string) => db.invoices.some((i) => i.deliveryNumber === dn && i.type === 'Invoice' && !i.cancelledBy)
  const lines = source.filter((x) => rebill || !billedFor(x.deliveryNumber)).flatMap((x) => x.items)
  if (!lines.length) return undefined
  const items = lines.map((l, i) => {
    const soItem = so.items.find((s) => s.itemNo === l.soItemNo)!
    const net = r2(soItem.netPrice * l.qty)
    return { itemNo: (i + 1) * 10, productId: l.productId, material: l.material, description: l.description, qty: l.qty, uom: l.uom, unitPrice: soItem.netPrice, netValue: net, taxRate: rate, taxValue: r2((net * rate) / 100) }
  })
  const net = r2(items.reduce((s, i) => s + i.netValue, 0))
  const tax = r2(items.reduce((s, i) => s + i.taxValue, 0))
  const inv: SapInvoice = {
    invoiceNumber: `MOCK-INV-${++db.seq.inv}`, type: 'Invoice', soldTo: so.soldTo, customerId: so.customerId, invoiceDate: at, dueDate: new Date(new Date(at).getTime() + termsDays(so.paymentTerms) * DAY).toISOString(),
    soNumber: so.soNumber, deliveryNumber: d?.deliveryNumber ?? source[0]?.deliveryNumber, customerReference: so.customerReference ?? so.requestRef, currency: so.currency, netValue: net, taxValue: tax, grossValue: r2(net + tax),
    paymentTerms: so.paymentTerms, items, hasOfficialDocument: false,
  }
  db.invoices.push(inv)
  recalcOrder(db, so)
  return inv
}

function cancelInvoice(db: Db, inv: SapInvoice, at: string) {
  inv.cancelledBy = `MOCK-INV-${++db.seq.inv}`
  inv.cancelledAt = at
  const so = db.salesOrders.find((s) => s.soNumber === inv.soNumber)
  if (so) recalcOrder(db, so)
}

function creditMemo(db: Db, inv: SapInvoice, reason: string, qty: number, productId: string, at: string) {
  const it = inv.items.find((i) => i.productId === productId)!
  const net = r2(it.unitPrice * qty)
  const tax = r2((net * it.taxRate) / 100)
  const cm: SapInvoice & { appliesTo?: string } = {
    invoiceNumber: `MOCK-CM-${++db.seq.inv}`, type: 'Credit Memo', soldTo: inv.soldTo, customerId: inv.customerId, invoiceDate: at, dueDate: at, soNumber: inv.soNumber, deliveryNumber: inv.deliveryNumber,
    customerReference: reason, currency: inv.currency, netValue: net, taxValue: tax, grossValue: r2(net + tax), paymentTerms: inv.paymentTerms,
    items: [{ ...it, itemNo: 10, qty, netValue: net, taxValue: tax, description: `${it.description} — ${reason}` }], hasOfficialDocument: false, appliesTo: inv.invoiceNumber,
  }
  db.invoices.push(cm)
  return cm
}

// ─── Derivations (what the BFF would compute from SAP open items) ───────

const asOfMs = () => startOfToday()
const daysBetween = (fromIso: string, toMs: number) => Math.floor((toMs - new Date(fromIso).setHours(0, 0, 0, 0)) / DAY)

function invoiceView(db: Db, inv: Db['invoices'][number]): SapInvoiceView {
  if (inv.type === 'Credit Memo') {
    return { ...inv, amountPaid: 0, creditsApplied: inv.grossValue, outstanding: 0, status: inv.cancelledBy ? 'Cancelled' : 'Paid', daysOverdue: 0, allocations: inv.appliesTo ? [{ document: inv.appliesTo, type: 'Credit Memo', date: inv.invoiceDate, amount: inv.grossValue }] : [] }
  }
  const allocations: SapAllocation[] = [
    ...db.payments.filter((p) => !p.reversed).flatMap((p) => p.allocations.filter((a) => a.invoiceNumber === inv.invoiceNumber).map((a) => ({ document: p.paymentDoc, type: 'Payment' as const, date: p.postingDate, amount: a.amount }))),
    ...db.invoices.filter((c) => c.type === 'Credit Memo' && !c.cancelledBy && c.appliesTo === inv.invoiceNumber).map((c) => ({ document: c.invoiceNumber, type: 'Credit Memo' as const, date: c.invoiceDate, amount: c.grossValue })),
  ]
  const paid = r2(allocations.filter((a) => a.type === 'Payment').reduce((s, a) => s + a.amount, 0))
  const credits = r2(allocations.filter((a) => a.type === 'Credit Memo').reduce((s, a) => s + a.amount, 0))
  if (inv.cancelledBy) return { ...inv, amountPaid: paid, creditsApplied: credits, outstanding: 0, status: 'Cancelled', daysOverdue: 0, allocations }
  const outstanding = Math.max(0, r2(inv.grossValue - paid - credits))
  const overdueDays = Math.max(0, daysBetween(inv.dueDate, asOfMs()))
  const status = outstanding <= 0.005 ? 'Paid' : overdueDays > 0 ? 'Overdue' : paid + credits > 0 ? 'Partially Paid' : 'Open'
  return { ...inv, amountPaid: paid, creditsApplied: credits, outstanding, status, daysOverdue: outstanding > 0 ? overdueDays : 0, allocations }
}

function paymentView(p: SapPayment): SapPaymentView {
  const allocated = p.reversed ? 0 : r2(p.allocations.reduce((s, a) => s + a.amount, 0))
  const unallocated = p.reversed ? 0 : r2(p.amount - allocated)
  return { ...p, allocated, unallocated, status: p.reversed ? 'Reversed' : unallocated <= 0.005 ? 'Fully Allocated' : allocated > 0 ? 'Partially Allocated' : 'Unallocated' }
}

function ledgerEntries(db: Db, bp: string): Omit<LedgerEntry, 'balance'>[] {
  const out: Omit<LedgerEntry, 'balance'>[] = []
  for (const i of db.invoices.filter((x) => x.soldTo === bp)) {
    if (i.type === 'Invoice') {
      out.push({ postingDate: i.invoiceDate, documentDate: i.invoiceDate, documentNumber: i.invoiceNumber, reference: i.soNumber ?? '', type: 'Invoice', description: `Invoice${i.deliveryNumber ? ` · delivery ${i.deliveryNumber}` : ''}`, debit: i.grossValue, credit: 0 })
      if (i.cancelledBy) out.push({ postingDate: i.cancelledAt!, documentDate: i.cancelledAt!, documentNumber: i.cancelledBy, reference: i.invoiceNumber, type: 'Invoice Cancellation', description: `Cancellation of ${i.invoiceNumber}`, debit: 0, credit: i.grossValue })
    } else {
      out.push({ postingDate: i.invoiceDate, documentDate: i.invoiceDate, documentNumber: i.invoiceNumber, reference: i.appliesTo ?? '', type: 'Credit Memo', description: i.customerReference ?? 'Credit memo', debit: 0, credit: i.grossValue })
    }
  }
  for (const p of db.payments.filter((x) => x.soldTo === bp)) {
    out.push({ postingDate: p.postingDate, documentDate: p.paymentDate, documentNumber: p.paymentDoc, reference: p.reference, type: 'Payment', description: `${p.method} received`, debit: 0, credit: p.amount })
    if (p.reversed) out.push({ postingDate: p.postingDate, documentDate: p.postingDate, documentNumber: `${p.paymentDoc}-R`, reference: p.paymentDoc, type: 'Payment Reversal', description: 'Payment reversed', debit: p.amount, credit: 0 })
  }
  return out.sort((x, y) => x.postingDate.localeCompare(y.postingDate) || x.documentNumber.localeCompare(y.documentNumber))
}

const BUCKETS: { key: AgingBucketKey; label: string; test: (d: number) => boolean }[] = [
  { key: 'current', label: 'Not yet due', test: (d) => d <= 0 },
  { key: 'd1_30', label: '1–30 days', test: (d) => d >= 1 && d <= 30 },
  { key: 'd31_60', label: '31–60 days', test: (d) => d >= 31 && d <= 60 },
  { key: 'd61_90', label: '61–90 days', test: (d) => d >= 61 && d <= 90 },
  { key: 'd90_plus', label: 'More than 90 days', test: (d) => d > 90 },
]

// ─── Access control ──────────────────────────────────────────────────────

function guard(db: Db) {
  if (!db.available) throw new SapServiceError('SAP_UNAVAILABLE', 'SAP is temporarily unavailable. Figures could not be refreshed — please try again shortly.')
}
/** BPs the principal may see (customer ↔ BP mapping). */
function allowedBps(ctx: SapAccessContext): Set<string> {
  const ids = new Set(ctx.customerIds)
  return new Set(getCustomers().filter((c) => ids.has(c.id) && c.sapBusinessPartner).map((c) => c.sapBusinessPartner!))
}
function bpFor(ctx: SapAccessContext, customerId: string) {
  if (!ctx.customerIds.includes(customerId)) throw new SapServiceError('NOT_AUTHORIZED', 'You are not authorised to view this customer account.')
  const c = getCustomers().find((x) => x.id === customerId)
  if (!c?.sapBusinessPartner) throw new SapServiceError('NOT_MAPPED', 'This customer account is not yet linked to an SAP business partner, so no SAP documents can be shown.')
  return { bp: c.sapBusinessPartner, customer: c }
}
const customerOfBp = (bp: string) => getCustomers().find((c) => c.sapBusinessPartner === bp)
const page = <T,>(rows: T[], pageNo = 1, pageSize = 25) => ({ items: rows.slice((pageNo - 1) * pageSize, pageNo * pageSize), total: rows.length, page: pageNo, pageSize })
const env = () => ({ mode: 'mock' as const, syncedAt: new Date().toISOString() })
const latency = <T,>(fn: () => T, ms = 300 + Math.random() * 250) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(fn())
      } catch (e) {
        reject(e)
      }
    }, ms),
  )
/** Relabel stored records with the BP's current TradeFlow customer (mapping can change). */
const own = <T extends { soldTo: string; customerId: string }>(x: T): T => ({ ...x, customerId: customerOfBp(x.soldTo)?.id ?? x.customerId })

// ─── Read API (mirrors SapCustomerDataService) ───────────────────────────

export interface ListQuery {
  customerId?: string
  search?: string
  page?: number
  pageSize?: number
}

export const sapDevMock = {
  mode: 'mock' as const,

  listSalesOrders: (ctx: SapAccessContext, q: ListQuery = {}) =>
    latency((): Paged<SapSalesOrder> => {
      const db = load(); guard(db)
      const bps = q.customerId ? new Set([bpFor(ctx, q.customerId).bp]) : allowedBps(ctx)
      const term = q.search?.toLowerCase()
      const rows = db.salesOrders.filter((s) => bps.has(s.soldTo) && (!term || `${s.soNumber} ${s.requestRef ?? ''} ${s.customerReference ?? ''}`.toLowerCase().includes(term))).map(own).sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      return { ...env(), ...page(rows, q.page, q.pageSize ?? 500) }
    }),

  getSalesOrder: (ctx: SapAccessContext, soNumber: string) =>
    latency(() => {
      const db = load(); guard(db)
      const so = db.salesOrders.find((s) => s.soNumber === soNumber && allowedBps(ctx).has(s.soldTo))
      if (!so) throw new SapServiceError('NOT_FOUND', 'Sales order not found.')
      return { ...env(), order: own(so), deliveries: db.deliveries.filter((d) => d.soNumber === soNumber).map((d) => deliveryView(db, d)), invoices: db.invoices.filter((i) => i.soNumber === soNumber).map((i) => invoiceView(db, i)) }
    }),

  listDeliveries: (ctx: SapAccessContext, q: ListQuery & { soNumber?: string } = {}) =>
    latency((): Paged<SapDeliveryView> => {
      const db = load(); guard(db)
      const bps = q.customerId ? new Set([bpFor(ctx, q.customerId).bp]) : allowedBps(ctx)
      const rows = db.deliveries.filter((d) => bps.has(d.soldTo) && (!q.soNumber || d.soNumber === q.soNumber)).map((d) => deliveryView(db, d)).sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      return { ...env(), ...page(rows, q.page, q.pageSize ?? 500) }
    }),

  getDelivery: (ctx: SapAccessContext, deliveryNumber: string) =>
    latency(() => {
      const db = load(); guard(db)
      const d = db.deliveries.find((x) => x.deliveryNumber === deliveryNumber && allowedBps(ctx).has(x.soldTo))
      if (!d) throw new SapServiceError('NOT_FOUND', 'Delivery not found.')
      const so = db.salesOrders.find((s) => s.soNumber === d.soNumber)
      return { ...env(), delivery: deliveryView(db, d), order: so ? own(so) : undefined }
    }),

  listInvoices: (ctx: SapAccessContext, q: ListQuery & { openOnly?: boolean } = {}) =>
    latency((): Paged<SapInvoiceView> => {
      const db = load(); guard(db)
      const bps = q.customerId ? new Set([bpFor(ctx, q.customerId).bp]) : allowedBps(ctx)
      const rows = db.invoices
        .filter((i) => bps.has(i.soldTo))
        .map((i) => own(invoiceView(db, i)))
        .filter((i) => !q.openOnly || (i.type === 'Invoice' && i.outstanding > 0))
        .sort((x, y) => y.invoiceDate.localeCompare(x.invoiceDate))
      return { ...env(), ...page(rows, q.page, q.pageSize ?? 500) }
    }),

  getInvoice: (ctx: SapAccessContext, invoiceNumber: string) =>
    latency(() => {
      const db = load(); guard(db)
      const inv = db.invoices.find((i) => i.invoiceNumber === invoiceNumber && allowedBps(ctx).has(i.soldTo))
      if (!inv) throw new SapServiceError('NOT_FOUND', 'Invoice not found.')
      return { ...env(), invoice: own(invoiceView(db, inv)) }
    }),

  /** Official PDF output. The dev mock has none — the UI must say so instead of rendering a look-alike. */
  getInvoiceDocument: (ctx: SapAccessContext, invoiceNumber: string) =>
    latency((): { available: false; reason: string } => {
      const db = load(); guard(db)
      if (!db.invoices.some((i) => i.invoiceNumber === invoiceNumber && allowedBps(ctx).has(i.soldTo))) throw new SapServiceError('NOT_FOUND', 'Invoice not found.')
      return { available: false, reason: 'The official invoice PDF is produced by SAP output management and is not available in development mode.' }
    }),

  listPayments: (ctx: SapAccessContext, q: ListQuery = {}) =>
    latency((): Paged<SapPaymentView> => {
      const db = load(); guard(db)
      const bps = q.customerId ? new Set([bpFor(ctx, q.customerId).bp]) : allowedBps(ctx)
      const rows = db.payments.filter((p) => bps.has(p.soldTo)).map((p) => own(paymentView(p))).sort((x, y) => y.postingDate.localeCompare(x.postingDate))
      return { ...env(), ...page(rows, q.page, q.pageSize ?? 500) }
    }),

  getPayment: (ctx: SapAccessContext, paymentDoc: string) =>
    latency(() => {
      const db = load(); guard(db)
      const p = db.payments.find((x) => x.paymentDoc === paymentDoc && allowedBps(ctx).has(x.soldTo))
      if (!p) throw new SapServiceError('NOT_FOUND', 'Payment not found.')
      return { ...env(), payment: own(paymentView(p)), invoices: p.allocations.map((a) => invoiceView(db, db.invoices.find((i) => i.invoiceNumber === a.invoiceNumber)!)) }
    }),

  getLedger: (ctx: SapAccessContext, customerId: string, q: { from?: string; to?: string; page?: number; pageSize?: number } = {}) =>
    latency((): LedgerPage => {
      const db = load(); guard(db)
      const { bp, customer } = bpFor(ctx, customerId)
      const from = q.from ?? dayIso(-365).slice(0, 10)
      const to = q.to ?? dayIso(0).slice(0, 10)
      const all = ledgerEntries(db, bp)
      const before = all.filter((e) => e.postingDate.slice(0, 10) < from)
      const opening = r2(before.reduce((s, e) => s + e.debit - e.credit, 0))
      let bal = opening
      const inRange = all.filter((e) => e.postingDate.slice(0, 10) >= from && e.postingDate.slice(0, 10) <= to).map((e) => ({ ...e, balance: (bal = r2(bal + e.debit - e.credit)) }))
      const totalDebit = r2(inRange.reduce((s, e) => s + e.debit, 0))
      const totalCredit = r2(inRange.reduce((s, e) => s + e.credit, 0))
      const p = page(inRange, q.page, q.pageSize ?? 25)
      return { ...env(), customerId, soldTo: bp, currency: customer.currency, from, to, openingBalance: opening, closingBalance: r2(opening + totalDebit - totalCredit), totalDebit, totalCredit, entries: p.items, total: p.total, page: p.page, pageSize: p.pageSize }
    }),

  getAging: (ctx: SapAccessContext, customerId: string) =>
    latency((): AgingReport => {
      const db = load(); guard(db)
      const { bp, customer } = bpFor(ctx, customerId)
      const open = db.invoices.filter((i) => i.soldTo === bp).map((i) => invoiceView(db, i)).filter((i) => i.type === 'Invoice' && i.outstanding > 0)
      const lines = open.map((i) => {
        const d = daysBetween(i.dueDate, asOfMs())
        return { invoiceNumber: i.invoiceNumber, invoiceDate: i.invoiceDate, dueDate: i.dueDate, outstanding: i.outstanding, daysOverdue: Math.max(0, d), bucket: BUCKETS.find((b) => b.test(d))!.key }
      })
      const buckets = BUCKETS.map((b) => ({ key: b.key, label: b.label, amount: r2(lines.filter((l) => l.bucket === b.key).reduce((s, l) => s + l.outstanding, 0)), count: lines.filter((l) => l.bucket === b.key).length }))
      return {
        ...env(), customerId, currency: customer.currency, asOf: new Date(asOfMs()).toISOString(),
        basis: 'Days past the net due date at the reporting date, per SAP open item. Calculated by the integration layer (development mock); replace with SAP’s aging output if the SAP team provides it.',
        buckets, total: r2(lines.reduce((s, l) => s + l.outstanding, 0)), lines: lines.sort((x, y) => y.daysOverdue - x.daysOverdue),
      }
    }),

  getOutstanding: (ctx: SapAccessContext, customerId: string) =>
    latency((): OutstandingReport => {
      const db = load(); guard(db)
      const { bp, customer } = bpFor(ctx, customerId)
      const lines = db.invoices
        .filter((i) => i.soldTo === bp)
        .map((i) => invoiceView(db, i))
        .filter((i) => i.type === 'Invoice' && i.outstanding > 0)
        .map((i) => ({ invoiceNumber: i.invoiceNumber, type: i.type, invoiceDate: i.invoiceDate, dueDate: i.dueDate, original: i.grossValue, applied: r2(i.amountPaid + i.creditsApplied), outstanding: i.outstanding, daysOutstanding: daysBetween(i.invoiceDate, asOfMs()), overdue: i.daysOverdue > 0 }))
        .sort((x, y) => x.dueDate.localeCompare(y.dueDate))
      const sum = (f: (l: (typeof lines)[number]) => number) => r2(lines.reduce((s, l) => s + f(l), 0))
      const unallocated = r2(db.payments.filter((p) => p.soldTo === bp).map(paymentView).reduce((s, p) => s + p.unallocated, 0))
      const outstanding = sum((l) => l.outstanding)
      return {
        ...env(), customerId, currency: customer.currency, asOf: new Date(asOfMs()).toISOString(), lines,
        totals: { original: sum((l) => l.original), applied: sum((l) => l.applied), outstanding, current: sum((l) => (l.overdue ? 0 : l.outstanding)), overdue: sum((l) => (l.overdue ? l.outstanding : 0)) },
        unallocatedPayments: unallocated, netBalance: r2(outstanding - unallocated),
      }
    }),

  getFinancialSummary: (ctx: SapAccessContext, customerId: string) =>
    latency((): FinancialSummary => {
      const db = load(); guard(db)
      const { bp, customer } = bpFor(ctx, customerId)
      const inv = db.invoices.filter((i) => i.soldTo === bp).map((i) => invoiceView(db, i)).filter((i) => i.type === 'Invoice')
      const open = inv.filter((i) => i.outstanding > 0)
      const pays = db.payments.filter((p) => p.soldTo === bp && !p.reversed).map(paymentView)
      const recent = pays.filter((p) => daysBetween(p.postingDate, asOfMs()) <= 30)
      const limit = db.credit[bp]
      const openOrders = db.salesOrders.filter((s) => s.soldTo === bp && s.status !== 'Completed' && s.status !== 'Cancelled').reduce((s, o) => s + o.items.reduce((t, i) => t + (i.confirmedQty - i.billedQty) * i.netPrice, 0), 0)
      const totalOutstanding = r2(open.reduce((s, i) => s + i.outstanding, 0))
      return {
        ...env(), customerId, currency: customer.currency, totalOutstanding,
        totalOverdue: r2(open.filter((i) => i.daysOverdue > 0).reduce((s, i) => s + i.outstanding, 0)),
        openInvoices: open.length, partiallyPaidInvoices: open.filter((i) => i.amountPaid + i.creditsApplied > 0).length,
        recentPayments: { count: recent.length, amount: r2(recent.reduce((s, p) => s + p.amount, 0)), days: 30 },
        unallocatedPayments: r2(pays.reduce((s, p) => s + p.unallocated, 0)),
        credit: limit ? { limit, exposure: r2(totalOutstanding + openOrders), available: r2(limit - totalOutstanding - openOrders) } : undefined,
      }
    }),

  /** Raw ledger balance (all postings) — used by tests to prove reconciliation. */
  _ledgerBalance: (customerId: string) => {
    const bp = getCustomers().find((c) => c.id === customerId)?.sapBusinessPartner
    return r2(ledgerEntries(load(), bp ?? '').reduce((s, e) => s + e.debit - e.credit, 0))
  },
}

function deliveryView(db: Db, d: SapDelivery): SapDeliveryView {
  const so = db.salesOrders.find((s) => s.soNumber === d.soNumber)
  const pendingQty: Record<number, number> = {}
  for (const it of so?.items ?? []) pendingQty[it.itemNo] = Math.max(0, it.confirmedQty - it.deliveredQty)
  return { ...own(d), pendingQty }
}

// ─── Sales-order creation (called by the SAP order service) ──────────────

export interface CreateOrderInput {
  idempotencyKey: string
  requestId: string
  requestRef: string
  soldTo?: string
  customerId: string
  currency: CurrencyCode
  requestedDeliveryDate: string
  customerReference?: string
  remarks?: string
  shipTo: string
  paymentTerms: string
  items: { lineNo: number; productId: string; material: string; quantity: number; uom: string; unitPrice: number }[]
}

export type CreateOrderResult =
  | { ok: true; documentNumber: string; confirmedQty: Record<string, number>; fullyConfirmed: boolean; existing: boolean; message: string }
  | { ok: false; errorCode: string; message: string; retryable: boolean }

export function createSalesOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  return latency((): CreateOrderResult => {
    const db = load()
    if (!db.available) return { ok: false, errorCode: 'SAP-UNAVAILABLE', message: 'SAP did not respond (development mock: SAP marked unavailable). Nothing was created. Safe to retry.', retryable: true }
    // Idempotency first: a key SAP already processed returns the same order — never a second one.
    const existing = db.idempotency[input.idempotencyKey]
    if (existing) {
      const so = db.salesOrders.find((s) => s.soNumber === existing)!
      db.failNext = null
      save()
      return { ok: true, documentNumber: so.soNumber, confirmedQty: Object.fromEntries(so.items.map((i) => [i.productId, i.confirmedQty])), fullyConfirmed: so.items.every((i) => i.confirmedQty >= i.orderedQty), existing: true, message: `SAP already holds sales order ${so.soNumber} for this request (idempotency key ${input.idempotencyKey}); no duplicate was created (development mock).` }
    }
    if (!input.soldTo) return { ok: false, errorCode: 'BP-NOT-MAPPED', message: 'The customer is not linked to an SAP business partner. Maintain the customer ↔ SAP mapping, then retry.', retryable: true }
    const cust = getCustomers().find((c) => c.sapBusinessPartner === input.soldTo)
    if (!cust) return { ok: false, errorCode: 'BP-UNKNOWN', message: `SAP business partner ${input.soldTo} does not exist (development mock).`, retryable: false }
    if (cust.status === 'On Hold' || cust.status === 'Blocked') return { ok: false, errorCode: 'CREDIT-BLOCK', message: `Sold-to ${input.soldTo} is on credit/delivery block (development mock). Resolve the customer status, then retry.`, retryable: true }
    if (!input.items.length || input.items.some((i) => i.quantity <= 0 || !i.material)) return { ok: false, errorCode: 'VAL-ITEMS', message: 'Payload rejected: missing items or material mapping (development mock).', retryable: false }
    if (db.failNext === 'timeout') {
      db.failNext = null
      save()
      return { ok: false, errorCode: 'GW-TIMEOUT', message: 'Gateway timeout after 30 s (development mock). SAP did not create an order. Safe to retry.', retryable: true }
    }
    const stock = (pid: string) => getProducts().find((p) => p.id === pid)?.availableQty ?? 0
    const items: SapSalesOrderItem[] = input.items.map((l) => {
      const p = getProducts().find((x) => x.id === l.productId)
      const confirmed = Math.max(0, Math.min(l.quantity, stock(l.productId)))
      return { itemNo: l.lineNo, productId: l.productId, material: l.material, description: p?.name ?? l.material, uom: l.uom, orderedQty: l.quantity, confirmedQty: confirmed, deliveredQty: 0, billedQty: 0, netPrice: l.unitPrice, netValue: r2(l.unitPrice * l.quantity) }
    })
    const net = r2(items.reduce((s, i) => s + i.netValue, 0))
    const so: SapSalesOrder = {
      soNumber: `MOCK-SO-${++db.seq.so}`, soldTo: input.soldTo, customerId: cust.id, requestRef: input.requestRef, requestId: input.requestId, idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(), requestedDeliveryDate: input.requestedDeliveryDate, customerReference: input.customerReference, currency: input.currency, netValue: net,
      taxValue: r2((net * (TAX_BY_COUNTRY[cust.country] ?? 0)) / 100), paymentTerms: input.paymentTerms, shipTo: input.shipTo, status: 'Open', deliveryStatus: 'Not Delivered', billingStatus: 'Not Billed', items,
    }
    db.salesOrders.push(so)
    db.idempotency[input.idempotencyKey] = so.soNumber
    const full = items.every((i) => i.confirmedQty >= i.orderedQty)
    if (db.failNext === 'timeout_after_commit') {
      // SAP created the order but the response was lost — the retry must return this order, not create another.
      db.failNext = null
      save()
      return { ok: false, errorCode: 'GW-TIMEOUT', message: 'Gateway timeout after 30 s (development mock). SAP may have created the order — retrying is safe: the idempotency key prevents a duplicate.', retryable: true }
    }
    save()
    return { ok: true, documentNumber: so.soNumber, confirmedQty: Object.fromEntries(items.map((i) => [i.productId, i.confirmedQty])), fullyConfirmed: full, existing: false, message: full ? 'Sales order created; all schedule lines confirmed (development mock).' : 'Sales order created; some lines only partially confirmed against available stock (development mock).' }
  }, 900)
}

// ─── Development simulator: events that happen inside SAP ─────────────────

export const sapSimulator = {
  state: () => {
    const db = load()
    return { available: db.available, failNext: db.failNext, orders: db.salesOrders.map((s) => ({ soNumber: s.soNumber, customerId: customerOfBp(s.soldTo)?.id ?? s.customerId, requestRef: s.requestRef, status: s.status })), deliveries: db.deliveries.map((d) => ({ deliveryNumber: d.deliveryNumber, soNumber: d.soNumber, status: d.status })), invoices: db.invoices.filter((i) => i.type === 'Invoice' && !i.cancelledBy).map((i) => ({ invoiceNumber: i.invoiceNumber, customerId: customerOfBp(i.soldTo)?.id ?? i.customerId, ...pick(invoiceView(db, i)) })) }
  },
  setAvailable(v: boolean) {
    load().available = v
    save()
  },
  failNext(mode: Db['failNext']) {
    load().failNext = mode
    save()
  },
  /** Post an outbound delivery with goods issue for all (or ~half) of the open quantity. */
  postDelivery(soNumber: string, share: 'full' | 'partial') {
    const db = load()
    const so = db.salesOrders.find((s) => s.soNumber === soNumber)
    if (!so) return 'Sales order not found.'
    const d = createDelivery(db, so, share === 'full' ? 1 : 0.5, new Date().toISOString())
    if (!d) return 'Nothing left to deliver on this order.'
    d.status = 'Goods Issued'
    d.goodsIssueDate = new Date().toISOString()
    d.trackingRef = `TRK-${d.deliveryNumber.slice(-4)}`
    recalcOrder(db, so)
    save()
    return `${d.deliveryNumber} created with goods issue.`
  },
  /** Record proof of delivery (goods arrived at the customer). */
  markDelivered(deliveryNumber: string) {
    const db = load()
    const d = db.deliveries.find((x) => x.deliveryNumber === deliveryNumber)
    if (!d || d.status === 'Cancelled') return 'Delivery not found.'
    if (d.status === 'In Picking') {
      d.goodsIssueDate = new Date().toISOString()
    }
    d.status = 'Delivered'
    d.deliveredDate = new Date().toISOString()
    const so = db.salesOrders.find((s) => s.soNumber === d.soNumber)
    if (so) recalcOrder(db, so)
    save()
    return `${deliveryNumber} marked delivered (proof of delivery).`
  },
  /** Run billing for goods-issued, unbilled deliveries of an order. */
  createInvoice(soNumber: string) {
    const db = load()
    const so = db.salesOrders.find((s) => s.soNumber === soNumber)
    if (!so) return 'Sales order not found.'
    const inv = createInvoice(db, so, undefined, new Date().toISOString())
    save()
    return inv ? `${inv.invoiceNumber} created (${inv.currency} ${inv.grossValue.toFixed(2)}).` : 'Nothing to bill: no goods-issued, unbilled delivery.'
  },
  /** Post an incoming payment; optionally clear the oldest open invoices first. */
  postPayment(customerId: string, amount: number, allocate: boolean, reference: string) {
    const db = load()
    const c = getCustomers().find((x) => x.id === customerId)
    if (!c?.sapBusinessPartner) return 'Customer is not mapped to an SAP business partner.'
    const open = db.invoices.filter((i) => i.soldTo === c.sapBusinessPartner && i.type === 'Invoice').map((i) => invoiceView(db, i)).filter((i) => i.outstanding > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    let left = amount
    const allocations: SapPayment['allocations'] = []
    if (allocate)
      for (const i of open) {
        if (left <= 0) break
        const a = r2(Math.min(left, i.outstanding))
        allocations.push({ invoiceNumber: i.invoiceNumber, amount: a })
        left = r2(left - a)
      }
    const p: SapPayment = { paymentDoc: `MOCK-PAY-${++db.seq.pay}`, soldTo: c.sapBusinessPartner, customerId, paymentDate: new Date().toISOString(), postingDate: new Date().toISOString(), reference: reference || 'Incoming payment', method: 'Bank Transfer', amount: r2(amount), currency: c.currency, allocations }
    db.payments.push(p)
    save()
    return `${p.paymentDoc} posted${allocations.length ? ` and cleared ${allocations.length} invoice(s)` : ' on account (unallocated)'}.`
  },
  cancelInvoice(invoiceNumber: string) {
    const db = load()
    const inv = db.invoices.find((i) => i.invoiceNumber === invoiceNumber && i.type === 'Invoice' && !i.cancelledBy)
    if (!inv) return 'Invoice not found or already cancelled.'
    if (invoiceView(db, inv).amountPaid > 0) return 'Invoice has payments allocated — reverse the clearing first.'
    cancelInvoice(db, inv, new Date().toISOString())
    save()
    return `${invoiceNumber} cancelled by ${inv.cancelledBy}.`
  },
  /** Count orders per idempotency key — used to prove that retries never duplicate. */
  ordersForRequest(requestId: string) {
    return load().salesOrders.filter((s) => s.requestId === requestId).length
  },
}

function pick(v: SapInvoiceView) {
  return { outstanding: v.outstanding, status: v.status }
}

/** Deliveries in the seeded SAP data that the customer had already received (for seeding acknowledgements). */
export function seededDeliveredDeliveries(customerId: string) {
  return seed().deliveries.filter((d) => d.customerId === customerId && d.status === 'Delivered')
}
