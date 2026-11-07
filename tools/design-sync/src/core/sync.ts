// Orchestration (design-sync.md §2 flow, §5.5 verification, §6, §9). Dependency-injected: it drives a
// DesignToolPort (plan → apply → verify → publish) and, for detect, a TrackerPort/AlertPort. States:
// planned | dry-run | verified | failed. Every failure (codes 2–5) raises an alert before returning
// (G-4). No step carries data from the tool into the repository (G-1, FR-025): apply/detect only read
// the snapshot to diff it in memory and emit logs/reports.
import type {
  AlertPort, ApplyResult, DesignToolPort, DivergenceCounts, DivergenceItem, Fingerprint, IsoDate,
  ReleaseRef, RoleRef, Sha256, SyncConfig, SyncEnvelope, SyncError, SyncLog, SyncPlan, SyncResultState,
  TrackedItem, TrackerPort, UpsertResult,
} from '../ports.ts'
import { detectDivergences, fingerprint } from './divergence.ts'
import { SyncCoreError, exitCodeFor } from './errors.ts'
import { buildEnvelope, buildLog, renderLogMarkdown, serializeLog } from './log.ts'
import type { Manifest } from './manifest.ts'
import { buildPlan, computeCapabilityChecks } from './plan.ts'
import { pathJoin, snapshotDigest } from './snapshot.ts'

export interface Clock {
  now(): Date
}

export const systemClock: Clock = { now: () => new Date() }

const EMPTY_COUNTS: DivergenceCounts = { missing: 0, extra: 0, value: 0, alias: 0, name: 0, hierarchy: 0, type: 0 }

export interface SyncOptions {
  readonly manifest: Manifest
  readonly previous: Manifest | null
  readonly previousProvided: boolean
  readonly firstSync: boolean
  readonly config: SyncConfig
  readonly tool: string // '<adapterId>:<targetId>'
  readonly source: SyncLog['source']
  readonly trigger: SyncEnvelope['trigger']
  readonly runUrl: string | null
  readonly allowMassDelete: boolean
  readonly publish: boolean
  readonly release: ReleaseRef
  readonly clock: Clock
  readonly owner?: RoleRef
  readonly alert?: AlertPort
}

export interface SyncOutput {
  readonly state: SyncResultState
  readonly plan: SyncPlan
  readonly log: SyncLog
  readonly logText: string
  readonly markdown: string
  readonly envelope: SyncEnvelope
  readonly applyResult: ApplyResult | null
  readonly error: SyncError | null
  readonly exitCode: number
}

function iso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

async function raiseAlert(options: SyncOptions, error: SyncError): Promise<void> {
  if (!options.alert || !options.owner) return
  const fp: Fingerprint = fingerprint('failure', error.code, null, options.tool)
  await options.alert.raise({
    fingerprint: fp, severity: 'error', error, owner: options.owner, tool: options.tool, runUrl: options.runUrl,
  })
}

function finish(options: SyncOptions, args: {
  command: SyncLog['command']
  result: SyncResultState
  plan: SyncPlan
  divergenceAfter: DivergenceCounts
  snapshotBefore: Sha256
  snapshotAfter: Sha256 | null
  error: SyncError | null
  applyResult: ApplyResult | null
  exitCode: number
  toolErrorDetail: string | null
}): SyncOutput {
  const log = buildLog({
    command: args.command,
    tool: options.tool,
    source: options.source,
    previous: options.previous ? { version: options.previous.source.version } : null,
    result: args.result,
    plan: args.plan,
    divergenceAfter: args.divergenceAfter,
    snapshotBefore: args.snapshotBefore,
    snapshotAfter: args.snapshotAfter,
    error: args.error,
  })
  const logText = serializeLog(log)
  const envelope = buildEnvelope(log, {
    ranOn: options.clock.now().toISOString(),
    trigger: options.trigger,
    runUrl: options.runUrl,
    toolErrorDetail: args.toolErrorDetail,
  })
  return {
    state: args.result,
    plan: args.plan,
    log,
    logText,
    markdown: renderLogMarkdown(log),
    envelope,
    applyResult: args.applyResult,
    error: args.error,
    exitCode: args.exitCode,
  }
}

