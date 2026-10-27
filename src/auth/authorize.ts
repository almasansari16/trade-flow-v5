/**
 * Centralised authorization (prototype).
 *
 *  - Effective permissions = union of the permissions of the user's active roles.
 *  - Record-level access is derived from permissions + assignments + ownership,
 *    never from a role name alone.
 *
 * IMPORTANT: In this frontend prototype these checks only shape the UI and the
 * in-browser store. Production must enforce the same rules on the server for every
 * API call (route guards in the browser are not a security boundary).
 */
import type { ApprovalStageName, Customer, DemoUser, RegistrationApplication, Role, Territory } from '@/types/domain'

export const GUEST: DemoUser = {
  id: 'guest',
  name: 'Guest',
  email: '',
  title: '',
  roleIds: [],
  kind: 'external',
  active: false,
  lastActiveAt: new Date(0).toISOString(),
}

export function permissionsFor(roles: Role[], user: DemoUser): Set<string> {
  const out = new Set<string>()
  if (!user.active) return out
  for (const r of roles) if (user.roleIds.includes(r.id)) r.permissions.forEach((p) => out.add(p))
  return out
}

export type Can = (permission: string) => boolean
export const makeCan = (perms: Set<string>): Can => (p) => perms.has(p)
export const anyOf = (can: Can, list: string[]) => list.some(can)

interface ScopeData {
  territories: Territory[]
  customers: Customer[]
}

/** Territories assigned to the user (territory list, region, or own customer account). */
export function assignedTerritoryIds(d: ScopeData, user: DemoUser): Set<string> {
  const out = new Set<string>(user.territoryIds ?? [])
  if (user.regionId) d.territories.filter((t) => t.regionId === user.regionId).forEach((t) => out.add(t.id))
  return out
}

/**
 * Customer accounts the user may see.
 * view_all → every account; view_assigned → accounts in assigned territories; view_own → own account.
 */
export function customerScope(d: ScopeData, user: DemoUser, can: Can): Set<string> {
  if (can('customer.view_all') || can('order.view_all')) return new Set(d.customers.map((c) => c.id))
  const out = new Set<string>()
  if (can('customer.view_assigned') || can('order.view_assigned')) {
    const terr = assignedTerritoryIds(d, user)
    d.customers.filter((c) => terr.has(c.territoryId)).forEach((c) => out.add(c.id))
  }
  if ((can('customer.view_own') || can('order.view_own')) && user.customerId) out.add(user.customerId)
  return out
}

/** Can the user open this customer application? (Drafts are private to the applicant.) */
export function canViewApplication(user: DemoUser, can: Can, app: RegistrationApplication, stageRoleOf: (stageId?: string) => string | undefined, territoryIds?: Set<string>): boolean {
  if (app.applicantUserId === user.id && can('application.view_own')) return true
  if (app.status === 'Draft') return false
  if (can('application.view_all')) return true
  // Read access to applications from the user's own territories (e.g. Account Manager).
  if (can('application.view_territory') && territoryIds?.has(app.territoryId)) return true
  if (can('application.view_assigned')) {
    if (app.assignedToUserId === user.id) return true
    if (app.history.some((e) => e.actorId === user.id || e.toUserId === user.id)) return true
    const stageRole = stageRoleOf(app.currentStageId)
    if (!app.assignedToUserId && stageRole && user.roleIds.includes(stageRole)) return true
  }
  return false
}

/** Role that acts on each sales-order approval level. */
export const ORDER_STAGE_ROLE: Record<ApprovalStageName, string> = {
  'Account Manager': 'territory_sales_manager',
  'Regional Manager': 'regional_manager',
  'Head of Sales': 'head_of_sales',
}
