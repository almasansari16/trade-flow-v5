/**
 * Demo state store.
 * Holds every record the prototype shows and the simulated workflow actions
 * that mutate it. Everything lives in browser memory (mirrored to
 * localStorage so a stakeholder demo survives a refresh) — nothing is sent anywhere.
 *
 * Every action re-checks the signed-in user's permissions before changing state
 * (defence in depth for the prototype). In production the same checks MUST run on
 * the server; browser checks are never a security boundary.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  GoodsReceiptAck,
  ActivityEntry,
  AdminAuditEntry,
  AppNotification,
  ApplicationContent,
  ApplicationDocument,
  ApprovalRule,
  ApprovalStep,
  Address,
  Contact,
  Customer,
  CustomerActivity,
  CustomerStatus,
  DemoCredential,
  DemoUser,
  DocumentRecord,
  EmailMessage,
  EmailThread,
  FollowUpStatus,
  IntegrationChannel,
  IntegrationEvent,
  NotificationPreference,
  OrderLine,
  Payment,
  Product,
  ProformaInvoice,
  PromoRules,
  RegistrationApplication,
  Role,
  SalesOrderRequest,
  Session,
  Shipment,
  ShipmentStatus,
  Territory,
  WorkflowDef,
} from '@/types/domain'
import { SHIPMENT_FLOW } from '@/types/domain'
import { regions, territories as seedTerritories, users as seedUsers } from '@/data/org'
import { brands, products as seedProducts } from '@/data/catalog'
import { customers as seedCustomers } from '@/data/customers'
import { applications as seedApplications } from '@/data/applications'
import { customerActivities as seedActivities } from '@/data/activities'
import { defaultApprovalRules, defaultNotificationPrefs, defaultPromoRules } from '@/data/config'
import {
  buildInvoice,
  buildPacking,
  documents as seedDocuments,
  invoices as seedInvoices,
  payments as seedPayments,
  salesOrderRequests as seedRequests,
  shipments as seedShipments,
  warehouseFor,
} from '@/data/transactions'
import { emailThreads as seedThreads, notifications as seedNotifications } from '@/data/communications'
import { integrationChannels as seedChannels, integrationEvents as seedEvents } from '@/data/integration'
import { calculatePromo } from '@/utils/promo'
import { roundMoney, toUsd } from '@/utils/fx'
import { ahead, nowIso, uid } from '@/utils/time'
import { defaultRoles, PROTECTED_ROLE_ID } from '@/auth/roles'
import { CRITICAL_PERMISSIONS, PERMISSION_IDS } from '@/auth/permissions'
import { credentialHash, passwordProblems, randomToken, seedCredentials } from '@/auth/demoCredentials'
import { canViewApplication, customerScope as customerScopeOf, GUEST, makeCan, ORDER_STAGE_ROLE, assignedTerritoryIds, permissionsFor, type Can } from '@/auth/authorize'
import { defaultOnboardingWorkflow, SECTION_LABELS } from '@/workflow/onboarding'
import {
  addInternalComment,
  applicantCanEdit,
  applyReviewerAction,
  resubmit,
  stageById,
  submitDraft,
  type NotificationDraft,
  type ReviewerAction,
  type ReviewerInput,
  type WorkflowCtx,
} from '@/workflow/engine'
import { createMockTrackingService, trackingLinkFor } from '@/workflow/tracking'
import type { ApplicationTrackingService, SapSalesOrderPayload, SapSubmitResult } from '@/services/contracts'
import { services } from '@/services'
import { seedGoodsReceipts } from '@/data/receipts'
import { configureSapDevMock, resetSapDevMock } from '@/services/sapDevMock'

// ─── State shape ──────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  quantity: number
}

export interface DemoState {
  version: number
  /** Prototype session (production: HttpOnly secure cookie issued by the server). */
  session?: Session
  users: DemoUser[]
  roles: Role[]
  credentials: DemoCredential[]
  loginAttempts: Record<string, { failures: number; lockedUntil?: string }>
  territories: Territory[]
  products: Product[]
  customers: Customer[]
  applications: RegistrationApplication[]
  onboardingWorkflow: WorkflowDef
  requests: SalesOrderRequest[]
  invoices: ProformaInvoice[]
  payments: Payment[]
  shipments: Shipment[]
  documents: DocumentRecord[]
  threads: EmailThread[]
  notifications: AppNotification[]
  promoRules: PromoRules
  approvalRules: ApprovalRule[]
  notificationPrefs: NotificationPreference[]
  integrationEvents: IntegrationEvent[]
  integrationChannels: IntegrationChannel[]
  adminAudit: AdminAuditEntry[]
  /** Customer visits, calls, meetings and follow-ups. */
  activities: CustomerActivity[]
  /** Customer goods-receipt acknowledgements for SAP deliveries (TradeFlow records, not SAP goods receipts). */
  goodsReceipts: GoodsReceiptAck[]
  cart: CartItem[]
  cartCustomerId?: string
  counters: { request: number; invoice: number; shipment: number; customer: number; application: number; payment: number; receipt: number }
}

const STATE_VERSION = 7
const STORAGE_KEY = 'tradeflow-demo-state'
export const SESSION_HOURS = 8
const MAX_LOGIN_FAILURES = 5
const LOCKOUT_MINUTES = 5

function seedState(): DemoState {
  return structuredClone({
    version: STATE_VERSION,
    session: undefined,
    users: seedUsers,
    roles: defaultRoles,
    credentials: seedCredentials(seedUsers.filter((u) => u.id !== 'u-system').map((u) => u.id)),
    loginAttempts: {},
    territories: seedTerritories,
    products: seedProducts,
    customers: seedCustomers,
    applications: seedApplications,
    onboardingWorkflow: defaultOnboardingWorkflow,
    requests: seedRequests,
    invoices: seedInvoices,
    payments: seedPayments,
    shipments: seedShipments,
    documents: seedDocuments,
    threads: seedThreads,
    notifications: seedNotifications,
    promoRules: defaultPromoRules,
    approvalRules: defaultApprovalRules,
    notificationPrefs: defaultNotificationPrefs,
    integrationEvents: seedEvents,
    integrationChannels: seedChannels,
    adminAudit: [],
    activities: seedActivities,
    goodsReceipts: seedGoodsReceipts,
    cart: [],
    counters: { request: 146, invoice: 407, shipment: 217, customer: 10093, application: 316, payment: 710, receipt: seedGoodsReceipts.length + 1 },
  })
}

function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState
      if (parsed.version === STATE_VERSION) {
        for (const r of parsed.requests ?? []) if (r.sap?.inFlight) r.sap.inFlight = false // a reload interrupted a call: allow retry
        return parsed
      }
    }
  } catch {
    /* storage unavailable or corrupt — fall back to seed */
  }
  return seedState()
}

// ─── Results ──────────────────────────────────────────────────────────────

export interface GoodsReceiptInput {
  deliveryNumber: string
  /** yyyy-mm-dd */
  receivedOn: string
  remarks?: string
  lines: { itemNo: number; receivedQty: number; damagedQty: number; note?: string }[]
}

export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }
const fail = (error: string) => ({ ok: false as const, error })
const DENIED = 'You do not have permission to perform this action.'

// ─── Pure helpers / selectors ─────────────────────────────────────────────

export function currentUserOf(s: Pick<DemoState, 'session' | 'users'>): DemoUser {
  const sess = s.session
  if (!sess || new Date(sess.expiresAt).getTime() < Date.now()) return GUEST
  const u = s.users.find((x) => x.id === sess.userId)
  return u && u.active ? u : GUEST
}

export const permissionsOf = (s: Pick<DemoState, 'roles'>, user: DemoUser) => permissionsFor(s.roles, user)
export const canFor = (s: Pick<DemoState, 'roles'>, user: DemoUser): Can => makeCan(permissionsOf(s, user))

export const workflowCtx = (s: DemoState): WorkflowCtx => ({ workflow: s.onboardingWorkflow, users: s.users, roles: s.roles, territories: s.territories, regions })

/** Territory ids whose records the user may see. */
export function territoriesInScope(s: DemoState, user: DemoUser, can: Can): string[] {
  if (can('customer.view_all') || can('order.view_all')) return s.territories.map((t) => t.id)
  const out = assignedTerritoryIds(s, user)
  if (user.customerId) {
    const c = s.customers.find((x) => x.id === user.customerId)
    if (c) out.add(c.territoryId)
  }
  return [...out]
}

/** Customer (customer) ids the user may see. */
export const customerScope = (s: DemoState, user: DemoUser, can: Can) => customerScopeOf(s, user, can)

export const stageRoleOf = (s: DemoState) => (stageId?: string) => stageById(s.onboardingWorkflow, stageId)?.roleId

export const visibleApplications = (s: DemoState, user: DemoUser, can: Can) =>
  s.applications.filter((a) => canViewApplication(user, can, a, stageRoleOf(s), assignedTerritoryIds(s, user)))

/** Notifications addressed to the user (by user id, or by one of the user's roles). */
export const notificationsFor = (s: Pick<DemoState, 'notifications'>, user: DemoUser) =>
  s.notifications.filter((n) => n.userIds?.includes(user.id) || n.audience.some((r) => user.roleIds.includes(r)))

export function rulesForValue(rules: ApprovalRule[], valueUsd: number) {
  const active = rules.filter((r) => r.active).sort((a, b) => a.minValueUsd - b.minValueUsd)
  return active.find((r) => valueUsd >= r.minValueUsd && (r.maxValueUsd === null || valueUsd < r.maxValueUsd)) ?? active.at(-1)!
}

export function approverIdFor(s: DemoState, stage: ApprovalStep['stage'], territoryId: string) {
  const t = s.territories.find((x) => x.id === territoryId)!
  if (stage === 'Account Manager') return t.managerId
  if (stage === 'Regional Manager') return regions.find((r) => r.id === t.regionId)!.managerId
  return s.users.find((u) => u.active && u.roleIds.includes('head_of_sales'))?.id ?? 'u-gm'
}

const ORDER_DECISION_PERMS = ['order.approve', 'order.reject', 'order.return_to_requester', 'order.return_to_previous_approver']

/** Can the user act on the request's current approval step? (stage role + assignment + permission) */
export function canActOn(s: DemoState, user: DemoUser, r: SalesOrderRequest, can: Can = canFor(s, user)) {
  if (r.status !== 'Pending Approval') return false
  const step = r.approvalSteps.find((x) => x.status === 'Pending')
  if (!step || !ORDER_DECISION_PERMS.some(can)) return false
  if (!user.roleIds.includes(ORDER_STAGE_ROLE[step.stage])) return false
  if (step.approverId === user.id) return true
  if (step.stage === 'Head of Sales') return true
  return assignedTerritoryIds(s, user).has(r.territoryId)
}

