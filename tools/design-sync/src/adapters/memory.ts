// In-memory fakes (design-sync.md §12). Never touch the repository or the network; they model a design
// tool, an item tracker, an alert sink and a clock so the contract suite and the core run deterministically
// on every PR (QA-02). NativeRefs come from a counter; Retry-After waits advance the FakeClock.
import type {
  AccessReport, AlertPort, ApplyResult, CollectionId, ContextId, DesignToolCapabilities, DesignToolPort,
  Fingerprint, IsoDate, OpenItem, PlanOperation, PublishOutcome, ReleaseRef, ResolveResult, SnapshotVariable,
  SyncAlert, SyncError, SyncErrorCode, SyncValue, SyncValueType, ToolSnapshot, TrackedItem, TrackedItemKind,
  TrackerPort, UnresolvedValue, UpsertResult,
} from '../ports.ts'
import type { Clock } from '../core/sync.ts'

const ALL_TYPES: readonly SyncValueType[] = [
  'color', 'dimension', 'number', 'fontFamily', 'fontWeight', 'duration',
  'cubicBezier', 'strokeStyle', 'border', 'shadow', 'typography', 'transition',
]

/** Convention names (design-sync.md §3) mapping each managed collection id to its tool name. */
export const DEFAULT_COLLECTION_NAMES: Readonly<Record<CollectionId, string>> = {
  primitive: 'Primitives',
  brand: 'Brand',
  mode: 'Mode',
  semantic: 'Invariant semantics',
  component: 'Components',
}

export const DEFAULT_CAPABILITIES: DesignToolCapabilities = {
  toolId: 'memory',
  maxModesPerAxis: 40,
  maxVariablesPerCollection: null,
  axisScope: 'frame',
  aliases: true,
  valueTypes: ALL_TYPES,
  separator: '/',
  keyField: 'description-suffix',
  hiddenVariables: true,
  codeSyntax: true,
  localPublishedSplit: true,
  maxAtomicBatchBytes: null,
  read: 'api',
  write: 'api',
  publish: 'manual',
}

export class FakeClock implements Clock {
  private t: number
  constructor(initial = '2026-11-07T00:00:00.000Z') {
    this.t = new Date(initial).getTime()
  }
  now(): Date {
    return new Date(this.t)
  }
  advanceSeconds(seconds: number): void {
    this.t += seconds * 1000
  }
}

interface MemMode {
  ref: string
  name: string
}
interface MemCollection {
  ref: string
  name: string
  managedId: CollectionId | null
  modes: Map<string, MemMode>
}
interface MemVariable {
  ref: string
  collectionRef: string
  path: string[]
  type: SyncValueType | 'unknown'
  key: string | null
  description: string
  hidden: boolean
  values: Map<string, SyncValue | UnresolvedValue>
}

export class FaultPlan {
  failAfter: { n: number; code: SyncErrorCode } | null = null
  pendingRateLimits = 0
  retryAfterSeconds = 0
  isForbidden = false
  credentialExpired = false
  pendingUnavailable = 0

  failAfterOperations(n: number, code: SyncErrorCode = 'INTERNAL'): void {
    this.failAfter = { n, code }
  }
  rateLimit(times: number, retryAfterSeconds: number): void {
    this.pendingRateLimits = times
    this.retryAfterSeconds = retryAfterSeconds
  }
  forbidden(): void {
    this.isForbidden = true
  }
  expireCredential(): void {
    this.credentialExpired = true
  }
  unavailable(times: number): void {
    this.pendingUnavailable = times
  }
  reset(): void {
    this.failAfter = null
    this.pendingRateLimits = 0
    this.retryAfterSeconds = 0
    this.isForbidden = false
    this.credentialExpired = false
    this.pendingUnavailable = 0
  }
}

export interface InMemoryDesignToolOptions {
  readonly capabilities?: Partial<DesignToolCapabilities>
  readonly initial?: ToolSnapshot
  readonly clock?: FakeClock
  readonly target?: string
  readonly collectionNames?: Partial<Record<CollectionId, string>>
  readonly credentialExpiresOn?: IsoDate | null
  readonly retry?: { readonly maxRetries: number; readonly maxRetryAfterSeconds: number }
}

