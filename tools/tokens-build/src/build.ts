// Build orchestration (US2): generates per-brand CSS (base + brand-<id>), typed ESM (index +
// values), manifests (tokens, sync) and report, deterministically. Contracts: css-output.md,
// esm-output.md, build-manifests.md.
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { PREFIX, type Model, type ModelToken } from './model.ts'
import { emitValue } from './emit.ts'
import { canonicalJson, writeText } from './write.ts'
import { lintGeneratedCss, CssLintError } from './css-lint.ts'

/** Thrown for a build configuration error (e.g. invalid layers.json); the CLI maps it to exit code 2. */
export class BuildConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BuildConfigError'
  }
}

/** Reads the single source of the layer order (layers.json); throws BuildConfigError if unusable (L-03). */
async function readLayerOrder(srcDir: string): Promise<string[]> {
  const path = join(srcDir, 'layers.json')
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    throw new BuildConfigError(`Cannot read layers.json at ${path} (L-03).`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new BuildConfigError(`Invalid JSON in layers.json: ${(err as Error).message}`)
  }
  const order = (parsed as { order?: unknown } | null)?.order
  if (!Array.isArray(order) || order.length === 0 || !order.every((x) => typeof x === 'string' && x.length > 0)) {
    throw new BuildConfigError('layers.json "order" must be a non-empty array of layer names (L-03).')
  }
  return order as string[]
}

const cssVar = (id: string) => `--${PREFIX}-${id.split('.').join('-')}`
const varRef = (id: string) => `var(${cssVar(id)})`

/** A primitive's CSS value: `var()` of its target for a whole-token alias (DEP-03/§4), else the
 * serialized literal. A `$ref` is already resolved by the parser (no aliasChain) and stays literal. */
const primValue = (t: ModelToken) =>
  t.hasAlias && t.aliasChain?.[0] ? varRef(t.aliasChain[0]) : emitValue(t.type, t.raw.$value, t.id)
const ON_LIGHT = `--${PREFIX}-_on-light`
const ON_DARK = `--${PREFIX}-_on-dark`
const LAYER = `${PREFIX}.tokens`
const ATTR_BRAND = `data-${PREFIX}-brand`
const ATTR_MODE = `data-${PREFIX}-mode`

interface ResolverMeta {
  brands: string[]
  defaultBrand: string
  modes: string[]
  defaultMode: string
}

async function readResolverMeta(srcDir: string): Promise<ResolverMeta> {
  const r = JSON.parse(await readFile(join(srcDir, 'tokens.resolver.json'), 'utf8'))
  const brand = r.modifiers?.brand
  const mode = r.modifiers?.mode
  return {
    brands: Object.keys(brand?.contexts ?? {}).sort(),
    defaultBrand: brand?.default,
    modes: Object.keys(mode?.contexts ?? {}).sort(),
    defaultMode: mode?.default,
  }
}

function appliedMap(model: Model): Map<string, Record<string, any>> {
  const m = new Map<string, Record<string, any>>()
  for (const p of model.load.permutations) {
    const brand = p.input.brand
    const mode = p.input.mode
    if (brand && mode) m.set(`${brand}/${mode}`, p.set)
  }
  return m
}

function directTarget(set: Record<string, any>, id: string): string | undefined {
  const chain = set[id]?.aliasChain
  return Array.isArray(chain) && chain.length ? chain[0] : undefined
}

function block(selector: string, decls: string[]): string {
  return `  ${selector} {\n${decls.map((d) => `    ${d}`).join('\n')}\n  }`
}

