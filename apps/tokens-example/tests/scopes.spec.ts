import { test, expect, type Page } from '@playwright/test'
import {
  assertScope,
  assertEmpty,
  assertUsedValues,
  blankWithCss,
  setBody,
  effective,
  cssVar,
  expected,
  PROP_TOKENS,
} from './helpers'

const B = (b: string) => `data-patods-brand="${b}"`
const M = (m: string) => `data-patods-mode="${m}"`

/** Strip the demo's runtime attributes/markup so the document root carries no scope. */
async function resetRoot(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-patods-brand')
    document.documentElement.removeAttribute('data-patods-mode')
    document.body.innerHTML = ''
  })
}

async function setRoot(page: Page, attrs: { brand?: string; mode?: string }): Promise<void> {
  await page.evaluate((a) => {
    const r = document.documentElement
    if (a.brand === undefined) r.removeAttribute('data-patods-brand')
    else r.setAttribute('data-patods-brand', a.brand)
    if (a.mode === undefined) r.removeAttribute('data-patods-mode')
    else r.setAttribute('data-patods-mode', a.mode)
  }, attrs)
}

async function setAttr(page: Page, testid: string, attrs: { brand?: string; mode?: string }): Promise<void> {
  await page.evaluate(
    ([id, a]) => {
      const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement
      if (a.brand === undefined) el.removeAttribute('data-patods-brand')
      else el.setAttribute('data-patods-brand', a.brand)
      if (a.mode === undefined) el.removeAttribute('data-patods-mode')
      else el.setAttribute('data-patods-mode', a.mode)
    },
    [testid, attrs] as const,
  )
}

