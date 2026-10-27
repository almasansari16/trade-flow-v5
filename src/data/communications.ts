import type { AppNotification, EmailThread } from '@/types/domain'
import { ago, ahead } from '@/utils/time'

const ext = (name: string, email: string) => ({ name, email })
const priya = ext('Priya Nair', 'priya.nair@tradeflow.example')
const aisha = ext('Aisha Siddiqui', 'aisha.siddiqui@tradeflow.example')
const carlos = ext('Carlos Mendes', 'carlos.mendes@tradeflow.example')
const daniel = ext('Daniel Okafor', 'daniel.okafor@tradeflow.example')

export const emailThreads: EmailThread[] = [
  {
    id: 'em-1', subject: 'SOR-2026-0136 — national day promotion order', customerId: 'c-001', requestId: 'r-136', unread: true, labels: ['Order'],
    followUp: { status: 'Due Today', dueAt: ahead(0, 4), ownerId: 'u-sc', note: 'Confirm Royal Oud allocation before TM approval' },
    messages: [
      { id: 'm-1a', direction: 'inbound', from: ext('Omar Haddad', 'omar.haddad@gulfhorizon.example'), to: [priya], sentAt: ago(1, 1), attachments: [{ name: 'GHT-PO-7856.pdf', sizeKb: 96 }],
        body: 'Hi Priya,\n\nWe have submitted SOR-2026-0136 for our national day campaign. Royal Oud is the hero SKU — could you check whether the full 420 units can be allocated from Jebel Ali?\n\nOur PO is attached for reference.\n\nBest regards,\nOmar' },
      { id: 'm-1b', direction: 'outbound', from: priya, to: [ext('Omar Haddad', 'omar.haddad@gulfhorizon.example')], sentAt: ago(0, 20), attachments: [],
        body: 'Hi Omar,\n\nThanks — the request is with Daniel for territory approval. Current availability shows 1,420 units of Royal Oud, so allocation looks fine. Because the value exceeds USD 100k it will also go to Layla and Marcus.\n\nI will update you as soon as it moves.\n\nKind regards,\nPriya' },
      { id: 'm-1c', direction: 'inbound', from: ext('Omar Haddad', 'omar.haddad@gulfhorizon.example'), to: [priya], sentAt: ago(0, 3), attachments: [],
        body: 'Thanks Priya. Our campaign artwork goes to print on Thursday, so a decision by Wednesday evening would really help.\n\nOmar' },
    ],
  },
  {
    id: 'em-2', subject: 'Payment receipt — PI-2026-0405', customerId: 'c-001', requestId: 'r-131', unread: true, labels: ['Finance'],
    followUp: { status: 'Open', dueAt: ahead(1), ownerId: 'u-sc' },
    messages: [
      { id: 'm-2a', direction: 'outbound', from: aisha, to: [ext('Rania Khoury', 'accounts@gulfhorizon.example')], sentAt: ago(9), attachments: [{ name: 'PI-2026-0405.pdf', sizeKb: 148 }],
        body: 'Dear Rania,\n\nPlease find attached proforma invoice PI-2026-0405 for SOR-2026-0131. Kindly upload the transfer confirmation in the portal once payment is made.\n\nRegards,\nAisha Siddiqui\nFinance' },
      { id: 'm-2b', direction: 'inbound', from: ext('Rania Khoury', 'accounts@gulfhorizon.example'), to: [aisha], sentAt: ago(7, 18), attachments: [{ name: 'Transfer_Confirmation_PI-2026-0405.pdf', sizeKb: 186 }],
        body: 'Dear Aisha,\n\nPayment was released today. The confirmation is attached and has also been uploaded in the portal.\n\nBest,\nRania' },
    ],
  },
  {
    id: 'em-3', subject: 'Collection booking — SHP-2026-0211', customerId: 'c-002', requestId: 'r-124', unread: false, labels: ['Logistics'],
    followUp: { status: 'Open', dueAt: ahead(2), ownerId: 'u-sc', note: 'Confirm truck plate and driver ID' },
    messages: [
      { id: 'm-3a', direction: 'outbound', from: carlos, to: [ext('Yousef Al-Harbi', 'yousef@alnoor-perfumes.example')], sentAt: ago(1, 5), attachments: [{ name: 'Packing_List_SHP-2026-0211.pdf', sizeKb: 290 }],
        body: 'Dear Yousef,\n\nYour order is ready for collection at Jebel Ali DC. Please share the forwarder name, truck plate number and driver ID so we can register the gate pass.\n\nCollection window: Sun–Thu, 08:00–15:00.\n\nRegards,\nCarlos' },
    ],
  },
  {
    id: 'em-4', subject: 'Revised quantities for SOR-2026-0141', customerId: 'c-007', requestId: 'r-141', unread: false, labels: ['Order', 'Changes'],
    followUp: { status: 'Overdue', dueAt: ago(1), ownerId: 'u-sc', note: 'Customer to resubmit with split shipment' },
    messages: [
      { id: 'm-4a', direction: 'outbound', from: priya, to: [ext('Sana Qureshi', 'sana@indusluxe.example')], sentAt: ago(5, 2), attachments: [],
        body: 'Dear Sana,\n\nKen has asked for SOR-2026-0141 to be split into two shipments because your LC covers USD 25k per draw. Could you revise the request accordingly?\n\nKind regards,\nPriya' },
      { id: 'm-4b', direction: 'inbound', from: ext('Sana Qureshi', 'sana@indusluxe.example'), to: [priya], sentAt: ago(3, 7), attachments: [],
        body: 'Hi Priya, understood. We are amending the LC with our bank and will resubmit early next week.\n\nSana' },
    ],
  },
  {
    id: 'em-5', subject: 'Documents for VAT re-registration', customerId: 'c-003', unread: false, labels: ['Customer'],
    followUp: { status: 'Open', dueAt: ahead(5), ownerId: 'u-sc', note: 'Commercial registration expired' },
    messages: [
      { id: 'm-5a', direction: 'outbound', from: priya, to: [ext('Hamad Al-Kuwari', 'hamad@pearlcoast.example')], sentAt: ago(2), attachments: [],
        body: 'Dear Hamad,\n\nOur records show your commercial registration certificate has expired. Please upload the renewed certificate so that your account remains active for new orders.\n\nThank you,\nPriya' },
    ],
  },
  {
    id: 'em-6', subject: 'Flagship opening — Musk Al Layl pre-order', customerId: 'c-002', requestId: 'r-139', unread: true, labels: ['Order'],
    followUp: { status: 'None' },
    messages: [
      { id: 'm-6a', direction: 'inbound', from: ext('Yousef Al-Harbi', 'yousef@alnoor-perfumes.example'), to: [priya, daniel], sentAt: ago(0, 8), attachments: [{ name: 'Flagship_Layout_Riyadh.pdf', sizeKb: 2240 }],
        body: 'Dear team,\n\nSharing the store layout for our Riyadh flagship. The Musk Al Layl pre-order in SOR-2026-0139 is planned for the hero wall. Any update on the GM approval?\n\nRegards,\nYousef' },
    ],
  },
  {
    id: 'em-7', subject: 'Welcome to the customer portal', customerId: 'c-011', unread: false, labels: ['Onboarding'],
    followUp: { status: 'Done', dueAt: ago(18), ownerId: 'u-sc' },
    messages: [
      { id: 'm-7a', direction: 'outbound', from: priya, to: [ext('Jonas Becker', 'jonas@nordlicht.example')], sentAt: ago(21), attachments: [{ name: 'Portal_Quick_Start.pdf', sizeKb: 640 }],
        body: 'Dear Jonas,\n\nWelcome aboard! Your account CUST-10092 is active. The attached quick-start guide explains how to browse the catalogue and submit your first order request.\n\nBest regards,\nPriya' },
      { id: 'm-7b', direction: 'inbound', from: ext('Jonas Becker', 'jonas@nordlicht.example'), to: [priya], sentAt: ago(19), attachments: [],
        body: 'Danke Priya — we will place our first order after the trade fair.\n\nJonas' },
    ],
  },
  {
    id: 'em-8', subject: 'Account on hold — outstanding documents', customerId: 'c-008', unread: false, labels: ['Customer'],
    followUp: { status: 'Overdue', dueAt: ago(3), ownerId: 'u-sc' },
    messages: [
      { id: 'm-8a', direction: 'outbound', from: priya, to: [ext('Wanjiru Kamau', 'wanjiru@savannafh.example')], sentAt: ago(10), attachments: [],
        body: 'Dear Wanjiru,\n\nYour account has been placed on hold pending the renewed business permit. Once uploaded, we will reactivate ordering within one working day.\n\nKind regards,\nPriya' },
    ],
  },
]

