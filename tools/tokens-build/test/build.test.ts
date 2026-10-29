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

  it('base.css usa a forma de toggle sem espaço no resolvedor', () => {
    const css = read('css/base.css')
    expect(css).toContain(
      '--patods-color-bg-surface: var(--patods-_on-light, var(--patods-brand-color-bg-surface-light))var(--patods-_on-dark, var(--patods-brand-color-bg-surface-dark));',
    )
    expect(css).toContain('--patods-_on-light: initial;')
  })

  it('a marca padrão aplica em :root; a não padrão não', () => {
    expect(read('css/brand-a.css')).toContain(':where(:root), [data-patods-brand="a"]')
    const b = read('css/brand-b.css')
    expect(b).toContain('[data-patods-brand="b"]')
    expect(b).not.toContain(':where(:root)')
  })

  it('a marca B tem accent diferente da A (eixo marca)', () => {
    expect(read('css/brand-a.css')).toContain('--patods-brand-color-bg-accent-light: var(--patods-color-blue-500);')
    expect(read('css/brand-b.css')).toContain('--patods-brand-color-bg-accent-light: var(--patods-color-neutral-900);')
  })

  it('values expõe o valor emitido por marca e modo', () => {
    const values = read('esm/values.js')
    expect(values).toContain('"color.bg.surface": "#101216"') // a/dark
    expect(values).toContain('"color.bg.surface": "#ffffff"') // a/light
  })

  it('o manifesto lista permutações e escala de controle', () => {
    const m = JSON.parse(read('meta/tokens.manifest.json'))
    expect(m.permutations).toEqual(['a/dark', 'a/light', 'b/dark', 'b/light'])
    expect(m.scales['control-height']).toContain('size.control.md')
  })

  it('ESM só expõe tokens públicos (sem brand-mode-source)', () => {
    const idx = read('esm/index.js')
    expect(idx).toContain('"color.bg.surface": "var(--patods-color-bg-surface)"')
    expect(idx).not.toContain('brand.color.bg.surface.light')
  })
})
