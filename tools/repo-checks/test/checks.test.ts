import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { scanText } from '../src/scan.ts'
import { checkLayers, checkTokenSourceEdge } from '../src/layers.ts'
import { checkTraceability } from '../src/traceability.ts'
import { checkLogicTests } from '../src/logic-tests.ts'
import { evaluateLicenses, evalLicenseExpr, type LicensePolicy } from '../src/licenses.ts'
import { runPnpm } from '../src/pnpm.ts'
import { normalizeBom, sbomFileName, parseSplit } from '../src/sbom.ts'
import { checkNamingDoc, compareVocabularies, parseDoc, DOC_PATH } from '../src/naming-doc.ts'

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

  it('forbids design-sync from reaching the token source (G-1, FR-025)', () => {
    const root = mkdtempSync(join(tmpdir(), 'patods-g1-'))
    const write = (rel: string, body: string) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true })
      writeFileSync(join(root, rel), body)
    }
    write('tools/design-sync/src/a.ts', "import x from '@patods/tokens/src/index.ts'\nconst p = 'packages/tokens/src/color.ts'\n")
    const codes = checkTokenSourceEdge(root).map((f) => f.code)
    expect(codes).toContain('ENG01-SUBPATH-NOT-ALLOWED')
    expect(codes).toContain('ENG01-TOKEN-SOURCE-REFERENCE')
  })

  it('allows design-sync to import the manifest via ./meta/* and ignores prose in comments', () => {
    const root = mkdtempSync(join(tmpdir(), 'patods-g1-ok-'))
    mkdirSync(join(root, 'tools/design-sync/src'), { recursive: true })
    writeFileSync(join(root, 'tools/design-sync/src/a.ts'), "// never touch packages/tokens/src\nimport m from '@patods/tokens/meta/sync-manifest.json'\n")
    expect(checkTokenSourceEdge(root)).toEqual([])
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

describe('checkNamingDoc (TOK-04)', () => {
  const root = join(import.meta.dirname, '../../..')
  const docText = () => readFileSync(join(root, DOC_PATH), 'utf8')
  const load = async () => (await import('../../tokens-build/src/vocabulary.ts')) as unknown as Parameters<typeof compareVocabularies>[1]

  it('the real document matches the validator vocabularies exactly', async () => {
    expect(await checkNamingDoc(root)).toEqual([])
  })

  it('parses flat and keyed blocks', () => {
    const { blocks } = parseDoc('<!-- vocab:a -->\n`x`, `y`\n<!-- /vocab:a -->\n<!-- vocab:b -->\n| K | V |\n| --- | --- |\n| `k` | `p`, `q` |\n<!-- /vocab:b -->')
    expect(blocks.get('a')).toEqual(['x', 'y'])
    expect(blocks.get('b')).toEqual({ k: ['p', 'q'] })
  })

  it('flags a word documented but absent from the validator', async () => {
    const text = docText().replace('`default`, `hover`, `active`', '`default`, `hover`, `bogus`, `active`')
    const codes = compareVocabularies(text, await load()).map((f) => f.code)
    expect(codes).toContain('TOK04-NOT-IN-VALIDATOR')
  })

  it('flags a validator word missing from the document', async () => {
    const text = docText().replace('`full`, `none`', '`full`')
    const f = compareVocabularies(text, await load())
    expect(f.map((x) => x.code)).toContain('TOK04-NOT-DOCUMENTED')
  })

  it('flags a wrong SZ order and a missing role', async () => {
    const sz = docText().replace('`xs` < `sm`', '`sm` < `xs`')
    expect(compareVocabularies(sz, await load()).map((f) => f.code)).toContain('TOK04-ORDER')
    const roles = docText().replace('`scrim`, `backdrop`', '`scrim`')
    expect(compareVocabularies(roles, await load()).map((f) => f.code)).toContain('TOK04-NOT-DOCUMENTED')
  })

  it('flags a removed block and an absent document', async () => {
    const text = docText().replace(/<!-- vocab:states -->[\s\S]*?<!-- \/vocab:states -->/, '')
    expect(compareVocabularies(text, await load()).map((f) => f.code)).toContain('TOK04-BLOCK-MISSING')
    const empty = mkdtempSync(join(tmpdir(), 'patods-naming-'))
    expect((await checkNamingDoc(empty)).map((f) => f.code)).toEqual(['TOK04-DOC-ABSENT'])
  })
})

describe('evaluateLicenses (ENG-21)', () => {
  const policy: LicensePolicy = {
    allowed: ['MIT', 'Apache-2.0'],
    allowedDevOnly: ['MPL-2.0'],
    aliases: { 'MIT License': 'MIT' },
    overrides: { legacy: { license: 'MIT', reason: 'reviewed' } },
  }
  const pkg = (name: string) => ({ name, versions: ['1.0.0'] })

  it('accepts allowed licenses, aliases and overrides', () => {
    const report = { MIT: [pkg('a')], 'MIT License': [pkg('b')], 'GPL-3.0': [pkg('legacy')] }
    expect(evaluateLicenses(report, report, policy)).toEqual([])
  })

  it('flags a license outside the allowlist with a per-package message', () => {
    const f = evaluateLicenses({ 'GPL-3.0': [pkg('bad')] }, { 'GPL-3.0': [pkg('bad')] }, policy)
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ code: 'ENG21-NOT-ALLOWED', pkg: 'bad@1.0.0' })
    expect(f[0]!.message).toContain('GPL-3.0')
  })

  it('flags an unknown license', () => {
    expect(evaluateLicenses({ Unknown: [pkg('x')] }, {}, policy).map((f) => f.code)).toEqual(['ENG21-UNKNOWN'])
  })

  it('allows a dev-only license for a dev package but not for a production one', () => {
    const report = { 'MPL-2.0': [pkg('axe')] }
    expect(evaluateLicenses(report, {}, policy)).toEqual([])
    expect(evaluateLicenses(report, report, policy).map((f) => f.code)).toEqual(['ENG21-DEV-ONLY-IN-PROD'])
  })

  it('handles SPDX OR and AND expressions', () => {
    const r = { '(MIT OR GPL-3.0)': [pkg('or')], '(MIT AND GPL-3.0)': [pkg('and')] }
    expect(evaluateLicenses(r, r, policy).map((f) => f.pkg)).toEqual(['and@1.0.0'])
  })

  it('flags a forbidden license behind a parenthesised OR (AND binds tighter than OR)', () => {
    const r = { '(MIT OR GPL-3.0) AND LicenseRef-Proprietary': [pkg('sneaky')] }
    const f = evaluateLicenses(r, r, policy)
    expect(f.map((x) => x.code)).toEqual(['ENG21-NOT-ALLOWED'])
    expect(f[0]!.pkg).toBe('sneaky@1.0.0')
  })

  it('respects precedence and grouping in evalLicenseExpr', () => {
    const ok = (a: string) => a === 'MIT' || a === 'ISC'
    expect(evalLicenseExpr('MIT OR GPL AND GPL', ok)).toBe(true) // MIT OR (GPL AND GPL)
    expect(evalLicenseExpr('GPL AND GPL OR ISC', ok)).toBe(true)
    expect(evalLicenseExpr('(MIT OR GPL) AND GPL', ok)).toBe(false)
    expect(evalLicenseExpr('(MIT OR GPL) AND (ISC OR X)', ok)).toBe(true)
    expect(evalLicenseExpr('MIT AND (GPL OR (ISC AND GPL))', ok)).toBe(false)
    expect(evalLicenseExpr('MIT License', (a) => a === 'MIT License')).toBe(true)
  })

  it('never accepts a malformed expression', () => {
    expect(evalLicenseExpr('(MIT', () => true)).toBe(false)
    expect(evalLicenseExpr('MIT AND', () => true)).toBe(false)
    expect(evalLicenseExpr('', () => true)).toBe(false)
    expect(evalLicenseExpr('MIT) OR MIT', () => true)).toBe(false)
  })
})

