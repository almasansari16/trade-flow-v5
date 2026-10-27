/**
 * Seeded transactional data: sales order requests and everything downstream
 * (proforma invoices, payments, shipments, documents).
 * Built with small helpers so totals, approvals and promo allocations are
 * internally consistent.
 */
import type {
  ActivityEntry,
  ApprovalStageName,
  ApprovalStep,
  DocumentRecord,
  OrderLine,
  Payment,
  ProformaInvoice,
  RequestStatus,
  SalesOrderRequest,
  Shipment,
  ShipmentStatus,
} from '@/types/domain'
import { SHIPMENT_FLOW } from '@/types/domain'
import { customers } from './customers'
import { products } from './catalog'
import { regions, territories, WAREHOUSES } from './org'
import { defaultApprovalRules, defaultPromoRules } from './config'
import { calculatePromo } from '@/utils/promo'
import { fromUsd, roundMoney, toUsd } from '@/utils/fx'

const HOUR = 3_600_000
const iso = (ms: number) => new Date(ms).toISOString()

export function stagesForValue(valueUsd: number, rules = defaultApprovalRules) {
  const rule =
    rules.find((r) => r.active && valueUsd >= r.minValueUsd && (r.maxValueUsd === null || valueUsd < r.maxValueUsd)) ??
    rules[rules.length - 1]!
  return rule
}

export function approverFor(stage: ApprovalStageName, territoryId: string) {
  const t = territories.find((x) => x.id === territoryId)!
  if (stage === 'Account Manager') return t.managerId
  if (stage === 'Regional Manager') return regions.find((r) => r.id === t.regionId)!.managerId
  return 'u-gm'
}

export const requestSubtotal = (r: Pick<SalesOrderRequest, 'lines'>) =>
  roundMoney(r.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0))

export const requestUnits = (r: Pick<SalesOrderRequest, 'lines'>) => r.lines.reduce((s, l) => s + l.quantity, 0)

interface Spec {
  id: string
  n: number
  customerId: string
  lines: [productId: string, qty: number][]
  daysAgo: number
  status: RequestStatus
  /** Number of approval steps already approved. */
  approved: number
  /** What happened at the next step, if anything. */
  outcome?: 'Rejected' | 'Returned for Clarification'
  outcomeComment?: string
  /** For a pending step: how many hours ago it entered the queue. */
  pendingHoursAgo?: number
  createdById?: string
  fulfilment?: 'Delivery' | 'Collection'
  customerPo?: string
  notes?: string
  approvalComments?: string[]
}

let actSeq = 0
const act = (at: number, actorId: string, action: string, kind: ActivityEntry['kind'], comment?: string): ActivityEntry => ({
  id: `act-seed-${actSeq++}`,
  at: iso(at),
  actorId,
  action,
  kind,
  comment,
})

