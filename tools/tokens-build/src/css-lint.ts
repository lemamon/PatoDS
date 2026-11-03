// Generated-CSS lint (US2, T042). Runs inside `tokens-build build` over the CSS rendered in memory,
// BEFORE writing dist/; any finding fails the build with exit 1 and writes no artifact
// (css-output.md §13). This covers the five in-scope checks:
//   css-layer                     — §3, L-01..L-05 (layer-order declaration vs layers.json)
//   css-toggle-form               — §6/§7, RS-03/T-02..T-04 (spaceless chained toggles, literal `initial`)
//   css-var-undeclared            — §10.1 (every fallback-less var() target is declared)
//   css-public-outside-resolver   — §4/RS-02 (each token type only in its legal scope)
//   dist-parity                   — §13 cross-check (same public-token set in CSS/ESM/.d.ts/manifest/API)
// The generated CSS is a tightly-controlled deterministic string (§8/§12), so the form checks scan
// lines/regex rather than pulling in a CSS parser; the structural checks use the token Model.
import { PREFIX, type Model, type ModelToken } from './model.ts'
import type { Finding } from './validate.ts'

const TOKENS_LAYER = `${PREFIX}.tokens`
const ATTR_BRAND = `data-${PREFIX}-brand`
const ATTR_MODE = `data-${PREFIX}-mode`
const PRIVATE_RE = new RegExp(`^--${PREFIX}-_`)
const DECL_RE = new RegExp(`^(--${PREFIX}-[a-z0-9_-]+)\\s*:`)
const VARREF_RE = new RegExp(`var\\((--${PREFIX}-[a-z0-9_-]+)`, 'g')

/** Thrown by the build when the generated CSS fails lint; the CLI maps it to exit code 1. */
export class CssLintError extends Error {
  readonly findings: Finding[]
  constructor(findings: Finding[]) {
    super(`generated-CSS lint failed with ${findings.length} finding(s)`)
    this.name = 'CssLintError'
    this.findings = findings
  }
}

export interface GeneratedCss {
  /** Leaf name of the generated file, e.g. `base.css` or `brand-a.css`. */
  rel: string
  css: string
}

export interface LintInput {
  cssFiles: GeneratedCss[]
  model: Model
  meta: { brands: string[]; defaultBrand: string; modes: string[]; defaultMode: string }
  /** The `order` array read from layers.json (the single source of the layer order). */
  layerOrder: string[]
  /** The in-memory ESM outputs (index.js + index.d.ts) for dist-parity. */
  esm: { js: string; dts: string }
  /** The in-memory tokens manifest object for dist-parity. */
  manifest: { tokens: { id: string; role: string }[] }
  /** The in-memory API report object for dist-parity. */
  api: { tokens: string[] }
}

interface Decl {
  /** The declaration text without the leading indent, e.g. `--patods-space-4: var(...);`. */
  text: string
  /** The custom-property name on the left-hand side, if this declaration declares one. */
  name?: string
  line: number
}
interface Block {
  selector: string
  decls: Decl[]
  line: number
}
interface ParsedCss extends GeneratedCss {
  lines: string[]
  blocks: Block[]
}

/** Parse the inner style rules of the single `@layer` block (2-space-indented, deterministic form). */
function parseBlocks(css: string): Block[] {
  const lines = css.split('\n')
  const blocks: Block[] = []
  let current: Block | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const open = /^ {2}(\S.*) \{$/.exec(line)
    if (open && !current) {
      current = { selector: open[1]!, decls: [], line: i + 1 }
      continue
    }
    if (current) {
      if (/^ {2}\}$/.test(line)) {
        blocks.push(current)
        current = null
        continue
      }
      const decl = /^ {4}(\S.*)$/.exec(line)
      if (decl) {
        const text = decl[1]!
        const name = DECL_RE.exec(text)?.[1]
        current.decls.push({ text, name, line: i + 1 })
      }
    }
  }
  return blocks
}

function idOf(byCssName: Map<string, ModelToken>, cssName: string): string | undefined {
  return byCssName.get(cssName)?.id
}

type BlockKind = 'primitives' | 'resolver' | 'mode' | 'brand' | 'other'
function blockKind(selector: string): BlockKind {
  if (selector.includes(`[${ATTR_BRAND}], [${ATTR_MODE}]`)) return 'resolver'
  if (new RegExp(`\\[${ATTR_MODE}="`).test(selector)) return 'mode'
  if (new RegExp(`\\[${ATTR_BRAND}="`).test(selector)) return 'brand'
  if (selector === ':where(:root)') return 'primitives'
  return 'other'
}

