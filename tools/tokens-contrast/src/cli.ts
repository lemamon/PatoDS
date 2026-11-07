#!/usr/bin/env node
// Contrast checker CLI (tools-cli.md §3.1). Exit: 0 ok; 1 failing pair or manifest violation; 2
// usage/config; 3 internal. With --out it writes contrast-report.json and contrast-report.md (§10).
import { parseArgs } from 'node:util'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { runContrastCheck, renderReportMd, canonicalJson } from './check.ts'

function main(): number {
  let parsed
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        json: { type: 'boolean', default: false },
        pkg: { type: 'string' },
        out: { type: 'string' },
      },
    })
  } catch (e) {
    process.stderr.write(`usage: ${(e as Error).message}\n`)
    return 2
  }
  const { positionals, values } = parsed
  if (positionals[0] !== 'check') {
    process.stderr.write('usage: tokens-contrast check [--json] [--out <dir>] [--pkg <dir>]\n')
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

  if (values.out !== undefined) {
    const outDir = resolve(pkgDir, values.out)
    try {
      mkdirSync(outDir, { recursive: true })
      writeFileSync(join(outDir, 'contrast-report.json'), canonicalJson(result), 'utf8')
      writeFileSync(join(outDir, 'contrast-report.md'), renderReportMd(result), 'utf8')
    } catch (err) {
      process.stderr.write(`internal error: cannot write report to ${outDir}: ${(err as Error).message}\n`)
      return 3
    }
  }

  if (values.json) {
    process.stdout.write(canonicalJson(result))
  } else {
    for (const e of result.errors) process.stderr.write(`error  ${e.code}  ${e.message}\n`)
    for (const f of result.findings) {
      const pos = f.file ? `${f.file}${f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : ''}` : ''
      const ctx = f.context ? ` ${f.context.brand}/${f.context.mode}` : ''
      process.stderr.write(`${pos}  error  ${f.code}  ${f.data?.pair ?? f.token ?? ''}${ctx}  ${f.message}\n`)
    }
    const s = result.summary
    process.stdout.write(`contrast: ${s.cases} cases (${s.exempt} exempt), ${s.passed} passed, ${s.failed} failed, ${result.findings.length} findings.\n`)
  }
  return result.exitCode
}

try {
  process.exit(main())
} catch (e) {
  process.stderr.write(`internal error: ${(e as Error)?.stack ?? e}\n`)
  process.exit(3)
}
