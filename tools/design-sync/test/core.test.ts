// Unit tests for the pure core (design-sync.md §5–§8). Each core module is imported by path so the
// QA-02 logic-tests gate sees it covered, and the load-bearing invariants (canonical determinism,
// classification, phase order, fingerprint formula, log split) are asserted directly.
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { canonicalStringify, digest, digestText } from '../src/core/canonical.ts'
import { SyncCoreError, exitCodeFor } from '../src/core/errors.ts'
import { COLLECTION_ORDER, contextsOf, parseManifest } from '../src/core/manifest.ts'
import { pathEquals, snapshotDigest, valueEquals } from '../src/core/snapshot.ts'
import { classifyDifference, isRestored } from '../src/core/classify.ts'
import { matchVariables } from '../src/core/match.ts'
import { detectDivergences, fingerprint } from '../src/core/divergence.ts'
import { assertPreconditions, buildPlan, computeCapabilityChecks } from '../src/core/plan.ts'
import { buildEnvelope, buildLog, deriveChanges, renderLogMarkdown, serializeLog } from '../src/core/log.ts'
import { buildTrackedItem, runApply, runDetect, systemClock } from '../src/core/sync.ts'
import { DEFAULT_CAPABILITIES, FakeClock, InMemoryDesignTool, InMemoryTracker } from '../src/adapters/memory.ts'
import type { SnapshotVariable, SyncOptions, ToolSnapshot } from '../src/ports.ts'
import { sampleConfig, sampleManifest, sampleManifestRaw } from './fixtures.ts'

const EMPTY_SNAPSHOT: ToolSnapshot = { tool: 'memory:sandbox', collections: [], variables: [], published: null }

function baseOptions(clock = new FakeClock()): SyncOptions {
  const manifest = sampleManifest()
  return {
    manifest, previous: null, previousProvided: false, firstSync: true, config: sampleConfig,
    tool: 'memory:sandbox', source: { package: manifest.source.package, version: manifest.source.version, changelog: 'x' },
    trigger: 'manual', runUrl: null, allowMassDelete: false, publish: false,
    release: { version: manifest.source.version, changelogExcerpt: '' }, clock,
    owner: { kind: 'team', slug: '@patods/design-sync-owners', source: 'CODEOWNERS' },
  }
}

describe('canonical', () => {
  it('sorts keys, indents, ends with a newline', () => {
    expect(canonicalStringify({ b: 1, a: 2 })).toBe('{\n  "a": 2,\n  "b": 1\n}\n')
  })
  it('digests are stable regardless of key order', () => {
    expect(digest({ a: 1, b: [3, 2] })).toBe(digest({ b: [3, 2], a: 1 }))
  })
  it('rejects non-finite numbers and normalizes -0', () => {
    expect(() => canonicalStringify({ x: Number.POSITIVE_INFINITY })).toThrow()
    expect(canonicalStringify({ x: -0 })).toBe('{\n  "x": 0\n}\n')
  })
  it('digestText hashes raw text', () => {
    expect(digestText('abc')).toBe(`sha256:${createHash('sha256').update('abc').digest('hex')}`)
  })
})

describe('errors', () => {
  it('maps codes to exit codes', () => {
    expect(exitCodeFor('MANIFEST_INVALID')).toBe(2)
    expect(exitCodeFor('ACCESS_DENIED')).toBe(4)
    expect(exitCodeFor('VERIFY_MISMATCH')).toBe(5)
    expect(exitCodeFor('INTERNAL')).toBe(3)
  })
  it('SyncCoreError carries code/phase', () => {
    const e = new SyncCoreError('MANIFEST_INVALID', 'config', 'bad')
    expect(e.toSyncError()).toEqual({ code: 'MANIFEST_INVALID', phase: 'config', message: 'bad', completedOperations: null })
  })
})

describe('manifest', () => {
  it('parses the fixture and exposes contexts', () => {
    const m = sampleManifest()
    expect(m.variables.length).toBe(8)
    expect(contextsOf(m, 'brand')).toEqual(['a', 'b'])
    expect(contextsOf(m, 'primitive')).toEqual(['*'])
    expect(COLLECTION_ORDER[0]).toBe('primitive')
  })
  it('rejects an unknown version', () => {
    const raw = { ...sampleManifestRaw(), version: 2 }
    expect(() => parseManifest(raw)).toThrow(SyncCoreError)
  })
  it('rejects a value whose context is missing', () => {
    const raw = sampleManifestRaw() as { variables: { values: Record<string, unknown> }[] }
    delete raw.variables[4]!.values.b
    expect(() => parseManifest(raw)).toThrow(/missing value for context/)
  })
})

