// Contrast checker (US4, A11Y-09, contrast-manifest.md §6/§8/§10). Validates the versioned manifest and
// surface sets (CM-01..CM-08), then measures every pair across every brand × mode permutation: expands
// `@set` surface sets (§8 step 2), resolves each reference to its emitted sRGB from the token manifest,
// verifies G-2 independently by running the build's own `toEmittedSrgb()` on the recorded DTCG value and
// comparing it to the emitted string (`emitted-mismatch`), composites alpha over an opaque stack in gamma
// sRGB (float and 8-bit-per-fold), takes the smaller WCAG 2.2 ratio, and decides per case/pair/group.
// Minimums come only from quality/thresholds.json, checked against the normative table (G-4). Pure and
// deterministic (G-3): every iteration is in code-point order and no output carries a timestamp, absolute
// path or locale-formatted number.
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { parse as parseJsonAst } from '@humanwhocodes/momoa'
import { parseEmitted, toEmittedSrgb, over, relativeLuminance, contrastRatio, type DtcgColor } from '@patods/color'

export interface Pair {
  id: string
  fg: string
  bg: string[] | string
  state: string
  kind: 'text' | 'non-text'
  group?: string
  exempt?: string
  description?: string
}

export interface Thresholds {
  level: string
  text: number
  nonText: number
}

export interface Finding {
  code: string
  severity: 'error'
  message: string
  file?: string
  line?: number
  column?: number
  token?: string
  context?: { brand: string; mode: string }
  data?: { pair?: string; ratio?: number; minimum?: number; surface?: string | null }
}

export interface CliError {
  code: string
  message: string
}

export interface ContrastCase {
  pair: string
  brand: string
  mode: string
  surface: string | null
  state: string
  kind: 'text' | 'non-text'
  fg: string
  bg: string[]
  ratio: number
  ratioFloat: number
  ratio8bit: number
  minimum: number
  result: 'pass' | 'fail' | 'exempt'
  group: string | null
  flags: Array<'near-threshold'>
}

export interface ContrastGroup {
  id: string
  members: string[]
  result: 'pass' | 'fail'
}

export interface ContrastCheckResult {
  format: 'patods.cli-result'
  version: 1
  tool: 'tokens-contrast'
  command: 'check'
  ok: boolean
  exitCode: 0 | 1 | 2 | 3
  level: string
  minimums: { nonText: number; text: number }
  summary: {
    cases: number
    pairs: number
    passed: number
    failed: number
    exempt: number
    groups: { passed: number; failed: number }
  }
  cases: ContrastCase[]
  groups: ContrastGroup[]
  findings: Finding[]
  errors: CliError[]
}

// Normative minimums per level (G-4, QA-14). Switching level needs an ADR-15 change here and in
// quality/thresholds.json; the checker never takes a minimum from anywhere else.
const LEVEL_TABLE: Record<string, { text: number; nonText: number }> = {
  'WCAG22-AA': { text: 4.5, nonText: 3 },
}

// The versioned state vocabulary (contrast-manifest.md §5). The manifest schema is the single source;
// this copy only lets CM-08 report `unknown-state` against the vocabulary rather than as a schema error.
const STATE_VOCAB = new Set(['default', 'hover', 'active', 'focus-visible', 'selected', 'invalid', 'disabled', 'inactive'])

/** G-4: the thresholds file must name a known level with the table's exact minimums. */
export function checkThresholds(th: Thresholds): CliError | null {
  const row = LEVEL_TABLE[th?.level]
  if (!row) return { code: 'THRESHOLDS_MISMATCH', message: `Unknown contrast level ${JSON.stringify(th?.level)}; the checker table has [${Object.keys(LEVEL_TABLE).join(', ')}] (G-4, QA-14).` }
  if (th.text !== row.text || th.nonText !== row.nonText) {
    return { code: 'THRESHOLDS_MISMATCH', message: `Thresholds for ${th.level} (text ${th.text}, non-text ${th.nonText}) differ from the normative table (text ${row.text}, non-text ${row.nonText}); minimums cannot be lowered (G-4).` }
  }
  return null
}

