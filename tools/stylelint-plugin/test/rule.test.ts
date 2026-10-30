import { describe, it, expect, beforeAll } from 'vitest'
import stylelint from 'stylelint'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import designTokens, { ruleName } from '../src/design-tokens.ts'

const PKG = join(import.meta.dirname, '../../../packages/tokens')
const manifestPath = join(PKG, 'dist/meta/tokens.manifest.json')

async function lintCodes(code: string): Promise<string[]> {
  const res = await stylelint.lint({
    code,
    config: { plugins: [designTokens as any], rules: { [ruleName]: [true, { manifestPath }] } },
  })
  const warnings = res.results[0]?.warnings ?? []
  return warnings.map((w) => w.text.split(':')[0]!.trim())
}

describe('patods/design-tokens', () => {
  beforeAll(() => {
    // ensure the manifest is generated
    execFileSync('node', [join(PKG, '../../tools/tokens-build/src/cli.ts'), 'build'], { cwd: PKG, stdio: 'pipe' })
  })

  it('valid usage of semantic tokens generates no warning', async () => {
    expect(
      await lintCodes('.x { color: var(--patods-color-fg-default); background-color: var(--patods-color-bg-surface); }'),
    ).toEqual([])
  })

  it('primitive token', async () => {
    expect(await lintCodes('.x { color: var(--patods-color-blue-500); }')).toContain('primitive-token')
  })

  it('brand-mode-source token', async () => {
    expect(await lintCodes('.x { color: var(--patods-brand-color-bg-surface-light); }')).toContain('brand-mode-source-token')
  })

  it('unknown token', async () => {
    expect(await lintCodes('.x { color: var(--patods-color-nope); }')).toContain('unknown-token')
  })

  it('literal value', async () => {
    expect(await lintCodes('.x { color: #fff; }')).toContain('literal-value')
    expect(await lintCodes('.x { height: 10px; }')).toContain('literal-value')
  })

  it('literal fallback in var()', async () => {
    expect(await lintCodes('.x { color: var(--patods-color-fg-default, #fff); }')).toContain('var-fallback-literal')
  })

  it('custom property definition', async () => {
    expect(await lintCodes('.x { --patods-color-x: red; }')).toContain('token-definition')
  })

  it('keywords and valid var() do not trigger literal', async () => {
    expect(await lintCodes('.x { color: inherit; background-color: transparent; gap: var(--patods-space-inline-sm); }')).toEqual([])
  })
})
