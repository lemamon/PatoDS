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

export interface LoadResult {
  tokens: Record<string, any>
  resolver: any
  permutations: Permutation[]
  /** Per-id layer/axis classification, read straight from the source files (in resolver mode the
   * parser merges everything and loses the per-file origin). */
  decl: Map<string, DeclInfo>
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

/** Loads and resolves the token source from `srcDir`, offline. */
export async function loadTokens(srcDir: string): Promise<LoadResult> {
  const cwd = pathToFileURL(srcDir.endsWith('/') ? srcDir : srcDir + '/')
  const resolverUrl = new URL('tokens.resolver.json', cwd)

  const req = async (url: URL): Promise<string> => {
    if (url.protocol !== 'file:') {
      throw new Error(`Rede bloqueada no build de tokens: ${url.href} (FR-025, determinismo)`)
    }
    return await readFile(fileURLToPath(url), 'utf8')
  }

  const config = defineConfig({ tokens: ['./tokens.resolver.json'] }, { cwd })
  const resolverSrc = await readFile(fileURLToPath(resolverUrl), 'utf8')
  const { tokens, resolver } = await parse([{ filename: resolverUrl, src: resolverSrc }], {
    config,
    req,
  })

  if (!resolver) throw new Error('Nenhum resolvedor encontrado na fonte de tokens.')
  const inputs = resolver.listPermutations?.()
  if (!inputs) {
    throw new Error(
      'resolver.listPermutations() indefinido: resolvedor complexo demais ou permutationLimit excedido.',
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
  return { tokens, resolver, permutations, decl }
}
