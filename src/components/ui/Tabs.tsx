import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface TabItem<K extends string> {
  key: K
  label: ReactNode
  count?: number
}

/** Accessible tab list (arrow-key navigation). Panels are rendered by the caller. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className,
  variant = 'underline',
}: {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
  variant?: 'underline' | 'pill'
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    refs.current[n]?.focus()
    onChange(items[n]!.key)
  }
  return (
    <div
      role="tablist"
      className={cn(
        'scroll-thin flex gap-1 overflow-x-auto',
        variant === 'underline' ? 'border-b border-line' : 'rounded-lg bg-slate-100 p-1',
        className,
      )}
    >
      {items.map((t, i) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-medium transition-colors',
              variant === 'underline'
                ? cn('-mb-px border-b-2 px-2.5 py-2 text-[13px]', active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink')
                : cn('rounded-md px-3 py-1.5', active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'),
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[11px] tabular', active ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-muted')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
