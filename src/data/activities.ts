/** Seeded customer visits, calls and follow-ups recorded by sales staff. */
import type { CustomerActivity } from '@/types/domain'
import { ago, ahead } from '@/utils/time'

type A = [id: string, customerId: string, territoryId: string, ownerId: string, type: CustomerActivity['type'], days: number, subject: string, status: CustomerActivity['status'], notes?: string, outcome?: string, nextDays?: number]

const rows: A[] = [
  ['ca-01', 'c-001', 't-uae', 'u-tm1', 'Visit', 3, 'Quarterly business review — Dubai HQ', 'Completed', 'Reviewed Q3 sell-out and national-day plans with Omar and the buying team.', 'Agreed to pre-book Royal Oud allocation for Q1.', 5],
  ['ca-02', 'c-001', 't-uae', 'u-tm1', 'Call', 1, 'Follow-up on SOR-2026-0136 allocation', 'Completed', 'Confirmed split delivery acceptable if stock is short.', 'Customer accepts partial allocation.'],
  ['ca-03', 'c-009', 't-uae', 'u-tm1', 'Visit', 6, 'Store walk — Muscat Grand Mall', 'Completed', 'Tester units low on two gondolas.', 'Raise tester allocation on next order.', 2],
  ['ca-04', 'c-003', 't-gcc', 'u-tm1', 'Meeting', 9, 'Commercial registration renewal', 'Completed', 'CR expired; customer is renewing with MOCI.', 'Documents expected within 2 weeks.', 4],
  ['ca-05', 'c-010', 't-gcc', 'u-tm1', 'Visit', -2, 'Introduce Maison Velour autumn range', 'Planned', 'Bring testers and the new price list.'],
  ['ca-06', 'c-009', 't-uae', 'u-tm1', 'Follow-up', -1, 'Chase SLA on SOR-2026-0137', 'Planned'],
  ['ca-07', 'c-002', 't-ksa', 'u-tm2', 'Visit', 4, 'Flagship store opening preparation — Riyadh', 'Completed', 'Reviewed launch window and display build.', 'Pre-order of Musk Al Layl confirmed.'],
  ['ca-08', 'c-002', 't-ksa', 'u-tm2', 'Call', -3, 'Launch-week stock check', 'Planned'],
  ['ca-09', 'c-004', 't-uk', 'u-tm3', 'Meeting', 12, 'Range review with Thames & Bloom', 'Completed', 'Library Candle stock-out discussed.', 'Resubmit order without candle.'],
  ['ca-10', 'c-005', 't-weu', 'u-tm3', 'Visit', 7, 'Paris boutique visit', 'Completed', 'Strong sell-through of Atlas Cedar.', 'Increase depth on Atlas Cedar.'],
  ['ca-11', 'c-011', 't-weu', 'u-tm3', 'Call', 2, 'Onboarding welcome call — Nordlicht', 'Completed', 'Explained ordering portal and payment terms.'],
  ['ca-12', 'c-006', 't-sea', 'u-tm4', 'Visit', 5, 'Changi duty-free planogram', 'Completed', 'New bay agreed from next month.', undefined, 10],
  ['ca-13', 'c-007', 't-sa', 'u-tm4', 'Call', 6, 'LC limit and order split', 'Completed', 'LC covers USD 25k per draw.', 'Customer to resubmit SOR-2026-0141 in two parts.'],
  ['ca-14', 'c-008', 't-eaf', 'u-tm5', 'Visit', 10, 'Account review — outstanding documents', 'Completed', 'Account on hold pending documents.', 'Documents promised by month end.'],
  ['ca-15', 'c-001', 't-uae', 'u-gm', 'Meeting', 20, 'Strategic account review with Gulf Horizon', 'Completed', 'Head of Sales joined the annual negotiation.', 'Annual target agreed.'],
]

export const customerActivities: CustomerActivity[] = rows.map(([id, customerId, territoryId, ownerId, type, days, subject, status, notes, outcome, nextDays]) => ({
  id,
  customerId,
  territoryId,
  ownerId,
  type,
  subject,
  status,
  notes,
  outcome,
  at: days >= 0 ? ago(days) : ahead(-days),
  nextActionAt: nextDays !== undefined ? ahead(nextDays) : undefined,
  createdAt: days >= 0 ? ago(days) : ago(1),
}))
