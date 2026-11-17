// ENG-21: every dependency of every workspace package (apps, tests, tools and packages) must carry a
// license listed in quality/license-policy.json. `allowedDevOnly` licenses are accepted only for a
// package that is absent from the production graph; `aliases` normalise spelling; `overrides` pin a
// reviewed license for a named package whose metadata is non-standard. SPDX expressions are evaluated
// with AND binding tighter than OR and parentheses respected (see evalLicenseExpr).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runPnpm } from './pnpm.ts'

export interface LicenseFinding {
  code: string
  pkg: string
  message: string
}

export interface LicensePolicy {
  allowed: readonly string[]
  allowedDevOnly?: readonly string[]
  aliases?: Readonly<Record<string, string>>
  overrides?: Readonly<Record<string, { license: string; reason?: string }>>
}

export interface LicensePackage {
  name: string
  versions: readonly string[]
}
/** Shape of `pnpm licenses list --json`: license id -> packages. */
export type LicenseReport = Readonly<Record<string, readonly LicensePackage[]>>

export const POLICY_PATH = 'quality/license-policy.json'

type Tok = '(' | ')' | 'AND' | 'OR' | { atom: string }

function tokenize(expr: string): Tok[] {
  const out: Tok[] = []
  let atom: string[] = []
  const flush = (): void => {
    if (atom.length) out.push({ atom: atom.join(' ') })
    atom = []
  }
  for (const w of expr.replace(/([()])/g, ' $1 ').split(/\s+/).filter(Boolean)) {
    if (w === '(' || w === ')') {
      flush()
      out.push(w)
    } else if (/^(AND|OR)$/i.test(w)) {
      flush()
      out.push(w.toUpperCase() as 'AND' | 'OR')
    } else atom.push(w)
  }
  flush()
  return out
}

/**
 * Evaluate an SPDX license expression with correct precedence: AND binds tighter than OR, parentheses
 * group. Grammar: or := and ('OR' and)*; and := primary ('AND' primary)*; primary := atom | '(' or ')'.
 * A leaf is true when `ok(atom)`; AND needs every operand true, OR needs any. A malformed expression
 * is never accepted (fail closed).
 */
export function evalLicenseExpr(expr: string, ok: (atom: string) => boolean): boolean {
  const toks = tokenize(expr)
  let i = 0
  const parseOr = (): boolean => {
    let v = parseAnd()
    while (toks[i] === 'OR') {
      i++
      const r = parseAnd() // always consume the operand
      v = v || r
    }
    return v
  }
  const parseAnd = (): boolean => {
    let v = parsePrimary()
    while (toks[i] === 'AND') {
      i++
      const r = parsePrimary()
      v = v && r
    }
    return v
  }
  const parsePrimary = (): boolean => {
    const t = toks[i]
    if (t === '(') {
      i++
      const v = parseOr()
      if (toks[i] !== ')') throw new Error('unbalanced parenthesis')
      i++
      return v
    }
    if (t !== undefined && typeof t === 'object') {
      i++
      return ok(t.atom)
    }
    throw new Error('unexpected token')
  }
  try {
    const v = parseOr()
    return i === toks.length && v
  } catch {
    return false
  }
}

export function evaluateLicenses(report: LicenseReport, prod: LicenseReport, policy: LicensePolicy): LicenseFinding[] {
  const out: LicenseFinding[] = []
  const allowed = new Set(policy.allowed)
  const devOnly = new Set(policy.allowedDevOnly ?? [])
  const aliases = policy.aliases ?? {}
  const overrides = policy.overrides ?? {}
  const prodNames = new Set(Object.values(prod).flatMap((pkgs) => pkgs.map((p) => p.name)))

  const norm = (l: string): string => aliases[l] ?? l
  for (const [raw, pkgs] of Object.entries(report)) {
    for (const p of pkgs) {
      const label = `${p.name}@${p.versions.join(',')}`
      const override = overrides[p.name]
      const license = norm(override ? override.license : raw)
      const isProd = prodNames.has(p.name)
      const leaf = (t: string, devOk: boolean): boolean => {
        const n = norm(t)
        return allowed.has(n) || (devOk && devOnly.has(n))
      }
      if (evalLicenseExpr(license, (t) => leaf(t, !isProd))) continue
      const onlyDevAllowed = evalLicenseExpr(license, (t) => leaf(t, true))
      if (onlyDevAllowed && isProd) {
        out.push({ code: 'ENG21-DEV-ONLY-IN-PROD', pkg: label, message: `${label}: license "${raw}" is allowed only for dev dependencies but the package is in the production graph (${POLICY_PATH}).` })
      } else {
        out.push({ code: /^(unknown|)$/i.test(raw) ? 'ENG21-UNKNOWN' : 'ENG21-NOT-ALLOWED', pkg: label, message: `${label}: license "${raw}" is not in the allowlist of ${POLICY_PATH} (ENG-21).` })
      }
    }
  }
  return out.sort((a, b) => (a.pkg < b.pkg ? -1 : a.pkg > b.pkg ? 1 : 0))
}

// pnpm prints a plain sentence instead of JSON when there is nothing to list.
function parseReport(text: string): LicenseReport {
  try {
    return JSON.parse(text) as LicenseReport
  } catch {
    return {}
  }
}

export function checkLicenses(root: string): LicenseFinding[] {
  let policy: LicensePolicy
  try {
    policy = JSON.parse(readFileSync(join(root, POLICY_PATH), 'utf8'))
  } catch (err) {
    return [{ code: 'ENG21-POLICY-UNREADABLE', pkg: '-', message: `Cannot read ${POLICY_PATH}: ${(err as Error).message}` }]
  }
  if (!Array.isArray(policy.allowed) || policy.allowed.length === 0) {
    return [{ code: 'ENG21-POLICY-ENVELOPE', pkg: '-', message: `${POLICY_PATH} must declare a non-empty "allowed" array.` }]
  }
  const report = parseReport(runPnpm(root, ['licenses', 'list', '--json', '-r']))
  const prod = parseReport(runPnpm(root, ['licenses', 'list', '--json', '-r', '--prod']))
  if (Object.keys(report).length === 0) {
    return [{ code: 'ENG21-EMPTY', pkg: '-', message: '`pnpm licenses list -r` returned no packages; refusing to pass on an empty inventory.' }]
  }
  return evaluateLicenses(report, prod, policy)
}
