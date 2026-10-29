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

  it('uso válido de tokens semânticos não gera aviso', async () => {
    expect(
      await lintCodes('.x { color: var(--patods-color-fg-default); background-color: var(--patods-color-bg-surface); }'),
    ).toEqual([])
  })

  it('token primitivo', async () => {
    expect(await lintCodes('.x { color: var(--patods-color-blue-500); }')).toContain('primitive-token')
  })

  it('token brand-mode-source', async () => {
    expect(await lintCodes('.x { color: var(--patods-brand-color-bg-surface-light); }')).toContain('brand-mode-source-token')
  })

  it('token desconhecido', async () => {
    expect(await lintCodes('.x { color: var(--patods-color-nope); }')).toContain('unknown-token')
  })

  it('valor literal', async () => {
    expect(await lintCodes('.x { color: #fff; }')).toContain('literal-value')
    expect(await lintCodes('.x { height: 10px; }')).toContain('literal-value')
  })

  it('fallback literal em var()', async () => {
    expect(await lintCodes('.x { color: var(--patods-color-fg-default, #fff); }')).toContain('var-fallback-literal')
  })

  it('definição de custom property', async () => {
    expect(await lintCodes('.x { --patods-color-x: red; }')).toContain('token-definition')
  })

  it('palavras-chave e var() válido não disparam literal', async () => {
    expect(await lintCodes('.x { color: inherit; background-color: transparent; gap: var(--patods-space-inline-sm); }')).toEqual([])
  })
})
