// Port contract suite (design-sync.md §13, cases C-01..C-18). Parameterized by a harness so it can run
// against the in-memory fake on every PR (QA-02) and, once a tool is chosen, against the real adapter on
// a sandbox. The harness is the extension point: `newTool` provisions a fresh target with given
// capabilities/initial state/clock. Fault-injection cases use the fake's FaultPlan, exposed through the
// harness; a harness without fault support skips them (a real adapter proves C-13/C-14 differently).
import { describe, expect, it } from 'vitest'
import type { AlertPort, SyncConfig, SyncOptions } from '../src/ports.ts'
import { canonicalStringify } from '../src/core/canonical.ts'
import { snapshotDigest } from '../src/core/snapshot.ts'
import { runApply, runPlan } from '../src/core/sync.ts'
import { FakeClock, InMemoryAlert, InMemoryDesignTool, type InMemoryDesignToolOptions } from '../src/adapters/memory.ts'
import { resolveInManifest } from './fixtures.ts'
import type { Manifest } from '../src/core/index.ts'

export interface ContractHarness {
  readonly manifest: Manifest
  readonly config: SyncConfig
  newTool(options?: InMemoryDesignToolOptions): InMemoryDesignTool
}

const OWNER = { kind: 'team', slug: '@patods/design-sync-owners', source: 'CODEOWNERS' } as const

function optionsFor(
  manifest: Manifest, config: SyncConfig, clock: FakeClock,
  opts: { previous?: Manifest | null; firstSync?: boolean; publish?: boolean; alert?: AlertPort } = {},
): SyncOptions {
  const previous = opts.previous ?? null
  return {
    manifest,
    previous,
    previousProvided: previous !== null,
    firstSync: opts.firstSync ?? true,
    config,
    tool: 'memory:sandbox',
    source: { package: manifest.source.package, version: manifest.source.version, changelog: 'CHANGELOG#x' },
    trigger: 'manual',
    runUrl: null,
    allowMassDelete: false,
    publish: opts.publish ?? false,
    release: { version: manifest.source.version, changelogExcerpt: '' },
    clock,
    owner: OWNER,
    alert: opts.alert,
  }
}

