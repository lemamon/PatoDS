// Shared test fixtures (design-sync.md §12, QA-15 synthetic brands a/b, c in the new-brand case). A
// compact manifest that still exercises the per-axis topology: a brand-mode-source in the brand
// collection, a public mode variable aliasing it, and the primitives they resolve to.
import type { SyncConfig, SyncValue } from '../src/ports.ts'
import { parseManifest, type Manifest } from '../src/core/index.ts'

export const DEFAULT_NAMES = {
  primitive: 'Primitives',
  brand: 'Brand',
  mode: 'Mode',
  semantic: 'Invariant semantics',
  component: 'Components',
} as const

export function sampleManifestRaw(version = '1.4.0'): Record<string, unknown> {
  return {
    format: 'patods.sync-manifest',
    version: 1,
    source: { package: '@patods/tokens', version },
    axes: [
      { id: 'brand', contexts: ['a', 'b'], default: 'a' },
      { id: 'mode', contexts: ['dark', 'light'], default: 'light' },
    ],
    collections: [
      { id: 'primitive', name: DEFAULT_NAMES.primitive, axis: null },
      { id: 'brand', name: DEFAULT_NAMES.brand, axis: 'brand' },
      { id: 'mode', name: DEFAULT_NAMES.mode, axis: 'mode' },
      { id: 'semantic', name: DEFAULT_NAMES.semantic, axis: null },
      { id: 'component', name: DEFAULT_NAMES.component, axis: null },
    ],
    variables: [
      prim('color.neutral.900', '#16181d'),
      prim('color.neutral.050', '#f5f6f8'),
      prim('color.sand.950', '#1a1712'),
      prim('color.sand.050', '#f7f3ec'),
      brandVar('brand.color.bg.surface.dark', { a: ['color', 'neutral', '900'], b: ['color', 'sand', '950'] }),
      brandVar('brand.color.bg.surface.light', { a: ['color', 'neutral', '050'], b: ['color', 'sand', '050'] }),
      modeVar('color.bg.surface', { dark: ['brand', 'color', 'bg', 'surface', 'dark'], light: ['brand', 'color', 'bg', 'surface', 'light'] }),
      semanticVar('color.focus.ring', ['color', 'neutral', '900']),
    ],
  }
}

function prim(key: string, hex: string): Record<string, unknown> {
  return {
    key, path: key.split('.'), collection: 'primitive', layer: 'primitive', category: 'color', role: 'public',
    type: 'color', cssName: `--patods-${key.replace(/\./g, '-')}`, description: '',
    values: { '*': { literal: { hex, alpha: 1 } } },
  }
}
function brandVar(key: string, aliases: Record<'a' | 'b', string[]>): Record<string, unknown> {
  return {
    key, path: key.split('.'), collection: 'brand', layer: 'semantic', category: 'color', role: 'brand-mode-source',
    type: 'color', cssName: `--patods-${key.replace(/\./g, '-')}`, description: '',
    values: { a: { alias: aliases.a }, b: { alias: aliases.b } },
  }
}
function modeVar(key: string, aliases: Record<'dark' | 'light', string[]>): Record<string, unknown> {
  return {
    key, path: key.split('.'), collection: 'mode', layer: 'semantic', category: 'color', role: 'public',
    type: 'color', cssName: `--patods-${key.replace(/\./g, '-')}`, description: 'Default surface background.',
    values: { dark: { alias: aliases.dark }, light: { alias: aliases.light } },
  }
}
function semanticVar(key: string, alias: string[]): Record<string, unknown> {
  return {
    key, path: key.split('.'), collection: 'semantic', layer: 'semantic', category: 'color', role: 'public',
    type: 'color', cssName: `--patods-${key.replace(/\./g, '-')}`, description: '',
    values: { '*': { alias } },
  }
}

export function sampleManifest(version = '1.4.0'): Manifest {
  return parseManifest(sampleManifestRaw(version))
}

export const sampleConfig: SyncConfig = {
  version: 1,
  tool: { adapter: 'memory', target: 'sandbox' },
  managedCollections: ['primitive', 'brand', 'mode', 'semantic', 'component'],
  ownerPath: 'tools/design-sync/',
  slaDays: { divergence: 5, manualWrite: 3, manualPublish: 3, capability: 14 },
  credentialExpiryWarnDays: 14,
  retry: { maxRetries: 5, maxRetryAfterSeconds: 60 },
  maxDeleteFraction: 0.5,
}

/** Resolve a (brand, mode) pair through the manifest's own alias chain (the expected value for C-12). */
export function resolveInManifest(manifest: Manifest, path: readonly string[], brand: string, mode: string, depth = 0): SyncValue {
  if (depth > 64) throw new Error('alias cycle')
  const v = manifest.variables.find((x) => x.path.join('.') === path.join('.'))
  if (!v) throw new Error(`no manifest variable at ${path.join('.')}`)
  const coll = manifest.collections.find((c) => c.id === v.collection)!
  const ctx = coll.axis === 'brand' ? brand : coll.axis === 'mode' ? mode : '*'
  const value = v.values[ctx]!
  if ('alias' in value) return resolveInManifest(manifest, value.alias, brand, mode, depth + 1)
  return value
}