const trunc4 = (n: number) => Math.trunc(n * 1e4) / 1e4
/** Two-decimal, truncated (never rounded), locale-independent, with trailing zeros (§10). */
const fmt2 = (n: number) => (Math.trunc(n * 100) / 100).toFixed(2)

/** Canonical JSON (tools-cli.md §1.4): code-point-sorted keys, 2-space indent, LF, final newline. */
function sortDeep(value: any): any {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key])
    return out
  }
  return value
}
export function canonicalJson(value: any): string {
  return JSON.stringify(sortDeep(value), null, 2) + '\n'
}

// --- Source positions (momoa), so findings carry file:line:column of the offending node (§6). ---

/** Resolves a JSON pointer (`/pairs/0/fg`) to its momoa node, to read the 1-based source position. */
function nodeAtPointer(root: any, pointer: string): any {
  if (!pointer) return root
  const parts = pointer.split('/').slice(1).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let node = root
  for (const part of parts) {
    if (node?.type === 'Object') {
      const m = node.members.find((mm: any) => mm.name?.value === part)
      if (!m) return node
      node = m.value
    } else if (node?.type === 'Array') {
      const i = Number(part)
      if (!Number.isInteger(i) || i < 0 || i >= node.elements.length) return node
      node = node.elements[i]?.value ?? node.elements[i]
    } else return node
  }
  return node
}

interface Positions {
  at(pointer: string): { line?: number; column?: number }
}
function positionsOf(text: string): Positions {
  let doc: any = null
  try {
    doc = parseJsonAst(text)
  } catch {
    doc = null
  }
  return {
    at(pointer: string) {
      if (!doc) return {}
      const loc = nodeAtPointer(doc.body, pointer)?.loc?.start
      return loc ? { line: loc.line, column: loc.column } : {}
    },
  }
}

// --- Schema validation (CM-01). Ajv with strict:false to tolerate 2020-12 + annotations. ---

// Ajv wrapper keywords that only restate a more specific inner failure (mirror of tokens-build/schema.ts).
const WRAPPER_KEYWORDS = new Set(['if', 'then', 'else', 'oneOf', 'anyOf', 'not', 'allOf'])

/** Maps Ajv errors to `manifest-schema` findings, dropping the errors that a dedicated semantic code
 * reports instead: the state enum (CM-08 `unknown-state`) and the group/exempt conditionals
 * (CM-06/CM-07). Everything else — a missing field, a wrong type, an unknown property, a bad pattern —
 * is a genuine shape error with no dedicated code. */
function schemaFindings(errors: any[], file: string, pos: Positions): Finding[] {
  const out: Finding[] = []
  const seen = new Set<string>()
  for (const err of errors ?? []) {
    if (WRAPPER_KEYWORDS.has(err.keyword)) continue
    const inConditional = /\/(if|then|else)\b/.test(err.schemaPath ?? '')
    const onState = (err.instancePath ?? '').endsWith('/state')
    if (inConditional || onState) continue
    const where = err.instancePath || '(root)'
    const key = `${file}|${where}|${err.message}`
    if (seen.has(key)) continue
    seen.add(key)
    const { line, column } = pos.at(err.instancePath ?? '')
    out.push({
      code: 'manifest-schema',
      severity: 'error',
      file,
      line,
      column,
      message: `${where} ${err.message ?? 'does not match the schema'} (CM-01, FR-019).`,
    })
  }
  return out
}

interface TokenInfo {
  role: string
  layer: string
  type: string
}

interface Resolved {
  rgb: [number, number, number]
  alpha: number
}

/** Composition + the smaller of the two WCAG variants for one resolved stack (bottom-up) and fg. */
function measure(fg: Resolved, stack: Resolved[]): { ratio: number; ratioFloat: number; ratio8bit: number } {
  const compose = (round8: boolean): number => {
    let bottom: [number, number, number] = stack[0]!.rgb
    for (let i = 1; i < stack.length; i++) bottom = over(stack[i]!, bottom, round8)
    const fgFinal = over(fg, bottom, round8)
    return contrastRatio(relativeLuminance(fgFinal), relativeLuminance(bottom))
  }
  const ratioFloat = compose(false)
  const ratio8bit = compose(true)
  return { ratio: Math.min(ratioFloat, ratio8bit), ratioFloat, ratio8bit }
}

