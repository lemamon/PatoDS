// Internal token model (data-model "Token"), derived from the adapter result. Parser-agnostic:
// validators and formatters operate only on this model.
import type { LoadResult, Bucket } from './adapter.ts'

export const PREFIX = 'patods'

export type Layer = 'primitive' | 'semantic' | 'component'
export type Axis = 'invariant' | 'brand' | 'mode'
export type Role = 'public' | 'brand-mode-source'
export type Placement = 'base' | 'brand' | 'brand-exclusive'

export const CATEGORIES = [
  'color',
  'typography',
  'space',
  'size',
  'radius',
  'border',
  'shadow',
  'motion',
  'z-index',
  'breakpoint',
  'opacity',
] as const
export type Category = (typeof CATEGORIES)[number]

export interface ModelToken {
  id: string
  segments: string[]
  cssName: string
  category: string
  layer: Layer
  axis: Axis
  role: Role
  placement: Placement
  /** Brand id when `placement` is `brand-exclusive`; absent otherwise (build-manifests.md §2.2, M-08). */
  exclusiveBrand?: string
  type: string
  scale?: 'control-height'
  deprecated: boolean | string
  description?: string
  file: string
  /** 1-based line/column of the token's key in its first declaring `file` (manifest §2.2 `source`). */
  sourceLine: number
  sourceColumn: number
  aliasOf?: string
  aliasChain?: string[]
  hasAlias: boolean
  /** Ids this token references by a direct `{path}` alias in the source (V-04 direction). Empty for a
   * literal. Read from the source-form index, not the resolved alias leaf. */
  directRefs: string[]
  raw: any
}

const BUCKET_LAYER: Record<Bucket, Layer> = {
  primitive: 'primitive',
  invariant: 'semantic',
  brand: 'semantic',
  mode: 'semantic',
  component: 'component',
}
const BUCKET_AXIS: Record<Bucket, Axis> = {
  primitive: 'invariant',
  invariant: 'invariant',
  brand: 'brand',
  mode: 'mode',
  component: 'invariant',
}

function hasAlias(t: any): boolean {
  if (!t) return false
  if (t.aliasOf) return true
  if (Array.isArray(t.aliasChain) && t.aliasChain.length > 0) return true
  if (t.partialAliasOf && typeof t.partialAliasOf === 'object') {
    const vals = Object.values(t.partialAliasOf)
    return vals.length > 0 && vals.every((v) => v !== undefined && v !== null)
  }
  return false
}

export interface Model {
  tokens: ModelToken[]
  byId: Map<string, ModelToken>
  load: LoadResult
}

/** Builds the model from the adapter result. */
export function buildModel(load: LoadResult): Model {
  const tokens: ModelToken[] = []
  const byId = new Map<string, ModelToken>()
  for (const [id, info] of load.decl) {
    const base = load.tokens[id]
    const segments = id.split('.')
    const bucket = info.bucket
    const role: Role = bucket === 'brand' ? 'brand-mode-source' : 'public'
    const layer = BUCKET_LAYER[bucket]
    const axis = BUCKET_AXIS[bucket]
    // Placement by declaration scope (css-output.md §4): axis-brand tokens (brand-axis public and
    // brand-mode sources) live in the brand files; mode/invariant/component in base. Primitives are
    // settled by the D7 partition below (base, unless exclusive to one brand).
    const placement: Placement = layer === 'primitive' ? 'base' : axis === 'brand' ? 'brand' : 'base'
    const t: ModelToken = {
      id,
      segments,
      cssName: `--${PREFIX}-${segments.join('-')}`,
      // For brand-mode-source (reserved "brand." group), the category is the 2nd segment (D7).
      category: (bucket === 'brand' ? segments[1] : segments[0]) ?? '',
      layer,
      axis,
      role,
      placement,
      type: base?.$type ?? '',
      deprecated: base?.$deprecated ?? false,
      description: base?.$description,
      file: info.file,
      sourceLine: info.line,
      sourceColumn: info.column,
      aliasOf: base?.aliasOf,
      aliasChain: base?.aliasChain,
      hasAlias: hasAlias(base),
      directRefs: load.source?.directRefs.get(id) ?? [],
      raw: base,
    }
    if (t.layer === 'semantic' && t.id.startsWith('size.control.')) t.scale = 'control-height'
    tokens.push(t)
    byId.set(id, t)
  }
  tokens.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const [primId, brand] of deriveBrandExclusive(tokens, byId, load)) {
    const t = byId.get(primId)!
    t.placement = 'brand-exclusive'
    t.exclusiveBrand = brand
  }
  return { tokens, byId, load }
}

