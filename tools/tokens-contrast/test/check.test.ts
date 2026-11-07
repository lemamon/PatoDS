import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEmitted } from '@patods/color'
import { runContrastCheck, renderReportMd, checkThresholds, type Pair } from '../src/check.ts'

const TH = { level: 'WCAG22-AA', text: 4.5, nonText: 3 }
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '../../..')
const CONTRAST = join(REPO, 'packages/tokens/contrast')
const FIXTURES = join(HERE, '..', 'fixtures')

// Every finding code the contract defines (contrast-manifest.md §6, tools-cli.md §3.1). The fixtures
// matrix must make each one fire at least once (the multiset invariant below).
const ALL_FINDING_CODES = [
  'pair-below-minimum', 'group-below-minimum', 'unknown-token', 'forbidden-reference',
  'stack-not-opaque', 'empty-surface-set', 'exempt-invalid-state', 'unknown-state',
  'manifest-schema', 'duplicate-id', 'unsorted-manifest', 'unknown-surface-set',
  'duplicate-pair', 'invalid-group', 'emitted-mismatch',
] as const

/** Derives a DTCG srgb value from an emitted string so toEmittedSrgb() round-trips to it (G-2). */
function deriveValue(emitted: string) {
  const { rgb, alpha } = parseEmitted(emitted)
  return { colorSpace: 'srgb', components: rgb, alpha }
}

/** Assembles a throwaway package dir from an on-disk fixture (manifest + surfaces + tokens), generating
 * dist/meta/tokens.manifest.json and copying the real schemas, exactly as the checker reads them. */
function pkgFromFixture(name: string): string {
  const src = join(FIXTURES, name)
  const dir = mkdtempSync(join(tmpdir(), `patods-contrast-${name}-`))
  mkdirSync(join(dir, 'contrast'), { recursive: true })
  mkdirSync(join(dir, 'dist/meta'), { recursive: true })
  copyFileSync(join(CONTRAST, 'manifest.schema.json'), join(dir, 'contrast/manifest.schema.json'))
  copyFileSync(join(CONTRAST, 'surfaces.schema.json'), join(dir, 'contrast/surfaces.schema.json'))
  copyFileSync(join(src, 'manifest.json'), join(dir, 'contrast/manifest.json'))
  try {
    copyFileSync(join(src, 'surfaces.json'), join(dir, 'contrast/surfaces.json'))
  } catch {
    /* fixture has no surface sets */
  }
  const spec = JSON.parse(readFileSync(join(src, 'tokens.json'), 'utf8'))
  const tokens = Object.entries(spec.tokens as Record<string, any>).map(([path, perms]) => {
    const emitted: Record<string, string> = {}
    const value: Record<string, any> = {}
    let layer = 'semantic', role = 'public', type = 'color'
    for (const [k, v] of Object.entries(perms)) {
      if (k === '$layer') { layer = v as string; continue }
      if (k === '$role') { role = v as string; continue }
      if (k === '$type') { type = v as string; continue }
      if (typeof v === 'string') { emitted[k] = v; value[k] = deriveValue(v) }
      else { emitted[k] = (v as any).emitted; value[k] = (v as any).value }
    }
    return { path, role, layer, type, color: { emitted, value, subRefs: null } }
  })
  writeFileSync(join(dir, 'dist/meta/tokens.manifest.json'), JSON.stringify({ permutations: spec.permutations, tokens }))
  return dir
}

/** Inline fixture for the focused unit tests (compositing, truncation, vectors). */
function inlinePkg(pairs: Pair[], colors: Record<string, Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), 'patods-contrast-inline-'))
  mkdirSync(join(dir, 'contrast'), { recursive: true })
  mkdirSync(join(dir, 'dist/meta'), { recursive: true })
  copyFileSync(join(CONTRAST, 'manifest.schema.json'), join(dir, 'contrast/manifest.schema.json'))
  copyFileSync(join(CONTRAST, 'surfaces.schema.json'), join(dir, 'contrast/surfaces.schema.json'))
  const perms = Object.keys(Object.values(colors)[0] ?? { 'a/light': '' })
  writeFileSync(join(dir, 'contrast/manifest.json'), JSON.stringify({ $schema: './manifest.schema.json', schemaVersion: 1, pairs }))
  const tokens = Object.entries(colors).map(([path, emitted]) => {
    const value: Record<string, any> = {}
    for (const [k, v] of Object.entries(emitted)) value[k] = deriveValue(v)
    return { path, role: 'public', layer: 'semantic', type: 'color', color: { emitted, value, subRefs: null } }
  })
  writeFileSync(join(dir, 'dist/meta/tokens.manifest.json'), JSON.stringify({ permutations: perms, tokens }))
  return dir
}

