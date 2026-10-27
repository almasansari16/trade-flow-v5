import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form'
import type { ZodType } from 'zod'

/**
 * Minimal Zod → react-hook-form resolver (keeps the dependency list short).
 * Maps each Zod issue path to a nested field error.
 */
export function zodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = await schema.safeParseAsync(values)
    if (result.success) return { values: result.data, errors: {} }
    const errors: Record<string, unknown> = {}
    for (const issue of result.error.issues) {
      let node = errors
      issue.path.forEach((key, i) => {
        const k = String(key)
        if (i === issue.path.length - 1) {
          if (!node[k]) node[k] = { type: issue.code, message: issue.message }
        } else {
          node[k] = (node[k] as Record<string, unknown>) ?? {}
          node = node[k] as Record<string, unknown>
        }
      })
    }
    return { values: {}, errors: errors as FieldErrors<T> }
  }
}
