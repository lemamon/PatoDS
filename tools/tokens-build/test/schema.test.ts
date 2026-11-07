import { describe, it, expect } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateSchema } from '../src/schema.ts'

const PKG = join(import.meta.dirname, '../../../packages/tokens')
const SRC = join(PKG, 'src')

/** Copies src + the vendored schemas into a temp package so `../schemas` resolves. */
function tmpPackage(): string {
  const dir = mkdtempSync(join(tmpdir(), 'patods-schema-'))
  cpSync(SRC, join(dir, 'src'), { recursive: true })
  cpSync(join(PKG, 'schemas'), join(dir, 'schemas'), { recursive: true })
  return join(dir, 'src')
}

describe('validateSchema (V-01, FR-002)', () => {
  it('the real source passes the vendored DTCG 2025.10 schemas', async () => {
    expect(await validateSchema(SRC)).toEqual([])
  })

  it('an invalid $type is a schema violation pointed at the token key, citing V-01', async () => {
    const srcDir = tmpPackage()
    const p = join(srcDir, 'primitive.tokens.json')
    writeFileSync(p, readFileSync(p, 'utf8').replace('"$type": "color"', '"$type": "notacolor"'))
    const findings = await validateSchema(srcDir)
    expect(findings.length).toBeGreaterThan(0)
    expect(findings.every((f) => f.code === 'TKN-SCHEMA' && f.rule === 'V-01')).toBe(true)
    const enumErr = findings.find((f) => f.message.includes('$type') && f.message.includes('allowed values'))
    expect(enumErr).toBeDefined()
    expect(enumErr!.file).toBe('src/primitive.tokens.json')
    expect(typeof enumErr!.line).toBe('number')
    expect(typeof enumErr!.column).toBe('number')
  })

  it('a malformed resolver (missing resolutionOrder) fails the resolver schema', async () => {
    const srcDir = tmpPackage()
    const rp = join(srcDir, 'tokens.resolver.json')
    const r = JSON.parse(readFileSync(rp, 'utf8'))
    delete r.resolutionOrder
    writeFileSync(rp, JSON.stringify(r, null, 2))
    const findings = await validateSchema(srcDir)
    expect(findings.some((f) => f.code === 'TKN-SCHEMA' && f.file === 'src/tokens.resolver.json' && f.message.includes('resolutionOrder'))).toBe(true)
  })

  it('reports a clear finding when the vendored schemas are absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'patods-schema-noschemas-'))
    cpSync(SRC, join(dir, 'src'), { recursive: true })
    const findings = await validateSchema(join(dir, 'src'))
    expect(findings.map((f) => f.code)).toContain('TKN-SCHEMA-MISSING')
  })
})
