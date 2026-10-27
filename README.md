# TradeFlow — B2B Distribution & Sales Portal (frontend prototype)

> **From Customer Request to Fulfillment.**
> A React + TypeScript customer portal prototype covering the full B2B cycle: registration → onboarding approval → sales request → internal approval → SAP sales order → SAP deliveries and customer goods-receipt confirmation → SAP invoices → outstanding, aging, ledger and payments. **There is no backend and no SAP connection.** Every SAP screen runs on a clearly labelled **development stand-in** ("Source: SAP development mock — not connected to SAP", `MOCK-` document numbers) behind typed service contracts. See `docs/SAP_INTEGRATION.md` (architecture, mappings, status model, backend work list) and `docs/CHANGES_ROUND5.md` (latest change report and tests).

## Setup and run

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check (tsc -b) + production build to dist/
npm run preview    # serve the production build
npm run lint       # oxlint
npm test           # unit tests (Vitest): workflow engine, authorization, public projection, tracking
npm run build:html # one self-contained file: dist-single/index.html
```

End-to-end scenarios (Python Playwright, against a running build):

```bash
npm run build && npm run preview &        # http://localhost:4173
python3 tests/e2e/scenarios.py            # 18 scenarios + 5 edge cases (five-account demo)
python3 tests/e2e/smoke.py                # every demo account × every permitted page, console errors
```

`build:html` inlines all code, styles and the logo into a single HTML file that opens by double-clicking (no server). It uses hash URLs (`#/app/...`) so routing works from disk; fonts load from Google Fonts when online, otherwise system fonts are used.

Open `/` for the public landing page, `/login` to sign in, `/register` to submit a Customer Application, or `/track` to follow an application without signing in.

Demo state is mirrored to `localStorage` so a demo survives a refresh. **Reset demo data** is on the sign-in page (and in the profile menu for administrators).

> Access control and the customer-onboarding workflow are documented in **[docs/ACCESS_CONTROL_AND_WORKFLOW.md](docs/ACCESS_CONTROL_AND_WORKFLOW.md)**, including everything that still needs a backend.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router 7 · Lucide React · Recharts · React Hook Form + Zod (small local resolver in `components/forms/zodResolver.ts`). No backend, no Next.js.

## Project structure

```
src/
  app/            router.tsx (lazy routes + permission guards), store.tsx (demo state, session, simulated actions with permission re-checks)
  auth/           permissions.ts (permission catalog), roles.ts (default roles), authorize.ts (central checks), guards.tsx (RequireAuth/RequirePermission/Can/403), demoCredentials.ts (PROTOTYPE ONLY)
  workflow/       onboarding.ts (configurable stages), engine.ts (pure transition rules), publicView.ts (applicant-safe projection), tracking.ts (mock public tracking)
  config/         brand.ts (product name/tagline — change here), navigation.ts (permission-driven sidebar + landing)
  components/
    layout/       AppShell, Sidebar, Topbar (search, notifications, help, profile/sign-out), PageHeader, Logo
    applications/ DistributorApplicationForm (register / draft / correction), PublicStatusCard
    ui/           Button, Badge/StatusBadge/DemoTag, Card, Dialog/ConfirmDialog/Drawer, Toast, Tabs, Popover menu, misc
    data-display/ DataTable (sort, paging, mobile cards), StatCard, Timeline, ApprovalChain, ProductVisual, FilterBar…
    forms/        Field controls, FileDrop (local-only), zodResolver
  pages/          public · dashboard · workspace · applications · customers (Customers) · catalog · orders · approvals · finance · logistics · communications · administration
  data/           typed seed data (org, catalog, customers, applications, transactions, communications, integration, config)
  services/       contracts.ts (service interfaces) + mock.ts (mock implementations) + index.ts (single switch point)
  hooks/          useScope (permission/assignment-based data scope + task generation), misc hooks
  types/          domain.ts — the full typed domain model
  utils/          formatting, FX (illustrative), promo calculation, time helpers
  styles/         design tokens (Tailwind @theme)
```

## Demo accounts and roles

Sign in at `/login`. The demo is built around **five primary accounts** (password **`TradeFlow@2026`**, shown on the sign-in page; prototype only). These are demonstration accounts, not a limit on customers: any number of customers can register and see only their own information.

| # | Demo account | Role | Responsibility |
|---|---|---|---|
| 1 | Omar Haddad (Gulf Horizon Trading) | Customer Portal User | Own profile (contacts, delivery address), statement and outstanding balance, sales history, order requests, invoices, shipments, inquiries, own applications |
| 2 | Priya Nair | Customer Onboarding Approver **+** Operations (Finance & Fulfilment) | Two roles on one user (no duplicate account). Onboarding: review registrations, internal comments, return for information, approve (activates the customer account) or reject. Operations: proforma, payment verification, shipments, SAP retry. **No sales-request approval.** |
| 3 | Daniel Okafor | Sales Representative / Account Manager | Gulf territories only: approves, rejects or returns customers' sales requests (first level), submits approved requests to SAP, customers, visits, performance. Territory registrations are read-only — **no onboarding approval** |
| 4 | Marcus Chen | Head of Sales | All territories: second-level approval of elevated requests (≥ USD 25k), SAP submission, consolidated performance, territory moves. Reads registrations; no onboarding decisions, no system administration |
| 5 | Elena Petrova | Administrator | Users, roles, permissions, authorization matrix, territory assignments, workflow configuration, integration monitor, audit trail. No business decisions |