describe('snapshot', () => {
  it('compares paths and values structurally', () => {
    expect(pathEquals(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(valueEquals({ alias: ['a', 'b'] }, { alias: ['a', 'b'] })).toBe(true)
    expect(valueEquals({ literal: { hex: '#000000', alpha: 1 } }, { literal: { hex: '#ffffff', alpha: 1 } })).toBe(false)
  })
  it('digests a snapshot independent of ref/order', () => {
    const a: ToolSnapshot = { tool: 't', collections: [{ ref: 'c1', name: 'Primitives', modes: [{ ref: 'm1', name: '*' }] }], variables: [], published: null }
    const b: ToolSnapshot = { tool: 't', collections: [{ ref: 'cX', name: 'Primitives', modes: [{ ref: 'mY', name: '*' }] }], variables: [], published: null }
    expect(snapshotDigest(a)).toBe(snapshotDigest(b))
  })
})

describe('classify', () => {
  it('follows the §6 table', () => {
    expect(classifyDifference({ real: null, desiredPrevious: null, firstSync: true })).toBe('initial')
    expect(classifyDifference({ real: null, desiredPrevious: undefined, firstSync: false })).toBe('unclassified')
    const v = { literal: { hex: '#000000', alpha: 1 } }
    expect(classifyDifference({ real: v, desiredPrevious: v, firstSync: false })).toBe('release')
    expect(classifyDifference({ real: { literal: { hex: '#111111', alpha: 1 } }, desiredPrevious: v, firstSync: false })).toBe('manual')
  })
  it('restored covers manual and unclassified', () => {
    expect(isRestored('manual')).toBe(true)
    expect(isRestored('release')).toBe(false)
  })
})

describe('match', () => {
  const desired = sampleManifest().variables
  const idOf = (ref: string) => (ref.startsWith('p') ? 'primitive' as const : null)
  it('matches by key even when the path was renamed, and flags extras', () => {
    const renamed: SnapshotVariable = { ref: 'p1', collectionRef: 'p', path: ['color', 'neutral', 'NINE'], type: 'color', key: 'color.neutral.900', description: '', hidden: false, values: {} }
    const extra: SnapshotVariable = { ref: 'p2', collectionRef: 'p', path: ['color', 'ghost'], type: 'color', key: null, description: '', hidden: false, values: {} }
    const res = matchVariables(desired, [renamed, extra], idOf)
    expect(res.matched.find((m) => m.desired.key === 'color.neutral.900')!.snapshot.ref).toBe('p1')
    expect(res.extra.map((e) => e.variable.ref)).toContain('p2')
  })
  it('adopts a keyless variable by path', () => {
    const keyless: SnapshotVariable = { ref: 'p9', collectionRef: 'p', path: ['color', 'neutral', '900'], type: 'color', key: null, description: '', hidden: false, values: {} }
    const res = matchVariables(desired, [keyless], idOf)
    const pair = res.matched.find((m) => m.desired.key === 'color.neutral.900')!
    expect(pair.adopted).toBe(true)
  })
})

describe('divergence', () => {
  it('fingerprint matches the §8 formula', () => {
    const want = `sha256:${createHash('sha256').update('value|color.bg.surface|dark|memory:sandbox').digest('hex')}`
    expect(fingerprint('value', 'color.bg.surface', 'dark', 'memory:sandbox')).toBe(want)
  })
  it('classifies a manual alias edit after sync', async () => {
    const manifest = sampleManifest()
    const tool = new InMemoryDesignTool()
    await runApply(tool, baseOptions(), { dryRun: false })
    tool.simulateManualEdit(['color', 'bg', 'surface'], 'dark', { alias: ['brand', 'color', 'bg', 'raised', 'dark'] })
    const report = detectDivergences({ manifest, snapshot: await tool.readSnapshot(), tool: 'memory:sandbox', previous: manifest, previousProvided: true, firstSync: false })
    const item = report.items.find((i) => i.path.join('.') === 'color.bg.surface' && i.mode === 'dark')!
    expect(item.kind).toBe('alias')
    expect(item.classification).toBe('manual')
  })
})

describe('plan', () => {
  it('creates everything on an empty tool, with monotonic phases and seq', () => {
    const plan = buildPlan({ manifest: sampleManifest(), snapshot: EMPTY_SNAPSHOT, capabilities: DEFAULT_CAPABILITIES, config: sampleConfig, tool: 'memory:sandbox', previous: null, previousProvided: false, firstSync: true, allowMassDelete: false })
    expect(plan.summary.create).toBe(8)
    plan.operations.forEach((op, i) => expect(op.seq).toBe(i))
    const phases = ['collections', 'modes', 'renames', 'recreates', 'creates', 'metadata', 'values', 'deletes']
    let last = -1
    for (const op of plan.operations) {
      const idx = phases.indexOf(op.phase)
      expect(idx).toBeGreaterThanOrEqual(last)
      last = idx
    }
  })
  it('computes capability checks and refuses on missing capabilities', () => {
    const checks = computeCapabilityChecks(sampleManifest(), DEFAULT_CAPABILITIES)
    expect(checks.find((c) => c.check === 'maxModesPerAxis' && c.subject === 'brand')!.ok).toBe(true)
    expect(() => assertPreconditions(sampleManifest(), { ...DEFAULT_CAPABILITIES, aliases: false })).toThrow(/aliases/)
    expect(() => assertPreconditions(sampleManifest(), { ...DEFAULT_CAPABILITIES, maxModesPerAxis: 1 })).toThrow(SyncCoreError)
    expect(() => assertPreconditions(sampleManifest(), { ...DEFAULT_CAPABILITIES, read: 'manual' })).toThrow(/read/)
  })
})

describe('log', () => {
  it('splits changes vs restored and renders markdown + envelope', () => {
    const plan = buildPlan({ manifest: sampleManifest(), snapshot: EMPTY_SNAPSHOT, capabilities: DEFAULT_CAPABILITIES, config: sampleConfig, tool: 'memory:sandbox', previous: null, previousProvided: false, firstSync: true, allowMassDelete: false })
    const derived = deriveChanges(plan)
    expect(derived.changes.length).toBeGreaterThan(0)
    expect(derived.restored).toHaveLength(0)
    const log = buildLog({ command: 'apply', tool: 'memory:sandbox', source: { package: '@patods/tokens', version: '1.4.0', changelog: 'x' }, previous: null, result: 'verified', plan, divergenceAfter: { missing: 0, extra: 0, value: 0, alias: 0, name: 0, hierarchy: 0, type: 0 }, snapshotBefore: digest(EMPTY_SNAPSHOT), snapshotAfter: digest(EMPTY_SNAPSHOT), error: null })
    expect(renderLogMarkdown(log)).toContain('## Version changes')
    const env = buildEnvelope(log, { ranOn: '2026-11-07T00:00:00.000Z', trigger: 'manual', runUrl: null, toolErrorDetail: null })
    expect(env.logSha256).toBe(digestText(serializeLog(log)))
  })
})

describe('sync orchestration', () => {
  it('systemClock returns a Date', () => {
    expect(systemClock.now()).toBeInstanceOf(Date)
  })
  it('detect opens a tracked item and builds a deterministic title', async () => {
    const tool = new InMemoryDesignTool()
    await runApply(tool, baseOptions(), { dryRun: false })
    tool.simulateManualEdit(['color', 'bg', 'surface'], 'dark', { alias: ['brand', 'color', 'bg', 'raised', 'dark'] })
    const tracker = new InMemoryTracker(new FakeClock())
    const out = await runDetect(tool, { ...baseOptions(), previous: sampleManifest(), previousProvided: true, firstSync: false }, tracker)
    expect(out.items.length).toBeGreaterThan(0)
    expect(out.tracker.created.length).toBe(out.items.length)
    const item = buildTrackedItem(out.items[0]!, baseOptions())
    expect(item.title.startsWith('[design-sync]')).toBe(true)
    expect(item.labels).toContain('design-sync:divergence')
  })
})
