// Determinism (FR-015, SC-002) and drift (QA-08) of the token build.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, mkdtempSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

function buildAt(root: string, srcDir: string, env: Record<string, string>): void {
  execFileSync('node', [join(root, 'tools/tokens-build/src/cli.ts'), 'build', '--src', srcDir], {
    cwd: join(root, 'packages/tokens'),
    env: { ...process.env, ...env },
    stdio: 'pipe',
  })
}

function buildOnce(root: string, env: Record<string, string>): void {
  buildAt(root, join(root, 'packages/tokens/src'), env)
}

function collectFrom(pkgDir: string): string[] {
  const rels: string[] = []
  walk(join(pkgDir, 'dist'), pkgDir, rels)
  if (safeExists(join(pkgDir, 'api/tokens.api.json'))) rels.push('api/tokens.api.json')
  return hashTree(pkgDir, rels)
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
  const out: CheckFinding[] = []

  // Run 1: default path and environment.
  buildOnce(root, {})
  const h1 = collectFrom(pkg)
  // Run 2: same path, divergent time zone and locale.
  buildOnce(root, { TZ: 'Asia/Tokyo', LANG: 'ja_JP.UTF-8', LC_ALL: 'ja_JP.UTF-8' })
  const h2 = collectFrom(pkg)
  // Run 3: a divergent filesystem path (fresh copy of the source), divergent time zone and C locale.
  const tmp = mkdtempSync(join(tmpdir(), 'patods-det-'))
  cpSync(join(pkg, 'src'), join(tmp, 'src'), { recursive: true })
  cpSync(join(pkg, 'schemas'), join(tmp, 'schemas'), { recursive: true })
  buildAt(root, join(tmp, 'src'), { TZ: 'America/Sao_Paulo', LANG: 'C', LC_ALL: 'C' })
  const h3 = collectFrom(tmp)

  if (h1.join('\n') !== h2.join('\n')) out.push({ code: 'DETERMINISM-MISMATCH', message: 'Non-deterministic build: outputs differ across time zone/locale.' })
  if (h1.join('\n') !== h3.join('\n')) out.push({ code: 'DETERMINISM-PATH', message: 'Non-deterministic build: outputs differ when built from a divergent filesystem path (SC-002, path independence).' })
  return out
}

export function checkDrift(root: string): CheckFinding[] {
  const out: CheckFinding[] = []
  // dist must not be tracked
  const trackedDist = execFileSync('git', ['ls-files', 'packages/tokens/dist'], { cwd: root, encoding: 'utf8' }).trim()
  if (trackedDist) out.push({ code: 'DRIFT-DIST-TRACKED', message: 'Generated files in dist/ are tracked.' })
  // regenerated api report must leave git clean
  buildOnce(root, {})
  const dirty = execFileSync('git', ['status', '--porcelain', 'packages/tokens/api'], { cwd: root, encoding: 'utf8' }).trim()
  if (dirty) out.push({ code: 'DRIFT-API-STALE', message: `API report out of date (regenerate and commit):\n${dirty}` })
  return out
}
