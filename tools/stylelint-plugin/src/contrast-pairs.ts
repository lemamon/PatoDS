// Stylelint rule patods/contrast-pairs (US5, FR-021, A11Y-09): every foreground/background colour pair
// a component style uses must appear in the contrast manifest. This rule only requires the tuple to be
// present; the ratio is measured by tokens-contrast (contrast-manifest.md). It groups declarations by
// subject and state, resolves var() → token path through the token manifest, reads the background stack
// from the subject's background or from a `/* patods-contrast: on … */` annotation, and skips
// `@media (forced-colors: active)`. The subject/state merge is the sanctioned approximation of the
// cascade (lint-rules.md §4.8); full specificity and cross-component nesting are out of scope.
import stylelint from 'stylelint'
import { readFileSync } from 'node:fs'

const { createPlugin, utils } = stylelint
export const ruleName = 'patods/contrast-pairs'

export const messages = utils.ruleMessages(ruleName, {
  notInManifest: (fg: string, bg: string, state: string, kind: string) =>
    `pair-not-in-manifest: (${fg}, [${bg}], ${state}, ${kind}) is not in the contrast manifest (FR-021).`,
  missingBackground: (fg: string) =>
    `missing-background: foreground "${fg}" has no background on the subject and no annotation (FR-021).`,
  missingForeground: (bg: string) =>
    `missing-foreground: background "${bg}" has no foreground colour on the subject (WCAG F24).`,
  unresolvable: (value: string) => `unresolvable-color: "${value}" does not resolve to an allowed colour token (FR-021).`,
  invalidAnnotation: (text: string) => `invalid-annotation: "${text}" (lint-rules.md §4.4).`,
  unmappedState: (seg: string) => `unmapped-state: selector segment "${seg}" has no state mapping (lint-rules.md §4.3).`,
})

// ---- v1 maps (lint-rules.md §4.2/§4.3) --------------------------------------------------------------

const COLOR_GROUPS: Record<string, string[]> = {
  text: ['color', '-webkit-text-fill-color'],
  nonText: ['fill', 'stroke', 'accent-color'],
  border: ['border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  edge: ['outline', 'outline-color'],
  focusEdge: ['box-shadow'],
  background: ['background-color'],
  backgroundImage: ['background-image'],
}
const PROP_GROUP = new Map<string, string>()
for (const [g, props] of Object.entries(COLOR_GROUPS)) for (const p of props) PROP_GROUP.set(p, g)
const INTERIOR = new Set(['text', 'nonText', 'border'])
const EDGE = new Set(['edge', 'focusEdge'])

// State selectors (pseudo-classes / attributes) → state, highest precedence first.
const STATE_RULES: { re: RegExp; state: string }[] = [
  { re: /:disabled(?![\w-])/, state: 'disabled' },
  { re: /\[disabled\]/, state: 'disabled' },
  { re: /\[aria-disabled="true"\]/, state: 'disabled' },
  { re: /:invalid(?![\w-])/, state: 'invalid' },
  { re: /:user-invalid(?![\w-])/, state: 'invalid' },
  { re: /\[aria-invalid="true"\]/, state: 'invalid' },
  { re: /:checked(?![\w-])/, state: 'selected' },
  { re: /:indeterminate(?![\w-])/, state: 'selected' },
  { re: /\[aria-selected="true"\]/, state: 'selected' },
  { re: /\[aria-checked="(?:true|mixed)"\]/, state: 'selected' },
  { re: /\[aria-pressed="true"\]/, state: 'selected' },
  { re: /\[aria-current(?:=(?!"false")[^\]]*)?\]/, state: 'selected' },
  { re: /:focus-visible(?![\w-])/, state: 'focus-visible' },
  { re: /:focus-within(?![\w-])/, state: 'focus-visible' },
  { re: /:focus(?![\w-])/, state: 'focus-visible' },
  { re: /:active(?![\w-])/, state: 'active' },
  { re: /:hover(?![\w-])/, state: 'hover' },
]
// state-only selectors removed from the subject with no state attached.
const NONE_RE = /:enabled(?![\w-])|:link(?![\w-])|:any-link(?![\w-])/g
// selectors that look like a state but have no mapping → unmapped-state.
const STATE_LIKE: RegExp[] = [
  /:visited(?![\w-])/, /:target(?![\w-])/, /:target-within(?![\w-])/, /:open(?![\w-])/,
  /:popover-open(?![\w-])/, /:modal(?![\w-])/, /:placeholder-shown(?![\w-])/, /:read-only(?![\w-])/,
  /:read-write(?![\w-])/, /:autofill(?![\w-])/,
]
const STATE_PRECEDENCE = ['disabled', 'inactive', 'invalid', 'selected', 'focus-visible', 'active', 'hover', 'default']
const GLOBALS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer'])
const STATE_VOCAB = new Set(['default', 'hover', 'active', 'focus-visible', 'selected', 'invalid', 'disabled', 'inactive'])

