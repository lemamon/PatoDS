// Contrast checker (US4, A11Y-09, contrast-manifest.md §8). Measures every manifest pair across every
// brand x mode permutation: resolves each reference to its emitted sRGB (from tokens.manifest.json),
// re-derives it with the same toEmittedSrgb() the build uses (G-2, `emitted-mismatch`), composites alpha
// over an opaque stack in gamma sRGB (float + 8-bit-per-fold), takes the smaller WCAG 2.2 ratio, and
// decides per case/pair/group. Minimums come only from quality/thresholds.json, checked against the
// normative table (G-4). Pure and deterministic (G-3). Note: @set surface-set expansion and on-disk
// report writing are the remaining US4 work (T057/T060); a pair using `@set` reports unknown-surface-set
// until surfaces.json exists.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEmitted, toEmittedSrgb, over, relativeLuminance, contrastRatio, type DtcgColor } from '@patods/color'

export interface Pair {
  id: string
  fg: string
  bg: string[]
  state: string
  kind: 'text' | 'non-text'
  group?: string
  exempt?: string
}

export interface Thresholds {
  level: string
  text: number
  nonText: number
}

export interface Finding {
  code: string
  pair: string
  context?: { brand: string; mode: string }
  data?: { ratio?: number; minimum?: number; surface?: string | null }
  message: string
}

export interface CliError {
  code: string
  message: string
}

export interface ContrastCase {
  pair: string
  brand: string
  mode: string
  surface: string | null
  state: string
  kind: 'text' | 'non-text'
  fg: string
  bg: string[]
  ratio: number
  ratioFloat: number
  ratio8bit: number
  minimum: number
  result: 'pass' | 'fail' | 'exempt'
  group: string | null
  flags: Array<'near-threshold'>
}

export interface ContrastGroup {
  id: string
  members: string[]
  result: 'pass' | 'fail'
}

export interface ContrastCheckResult {
  format: 'patods.cli-result'
  version: 1
  tool: 'tokens-contrast'
  command: 'check'
  ok: boolean
  exitCode: 0 | 1 | 2 | 3
  level: string
  minimums: { nonText: number; text: number }
  summary: {
    cases: number
    pairs: number
    passed: number
    failed: number
    exempt: number
    groups: { passed: number; failed: number }
  }
  cases: ContrastCase[]
  groups: ContrastGroup[]
  findings: Finding[]
  errors: CliError[]
}

// Normative minimums per level (G-4, QA-14). Switching level needs an ADR-15 change here and in
// quality/thresholds.json; the checker never takes a minimum from anywhere else.
const LEVEL_TABLE: Record<string, { text: number; nonText: number }> = {
  'WCAG22-AA': { text: 4.5, nonText: 3 },
}

/** G-4: the thresholds file must name a known level with the table's exact minimums. */
export function checkThresholds(th: Thresholds): CliError | null {
  const row = LEVEL_TABLE[th?.level]
  if (!row) return { code: 'THRESHOLDS_MISMATCH', message: `Unknown contrast level ${JSON.stringify(th?.level)}; the checker table has [${Object.keys(LEVEL_TABLE).join(', ')}] (G-4, QA-14).` }
  if (th.text !== row.text || th.nonText !== row.nonText) {
    return { code: 'THRESHOLDS_MISMATCH', message: `Thresholds for ${th.level} (text ${th.text}, non-text ${th.nonText}) differ from the normative table (text ${row.text}, non-text ${row.nonText}); minimums cannot be lowered (G-4).` }
  }
  return null
}

const trunc4 = (n: number) => Math.trunc(n * 1e4) / 1e4

function emittedOf(tokensManifest: any, id: string, perm: string): string | undefined {
  return tokensManifest.tokens.find((x: any) => x.path === id)?.color?.emitted?.[perm]
}

/** G-2: the emitted string, read back and re-derived with toEmittedSrgb, must be the canonical form.
 * parseEmitted returns sRGB components in 0..1, which is exactly what DtcgColor/toEmittedSrgb expect. */
function reEmit(emitted: string): string {
  const { rgb, alpha } = parseEmitted(emitted)
  const c: DtcgColor = { colorSpace: 'srgb', components: [rgb[0], rgb[1], rgb[2]], alpha }
  return toEmittedSrgb(c)
}

interface Resolved {
  rgb: [number, number, number]
  alpha: number
}

