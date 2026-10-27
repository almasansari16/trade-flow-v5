import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

/**
 * Lightweight popover anchored to a trigger. Closes on outside click / Escape.
 * `trigger` receives the open state and toggle props.
 */
export function Popover({
  trigger,
  children,
  align = 'right',
  className,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (p: { open: boolean; toggle: () => void; 'aria-expanded': boolean; 'aria-haspopup': true }) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internal, setInternal] = useState(false)
  const open = controlledOpen ?? internal
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInternal(v))
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => setOpen(false)
  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen(!open), 'aria-expanded': open, 'aria-haspopup': true })}
      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-2 min-w-48 animate-slide-up rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-pop)]',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  active,
  description,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  danger?: boolean
  active?: boolean
  description?: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
        danger ? 'text-danger-700 hover:bg-danger-50' : 'text-ink hover:bg-canvas',
        active && 'bg-primary-50 text-primary-700',
      )}
    >
      {icon && <span className="mt-0.5 shrink-0 text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{children}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </button>
  )
}

export const MenuDivider = () => <div className="my-1 h-px bg-line" role="separator" />