export function describeDesignToolPortContract(name: string, factory: () => ContractHarness): void {
  describe(`DesignToolPort contract — ${name}`, () => {
    const h = factory()
    const manifest = h.manifest

    it('C-01 capabilities are static and valid', () => {
      const caps = h.newTool().capabilities()
      expect(caps.maxModesPerAxis).toBeGreaterThanOrEqual(1)
      expect(typeof caps.aliases).toBe('boolean')
      expect(caps.valueTypes).toContain('color')
      expect(['api', 'agent-mcp', 'manual']).toContain(caps.read)
      expect(['api', 'agent-mcp', 'manual']).toContain(caps.write)
      expect(['api', 'manual', 'none']).toContain(caps.publish)
    })

    it('C-02 checkAccess approves a valid credential and reports a typed problem for an invalid one', async () => {
      expect((await h.newTool().checkAccess()).ok).toBe(true)
      const expired = h.newTool()
      expired.faults.expireCredential()
      const report = await expired.checkAccess()
      expect(report.ok).toBe(false)
      expect(report.problems[0]!.code).toBe('CREDENTIAL_EXPIRED')
      const forbidden = h.newTool()
      forbidden.faults.forbidden()
      expect((await forbidden.checkAccess()).problems[0]!.code).toBe('ACCESS_DENIED')
    })

    it('C-03 two consecutive reads give the same snapshot and sha256', async () => {
      const tool = h.newTool()
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      const a = await tool.readSnapshot()
      const b = await tool.readSnapshot()
      expect(canonicalStringify(a)).toBe(canonicalStringify(b))
      expect(snapshotDigest(a)).toBe(snapshotDigest(b))
    })

    it('C-04 initial sync from the fixture ends verified', async () => {
      const out = await runApply(h.newTool(), optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      expect(out.state).toBe('verified')
      expect(out.exitCode).toBe(0)
    })

    it('C-05 a second run produces an empty plan (idempotence)', async () => {
      const tool = h.newTool()
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      const again = await runPlan(tool, optionsFor(manifest, h.config, new FakeClock(), { previous: manifest, firstSync: false }))
      expect(again.plan.operations).toHaveLength(0)
    })

    it('C-06 dryRun does not change the target and returns the planned operations', async () => {
      const tool = h.newTool()
      const out = await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: true })
      expect(out.state).toBe('dry-run')
      expect(out.plan.operations.length).toBeGreaterThan(0)
      expect(out.applyResult!.status).toBe('dry-run')
      expect((await tool.readSnapshot()).variables).toHaveLength(0)
    })

    it('C-07 phase order is respected in operationsLog', async () => {
      const tool = h.newTool()
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      const phases = ['collections', 'modes', 'renames', 'recreates', 'creates', 'metadata', 'values', 'deletes']
      let last = -1
      for (const op of tool.operationsLog()) {
        const idx = phases.indexOf(op.phase)
        expect(idx).toBeGreaterThanOrEqual(last)
        last = idx
      }
      expect(tool.operationsLog().length).toBeGreaterThan(0)
    })

    it('C-08 a manual value edit is restored and classified manual', async () => {
      const tool = h.newTool()
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      tool.simulateManualEdit(['color', 'bg', 'surface'], 'dark', { alias: ['brand', 'color', 'bg', 'raised', 'dark'] })
      const out = await runApply(tool, optionsFor(manifest, h.config, new FakeClock(), { previous: manifest, firstSync: false }), { dryRun: false })
      expect(out.state).toBe('verified')
      const restored = out.log.restored.find((c) => c.path.join('.') === 'color.bg.surface' && c.mode === 'dark')
      expect(restored).toBeDefined()
      expect(restored!.cause).toBe('manual')
      expect(canonicalStringify(tool.resolve(['color', 'bg', 'surface'], 'a', 'dark'))).toBe(canonicalStringify(resolveInManifest(manifest, ['color', 'bg', 'surface'], 'a', 'dark')))
    })

    it('C-09 a manual rename is undone by key, preserving the native ref (links)', async () => {
      const tool = h.newTool()
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      const before = (await tool.readSnapshot()).variables.find((v) => v.key === 'color.focus.ring')!
      tool.simulateRename(['color', 'focus', 'ring'], ['color', 'focus', 'legacy'])
      const plan = await runPlan(tool, optionsFor(manifest, h.config, new FakeClock(), { previous: manifest, firstSync: false }))
      const rename = plan.plan.operations.find((o) => o.op === 'renameVariable')
      expect(rename).toBeDefined()
      expect(plan.plan.operations.some((o) => o.op === 'createVariable' && o.path.join('.') === 'color.focus.ring')).toBe(false)
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock(), { previous: manifest, firstSync: false }), { dryRun: false })
      const after = (await tool.readSnapshot()).variables.find((v) => v.key === 'color.focus.ring')!
      expect(after.ref).toBe(before.ref)
    })

    it('C-10 an extra managed variable is removed; an unmanaged collection stays intact', async () => {
      const tool = h.newTool({ initial: { tool: 'memory:sandbox', collections: [{ ref: 'cL', name: 'Legacy', modes: [{ ref: 'mL', name: '*' }] }], variables: [{ ref: 'vL', collectionRef: 'cL', path: ['legacy', 'keep'], type: 'color', key: null, description: '', hidden: false, values: { '*': { literal: { hex: '#000000', alpha: 1 } } } }], published: null } })
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      tool.simulateExtraVariable('primitive', ['color', 'ghost', '000'], 'color')
      const out = await runApply(tool, optionsFor(manifest, h.config, new FakeClock(), { previous: manifest, firstSync: false }), { dryRun: false })
      expect(out.state).toBe('verified')
      const snap = await tool.readSnapshot()
      expect(snap.variables.some((v) => v.path.join('.') === 'color.ghost.000')).toBe(false)
      expect(snap.variables.some((v) => v.path.join('.') === 'legacy.keep')).toBe(true)
    })

    it('C-11 a type change becomes recreateVariable with breaking: true', async () => {
      const tool = h.newTool()
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      tool.simulateTypeChange(['color', 'neutral', '900'], 'dimension')
      const plan = await runPlan(tool, optionsFor(manifest, h.config, new FakeClock(), { previous: manifest, firstSync: false }))
      const recreate = plan.plan.operations.find((o) => o.op === 'recreateVariable' && o.path.join('.') === 'color.neutral.900')
      expect(recreate).toBeDefined()
      expect(recreate!.breaking).toBe(true)
    })

    it('C-12 per-axis topology: resolving each brand×mode pair follows the chain, zero auxiliaries', async () => {
      const tool = h.newTool()
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      const snap = await tool.readSnapshot()
      const keys = new Set(manifest.variables.map((v) => v.key))
      for (const v of snap.variables) {
        expect(v.key).not.toBeNull()
        expect(keys.has(v.key!)).toBe(true)
      }
      for (const brand of ['a', 'b']) {
        for (const mode of ['dark', 'light']) {
          const got = tool.resolve(['color', 'bg', 'surface'], brand, mode)
          const want = resolveInManifest(manifest, ['color', 'bg', 'surface'], brand, mode)
          expect(canonicalStringify(got)).toBe(canonicalStringify(want))
        }
      }
    })

    it('C-13 a failure after N operations leaves partial; the next run converges and alerts', async () => {
      const clock = new FakeClock()
      const tool = h.newTool({ clock })
      tool.faults.failAfterOperations(3, 'INTERNAL')
      const alert = new InMemoryAlert()
      const first = await runApply(tool, optionsFor(manifest, h.config, clock, { alert }), { dryRun: false })
      expect(first.state).toBe('failed')
      expect(first.applyResult!.status).toBe('partial')
      expect(first.applyResult!.completedOperations).toBe(3)
      expect(alert.raised).toHaveLength(1)
      tool.faults.reset()
      const second = await runApply(tool, optionsFor(manifest, h.config, clock, { previous: manifest, firstSync: false }), { dryRun: false })
      expect(second.state).toBe('verified')
    })

    it('C-14 429 with Retry-After is honored up to the limit; afterwards RATE_LIMITED', async () => {
      const clock = new FakeClock()
      const tool = h.newTool({ clock, retry: { maxRetries: 5, maxRetryAfterSeconds: 60 } })
      tool.faults.rateLimit(2, 10)
      const t0 = clock.now().getTime()
      const ok = await runApply(tool, optionsFor(manifest, h.config, clock), { dryRun: false })
      expect(ok.state).toBe('verified')
      expect(clock.now().getTime() - t0).toBe(20_000)

      const clock2 = new FakeClock()
      const tool2 = h.newTool({ clock: clock2, retry: { maxRetries: 1, maxRetryAfterSeconds: 60 } })
      tool2.faults.rateLimit(3, 10)
      const limited = await runApply(tool2, optionsFor(manifest, h.config, clock2, { alert: new InMemoryAlert() }), { dryRun: false })
      expect(limited.state).toBe('failed')
      expect(limited.error!.code).toBe('RATE_LIMITED')
      expect(limited.exitCode).toBe(4)
    })

    it('C-15 maxModesPerAxis below the brand count refuses the plan without writing', async () => {
      const tool = h.newTool({ capabilities: { maxModesPerAxis: 1 } })
      const out = await runPlan(tool, optionsFor(manifest, h.config, new FakeClock(), { alert: new InMemoryAlert() }))
      expect(out.state).toBe('failed')
      expect(out.error!.code).toBe('CAPABILITY_EXCEEDED')
      expect(out.exitCode).toBe(2)
      expect((await tool.readSnapshot()).variables).toHaveLength(0)
    })

    it('C-16 requestPublish returns the outcome of the publish capability', async () => {
      const release = { version: '1.4.0', changelogExcerpt: '' }
      expect((await h.newTool({ capabilities: { publish: 'api' } }).requestPublish(release)).status).toBe('published')
      expect((await h.newTool({ capabilities: { publish: 'manual' } }).requestPublish(release)).status).toBe('manual')
      expect((await h.newTool({ capabilities: { publish: 'none' } }).requestPublish(release)).status).toBe('none')
    })

    it('C-17 the value round trip is exact (color, dimension, duration, number)', async () => {
      const tool = h.newTool()
      await runApply(tool, optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      const snap = await tool.readSnapshot()
      const neutral = snap.variables.find((v) => v.key === 'color.neutral.900')!
      expect(canonicalStringify(neutral.values['*'])).toBe(canonicalStringify({ literal: { hex: '#16181d', alpha: 1 } }))
    })

    it('C-18 same inputs, two runs: plan and log byte-for-byte identical', async () => {
      const a = await runApply(h.newTool(), optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      const b = await runApply(h.newTool(), optionsFor(manifest, h.config, new FakeClock()), { dryRun: false })
      expect(canonicalStringify(a.plan)).toBe(canonicalStringify(b.plan))
      expect(a.logText).toBe(b.logText)
    })
  })
}
