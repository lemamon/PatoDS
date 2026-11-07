// QA-02: all non-UI logic MUST have a unit test. For each tools/* package, every runtime source module
// (a `src/**/*.ts` with a value export, excluding the `index.ts` barrel and the `cli.ts`/`bin` entry)
// must be imported by at least one `test/**/*.test.ts` of the package. A module no test imports is a gap.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface LogicFinding {
  code: string
  module: string
  message: string
}

function listTs(dir: string, base: string, acc: string[]): string[] {
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) listTs(full, base, acc)
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(full.slice(base.length + 1).split('\\').join('/'))
  }
  return acc
}

const RUNTIME_EXPORT = /export\s+(async\s+)?(function|const|class)\s/

// Integration modules whose test is a CI gate that runs the real build, not a unit import (QA-02 covers
// non-UI logic; these are build-orchestration exercised end-to-end by check:determinism / check:drift).
const CI_GATED = new Set(['tools/repo-checks/src/determinism.ts'])

export function checkLogicTests(root: string): LogicFinding[] {
  const out: LogicFinding[] = []
  const group = join(root, 'tools')
  let pkgs: string[] = []
  try {
    pkgs = readdirSync(group, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return out
  }
  for (const pkg of pkgs.sort()) {
    const srcDir = join(group, pkg, 'src')
    const testDir = join(group, pkg, 'test')
    const srcFiles = listTs(srcDir, srcDir, []).filter((rel) => !rel.endsWith('.test.ts'))
    const testFiles = listTs(testDir, testDir, []).filter((rel) => rel.endsWith('.test.ts'))
    const testBlob = testFiles.map((rel) => readFileSync(join(testDir, rel), 'utf8')).join('\n')
    for (const rel of srcFiles.sort()) {
      const name = rel.split('/').pop()!
      if (name === 'index.ts' || name === 'cli.ts') continue // barrel and bin entry
      if (CI_GATED.has(`tools/${pkg}/src/${rel}`)) continue
      const body = readFileSync(join(srcDir, rel), 'utf8')
      if (!RUNTIME_EXPORT.test(body)) continue // type-only module, no logic to test
      // A test covers it when some test file imports `src/<rel>` (with or without the .ts extension).
      const importPath = `src/${rel}`
      const covered = testBlob.includes(importPath) || testBlob.includes(importPath.replace(/\.ts$/, ''))
      if (!covered) {
        out.push({
          code: 'QA02-UNTESTED-MODULE',
          module: `tools/${pkg}/${importPath}`,
          message: `Runtime module "tools/${pkg}/${importPath}" is imported by no test in tools/${pkg}/test/ (QA-02).`,
        })
      }
    }
  }
  return out
}
