/**
 * SIMULATED integration telemetry. Nothing here reflects a real connection.
 * Entity names mirror the kind of objects a future S/4HANA integration
 * would exchange, purely so stakeholders can picture the monitoring screen.
 */
import type { IntegrationChannel, IntegrationEvent } from '@/types/domain'
import { ago } from '@/utils/time'

export const integrationChannels: IntegrationChannel[] = [
  { id: 'ch-bp', name: 'Customer master (Business Partner)', status: 'Degraded', lastSyncAt: ago(0, 0.4), latencyMs: 1840, successRate: 92.4 },
  { id: 'ch-so', name: 'Sales order requests', status: 'Operational', lastSyncAt: ago(0, 0.1), latencyMs: 620, successRate: 99.1 },
  { id: 'ch-pr', name: 'Pricing & availability', status: 'Operational', lastSyncAt: ago(0, 0.25), latencyMs: 410, successRate: 98.6 },
  { id: 'ch-bd', name: 'Billing documents', status: 'Operational', lastSyncAt: ago(0, 1.2), latencyMs: 780, successRate: 100 },
  { id: 'ch-dl', name: 'Outbound deliveries', status: 'Operational', lastSyncAt: ago(0, 0.6), latencyMs: 530, successRate: 99.7 },
]

const payload = (o: object) => JSON.stringify(o, null, 2)

export const integrationEvents: IntegrationEvent[] = [
  { id: 'ie-1', entity: 'Sales Order', direction: 'Outbound', objectRef: 'SOR-2026-0127', status: 'Failed', at: ago(0, 0.1), attempts: 1, errorCode: 'GW-TIMEOUT', message: 'Gateway timeout after 30 s (development mock). Retry from the request page.', payloadPreview: payload({ request: 'SOR-2026-0127', soldTo: 'CUST-10058', items: 3, currency: 'EUR' }) },
  { id: 'ie-2', entity: 'Business Partner', direction: 'Outbound', objectRef: 'APP-2026-0311', status: 'Pending', at: ago(0, 0.3), attempts: 0, message: 'Queued — waiting for application approval before BP creation.', payloadPreview: payload({ application: 'APP-2026-0311', role: 'Sold-to', country: 'SA' }) },
  { id: 'ie-3', entity: 'Business Partner', direction: 'Outbound', objectRef: 'CUST-10092', status: 'Failed', at: ago(0, 0.4), attempts: 3, errorCode: 'BP-VAL-014', message: 'Tax number format rejected for country DE (simulated validation error).', payloadPreview: payload({ customer: 'CUST-10092', taxNumber: 'DE 318844120', expectedFormat: 'DE#########' }) },
  { id: 'ie-4', entity: 'Pricing', direction: 'Inbound', objectRef: 'Price list EU-2026-Q4', status: 'Failed', at: ago(0, 5), attempts: 2, errorCode: 'PRC-NOT-FOUND', message: 'Condition record missing for SKU LN-EXT-50-VEL in sales org EU01 (simulated).', payloadPreview: payload({ priceList: 'EU-2026-Q4', sku: 'LN-EXT-50-VEL', salesOrg: 'EU01' }) },
  { id: 'ie-5', entity: 'Stock', direction: 'Inbound', objectRef: 'Availability snapshot', status: 'Synced', at: ago(0, 0.25), attempts: 1, message: '22 SKUs refreshed across 3 plants.', payloadPreview: payload({ skus: 22, plants: ['AE01', 'NL01', 'SG01'] }) },
  { id: 'ie-6', entity: 'Billing Document', direction: 'Inbound', objectRef: 'PI-2026-0406', targetRef: 'PF-90000406 (mock)', status: 'Synced', at: ago(1, 3), attempts: 1, message: 'Proforma reference stored.', payloadPreview: payload({ proforma: 'PI-2026-0406', request: 'SOR-2026-0133' }) },
  { id: 'ie-7', entity: 'Outbound Delivery', direction: 'Inbound', objectRef: 'SHP-2026-0211', targetRef: 'DL-80000211 (mock)', status: 'Synced', at: ago(1, 5), attempts: 1, message: 'Delivery status → ready for pick-up.', payloadPreview: payload({ shipment: 'SHP-2026-0211', status: 'Ready for Collection' }) },
  { id: 'ie-8', entity: 'Sales Order', direction: 'Outbound', objectRef: 'SOR-2026-0129', targetRef: 'MOCK-SO-6129', status: 'Synced', at: ago(14), attempts: 1, message: 'Sales order accepted (development mock).', payloadPreview: payload({ request: 'SOR-2026-0129', soldTo: 'CUST-10052' }) },
  { id: 'ie-9', entity: 'Sales Order', direction: 'Outbound', objectRef: 'SOR-2026-0131', targetRef: 'MOCK-SO-6131', status: 'Synced', at: ago(11), attempts: 2, message: 'Accepted on 2nd attempt after a gateway timeout (development mock).', payloadPreview: payload({ request: 'SOR-2026-0131', attempt: 2 }) },
  { id: 'ie-10', entity: 'Business Partner', direction: 'Outbound', objectRef: 'CUST-10088', targetRef: 'BP-0010088 (mock)', status: 'Synced', at: ago(60), attempts: 1, message: 'Business partner created.', payloadPreview: payload({ customer: 'CUST-10088' }) },
  { id: 'ie-11', entity: 'Outbound Delivery', direction: 'Inbound', objectRef: 'SHP-2026-0212', status: 'Pending', at: ago(0, 2), attempts: 0, message: 'Waiting for warehouse goods-issue confirmation.', payloadPreview: payload({ shipment: 'SHP-2026-0212' }) },
  { id: 'ie-12', entity: 'Pricing', direction: 'Inbound', objectRef: 'Price list ME-2026-Q4', status: 'Synced', at: ago(0, 6), attempts: 1, message: '22 condition records loaded.', payloadPreview: payload({ priceList: 'ME-2026-Q4', records: 22 }) },
]
