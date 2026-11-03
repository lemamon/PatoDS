// Parsing-engine adapter (ADR-11): isolates PatoDS from @terrazzo/parser behind a thin boundary.
// Reads the DTCG 2025.10 source, resolves every brand x mode permutation, and never touches the
// network (FR-025, D1). Swapping the parser (e.g. Style Dictionary once it has a Resolver) only
// changes this file.
import { parse, defineConfig } from '@terrazzo/parser'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, relative } from 'node:path'

export type Bucket = 'primitive' | 'invariant' | 'brand' | 'mode' | 'component'

export interface DeclInfo {
  file: string
  bucket: Bucket
}

export interface Permutation {
  input: Record<string, string>
  id: string
  set: Record<string, any>
}

/** Where a path is declared, with the source bucket of that file. */
export interface SourceOccurrence {
  file: string
  bucket: Bucket
}

/** A `$ref` (JSON pointer / relative file) found in the raw source, with the token it sits on. */
export interface SourceRefNote {
  id: string
  file: string
  bucket: Bucket
  value: string
}

/** A `$root` found in the raw source, with the group path it sits on. */
export interface SourceRootNote {
  file: string
  path: string
}

/** Source-form index, read from the raw JSON before @terrazzo resolves/merges it. Validators that
 * reason about the source shape (V-04 direct direction, V-05 `$ref`/`$root`, V-07/V-09 axis by
 * location) use this; the resolved `tokens` set has already lost the direct alias and the per-file
 * origin. */
export interface SourceIndex {
  /** id -> every file/bucket that declares it (unique by file, sorted). */
  occurrences: Map<string, SourceOccurrence[]>
  /** id -> bucket of the first declaring file (sorted), matching `decl`. */
  bucketOf: Map<string, Bucket>
  /** id -> the ids it references by a direct `{path}` alias ($value and composite subvalues). */
  directRefs: Map<string, string[]>
  /** every `$ref` occurrence (V-05). */
  refs: SourceRefNote[]
  /** every `$root` occurrence (V-05). */
  roots: SourceRootNote[]
}

export interface LoadResult {
  tokens: Record<string, any>
  resolver: any
  permutations: Permutation[]
  /** Per-id layer/axis classification, read straight from the source files (in resolver mode the
   * parser merges everything and loses the per-file origin). */
  decl: Map<string, DeclInfo>
  /** Source-form index read from the raw JSON (V-04, V-05, V-07, V-09). */
  source: SourceIndex
}

function bucketOf(rel: string): Bucket | undefined {
  if (rel === 'primitive.tokens.json') return 'primitive'
  if (rel === 'semantic/invariant.tokens.json') return 'invariant'
  if (rel.startsWith('semantic/brand/')) return 'brand'
  if (rel.startsWith('semantic/mode/')) return 'mode'
  if (rel.startsWith('component/')) return 'component'
  return undefined
}

/** Flattens a DTCG document into token ids (groups are objects without `$value`). */
function flattenIds(node: any, prefix: string, out: string[]): void {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return
  if ('$value' in node) {
    if (prefix) out.push(prefix)
    return
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue
    flattenIds(node[key], prefix ? `${prefix}.${key}` : key, out)
  }
}

async function listTokenFiles(dir: string, base: string, acc: string[]): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await listTokenFiles(full, base, acc)
    else if (entry.name.endsWith('.tokens.json')) acc.push(relative(base, full))
  }
  return acc
}

/** Reads the source files and classifies each id by layer/axis. */
async function classify(srcDir: string): Promise<Map<string, DeclInfo>> {
  const decl = new Map<string, DeclInfo>()
  const files = await listTokenFiles(srcDir, srcDir, [])
  for (const rel of files.sort()) {
    const bucket = bucketOf(rel.split('\\').join('/'))
    if (!bucket) continue
    const json = JSON.parse(await readFile(join(srcDir, rel), 'utf8'))
    const ids: string[] = []
    flattenIds(json, '', ids)
    for (const id of ids) {
      if (!decl.has(id)) decl.set(id, { file: rel.split('\\').join('/'), bucket })
    }
  }
  return decl
}

const ALIAS_RE = /^\{([^}]+)\}$/

/** Collects the direct `{path}` alias targets from a `$value` (string, composite object or array). */
function collectAliasTargets(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    const m = ALIAS_RE.exec(value.trim())
    if (m) out.push(m[1]!)
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectAliasTargets(v, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$')) continue
      collectAliasTargets(v, out)
    }
  }
}

