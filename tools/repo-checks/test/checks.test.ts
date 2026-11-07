import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { scanText } from '../src/scan.ts'
import { checkLayers } from '../src/layers.ts'
import { checkTraceability } from '../src/traceability.ts'
import { checkLogicTests } from '../src/logic-tests.ts'

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

describe('checkTraceability (ACE-02)', () => {
  it('the real matrix maps every met id to an existing check', () => {
    const root = join(import.meta.dirname, '../../..')
    expect(checkTraceability(root)).toEqual([])
  })

  it('blocks a met id that names a nonexistent check', () => {
    const root = mkdtempSync(join(tmpdir(), 'patods-trace-'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { 'tokens:validate': 'turbo run tokens:validate' } }))
    mkdirSync(join(root, 'quality'), { recursive: true })
    writeFileSync(
      join(root, 'quality/traceability.json'),
      JSON.stringify({
        format: 'patods.traceability',
        version: 1,
        entries: [
          { id: 'FR-001', status: 'met', check: 'tokens:validate' },
          { id: 'FR-999', status: 'met', check: 'check:does-not-exist' },
        ],
      }),
    )
    const findings = checkTraceability(root)
    expect(findings.map((f) => f.code)).toContain('TRACE-CHECK-MISSING')
    expect(findings.find((f) => f.code === 'TRACE-CHECK-MISSING')?.id).toBe('FR-999')
  })

  it('blocks a met id with neither check nor evidence, and a duplicate id', () => {
    const root = mkdtempSync(join(tmpdir(), 'patods-trace-'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: {} }))
    mkdirSync(join(root, 'quality'), { recursive: true })
    writeFileSync(
      join(root, 'quality/traceability.json'),
      JSON.stringify({
        format: 'patods.traceability',
        version: 1,
        entries: [
          { id: 'FR-001', status: 'met' },
          { id: 'FR-001', status: 'planned', task: 'T001' },
        ],
      }),
    )
    const codes = checkTraceability(root).map((f) => f.code)
    expect(codes).toContain('TRACE-MET-NO-CHECK')
    expect(codes).toContain('TRACE-DUPLICATE')
  })
})

describe('checkLogicTests (QA-02)', () => {
  const synth = (importsFoo: boolean): string => {
    const root = mkdtempSync(join(tmpdir(), 'patods-logic-'))
    mkdirSync(join(root, 'tools/x/src'), { recursive: true })
    mkdirSync(join(root, 'tools/x/test'), { recursive: true })
    writeFileSync(join(root, 'tools/x/src/foo.ts'), 'export function f() { return 1 }\n')
    writeFileSync(join(root, 'tools/x/test/foo.test.ts'), importsFoo ? "import { f } from '../src/foo.ts'\n" : '// no import\n')
    return root
  }

  it('the real repository has every runtime module imported by a test', () => {
    expect(checkLogicTests(join(import.meta.dirname, '../../..'))).toEqual([])
  })

  it('flags a runtime module no test imports', () => {
    expect(checkLogicTests(synth(false)).map((f) => f.code)).toContain('QA02-UNTESTED-MODULE')
  })

  it('passes when a test imports the module', () => {
    expect(checkLogicTests(synth(true))).toEqual([])
  })
})