export class InMemoryDesignTool implements DesignToolPort {
  readonly faults = new FaultPlan()
  private readonly caps: DesignToolCapabilities
  private readonly clock: FakeClock
  private readonly target: string
  private readonly names: Record<CollectionId, string>
  private readonly credentialExpiresOn: IsoDate | null
  private readonly maxRetries: number
  private readonly maxRetryAfterSeconds: number

  private collections: MemCollection[] = []
  private variables: MemVariable[] = []
  private published: MemVariable[] | null = null
  private counter = 0
  private opsLog: PlanOperation[] = []

  constructor(options: InMemoryDesignToolOptions = {}) {
    this.caps = { ...DEFAULT_CAPABILITIES, ...options.capabilities }
    this.clock = options.clock ?? new FakeClock()
    this.target = options.target ?? 'sandbox'
    this.names = { ...DEFAULT_COLLECTION_NAMES, ...options.collectionNames }
    this.credentialExpiresOn = options.credentialExpiresOn ?? null
    this.maxRetries = options.retry?.maxRetries ?? 5
    this.maxRetryAfterSeconds = options.retry?.maxRetryAfterSeconds ?? 60
    if (options.initial) this.seedSync(options.initial)
  }

  private get toolId(): string {
    return `${this.caps.toolId}:${this.target}`
  }
  private nextRef(prefix: string): string {
    this.counter += 1
    return `${prefix}${this.counter}`
  }

  capabilities(): DesignToolCapabilities {
    return this.caps
  }

  async checkAccess(): Promise<AccessReport> {
    if (this.faults.credentialExpired) {
      return { ok: false, problems: [{ code: 'CREDENTIAL_EXPIRED', message: 'the tool credential has expired' }], scopes: [], plan: null, credentialExpiresOn: '2000-01-01' }
    }
    if (this.faults.isForbidden) {
      return { ok: false, problems: [{ code: 'ACCESS_DENIED', message: 'the credential lacks write scope on the library file' }], scopes: [], plan: null, credentialExpiresOn: this.credentialExpiresOn }
    }
    return { ok: true, problems: [], scopes: ['file_variables:read', 'file_variables:write'], plan: 'enterprise', credentialExpiresOn: this.credentialExpiresOn }
  }

  async readSnapshot(): Promise<ToolSnapshot> {
    const collections = [...this.collections]
      .sort((a, b) => cmp(a.name, b.name))
      .map((c) => ({ ref: c.ref, name: c.name, modes: [...c.modes.values()].sort((m, n) => cmp(m.name, n.name)).map((m) => ({ ref: m.ref, name: m.name })) }))
    return {
      tool: this.toolId,
      collections,
      variables: this.snapshotVariables(this.variables),
      published: this.published ? { variables: this.snapshotVariables(this.published) } : null,
    }
  }

  private snapshotVariables(vars: readonly MemVariable[]): SnapshotVariable[] {
    return [...vars]
      .sort((a, b) => cmp(colKey(this.collections, a.collectionRef), colKey(this.collections, b.collectionRef)) || cmp(a.path.join('.'), b.path.join('.')))
      .map((v) => ({
        ref: v.ref,
        collectionRef: v.collectionRef,
        path: [...v.path],
        type: v.type,
        key: v.key,
        description: v.description,
        hidden: v.hidden,
        values: Object.fromEntries([...v.values.entries()].sort((a, b) => cmp(a[0], b[0]))),
      }))
  }

  async apply(plan: { operations: readonly PlanOperation[] }, options: { dryRun: boolean }): Promise<ApplyResult> {
    if (options.dryRun) {
      this.opsLog = [...plan.operations]
      return { status: 'dry-run', completedOperations: 0, failedAtSeq: null, error: null }
    }
    const firstSeq = plan.operations[0]?.seq ?? null

    const whole = this.wholeRequestFault(firstSeq)
    if (whole) return whole
    const limited = this.applyRateLimit(firstSeq)
    if (limited) return limited

    this.opsLog = []
    let completed = 0
    for (const op of plan.operations) {
      if (this.faults.failAfter && completed >= this.faults.failAfter.n) {
        const error: SyncError = { code: this.faults.failAfter.code, phase: 'apply', message: `simulated failure after ${completed} operations`, completedOperations: completed }
        return { status: 'partial', completedOperations: completed, failedAtSeq: op.seq, error }
      }
      this.execute(op)
      this.opsLog.push(op)
      completed += 1
    }
    return { status: 'applied', completedOperations: completed, failedAtSeq: null, error: null }
  }

