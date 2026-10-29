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
    process.stderr.write('uso: tokens-contrast check [--json] [--pkg <dir>]\n')
    return 2
  }
  const pkgDir = resolve(values.pkg ?? '.')
  const root = resolve(pkgDir, '../..')
  let thresholds
  try {
    thresholds = JSON.parse(readFileSync(join(root, 'quality/thresholds.json'), 'utf8')).contrast
  } catch {
    process.stderr.write('config: quality/thresholds.json não encontrado ou inválido.\n')
    return 2
  }

  let result
  try {
    result = runContrastCheck(pkgDir, thresholds)
  } catch (err) {
    process.stderr.write(`erro interno: ${(err as Error).message}\n`)
    return 3
  }

  if (values.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  } else {
    for (const f of result.findings) process.stderr.write(`${f.code}  ${f.pair}  ${f.perm}  ${f.message}\n`)
    const n = result.report.rows.length
    const exempt = result.report.rows.filter((r) => r.exempt).length
    process.stdout.write(`contraste: ${n} medições (${exempt} isentas), ${result.findings.length} reprovações.\n`)
  }
  return result.findings.length ? 1 : 0
}

main().then(
  (c) => process.exit(c),
  (e) => {
    process.stderr.write(`erro interno: ${e?.stack ?? e}\n`)
    process.exit(3)
  },
)
