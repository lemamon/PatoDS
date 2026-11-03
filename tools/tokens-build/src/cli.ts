#!/usr/bin/env node
// tokens-build CLI (tools-cli.md). Exit codes: 0 ok; 1 violation; 2 usage/config; 3 internal.
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadTokens } from './adapter.ts'
import { buildModel } from './model.ts'
import { validateModel, validationSummary, type Finding } from './validate.ts'
import { runBuild, BuildConfigError } from './build.ts'
import { CssLintError } from './css-lint.ts'

function printFindings(findings: Finding[], json: boolean): void {
  if (json) {
    process.stdout.write(
      JSON.stringify({ format: 'patods.tokens-validate', version: 1, findings }, null, 2) + '\n',
    )
    return
  }
  for (const f of findings) {
    const loc = f.file ? `${f.file}${f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : ''}` : '—'
    process.stderr.write(`${loc}  error  ${f.code}  ${f.id ?? ''}: ${f.message} [${f.rule}]\n`)
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      src: { type: 'string' },
    },
  })
  const cmd = positionals[0]
  if (cmd !== 'validate' && cmd !== 'build') {
    process.stderr.write('usage: tokens-build <validate|build> [--json] [--src <dir>]\n')
    return 2
  }
  const srcDir = resolve(values.src ?? 'src')

  let load
  try {
    load = await loadTokens(srcDir)
  } catch (err) {
    // Parser errors (V-01 schema, V-03 alias/cycle) land here.
    process.stderr.write(`error  TKN-PARSE  ${(err as Error).message}\n`)
    return 1
  }

  const model = buildModel(load)
  const findings = validateModel(model)

  if (cmd === 'validate') {
    printFindings(findings, Boolean(values.json))
    if (!values.json) {
      const s = validationSummary(model)
      process.stdout.write('\nCount per category (primitive/semantic/component):\n')
      for (const [c, r] of Object.entries(s.categories)) {
        process.stdout.write(`  ${c.padEnd(12)} ${r.primitive}/${r.semantic}/${r.component}\n`)
      }
      process.stdout.write(`Control-height scale: ${s.controlScale.join(', ')}\n`)
    }
    return findings.length > 0 ? 1 : 0
  }

  // build command
  if (findings.length > 0) {
    printFindings(findings, Boolean(values.json))
    process.stderr.write('build aborted: validation failed.\n')
    return 1
  }
  try {
    await runBuild(model, srcDir)
    return 0
  } catch (err) {
    if (err instanceof CssLintError) {
      printFindings(err.findings, Boolean(values.json))
      if (!values.json) process.stderr.write('build aborted: generated-CSS lint failed.\n')
      return 1
    }
    if (err instanceof BuildConfigError) {
      process.stderr.write(`error  TKN-CONFIG  ${err.message}\n`)
      return 2
    }
    process.stderr.write(`error  TKN-BUILD-INTERNAL  ${(err as Error).message}\n`)
    return 3
  }
}

// Run only when invoked as the CLI entry, so tests can import main() without side effects.
// `import.meta.main` lands in Node 24.2+; fall back to argv[1] so the bin still runs on Node 22 LTS.
const isEntry =
  import.meta.main ?? (!!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
if (isEntry) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`internal error: ${err?.stack ?? err}\n`)
      process.exit(3)
    },
  )
}
