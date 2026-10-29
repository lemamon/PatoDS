// Serializes a resolved DTCG value to a CSS string, by $type (css-output.md §11).
import { toEmittedSrgb, type DtcgColor } from '@patods/color'

export class UnserializableValueError extends Error {
  type: string
  id: string
  constructor(type: string, id: string) {
    super(`Valor não serializável (unserializable-value): tipo "${type}" em "${id}" (S-04).`)
    this.type = type
    this.id = id
  }
}

function dim(v: any): string {
  if (v && typeof v === 'object' && 'value' in v) return `${v.value}${v.unit ?? ''}`
  return String(v)
}

function fontFamily(v: any): string {
  const arr = Array.isArray(v) ? v : [v]
  return arr.map((f: string) => (/\s/.test(f) ? `"${f}"` : f)).join(', ')
}

/** Serializes a token's resolved $value. Throws UnserializableValueError for composites
 * without a single CSS value (composite typography, object-form strokeStyle). */
export function emitValue(type: string, value: any, id: string): string {
  switch (type) {
    case 'color':
      return toEmittedSrgb(value as DtcgColor)
    case 'dimension':
      return dim(value)
    case 'number':
      return String(value)
    case 'fontFamily':
      return fontFamily(value)
    case 'fontWeight':
      return String(value)
    case 'duration':
      return dim(value)
    case 'cubicBezier': {
      const [a, b, c, d] = value as number[]
      return `cubic-bezier(${a}, ${b}, ${c}, ${d})`
    }
    case 'shadow': {
      const layers = Array.isArray(value) ? value : [value]
      return layers
        .map((s: any) => `${dim(s.offsetX)} ${dim(s.offsetY)} ${dim(s.blur)} ${dim(s.spread)} ${toEmittedSrgb(s.color)}`)
        .join(', ')
    }
    case 'strokeStyle':
      if (typeof value === 'string') return value
      throw new UnserializableValueError(type, id)
    case 'typography':
      throw new UnserializableValueError(type, id)
    default:
      if (typeof value === 'string' || typeof value === 'number') return String(value)
      throw new UnserializableValueError(type, id)
  }
}
