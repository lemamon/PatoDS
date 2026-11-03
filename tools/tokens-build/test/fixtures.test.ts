import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { mkdtempSync, cpSync, mkdirSync, copyFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { loadTokens } from '../src/adapter.ts'
import { buildModel } from '../src/model.ts'
import { validateModel } from '../src/validate.ts'

// US1 fixtures (T024/T025). `valid/` is a full, self-contained valid source; each `invalid/<case>/`
// is an overlay (only the files that change) plus expect.json. A case is composed by copying the
// valid base and overwriting it with the overlay files, then run through the real validate pipeline.
const FIX = join(import.meta.dirname, '../fixtures')
const VALID = join(FIX, 'valid')
const INVALID = join(FIX, 'invalid')

/** Copy the valid base into a tmp dir, overlay a case's files, return the composed source dir. */
function compose(overlayDir?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'patods-fix-'))
  const src = join(dir, 'src')
  cpSync(VALID, src, { recursive: true })
  if (overlayDir) {
    for (const rel of readdirSync(overlayDir, { recursive: true, encoding: 'utf8' })) {
      if (rel === 'expect.json') continue
      const from = join(overlayDir, rel)
      if (!statSync(from).isFile()) continue // skip directory entries
      const to = join(src, rel)
      mkdirSync(dirname(to), { recursive: true })
      copyFileSync(from, to)
    }
  }
  return src
}

async function validateSource(src: string): Promise<string[]> {
  const model = buildModel(await loadTokens(src))
  return [...new Set(validateModel(model).map((f) => f.code))].sort()
}

describe('US1 fixtures', () => {
  it('the valid fixture validates with zero findings (T025)', async () => {
    expect(await validateSource(compose())).toEqual([])
  })

  const cases = readdirSync(INVALID, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  for (const name of cases) {
    const caseDir = join(INVALID, name)
    const expected = JSON.parse(readFileSync(join(caseDir, 'expect.json'), 'utf8')) as {
      description: string
      codes?: string[]
      throws?: string
    }
    it(`${name}: ${expected.description} (T024)`, async () => {
      const src = compose(caseDir)
      if (expected.throws) {
        await expect(loadTokens(src)).rejects.toThrow(expected.throws)
      } else {
        expect(await validateSource(src)).toEqual([...(expected.codes ?? [])].sort())
      }
    })
  }
})