  private wholeRequestFault(firstSeq: number | null): ApplyResult | null {
    const fail = (code: SyncErrorCode, message: string): ApplyResult => ({
      status: 'partial', completedOperations: 0, failedAtSeq: firstSeq, error: { code, phase: 'apply', message, completedOperations: 0 },
    })
    if (this.faults.isForbidden) return fail('ACCESS_DENIED', 'tool returned 403 Forbidden')
    if (this.faults.credentialExpired) return fail('CREDENTIAL_EXPIRED', 'tool credential expired during apply')
    if (this.faults.pendingUnavailable > 0) {
      this.faults.pendingUnavailable -= 1
      return fail('TOOL_UNAVAILABLE', 'tool returned 503 / network error')
    }
    return null
  }

  private applyRateLimit(firstSeq: number | null): ApplyResult | null {
    let used = 0
    while (this.faults.pendingRateLimits > 0) {
      if (used >= this.maxRetries || this.faults.retryAfterSeconds > this.maxRetryAfterSeconds) {
        return { status: 'partial', completedOperations: 0, failedAtSeq: firstSeq, error: { code: 'RATE_LIMITED', phase: 'apply', message: `rate limit not cleared after ${used} retries`, completedOperations: 0 } }
      }
      this.clock.advanceSeconds(this.faults.retryAfterSeconds)
      this.faults.pendingRateLimits -= 1
      used += 1
    }
    return null
  }

  private execute(op: PlanOperation): void {
    switch (op.op) {
      case 'createCollection': {
        const name = this.names[op.collection]
        const modes = new Map<string, MemMode>()
        for (const m of op.modes) modes.set(m, { ref: this.nextRef('m'), name: m })
        this.collections.push({ ref: this.nextRef('c'), name, managedId: op.collection, modes })
        break
      }
      case 'createMode': {
        const coll = this.collectionOf(op.collection)
        if (coll && !coll.modes.has(op.mode)) coll.modes.set(op.mode, { ref: this.nextRef('m'), name: op.mode })
        break
      }
      case 'renameMode': {
        const coll = this.collectionOf(op.collection)
        const mode = coll && [...coll.modes.values()].find((m) => m.ref === op.ref)
        if (coll && mode) {
          coll.modes.delete(mode.name)
          mode.name = op.to
          coll.modes.set(op.to, mode)
        }
        break
      }
      case 'deleteMode': {
        const coll = this.collectionOf(op.collection)
        if (coll) coll.modes.delete(op.mode)
        break
      }
      case 'renameVariable': {
        const v = this.byRef(op.ref)
        if (v) v.path = [...op.to]
        break
      }
      case 'recreateVariable': {
        const old = this.byRef(op.ref)
        if (old) this.variables = this.variables.filter((x) => x.ref !== op.ref)
        const coll = this.collectionOf(op.collection)
        this.variables.push({ ref: this.nextRef('v'), collectionRef: coll?.ref ?? op.collection, path: [...op.path], type: op.type, key: op.key, description: old?.description ?? '', hidden: old?.hidden ?? false, values: new Map() })
        break
      }
      case 'createVariable': {
        const coll = this.collectionOf(op.collection) ?? this.ensureCollection(op.collection)
        this.variables.push({ ref: this.nextRef('v'), collectionRef: coll.ref, path: [...op.path], type: op.type, key: op.key, description: '', hidden: false, values: new Map() })
        break
      }
      case 'setMetadata': {
        const v = this.byKeyOrPath(op.key, op.path, op.collection)
        if (v && op.fields.includes('key')) v.key = op.key
        break
      }
      case 'setValue': {
        const v = this.byKeyOrPath(op.key, op.path, op.collection)
        if (v) v.values.set(op.mode, op.value)
        break
      }
      case 'deleteVariable': {
        this.variables = this.variables.filter((x) => x.ref !== op.ref)
        break
      }
    }
  }