// ---- manifests -------------------------------------------------------------------------------------

interface TokenEntry {
  id: string
  layer: string
  role: string
  type: string
}
interface Pair {
  fg: string
  bg: string[]
  state: string
  kind: string
}

function loadTokenManifest(path: string): { byCss: Map<string, TokenEntry>; prefix: string } {
  const json = JSON.parse(readFileSync(path, 'utf8'))
  const byCss = new Map<string, TokenEntry>()
  let prefix = 'patods'
  for (const t of json.tokens ?? []) {
    byCss.set(t.cssName, { id: t.id, layer: t.layer, role: t.role, type: t.type })
    const m = /^--([a-z0-9]+)-/.exec(t.cssName)
    if (m) prefix = m[1]!
  }
  return { byCss, prefix }
}

function loadContrastManifest(path: string): Pair[] {
  const json = JSON.parse(readFileSync(path, 'utf8'))
  return (json.pairs ?? []).map((p: any) => ({
    fg: p.fg,
    bg: Array.isArray(p.bg) ? p.bg : [p.bg],
    state: p.state,
    kind: p.kind ?? p.type,
  }))
}

function loadSurfaces(path: string | undefined): Set<string> | null {
  if (!path) return null
  try {
    const json = JSON.parse(readFileSync(path, 'utf8'))
    const names = Object.keys(json.sets ?? json ?? {})
    return new Set(names)
  } catch {
    return null
  }
}

// ---- helpers ---------------------------------------------------------------------------------------

type Resolution =
  | { kind: 'token'; path: string }
  | { kind: 'transparent' }
  | { kind: 'currentcolor' }
  | { kind: 'absent' }
  | { kind: 'unresolvable'; value: string }

function resolveColor(value: string, prefix: string, byCss: Map<string, TokenEntry>): Resolution {
  const v = value.replace(/!important\s*$/, '').trim()
  const lower = v.toLowerCase()
  if (lower === 'transparent') return { kind: 'transparent' }
  if (lower === 'currentcolor') return { kind: 'currentcolor' }
  if (GLOBALS.has(lower)) return { kind: 'absent' }
  const single = new RegExp(`^var\\(\\s*(--${prefix}-[a-z0-9-]+)\\s*(?:,[^)]*)?\\)$`, 'i').exec(v)
  if (single) {
    const entry = byCss.get(single[1]!)
    if (!entry) return { kind: 'unresolvable', value: v }
    if (entry.layer === 'primitive' || entry.role === 'brand-mode-source' || entry.type !== 'color') {
      return { kind: 'unresolvable', value: v }
    }
    return { kind: 'token', path: entry.id }
  }
  return { kind: 'unresolvable', value: v }
}

interface Annotation {
  tokens: string[] // stack entries: token paths and "@set" names, base→top
  asNonText: boolean
}

/** Parses a `patods-contrast: on …` comment; returns the annotation, or 'invalid' on bad syntax/refs. */
function parseAnnotation(
  text: string,
  prefix: string,
  byCss: Map<string, TokenEntry>,
  surfaces: Set<string> | null,
): Annotation | 'invalid' | null {
  const marker = `${prefix}-contrast:`
  const t = text.trim()
  if (!t.startsWith(marker)) return null
  const body = t.slice(marker.length).trim()
  const m = /^on\s+(.+?)(?:\s+as\s+(non-text))?$/.exec(body)
  if (!m) return 'invalid'
  const asNonText = m[2] === 'non-text'
  const parts = m[1]!.trim().split(/\s+/)
  const stack: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!
    if (p.startsWith('@')) {
      if (i !== 0) return 'invalid' // a set is only valid at the base
      const set = p.slice(1)
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(set)) return 'invalid'
      if (surfaces && !surfaces.has(set)) return 'invalid'
      stack.push(p)
    } else if (p.startsWith(`--${prefix}-`)) {
      const entry = byCss.get(p)
      if (!entry || entry.layer === 'primitive' || entry.role === 'brand-mode-source' || entry.type !== 'color') {
        return 'invalid'
      }
      stack.push(entry.id)
    } else {
      return 'invalid'
    }
  }
  return stack.length ? { tokens: stack, asNonText } : 'invalid'
}

/** Resolves nesting (& and implicit descendant) up the parent chain into absolute selector lists. */
function resolvedSelectors(rule: any): string[] {
  const own = String(rule.selector)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const parent = rule.parent
  if (!parent || parent.type !== 'rule') return own
  const parents = resolvedSelectors(parent)
  const out: string[] = []
  for (const ps of parents) {
    for (const os of own) {
      out.push(os.includes('&') ? os.replace(/&/g, ps) : `${ps} ${os}`)
    }
  }
  return out
}

