/** Helpers for seeding mock data relative to "now" so the demo always looks current. */
const HOUR = 3_600_000
const DAY = 24 * HOUR

export const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * HOUR).toISOString()
export const ahead = (days: number, hours = 0) => new Date(Date.now() + days * DAY + hours * HOUR).toISOString()
export const nowIso = () => new Date().toISOString()

let seq = 0
/** Locally unique id for records created during the demo session. */
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

/** Human-readable demo reference, e.g. SOR-2026-0142. */
export const demoRef = (prefix: string, n: number) => `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`
