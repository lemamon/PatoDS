// Contrast checker (US4, A11Y-09): measures every manifest pair across all permutations, compositing
// alpha over the background stack before the WCAG ratio. Uses the emitted value from
// tokens.manifest.json, so the measured value is the emitted one (contrast-manifest.md).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEmitted, srgbComponents, over, relativeLuminance, contrastRatio } from '@patods/color'

export interface Pair {
  id: string
  fg: string
  bg: string[]
  state: string
  kind: 'text' | 'non-text'
  group?: string
  exempt?: string
}

export interface ContrastFinding {
  code: string
  pair: string
  perm: string
  message: string
}

interface Thresholds {
  level: string
  text: number
  nonText: number
}

function emittedOf(tokensManifest: any, id: string, perm: string): string | undefined {
  const t = tokensManifest.tokens.find((x: any) => x.id === id)
  return t?.color?.emitted?.[perm]
}

/** Composites a background stack (bottom-up) into an opaque sRGB color. */
function composeBg(stack: string[], manifest: any, perm: string, round8: boolean): [number, number, number] | null {
  let bottom: [number, number, number] | null = null
  for (const id of stack) {
    const s = emittedOf(manifest, id, perm)
    if (!s) return null
    const c = parseEmitted(s)
    if (bottom === null) {
      if (c.alpha < 1) return null // the base must be opaque
      bottom = c.rgb
    } else {
      bottom = over(c, bottom, round8)
    }
  }
  return bottom
}

function ratioFor(pair: Pair, manifest: any, perm: string, round8: boolean): number | null {
  const bg = composeBg(pair.bg, manifest, perm, round8)
  if (!bg) return null
  const fgStr = emittedOf(manifest, pair.fg, perm)
  if (!fgStr) return null
  const fg = parseEmitted(fgStr)
  const fgFinal = over(fg, bg, round8)
  return contrastRatio(relativeLuminance(fgFinal), relativeLuminance(bg))
}

export interface CheckResult {
  findings: ContrastFinding[]
  report: {
    format: string
    version: number
    level: string
    rows: { pair: string; perm: string; kind: string; ratio: number; min: number; exempt: boolean; pass: boolean }[]
  }
}

export function runContrastCheck(pkgDir: string, thresholds: Thresholds): CheckResult {
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'contrast/manifest.json'), 'utf8'))
  const tokensManifest = JSON.parse(readFileSync(join(pkgDir, 'dist/meta/tokens.manifest.json'), 'utf8'))
  const perms: string[] = tokensManifest.permutations
  const findings: ContrastFinding[] = []
  const rows: CheckResult['report']['rows'] = []

  for (const pair of manifest.pairs as Pair[]) {
    const min = pair.kind === 'text' ? thresholds.text : thresholds.nonText
    for (const perm of perms) {
      const rFloat = ratioFor(pair, tokensManifest, perm, false)
      const r8 = ratioFor(pair, tokensManifest, perm, true)
      if (rFloat === null || r8 === null) {
        findings.push({ code: 'emitted-mismatch', pair: pair.id, perm, message: `Pair "${pair.id}": color not resolved in ${perm}.` })
        continue
      }
      const ratio = Math.min(rFloat, r8)
      const truncated = Math.floor(ratio * 100) / 100
      const pass = ratio >= min
      const exempt = pair.exempt === 'wcag-inactive'
      rows.push({ pair: pair.id, perm, kind: pair.kind, ratio: truncated, min, exempt, pass })
      if (!pass && !exempt) {
        findings.push({
          code: 'contrast-below-min',
          pair: pair.id,
          perm,
          message: `Pair "${pair.id}" in ${perm}: ratio ${truncated} < ${min} (${pair.kind}) (A11Y-09).`,
        })
      }
    }
  }
  rows.sort((a, b) => a.pair.localeCompare(b.pair) || a.perm.localeCompare(b.perm))
  return { findings, report: { format: 'patods.contrast-report', version: 1, level: thresholds.level, rows } }
}
