// Stylelint rule patods/design-tokens (US5, FR-022/FR-023; lint-rules.md §3). In component CSS it blocks
// a primitive token, a brand/mode source token, an unknown token, a literal value (hex, non-zero
// dimension/number, color/easing/other function, category keyword, named/system colour, quoted string),
// a literal var() fallback, a custom-property definition, and a control height that is outside the single
// control-height scale — a control root or size variant that fails to declare one. The nine subcodes and
// their positions are the normative ones of §2.1/§3.5; the token facts (layer, role, category, scale,
// alias chains, the control-height scale) all come from the build manifest (Principle I, no hand list).
import stylelint from 'stylelint'
import { readFileSync } from 'node:fs'
import { isAbsolute, relative } from 'node:path'
import { tokenize, TokenType } from '@csstools/css-tokenizer'
import {
  parseListOfComponentValues,
  isFunctionNode,
  isTokenNode,
} from '@csstools/css-parser-algorithms'
import selectorParser from 'postcss-selector-parser'
import { resolveDataPath } from './resolve-data-path.ts'
import governedDefault from './governed-properties.json' with { type: 'json' }

const { createPlugin, utils } = stylelint
export const ruleName = 'patods/design-tokens'

// The stable set of subcodes (lint-rules.md §2.1, G-2). Renaming or removing one requires an ADR-16 record.
export const designTokensCodes = [
  'primitive-token',
  'brand-mode-source-token',
  'unknown-token',
  'literal-value',
  'var-fallback-literal',
  'token-definition',
  'control-height',
  'control-height-missing',
  'unclassified-component',
] as const
export type DesignTokensCode = (typeof designTokensCodes)[number]

export const messages = utils.ruleMessages(ruleName, {
  primitive: (name: string) => `primitive-token: "${name}" is primitive; use a semantic or component token (TOK-03).`,
  brandSource: (name: string) => `brand-mode-source-token: "${name}" is a brand/mode source and cannot be consumed (FR-033).`,
  unknown: (name: string) => `unknown-token: "${name}" is not a public semantic or component token.`,
  literal: (prop: string) => `literal-value: literal value in "${prop}"; use a token (TOK-03).`,
  fallback: (name: string) => `var-fallback-literal: literal fallback in var(${name}, …) (TOK-03).`,
  definition: (prop: string) => `token-definition: custom property "${prop}" defined outside the token source (FR-001).`,
  controlHeight: (prop: string) => `control-height: "${prop}" must take a token from the control-height scale (FR-023).`,
  controlHeightMissing: (sel: string) => `control-height-missing: "${sel}" sets no control height from the scale (FR-023).`,
  unclassifiedComponent: (sel: string) => `unclassified-component: "${sel}" is not in the control registry (§3.7).`,
})

// ---- static vocabularies (lint-rules.md §3.3) ------------------------------------------------------

const ALLOWLIST = new Set(['transparent', 'currentcolor', 'auto', 'none', 'inherit', 'initial', 'unset', 'revert', 'revert-layer'])
const CALC = new Set(['calc', 'min', 'max', 'clamp'])
const COLOR_FUNCS = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix', 'light-dark', 'contrast-color'])
const SYSTEM_COLORS = new Set([
  'canvas', 'canvastext', 'linktext', 'visitedtext', 'activetext', 'buttonface', 'buttontext',
  'buttonborder', 'field', 'fieldtext', 'highlight', 'highlighttext', 'selecteditem', 'selecteditemtext',
  'mark', 'marktext', 'graytext', 'accentcolor', 'accentcolortext',
])
const NAMED_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond',
  'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
  'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey',
  'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon',
  'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia',
  'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink',
  'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue',
  'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink',
  'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue',
  'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise',
  'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace',
  'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise',
  'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna',
  'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal',
  'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
])

const DEFAULT_CONTROL_HEIGHT_PROPS = ['height', 'min-height', 'block-size', 'min-block-size']

// ---- manifest --------------------------------------------------------------------------------------

interface Entry {
  layer: string
  role: string
  category: string
  scale: string | null
  aliasChains: Record<string, string[]> | null
}

interface Manifest {
  byCss: Map<string, Entry>
  prefix: string
  controlHeightCss: Set<string> // allowed tokens that resolve to a control-height scale member
}

