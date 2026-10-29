// Motor de cor e contraste do PatoDS (ADR-15). Folha, sem dependências do workspace.
// Os componentes DTCG são a fonte de verdade; o gerador de CSS e o checker de contraste chamam a
// mesma `toEmittedSrgb()`, de modo que o valor medido é o valor emitido.
import Color from 'colorjs.io'

export interface DtcgColor {
  colorSpace: string
  components: number[]
  alpha?: number
  hex?: string
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

function to8bit(n: number): number {
  return Math.round(clamp01(n) * 255)
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, '0')
}

/** Componentes sRGB (0..1) de uma cor DTCG, mapeando gamut pelo CSS Color 4 quando necessário. */
export function srgbComponents(c: DtcgColor): { rgb: [number, number, number]; alpha: number } {
  const alpha = c.alpha ?? 1
  if (c.colorSpace === 'srgb') {
    const [r = 0, g = 0, b = 0] = c.components
    return { rgb: [r, g, b], alpha }
  }
  const spaceId = { 'display-p3': 'p3', 'a98-rgb': 'a98rgb', 'prophoto-rgb': 'prophoto' }[c.colorSpace] ?? c.colorSpace
  const color = new Color(spaceId, c.components, alpha)
  const srgb = color.to('srgb')
  if (!srgb.inGamut()) srgb.toGamut({ space: 'srgb', method: 'css' })
  const [r, g, b] = srgb.coords
  return { rgb: [r ?? 0, g ?? 0, b ?? 0], alpha }
}

/** String CSS emitida: #rrggbb para opaco, rgb(r g b / a) com 3 casas no alfa caso contrário. */
export function toEmittedSrgb(c: DtcgColor): string {
  const { rgb, alpha } = srgbComponents(c)
  const [r, g, b] = rgb.map(to8bit) as [number, number, number]
  if (alpha >= 1) return `#${hex2(r)}${hex2(g)}${hex2(b)}`
  const a = Math.round(alpha * 1000) / 1000
  return `rgb(${r} ${g} ${b} / ${a})`
}

/** Luminância relativa WCAG 2.x a partir de componentes sRGB (0..1). */
export function relativeLuminance(rgb: [number, number, number]): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgb
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Composição source-over em sRGB gama de `fg` sobre `bg` (ambos 0..1, com alfa). */
export function over(
  fg: { rgb: [number, number, number]; alpha: number },
  bg: [number, number, number],
  round8 = false,
): [number, number, number] {
  const out = fg.rgb.map((c, i) => {
    const v = c * fg.alpha + bg[i]! * (1 - fg.alpha)
    return round8 ? Math.round(v * 255) / 255 : v
  })
  return [out[0]!, out[1]!, out[2]!]
}

/** Razão de contraste WCAG 2.x (sem arredondamento). */
export function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}
