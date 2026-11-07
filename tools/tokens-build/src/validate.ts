// Token source validators (US1). Rules V-01..V-13 from the data model, in one sectioned module.
// V-01 (DTCG schema) and V-03 (alias/cycle) are enforced by the parser in the adapter, which fails
// before reaching here.
import { CATEGORIES, type Model, type ModelToken } from './model.ts'

export interface Finding {
  code: string
  rule: string
  id?: string
  file?: string
  /** 1-based line in `file` (generated-CSS lint reports a position per css-output.md §13). */
  line?: number
  /** 1-based column in `file`, when known. */
  column?: number
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

/** V-02: literals only in the primitive layer. */
function literals(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    if (t.layer !== 'primitive' && !t.hasAlias) {
      out.push({
        code: 'TKN-LITERAL-OUTSIDE-PRIMITIVE',
        rule: 'V-02',
        id: t.id,
        file: t.file,
        message: `Token ${t.layer} "${t.id}" has a literal value; only the primitive layer may (TOK-02, FR-003).`,
      })
    }
  }
}

const LAYER_ALLOWED: Record<string, Set<string>> = {
  primitive: new Set(['primitive']),
  semantic: new Set(['primitive', 'semantic']),
  component: new Set(['primitive', 'semantic', 'component']),
}

/** V-04: cross-layer reference direction, over the DIRECT alias target (not the resolved leaf).
 * A primitive aliasing a semantic token is forbidden even though the leaf is a primitive. */
function direction(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    for (const ref of t.directRefs) {
      const d = m.byId.get(ref)
      if (!d) continue
      if (!LAYER_ALLOWED[t.layer]?.has(d.layer)) {
        out.push({
          code: 'TKN-LAYER-DIRECTION',
          rule: 'V-04',
          id: t.id,
          file: t.file,
          message: `Token ${t.layer} "${t.id}" references ${d.layer} "${ref}"; forbidden direction (TOK-02, FR-004).`,
        })
      }
    }
  }
}

/** V-05: `$ref` only in the primitive layer and local; `$root` forbidden anywhere.
 * (`$extends` in the object form is rejected earlier by the parser, like V-01/V-03.) */
function refForm(m: Model, out: Finding[]): void {
  const src = m.load.source
  if (!src) return
  for (const r of src.refs) {
    if (r.bucket !== 'primitive') {
      out.push({
        code: 'TKN-REF-OUTSIDE-PRIMITIVE',
        rule: 'V-05',
        id: r.id,
        file: r.file,
        message: `"$ref" is accepted only in the primitive layer; "${r.id}" uses it in ${r.bucket} (FR-003, FR-004).`,
      })
      continue
    }
    // Inside the primitive layer: must be a local fragment or a relative path under src/primitive/.
    const v = r.value.trim()
    const local = v.startsWith('#') || (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.startsWith('/') && !v.includes('..'))
    if (!local) {
      out.push({
        code: 'TKN-REF-NOT-LOCAL',
        rule: 'V-05',
        id: r.id,
        file: r.file,
        message: `"$ref" "${r.value}" in "${r.id}" is remote or outside src/primitive/ (FR-002).`,
      })
    }
  }
  for (const root of src.roots) {
    out.push({
      code: 'TKN-ROOT-FORBIDDEN',
      rule: 'V-05',
      file: root.file,
      message: `"$root" is forbidden (path "${root.path || '(top level)'}"); it detaches the CSS name from the token path (FR-005).`,
    })
  }
}

const SHARED_BUCKETS = new Set(['primitive', 'invariant', 'component'])

/** Which variation class an occurrence belongs to: each shared file is its own class, while all brand
 * files share one class and both mode files another (a path MAY repeat within one modifier). */
function variationClass(file: string, bucket: string): string {
  if (bucket === 'brand') return 'brand'
  if (bucket === 'mode') return 'mode'
  return `shared:${file}`
}

/** V-07/V-09: axis by location. A path defined in more than one variation class (a shared set and a
 * context, both modifiers, or two shared files) carries an axis value it must not, or is duplicated. */
function pathDuplicate(m: Model, out: Finding[]): void {
  const src = m.load.source
  if (!src) return
  for (const [id, occs] of src.occurrences) {
    const classes = new Set(occs.map((o) => variationClass(o.file, o.bucket)))
    if (classes.size > 1) {
      out.push({
        code: 'TKN-PATH-DUPLICATE',
        rule: 'V-07',
        id,
        file: occs[0]!.file,
        message: `Path "${id}" is defined in more than one place (${occs
          .map((o) => o.file)
          .join(', ')}); shared sets carry no axis value and a path belongs to one modifier (V-09, TOK-09, FR-011).`,
      })
    }
  }
}

/** Transitive axis reach of a token over its direct aliases: the axes (brand/mode) its dependency
 * graph touches. Cycle-safe via the in-progress marker in `memo`. */
