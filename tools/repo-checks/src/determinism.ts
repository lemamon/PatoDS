// Determinismo (FR-015, SC-002) e drift (QA-08) do build de tokens.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

function walk(dir: string, base: string, acc: string[]): string[] {
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, base, acc)
    else acc.push(full.slice(base.length + 1))
  }
  return acc
}

function hashTree(root: string, rels: string[]): string[] {
  return rels
    .sort()
    .map((rel) => {
      const h = createHash('sha256').update(readFileSync(join(root, rel))).digest('hex')
      return `${h}  ${rel}`
    })
}

function buildOnce(root: string, env: Record<string, string>): void {
  execFileSync('node', [join(root, 'tools/tokens-build/src/cli.ts'), 'build'], {
    cwd: join(root, 'packages/tokens'),
    env: { ...process.env, ...env },
    stdio: 'pipe',
  })
}

function safeExists(p: string): boolean {
  try {
    statSync(p)
    return true
  } catch {
    return false
  }
}

export interface CheckFinding {
  code: string
  message: string
}

export function checkDeterminism(root: string): CheckFinding[] {
  const pkg = join(root, 'packages/tokens')
  const collect = () => {
    const rels: string[] = []
    walk(join(pkg, 'dist'), pkg, rels)
    if (safeExists(join(pkg, 'api/tokens.api.json'))) rels.push('api/tokens.api.json')
    return hashTree(pkg, rels)
  }
  buildOnce(root, {})
  const h1 = collect()
  buildOnce(root, { TZ: 'Asia/Tokyo', LANG: 'ja_JP.UTF-8', LC_ALL: 'ja_JP.UTF-8' })
  const h2 = collect()
  if (h1.join('\n') !== h2.join('\n')) {
    return [{ code: 'DETERMINISM-MISMATCH', message: 'Build não determinístico: saídas diferem entre execuções.' }]
  }
  return []
}

export function checkDrift(root: string): CheckFinding[] {
  const out: CheckFinding[] = []
  // dist não pode ser versionado
  const trackedDist = execFileSync('git', ['ls-files', 'packages/tokens/dist'], { cwd: root, encoding: 'utf8' }).trim()
  if (trackedDist) out.push({ code: 'DRIFT-DIST-TRACKED', message: 'Arquivos gerados em dist/ estão versionados.' })
  // api regenerado deve deixar o git limpo
  buildOnce(root, {})
  const dirty = execFileSync('git', ['status', '--porcelain', 'packages/tokens/api'], { cwd: root, encoding: 'utf8' }).trim()
  if (dirty) out.push({ code: 'DRIFT-API-STALE', message: `Relatório de API desatualizado (regenere e commit):\n${dirty}` })
  return out
}
