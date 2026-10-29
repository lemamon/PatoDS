// Regra Stylelint patods/design-tokens (US5, FR-022/FR-023): barra token primitivo, token
// brand-mode-source, token desconhecido, valor literal, fallback literal em var() e definição de
// custom property em CSS de componente. Guiada pelo manifesto de tokens (build-manifests.md).
import stylelint from 'stylelint'
import { readFileSync } from 'node:fs'

const { createPlugin, utils } = stylelint
export const ruleName = 'patods/design-tokens'

export const messages = utils.ruleMessages(ruleName, {
  primitive: (name: string) => `primitive-token: "${name}" é primitivo; use um token semântico ou de componente (TOK-03).`,
  brandSource: (name: string) => `brand-mode-source-token: "${name}" é fonte de marca/modo e não pode ser consumido (FR-033).`,
  unknown: (name: string) => `unknown-token: "${name}" não está no catálogo de tokens.`,
  literal: (prop: string) => `literal-value: valor literal em "${prop}"; use um token (TOK-03).`,
  fallback: (name: string) => `var-fallback-literal: fallback literal em var(${name}, …) (TOK-03).`,
  definition: (prop: string) => `token-definition: custom property "${prop}" definida fora da fonte de tokens (FR-001).`,
})

const PREFIX = 'patods'
const GOVERNED = new Set([
  'color', 'background-color', 'background', 'border-color', 'border', 'border-top-color',
  'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'outline',
  'fill', 'stroke', 'box-shadow', 'text-decoration-color', 'caret-color', 'accent-color',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'block-size',
  'min-block-size', 'inline-size', 'gap', 'row-gap', 'column-gap', 'border-width', 'border-radius',
  'font-size', 'line-height', 'letter-spacing', 'padding', 'padding-top', 'padding-right',
  'padding-bottom', 'padding-left', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
])
const KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer', 'currentcolor', 'transparent', 'none', 'auto', '0'])
const VAR_RE = new RegExp(`var\\(\\s*(--${PREFIX}-[a-z0-9-]+)\\s*(?:,([^;]*))?\\)`, 'gi')
const COLOR_LIT = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/
const DIM_LIT = /\b\d*\.?\d+(px|rem|em|%|vh|vw|vmin|vmax|ch|ex|pt|cm|mm|in|deg|ms|s)\b/

interface Entry {
  layer: string
  role: string
}

function loadManifest(manifestPath: string): Map<string, Entry> {
  const m = new Map<string, Entry>()
  const json = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const t of json.tokens ?? []) m.set(t.cssName, { layer: t.layer, role: t.role })
  return m
}

function hasLiteral(text: string): boolean {
  // remove spans var(...) antes de procurar literais fora de tokens
  const stripped = text.replace(VAR_RE, ' ').replace(/\b(?:calc|min|max|clamp)\(/g, ' ')
  const cleaned = stripped.replace(/[(),/]/g, ' ')
  for (const part of cleaned.split(/\s+/).filter(Boolean)) {
    if (KEYWORDS.has(part.toLowerCase())) continue
    if (COLOR_LIT.test(part) || DIM_LIT.test(part)) return true
  }
  return false
}

const rule = (primary: boolean, secondary?: { manifestPath?: string }) => {
  return (root: any, result: any) => {
    const valid = utils.validateOptions(result, ruleName, { actual: primary, possible: [true, false] })
    if (!valid || !primary) return
    const manifestPath = secondary?.manifestPath
    if (!manifestPath) {
      throw new Error(`${ruleName}: opção "manifestPath" obrigatória.`)
    }
    let manifest: Map<string, Entry>
    try {
      manifest = loadManifest(manifestPath)
    } catch (e) {
      throw new Error(`${ruleName}: não foi possível ler o manifesto (${manifestPath}).`)
    }

    root.walkDecls((decl: any) => {
      const prop: string = decl.prop
      const value: string = decl.value

      if (prop.startsWith(`--${PREFIX}-`)) {
        utils.report({ message: messages.definition(prop), node: decl, result, ruleName })
      }

      VAR_RE.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = VAR_RE.exec(value)) !== null) {
        const name = match[1]!
        const fallback = match[2]
        const entry = manifest.get(name)
        if (!entry) {
          utils.report({ message: messages.unknown(name), node: decl, result, ruleName })
        } else if (entry.layer === 'primitive') {
          utils.report({ message: messages.primitive(name), node: decl, result, ruleName })
        } else if (entry.role === 'brand-mode-source') {
          utils.report({ message: messages.brandSource(name), node: decl, result, ruleName })
        }
        if (fallback && (COLOR_LIT.test(fallback) || DIM_LIT.test(fallback))) {
          utils.report({ message: messages.fallback(name), node: decl, result, ruleName })
        }
      }

      if (GOVERNED.has(prop.toLowerCase()) && hasLiteral(value)) {
        utils.report({ message: messages.literal(prop), node: decl, result, ruleName })
      }
    })
  }
}

rule.ruleName = ruleName
rule.messages = messages
export default createPlugin(ruleName, rule as any)
