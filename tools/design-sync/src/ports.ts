// Sync ports (ADR-14, design-sync.md). No operation reads from the tool back into the repository
// (guarantees FR-025 and US6 scenario 6 by construction).

export interface ToolVariable {
  name: string
  value: string
  /** token key stored in the tool, used to detect a manual rename. */
  key?: string
}

export interface Capabilities {
  maxModesPerAxis: number
  axisScope: 'frame' | 'file'
  write: 'api' | 'agent-mcp' | 'manual'
  publish: 'api' | 'manual' | 'none'
}

export type PlanOp =
  | { op: 'create'; name: string; value: string; key: string }
  | { op: 'update'; name: string; value: string; key: string }
  | { op: 'rename'; from: string; name: string; key: string }
  | { op: 'delete'; name: string }

export interface DesignToolPort {
  capabilities(): Capabilities
  checkAccess(): Promise<{ ok: boolean; reason?: string }>
  readSnapshot(): Promise<ToolVariable[]>
  apply(plan: PlanOp[], opts?: { dryRun?: boolean }): Promise<void>
  requestPublish(release: string): Promise<'published' | { manual: string }>
}

export interface TrackedItem {
  fingerprint: string
  title: string
  owner: string
  due: string
}

export interface TrackerPort {
  upsert(item: TrackedItem): Promise<void>
  resolve(fingerprint: string, note: string): Promise<void>
  listOpen(): Promise<TrackedItem[]>
}

export interface AlertPort {
  raise(a: { severity: string; message: string; owner: string }): Promise<void>
}
