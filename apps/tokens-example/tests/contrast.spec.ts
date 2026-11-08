// Real-browser contrast samples (T061, Principle VII, QA-01; contrast-manifest.md §11). Proves that
// the generator, the browser cascade and the checker agree: each sample paints the token's emitted
// value from the PACKAGED tarball, and axe measures the real composited contrast.
//
// Case input is the checker's own `contrast-report.json` for THIS commit (env CONTRAST_REPORT in CI,
// else the default `--out` path that `pnpm contrast:check` writes; turbo runs contrast:check before
// test:e2e). Expected colors come from the tarball `./values` map, never hand-written — since the
// checker already proved its conversion equals the emitted string (emitted-mismatch), equality with
// the computed value closes the chain measured = emitted = rendered.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { values, blankWithCss, type Brand, type Mode } from './helpers'

interface ContrastCase {
  pair: string
  brand: Brand
  mode: Mode
  surface: string | null
  state: string
  kind: 'text' | 'non-text'
  fg: string
  bg: string[] // expanded stack, bottom (opaque base) to top
  result: 'pass' | 'fail' | 'exempt'
  group: string | null
  flags: string[]
}

const REPORT_PATH =
  process.env.CONTRAST_REPORT ?? join(import.meta.dirname, '../../../packages/tokens/reports/contrast-report.json')

const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as { cases: ContrastCase[]; level?: string }
const CASES = report.cases

const caseKey = (c: ContrastCase): string => `${c.pair}|${c.brand}|${c.mode}|${c.surface ?? '-'}`

// Serializable descriptor handed to the page builder (no functions cross the boundary).
type CaseDesc = {
  key: string
  brand: Brand
  mode: Mode
  kind: 'text' | 'non-text'
  eligible: boolean // non-exempt text → measured by axe (axe only measures text)
  bg: string[]
  fg: string
}
const descriptors: CaseDesc[] = CASES.map((c) => ({
  key: caseKey(c),
  brand: c.brand,
  mode: c.mode,
  kind: c.kind,
  eligible: c.kind === 'text' && c.result !== 'exempt',
  bg: c.bg,
  fg: c.fg,
}))

type Measured = {
  key: string
  brand: Brand
  mode: Mode
  layers: { token: string; color: string }[]
  fg: { token: string; color: string }
}

/**
 * Loads the published base + brand CSS, then paints every case as a nested stack on real ancestors:
 * the outermost `<section>` carries the permutation's brand/mode attributes and the opaque base; each
 * further background layer is a child painting its color; the foreground sample sits innermost. No
 * ancestor carries opacity/filter/mix-blend-mode/transform, so axe reaches only the painted stack and
 * never the page's default white (§11). Returns the browser-computed colors of every layer and sample.
 */
