import type { ReactNode } from 'react'
import type { Product } from '@/types/domain'
import { cn } from '@/utils/cn'

/**
 * Generated product illustration (pure SVG) so the catalogue looks finished
 * without depending on real product photography.
 */
export function ProductVisual({ product, hue, className }: { product: Pick<Product, 'bottle' | 'name'>; hue: number; className?: string }) {
  const bg = `hsl(${hue} 70% 96%)`
  const glass = `hsl(${hue} 45% 82%)`
  const liquid = `hsl(${hue} 55% 62%)`
  const cap = `hsl(${hue} 30% 22%)`
  const accent = `hsl(${hue} 60% 45%)`
  const shapes: Record<Product['bottle'], ReactNode> = {
    tall: (
      <>
        <rect x="70" y="22" width="20" height="16" rx="3" fill={cap} />
        <rect x="76" y="36" width="8" height="8" fill={glass} />
        <rect x="52" y="44" width="56" height="88" rx="8" fill={glass} />
        <rect x="56" y="70" width="48" height="58" rx="6" fill={liquid} opacity=".85" />
        <rect x="62" y="84" width="36" height="18" rx="2" fill="#fff" opacity=".9" />
      </>
    ),
    round: (
      <>
        <rect x="68" y="26" width="24" height="18" rx="4" fill={cap} />
        <circle cx="80" cy="92" r="42" fill={glass} />
        <path d="M44 100a36 36 0 0 0 72 0z" fill={liquid} opacity=".85" />
        <rect x="64" y="84" width="32" height="14" rx="2" fill="#fff" opacity=".9" />
      </>
    ),
    square: (
      <>
        <rect x="64" y="20" width="32" height="22" rx="2" fill={cap} />
        <rect x="70" y="40" width="20" height="6" fill={accent} />
        <rect x="46" y="46" width="68" height="84" rx="4" fill={glass} />
        <rect x="50" y="72" width="60" height="54" rx="2" fill={liquid} opacity=".85" />
        <rect x="58" y="80" width="44" height="22" rx="1" fill="#fff" opacity=".9" />
      </>
    ),
    jar: (
      <>
        <rect x="46" y="44" width="68" height="14" rx="4" fill={cap} />
        <rect x="48" y="58" width="64" height="72" rx="10" fill={glass} />
        <rect x="52" y="84" width="56" height="42" rx="8" fill={liquid} opacity=".8" />
        <rect x="76" y="34" width="3" height="16" fill={accent} />
        <rect x="83" y="30" width="3" height="20" fill={accent} />
      </>
    ),
    box: (
      <>
        <rect x="40" y="40" width="80" height="90" rx="4" fill={liquid} />
        <rect x="40" y="40" width="80" height="18" rx="4" fill={cap} />
        <rect x="76" y="40" width="8" height="90" fill={accent} opacity=".7" />
        <rect x="54" y="80" width="52" height="22" rx="2" fill="#fff" opacity=".85" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 160 150" role="img" aria-label={`${product.name} illustration`} className={cn('block', className ?? 'w-full')} style={{ background: bg }}>
      <ellipse cx="80" cy="136" rx="44" ry="5" fill={cap} opacity=".08" />
      {shapes[product.bottle]}
    </svg>
  )
}
