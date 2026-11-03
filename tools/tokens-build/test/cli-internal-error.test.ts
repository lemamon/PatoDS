import { describe, it, expect, vi } from 'vitest'
import { join } from 'node:path'

// Force runBuild to throw a generic (non-lint, non-config) error so the CLI's internal-error
// branch is exercised: an unexpected failure maps to exit code 3 (QA-02/SC-009, css-output.md §13).
vi.mock('../src/build.ts', async (orig) => {
  const actual = (await orig()) as object
  return { ...actual, runBuild: vi.fn().mockRejectedValue(new Error('boom')) }
})

const SRC = join(import.meta.dirname, '../../../packages/tokens/src')

describe('build exit code 3 (internal error)', () => {
  it('maps an unexpected runBuild failure to exit 3', async () => {
    const { main } = await import('../src/cli.ts')
    expect(await main(['build', '--src', SRC, '--json'])).toBe(3)
  })
})
