#!/usr/bin/env node
// CLI de checagens do repositório (tools-cli.md). Saída: 0 ok; 1 violação; 2 uso; 3 interno.
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { scanRepo } from './scan.ts'
import { checkLayers } from './layers.ts'
import { checkDeterminism, checkDrift } from './determinism.ts'

function findRoot(): string {
  // repo-checks roda em tools/repo-checks; a raiz tem pnpm-workspace.yaml.
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
    if (!findings.length) process.stdout.write('determinismo: saídas idênticas entre execuções.\n')
    return findings.length ? 1 : 0
  }
  if (cmd === 'drift') {
    const findings = checkDrift(root)
    for (const f of findings) process.stderr.write(`${f.code}  ${f.message}\n`)
    if (!findings.length) process.stdout.write('drift: nenhum artefato gerado versionado; relatório de API em dia.\n')
    return findings.length ? 1 : 0
  }
  process.stderr.write('uso: repo-checks <scan-tokens|layers|determinism|drift> [--json] [--root <dir>]\n')
  return 2
}

main().then(
  (c) => process.exit(c),
  (e) => {
    process.stderr.write(`erro interno: ${e?.stack ?? e}\n`)
    process.exit(3)
  },
)