function buildRequest(s: Spec): SalesOrderRequest {
  const customer = customers.find((c) => c.id === s.customerId)!
  const created = Date.now() - s.daysAgo * 24 * HOUR
  const lines: OrderLine[] = s.lines.map(([productId, quantity]) => {
    const p = products.find((x) => x.id === productId)!
    return { productId, quantity, unitPrice: roundMoney(fromUsd(p.unitPriceUsd, customer.currency)) }
  })
  const subtotal = requestSubtotal({ lines })
  const rule = stagesForValue(toUsd(subtotal, customer.currency))
  const createdById = s.createdById ?? (s.customerId === 'c-001' ? 'u-dist' : 'u-sc')
  const activity: ActivityEntry[] = [act(created, createdById, 'Request created', 'user')]

  const steps: ApprovalStep[] = []
  if (s.status !== 'Draft') {
    const submitted = created + 0.5 * HOUR
    activity.push(act(submitted, createdById, 'Request submitted for approval', 'user', s.notes))
    let cursor = submitted
    rule.stages.forEach((stage, i) => {
      const approverId = approverFor(stage, customer.territoryId)
      if (i < s.approved) {
        const acted = cursor + (6 + i * 5) * HOUR
        const comment = s.approvalComments?.[i]
        steps.push({ stage, approverId, status: 'Approved', slaHours: rule.slaHours, enteredAt: iso(cursor), actedAt: iso(acted), actedById: approverId, comment })
        activity.push(act(acted, approverId, `Approved at ${stage} stage`, 'approval', comment))
        cursor = acted
      } else if (i === s.approved) {
        if (s.outcome) {
          const acted = cursor + 9 * HOUR
          steps.push({ stage, approverId, status: s.outcome, slaHours: rule.slaHours, enteredAt: iso(cursor), actedAt: iso(acted), actedById: approverId, comment: s.outcomeComment })
          activity.push(act(acted, approverId, s.outcome === 'Rejected' ? `Rejected at ${stage} stage` : `Changes requested at ${stage} stage`, s.outcome === 'Rejected' ? 'rejection' : 'change', s.outcomeComment))
        } else {
          const entered = s.pendingHoursAgo !== undefined ? Date.now() - s.pendingHoursAgo * HOUR : cursor
          steps.push({ stage, approverId, status: 'Pending', slaHours: rule.slaHours, enteredAt: iso(entered) })
        }
      } else {
        steps.push({ stage, approverId, status: 'Waiting', slaHours: rule.slaHours })
      }
    })
    if (s.approved >= rule.stages.length) {
      activity.push(act(cursor + 0.1 * HOUR, 'u-system', 'All approvals complete — request approved', 'system'))
    }
  }

  const promo = calculatePromo(lines, products, defaultPromoRules)
  return {
    id: s.id,
    ref: s.status === 'Draft' ? `DRAFT-${String(s.n).padStart(4, '0')}` : `SOR-2026-${String(s.n).padStart(4, '0')}`,
    customerId: s.customerId,
    territoryId: customer.territoryId,
    currency: customer.currency,
    lines,
    promo,
    status: s.status,
    approvalSteps: steps,
    fulfilment: s.fulfilment ?? 'Collection',
    deliveryAddress: s.fulfilment === 'Delivery' ? customer.deliveryAddress : undefined,
    collectionWarehouse: s.fulfilment === 'Delivery' ? undefined : warehouseFor(customer.territoryId),
    requestedDate: iso(created + 21 * 24 * HOUR),
    customerPo: s.customerPo,
    notes: s.notes,
    createdAt: iso(created),
    updatedAt: iso(created + 2 * HOUR),
    createdById,
    activity,
    ...sapSeed(s, lines, iso(cursorAfterApproval(s, created))),
  }
}

/** Seeded SAP state: downstream requests were confirmed by the mock; r-127 shows a failed submission awaiting retry. */
function sapSeed(s: Spec, lines: OrderLine[], at: string): Pick<SalesOrderRequest, 'sap' | 'externalRef'> {
  const downstream = ['Awaiting Payment', 'Payment Verified', 'In Fulfillment', 'Ready for Collection', 'Collected']
  if (downstream.includes(s.status)) {
    const doc = `MOCK-SO-${6000 + s.n}`
    return {
      externalRef: doc,
      sap: {
        status: 'Sales Order Created',
        fullyConfirmed: true,
        idempotencyKey: s.id,
        soldTo: customers.find((c) => c.id === s.customerId)?.sapBusinessPartner,
        documentNumber: doc,
        confirmedQty: Object.fromEntries(lines.map((l) => [l.productId, l.quantity])),
        attempts: [{ at, byId: 'u-system', outcome: 'confirmed', mode: 'mock', documentNumber: doc, message: 'Order accepted; all schedule lines confirmed (development mock).' }],
      },
    }
  }
  if (s.status === 'Approved') {
    return {
      sap: {
        status: 'SAP Creation Failed',
        idempotencyKey: s.id,
        soldTo: customers.find((c) => c.id === s.customerId)?.sapBusinessPartner,
        errorCode: 'GW-TIMEOUT',
        errorMessage: 'Gateway timeout after 30 s (development mock). Safe to retry.',
        attempts: [{ at, byId: 'u-system', outcome: 'failed', mode: 'mock', errorCode: 'GW-TIMEOUT', message: 'Gateway timeout after 30 s (development mock). Safe to retry.' }],
      },
    }
  }
  return {}
}

function cursorAfterApproval(s: Spec, created: number) {
  return created + (s.daysAgo > 1 ? 30 : 3) * HOUR
}

