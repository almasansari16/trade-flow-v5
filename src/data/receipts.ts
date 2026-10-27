import type { GoodsReceiptAck } from '@/types/domain'
import { seededDeliveredDeliveries } from '@/services/sapDevMock'

/**
 * Seeded customer acknowledgements for deliveries Gulf Horizon Trading already received.
 * The most recent one reported damaged cartons, which Operations resolved.
 */
const delivered = seededDeliveredDeliveries('c-001')
export const seedGoodsReceipts: GoodsReceiptAck[] = delivered.map((d, i) => {
  const last = i === delivered.length - 1
  const at = d.deliveredDate ?? d.createdAt
  return {
    id: `grc-${i + 1}`,
    ref: `GRC-2026-${String(i + 1).padStart(4, '0')}`,
    deliveryNumber: d.deliveryNumber,
    soNumber: d.soNumber,
    customerId: d.customerId,
    receivedOn: at,
    confirmedAt: at,
    confirmedById: 'u-dist',
    remarks: last ? '3 cartons of the first line arrived crushed; units unusable.' : undefined,
    lines: d.items.map((it, j) => ({ itemNo: it.itemNo, productId: it.productId, description: it.description, deliveredQty: it.qty, receivedQty: it.qty, damagedQty: last && j === 0 ? 18 : 0 })),
    outcome: last ? 'Received with discrepancy' : 'Received in full',
    discrepancy: last ? { status: 'Resolved', routedTo: 'Operations (Finance & Fulfilment) and the account manager', resolvedById: 'u-sc', resolvedAt: new Date(new Date(at).getTime() + 2 * 86_400_000).toISOString(), resolution: 'Replacement units shipped with the next delivery; credit not required.' } : undefined,
    sapUpdate: 'Not required — customer acknowledgement only',
  }
})
