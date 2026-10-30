import { describe, it, expect } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTokens } from '../src/adapter.ts'
import { buildModel } from '../src/model.ts'
import { validateModel } from '../src/validate.ts'
import { runBuild } from '../src/build.ts'

const SRC = join(import.meta.dirname, '../../../packages/tokens/src')

// US3: adding a brand only touches token files (source + API report).
describe('add brand (US3)', () => {
  it('brand C enters with only token files, keeps parity and generates brand-c.css', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'patods-src-'))
    cpSync(SRC, join(dir, 'src'), { recursive: true })
    const srcDir = join(dir, 'src')

    // 1) new brand context in the resolver
    const resolverPath = join(srcDir, 'tokens.resolver.json')
    const resolver = JSON.parse(readFileSync(resolverPath, 'utf8'))
    resolver.modifiers.brand.contexts.c = [{ $ref: './semantic/brand/c.tokens.json' }]
    writeFileSync(resolverPath, JSON.stringify(resolver, null, 2))

    // 2) brand C token file (reuses brand B's structure)
    const bFile = readFileSync(join(srcDir, 'semantic/brand/b.tokens.json'), 'utf8')
    writeFileSync(join(srcDir, 'semantic/brand/c.tokens.json'), bFile.replace('Synthetic brand B', 'Synthetic brand C'))

    const model = buildModel(await loadTokens(srcDir))
    // acceptance scenario 2: key parity still holds
    expect(validateModel(model)).toEqual([])

    await runBuild(model, srcDir)
    const brandC = readFileSync(join(dir, 'dist/css/brand-c.css'), 'utf8')
    expect(brandC).toContain('[data-patods-brand="c"]')
    expect(brandC).not.toContain(':where(:root)')

    const values = JSON.parse(
      readFileSync(join(dir, 'dist/esm/values.js'), 'utf8').replace(/^[^{]*/, '').replace(/\)\s*$/, ''),
    )
    expect(Object.keys(values)).toContain('c')
  })
})