async function buildSamples(page: Page): Promise<Measured[]> {
  await blankWithCss(page, ['base.css', 'brand-a.css', 'brand-b.css'])
  return page.evaluate((cases: CaseDesc[]) => {
    const cssVar = (id: string): string => `--patods-${id.replace(/\./g, '-')}`
    const axeRoot = document.createElement('div')
    axeRoot.id = 'axe-root'
    const other = document.createElement('div')
    other.id = 'other'
    document.body.append(axeRoot, other)

    const measured: Measured[] = []
    for (const c of cases) {
      const section = document.createElement('section')
      section.setAttribute('data-patods-brand', c.brand)
      section.setAttribute('data-patods-mode', c.mode)
      section.setAttribute('data-case', c.key)

      let host: HTMLElement = section
      const layerEls: { token: string; el: HTMLElement }[] = []
      for (const token of c.bg) {
        const layer = document.createElement('div')
        layer.className = 'layer'
        layer.setAttribute('data-token', token)
        layer.style.backgroundColor = `var(${cssVar(token)})`
        layer.style.padding = '8px'
        host.appendChild(layer)
        host = layer
        layerEls.push({ token, el: layer })
      }

      const sample = document.createElement(c.kind === 'text' ? 'span' : 'div')
      sample.className = 'sample'
      sample.setAttribute('data-token', c.fg)
      if (c.kind === 'text') {
        sample.style.color = `var(${cssVar(c.fg)})`
        sample.style.fontSize = '16px'
        sample.style.fontFamily = 'system-ui, sans-serif'
        sample.textContent = 'The quick brown fox jumps 0123'
      } else {
        sample.style.backgroundColor = `var(${cssVar(c.fg)})`
        sample.style.display = 'block'
        sample.style.width = '48px'
        sample.style.height = '24px'
      }
      host.appendChild(sample)
      ;(c.eligible ? axeRoot : other).appendChild(section)

      measured.push({
        key: c.key,
        brand: c.brand,
        mode: c.mode,
        layers: layerEls.map((l) => ({ token: l.token, color: getComputedStyle(l.el).backgroundColor })),
        fg: {
          token: c.fg,
          color: c.kind === 'text' ? getComputedStyle(sample).color : getComputedStyle(sample).backgroundColor,
        },
      })
    }
    return measured
  }, descriptors)
}

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Parses `#rrggbb[aa]`, `rgb(r g b / a)` (emitted) and `rgb(r, g, b)` / `rgba(...)` (computed). */
function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase()
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    }
  }
  const nums = (s.match(/-?[\d.]+/g) ?? []).map(Number)
  return { r: nums[0], g: nums[1], b: nums[2], a: nums.length >= 4 ? nums[3] : 1 }
}

/** Channels exactly equal; alpha within half an 8-bit step (engines may quantize the alpha) — §11. */
function expectColor(actual: string, expectedStr: string, label: string): void {
  const a = parseColor(actual)
  const e = parseColor(expectedStr)
  expect(`${a.r},${a.g},${a.b}`, `${label}: rgb (${actual} vs ${expectedStr})`).toBe(`${e.r},${e.g},${e.b}`)
  expect(Math.abs(a.a - e.a), `${label}: alpha (${actual} vs ${expectedStr})`).toBeLessThanOrEqual(1 / 510)
}

test.describe('contrast samples (published tarball, real cascade)', () => {
  test('the report has cases to verify', () => {
    expect(CASES.length, `no cases in ${REPORT_PATH}`).toBeGreaterThan(0)
  })

  test('every layer and foreground paints the emitted sRGB from the ./values map (§11 assertion 1)', async ({ page }) => {
    const measured = await buildSamples(page)
    expect(measured.length).toBe(CASES.length)
    for (const m of measured) {
      for (const layer of m.layers) {
        expectColor(layer.color, values[m.brand][m.mode][layer.token]!, `${m.key} bg ${layer.token}`)
      }
      expectColor(m.fg.color, values[m.brand][m.mode][m.fg.token]!, `${m.key} fg ${m.fg.token}`)
    }
  })

  test('axe color-contrast finds no violation or incomplete over the non-exempt text samples (§11 assertion 2)', async ({ page }) => {
    await buildSamples(page)
    const results = await new AxeBuilder({ page }).include('#axe-root').withRules(['color-contrast']).analyze()
    const colorContrast = <T extends { id: string }>(list: T[]) => list.filter((r) => r.id === 'color-contrast')
    expect(colorContrast(results.violations), 'axe color-contrast violations').toEqual([])
    expect(colorContrast(results.incomplete), 'axe color-contrast incomplete').toEqual([])
    // Guard against a vacuous pass: axe must actually have measured (and passed) the text samples.
    const eligibleCount = descriptors.filter((d) => d.eligible).length
    const passedNodes = colorContrast(results.passes).flatMap((r) => r.nodes)
    expect(passedNodes.length, 'axe measured the non-exempt text samples').toBeGreaterThanOrEqual(eligibleCount)
  })
})
