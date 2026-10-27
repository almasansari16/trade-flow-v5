import type { TradeFlowServices } from './contracts'
import { mockServices } from './mock'

/**
 * Single switch point for data services. Replace with a real implementation
 * (e.g. `createHttpServices(config)`) once a backend exists.
 */
export const services: TradeFlowServices = mockServices

/** Shown in the UI wherever SAP data or actions appear, so mock behaviour is never presented as live. */
export const SAP_MODE = services.sap.mode
export const SAP_MODE_LABEL = SAP_MODE === 'mock' ? 'SAP: development mock — not connected' : 'SAP: connected'

export type * from './contracts'
