// Diff and plan (design-sync.md §5). Pure: from the desired state (manifest), the real state
// (snapshot), the tool capabilities and the config, it computes an ordered, deterministic SyncPlan.
// Preconditions (§5.2) refuse before anything is written. Operations are grouped into the §5.4 phases
// and numbered by seq. The plan never reads from the tool into the repository (G-1, FR-025).
import type {
  CapabilityCheck, CapabilityOutcome, CollectionId, ContextId, DesignToolCapabilities, Fingerprint,
  OperationCause, PlanOperation, PlanPhase, PlanSummaryKey, SnapshotVariable, SyncConfig, SyncPlan,
  SyncValue, SyncValueType, ToolSnapshot,
} from '../ports.ts'
import { digest } from './canonical.ts'
import { classifyDifference } from './classify.ts'
import { fingerprint } from './divergence.ts'
import { SyncCoreError } from './errors.ts'
import { COLLECTION_ORDER, contextsOf, type DesiredVariable, type Manifest } from './manifest.ts'
import { matchVariables, type MatchResult } from './match.ts'
import { pathEquals, pathJoin, snapshotDigest, valueEquals } from './snapshot.ts'

export interface PlanInput {
  readonly manifest: Manifest
  readonly snapshot: ToolSnapshot
  readonly capabilities: DesignToolCapabilities
  readonly config: SyncConfig
  readonly tool: string
  readonly previous: Manifest | null
  readonly previousProvided: boolean
  readonly firstSync: boolean
  readonly allowMassDelete: boolean
}

const PHASE_ORDER: readonly PlanPhase[] = [
  'collections', 'modes', 'renames', 'recreates', 'creates', 'metadata', 'values', 'deletes',
]

interface Draft {
  readonly phase: PlanPhase
  readonly collection: CollectionId
  readonly sortPath: string
  readonly sortCtx: string
  readonly sub: number
  readonly cause: OperationCause
  readonly breaking: boolean
  readonly op: Omit<PlanOperation, 'seq' | 'phase' | 'collection' | 'cause' | 'breaking'>
}

/** Capability checks recorded in every plan/log (§5.2). */
export function computeCapabilityChecks(manifest: Manifest, caps: DesignToolCapabilities): CapabilityCheck[] {
  const brands = contextsOf(manifest, 'brand')
  const modes = contextsOf(manifest, 'mode')
  const checks: CapabilityCheck[] = [
    { check: 'maxModesPerAxis', subject: 'brand', required: brands.length, limit: caps.maxModesPerAxis, ok: caps.maxModesPerAxis >= brands.length },
    { check: 'maxModesPerAxis', subject: 'mode', required: modes.length, limit: caps.maxModesPerAxis, ok: caps.maxModesPerAxis >= modes.length },
    { check: 'aliases', subject: 'topology', required: 'true', limit: String(caps.aliases), ok: caps.aliases },
    { check: 'read', subject: 'snapshot', required: 'api|agent-mcp', limit: caps.read, ok: caps.read !== 'manual' },
    { check: 'axisScope', subject: 'per-frame', required: 'frame', limit: caps.axisScope, ok: caps.axisScope === 'frame' },
    { check: 'write', subject: 'apply', required: 'api', limit: caps.write, ok: caps.write === 'api' },
    { check: 'publish', subject: 'library', required: 'api', limit: caps.publish, ok: caps.publish === 'api' },
  ]
  const supported = new Set(caps.valueTypes)
  for (const type of usedTypes(manifest)) {
    checks.push({ check: 'valueTypes', subject: type, required: 'representable', limit: supported.has(type) ? 'yes' : 'no', ok: supported.has(type) })
  }
  return checks.sort((a, b) => cmp(a.check, b.check) || cmp(a.subject, b.subject))
}

function usedTypes(manifest: Manifest): SyncValueType[] {
  return [...new Set(manifest.variables.map((v) => v.type))].sort(cmp)
}

/** §5.2 preconditions that refuse the plan outright (nothing is written). Throws on the first failure. */
export function assertPreconditions(manifest: Manifest, caps: DesignToolCapabilities): void {
  if (!caps.aliases) throw new SyncCoreError('ALIASES_UNSUPPORTED', 'plan', 'tool does not support variable aliases; the per-axis topology (FR-033) cannot be represented')
  const brands = contextsOf(manifest, 'brand').length
  const modes = contextsOf(manifest, 'mode').length
  const needed = Math.max(brands, modes)
  if (caps.maxModesPerAxis < needed) {
    throw new SyncCoreError('CAPABILITY_EXCEEDED', 'plan', `maxModesPerAxis ${caps.maxModesPerAxis} is below the ${needed} contexts required (brands=${brands}, modes=${modes})`)
  }
  if (caps.read === 'manual') throw new SyncCoreError('READ_UNAVAILABLE', 'plan', 'tool offers no automatic read: there is no snapshot to diff or verify')
}