/** Subject + state of one complex selector; { unmapped } names a state-like segment with no mapping. */
function subjectAndState(selector: string): { subject: string; state: string; unmapped?: string } {
  let s = selector
  for (const re of STATE_LIKE) {
    const m = re.exec(s)
    if (m) return { subject: s, state: 'default', unmapped: m[0] }
  }
  const data = /\[data-patods-state="([^"]*)"\]/.exec(s)
  if (data) {
    if (!STATE_VOCAB.has(data[1]!)) return { subject: s, state: 'default', unmapped: data[0] }
  }
  const states: string[] = []
  for (const { re, state } of STATE_RULES) {
    if (re.test(s)) {
      states.push(state)
      s = s.replace(new RegExp(re.source, 'g'), '')
    }
  }
  if (data) {
    states.push(data[1]!)
    s = s.replace(data[0], '')
  }
  s = s.replace(NONE_RE, '')
  const subject = s.replace(/\s+/g, ' ').trim()
  const state = states.length
    ? STATE_PRECEDENCE.find((p) => states.includes(p)) ?? 'default'
    : 'default'
  return { subject, state }
}

/** Walks the at-rule ancestors; null when the rule is inside `@media (forced-colors: active)`. */
function contextOf(rule: any): string | null {
  const parts: string[] = []
  let node = rule.parent
  while (node) {
    if (node.type === 'atrule') {
      const name = String(node.name).toLowerCase()
      const params = String(node.params ?? '').trim()
      if (name === 'media' && /forced-colors\s*:\s*active/i.test(params) && !/not\s/i.test(params)) return null
      if (name !== 'layer') parts.push(`@${name} ${params}`)
    }
    node = node.parent
  }
  return parts.reverse().join(' / ')
}

// ---- rule ------------------------------------------------------------------------------------------

interface Decl {
  resolution: Resolution
  node: any
  annotation: Annotation | null
}
type StateData = Map<string, Decl> // group → decl
type SubjectData = Map<string, StateData> // state → groups

