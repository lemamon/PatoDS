// T040 consumer gate (FR-016, QA-08, ENG-05): prove the published @patods/tokens tarball type-checks
// in a downstream project under both module-resolution strategies and both supported TypeScript
// majors, and that the tarball itself is publishable (publint). Run by `test:types`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publint } from 'publint'
import { formatMessage } from 'publint/utils'

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)))
const nm = join(pkgDir, 'node_modules')
const tarball = join(pkgDir, 'vendor', 'patods-tokens-0.0.0.tgz')

// TypeScript 6.0 (default catalog). TypeScript 7.0 (catalog `typescript7`) runs from the sibling
// `@patods/types-consumer-ts7` package over these same sources and tsconfigs — pnpm cannot hold two
// `typescript` versions in one package, and the named catalog only resolves under that exact key.
const tsc = join(nm, 'typescript', 'bin', 'tsc')
const configs = [
  { name: 'bundler', file: 'tsconfig.bundler.json' },
  { name: 'nodenext', file: 'tsconfig.nodenext.json' },
]

let failures = 0

console.log('tsc (TS 6.0, strict --noEmit, positive expect-type + negative @ts-expect-error):')
for (const cfg of configs) {
  const label = `TS 6.0 · moduleResolution=${cfg.name}`
  try {
    execFileSync(tsc, ['-p', cfg.file], { cwd: pkgDir, stdio: 'pipe' })
    console.log(`  ✓ ${label}`)
  } catch (err) {
    failures++
    console.log(`  ✗ ${label}`)
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim()
    if (out) console.log(out.replace(/^/gm, '      '))
  }
}

// publint against the extracted tarball — exactly the bytes npm would publish.
console.log('\npublint (published tarball):')
const work = mkdtempSync(join(tmpdir(), 'patods-publint-'))
try {
  execFileSync('tar', ['-xzf', tarball, '-C', work], { stdio: 'pipe' })
  const extracted = join(work, 'package')
  const manifest = JSON.parse(readFileSync(join(extracted, 'package.json'), 'utf8'))
  const { messages } = await publint({ pkgDir: extracted, level: 'suggestion', strict: false })
  const blocking = messages.filter((m) => m.type === 'error' || m.type === 'warning')
  const notes = messages.filter((m) => m.type === 'suggestion')
  for (const m of blocking) {
    failures++
    console.log(`  ✗ [${m.type}] ${formatMessage(m, manifest)}`)
  }
  for (const m of notes) console.log(`  · [suggestion] ${formatMessage(m, manifest)}`)
  if (blocking.length === 0) console.log('  ✓ no errors or warnings')
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll type-consumer checks passed.')