function renderBaseCss(model: Model, meta: ResolverMeta, applied: Map<string, Record<string, any>>, layerOrder: string[]): string {
  // Shared primitives only: brand-exclusive primitives are declared in their brand file (D7, §4).
  const prims = model.tokens.filter((t) => t.layer === 'primitive' && t.placement === 'base').sort(byCss)
  const primDecls = prims.map((t) => `${t.cssName}: ${primValue(t)};`)

  const defLight = `${meta.defaultBrand}/light`
  const defDark = `${meta.defaultBrand}/dark`
  const resolver: string[] = []
  for (const t of model.tokens.filter((x) => x.role === 'public' && x.layer !== 'primitive').sort(byCss)) {
    if (t.axis === 'mode') {
      const lt = directTarget(applied.get(defLight)!, t.id)
      const dt = directTarget(applied.get(defDark)!, t.id)
      if (!lt || !dt) continue
      resolver.push(`${t.cssName}: var(${ON_LIGHT}, ${varRef(lt)})var(${ON_DARK}, ${varRef(dt)});`)
    } else {
      const target = t.aliasChain?.[0]
      resolver.push(`${t.cssName}: ${target ? varRef(target) : emitValue(t.type, t.raw.$value, t.id)};`)
    }
  }

  const parts = [
    `@layer ${layerOrder.join(', ')};`,
    '',
    `@layer ${LAYER} {`,
    block(':where(:root)', primDecls),
    '',
    block(`:where(:root), [${ATTR_MODE}="light"]`, [`${ON_LIGHT}: initial;`, `${ON_DARK}: ;`, 'color-scheme: light;']),
    block(`[${ATTR_MODE}="dark"]`, [`${ON_LIGHT}: ;`, `${ON_DARK}: initial;`, 'color-scheme: dark;']),
    '',
    block(`:where(:root, [${ATTR_BRAND}], [${ATTR_MODE}])`, resolver),
    '}',
    '',
  ]
  return parts.join('\n')
}

function renderBrandCss(model: Model, brand: string, isDefault: boolean, applied: Map<string, Record<string, any>>, layerOrder: string[]): string {
  // Everything declared in the brand rule (css-output.md §4): brand-axis tokens (brand-axis public and
  // brand-mode sources, both axis `brand`) plus the primitives exclusive to this brand (D7).
  const key = [...applied.keys()].find((k) => k.startsWith(`${brand}/`))
  const set = (key && applied.get(key)) || {}
  const brandScoped = model.tokens.filter((t) => t.axis === 'brand')
  const exclusivePrims = model.tokens.filter((t) => t.layer === 'primitive' && t.exclusiveBrand === brand)
  const decls = [...brandScoped, ...exclusivePrims].sort(byCss).map((t) => {
    if (t.layer === 'primitive') return `${t.cssName}: ${primValue(t)};`
    const target = directTarget(set, t.id)
    return `${t.cssName}: ${target ? varRef(target) : emitValue(t.type, set[t.id]?.$value, t.id)};`
  })
  const selector = isDefault ? `:where(:root), [${ATTR_BRAND}="${brand}"]` : `[${ATTR_BRAND}="${brand}"]`
  return [`@layer ${layerOrder.join(', ')};`, '', `@layer ${LAYER} {`, block(selector, decls), '}', ''].join('\n')
}

function byCss(a: ModelToken, b: ModelToken): number {
  return a.cssName < b.cssName ? -1 : a.cssName > b.cssName ? 1 : 0
}

function publicTokens(model: Model): ModelToken[] {
  return model.tokens.filter((t) => t.role === 'public').sort((a, b) => (a.id < b.id ? -1 : 1))
}

/** Every published token: public semantics/primitives/component plus brand-mode sources, by code point
 * (esm-output.md §4; manifest §2.1). Private `_` names are never `public`/`brand-mode-source`. */
function publishedTokens(model: Model): ModelToken[] {
  return model.tokens
    .filter((t) => t.role === 'public' || t.role === 'brand-mode-source')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Modes in canonical order: the default first, the rest after (esm-output.md E-03). */
function canonicalModes(meta: ResolverMeta): string[] {
  return [meta.defaultMode, ...meta.modes.filter((m) => m !== meta.defaultMode)]
}

const ESM_HEADER = `/* @${PREFIX}/tokens: generated file, do not edit. */\n`

/** JSDoc for a .d.ts property, from $description/$deprecated (E-07), with terminators escaped. */
function jsdoc(t: ModelToken): string {
  const esc = (s: string) => s.replace(/\*\//g, '*\\/')
  const parts: string[] = []
  if (t.description) parts.push(esc(t.description))
  if (t.deprecated) parts.push(`@deprecated${typeof t.deprecated === 'string' ? ' ' + esc(t.deprecated) : ''}`)
  return parts.length ? `  /** ${parts.join(' ')} */\n` : ''
}

/** Serializes a value as a deeply `Object.freeze`d literal, each level carrying the PURE annotation (E-05). */
function emitFrozen(value: any, indent: number): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value)
    if (!keys.length) return '/*#__PURE__*/ Object.freeze({})'
    const pad = '  '.repeat(indent)
    const padIn = '  '.repeat(indent + 1)
    const body = keys.map((k) => `${padIn}${JSON.stringify(k)}: ${emitFrozen(value[k], indent + 1)}`).join(',\n')
    return `/*#__PURE__*/ Object.freeze({\n${body}\n${pad}})`
  }
  return JSON.stringify(value)
}