export function warehouseFor(territoryId: string) {
  const t = territories.find((x) => x.id === territoryId)
  if (t?.regionId === 'r-eu') return WAREHOUSES[1]!
  if (t?.regionId === 'r-apac') return WAREHOUSES[2]!
  return WAREHOUSES[0]!
}

const specs: Spec[] = [
  { id: 'r-118', n: 118, customerId: 'c-001', daysAgo: 42, status: 'Collected', approved: 2, customerPo: 'GHT-PO-7781', lines: [['p-01', 240], ['p-05', 180], ['p-10', 120], ['p-18', 96], ['p-04', 120]], approvalComments: ['Ramadan build-up volumes, aligned with forecast.'] },
  { id: 'r-124', n: 124, customerId: 'c-002', daysAgo: 26, status: 'Ready for Collection', approved: 2, customerPo: 'ANP-2026-311', lines: [['p-05', 360], ['p-07', 240], ['p-01', 180], ['p-09', 80]] },
  { id: 'r-126', n: 126, customerId: 'c-006', daysAgo: 20, status: 'In Fulfillment', approved: 2, lines: [['p-18', 120], ['p-20', 240], ['p-10', 60], ['p-02', 60]] },
  { id: 'r-129', n: 129, customerId: 'c-004', daysAgo: 17, status: 'Payment Verified', approved: 2, fulfilment: 'Delivery', customerPo: 'TB-PO-0932', lines: [['p-14', 144], ['p-15', 96], ['p-16', 120], ['p-12', 96]] },
  { id: 'r-131', n: 131, customerId: 'c-001', daysAgo: 12, status: 'Awaiting Payment', approved: 2, customerPo: 'GHT-PO-7820', lines: [['p-22', 300], ['p-03', 48], ['p-11', 36], ['p-19', 60]] },
  { id: 'r-133', n: 133, customerId: 'c-003', daysAgo: 9, status: 'Awaiting Payment', approved: 2, lines: [['p-05', 120], ['p-13', 36], ['p-18', 72]] },
  { id: 'r-127', n: 127, customerId: 'c-005', daysAgo: 6, status: 'Approved', approved: 2, lines: [['p-10', 96], ['p-12', 144], ['p-02', 72]] },
  { id: 'r-135', n: 135, customerId: 'c-005', daysAgo: 3, status: 'Pending Approval', approved: 1, pendingHoursAgo: 20, lines: [['p-01', 180], ['p-14', 120], ['p-18', 120], ['p-13', 48]], approvalComments: ['Good sell-through on Atlas Cedar last quarter.'] },
  { id: 'r-136', n: 136, customerId: 'c-001', daysAgo: 1, status: 'Pending Approval', approved: 0, pendingHoursAgo: 18, customerPo: 'GHT-PO-7856', notes: 'Q1 national-day promotion stock. Please prioritise Royal Oud allocation.', lines: [['p-01', 480], ['p-05', 420], ['p-10', 300], ['p-18', 240], ['p-03', 72], ['p-04', 240]] },
  { id: 'r-137', n: 137, customerId: 'c-009', daysAgo: 2, status: 'Pending Approval', approved: 0, pendingHoursAgo: 38, lines: [['p-05', 96], ['p-07', 72], ['p-08', 48]] },
  { id: 'r-138', n: 138, customerId: 'c-003', daysAgo: 4, status: 'Pending Approval', approved: 1, pendingHoursAgo: 10, lines: [['p-05', 240], ['p-11', 60], ['p-10', 120], ['p-21', 40]] },
  { id: 'r-139', n: 139, customerId: 'c-002', daysAgo: 5, status: 'Pending Approval', approved: 1, pendingHoursAgo: 30, customerPo: 'ANP-2026-344', notes: 'Includes pre-order of Musk Al Layl Extrait for flagship store opening.', lines: [['p-05', 600], ['p-07', 360], ['p-06', 120], ['p-01', 300]], approvalComments: ['Within annual plan.', 'Approve — strategic account, flagship launch.'] },
  { id: 'r-140', n: 140, customerId: 'c-006', daysAgo: 1, status: 'Pending Approval', approved: 0, pendingHoursAgo: 6, lines: [['p-02', 60], ['p-19', 48]] },
  { id: 'r-141', n: 141, customerId: 'c-007', daysAgo: 6, status: 'Returned for Clarification', approved: 0, outcome: 'Returned for Clarification', outcomeComment: 'Please split Royal Oud into two shipments — LC limit only covers USD 25k per draw.', lines: [['p-01', 120], ['p-05', 216], ['p-22', 96]] },
  { id: 'r-142', n: 142, customerId: 'c-004', daysAgo: 8, status: 'Rejected', approved: 0, outcome: 'Rejected', outcomeComment: 'Library Candle is out of stock with no inbound until next quarter. Please resubmit without it.', lines: [['p-17', 120], ['p-14', 60]] },
  { id: 'r-143', n: 143, customerId: 'c-001', daysAgo: 0.2, status: 'Draft', approved: 0, lines: [['p-02', 36], ['p-12', 48]] },
  { id: 'r-144', n: 144, customerId: 'c-010', daysAgo: 0.3, status: 'Pending Approval', approved: 0, pendingHoursAgo: 5, lines: [['p-05', 72], ['p-11', 24]] },
  { id: 'r-145', n: 145, customerId: 'c-001', daysAgo: 2, status: 'Pending Approval', approved: 1, pendingHoursAgo: 14, customerPo: 'GHT-PO-7849', lines: [['p-10', 180], ['p-18', 180], ['p-22', 240]] },
]

