// Divergence classification (design-sync.md §6). For a difference between the real (snapshot) and the
// desired-current element, compare the real with the desired-previous to decide whether the difference
// is a version change (release), a manual edit in the target (manual), the first sync (initial), or
// unclassifiable because no previous manifest was supplied (unclassified).
import type { OperationCause, SyncValue, UnresolvedValue } from '../ports.ts'
import { valueEquals } from './snapshot.ts'

export interface ClassifyInput {
  /** Current real value/presence of the element (null = absent in the tool). */
  readonly real: SyncValue | UnresolvedValue | null
  /** Desired value/presence in the previous version (null = absent); undefined = no previous supplied. */
  readonly desiredPrevious: SyncValue | null | undefined
  /** No previous version exists for this target (the very first sync). */
  readonly firstSync: boolean
}

/**
 * Classify one element-level difference. The caller only invokes this for genuine differences
 * (real ≠ desiredCurrent); the "no difference" row of the table never reaches here.
 */
export function classifyDifference(input: ClassifyInput): OperationCause {
  if (input.firstSync) return 'initial'
  if (input.desiredPrevious === undefined) return 'unclassified'
  // Real equals the previous desired state ⇒ the version moved it ⇒ release.
  return valueEquals(input.real, input.desiredPrevious) ? 'release' : 'manual'
}

/** Whether a classified difference is restored (manual / unclassified) rather than a release change. */
export function isRestored(cause: OperationCause): boolean {
  return cause === 'manual' || cause === 'unclassified'
}
