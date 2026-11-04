import { describe, it, expect, beforeAll } from 'vitest'
import { join, dirname } from 'node:path'
import { mkdtempSync, cpSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { loadTokens } from '../src/adapter.ts'
import { buildModel, type Model, type ModelToken } from '../src/model.ts'
import { renderAll, lintInputFrom, type RenderedBuild } from '../src/build.ts'
import { lintGeneratedCss, type LintInput } from '../src/css-lint.ts'
import { main } from '../src/cli.ts'

const SRC = join(import.meta.dirname, '../../../packages/tokens/src')
const codes = (f: { code: string }[]) => f.map((x) => x.code)

let model: Model
let rendered: RenderedBuild
let base: LintInput

beforeAll(async () => {
  model = buildModel(await loadTokens(SRC))
  rendered = await renderAll(model, SRC)
  base = lintInputFrom(model, rendered)
})

/** Clone the lint input with one CSS file's string mutated. */
function withCss(rel: string, mutate: (css: string) => string): LintInput {
  return { ...base, cssFiles: base.cssFiles.map((f) => (f.rel === rel ? { ...f, css: mutate(f.css) } : f)) }
}

describe('lintGeneratedCss (T042)', () => {
  it('valid generated CSS produces no findings', () => {
    expect(lintGeneratedCss(base)).toEqual([])
  })

  // --- css-toggle-form (RS-03, T-02..T-04, D-03) ---
  it('css-toggle-form: a space between the chained toggles', () => {
    const input = withCss('base.css', (css) => css.replace(')var(--patods-_on-dark', ') var(--patods-_on-dark'))
    expect(codes(lintGeneratedCss(input))).toContain('css-toggle-form')
  })

  it('css-toggle-form: trailing content after the chained toggles', () => {
    const input = withCss('base.css', (css) => css.replace(')var(--patods-_on-dark, var(--patods-brand-color-bg-surface-dark));', ')var(--patods-_on-dark, var(--patods-brand-color-bg-surface-dark)) GARBAGE;'))
    expect(codes(lintGeneratedCss(input))).toContain('css-toggle-form')
  })

  it('css-toggle-form: a toggle set by indirection instead of literal initial', () => {
    const input = withCss('base.css', (css) => css.replace('--patods-_on-light: initial;', '--patods-_on-light: var(--x);'))
    expect(codes(lintGeneratedCss(input))).toContain('css-toggle-form')
  })

  it('css-toggle-form: two initials in one mode rule', () => {
    // The light rule sets _on-light:initial / _on-dark: ; turning the OFF one on gives two initials.
    const input = withCss('base.css', (css) => css.replace('--patods-_on-dark: ;', '--patods-_on-dark: initial;'))
    expect(codes(lintGeneratedCss(input))).toContain('css-toggle-form')
  })

  it('css-toggle-form: a mode rule that omits a toggle (not reset to empty)', () => {
    const input = withCss('base.css', (css) => css.replace('\n    --patods-_on-light: ;', ''))
    expect(codes(lintGeneratedCss(input))).toContain('css-toggle-form')
  })

  it('css-toggle-form: a toggle declared outside a base.css mode rule', () => {
    const input = withCss('brand-a.css', (css) => css.replace('{\n    ', '{\n    --patods-_on-light: initial;\n    '))
    expect(codes(lintGeneratedCss(input))).toContain('css-toggle-form')
  })

  it('css-toggle-form: mode rules out of canonical order (D-03)', () => {
    const input = withCss('base.css', (css) =>
      css.replace(
        /(  :where\(:root\), \[data-patods-mode="light"\] \{[\s\S]*?\n  \})\n(  \[data-patods-mode="dark"\] \{[\s\S]*?\n  \})/,
        '$2\n$1',
      ),
    )
    expect(lintGeneratedCss(input)).toContainEqual(
      expect.objectContaining({ code: 'css-toggle-form', rule: 'D-03', file: 'base.css' }),
    )
  })

  // --- css-var-undeclared (§10.1) ---
  it('css-var-undeclared: a var() target declared nowhere', () => {
    const input = withCss('brand-a.css', (css) => css.replace('var(--patods-color-blue-500)', 'var(--patods-color-nope)'))
    expect(codes(lintGeneratedCss(input))).toContain('css-var-undeclared')
  })

  it('css-var-undeclared: a brand-mode source declared in only one brand (not every brand)', () => {
    // base.css references the dark source via a toggle fallback; removing it from brand-b only means
    // it is no longer declared in *every* brand file, so the base reference is undeclared (§10.1 iii).
    const input = withCss('brand-b.css', (css) =>
      css.replace(/\n {4}--patods-brand-color-bg-surface-dark: [^\n]*/, ''),
    )
    expect(codes(lintGeneratedCss(input))).toContain('css-var-undeclared')
  })

  // --- css-public-outside-resolver (§4/RS-02) ---
  it('css-public-outside-resolver: a resolver token declared in the primitives rule', () => {
    // A component token (invariant, belongs in the resolver) injected into the primitives rule —
    // isolates css-public-outside-resolver (a mode-axis token would also trip css-toggle-form).
    const input = withCss('base.css', (css) =>
      css.replace(':where(:root) {\n', ':where(:root) {\n    --patods-color-button-bg-default: #000;\n'),
    )
    const findings = lintGeneratedCss(input)
    expect(codes(findings)).toContain('css-public-outside-resolver')
    expect(codes(findings)).not.toContain('css-toggle-form')
    expect(findings).toContainEqual(
      expect.objectContaining({ code: 'css-public-outside-resolver', rule: 'RS-02', file: 'base.css' }),
    )
  })

  it('css-public-outside-resolver: a brand-mode source declared in base.css', () => {
    const input = withCss('base.css', (css) =>
      css.replace(':where(:root) {\n', ':where(:root) {\n    --patods-brand-color-bg-accent-light: #000;\n'),
    )
    expect(codes(lintGeneratedCss(input))).toContain('css-public-outside-resolver')
  })

  it('css-public-outside-resolver: a brand-exclusive primitive in its brand rule lints clean', () => {
    const prim: ModelToken = {
      id: 'color.blue.500',
      segments: ['color', 'blue', '500'],
      cssName: '--patods-color-blue-500',
      category: 'color',
      layer: 'primitive',
      axis: 'invariant',
      role: 'public',
      placement: 'brand-exclusive',
      exclusiveBrand: 'a',
      type: 'color',
      deprecated: false,
      file: 'primitive/brand-a.tokens.json',
      sourceLine: 1,
      sourceColumn: 1,
      directRefs: [],
      hasAlias: false,
      raw: {},
    }
    const synthetic: LintInput = {
      cssFiles: [
        {
          rel: 'base.css',
          css:
            '@layer patods.tokens;\n\n@layer patods.tokens {\n' +
            '  :where(:root), [data-patods-mode="light"] {\n    --patods-_on-light: initial;\n    --patods-_on-dark: ;\n    color-scheme: light;\n  }\n' +
            '  [data-patods-mode="dark"] {\n    --patods-_on-light: ;\n    --patods-_on-dark: initial;\n    color-scheme: dark;\n  }\n\n' +
            '  :where(:root, [data-patods-brand], [data-patods-mode]) {\n  }\n}\n',
        },
        { rel: 'brand-a.css', css: '@layer patods.tokens;\n\n@layer patods.tokens {\n  :where(:root), [data-patods-brand="a"] {\n    --patods-color-blue-500: #3b82f6;\n  }\n}\n' },
      ],
      model: { tokens: [prim], byId: new Map([[prim.id, prim]]), load: {} as never },
      meta: { brands: ['a', 'b'], defaultBrand: 'a', modes: ['light', 'dark'], defaultMode: 'light' },
      layerOrder: ['patods.tokens'],
      esm: {
        js: '// x\nexport const tokens = Object.freeze({\n  "color.blue.500": "var(--patods-color-blue-500)",\n})\n',
        dts: 'export declare const tokens: {\n  readonly "color.blue.500": "var(--patods-color-blue-500)"\n}\nexport type TokenName = keyof typeof tokens\n',
      },
      manifest: { tokens: [{ path: 'color.blue.500', role: 'public' }] },
      api: { tokens: ['color.blue.500'] },
    }
    expect(lintGeneratedCss(synthetic)).toEqual([])
  })

  // --- css-layer (§3, L-01..L-05) ---
  it('css-layer: the layer-order declaration does not match layers.json', () => {
    const input = withCss('base.css', (css) => css.replace('@layer patods.tokens;', '@layer patods.other;'))
    expect(lintGeneratedCss(input)).toContainEqual(
      expect.objectContaining({ code: 'css-layer', rule: 'L-02', file: 'base.css', line: 1 }),
    )
  })

  it('css-layer: emitted declaration diverges from the layers.json order', () => {
    const input: LintInput = { ...base, layerOrder: ['patods.reset', 'patods.tokens'] }
    expect(codes(lintGeneratedCss(input))).toContain('css-layer')
  })

  it('css-layer: layers.json order missing the tokens layer (L-05)', () => {
    const input: LintInput = { ...base, layerOrder: ['patods.other'] }
    expect(lintGeneratedCss(input)).toContainEqual(expect.objectContaining({ code: 'css-layer', rule: 'L-05' }))
  })

  it('css-layer: a missing @layer block opener (L-01)', () => {
    const input = withCss('base.css', (css) => css.replace('\n@layer patods.tokens {\n', '\n'))
    expect(lintGeneratedCss(input)).toContainEqual(expect.objectContaining({ code: 'css-layer', rule: 'L-01' }))
  })

  it('css-layer: a style rule outside the @layer block (column 0)', () => {
    const input = withCss('base.css', (css) => `${css}\n.rogue { color: red; }\n`)
    expect(codes(lintGeneratedCss(input))).toContain('css-layer')
  })

  it('css-layer: an indented style rule outside the @layer block', () => {
    const input = withCss('base.css', (css) => `${css}\n  .rogue { color: red; }\n`)
    expect(codes(lintGeneratedCss(input))).toContain('css-layer')
  })

  it('css-layer: tolerates a leading header comment before the declaration', () => {
    const input = withCss('base.css', (css) => `/* @patods/tokens: generated file, do not edit. */\n${css}`)
    expect(codes(lintGeneratedCss(input))).not.toContain('css-layer')
  })

  // --- dist-parity (§13 cross-check) ---
  it('dist-parity: a token missing from the API report', () => {
    const input: LintInput = { ...base, api: { ...base.api, tokens: base.api.tokens.slice(1) } }
    expect(codes(lintGeneratedCss(input))).toContain('dist-parity')
  })

  it('dist-parity: an extra ESM key not in the model', () => {
    const input = {
      ...base,
      esm: {
        ...base.esm,
        js: base.esm.js.replace(
          'export const tokens = /*#__PURE__*/ Object.freeze({\n',
          'export const tokens = /*#__PURE__*/ Object.freeze({\n  "ghost.token": "var(--patods-ghost-token)",\n',
        ),
      },
    }
    expect(codes(lintGeneratedCss(input))).toContain('dist-parity')
  })

  it('dist-parity: a token missing from the CSS', () => {
    const input = withCss('base.css', (css) => css.replace(/\n {4}--patods-radius-md:[^\n]*/, ''))
    expect(codes(lintGeneratedCss(input))).toContain('dist-parity')
  })

  // --- manifest-guarantee (§2.4, M-07/M-08) ---
  it('manifest-guarantee: exclusiveBrand without brand-exclusive placement (M-08)', () => {
    const victim = base.model.tokens.find((t) => t.layer === 'primitive' && t.placement === 'base')!
    const input: LintInput = {
      ...base,
      model: { ...base.model, tokens: base.model.tokens.map((t) => (t === victim ? { ...t, exclusiveBrand: 'a' } : t)) },
    }
    expect(lintGeneratedCss(input)).toContainEqual(expect.objectContaining({ code: 'manifest-guarantee', rule: 'M-08' }))
  })

  it('manifest-guarantee: aliasChains missing a permutation key (M-07)', () => {
    const idx = base.manifest.tokens.findIndex((t) => t.aliasChains)
    const input: LintInput = {
      ...base,
      manifest: { tokens: base.manifest.tokens.map((t, i) => (i === idx ? { ...t, aliasChains: { 'a/light': [] } } : t)) },
    }
    expect(lintGeneratedCss(input)).toContainEqual(expect.objectContaining({ code: 'manifest-guarantee', rule: 'M-07' }))
  })
})

describe('brand-exclusive primitive partition (D7)', () => {
  it('a primitive that aliases another primitive emits var(), and the target follows it (DEP-03, §4)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'patods-primalias-'))
    cpSync(SRC, join(dir, 'src'), { recursive: true })
    const srcDir = join(dir, 'src')
    // Add a primitive that is a whole-token alias to another primitive, reached only via brand a.
    const primPath = join(srcDir, 'primitive.tokens.json')
    const prim = JSON.parse(readFileSync(primPath, 'utf8'))
    prim.color['brand-accent'] = { $type: 'color', $value: '{color.blue.300}' }
    writeFileSync(primPath, JSON.stringify(prim, null, 2))
    const aPath = join(srcDir, 'semantic/brand/a.tokens.json')
    writeFileSync(aPath, readFileSync(aPath, 'utf8').replace('{color.blue.300}', '{color.brand-accent}'))

    const model = buildModel(await loadTokens(srcDir))
    const r = await renderAll(model, srcDir)
    const brandA = r.cssOut.find((f) => f.leaf === 'brand-a.css')!.css
    // DEP-03/§4: the aliasing primitive emits var() of its target, not the resolved literal.
    expect(brandA).toContain('--patods-color-brand-accent: var(--patods-color-blue-300);')
    // The target primitive follows its only referrer into brand-a.css (no orphan), and lint is clean.
    expect(brandA).toContain('--patods-color-blue-300:')
    expect(lintGeneratedCss(lintInputFrom(model, r))).toEqual([])
  })
})

describe('build exit codes (CLI, QA-02/SC-009)', () => {
  function tmpSrc(): string {
    const dir = mkdtempSync(join(tmpdir(), 'patods-csslint-'))
    cpSync(SRC, join(dir, 'src'), { recursive: true })
    return join(dir, 'src')
  }

  it('exit 0: a clean build', async () => {
    expect(await main(['build', '--src', tmpSrc(), '--json'])).toBe(0)
  })

  it('exit 1: a lint violation (layers.json drifted) and no artifact is written', async () => {
    const src = tmpSrc()
    writeFileSync(join(src, 'layers.json'), JSON.stringify({ order: ['patods.other'] }))
    expect(await main(['build', '--src', src, '--json'])).toBe(1)
    // css-output.md §13: a lint failure writes no dist/ artifact.
    expect(existsSync(join(dirname(src), 'dist', 'css', 'base.css'))).toBe(false)
  })

  it('exit 2: a config error (invalid layers.json)', async () => {
    const src = tmpSrc()
    writeFileSync(join(src, 'layers.json'), JSON.stringify({ order: [] }))
    expect(await main(['build', '--src', src, '--json'])).toBe(2)
  })
})