describe('SBOM normalisation (ENG-19)', () => {
  const bom = {
    serialNumber: 'urn:uuid:1',
    metadata: { timestamp: 'now', component: { name: 'repo-checks', group: '@patods' } },
    components: [{ 'bom-ref': 'b' }, { 'bom-ref': 'a' }],
    dependencies: [{ ref: 'b', dependsOn: ['z', 'y'] }, { ref: 'a' }],
  }

  it('drops per-run fields and sorts so two runs are byte-identical', () => {
    const other = { ...bom, serialNumber: 'urn:uuid:2', metadata: { ...bom.metadata, timestamp: 'later' }, components: [...bom.components].reverse() }
    const a = JSON.stringify(normalizeBom(bom))
    expect(a).toBe(JSON.stringify(normalizeBom(other)))
    expect(a).not.toContain('serialNumber')
    expect(a).not.toContain('timestamp')
    expect((normalizeBom(bom).components as { 'bom-ref': string }[]).map((c) => c['bom-ref'])).toEqual(['a', 'b'])
    expect((normalizeBom(bom).dependencies as { ref: string }[])[1]).toEqual({ ref: 'b', dependsOn: ['y', 'z'] })
  })

  it('derives a stable file name and parses NDJSON', () => {
    expect(sbomFileName(bom)).toBe('patods-repo-checks.cdx.json')
    expect(sbomFileName({})).toBeUndefined()
    expect(parseSplit('{"a":1}\n\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }])
  })
})

describe('runPnpm', () => {
  it('runs the workspace package manager and returns its stdout', () => {
    const root = join(import.meta.dirname, '../../..')
    expect(runPnpm(root, ['--version']).trim()).toMatch(/^\d+\.\d+\.\d+/)
  })
})
