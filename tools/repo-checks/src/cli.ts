#!/usr/bin/env node
// Repository checks CLI (tools-cli.md). Exit: 0 ok; 1 violation; 2 usage; 3 internal.
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { scanRepo } from './scan.ts'
import { checkLayers } from './layers.ts'
import { checkDeterminism, checkDrift } from './determinism.ts'
import { checkTraceability } from './traceability.ts'
import { checkLogicTests } from './logic-tests.ts'

function findRoot(): string {
  // repo-checks runs in tools/repo-checks; the root has pnpm-workspace.yaml.
  return resolve(process.cwd(), '../..')
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { json: { type: 'boolean', default: false }, root: { type: 'string' } },
  })
  const cmd = positionals[0]
  const root = resolve(values.root ?? findRoot())

  if (cmd === 'scan-tokens') {
    const findings = await scanRepo(root)
    if (values.json) process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n')
    else for (const f of findings) process.stderr.write(`${f.file}  ${f.code}  ${f.message}\n`)
    return findings.length ? 1 : 0
  }
  if (cmd === 'layers') {
    const findings = await checkLayers(root)
    if (values.json) process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n')
    else for (const f of findings) process.stderr.write(`${f.pkg}  ${f.code}  ${f.message}\n`)
    return findings.length ? 1 : 0
  }
  if (cmd === 'determinism') {
    const findings = checkDeterminism(root)
    for (const f of findings) process.stderr.write(`${f.code}  ${f.message}\n`)
    if (!findings.length) process.stdout.write('determinism: identical outputs across runs.\n')
    return findings.length ? 1 : 0
  }
  if (cmd === 'drift') {
    const findings = checkDrift(root)
    for (const f of findings) process.stderr.write(`${f.code}  ${f.message}\n`)
    if (!findings.length) process.stdout.write('drift: no generated artifact tracked; API report up to date.\n')
    return findings.length ? 1 : 0
  }
  if (cmd === 'traceability') {
    const findings = checkTraceability(root)
    if (values.json) process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n')
    else for (const f of findings) process.stderr.write(`${f.id ?? '-'}  ${f.code}  ${f.message}\n`)
    if (!findings.length) process.stdout.write('traceability: every contracted id maps to a real check or evidence (ACE-02).\n')
    return findings.length ? 1 : 0
  }
  if (cmd === 'logic-tests') {
    const findings = checkLogicTests(root)
    if (values.json) process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n')
    else for (const f of findings) process.stderr.write(`${f.module}  ${f.code}  ${f.message}\n`)
    if (!findings.length) process.stdout.write('logic-tests: every runtime module has a test (QA-02).\n')
    return findings.length ? 1 : 0
  }
  process.stderr.write('usage: repo-checks <scan-tokens|layers|determinism|drift|traceability|logic-tests> [--json] [--root <dir>]\n')
  return 2
}

main().then(
  (c) => process.exit(c),
  (e) => {
    process.stderr.write(`internal error: ${e?.stack ?? e}\n`)
    process.exit(3)
  },
)