  async requestPublish(_release: ReleaseRef): Promise<PublishOutcome> {
    void _release
    if (this.caps.publish === 'api') {
      this.published = this.variables.map((v) => ({ ...v, values: new Map(v.values) }))
      return { status: 'published' }
    }
    if (this.caps.publish === 'manual') return { status: 'manual', instructions: 'Publish the library in the tool UI.' }
    return { status: 'none' }
  }

  // ── Test helpers (design-sync.md §12) ─────────────────────────────────────

  seed(snapshot: ToolSnapshot): void {
    this.seedSync(snapshot)
  }
  private seedSync(snapshot: ToolSnapshot): void {
    this.collections = snapshot.collections.map((c) => ({
      ref: c.ref, name: c.name,
      managedId: managedIdOf(this.names, c.name),
      modes: new Map(c.modes.map((m) => [m.name, { ref: m.ref, name: m.name }])),
    }))
    this.variables = snapshot.variables.map((v) => ({
      ref: v.ref, collectionRef: v.collectionRef, path: [...v.path], type: v.type, key: v.key,
      description: v.description, hidden: v.hidden, values: new Map(Object.entries(v.values)),
    }))
    this.published = snapshot.published ? snapshot.published.variables.map((v) => ({ ref: v.ref, collectionRef: v.collectionRef, path: [...v.path], type: v.type, key: v.key, description: v.description, hidden: v.hidden, values: new Map(Object.entries(v.values)) })) : null
    this.counter = Math.max(0, ...this.allRefs().map(refNumber))
  }

  simulateManualEdit(path: readonly string[], mode: ContextId, value: SyncValue): void {
    const v = this.byPath(path)
    if (v) v.values.set(mode, value)
  }
  simulateRename(path: readonly string[], newPath: readonly string[]): void {
    const v = this.byPath(path)
    if (v) v.path = [...newPath]
  }
  simulateExtraVariable(collection: CollectionId, path: readonly string[], type: SyncValueType): void {
    const coll = this.collectionOf(collection) ?? this.ensureCollection(collection)
    this.variables.push({ ref: this.nextRef('v'), collectionRef: coll.ref, path: [...path], type, key: null, description: '', hidden: false, values: new Map() })
  }
  simulateDeleteVariable(path: readonly string[]): void {
    const v = this.byPath(path)
    if (v) this.variables = this.variables.filter((x) => x.ref !== v.ref)
  }
  simulateTypeChange(path: readonly string[], type: SyncValueType): void {
    const v = this.byPath(path)
    if (v) v.type = type
  }
  simulateModeRename(collection: CollectionId, from: ContextId, to: string): void {
    const coll = this.collectionOf(collection)
    const mode = coll?.modes.get(from)
    if (coll && mode) {
      coll.modes.delete(from)
      mode.name = to
      coll.modes.set(to, mode)
    }
  }
  simulatePublish(): void {
    this.published = this.variables.map((v) => ({ ...v, values: new Map(v.values) }))
  }

  /** Resolve a (brand, mode) pair by following the alias chain, as a real frame would (C-12). */
  resolve(path: readonly string[], brand: ContextId, mode: ContextId, depth = 0): SyncValue {
    if (depth > 64) throw new Error(`alias cycle at ${path.join('.')}`)
    const v = this.byPath(path)
    if (!v) throw new Error(`no variable at ${path.join('.')}`)
    const coll = this.collections.find((c) => c.ref === v.collectionRef)
    const active = coll?.modes.has(brand) ? brand : coll?.modes.has(mode) ? mode : '*'
    const value = v.values.get(active)
    if (!value || 'unresolved' in value) throw new Error(`unresolved value at ${path.join('.')} [${active}]`)
    if ('alias' in value) return this.resolve(value.alias, brand, mode, depth + 1)
    return value
  }

  operationsLog(): readonly PlanOperation[] {
    return this.opsLog
  }

  // ── internal lookups ──────────────────────────────────────────────────────