export function buildPlan(input: PlanInput): SyncPlan {
  const { manifest, snapshot, capabilities: caps, tool } = input
  assertPreconditions(manifest, caps)

  const supportedTypes = new Set(caps.valueTypes)
  const effectiveDesired = manifest.variables.filter((v) => supportedTypes.has(v.type))
  const unsupported = manifest.variables.length - effectiveDesired.length

  const nameToId = new Map(manifest.collections.map((c) => [c.name, c.id]))
  const refToId = new Map<string, CollectionId | null>()
  const snapCollByName = new Map(snapshot.collections.map((c) => [c.name, c]))
  for (const c of snapshot.collections) refToId.set(c.ref, nameToId.get(c.name) ?? null)
  const match = matchVariables(effectiveDesired, snapshot.variables, (ref) => refToId.get(ref) ?? null)

  const prevByKey = new Map((input.previous?.variables ?? []).map((v) => [v.key, v]))
  const classifyVar = (key: string, real: SyncValue | null): OperationCause => {
    const prev = input.previousProvided ? (prevByKey.has(key) ? sig(prevByKey.get(key)!) : null) : undefined
    return classifyDifference({ real, desiredPrevious: prev, firstSync: input.firstSync })
  }

  const drafts: Draft[] = []
  const summary: Record<PlanSummaryKey, number> = { create: 0, rename: 0, recreate: 0, update: 0, delete: 0, unchanged: 0, unsupported }

  // Phase 1: collections absent in the tool that the manifest references.
  const neededCollections = new Set(effectiveDesired.map((v) => v.collection))
  for (const id of COLLECTION_ORDER) {
    if (!neededCollections.has(id)) continue
    const name = manifest.collections.find((c) => c.id === id)!.name
    if (snapCollByName.has(name)) continue
    drafts.push({
      phase: 'collections', collection: id, sortPath: '', sortCtx: '', sub: 0,
      cause: input.firstSync ? 'initial' : structuralCause(input, true), breaking: false,
      op: { op: 'createCollection', modes: contextsOf(manifest, id) },
    })
  }

  // Phase 2: modes on an existing collection (create missing; rename when one missing ↔ one extra).
  for (const id of COLLECTION_ORDER) {
    const name = manifest.collections.find((c) => c.id === id)!.name
    const snapColl = snapCollByName.get(name)
    if (!snapColl || !neededCollections.has(id)) continue
    const want = contextsOf(manifest, id)
    const have = snapColl.modes.map((m) => m.name)
    const missing = want.filter((c) => !have.includes(c))
    const extra = snapColl.modes.filter((m) => !want.includes(m.name))
    if (missing.length === 1 && extra.length === 1) {
      const to = missing[0]!
      drafts.push({
        phase: 'modes', collection: id, sortPath: '', sortCtx: to, sub: 0,
        cause: structuralCause(input, true), breaking: false,
        op: { op: 'renameMode', ref: extra[0]!.ref, from: extra[0]!.name, to },
      })
    } else {
      for (const to of missing) {
        drafts.push({
          phase: 'modes', collection: id, sortPath: '', sortCtx: to, sub: 0,
          cause: structuralCause(input, true), breaking: false,
          op: { op: 'createMode', mode: to },
        })
      }
      for (const m of extra) {
        drafts.push({
          phase: 'deletes', collection: id, sortPath: '', sortCtx: m.name, sub: 1,
          cause: structuralCause(input, false), breaking: false,
          op: { op: 'deleteMode', mode: m.name, ref: m.ref },
        })
      }
    }
  }

  // Matched variables → renames, recreates, metadata, values.
  for (const pair of match.matched) {
    const { desired: d, snapshot: s, collection } = pair
    const typeChanged = s.type !== d.type
    if (typeChanged) {
      drafts.push({
        phase: 'recreates', collection, sortPath: pathJoin(d.path), sortCtx: '', sub: 0,
        cause: classifyVar(d.key, null), breaking: true,
        op: { op: 'recreateVariable', ref: s.ref, key: d.key, path: d.path, reason: 'type', type: d.type },
      })
    } else if (!pathEquals(s.path, d.path)) {
      drafts.push({
        phase: 'renames', collection, sortPath: pathJoin(d.path), sortCtx: '', sub: 0,
        cause: classifyVar(d.key, aliasOrNull(s)), breaking: false,
        op: { op: 'renameVariable', ref: s.ref, key: d.key, from: s.path, to: d.path },
      })
    }
    const metaFields = metadataFieldsFor(pair, typeChanged)
    if (metaFields.length > 0) {
      drafts.push({
        phase: 'metadata', collection, sortPath: pathJoin(d.path), sortCtx: '', sub: 0,
        cause: pair.adopted ? 'manual' : classifyVar(d.key, null), breaking: false,
        op: { op: 'setMetadata', key: d.key, path: d.path, fields: metaFields },
      })
    }
    let changed = false
    for (const ctx of contextsOf(manifest, collection)) {
      const want = d.values[ctx]
      if (!want) continue
      const before = typeChanged ? null : asSyncValue(s.values[ctx])
      if (!typeChanged && valueEquals(before, want)) continue
      changed = true
      drafts.push({
        phase: 'values', collection, sortPath: pathJoin(d.path), sortCtx: ctx, sub: 0,
        cause: classifyDifference({ real: before, desiredPrevious: prevValue(input, prevByKey, d.key, ctx), firstSync: input.firstSync }),
        breaking: false,
        op: { op: 'setValue', key: d.key, path: d.path, mode: ctx, value: want, before },
      })
    }
    if (typeChanged) summary.recreate += 1
    else if (!pathEquals(s.path, d.path)) summary.rename += 1
    else if (changed || metaFields.length > 0) summary.update += 1
    else summary.unchanged += 1
  }

  // Missing variables → create + metadata + values.
  for (const d of match.missing) {
    const cause = classifyVar(d.key, null)
    drafts.push({
      phase: 'creates', collection: d.collection, sortPath: pathJoin(d.path), sortCtx: '', sub: 0,
      cause, breaking: false,
      op: { op: 'createVariable', key: d.key, path: d.path, type: d.type },
    })
    drafts.push({
      phase: 'metadata', collection: d.collection, sortPath: pathJoin(d.path), sortCtx: '', sub: 0,
      cause, breaking: false,
      op: { op: 'setMetadata', key: d.key, path: d.path, fields: ['key'] },
    })
    for (const ctx of contextsOf(manifest, d.collection)) {
      const want = d.values[ctx]
      if (!want) continue
      drafts.push({
        phase: 'values', collection: d.collection, sortPath: pathJoin(d.path), sortCtx: ctx, sub: 0,
        cause: classifyDifference({ real: null, desiredPrevious: prevValue(input, prevByKey, d.key, ctx), firstSync: input.firstSync }),
        breaking: false,
        op: { op: 'setValue', key: d.key, path: d.path, mode: ctx, value: want, before: null },
      })
    }
    summary.create += 1
  }

  // Recreated variables also need their values re-set (the recreate removed them).
  for (const pair of match.matched) {
    if (pair.snapshot.type === pair.desired.type) continue
    const d = pair.desired
    for (const ctx of contextsOf(manifest, pair.collection)) {
      const want = d.values[ctx]
      if (!want) continue
      drafts.push({
        phase: 'values', collection: pair.collection, sortPath: pathJoin(d.path), sortCtx: ctx, sub: 0,
        cause: classifyDifference({ real: null, desiredPrevious: prevValue(input, prevByKey, d.key, ctx), firstSync: input.firstSync }),
        breaking: false,
        op: { op: 'setValue', key: d.key, path: d.path, mode: ctx, value: want, before: null },
      })
    }
  }

  // Phase 8: deletes (extras), last and only in managed collections.
  for (const e of match.extra) {
    drafts.push({
      phase: 'deletes', collection: e.collection, sortPath: pathJoin(e.variable.path), sortCtx: '', sub: 0,
      cause: classifyExtra(input, prevByKey, e.variable, e.collection), breaking: false,
      op: { op: 'deleteVariable', ref: e.variable.ref, key: e.variable.key, path: e.variable.path },
    })
    summary.delete += 1
  }

  // §5.2 mass-delete precondition (needs the planned delete count).
  const managedCount = snapshot.variables.filter((v) => refToId.get(v.collectionRef)).length
  const limit = Math.floor(input.config.maxDeleteFraction * Math.max(managedCount, 1))
  if (!input.allowMassDelete && summary.delete > limit) {
    throw new SyncCoreError('MASS_DELETE_BLOCKED', 'plan', `plan removes ${summary.delete} managed variables, above the limit of ${limit} (maxDeleteFraction=${input.config.maxDeleteFraction}); pass --allow-mass-delete to proceed`)
  }

  const operations = assignSeq(drafts)
  const checks = computeCapabilityChecks(manifest, caps)
  const outcomes = computeOutcomes(manifest, caps, tool)

  return {
    format: 'patods.sync-plan',
    version: 1,
    tool,
    source: { package: manifest.source.package, version: manifest.source.version },
    previous: input.previous ? { version: input.previous.source.version } : null,
    digests: {
      manifest: digest(manifest),
      previousManifest: input.previous ? digest(input.previous) : null,
      snapshot: snapshotDigest(snapshot),
    },
    capabilityChecks: checks,
    summary,
    operations,
    outcomes,
  }
}

