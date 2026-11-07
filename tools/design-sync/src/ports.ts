// Sync ports and shared shapes (design-sync.md §4, §5, §7, §8). Type-only module: it declares the
// contract surface and holds no runtime value. By construction no port carries data from the design
// tool back into the repository (G-1 → FR-025, US6 scenario 6): the only reads expose tool state for
// diffing in memory; nothing here writes to disk or returns a repository-destined artifact.

// ── §4.1 Support types ──────────────────────────────────────────────────────

export type TokenPath = readonly string[]
export type TokenKey = string // segments joined by '.'
export type ContextId = string // brand id, 'light' | 'dark', or '*'
export type NativeRef = string // opaque tool identifier
export type Sha256 = `sha256:${string}`
export type IsoDate = string // YYYY-MM-DD, from the injected clock
export type Fingerprint = Sha256

export type CollectionId = 'primitive' | 'brand' | 'mode' | 'semantic' | 'component'

export type SyncValueType =
  | 'color' | 'dimension' | 'number' | 'fontFamily' | 'fontWeight' | 'duration'
  | 'cubicBezier' | 'strokeStyle' | 'border' | 'shadow' | 'typography' | 'transition'

export type LiteralValue =
  | { readonly hex: string; readonly alpha: number }
  | { readonly value: number; readonly unit: 'px' | 'rem' | 'ms' | 's' }
  | { readonly value: number }
  | { readonly value: string | readonly string[] }
  | { readonly value: readonly [number, number, number, number] }
  | { readonly composite: Readonly<Record<string, unknown>> }

export type SyncValue = { readonly literal: LiteralValue } | { readonly alias: TokenPath }

/** A snapshot value that the adapter could not normalize back into a `SyncValue`. */
export type UnresolvedValue = { readonly unresolved: string }

export interface ReleaseRef {
  readonly version: string
  readonly changelogExcerpt: string // excerpt from the version's changelog (GOV-03)
}

export type SyncErrorCode =
  | 'USAGE' | 'CONFIG_INVALID' | 'MANIFEST_INVALID' | 'CAPABILITY_EXCEEDED'
  | 'ALIASES_UNSUPPORTED' | 'READ_UNAVAILABLE' | 'MASS_DELETE_BLOCKED' | 'OUT_DIR_FORBIDDEN'
  | 'ACCESS_DENIED' | 'CREDENTIAL_MISSING' | 'CREDENTIAL_EXPIRED' | 'RATE_LIMITED'
  | 'TOOL_UNAVAILABLE' | 'VERIFY_MISMATCH' | 'INTERNAL'

export type SyncPhase =
  | 'config' | 'access' | 'snapshot' | 'plan' | 'apply' | 'verify' | 'publish' | 'report'

export interface SyncError {
  readonly code: SyncErrorCode
  readonly phase: SyncPhase
  readonly message: string // stable, no secret or raw response
  readonly completedOperations: number | null // on failure during apply
}

// ── §4.2 DesignToolPort ─────────────────────────────────────────────────────

export type WriteCapability = 'api' | 'agent-mcp' | 'manual'
export type ReadCapability = 'api' | 'agent-mcp' | 'manual'
export type PublishCapability = 'api' | 'manual' | 'none'

export interface DesignToolCapabilities {
  readonly toolId: string // adapter id, e.g. 'memory'
  readonly maxModesPerAxis: number // mode limit per collection of the contracted plan
  readonly maxVariablesPerCollection: number | null
  readonly axisScope: 'frame' | 'file' // mode switch per frame or only on the whole file
  readonly aliases: boolean // a variable can point to another variable
  readonly valueTypes: readonly SyncValueType[] // types representable as a variable
  readonly separator: '/' | '.' // segment separator (TOK-04 convention)
  readonly keyField: 'description-suffix' | 'code-syntax' | 'native-metadata'
  readonly hiddenVariables: boolean
  readonly codeSyntax: boolean
  readonly localPublishedSplit: boolean // distinguishes local and published state
  readonly maxAtomicBatchBytes: number | null // maximum size of an atomic batch
  readonly read: ReadCapability
  readonly write: WriteCapability
  readonly publish: PublishCapability
}

export interface AccessProblem {
  readonly code: 'ACCESS_DENIED' | 'CREDENTIAL_MISSING' | 'CREDENTIAL_EXPIRED'
    | 'SCOPE_MISSING' | 'PLAN_INSUFFICIENT' | 'TOOL_UNAVAILABLE'
  readonly message: string
}

export interface AccessReport {
  readonly ok: boolean
  readonly problems: readonly AccessProblem[]
  readonly scopes: readonly string[]
  readonly plan: string | null // plan or seat, when the tool reports it
  readonly credentialExpiresOn: IsoDate | null
}

export interface SnapshotMode {
  readonly ref: NativeRef
  readonly name: string
}

export interface SnapshotCollection {
  readonly ref: NativeRef
  readonly name: string
  readonly modes: readonly SnapshotMode[]
}