// Exact custom-property equality is asserted against the PUBLISHED (non-minified) tarball CSS,
// which is byte-identical to the values map (SC-007). A consumer's CSS minifier may normalize
// equivalent numbers (0.5rem -> .5rem); that semantic equivalence is covered by BR-19 instead.
test.describe('scopes (base + a + b, published CSS)', () => {
  test.beforeEach(async ({ page }) => {
    await blankWithCss(page, ['base.css', 'brand-a.css', 'brand-b.css'])
  })

  test('BR-01 no attributes: default brand and light', async ({ page }) => {
    await setBody(page, `<div data-testid="r"><div data-testid="c"></div></div>`)
    await assertScope(page, 'r', 'a', 'light')
    await assertScope(page, 'c', 'a', 'light')
  })

  test('BR-02 only mode=dark on the root: default brand, dark across the tree', async ({ page }) => {
    await setRoot(page, { mode: 'dark' })
    await setBody(page, `<div data-testid="r"><div data-testid="c"></div></div>`)
    await assertScope(page, 'r', 'a', 'dark')
    await assertScope(page, 'c', 'a', 'dark')
  })

  test('BR-03 mode-only inner scope; sibling returns to outer mode', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('a')} ${M('light')} data-testid="outer">
         <div ${M('dark')} data-testid="inner"><div data-testid="inner-child"></div></div>
         <div data-testid="sibling"></div>
       </div>`,
    )
    await assertScope(page, 'inner', 'a', 'dark')
    await assertScope(page, 'inner-child', 'a', 'dark')
    await assertScope(page, 'sibling', 'a', 'light')
  })

  test('BR-04 brand-only scope inherits the mode', async ({ page }) => {
    await setBody(
      page,
      `<div ${M('dark')} data-testid="outer">
         <div ${B('b')} data-testid="el"><div data-testid="child"></div></div>
       </div>`,
    )
    await assertScope(page, 'el', 'b', 'dark')
    await assertScope(page, 'child', 'b', 'dark')
  })

  test('BR-05 a > b > a uses inner a with the nearest mode', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('a')} ${M('dark')} data-testid="l1">
         <div ${B('b')} data-testid="l2">
           <div ${B('a')} data-testid="l3"></div>
         </div>
       </div>`,
    )
    await assertScope(page, 'l1', 'a', 'dark')
    await assertScope(page, 'l2', 'b', 'dark')
    await assertScope(page, 'l3', 'a', 'dark')
  })

  test('BR-06 alternating mode light > dark > light', async ({ page }) => {
    await setBody(
      page,
      `<div ${M('light')} data-testid="m1">
         <div ${M('dark')} data-testid="m2">
           <div ${M('light')} data-testid="m3"></div>
         </div>
       </div>`,
    )
    await assertScope(page, 'm1', 'a', 'light')
    await assertScope(page, 'm2', 'a', 'dark')
    await assertScope(page, 'm3', 'a', 'light')
  })

  test('BR-07 chain dark > b > a > light > b > dark', async ({ page }) => {
    await setBody(
      page,
      `<div ${M('dark')} data-testid="c1">
         <div ${B('b')} data-testid="c2">
           <div ${B('a')} data-testid="c3">
             <div ${M('light')} data-testid="c4">
               <div ${B('b')} data-testid="c5">
                 <div ${M('dark')} data-testid="c6"></div>
               </div>
             </div>
           </div>
         </div>
       </div>`,
    )
    await assertScope(page, 'c1', 'a', 'dark')
    await assertScope(page, 'c2', 'b', 'dark')
    await assertScope(page, 'c3', 'a', 'dark')
    await assertScope(page, 'c4', 'a', 'light')
    await assertScope(page, 'c5', 'b', 'light')
    await assertScope(page, 'c6', 'b', 'dark')
  })

  test('BR-08 both attributes on one element and swapped pair nested', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('a')} ${M('dark')} data-testid="p">
         <div ${B('b')} ${M('light')} data-testid="q"></div>
       </div>`,
    )
    await assertScope(page, 'p', 'a', 'dark')
    await assertScope(page, 'q', 'b', 'light')
  })

  test('BR-09 brand-only scope with no mode ancestor: that brand with light', async ({ page }) => {
    await setBody(page, `<div ${B('b')} data-testid="el"></div>`)
    await assertScope(page, 'el', 'b', 'light')
  })

  test('BR-10 invalid values inherit the nearest valid ancestor', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('b')} ${M('dark')} data-testid="base">
         <div ${B('zzz')} data-testid="unknown-brand"></div>
         <div ${B('')} data-testid="empty-brand"></div>
         <div ${M('sepia')} data-testid="unknown-mode"></div>
         <div ${M('')} data-testid="empty-mode"></div>
         <div ${M('Dark')} data-testid="cased-mode"></div>
         <div ${M(' dark')} data-testid="spaced-mode"></div>
       </div>`,
    )
    for (const id of ['unknown-brand', 'empty-brand', 'unknown-mode', 'empty-mode', 'cased-mode', 'spaced-mode']) {
      await assertScope(page, id, 'b', 'dark')
    }
  })

  test('BR-12 sibling after a closed nested scope keeps outer values', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('b')} ${M('dark')} data-testid="outer">
         <div ${B('a')} ${M('light')} data-testid="nested"></div>
         <div data-testid="after"></div>
       </div>`,
    )
    await assertScope(page, 'nested', 'a', 'light')
    await assertScope(page, 'after', 'b', 'dark')
  })

  test('BR-13 brand alternated across many levels then a mode-only scope', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('a')} ${M('dark')} data-testid="d1">
         <div ${B('b')} data-testid="d2">
           <div ${B('a')} data-testid="d3">
             <div ${B('b')} data-testid="d4">
               <div ${M('light')} data-testid="d5"></div>
             </div>
           </div>
         </div>
       </div>`,
    )
    await assertScope(page, 'd4', 'b', 'dark')
    await assertScope(page, 'd5', 'b', 'light')
  })

  test('BR-15 runtime set/switch/remove on root and nested, no reload', async ({ page }) => {
    await setBody(page, `<div data-testid="el"><div data-testid="child"></div></div>`)
    await assertScope(page, 'el', 'a', 'light')
    await setRoot(page, { brand: 'b', mode: 'dark' })
    await assertScope(page, 'el', 'b', 'dark')
    await setAttr(page, 'el', { brand: 'a', mode: 'light' })
    await assertScope(page, 'el', 'a', 'light')
    await assertScope(page, 'child', 'a', 'light')
    await setAttr(page, 'el', {}) // remove -> inherits root again
    await assertScope(page, 'el', 'b', 'dark')
  })

  test('BR-16 non-color tokens in nested scopes (shadow, opacity, component alias)', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('a')} ${M('light')} data-testid="outer">
         <div ${B('b')} ${M('dark')} data-testid="inner"></div>
       </div>`,
    )
    await assertScope(page, 'inner', 'b', 'dark') // includes opacity + component alias
    await assertUsedValues(page, 'inner', 'b', 'dark') // includes multi-layer shadow
  })

  test('BR-17 used values equal the reference literal', async ({ page }) => {
    await setBody(page, `<div ${B('a')} ${M('dark')} data-testid="el"></div>`)
    await assertUsedValues(page, 'el', 'a', 'dark')
  })

  test('BR-18 per-element public-token invariant across a representative tree', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('a')} data-testid="t1">
         <div ${M('dark')} data-testid="t2">
           <div ${B('b')} data-testid="t3"></div>
         </div>
       </div>`,
    )
    await assertScope(page, 't1', 'a', 'light')
    await assertScope(page, 't2', 'a', 'dark')
    await assertScope(page, 't3', 'b', 'dark')
  })

  test('BR-21 app override outside the layer wins and inherits to descendants', async ({ page }) => {
    await setBody(
      page,
      `<div ${B('a')} ${M('light')} data-testid="scope">
         <div data-testid="plain"></div>
       </div>`,
    )
    await page.evaluate(() => {
      const scope = document.querySelector('[data-testid="scope"]') as HTMLElement
      scope.style.setProperty('--patods-color-bg-surface', '#abcdef') // unlayered: beats @layer
    })
    const onScope = await page
      .locator('[data-testid="scope"]')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--patods-color-bg-surface'))
    expect(onScope).toBe('#abcdef')
    const onChild = await page
      .locator('[data-testid="plain"]')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--patods-color-bg-surface'))
    expect(onChild).toBe('#abcdef')
  })

  test('BR-20 seeded random tree: zero divergences against the oracle', async ({ page }) => {
    const SEED = 0x50a70d5 // recorded seed
    const rand = mulberry32(SEED)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!
    const choices: Array<{ brand?: string; mode?: string }> = [
      {},
      { brand: 'a' },
      { brand: 'b' },
      { mode: 'light' },
      { mode: 'dark' },
      { brand: 'a', mode: 'dark' },
      { brand: 'b', mode: 'light' },
      { brand: 'zzz' },
      { mode: 'sepia' },
    ]

    type N = { id: string; parent: string | null; attrs: { brand?: string; mode?: string } }
    const nodes: N[] = []
    let counter = 0
    const build = (depth: number, parent: string | null): string => {
      const id = `n${counter++}`
      const attrs = pick(choices)
      nodes.push({ id, parent, attrs })
      const kids = depth > 0 ? Array.from({ length: 1 + Math.floor(rand() * 2) }, () => build(depth - 1, id)) : []
      const a = [attrs.brand !== undefined ? B(attrs.brand) : '', attrs.mode !== undefined ? M(attrs.mode) : ''].join(' ')
      return `<div ${a} data-testid="${id}">${kids.join('')}</div>`
    }
    await setBody(page, build(6, null)) // depth >= 6

    const byId = new Map(nodes.map((n) => [n.id, n]))
    const chainOf = (n: N): Array<{ brand?: string; mode?: string }> => {
      const chain: Array<{ brand?: string; mode?: string }> = []
      let cur: N | undefined = n
      while (cur) {
        chain.unshift(cur.attrs)
        cur = cur.parent ? byId.get(cur.parent) : undefined
      }
      return chain
    }

    const checkAll = async () => {
      for (const n of nodes) {
        const { brand, mode } = effective(chainOf(n))
        const resolved = await page.locator(`[data-testid="${n.id}"]`).evaluate((el, vars) => {
          const cs = getComputedStyle(el)
          return vars.map((v) => cs.getPropertyValue(v))
        }, PROP_TOKENS.map(cssVar))
        PROP_TOKENS.forEach((tid, i) => {
          expect(resolved[i], `${n.id}: ${tid} @ ${brand}/${mode}`).toBe(expected(brand, mode, tid))
        })
      }
    }

    await checkAll()
    for (let i = 0; i < 60; i++) {
      const node = pick(nodes)
      node.attrs = pick(choices)
      await setAttr(page, node.id, node.attrs)
    }
    await checkAll()
  })
})

