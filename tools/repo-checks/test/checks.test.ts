import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanText } from '../src/scan.ts'
import { checkLayers } from '../src/layers.ts'

const fx = (n: string) => readFileSync(join(import.meta.dirname, '../fixtures', n), 'utf8')

describe('scanText (FR-001)', () => {
  it('detects custom property --patods-* in CSS', () => {
    expect(scanText('fixtures/bad.css', fx('bad.css')).map((f) => f.code)).toContain('FR001-CSS-VAR-DECL')
  })
  it('detects in <style> of a Vue SFC', () => {
    expect(scanText('fixtures/bad.vue', fx('bad.vue')).map((f) => f.code)).toContain('FR001-CSS-VAR-DECL')
  })
  it('detects setProperty in TSX', () => {
    expect(scanText('fixtures/bad.tsx', fx('bad.tsx')).map((f) => f.code)).toContain('FR001-SETPROPERTY')
  })
  it('detects .tokens.json outside the source', () => {
    expect(scanText('fixtures/stray.tokens.json', fx('stray.tokens.json')).map((f) => f.code)).toContain('FR001-DTCG-OUTSIDE-SOURCE')
  })
  it('does not flag valid usage var(--patods-*)', () => {
    expect(scanText('fixtures/ok.css', fx('ok.css'))).toEqual([])
  })
})

describe('checkLayers (ENG-01)', () => {
  it('the real repository has no forbidden layer edge', async () => {
    const root = join(import.meta.dirname, '../../..')
    expect(await checkLayers(root)).toEqual([])
  })
})
