import { describe, it, expect, beforeAll } from 'vitest'
import stylelint from 'stylelint'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import contrastPairs, { ruleName } from '../src/contrast-pairs.ts'

const PKG = join(import.meta.dirname, '../../../packages/tokens')
const manifestPath = join(PKG, 'dist/meta/tokens.manifest.json')
const contrastManifestPath = join(PKG, 'contrast/manifest.json')

async function lintCodes(code: string): Promise<string[]> {
  const res = await stylelint.lint({
    code,
    config: { plugins: [contrastPairs as any], rules: { [ruleName]: [true, { manifestPath, contrastManifestPath }] } },
  })
  const warnings = res.results[0]?.warnings ?? []
  return warnings.map((w) => w.text.split(':')[0]!.trim())
}

describe('patods/contrast-pairs', () => {
  beforeAll(() => {
    execFileSync('node', [join(PKG, '../../tools/tokens-build/src/cli.ts'), 'build'], { cwd: PKG, stdio: 'pipe' })
  })

  it('a pair present in the manifest generates no warning', async () => {
    expect(
      await lintCodes('.x { color: var(--patods-color-fg-default); background-color: var(--patods-color-bg-surface); }'),
    ).toEqual([])
  })

  it('pair-not-in-manifest', async () => {
    expect(
      await lintCodes('.x { color: var(--patods-color-fg-default); background-color: var(--patods-color-bg-accent); }'),
    ).toContain('pair-not-in-manifest')
  })

  it('missing-background: an interior foreground with no background', async () => {
    expect(await lintCodes('.x { color: var(--patods-color-fg-default); }')).toContain('missing-background')
  })

  it('missing-foreground: a background with no foreground', async () => {
    expect(await lintCodes('.x { background-color: var(--patods-color-bg-surface); }')).toContain('missing-foreground')
  })

  it('unresolvable-color: a non-token colour expression', async () => {
    expect(
      await lintCodes(
        '.x { color: color-mix(in srgb, var(--patods-color-fg-default) 80%, transparent); background-color: var(--patods-color-bg-surface); }',
      ),
    ).toContain('unresolvable-color')
  })

  it('a background annotation supplies the stack', async () => {
    expect(
      await lintCodes('.x { /* patods-contrast: on --patods-color-bg-surface */ color: var(--patods-color-fg-default); }'),
    ).toEqual([])
  })

  it('missing-background: an outline with no annotation', async () => {
    expect(await lintCodes('.x:focus-visible { outline-color: var(--patods-color-border-default); }')).toContain(
      'missing-background',
    )
  })

  it('skips @media (forced-colors: active)', async () => {
    expect(
      await lintCodes(
        '@media (forced-colors: active) { .x { color: var(--patods-color-fg-default); background-color: var(--patods-color-bg-accent); } }',
      ),
    ).toEqual([])
  })

  it('unmapped-state: a state-like selector with no mapping', async () => {
    expect(
      await lintCodes('.x:visited { color: var(--patods-color-fg-default); background-color: var(--patods-color-bg-surface); }'),
    ).toContain('unmapped-state')
  })

  it('invalid-annotation: bad syntax', async () => {
    expect(
      await lintCodes('.x { /* patods-contrast: over @surfaces */ color: var(--patods-color-fg-default); }'),
    ).toContain('invalid-annotation')
  })

  it('invalid-annotation: a primitive token in the stack', async () => {
    expect(
      await lintCodes('.x { /* patods-contrast: on --patods-color-blue-500 */ color: var(--patods-color-fg-default); }'),
    ).toContain('invalid-annotation')
  })

  it('a disabled exempt pair in the manifest counts as present', async () => {
    expect(
      await lintCodes(
        '.x:disabled { color: var(--patods-color-border-default); background-color: var(--patods-color-bg-surface); }',
      ),
    ).toEqual([])
  })
})
