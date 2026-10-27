import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck,
  BadgeCheck,
  Bell,
  BookOpen,
  Boxes,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FolderOpen,
  GitBranch,
  Grid3X3,
  History,
  KeyRound,
  LayoutDashboard,
  Mail,
  MapPinned,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Warehouse,
  FilePlus2,
  FileClock,
  FileText,
  Scale,
  Hourglass,
  BookText,
  Banknote,
} from 'lucide-react'

/**
 * Navigation is driven by permissions (any-of), never by role names.
 * The same `permissions` list is used by the route guard, so hiding a menu item
 * and blocking a typed URL are always consistent.
 */
export interface NavItem {
  key: string
  label: string
  to: string
  icon: LucideIcon
  /** The user needs at least one of these permissions. */
  permissions: string[]
  /** Optional key used by the shell to render a count badge. */
  badge?: 'tasks' | 'notifications' | 'approvals' | 'email' | 'applications' | 'myApplications' | 'receipts'
  /** Highlight only on an exact path match (e.g. a list whose child path is another menu item). */
  end?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const ORDER_VIEW = ['order.view_own', 'order.view_assigned', 'order.view_all']

export const NAVIGATION: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { key: 'overview', label: 'Overview', to: '/app', icon: LayoutDashboard, permissions: ['dashboard.view'] },
      { key: 'tasks', label: 'My Tasks', to: '/app/tasks', icon: CheckSquare, permissions: ['task.view'], badge: 'tasks' },
      { key: 'notifications', label: 'Notifications', to: '/app/notifications', icon: Bell, permissions: ['notification.view'], badge: 'notifications' },
    ],
  },
  {
    title: 'Customer Management',
    items: [
      { key: 'customers', label: 'Customers', to: '/app/customers', icon: Users, permissions: ['customer.view_assigned', 'customer.view_all'] },
      { key: 'applications', label: 'Customer Onboarding', to: '/app/applications', icon: FileCheck2, permissions: ['application.view_assigned', 'application.view_territory', 'application.view_all'], badge: 'applications' },
      { key: 'activities', label: 'Visits & Activities', to: '/app/activities', icon: CalendarCheck, permissions: ['activity.view_assigned', 'activity.view_all'] },
      { key: 'performance', label: 'Territory Performance', to: '/app/performance', icon: BarChart3, permissions: ['performance.view_assigned', 'performance.view_all'] },
    ],
  },
  {
    title: 'Products',
    items: [{ key: 'catalog', label: 'Product Catalog', to: '/app/catalog', icon: BookOpen, permissions: ['catalog.view'] }],
  },
  {
    title: 'Sales',
    items: [
      { key: 'new-request', label: 'Create Sales Request', to: '/app/requests/new', icon: FilePlus2, permissions: ['order.create'] },
      { key: 'requests', label: 'Sales Requests', to: '/app/requests', icon: ClipboardList, permissions: ['order.create', 'order.create_on_behalf', 'order.approval_monitor'], end: true },
      { key: 'approvals', label: 'Request Approvals', to: '/app/approvals', icon: GitBranch, permissions: ['order.approve', 'order.reject', 'order.approval_monitor', 'order.sap_submit'], badge: 'approvals' },
      { key: 'orders', label: 'Sales Orders', to: '/app/orders', icon: ShoppingCart, permissions: ORDER_VIEW },
    ],
  },
  {
    title: 'Deliveries',
    items: [
      { key: 'deliveries', label: 'Deliveries', to: '/app/deliveries', icon: Truck, permissions: ['delivery.view'], badge: 'receipts' },
      { key: 'shipments', label: 'Warehouse Coordination', to: '/app/shipments', icon: Warehouse, permissions: ['shipment.view'] },
      { key: 'collection', label: 'Collection Readiness', to: '/app/collection', icon: PackageCheck, permissions: ['collection.view'] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { key: 'sap-invoices', label: 'Invoices', to: '/app/finance/invoices', icon: Receipt, permissions: ['finance.account_view'] },
      { key: 'open-invoices', label: 'Open Invoices', to: '/app/finance/open-invoices', icon: FileClock, permissions: ['finance.account_view'] },
      { key: 'outstanding', label: 'Outstanding Report', to: '/app/finance/outstanding', icon: Scale, permissions: ['finance.account_view'] },
      { key: 'aging', label: 'Invoice Aging', to: '/app/finance/aging', icon: Hourglass, permissions: ['finance.account_view'] },
      { key: 'ledger', label: 'Customer Ledger', to: '/app/finance/ledger', icon: BookText, permissions: ['finance.account_view'] },
      { key: 'sap-payments', label: 'Payments', to: '/app/finance/payments', icon: Banknote, permissions: ['finance.account_view'] },
      { key: 'payments', label: 'Payment Advice', to: '/app/payments', icon: CreditCard, permissions: ['payment.view'] },
      { key: 'invoices', label: 'Proforma Requests', to: '/app/invoices', icon: FileText, permissions: ['invoice.view'] },
    ],
  },
  {
    title: 'Communication',
    items: [
      { key: 'email', label: 'Email Conversations', to: '/app/email', icon: Mail, permissions: ['email.view'], badge: 'email' },
      { key: 'followups', label: 'Follow-ups', to: '/app/follow-ups', icon: CalendarClock, permissions: ['followup.manage'] },
    ],
  },
  {
    title: 'My Account',
    items: [
      { key: 'account', label: 'Business Profile', to: '/app/account', icon: Building2, permissions: ['customer.view_own'] },
      { key: 'my-applications', label: 'My Applications', to: '/app/my-applications', icon: BadgeCheck, permissions: ['application.view_own'], badge: 'myApplications' },
      { key: 'documents', label: 'Documents', to: '/app/documents', icon: FolderOpen, permissions: ['document.view'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { key: 'users', label: 'Users', to: '/app/admin/users', icon: UserCog, permissions: ['user.view'] },
      { key: 'roles', label: 'Roles & Permissions', to: '/app/admin/roles', icon: KeyRound, permissions: ['role.view'] },
      { key: 'authorization', label: 'Authorization Matrix', to: '/app/admin/authorization', icon: Grid3X3, permissions: ['role.view'] },
      { key: 'territories', label: 'Territory Management', to: '/app/admin/territories', icon: MapPinned, permissions: ['territory.view'] },
      { key: 'workflow', label: 'Workflow Rules', to: '/app/admin/workflow', icon: Boxes, permissions: ['workflow.view'] },
      { key: 'integration', label: 'Integration Monitor', to: '/app/admin/integration', icon: Activity, permissions: ['integration.view'] },
      { key: 'audit', label: 'Audit Trail', to: '/app/admin/audit', icon: History, permissions: ['audit.view'] },
    ],
  },
]

export function navigationFor(can: (p: string) => boolean): NavSection[] {
  return NAVIGATION.map((s) => ({ ...s, items: s.items.filter((i) => i.permissions.some(can)) })).filter((s) => s.items.length > 0)
}

/** Flattened lookup used for breadcrumbs and route guards. */
export const ALL_NAV_ITEMS = NAVIGATION.flatMap((s) => s.items)
export const navPermissions = (key: string) => ALL_NAV_ITEMS.find((i) => i.key === key)?.permissions ?? []

/** First page the user may open — used for role-aware landing after sign-in. */
export function landingPathFor(can: (p: string) => boolean) {
  if (!can('dashboard.view') && can('application.view_own')) return '/app/my-applications'
  return navigationFor(can)[0]?.items[0]?.to ?? '/app/no-access'
}
