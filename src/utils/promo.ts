import type { OrderLine, Product, PromoAllocation, PromoRules } from '@/types/domain'

/**
 * Illustrative tester & sample allocation.
 *
 * ASSUMPTIONS (to be confirmed with the business — see README):
 *  1. Only products whose category is listed in `rules.eligibleCategories` count
 *     as "eligible fragrance units". Body mists, home fragrance and gift sets do not.
 *  2. Allocation is computed on the request total, not per SKU, and rounds down:
 *       testers = floor(eligibleUnits / testerPerUnits)
 *       samples = floor(eligibleUnits / sampleBlockUnits) × samplesPerBlock
 *  3. Testers and samples are free-of-charge and carry no price on the request.
 *  4. Default rule: 1 tester per 6 eligible units; 4 × 1.2 ml samples per 12 eligible units.
 */
export function calculatePromo(
  lines: OrderLine[],
  products: Product[],
  rules: PromoRules,
): PromoAllocation {
  if (!rules.enabled) return { eligibleUnits: 0, testers: 0, samples: 0, ruleVersion: rules.version }
  const byId = new Map(products.map((p) => [p.id, p]))
  const eligibleUnits = lines.reduce((sum, l) => {
    const p = byId.get(l.productId)
    return p && rules.eligibleCategories.includes(p.category) ? sum + l.quantity : sum
  }, 0)
  const testers = rules.testerPerUnits > 0 ? Math.floor(eligibleUnits / rules.testerPerUnits) : 0
  const samples =
    rules.sampleBlockUnits > 0 ? Math.floor(eligibleUnits / rules.sampleBlockUnits) * rules.samplesPerBlock : 0
  return { eligibleUnits, testers, samples, ruleVersion: rules.version }
}

/** Units still needed to unlock the next tester / sample block — used for nudges in the UI. */
export function nextPromoThreshold(eligibleUnits: number, rules: PromoRules) {
  const toTester = rules.testerPerUnits - (eligibleUnits % rules.testerPerUnits)
  const toSamples = rules.sampleBlockUnits - (eligibleUnits % rules.sampleBlockUnits)
  return { toTester, toSamples }
}