export interface SnapshotVariable {
  readonly ref: NativeRef
  readonly collectionRef: NativeRef
  readonly path: TokenPath // name split by the separator, with no other normalization
  readonly type: SyncValueType | 'unknown'
  readonly key: TokenKey | null // read from keyField; null if absent
  readonly description: string // without the key marker
  readonly hidden: boolean
  readonly values: Readonly<Record<string, SyncValue | UnresolvedValue>>
}

export interface ToolSnapshot {
  readonly tool: string // '<adapterId>:<targetId>'
  readonly collections: readonly SnapshotCollection[]
  readonly variables: readonly SnapshotVariable[]
  readonly published: { readonly variables: readonly SnapshotVariable[] } | null
}

export interface ApplyResult {
  readonly status: 'applied' | 'dry-run' | 'partial' | 'manual'
  readonly completedOperations: number
  readonly failedAtSeq: number | null
  readonly error: SyncError | null
}

export type PublishOutcome =
  | { readonly status: 'published' }
  | { readonly status: 'manual'; readonly instructions: string }
  | { readonly status: 'none' }

export interface DesignToolPort {
  capabilities(): DesignToolCapabilities
  checkAccess(): Promise<AccessReport>
  readSnapshot(): Promise<ToolSnapshot>
  apply(plan: SyncPlan, options: { readonly dryRun: boolean }): Promise<ApplyResult>
  requestPublish(release: ReleaseRef): Promise<PublishOutcome>
}

// ── §4.3 TrackerPort ────────────────────────────────────────────────────────

export interface RoleRef {
  readonly kind: 'team'
  readonly slug: string // e.g. '@<org>/<sync-owner-team>'
  readonly source: 'CODEOWNERS'
}

export type TrackedItemKind =
  | 'divergence' | 'manual-write' | 'manual-publish' | 'capability' | 'credential' | 'failure'

export interface TrackedItem {
  readonly fingerprint: Fingerprint
  readonly kind: TrackedItemKind
  readonly title: string
  readonly body: string // deterministic Markdown
  readonly owner: RoleRef
  readonly due: IsoDate // detection + config SLA
  readonly labels: readonly string[]
}

export interface OpenItem {
  readonly fingerprint: Fingerprint
  readonly kind: TrackedItemKind
  readonly detectedOn: IsoDate
  readonly due: IsoDate
  readonly url: string | null
}

export type UpsertResult = { readonly action: 'created' | 'updated' | 'reopened' | 'unchanged' }
export type ResolveResult = { readonly action: 'resolved' | 'not-found' }

export interface TrackerPort {
  upsert(item: TrackedItem): Promise<UpsertResult>
  resolve(fingerprint: Fingerprint, note: string): Promise<ResolveResult>
  listOpen(filter?: { readonly kinds?: readonly TrackedItemKind[] }): Promise<readonly OpenItem[]>
}

// ── §4.4 AlertPort ──────────────────────────────────────────────────────────

export interface SyncAlert {
  readonly fingerprint: Fingerprint // sha256('failure|' + code + '||' + tool)
  readonly severity: 'error' | 'warning'
  readonly error: SyncError
  readonly owner: RoleRef
  readonly tool: string
  readonly runUrl: string | null // from the envelope; never in the canonical content
}

export interface AlertPort {
  raise(alert: SyncAlert): Promise<void>
}

// ── §5 Plan and diff ────────────────────────────────────────────────────────

export type OperationCause = 'release' | 'manual' | 'initial' | 'unclassified'

export type PlanPhase =
  | 'collections' | 'modes' | 'renames' | 'recreates' | 'creates' | 'metadata' | 'values' | 'deletes'

export interface PlanOperationBase {
  readonly seq: number
  readonly phase: PlanPhase
  readonly collection: CollectionId
  readonly cause: OperationCause
  readonly breaking: boolean // breaks layer links in the target
}

export type MetadataField = 'key' | 'description' | 'codeSyntax' | 'hidden'

export type PlanOperation = PlanOperationBase & (
  | { readonly op: 'createCollection'; readonly modes: readonly ContextId[] }
  | { readonly op: 'createMode' | 'deleteMode'; readonly mode: ContextId; readonly ref?: NativeRef }
  | { readonly op: 'renameMode'; readonly ref: NativeRef; readonly from: string; readonly to: ContextId }
  | { readonly op: 'renameVariable'; readonly ref: NativeRef; readonly key: TokenKey
      readonly from: TokenPath; readonly to: TokenPath }
  | { readonly op: 'recreateVariable'; readonly ref: NativeRef; readonly key: TokenKey
      readonly path: TokenPath; readonly reason: 'type' | 'collection'; readonly type: SyncValueType }
  | { readonly op: 'createVariable'; readonly key: TokenKey; readonly path: TokenPath
      readonly type: SyncValueType }
  | { readonly op: 'setMetadata'; readonly key: TokenKey; readonly path: TokenPath
      readonly fields: readonly MetadataField[] }
  | { readonly op: 'setValue'; readonly key: TokenKey; readonly path: TokenPath
      readonly mode: ContextId; readonly value: SyncValue; readonly before: SyncValue | null }
  | { readonly op: 'deleteVariable'; readonly ref: NativeRef; readonly key: TokenKey | null
      readonly path: TokenPath }
)