function toList(bg: string[] | string): string[] {
  return typeof bg === 'string' ? [bg] : [...bg]
}

export function runContrastCheck(pkgDir: string, thresholds: Thresholds): ContrastCheckResult {
  const base = {
    format: 'patods.cli-result' as const,
    version: 1 as const,
    tool: 'tokens-contrast' as const,
    command: 'check' as const,
    level: thresholds?.level,
    minimums: { nonText: thresholds?.nonText, text: thresholds?.text },
  }
  const fail = (exitCode: 2 | 3, err: CliError): ContrastCheckResult => ({
    ...base,
    ok: false,
    exitCode,
    summary: emptySummary(),
    cases: [],
    groups: [],
    findings: [],
    errors: [err],
  })

  // G-4 first: a bad thresholds file is a configuration error (exit 2), not a measurement.
  const thErr = checkThresholds(thresholds)
  if (thErr) return fail(2, thErr)

  const root = resolve(pkgDir, '../..')
  const manifestRel = relative(root, join(pkgDir, 'contrast/manifest.json')).split('\\').join('/')
  const surfacesRel = relative(root, join(pkgDir, 'contrast/surfaces.json')).split('\\').join('/')

  let manifestText: string
  let tokensManifest: any
  try {
    manifestText = readFileSync(join(pkgDir, 'contrast/manifest.json'), 'utf8')
  } catch {
    return fail(2, { code: 'CONFIG', message: `Cannot read ${manifestRel}.` })
  }
  try {
    tokensManifest = JSON.parse(readFileSync(join(pkgDir, 'dist/meta/tokens.manifest.json'), 'utf8'))
  } catch {
    return fail(2, { code: 'CONFIG', message: 'Cannot read dist/meta/tokens.manifest.json; run `pnpm tokens:build` first.' })
  }
  let manifest: any
  try {
    manifest = JSON.parse(manifestText)
  } catch (e) {
    return fail(2, { code: 'CONFIG', message: `Invalid JSON in ${manifestRel}: ${(e as Error).message}.` })
  }

  const perms: string[] = tokensManifest.permutations
  if (!Array.isArray(perms) || perms.length === 0) {
    return fail(2, { code: 'CONFIG', message: 'The token manifest has no permutation list (G-1).' })
  }
  const sortedPerms = [...perms].sort()

  // surfaces.json is optional on disk; absent means no sets. A present-but-invalid file is CONFIG.
  let surfacesText: string | null = null
  let surfaces: any = { sets: {} }
  try {
    surfacesText = readFileSync(join(pkgDir, 'contrast/surfaces.json'), 'utf8')
    surfaces = JSON.parse(surfacesText)
  } catch (e) {
    if (surfacesText !== null) return fail(2, { code: 'CONFIG', message: `Invalid JSON in ${surfacesRel}: ${(e as Error).message}.` })
  }

  const findings: Finding[] = []
  const manifestPos = positionsOf(manifestText)
  const surfacesPos = positionsOf(surfacesText ?? '')

  // Token roles for CM-03 (public semantic/component color only; primitive and brand-mode-source are
  // forbidden references). Primitives carry role `public` in the manifest, so the layer is what forbids.
  const tokenInfo = new Map<string, TokenInfo>()
  for (const t of tokensManifest.tokens ?? []) tokenInfo.set(t.path, { role: t.role, layer: t.layer, type: t.type })

  // ---- CM-01: schema validation of both files. ----
  const schemaErr = (file: string): Finding => ({ code: 'manifest-schema', severity: 'error', file, message: `Cannot load or compile ${file}'s schema (CM-01).` })
  try {
    const manifestSchema = JSON.parse(readFileSync(join(pkgDir, 'contrast/manifest.schema.json'), 'utf8'))
    const validate = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(manifestSchema)
    if (!validate(manifest)) findings.push(...schemaFindings(validate.errors ?? [], manifestRel, manifestPos))
  } catch {
    findings.push(schemaErr(manifestRel))
  }
  if (surfacesText !== null) {
    try {
      const surfacesSchema = JSON.parse(readFileSync(join(pkgDir, 'contrast/surfaces.schema.json'), 'utf8'))
      const validate = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(surfacesSchema)
      if (!validate(surfaces)) findings.push(...schemaFindings(validate.errors ?? [], surfacesRel, surfacesPos))
    } catch {
      findings.push(schemaErr(surfacesRel))
    }
  }

  const pairsRaw: Pair[] = Array.isArray(manifest.pairs) ? manifest.pairs : []
  const setNames = new Set(Object.keys(surfaces.sets ?? {}))
  // CM-03: a reference is forbidden when it resolves to a token that is a primitive, a brand-mode-source,
  // or not of $type color. Primitives carry role `public` in the manifest, so the layer is what forbids.
  const forbiddenInfo = (id: string): TokenInfo | null => {
    const info = tokenInfo.get(id)
    return info && (info.layer === 'primitive' || info.role === 'brand-mode-source' || info.type !== 'color') ? info : null
  }
  // First source index of each pair id, for stable positions.
  const indexOfId = new Map<string, number>()
  pairsRaw.forEach((p, i) => {
    if (p && typeof p.id === 'string' && !indexOfId.has(p.id)) indexOfId.set(p.id, i)
  })
  const pairFinding = (p: Pair, extra: Partial<Finding>): Finding => {
    const i = indexOfId.get(p.id) ?? 0
    const { line, column } = manifestPos.at(`/pairs/${i}`)
    return { severity: 'error', file: manifestRel, line, column, ...extra } as Finding
  }

  // Pairs that must not be measured (a structural defect makes measurement meaningless or unsafe).
  const blocked = new Set<string>()
  const block = (id: string) => blocked.add(id)

  // ---- CM-02: order by id (code point) and id uniqueness. ----
  const ids = pairsRaw.map((p) => (p && typeof p.id === 'string' ? p.id : ''))
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] && ids[i - 1] && ids[i]! < ids[i - 1]!) {
      findings.push(pairFinding(pairsRaw[i]!, { code: 'unsorted-manifest', data: { pair: ids[i]! }, message: `Pair "${ids[i]}" is out of code-point order (after "${ids[i - 1]}"); the manifest must be sorted by id (CM-02).` }))
      break
    }
  }
  const idSeen = new Set<string>()
  for (const p of pairsRaw) {
    if (!p || typeof p.id !== 'string') continue
    if (idSeen.has(p.id)) {
      findings.push(pairFinding(p, { code: 'duplicate-id', data: { pair: p.id }, message: `Duplicate pair id "${p.id}" (CM-02).` }))
      block(p.id)
    }
    idSeen.add(p.id)
  }

  // ---- CM-03 on surface-set members (contrast-manifest §4/§6): each surface of each set must be a
  // public semantic/component color. A set with a forbidden member is reported against surfaces.json and
  // its name is collected so that any pair using it is not silently measured. ----
  const badSets = new Set<string>()
  for (const setName of [...setNames].sort()) {
    const modes = surfaces.sets?.[setName] ?? {}
    for (const mode of Object.keys(modes).sort()) {
      const list = Array.isArray(modes[mode]) ? modes[mode] : []
      list.forEach((id: string, i: number) => {
        const info = typeof id === 'string' ? forbiddenInfo(id) : null
        if (info) {
          badSets.add(setName)
          const { line, column } = surfacesPos.at(`/sets/${setName}/${mode}/${i}`)
          findings.push({ code: 'forbidden-reference', severity: 'error', file: surfacesRel, line, column, token: id, data: { surface: id }, message: `Surface set "${setName}" (${mode}[${i}]): "${id}" is a ${info.layer}/${info.role}/${info.type}; a surface must be a public semantic or component color token (CM-03, §4).` })
        }
      })
    }
  }

  // ---- CM-03/04/05/06/07/08: per-pair structural rules. ----
  const tupleSeen = new Map<string, string>()
  for (const p of pairsRaw) {
    if (!p || typeof p.id !== 'string') continue
    const bgList = toList(p.bg)

    // CM-08: state must belong to the versioned vocabulary.
    if (typeof p.state !== 'string' || !STATE_VOCAB.has(p.state)) {
      findings.push(pairFinding(p, { code: 'unknown-state', data: { pair: p.id }, message: `Pair "${p.id}": state ${JSON.stringify(p.state)} is outside the versioned vocabulary (CM-08, §5).` }))
      block(p.id)
    }
    // CM-07: exempt only with state disabled or inactive.
    if (p.exempt !== undefined && !(p.state === 'disabled' || p.state === 'inactive')) {
      findings.push(pairFinding(p, { code: 'exempt-invalid-state', data: { pair: p.id }, message: `Pair "${p.id}": "exempt" is allowed only with state "disabled" or "inactive", not ${JSON.stringify(p.state)} (CM-07).` }))
      block(p.id)
    }
    // CM-03: fg and bg tokens must be a public semantic/component color (not primitive/brand-mode-source/non-color).
    const refs: Array<{ id: string; where: string }> = []
    if (typeof p.fg === 'string') refs.push({ id: p.fg, where: 'fg' })
    bgList.forEach((b, i) => { if (typeof b === 'string' && !b.startsWith('@')) refs.push({ id: b, where: `bg[${i}]` }) })
    for (const r of refs) {
      const info = forbiddenInfo(r.id)
      if (info) {
        findings.push(pairFinding(p, { code: 'forbidden-reference', token: r.id, data: { pair: p.id }, message: `Pair "${p.id}" (${r.where}): "${r.id}" is a ${info.layer}/${info.role}/${info.type}; only a public semantic or component color token is allowed (CM-03).` }))
        block(p.id)
      }
    }
    // CM-04: @set only in the first position of bg, and must exist in surfaces.json (and its members must
    // themselves satisfy CM-03 — a pair using a set with a forbidden member is blocked, not measured).
    bgList.forEach((b, i) => {
      if (typeof b === 'string' && b.startsWith('@')) {
        if (i !== 0) {
          findings.push(pairFinding(p, { code: 'unknown-surface-set', token: b, data: { pair: p.id }, message: `Pair "${p.id}": a surface set (${b}) may only be the base of the stack, not position ${i} (CM-04).` }))
          block(p.id)
        } else if (!setNames.has(b)) {
          findings.push(pairFinding(p, { code: 'unknown-surface-set', token: b, data: { pair: p.id }, message: `Pair "${p.id}": surface set "${b}" is not defined in surfaces.json (CM-04).` }))
          block(p.id)
        } else if (badSets.has(b)) {
          block(p.id)
        }
      }
    })
    // CM-05: no two pairs share the canonical tuple (fg, bg-as-list, state, kind).
    const tuple = JSON.stringify([p.fg, bgList, p.state, p.kind])
    if (tupleSeen.has(tuple)) {
      findings.push(pairFinding(p, { code: 'duplicate-pair', data: { pair: p.id }, message: `Pair "${p.id}" repeats the canonical tuple (fg, bg, state, kind) of "${tupleSeen.get(tuple)}" (CM-05).` }))
    } else {
      tupleSeen.set(tuple, p.id)
    }
  }

  // ---- CM-06: any-of groups. ----
  const groupsMap = new Map<string, Pair[]>()
  for (const p of pairsRaw) {
    if (p && typeof p.id === 'string' && p.group) {
      const g = groupsMap.get(p.group) ?? []
      g.push(p)
      groupsMap.set(p.group, g)
    }
  }
  const invalidGroups = new Set<string>()
  for (const [gid, members] of [...groupsMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const problems: string[] = []
    if (members.length < 2) problems.push('fewer than two members')
    const fgs = new Set(members.map((m) => m.fg))
    if (fgs.size > 1) problems.push('members with different fg')
    const bgs = members.map((m) => JSON.stringify(toList(m.bg)))
    if (new Set(bgs).size !== bgs.length) problems.push('non-distinct bg')
    if (members.some((m) => m.state !== 'focus-visible')) problems.push('a member whose state is not focus-visible')
    if (members.some((m) => m.kind !== 'non-text')) problems.push('a member whose kind is not non-text')
    if (members.some((m) => m.exempt !== undefined)) problems.push('a member with exempt')
    if (problems.length) {
      invalidGroups.add(gid)
      const anchor = members[0]!
      findings.push(pairFinding(anchor, { code: 'invalid-group', data: { pair: gid }, message: `Group "${gid}" is invalid: ${problems.join('; ')} (CM-06).` }))
      members.forEach((m) => block(m.id))
    }
  }

  // ---- Measurement (§8). ----
  const cases: ContrastCase[] = []
  // pair id -> perm -> passed? (all expanded surface cases pass)
  const pairPass = new Map<string, Map<string, boolean>>()

  // Resolution is memoized per (pair, permutation) via `cache`: a token shared across the expanded
  // surfaces of a @set — the foreground, or a layer above the base — resolves and reports once, not once
  // per surface. Distinct tokens (each surface base) still get their own finding.
  const resolveColor = (id: string, pair: string, brand: string, mode: string, cache: Map<string, Resolved | null>): Resolved | null => {
    if (cache.has(id)) return cache.get(id)!
    const perm = `${brand}/${mode}`
    const { line, column } = manifestPos.at(`/pairs/${indexOfId.get(pair) ?? 0}`)
    const at = { file: manifestRel, line, column }
    const push = (f: Finding): null => { findings.push(f); cache.set(id, null); return null }
    const tok = tokensManifest.tokens?.find((x: any) => x.path === id)
    const emitted = tok?.color?.emitted?.[perm]
    if (typeof emitted !== 'string') {
      return push({ code: 'unknown-token', severity: 'error', ...at, token: id, context: { brand, mode }, data: { pair }, message: `Pair "${pair}": "${id}" has no emitted color in ${perm} (V-14, A11Y-09).` })
    }
    // G-2: recompute the emitted string from the recorded DTCG value with the build's own toEmittedSrgb.
    const value = tok?.color?.value?.[perm] as DtcgColor | undefined
    if (value) {
      let reEmitted: string
      try {
        reEmitted = toEmittedSrgb(value)
      } catch {
        return push({ code: 'emitted-mismatch', severity: 'error', ...at, token: id, context: { brand, mode }, data: { pair }, message: `Pair "${pair}": the recorded DTCG value for "${id}" in ${perm} is not a serializable sRGB color (G-2).` })
      }
      if (reEmitted !== emitted) {
        return push({ code: 'emitted-mismatch', severity: 'error', ...at, token: id, context: { brand, mode }, data: { pair }, message: `Pair "${pair}": toEmittedSrgb() of "${id}" in ${perm} is "${reEmitted}", but the build emitted "${emitted}" (G-2).` })
      }
    }
    try {
      const resolved = parseEmitted(emitted)
      cache.set(id, resolved)
      return resolved
    } catch {
      return push({ code: 'emitted-mismatch', severity: 'error', ...at, token: id, context: { brand, mode }, data: { pair }, message: `Pair "${pair}": emitted "${emitted}" for "${id}" in ${perm} is not a readable sRGB value (G-2).` })
    }
  }

  const sortedPairs = [...pairsRaw].filter((p) => p && typeof p.id === 'string').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const pair of sortedPairs) {
    const permPass = new Map<string, boolean>()
    pairPass.set(pair.id, permPass)
    if (blocked.has(pair.id)) {
      for (const perm of sortedPerms) permPass.set(perm, false)
      continue
    }
    const minimum = pair.kind === 'text' ? thresholds.text : thresholds.nonText
    const bgList = toList(pair.bg)
    const isSet = typeof bgList[0] === 'string' && bgList[0]!.startsWith('@')

    for (const perm of sortedPerms) {
      const [brand, mode] = perm.split('/') as [string, string]
      // §8 step 2: expand @set into one case per surface of the set in this permutation's mode.
      let expansions: Array<{ surface: string | null; stack: string[] }>
      if (isSet) {
        const setName = bgList[0]!
        const modeSurfaces: string[] = surfaces.sets?.[setName]?.[mode] ?? []
        if (!Array.isArray(modeSurfaces) || modeSurfaces.length === 0) {
          findings.push(pairFinding(pair, { code: 'empty-surface-set', context: { brand, mode }, data: { pair: pair.id }, message: `Pair "${pair.id}": surface set "${setName}" has no surface in mode "${mode}" (V-16).` }))
          permPass.set(perm, false)
          continue
        }
        expansions = modeSurfaces.map((s) => ({ surface: s, stack: [s, ...bgList.slice(1)] }))
      } else {
        expansions = [{ surface: null, stack: bgList }]
      }

      // One resolution cache per (pair, permutation): the foreground and any layer shared across the
      // expanded surfaces resolves and reports once, not once per surface (§8 step 3).
      const cache = new Map<string, Resolved | null>()
      const fg = resolveColor(pair.fg, pair.id, brand, mode, cache)
      let allPass = true
      for (const exp of expansions) {
        const stack = exp.stack.map((id) => resolveColor(id, pair.id, brand, mode, cache))
        if (!fg || stack.some((s) => s === null)) {
          allPass = false
          continue
        }
        const resolvedStack = stack as Resolved[]
        if (resolvedStack[0]!.alpha < 1) {
          findings.push(pairFinding(pair, { code: 'stack-not-opaque', token: exp.stack[0], context: { brand, mode }, data: { pair: pair.id, surface: exp.surface }, message: `Pair "${pair.id}": the base "${exp.stack[0]}" is translucent in ${perm}; the checker never assumes a background (V-16).` }))
          allPass = false
          continue
        }
        const m = measure(fg, resolvedStack)
        const exempt = pair.exempt === 'wcag-inactive'
        const passed = m.ratio >= minimum
        const result: ContrastCase['result'] = exempt ? 'exempt' : passed ? 'pass' : 'fail'
        const flags: Array<'near-threshold'> = passed && !exempt && m.ratio - minimum < 0.05 ? ['near-threshold'] : []
        cases.push({
          pair: pair.id,
          brand,
          mode,
          surface: exp.surface,
          state: pair.state,
          kind: pair.kind,
          fg: pair.fg,
          bg: exp.stack,
          ratio: trunc4(m.ratio),
          ratioFloat: trunc4(m.ratioFloat),
          ratio8bit: trunc4(m.ratio8bit),
          minimum,
          result,
          group: pair.group ?? null,
          flags,
        })
        // A case counts as passing for the pair/group decision when it passes or is exempt.
        if (!(passed || exempt)) allPass = false
      }
      permPass.set(perm, allPass)
    }
  }

  // ---- §8 step 10: per-pair and per-group decisions. ----
  for (const pair of sortedPairs) {
    if (blocked.has(pair.id) || pair.group || pair.exempt) continue
    for (const perm of sortedPerms) {
      const [brand, mode] = perm.split('/') as [string, string]
      if (pairPass.get(pair.id)!.get(perm) === false) {
        const cs = cases.filter((x) => x.pair === pair.id && x.brand === brand && x.mode === mode)
        // Only a genuinely measured low-ratio case is pair-below-minimum. A permutation that did not
        // pass because a reference could not resolve (`unknown-token`, `emitted-mismatch`) or the base
        // was translucent (`stack-not-opaque`) already carries its own, more precise finding.
        if (!cs.some((c) => c.result === 'fail')) continue
        const worst = cs.reduce((a, b) => (a.ratio <= b.ratio ? a : b))
        findings.push(pairFinding(pair, {
          code: 'pair-below-minimum',
          context: { brand, mode },
          data: { pair: pair.id, ratio: worst.ratio, minimum: worst.minimum, surface: worst.surface },
          message: `Pair "${pair.id}" in ${perm}: ratio ${worst.ratio} < ${worst.minimum} (${pair.kind}) (A11Y-09, V-15).`,
        }))
      }
    }
  }

  const groups: ContrastGroup[] = []
  for (const [gid, members] of [...groupsMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (invalidGroups.has(gid)) continue
    let groupPassesEveryPerm = true
    for (const perm of sortedPerms) {
      const [brand, mode] = perm.split('/') as [string, string]
      const anyPass = members.some((m) => pairPass.get(m.id)?.get(perm) === true)
      if (!anyPass) {
        groupPassesEveryPerm = false
        findings.push(pairFinding(members[0]!, { code: 'group-below-minimum', context: { brand, mode }, data: { pair: gid }, message: `Group "${gid}" in ${perm}: no member reaches the minimum (any-of, V-15, A11Y-09).` }))
      }
    }
    groups.push({ id: gid, members: members.map((m) => m.id).sort(), result: groupPassesEveryPerm ? 'pass' : 'fail' })
  }

  // Deterministic ordering by CODE POINT, never by locale (tools-cli §1.4/§1.7, G-3): cases by pair,
  // brand, mode, surface (§10); findings by file, line, column, code, token, then pair/context (§1.5).
  const cp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
  cases.sort((a, b) => cp(a.pair, b.pair) || cp(a.brand, b.brand) || cp(a.mode, b.mode) || cp(String(a.surface), String(b.surface)))
  findings.sort((a, b) =>
    cp(a.file ?? '', b.file ?? '') ||
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.column ?? 0) - (b.column ?? 0) ||
    cp(a.code, b.code) ||
    cp(a.token ?? '', b.token ?? '') ||
    cp(a.data?.pair ?? '', b.data?.pair ?? '') ||
    cp(`${a.context?.brand}/${a.context?.mode}`, `${b.context?.brand}/${b.context?.mode}`),
  )

  const passed = cases.filter((c) => c.result === 'pass').length
  const failed = cases.filter((c) => c.result === 'fail').length
  const exemptN = cases.filter((c) => c.result === 'exempt').length
  const exitCode: 0 | 1 = findings.length ? 1 : 0
  return {
    ...base,
    ok: exitCode === 0,
    exitCode,
    summary: {
      cases: cases.length,
      pairs: sortedPairs.length,
      passed,
      failed,
      exempt: exemptN,
      groups: { passed: groups.filter((g) => g.result === 'pass').length, failed: groups.filter((g) => g.result === 'fail').length },
    },
    cases,
    groups,
    findings,
    errors: [],
  }
}