function loadManifest(manifestPath: string): Manifest {
  const json = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const byCss = new Map<string, Entry>()
  let prefix = 'patods'
  const scaleMembers = new Set<string>((json.scales?.['control-height'] ?? []) as string[])
  for (const t of json.tokens ?? []) {
    byCss.set(t.cssName, { layer: t.layer, role: t.role, category: t.category, scale: t.scale ?? null, aliasChains: t.aliasChains ?? null })
    const m = /^--([a-z0-9]+)-/.exec(t.cssName)
    if (m) prefix = m[1]!
  }
  const controlHeightCss = new Set<string>()
  for (const [cssName, e] of byCss) {
    if (e.layer === 'primitive' || e.role === 'brand-mode-source') continue
    if (e.scale === 'control-height') {
      controlHeightCss.add(cssName)
      continue
    }
    if (e.aliasChains) {
      for (const chain of Object.values(e.aliasChains)) {
        if (chain.some((p) => scaleMembers.has(p))) {
          controlHeightCss.add(cssName)
          break
        }
      }
    }
  }
  return { byCss, prefix, controlHeightCss }
}

type VarClass = 'ok' | 'primitive' | 'brand' | 'unknown'
function classifyVar(name: string, byCss: Map<string, Entry>): VarClass {
  const e = byCss.get(name)
  if (!e) return 'unknown'
  if (e.layer === 'primitive') return 'primitive'
  if (e.role === 'brand-mode-source') return 'brand'
  return 'ok'
}

// ---- value analysis (lint-rules.md §3.3/§3.4) ------------------------------------------------------

interface Finding {
  offset: number // character offset into the declaration value
  code: 'primitive' | 'brand' | 'unknown' | 'literal' | 'fallback'
  arg: string
}

interface Ctx {
  governed: boolean
  category: string | null
  keywords: Set<string>
  inCalc: boolean
  inFallback: boolean
  fallbackVar: string
  forcedColors: boolean
}

function firstIdent(children: any[]): any {
  for (const c of children) if (isTokenNode(c) && c.value[0] === TokenType.Ident) return c.value
  return null
}

function fallbackAfterComma(children: any[]): any[] {
  const i = children.findIndex((c) => isTokenNode(c) && c.value[0] === TokenType.Comma)
  return i === -1 ? [] : children.slice(i + 1)
}

function walkValue(nodes: any[], ctx: Ctx, byCss: Map<string, Entry>, out: Finding[]): void {
  for (const node of nodes) {
    if (isFunctionNode(node)) {
      const name = node.getName().toLowerCase()
      const startOffset = node.name[2] as number
      if (name === 'var') {
        const ident = firstIdent(node.value)
        const varName = ident ? (ident[1] as string) : ''
        if (varName.startsWith('--')) {
          const cls = classifyVar(varName, byCss)
          if (cls !== 'ok') out.push({ offset: startOffset, code: cls, arg: varName })
        }
        const fb = fallbackAfterComma(node.value)
        if (fb.length) walkValue(fb, { ...ctx, inCalc: false, inFallback: true, fallbackVar: varName || ctx.fallbackVar }, byCss, out)
      } else if (CALC.has(name)) {
        walkValue(node.value, { ...ctx, inCalc: true }, byCss, out)
      } else {
        // Other function: a colour / easing / url / env / attr / gradient function.
        if (ctx.governed) {
          out.push(ctx.inFallback ? { offset: startOffset, code: 'fallback', arg: ctx.fallbackVar } : { offset: startOffset, code: 'literal', arg: ctx.category ?? '' })
          // opaque literal leaf: do not descend
        } else {
          walkValue(node.value, ctx, byCss, out) // still classify any nested var()
        }
      }
    } else if (isTokenNode(node)) {
      classifyToken(node.value, ctx, out)
    }
    // whitespace / comments / blocks: ignored
  }
}

