// Determinism (FR-015, SC-002) and drift (QA-08) of the token build.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs'
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

  // The real published-artifact leg: two clean git worktrees, packed with pnpm pack (SC-002, ENG-08).
  out.push(...checkPackDeterminism(root))
  return out
}

// --- Published tarball determinism (SC-002, ENG-08): two literal `git worktree`s at divergent
// filesystem paths, built and `pnpm pack`ed under divergent TZ/locale (and, when supplied, divergent
// Node binaries — the floor/latest matrix), compared per packed file and by whole-tarball sha256. ---

function sha256File(p: string): string {
  return createHash('sha256').update(readFileSync(p)).digest('hex')
}

function nodeVer(bin: string): string {
  try {
    return execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim()
  } catch {
    return bin
  }
}

function onlyTgz(dir: string): string {
  const tgz = readdirSync(dir).filter((n) => n.endsWith('.tgz'))
  if (tgz.length !== 1) throw new Error(`expected exactly one .tgz in ${dir}, found ${tgz.length}`)
  return join(dir, tgz[0])
}

function gitWorktreeAdd(root: string, path: string): void {
  execFileSync('git', ['worktree', 'add', '--detach', '--quiet', path, 'HEAD'], { cwd: root, stdio: 'pipe' })
}

function gitWorktreeRemove(root: string, path: string): void {
  try {
    execFileSync('git', ['worktree', 'remove', '--force', path], { cwd: root, stdio: 'pipe' })
  } catch {
    /* best effort; the temp tree is deleted below and `git worktree prune` reclaims the admin entry */
  }
}

/** Builds a worktree's token source with THIS checkout's tooling (so the worktree needs no install and
 * the run stays offline, QA-01), writing dist into the worktree's own package dir. */
function buildWorktree(nodeBin: string, root: string, pkgDir: string, env: Record<string, string>): void {
  execFileSync(nodeBin, [join(root, 'tools/tokens-build/src/cli.ts'), 'build', '--src', join(pkgDir, 'src')], {
    cwd: pkgDir,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  })
}

/** `pnpm pack` the already-built package (no prepack/prepare script → no install, no network). */
function packWorktree(pkgDir: string, dest: string, env: Record<string, string>): void {
  execFileSync('pnpm', ['pack', '--pack-destination', dest], {
    cwd: pkgDir,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  })
}

function extractTgz(tgz: string, dest: string): string {
  mkdirSync(dest, { recursive: true })
  execFileSync('tar', ['-xzf', tgz, '-C', dest], { stdio: 'pipe' })
  return join(dest, 'package') // npm/pnpm tarballs root their contents at package/
}

function firstDiff(a: string[], b: string[]): string {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return `${a[i] ?? '(absent in A)'} != ${b[i] ?? '(absent in B)'}`
  }
  return '(file sets differ)'
}

function checkPackDeterminism(root: string): CheckFinding[] {
  const out: CheckFinding[] = []
  // Floor vs latest Node: the CI nightly-determinism matrix runs this check under node 22 and 24, and
  // a single run can additionally cross two binaries through these env paths. Default: the current Node
  // for both legs (byte-identical; the Node axis is then supplied by the CI matrix).
  const nodeA = process.env.PATODS_NODE_FLOOR || 'node'
  const nodeB = process.env.PATODS_NODE_LATEST || 'node'
  // Divergent filesystem paths: different prefixes and depths catch path-length-dependent output.
  const baseA = mkdtempSync(join(tmpdir(), 'patods-pack-a-'))
  const baseB = mkdtempSync(join(tmpdir(), 'patods-pack-bb-deeper-'))
  const wtA = join(baseA, 'wt')
  const wtB = join(baseB, 'nested', 'wt')
  const packA = join(baseA, 'out')
  const packB = join(baseB, 'out')
  try {
    mkdirSync(packA, { recursive: true })
    mkdirSync(join(baseB, 'nested'), { recursive: true })
    mkdirSync(packB, { recursive: true })
    gitWorktreeAdd(root, wtA)
    gitWorktreeAdd(root, wtB)
    const pkgA = join(wtA, 'packages/tokens')
    const pkgB = join(wtB, 'packages/tokens')
    const envA = { TZ: 'UTC', LANG: 'C', LC_ALL: 'C' }
    const envB = { TZ: 'Asia/Tokyo', LANG: 'ja_JP.UTF-8', LC_ALL: 'ja_JP.UTF-8' }
    buildWorktree(nodeA, root, pkgA, envA)
    buildWorktree(nodeB, root, pkgB, envB)
    packWorktree(pkgA, packA, envA)
    packWorktree(pkgB, packB, envB)
    const tgzA = onlyTgz(packA)
    const tgzB = onlyTgz(packB)

    // Per-file sha256 of the packed contents (precise diagnostic: which file diverged).
    const rootA = extractTgz(tgzA, join(baseA, 'ex'))
    const rootB = extractTgz(tgzB, join(baseB, 'ex'))
    const fileHashesA = hashTree(rootA, walk(rootA, rootA, []))
    const fileHashesB = hashTree(rootB, walk(rootB, rootB, []))
    if (fileHashesA.join('\n') !== fileHashesB.join('\n')) {
      out.push({
        code: 'DETERMINISM-PACK-FILE',
        message: `Packed file differs between the two worktrees (${nodeVer(nodeA)} vs ${nodeVer(nodeB)}): ${firstDiff(fileHashesA, fileHashesB)}`,
      })
    }

    // Whole-tarball sha256 (byte-for-byte reproducibility of the published artifact).
    const shaA = sha256File(tgzA)
    const shaB = sha256File(tgzB)
    if (shaA !== shaB) {
      out.push({
        code: 'DETERMINISM-PACK',
        message: `Tarball sha256 differs across worktree/TZ/locale/Node (${nodeVer(nodeA)}=${shaA}, ${nodeVer(nodeB)}=${shaB}).`,
      })
    }
  } finally {
    gitWorktreeRemove(root, wtA)
    gitWorktreeRemove(root, wtB)
    try {
      execFileSync('git', ['worktree', 'prune'], { cwd: root, stdio: 'pipe' })
    } catch {
      /* best effort */
    }
    rmSync(baseA, { recursive: true, force: true })
    rmSync(baseB, { recursive: true, force: true })
  }
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