function emptySummary(): ContrastCheckResult['summary'] {
  return { cases: 0, pairs: 0, passed: 0, failed: 0, exempt: 0, groups: { passed: 0, failed: 0 } }
}

// --- §10 Markdown report (deterministic: LF, no timestamp/abs-path, locale-independent numbers). ---
export function renderReportMd(r: ContrastCheckResult): string {
  const dash = (s: string | null) => (s == null || s === '' ? '-' : s)
  const lines: string[] = []
  lines.push('# Contrast report', '')
  lines.push(`Level: ${r.level}. Minimums: text ${fmt2(r.minimums.text)}; non-text ${fmt2(r.minimums.nonText)}.`, '')
  lines.push('| pair | brand | mode | surface | state | kind | min | ratio | result | group |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const c of r.cases) {
    lines.push(`| ${c.pair} | ${c.brand} | ${c.mode} | ${dash(c.surface)} | ${c.state} | ${c.kind} | ${fmt2(c.minimum)} | ${fmt2(c.ratio)} | ${c.result} | ${dash(c.group)} |`)
  }
  lines.push('', '## Groups', '')
  lines.push('| group | members | result |')
  lines.push('| --- | --- | --- |')
  for (const g of r.groups) lines.push(`| ${g.id} | ${g.members.join(', ')} | ${g.result} |`)
  lines.push('', '## Findings', '')
  if (r.findings.length === 0) {
    lines.push('None.')
  } else {
    for (const f of r.findings) {
      const pos = f.file ? `\`${f.file}${f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : ''}\` ` : ''
      const ctx = f.context ? ` (${f.context.brand}/${f.context.mode})` : ''
      const who = f.data?.pair ?? f.token ?? ''
      const meas = f.data && f.data.ratio !== undefined ? `: ${fmt2(f.data.ratio)} < ${fmt2(f.data.minimum ?? 0)}` : ''
      lines.push(`- ${pos}\`${f.code}\` ${who}${ctx}${meas}`)
    }
  }
  const s = r.summary
  lines.push('', '## Summary', '')
  lines.push(`cases=${s.cases} pairs=${s.pairs} passed=${s.passed} failed=${s.failed} exempt=${s.exempt} groups.passed=${s.groups.passed} groups.failed=${s.groups.failed} findings=${r.findings.length}`)
  return lines.join('\n') + '\n'
}