function classifyToken(tok: any, ctx: Ctx, out: Finding[]): void {
  const type = tok[0]
  const start = tok[2] as number
  const data = tok[4]
  const push = () => out.push(ctx.inFallback ? { offset: start, code: 'fallback', arg: ctx.fallbackVar } : { offset: start, code: 'literal', arg: ctx.category ?? '' })
  switch (type) {
    case TokenType.Hash:
      push() // hexadecimal colour: literal in any property (§3.3)
      return
    case TokenType.Dimension: {
      if (Number(data?.value) === 0) return // 0 with a unit
      if (ctx.governed) push()
      return
    }
    case TokenType.Percentage: {
      if (Number(data?.value) === 0) return
      if (ctx.governed) push()
      return
    }
    case TokenType.Number: {
      if (Number(data?.value) === 0) return
      if (ctx.inCalc) return // unitless operand of * or / (approximated as accepted)
      if (ctx.governed) push()
      return
    }
    case TokenType.String:
    case TokenType.URL:
      if (ctx.governed) push()
      return
    case TokenType.Ident: {
      const id = String(data?.value ?? tok[1]).toLowerCase()
      if (ALLOWLIST.has(id)) return
      if (NAMED_COLORS.has(id)) {
        if (ctx.governed) push()
        return
      }
      if (SYSTEM_COLORS.has(id)) {
        if (!ctx.forcedColors && ctx.governed) push()
        return
      }
      if (ctx.keywords.has(id)) {
        if (ctx.governed) push()
        return
      }
      return // other identifier: structural, accepted
    }
    default:
      return
  }
}

// ---- selector helpers (postcss-selector-parser) ----------------------------------------------------

function resolvedSelectors(rule: any): string[] {
  const own = String(rule.selector).split(',').map((s) => s.trim()).filter(Boolean)
  const parent = rule.parent
  if (!parent || parent.type !== 'rule') return own
  const out: string[] = []
  for (const ps of resolvedSelectors(parent)) for (const os of own) out.push(os.includes('&') ? os.replace(/&/g, ps) : `${ps} ${os}`)
  return out
}

function normAttr(node: any): string {
  const op = node.operator ?? ''
  const val = node.value != null ? `"${String(node.value).replace(/^["']|["']$/g, '')}"` : ''
  return `[${node.attribute}${op}${val}]`
}

/** Simple class + data-<prefix>-* attribute selectors of a compound, normalized and sorted. */
function compoundKey(simples: string[]): string {
  return [...simples].sort().join('')
}

interface CompoundInfo {
  simples: string[] // normalized class/attr simple selectors
  pseudoClasses: string[]
  pseudoElements: string[]
}

/** Parse one complex selector into its compounds (left→right), without expanding :is()/:where(). */
function compoundsOf(selector: string, prefix: string): CompoundInfo[] {
  const compounds: CompoundInfo[] = []
  selectorParser((root: any) => {
    root.each((sel: any) => {
      let cur: CompoundInfo = { simples: [], pseudoClasses: [], pseudoElements: [] }
      sel.each((n: any) => {
        if (n.type === 'combinator') {
          compounds.push(cur)
          cur = { simples: [], pseudoClasses: [], pseudoElements: [] }
          return
        }
        if (n.type === 'class') cur.simples.push(`.${n.value}`)
        else if (n.type === 'attribute' && String(n.attribute).startsWith(`data-${prefix}-`)) cur.simples.push(normAttr(n))
        else if (n.type === 'pseudo') {
          if (String(n.value).startsWith('::')) cur.pseudoElements.push(n.value)
          else cur.pseudoClasses.push(n.value)
        }
      })
      compounds.push(cur)
    })
  }).processSync(selector)
  return compounds
}

/** Every class + data-<prefix>-* attribute simple selector anywhere in the selector (incl. :is/:where/:not/:has). */
function allSimples(selector: string, prefix: string): { value: string; index: number }[] {
  const out: { value: string; index: number }[] = []
  selectorParser((root: any) => {
    root.walk((n: any) => {
      if (n.type === 'class') out.push({ value: `.${n.value}`, index: n.sourceIndex })
      else if (n.type === 'attribute' && String(n.attribute).startsWith(`data-${prefix}-`)) out.push({ value: normAttr(n), index: n.sourceIndex })
    })
  }).processSync(selector)
  return out
}

// ---- control registry (lint-rules.md §3.7) ---------------------------------------------------------

