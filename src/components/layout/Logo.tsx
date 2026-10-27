import { BRAND } from '@/config/brand'
import { cn } from '@/utils/cn'

/** The TradeFlow symbol (transparent PNG cut from the supplied artwork). */
export function LogoMark({ className }: { className?: string }) {
  return <img src={BRAND.markSrc} alt="" aria-hidden width={32} height={32} className={cn('size-7 shrink-0 object-contain', className)} />
}

export function Logo({ collapsed, dark, className }: { collapsed?: boolean; dark?: boolean; className?: string }) {
  const [first, second] = BRAND.wordmark
  return (
    <span className={cn('flex items-center gap-2.5', className)} aria-label={BRAND.name}>
      <LogoMark />
      {!collapsed && (
        <span className="leading-none">
          <span className="block text-[16px] font-bold tracking-tight">
            <span className={dark ? 'text-white' : 'text-ink'}>{first}</span>
            <span className={dark ? 'text-slate-400' : 'text-[#5B6B85]'}>{second}</span>
          </span>
          <span className={cn('mt-0.5 block text-[9px] font-medium uppercase tracking-[0.12em]', dark ? 'text-slate-500' : 'text-muted')}>Distribution Cloud</span>
        </span>
      )}
    </span>
  )
}