function renderEsm(model: Model, meta: ResolverMeta): { js: string; dts: string } {
  const toks = publishedTokens(model)
  const modes = canonicalModes(meta)
  const attrs = { brand: ATTR_BRAND, mode: ATTR_MODE }

  const tokenEntries = toks.map((t) => `  ${JSON.stringify(t.id)}: ${JSON.stringify(varRef(t.id))}`).join(',\n')
  const js =
    ESM_HEADER +
    `export const attributes = /*#__PURE__*/ Object.freeze(${JSON.stringify(attrs, null, 2)});\n` +
    `export const brands = /*#__PURE__*/ Object.freeze(${JSON.stringify(meta.brands)});\n` +
    `export const defaultBrand = ${JSON.stringify(meta.defaultBrand)};\n` +
    `export const defaultMode = ${JSON.stringify(meta.defaultMode)};\n` +
    `export const modes = /*#__PURE__*/ Object.freeze(${JSON.stringify(modes)});\n` +
    `export const tokens = /*#__PURE__*/ Object.freeze({\n${tokenEntries}\n});\n`

  const tuple = (xs: string[]) => `readonly [${xs.map((x) => JSON.stringify(x)).join(', ')}]`
  const nameUnion = toks.map((t) => `  | ${JSON.stringify(t.id)}`).join('\n')
  const refProps = toks.map((t) => `${jsdoc(t)}  readonly ${JSON.stringify(t.id)}: ${JSON.stringify(varRef(t.id))};`).join('\n')
  const dts =
    ESM_HEADER +
    `export type Brand = ${meta.brands.map((b) => JSON.stringify(b)).join(' | ')};\n` +
    `export type Mode = ${modes.map((m) => JSON.stringify(m)).join(' | ')};\n` +
    `export type TokenName =\n${nameUnion};\n` +
    `export type TokenRefs = {\n${refProps}\n};\n` +
    `export type TokenRef = TokenRefs[TokenName];\n` +
    `export declare const attributes: {\n  readonly brand: ${JSON.stringify(ATTR_BRAND)};\n  readonly mode: ${JSON.stringify(ATTR_MODE)};\n};\n` +
    `export declare const brands: ${tuple(meta.brands)};\n` +
    `export declare const defaultBrand: ${JSON.stringify(meta.defaultBrand)};\n` +
    `export declare const defaultMode: ${JSON.stringify(meta.defaultMode)};\n` +
    `export declare const modes: ${tuple(modes)};\n` +
    `export declare const tokens: TokenRefs;\n`
  return { js, dts }
}

function renderValues(model: Model, meta: ResolverMeta, applied: Map<string, Record<string, any>>): { js: string; dts: string } {
  const toks = publishedTokens(model)
  const modes = canonicalModes(meta)
  const obj: Record<string, Record<string, Record<string, string>>> = {}
  for (const brand of meta.brands) {
    obj[brand] = {}
    for (const mode of modes) {
      const set = applied.get(`${brand}/${mode}`)!
      const row: Record<string, string> = {}
      for (const t of toks) {
        const v = set[t.id]?.$value
        if (v !== undefined) row[t.id] = emitValue(t.type, v, t.id)
      }
      obj[brand]![mode] = row
    }
  }
  const js = ESM_HEADER + `export const values = ${emitFrozen(obj, 0)};\n`
  const dts =
    ESM_HEADER +
    `import type { Brand, Mode, TokenName } from "./index.js";\n` +
    `export type { Brand, Mode, TokenName } from "./index.js";\n` +
    `export type TokenValues = Readonly<Record<Brand, Readonly<Record<Mode, Readonly<Record<TokenName, string>>>>>>;\n` +
    `export declare const values: TokenValues;\n`
  return { js, dts }
}

/** Direct one-hop alias target per context key (§2.2 `aliasOf`): `"*"` for invariant, brand id for the
 * brand axis, mode id for the mode axis. Null for primitives (and any literal). */