/** css-layer (§3, L-01..L-05): layer-order declaration first, identical across files and to layers.json. */
function checkLayer(files: ParsedCss[], layerOrder: string[], out: Finding[]): void {
  const expectedDecl = `@layer ${layerOrder.join(', ')};`
  const expectedOpen = `@layer ${TOKENS_LAYER} {`
  for (const f of files) {
    // The layer-order declaration is the first statement after an optional leading header comment
    // (css-output.md L-02/§8: "after the header comment"); tolerate the header without requiring it.
    const declIdx = f.lines.findIndex((l) => l.trim() !== '' && !l.trim().startsWith('/*'))
    const declLine = declIdx >= 0 ? f.lines[declIdx]! : ''
    if (declLine !== expectedDecl) {
      out.push({
        code: 'css-layer',
        rule: 'L-02',
        file: f.rel,
        line: declIdx + 1,
        message: `The layer-order declaration must be "${expectedDecl}" from layers.json; found "${declLine}".`,
      })
    }
    if (!layerOrder.includes(TOKENS_LAYER)) {
      out.push({
        code: 'css-layer',
        rule: 'L-05',
        file: f.rel,
        line: 1,
        message: `layers.json order ${JSON.stringify(layerOrder)} must include the tokens layer "${TOKENS_LAYER}".`,
      })
    }
    const openers = f.lines.map((l, i) => ({ l, i })).filter((x) => /^@layer .+\{$/.test(x.l))
    if (openers.length !== 1 || openers[0]!.l !== expectedOpen) {
      out.push({
        code: 'css-layer',
        rule: 'L-01',
        file: f.rel,
        line: (openers[0]?.i ?? declIdx) + 1,
        message: `Expected exactly one "${expectedOpen}" block; found ${openers.length}.`,
      })
    }
    // No style rule outside the @layer block. Track the block span by brace depth so a rule placed
    // before the opener or after the closing brace is caught regardless of indentation (L-01).
    const openerIdx = openers[0]?.i ?? -1
    let closeIdx = -1
    if (openerIdx >= 0) {
      let depth = 0
      for (let i = openerIdx; i < f.lines.length && closeIdx < 0; i++) {
        for (const ch of f.lines[i]!) {
          if (ch === '{') depth++
          else if (ch === '}' && --depth === 0) {
            closeIdx = i
            break
          }
        }
      }
    }
    f.lines.forEach((l, i) => {
      if (!l.includes('{') || i === openerIdx || l.trim().startsWith('@layer')) return
      const insideLayer = openerIdx >= 0 && i > openerIdx && (closeIdx < 0 || i < closeIdx)
      if (!insideLayer) {
        out.push({
          code: 'css-layer',
          rule: 'L-01',
          file: f.rel,
          line: i + 1,
          message: `Style rule "${l.trim()}" sits outside the @layer ${TOKENS_LAYER} block.`,
        })
      }
    })
  }
}

/** css-toggle-form (§6/§7, RS-03, T-02..T-04): spaceless chained toggles, literal `initial`, canonical order. */
function checkToggleForm(files: ParsedCss[], input: LintInput, out: Finding[]): void {
  const byCssName = new Map(input.model.tokens.map((t) => [t.cssName, t]))
  const modeNames = new Set(
    input.model.tokens.filter((t) => t.role === 'public' && t.axis === 'mode').map((t) => t.cssName),
  )
  // Canonical mode order: the default mode first, then the rest by code point (D-03).
  const canonicalModes = [input.meta.defaultMode, ...input.meta.modes.filter((m) => m !== input.meta.defaultMode).sort()]
  const toggleName = (m: string) => `--${PREFIX}-_on-${m}`
  const modeToggleNames = new Set(canonicalModes.map(toggleName))
  const togglePrefix = new RegExp(`^--${PREFIX}-_on-`)
  const rhsOf = (text: string) => text.slice(text.indexOf(':') + 1).replace(/;$/, '').trim()

  // RS-03: each mode-axis resolver declaration is the full canonical chained toggle form —
  // exactly one `var(<toggle>, …)` per mode in canonical order, no character between the toggles,
  // and nothing trailing after the last toggle.
  for (const f of files) {
    for (const b of f.blocks) {
      for (const d of b.decls) {
        if (!d.name || !modeNames.has(d.name)) continue
        const rhs = rhsOf(d.text)
        const seq = [...rhs.matchAll(new RegExp(`var\\(--${PREFIX}-_on-([a-z0-9-]+),`, 'g'))].map((m) => m[1]!)
        const canonical = seq.join(',') === canonicalModes.join(',') && !rhs.includes(') var(') && rhs.endsWith(')')
        if (!canonical) {
          out.push({
            code: 'css-toggle-form',
            rule: 'RS-03',
            file: f.rel,
            line: d.line,
            id: idOf(byCssName, d.name),
            message: `Mode-axis token "${d.name}" must use the canonical chained toggle form (one spaceless var() per mode [${canonicalModes.join(', ')}], nothing trailing); found "${d.text}".`,
          })
        }
      }
    }
  }

  // T-02..T-04: toggles only in base.css mode rules; every mode toggle declared once per rule;
  // each value literally `initial` or empty; exactly one `initial` per rule.
  for (const f of files) {
    for (const b of f.blocks) {
      const kind = blockKind(b.selector)
      const toggleDecls = b.decls.filter((d) => d.name && togglePrefix.test(d.name))
      const isBaseModeRule = f.rel.endsWith('base.css') && kind === 'mode'
      for (const d of toggleDecls) {
        if (!isBaseModeRule) {
          out.push({
            code: 'css-toggle-form',
            rule: 'T-04',
            file: f.rel,
            line: d.line,
            message: `Toggle "${d.name}" may only be declared in a base.css mode rule; found in ${b.selector}.`,
          })
          continue
        }
        if (!modeToggleNames.has(d.name!)) {
          out.push({
            code: 'css-toggle-form',
            rule: 'T-04',
            file: f.rel,
            line: d.line,
            message: `Unknown mode toggle "${d.name}"; the modes are [${input.meta.modes.join(', ')}].`,
          })
          continue
        }
        const rhs = rhsOf(d.text)
        if (rhs !== 'initial' && rhs !== '') {
          out.push({
            code: 'css-toggle-form',
            rule: 'T-02',
            file: f.rel,
            line: d.line,
            message: `Toggle "${d.name}" must be literally \`initial\` or empty, never an indirection; found "${rhs}".`,
          })
        }
      }
      if (isBaseModeRule) {
        const declared = new Set(toggleDecls.map((d) => d.name))
        const missing = canonicalModes.map(toggleName).filter((n) => !declared.has(n))
        if (missing.length > 0) {
          out.push({
            code: 'css-toggle-form',
            rule: 'T-02',
            file: f.rel,
            line: b.line,
            message: `Mode rule ${b.selector} must declare and reset every mode toggle; missing [${missing.join(', ')}].`,
          })
        }
        const initials = toggleDecls.filter((d) => rhsOf(d.text) === 'initial').length
        if (initials !== 1) {
          out.push({
            code: 'css-toggle-form',
            rule: 'T-02',
            file: f.rel,
            line: b.line,
            message: `Mode rule ${b.selector} must set exactly one toggle to \`initial\`; found ${initials}.`,
          })
        }
      }
    }
  }

  // D-03: base.css mode rules in canonical order (default mode first, then the rest by code point).
  const base = files.find((f) => f.rel.endsWith('base.css'))
  if (base) {
    const seq: string[] = []
    for (const b of base.blocks) {
      const m = new RegExp(`\\[${ATTR_MODE}="([^"]+)"\\]`).exec(b.selector)
      if (m) seq.push(m[1]!)
    }
    if (seq.join(',') !== canonicalModes.join(',')) {
      out.push({
        code: 'css-toggle-form',
        rule: 'D-03',
        file: base.rel,
        line: 1,
        message: `Mode rules must be in canonical order [${canonicalModes.join(', ')}]; found [${seq.join(', ')}].`,
      })
    }
  }
}

/** css-var-undeclared (§10.1): every fallback-less var() target is declared in-file, in base, or in every brand. */
function checkVarUndeclared(files: ParsedCss[], out: Finding[]): void {
  const declaredByFile = new Map<string, Set<string>>()
  for (const f of files) {
    const s = new Set<string>()
    for (const b of f.blocks) for (const d of b.decls) if (d.name) s.add(d.name)
    declaredByFile.set(f.rel, s)
  }
  const baseRel = files.find((f) => f.rel.endsWith('base.css'))?.rel
  const base = (baseRel && declaredByFile.get(baseRel)) || new Set<string>()
  const brandSets = files.filter((f) => f.rel !== baseRel).map((f) => declaredByFile.get(f.rel)!)
  const everyBrand =
    brandSets.length > 0
      ? [...brandSets[0]!].filter((name) => brandSets.every((s) => s.has(name)))
      : []
  const everyBrandSet = new Set(everyBrand)

  for (const f of files) {
    const own = declaredByFile.get(f.rel)!
    for (const b of f.blocks) {
      for (const d of b.decls) {
        for (const m of d.text.matchAll(VARREF_RE)) {
          const target = m[1]!
          if (own.has(target) || base.has(target) || everyBrandSet.has(target)) continue
          out.push({
            code: 'css-var-undeclared',
            rule: 'U-01',
            file: f.rel,
            line: d.line,
            message: `var(${target}) has no declaration in ${f.rel}, base.css, or every brand file (§10.1).`,
          })
        }
      }
    }
  }
}

/** css-public-outside-resolver (§4/RS-02): each token type only in its legal scope; one declaration per file. */
function checkPublicPlacement(files: ParsedCss[], input: LintInput, out: Finding[]): void {
  const byCssName = new Map(input.model.tokens.map((t) => [t.cssName, t]))
  for (const f of files) {
    const isBase = f.rel.endsWith('base.css')
    const seen = new Map<string, number>()
    for (const b of f.blocks) {
      const kind = blockKind(b.selector)
      for (const d of b.decls) {
        if (!d.name) continue
        if (PRIVATE_RE.test(d.name)) continue // private toggles legitimately repeat across mode rules
        seen.set(d.name, (seen.get(d.name) ?? 0) + 1)
        const tok = byCssName.get(d.name)
        if (!tok) {
          out.push({
            code: 'css-public-outside-resolver',
            rule: 'RS-02',
            file: f.rel,
            line: d.line,
            message: `Unknown custom property "${d.name}" declared in ${b.selector}.`,
          })
          continue
        }
        const { ok, legal } = placementOk(tok, kind, isBase)
        if (!ok) {
          out.push({
            code: 'css-public-outside-resolver',
            rule: 'RS-02',
            file: f.rel,
            line: d.line,
            id: tok.id,
            message: `"${tok.id}" (${tok.role}/${tok.axis}/${tok.layer}) declared in ${kind} rule but must be in ${legal}.`,
          })
        }
      }
    }
    for (const [name, count] of seen) {
      if (count > 1) {
        out.push({
          code: 'css-public-outside-resolver',
          rule: 'D3',
          file: f.rel,
          message: `"${name}" declared ${count} times in ${f.rel}; each name at most once per file.`,
        })
      }
    }
  }
}

function placementOk(tok: ModelToken, kind: BlockKind, isBase: boolean): { ok: boolean; legal: string } {
  if (tok.role === 'brand-mode-source') {
    return { ok: !isBase && kind === 'brand', legal: 'the brand rule of each brand file' }
  }
  if (tok.layer === 'primitive') {
    // Shared primitive in base; brand-exclusive primitive in a brand rule.
    return { ok: (isBase && kind === 'primitives') || (!isBase && kind === 'brand'), legal: 'the base.css primitives rule or a brand rule' }
  }
  // Public non-primitive (mode-axis, invariant, component): only the base.css resolver.
  return { ok: isBase && kind === 'resolver', legal: 'the base.css resolver rule' }
}

/** dist-parity (§13): the same public-token set in CSS, ESM, .d.ts TokenName, manifest, and API report. */
function checkDistParity(files: ParsedCss[], input: LintInput, out: Finding[]): void {
  const byCssName = new Map(input.model.tokens.map((t) => [t.cssName, t]))
  const expected = new Set(input.model.tokens.filter((t) => t.role === 'public').map((t) => t.id))

  const cssIds = new Set<string>()
  for (const f of files) {
    for (const b of f.blocks) {
      for (const d of b.decls) {
        if (!d.name || PRIVATE_RE.test(d.name)) continue
        const tok = byCssName.get(d.name)
        if (tok && tok.role === 'public') cssIds.add(tok.id)
      }
    }
  }
  const esmIds = new Set([...input.esm.js.matchAll(/^ {2}"(.+?)": "var\(/gm)].map((m) => m[1]!))
  const dtsIds = new Set([...input.esm.dts.matchAll(/^ {2}readonly "(.+?)":/gm)].map((m) => m[1]!))
  const manifestIds = new Set(input.manifest.tokens.filter((t) => t.role === 'public').map((t) => t.id))
  const apiIds = new Set(input.api.tokens)

  const surfaces: [string, Set<string>][] = [
    ['CSS', cssIds],
    ['ESM', esmIds],
    ['.d.ts TokenName', dtsIds],
    ['manifest', manifestIds],
    ['API report', apiIds],
  ]
  for (const [name, set] of surfaces) {
    const missing = [...expected].filter((id) => !set.has(id)).sort()
    const extra = [...set].filter((id) => !expected.has(id)).sort()
    if (missing.length || extra.length) {
      out.push({
        code: 'dist-parity',
        rule: 'E-08',
        message: `${name} public-token set differs from the model: missing [${missing.join(', ')}], extra [${extra.join(', ')}].`,
      })
    }
  }
}

/** Lint the generated CSS and cross-check dist-parity. Returns findings (empty = clean). */
export function lintGeneratedCss(input: LintInput): Finding[] {
  const out: Finding[] = []
  const files: ParsedCss[] = input.cssFiles.map((f) => ({ ...f, lines: f.css.split('\n'), blocks: parseBlocks(f.css) }))
  checkLayer(files, input.layerOrder, out)
  checkToggleForm(files, input, out)
  checkVarUndeclared(files, out)
  checkPublicPlacement(files, input, out)
  checkDistParity(files, input, out)
  return out
}
