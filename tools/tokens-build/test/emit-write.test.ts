import { describe, it, expect } from 'vitest'
import { emitValue, UnserializableValueError } from '../src/emit.ts'
import { canonicalJson } from '../src/write.ts'

describe('emitValue (css-output §11)', () => {
  it('serializes a color via toEmittedSrgb', () => {
    expect(emitValue('color', { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1 }, 'x')).toBe('#ffffff')
    expect(emitValue('color', { colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.5 }, 'x')).toBe('rgb(0 0 0 / 0.5)')
  })
  it('serializes dimensions, numbers, font families and cubic-bezier', () => {
    expect(emitValue('dimension', { value: 16, unit: 'px' }, 'x')).toBe('16px')
    expect(emitValue('number', 1.5, 'x')).toBe('1.5')
    expect(emitValue('fontFamily', ['Inter', 'Fira Sans'], 'x')).toBe('Inter, "Fira Sans"')
    expect(emitValue('cubicBezier', [0.4, 0, 0.2, 1], 'x')).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
  })
  it('serializes a shadow composite', () => {
    const shadow = { offsetX: { value: 0, unit: 'px' }, offsetY: { value: 4, unit: 'px' }, blur: { value: 12, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1 } }
    expect(emitValue('shadow', [shadow], 'x')).toBe('0px 4px 12px 0px #000000')
  })
  it('throws UnserializableValueError for composite typography', () => {
    expect(() => emitValue('typography', {}, 'type.body')).toThrow(UnserializableValueError)
  })
})

describe('canonicalJson (write.ts, M-02)', () => {
  it('sorts keys at every level, 2-space indent, trailing LF', () => {
    const out = canonicalJson({ b: 1, a: { d: 2, c: 3 } })
    expect(out).toBe('{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n')
  })
  it('preserves array order while sorting object keys inside', () => {
    expect(canonicalJson([{ y: 1, x: 2 }])).toBe('[\n  {\n    "x": 2,\n    "y": 1\n  }\n]\n')
  })
})