export const salesOrderRequests: SalesOrderRequest[] = specs.map(buildRequest)

// ─── Invoices, payments ───────────────────────────────────────────────────

export const BANK_DETAILS = {
  bank: 'Demo Commercial Bank — Dubai Main Branch',
  accountName: 'TradeFlow Distribution FZE (demo)',
  iban: 'AE00 0000 0000 0000 0000 000',
  swift: 'DEMOAEAD',
}

const invoiceSpec: Record<string, { status: ProformaInvoice['status']; payment: Payment['status']; issuedDaysAfter: number }> = {
  'r-118': { status: 'Payment Verified', payment: 'Verified', issuedDaysAfter: 3 },
  'r-124': { status: 'Payment Verified', payment: 'Verified', issuedDaysAfter: 3 },
  'r-126': { status: 'Payment Verified', payment: 'Verified', issuedDaysAfter: 2 },
  'r-129': { status: 'Payment Verified', payment: 'Verified', issuedDaysAfter: 2 },
  'r-131': { status: 'Receipt Uploaded', payment: 'Receipt Uploaded', issuedDaysAfter: 3 },
  'r-133': { status: 'Issued', payment: 'Awaiting Receipt', issuedDaysAfter: 2 },
}

export function buildInvoice(r: SalesOrderRequest, n: number, issuedAt: string, status: ProformaInvoice['status'] = 'Issued'): ProformaInvoice {
  const subtotal = requestSubtotal(r)
  const freight = r.fulfilment === 'Delivery' ? roundMoney(subtotal * 0.025) : 0
  return {
    id: `inv-${r.id}`,
    number: `PI-2026-${String(n).padStart(4, '0')}`,
    requestId: r.id,
    customerId: r.customerId,
    issuedAt,
    dueAt: new Date(new Date(issuedAt).getTime() + 7 * 24 * HOUR).toISOString(),
    currency: r.currency,
    subtotal,
    freight,
    tax: 0,
    total: roundMoney(subtotal + freight),
    status,
    bankDetails: BANK_DETAILS,
  }
}

export const invoices: ProformaInvoice[] = []
export const payments: Payment[] = []