/** May the user submit (or retry) this internally approved request to SAP? Permission AND record scope are both required. */
export function canSubmitToSap(s: DemoState, user: DemoUser, r: SalesOrderRequest, can: Can = canFor(s, user)) {
  if (r.status !== 'Approved' || !r.sap || r.sap.inFlight) return false
  if (r.sap.status !== 'Pending SAP Creation' && r.sap.status !== 'SAP Creation Failed') return false
  if (!can('order.sap_submit')) return false
  return customerScopeOf(s, user, can).has(r.customerId)
}

export const pendingStep = (r: SalesOrderRequest) => r.approvalSteps.find((x) => x.status === 'Pending')

export const requestTotal = (r: Pick<SalesOrderRequest, 'lines'>) =>
  roundMoney(r.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0))

const userIdsOfCustomer = (s: DemoState, customerId: string) => s.users.filter((u) => u.customerId === customerId && u.active).map((u) => u.id)

/** Applicant e-mail addresses accepted for public tracking (account email + contact email). */
export function applicantEmailsOf(s: Pick<DemoState, 'users'>, app: RegistrationApplication) {
  const owner = s.users.find((u) => u.id === app.applicantUserId)
  return [app.contact.email, owner?.email].filter((x): x is string => !!x)
}

// ─── Action inputs ────────────────────────────────────────────────────────

export interface RequestDraftInput {
  id?: string
  customerId: string
  lines: OrderLine[]
  fulfilment: SalesOrderRequest['fulfilment']
  deliveryAddress?: SalesOrderRequest['deliveryAddress']
  collectionWarehouse?: string
  requestedDate: string
  customerPo?: string
  notes?: string
}

export type ApprovalDecision = 'approve' | 'reject' | 'changes' | 'return_previous'

export interface NewFile {
  name: string
  type: ApplicationDocument['type']
  sizeKb: number
}

export interface ApplicantRegistrationInput {
  account: { name: string; title: string; email: string; password: string }
  content: ApplicationContent
  documents: NewFile[]
  submit: boolean
}

export interface ApplicationEditInput {
  content: ApplicationContent
  addDocuments?: NewFile[]
  supersedeDocumentIds?: string[]
}

export interface UserInput {
  name: string
  email: string
  title: string
  kind: DemoUser['kind']
  department?: string
  roleIds: string[]
  territoryIds?: string[]
  regionId?: string
  reviewRegionIds?: string[]
  customerId?: string
  active: boolean
}

export const MIN_REMARK = 10

interface StoreApi {
  state: DemoState
  user: DemoUser
  isAuthenticated: boolean
  permissions: Set<string>
  can: Can
  canAny: (...p: string[]) => boolean
  tracking: ApplicationTrackingService
  resetDemo: () => void
  // auth
  login: (email: string, password: string) => Result<{ user: DemoUser }>
  logout: () => void
  // notifications
  markNotificationRead: (id: string, read?: boolean) => void
  markAllNotificationsRead: () => void
  // cart
  addToCart: (productId: string, qty: number) => void
  setCartQty: (productId: string, qty: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
  // requests
  saveDraft: (input: RequestDraftInput) => string
  submitRequest: (input: RequestDraftInput, ref: string) => string
  decideApproval: (requestId: string, decision: ApprovalDecision, comment: string) => Result<{ finalApproved?: boolean }>
  /** Submit / retry an internally approved request to SAP through the SAP service (development mock unless a live service is configured). */
  submitToSap: (requestId: string) => Promise<Result<{ outcome: 'confirmed' | 'partially_confirmed' | 'failed' | 'existing_returned'; message: string }>>
  cancelRequest: (requestId: string, comment: string) => void
  addRequestComment: (requestId: string, comment: string, internal?: boolean) => void
  confirmGoodsReceipt: (input: GoodsReceiptInput) => Promise<Result<{ ref: string; discrepancy: boolean }>>
  resolveReceiptDiscrepancy: (ackId: string, resolution: string) => Result
  // customer applications
  registerApplicant: (input: ApplicantRegistrationInput) => Result<{ appId: string; ref: string; trackingLink: string }>
  saveOwnApplication: (appId: string, input: ApplicationEditInput) => Result
  submitOwnApplication: (appId: string) => Result
  resubmitOwnApplication: (appId: string, note: string) => Result
  applicationAction: (appId: string, action: ReviewerAction, input: ReviewerInput) => Result
  commentOnApplication: (appId: string, text: string) => Result
  renewTrackingLink: (appId: string) => Result<{ link: string }>
  setCustomerStatus: (id: string, status: CustomerStatus, comment: string) => void
  // finance
  issueInvoice: (requestId: string) => void
  uploadReceipt: (invoiceId: string, file: { name: string; sizeKb: number }, meta: { valueDate: string; payerBank: string }) => void
  verifyPayment: (paymentId: string, decision: 'verify' | 'reject', note: string) => void
  // logistics
  advanceShipment: (shipmentId: string, note?: string) => void
  // documents
  addDocument: (doc: Omit<DocumentRecord, 'id' | 'uploadedAt' | 'uploadedById'>) => void
  // email
  sendEmail: (input: { threadId?: string; subject: string; to: { name: string; email: string }[]; body: string; attachments: { name: string; sizeKb: number }[]; customerId: string; requestId?: string }) => string
  markThreadRead: (threadId: string, unread?: boolean) => void
  setFollowUp: (threadId: string, status: FollowUpStatus, dueAt?: string, note?: string) => void
  linkThread: (threadId: string, customerId: string, requestId?: string) => void
  // admin
  updatePromoRules: (rules: PromoRules) => void
  updateApprovalRules: (rules: ApprovalRule[]) => Result
  // customers & sales activities
  updateOwnProfile: (input: { contacts: Contact[]; deliveryAddress: Address }) => Result
  reassignCustomerTerritory: (customerId: string, territoryId: string, reason: string) => Result
  /** Maintain the customer ↔ SAP business partner mapping (customer.manage). */
  setSapMapping: (customerId: string, businessPartner: string) => Result
  logActivity: (input: Omit<CustomerActivity, 'id' | 'territoryId' | 'ownerId' | 'createdAt'>) => Result<{ id: string }>
  updateActivity: (id: string, patch: Partial<Pick<CustomerActivity, 'status' | 'outcome' | 'notes' | 'nextActionAt'>>) => Result
  toggleNotificationPref: (id: string, channel: 'inApp' | 'email') => void
  createUser: (input: UserInput, password: string) => Result<{ id: string }>
  updateUser: (id: string, patch: Partial<UserInput>) => Result
  resetUserPassword: (id: string, password: string) => Result
  createRole: (input: { name: string; description: string; audience: Role['audience']; permissions: string[] }) => Result<{ id: string }>
  updateRole: (id: string, patch: { name?: string; description?: string }) => Result
  deleteRole: (id: string) => Result
  setRolePermission: (roleId: string, permission: string, granted: boolean) => Result
  updateOnboardingWorkflow: (def: WorkflowDef) => Result
  updateTerritory: (id: string, patch: Partial<Pick<Territory, 'managerId' | 'visibleBrandIds'>>) => void
  setIntegrationEvent: (event: IntegrationEvent) => void
}

const StoreContext = createContext<StoreApi | null>(null)

/** Fields belonging to each editable section of the application. */
const SECTION_FIELDS: Record<string, (keyof ApplicationContent)[]> = {
  company: ['companyName', 'legalName', 'crNumber', 'taxNumber', 'website', 'businessType', 'annualVolumeBand'],
  contact: ['contact', 'country', 'city', 'territoryId'],
  brands: ['requestedBrandIds'],
  addresses: ['billingAddress', 'deliveryAddress'],
}

function applicationProblems(a: RegistrationApplication): string | undefined {
  if (!a.companyName.trim() || !a.legalName.trim()) return 'Company details are incomplete.'
  if (!a.crNumber.trim() || !a.taxNumber.trim()) return 'Registration and tax numbers are required.'
  if (!a.contact.name.trim() || !a.contact.email.trim()) return 'A primary contact is required.'
  if (a.requestedBrandIds.length === 0) return 'Select at least one brand.'
  if (!a.billingAddress.line1.trim() || !a.deliveryAddress.line1.trim()) return 'Billing and delivery addresses are required.'
  if (a.documents.filter((d) => !d.supersededAt).length === 0) return 'Upload at least one supporting document.'
  return undefined
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(loadState)
  const stateRef = useRef(state)
  // The development SAP stand-in resolves customer ↔ BP and product ↔ material mappings from live TradeFlow data.
  configureSapDevMock({ customers: () => stateRef.current.customers, products: () => stateRef.current.products })
  const [, setTick] = useState(0)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [state])

