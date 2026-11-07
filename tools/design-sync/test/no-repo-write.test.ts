// Architecture test for G-1 / FR-025 / US6 scenario 6 (design-sync.md §1, §13): no operation carries
// data from the design tool into the repository. Proven structurally: DesignToolPort has exactly the
// five read/write-to-TOOL members; the pure core imports no filesystem module; no source reaches the
// token source (@patods/tokens outside ./meta/*, or packages/tokens/src); and the CLI exposes no import
// command and refuses --out inside the token package. Complements repo-checks layers (token-source edge).
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = fileURLToPath(new URL('../src', import.meta.url))

// Strip comments so prose that names the forbidden paths (this file's own guarantees are documented in
// comments) is not mistaken for a real reference; only executable code is scanned.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function allTs(dir: string, acc: { path: string; body: string }[] = []): { path: string; body: string }[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) allTs(full, acc)
    else if (e.name.endsWith('.ts')) acc.push({ path: full, body: stripComments(readFileSync(full, 'utf8')) })
  }
  return acc
}

const files = allTs(SRC)
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

describe('G-1: no tool → repository operation', () => {
  it('DesignToolPort declares exactly the five tool-facing members', () => {
    const ports = read('ports.ts')
    const block = /export interface DesignToolPort \{([\s\S]*?)\n\}/.exec(ports)![1]!
    const members = [...block.matchAll(/^\s*(\w+)\s*\(/gm)].map((m) => m[1])
    expect(members.sort()).toEqual(['apply', 'capabilities', 'checkAccess', 'readSnapshot', 'requestPublish'])
  })

  it('no port method name implies a write back into the repository', () => {
    const ports = read('ports.ts')
    for (const forbidden of ['writeRepo', 'writeToRepo', 'importToRepo', 'writeSource', 'toRepository', 'pullIntoRepo']) {
      expect(ports).not.toContain(forbidden)
    }
  })

  it('the pure core imports no filesystem module (it only reads snapshots in memory)', () => {
    for (const f of files.filter((x) => x.path.includes(`${join('src', 'core')}`))) {
      expect(f.body, f.path).not.toMatch(/from ['"]node:fs/)
      expect(f.body, f.path).not.toMatch(/writeFileSync|mkdirSync|writeFile\(/)
    }
  })

  it('no source reaches the token source (@patods/tokens outside ./meta/*, or packages/tokens/src)', () => {
    for (const f of files) {
      expect(f.body, f.path).not.toContain('packages/tokens/src')
      for (const m of f.body.matchAll(/from ['"](@patods\/tokens[^'"]*)['"]/g)) {
        expect(m[1]!.includes('/meta/'), `${f.path} imports ${m[1]}`).toBe(true)
      }
    }
  })

  it('the CLI exposes only plan/apply/detect/check-access (no import command)', () => {
    const cli = read('cli.ts')
    expect(cli).toMatch(/\['plan', 'apply', 'detect', 'check-access'\]/)
    expect(cli).not.toMatch(/'import'/)
  })

  it('the CLI refuses --out inside the token package', () => {
    expect(read('cli.ts')).toContain("packages', 'tokens")
  })
})