let invN = 401
for (const r of salesOrderRequests) {
  const spec = invoiceSpec[r.id]
  if (!spec) continue
  const lastApproval = r.approvalSteps.at(-1)?.actedAt ?? r.createdAt
  const issued = iso(new Date(lastApproval).getTime() + spec.issuedDaysAfter * 4 * HOUR)
  const inv = buildInvoice(r, invN++, issued, spec.status)
  invoices.push(inv)
  r.invoiceId = inv.id
  const uploaded = iso(new Date(issued).getTime() + 30 * HOUR)
  payments.push({
    id: `pay-${r.id}`,
    ref: `PAY-2026-${String(invN + 300).padStart(4, '0')}`,
    invoiceId: inv.id,
    customerId: r.customerId,
    amount: inv.total,
    currency: inv.currency,
    method: r.customerId === 'c-007' ? 'Letter of Credit' : 'Bank Transfer',
    status: spec.payment,
    valueDate: spec.payment === 'Awaiting Receipt' ? undefined : uploaded,
    payerBank: spec.payment === 'Awaiting Receipt' ? undefined : 'Customer bank (demo)',
    receiptFile: spec.payment === 'Awaiting Receipt' ? undefined : { name: `Transfer_Confirmation_${inv.number}.pdf`, sizeKb: 186, uploadedAt: uploaded },
    verifiedById: spec.payment === 'Verified' ? 'u-sc' : undefined,
    verifiedAt: spec.payment === 'Verified' ? iso(new Date(uploaded).getTime() + 20 * HOUR) : undefined,
  })
  r.activity.push(act(new Date(issued).getTime(), 'u-sc', `Proforma invoice ${inv.number} issued`, 'finance'))
  if (spec.payment !== 'Awaiting Receipt')
    r.activity.push(act(new Date(uploaded).getTime(), r.createdById, 'Payment receipt uploaded', 'finance'))
  if (spec.payment === 'Verified')
    r.activity.push(act(new Date(uploaded).getTime() + 20 * HOUR, 'u-sc', 'Payment verified (demo)', 'finance'))
}

// ─── Shipments ────────────────────────────────────────────────────────────

const shipmentStatusFor: Record<string, ShipmentStatus> = {
  'r-118': 'Collected',
  'r-124': 'Ready for Collection',
  'r-126': 'Documents in Progress',
  'r-129': 'Payment Verified',
  'r-131': 'Awaiting Payment',
  'r-133': 'Awaiting Payment',
}

export function buildPacking(r: SalesOrderRequest) {
  const packing: Shipment['packing'] = r.lines.map((l) => {
    const p = products.find((x) => x.id === l.productId)!
    return { productId: l.productId, quantity: l.quantity, cartons: Math.ceil(l.quantity / (p.casePack * 4)), kind: 'Saleable' as const }
  })
  const units = requestUnits(r)
  return {
    packing,
    cartons: packing.reduce((s, p) => s + p.cartons, 0) + (r.promo.testers + r.promo.samples > 0 ? 1 : 0),
    grossWeightKg: Math.round(units * 0.42),
    volumeCbm: Math.round(units * 0.0021 * 100) / 100,
  }
}

export const shipments: Shipment[] = []
export const documents: DocumentRecord[] = []

let shpN = 210
for (const r of salesOrderRequests) {
  const status = shipmentStatusFor[r.id]
  if (!status) continue
  const idx = SHIPMENT_FLOW.indexOf(status)
  const base = new Date(r.approvalSteps.at(-1)?.actedAt ?? r.createdAt).getTime()
  const history = SHIPMENT_FLOW.slice(0, idx + 1).map((st, i) => ({
    status: st,
    at: iso(Math.min(base + i * 40 * HOUR, Date.now() - (idx - i) * 3 * HOUR)),
    byId: i === 0 ? 'u-system' : st === 'Payment Verified' || st === 'Awaiting Payment' ? 'u-sc' : 'u-sc',
  }))
  const pk = buildPacking(r)
  const shp: Shipment = {
    id: `shp-${r.id}`,
    ref: `SHP-2026-${String(shpN++).padStart(4, '0')}`,
    requestId: r.id,
    customerId: r.customerId,
    status,
    mode: r.fulfilment === 'Delivery' ? 'Sea Freight' : 'Customer Collection',
    warehouse: r.collectionWarehouse ?? warehouseFor(r.territoryId),
    collectionRef: idx >= SHIPMENT_FLOW.indexOf('Ready for Collection') ? `COL-${String(shpN + 7000)}` : undefined,
    collectionWindow: idx >= SHIPMENT_FLOW.indexOf('Ready for Collection') ? 'Sun–Thu, 08:00–15:00 (bring collection reference & ID)' : undefined,
    ...pk,
    history,
    documentIds: [],
  }
  shipments.push(shp)
  r.shipmentId = shp.id

  const docAt = history.at(-1)!.at
  if (idx >= SHIPMENT_FLOW.indexOf('Documents in Progress')) {
    const final = idx >= SHIPMENT_FLOW.indexOf('Ready for Collection')
    for (const [type, name] of [
      ['Packing List', `Packing_List_${shp.ref}.pdf`],
      ['Commercial Invoice', `Commercial_Invoice_${shp.ref}.pdf`],
      ['Certificate of Origin', `Certificate_of_Origin_${shp.ref}.pdf`],
    ] as const) {
      const id = `doc-${shp.id}-${type.replace(/\s/g, '').toLowerCase()}`
      documents.push({ id, name, type, linkedTo: { kind: 'shipment', id: shp.id }, customerId: r.customerId, uploadedAt: docAt, uploadedById: 'u-sc', sizeKb: 220 + name.length * 3, status: final ? 'Final' : 'Draft' })
      shp.documentIds.push(id)
    }
  }
}