  private collectionOf(id: CollectionId): MemCollection | undefined {
    return this.collections.find((c) => c.managedId === id)
  }
  private ensureCollection(id: CollectionId): MemCollection {
    const coll: MemCollection = { ref: this.nextRef('c'), name: this.names[id], managedId: id, modes: new Map() }
    this.collections.push(coll)
    return coll
  }
  private byRef(ref: string): MemVariable | undefined {
    return this.variables.find((v) => v.ref === ref)
  }
  private byPath(path: readonly string[]): MemVariable | undefined {
    const key = path.join('.')
    return this.variables.find((v) => v.path.join('.') === key)
  }
  private byKeyOrPath(key: string, path: readonly string[], collection: CollectionId): MemVariable | undefined {
    const byKey = this.variables.find((v) => v.key === key)
    if (byKey) return byKey
    const coll = this.collectionOf(collection)
    const p = path.join('.')
    return this.variables.find((v) => v.collectionRef === coll?.ref && v.path.join('.') === p)
  }
  private allRefs(): string[] {
    return [
      ...this.collections.map((c) => c.ref),
      ...this.collections.flatMap((c) => [...c.modes.values()].map((m) => m.ref)),
      ...this.variables.map((v) => v.ref),
    ]
  }
}

function managedIdOf(names: Record<CollectionId, string>, name: string): CollectionId | null {
  const entry = (Object.entries(names) as [CollectionId, string][]).find(([, n]) => n === name)
  return entry ? entry[0] : null
}

function colKey(collections: readonly MemCollection[], ref: string): string {
  return collections.find((c) => c.ref === ref)?.name ?? ref
}

function refNumber(ref: string): number {
  const n = Number(ref.replace(/^[a-z]+/, ''))
  return Number.isFinite(n) ? n : 0
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ── InMemoryTracker / InMemoryAlert (design-sync.md §12) ───────────────────────

interface StoredItem {
  item: TrackedItem
  state: 'open' | 'resolved'
  detectedOn: IsoDate
  due: IsoDate
}

export class InMemoryTracker implements TrackerPort {
  private readonly items = new Map<Fingerprint, StoredItem>()
  private readonly clock: Clock
  constructor(clock: Clock = new FakeClock()) {
    this.clock = clock
  }

  async upsert(item: TrackedItem): Promise<UpsertResult> {
    const today = this.clock.now().toISOString().slice(0, 10)
    const existing = this.items.get(item.fingerprint)
    if (!existing) {
      this.items.set(item.fingerprint, { item, state: 'open', detectedOn: today, due: item.due })
      return { action: 'created' }
    }
    if (existing.state === 'resolved') {
      this.items.set(item.fingerprint, { item, state: 'open', detectedOn: today, due: item.due })
      return { action: 'reopened' }
    }
    const changed = existing.item.title !== item.title || existing.item.body !== item.body || existing.item.labels.join('\u0000') !== item.labels.join('\u0000')
    // Open item: update title/body/labels, preserve original detectedOn and due (§4.3).
    this.items.set(item.fingerprint, { item: { ...item, due: existing.due }, state: 'open', detectedOn: existing.detectedOn, due: existing.due })
    return { action: changed ? 'updated' : 'unchanged' }
  }

  async resolve(fingerprint: Fingerprint, _note: string): Promise<ResolveResult> {
    void _note
    const existing = this.items.get(fingerprint)
    if (!existing || existing.state === 'resolved') return { action: 'not-found' }
    existing.state = 'resolved'
    return { action: 'resolved' }
  }

  async listOpen(filter?: { readonly kinds?: readonly TrackedItemKind[] }): Promise<readonly OpenItem[]> {
    const kinds = filter?.kinds ? new Set(filter.kinds) : null
    return [...this.items.values()]
      .filter((s) => s.state === 'open' && (!kinds || kinds.has(s.item.kind)))
      .sort((a, b) => cmp(a.item.fingerprint, b.item.fingerprint))
      .map((s) => ({ fingerprint: s.item.fingerprint, kind: s.item.kind, detectedOn: s.detectedOn, due: s.due, url: null }))
  }
}

export class InMemoryAlert implements AlertPort {
  readonly raised: SyncAlert[] = []
  async raise(alert: SyncAlert): Promise<void> {
    this.raised.push(alert)
  }
}