export type CapabilityCheckName =
  | 'maxModesPerAxis' | 'maxVariablesPerCollection' | 'aliases' | 'axisScope'
  | 'read' | 'write' | 'publish' | 'valueTypes'

export interface CapabilityCheck {
  readonly check: CapabilityCheckName
  readonly subject: string // e.g. 'brand', 'mode', 'shadow'
  readonly required: number | string
  readonly limit: number | string
  readonly ok: boolean
}

export type CapabilityOutcomeKind =
  | 'manual-write' | 'manual-publish' | 'capability' | 'unsupported-type'

export interface CapabilityOutcome {
  readonly kind: CapabilityOutcomeKind
  readonly subject: string
  readonly fingerprint: Fingerprint
}

export type PlanSummaryKey =
  | 'create' | 'rename' | 'recreate' | 'update' | 'delete' | 'unchanged' | 'unsupported'

export interface SyncPlan {
  readonly format: 'patods.sync-plan'
  readonly version: 1
  readonly tool: string
  readonly source: { readonly package: string; readonly version: string }
  readonly previous: { readonly version: string } | null
  readonly digests: {
    readonly manifest: Sha256
    readonly previousManifest: Sha256 | null
    readonly snapshot: Sha256
  }
  readonly capabilityChecks: readonly CapabilityCheck[]
  readonly summary: Readonly<Record<PlanSummaryKey, number>>
  readonly operations: readonly PlanOperation[]
  readonly outcomes: readonly CapabilityOutcome[]
}

// ── §6/§7 Divergence classification and log ─────────────────────────────────

export type DivergenceClass = OperationCause // release | manual | initial | unclassified

export type DivergenceKind = 'missing' | 'extra' | 'value' | 'alias' | 'name' | 'hierarchy' | 'type'

export type DivergenceField =
  | 'value' | 'description' | 'key' | 'codeSyntax' | 'hidden' | 'collection' | 'modes'

export interface DivergenceItem {
  readonly fingerprint: Fingerprint
  readonly kind: DivergenceKind
  readonly field: DivergenceField
  readonly collection: CollectionId
  readonly path: TokenPath
  readonly mode: ContextId | null
  readonly tool: string
  readonly expected: SyncValue | null
  readonly actual: SyncValue | UnresolvedValue | null
  readonly classification: DivergenceClass
  readonly sourceVersion: string
}

export type DivergenceCounts = Readonly<Record<DivergenceKind, number>>

export type SyncResultState = 'planned' | 'dry-run' | 'verified' | 'failed'

export interface LogChange {
  readonly op: PlanOperation['op']
  readonly collection: CollectionId
  readonly path: TokenPath
  readonly mode?: ContextId
  readonly from?: TokenPath
  readonly before?: SyncValue | null
  readonly after?: SyncValue | null
  readonly cause: OperationCause
  readonly breaking: boolean
}

export interface SyncLog {
  readonly format: 'patods.sync-log'
  readonly version: 1
  readonly command: 'plan' | 'apply' | 'detect'
  readonly tool: string
  readonly source: { readonly package: string; readonly version: string; readonly changelog: string }
  readonly previous: { readonly version: string } | null
  readonly result: SyncResultState
  readonly digests: {
    readonly manifest: Sha256
    readonly previousManifest: Sha256 | null
    readonly snapshotBefore: Sha256
    readonly snapshotAfter: Sha256 | null
    readonly plan: Sha256
  }
  readonly capabilityChecks: readonly CapabilityCheck[]
  readonly changes: readonly LogChange[]
  readonly restored: readonly LogChange[]
  readonly outcomes: readonly CapabilityOutcome[]
  readonly divergenceAfter: DivergenceCounts
  readonly error: SyncError | null
}

export interface SyncEnvelope {
  readonly format: 'patods.sync-envelope'
  readonly version: 1
  readonly ranOn: string // ISO datetime, non-deterministic
  readonly trigger: 'release' | 'schedule' | 'manual' | 'pr'
  readonly runUrl: string | null
  readonly logSha256: Sha256
  readonly toolErrorDetail: string | null // raw, no secret
}

// ── §15 Versioned configuration ─────────────────────────────────────────────

export interface SyncConfig {
  readonly version: number
  readonly tool: { readonly adapter: string; readonly target: string }
  readonly managedCollections: readonly CollectionId[]
  readonly ownerPath: string
  readonly slaDays: {
    readonly divergence: number
    readonly manualWrite: number
    readonly manualPublish: number
    readonly capability: number
  }
  readonly credentialExpiryWarnDays: number
  readonly retry: { readonly maxRetries: number; readonly maxRetryAfterSeconds: number }
  readonly maxDeleteFraction: number
}
