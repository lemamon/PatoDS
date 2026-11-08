import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadTokens } from '../src/adapter.ts'
import { buildModel } from '../src/model.ts'
import { runBuild } from '../src/build.ts'

const SRC = join(import.meta.dirname, '../../../packages/tokens/src')
const DIST = join(import.meta.dirname, '../../../packages/tokens/dist')
const read = (rel: string) => readFileSync(join(DIST, rel), 'utf8')

describe('runBuild (US2)', () => {
  beforeAll(async () => {
    const model = buildModel(await loadTokens(SRC))
    await runBuild(model, SRC)
  })

  it('base.css uses the spaceless toggle form in the resolver', () => {
    const css = read('css/base.css')
    expect(css).toContain(
      '--patods-color-bg-surface: var(--patods-_on-light, var(--patods-brand-color-bg-surface-light))var(--patods-_on-dark, var(--patods-brand-color-bg-surface-dark));',
    )
    expect(css).toContain('--patods-_on-light: initial;')
  })

  it('the default brand applies on :root; the non-default does not', () => {
    expect(read('css/brand-a.css')).toContain(':where(:root), [data-patods-brand="a"]')
    const b = read('css/brand-b.css')
    expect(b).toContain('[data-patods-brand="b"]')
    expect(b).not.toContain(':where(:root)')
  })

  it('brand B has a different accent from A (brand axis)', () => {
    expect(read('css/brand-a.css')).toContain('--patods-brand-color-bg-accent-light: var(--patods-color-blue-500);')
    expect(read('css/brand-b.css')).toContain('--patods-brand-color-bg-accent-light: var(--patods-color-neutral-900);')
  })

  it('values exposes the emitted value per brand and mode', () => {
    const values = read('esm/values.js')
    expect(values).toContain('"color.bg.surface": "#101216"') // a/dark
    expect(values).toContain('"color.bg.surface": "#ffffff"') // a/light
  })

  it('the manifest lists permutations and control scale', () => {
    const m = JSON.parse(read('meta/tokens.manifest.json'))
    expect(m.permutations).toEqual(['a/dark', 'a/light', 'b/dark', 'b/light'])
    expect(m.scales['control-height']).toContain('size.control.md')
  })

  it('report.json controlHeight is per-permutation {path,value} ascending by value (§4, FR-008)', () => {
    const r = JSON.parse(read('meta/report.json'))
    expect(Object.keys(r.controlHeight).sort()).toEqual(['a/dark', 'a/light', 'b/dark', 'b/light'])
    for (const pid of Object.keys(r.controlHeight)) {
      const scale = r.controlHeight[pid]
      expect(scale.map((e: any) => e.path)).toEqual(['size.control.sm', 'size.control.md', 'size.control.lg'])
      const nums = scale.map((e: any) => parseFloat(e.value))
      expect(nums).toEqual([...nums].sort((a, b) => a - b)) // ascending by value
      expect(scale).toEqual([
        { path: 'size.control.sm', value: '1.75rem' },
        { path: 'size.control.md', value: '2.25rem' },
        { path: 'size.control.lg', value: '2.75rem' },
      ])
    }
  })

  it('the manifest root carries package and brands[].file (build-manifests §2.1)', () => {
    const m = JSON.parse(read('meta/tokens.manifest.json'))
    expect(m.package).toBe('@patods/tokens')
    expect(m.brands).toContainEqual({ id: 'a', default: true, file: 'dist/css/brand-a.css' })
    expect(m.brands).toContainEqual({ id: 'b', default: false, file: 'dist/css/brand-b.css' })
  })

  it('a mode-axis token carries path/aliasOf/aliasChains/source/color (§2.2)', () => {
    const m = JSON.parse(read('meta/tokens.manifest.json'))
    const t = m.tokens.find((x: any) => x.path === 'color.bg.surface')
    expect(t.cssName).toBe('--patods-color-bg-surface')
    expect(t.axis).toBe('mode')
    expect(t.placement).toBe('base')
    expect(t.exclusiveBrand).toBeNull()
    expect(t.aliasOf).toEqual({ dark: 'brand.color.bg.surface.dark', light: 'brand.color.bg.surface.light' })
    expect(t.aliasChains['a/light']).toEqual(['color.bg.surface', 'brand.color.bg.surface.light', 'color.white'])
    expect(Object.keys(t.aliasChains).sort()).toEqual(['a/dark', 'a/light', 'b/dark', 'b/light'])
    expect(t.color.subRefs).toBeNull()
    expect(Object.keys(t.color.emitted).sort()).toEqual(['a/dark', 'a/light', 'b/dark', 'b/light'])
    expect(t.source.file).toBe('src/semantic/mode/dark.tokens.json')
    expect(typeof t.source.line).toBe('number')
    expect(typeof t.source.column).toBe('number')
  })

  it('the API report has the §11 shape: css/theme/entries + per-token metadata', () => {
    const a = JSON.parse(read('../api/tokens.api.json'))
    expect(a.format).toBe('patods.tokens-api')
    expect(a.package).toBe('@patods/tokens')
    expect(a.css).toEqual({ layer: 'patods.tokens', layerOrder: ['patods.tokens'] })
    expect(a.theme.defaultBrand).toBe('a')
    expect(a.theme.modes).toEqual(['light', 'dark'])
    expect(a.entries.map((e: any) => e.path)).toEqual(['.', './values', './css/base.css', './css/brand-*.css', './meta/*'])
    expect(a.entries[0].exports).toContainEqual({ kind: 'const', name: 'tokens' })
    // Per-token metadata, no values/descriptions; brand-exclusive carries exclusiveBrand.
    const prim = a.tokens.find((t: any) => t.name === 'color.blue.300')
    expect(prim).toMatchObject({ layer: 'primitive', placement: 'brand-exclusive', exclusiveBrand: 'a', role: 'public' })
    expect(prim.value).toBeUndefined()
    const sem = a.tokens.find((t: any) => t.name === 'color.bg.surface')
    expect(sem).toMatchObject({ axis: 'mode', layer: 'semantic', placement: 'base' })
    expect(sem.exclusiveBrand).toBeUndefined()
  })

  it('D7: color.blue.300 is brand-exclusive to a — in brand-a.css, not base.css (§2.2, css-output §4)', () => {
    const m = JSON.parse(read('meta/tokens.manifest.json'))
    const t = m.tokens.find((x: any) => x.path === 'color.blue.300')
    expect(t.placement).toBe('brand-exclusive')
    expect(t.exclusiveBrand).toBe('a')
    expect(t.aliasChains).toBeNull() // primitive
    expect(t.aliasOf).toBeNull()
    // CSS: declared in brand-a.css, absent from base.css (D7 primitive partition).
    expect(read('css/brand-a.css')).toContain('--patods-color-blue-300:')
    expect(read('css/base.css')).not.toContain('--patods-color-blue-300:')
  })

  it('ESM exposes every published token, brand-mode-source included (esm-output §4)', () => {
    const idx = read('esm/index.js')
    expect(idx).toContain('"color.bg.surface": "var(--patods-color-bg-surface)"')
    expect(idx).toContain('"brand.color.bg.surface.light": "var(--patods-brand-color-bg-surface-light)"')
  })
})
