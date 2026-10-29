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

// Modelo-base válido mínimo cobrindo as 11 categorias com um semântico público cada.
const CATS = ['color', 'typography', 'space', 'size', 'radius', 'border', 'shadow', 'motion', 'z-index', 'breakpoint', 'opacity']
function validBase(): ModelToken[] {
  return CATS.map((c) => tok({ id: `${c}.ok`, category: c, layer: 'semantic', role: 'public', hasAlias: true }))
}

describe('validateModel', () => {
  it('modelo válido não gera findings', () => {
    expect(validateModel(model(validBase()))).toEqual([])
  })

  it('V-02: literal fora da camada primitiva', () => {
    const m = model([...validBase(), tok({ id: 'color.bad', layer: 'semantic', hasAlias: false })])
    expect(codes(validateModel(m))).toContain('TKN-LITERAL-OUTSIDE-PRIMITIVE')
  })

  it('V-04: direção de referência proibida (primitivo → semântico)', () => {
    const prim = tok({ id: 'color.p', layer: 'primitive', axis: 'invariant', hasAlias: false, raw: { dependencies: ['color.ok'] } })
    const m = model([...validBase(), prim])
    expect(codes(validateModel(m))).toContain('TKN-LAYER-DIRECTION')
  })

  it('V-06: categoria desconhecida e segmento fora do padrão', () => {
    const m = model([...validBase(), tok({ id: 'Foo.Bar', category: 'Foo' })])
    const c = codes(validateModel(m))
    expect(c).toContain('TKN-NAME-CATEGORY')
    expect(c).toContain('TKN-NAME-SEGMENT')
  })

  it('V-06: colisão de nome CSS', () => {
    const m = model([...validBase(), tok({ id: 'color.ok', category: 'color' })]) // duplica color.ok
    expect(codes(validateModel(m))).toContain('TKN-NAME-COLLISION')
  })

  it('V-08: brand-mode-source fora da forma', () => {
    const m = model([...validBase(), tok({ id: 'brand.color.bg.surface.sepia', category: 'color', role: 'brand-mode-source', axis: 'brand' })])
    expect(codes(validateModel(m))).toContain('TKN-BRAND-SOURCE-MODE')
  })

  it('V-10: hex diverge dos componentes', () => {
    const bad = tok({ id: 'color.white', layer: 'primitive', type: 'color', hasAlias: false, raw: { $value: { colorSpace: 'srgb', components: [1, 1, 1], hex: '#000000' } } })
    expect(codes(validateModel(model([...validBase(), bad])))).toContain('TKN-COLOR-HEX-MISMATCH')
  })

  it('V-11: categoria sem semântico público', () => {
    const missing = validBase().filter((t) => t.category !== 'opacity')
    expect(codes(validateModel(model(missing)))).toContain('TKN-CATEGORY-COVERAGE')
  })

  it('V-12: altura de controle fora da escala', () => {
    const m = model([...validBase(), tok({ id: 'size.control.xl', category: 'size', scale: undefined })])
    expect(codes(validateModel(m))).toContain('TKN-CONTROL-SCALE')
  })

  it('V-13: chave semântica ausente numa permutação', () => {
    const base = validBase()
    const m = model(base)
    m.load.permutations[0]!.set = {} // remove todas as chaves da permutação
    expect(codes(validateModel(m))).toContain('TKN-PARITY-MISSING')
  })
})
