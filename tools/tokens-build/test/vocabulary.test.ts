import { describe, it, expect } from 'vitest'
import { CATEGORIES, SZ, STATES, VARIANTS, ROLES, SZ_REF, SEMANTIC_PROPERTIES, COMPONENT_PROPERTIES, VOCABULARIES, MODE_IDS } from '../src/vocabulary.ts'

describe('naming vocabularies (token-source.md section 8.4)', () => {
  it('SZ is the ordered size scale', () => {
    expect([...SZ]).toEqual(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'])
  })
  it('states and variants are disjoint and contain no duplicates', () => {
    expect(STATES.filter((s) => (VARIANTS as readonly string[]).includes(s))).toEqual([])
    expect(new Set(STATES).size).toBe(STATES.length)
    expect(new Set(VARIANTS).size).toBe(VARIANTS.length)
  })
  it('variants include every SZ word', () => {
    for (const w of SZ) expect(VARIANTS).toContain(w)
  })
  it('every word is a valid segment', () => {
    const seg = /^[a-z0-9]+(-[a-z0-9]+)*$/
    const words = [...CATEGORIES, ...STATES, ...VARIANTS, ...MODE_IDS, ...Object.values(ROLES).flat().filter((w) => w !== SZ_REF)]
    for (const w of words) expect(seg.test(w)).toBe(true)
  })
  it('properties are defined for every category in both layers', () => {
    for (const c of CATEGORIES) {
      expect(SEMANTIC_PROPERTIES[c]).toBeDefined()
      expect(COMPONENT_PROPERTIES[c]).toBeDefined()
    }
  })
  it('the registry exposes the blocks the document must carry', () => {
    expect(Object.keys(VOCABULARIES).sort()).toEqual(
      ['categories', 'component-properties', 'mode-ids', 'reserved-component-ids', 'reserved-groups', 'roles', 'segment-pattern', 'semantic-properties', 'states', 'step-words', 'sz', 'variants'].sort(),
    )
  })
})
