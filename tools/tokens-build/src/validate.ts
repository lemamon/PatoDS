// Validadores da fonte de tokens (US1). Reúne as regras V-01 a V-13 do data-model num módulo
// seccionado (as tarefas T027-T031 previam arquivos rules/* separados; concentrados aqui por
// coesão — ver nota no relatório). V-01 (schema DTCG) e V-03 (alias/ciclo) são garantidos pelo
// parser no adaptador, que falha antes de chegar aqui.
import { CATEGORIES, type Model, type ModelToken } from './model.ts'

export interface Finding {
  code: string
  rule: string
  id?: string
  file?: string
  message: string
}

const SEG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MODE_IDS = new Set(['light', 'dark'])

function toHex8(components: number[]): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${h(components[0] ?? 0)}${h(components[1] ?? 0)}${h(components[2] ?? 0)}`
}

/** V-02: literal só na camada primitiva. */
function literals(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    if (t.layer !== 'primitive' && !t.hasAlias) {
      out.push({
        code: 'TKN-LITERAL-OUTSIDE-PRIMITIVE',
        rule: 'V-02',
        id: t.id,
        file: t.file,
        message: `Token ${t.layer} "${t.id}" tem valor literal; só a camada primitiva pode (TOK-02, FR-003).`,
      })
    }
  }
}

const LAYER_ALLOWED: Record<string, Set<string>> = {
  primitive: new Set(['primitive']),
  semantic: new Set(['primitive', 'semantic']),
  component: new Set(['primitive', 'semantic', 'component']),
}

/** V-04: direção de referência entre camadas. */
function direction(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    const deps: string[] = t.raw?.dependencies ?? []
    for (const dep of deps) {
      const d = m.byId.get(dep)
      if (!d) continue
      if (!LAYER_ALLOWED[t.layer]?.has(d.layer)) {
        out.push({
          code: 'TKN-LAYER-DIRECTION',
          rule: 'V-04',
          id: t.id,
          file: t.file,
          message: `Token ${t.layer} "${t.id}" referencia ${d.layer} "${dep}"; direção proibida (TOK-02, FR-004).`,
        })
      }
    }
  }
}

/** V-06: nomenclatura (segmentos kebab ASCII, categoria conhecida, nome CSS único). */
function naming(m: Model, out: Finding[]): void {
  const byCss = new Map<string, string>()
  for (const t of m.tokens) {
    for (const s of t.segments) {
      if (!SEG.test(s)) {
        out.push({
          code: 'TKN-NAME-SEGMENT',
          rule: 'V-06',
          id: t.id,
          file: t.file,
          message: `Segmento "${s}" em "${t.id}" fora do padrão kebab ASCII minúsculo (TOK-04, FR-005).`,
        })
      }
    }
    if (!(CATEGORIES as readonly string[]).includes(t.category)) {
      out.push({
        code: 'TKN-NAME-CATEGORY',
        rule: 'V-06',
        id: t.id,
        file: t.file,
        message: `Primeiro segmento "${t.category}" de "${t.id}" não é uma categoria do TOK-10 (FR-005, FR-006).`,
      })
    }
    const prev = byCss.get(t.cssName)
    if (prev) {
      out.push({
        code: 'TKN-NAME-COLLISION',
        rule: 'V-06',
        id: t.id,
        file: t.file,
        message: `Nome CSS "${t.cssName}" colide entre "${prev}" e "${t.id}" (FR-005).`,
      })
    } else byCss.set(t.cssName, t.id)
  }
}

/** V-07/V-08: forma do grupo brand.* (role brand-mode-source). */
function brandSource(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    const underBrand = t.id.startsWith('brand.')
    if (underBrand !== (t.role === 'brand-mode-source')) {
      out.push({
        code: 'TKN-BRAND-SOURCE-FORM',
        rule: 'V-08',
        id: t.id,
        file: t.file,
        message: `Token "${t.id}": grupo reservado "brand." e papel brand-mode-source devem coincidir (FR-033).`,
      })
      continue
    }
    if (t.role === 'brand-mode-source') {
      const last = t.segments[t.segments.length - 1] ?? ''
      if (!MODE_IDS.has(last)) {
        out.push({
          code: 'TKN-BRAND-SOURCE-MODE',
          rule: 'V-08',
          id: t.id,
          file: t.file,
          message: `Token brand-mode-source "${t.id}" deve terminar num id de modo (${[...MODE_IDS].join(', ')}) (FR-033).`,
        })
      }
    }
  }
}

/** V-10: hex informado em cor dentro do gamut deve bater com a quantização de 8 bits. */
function colorHex(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    if (t.layer !== 'primitive' || t.type !== 'color') continue
    const v = t.raw?.$value
    if (!v || !Array.isArray(v.components) || typeof v.hex !== 'string') continue
    if (v.colorSpace && v.colorSpace !== 'srgb') continue
    const expected = toHex8(v.components)
    if (expected.toLowerCase() !== v.hex.toLowerCase()) {
      out.push({
        code: 'TKN-COLOR-HEX-MISMATCH',
        rule: 'V-10',
        id: t.id,
        file: t.file,
        message: `Token "${t.id}": hex ${v.hex} diverge dos componentes (esperado ${expected}) (FR-015).`,
      })
    }
  }
}

/** V-11: cada categoria tem ao menos um token semântico público. */
function coverage(m: Model, out: Finding[]): void {
  const covered = new Set<string>()
  for (const t of m.tokens) {
    if (t.layer === 'semantic' && t.role === 'public') covered.add(t.category)
  }
  for (const c of CATEGORIES) {
    if (!covered.has(c)) {
      out.push({
        code: 'TKN-CATEGORY-COVERAGE',
        rule: 'V-11',
        message: `Categoria "${c}" sem token semântico público (TOK-10, FR-006).`,
      })
    }
  }
}

/** V-12: escala única de alturas de controle. */
function controlScale(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    const looksControl = t.id.startsWith('size.control.')
    if (looksControl && t.scale !== 'control-height') {
      out.push({
        code: 'TKN-CONTROL-SCALE',
        rule: 'V-12',
        id: t.id,
        file: t.file,
        message: `Altura de controle "${t.id}" fora da escala única (TOK-13, FR-007).`,
      })
    }
  }
}

/** V-13: mesmas chaves semânticas públicas em todas as permutações. */
function parity(m: Model, out: Finding[]): void {
  const publicSemantic = m.tokens
    .filter((t) => t.role === 'public' && (t.layer === 'semantic' || t.layer === 'component'))
    .map((t) => t.id)
  const expected = new Set(publicSemantic)
  for (const perm of m.load.permutations) {
    const present = new Set(Object.keys(perm.set))
    for (const id of expected) {
      if (!present.has(id)) {
        out.push({
          code: 'TKN-PARITY-MISSING',
          rule: 'V-13',
          id,
          message: `Chave semântica "${id}" ausente na permutação ${perm.id} (TOK-09, FR-011).`,
        })
      }
    }
  }
}

export function validateModel(m: Model): Finding[] {
  const out: Finding[] = []
  literals(m, out)
  direction(m, out)
  naming(m, out)
  brandSource(m, out)
  colorHex(m, out)
  coverage(m, out)
  controlScale(m, out)
  parity(m, out)
  return out
}

/** Resumo de validação (cenário 4 da US1): contagem por categoria e escala de alturas. */
export function validationSummary(m: Model): {
  categories: Record<string, { primitive: number; semantic: number; component: number }>
  controlScale: string[]
} {
  const categories: Record<string, any> = {}
  for (const c of CATEGORIES) categories[c] = { primitive: 0, semantic: 0, component: 0 }
  for (const t of m.tokens) {
    const row = categories[t.category]
    if (row && row[t.layer] !== undefined) row[t.layer] += 1
  }
  const controlScale = m.tokens
    .filter((t) => t.scale === 'control-height')
    .map((t) => t.id)
    .sort()
  return { categories, controlScale }
}