Additional seeded records (same password, listed under "More test accounts"): other Account Managers (Faisal — Saudi Arabia, Sofia — UK & W. Europe, Ken — Asia, Amara — East Africa) so territory restrictions are visible; another customer (Jonas); and prospective customers with applications in various states. Optional roles with no seeded users — Regional Manager, Finance Officer, Logistics Coordinator, Read-only Auditor — remain available in Roles & Permissions.

## Implemented screens

Public: landing page · sign-in (`/login`) · Customer registration with account creation and save-draft · **Track Application** (`/track`, reference + registered email or secure time-limited link).
Workspace: permission-composed overview (compact customer dashboard with request KPIs, company card and catalogue/stock snapshot; Account Manager, Head of Sales, operations and admin dashboards; SAP-queue banner) · My tasks · Notifications.
Customer Portal: My Customer Profile (editable contacts and delivery address, statement with running balance, sales history, inquiries) · My Applications.
Customer Management: Customers (territory / manager / status filters, last activity) · Customer profile (sales history, visits & activities, territory assignment history and move) · Visits & Activities · Territory Performance (period, territory and manager filters; territory and manager comparison).
Customer onboarding: My Applications (list, detail, correct & resubmit, answer clarification, secure link) · Customer Onboarding dashboard (KPIs Total / Pending review / Under review / Returned / Approved / Rejected as filters; columns Ref, Company, Contact, Business email, Submitted, Status, Assigned reviewer, Actions; search, filters, sorting, pagination) · Application detail (stage track, action panel with confirmation dialogs, internal comments, internal/public history, revisions with field diff, current and superseded documents).
Sales: Product catalog (image with labelled fallback, SKU, category, description, price per UoM, stock with UoM, availability, over-stock warning, stock-source label) · Sales request wizard (search/filter, quantities, subtotal/tax note/estimated total, review & confirm) · Sales requests · **Request approvals** (KPIs Total / Pending / Under review / Approved / Rejected / Submitted to SAP; columns ref, customer, date, products, total, status, assigned rep; SAP queue) · Request detail (lines with image, available stock and SAP-confirmed quantity; approve / reject / return; **SAP submission panel** with attempts, errors and retry) · Orders · Proforma invoices · Payments.
Fulfillment: Shipment tracking · Shipment detail · Collection readiness · Documents.
Communication: Email split view · Follow-ups.
Administration: Users (multi-role, assignments, effective permissions, responsibilities) · Roles & permissions · Authorization matrix (editable, CSV export) · Territory management (Account Manager per territory, brand visibility) · Workflow rules (onboarding stages, approval bands, tester/sample rules, notifications) · Integration monitor · Audit trail (CSV export).

## Simulated features