function computeOutcomes(manifest: Manifest, caps: DesignToolCapabilities, tool: string): CapabilityOutcome[] {
  const out: CapabilityOutcome[] = []
  const version = manifest.source.version
  if (caps.write === 'manual' || caps.write === 'agent-mcp') {
    out.push({ kind: 'manual-write', subject: version, fingerprint: fp('manual-write', version, tool) })
  }
  if (caps.publish === 'manual') {
    out.push({ kind: 'manual-publish', subject: version, fingerprint: fp('manual-publish', version, tool) })
  }
  if (caps.axisScope === 'file') {
    out.push({ kind: 'capability', subject: 'axisScope', fingerprint: fp('capability', 'axisScope', tool) })
  }
  const supported = new Set(caps.valueTypes)
  for (const type of usedTypes(manifest)) {
    if (!supported.has(type)) out.push({ kind: 'unsupported-type', subject: type, fingerprint: fp('capability', type, tool) })
  }
  return out.sort((a, b) => cmp(a.kind, b.kind) || cmp(a.subject, b.subject))
}

function fp(kind: string, path: string, tool: string): Fingerprint {
  return fingerprint(kind, path, null, tool)
}

// Only the key is written back (it carries its value in the op). description/codeSyntax/hidden are tool
// policy, not a repository-driven value, so the core detects their drift (§8) but does not write them;
// a value-carrying metadata write waits for the real adapter (ADR-14).
function metadataFieldsFor(pair: MatchResult['matched'][number], typeChanged: boolean): ('key')[] {
  void typeChanged
  return pair.adopted || pair.snapshot.key !== pair.desired.key ? ['key'] : []
}