/** Collects every `$ref` string nested inside a `$value` (composite subvalues included). */
function collectRefsIn(value: unknown, id: string, note: Omit<SourceRefNote, 'value' | 'id'>, out: SourceRefNote[]): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const v of value) collectRefsIn(v, id, note, out)
    return
  }
  const ref = (value as Record<string, unknown>)['$ref']
  if (typeof ref === 'string') out.push({ id, ...note, value: ref })
  for (const [k, v] of Object.entries(value)) {
    if (k === '$ref') continue
    collectRefsIn(v, id, note, out)
  }
}

/** Reads the raw JSON of every source file and builds the source-form index (V-04, V-05, V-07, V-09).
 * Independent of @terrazzo: it sees the direct aliases, the per-file origin and the `$ref`/`$root`
 * meta keys that resolution would otherwise consume or collapse. */
async function scanSource(srcDir: string): Promise<SourceIndex> {
  const occurrences = new Map<string, SourceOccurrence[]>()
  const idBucket = new Map<string, Bucket>()
  const directRefs = new Map<string, string[]>()
  const refs: SourceRefNote[] = []
  const roots: SourceRootNote[] = []

  const files = await listTokenFiles(srcDir, srcDir, [])
  for (const relRaw of files.sort()) {
    const rel = relRaw.split('\\').join('/')
    const bucket = bucketOf(rel)
    if (!bucket) continue
    const json = JSON.parse(await readFile(join(srcDir, relRaw), 'utf8'))

    const walk = (node: any, path: string): void => {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) return
      if ('$root' in node) roots.push({ file: rel, path })
      if (typeof node['$ref'] === 'string') refs.push({ id: path, file: rel, bucket, value: node['$ref'] })
      if ('$value' in node) {
        // Token node: record its origin and its direct alias targets.
        const occ = occurrences.get(path) ?? []
        if (!occ.some((o) => o.file === rel)) occ.push({ file: rel, bucket })
        occurrences.set(path, occ)
        if (!idBucket.has(path)) idBucket.set(path, bucket)
        const targets: string[] = []
        collectAliasTargets(node['$value'], targets)
        if (targets.length) {
          const prev = directRefs.get(path) ?? []
          for (const t of targets) if (!prev.includes(t)) prev.push(t)
          directRefs.set(path, prev)
        }
        collectRefsIn(node['$value'], path, { file: rel, bucket }, refs)
        return
      }
      for (const key of Object.keys(node)) {
        if (key.startsWith('$')) continue
        walk(node[key], path ? `${path}.${key}` : key)
      }
    }
    walk(json, '')
  }

  return { occurrences, bucketOf: idBucket, directRefs, refs, roots }
}

/** Loads and resolves the token source from `srcDir`, offline. */
export async function loadTokens(srcDir: string): Promise<LoadResult> {
  const cwd = pathToFileURL(srcDir.endsWith('/') ? srcDir : srcDir + '/')
  const resolverUrl = new URL('tokens.resolver.json', cwd)

  const req = async (url: URL): Promise<string> => {
    if (url.protocol !== 'file:') {
      throw new Error(`Network blocked during token build: ${url.href} (FR-025, determinism)`)
    }
    return await readFile(fileURLToPath(url), 'utf8')
  }

  const config = defineConfig({ tokens: ['./tokens.resolver.json'] }, { cwd })
  const resolverSrc = await readFile(fileURLToPath(resolverUrl), 'utf8')
  const { tokens, resolver } = await parse([{ filename: resolverUrl, src: resolverSrc }], {
    config,
    req,
  })

  if (!resolver) throw new Error('No resolver found in the token source.')
  const inputs = resolver.listPermutations?.()
  if (!inputs) {
    throw new Error(
      'resolver.listPermutations() undefined: resolver too complex or permutationLimit exceeded.',
    )
  }

  const permutations: Permutation[] = inputs
    .map((input: Record<string, string>) => ({
      input,
      id: resolver.getPermutationID(input),
      set: resolver.apply(input),
    }))
    .sort((a: Permutation, b: Permutation) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const decl = await classify(srcDir)
  const source = await scanSource(srcDir)
  return { tokens, resolver, permutations, decl, source }
}
