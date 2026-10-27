import { Database } from 'lucide-react'
import { services } from '@/services'

/**
 * Honest label for where prices and stock come from. In development mode they are seeded demo
 * values held in the browser — not live SAP availability.
 */
export function StockSourceNote({ className }: { className?: string }) {
  const live = services.sap.mode === 'live'
  return (
    <span className={className ?? 'inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted'} title={live ? 'Prices and stock read from SAP' : 'Prices and stock are seeded demo values stored in this browser. No SAP connection.'}>
      <Database className="size-3" />
      {live ? 'Prices & stock: SAP (current)' : 'Prices & stock: demo data — not live SAP'}
    </span>
  )
}
