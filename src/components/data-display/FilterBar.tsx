import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export function SearchInput({ value, onChange, placeholder = 'Search…', className, label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input h-9 pl-9 pr-8"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn('input h-9 w-full min-w-36 pr-8 text-[13px] sm:w-auto', className)}>
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function FilterBar({ children, onReset, active, trailing }: { children: ReactNode; onReset?: () => void; active?: boolean; trailing?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {children}
        {active && onReset && (
          <button type="button" onClick={onReset} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-muted hover:bg-canvas hover:text-ink">
            <X className="size-3.5" /> Reset
          </button>
        )}
      </div>
      {trailing && <div className="flex items-center gap-2">{trailing}</div>}
    </div>
  )
}