  // Re-evaluate the session once a minute so expiry signs the user out.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  // Keep tabs in sync (sign-out in one tab signs out the others).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const next = JSON.parse(e.newValue) as DemoState
        if (next.version === STATE_VERSION) {
          stateRef.current = next
          setState(next)
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /** Clone the latest state, run the recipe, commit only if it succeeded. */
  const transact = useCallback(<R extends { ok: boolean }>(recipe: (draft: DemoState) => R): R => {
    const draft = structuredClone(stateRef.current)
    const r = recipe(draft)
    if (r.ok) {
      stateRef.current = draft
      setState(draft)
    }
    return r
  }, [])

  const mutate = useCallback((recipe: (draft: DemoState) => void) => transact((d) => (recipe(d), { ok: true })), [transact])

  const user = currentUserOf(state)
  const permissions = useMemo(() => permissionsOf(state, user), [state, user])

  const api = useMemo<StoreApi>(() => {
    const actorOf = (s: DemoState) => currentUserOf(s)
    const canOf = (s: DemoState) => canFor(s, actorOf(s))
    const log = (r: { activity: ActivityEntry[] }, actorId: string, action: string, kind: ActivityEntry['kind'], comment?: string) =>
      r.activity.push({ id: uid('act'), at: nowIso(), actorId, action, kind, comment: comment || undefined })
    const notify = (s: DemoState, n: Omit<AppNotification, 'id' | 'at' | 'read' | 'audience'> & { audience?: string[] }) =>
      s.notifications.unshift({ ...n, audience: n.audience ?? [], id: uid('n'), at: nowIso(), read: false })
    const notifyCustomer = (s: DemoState, customerId: string, n: Omit<AppNotification, 'id' | 'at' | 'read' | 'audience' | 'userIds'>) =>
      notify(s, { ...n, audience: ['operations_reviewer'], userIds: userIdsOfCustomer(s, customerId) })
    const deliver = (s: DemoState, drafts: NotificationDraft[]) =>
      drafts.forEach((d) => (d.userIds?.length || d.audience?.length) && notify(s, { kind: 'application', title: d.title, body: d.body, link: d.link, userIds: d.userIds, audience: d.audience }))
    const audit = (s: DemoState, area: AdminAuditEntry['area'], action: string, target: string, details?: string) =>
      s.adminAudit.unshift({ id: uid('aud'), at: nowIso(), actorId: actorOf(s).id, area, action, target, details })

    const buildSteps = (s: DemoState, customer: Customer, subtotal: number): ApprovalStep[] => {
      const rule = rulesForValue(s.approvalRules, toUsd(subtotal, customer.currency))
      return rule.stages.map((stage, i) => ({
        stage,
        approverId: approverIdFor(s, stage, customer.territoryId),
        status: i === 0 ? 'Pending' : 'Waiting',
        slaHours: rule.slaHours,
        enteredAt: i === 0 ? nowIso() : undefined,
      }))
    }

    const upsertDraft = (s: DemoState, input: RequestDraftInput, id: string, ref: string): SalesOrderRequest => {
      const customer = s.customers.find((c) => c.id === input.customerId)!
      const existing = s.requests.find((r) => r.id === id)
      const base: SalesOrderRequest = existing ?? {
        id,
        ref,
        customerId: customer.id,
        territoryId: customer.territoryId,
        currency: customer.currency,
        lines: [],
        promo: { eligibleUnits: 0, testers: 0, samples: 0, ruleVersion: s.promoRules.version },
        status: 'Draft',
        approvalSteps: [],
        fulfilment: 'Collection',
        requestedDate: input.requestedDate,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdById: actorOf(s).id,
        activity: [],
      }
      Object.assign(base, {
        customerId: customer.id,
        territoryId: customer.territoryId,
        currency: customer.currency,
        lines: input.lines,
        promo: calculatePromo(input.lines, s.products, s.promoRules),
        fulfilment: input.fulfilment,
        deliveryAddress: input.fulfilment === 'Delivery' ? input.deliveryAddress : undefined,
        collectionWarehouse: input.fulfilment === 'Collection' ? input.collectionWarehouse ?? warehouseFor(customer.territoryId) : undefined,
        requestedDate: input.requestedDate,
        customerPo: input.customerPo,
        notes: input.notes,
        updatedAt: nowIso(),
      })
      if (!existing) {
        log(base, actorOf(s).id, 'Request created', 'user')
        s.requests.unshift(base)
      }
      return base
    }

    const mayOrderFor = (s: DemoState, customerId: string) => {
      const actor = actorOf(s)
      const can = canFor(s, actor)
      if (can('order.create_on_behalf') && customerScope(s, actor, can).has(customerId)) return true
      return can('order.create') && actor.customerId === customerId
    }

    const createShipment = (s: DemoState, r: SalesOrderRequest) => {
      const pk = buildPacking(r)
      const shp: Shipment = {
        id: `shp-${r.id}`,
        ref: `SHP-${new Date().getFullYear()}-${String(s.counters.shipment++).padStart(4, '0')}`,
        requestId: r.id,
        customerId: r.customerId,
        status: 'Approved',
        mode: r.fulfilment === 'Delivery' ? 'Sea Freight' : 'Customer Collection',
        warehouse: r.collectionWarehouse ?? warehouseFor(r.territoryId),
        ...pk,
        history: [{ status: 'Approved', at: nowIso(), byId: 'u-system' }],
        documentIds: [],
      }
      s.shipments.unshift(shp)
      r.shipmentId = shp.id
    }

    const syncShipment = (s: DemoState, requestId: string, status: ShipmentStatus, byId: string, note?: string) => {
      const shp = s.shipments.find((x) => x.requestId === requestId)
      if (!shp || shp.status === status) return
      shp.status = status
      shp.history.push({ status, at: nowIso(), byId, note })
    }

    /** Final approval of a customer application: create the customer account (mock). */
    const activateCustomer = (s: DemoState, a: RegistrationApplication) => {
      if (a.customerId) return // never create a second account for the same registration
      const code = `CUST-${s.counters.customer++}`
      const customerId = uid('c')
      a.customerId = customerId
      const terr = s.territories.find((t) => t.id === a.territoryId)!
      const reviewer = [...a.history].reverse().find((e) => e.action === 'approve')?.actorId
      s.customers.unshift({
        id: customerId,
        code,
        name: a.companyName,
        legalName: a.legalName,
        country: a.country,
        city: a.city,
        territoryId: a.territoryId,
        status: 'Active',
        crNumber: a.crNumber,
        taxNumber: a.taxNumber,
        currency: terr.defaultCurrency,
        paymentTerms: '100% advance before release',
        creditLimit: 150_000,
        brandIds: a.requestedBrandIds,
        contacts: [{ id: uid('ct'), ...a.contact, primary: true }],
        billingAddress: a.billingAddress,
        deliveryAddress: a.deliveryAddress,
        customerSince: nowIso(),
        accountManagerId: terr.managerId,
        tier: 'New',
        territoryHistory: [{ territoryId: a.territoryId, from: nowIso(), byId: 'u-system', reason: 'Account created on approval' }],
      })
      a.documents
        .filter((d) => !d.supersededAt)
        .forEach((d) => s.documents.unshift({ id: uid('doc'), name: d.name, type: d.type, linkedTo: { kind: 'customer', id: customerId }, customerId, uploadedAt: d.uploadedAt, uploadedById: a.applicantUserId ?? 'u-system', sizeKb: d.sizeKb, status: 'Verified' }))
      a.history.push({ id: uid('wf'), at: nowIso(), actorId: 'system', action: 'account_created', toStatus: 'Approved', visibility: 'public', revision: a.revision, remarks: `Customer account ${code} created and Customer Portal User role assigned (prototype).` })
      s.adminAudit.unshift({ id: uid('aud'), at: nowIso(), actorId: reviewer ?? 'u-system', area: 'user', action: 'Customer account activated from approved registration', target: `${code} ${a.companyName}`, details: `${a.ref} approved by ${s.users.find((u) => u.id === reviewer)?.name ?? '—'}` })
      const owner = s.users.find((u) => u.id === a.applicantUserId)
      if (owner) {
        owner.roleIds = [...owner.roleIds.filter((r) => r !== 'applicant'), ...(owner.roleIds.includes('customer') ? [] : ['customer'])]
        owner.customerId = customerId
      }
      s.integrationEvents.unshift({ id: uid('ie'), entity: 'Business Partner', direction: 'Outbound', objectRef: code, status: 'Pending', at: nowIso(), attempts: 0, message: 'Queued for business partner creation (simulated — no ERP connection).', payloadPreview: JSON.stringify({ customer: code, country: a.country, role: 'Sold-to' }, null, 2) })
      notify(s, { kind: 'customer', title: `${a.companyName} is now a customer`, body: `Customer account ${code} is active (demo).`, link: `/app/customers/${customerId}`, audience: ['admin'], userIds: [reviewer, a.assignedToUserId].filter((x): x is string => !!x) })
    }

    /** Duplicate-registration checks (requirements §4, §13). Same normalised registration number = same company. */
    const normReg = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
    const existingCustomerFor = (s: DemoState, a: RegistrationApplication) => s.customers.find((c) => c.id !== a.customerId && normReg(c.crNumber) === normReg(a.crNumber))
    const duplicateRegistrationProblem = (s: DemoState, a: RegistrationApplication) => {
      if (!normReg(a.crNumber)) return undefined
      if (existingCustomerFor(s, a)) return 'A customer account with this commercial registration number already exists. If this is your company, please sign in with your existing account or contact us — a new registration is not needed.'
      const open = s.applications.find((x) => x.id !== a.id && normReg(x.crNumber) === normReg(a.crNumber) && !['Draft', 'Rejected'].includes(x.status))
      if (open) return 'A registration for this commercial registration number is already being processed. Please track the existing application instead of submitting a new one.'
      return undefined
    }

    const ownApplication = (s: DemoState, appId: string) => {
      const a = s.applications.find((x) => x.id === appId)
      const actor = actorOf(s)
      if (!a || a.applicantUserId !== actor.id) return undefined
      return a
    }

    return {
      state,
      user,
      isAuthenticated: user.id !== GUEST.id,
      permissions,
      can: makeCan(permissions),
      canAny: (...p) => p.some((x) => permissions.has(x)),
      tracking: createMockTrackingService(() => ({
        applications: stateRef.current.applications,
        workflow: stateRef.current.onboardingWorkflow,
        applicantEmailOf: (a) => applicantEmailsOf(stateRef.current, a),
      })),

      resetDemo: () => {
        const prev = stateRef.current
        const next = seedState()
        resetSapDevMock() // the development SAP stand-in returns to its seeded documents too
        // Keep the current session if that user still exists in the seed.
        if (prev.session && next.users.some((u) => u.id === prev.session!.userId)) next.session = prev.session
        stateRef.current = next
        setState(next)
      },

      // ── Authentication (PROTOTYPE — see src/auth/demoCredentials.ts) ──
      login: (email, password) => {
        let outcome: Result<{ user: DemoUser }> = fail('Incorrect email or password.')
        transact((s) => {
          const key = email.trim().toLowerCase()
          const attempt = (s.loginAttempts[key] ??= { failures: 0 })
          if (attempt.lockedUntil && new Date(attempt.lockedUntil).getTime() > Date.now()) {
            outcome = fail(`Too many failed sign-in attempts. Try again in ${LOCKOUT_MINUTES} minutes.`)
            return { ok: true }
          }
          const u = s.users.find((x) => x.email.toLowerCase() === key && x.id !== 'u-system')
          const cred = u && s.credentials.find((c) => c.userId === u.id)
          if (!u || !cred || cred.hash !== credentialHash(u.id, password) || !u.active) {
            attempt.failures += 1
            if (attempt.failures >= MAX_LOGIN_FAILURES) {
              attempt.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
              attempt.failures = 0
            }
            s.adminAudit.unshift({ id: uid('aud'), at: nowIso(), actorId: u?.id ?? 'guest', area: 'auth', action: 'Sign-in failed', target: key, details: u && !u.active ? 'Account deactivated' : undefined })
            outcome = fail(attempt.lockedUntil ? `Too many failed sign-in attempts. Try again in ${LOCKOUT_MINUTES} minutes.` : 'Incorrect email or password.')
            return { ok: true }
          }
          delete s.loginAttempts[key]
          s.session = { userId: u.id, issuedAt: nowIso(), expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString() }
          u.lastActiveAt = nowIso()
          s.cart = []
          s.adminAudit.unshift({ id: uid('aud'), at: nowIso(), actorId: u.id, area: 'auth', action: 'Signed in', target: u.email })
          outcome = { ok: true, user: u }
          return { ok: true }
        })
        return outcome
      },
      logout: () =>
        mutate((s) => {
          const u = actorOf(s)
          if (u.id !== GUEST.id) s.adminAudit.unshift({ id: uid('aud'), at: nowIso(), actorId: u.id, area: 'auth', action: 'Signed out', target: u.email })
          s.session = undefined
          s.cart = []
        }),

      markNotificationRead: (id, read = true) =>
        mutate((s) => {
          const n = notificationsFor(s, actorOf(s)).find((x) => x.id === id)
          if (n) n.read = read
        }),
      markAllNotificationsRead: () => mutate((s) => notificationsFor(s, actorOf(s)).forEach((n) => (n.read = true))),

      addToCart: (productId, qty) =>
        mutate((s) => {
          const item = s.cart.find((c) => c.productId === productId)
          if (item) item.quantity += qty
          else s.cart.push({ productId, quantity: qty })
        }),
      setCartQty: (productId, qty) =>
        mutate((s) => {
          if (qty <= 0) s.cart = s.cart.filter((c) => c.productId !== productId)
          else {
            const item = s.cart.find((c) => c.productId === productId)
            if (item) item.quantity = qty
            else s.cart.push({ productId, quantity: qty })
          }
        }),
      removeFromCart: (productId) => mutate((s) => void (s.cart = s.cart.filter((c) => c.productId !== productId))),
      clearCart: () => mutate((s) => void (s.cart = [])),

      saveDraft: (input) => {
        const id = input.id ?? uid('r')
        mutate((s) => {
          if (!mayOrderFor(s, input.customerId)) return
          const ref = `DRAFT-${String(s.counters.request).padStart(4, '0')}`
          const isNew = !s.requests.some((r) => r.id === id)
          if (isNew) s.counters.request++
          const r = upsertDraft(s, input, id, ref)
          if (r.status !== 'Returned for Clarification') r.status = 'Draft'
          log(r, actorOf(s).id, 'Draft saved', 'user')
        })
        return id
      },

      submitRequest: (input, ref) => {
        const id = input.id ?? uid('r')
        mutate((s) => {
          if (!mayOrderFor(s, input.customerId)) return
          if (!s.requests.some((r) => r.id === id)) s.counters.request++
          const r = upsertDraft(s, input, id, ref)
          if (r.ref.startsWith('DRAFT')) r.ref = ref
          const customer = s.customers.find((c) => c.id === r.customerId)!
          const resubmission = r.status === 'Returned for Clarification'
          r.approvalSteps = buildSteps(s, customer, requestTotal(r))
          r.status = 'Pending Approval'
          log(r, actorOf(s).id, resubmission ? 'Request revised and resubmitted' : 'Request submitted for approval', 'user', input.notes)
          const first = r.approvalSteps[0]!
          notify(s, { kind: 'approval', title: `${r.ref} awaits your approval`, body: `${customer.name} · ${r.approvalSteps.length} approval level(s)`, link: `/app/approvals/${r.id}`, userIds: [first.approverId] })
          notifyCustomer(s, customer.id, { kind: 'approval', title: `${r.ref} submitted`, body: `Now with ${s.users.find((u) => u.id === first.approverId)?.name} (${first.stage}).`, link: `/app/requests/${r.id}` })
          s.cart = []
        })
        return id
      },

      decideApproval: (requestId, decision, comment) =>
        transact((s): Result<{ finalApproved?: boolean }> => {
          const r = s.requests.find((x) => x.id === requestId)
          const actor = actorOf(s)
          const can = canFor(s, actor)
          if (!r || !canActOn(s, actor, r, can)) return fail('This request is not waiting for your decision.')
          const perm = { approve: 'order.approve', reject: 'order.reject', changes: 'order.return_to_requester', return_previous: 'order.return_to_previous_approver' }[decision]
          if (!can(perm)) return fail(DENIED)
          const text = comment.trim()
          if (decision !== 'approve' && text.length < MIN_REMARK) return fail(`Please enter a reason of at least ${MIN_REMARK} characters.`)
          const idx = r.approvalSteps.findIndex((x) => x.status === 'Pending')
          const step = r.approvalSteps[idx]!
          const customer = s.customers.find((c) => c.id === r.customerId)!
          r.updatedAt = nowIso()

          if (decision === 'return_previous') {
            const prev = r.approvalSteps[idx - 1]
            if (!prev) return fail('This is the first approval level — there is no previous approver.')
            const now = nowIso()
            step.history = [...(step.history ?? []), { status: 'Returned', actedAt: now, actedById: actor.id, comment: text, reopenedAt: now, reopenedById: actor.id }]
            step.status = 'Waiting'
            step.enteredAt = undefined
            prev.history = [...(prev.history ?? []), { status: prev.status, actedAt: prev.actedAt, actedById: prev.actedById, comment: prev.comment, reopenedAt: now, reopenedById: actor.id }]
            prev.status = 'Pending'
            prev.enteredAt = now
            prev.actedAt = undefined
            prev.actedById = undefined
            prev.comment = undefined
            log(r, actor.id, `Returned from ${step.stage} to ${prev.stage} (demo)`, 'return', text)
            notify(s, { kind: 'approval', title: `${r.ref} returned to you`, body: `${actor.name} (${step.stage}): ${text}`, link: `/app/approvals/${r.id}`, userIds: [prev.approverId] })
            return { ok: true }
          }

          step.actedAt = nowIso()
          step.actedById = actor.id
          step.comment = text || undefined
          if (decision === 'approve') {
            step.status = 'Approved'
            log(r, actor.id, `Approved at ${step.stage} stage (demo)`, 'approval', text)
            const next = r.approvalSteps[idx + 1]
            if (next) {
              next.status = 'Pending'
              next.enteredAt = nowIso()
              notify(s, { kind: 'approval', title: `${r.ref} awaits your approval`, body: `${customer.name} · approved by ${actor.name}`, link: `/app/approvals/${r.id}`, userIds: [next.approverId] })
              notifyCustomer(s, customer.id, { kind: 'approval', title: `${r.ref} approved by ${step.stage.toLowerCase()}`, body: `Now with ${s.users.find((u) => u.id === next.approverId)?.name} (${next.stage}).`, link: `/app/requests/${r.id}` })
            } else {
              // Internal approval only. SAP submission is a separate, tracked step (requirements §9).
              r.status = 'Approved'
              r.sap = { status: 'Pending SAP Creation', attempts: [] }
              log(r, 'u-system', 'All internal approvals complete — pending SAP submission', 'system')
              notifyCustomer(s, customer.id, { kind: 'approval', title: `${r.ref} approved`, body: 'Approved internally. It will now be submitted to SAP; you will be notified when SAP accepts it.', link: `/app/requests/${r.id}` })
              return { ok: true, finalApproved: true }
            }
          } else if (decision === 'reject') {
            step.status = 'Rejected'
            r.status = 'Rejected'
            log(r, actor.id, `Rejected at ${step.stage} stage (demo)`, 'rejection', text)
            notifyCustomer(s, customer.id, { kind: 'approval', title: `${r.ref} rejected`, body: text, link: `/app/requests/${r.id}` })
          } else {
            step.status = 'Returned for Clarification'
            r.status = 'Returned for Clarification'
            log(r, actor.id, `Returned to requester at ${step.stage} stage (demo)`, 'change', text)
            notifyCustomer(s, customer.id, { kind: 'approval', title: `Changes requested on ${r.ref}`, body: text, link: `/app/requests/${r.id}` })
          }
          return { ok: true }
        }),

      submitToSap: async (requestId) => {
        // 1) validate + lock (prevents double submission)
        const start = transact((s): Result<{ payload: SapSalesOrderPayload }> => {
          const r = s.requests.find((x) => x.id === requestId)
          const actor = actorOf(s)
          if (!r || !canSubmitToSap(s, actor, r)) return fail(r?.sap?.inFlight ? 'A submission is already in progress.' : DENIED)
          const customer = s.customers.find((c) => c.id === r.customerId)!
          r.sap!.inFlight = true
          log(r, actor.id, r.sap!.attempts.length ? `SAP submission retried (attempt ${r.sap!.attempts.length + 1})` : 'SAP submission initiated', 'system')
          r.sap!.idempotencyKey = r.id
          r.sap!.soldTo = customer.sapBusinessPartner
          const addr = r.fulfilment === 'Delivery' ? r.deliveryAddress ?? customer.deliveryAddress : undefined
          const payload: SapSalesOrderPayload = {
            idempotencyKey: r.id,
            requestId: r.id,
            requestRef: r.ref,
            customerId: customer.id,
            soldTo: customer.sapBusinessPartner,
            shipTo: addr ? `${addr.line1}, ${addr.city}, ${addr.country}` : `Collection · ${r.collectionWarehouse ?? 'regional DC'}`,
            currency: r.currency,
            paymentTerms: customer.paymentTerms,
            requestedDeliveryDate: r.requestedDate.slice(0, 10),
            customerReference: r.customerPo ?? r.ref,
            remarks: r.notes,
            items: r.lines.map((l, i) => {
              const p = s.products.find((x) => x.id === l.productId)
              return { lineNo: (i + 1) * 10, productId: l.productId, material: p?.sapMaterial ?? '', sku: p?.sku ?? l.productId, quantity: l.quantity, uom: p?.uom ?? 'EA', unitPrice: l.unitPrice }
            }),
          }
          return { ok: true, payload }
        })
        if (!start.ok) return start
        // 2) call the SAP service (mock in development mode)
        let res: SapSubmitResult
        try {
          res = await services.sap.submitSalesOrder(start.payload)
        } catch {
          res = { ok: false, errorCode: 'NETWORK', message: 'The SAP service could not be reached. No order was created. Please retry.', retryable: true }
        }
        // 3) record the response
        return transact((s): Result<{ outcome: 'confirmed' | 'partially_confirmed' | 'failed' | 'existing_returned'; message: string }> => {
          const r = s.requests.find((x) => x.id === requestId)
          if (!r?.sap) return fail('Request no longer available.')
          const actor = actorOf(s)
          const customer = s.customers.find((c) => c.id === r.customerId)!
          const at = nowIso()
          const mode = services.sap.mode
          r.sap.inFlight = false
          r.updatedAt = at
          if (res.ok) {
            const outcome = res.existing ? 'existing_returned' : res.fullyConfirmed ? 'confirmed' : 'partially_confirmed'
            r.sap.status = 'Sales Order Created'
            r.sap.fullyConfirmed = res.fullyConfirmed
            r.sap.documentNumber = res.documentNumber
            r.sap.confirmedQty = res.confirmedQty
            r.sap.errorCode = undefined
            r.sap.errorMessage = undefined
            r.sap.attempts.push({ at, byId: actor.id, outcome, mode, documentNumber: res.documentNumber, message: res.message })
            r.externalRef = res.documentNumber
            log(r, actor.id, `SAP sales order ${res.documentNumber}${res.existing ? ' returned for an already-processed request (no duplicate)' : ' created'}${mode === 'mock' ? ' (development mock)' : ''}`, 'system', res.message)
            if (!r.shipmentId) createShipment(s, r)
            s.integrationEvents.unshift({ id: uid('ie'), entity: 'Sales Order', direction: 'Outbound', objectRef: r.ref, targetRef: res.documentNumber, status: 'Synced', at, attempts: r.sap.attempts.length, message: res.message, payloadPreview: JSON.stringify(start.payload, null, 2) })
            notify(s, { kind: 'finance', title: 'Proforma invoice to issue', body: `${r.ref} (${customer.name}) accepted by SAP as ${res.documentNumber}.`, link: `/app/requests/${r.id}`, audience: ['operations_reviewer', 'finance'] })
            notifyCustomer(s, customer.id, { kind: 'approval', title: `Sales order ${res.documentNumber} created for ${r.ref}`, body: res.fullyConfirmed ? 'All quantities confirmed. Track delivery and invoices under Sales Orders.' : 'Some quantities are only partially confirmed — see the order for details.', link: `/app/requests/${r.id}` })
            return { ok: true, outcome, message: res.message }
          }
          r.sap.status = 'SAP Creation Failed'
          r.sap.errorCode = res.errorCode
          r.sap.errorMessage = res.message
          r.sap.attempts.push({ at, byId: actor.id, outcome: 'failed', mode, errorCode: res.errorCode, message: res.message })
          log(r, actor.id, `SAP submission failed (${res.errorCode})`, 'system', res.message)
          s.integrationEvents.unshift({ id: uid('ie'), entity: 'Sales Order', direction: 'Outbound', objectRef: r.ref, status: 'Failed', at, attempts: r.sap.attempts.length, errorCode: res.errorCode, message: res.message, payloadPreview: JSON.stringify(start.payload, null, 2) })
          return { ok: true, outcome: 'failed', message: res.message }
        })
      },

      cancelRequest: (requestId, comment) =>
        mutate((s) => {
          const r = s.requests.find((x) => x.id === requestId)
          const actor = actorOf(s)
          const can = canFor(s, actor)
          if (!r || !can('order.cancel') || !customerScope(s, actor, can).has(r.customerId)) return
          r.status = 'Cancelled'
          r.approvalSteps.forEach((st) => (st.status === 'Pending' || st.status === 'Waiting') && (st.status = 'Waiting'))
          log(r, actor.id, 'Request cancelled', 'user', comment)
        }),

      addRequestComment: (requestId, comment, internal) =>
        mutate((s) => {
          const r = s.requests.find((x) => x.id === requestId)
          const actor = actorOf(s)
          const can = canFor(s, actor)
          if (!r || !can('order.comment') || !customerScope(s, actor, can).has(r.customerId)) return
          // Only staff can write internal comments; a customer's comment is always visible to both sides.
          const isInternal = !!internal && actor.kind === 'internal'
          r.activity.push({ id: uid('act'), at: nowIso(), actorId: actor.id, action: isInternal ? 'Internal comment' : 'Comment added', kind: 'user', comment, internal: isInternal || undefined })
        }),

      confirmGoodsReceipt: async (input) => {
        const s0 = stateRef.current
        const actor = actorOf(s0)
        const can = canFor(s0, actor)
        if (!can('delivery.confirm_receipt')) return fail(DENIED)
        const ids = [...customerScope(s0, actor, can)]
        let d
        try {
          d = (await services.sapData.getDelivery({ customerIds: ids }, input.deliveryNumber)).delivery
        } catch (e) {
          return fail(e instanceof Error ? e.message : 'The delivery could not be loaded from SAP.')
        }
        if (d.status !== 'Goods Issued' && d.status !== 'Delivered') return fail('Receipt can be confirmed once the delivery has left the warehouse.')
        const today = new Date().toISOString().slice(0, 10)
        if (!input.receivedOn || input.receivedOn > today) return fail('Enter the date the goods were received (not in the future).')
        if (d.goodsIssueDate && input.receivedOn < d.goodsIssueDate.slice(0, 10)) return fail('The receipt date cannot be before the goods left the warehouse.')
        const lines = d.items.map((it) => {
          const l = input.lines.find((x) => x.itemNo === it.itemNo)
          return { itemNo: it.itemNo, productId: it.productId, description: it.description, deliveredQty: it.qty, receivedQty: l?.receivedQty ?? NaN, damagedQty: l?.damagedQty ?? 0, note: l?.note?.trim() || undefined }
        })
        for (const l of lines) {
          if (!Number.isInteger(l.receivedQty) || l.receivedQty < 0 || l.receivedQty > l.deliveredQty) return fail(`Received quantity for ${l.description} must be between 0 and ${l.deliveredQty}.`)
          if (!Number.isInteger(l.damagedQty) || l.damagedQty < 0 || l.damagedQty > l.receivedQty) return fail(`Damaged quantity for ${l.description} must be between 0 and the received quantity.`)
        }
        const discrepancy = lines.some((l) => l.receivedQty < l.deliveredQty || l.damagedQty > 0)
        if (discrepancy && !input.remarks?.trim() && lines.every((l) => !l.note)) return fail('Describe the discrepancy (missing or damaged goods) in the remarks.')
        let out: Result<{ ref: string; discrepancy: boolean }> = fail('Could not record the confirmation.')
        transact((s) => {
          if (s.goodsReceipts.some((g) => g.deliveryNumber === d.deliveryNumber)) {
            out = fail('Receipt for this delivery has already been confirmed.')
            return { ok: false }
          }
          const ref = `GRC-${new Date().getFullYear()}-${String(s.counters.receipt++).padStart(4, '0')}`
          const terr = s.territories.find((t) => t.id === s.customers.find((c) => c.id === d.customerId)?.territoryId)
          const ack: GoodsReceiptAck = {
            id: uid('grc'), ref, deliveryNumber: d.deliveryNumber, soNumber: d.soNumber, customerId: d.customerId, receivedOn: new Date(input.receivedOn).toISOString(), confirmedAt: nowIso(), confirmedById: actor.id,
            remarks: input.remarks?.trim() || undefined, lines, outcome: discrepancy ? 'Received with discrepancy' : 'Received in full',
            discrepancy: discrepancy ? { status: 'Open', routedTo: 'Operations (Finance & Fulfilment) and the account manager' } : undefined,
            sapUpdate: 'Not required — customer acknowledgement only',
          }
          s.goodsReceipts.unshift(ack)
          const customer = s.customers.find((c) => c.id === d.customerId)
          if (discrepancy) {
            notify(s, { kind: 'logistics', title: `Receipt discrepancy reported · ${d.deliveryNumber}`, body: `${customer?.name ?? ''}: ${ack.remarks ?? 'see delivery'}`, link: `/app/deliveries/${d.deliveryNumber}`, audience: ['operations_reviewer', 'logistics'], userIds: terr ? [terr.managerId] : undefined })
          }
          notifyCustomer(s, d.customerId, { kind: 'logistics', title: `Receipt confirmed · ${ref}`, body: `${d.deliveryNumber}: ${ack.outcome}.`, link: `/app/deliveries/${d.deliveryNumber}` })
          out = { ok: true, ref, discrepancy }
          return { ok: true }
        })
        return out
      },

      resolveReceiptDiscrepancy: (ackId, resolution) =>
        transact((s) => {
          const g = s.goodsReceipts.find((x) => x.id === ackId)
          const actor = actorOf(s)
          const can = canFor(s, actor)
          if (!g?.discrepancy || !can('delivery.resolve_discrepancy') || !customerScope(s, actor, can).has(g.customerId)) return fail(DENIED)
          if (resolution.trim().length < MIN_REMARK) return fail(`Describe the resolution (at least ${MIN_REMARK} characters).`)
          g.discrepancy = { ...g.discrepancy, status: 'Resolved', resolvedById: actor.id, resolvedAt: nowIso(), resolution: resolution.trim() }
          notifyCustomer(s, g.customerId, { kind: 'logistics', title: `Discrepancy resolved · ${g.deliveryNumber}`, body: resolution.trim(), link: `/app/deliveries/${g.deliveryNumber}` })
          return { ok: true }
        }),

      // ── Customer applications ──
      registerApplicant: (input) => {
        let out: Result<{ appId: string; ref: string; trackingLink: string }> = fail('Registration failed.')
        transact((s) => {
          const email = input.account.email.trim().toLowerCase()
          if (s.users.some((u) => u.email.toLowerCase() === email)) {
            out = fail('An account with this email already exists. Sign in to continue your application.')
            return { ok: false }
          }
          const pw = passwordProblems(input.account.password)
          if (pw.length) {
            out = fail(`Password must contain ${pw.join(', ')}.`)
            return { ok: false }
          }
          const userId = uid('u')
          s.users.push({ id: userId, name: input.account.name.trim(), email, title: input.account.title.trim(), roleIds: ['applicant'], kind: 'external', active: true, lastActiveAt: nowIso(), createdAt: nowIso() })
          s.credentials.push({ userId, hash: credentialHash(userId, input.account.password) })
          s.session = { userId, issuedAt: nowIso(), expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString() }
          const now = nowIso()
          const app: RegistrationApplication = {
            ...structuredClone(input.content),
            id: uid('a'),
            ref: `APP-${new Date().getFullYear()}-${String(s.counters.application++).padStart(4, '0')}`,
            workflowId: s.onboardingWorkflow.id,
            status: 'Draft',
            applicantUserId: userId,
            createdAt: now,
            updatedAt: now,
            documents: input.documents.map((d) => ({ ...d, id: uid('ad'), uploadedAt: now, revision: 1 })),
            revision: 1,
            revisions: [],
            history: [{ id: uid('wf'), at: now, actorId: userId, action: 'save_draft', toStatus: 'Draft', visibility: 'public', revision: 1 }],
            trackingToken: randomToken(),
            trackingTokenExpiresAt: ahead(30),
          }
          s.applications.unshift(app)
          s.adminAudit.unshift({ id: uid('aud'), at: now, actorId: userId, area: 'user', action: 'Applicant self-registered', target: email })
          if (input.submit) {
            const problem = applicationProblems(app) ?? duplicateRegistrationProblem(s, app)
            if (problem) {
              out = fail(problem)
              return { ok: false }
            }
            const r = submitDraft(workflowCtx(s), app, s.users.find((u) => u.id === userId)!)
            if (!r.ok) {
              out = r
              return { ok: false }
            }
            deliver(s, r.notifications)
          }
          out = { ok: true, appId: app.id, ref: app.ref, trackingLink: trackingLinkFor(app) }
          return { ok: true }
        })
        return out
      },

      saveOwnApplication: (appId, input) =>
        transact((s) => {
          const a = ownApplication(s, appId)
          const actor = actorOf(s)
          if (!a) return fail('Application not found.')
          if (!applicantCanEdit(a, actor, canFor(s, actor))) return fail('This application cannot be edited at the moment.')
          const correction = a.status === 'Returned for Information'
          const allowed = correction ? a.returnInfo!.editableSections : (['company', 'contact', 'brands', 'addresses', 'documents'] as const)
          for (const sec of allowed) for (const f of SECTION_FIELDS[sec] ?? []) (a as unknown as Record<string, unknown>)[f] = structuredClone(input.content[f])
          if (allowed.includes('documents')) {
            const now = nowIso()
            const rev = correction ? a.revision + 1 : a.revision
            for (const id of input.supersedeDocumentIds ?? []) {
              const d = a.documents.find((x) => x.id === id && !x.supersededAt)
              if (!d) continue
              if (!correction && d.revision === a.revision) a.documents = a.documents.filter((x) => x.id !== id)
              else Object.assign(d, { supersededAt: now, supersededInRevision: rev })
            }
            for (const f of input.addDocuments ?? []) a.documents.push({ ...f, id: uid('ad'), uploadedAt: now, revision: rev })
          } else if (input.addDocuments?.length || input.supersedeDocumentIds?.length) {
            return fail(`${SECTION_LABELS.documents} are not open for correction.`)
          }
          a.updatedAt = nowIso()
          return { ok: true }
        }),

      submitOwnApplication: (appId) =>
        transact((s) => {
          const a = ownApplication(s, appId)
          const actor = actorOf(s)
          if (!a) return fail('Application not found.')
          if (!canFor(s, actor)('application.create')) return fail(DENIED)
          const problem = applicationProblems(a) ?? duplicateRegistrationProblem(s, a)
          if (problem) return fail(problem)
          const r = submitDraft(workflowCtx(s), a, actor)
          if (!r.ok) return r
          deliver(s, r.notifications)
          return { ok: true }
        }),

      resubmitOwnApplication: (appId, note) =>
        transact((s) => {
          const a = ownApplication(s, appId)
          const actor = actorOf(s)
          if (!a) return fail('Application not found.')
          if (!canFor(s, actor)('application.resubmit')) return fail(DENIED)
          if (a.returnInfo?.type === 'correction') {
            const problem = applicationProblems(a)
            if (problem) return fail(problem)
          }
          const r = resubmit(workflowCtx(s), a, actor, note)
          if (!r.ok) return r
          deliver(s, r.notifications)
          return { ok: true }
        }),

      applicationAction: (appId, action, input) =>
        transact((s) => {
          const a = s.applications.find((x) => x.id === appId)
          const actor = actorOf(s)
          const can = canFor(s, actor)
          if (!a || !canViewApplication(actor, can, a, stageRoleOf(s), assignedTerritoryIds(s, actor))) return fail('Application not found.')
          if (action === 'approve' && a.customerId) return fail('This registration already has a customer account.')
          const dup = action === 'approve' ? existingCustomerFor(s, a) : undefined
          if (dup) return fail(`Customer ${dup.code} (${dup.name}) already has this registration number. Approving would create a duplicate account — return or reject the application instead.`)
          const r = applyReviewerAction(workflowCtx(s), a, actor, can, action, input)
          if (!r.ok) return r
          deliver(s, r.notifications)
          if (r.finalApproved) activateCustomer(s, a)
          return { ok: true }
        }),

      commentOnApplication: (appId, text) =>
        transact((s) => {
          const a = s.applications.find((x) => x.id === appId)
          const actor = actorOf(s)
          const can = canFor(s, actor)
          if (!a || !canViewApplication(actor, can, a, stageRoleOf(s), assignedTerritoryIds(s, actor))) return fail('Application not found.')
          const r = addInternalComment(a, actor, can, text)
          if (!r.ok) return r
          a.updatedAt = nowIso()
          return { ok: true }
        }),

      renewTrackingLink: (appId) => {
        let out: Result<{ link: string }> = fail('Application not found.')
        transact((s) => {
          const a = ownApplication(s, appId)
          if (!a) return { ok: false }
          a.trackingToken = randomToken()
          a.trackingTokenExpiresAt = ahead(30)
          out = { ok: true, link: trackingLinkFor(a) }
          return { ok: true }
        })
        return out
      },

      setCustomerStatus: (id, status, comment) =>
        mutate((s) => {
          const c = s.customers.find((x) => x.id === id)
          if (!c || !canOf(s)('customer.manage')) return
          audit(s, 'user', `Customer status → ${status}`, `${c.code} ${c.name}`, comment || undefined)
          c.status = status
        }),

      issueInvoice: (requestId) =>
        mutate((s) => {
          const r = s.requests.find((x) => x.id === requestId)
          // A proforma may only be issued once SAP has accepted the order (document number exists).
          if (!r || r.status !== 'Approved' || !r.sap?.documentNumber || !canOf(s)('invoice.issue')) return
          const inv = buildInvoice(r, s.counters.invoice++, nowIso(), 'Issued')
          s.invoices.unshift(inv)
          r.invoiceId = inv.id
          r.status = 'Awaiting Payment'
          s.payments.unshift({ id: uid('pay'), ref: `PAY-${new Date().getFullYear()}-${String(s.counters.payment++).padStart(4, '0')}`, invoiceId: inv.id, customerId: r.customerId, amount: inv.total, currency: inv.currency, method: 'Bank Transfer', status: 'Awaiting Receipt' })
          s.documents.unshift({ id: uid('doc'), name: `${inv.number}.pdf`, type: 'Proforma Invoice', linkedTo: { kind: 'invoice', id: inv.id }, customerId: r.customerId, uploadedAt: nowIso(), uploadedById: actorOf(s).id, sizeKb: 148, status: 'Final' })
          log(r, actorOf(s).id, `Proforma invoice ${inv.number} issued (demo)`, 'finance')
          syncShipment(s, r.id, 'Awaiting Payment', actorOf(s).id)
          notifyCustomer(s, r.customerId, { kind: 'finance', title: `Proforma invoice ${inv.number} issued`, body: `Please arrange payment for ${r.ref} and upload the receipt.`, link: `/app/invoices/${inv.id}` })
        }),

      uploadReceipt: (invoiceId, file, meta) =>
        mutate((s) => {
          const inv = s.invoices.find((i) => i.id === invoiceId)
          const p = s.payments.find((x) => x.invoiceId === invoiceId)
          const actor = actorOf(s)
          const can = canFor(s, actor)
          if (!inv || !p || !can('payment.upload_receipt') || !customerScope(s, actor, can).has(inv.customerId)) return
          p.receiptFile = { ...file, uploadedAt: nowIso() }
          p.valueDate = meta.valueDate
          p.payerBank = meta.payerBank
          p.status = 'Receipt Uploaded'
          inv.status = 'Receipt Uploaded'
          s.documents.unshift({ id: uid('doc'), name: file.name, type: 'Payment Receipt', linkedTo: { kind: 'invoice', id: inv.id }, customerId: inv.customerId, uploadedAt: nowIso(), uploadedById: actor.id, sizeKb: file.sizeKb, status: 'Pending Review' })
          const r = s.requests.find((x) => x.id === inv.requestId)
          if (r) log(r, actor.id, 'Payment receipt uploaded', 'finance', file.name)
          notify(s, { kind: 'finance', title: 'Payment receipt uploaded', body: `Proof of payment received for ${inv.number}.`, link: '/app/payments', audience: ['operations_reviewer', 'finance'] })
        }),

      verifyPayment: (paymentId, decision, note) =>
        mutate((s) => {
          const p = s.payments.find((x) => x.id === paymentId)
          if (!p || !canOf(s)('payment.verify')) return
          const inv = s.invoices.find((i) => i.id === p.invoiceId)!
          const r = s.requests.find((x) => x.id === inv.requestId)
          const actor = actorOf(s)
          p.note = note || undefined
          if (decision === 'verify') {
            p.status = 'Verified'
            p.verifiedById = actor.id
            p.verifiedAt = nowIso()
            inv.status = 'Payment Verified'
            s.documents.forEach((d) => d.type === 'Payment Receipt' && d.linkedTo.id === inv.id && (d.status = 'Verified'))
            if (r) {
              r.status = 'Payment Verified'
              log(r, actor.id, 'Payment verified (demo — no bank reconciliation performed)', 'finance', note)
              syncShipment(s, r.id, 'Payment Verified', actor.id)
            }
            notifyCustomer(s, p.customerId, { kind: 'finance', title: `Payment verified for ${inv.number}`, body: 'Your order moves to warehouse preparation.', link: `/app/invoices/${inv.id}` })
            notify(s, { kind: 'logistics', title: `Payment verified — prepare ${r?.ref ?? 'order'}`, body: 'Order can move to warehouse preparation.', link: r?.shipmentId ? `/app/shipments/${r.shipmentId}` : '/app/shipments', audience: ['operations_reviewer', 'logistics'] })
          } else {
            p.status = 'Rejected'
            inv.status = 'Issued'
            if (r) log(r, actor.id, 'Payment receipt rejected', 'finance', note)
            notifyCustomer(s, p.customerId, { kind: 'finance', title: `Payment receipt rejected for ${inv.number}`, body: note || 'Please upload a valid transfer confirmation.', link: `/app/invoices/${inv.id}` })
          }
        }),

      advanceShipment: (shipmentId, note) =>
        mutate((s) => {
          const shp = s.shipments.find((x) => x.id === shipmentId)
          if (!shp || !canOf(s)('shipment.update')) return
          const idx = SHIPMENT_FLOW.indexOf(shp.status)
          if (idx < SHIPMENT_FLOW.indexOf('Payment Verified') || idx >= SHIPMENT_FLOW.length - 1) return
          const next = SHIPMENT_FLOW[idx + 1]!
          const actor = actorOf(s)
          shp.status = next
          shp.history.push({ status: next, at: nowIso(), byId: actor.id, note: note || undefined })
          const r = s.requests.find((x) => x.id === shp.requestId)!
          if (next === 'Ready for Warehouse Preparation') r.status = 'In Fulfillment'
          if (next === 'Documents in Progress') {
            for (const type of ['Packing List', 'Commercial Invoice', 'Certificate of Origin'] as const) {
              const id = uid('doc')
              s.documents.unshift({ id, name: `${type.replace(/ /g, '_')}_${shp.ref}.pdf`, type, linkedTo: { kind: 'shipment', id: shp.id }, customerId: shp.customerId, uploadedAt: nowIso(), uploadedById: actor.id, sizeKb: 240, status: 'Draft' })
              shp.documentIds.push(id)
            }
          }
          if (next === 'Ready for Collection') {
            r.status = 'Ready for Collection'
            shp.collectionRef = `COL-${7000 + s.counters.shipment++}`
            shp.collectionWindow = 'Sun–Thu, 08:00–15:00 (bring collection reference & ID)'
            s.documents.forEach((d) => shp.documentIds.includes(d.id) && (d.status = 'Final'))
            notifyCustomer(s, shp.customerId, { kind: 'logistics', title: `${r.ref} is ready for collection`, body: `Collection reference ${shp.collectionRef} at ${shp.warehouse}.`, link: `/app/shipments/${shp.id}` })
          }
          if (next === 'Collected') {
            r.status = 'Collected'
            notifyCustomer(s, shp.customerId, { kind: 'logistics', title: `${r.ref} collected`, body: 'Goods released to the customer’s forwarder.', link: `/app/shipments/${shp.id}` })
          }
          log(r, actor.id, `Shipment status → ${next} (demo)`, 'logistics', note)
        }),

      addDocument: (doc) =>
        mutate((s) => {
          if (!canOf(s)('document.upload')) return
          s.documents.unshift({ ...doc, id: uid('doc'), uploadedAt: nowIso(), uploadedById: actorOf(s).id })
        }),

      sendEmail: (input) => {
        const threadId = input.threadId ?? uid('em')
        mutate((s) => {
          const actor = actorOf(s)
          if (!canFor(s, actor)('email.send')) return
          const msg: EmailMessage = {
            id: uid('m'),
            direction: actor.kind === 'external' ? 'inbound' : 'outbound',
            from: { name: actor.name, email: actor.email },
            to: input.to,
            sentAt: nowIso(),
            body: input.body,
            attachments: input.attachments,
            simulated: true,
          }
          const t = s.threads.find((x) => x.id === threadId)
          if (t) {
            t.messages.push(msg)
          } else {
            s.threads.unshift({ id: threadId, subject: input.subject, customerId: input.customerId, requestId: input.requestId, messages: [msg], followUp: { status: 'None' }, unread: false, labels: ['Demo'] })
          }
        })
        return threadId
      },
      markThreadRead: (threadId, unread = false) =>
        mutate((s) => {
          const t = s.threads.find((x) => x.id === threadId)
          if (t) t.unread = unread
        }),
      setFollowUp: (threadId, status, dueAt, note) =>
        mutate((s) => {
          const t = s.threads.find((x) => x.id === threadId)
          if (t && canOf(s)('followup.manage')) t.followUp = { status, dueAt, note, ownerId: actorOf(s).id }
        }),
      linkThread: (threadId, customerId, requestId) =>
        mutate((s) => {
          const t = s.threads.find((x) => x.id === threadId)
          if (t && canOf(s)('email.send')) {
            t.customerId = customerId
            t.requestId = requestId
          }
        }),

      // ── Administration ──
      updatePromoRules: (rules) =>
        mutate((s) => {
          if (!canOf(s)('workflow.manage')) return
          audit(s, 'workflow', 'Promotion rules updated', `Version ${rules.version}`)
          s.promoRules = rules
        }),
      updateApprovalRules: (rules) =>
        transact((s) => {
          if (!canOf(s)('workflow.manage')) return fail(DENIED)
          for (const r of rules.filter((x) => x.active))
            for (const st of r.stages) {
              const roleId = ORDER_STAGE_ROLE[st]
              if (!s.users.some((u) => u.active && u.roleIds.includes(roleId)))
                return fail(`“${r.name}” uses the ${st} level, but no active user has that role. Assign the role first or remove the level.`)
            }
          audit(s, 'workflow', 'Sales-order approval rules updated', `${rules.filter((r) => r.active).length} active rule(s)`)
          s.approvalRules = rules
          return { ok: true }
        }),

      updateOwnProfile: (input) =>
        transact((s) => {
          const actor = actorOf(s)
          if (!canFor(s, actor)('customer.edit_own') || !actor.customerId) return fail(DENIED)
          const c = s.customers.find((x) => x.id === actor.customerId)
          if (!c) return fail('Customer account not found.')
          if (!input.contacts.length || !input.contacts.some((x) => x.primary)) return fail('Keep at least one primary contact.')
          for (const ct of input.contacts) {
            if (!ct.name.trim() || !/^\S+@\S+\.\S+$/.test(ct.email)) return fail('Every contact needs a name and a valid email address.')
            if (!/^\+?[0-9 ()-]{7,20}$/.test(ct.phone)) return fail(`Enter a valid phone number for ${ct.name}.`)
          }
          if (!input.deliveryAddress.line1.trim() || !input.deliveryAddress.city.trim()) return fail('Delivery address needs a street and a city.')
          const before = JSON.stringify({ contacts: c.contacts, deliveryAddress: c.deliveryAddress })
          c.contacts = structuredClone(input.contacts)
          c.deliveryAddress = { ...structuredClone(input.deliveryAddress), country: c.deliveryAddress.country }
          c.profileUpdatedAt = nowIso()
          if (before !== JSON.stringify({ contacts: c.contacts, deliveryAddress: c.deliveryAddress })) {
            audit(s, 'customer', 'Customer updated own profile', `${c.code} ${c.name}`, 'Contacts / delivery address')
            const tsm = s.territories.find((t) => t.id === c.territoryId)?.managerId
            notify(s, { kind: 'customer', title: `${c.name} updated their profile`, body: 'Contacts or delivery address changed in the customer portal.', link: `/app/customers/${c.id}`, userIds: [tsm, c.accountManagerId].filter((x): x is string => !!x) })
          }
          return { ok: true }
        }),

      setSapMapping: (customerId, businessPartner) =>
        transact((s) => {
          const actor = actorOf(s)
          const can = canFor(s, actor)
          const c = s.customers.find((x) => x.id === customerId)
          if (!c || !can('customer.manage') || !customerScope(s, actor, can).has(customerId)) return fail(DENIED)
          const bp = businessPartner.trim()
          if (!/^\d{6,10}$/.test(bp)) return fail('Enter the SAP business partner number (6–10 digits).')
          const other = s.customers.find((x) => x.id !== customerId && x.sapBusinessPartner === bp)
          if (other) return fail(`Business partner ${bp} is already mapped to ${other.name}. One BP may map to one customer account only.`)
          const before = c.sapBusinessPartner
          c.sapBusinessPartner = bp
          audit(s, 'customer', 'SAP business partner mapping changed', `${c.code} ${c.name}`, `${before ?? 'none'} → ${bp}`)
          return { ok: true }
        }),

      reassignCustomerTerritory: (customerId, territoryId, reason) =>
        transact((s) => {
          if (!canOf(s)('customer.reassign')) return fail(DENIED)
          const c = s.customers.find((x) => x.id === customerId)
          const t = s.territories.find((x) => x.id === territoryId)
          if (!c || !t) return fail('Customer or territory not found.')
          if (c.territoryId === territoryId) return fail('The customer is already in this territory.')
          if (reason.trim().length < MIN_REMARK) return fail(`Please give a reason (at least ${MIN_REMARK} characters).`)
          const now = nowIso()
          const from = c.territoryId
          const hist = c.territoryHistory?.length ? c.territoryHistory : [{ territoryId: from, from: c.customerSince, byId: 'u-system' }]
          hist[hist.length - 1]!.to = now
          hist.push({ territoryId, from: now, byId: actorOf(s).id, reason: reason.trim() })
          c.territoryHistory = hist
          c.territoryId = territoryId
          const oldT = s.territories.find((x) => x.id === from)
          audit(s, 'territory', 'Customer moved to another territory', `${c.code} ${c.name}`, `${oldT?.name} → ${t.name}: ${reason.trim()}`)
          notify(s, { kind: 'customer', title: `${c.name} moved to ${t.name}`, body: `From ${oldT?.name}. Orders, invoices and history move with the account.`, link: `/app/customers/${c.id}`, userIds: [oldT?.managerId, t.managerId].filter((x): x is string => !!x) })
          return { ok: true }
        }),

      logActivity: (input) => {
        let out: Result<{ id: string }> = fail(DENIED)
        transact((s) => {
          const actor = actorOf(s)
          const can = canFor(s, actor)
          const c = s.customers.find((x) => x.id === input.customerId)
          if (!can('activity.manage') || !c || !customerScope(s, actor, can).has(c.id)) return { ok: false }
          if (input.subject.trim().length < 3) {
            out = fail('Enter a short subject.')
            return { ok: false }
          }
          const id = uid('ca')
          s.activities.unshift({ ...input, subject: input.subject.trim(), id, territoryId: c.territoryId, ownerId: actor.id, createdAt: nowIso() })
          out = { ok: true, id }
          return { ok: true }
        })
        return out
      },

      updateActivity: (id, patch) =>
        transact((s) => {
          const actor = actorOf(s)
          const a = s.activities.find((x) => x.id === id)
          if (!a) return fail('Activity not found.')
          if (!canFor(s, actor)('activity.manage') || (a.ownerId !== actor.id && !canFor(s, actor)('activity.view_all'))) return fail(DENIED)
          Object.assign(a, patch)
          return { ok: true }
        }),
      toggleNotificationPref: (id, channel) =>
        mutate((s) => {
          const p = s.notificationPrefs.find((x) => x.id === id)
          if (!p || !canOf(s)('workflow.manage')) return
          p[channel] = !p[channel]
          audit(s, 'workflow', `Notification ${channel === 'inApp' ? 'in-app' : 'email'} ${p[channel] ? 'enabled' : 'disabled'}`, p.event)
        }),

      createUser: (input, password) => {
        let out: Result<{ id: string }> = fail(DENIED)
        transact((s) => {
          if (!canOf(s)('user.manage')) return { ok: false }
          const email = input.email.trim().toLowerCase()
          if (!input.name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
            out = fail('Enter a name and a valid email address.')
            return { ok: false }
          }
          if (s.users.some((u) => u.email.toLowerCase() === email)) {
            out = fail('A user with this email already exists.')
            return { ok: false }
          }
          if (input.roleIds.length === 0) {
            out = fail('Assign at least one role.')
            return { ok: false }
          }
          const pw = passwordProblems(password)
          if (pw.length) {
            out = fail(`Temporary password must contain ${pw.join(', ')}.`)
            return { ok: false }
          }
          const id = uid('u')
          s.users.push({ ...structuredClone(input), email, id, lastActiveAt: nowIso(), createdAt: nowIso() })
          s.credentials.push({ userId: id, hash: credentialHash(id, password) })
          audit(s, 'user', 'User created', `${input.name} <${email}>`, `Roles: ${input.roleIds.join(', ')}`)
          out = { ok: true, id }
          return { ok: true }
        })
        return out
      },

      updateUser: (id, patch) =>
        transact((s) => {
          const actor = actorOf(s)
          if (!canFor(s, actor)('user.manage')) return fail(DENIED)
          const u = s.users.find((x) => x.id === id)
          if (!u) return fail('User not found.')
          if (patch.active === false && id === actor.id) return fail('You cannot deactivate your own account.')
          if (patch.roleIds && patch.roleIds.length === 0) return fail('Assign at least one role.')
          if (patch.email) {
            const email = patch.email.trim().toLowerCase()
            if (s.users.some((x) => x.id !== id && x.email.toLowerCase() === email)) return fail('Another user already uses this email.')
            patch = { ...patch, email }
          }
          const wasAdmin = u.active && u.roleIds.includes(PROTECTED_ROLE_ID)
          const willBeAdmin = (patch.active ?? u.active) && (patch.roleIds ?? u.roleIds).includes(PROTECTED_ROLE_ID)
          if (wasAdmin && !willBeAdmin && s.users.filter((x) => x.active && x.roleIds.includes(PROTECTED_ROLE_ID)).length <= 1)
            return fail('At least one active System Administrator must remain.')
          const changes = Object.entries(patch)
            .filter(([k, v]) => JSON.stringify((u as unknown as Record<string, unknown>)[k]) !== JSON.stringify(v))
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') || '—' : String(v ?? '—')}`)
          Object.assign(u, structuredClone(patch))
          if (changes.length) audit(s, 'user', patch.active === false ? 'User deactivated' : patch.active === true && changes.length === 1 ? 'User activated' : 'User updated', `${u.name} <${u.email}>`, changes.join(' · '))
          return { ok: true }
        }),

      resetUserPassword: (id, password) =>
        transact((s) => {
          if (!canOf(s)('user.manage')) return fail(DENIED)
          const u = s.users.find((x) => x.id === id)
          if (!u) return fail('User not found.')
          const pw = passwordProblems(password)
          if (pw.length) return fail(`Password must contain ${pw.join(', ')}.`)
          s.credentials = [...s.credentials.filter((c) => c.userId !== id), { userId: id, hash: credentialHash(id, password) }]
          audit(s, 'auth', 'Password reset by administrator', u.email)
          return { ok: true }
        }),

      createRole: (input) => {
        let out: Result<{ id: string }> = fail(DENIED)
        transact((s) => {
          if (!canOf(s)('role.manage')) return { ok: false }
          const name = input.name.trim()
          if (name.length < 3) {
            out = fail('Role name must be at least 3 characters.')
            return { ok: false }
          }
          if (s.roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
            out = fail('A role with this name already exists.')
            return { ok: false }
          }
          const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'role'
          let id = base
          for (let i = 2; s.roles.some((r) => r.id === id); i++) id = `${base}_${i}`
          const perms = input.permissions.filter((p) => PERMISSION_IDS.has(p))
          if (perms.length && !canOf(s)('permission.manage')) {
            out = fail('You may create the role, but granting permissions requires permission management rights.')
            return { ok: false }
          }
          s.roles.push({ id, name, description: input.description.trim(), audience: input.audience, system: false, permissions: perms })
          audit(s, 'role', 'Role created', name, perms.length ? `${perms.length} permission(s)` : undefined)
          out = { ok: true, id }
          return { ok: true }
        })
        return out
      },

      updateRole: (id, patch) =>
        transact((s) => {
          if (!canOf(s)('role.manage')) return fail(DENIED)
          const r = s.roles.find((x) => x.id === id)
          if (!r) return fail('Role not found.')
          if (patch.name !== undefined) {
            const name = patch.name.trim()
            if (name.length < 3) return fail('Role name must be at least 3 characters.')
            if (s.roles.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) return fail('A role with this name already exists.')
            r.name = name
          }
          if (patch.description !== undefined) r.description = patch.description.trim()
          audit(s, 'role', 'Role updated', r.name)
          return { ok: true }
        }),

      deleteRole: (id) =>
        transact((s) => {
          if (!canOf(s)('role.manage')) return fail(DENIED)
          const r = s.roles.find((x) => x.id === id)
          if (!r) return fail('Role not found.')
          if (r.system) return fail('Built-in roles cannot be deleted. Remove permissions instead.')
          const holders = s.users.filter((u) => u.roleIds.includes(id))
          if (holders.length) return fail(`Remove this role from ${holders.length} user(s) before deleting it.`)
          if (s.onboardingWorkflow.stages.some((st) => st.roleId === id)) return fail('This role is used by a workflow stage.')
          s.roles = s.roles.filter((x) => x.id !== id)
          audit(s, 'role', 'Role deleted', r.name)
          return { ok: true }
        }),

      setRolePermission: (roleId, permission, granted) =>
        transact((s) => {
          if (!canOf(s)('permission.manage')) return fail(DENIED)
          const r = s.roles.find((x) => x.id === roleId)
          if (!r) return fail('Role not found.')
          if (!PERMISSION_IDS.has(permission)) return fail('Unknown permission.')
          if (r.id === PROTECTED_ROLE_ID && CRITICAL_PERMISSIONS.includes(permission) && !granted)
            return fail('Critical administration permissions cannot be removed from the System Administrator role (prevents lock-out).')
          const has = r.permissions.includes(permission)
          if (has === granted) return { ok: true }
          r.permissions = granted ? [...r.permissions, permission] : r.permissions.filter((p) => p !== permission)
          audit(s, 'permission', granted ? 'Permission granted' : 'Permission revoked', r.name, permission)
          return { ok: true }
        }),

      updateOnboardingWorkflow: (def) =>
        transact((s) => {
          if (!canOf(s)('workflow.manage')) return fail(DENIED)
          const active = def.stages.filter((x) => x.active)
          if (active.length === 0) return fail('At least one stage must be active.')
          if (active[active.length - 1]!.kind !== 'approval') return fail('The last active stage must be an approval stage.')
          for (const st of def.stages) {
            const role = s.roles.find((r) => r.id === st.roleId)
            if (!role) return fail(`Stage “${st.name}” refers to an unknown role.`)
            const needed = st.kind === 'review' ? 'application.review' : 'application.approve'
            if (st.active && !role.permissions.includes(needed)) return fail(`“${role.name}” lacks the ${needed} permission, so nobody could act on the active stage “${st.name}”.`)
            if (st.active && !s.users.some((u) => u.active && u.roleIds.includes(role.id))) return fail(`No active user has the role “${role.name}” required by “${st.name}”.`)
          }
          const inFlight = (stageId: string) => s.applications.filter((a) => a.currentStageId === stageId && ['Submitted', 'Under Review', 'Resubmitted', 'Pending Approval'].includes(a.status)).length
          for (const st of def.stages) {
            const before = s.onboardingWorkflow.stages.find((x) => x.id === st.id)
            if (before?.active && !st.active && inFlight(st.id) > 0) return fail(`“${st.name}” has ${inFlight(st.id)} application(s) in progress and cannot be deactivated.`)
          }
          s.onboardingWorkflow = structuredClone(def)
          audit(s, 'workflow', 'Customer onboarding workflow updated', def.name, active.map((x) => x.name).join(' → '))
          return { ok: true }
        }),

      updateTerritory: (id, patch) =>
        mutate((s) => {
          const t = s.territories.find((x) => x.id === id)
          if (!t || !canOf(s)('territory.manage')) return
          Object.assign(t, patch)
          audit(s, 'territory', 'Territory updated', t.name, Object.keys(patch).join(', '))
        }),
      setIntegrationEvent: (event) =>
        mutate((s) => {
          const i = s.integrationEvents.findIndex((x) => x.id === event.id)
          if (i >= 0 && canOf(s)('integration.retry')) s.integrationEvents[i] = event
        }),
    }
  }, [state, user, permissions, mutate, transact])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

// ─── Convenience lookup hook ──────────────────────────────────────────────

export function useLookups() {
  const { state } = useStore()
  return useMemo(() => {
    const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]))
    const customers = byId(state.customers)
    const products = byId(state.products)
    const users = byId(state.users)
    const territories = byId(state.territories)
    const roles = byId(state.roles)
    const brandMap = byId(brands)
    const regionMap = byId(regions)
    return {
      customer: (id?: string) => (id ? customers.get(id) : undefined),
      product: (id: string) => products.get(id),
      user: (id?: string) => (id ? users.get(id) : undefined),
      role: (id?: string) => (id ? roles.get(id) : undefined),
      territory: (id?: string) => (id ? territories.get(id) : undefined),
      brand: (id: string) => brandMap.get(id),
      region: (id?: string) => (id ? regionMap.get(id) : undefined),
      request: (id?: string) => state.requests.find((r) => r.id === id),
      invoice: (id?: string) => state.invoices.find((r) => r.id === id),
      shipment: (id?: string) => state.shipments.find((r) => r.id === id),
    }
  }, [state])
}
