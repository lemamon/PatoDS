// Desired state from sync-manifest.json (design-sync.md §3). The core's only desired-state input; it
// never reads the DTCG resolver syntax and never reaches packages/tokens/src (G-1, FR-025). An unknown
// format or version, or a structural violation, is MANIFEST_INVALID (CLI code 2).
import type {
  CollectionId, ContextId, SyncValue, SyncValueType, TokenKey, TokenPath,
} from '../ports.ts'
import { SyncCoreError } from './errors.ts'

export interface ManifestAxis {
  readonly id: 'brand' | 'mode'
  readonly contexts: readonly string[]
  readonly default: string
}

export interface ManifestCollection {
  readonly id: CollectionId
  readonly name: string
  readonly axis: 'brand' | 'mode' | null
}

export interface DesiredVariable {
  readonly key: TokenKey
  readonly path: TokenPath
  readonly collection: CollectionId
  readonly type: SyncValueType
  readonly role: 'public' | 'brand-mode-source'
  readonly description: string
  readonly values: Readonly<Record<ContextId, SyncValue>>
}

export interface Manifest {
  readonly format: string
  readonly version: number
  readonly source: { readonly package: string; readonly version: string }
  readonly axes: readonly ManifestAxis[]
  readonly collections: readonly ManifestCollection[]
  readonly variables: readonly DesiredVariable[]
}

export const MANIFEST_FORMAT = 'patods.sync-manifest'
/** Collection order = alias dependency order (design-sync.md §3.2). Deletes and diffs follow it. */
export const COLLECTION_ORDER: readonly CollectionId[] = ['primitive', 'brand', 'mode', 'semantic', 'component']

const VALUE_TYPES = new Set<SyncValueType>([
  'color', 'dimension', 'number', 'fontFamily', 'fontWeight', 'duration',
  'cubicBezier', 'strokeStyle', 'border', 'shadow', 'typography', 'transition',
])

