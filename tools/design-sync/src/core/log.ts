// Sync record (design-sync.md §7). The canonical sync-log.json is byte-for-byte deterministic for the
// same inputs (G-3); sync-log.md is rendered only from it; the non-deterministic envelope (date, run
// URL, raw tool error) is separate. changes[] carries version changes (release/initial); restored[]
// carries manual edits undone (manual/unclassified). A release change never appears in restored[].
import type {
  CapabilityOutcome, DivergenceCounts, LogChange, PlanOperation, Sha256, SyncEnvelope, SyncError,
  SyncLog, SyncPlan, SyncResultState,
} from '../ports.ts'
import { canonicalStringify, digest, digestText } from './canonical.ts'
import { isRestored } from './classify.ts'
import { pathJoin } from './snapshot.ts'

export interface DerivedChanges {
  readonly changes: readonly LogChange[]
  readonly restored: readonly LogChange[]
}

/** Split the plan's content operations into version changes and restored manual edits (§7). */
export function deriveChanges(plan: SyncPlan): DerivedChanges {
  const entries: LogChange[] = []
  for (const op of plan.operations) {
    const e = toLogChange(op)
    if (e) entries.push(e)
  }
  entries.sort((a, b) => cmp(pathJoin(a.path), pathJoin(b.path)) || cmp(a.mode ?? '', b.mode ?? '') || cmp(a.op, b.op))
  return {
    changes: entries.filter((e) => !isRestored(e.cause)),
    restored: entries.filter((e) => isRestored(e.cause)),
  }
}

function toLogChange(op: PlanOperation): LogChange | null {
  switch (op.op) {
    case 'setValue':
      return { op: op.op, collection: op.collection, path: op.path, mode: op.mode, before: op.before, after: op.value, cause: op.cause, breaking: op.breaking }
    case 'renameVariable':
      return { op: op.op, collection: op.collection, path: op.to, from: op.from, cause: op.cause, breaking: op.breaking }
    case 'recreateVariable':
    case 'createVariable':
    case 'deleteVariable':
      return { op: op.op, collection: op.collection, path: op.path, cause: op.cause, breaking: op.breaking }
    default:
      return null
  }
}

export interface BuildLogInput {
  readonly command: SyncLog['command']
  readonly tool: string
  readonly source: SyncLog['source']
  readonly previous: SyncLog['previous']
  readonly result: SyncResultState
  readonly plan: SyncPlan
  readonly divergenceAfter: DivergenceCounts
  readonly snapshotBefore: Sha256
  readonly snapshotAfter: Sha256 | null
  readonly error: SyncError | null
}

export function buildLog(input: BuildLogInput): SyncLog {
  const derived = deriveChanges(input.plan)
  return {
    format: 'patods.sync-log',
    version: 1,
    command: input.command,
    tool: input.tool,
    source: input.source,
    previous: input.previous,
    result: input.result,
    digests: {
      manifest: input.plan.digests.manifest,
      previousManifest: input.plan.digests.previousManifest,
      snapshotBefore: input.snapshotBefore,
      snapshotAfter: input.snapshotAfter,
      plan: digest(input.plan),
    },
    capabilityChecks: input.plan.capabilityChecks,
    changes: derived.changes,
    restored: derived.restored,
    outcomes: input.plan.outcomes,
    divergenceAfter: input.divergenceAfter,
    error: input.error,
  }
}

/** Canonical serialization of the log (what the envelope hashes and what sync-log.json contains). */
export function serializeLog(log: SyncLog): string {
  return canonicalStringify(log)
}

export interface EnvelopeInput {
  readonly ranOn: string
  readonly trigger: SyncEnvelope['trigger']
  readonly runUrl: string | null
  readonly toolErrorDetail: string | null
}

export function buildEnvelope(log: SyncLog, input: EnvelopeInput): SyncEnvelope {
  return {
    format: 'patods.sync-envelope',
    version: 1,
    ranOn: input.ranOn,
    trigger: input.trigger,
    runUrl: input.runUrl,
    logSha256: digestText(serializeLog(log)),
    toolErrorDetail: input.toolErrorDetail,
  }
}

/** sync-log.md, rendered only from the canonical log (§7). Deterministic. */
export function renderLogMarkdown(log: SyncLog): string {
  const lines: string[] = []
  lines.push(`# Sync ${log.command} — ${log.tool}`, '')
  lines.push('## Summary', '')
  lines.push(`- Source: ${log.source.package} ${log.source.version}`)
  lines.push(`- Previous: ${log.previous ? log.previous.version : '(none)'}`)
  lines.push(`- Result: ${log.result}`)
  lines.push(`- Changes: ${log.changes.length} · Restored: ${log.restored.length}`, '')

  lines.push('## Version changes', '')
  if (log.changes.length === 0) lines.push('_None._', '')
  else for (const c of log.changes) lines.push(`- ${renderChange(c)}`)
  if (log.changes.length > 0) lines.push('')

  lines.push('## Restored manual edits', '')
  if (log.restored.length === 0) lines.push('_None._', '')
  else for (const c of log.restored) lines.push(`- ${renderChange(c)}`)
  if (log.restored.length > 0) lines.push('')

  lines.push('## Capability outcomes', '')
  if (log.outcomes.length === 0) lines.push('_None._', '')
  else for (const o of log.outcomes) lines.push(`- ${o.kind}: ${o.subject}`)
  lines.push('')

  lines.push('## Recorded limits', '')
  for (const c of log.capabilityChecks) lines.push(`- ${c.check} (${c.subject}): required ${c.required}, limit ${c.limit} — ${c.ok ? 'ok' : 'FAIL'}`)
  lines.push('')

  lines.push('## Digests', '')
  lines.push(`- manifest: ${log.digests.manifest}`)
  lines.push(`- previousManifest: ${log.digests.previousManifest ?? '(none)'}`)
  lines.push(`- snapshotBefore: ${log.digests.snapshotBefore}`)
  lines.push(`- snapshotAfter: ${log.digests.snapshotAfter ?? '(none)'}`)
  lines.push(`- plan: ${log.digests.plan}`)
  lines.push(`- divergenceAfter: ${renderCounts(log.divergenceAfter)}`)
  lines.push('')
  return lines.join('\n')
}

function renderChange(c: LogChange): string {
  const where = c.mode ? `${pathJoin(c.path)} (${c.mode})` : pathJoin(c.path)
  const from = c.from ? ` from ${pathJoin(c.from)}` : ''
  return `${c.op} ${c.collection}/${where}${from} [${c.cause}${c.breaking ? ', breaking' : ''}]`
}

function renderCounts(counts: DivergenceCounts): string {
  return (Object.keys(counts) as (keyof DivergenceCounts)[]).sort().map((k) => `${k}=${counts[k]}`).join(' ')
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
