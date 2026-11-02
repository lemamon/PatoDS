import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page } from '@playwright/test'
import { values, type Brand, type Mode } from '@patods/tokens/values'

export { values, type Brand, type Mode }

// Raw (non-minified) CSS as published in the tarball — used for import-order variants
// and the non-minified half of BR-19. Read from the installed package, never hand-written.
const CSS_DIR = join(import.meta.dirname, '../node_modules/@patods/tokens/dist/css')
export const cssFile = (name: string): string => readFileSync(join(CSS_DIR, name), 'utf8')

// Brand/mode-dependent and invariant public tokens compared by exact custom-property string.
export const PROP_TOKENS = [
  'color.bg.surface',
  'color.fg.default',
  'color.bg.accent',
  'color.fg.on-accent',
  'color.border.default',
  'color.button.bg.default', // component alias
  'space.4', // invariant
  'radius.md', // invariant
  'opacity.60', // invariant
] as const

// Used-value probes (BR-17): property -> token whose value feeds it.
export const USED_VALUES = [
  { prop: 'background-color', token: 'color.bg.surface' },
  { prop: 'border-top-left-radius', token: 'radius.md' },
  { prop: 'box-shadow', token: 'shadow.overlay' },
  { prop: 'outline-color', token: 'color.border.focus' },
  { prop: 'height', token: 'size.h.md' },
] as const

export const cssVar = (id: string): string => `--patods-${id.replace(/\./g, '-')}`
export const expected = (brand: Brand, mode: Mode, id: string): string => values[brand][mode][id]!

export const BRANDS: Brand[] = ['a', 'b']
export const MODES: Mode[] = ['light', 'dark']

/** Effective axis values per R-07, given the raw attribute chain root..self and the imported brands. */
export function effective(
  chain: ReadonlyArray<{ brand?: string; mode?: string }>,
  imported: readonly Brand[] = BRANDS,
): { brand: Brand; mode: Mode } {
  let brand: Brand = 'a'
  let mode: Mode = 'light'
  for (const node of chain) {
    if ((node.brand === 'a' || node.brand === 'b') && imported.includes(node.brand)) brand = node.brand
    if (node.mode === 'light' || node.mode === 'dark') mode = node.mode
  }
  return { brand, mode }
}

/** Replace document.body with the given markup, keeping the <head> stylesheets. */
export async function setBody(page: Page, html: string): Promise<void> {
  await page.evaluate((h) => {
    document.body.innerHTML = h
  }, html)
}

/** Load a blank page with only the given CSS files injected in order (import-variant cases). */
export async function blankWithCss(page: Page, files: string[]): Promise<void> {
  await page.goto('about:blank')
  for (const name of files) await page.addStyleTag({ content: cssFile(name) })
}

/** Assert every PROP_TOKEN on the element resolves to the values-map entry for (brand, mode). */
export async function assertScope(page: Page, testid: string, brand: Brand, mode: Mode): Promise<void> {
  const resolved = await page.locator(`[data-testid="${testid}"]`).evaluate((el, vars) => {
    const cs = getComputedStyle(el)
    return vars.map((v) => cs.getPropertyValue(v))
  }, PROP_TOKENS.map(cssVar))
  PROP_TOKENS.forEach((id, i) => {
    // Exact string equality, without trimming (R-05, §16).
    expect(resolved[i], `${testid}: ${id} @ ${brand}/${mode}`).toBe(expected(brand, mode, id))
  })
}

/** Assert a custom property is empty on the element (U-02 / §10.1 variable without a value). */
export async function assertEmpty(page: Page, testid: string, id: string): Promise<void> {
  const v = await page
    .locator(`[data-testid="${testid}"]`)
    .evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), cssVar(id))
  expect(v, `${testid}: ${id} should be empty`).toBe('')
}

/**
 * Assert used values (BR-17): apply each probed property via the token var on the element and
 * compare the browser-normalized used value to a reference element carrying the literal.
 */
export async function assertUsedValues(page: Page, testid: string, brand: Brand, mode: Mode): Promise<void> {
  for (const { prop, token } of USED_VALUES) {
    const literal = expected(brand, mode, token)
    const [actual, reference] = await page.evaluate(
      ([sel, cssProp, varName, lit]) => {
        const target = document.querySelector(sel) as HTMLElement
        const probe = document.createElement('div')
        document.body.appendChild(probe)
        target.style.setProperty(cssProp, `var(${varName})`)
        probe.style.setProperty(cssProp, lit)
        const a = getComputedStyle(target).getPropertyValue(cssProp)
        const b = getComputedStyle(probe).getPropertyValue(cssProp)
        probe.remove()
        return [a, b]
      },
      [`[data-testid="${testid}"]`, prop, cssVar(token), literal] as const,
    )
    expect(actual, `${testid}: used ${prop} @ ${brand}/${mode}`).toBe(reference)
  }
}
