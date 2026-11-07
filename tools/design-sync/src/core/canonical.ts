// Canonical JSON and hashing (tools-cli.md §1.4, design-sync.md §7, G-3). Byte-for-byte determinism
// for the same inputs: object keys in code-point order, 2-space indent, LF, final newline; no date,
// time, absolute path, machine name or environment value enters canonical content.
import { createHash } from 'node:crypto'
import type { Sha256 } from '../ports.ts'

/** Deep copy with object keys sorted by code point; arrays keep their (contract-defined) order. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort(byCodePoint)) {
      const v = (value as Record<string, unknown>)[key]
      if (v !== undefined) out[key] = canonicalize(v)
    }
    return out
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number is not canonical JSON: ${value}`)
    if (Object.is(value, -0)) return 0
  }
  return value
}

function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Canonical JSON text: sorted keys, 2-space indentation, trailing newline (tools-cli.md §1.4). */
export function canonicalStringify(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** `sha256:` + lowercase hex over the UTF-8 bytes of the canonical rendering of `value`. */
export function digest(value: unknown): Sha256 {
  return `sha256:${sha256Hex(canonicalStringify(value))}`
}

/** `sha256:` + lowercase hex over the UTF-8 bytes of an already-serialized text (e.g. a log file). */
export function digestText(text: string): Sha256 {
  return `sha256:${sha256Hex(text)}`
}