/** `design-sync apply` (and `--dry-run`). */
export async function runApply(port: DesignToolPort, options: SyncOptions, flags: { readonly dryRun: boolean }): Promise<SyncOutput> {
  const caps = port.capabilities()
  const before = await port.readSnapshot()
  const snapshotBefore = snapshotDigest(before)
  let plan: SyncPlan
  try {
    plan = buildPlan({
      manifest: options.manifest, snapshot: before, capabilities: caps, config: options.config, tool: options.tool,
      previous: options.previous, previousProvided: options.previousProvided, firstSync: options.firstSync,
      allowMassDelete: options.allowMassDelete,
    })
  } catch (err) {
    return await refuse(options, 'apply', err, snapshotBefore, caps)
  }

  if (flags.dryRun) {
    const dry = await port.apply(plan, { dryRun: true })
    return finish(options, { command: 'apply', result: 'dry-run', plan, divergenceAfter: EMPTY_COUNTS, snapshotBefore, snapshotAfter: null, error: null, applyResult: dry, exitCode: 0, toolErrorDetail: null })
  }

  const applyResult = await port.apply(plan, { dryRun: false })
  if (applyResult.status === 'manual') {
    // write=manual (§9): nothing was written and no failure occurred. The plan already carries the
    // manual-write capability outcome; result is `planned` (manual output), exit 1, no failure alert.
    return finish(options, { command: 'apply', result: 'planned', plan, divergenceAfter: EMPTY_COUNTS, snapshotBefore, snapshotAfter: null, error: null, applyResult, exitCode: 1, toolErrorDetail: null })
  }
  if (applyResult.status === 'partial' || applyResult.error) {
    const error: SyncError = applyResult.error ?? { code: 'INTERNAL', phase: 'apply', message: 'apply did not complete', completedOperations: applyResult.completedOperations }
    await raiseAlert(options, error)
    return finish(options, { command: 'apply', result: 'failed', plan, divergenceAfter: EMPTY_COUNTS, snapshotBefore, snapshotAfter: null, error, applyResult, exitCode: exitCodeFor(error.code), toolErrorDetail: error.message })
  }

  // §5.5 verification: a fresh snapshot must diff empty.
  const after = await port.readSnapshot()
  const residual = detectDivergences({ manifest: options.manifest, snapshot: after, tool: options.tool, previous: options.previous, previousProvided: options.previousProvided, firstSync: options.firstSync })
  const snapshotAfter = snapshotDigest(after)
  if (residual.items.length > 0) {
    const error: SyncError = { code: 'VERIFY_MISMATCH', phase: 'verify', message: `verification found ${residual.items.length} residual divergence(s) after apply`, completedOperations: applyResult.completedOperations }
    await raiseAlert(options, error)
    return finish(options, { command: 'apply', result: 'failed', plan, divergenceAfter: residual.counts, snapshotBefore, snapshotAfter, error, applyResult, exitCode: 5, toolErrorDetail: error.message })
  }

  if (options.publish) await port.requestPublish(options.release)
  return finish(options, { command: 'apply', result: 'verified', plan, divergenceAfter: residual.counts, snapshotBefore, snapshotAfter, error: null, applyResult, exitCode: 0, toolErrorDetail: null })
}

/** `design-sync plan` — read, diff, no write. */
export async function runPlan(port: DesignToolPort, options: SyncOptions): Promise<SyncOutput> {
  const caps = port.capabilities()
  const before = await port.readSnapshot()
  const snapshotBefore = snapshotDigest(before)
  let plan: SyncPlan
  try {
    plan = buildPlan({
      manifest: options.manifest, snapshot: before, capabilities: caps, config: options.config, tool: options.tool,
      previous: options.previous, previousProvided: options.previousProvided, firstSync: options.firstSync,
      allowMassDelete: options.allowMassDelete,
    })
  } catch (err) {
    return await refuse(options, 'plan', err, snapshotBefore, caps)
  }
  return finish(options, { command: 'plan', result: 'planned', plan, divergenceAfter: EMPTY_COUNTS, snapshotBefore, snapshotAfter: null, error: null, applyResult: null, exitCode: 0, toolErrorDetail: null })
}

