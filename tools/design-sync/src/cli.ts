#!/usr/bin/env node
// design-sync CLI (tools-cli.md §5, design-sync.md §10/§11). Exit codes: 0 ok; 1 divergence or
// --fail-on-changes; 2 usage/config/precondition; 3 internal; 4 tool access; 5 verify mismatch. Only the
// `memory` adapter runs until the requester chooses a tool (ADR-14). No command imports tool variables
// into the repository (FR-025): there is no import command and --out inside packages/tokens/ is refused.
import { parseArgs } from 'node:util'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ReleaseRef, RoleRef, SyncConfig, ToolSnapshot } from './ports.ts'
import { canonicalStringify, parseManifest, type Manifest } from './core/index.ts'
import { detectDivergences } from './core/divergence.ts'
import { runApply, runDetect, runPlan, systemClock, type SyncOptions } from './core/sync.ts'
import { InMemoryDesignTool, InMemoryAlert, InMemoryTracker } from './adapters/memory.ts'
import { resolveOwner } from './adapters/github/owners.ts'

interface Flags {
  adapter: string
  config: string
  manifest: string
  previous?: string
  out?: string
  'memory-state'?: string
  'memory-out'?: string
  tracker: string
  alert: string
  trigger: string
  'run-url'?: string
  version?: string
  json: boolean
  'dry-run': boolean
  'allow-mass-delete': boolean
  'no-publish': boolean
  'no-tracker': boolean
  'fail-on-changes': boolean
  'first-sync': boolean
  root: string
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function usage(): never {
  process.stderr.write('usage: design-sync <plan|apply|detect|check-access> [--adapter memory] [--manifest <f>] [--previous <f>] [--config <f>] [--out <dir>] [--json]\n')
  process.exit(2)
}

function writeOut(dir: string, name: string, content: string): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), content)
}

