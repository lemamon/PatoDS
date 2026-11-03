// T040, TypeScript 7.0 axis (catalog `typescript7`). pnpm cannot hold two `typescript` versions in
// one package and the named catalog only resolves under the `typescript` key, so this sidecar owns
// only the TS 7 compiler and type-checks the consumer sources that live in the sibling
// `@patods/types-consumer` package (its node_modules resolves the tarball + expect-type).
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)))
const tsc = join(pkgDir, 'node_modules', 'typescript', 'bin', 'tsc')
const sibling = join(pkgDir, '..', 'types-consumer')
const configs = [
  { name: 'bundler', file: 'tsconfig.bundler.json' },
  { name: 'nodenext', file: 'tsconfig.nodenext.json' },
]

let failures = 0
console.log('tsc (TS 7.0, strict --noEmit, shared consumer sources):')
for (const cfg of configs) {
  const label = `TS 7.0 · moduleResolution=${cfg.name}`
  try {
    execFileSync(tsc, ['-p', join(sibling, cfg.file)], { cwd: sibling, stdio: 'pipe' })
    console.log(`  ✓ ${label}`)
  } catch (err) {
    failures++
    console.log(`  ✗ ${label}`)
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim()
    if (out) console.log(out.replace(/^/gm, '      '))
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nTS 7.0 consumer checks passed.')