const codesOf = (r: ReturnType<typeof runContrastCheck>) => r.findings.map((f) => f.code)
const fmt2 = (n: number) => (Math.trunc(n * 100) / 100).toFixed(2)

describe('fixtures matrix (contrast-manifest.md §12): each fixture asserts its code(s) and exit', () => {
  const names = readdirSync(FIXTURES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  const union = new Set<string>()

  for (const name of names) {
    it(`fixture "${name}" produces its expected finding codes and exit code`, () => {
      const expected = JSON.parse(readFileSync(join(FIXTURES, name, 'expect.json'), 'utf8')) as { codes: string[]; exitCode: number }
      const r = runContrastCheck(pkgFromFixture(name), TH)
      const actual = codesOf(r)
      for (const code of actual) union.add(code)
      for (const code of expected.codes) expect(actual, `fixture ${name} must emit ${code}`).toContain(code)
      expect(r.exitCode, `fixture ${name} exit code`).toBe(expected.exitCode)
      if (expected.codes.length === 0) expect(actual).toEqual([])
    })
  }

  it('the matrix covers every finding code at least once (multiset invariant)', () => {
    // Recompute the union independently so the test does not depend on describe-block ordering.
    const seen = new Set<string>()
    for (const name of names) {
      for (const f of runContrastCheck(pkgFromFixture(name), TH).findings) seen.add(f.code)
    }
    const missing = ALL_FINDING_CODES.filter((c) => !seen.has(c))
    expect(missing, `no invalid fixture emits: ${missing.join(', ')}`).toEqual([])
  })
})

describe('WCAG reference vectors (contrast-manifest.md §8, QA-02)', () => {
  it('#767676 on #ffffff truncates to 4.54 and passes text', () => {
    const r = runContrastCheck(inlinePkg([{ id: 'v.pass', fg: 'color.fg', bg: ['color.bg'], state: 'default', kind: 'text' }],
      { 'color.fg': { 'a/light': '#767676' }, 'color.bg': { 'a/light': '#ffffff' } }), TH)
    const c = r.cases[0]!
    expect(fmt2(c.ratio)).toBe('4.54')
    expect(c.result).toBe('pass')
  })
  it('#777777 on #ffffff truncates to 4.47 and fails text', () => {
    const r = runContrastCheck(inlinePkg([{ id: 'v.fail', fg: 'color.fg', bg: ['color.bg'], state: 'default', kind: 'text' }],
      { 'color.fg': { 'a/light': '#777777' }, 'color.bg': { 'a/light': '#ffffff' } }), TH)
    const c = r.cases[0]!
    expect(fmt2(c.ratio)).toBe('4.47')
    expect(c.result).toBe('fail')
    expect(codesOf(r)).toContain('pair-below-minimum')
  })
  it('black on white is 21.00', () => {
    const r = runContrastCheck(inlinePkg([{ id: 'v.max', fg: 'color.fg', bg: ['color.bg'], state: 'default', kind: 'text' }],
      { 'color.fg': { 'a/light': '#000000' }, 'color.bg': { 'a/light': '#ffffff' } }), TH)
    expect(fmt2(r.cases[0]!.ratio)).toBe('21.00')
  })
  it('white text over a 0.5 black scrim over white is 3.94 (8-bit variant is the smaller), and fails', () => {
    const r = runContrastCheck(inlinePkg([{ id: 'v.scrim', fg: 'color.white', bg: ['color.white', 'color.scrim'], state: 'default', kind: 'text' }],
      { 'color.white': { 'a/light': '#ffffff' }, 'color.scrim': { 'a/light': 'rgb(0 0 0 / 0.5)' } }), TH)
    const c = r.cases[0]!
    expect(fmt2(c.ratio)).toBe('3.94')
    expect(c.ratio8bit).toBeLessThan(c.ratioFloat) // rounding each fold to 8 bits is the worse case
    expect(c.result).toBe('fail')
  })
})

describe('compositing, exemption, any-of and report shape', () => {
  it('a translucent foreground is composited over the opaque base (US4 scenario 3)', () => {
    const r = runContrastCheck(inlinePkg([{ id: 'c.scrim', fg: 'color.black', bg: ['color.white', 'color.scrim'], state: 'default', kind: 'text' }],
      { 'color.black': { 'a/light': '#000000' }, 'color.white': { 'a/light': '#ffffff' }, 'color.scrim': { 'a/light': 'rgb(0 0 0 / 0.6)' } }), TH)
    const c = r.cases.find((x) => x.pair === 'c.scrim')!
    expect(c.ratio).toBeGreaterThan(3)
    expect(c.ratio).toBeLessThan(21)
    // The reported ratio is the smaller of the two composition variants (§8 step 8).
    expect(c.ratio).toBe(Math.min(c.ratioFloat, c.ratio8bit))
  })

  it('a near-black translucent foreground (emitted rgb(1 1 1 / a), channels <= 1) reads back on the 0..255 scale, not as white', () => {
    // §8 step 4: read back the integer channels in 0..255. A near-black translucent fg over white must
    // composite to a dark color with real contrast, not collapse to white (ratio 1).
    const r = runContrastCheck(inlinePkg([{ id: 'ink', fg: 'color.ink', bg: ['color.white'], state: 'default', kind: 'text' }],
      { 'color.ink': { 'a/light': 'rgb(1 1 1 / 0.8)' }, 'color.white': { 'a/light': '#ffffff' } }), TH)
    expect(codesOf(r)).not.toContain('emitted-mismatch') // the DTCG value round-trips
    const c = r.cases[0]!
    expect(c.ratio).toBeGreaterThan(2) // would be 1.0 if the fg were misparsed as white
  })

  it('a token shared across the surfaces of a @set (fg or an upper layer) reports at most once per permutation', () => {
    // @set with two surfaces + a shared upper layer; both the fg and the upper layer are missing in
    // a/dark. The dedup must yield exactly ONE unknown-token each (not one per surface), while the two
    // distinct surface tokens keep their own findings.
    const dir = mkdtempSync(join(tmpdir(), 'patods-contrast-dedup-'))
    mkdirSync(join(dir, 'contrast'), { recursive: true })
    mkdirSync(join(dir, 'dist/meta'), { recursive: true })
    copyFileSync(join(CONTRAST, 'manifest.schema.json'), join(dir, 'contrast/manifest.schema.json'))
    copyFileSync(join(CONTRAST, 'surfaces.schema.json'), join(dir, 'contrast/surfaces.schema.json'))
    writeFileSync(join(dir, 'contrast/manifest.json'), JSON.stringify({ $schema: './manifest.schema.json', schemaVersion: 1,
      pairs: [{ id: 'scrim.any', fg: 'color.ink', bg: ['@surfaces', 'color.veil'], state: 'default', kind: 'text' }] }))
    writeFileSync(join(dir, 'contrast/surfaces.json'), JSON.stringify({ $schema: './surfaces.schema.json', schemaVersion: 1,
      sets: { '@surfaces': { light: ['color.a', 'color.b'], dark: ['color.a', 'color.b'] } } }))
    const tok = (emitted: Record<string, string>) => ({ emitted, value: Object.fromEntries(Object.entries(emitted).map(([k, v]) => [k, (() => { const { rgb, alpha } = parseEmitted(v); return { colorSpace: 'srgb', components: rgb, alpha } })()])), subRefs: null })
    const tokens = [
      // color.ink and color.veil present only in a/light (missing in a/dark).
      { path: 'color.ink', role: 'public', layer: 'semantic', type: 'color', color: tok({ 'a/light': '#000000' }) },
      { path: 'color.veil', role: 'public', layer: 'semantic', type: 'color', color: tok({ 'a/light': 'rgb(0 0 0 / 0.3)' }) },
      { path: 'color.a', role: 'public', layer: 'semantic', type: 'color', color: tok({ 'a/light': '#ffffff', 'a/dark': '#ffffff' }) },
      { path: 'color.b', role: 'public', layer: 'semantic', type: 'color', color: tok({ 'a/light': '#eeeeee', 'a/dark': '#eeeeee' }) },
    ]
    writeFileSync(join(dir, 'dist/meta/tokens.manifest.json'), JSON.stringify({ permutations: ['a/dark', 'a/light'], tokens }))
    const r = runContrastCheck(dir, TH)
    const darkUnknown = r.findings.filter((f) => f.code === 'unknown-token' && f.context?.mode === 'dark')
    expect(darkUnknown.filter((f) => f.token === 'color.ink')).toHaveLength(1)
    expect(darkUnknown.filter((f) => f.token === 'color.veil')).toHaveLength(1)
  })

  it('an exempt pair is measured and reported, but never fails', () => {
    const r = runContrastCheck(inlinePkg([{ id: 'dis', fg: 'color.mid', bg: ['color.white'], state: 'disabled', kind: 'text', exempt: 'wcag-inactive' }],
      { 'color.mid': { 'a/light': '#999999' }, 'color.white': { 'a/light': '#ffffff' } }), TH)
    expect(r.findings).toEqual([])
    expect(r.exitCode).toBe(0)
    expect(r.cases[0]!.result).toBe('exempt')
  })

  it('an any-of group passes when one member passes and fails when none do', () => {
    const group = (bgInner: string) => [
      { id: 'focus.inner', fg: 'color.ring', bg: ['color.inner'], state: 'focus-visible', kind: 'non-text', group: 'focus' } as Pair,
      { id: 'focus.outer', fg: 'color.ring', bg: ['color.outer'], state: 'focus-visible', kind: 'non-text', group: 'focus' } as Pair,
    ]
    const pass = runContrastCheck(inlinePkg(group('color.inner'),
      { 'color.ring': { 'a/light': '#000000' }, 'color.inner': { 'a/light': '#222222' }, 'color.outer': { 'a/light': '#ffffff' } }), TH)
    expect(pass.findings.filter((f) => f.code === 'group-below-minimum')).toEqual([])
    expect(pass.groups.find((g) => g.id === 'focus')!.result).toBe('pass')
    const fail = runContrastCheck(inlinePkg(group('color.inner'),
      { 'color.ring': { 'a/light': '#000000' }, 'color.inner': { 'a/light': '#111111' }, 'color.outer': { 'a/light': '#222222' } }), TH)
    expect(codesOf(fail)).toContain('group-below-minimum')
    expect(fail.groups.find((g) => g.id === 'focus')!.result).toBe('fail')
  })

  it('cases are ordered by pair, brand, mode and the JSON ratio truncates to 4 places', () => {
    const r = runContrastCheck(inlinePkg([{ id: 'ord', fg: 'color.fg', bg: ['color.bg'], state: 'default', kind: 'text' }],
      { 'color.fg': { 'a/dark': '#000000', 'a/light': '#000000', 'b/dark': '#000000', 'b/light': '#000000' },
        'color.bg': { 'a/dark': '#ffffff', 'a/light': '#ffffff', 'b/dark': '#ffffff', 'b/light': '#ffffff' } }), TH)
    expect(r.cases.map((c) => `${c.brand}/${c.mode}`)).toEqual(['a/dark', 'a/light', 'b/dark', 'b/light'])
    expect(Number.isInteger(r.cases[0]!.ratio * 1e4)).toBe(true)
  })

  it('the Markdown report is deterministic: LF, two-decimal truncated ratios, no timestamp', () => {
    const r = runContrastCheck(inlinePkg([{ id: 'rep', fg: 'color.fg', bg: ['color.bg'], state: 'default', kind: 'text' }],
      { 'color.fg': { 'a/light': '#000000' }, 'color.bg': { 'a/light': '#ffffff' } }), TH)
    const md = renderReportMd(r)
    expect(md).toContain('| rep | a | light | - | default | text | 4.50 | 21.00 | pass | - |')
    expect(md).not.toMatch(/\r/)
    expect(md.endsWith('\n')).toBe(true)
    expect(md).not.toMatch(/\d{4}-\d{2}-\d{2}/) // no ISO date
  })
})

describe('determinism across locale (G-3, SC-002, tools-cli §1.7: order by code point, never by locale)', () => {
  const pkg = join(REPO, 'packages/tokens')
  const cli = join(HERE, '..', 'src/cli.ts')
  const built = existsSync(join(pkg, 'dist/meta/tokens.manifest.json'))
  const run = (env: Record<string, string>) =>
    execFileSync(process.execPath, [cli, 'check', '--json'], { cwd: pkg, env: { ...process.env, ...env }, encoding: 'utf8' })

  it.runIf(built)('the real --json output is byte-identical under C and a non-C collation locale', () => {
    const c = run({ LC_ALL: 'C', LANG: 'C', TZ: 'UTC' })
    const se = run({ LC_ALL: 'sv_SE.UTF-8', LANG: 'sv_SE.UTF-8', TZ: 'Asia/Tokyo' })
    expect(se).toBe(c)
  })
})

describe('checkThresholds (G-4)', () => {
  it('accepts the normative WCAG22-AA minimums', () => {
    expect(checkThresholds(TH)).toBeNull()
  })
  it('rejects a lowered minimum with THRESHOLDS_MISMATCH', () => {
    expect(checkThresholds({ level: 'WCAG22-AA', text: 4.0, nonText: 3 })?.code).toBe('THRESHOLDS_MISMATCH')
  })
  it('rejects an unknown level', () => {
    expect(checkThresholds({ level: 'WCAG21-A', text: 4.5, nonText: 3 })?.code).toBe('THRESHOLDS_MISMATCH')
  })
  it('the runner returns exit code 2 on an inconsistent thresholds file (contrast-manifest §12)', () => {
    const r = runContrastCheck(inlinePkg([], { 'color.fg': { 'a/light': '#000' } }), { level: 'WCAG22-AA', text: 3.0, nonText: 3 })
    expect(r.exitCode).toBe(2)
    expect(r.errors.map((e) => e.code)).toContain('THRESHOLDS_MISMATCH')
  })
})
