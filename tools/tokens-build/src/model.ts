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
  type: string
  scale?: 'control-height'
  deprecated: boolean | string
  description?: string
  file: string
  aliasOf?: string
  aliasChain?: string[]
  hasAlias: boolean
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
    const placement: Placement = role === 'brand-mode-source' ? 'brand' : 'base'
    const t: ModelToken = {
      id,
      segments,
      cssName: `--${PREFIX}-${segments.join('-')}`,
      // For brand-mode-source (reserved "brand." group), the category is the 2nd segment (D7).
      category: (bucket === 'brand' ? segments[1] : segments[0]) ?? '',
      layer: BUCKET_LAYER[bucket],
      axis: BUCKET_AXIS[bucket],
      role,
      placement,
      type: base?.$type ?? '',
      deprecated: base?.$deprecated ?? false,
      description: base?.$description,
      file: info.file,
      aliasOf: base?.aliasOf,
      aliasChain: base?.aliasChain,
      hasAlias: hasAlias(base),
      raw: base,
    }
    if (t.layer === 'semantic' && t.id.startsWith('size.control.')) t.scale = 'control-height'
    tokens.push(t)
    byId.set(id, t)
  }
  tokens.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { tokens, byId, load }
}
