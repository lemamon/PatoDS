import { describe, it, expect } from 'vitest'
import { toEmittedSrgb, relativeLuminance, srgbComponents, over, contrastRatio } from '../src/index.ts'

describe('toEmittedSrgb', () => {
  it('opaco vira #rrggbb', () => {
    expect(toEmittedSrgb({ colorSpace: 'srgb', components: [1, 1, 1] })).toBe('#ffffff')
    expect(toEmittedSrgb({ colorSpace: 'srgb', components: [0, 0, 0] })).toBe('#000000')
  })
  it('alfa vira rgb(r g b / a) com 3 casas', () => {
    expect(toEmittedSrgb({ colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.6 })).toBe('rgb(0 0 0 / 0.6)')
  })
  it('mapeia espaço amplo para sRGB', () => {
    const s = toEmittedSrgb({ colorSpace: 'display-p3', components: [1, 0, 0] })
    expect(s).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('WCAG', () => {
  const ratio = (a: [number, number, number], b: [number, number, number]) =>
    contrastRatio(relativeLuminance(a), relativeLuminance(b))
  it('preto sobre branco = 21', () => {
    expect(ratio([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 2)
  })
  it('#767676 sobre #fff passa 4.5 (>= 4.54)', () => {
    const g = 0x76 / 255
    expect(ratio([g, g, g], [1, 1, 1])).toBeGreaterThan(4.5)
  })
  it('#777 sobre #fff reprova 4.5', () => {
    const g = 0x77 / 255
    expect(ratio([g, g, g], [1, 1, 1])).toBeLessThan(4.5)
  })
  it('composição de alfa sobre fundo', () => {
    const c = over({ rgb: [0, 0, 0], alpha: 0.5 }, [1, 1, 1])
    expect(c[0]).toBeCloseTo(0.5, 5)
  })
})