function invalid(message: string): never {
  throw new SyncCoreError('MANIFEST_INVALID', 'config', message)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Parse and structurally validate a raw manifest document into the desired-state model. */
export function parseManifest(raw: unknown): Manifest {
  if (!isObject(raw)) invalid('manifest is not a JSON object')
  if (raw.format !== MANIFEST_FORMAT) invalid(`unknown manifest format ${JSON.stringify(raw.format)}; expected "${MANIFEST_FORMAT}"`)
  if (raw.version !== 1) invalid(`unknown manifest version ${JSON.stringify(raw.version)}; this core supports version 1`)

  if (!isObject(raw.source) || typeof raw.source.package !== 'string' || typeof raw.source.version !== 'string') {
    invalid('manifest.source must be { package: string, version: string }')
  }

  const axes = parseAxes(raw.axes)
  const collections = parseCollections(raw.collections)
  const collectionById = new Map(collections.map((c) => [c.id, c]))
  const axisById = new Map(axes.map((a) => [a.id, a]))
  const variables = parseVariables(raw.variables, collectionById, axisById)

  return {
    format: MANIFEST_FORMAT,
    version: 1,
    source: { package: raw.source.package, version: raw.source.version },
    axes,
    collections,
    variables,
  }
}

function parseAxes(raw: unknown): ManifestAxis[] {
  if (!Array.isArray(raw)) invalid('manifest.axes must be an array')
  const axes: ManifestAxis[] = []
  for (const a of raw) {
    if (!isObject(a) || (a.id !== 'brand' && a.id !== 'mode')) invalid('each axis needs id "brand" or "mode"')
    if (!Array.isArray(a.contexts) || a.contexts.some((c) => typeof c !== 'string') || a.contexts.length === 0) {
      invalid(`axis ${String(a.id)} needs a non-empty string contexts array`)
    }
    const contexts = a.contexts as string[]
    if (typeof a.default !== 'string' || !contexts.includes(a.default)) invalid(`axis ${a.id} default must be one of its contexts`)
    const sorted = [...contexts].sort()
    if (sorted.join('\u0000') !== contexts.join('\u0000')) invalid(`axis ${a.id} contexts must be in code-point order`)
    axes.push({ id: a.id, contexts, default: a.default })
  }
  if (!axisIds(axes).has('brand') || !axisIds(axes).has('mode') || axes.length !== 2) {
    invalid('manifest.axes must be exactly "brand" and "mode"')
  }
  return axes
}

function axisIds(axes: readonly ManifestAxis[]): Set<string> {
  return new Set(axes.map((a) => a.id))
}

function parseCollections(raw: unknown): ManifestCollection[] {
  if (!Array.isArray(raw)) invalid('manifest.collections must be an array')
  const out: ManifestCollection[] = []
  for (const c of raw) {
    if (!isObject(c) || typeof c.id !== 'string' || !COLLECTION_ORDER.includes(c.id as CollectionId)) {
      invalid(`collection id must be one of ${COLLECTION_ORDER.join(', ')}`)
    }
    if (typeof c.name !== 'string') invalid(`collection ${String(c.id)} needs a string name`)
    const axis = c.axis == null ? null : c.axis
    if (axis !== null && axis !== 'brand' && axis !== 'mode') invalid(`collection ${c.id} axis must be null, "brand" or "mode"`)
    out.push({ id: c.id as CollectionId, name: c.name, axis })
  }
  const ids = out.map((c) => c.id)
  if (ids.length !== COLLECTION_ORDER.length || COLLECTION_ORDER.some((id) => !ids.includes(id))) {
    invalid(`manifest.collections must be exactly: ${COLLECTION_ORDER.join(', ')}`)
  }
  return out
}

function parseVariables(
  raw: unknown,
  collectionById: Map<CollectionId, ManifestCollection>,
  axisById: Map<string, ManifestAxis>,
): DesiredVariable[] {
  if (!Array.isArray(raw)) invalid('manifest.variables must be an array')
  const out: DesiredVariable[] = []
  const seenKeys = new Set<string>()
  for (const v of raw) {
    if (!isObject(v)) invalid('each variable must be an object')
    if (typeof v.key !== 'string' || v.key.length === 0) invalid('variable.key must be a non-empty string')
    if (seenKeys.has(v.key)) invalid(`duplicate variable key "${v.key}"`)
    seenKeys.add(v.key)
    if (!Array.isArray(v.path) || v.path.some((p) => typeof p !== 'string') || v.path.length === 0) {
      invalid(`variable "${v.key}" needs a non-empty string path`)
    }
    if (typeof v.collection !== 'string' || !collectionById.has(v.collection as CollectionId)) {
      invalid(`variable "${v.key}" has an unknown collection ${JSON.stringify(v.collection)}`)
    }
    const collection = v.collection as CollectionId
    if (typeof v.type !== 'string' || !VALUE_TYPES.has(v.type as SyncValueType)) {
      invalid(`variable "${v.key}" has an unknown type ${JSON.stringify(v.type)}`)
    }
    if (v.role !== 'public' && v.role !== 'brand-mode-source') invalid(`variable "${v.key}" role must be public or brand-mode-source`)
    const description = typeof v.description === 'string' ? v.description : ''
    const expected = contextsFor(collectionById.get(collection)!, axisById)
    const values = parseValues(v.key, v.values, expected)
    out.push({ key: v.key, path: v.path as string[], collection, type: v.type as SyncValueType, role: v.role, description, values })
  }
  // §3.2: variables ordered by key in code point.
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

function parseValues(key: string, raw: unknown, expected: readonly ContextId[]): Record<ContextId, SyncValue> {
  if (!isObject(raw)) invalid(`variable "${key}" needs a values object`)
  const keys = Object.keys(raw)
  for (const ctx of expected) if (!(ctx in raw)) invalid(`variable "${key}" is missing value for context "${ctx}"`)
  for (const k of keys) if (!expected.includes(k)) invalid(`variable "${key}" has an unexpected context "${k}"`)
  const out: Record<ContextId, SyncValue> = {}
  for (const ctx of expected) {
    const val = (raw as Record<string, unknown>)[ctx]
    if (!isObject(val) || !('literal' in val || 'alias' in val)) invalid(`variable "${key}" context "${ctx}" must be a literal or alias`)
    if ('alias' in val && (!Array.isArray(val.alias) || val.alias.some((s) => typeof s !== 'string'))) {
      invalid(`variable "${key}" context "${ctx}" alias must be a path of segments`)
    }
    out[ctx] = val as SyncValue
  }
  return out
}

/** Contexts a collection carries in the tool: the axis contexts, or the reserved key "*" when axis-less. */
export function contextsFor(collection: ManifestCollection, axisById: Map<string, ManifestAxis>): readonly ContextId[] {
  if (collection.axis === null) return ['*']
  const axis = axisById.get(collection.axis)
  if (!axis) invalid(`collection ${collection.id} references unknown axis ${collection.axis}`)
  return axis.contexts
}

/** Convenience: contexts for a collection id over a parsed manifest. */
export function contextsOf(manifest: Manifest, collectionId: CollectionId): readonly ContextId[] {
  const collection = manifest.collections.find((c) => c.id === collectionId)
  if (!collection) invalid(`manifest has no collection ${collectionId}`)
  const axisById = new Map(manifest.axes.map((a) => [a.id, a]))
  return contextsFor(collection, axisById)
}