function aliasOfOf(t: ModelToken, meta: ResolverMeta, applied: Map<string, Record<string, any>>): Record<string, string> | null {
  if (t.layer === 'primitive' || !t.hasAlias) return null
  const direct = (perm: string): string | undefined => {
    const c = applied.get(perm)?.[t.id]?.aliasChain
    return Array.isArray(c) && c.length ? c[0] : undefined
  }
  const out: Record<string, string> = {}
  if (t.axis === 'mode') {
    for (const m of meta.modes) { const d = direct(`${meta.defaultBrand}/${m}`); if (d) out[m] = d }
  } else if (t.axis === 'brand') {
    for (const b of meta.brands) { const d = direct(`${b}/${meta.defaultMode}`); if (d) out[b] = d }
  } else {
    const d = direct(`${meta.defaultBrand}/${meta.defaultMode}`); if (d) out['*'] = d
  }
  return Object.keys(out).length ? out : null
}

/** Per-permutation alias chain from the token down to the terminal primitive, inclusive (§2.2
 * `aliasChains`, M-07 keys === permutations). Null for primitives (and any literal). */
function aliasChainsOf(t: ModelToken, permIds: string[], applied: Map<string, Record<string, any>>): Record<string, string[]> | null {
  if (t.layer === 'primitive' || !t.hasAlias) return null
  const out: Record<string, string[]> = {}
  for (const pid of permIds) {
    const chain = applied.get(pid)?.[t.id]?.aliasChain
    out[pid] = Array.isArray(chain) ? [t.id, ...chain] : [t.id]
  }
  return out
}

/** `color` block (§2.3): `emitted` per permutation (the string as emitted in CSS/`./values`); `value`
 * — the resolved DTCG color value per permutation (the generator's source of truth, a plain `color`
 * only; `null` for a composite), which the contrast checker passes through `toEmittedSrgb()` to verify
 * G-2 independently (`emitted-mismatch`); and `subRefs` — the color-token paths aliased by a
 * shadow/border composite's subvalues (per permutation, in subvalue order), or `null` for a plain
 * `color`. Null for non-color, non-composite types. */
function colorOf(t: ModelToken, permIds: string[], applied: Map<string, Record<string, any>>, byId: Map<string, ModelToken>): { emitted: Record<string, string>; value: Record<string, any> | null; subRefs: Record<string, string[]> | null } | null {
  const composite = t.type === 'shadow' || t.type === 'border'
  if (t.type !== 'color' && !composite) return null
  const emitted: Record<string, string> = {}
  let value: Record<string, any> | null = composite ? null : {}
  for (const pid of permIds) {
    const v = applied.get(pid)?.[t.id]?.$value
    if (v !== undefined) {
      emitted[pid] = emitValue(t.type, v, t.id)
      // For a plain color, the resolved DTCG value (colorSpace + components + alpha) is the generator's
      // source of truth; the checker recomputes toEmittedSrgb() on it to prove measured = emitted (G-2).
      if (value) value[pid] = v
    }
  }
  let subRefs: Record<string, string[]> | null = null
  if (composite) {
    // Color tokens aliased by the composite subvalues (source-form direct refs, filtered to color type).
    const colorPaths = t.directRefs.filter((id) => byId.get(id)?.type === 'color')
    subRefs = {}
    for (const pid of permIds) subRefs[pid] = colorPaths
  }
  return { emitted, value, subRefs }
}

function renderTokensManifest(model: Model, meta: ResolverMeta, applied: Map<string, Record<string, any>>, layerOrder: string[]): any {
  const permIds = [...applied.keys()].sort()
  const tokens = publishedTokens(model).map((t) => ({
    path: t.id,
    cssName: t.cssName,
    layer: t.layer,
    category: t.category,
    type: t.type,
    axis: t.axis,
    role: t.role,
    placement: t.placement,
    exclusiveBrand: t.exclusiveBrand ?? null,
    aliasOf: aliasOfOf(t, meta, applied),
    aliasChains: aliasChainsOf(t, permIds, applied),
    scale: t.scale ?? null,
    color: colorOf(t, permIds, applied, model.byId),
    deprecated: t.deprecated,
    description: t.description ?? null,
    source: { file: `src/${t.file}`, line: t.sourceLine, column: t.sourceColumn },
  }))
  return {
    format: `${PREFIX}.tokens-manifest`,
    version: 1,
    attributes: { brand: ATTR_BRAND, mode: ATTR_MODE },
    brands: meta.brands.map((id) => ({ id, default: id === meta.defaultBrand, file: `dist/css/brand-${id}.css` })),
    modes: meta.modes.map((id) => ({ id, default: id === meta.defaultMode })),
    layerOrder,
    package: `@${PREFIX}/tokens`,
    permutations: permIds,
    scales: {
      'control-height': model.tokens.filter((t) => t.scale === 'control-height').map((t) => t.id).sort(),
    },
    tokens,
  }
}