/** Resolves a token to its emitted color in a permutation, checking G-2 and recording a finding on a
 * problem. Returns null when it cannot resolve (the case is then skipped). */
function resolveColor(tokensManifest: any, id: string, pair: string, brand: string, mode: string, findings: Finding[]): Resolved | null {
  const perm = `${brand}/${mode}`
  const emitted = emittedOf(tokensManifest, id, perm)
  if (!emitted) {
    findings.push({ code: 'unknown-token', pair, context: { brand, mode }, message: `Pair "${pair}": "${id}" has no emitted color in ${perm} (V-14, A11Y-09).` })
    return null
  }
  let parsed
  try {
    parsed = parseEmitted(emitted)
    if (reEmit(emitted) !== emitted) {
      findings.push({ code: 'emitted-mismatch', pair, context: { brand, mode }, message: `Pair "${pair}": emitted "${emitted}" for "${id}" in ${perm} is not the canonical toEmittedSrgb form (G-2).` })
      return null
    }
  } catch {
    findings.push({ code: 'emitted-mismatch', pair, context: { brand, mode }, message: `Pair "${pair}": emitted "${emitted}" for "${id}" in ${perm} is not a readable sRGB value (G-2).` })
    return null
  }
  return parsed
}

/** Composition + the smaller of the two WCAG variants for one resolved stack (bottom-up) and fg. */
function measure(fg: Resolved, stack: Resolved[]): { ratio: number; ratioFloat: number; ratio8bit: number } {
  const compose = (round8: boolean): number => {
    let bottom: [number, number, number] = stack[0]!.rgb
    for (let i = 1; i < stack.length; i++) bottom = over(stack[i]!, bottom, round8)
    const fgFinal = over(fg, bottom, round8)
    return contrastRatio(relativeLuminance(fgFinal), relativeLuminance(bottom))
  }
  const ratioFloat = compose(false)
  const ratio8bit = compose(true)
  return { ratio: Math.min(ratioFloat, ratio8bit), ratioFloat, ratio8bit }
}

