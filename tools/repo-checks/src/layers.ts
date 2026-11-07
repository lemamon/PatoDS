// Layer boundaries (ENG-01, manifest check): tokens -> core -> frameworks; tools depend on the UI
// only as a devDependency. Reads the workspace package.json files and validates production
// dependency edges by layer. It also enforces the design-sync token-source edge (G-1 of
// design-sync.md, FR-025): the sync tool must never import @patods/tokens outside ./meta/*, nor
// reference packages/tokens/src — that is how a tool -> repository (source) write would start.
import { readFile, readdir } from 'node:fs/promises'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Layer = 'tokens' | 'tools' | 'apps' | 'root'

export interface LayerFinding {
  code: string
  pkg: string
  message: string
}

const ALLOWED_PROD: Record<Layer, Set<Layer>> = {
  tokens: new Set<Layer>(['tokens']),
  tools: new Set<Layer>(['tools', 'tokens']),
  apps: new Set<Layer>(['apps']),
  root: new Set<Layer>(['tokens', 'tools', 'apps', 'root']),
}

function layerOfDir(rel: string): Layer {
  if (rel.startsWith('packages/')) return 'tokens'
  if (rel.startsWith('tools/')) return 'tools'
  if (rel.startsWith('apps/') || rel.startsWith('tests/')) return 'apps'
  return 'root'
}

async function readWorkspacePackages(root: string): Promise<{ name: string; dir: string; layer: Layer; json: any }[]> {
  const out: { name: string; dir: string; layer: Layer; json: any }[] = []
  for (const group of ['packages', 'tools', 'apps', 'tests']) {
    let entries: string[] = []
    try {
      entries = (await readdir(join(root, group), { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    } catch {
      continue
    }
    for (const name of entries) {
      const rel = `${group}/${name}`
      let json: any
      try {
        json = JSON.parse(await readFile(join(root, rel, 'package.json'), 'utf8'))
      } catch {
        continue
      }
      out.push({ name: json.name ?? rel, dir: rel, layer: layerOfDir(rel), json })
    }
  }
  return out
}

export async function checkLayers(root: string): Promise<LayerFinding[]> {
  const pkgs = await readWorkspacePackages(root)
  const byName = new Map(pkgs.map((p) => [p.name, p]))
  const out: LayerFinding[] = []
  for (const p of pkgs) {
    const prod: Record<string, string> = p.json.dependencies ?? {}
    for (const dep of Object.keys(prod)) {
      const target = byName.get(dep)
      if (!target) continue // external dependency, covered by license/allowlist
      if (!ALLOWED_PROD[p.layer].has(target.layer)) {
        out.push({
          code: 'ENG01-FORBIDDEN-EDGE',
          pkg: p.name,
          message: `Layer "${p.layer}" (${p.dir}) depends in production on "${target.layer}" (${dep}); forbidden edge (ENG-01).`,
        })
      }
    }
    // Tools must not have the UI (tokens layer) as a production dependency.
    if (p.layer === 'tools') {
      for (const dep of Object.keys(prod)) {
        const target = byName.get(dep)
        if (target?.layer === 'tokens') {
          out.push({
            code: 'ENG01-TOOL-PROD-UI',
            pkg: p.name,
            message: `Tool "${p.name}" depends on the UI "${dep}" in production; only devDependency is allowed (ENG-01).`,
          })
        }
      }
    }
  }
  out.push(...checkTokenSourceEdge(root))
  return out
}

/**
 * G-1 / FR-025: tools/design-sync must not reach the token source. Flags an import of @patods/tokens
 * outside the ./meta/* subpath, or any reference to packages/tokens/src. Comments are stripped first so
 * the package's own guarantees, documented in prose, are not mistaken for a reference.
 */
export function checkTokenSourceEdge(root: string): LayerFinding[] {
  const out: LayerFinding[] = []
  const srcDir = join(root, 'tools/design-sync/src')
  for (const file of listTsFiles(srcDir)) {
    const code = stripComments(readFileSync(file, 'utf8'))
    const rel = file.slice(root.length + 1)
    if (code.includes('packages/tokens/src')) {
      out.push({ code: 'ENG01-TOKEN-SOURCE-REFERENCE', pkg: '@patods/design-sync', message: `${rel} references packages/tokens/src; design-sync must not reach the token source (G-1, FR-025).` })
    }
    for (const m of code.matchAll(/from\s+['"](@patods\/tokens[^'"]*)['"]/g)) {
      if (!m[1]!.includes('/meta/')) {
        out.push({ code: 'ENG01-SUBPATH-NOT-ALLOWED', pkg: '@patods/design-sync', message: `${rel} imports "${m[1]}" outside ./meta/*; design-sync may only read the manifest (G-1, FR-025).` })
      }
    }
  }
  return out
}

function listTsFiles(dir: string, acc: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) listTsFiles(full, acc)
    else if (e.name.endsWith('.ts')) acc.push(full)
  }
  return acc
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}
