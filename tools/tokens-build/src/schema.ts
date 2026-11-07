// V-01 DTCG schema validation (FR-002, TOK-01). Validates the raw source — tokens.resolver.json and
// every *.tokens.json — against the versioned, vendored DTCG 2025.10 JSON Schemas
// (packages/tokens/schemas/dtcg-2025.10/, offline). Each violation becomes a TKN-SCHEMA finding whose
// file/line/column is resolved from the JSON pointer via momoa (data-model: `source` from the Ajv read).
// Runs before the model rules; the @terrazzo parser is a second structural net, not this contract's V-01.
import Ajv from 'ajv'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseJsonAst } from '@humanwhocodes/momoa'
import type { Finding } from './validate.ts'

/** Lists `*.tokens.json` under `srcDir`, relative and `/`-separated (sorted for determinism). */
async function listTokenFiles(dir: string, base: string, acc: string[]): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await listTokenFiles(full, base, acc)
    else if (entry.name.endsWith('.tokens.json')) acc.push(full.slice(base.length + 1).split('\\').join('/'))
  }
  return acc
}

/** Resolves a JSON pointer (`/a/b/0`) to a momoa node, to read its 1-based source position. */
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

// Keywords whose Ajv error is a conditional/combinator wrapper ("must match \"else\" schema") that only
// restates a more specific inner failure; dropped so one violation yields one actionable finding.
const WRAPPER_KEYWORDS = new Set(['if', 'then', 'else', 'oneOf', 'anyOf', 'not'])

function findingsFor(rel: string, text: string, errors: any[], which: string): Finding[] {
  let doc: any
  try {
    doc = parseJsonAst(text)
  } catch {
    doc = null
  }
  const out: Finding[] = []
  const seen = new Set<string>()
  for (const err of errors) {
    if (WRAPPER_KEYWORDS.has(err.keyword)) continue
    const where = err.instancePath || '(root)'
    const dedupe = `${where}|${err.message}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    const node = doc ? nodeAtPointer(doc.body, err.instancePath ?? '') : null
    const loc = node?.loc?.start
    out.push({
      code: 'TKN-SCHEMA',
      rule: 'V-01',
      file: `src/${rel}`,
      line: loc?.line,
      column: loc?.column,
      message: `${where} ${err.message ?? 'does not match the schema'} (DTCG 2025.10 ${which} schema, V-01, FR-002).`,
    })
  }
  return out
}

/** Validates the source against the vendored DTCG schemas. Returns V-01 findings (empty = clean). */
export async function validateSchema(srcDir: string): Promise<Finding[]> {
  const schemaDir = join(srcDir, '..', 'schemas', 'dtcg-2025.10')
  let formatSchema: unknown
  let resolverSchema: unknown
  try {
    formatSchema = JSON.parse(await readFile(join(schemaDir, 'format.json'), 'utf8'))
    resolverSchema = JSON.parse(await readFile(join(schemaDir, 'resolver.json'), 'utf8'))
  } catch (err) {
    return [{ code: 'TKN-SCHEMA-MISSING', rule: 'V-01', message: `Cannot load the vendored DTCG schemas at ${schemaDir}: ${(err as Error).message} (FR-002).` }]
  }

  // Separate instances: resolver.json bundles the format schema's $ids, so one shared instance would
  // register them twice. strict:false tolerates draft-07 `$schema`, unknown formats and annotations.
  // logger:false silences Ajv's "unknown format ignored" notes (no ajv-formats; the DTCG `format`
  // assertions — uri-reference, json-pointer-uri-fragment — degrade to annotations, which is fine for
  // the structural V-01 contract). strict:false tolerates the draft-07 `$schema` and the bundled $ids.
  const opts = { strict: false, allErrors: true, logger: false } as const
  let validateFormat: any
  let validateResolver: any
  try {
    validateFormat = new Ajv(opts).compile(formatSchema as object)
    validateResolver = new Ajv(opts).compile(resolverSchema as object)
  } catch (err) {
    return [{ code: 'TKN-SCHEMA-COMPILE', rule: 'V-01', message: `Cannot compile the DTCG schemas: ${(err as Error).message}.` }]
  }

  const out: Finding[] = []
  const check = async (rel: string, validate: any, which: string): Promise<void> => {
    let text: string
    try {
      text = await readFile(join(srcDir, rel), 'utf8')
    } catch {
      return
    }
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (err) {
      out.push({ code: 'TKN-SCHEMA-PARSE', rule: 'V-01', file: `src/${rel}`, message: `Invalid JSON: ${(err as Error).message} (V-01).` })
      return
    }
    if (!validate(data)) out.push(...findingsFor(rel, text, validate.errors ?? [], which))
  }

  await check('tokens.resolver.json', validateResolver, 'resolver')
  for (const rel of (await listTokenFiles(srcDir, srcDir, [])).sort()) {
    await check(rel, validateFormat, 'format')
  }
  return out
}
