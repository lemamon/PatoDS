import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
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

  it('blocks a forbidden edge: an app depending on a tokens package in production', async () => {
    // Synthetic workspace: apps/ (apps layer) may only depend on apps in production, so a production
    // dependency on a tokens-layer package is the forbidden edge the gate must catch (T021/T023).
    const root = mkdtempSync(join(tmpdir(), 'patods-layers-'))
    const write = (rel: string, json: unknown) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true })
      writeFileSync(join(root, rel), JSON.stringify(json))
    }
    write('packages/ui/package.json', { name: '@x/ui' })
    write('apps/demo/package.json', { name: '@x/demo', dependencies: { '@x/ui': '*' } })
    const findings = await checkLayers(root)
    expect(findings.map((f) => f.code)).toContain('ENG01-FORBIDDEN-EDGE')
  })
})