function renderSyncManifest(model: Model, meta: ResolverMeta): any {
  return {
    format: `${PREFIX}.sync-manifest`,
    version: 1,
    axes: { brand: meta.brands, mode: meta.modes },
    variables: publicTokens(model).map((t) => ({ path: t.segments, type: t.type, axis: t.axis })),
  }
}

function renderReport(model: Model, meta: ResolverMeta, files: { path: string; bytes: number; gzipBytes: number }[]): any {
  const categories: Record<string, any> = {}
  for (const t of model.tokens) {
    const c = (categories[t.category] ??= { category: t.category, primitive: 0, semantic: 0, component: 0 })
    c[t.layer] += 1
  }
  return {
    format: `${PREFIX}.tokens-report`,
    version: 1,
    categories: Object.values(categories),
    controlHeight: model.tokens.filter((t) => t.scale === 'control-height').map((t) => t.id).sort(),
    files,
    permutations: [...appliedMap(model).keys()].sort(),
    totals: {
      primitive: model.tokens.filter((t) => t.layer === 'primitive').length,
      semantic: model.tokens.filter((t) => t.layer === 'semantic').length,
      component: model.tokens.filter((t) => t.layer === 'component').length,
    },
  }
}

/** Markdown twin of the report (build-manifests.md §4): the same data in tables, no timestamp (G-3). */
function renderReportMd(report: any): string {
  const lines: string[] = ['# Tokens report', '']
  lines.push('## Totals (primitive / semantic / component)', '')
  lines.push(`${report.totals.primitive} / ${report.totals.semantic} / ${report.totals.component}`, '')
  lines.push('## Count per category', '', '| category | primitive | semantic | component |', '| --- | --- | --- | --- |')
  for (const c of report.categories) lines.push(`| ${c.category} | ${c.primitive} | ${c.semantic} | ${c.component} |`)
  lines.push('', '## Control-height scale', '', report.controlHeight.join(', ') || '(none)', '')
  lines.push('## Permutations', '', report.permutations.join(', '), '')
  lines.push('## Files (bytes / gzip)', '', '| path | bytes | gzip |', '| --- | --- | --- |')
  for (const f of report.files) lines.push(`| ${f.path} | ${f.bytes} | ${f.gzipBytes} |`)
  return lines.join('\n') + '\n'
}

// ESM export surface (esm-output.md §4/§5), each list ordered by name (code point) per §11.1.
const ENTRY_DOT_EXPORTS = [
  { kind: 'type', name: 'Brand' },
  { kind: 'type', name: 'Mode' },
  { kind: 'type', name: 'TokenName' },
  { kind: 'type', name: 'TokenRef' },
  { kind: 'type', name: 'TokenRefs' },
  { kind: 'const', name: 'attributes' },
  { kind: 'const', name: 'brands' },
  { kind: 'const', name: 'defaultBrand' },
  { kind: 'const', name: 'defaultMode' },
  { kind: 'const', name: 'modes' },
  { kind: 'const', name: 'tokens' },
]
const ENTRY_VALUES_EXPORTS = [
  { kind: 'type', name: 'Brand' },
  { kind: 'type', name: 'Mode' },
  { kind: 'type', name: 'TokenName' },
  { kind: 'type', name: 'TokenValues' },
  { kind: 'const', name: 'values' },
]

/** API report (esm-output.md §11): the public surface — css, theme, export entries and per-token
 * metadata (no values or descriptions) — input to the GOV-01 major/minor/patch classification. */
