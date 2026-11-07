// Typed core error. Carries the CLI/exit taxonomy (design-sync.md §4.1, tools-cli.md §1.2) so the CLI
// and the orchestrator can map a failure to an exit code and to an AlertPort.raise call (G-4).
import type { SyncError, SyncErrorCode, SyncPhase } from '../ports.ts'

export class SyncCoreError extends Error {
  readonly code: SyncErrorCode
  readonly phase: SyncPhase
  readonly completedOperations: number | null

  constructor(code: SyncErrorCode, phase: SyncPhase, message: string, completedOperations: number | null = null) {
    super(message)
    this.name = 'SyncCoreError'
    this.code = code
    this.phase = phase
    this.completedOperations = completedOperations
  }

  toSyncError(): SyncError {
    return { code: this.code, phase: this.phase, message: this.message, completedOperations: this.completedOperations }
  }
}

/** Exit code for a terminal error (tools-cli.md §1.2). Violations (plan non-empty) are code 1 elsewhere. */
export function exitCodeFor(code: SyncErrorCode): number {
  switch (code) {
    case 'USAGE':
    case 'CONFIG_INVALID':
    case 'MANIFEST_INVALID':
    case 'CAPABILITY_EXCEEDED':
    case 'ALIASES_UNSUPPORTED':
    case 'READ_UNAVAILABLE':
    case 'MASS_DELETE_BLOCKED':
    case 'OUT_DIR_FORBIDDEN':
      return 2
    case 'ACCESS_DENIED':
    case 'CREDENTIAL_MISSING':
    case 'CREDENTIAL_EXPIRED':
    case 'RATE_LIMITED':
    case 'TOOL_UNAVAILABLE':
      return 4
    case 'VERIFY_MISMATCH':
      return 5
    case 'INTERNAL':
      return 3
  }
}
