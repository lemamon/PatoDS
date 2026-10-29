// Pure, deterministic sync core (DSN-01..DSN-05, DSN-11). Operates on an abstract desired state and
// a tool snapshot; it knows no concrete tool.
import { createHash } from 'node:crypto'
import type { DesignToolPort, PlanOp, ToolVariable } from './ports.ts'

export interface DesiredVar {
  name: string
  value: string
  key: string
}

/** Desired state from the build-generated sync-manifest.json (build-manifests.md §3). */
export function readDesired(syncManifest: any): DesiredVar[] {
  return (syncManifest.variables ?? [])
    .map((v: any) => {
      const name = Array.isArray(v.path) ? v.path.join('/') : String(v.path)
      return { name, value: `${v.type}:${v.axis}`, key: name }
    })
    .sort((a: DesiredVar, b: DesiredVar) => a.name.localeCompare(b.name))
}

/** Idempotent plan: create -> update -> rename -> delete, only on managed variables. */
export function diff(desired: DesiredVar[], snapshot: ToolVariable[]): PlanOp[] {
  const byName = new Map(snapshot.map((v) => [v.name, v]))
  const byKey = new Map(snapshot.filter((v) => v.key).map((v) => [v.key!, v]))
  const desiredNames = new Set(desired.map((d) => d.name))
  const ops: PlanOp[] = []

  for (const d of desired) {
    const current = byName.get(d.name)
    if (current) {
      if (current.value !== d.value) ops.push({ op: 'update', name: d.name, value: d.value, key: d.key })
    } else {
      const renamed = byKey.get(d.key)
      if (renamed && !desiredNames.has(renamed.name)) {
        ops.push({ op: 'rename', from: renamed.name, name: d.name, key: d.key })
        if (renamed.value !== d.value) ops.push({ op: 'update', name: d.name, value: d.value, key: d.key })
      } else {
        ops.push({ op: 'create', name: d.name, value: d.value, key: d.key })
      }
    }
  }
  // deletes: leftover managed variables (extra manual edits)
  const keptByRename = new Set(ops.filter((o) => o.op === 'rename').map((o: any) => o.from))
  for (const v of snapshot) {
    if (!desiredNames.has(v.name) && !keptByRename.has(v.name)) ops.push({ op: 'delete', name: v.name })
  }
  return ops.sort((a, b) => order(a) - order(b) || name(a).localeCompare(name(b)))
}

function order(o: PlanOp): number {
  return { create: 0, update: 1, rename: 2, delete: 3 }[o.op]
}
function name(o: PlanOp): string {
  return 'name' in o ? o.name : ''
}

export interface Divergence {
  fingerprint: string
  kind: string
  name: string
}

export function fingerprint(kind: string, name: string, tool = 'memory'): string {
  return createHash('sha256').update(`${kind}|${name}|${tool}`).digest('hex').slice(0, 16)
}

/** Divergences (DSN-11): each plan op becomes a deduplicated trackable item. */
export function detect(plan: PlanOp[]): Divergence[] {
  return plan.map((o) => {
    const kind = o.op === 'update' ? 'value' : o.op
    const n = 'name' in o ? o.name : ''
    return { fingerprint: fingerprint(kind, n), kind, name: n }
  })
}

export interface SyncResult {
  state: 'planned' | 'dry-run' | 'verified' | 'failed'
  plan: PlanOp[]
  restored: string[]
  error?: string
}

/** Applies the plan and verifies by re-reading the snapshot (final diff must be empty). */
export async function sync(port: DesignToolPort, desired: DesiredVar[], opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const before = await port.readSnapshot()
  const plan = diff(desired, before)
  const restored = plan.filter((o) => o.op === 'update' || o.op === 'rename').map((o: any) => o.name)
  if (opts.dryRun) return { state: 'dry-run', plan, restored }
  try {
    await port.apply(plan)
  } catch (err) {
    return { state: 'failed', plan, restored, error: (err as Error).message }
  }
  const after = await port.readSnapshot()
  const residual = diff(desired, after)
  if (residual.length > 0) return { state: 'failed', plan, restored, error: 'verificação falhou: diff não vazio após aplicar' }
  return { state: 'verified', plan, restored }
}
