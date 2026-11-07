#!/usr/bin/env node
// Contrast checker CLI. Exit: 0 ok; 1 failing pair; 2 usage/config; 3 internal.
import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { runContrastCheck } from './check.ts'

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { json: { type: 'boolean', default: false }, pkg: { type: 'string' } },
  })
  if (positionals[0] !== 'check') {
    process.stderr.write('usage: tokens-contrast check [--json] [--pkg <dir>]\n')
    return 2
  }
  const pkgDir = resolve(values.pkg ?? '.')
  const root = resolve(pkgDir, '../..')
  let thresholds
  try {
    thresholds = JSON.parse(readFileSync(join(root, 'quality/thresholds.json'), 'utf8')).contrast
  } catch {
    process.stderr.write('config: quality/thresholds.json not found or invalid.\n')
    return 2
  }

  let result
  try {
    result = runContrastCheck(pkgDir, thresholds)
  } catch (err) {
    process.stderr.write(`internal error: ${(err as Error).message}\n`)
    return 3
  }

  if (values.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  } else {
    for (const e of result.errors) process.stderr.write(`error  ${e.code}  ${e.message}\n`)
    for (const f of result.findings) {
      const ctx = f.context ? ` ${f.context.brand}/${f.context.mode}` : ''
      process.stderr.write(`error  ${f.code}  ${f.pair}${ctx}  ${f.message}\n`)
    }
    const s = result.summary
    process.stdout.write(`contrast: ${s.cases} cases (${s.exempt} exempt), ${s.passed} passed, ${s.failed} failed, ${result.findings.length} findings.\n`)
  }
  return result.exitCode
}

main().then(
  (c) => process.exit(c),
  (e) => {
    process.stderr.write(`internal error: ${e?.stack ?? e}\n`)
    process.exit(3)
  },
)