// Import-variant cases: blank page with only the chosen tarball CSS injected, in order.
test.describe('import variants (controlled CSS)', () => {
  test('BR-11 brand present in markup without its file imported behaves as invalid', async ({ page }) => {
    await blankWithCss(page, ['base.css', 'brand-a.css']) // b NOT imported
    await setBody(
      page,
      `<div ${B('a')} ${M('dark')} data-testid="base">
         <div ${B('b')} data-testid="b-missing"></div>
       </div>`,
    )
    await assertScope(page, 'b-missing', 'a', 'dark') // inherits a/dark
  })

  test('BR-14 same result regardless of import order', async ({ page }) => {
    const markup = `<div data-testid="root-default">
        <div ${B('b')} ${M('dark')} data-testid="scoped-b"></div>
      </div>`
    for (const order of [
      ['base.css', 'brand-a.css', 'brand-b.css'],
      ['base.css', 'brand-b.css', 'brand-a.css'],
      ['brand-a.css', 'base.css', 'brand-b.css'], // a brand file before base.css
    ]) {
      await blankWithCss(page, order)
      await setBody(page, markup)
      await assertScope(page, 'root-default', 'a', 'light') // default brand where no attribute
      await assertScope(page, 'scoped-b', 'b', 'dark')
    }
  })

  test('BR-14b default brand needs its file: base + b only, no attribute -> variable without value', async ({
    page,
  }) => {
    await blankWithCss(page, ['base.css', 'brand-b.css']) // a (default) NOT imported
    await setBody(page, `<div data-testid="no-attr"></div>`)
    await assertEmpty(page, 'no-attr', 'color.bg.surface')
  })

  test('BR-19 minified Vite bundle resolves to the same used values as the published CSS', async ({ page }) => {
    // Vite 8 minifies CSS (e.g. 0.5rem -> .5rem), so custom-property strings are not byte-identical;
    // the meaningful invariant is that used values are identical. Assert both substrates against the
    // same reference literals (browser-normalized), which proves semantic equivalence.
    const markup = `<div ${B('b')} ${M('dark')} data-testid="el"></div>`

    await blankWithCss(page, ['base.css', 'brand-a.css', 'brand-b.css']) // non-minified published CSS
    await setBody(page, markup)
    await assertUsedValues(page, 'el', 'b', 'dark')

    await page.goto('/') // minified Vite production bundle served by `vite preview`
    await resetRoot(page)
    await setBody(page, markup)
    await assertUsedValues(page, 'el', 'b', 'dark')
  })
})

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
