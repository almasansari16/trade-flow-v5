/**
 * Mock implementations of the service contracts.
 * They read seeded data, add a small artificial latency and never leave the browser.
 * Swap `services` in ./index.ts for a real implementation later.
 */
import type { TradeFlowServices } from './contracts'
import { customers } from '@/data/customers'
import { products } from '@/data/catalog'
import { salesOrderRequests, invoices, payments, shipments } from '@/data/transactions'
import { emailThreads } from '@/data/communications'
import { fromUsd, roundMoney } from '@/utils/fx'
import { uid } from '@/utils/time'
import { createSalesOrder, sapDevMock, sapSimulator } from './sapDevMock'

const delay = <T,>(value: T, ms = 450 + Math.random() * 350) => new Promise<T>((r) => setTimeout(() => r(value), ms))

let reqSeq = 146
/** Kept for tests that tweak the development SAP mock. */
export const sapMockControls = sapSimulator

export const mockServices: TradeFlowServices = {
  customers: {
    lookupCustomers: (q) => delay(customers.filter((c) => `${c.name} ${c.code}`.toLowerCase().includes(q.toLowerCase()))),
    getCustomer: (id) => delay(customers.find((c) => c.id === id)),
  },
  catalog: {
    listProducts: (q = {}) =>
      delay(
        products.filter(
          (p) =>
            (!q.search || `${p.name} ${p.sku}`.toLowerCase().includes(q.search.toLowerCase())) &&
            (!q.brandIds?.length || q.brandIds.includes(p.brandId)) &&
            (!q.categories?.length || q.categories.includes(p.category)),
        ),
      ),
    getPriceAndAvailability: (ids, customerId) => {
      const currency = customers.find((c) => c.id === customerId)?.currency ?? 'USD'
      return delay(
        products
          .filter((p) => ids.includes(p.id))
          .map((p) => ({ productId: p.id, currency, unitPrice: roundMoney(fromUsd(p.unitPriceUsd, currency)), availableQty: p.availableQty, stockStatus: p.stockStatus, source: 'mock' as const })),
        600,
      )
    },
  },
  orders: {
    submitRequest: () =>
      delay({ id: uid('r'), ref: `SOR-${new Date().getFullYear()}-${String(reqSeq++).padStart(4, '0')}`, receivedAt: new Date().toISOString() }, 800),
    getApprovalStatus: (id) => delay(salesOrderRequests.find((r) => r.id === id)?.approvalSteps ?? []),
  },
  finance: {
    getProformaInvoice: (id) => delay(invoices.find((i) => i.id === id)),
    getPaymentStatus: (invoiceId) => delay(payments.find((p) => p.invoiceId === invoiceId)),
  },
  logistics: {
    getShipmentStatus: (id) => delay(shipments.find((s) => s.id === id)),
  },
  communications: {
    listConversations: (customerId) => delay(emailThreads.filter((t) => !customerId || t.customerId === customerId)),
  },
  sap: {
    mode: 'mock',
    submitSalesOrder: (payload) =>
      createSalesOrder({
        idempotencyKey: payload.idempotencyKey,
        requestId: payload.requestId,
        requestRef: payload.requestRef,
        soldTo: payload.soldTo,
        customerId: payload.customerId,
        currency: payload.currency,
        requestedDeliveryDate: payload.requestedDeliveryDate,
        customerReference: payload.customerReference,
        remarks: payload.remarks,
        shipTo: payload.shipTo,
        paymentTerms: payload.paymentTerms,
        items: payload.items.map((i) => ({ lineNo: i.lineNo, productId: i.productId, material: i.material, quantity: i.quantity, uom: i.uom, unitPrice: i.unitPrice })),
      }),
  },
  sapData: sapDevMock,
  integration: {
    retry: (event) =>
      delay(
        {
          ...event,
          attempts: event.attempts + 1,
          at: new Date().toISOString(),
          // Deterministic demo outcome: timeouts recover, validation errors keep failing.
          status: event.errorCode === 'BP-VAL-014' ? ('Failed' as const) : ('Synced' as const),
          message:
            event.errorCode === 'BP-VAL-014'
              ? 'Retry failed: tax number still rejected. Correct the customer’s master data (SAP customer master) and retry (simulated).'
              : 'Retry succeeded in mock environment.',
          errorCode: event.errorCode === 'BP-VAL-014' ? event.errorCode : undefined,
        },
        1200,
      ),
  },
}
