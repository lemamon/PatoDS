import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runContrastCheck, type Pair } from '../src/check.ts'

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
      tokens: Object.entries(colors).map(([id, emitted]) => ({ id, type: 'color', color: { emitted } })),
    }),
  )
  return dir
}

describe('runContrastCheck (US4)', () => {
  it('fails a pair below the minimum and passes a good pair', () => {
    const dir = fixture(
      [
        { id: 'ok', fg: 'fg', bg: ['bgLight'], state: 'default', kind: 'text' },
        { id: 'bad', fg: 'mid', bg: ['bgLight'], state: 'default', kind: 'text' },
      ],
      {
        fg: { 'a/light': '#000000' },
        mid: { 'a/light': '#777777' },
        bgLight: { 'a/light': '#ffffff' },
      },
    )
    const r = runContrastCheck(dir, TH)
    const failed = r.findings.filter((f) => f.code === 'contrast-below-min').map((f) => f.pair)
    expect(failed).toContain('bad')
    expect(failed).not.toContain('ok')
  })

  it('an exempt pair is measured and reported, but does not fail', () => {
    const dir = fixture(
      [{ id: 'dis', fg: 'mid', bg: ['bgLight'], state: 'disabled', kind: 'text', exempt: 'wcag-inactive' }],
      { mid: { 'a/light': '#999999' }, bgLight: { 'a/light': '#ffffff' } },
    )
    const r = runContrastCheck(dir, TH)
    expect(r.findings).toEqual([])
    expect(r.report.rows[0]!.exempt).toBe(true)
    expect(r.report.rows[0]!.pass).toBe(false)
  })

  it('translucent background is composited over the opaque base (does not assume an opaque background)', () => {
    const dir = fixture(
      [{ id: 'scrim', fg: 'black', bg: ['bgLight', 'scrim'], state: 'default', kind: 'text' }],
      {
        black: { 'a/light': '#000000' },
        bgLight: { 'a/light': '#ffffff' },
        scrim: { 'a/light': 'rgb(0 0 0 / 0.6)' },
      },
    )
    const r = runContrastCheck(dir, TH)
    // black over (black-60% over white=#666): ratio ~3.66. Had it assumed the scrim was opaque
    // black, the ratio would be 1 (black on black). Compositing yields an intermediate value.
    const row = r.report.rows.find((x) => x.pair === 'scrim')!
    expect(row.ratio).toBeGreaterThan(3)
    expect(row.ratio).toBeLessThan(5)
  })

  it('non-opaque base is an error', () => {
    const dir = fixture(
      [{ id: 'x', fg: 'white', bg: ['scrim'], state: 'default', kind: 'text' }],
      { white: { 'a/light': '#ffffff' }, scrim: { 'a/light': 'rgb(0 0 0 / 0.6)' } },
    )
    const r = runContrastCheck(dir, TH)
    expect(r.findings.some((f) => f.code === 'emitted-mismatch')).toBe(true)
  })
})