function resolveOwnerRef(root: string, ownerPath: string): RoleRef {
  try {
    const text = readFileSync(join(root, '.github/CODEOWNERS'), 'utf8')
    const owner = resolveOwner(text, ownerPath)
    if (owner) return owner
  } catch {
    /* no CODEOWNERS available locally */
  }
  return { kind: 'team', slug: '@patods/design-sync-owners', source: 'CODEOWNERS' }
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      adapter: { type: 'string', default: 'memory' },
      config: { type: 'string', default: 'tools/design-sync/design-sync.config.json' },
      manifest: { type: 'string', default: 'packages/tokens/dist/meta/sync-manifest.json' },
      previous: { type: 'string' },
      out: { type: 'string' },
      'memory-state': { type: 'string' },
      'memory-out': { type: 'string' },
      tracker: { type: 'string', default: 'memory' },
      alert: { type: 'string', default: 'memory' },
      trigger: { type: 'string', default: 'manual' },
      'run-url': { type: 'string' },
      version: { type: 'string' },
      json: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'allow-mass-delete': { type: 'boolean', default: false },
      'no-publish': { type: 'boolean', default: false },
      'no-tracker': { type: 'boolean', default: false },
      'fail-on-changes': { type: 'boolean', default: false },
      'first-sync': { type: 'boolean', default: false },
      root: { type: 'string', default: '.' },
    },
  })
  const flags = values as unknown as Flags
  const cmd = positionals[0]
  if (!cmd || !['plan', 'apply', 'detect', 'check-access'].includes(cmd)) usage()
  if (flags.adapter !== 'memory') {
    process.stderr.write(`adapter "${flags.adapter}" is not available: only "memory" exists until the requester chooses a tool (ADR-14).\n`)
    return 2
  }
  const root = resolve(flags.root)
  const config = loadJson(resolve(flags.config)) as SyncConfig

  if (flags.out) {
    const outAbs = resolve(flags.out)
    if (outAbs.includes(`${join(root, 'packages', 'tokens')}`)) {
      process.stderr.write('refusing --out inside packages/tokens/: design-sync never writes to the token source (FR-025).\n')
      return 2
    }
  }

  const tool = new InMemoryDesignTool(flags['memory-state'] ? { initial: loadJson(resolve(flags['memory-state'])) as ToolSnapshot } : {})

  if (cmd === 'check-access') {
    const access = await tool.checkAccess()
    const capabilities = tool.capabilities()
    const owner = resolveOwnerRef(root, config.ownerPath)
    if (flags.json) process.stdout.write(canonicalStringify({ format: 'patods.cli-result', version: 1, tool: 'design-sync', command: 'check-access', ok: access.ok, exitCode: access.ok ? 0 : 4, access, capabilities, owner }))
    else process.stderr.write(`check-access: ${access.ok ? 'ok' : 'FAILED'} (${access.problems.map((p) => p.code).join(', ') || 'no problems'})\n`)
    return access.ok ? 0 : 4
  }

  const manifest = parseManifest(loadJson(resolve(flags.manifest)))
  const previousProvided = !!flags.previous
  const previous: Manifest | null = flags.previous ? parseManifest(loadJson(resolve(flags.previous))) : null
  const firstSync = !previousProvided && (flags['first-sync'] || flags.trigger !== 'release')
  if (flags.trigger === 'release' && !previousProvided && !flags['first-sync']) {
    process.stderr.write('release trigger requires --previous (or --first-sync for the first sync) to classify drift (design-sync.md §6).\n')
    return 2
  }

  const owner = resolveOwnerRef(root, config.ownerPath)
  const release: ReleaseRef = { version: manifest.source.version, changelogExcerpt: '' }
  const options: SyncOptions = {
    manifest, previous, previousProvided, firstSync, config,
    tool: tool.capabilities().toolId + ':' + (config.tool.target ?? 'sandbox'),
    source: { package: manifest.source.package, version: manifest.source.version, changelog: `CHANGELOG#${manifest.source.version}` },
    trigger: flags.trigger as SyncOptions['trigger'],
    runUrl: flags['run-url'] ?? null,
    allowMassDelete: flags['allow-mass-delete'],
    publish: !flags['no-publish'],
    release,
    clock: systemClock,
    owner,
    alert: new InMemoryAlert(),
  }

  if (cmd === 'plan') {
    const out = await runPlan(tool, options)
    if (flags.out) {
      writeOut(resolve(flags.out), 'sync-plan.json', canonicalStringify(out.plan))
      writeOut(resolve(flags.out), 'sync-plan.md', out.markdown)
    }
    if (flags.json) process.stdout.write(canonicalStringify({ format: 'patods.cli-result', version: 1, tool: 'design-sync', command: 'plan', ok: out.exitCode === 0, exitCode: out.exitCode, plan: out.plan }))
    else process.stderr.write(`plan: ${out.plan.operations.length} operations.\n`)
    if (out.error) return out.exitCode
    return flags['fail-on-changes'] && out.plan.operations.length > 0 ? 1 : 0
  }

  if (cmd === 'apply') {
    if (flags.version && flags.version !== manifest.source.version) {
      process.stderr.write(`--version ${flags.version} does not match manifest source.version ${manifest.source.version}.\n`)
      return 2
    }
    const out = await runApply(tool, options, { dryRun: flags['dry-run'] })
    if (flags.out) {
      writeOut(resolve(flags.out), 'sync-plan.json', canonicalStringify(out.plan))
      writeOut(resolve(flags.out), 'sync-plan.md', out.markdown)
      writeOut(resolve(flags.out), 'sync-log.json', out.logText)
      writeOut(resolve(flags.out), 'sync-log.md', out.markdown)
      writeOut(resolve(flags.out), 'sync-envelope.json', canonicalStringify(out.envelope))
    }
    if (flags['memory-out']) writeFileSync(resolve(flags['memory-out']), canonicalStringify(await tool.readSnapshot()))
    if (flags.json) process.stdout.write(canonicalStringify({ format: 'patods.cli-result', version: 1, tool: 'design-sync', command: 'apply', ok: out.exitCode === 0, exitCode: out.exitCode, log: out.log, envelope: out.envelope }))
    else process.stderr.write(`apply: ${out.state} (${out.plan.operations.length} ops).\n`)
    return out.exitCode
  }

  // detect
  const tracker = flags['no-tracker'] ? undefined : new InMemoryTracker(systemClock)
  const out = await runDetect(tool, options, tracker)
  if (flags.out) {
    const report = detectDivergences({ manifest, snapshot: await tool.readSnapshot(), tool: options.tool, previous, previousProvided, firstSync })
    writeOut(resolve(flags.out), 'divergence-report.json', canonicalStringify({ format: 'patods.divergence-report', version: 1, tool: options.tool, sourceVersion: manifest.source.version, divergences: report.items, summary: { divergences: report.items.length, byKind: report.counts } }))
  }
  if (flags.json) process.stdout.write(canonicalStringify({ format: 'patods.cli-result', version: 1, tool: 'design-sync', command: 'detect', ok: out.exitCode === 0, exitCode: out.exitCode, summary: { divergences: out.items.length, byKind: out.counts }, divergences: out.items, tracker: out.tracker }))
  else process.stderr.write(`detect: ${out.items.length} divergence(s).\n`)
  return out.exitCode
}

main().then(
  (c) => process.exit(c),
  (e) => {
    process.stderr.write(`internal error: ${e?.stack ?? e}\n`)
    process.exit(3)
  },
)
