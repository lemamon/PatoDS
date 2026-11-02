// PatoDS tokens example: consumes the PACKAGED @patods/tokens tarball (never the
// source), proving the generated CSS and the typed value map agree at runtime
// (FR-012..FR-014, SC-006, SC-007). Brand and mode are independent axes selected
// by the `data-patods-brand` / `data-patods-mode` attributes.
import '@patods/tokens/css/base.css'
import '@patods/tokens/css/brand-a.css'
import '@patods/tokens/css/brand-b.css'
import './style.css'
import { tokens } from '@patods/tokens'
import { values, type Brand, type Mode } from '@patods/tokens/values'

const BRANDS: Brand[] = ['a', 'b']
const MODES: Mode[] = ['light', 'dark']

// Semantic tokens shown in the live comparison table.
const SAMPLE_TOKENS = [
  'color.bg.surface',
  'color.fg.default',
  'color.bg.accent',
  'color.fg.on-accent',
  'color.border.default',
] as const

const cssName = (id: string): string => `--patods-${id.replace(/\./g, '-')}`

function applyScope(brand: Brand, mode: Mode): void {
  const root = document.documentElement
  root.setAttribute('data-patods-brand', brand)
  root.setAttribute('data-patods-mode', mode)
}

/** Value the browser actually resolves for a custom property at the document root. */
function resolved(id: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssName(id)).trim()
}

function renderRows(brand: Brand, mode: Mode): string {
  return SAMPLE_TOKENS.map((id) => {
    const expected = values[brand][mode][id]
    const actual = resolved(id)
    const match = expected === actual
    return `<tr data-token="${id}" data-match="${match}">
      <td><code>${id}</code></td>
      <td><span class="swatch" style="background: var(${cssName(id)})"></span><code>${actual}</code></td>
      <td><code>${expected}</code></td>
      <td class="match">${match ? '✓' : '✗'}</td>
    </tr>`
  }).join('')
}

function layout(): string {
  const options = (items: readonly string[], current: string) =>
    items.map((v) => `<option value="${v}"${v === current ? ' selected' : ''}>${v}</option>`).join('')

  return `
    <section class="panel">
      <h1>PatoDS tokens</h1>
      <p class="muted">Consuming the packaged <code>@patods/tokens</code> tarball.</p>

      <div class="controls">
        <label>Brand
          <select id="brand">${options(BRANDS, 'a')}</select>
        </label>
        <label>Mode
          <select id="mode">${options(MODES, 'light')}</select>
        </label>
      </div>

      <div class="samples">
        <article class="card">
          <h2>Surface card</h2>
          <p>Text on a brand surface. Border and radius come from tokens.</p>
          <button class="accent" type="button">Accent action</button>
        </article>
      </div>

      <table class="values">
        <caption>CSS output (resolved) vs. typed <code>values</code> map</caption>
        <thead>
          <tr><th>Token</th><th>Resolved (CSS)</th><th>values[brand][mode]</th><th>=</th></tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>

      <p class="muted">
        <code>tokens['color.fg.default']</code> = <code>${tokens['color.fg.default']}</code>
      </p>
    </section>`
}

function main(): void {
  const app = document.getElementById('app')!
  app.innerHTML = layout()

  const brandSel = document.getElementById('brand') as HTMLSelectElement
  const modeSel = document.getElementById('mode') as HTMLSelectElement
  const rows = document.getElementById('rows')!

  const update = () => {
    const brand = brandSel.value as Brand
    const mode = modeSel.value as Mode
    applyScope(brand, mode)
    // Read resolved values after the scope is applied.
    rows.innerHTML = renderRows(brand, mode)
  }

  brandSel.addEventListener('change', update)
  modeSel.addEventListener('change', update)
  update()
}

main()