export function runContrastCheck(pkgDir: string, thresholds: Thresholds): ContrastCheckResult {
  const base = {
    format: 'patods.cli-result' as const,
    version: 1 as const,
    tool: 'tokens-contrast' as const,
    command: 'check' as const,
    level: thresholds?.level,
    minimums: { nonText: thresholds?.nonText, text: thresholds?.text },
  }

  // G-4 first: a bad thresholds file is a configuration error (exit 2), not a measurement.
  const thErr = checkThresholds(thresholds)
  if (thErr) {
    return { ...base, ok: false, exitCode: 2, summary: emptySummary(), cases: [], groups: [], findings: [], errors: [thErr] }
  }

  const manifest = JSON.parse(readFileSync(join(pkgDir, 'contrast/manifest.json'), 'utf8'))
  const tokensManifest = JSON.parse(readFileSync(join(pkgDir, 'dist/meta/tokens.manifest.json'), 'utf8'))
  const perms: string[] = tokensManifest.permutations
  if (!Array.isArray(perms) || perms.length === 0) {
    return { ...base, ok: false, exitCode: 2, summary: emptySummary(), cases: [], groups: [], findings: [], errors: [{ code: 'CONFIG', message: 'The token manifest has no permutation list (G-1).' }] }
  }

  const pairs = [...(manifest.pairs as Pair[])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const findings: Finding[] = []
  const cases: ContrastCase[] = []
  // pair -> perm -> passed? (for per-pair and group decisions)
  const pairPass = new Map<string, Map<string, boolean>>()

  for (const pair of pairs) {
    const minimum = pair.kind === 'text' ? thresholds.text : thresholds.nonText
    const permPass = new Map<string, boolean>()
    pairPass.set(pair.id, permPass)
    for (const perm of [...perms].sort()) {
      const [brand, mode] = perm.split('/') as [string, string]
      // @set surface sets (contrast-manifest §4) are not expanded yet (T057/A1b).
      if (pair.bg.some((b) => b.startsWith('@'))) {
        findings.push({ code: 'unknown-surface-set', pair: pair.id, context: { brand, mode }, message: `Pair "${pair.id}": @set surface sets are not yet supported (surfaces.json, T057).` })
        permPass.set(perm, false)
        continue
      }
      const fg = resolveColor(tokensManifest, pair.fg, pair.id, brand, mode, findings)
      const stack = pair.bg.map((id) => resolveColor(tokensManifest, id, pair.id, brand, mode, findings))
      if (!fg || stack.some((s) => s === null)) {
        permPass.set(perm, false)
        continue
      }
      const resolvedStack = stack as Resolved[]
      if (resolvedStack[0]!.alpha < 1) {
        findings.push({ code: 'stack-not-opaque', pair: pair.id, context: { brand, mode }, message: `Pair "${pair.id}": the base "${pair.bg[0]}" is translucent in ${perm}; the checker never assumes a background (V-16).` })
        permPass.set(perm, false)
        continue
      }
      const m = measure(fg, resolvedStack)
      const exempt = pair.exempt === 'wcag-inactive'
      const passed = m.ratio >= minimum
      const result: ContrastCase['result'] = exempt ? 'exempt' : passed ? 'pass' : 'fail'
      const flags: Array<'near-threshold'> = passed && !exempt && m.ratio - minimum < 0.05 ? ['near-threshold'] : []
      cases.push({
        pair: pair.id,
        brand,
        mode,
        surface: null,
        state: pair.state,
        kind: pair.kind,
        fg: pair.fg,
        bg: pair.bg,
        ratio: trunc4(m.ratio),
        ratioFloat: trunc4(m.ratioFloat),
        ratio8bit: trunc4(m.ratio8bit),
        minimum,
        result,
        group: pair.group ?? null,
        flags,
      })
      // A case "passes" for the pair/group decision when it passes or is exempt.
      permPass.set(perm, passed || exempt)
    }
  }

  // Per-pair and per-group decisions (§8 step 10).
  const groupsMap = new Map<string, Pair[]>()
  for (const pair of pairs) {
    if (pair.group) {
      const g = groupsMap.get(pair.group) ?? []
      g.push(pair)
      groupsMap.set(pair.group, g)
      continue
    }
    if (pair.exempt) continue
    for (const perm of [...perms].sort()) {
      const [brand, mode] = perm.split('/') as [string, string]
      if (pairPass.get(pair.id)!.get(perm) === false) {
        const c = cases.find((x) => x.pair === pair.id && x.brand === brand && x.mode === mode)
        findings.push({ code: 'pair-below-minimum', pair: pair.id, context: { brand, mode }, data: { ratio: c?.ratio, minimum: c?.minimum, surface: null }, message: `Pair "${pair.id}" in ${perm}: ratio ${c?.ratio ?? '?'} < ${c?.minimum ?? '?'} (${pair.kind}) (A11Y-09, V-15).` })
      }
    }
  }

  const groups: ContrastGroup[] = []
  for (const [id, members] of [...groupsMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    let groupPassesEveryPerm = true
    for (const perm of [...perms].sort()) {
      const [brand, mode] = perm.split('/') as [string, string]
      const anyPass = members.some((m) => pairPass.get(m.id)!.get(perm) === true)
      if (!anyPass) {
        groupPassesEveryPerm = false
        findings.push({ code: 'group-below-minimum', pair: id, context: { brand, mode }, message: `Group "${id}" in ${perm}: no member reaches the minimum (any-of, V-15, A11Y-09).` })
      }
    }
    groups.push({ id, members: members.map((m) => m.id).sort(), result: groupPassesEveryPerm ? 'pass' : 'fail' })
  }

  cases.sort((a, b) => a.pair.localeCompare(b.pair) || a.brand.localeCompare(b.brand) || a.mode.localeCompare(b.mode))
  const passed = cases.filter((c) => c.result === 'pass').length
  const failed = cases.filter((c) => c.result === 'fail').length
  const exemptN = cases.filter((c) => c.result === 'exempt').length
  const exitCode = findings.length ? 1 : 0
  return {
    ...base,
    ok: exitCode === 0,
    exitCode,
    summary: {
      cases: cases.length,
      pairs: pairs.length,
      passed,
      failed,
      exempt: exemptN,
      groups: { passed: groups.filter((g) => g.result === 'pass').length, failed: groups.filter((g) => g.result === 'fail').length },
    },
    cases,
    groups,
    findings,
    errors: [],
  }
}

function emptySummary(): ContrastCheckResult['summary'] {
  return { cases: 0, pairs: 0, passed: 0, failed: 0, exempt: 0, groups: { passed: 0, failed: 0 } }
}