interface RegClasses {
  root: string[]
  sizing: string[]
  other: string[]
  parts: string[]
}
interface RegEntry {
  id: string
  kind: 'control' | 'non-control'
  file: string
  classes: RegClasses
}
interface Registry {
  controlBoxSimple: Set<string> // simple selectors in root/sizing/other of any control entry
  controlPartsSimple: Set<string> // simple selectors in parts of any control entry
  registeredSimple: Set<string> // simple selectors anywhere in any registered compound
  entries: RegEntry[]
}

function simplesOfCompound(compound: string, prefix: string): string[] {
  const cs = compoundsOf(compound, prefix)
  return cs.flatMap((c) => c.simples)
}

function loadRegistry(registryPath: string, prefix: string): Registry {
  const json = JSON.parse(readFileSync(registryPath, 'utf8'))
  const entries: RegEntry[] = json.components ?? []
  const controlBoxSimple = new Set<string>()
  const controlPartsSimple = new Set<string>()
  const registeredSimple = new Set<string>()
  for (const e of entries) {
    const groups: [keyof RegClasses, Set<string> | null][] = [
      ['root', e.kind === 'control' ? controlBoxSimple : null],
      ['sizing', e.kind === 'control' ? controlBoxSimple : null],
      ['other', e.kind === 'control' ? controlBoxSimple : null],
      ['parts', e.kind === 'control' ? controlPartsSimple : null],
    ]
    for (const [g, target] of groups) {
      for (const compound of e.classes?.[g] ?? []) {
        for (const s of simplesOfCompound(compound, prefix)) {
          registeredSimple.add(s)
          target?.add(s)
        }
      }
    }
  }
  return { controlBoxSimple, controlPartsSimple, registeredSimple, entries }
}

function fileMatches(absFile: string | undefined, entryFile: string): boolean {
  if (!absFile) return false
  const a = absFile.replace(/\\/g, '/')
  const e = entryFile.replace(/\\/g, '/')
  if (a === e || a.endsWith(`/${e}`)) return true
  const rel = relative(process.cwd(), absFile).replace(/\\/g, '/')
  return rel === e
}

// ---- rule ------------------------------------------------------------------------------------------

function declValueIndex(decl: any): number {
  const between = decl.raws?.between ?? ': '
  return String(decl.prop).length + String(between).length
}

