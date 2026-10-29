import { describe, it, expect } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTokens } from '../src/adapter.ts'
import { buildModel } from '../src/model.ts'
import { validateModel } from '../src/validate.ts'
import { runBuild } from '../src/build.ts'

const SRC = join(import.meta.dirname, '../../../packages/tokens/src')

// US3: adicionar uma marca altera apenas arquivos de tokens (fonte + relatório de API).
describe('adicionar marca (US3)', () => {
  it('a marca C entra só com arquivos de tokens, mantém paridade e gera brand-c.css', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'patods-src-'))
    cpSync(SRC, join(dir, 'src'), { recursive: true })
    const srcDir = join(dir, 'src')

    // 1) novo contexto de marca no resolver
    const resolverPath = join(srcDir, 'tokens.resolver.json')
    const resolver = JSON.parse(readFileSync(resolverPath, 'utf8'))
    resolver.modifiers.brand.contexts.c = [{ $ref: './semantic/brand/c.tokens.json' }]
    writeFileSync(resolverPath, JSON.stringify(resolver, null, 2))

    // 2) arquivo de tokens da marca C (reaproveita a estrutura da B)
    const bFile = readFileSync(join(srcDir, 'semantic/brand/b.tokens.json'), 'utf8')
    writeFileSync(join(srcDir, 'semantic/brand/c.tokens.json'), bFile.replace('Marca sintética B', 'Marca sintética C'))

    const model = buildModel(await loadTokens(srcDir))
    // cenário de aceite 2: paridade de chaves continua válida
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
