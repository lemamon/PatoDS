// Test subpath of @patods/design-sync (design-sync.md §12): the in-memory fakes used by the port
// contract suite. describeDesignToolPortContract itself lives in test/port-contract.ts (it depends on
// the test runner) and runs against these fakes on every PR, and against a real adapter once chosen.
export {
  InMemoryDesignTool, InMemoryTracker, InMemoryAlert, FakeClock, FaultPlan,
  DEFAULT_CAPABILITIES, DEFAULT_COLLECTION_NAMES,
} from './adapters/memory.ts'
export type { InMemoryDesignToolOptions } from './adapters/memory.ts'
