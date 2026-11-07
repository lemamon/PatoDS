// ACE-02 traceability matrix check. Reads quality/traceability.json and fails when a contracted ID
// marked `met` names a CI check that does not exist (a root package.json script) or an evidence file
// that is absent, when the envelope is malformed, or when an id repeats. Future-phase IDs are marked
// `planned` and only need an owning task; `deferred` is for an uncontracted Desirable (TOK-12).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface TraceFinding {
  code: string
  id?: string
  message: string
}

interface Entry {
  id?: unknown
  status?: unknown
  check?: unknown
  evidence?: unknown
  task?: unknown
  note?: unknown
}

const STATUSES = new Set(['met', 'planned', 'deferred', 'evidence'])

export function checkTraceability(root: string): TraceFinding[] {
  const out: TraceFinding[] = []
  const matrixPath = join(root, 'quality/traceability.json')

  let doc: { format?: unknown; version?: unknown; entries?: unknown }
  try {
    doc = JSON.parse(readFileSync(matrixPath, 'utf8'))
  } catch (err) {
    return [{ code: 'TRACE-UNREADABLE', message: `Cannot read quality/traceability.json: ${(err as Error).message} (ACE-02).` }]
  }

  if (doc.format !== 'patods.traceability' || typeof doc.version !== 'number') {
    out.push({ code: 'TRACE-ENVELOPE', message: 'traceability.json must start with format "patods.traceability" and a numeric version (ACE-02).' })
  }
  const entries = Array.isArray(doc.entries) ? (doc.entries as Entry[]) : null
  if (!entries) {
    out.push({ code: 'TRACE-ENVELOPE', message: 'traceability.json "entries" must be an array (ACE-02).' })
    return out
  }

  // Root package.json scripts are the universe of named CI checks.
  let scripts: Record<string, string> = {}
  try {
    scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts ?? {}
  } catch {
    out.push({ code: 'TRACE-NO-SCRIPTS', message: 'Cannot read the root package.json scripts to resolve check names.' })
  }

  const seen = new Set<string>()
  for (const e of entries) {
    const id = typeof e.id === 'string' ? e.id : undefined
    if (!id) {
      out.push({ code: 'TRACE-ENTRY', message: `An entry is missing a string "id": ${JSON.stringify(e).slice(0, 80)}.` })
      continue
    }
    if (seen.has(id)) out.push({ code: 'TRACE-DUPLICATE', id, message: `Id "${id}" appears more than once in the matrix.` })
    seen.add(id)

    const status = typeof e.status === 'string' ? e.status : ''
    if (!STATUSES.has(status)) {
      out.push({ code: 'TRACE-STATUS', id, message: `Id "${id}" has an unknown status ${JSON.stringify(e.status)}; expected one of ${[...STATUSES].join(', ')}.` })
      continue
    }

    if (status === 'met') {
      const check = typeof e.check === 'string' ? e.check : undefined
      const evidence = typeof e.evidence === 'string' ? e.evidence : undefined
      if (!check && !evidence) {
        out.push({ code: 'TRACE-MET-NO-CHECK', id, message: `Id "${id}" is "met" but names neither a check nor evidence (ACE-02).` })
      }
      if (check && !(check in scripts)) {
        out.push({ code: 'TRACE-CHECK-MISSING', id, message: `Id "${id}" names check "${check}", which is not a root package.json script (ACE-02: nonexistent check).` })
      }
      if (evidence) {
        try {
          readFileSync(join(root, evidence))
        } catch {
          out.push({ code: 'TRACE-EVIDENCE-MISSING', id, message: `Id "${id}" names evidence "${evidence}", which does not exist (ACE-02).` })
        }
      }
    } else if (status === 'evidence') {
      const evidence = typeof e.evidence === 'string' ? e.evidence : undefined
      if (!evidence) out.push({ code: 'TRACE-EVIDENCE-NONE', id, message: `Id "${id}" has status "evidence" but no evidence path.` })
      else {
        try {
          readFileSync(join(root, evidence))
        } catch {
          out.push({ code: 'TRACE-EVIDENCE-MISSING', id, message: `Id "${id}" names evidence "${evidence}", which does not exist (ACE-02).` })
        }
      }
    } else if (status === 'planned') {
      if (typeof e.task !== 'string') {
        out.push({ code: 'TRACE-PLANNED-NO-TASK', id, message: `Id "${id}" is "planned" but names no owning task.` })
      }
    }
  }
  return out
}