/** D7 primitive partition (css-output.md §4, FND-02). A primitive is exclusive to brand X when every
 * declaration that `var()`-references it belongs to brand X's scope and none to the shared base scope.
 * Attribution is by the ONE-HOP emitted `var()` target of each declaration (not the transitive chain),
 * so a primitive reached only through a brand-mode source counts for that brand, not for the mode-axis
 * token that fronts it. Primitive→primitive whole-token aliases propagate to a fixpoint (D7 clause c). */
function deriveBrandExclusive(tokens: ModelToken[], byId: Map<string, ModelToken>, load: LoadResult): Map<string, string> {
  const applied = new Map<string, Record<string, any>>()
  for (const p of load.permutations) {
    if (p.input.brand && p.input.mode) applied.set(`${p.input.brand}/${p.input.mode}`, p.set)
  }
  const brands = [...new Set(load.permutations.map((p) => p.input.brand).filter(Boolean))].sort()
  const modes = [...new Set(load.permutations.map((p) => p.input.mode).filter(Boolean))].sort()
  const isPrim = (id: string) => byId.get(id)?.layer === 'primitive'
  const directOf = (set: Record<string, any> | undefined, id: string): string | undefined => {
    const c = set?.[id]?.aliasChain
    return Array.isArray(c) && c.length ? c[0] : undefined
  }
  const baseNeeded = new Set<string>()
  const brandNeeded = new Map<string, Set<string>>()
  const addBrand = (prim: string, b: string): boolean => {
    let s = brandNeeded.get(prim)
    if (!s) brandNeeded.set(prim, (s = new Set()))
    if (s.has(b)) return false
    s.add(b)
    return true
  }
  // Seed from the one-hop direct target of every non-primitive declaration.
  for (const t of tokens) {
    if (t.layer === 'primitive') continue
    if (t.axis === 'brand') {
      for (const b of brands) {
        const d = directOf(applied.get(`${b}/${modes[0]}`), t.id)
        if (d && isPrim(d)) addBrand(d, b)
      }
    } else {
      const targets = new Set<string>()
      for (const set of applied.values()) {
        const d = directOf(set, t.id)
        if (d) targets.add(d)
      }
      for (const d of targets) if (isPrim(d)) baseNeeded.add(d)
    }
  }
  // Fixpoint over primitive→primitive whole-token aliases: a referencing primitive passes its own
  // resolved scope down to its target (an unreferenced primitive defaults to base, per D7).
  const placeOf = (id: string): string => {
    if (baseNeeded.has(id)) return 'base'
    const bs = brandNeeded.get(id)
    return bs && bs.size === 1 ? [...bs][0]! : 'base'
  }
  for (let changed = true, guard = 0; changed && guard <= tokens.length; guard++) {
    changed = false
    for (const q of tokens) {
      if (q.layer !== 'primitive' || !q.hasAlias) continue
      const target = q.aliasChain?.[0]
      if (!target || !isPrim(target)) continue
      const place = placeOf(q.id)
      if (place === 'base') {
        if (!baseNeeded.has(target)) { baseNeeded.add(target); changed = true }
      } else if (addBrand(target, place)) changed = true
    }
  }
  const out = new Map<string, string>()
  for (const t of tokens) {
    if (t.layer !== 'primitive' || baseNeeded.has(t.id)) continue
    const bs = brandNeeded.get(t.id)
    if (bs && bs.size === 1) out.set(t.id, [...bs][0]!)
  }
  return out
}