function renderApi(model: Model, meta: ResolverMeta, layerOrder: string[]): any {
  return {
    format: `${PREFIX}.tokens-api`,
    version: 1,
    package: `@${PREFIX}/tokens`,
    css: { layer: LAYER, layerOrder },
    theme: {
      attributes: { brand: ATTR_BRAND, mode: ATTR_MODE },
      brands: meta.brands,
      defaultBrand: meta.defaultBrand,
      defaultMode: meta.defaultMode,
      modes: canonicalModes(meta),
    },
    entries: [
      { exports: ENTRY_DOT_EXPORTS, kind: 'esm', path: '.' },
      { exports: ENTRY_VALUES_EXPORTS, kind: 'esm', path: './values' },
      { kind: 'css', path: './css/base.css' },
      { files: meta.brands.map((b) => `./css/brand-${b}.css`), kind: 'css', path: './css/brand-*.css' },
      {
        files: [
          { path: './meta/report.json', version: 1 },
          { path: './meta/report.md' },
          { path: './meta/sync-manifest.json', version: 1 },
          { path: './meta/tokens.manifest.json', version: 1 },
        ],
        kind: 'meta',
        path: './meta/*',
      },
    ],
    tokens: publishedTokens(model).map((t) => {
      const tok: Record<string, unknown> = {
        axis: t.axis,
        category: t.category,
        cssName: t.cssName,
        deprecated: t.deprecated,
        layer: t.layer,
        name: t.id,
        placement: t.placement,
        role: t.role,
        type: t.type,
      }
      if (t.exclusiveBrand) tok.exclusiveBrand = t.exclusiveBrand
      return tok
    }),
  }
}

export interface RenderedBuild {
  meta: ResolverMeta
  layerOrder: string[]
  cssOut: { leaf: string; css: string }[]
  esm: { js: string; dts: string }
  vals: { js: string; dts: string }
  manifest: ReturnType<typeof renderTokensManifest>
  syncManifest: ReturnType<typeof renderSyncManifest>
  api: ReturnType<typeof renderApi>
}

/** Renders every build output in memory (no I/O), so it can be linted before writing (css-output.md §13). */
export async function renderAll(model: Model, srcDir: string): Promise<RenderedBuild> {
  const meta = await readResolverMeta(srcDir)
  const applied = appliedMap(model)
  const layerOrder = await readLayerOrder(srcDir)
  const cssOut = [
    { leaf: 'base.css', css: renderBaseCss(model, meta, applied, layerOrder) },
    ...meta.brands.map((brand) => ({
      leaf: `brand-${brand}.css`,
      css: renderBrandCss(model, brand, brand === meta.defaultBrand, applied, layerOrder),
    })),
  ]
  return {
    meta,
    layerOrder,
    cssOut,
    esm: renderEsm(model, meta),
    vals: renderValues(model, meta, applied),
    manifest: renderTokensManifest(model, meta, applied, layerOrder),
    syncManifest: renderSyncManifest(model, meta),
    api: renderApi(model, meta, layerOrder),
  }
}

/** Builds the generated-CSS lint input from a rendered build. */
export function lintInputFrom(model: Model, r: RenderedBuild) {
  return {
    cssFiles: r.cssOut.map((f) => ({ rel: f.leaf, css: f.css })),
    model,
    meta: r.meta,
    layerOrder: r.layerOrder,
    esm: r.esm,
    manifest: r.manifest,
    api: r.api,
  }
}

export async function runBuild(model: Model, srcDir: string): Promise<void> {
  const pkgDir = resolve(srcDir, '..')
  const dist = join(pkgDir, 'dist')
  const r = await renderAll(model, srcDir)
  const { meta, cssOut, esm, vals, manifest, syncManifest, api } = r

  // Generated-CSS lint gate: any finding aborts the build with no artifact written (exit 1).
  const findings = lintGeneratedCss(lintInputFrom(model, r))
  if (findings.length > 0) throw new CssLintError(findings)

  // CSS
  const files: { path: string; bytes: number; gzipBytes: number }[] = []
  const writeCss = async (rel: string, css: string) => {
    await writeText(join(dist, rel), css)
    files.push({ path: `dist/${rel}`, bytes: Buffer.byteLength(css), gzipBytes: gzipSync(Buffer.from(css), { level: 9 }).length })
  }
  for (const f of cssOut) await writeCss(`css/${f.leaf}`, f.css)

  // ESM
  await writeText(join(dist, 'esm/index.js'), esm.js)
  await writeText(join(dist, 'esm/index.d.ts'), esm.dts)
  await writeText(join(dist, 'esm/values.js'), vals.js)
  await writeText(join(dist, 'esm/values.d.ts'), vals.dts)

  // Manifests and report
  await writeText(join(dist, 'meta/tokens.manifest.json'), canonicalJson(manifest))
  await writeText(join(dist, 'meta/sync-manifest.json'), canonicalJson(syncManifest))
  const report = renderReport(model, meta, files)
  await writeText(join(dist, 'meta/report.json'), canonicalJson(report))
  await writeText(join(dist, 'meta/report.md'), renderReportMd(report))
  await writeText(join(pkgDir, 'api/tokens.api.json'), canonicalJson(api))
}
