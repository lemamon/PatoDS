// Match manifest (desired) variables to snapshot (real) variables (design-sync.md §5.3). Only managed
// collections take part; variables of other collections are never changed, renamed or removed. Matching
// is by key first (so a manual rename is undone, DSN-04), then by path (adoption writes the key back),
// deterministically broken on ties. The result drives the plan (§5.4) and the divergence report (§8).
import type { CollectionId, SnapshotVariable } from '../ports.ts'
import type { DesiredVariable } from './manifest.ts'
import { pathEquals, pathJoin } from './snapshot.ts'

export interface ManagedSnapshotVariable {
  readonly variable: SnapshotVariable
  readonly collection: CollectionId
}

export interface MatchPair {
  readonly desired: DesiredVariable
  readonly snapshot: SnapshotVariable
  readonly collection: CollectionId
  /** The snapshot variable carried no key and was adopted by path (§5.3 step 2): setMetadata writes it. */
  readonly adopted: boolean
}

export interface MatchResult {
  readonly matched: readonly MatchPair[]
  readonly missing: readonly DesiredVariable[]
  readonly extra: readonly ManagedSnapshotVariable[]
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * @param nameToId maps a snapshot collection *name* to a managed collection id; a name absent from the
 *   map marks an unmanaged collection whose variables are left untouched.
 */
export function matchVariables(
  desired: readonly DesiredVariable[],
  snapshot: readonly SnapshotVariable[],
  collectionIdOfRef: (ref: string) => CollectionId | null,
): MatchResult {
  const managed: ManagedSnapshotVariable[] = []
  for (const v of snapshot) {
    const collection = collectionIdOfRef(v.collectionRef)
    if (collection) managed.push({ variable: v, collection })
  }

  const used = new Set<string>() // snapshot refs already matched
  const matched: MatchPair[] = []
  const missing: DesiredVariable[] = []

  // Stable iteration over desired (already key-sorted by the manifest parser).
  for (const d of desired) {
    const byKey = managed.filter((m) => !used.has(m.variable.ref) && m.variable.key === d.key && m.collection === d.collection)
    if (byKey.length > 0) {
      const chosen = tieBreak(byKey, d)
      used.add(chosen.variable.ref)
      matched.push({ desired: d, snapshot: chosen.variable, collection: d.collection, adopted: false })
      continue
    }
    const byPath = managed.filter(
      (m) => !used.has(m.variable.ref) && m.variable.key === null && m.collection === d.collection && pathEquals(m.variable.path, d.path),
    )
    if (byPath.length > 0) {
      const chosen = [...byPath].sort((a, b) => cmp(a.variable.ref, b.variable.ref))[0]!
      used.add(chosen.variable.ref)
      matched.push({ desired: d, snapshot: chosen.variable, collection: d.collection, adopted: true })
      continue
    }
    missing.push(d)
  }

  const extra = managed
    .filter((m) => !used.has(m.variable.ref))
    .sort((a, b) => cmp(a.collection, b.collection) || cmp(pathJoin(a.variable.path), pathJoin(b.variable.path)))
  return { matched, missing, extra }
}

/** §5.3 step 3: on two variables with the same key, keep the one whose path matches; else lowest ref. */
function tieBreak(candidates: readonly ManagedSnapshotVariable[], desired: DesiredVariable): ManagedSnapshotVariable {
  const exact = candidates.filter((c) => pathEquals(c.variable.path, desired.path))
  const pool = exact.length > 0 ? exact : candidates
  return [...pool].sort((a, b) => cmp(a.variable.ref, b.variable.ref))[0]!
}
