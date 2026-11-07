// Snapshot helpers: an order-independent digest (two reads of the same state give the same sha256,
// C-03) and structural value comparison for the diff. No tool→repository data flow here; a snapshot is
// consumed only in memory to compute the plan and the divergence report.
import type { SyncValue, ToolSnapshot, UnresolvedValue } from '../ports.ts'
import { canonicalStringify, digest } from './canonical.ts'
import type { Sha256 } from '../ports.ts'

export function pathJoin(path: readonly string[]): string {
  return path.join('.')
}

export function pathEquals(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((seg, i) => seg === b[i])
}

export function isAlias(value: SyncValue | UnresolvedValue | null | undefined): value is { readonly alias: readonly string[] } {
  return !!value && typeof value === 'object' && 'alias' in value
}

export function isUnresolved(value: SyncValue | UnresolvedValue | null | undefined): value is UnresolvedValue {
  return !!value && typeof value === 'object' && 'unresolved' in value
}

/** Structural equality of two values, independent of key order inside composites. */
export function valueEquals(a: SyncValue | UnresolvedValue | null, b: SyncValue | UnresolvedValue | null): boolean {
  if (a === null || b === null) return a === b
  return canonicalStringify(a) === canonicalStringify(b)
}

/**
 * Deterministic digest of a snapshot. Normalizes away native refs (opaque, non-deterministic) and
 * ordering, keeping only the observable shape: collections by name, modes by name, variables by
 * (collection name, path), values by context.
 */
export function snapshotDigest(snapshot: ToolSnapshot): Sha256 {
  const collByRef = new Map(snapshot.collections.map((c) => [c.ref, c.name]))
  const normalized = {
    tool: snapshot.tool,
    collections: [...snapshot.collections]
      .map((c) => ({ name: c.name, modes: [...c.modes].map((m) => m.name).sort(cmp) }))
      .sort((a, b) => cmp(a.name, b.name)),
    variables: [...snapshot.variables]
      .map((v) => ({
        collection: collByRef.get(v.collectionRef) ?? v.collectionRef,
        path: v.path,
        type: v.type,
        key: v.key,
        description: v.description,
        hidden: v.hidden,
        values: v.values,
      }))
      .sort((a, b) => cmp(a.collection, b.collection) || cmp(pathJoin(a.path), pathJoin(b.path))),
    published: snapshot.published
      ? {
          variables: [...snapshot.published.variables]
            .map((v) => ({ collection: collByRef.get(v.collectionRef) ?? v.collectionRef, path: v.path, values: v.values }))
            .sort((a, b) => cmp(a.collection, b.collection) || cmp(pathJoin(a.path), pathJoin(b.path))),
        }
      : null,
  }
  return digest(normalized)
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
