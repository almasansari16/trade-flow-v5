/** Absolute URL for an in-app path (handles the hash-routed single-file build). */
export function absoluteAppUrl(path: string) {
  if (import.meta.env.VITE_SINGLE_FILE === 'true') return `${window.location.origin}${window.location.pathname}#${path}`
  return `${window.location.origin}${path}`
}