function sig(v: DesiredVariable): SyncValue {
  return { literal: { value: `${v.collection}#${pathJoin(v.path)}#${v.type}` } }
}

function aliasOrNull(s: SnapshotVariable): SyncValue | null {
  return { literal: { value: `${pathJoin(s.path)}#${s.type}` } }
}

function asSyncValue(v: SnapshotVariable['values'][string] | undefined): SyncValue | null {
  if (!v) return null
  if ('unresolved' in v) return null
  return v
}

function prevValue(input: PlanInput, prevByKey: Map<string, DesiredVariable>, key: string, ctx: ContextId): SyncValue | null | undefined {
  if (!input.previousProvided) return undefined
  const p = prevByKey.get(key)
  return p ? p.values[ctx] ?? null : null
}

function classifyExtra(input: PlanInput, prevByKey: Map<string, DesiredVariable>, v: SnapshotVariable, collection: CollectionId): OperationCause {
  const real: SyncValue = { literal: { value: `${collection}#${pathJoin(v.path)}#${v.type}` } }
  const prev = input.previousProvided ? (v.key && prevByKey.has(v.key) ? sig(prevByKey.get(v.key)!) : null) : undefined
  return classifyDifference({ real, desiredPrevious: prev, firstSync: input.firstSync })
}

function structuralCause(input: PlanInput, present: boolean): OperationCause {
  if (input.firstSync) return 'initial'
  if (!input.previousProvided) return 'unclassified'
  return present ? 'manual' : 'release'
}

function assignSeq(drafts: readonly Draft[]): PlanOperation[] {
  const sorted = [...drafts].sort((a, b) =>
    PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase)
    || a.sub - b.sub
    || COLLECTION_ORDER.indexOf(a.collection) - COLLECTION_ORDER.indexOf(b.collection)
    || cmp(a.sortPath, b.sortPath)
    || cmp(a.sortCtx, b.sortCtx))
  return sorted.map((d, i) => ({ seq: i, phase: d.phase, collection: d.collection, cause: d.cause, breaking: d.breaking, ...d.op } as PlanOperation))
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
