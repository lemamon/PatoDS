// TOK-04 / DOC-08: docs/tokens/convencao-de-nomes.md must document exactly the vocabularies the validator
// exports (tools/tokens-build/src/vocabulary.ts, VOCABULARIES). The document marks each list with
// `<!-- vocab:ID -->` ... `<!-- /vocab:ID -->`; words are the backticked spans inside the block. In a block
// with table rows (`| key | words |`), the first backticked cell is the key and the second cell the words.
// A word documented but absent from the validator, or exported but undocumented, is a finding.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface NamingDocFinding {
  code: string
  block?: string
  message: string
}

export type Vocab = readonly string[] | Readonly<Record<string, readonly string[]>>
export interface VocabularyModule {
  VOCABULARIES: Readonly<Record<string, Vocab>>
  ORDERED_VOCABULARIES: readonly string[]
}

export const DOC_PATH = 'docs/tokens/convencao-de-nomes.md'
export const VOCAB_PATH = 'tools/tokens-build/src/vocabulary.ts'

const ticks = (s: string): string[] => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]!.replace(/\\\|/g, '|'))

/** Extract `{ blockId: Vocab }` from the document text. Returns duplicate block ids separately. */
export function parseDoc(text: string): { blocks: Map<string, Vocab>; duplicates: string[] } {
  const blocks = new Map<string, Vocab>()
  const duplicates: string[] = []
  const re = /<!--\s*vocab:([a-z0-9-]+)\s*-->([\s\S]*?)<!--\s*\/vocab:\1\s*-->/g
  for (const m of text.matchAll(re)) {
    const id = m[1]!
    if (blocks.has(id)) duplicates.push(id)
    const rows = m[2]!.split('\n').map((l) => l.trim()).filter(Boolean)
    const keyed: Record<string, string[]> = {}
    const flat: string[] = []
    let isTable = false
    for (const row of rows) {
      if (row.startsWith('|')) {
        isTable = true
        // split on unescaped pipes
        const cells = row.replace(/^\||\|$/g, '').split(/(?<!\\)\|/)
        const key = ticks(cells[0] ?? '')[0]
        if (key === undefined) continue // header, separator
        keyed[key] = ticks(cells.slice(1).join('|'))
      } else flat.push(...ticks(row))
    }
    blocks.set(id, isTable ? keyed : flat)
  }
  return { blocks, duplicates }
}

function diffWords(block: string, label: string, doc: readonly string[], code: readonly string[], ordered: boolean, out: NamingDocFinding[]): void {
  const dupes = doc.filter((w, i) => doc.indexOf(w) !== i)
  for (const w of new Set(dupes)) {
    out.push({ code: 'TOK04-DOC-DUPLICATE', block, message: `"${w}" appears more than once in ${label} of ${DOC_PATH}.` })
  }
  const docSet = new Set(doc)
  const codeSet = new Set(code)
  for (const w of docSet) {
    if (!codeSet.has(w)) out.push({ code: 'TOK04-NOT-IN-VALIDATOR', block, message: `"${w}" is documented in ${label} but is not in the validator vocabulary (${VOCAB_PATH}).` })
  }
  for (const w of codeSet) {
    if (!docSet.has(w)) out.push({ code: 'TOK04-NOT-DOCUMENTED', block, message: `"${w}" is in the validator vocabulary (${label}) but is not documented in ${DOC_PATH}.` })
  }
  if (ordered && docSet.size === codeSet.size && [...docSet].every((w) => codeSet.has(w)) && doc.join('\u0000') !== code.join('\u0000')) {
    out.push({ code: 'TOK04-ORDER', block, message: `${label} is ordered; document has [${doc.join(', ')}] but the validator has [${code.join(', ')}].` })
  }
}

export function compareVocabularies(docText: string, mod: VocabularyModule): NamingDocFinding[] {
  const out: NamingDocFinding[] = []
  const { blocks, duplicates } = parseDoc(docText)
  for (const id of duplicates) out.push({ code: 'TOK04-DOC-DUPLICATE', block: id, message: `Block "${id}" is declared more than once in ${DOC_PATH}.` })
  const ordered = new Set(mod.ORDERED_VOCABULARIES)
  for (const [id, vocab] of Object.entries(mod.VOCABULARIES)) {
    const doc = blocks.get(id)
    if (doc === undefined) {
      out.push({ code: 'TOK04-BLOCK-MISSING', block: id, message: `Vocabulary "${id}" has no <!-- vocab:${id} --> block in ${DOC_PATH}.` })
      continue
    }
    const codeIsList = Array.isArray(vocab)
    const docIsList = Array.isArray(doc)
    if (codeIsList !== docIsList) {
      out.push({ code: 'TOK04-SHAPE', block: id, message: `Block "${id}" is a ${docIsList ? 'flat list' : 'keyed table'} in the document but a ${codeIsList ? 'flat list' : 'keyed map'} in the validator.` })
      continue
    }
    if (codeIsList && docIsList) {
      diffWords(id, id, doc as readonly string[], vocab as readonly string[], ordered.has(id), out)
    } else {
      const dm = doc as Record<string, readonly string[]>
      const cm = vocab as Record<string, readonly string[]>
      diffWords(id, `${id} keys`, Object.keys(dm), Object.keys(cm), false, out)
      for (const k of Object.keys(cm)) {
        if (k in dm) diffWords(id, `${id}["${k}"]`, dm[k]!, cm[k]!, false, out)
      }
    }
  }
  for (const id of blocks.keys()) {
    if (!(id in mod.VOCABULARIES)) out.push({ code: 'TOK04-BLOCK-UNKNOWN', block: id, message: `Block "${id}" in ${DOC_PATH} has no vocabulary in the validator registry.` })
  }
  return out
}

export async function checkNamingDoc(root: string): Promise<NamingDocFinding[]> {
  const docFile = join(root, DOC_PATH)
  if (!existsSync(docFile)) return [{ code: 'TOK04-DOC-ABSENT', message: `${DOC_PATH} does not exist (TOK-04).` }]
  const modFile = join(root, VOCAB_PATH)
  if (!existsSync(modFile)) return [{ code: 'TOK04-VALIDATOR-ABSENT', message: `${VOCAB_PATH} does not exist.` }]
  const mod = (await import(pathToFileURL(modFile).href)) as Partial<VocabularyModule>
  if (!mod.VOCABULARIES || !mod.ORDERED_VOCABULARIES) {
    return [{ code: 'TOK04-VALIDATOR-ABSENT', message: `${VOCAB_PATH} must export VOCABULARIES and ORDERED_VOCABULARIES.` }]
  }
  return compareVocabularies(readFileSync(docFile, 'utf8'), mod as VocabularyModule)
}
