import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runContrastCheck, checkThresholds, type Pair } from '../src/check.ts'

const TH = { level: 'WCAG22-AA', text: 4.5, nonText: 3 }

function fixture(pairs: Pair[], colors: Record<string, Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), 'patods-contrast-'))
  mkdirSync(join(dir, 'contrast'), { recursive: true })
  mkdirSync(join(dir, 'dist/meta'), { recursive: true })
  const perms = Object.keys(Object.values(colors)[0] ?? { 'a/light': '' })
  writeFileSync(join(dir, 'contrast/manifest.json'), JSON.stringify({ version: 1, pairs }))
  writeFileSync(
    join(dir, 'dist/meta/tokens.manifest.json'),
    JSON.stringify({
      permutations: perms,
      tokens: Object.entries(colors).map(([path, emitted]) => ({ path, type: 'color', color: { emitted } })),
    }),
  )
  return dir
}

const codes = (r: ReturnType<typeof runContrastCheck>) => r.findings.map((f) => f.code)

describe('runContrastCheck (US4, contrast-manifest §8)', () => {
  it('a pair below the minimum fails with pair-below-minimum; a good pair passes', () => {
    const dir = fixture(
      [
        { id: 'ok', fg: 'fg', bg: ['bgLight'], state: 'default', kind: 'text' },
        { id: 'bad', fg: 'mid', bg: ['bgLight'], state: 'default', kind: 'text' },
      ],
      { fg: { 'a/light': '#000000' }, mid: { 'a/light': '#777777' }, bgLight: { 'a/light': '#ffffff' } },
    )
    const r = runContrastCheck(dir, TH)
    expect(r.findings.filter((f) => f.code === 'pair-below-minimum').map((f) => f.pair)).toEqual(['bad'])
    expect(r.exitCode).toBe(1)
    expect(r.summary).toMatchObject({ pairs: 2, passed: 1, failed: 1 })
  })

  it('an exempt pair is measured and reported, but never fails', () => {
    const dir = fixture(
      [{ id: 'dis', fg: 'mid', bg: ['bgLight'], state: 'disabled', kind: 'text', exempt: 'wcag-inactive' }],
      { mid: { 'a/light': '#999999' }, bgLight: { 'a/light': '#ffffff' } },
    )
    const r = runContrastCheck(dir, TH)
    expect(r.findings).toEqual([])
    expect(r.exitCode).toBe(0)
    expect(r.cases[0]!.result).toBe('exempt')
  })

  it('a translucent foreground is composited over the opaque base', () => {
    const dir = fixture(
      [{ id: 'scrim', fg: 'black', bg: ['bgLight', 'scrim'], state: 'default', kind: 'text' }],
      { black: { 'a/light': '#000000' }, bgLight: { 'a/light': '#ffffff' }, scrim: { 'a/light': 'rgb(0 0 0 / 0.6)' } },
    )
    const r = runContrastCheck(dir, TH)
    const c = r.cases.find((x) => x.pair === 'scrim')!
    expect(c.ratio).toBeGreaterThan(3)
    expect(c.ratio).toBeLessThan(5)
  })

  it('a non-opaque base is stack-not-opaque (never assumes a background)', () => {
    const dir = fixture(
      [{ id: 'x', fg: 'white', bg: ['scrim'], state: 'default', kind: 'text' }],
      { white: { 'a/light': '#ffffff' }, scrim: { 'a/light': 'rgb(0 0 0 / 0.6)' } },
    )
    expect(codes(runContrastCheck(dir, TH))).toContain('stack-not-opaque')
  })

  it('a token missing in a permutation is unknown-token', () => {
    const dir = fixture(
      [{ id: 'p', fg: 'fg', bg: ['bg'], state: 'default', kind: 'text' }],
      { fg: { 'a/light': '#000000', 'a/dark': '#000000' }, bg: { 'a/light': '#ffffff' } }, // bg missing in a/dark
    )
    const f = runContrastCheck(dir, TH).findings.find((x) => x.code === 'unknown-token')
    expect(f).toBeDefined()
    expect(f!.context).toEqual({ brand: 'a', mode: 'dark' })
  })

  it('a non-canonical emitted string is emitted-mismatch (G-2)', () => {
    const dir = fixture(
      [{ id: 'p', fg: 'fg', bg: ['bg'], state: 'default', kind: 'text' }],
      { fg: { 'a/light': '#FFFFFF' }, bg: { 'a/light': '#000000' } }, // uppercase hex is not the canonical form
    )
    expect(codes(runContrastCheck(dir, TH))).toContain('emitted-mismatch')
  })

  it('a focus-indicator any-of group passes when one member passes, fails when none do', () => {
    const group = (innerBg: string): Pair[] => [
      { id: 'inner', fg: 'ring', bg: ['innerBg'], state: 'focus-visible', kind: 'non-text', group: 'focus' },
      { id: 'outer', fg: 'ring', bg: ['outerBg'], state: 'focus-visible', kind: 'non-text', group: 'focus' },
    ]
    // inner fails (grey on grey), outer passes (black on white) -> group passes, no finding.
    const passDir = fixture(group('innerBg'), {
      ring: { 'a/light': '#000000' }, innerBg: { 'a/light': '#222222' }, outerBg: { 'a/light': '#ffffff' },
    })
    const pass = runContrastCheck(passDir, TH)
    expect(pass.findings.filter((f) => f.code === 'group-below-minimum')).toEqual([])
    expect(pass.groups.find((g) => g.id === 'focus')!.result).toBe('pass')
    // both members fail -> group-below-minimum.
    const failDir = fixture(group('innerBg'), {
      ring: { 'a/light': '#000000' }, innerBg: { 'a/light': '#111111' }, outerBg: { 'a/light': '#222222' },
    })
    const fail = runContrastCheck(failDir, TH)
    expect(fail.findings.map((f) => f.code)).toContain('group-below-minimum')
    expect(fail.groups.find((g) => g.id === 'focus')!.result).toBe('fail')
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
  it('the runner returns exit code 2 on a bad thresholds file', () => {
    const dir = fixture([], { fg: { 'a/light': '#000' } })
    const r = runContrastCheck(dir, { level: 'WCAG22-AA', text: 3.0, nonText: 3 })
    expect(r.exitCode).toBe(2)
    expect(r.errors.map((e) => e.code)).toContain('THRESHOLDS_MISMATCH')
  })
})
