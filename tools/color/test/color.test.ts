import { describe, it, expect } from 'vitest'
import { toEmittedSrgb, relativeLuminance, srgbComponents, over, contrastRatio, parseEmitted } from '../src/index.ts'

describe('toEmittedSrgb', () => {
  it('opaque becomes #rrggbb', () => {
    expect(toEmittedSrgb({ colorSpace: 'srgb', components: [1, 1, 1] })).toBe('#ffffff')
    expect(toEmittedSrgb({ colorSpace: 'srgb', components: [0, 0, 0] })).toBe('#000000')
  })
  it('alpha becomes rgb(r g b / a) with 3 decimal places', () => {
    expect(toEmittedSrgb({ colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.6 })).toBe('rgb(0 0 0 / 0.6)')
  })
  it('maps wide gamut to sRGB', () => {
    const s = toEmittedSrgb({ colorSpace: 'display-p3', components: [1, 0, 0] })
    expect(s).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('WCAG', () => {
  const ratio = (a: [number, number, number], b: [number, number, number]) =>
    contrastRatio(relativeLuminance(a), relativeLuminance(b))
  it('black over white = 21', () => {
    expect(ratio([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 2)
  })
  it('#767676 over #fff passes 4.5 (>= 4.54)', () => {
    const g = 0x76 / 255
    expect(ratio([g, g, g], [1, 1, 1])).toBeGreaterThan(4.5)
  })
  it('#777 over #fff fails 4.5', () => {
    const g = 0x77 / 255
    expect(ratio([g, g, g], [1, 1, 1])).toBeLessThan(4.5)
  })
  it('alpha composition over background', () => {
    const c = over({ rgb: [0, 0, 0], alpha: 0.5 }, [1, 1, 1])
    expect(c[0]).toBeCloseTo(0.5, 5)
  })
})

describe('parseEmitted', () => {
  it('reads #rrggbb and #rrggbbaa back to 0..1', () => {
    expect(parseEmitted('#ffffff')).toEqual({ rgb: [1, 1, 1], alpha: 1 })
    expect(parseEmitted('#000000')).toEqual({ rgb: [0, 0, 0], alpha: 1 })
    const a = parseEmitted('#80808080')
    expect(a.rgb[0]).toBeCloseTo(0x80 / 255, 6)
    expect(a.alpha).toBeCloseTo(0x80 / 255, 6)
  })
  it('reads rgb() number channels on the 0..255 scale, not as 0..1 fractions', () => {
    // Round-trips what toEmittedSrgb emits (integer channels), including near-black translucent.
    expect(parseEmitted('rgb(0 0 0 / 0.5)')).toEqual({ rgb: [0, 0, 0], alpha: 0.5 })
    const nearBlack = parseEmitted('rgb(1 1 1 / 0.8)')
    expect(nearBlack.rgb[0]).toBeCloseTo(1 / 255, 6)
    expect(nearBlack.alpha).toBeCloseTo(0.8, 6)
    expect(parseEmitted('rgb(255 128 0)').rgb).toEqual([1, 128 / 255, 0])
    // emitted rgb() round-trips through toEmittedSrgb byte-for-byte.
    const { rgb, alpha } = parseEmitted('rgb(1 1 1 / 0.8)')
    expect(toEmittedSrgb({ colorSpace: 'srgb', components: rgb, alpha })).toBe('rgb(1 1 1 / 0.8)')
  })
  it('reads percentage channels as 0..1', () => {
    expect(parseEmitted('rgb(100% 0% 50%)').rgb).toEqual([1, 0, 0.5])
  })
})
