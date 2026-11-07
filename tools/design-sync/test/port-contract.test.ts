// Runs the DesignToolPort contract suite (C-01..C-18) against the in-memory fake on every PR (QA-02,
// design-sync.md §13). The same suite runs against the real adapter on a sandbox once a tool is chosen.
import { describeDesignToolPortContract } from './port-contract.ts'
import { InMemoryDesignTool } from '../src/adapters/memory.ts'
import { sampleConfig, sampleManifest } from './fixtures.ts'

describeDesignToolPortContract('InMemoryDesignTool', () => ({
  manifest: sampleManifest(),
  config: sampleConfig,
  newTool: (options) => new InMemoryDesignTool(options),
}))
