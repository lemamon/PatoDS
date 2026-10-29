// Fronteiras de camada (ENG-01, check de manifesto): tokens → núcleo → frameworks; ferramentas
// dependem da UI só como devDependency. Lê os package.json do workspace e valida as arestas de
// dependência de produção por camada.
import { readFile, readdir } from 'node:fs/promises'
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
      if (!target) continue // dependência externa, coberta por licença/allowlist
      if (!ALLOWED_PROD[p.layer].has(target.layer)) {
        out.push({
          code: 'ENG01-FORBIDDEN-EDGE',
          pkg: p.name,
          message: `Camada "${p.layer}" (${p.dir}) depende em produção de "${target.layer}" (${dep}); aresta proibida (ENG-01).`,
        })
      }
    }
    // Ferramentas não podem ter UI (camada tokens) como dependência de produção.
    if (p.layer === 'tools') {
      for (const dep of Object.keys(prod)) {
        const target = byName.get(dep)
        if (target?.layer === 'tokens') {
          out.push({
            code: 'ENG01-TOOL-PROD-UI',
            pkg: p.name,
            message: `Ferramenta "${p.name}" depende da UI "${dep}" em produção; só devDependency é permitido (ENG-01).`,
          })
        }
      }
    }
  }
  return out
}
