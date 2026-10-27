import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export function Field({
  label,
  required,
  error,
  hint,
  children,
  htmlFor,
  className,
  errorId,
}: {
  label: ReactNode
  required?: boolean
  error?: string
  hint?: ReactNode
  children: ReactNode
  htmlFor?: string
  className?: string
  errorId?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger-700">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; error?: string; hint?: ReactNode; leading?: ReactNode; trailing?: ReactNode }

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField({ label, error, hint, required, className, leading, trailing, id, ...rest }, ref) {
  const autoId = useId()
  const fid = id ?? autoId
  const input = (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">{leading}</span>}
      <input
        ref={ref}
        id={fid}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={error ? `${fid}-err` : undefined}
        className={cn('input', leading && 'pl-9', trailing && 'pr-10', error && 'border-danger focus:border-danger focus:ring-danger/15', className)}
        {...rest}
      />
      {trailing && <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>}
    </div>
  )
  if (!label) return input
  return (
    <Field label={label} required={required} error={error} hint={hint} htmlFor={fid} errorId={`${fid}-err`}>
      {input}
    </Field>
  )
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; error?: string; hint?: ReactNode; options: { value: string; label: string }[]; placeholder?: string }

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField({ label, error, hint, required, options, placeholder, className, id, ...rest }, ref) {
  const autoId = useId()
  const fid = id ?? autoId
  const select = (
    <div className="relative">
      <select
        ref={ref}
        id={fid}
        aria-invalid={!!error}
        className={cn('input appearance-none pr-9', error && 'border-danger', className)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  )
  if (!label) return select
  return (
    <Field label={label} required={required} error={error} hint={hint} htmlFor={fid}>
      {select}
    </Field>
  )
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; error?: string; hint?: ReactNode }

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextareaField({ label, error, hint, required, className, id, ...rest }, ref) {
  const autoId = useId()
  const fid = id ?? autoId
  const area = (
    <textarea
      ref={ref}
      id={fid}
      aria-invalid={!!error}
      className={cn('input h-auto min-h-24 py-2.5 leading-relaxed', error && 'border-danger', className)}
      {...rest}
    />
  )
  if (!label) return area
  return (
    <Field label={label} required={required} error={error} hint={hint} htmlFor={fid}>
      {area}
    </Field>
  )
})

export function Checkbox({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-primary" {...rest} />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-primary' : 'bg-line-strong')}
    >
      <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  )
}
