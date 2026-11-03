import { describe, it, expect } from 'vitest'
import { validateModel, type Finding } from '../src/validate.ts'
import type { Model, ModelToken } from '../src/model.ts'

function tok(p: Partial<ModelToken> & { id: string }): ModelToken {
  const segments = p.id.split('.')
  return {
    id: p.id,
    segments,
    cssName: `--patods-${segments.join('-')}`,
    category: p.category ?? segments[0]!,
    layer: p.layer ?? 'semantic',
    axis: p.axis ?? 'invariant',
    role: p.role ?? 'public',
    placement: p.placement ?? 'base',
    type: p.type ?? 'color',
    scale: p.scale,
    deprecated: p.deprecated ?? false,
    description: p.description,
    file: p.file ?? 'semantic/invariant.tokens.json',
    aliasOf: p.aliasOf,
    aliasChain: p.aliasChain,
    hasAlias: p.hasAlias ?? true,
    directRefs: p.directRefs ?? [],
    raw: p.raw ?? {},
  }
}

function model(tokens: ModelToken[], permIds: string[] = ['a/light']): Model {
  const byId = new Map(tokens.map((t) => [t.id, t]))
  const perms = permIds.map((id) => ({
    id,
    input: {},
    set: Object.fromEntries(
      tokens.filter((t) => t.role === 'public' && t.layer !== 'primitive').map((t) => [t.id, {}]),
    ),
  }))
  return { tokens, byId, load: { tokens: {}, resolver: {}, permutations: perms, decl: new Map() } as any }
}

const codes = (f: Finding[]) => f.map((x) => x.code)

// Minimal valid base model covering the 11 categories with one public semantic token each.
const CATS = ['color', 'typography', 'space', 'size', 'radius', 'border', 'shadow', 'motion', 'z-index', 'breakpoint', 'opacity']
function validBase(): ModelToken[] {
  return CATS.map((c) => tok({ id: `${c}.ok`, category: c, layer: 'semantic', role: 'public', hasAlias: true }))
}

