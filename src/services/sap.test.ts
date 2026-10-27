/**
 * Development SAP stand-in: approval ≠ order creation; idempotent retries; customer isolation;
 * open items, ledger, outstanding and aging reconcile with each other.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createSalesOrder, resetSapDevMock, sapDevMock, sapSimulator } from './sapDevMock'
import { displayStatus } from '@/utils/requestStatus'
import { salesOrderRequests } from '@/data/transactions'

const omar = { customerIds: ['c-001'] }
const order = (key: string, over: Partial<Parameters<typeof createSalesOrder>[0]> = {}) =>
  createSalesOrder({
    idempotencyKey: key, requestId: key, requestRef: `SOR-T-${key}`, customerId: 'c-001', soldTo: '0010021', currency: 'AED', requestedDeliveryDate: '2026-11-30',
    shipTo: 'Dubai', paymentTerms: 'Net 30 days', items: [{ lineNo: 10, productId: 'p-01', material: 'FG100001', quantity: 12, uom: 'EA', unitPrice: 250 }], ...over,
  })

beforeEach(() => resetSapDevMock())

describe('sales order creation', () => {
  it('creates a clearly marked mock order and is idempotent on the request id', async () => {
    const r1 = await order('rq-1')
    expect(r1.ok && r1.documentNumber.startsWith('MOCK-SO-') && !r1.existing).toBe(true)
    const r2 = await order('rq-1')
    expect(r2).toMatchObject({ ok: true, existing: true, documentNumber: r1.ok ? r1.documentNumber : '' })
    expect(sapSimulator.ordersForRequest('rq-1')).toBe(1)
  })
  it('a timeout after SAP committed is resolved on retry without a duplicate', async () => {
    sapSimulator.failNext('timeout_after_commit')
    const first = await order('rq-2')
    expect(first).toMatchObject({ ok: false, errorCode: 'GW-TIMEOUT', retryable: true })
    const retry = await order('rq-2')
    expect(retry).toMatchObject({ ok: true, existing: true })
    expect(sapSimulator.ordersForRequest('rq-2')).toBe(1)
  })
  it('refuses unmapped customers and partially confirms beyond stock', async () => {
    expect(await order('rq-3', { soldTo: undefined })).toMatchObject({ ok: false, errorCode: 'BP-NOT-MAPPED' })
    const r = await order('rq-4', { items: [{ lineNo: 10, productId: 'p-11', material: 'FG100011', quantity: 120, uom: 'EA', unitPrice: 300 }] })
    expect(r).toMatchObject({ ok: true, fullyConfirmed: false, confirmedQty: { 'p-11': 85 } })
  })
})

describe('customer isolation', () => {
  it('lists only the principal’s documents and refuses other accounts', async () => {
    const inv = await sapDevMock.listInvoices(omar)
    expect(inv.items.length).toBeGreaterThan(0)
    expect(inv.items.every((i) => i.customerId === 'c-001')).toBe(true)
    const other = (await sapDevMock.listInvoices({ customerIds: ['c-002'] })).items[0]!
    await expect(sapDevMock.getInvoice(omar, other.invoiceNumber)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(sapDevMock.getLedger(omar, 'c-002')).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' })
    await expect(sapDevMock.getAging({ customerIds: ['c-011'] }, 'c-011')).rejects.toMatchObject({ code: 'NOT_MAPPED' })
  })
})

describe('financial figures reconcile', () => {
  it('ledger balance = open items − unallocated payments; aging total = open items', async () => {
    const out = await sapDevMock.getOutstanding(omar, 'c-001')
    const aging = await sapDevMock.getAging(omar, 'c-001')
    const ledger = await sapDevMock.getLedger(omar, 'c-001', { from: '2000-01-01', pageSize: 500 })
    expect(aging.total).toBeCloseTo(out.totals.outstanding, 2)
    expect(aging.buckets.reduce((s, b) => s + b.amount, 0)).toBeCloseTo(aging.total, 2)
    expect(ledger.closingBalance).toBeCloseTo(out.netBalance, 2)
    expect(ledger.closingBalance).toBeCloseTo(sapDevMock._ledgerBalance('c-001'), 2)
    expect(out.unallocatedPayments).toBeGreaterThan(0)
    // every bucket is represented in the seed
    expect(aging.buckets.filter((b) => b.amount > 0).map((b) => b.key)).toEqual(['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'])
  })
  it('a ledger window carries the earlier postings as opening balance', async () => {
    const full = await sapDevMock.getLedger(omar, 'c-001', { from: '2000-01-01', pageSize: 500 })
    const cut = full.entries[Math.floor(full.entries.length / 2)]!.postingDate.slice(0, 10)
    const win = await sapDevMock.getLedger(omar, 'c-001', { from: cut, pageSize: 500 })
    expect(win.openingBalance + win.totalDebit - win.totalCredit).toBeCloseTo(full.closingBalance, 2)
  })
  it('a posted payment clears the oldest invoices and the summary follows', async () => {
    const before = await sapDevMock.getFinancialSummary(omar, 'c-001')
    sapSimulator.postPayment('c-001', 5000, true, 'TEST')
    const after = await sapDevMock.getFinancialSummary(omar, 'c-001')
    expect(after.totalOutstanding).toBeCloseTo(before.totalOutstanding - 5000, 2)
  })
  it('cancelled invoices carry no outstanding amount', async () => {
    const inv = (await sapDevMock.listInvoices(omar)).items
    const cancelled = inv.find((i) => i.status === 'Cancelled')!
    expect(cancelled.outstanding).toBe(0)
  })
})

describe('deliveries and order status', () => {
  it('supports several deliveries per order and derives SAP order status', async () => {
    const so = (await sapDevMock.listSalesOrders(omar)).items.find((s) => s.requestRef === 'SOR-2026-0118')!
    const detail = await sapDevMock.getSalesOrder(omar, so.soNumber)
    expect(detail.deliveries.length).toBe(2)
    expect(detail.invoices.length).toBe(2)
    expect(so.status).toBe('Completed')
    const open = (await sapDevMock.listSalesOrders(omar)).items.find((s) => s.requestRef === 'SOR-2026-0131')!
    expect(open.status).toBe('Open')
    sapSimulator.postDelivery(open.soNumber, 'partial')
    const after = (await sapDevMock.getSalesOrder(omar, open.soNumber)).order
    expect(after.status).toBe('Partially Delivered')
  })
})

describe('seeded TradeFlow request states keep approval and SAP distinct', () => {
  it('no request has an SAP order without internal approval; r-127 failed and has no document', () => {
    for (const r of salesOrderRequests) if (r.sap) expect(['Approved', 'Awaiting Payment', 'Payment Verified', 'In Fulfillment', 'Ready for Collection', 'Collected']).toContain(r.status)
    const r127 = salesOrderRequests.find((r) => r.id === 'r-127')!
    expect(r127.sap?.status).toBe('SAP Creation Failed')
    expect(r127.externalRef).toBeUndefined()
    expect(displayStatus(r127)).toBe('SAP Creation Failed')
  })
})
