// ENG-19: CycloneDX SBOM per workspace package (apps, tests, tools, packages) from the native `pnpm sbom`
// (no extra dependency). The lockfile is the only input (`--lockfile-only`), and the per-run fields
// (`serialNumber`, `metadata.timestamp`) are dropped and arrays sorted so the output is byte-stable.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runPnpm } from './pnpm.ts'

export interface SbomFinding {
  code: string
  message: string
}

export const SBOM_DIR = 'reports/sbom'

type Json = Record<string, unknown>

const byKey = (key: string) => (a: Json, b: Json): number => {
  const x = String(a[key] ?? '')
  const y = String(b[key] ?? '')
  return x < y ? -1 : x > y ? 1 : 0
}

/** Drop run-specific fields and sort arrays; the result depends only on the lockfile content. */
export function normalizeBom(bom: Json): Json {
  const { serialNumber: _s, ...rest } = bom
  const out: Json = { ...rest }
  if (out.metadata && typeof out.metadata === 'object') {
    const { timestamp: _t, ...meta } = out.metadata as Json
    out.metadata = meta
  }
  if (Array.isArray(out.components)) out.components = [...(out.components as Json[])].sort(byKey('bom-ref'))
  if (Array.isArray(out.dependencies)) {
    out.dependencies = (out.dependencies as Json[])
      .map((d) => (Array.isArray(d.dependsOn) ? { ...d, dependsOn: [...(d.dependsOn as string[])].sort() } : d))
      .sort(byKey('ref'))
  }
  return out
}

/** `@patods/repo-checks` -> `patods-repo-checks.cdx.json`. */
export function sbomFileName(bom: Json): string | undefined {
  const c = (bom.metadata as Json | undefined)?.component as Json | undefined
  if (!c || typeof c.name !== 'string') return undefined
  const full = typeof c.group === 'string' ? `${c.group}/${c.name}` : c.name
  return `${full.replace(/^@/, '').replace(/[^A-Za-z0-9._-]+/g, '-')}.cdx.json`
}

export function parseSplit(ndjson: string): Json[] {
  return ndjson.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l) as Json)
}

export function generateSbom(root: string): { files: string[]; findings: SbomFinding[] } {
  const findings: SbomFinding[] = []
  const boms = parseSplit(runPnpm(root, ['sbom', '--sbom-format', 'cyclonedx', '--lockfile-only', '--split']))
  if (boms.length === 0) return { files: [], findings: [{ code: 'ENG19-EMPTY', message: '`pnpm sbom --split` produced no SBOM.' }] }
  const dir = join(root, SBOM_DIR)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const files: string[] = []
  for (const bom of boms) {
    const name = sbomFileName(bom)
    if (!name) {
      findings.push({ code: 'ENG19-NO-NAME', message: 'An SBOM has no metadata.component name.' })
      continue
    }
    writeFileSync(join(dir, name), JSON.stringify(normalizeBom(bom), null, 2) + '\n')
    files.push(name)
  }
  return { files: files.sort(), findings }
}
