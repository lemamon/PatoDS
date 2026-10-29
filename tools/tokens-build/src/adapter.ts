// Adaptador do motor de parsing (ADR-11): isola o PatoDS do @terrazzo/parser atrás de uma
// fronteira fina. Lê a fonte DTCG 2025.10, resolve todas as permutações marca × modo e nunca
// acessa a rede (FR-025, D1). Se o parser for trocado (ex.: Style Dictionary quando tiver
// Resolver), só este arquivo muda.
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
  /** Classificação de cada id de token por camada/eixo, lida direto dos arquivos-fonte
   * (o parser, em modo resolver, funde tudo e perde a origem por arquivo). */
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

/** Achata um documento DTCG em ids de token (grupos são objetos sem `$value`). */
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

/** Lê os arquivos-fonte e classifica cada id por camada/eixo. */
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

/** Carrega e resolve a fonte de tokens de `srcDir`, sem rede. */
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