describe('validateModel', () => {
  it('valid model generates no findings', () => {
    expect(validateModel(model(validBase()))).toEqual([])
  })

  it('V-02: literal outside the primitive layer', () => {
    const m = model([...validBase(), tok({ id: 'color.bad', layer: 'semantic', hasAlias: false })])
    expect(codes(validateModel(m))).toContain('TKN-LITERAL-OUTSIDE-PRIMITIVE')
  })

  it('V-04: forbidden reference direction (primitive → semantic, over the direct alias)', () => {
    const prim = tok({ id: 'color.p', layer: 'primitive', axis: 'invariant', directRefs: ['color.ok'] })
    const m = model([...validBase(), prim])
    expect(codes(validateModel(m))).toContain('TKN-LAYER-DIRECTION')
  })

  it('V-06: unknown category and nonstandard segment', () => {
    const m = model([...validBase(), tok({ id: 'Foo.Bar', category: 'Foo' })])
    const c = codes(validateModel(m))
    expect(c).toContain('TKN-NAME-CATEGORY')
    expect(c).toContain('TKN-NAME-SEGMENT')
  })

  it('V-06: CSS name collision', () => {
    const m = model([...validBase(), tok({ id: 'color.ok', category: 'color' })]) // duplicates color.ok
    expect(codes(validateModel(m))).toContain('TKN-NAME-COLLISION')
  })

  it('V-08: brand-mode-source outside the expected form', () => {
    const m = model([...validBase(), tok({ id: 'brand.color.bg.surface.sepia', category: 'color', role: 'brand-mode-source', axis: 'brand' })])
    expect(codes(validateModel(m))).toContain('TKN-BRAND-SOURCE-MODE')
  })

  it('V-10: hex diverges from the components', () => {
    const bad = tok({ id: 'color.white', layer: 'primitive', type: 'color', hasAlias: false, raw: { $value: { colorSpace: 'srgb', components: [1, 1, 1], hex: '#000000' } } })
    expect(codes(validateModel(model([...validBase(), bad])))).toContain('TKN-COLOR-HEX-MISMATCH')
  })

  it('V-11: category without public semantic', () => {
    const missing = validBase().filter((t) => t.category !== 'opacity')
    expect(codes(validateModel(model(missing)))).toContain('TKN-CATEGORY-COVERAGE')
  })

  it('V-12: control height outside the scale', () => {
    const m = model([...validBase(), tok({ id: 'size.control.xl', category: 'size', scale: undefined })])
    expect(codes(validateModel(m))).toContain('TKN-CONTROL-SCALE')
  })

  it('V-13: semantic key missing in a permutation', () => {
    const base = validBase()
    const m = model(base)
    m.load.permutations[0]!.set = {} // remove all keys from the permutation
    expect(codes(validateModel(m))).toContain('TKN-PARITY-MISSING')
  })

  // Source-form rules (V-05, V-07, V-09) read the source index on load, not the token list.
  type Src = Model['load']['source']
  const withSource = (src: Partial<Src>): Model => {
    const m = model(validBase())
    m.load.source = {
      occurrences: new Map(),
      bucketOf: new Map(),
      directRefs: new Map(),
      refs: [],
      roots: [],
      ...src,
    }
    return m
  }

  it('V-05: $ref outside the primitive layer', () => {
    const m = withSource({ refs: [{ id: 'color.x', file: 'semantic/invariant.tokens.json', bucket: 'invariant', value: '#/color/blue/500' }] })
    expect(codes(validateModel(m))).toContain('TKN-REF-OUTSIDE-PRIMITIVE')
  })

  it('V-05: a remote $ref inside the primitive layer', () => {
    const m = withSource({ refs: [{ id: 'color.x', file: 'primitive.tokens.json', bucket: 'primitive', value: 'https://example.com/x.json#/a' }] })
    expect(codes(validateModel(m))).toContain('TKN-REF-NOT-LOCAL')
  })

  it('V-05: a local $ref inside the primitive layer is allowed', () => {
    const m = withSource({ refs: [{ id: 'color.x', file: 'primitive.tokens.json', bucket: 'primitive', value: '#/color/blue/500' }] })
    expect(codes(validateModel(m))).not.toContain('TKN-REF-OUTSIDE-PRIMITIVE')
    expect(codes(validateModel(m))).not.toContain('TKN-REF-NOT-LOCAL')
  })

  it('V-05: $root is forbidden', () => {
    const m = withSource({ roots: [{ file: 'semantic/invariant.tokens.json', path: 'color' }] })
    expect(codes(validateModel(m))).toContain('TKN-ROOT-FORBIDDEN')
  })

  it('V-07/V-09: a path in a shared set and another set is a duplicate', () => {
    const m = withSource({
      occurrences: new Map([
        ['color.dup', [
          { file: 'semantic/invariant.tokens.json', bucket: 'invariant' },
          { file: 'component/component.tokens.json', bucket: 'component' },
        ]],
      ]),
    })
    expect(codes(validateModel(m))).toContain('TKN-PATH-DUPLICATE')
  })

  it('V-07/V-09: a path repeated across brand files is not a duplicate', () => {
    const m = withSource({
      occurrences: new Map([
        ['brand.color.x.light', [
          { file: 'semantic/brand/a.tokens.json', bucket: 'brand' },
          { file: 'semantic/brand/b.tokens.json', bucket: 'brand' },
        ]],
      ]),
    })
    expect(codes(validateModel(m))).not.toContain('TKN-PATH-DUPLICATE')
  })

  it('V-07: an invariant token depending on a mode axis (AX-1)', () => {
    const m = withSource({
      bucketOf: new Map([['color.inv', 'invariant'], ['color.m', 'mode']]),
      directRefs: new Map([['color.inv', ['color.m']]]),
    })
    expect(codes(validateModel(m))).toContain('TKN-AXIS-DEPENDENCY')
  })

  it('V-07: a brand token depending on a mode axis (AX-2)', () => {
    const m = withSource({
      bucketOf: new Map([['brand.color.x.light', 'brand'], ['color.m', 'mode']]),
      directRefs: new Map([['brand.color.x.light', ['color.m']]]),
    })
    expect(codes(validateModel(m))).toContain('TKN-AXIS-DEPENDENCY')
  })

  it('V-07: a mode token depending on a brand axis is allowed (AX-3 form)', () => {
    const m = withSource({
      bucketOf: new Map([['color.m', 'mode'], ['brand.color.x.light', 'brand']]),
      directRefs: new Map([['color.m', ['brand.color.x.light']]]),
    })
    expect(codes(validateModel(m))).not.toContain('TKN-AXIS-DEPENDENCY')
  })
})
