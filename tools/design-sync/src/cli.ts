#!/usr/bin/env node
// CLI de sincronização (tools-cli.md). Saída: 0 ok; 1 divergência; 2 uso; 3 interno; 4 acesso;
// 5 verificação. Só o adaptador "memory" roda aqui; o adaptador da ferramenta real é escrito após
// a decisão do requerente (ADR-14).
import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { readDesired, diff, detect, sync } from './core.ts'
import { InMemoryDesignTool } from './adapters/memory.ts'

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { adapter: { type: 'string', default: 'memory' }, pkg: { type: 'string' }, json: { type: 'boolean', default: false } },
  })
  const cmd = positionals[0]
  if (!['plan', 'apply', 'detect', 'check-access'].includes(cmd ?? '')) {
    process.stderr.write('uso: design-sync <plan|apply|detect|check-access> [--adapter memory] [--pkg <dir>]\n')
    return 2
  }
  if (values.adapter !== 'memory') {
    process.stderr.write(`adaptador "${values.adapter}" indisponível: só "memory" até a decisão do requerente (ADR-14).\n`)
    return 2
  }
  const pkgDir = resolve(values.pkg ?? '.')
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'dist/meta/sync-manifest.json'), 'utf8'))
  const desired = readDesired(manifest)
  const tool = new InMemoryDesignTool()

  if (cmd === 'check-access') {
    const a = await tool.checkAccess()
    return a.ok ? 0 : 4
  }
  if (cmd === 'plan' || cmd === 'detect') {
    const plan = diff(desired, await tool.readSnapshot())
    const out = cmd === 'detect' ? detect(plan) : plan
    process.stdout.write(JSON.stringify(out, null, 2) + '\n')
    return out.length ? 1 : 0
  }
  // apply
  const res = await sync(tool, desired)
  process.stdout.write(`sync: ${res.state}, ${res.plan.length} operações, ${res.restored.length} restauradas.\n`)
  return res.state === 'verified' ? 0 : 5
}

main().then(
  (c) => process.exit(c),
  (e) => {
    process.stderr.write(`erro interno: ${e?.stack ?? e}\n`)
    process.exit(3)
  },
)