// Invoice PDFs and receipts
for (const inv of invoices) {
  documents.push({ id: `doc-${inv.id}`, name: `${inv.number}.pdf`, type: 'Proforma Invoice', linkedTo: { kind: 'invoice', id: inv.id }, customerId: inv.customerId, uploadedAt: inv.issuedAt, uploadedById: 'u-sc', sizeKb: 148, status: 'Final' })
}
for (const p of payments) {
  if (p.receiptFile)
    documents.push({ id: `doc-${p.id}`, name: p.receiptFile.name, type: 'Payment Receipt', linkedTo: { kind: 'invoice', id: p.invoiceId }, customerId: p.customerId, uploadedAt: p.receiptFile.uploadedAt, uploadedById: p.customerId === 'c-001' ? 'u-dist' : 'u-sc', sizeKb: p.receiptFile.sizeKb, status: p.status === 'Verified' ? 'Verified' : 'Pending Review' })
}
// Customer registration documents
const regDocs: [string, DocumentRecord['type'], string, DocumentRecord['status'], number?][] = [
  ['c-001', 'Trade License', 'Trade_License_GHT_2026.pdf', 'Verified', 220],
  ['c-001', 'Tax Certificate', 'TRN_Certificate.pdf', 'Verified'],
  ['c-002', 'Commercial Registration', 'CR_AlNoor_1010552881.pdf', 'Verified', 300],
  ['c-002', 'Tax Certificate', 'VAT_Registration_AlNoor.pdf', 'Verified'],
  ['c-003', 'Commercial Registration', 'CR_PearlCoast.pdf', 'Expired', -12],
  ['c-004', 'Commercial Registration', 'Companies_House_ThamesBloom.pdf', 'Verified'],
  ['c-005', 'Commercial Registration', 'Kbis_MaisonRive.pdf', 'Verified'],
  ['c-006', 'Commercial Registration', 'ACRA_BizProfile_StraitsScent.pdf', 'Verified'],
  ['c-007', 'Commercial Registration', 'SECP_Incorporation_IndusLuxe.pdf', 'Verified'],
  ['c-008', 'Trade License', 'Business_Permit_Savanna.pdf', 'Pending Review'],
  ['c-009', 'Commercial Registration', 'CR_MuscatRoyal.pdf', 'Verified'],
  ['c-010', 'Commercial Registration', 'CR_KuwaitPrime.pdf', 'Verified'],
  ['c-011', 'Commercial Registration', 'Handelsregisterauszug.pdf', 'Verified'],
  ['c-001', 'Safety Data Sheet', 'SDS_Fragrance_Alcohol_Based.pdf', 'Verified'],
]
regDocs.forEach(([customerId, type, name, status, expiryDays], i) => {
  const expiresAt = expiryDays !== undefined ? new Date(Date.now() + expiryDays * 24 * HOUR).toISOString() : undefined
  documents.push({ id: `doc-reg-${i}`, name, type, linkedTo: { kind: 'customer', id: customerId }, customerId, uploadedAt: new Date(Date.now() - (60 + i * 11) * 24 * HOUR).toISOString(), uploadedById: 'u-sc', sizeKb: 300 + i * 37, status, expiresAt })
})