async function refuse(options: SyncOptions, command: SyncLog['command'], err: unknown, snapshotBefore: Sha256, caps: ReturnType<DesignToolPort['capabilities']>): Promise<SyncOutput> {
  const error = err instanceof SyncCoreError ? err.toSyncError() : { code: 'INTERNAL' as const, phase: 'plan' as const, message: (err as Error).message, completedOperations: null }
  // The refused plan still records the capability checks (§5.2) and raises an alert before returning (G-4).
  const refusedPlan: SyncPlan = {
    format: 'patods.sync-plan', version: 1, tool: options.tool,
    source: { package: options.source.package, version: options.source.version },
    previous: options.previous ? { version: options.previous.source.version } : null,
    digests: { manifest: `sha256:${'0'.repeat(64)}`, previousManifest: null, snapshot: snapshotBefore },
    capabilityChecks: computeCapabilityChecks(options.manifest, caps),
    summary: { create: 0, rename: 0, recreate: 0, update: 0, delete: 0, unchanged: 0, unsupported: 0 },
    operations: [], outcomes: [],
  }
  await raiseAlert(options, error)
  return finish(options, { command, result: 'failed', plan: refusedPlan, divergenceAfter: EMPTY_COUNTS, snapshotBefore, snapshotAfter: null, error, applyResult: null, exitCode: exitCodeFor(error.code), toolErrorDetail: error.message })
}

// ── detect ──────────────────────────────────────────────────────────────────

export interface DetectOutput {
  readonly items: readonly DivergenceItem[]
  readonly counts: DivergenceCounts
  readonly tracker: {
    readonly created: readonly Fingerprint[]
    readonly updated: readonly Fingerprint[]
    readonly reopened: readonly Fingerprint[]
    readonly unchanged: readonly Fingerprint[]
    readonly resolved: readonly Fingerprint[]
  }
  readonly exitCode: number
}

/** `design-sync detect` — report divergences, upsert items by fingerprint, resolve those gone. */
export async function runDetect(port: DesignToolPort, options: SyncOptions, tracker?: TrackerPort): Promise<DetectOutput> {
  const snapshot = await port.readSnapshot()
  const { items, counts } = detectDivergences({ manifest: options.manifest, snapshot, tool: options.tool, previous: options.previous, previousProvided: options.previousProvided, firstSync: options.firstSync })

  const created: Fingerprint[] = []
  const updated: Fingerprint[] = []
  const reopened: Fingerprint[] = []
  const unchanged: Fingerprint[] = []
  const resolved: Fingerprint[] = []

  if (tracker && options.owner) {
    const seen = new Set<Fingerprint>()
    for (const item of items) {
      seen.add(item.fingerprint)
      const res: UpsertResult = await tracker.upsert(buildTrackedItem(item, options))
      bucket(res.action, item.fingerprint, { created, updated, reopened, unchanged })
    }
    const open = await tracker.listOpen({ kinds: ['divergence'] })
    for (const o of open) {
      if (!seen.has(o.fingerprint)) {
        const r = await tracker.resolve(o.fingerprint, `No longer observed by a detect run of ${options.source.version}.`)
        if (r.action === 'resolved') resolved.push(o.fingerprint)
      }
    }
  }

  return { items, counts, tracker: { created, updated, reopened, unchanged, resolved }, exitCode: items.length > 0 ? 1 : 0 }
}

// EMPTY_COUNTS is re-exported from ./divergence.ts; not re-exported here to avoid a barrel collision.

function bucket(action: UpsertResult['action'], fp: Fingerprint, into: { created: Fingerprint[]; updated: Fingerprint[]; reopened: Fingerprint[]; unchanged: Fingerprint[] }): void {
  if (action === 'created') into.created.push(fp)
  else if (action === 'updated') into.updated.push(fp)
  else if (action === 'reopened') into.reopened.push(fp)
  else into.unchanged.push(fp)
}

/** Build the tracked item for a divergence (§8, §11): deterministic title/body/labels, owner, due. */
export function buildTrackedItem(item: DivergenceItem, options: SyncOptions): TrackedItem {
  const owner = options.owner!
  const modePart = item.mode ? ` (${item.mode})` : ''
  const title = `[design-sync] ${item.kind} ${pathJoin(item.path)}${modePart}`
  const due = iso(addDays(options.clock.now(), options.config.slaDays.divergence))
  const body = [
    `Divergence detected by design-sync on \`${item.tool}\`.`,
    '',
    `- kind: ${item.kind}`,
    `- field: ${item.field}`,
    `- collection: ${item.collection}`,
    `- path: ${pathJoin(item.path)}`,
    `- mode: ${item.mode ?? '(n/a)'}`,
    `- classification: ${item.classification}`,
    `- source version: ${item.sourceVersion}`,
    '',
    `Owner: ${owner.slug} (from ${owner.source}). Due ${due}.`,
    '',
    `<!-- patods-design-sync fingerprint: ${item.fingerprint} -->`,
  ].join('\n')
  return {
    fingerprint: item.fingerprint,
    kind: 'divergence',
    title,
    body,
    owner,
    due,
    labels: ['design-sync', 'design-sync:divergence', `kind:${item.kind}`],
  }
}