function axisReach(id: string, src: NonNullable<Model['load']['source']>, memo: Map<string, Set<string>>): Set<string> {
  const cached = memo.get(id)
  if (cached) return cached
  const acc = new Set<string>()
  memo.set(id, acc) // cycle guard: a token in progress contributes nothing yet
  for (const target of src.directRefs.get(id) ?? []) {
    const b = src.bucketOf.get(target)
    if (b === 'brand') acc.add('brand')
    if (b === 'mode') acc.add('mode')
    for (const a of axisReach(target, src, memo)) acc.add(a)
  }
  return acc
}

/** V-07 (axis dependency, section 7.2): an invariant token must not depend on any axis (AX-1); a brand
 * token must not depend on mode (AX-2). The mode→brand form of section 7.3 (AX-3) is a V-08 concern. */
function axisDependency(m: Model, out: Finding[]): void {
  const src = m.load.source
  if (!src) return
  const memo = new Map<string, Set<string>>()
  for (const [id, bucket] of src.bucketOf) {
    const reach = axisReach(id, src, memo)
    if (bucket === 'invariant' && reach.size > 0) {
      out.push({
        code: 'TKN-AXIS-DEPENDENCY',
        rule: 'V-07',
        id,
        file: src.occurrences.get(id)?.[0]?.file,
        message: `Invariant token "${id}" depends on the ${[...reach].sort().join('/')} axis; invariant tokens must be axis-free (AX-1, FR-011).`,
      })
    } else if (bucket === 'brand' && reach.has('mode')) {
      out.push({
        code: 'TKN-AXIS-DEPENDENCY',
        rule: 'V-07',
        id,
        file: src.occurrences.get(id)?.[0]?.file,
        message: `Brand token "${id}" depends on the mode axis; a brand scope must not freeze a mode (AX-2, FR-012).`,
      })
    }
  }
}

/** V-06: naming (kebab ASCII segments, known category, unique CSS name). */
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
          message: `Segment "${s}" in "${t.id}" outside the lowercase ASCII kebab pattern (TOK-04, FR-005).`,
        })
      }
    }
    if (!(CATEGORIES as readonly string[]).includes(t.category)) {
      out.push({
        code: 'TKN-NAME-CATEGORY',
        rule: 'V-06',
        id: t.id,
        file: t.file,
        message: `First segment "${t.category}" of "${t.id}" is not a TOK-10 category (FR-005, FR-006).`,
      })
    }
    const prev = byCss.get(t.cssName)
    if (prev) {
      out.push({
        code: 'TKN-NAME-COLLISION',
        rule: 'V-06',
        id: t.id,
        file: t.file,
        message: `CSS name "${t.cssName}" collides between "${prev}" and "${t.id}" (FR-005).`,
      })
    } else byCss.set(t.cssName, t.id)
  }
}

/** V-07/V-08: brand.* group form (brand-mode-source role). */
function brandSource(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    const underBrand = t.id.startsWith('brand.')
    if (underBrand !== (t.role === 'brand-mode-source')) {
      out.push({
        code: 'TKN-BRAND-SOURCE-FORM',
        rule: 'V-08',
        id: t.id,
        file: t.file,
        message: `Token "${t.id}": reserved group "brand." and role brand-mode-source must match (FR-033).`,
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
          message: `Token brand-mode-source "${t.id}" must end in a mode id (${[...MODE_IDS].join(', ')}) (FR-033).`,
        })
      }
    }
  }
}

/** V-10: a supplied in-gamut hex must match the 8-bit quantization of the components. */
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
        message: `Token "${t.id}": hex ${v.hex} diverges from the components (expected ${expected}) (FR-015).`,
      })
    }
  }
}

/** V-11: each category has at least one public semantic token. */
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
        message: `Category "${c}" without a public semantic token (TOK-10, FR-006).`,
      })
    }
  }
}

/** V-12: single control-height scale. */
function controlScale(m: Model, out: Finding[]): void {
  for (const t of m.tokens) {
    const looksControl = t.id.startsWith('size.control.')
    if (looksControl && t.scale !== 'control-height') {
      out.push({
        code: 'TKN-CONTROL-SCALE',
        rule: 'V-12',
        id: t.id,
        file: t.file,
        message: `Control height "${t.id}" outside the single scale (TOK-13, FR-007).`,
      })
    }
  }
}

/** V-13: same public semantic keys across all permutations. */
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
          message: `Semantic key "${id}" missing in permutation ${perm.id} (TOK-09, FR-011).`,
        })
      }
    }
  }
}

export function validateModel(m: Model): Finding[] {
  const out: Finding[] = []
  literals(m, out)
  direction(m, out)
  refForm(m, out)
  pathDuplicate(m, out)
  axisDependency(m, out)
  naming(m, out)
  brandSource(m, out)
  colorHex(m, out)
  coverage(m, out)
  controlScale(m, out)
  parity(m, out)
  // T017: every token-scoped finding carries the token's source position (id -> file:line:column).
  for (const f of out) {
    if (!f.id || f.line !== undefined) continue
    const t = m.byId.get(f.id)
    if (!t) continue
    f.file ??= t.file
    f.line = t.sourceLine
    f.column = t.sourceColumn
  }
  return out
}

/** Validation summary (US1 scenario 4): per-category counts and control-height scale. */
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