- **Workflow A — customer onboarding:** register (creates an applicant account) → Customer Onboarding Approver reviews → approve, reject (mandatory reason), return for information (selected sections re-opened) or request clarification → resubmit (new revision). Approval creates the customer account once (duplicate registration numbers are refused at submission and at approval), assigns it to the territory's Account Manager, converts the applicant to a Customer Portal User and writes an audit entry. Optional extra stages (credit check, commercial, final) can be switched on in Workflow Rules. **Approving a customer never approves a sales request.**
- Customer visits, calls, meetings and follow-ups recorded by sales staff (planned → completed with outcome), visible to the territory's manager and the Head of Sales.
- Moving a customer to another territory keeps the account, orders, invoices and activities; the new territory's manager sees the full history and both managers are notified.
- **Workflow B — sales requests:** catalogue → cart → wizard with price/availability check through the mock service, case-pack validation, over-stock warnings, draft saving, confirmation dialog and a mock reference → status **Pending Approval** (the confirmation says it is saved in this browser only).
- Approval routing by USD value band (default: <25k Account Manager; ≥25k Account Manager → Head of Sales), SLA indicators, approve / reject / return for clarification / return to previous approver with mandatory reasons, acting user and timestamp recorded (earlier decisions kept); revise-and-resubmit.
- **SAP submission is separate from approval:** final internal approval sets *Approved · Pending SAP Creation* (no SAP document). A user with `order.sap_submit` submits (optionally straight after approving) through `services.sap.submitSalesOrder`; the response is recorded as *Sales Order Created* (all lines confirmed), *Submitted to SAP* (document created, some lines only partially confirmed) or *SAP Creation Failed* (error code + message, retry). Shipments and proforma invoices are only possible once SAP has accepted the order. Customers see plain-language status only, never error codes. Seed `SOR-2026-0127` starts in *SAP Creation Failed* to demonstrate retry.
- Finance issues proforma (creates invoice, payment record, document) → customer uploads receipt (**Receipt Uploaded**) → finance completes a checklist and marks **Verified** (or rejects).
- Shipment flow: Approved → Awaiting Payment → Payment Verified → Ready for Warehouse Preparation → Documents in Progress → Ready for Collection (collection reference generated) → Collected. Logistics advances the warehouse steps; payment steps follow Finance.
- In-app notifications addressed to specific users (assignee, applicant, the customer's own users) or roles; tasks generated from workflow state.
- Email compose/reply adds messages to local state only (marked "Simulated — not sent").
- Integration monitor records every SAP submission attempt; retries resolve via the mock service (timeouts recover, validation errors keep failing).
- Admin changes (users, roles, permission grants, onboarding stages, approval bands, promo rules, territories) apply immediately and are written to the audit trail.

## Tester & sample calculation — assumptions (illustrative, to be confirmed)

Implemented in `src/utils/promo.ts`, configurable in Administration › Workflow Rules:

1. Eligible units = units in categories *Eau de Parfum, Extrait de Parfum, Eau de Toilette* (body mists, home fragrance and gift sets excluded).
2. Calculated on the whole request, rounding down: testers = ⌊eligible ÷ 6⌋; samples = ⌊eligible ÷ 12⌋ × 4 (1.2 ml each).
3. Testers and samples are free of charge and shown separately from priced lines.

## SAP-backed customer portal (round 5)

- **Sales Orders** (`/app/orders`): portal requests and SAP orders with combined status, delivery and invoice status, and a lifecycle timeline.
- **Deliveries** (`/app/deliveries`): SAP deliveries, partial/multiple per order, plus **Confirm goods received** with discrepancy reporting. This is a TradeFlow acknowledgement, not an SAP goods receipt.
- **Finance** (`/app/finance/*`): SAP invoices and open invoices, invoice detail, outstanding report, invoice aging (5 buckets), customer ledger, posted payments with allocations. **Payment advice** (proof-of-payment upload) and **Proforma requests** remain as separate TradeFlow workflows.
- **SAP development simulator** (Administration › Integration Monitor, Priya or Elena): post deliveries, run billing, post payments, cancel invoices, simulate SAP outages and order-creation timeouts.

## Known limitations

- **Authentication, authorization, persistence, notifications and public tracking are simulated in the browser.** They demonstrate the intended behaviour but are not secure: anyone with browser dev-tools can read or change the local state. See `docs/ACCESS_CONTROL_AND_WORKFLOW.md` for what production needs.
- Demo passwords are checked against a non-cryptographic hash in localStorage; the shared demo password is displayed on purpose.
- Prices, stock, FX rates, credit limits, bank details and all SAP documents (`MOCK-SO/DL/INV/CM/PAY-…`) are fictional and produced by the development stand-in. Brands and customers are invented. Stock is labelled *demo data — not live SAP*.
- No product has a real image: the catalogue shows a labelled illustration. Setting `imageUrl` on a product (product master/DAM) displays the image; failed images fall back to the illustration.
- Taxes are not calculated (shown as such); totals exclude tax and freight.
- Uploaded files are never stored — only name and size; previews are placeholders.
- Single-browser state (localStorage); no multi-user concurrency.
- Charts labelled "Illustrative" use synthetic history. No i18n/RTL, no real email delivery, no tax logic.

## Future backend & SAP integration requirements

The UI talks to data through `src/services/contracts.ts`. Replace `mockServices` in `src/services/index.ts` with a real implementation backed by a separately developed BFF/integration layer. That layer would need to provide:

- **Identity & access:** SSO / identity provider, server-side sessions, and the permission + assignment model of `src/auth` enforced on every API call (details in `docs/ACCESS_CONTROL_AND_WORKFLOW.md`).
- **Customer registration:** persist applications, revisions and documents (object storage with virus scanning), the onboarding workflow engine, public tracking endpoint, and Business Partner creation/maintenance in S/4HANA on final approval.
- **Catalogue, pricing & availability:** product master, customer-specific pricing conditions and ATP/stock per plant.
- **Sales order requests:** persistence (`SalesOrderService.submitRequest` must store the request server-side), approval workflow engine (value bands, SLAs, delegation/escalation), audit trail.
- **SAP sales-order submission:** a server-side implementation of `SapOrderService` (see `src/services/contracts.ts`) behind the BFF — the browser sends only the request id; the BFF builds the payload, holds SAP credentials, calls the chosen S/4HANA API, persists document number, confirmations and errors, and supports idempotent retry.
- **Tester/sample policy:** confirmed rules, possibly as free-goods condition records.
- **Finance:** proforma generation (document templates), bank-reconciliation-backed payment verification, billing document references.
- **Logistics:** outbound delivery, picking/packing, shipping documents and goods-issue status.
- **Communication:** mail integration (send/receive, threading), notification delivery (email/in-app).
- **Integration operations:** queueing, retries, error handling and monitoring (feeding the Integration Monitor screen).

All SAP API selection, endpoints and credentials are deliberately out of scope for this prototype.
