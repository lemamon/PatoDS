// Divergence report and fingerprints (design-sync.md §8). `design-sync detect` compares the snapshot
// (real) with the current manifest (desired) and classifies each difference against the previous
// version (§6). The fingerprint keeps the value outside itself, so the same divergence always updates
// the same tracked item. No tool→repository write: the report is produced in memory.
import type {
  CollectionId, DivergenceCounts, DivergenceField, DivergenceItem, DivergenceKind, Fingerprint,
  SnapshotVariable, SyncValue, ToolSnapshot,
} from '../ports.ts'
import { sha256Hex } from './canonical.ts'
import { classifyDifference } from './classify.ts'
import { contextsOf, type DesiredVariable, type Manifest } from './manifest.ts'
import { matchVariables } from './match.ts'
import { isAlias, pathEquals, pathJoin, valueEquals } from './snapshot.ts'

const EMPTY_COUNTS: DivergenceCounts = { missing: 0, extra: 0, value: 0, alias: 0, name: 0, hierarchy: 0, type: 0 }

/**
 * §8 fingerprint. `kind + "|" + path + "|" + (mode ?? "") + "|" + tool`, sha256 over the UTF-8 bytes.
 * The separator `|` never occurs in a kebab-ASCII segment, in `kind` or in `tool`. Shared by every
 * trackable item: for failure/capability/credential/manual-* the `kind` is the item type.
 */
export function fingerprint(kind: string, pathString: string, mode: string | null, tool: string): Fingerprint {
  return `sha256:${sha256Hex(`${kind}|${pathString}|${mode ?? ''}|${tool}`)}`
}

export interface DetectInput {
  readonly manifest: Manifest
  readonly snapshot: ToolSnapshot
  readonly tool: string
  /** Parsed previous-version manifest, or null when none applies. */
  readonly previous: Manifest | null
  /** Whether --previous was supplied at all (distinguishes `unclassified` from `initial`). */
  readonly previousProvided: boolean
  /** No previous version has been verified for this target. */
  readonly firstSync: boolean
}

export interface DetectResult {
  readonly items: readonly DivergenceItem[]
  readonly counts: DivergenceCounts
}

function sigValue(sig: string | null): SyncValue | null {
  return sig === null ? null : { literal: { value: sig } }
}

function variableSignature(collection: CollectionId, path: readonly string[], type: string): string {
  return `${collection}#${pathJoin(path)}#${type}`
}

/** Compute the divergence report between the snapshot and the current manifest. */
export function detectDivergences(input: DetectInput): DetectResult {
  const { manifest, snapshot, tool } = input
  const nameToId = new Map(manifest.collections.map((c) => [c.name, c.id]))
  const refToId = new Map<string, CollectionId | null>()
  for (const c of snapshot.collections) refToId.set(c.ref, nameToId.get(c.name) ?? null)
  const collectionIdOfRef = (ref: string): CollectionId | null => refToId.get(ref) ?? null

  const match = matchVariables(manifest.variables, snapshot.variables, collectionIdOfRef)
  const prevByKey = new Map((input.previous?.variables ?? []).map((v) => [v.key, v]))
  const sourceVersion = manifest.source.version

  const items: DivergenceItem[] = []
  const emit = (
    kind: DivergenceKind, field: DivergenceField, collection: CollectionId, path: readonly string[],
    mode: string | null, expected: SyncValue | null, real: SnapshotVariable['values'][string] | null,
    classifyReal: SyncValue | { readonly unresolved: string } | null, classifyPrev: SyncValue | null | undefined,
  ): void => {
    const cause = classifyDifference({ real: classifyReal, desiredPrevious: classifyPrev, firstSync: input.firstSync })
    items.push({
      fingerprint: fingerprint(kind, pathJoin(path), mode, tool),
      kind, field, collection, path, mode, tool,
      expected, actual: real, classification: cause, sourceVersion,
    })
  }

  const prevSig = (key: string): string | null | undefined => {
    if (!input.previousProvided) return undefined
    const p = prevByKey.get(key)
    return p ? variableSignature(p.collection, p.path, p.type) : null
  }
  const prevValue = (key: string, ctx: string): SyncValue | null | undefined => {
    if (!input.previousProvided) return undefined
    const p = prevByKey.get(key)
    return p ? p.values[ctx] ?? null : null
  }

  for (const d of match.missing) {
    const ps = prevSig(d.key)
    emit('missing', 'value', d.collection, d.path, null, null, null, null, ps === undefined ? undefined : sigValue(ps))
  }

  for (const e of match.extra) {
    const sig = variableSignature(e.collection, e.variable.path, e.variable.type)
    // Classify against the previous version by the extra's own key: a token present in the previous
    // version, absent from the current one, still in the tool, is a release removal (§6 release row);
    // an extra with no such previous entry (or no key) is a manual addition.
    const ps = e.variable.key ? prevSig(e.variable.key) : input.previousProvided ? null : undefined
    emit('extra', 'value', e.collection, e.variable.path, null, null, firstValue(e.variable), sigValue(sig), prevSigValue(ps))
  }

  for (const pair of match.matched) {
    const { desired: d, snapshot: s, collection } = pair
    if (s.type !== d.type) {
      const realSig = sigValue(variableSignature(collection, s.path, s.type))
      emit('type', 'value', collection, d.path, null, null, null, realSig, prevSigValue(prevSig(d.key)))
    }
    if (!pathEquals(s.path, d.path)) {
      const kind: DivergenceKind = onlyLastSegmentDiffers(s.path, d.path) ? 'name' : 'hierarchy'
      const realSig = sigValue(variableSignature(collection, s.path, d.type))
      emit(kind, kind === 'hierarchy' ? 'collection' : 'value', collection, d.path, null, null, null, realSig, prevSigValue(prevSig(d.key)))
    }
    for (const ctx of contextsOf(manifest, collection)) {
      const real = s.values[ctx] ?? null
      const want = d.values[ctx] ?? null
      if (want === null || valueEquals(real, want)) continue
      const kind: DivergenceKind = isAlias(real) && isAlias(want) ? 'alias' : 'value'
      const mode = ctx === '*' ? null : ctx
      emit(kind, 'value', collection, d.path, mode, want, real, real, prevValue(d.key, ctx))
    }
  }

  items.sort((a, b) => cmp(a.kind, b.kind) || cmp(pathJoin(a.path), pathJoin(b.path)) || cmp(a.mode ?? '', b.mode ?? ''))
  const counts = { ...EMPTY_COUNTS }
  for (const it of items) counts[it.kind] += 1
  return { items, counts }
}

function prevSigValue(sig: string | null | undefined): SyncValue | null | undefined {
  return sig === undefined ? undefined : sigValue(sig)
}

function firstValue(v: SnapshotVariable): SnapshotVariable['values'][string] | null {
  const keys = Object.keys(v.values).sort()
  const k = keys[0]
  return k === undefined ? null : v.values[k] ?? null
}

function onlyLastSegmentDiffers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length - 1; i += 1) if (a[i] !== b[i]) return false
  return a[a.length - 1] !== b[b.length - 1]
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export { EMPTY_COUNTS }
export type { DesiredVariable }