const rule = (
  primary: boolean,
  secondary?: {
    manifestPath?: string
    contrastManifestPath?: string
    surfacesPath?: string
  },
) => {
  return (root: any, result: any) => {
    const valid = utils.validateOptions(result, ruleName, { actual: primary, possible: [true, false] })
    if (!valid || !primary) return
    const { manifestPath, contrastManifestPath, surfacesPath } = secondary ?? {}
    if (!manifestPath || !contrastManifestPath) {
      throw new Error(`${ruleName}: options "manifestPath" and "contrastManifestPath" are required.`)
    }
    let byCss: Map<string, TokenEntry>
    let prefix: string
    let pairs: Pair[]
    try {
      ;({ byCss, prefix } = loadTokenManifest(manifestPath))
      pairs = loadContrastManifest(contrastManifestPath)
    } catch {
      throw new Error(`${ruleName}: could not read the manifests.`)
    }
    const surfaces = loadSurfaces(surfacesPath)

    const report = (node: any, message: string) => utils.report({ message, node, result, ruleName })
    const matches = (fg: string, stack: string[], state: string, kind: string): boolean =>
      pairs.some(
        (p) =>
          p.kind === kind &&
          p.state === state &&
          p.fg === fg &&
          p.bg.length === stack.length &&
          p.bg.every((b, i) => b === stack[i]),
      )

    // Collect declarations grouped by subject (context folded into the key) and state.
    const subjects = new Map<string, SubjectData>()

    root.walkRules((r: any) => {
      // Skip keyframes and at-rules that are not selectors.
      if (r.parent?.type === 'atrule' && /keyframes$/i.test(String(r.parent.name))) return
      const context = contextOf(r)
      if (context === null) return // forced-colors block: ignored entirely

      for (const sel of resolvedSelectors(r)) {
        const { subject, state, unmapped } = subjectAndState(sel)
        // Only matters when the rule declares a colour property.
        const colourDecls = (r.nodes ?? []).filter(
          (n: any) => n.type === 'decl' && PROP_GROUP.has(String(n.prop).toLowerCase()),
        )
        if (!colourDecls.length) continue
        if (unmapped) {
          report(r, messages.unmappedState(unmapped))
          continue // a rule with an unmapped state is kept out of pair formation
        }
        const key = `${context}||${subject}`
        const subjectData = subjects.get(key) ?? new Map<string, StateData>()
        subjects.set(key, subjectData)
        const stateData = subjectData.get(state) ?? new Map<string, Decl>()
        subjectData.set(state, stateData)

        for (const decl of colourDecls) {
          const group = PROP_GROUP.get(String(decl.prop).toLowerCase())!
          // Preceding comment, whitespace only in between, is the annotation.
          let annotation: Annotation | null = null
          const prev = decl.prev()
          if (prev && prev.type === 'comment') {
            const parsed = parseAnnotation(prev.text, prefix, byCss, surfaces)
            if (parsed === 'invalid') report(prev, messages.invalidAnnotation(prev.text.trim()))
            else if (parsed) {
              if (parsed.asNonText && group !== 'text') report(prev, messages.invalidAnnotation(prev.text.trim()))
              else annotation = parsed
            }
          }
          const resolution =
            group === 'backgroundImage'
              ? ({ kind: 'absent' } as Resolution) // image handled by value, not colour resolution
              : resolveColor(String(decl.value), prefix, byCss)
          stateData.set(group, { resolution, node: decl, annotation })
          if (group === 'backgroundImage') stateData.get(group)!.resolution = { kind: 'unresolvable', value: String(decl.value) }
        }
      }
    })

    // Form and match pairs per subject and state.
    for (const subjectData of subjects.values()) {
      const def = subjectData.get('default')
      for (const [state, sd] of subjectData) {
        const effBg = sd.get('background') ?? (state !== 'default' ? def?.get('background') : undefined)
        const bgToken = effBg && effBg.resolution.kind === 'token' ? effBg.resolution.path : null
        const bgAnnotation = effBg?.annotation ?? null

        const interiorFor = (group: string): Decl | undefined =>
          sd.get(group) ?? (state !== 'default' ? def?.get(group) : undefined)

        // 1. interior foregrounds (text / nonText / border)
        for (const group of INTERIOR) {
          if (group === 'border' && state !== 'focus-visible') continue // v1: border only in focus-visible
          const fg = interiorFor(group)
          if (!fg) continue
          // In a non-default state only evaluate when something changed here (this state's fg or bg).
          if (state !== 'default' && !sd.get(group) && !sd.get('background')) continue
          if (fg.resolution.kind === 'unresolvable') {
            report(fg.node, messages.unresolvable(fg.resolution.value))
            continue
          }
          if (fg.resolution.kind !== 'token') continue
          const ann = fg.annotation ?? (state !== 'default' ? def?.get(group)?.annotation : null) ?? null
          const stack: string[] = []
          if (ann) stack.push(...ann.tokens)
          if (bgToken) stack.push(bgToken)
          if (!stack.length) {
            report(fg.node, messages.missingBackground(fg.resolution.path))
            continue
          }
          const kind = group === 'text' ? (ann?.asNonText ? 'non-text' : 'text') : 'non-text'
          if (!matches(fg.resolution.path, stack, state, kind)) {
            report(fg.node, messages.notInManifest(fg.resolution.path, stack.join(', '), state, kind))
          }
        }

        // 2. outer edges (edge always; focusEdge only in focus-visible) — annotation required
        for (const group of EDGE) {
          if (group === 'focusEdge' && state !== 'focus-visible') continue
          const fg = sd.get(group) ?? (state !== 'default' ? def?.get(group) : undefined)
          if (!fg) continue
          if (state !== 'default' && !sd.get(group)) continue
          if (fg.resolution.kind === 'unresolvable') {
            report(fg.node, messages.unresolvable(fg.resolution.value))
            continue
          }
          if (fg.resolution.kind !== 'token') continue
          const ann = fg.annotation ?? null
          if (!ann) {
            report(fg.node, messages.missingBackground(fg.resolution.path))
            continue
          }
          if (!matches(fg.resolution.path, ann.tokens, state, 'non-text')) {
            report(fg.node, messages.notInManifest(fg.resolution.path, ann.tokens.join(', '), state, 'non-text'))
          }
        }

        // 3. graphic background (annotated) — foreground is the background colour over the stack
        const bgHere = sd.get('background')
        if (bgHere && bgHere.annotation && bgHere.resolution.kind === 'token') {
          const stack = [...bgHere.annotation.tokens]
          if (!matches(bgHere.resolution.path, stack, state, 'non-text')) {
            report(bgHere.node, messages.notInManifest(bgHere.resolution.path, stack.join(', '), state, 'non-text'))
          }
        }

        // 4. background without a foreground (non-annotated bg, no effective text foreground)
        if (bgHere && !bgHere.annotation && bgHere.resolution.kind === 'token') {
          const text = sd.get('text') ?? def?.get('text')
          const hasText = text && (text.resolution.kind === 'token' || text.resolution.kind === 'unresolvable')
          if (!hasText) report(bgHere.node, messages.missingForeground(bgHere.resolution.path))
        }

        // 5. image under text
        const img = sd.get('backgroundImage')
        if (img && !/^\s*none\s*$/i.test(String(img.node.value))) {
          const text = sd.get('text') ?? def?.get('text')
          if (text && text.resolution.kind === 'token') report(img.node, messages.unresolvable(String(img.node.value)))
        }
      }
    }
  }
}

rule.ruleName = ruleName
rule.messages = messages
export default createPlugin(ruleName, rule as any)
