/**
 * PROTOTYPE ONLY — mock credential store.
 *
 * The prototype has no identity provider, so seeded demo accounts share one demo
 * password and are checked in the browser. Passwords are stored as a fast,
 * NON-cryptographic hash purely so plain text is not written to localStorage.
 *
 * Production must replace this with a server-side identity provider (e.g. SAP IAS /
 * Entra ID / Keycloak) using salted, slow password hashing (Argon2id / bcrypt),
 * MFA, lock-out and session management. Nothing in this file is production-grade.
 */
import type { DemoCredential } from '@/types/domain'

/** Shown on the sign-in page of the prototype. */
export const DEMO_PASSWORD = 'TradeFlow@2026'

/** cyrb53 — small non-cryptographic string hash (demo use only). */
export function demoHash(input: string, seed = 7): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export const seedCredentials = (userIds: string[]): DemoCredential[] =>
  userIds.map((userId) => ({ userId, hash: demoHash(`${userId}:${DEMO_PASSWORD}`) }))

export const credentialHash = (userId: string, password: string) => demoHash(`${userId}:${password}`)

/** Prototype password policy (production policy belongs on the server). */
export function passwordProblems(pw: string): string[] {
  const out: string[] = []
  if (pw.length < 8) out.push('at least 8 characters')
  if (!/[A-Za-z]/.test(pw)) out.push('a letter')
  if (!/\d/.test(pw)) out.push('a number')
  return out
}

/** Random, URL-safe token (secure-link demo). Uses Web Crypto when available. */
export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(arr)
  else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}