export const notifications: AppNotification[] = [
  { id: 'n-1', kind: 'approval', title: 'SOR-2026-0136 awaits your approval', body: 'Gulf Horizon Trading · AED 439k · Strategic order (3 levels)', at: ago(0, 18), read: false, link: '/app/approvals/r-136', audience: [], userIds: ['u-tm1'] },
  { id: 'n-2', kind: 'approval', title: 'SLA breached: SOR-2026-0137', body: 'Muscat Royal Trading has been waiting 38 hours at Account Manager stage.', at: ago(0, 14), read: false, link: '/app/approvals/r-137', audience: ['operations_reviewer'], userIds: ['u-tm1'] },
  { id: 'n-3', kind: 'approval', title: 'SOR-2026-0145 awaits your approval', body: 'Gulf Horizon Trading · approved by Daniel Okafor', at: ago(0, 14), read: false, link: '/app/approvals/r-145', audience: [], userIds: ['u-gm'] },
  { id: 'n-4', kind: 'approval', title: 'SOR-2026-0138 awaits your approval', body: 'Pearl Coast Retail · QAR 137k', at: ago(0, 10), read: true, link: '/app/approvals/r-138', audience: [], userIds: ['u-gm'] },
  { id: 'n-5', kind: 'approval', title: 'Final approval needed: SOR-2026-0139', body: 'Al Noor Perfumes · SAR 413k · flagship store launch', at: ago(1, 6), read: false, link: '/app/approvals/r-139', audience: [], userIds: ['u-gm'] },
  { id: 'n-6', kind: 'finance', title: 'Payment receipt uploaded', body: 'Gulf Horizon Trading uploaded proof of payment for PI-2026-0405.', at: ago(7, 18), read: false, link: '/app/payments', audience: ['finance'] },
  { id: 'n-7', kind: 'finance', title: 'Proforma invoice to issue', body: 'SOR-2026-0127 (Maison Rive Distribution) is approved and awaiting a proforma invoice.', at: ago(4), read: false, link: '/app/orders', audience: ['finance'] },
  { id: 'n-8', kind: 'logistics', title: 'Payment verified — prepare SHP-2026-0213', body: 'Thames & Bloom order can move to warehouse preparation.', at: ago(2, 4), read: false, link: '/app/shipments/shp-r-129', audience: ['logistics'] },
  { id: 'n-9', kind: 'logistics', title: 'Ready for collection', body: 'Your order SOR-2026-0118 was collected. Thank you!', at: ago(14), read: true, link: '/app/shipments/shp-r-118', audience: [], userIds: ['u-dist'] },
  { id: 'n-10', kind: 'approval', title: 'SOR-2026-0145 approved by territory sales manager', body: 'Now with Marcus Chen (Head of Sales).', at: ago(1, 12), read: false, link: '/app/requests/r-145', audience: [], userIds: ['u-dist'] },
  { id: 'n-11', kind: 'finance', title: 'Receipt received for PI-2026-0405', body: 'Finance is verifying your payment. You will be notified once confirmed.', at: ago(7, 17), read: true, link: '/app/invoices/inv-r-131', audience: [], userIds: ['u-dist'] },
  { id: 'n-12', kind: 'application', title: 'New customer registration', body: 'Aurora Trade Co (Manchester) submitted APP-2026-0314.', at: ago(0, 6), read: false, link: '/app/applications/a-003', audience: [], userIds: ['u-sc'] },
  { id: 'n-13', kind: 'system', title: 'Integration: 2 records failed', body: 'Business Partner sync failed for CUST-10092 and one pricing record.', at: ago(0, 5), read: false, link: '/app/admin/integration', audience: ['admin', 'finance'] },
  { id: 'n-14', kind: 'email', title: 'New reply from Omar Haddad', body: 'Re: SOR-2026-0136 — national day promotion order', at: ago(0, 3), read: false, link: '/app/email', audience: ['operations_reviewer'] },
  { id: 'n-15', kind: 'customer', title: 'Document expired', body: 'Pearl Coast Retail commercial registration expired 12 days ago.', at: ago(1), read: true, link: '/app/customers/c-003', audience: ['operations_reviewer', 'admin'] },
  { id: 'n-16', kind: 'logistics', title: 'Your order is ready for collection', body: 'Al Noor Perfumes: SHP-2026-0211 at Jebel Ali DC.', at: ago(1, 5), read: false, link: '/app/shipments/shp-r-124', audience: ['logistics', 'operations_reviewer'] },
  { id: 'n-21', kind: 'application', title: 'APP-2026-0302 resubmitted (revision 2)', body: 'Bahrain Fragrance Hub uploaded the store list and confirmed the delivery address.', at: ago(0, 19), read: false, link: '/app/applications/a-007', audience: [], userIds: ['u-sc'] },
  { id: 'n-22', kind: 'application', title: 'APP-2026-0306 returned for correction', body: 'Please enter your TIN, upload the TIN certificate and a recent bank reference letter.', at: ago(7), read: false, link: '/app/my-applications/a-002', audience: [], userIds: ['u-app2'] },
  { id: 'n-17', kind: 'approval', title: 'Approved at Account Manager stage', body: 'SOR-2026-0139 is now with Marcus Chen (Head of Sales) for final approval.', at: ago(1, 6), read: true, link: '/app/requests/r-139', audience: ['operations_reviewer'], userIds: ['u-gm'] },
]
