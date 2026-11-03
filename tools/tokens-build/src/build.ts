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
  const prims = model.tokens.filter((t) => t.layer === 'primitive').sort(byCss)
  const primDecls = prims.map((t) => `${t.cssName}: ${emitValue(t.type, t.raw.$value, t.id)};`)

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
  const sources = model.tokens.filter((t) => t.role === 'brand-mode-source').sort(byCss)
  const set = applied.get(`${brand}/light`)!
  const decls = sources.map((t) => {
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

function renderEsm(model: Model): { js: string; dts: string } {
  const toks = publicTokens(model)
  const entries = toks.map((t) => `  ${JSON.stringify(t.id)}: ${JSON.stringify(varRef(t.id))},`)
  const js = `// Generated by @patods/tokens-build. Do not edit.\nexport const tokens = Object.freeze({\n${entries.join('\n')}\n})\n`
  const typeEntries = toks.map((t) => `  readonly ${JSON.stringify(t.id)}: ${JSON.stringify(varRef(t.id))}`)
  const dts = `export declare const tokens: {\n${typeEntries.join('\n')}\n}\nexport type TokenName = keyof typeof tokens\n`
  return { js, dts }
}

function renderValues(model: Model, meta: ResolverMeta, applied: Map<string, Record<string, any>>): { js: string; dts: string } {
  const toks = publicTokens(model)
  const obj: Record<string, Record<string, Record<string, string>>> = {}
  for (const brand of meta.brands) {
    obj[brand] = {}
    for (const mode of meta.modes) {
      const set = applied.get(`${brand}/${mode}`)!
      const row: Record<string, string> = {}
      for (const t of toks) {
        const v = set[t.id]?.$value
        if (v !== undefined) row[t.id] = emitValue(t.type, v, t.id)
      }
      obj[brand]![mode] = row
    }
  }
  const js = `// Generated by @patods/tokens-build. Do not edit.\nexport const values = Object.freeze(${JSON.stringify(obj, null, 2)})\n`
  const dts = `export type Brand = ${meta.brands.map((b) => JSON.stringify(b)).join(' | ')}\nexport type Mode = ${meta.modes.map((m) => JSON.stringify(m)).join(' | ')}\nexport declare const values: Readonly<Record<Brand, Record<Mode, Record<string, string>>>>\n`
  return { js, dts }
}

function renderTokensManifest(model: Model, meta: ResolverMeta, applied: Map<string, Record<string, any>>, layerOrder: string[]): any {
  const permIds = [...applied.keys()].sort()
  const tokens = model.tokens
    .filter((t) => t.role === 'public' || t.role === 'brand-mode-source')
    .map((t) => {
      const color: Record<string, string> = {}
      if (t.type === 'color') {
        for (const pid of permIds) {
          const v = applied.get(pid)![t.id]?.$value
          if (v) color[pid] = emitValue('color', v, t.id)
        }
      }
      return {
        id: t.id,
        cssName: t.cssName,
        layer: t.layer,
        category: t.category,
        type: t.type,
        axis: t.axis,
        role: t.role,
        placement: t.placement,
        scale: t.scale ?? null,
        aliasChain: t.aliasChain ?? null,
        color: t.type === 'color' ? { emitted: color } : null,
        file: t.file,
      }
    })
  return {
    format: `${PREFIX}.tokens-manifest`,
    version: 1,
    attributes: { brand: ATTR_BRAND, mode: ATTR_MODE },
    brands: meta.brands.map((id) => ({ id, default: id === meta.defaultBrand })),
    modes: meta.modes.map((id) => ({ id, default: id === meta.defaultMode })),
    layerOrder,
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

function renderApi(model: Model, meta: ResolverMeta): any {
  return {
    format: `${PREFIX}.tokens-api`,
    version: 1,
    package: '@patods/tokens',
    brands: meta.brands,
    modes: meta.modes,
    tokens: publicTokens(model).map((t) => t.id),
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
    esm: renderEsm(model),
    vals: renderValues(model, meta, applied),
    manifest: renderTokensManifest(model, meta, applied, layerOrder),
    syncManifest: renderSyncManifest(model, meta),
    api: renderApi(model, meta),
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
  await writeText(join(dist, 'meta/report.json'), canonicalJson(renderReport(model, meta, files)))
  await writeText(join(pkgDir, 'api/tokens.api.json'), canonicalJson(api))
}