const rule = (primary: boolean, secondary?: any) => {
  return (root: any, result: any) => {
    const valid = utils.validateOptions(result, ruleName, { actual: primary, possible: [true, false] })
    if (!valid || !primary) return
    const manifestPath: string | undefined = secondary?.manifestPath
    const controlRegistryPath: string | undefined = secondary?.controlRegistryPath
    if (!manifestPath) throw new Error(`${ruleName}: option "manifestPath" required.`)
    if (!controlRegistryPath) throw new Error(`${ruleName}: option "controlRegistryPath" required.`)

    let manifest: Manifest
    let registry: Registry
    try {
      manifest = loadManifest(resolveDataPath(manifestPath))
    } catch {
      throw new Error(`${ruleName}: could not read the manifest (${manifestPath}).`)
    }
    try {
      registry = loadRegistry(resolveDataPath(controlRegistryPath), manifest.prefix)
    } catch {
      throw new Error(`${ruleName}: could not read the control registry (${controlRegistryPath}).`)
    }
    const { byCss, prefix, controlHeightCss } = manifest

    const governed: Record<string, string> = secondary?.governedProperties?.properties ?? (governedDefault as any).properties
    const keywordsByCat: Record<string, string[]> = secondary?.governedProperties?.literalKeywords ?? (governedDefault as any).literalKeywords
    const controlHeightProps = new Set<string>(secondary?.controlHeightProperties ?? DEFAULT_CONTROL_HEIGHT_PROPS)

    const report = (node: any, message: string, index: number, endIndex: number = index + 1) =>
      utils.report({ message, node, result, ruleName, index, endIndex })

    // forced-colors context of a node.
    const inForcedColors = (node: any): boolean => {
      let n = node.parent
      while (n) {
        if (n.type === 'atrule' && String(n.name).toLowerCase() === 'media' && /forced-colors\s*:\s*active/i.test(String(n.params)) && !/\bnot\b/i.test(String(n.params))) return true
        n = n.parent
      }
      return false
    }

    // skip @font-face / @page declarations.
    const inSkippedAtRule = (node: any): boolean => {
      let n = node.parent
      while (n) {
        if (n.type === 'atrule' && /^(font-face|page)$/i.test(String(n.name))) return true
        n = n.parent
      }
      return false
    }

    // Track which declarations produced a value warning (step 2), so control-height (step 3) is skipped.
    const valueWarned = new Set<any>()

    // ---- pass 1: declarations ----
    root.walkDecls((decl: any) => {
      if (inSkippedAtRule(decl)) return
      const prop = String(decl.prop)
      const lower = prop.toLowerCase()

      // step 1: custom property definition
      if (prop.startsWith('--')) {
        report(decl, messages.definition(prop), 0)
        return // value not analyzed
      }

      // step 2: value leaves
      const category = governed[lower] ?? null
      const isGoverned = category != null
      const keywords = new Set<string>(category ? keywordsByCat[category] ?? [] : [])
      const value = String(decl.value)
      const out: Finding[] = []
      try {
        const nodes = parseListOfComponentValues(tokenize({ css: value }))
        walkValue(nodes, { governed: isGoverned, category, keywords, inCalc: false, inFallback: false, fallbackVar: '', forcedColors: inForcedColors(decl) }, byCss, out)
      } catch {
        /* unparsable value: no leaf warnings */
      }
      const base = declValueIndex(decl)
      for (const f of out) {
        valueWarned.add(decl)
        const msg =
          f.code === 'primitive' ? messages.primitive(f.arg)
          : f.code === 'brand' ? messages.brandSource(f.arg)
          : f.code === 'unknown' ? messages.unknown(f.arg)
          : f.code === 'fallback' ? messages.fallback(f.arg)
          : messages.literal(prop)
        report(decl, msg, base + f.offset)
      }
    })

    // ---- @property / @custom-media: token-definition at the at-rule position ----
    root.walkAtRules((at: any) => {
      const name = String(at.name).toLowerCase()
      if (name === 'property' || name === 'custom-media') {
        report(at, messages.definition(`@${name}`), 0)
      }
    })

    // ---- @media / @container parameters (§3.6) ----
    root.walkAtRules((at: any) => {
      const name = String(at.name).toLowerCase()
      if (name !== 'media' && name !== 'container') return
      const params = String(at.params ?? '')
      const base = 1 + String(at.name).length + String(at.raws?.afterName ?? ' ').length
      let toks: any[]
      try {
        toks = tokenize({ css: params })
      } catch {
        return
      }
      for (const tok of toks) {
        const type = tok[0]
        const start = tok[2] as number
        const data = tok[4]
        if (type === TokenType.Ident) {
          const id = String(data?.value ?? tok[1])
          if (id.startsWith('--')) {
            const e = byCss.get(id)
            if (e && e.layer !== 'primitive' && e.role !== 'brand-mode-source' && e.category === 'breakpoint') continue
            if (e && e.layer === 'primitive') report(at, messages.primitive(id), base + start)
            else report(at, messages.unknown(id), base + start)
          }
          continue
        }
        if ((type === TokenType.Dimension || type === TokenType.Number || type === TokenType.Percentage) && Number(data?.value) !== 0) {
          report(at, messages.literal(`@${name}`), base + start)
        }
      }
    })

    // ---- pass 2: control-height on control-sizing rules (§3.5/§3.7) ----
    const isValidControlHeightValue = (value: string): boolean => {
      let nodes: any[]
      try {
        nodes = parseListOfComponentValues(tokenize({ css: value }))
      } catch {
        return false
      }
      const meaningful = nodes.filter((n: any) => isFunctionNode(n) || isTokenNode(n))
      if (meaningful.length !== 1) return false
      const only = meaningful[0]
      if (!isFunctionNode(only) || only.getName().toLowerCase() !== 'var') return false
      const ident = firstIdent(only.value)
      const varName = ident ? (ident[1] as string) : ''
      return controlHeightCss.has(varName)
    }

    const absFile: string | undefined = root.source?.input?.file
    const fileEntries = registry.entries.filter((e) => fileMatches(absFile, e.file))
    const fileIsRegistered = fileEntries.length > 0

    const rightmostSizesControl = (selector: string): { sizes: boolean } => {
      const compounds = compoundsOf(selector, prefix)
      const last = compounds[compounds.length - 1]
      if (!last) return { sizes: false }
      if (last.pseudoElements.length) return { sizes: false } // pseudo-element → not the control box
      const simples = new Set(last.simples)
      const hitsBox = [...simples].some((s) => registry.controlBoxSimple.has(s))
      const hitsParts = [...simples].some((s) => registry.controlPartsSimple.has(s))
      return { sizes: hitsBox && !hitsParts }
    }

    root.walkRules((r: any) => {
      if (r.parent?.type === 'atrule' && /keyframes$/i.test(String(r.parent.name))) return
      let sizes = false
      for (const sel of resolvedSelectors(r)) if (rightmostSizesControl(sel).sizes) sizes = true
      if (!sizes) return
      r.walkDecls((decl: any) => {
        if (!controlHeightProps.has(String(decl.prop).toLowerCase())) return
        if (valueWarned.has(decl)) return // step 2 already warned → skip step 3
        if (!isValidControlHeightValue(String(decl.value))) {
          report(decl, messages.controlHeight(String(decl.prop)), declValueIndex(decl))
        }
      })
    })

    // ---- pass 3: control-height-missing presence (§3.5/§3.7) ----
    if (fileIsRegistered) {
      // single-compound rules that declare a valid control height, keyed by compound.
      const satisfied = new Set<string>()
      const firstRuleFor = new Map<string, any>() // compoundKey → first rule whose rightmost compound ⊇ it
      root.walkRules((r: any) => {
        if (r.parent?.type === 'atrule' && /keyframes$/i.test(String(r.parent.name))) return
        for (const sel of resolvedSelectors(r)) {
          const compounds = compoundsOf(sel, prefix)
          if (compounds.length !== 1) continue
          const c = compounds[0]!
          if (c.pseudoClasses.length || c.pseudoElements.length) continue
          const key = compoundKey(c.simples)
          let ok = false
          r.walkDecls((decl: any) => {
            if (controlHeightProps.has(String(decl.prop).toLowerCase()) && isValidControlHeightValue(String(decl.value))) ok = true
          })
          if (ok) satisfied.add(key)
        }
      })
      // position helper: first rule whose rightmost compound contains the registered simple selectors.
      const locate = (simples: string[]): any | null => {
        let found: any = null
        root.walkRules((r: any) => {
          if (found) return
          if (r.parent?.type === 'atrule' && /keyframes$/i.test(String(r.parent.name))) return
          for (const sel of resolvedSelectors(r)) {
            const compounds = compoundsOf(sel, prefix)
            const last = compounds[compounds.length - 1]
            if (last && simples.every((s) => last.simples.includes(s))) {
              found = r
              return
            }
          }
        })
        return found
      }
      for (const e of fileEntries) {
        if (e.kind !== 'control') continue
        for (const g of ['root', 'sizing'] as const) {
          for (const compound of e.classes?.[g] ?? []) {
            const simples = simplesOfCompound(compound, prefix)
            if (satisfied.has(compoundKey(simples))) continue
            const where = locate(simples)
            if (where) report(where, messages.controlHeightMissing(compound), 0)
            else report(root, messages.controlHeightMissing(compound), 0, 1)
          }
        }
      }
    }

    // ---- pass 4: unclassified-component (§3.5) ----
    if (!fileIsRegistered) {
      report(root, messages.unclassifiedComponent(absFile ? relative(process.cwd(), absFile).replace(/\\/g, '/') : '<file>'), 0, 1)
    } else {
      root.walkRules((r: any) => {
        if (r.parent?.type === 'atrule' && /keyframes$/i.test(String(r.parent.name))) return
        const seen = new Set<string>()
        for (const sel of resolvedSelectors(r)) {
          for (const s of allSimples(sel, prefix)) {
            if (registry.registeredSimple.has(s.value)) continue
            const dedupe = `${s.value}@${s.index}`
            if (seen.has(dedupe)) continue
            seen.add(dedupe)
            report(r, messages.unclassifiedComponent(s.value), s.index)
          }
        }
      })
    }
  }
}

rule.ruleName = ruleName
rule.messages = messages
export default createPlugin(ruleName, rule as any)
