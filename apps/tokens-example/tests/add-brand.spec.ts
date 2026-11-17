import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cssVar, PROP_TOKENS } from './helpers'

// US3 scenario 3 (FR-009, SC-005): a NEW brand `c` added through token files only changes the
// app's resolved CSS values at runtime, with no reload and no component code change.
// Setup mirrors tools/tokens-build/test/add-brand.test.ts (T052): copy packages/tokens/src to a
// temp dir, add the `c` resolver context + semantic/brand/c.tokens.json, then run the real
// `tokens-build build` CLI. The generated brand-c.css is added to the running example app
// (built from the packaged tarball) and the expected values come from the generated ./values.

const REPO = join(import.meta.dirname, '../../..')
const SRC = join(REPO, 'packages/tokens/src')
const APP_SRC = join(import.meta.dirname, '../src')
const CLI = join(REPO, 'tools/tokens-build/src/cli.ts')

type Values = Record<string, Record<'light' | 'dark', Record<string, string>>>

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? listFiles(p, base) : [relative(base, p)]
  })
}

function digest(dir: string): Record<string, string> {
  return Object.fromEntries(
    listFiles(dir)
      .sort()
      .map((f) => [f, createHash('sha256').update(readFileSync(join(dir, f))).digest('hex')]),
  )
}

async function resolvedProps(page: Page): Promise<string[]> {
  return page.evaluate(
    (vars) => {
      const cs = getComputedStyle(document.documentElement)
      return vars.map((v) => cs.getPropertyValue(v))
    },
    PROP_TOKENS.map(cssVar),
  )
}

// The app bundle is minified (#ffffff -> #fff), so compare browser-normalized colors (used values).
async function normColor(page: Page, v: string): Promise<string> {
  return page.evaluate((lit) => {
    const p = document.createElement('div')
    document.body.appendChild(p)
    p.style.color = lit
    const out = getComputedStyle(p).color
    p.remove()
    return out
  }, v)
}

async function expectColors(page: Page, brand: string, mode: 'light' | 'dark', values: Values): Promise<void> {
  const resolved = await resolvedProps(page)
  for (const [i, id] of PROP_TOKENS.entries()) {
    if (!id.startsWith('color.')) continue
    const got = await normColor(page, resolved[i]!)
    const want = await normColor(page, values[brand]![mode][id]!)
    expect(got, `${brand}/${mode}: ${id}`).toBe(want)
  }
}

test.describe('add brand c at runtime (US3 scenario 3)', () => {
  let work = ''
  let brandCss = ''
  let values: Values
  let changedSource: string[] = []
  const appSrcBefore = digest(APP_SRC)

  test.beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'patods-add-brand-'))
    const srcDir = join(work, 'pkg/src')
    cpSync(SRC, srcDir, { recursive: true })
    cpSync(join(REPO, 'packages/tokens/schemas'), join(work, 'pkg/schemas'), { recursive: true }) // vendored DTCG schemas (V-01)

    // 1) brand context in the resolver
    const resolverPath = join(srcDir, 'tokens.resolver.json')
    const resolver = JSON.parse(readFileSync(resolverPath, 'utf8'))
    resolver.modifiers.brand.contexts.c = [{ $ref: './semantic/brand/c.tokens.json' }]
    writeFileSync(resolverPath, JSON.stringify(resolver, null, 2))

    // 2) brand c file: same key set as b (token-source §7.4), distinct values so a switch is observable
    const c = JSON.parse(readFileSync(join(srcDir, 'semantic/brand/b.tokens.json'), 'utf8'))
    c.$description = 'Synthetic brand C. brand.* tokens (role brand-mode-source, FR-033).'
    c.brand.color.bg.accent.light.$value = '{color.neutral.600}'
    c.brand.color.bg.surface.light.$value = '{color.neutral.100}'
    writeFileSync(join(srcDir, 'semantic/brand/c.tokens.json'), JSON.stringify(c, null, 2))

    // 3) rebuild with the real CLI (validation + generation)
    execFileSync(process.execPath, [CLI, 'build', '--src', srcDir], { cwd: join(work, 'pkg'), stdio: 'pipe' })

    brandCss = readFileSync(join(work, 'pkg/dist/css/brand-c.css'), 'utf8')
    const mod = await import(pathToFileURL(join(work, 'pkg/dist/esm/values.js')).href)
    values = mod.values as Values

    // Token-only diff: every changed/added source file is under the tokens source tree.
    const before = digest(SRC)
    const after = digest(srcDir)
    changedSource = Object.keys(after).filter((f) => before[f] !== after[f])
  })

  test.afterAll(() => {
    if (work) rmSync(work, { recursive: true, force: true })
  })

  test('the diff is tokens-only: resolver + c.tokens.json, no component code (FR-009, SC-005)', () => {
    expect(changedSource.sort()).toEqual(['semantic/brand/c.tokens.json', 'tokens.resolver.json'])
    expect(Object.keys(values)).toContain('c')
    expect(digest(APP_SRC)).toEqual(appSrcBefore) // example app source untouched by this flow
  })

  test('switching to brand c at runtime changes resolved values without reload', async ({ page }) => {
    await page.goto('/')
    const root = page.locator('html')
    await root.evaluate((r) => {
      r.setAttribute('data-patods-brand', 'a')
      r.setAttribute('data-patods-mode', 'light')
      ;(window as unknown as { __noReload: boolean }).__noReload = true
    })
    const onA = await resolvedProps(page)

    // The new brand ships as one more CSS file; no component/app code involved.
    await page.addStyleTag({ content: brandCss })

    for (const mode of ['light', 'dark'] as const) {
      await root.evaluate((r, m) => {
        r.setAttribute('data-patods-brand', 'c')
        r.setAttribute('data-patods-mode', m)
      }, mode)
      const onC = await resolvedProps(page)
      await expectColors(page, 'c', mode, values)
      if (mode === 'light') {
        // brand c really differs from a on a brand-dependent token (the switch is observable)
        expect(onC).not.toEqual(onA)
        expect(values['c']!.light['color.bg.accent']).not.toBe(values['a']!.light['color.bg.accent'])
      }
    }

    // Same document: no reload happened.
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true)

    // a and b keep working after c is present.
    for (const brand of ['a', 'b'] as const) {
      await root.evaluate((r, b) => {
        r.setAttribute('data-patods-brand', b)
        r.setAttribute('data-patods-mode', 'light')
      }, brand)
      await expectColors(page, brand, 'light', values)
    }
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true)
  })
})
