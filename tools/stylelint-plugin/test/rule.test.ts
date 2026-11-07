// Fixtures harness (lint-rules.md §5; T064). Proves FR-021, FR-024, SC-009: over the on-disk fixtures the
// multiset of {file, line, column, code} of the real warnings equals the multiset of the `expect:`
// comments, `valid/` is silent, the two rules do not cross-trip on the shared gate globs, and every
// subcode has at least one invalid fixture (coverage).
import { describe, it, expect, beforeAll } from 'vitest'
import stylelint from 'stylelint'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import designTokens, { ruleName as dtRule, designTokensCodes } from '../src/design-tokens.ts'
import contrastPairs, { ruleName as cpRule, contrastPairsCodes } from '../src/contrast-pairs.ts'
import { resolveDataPath } from '../src/resolve-data-path.ts'

const PLUGIN = join(import.meta.dirname, '..')
const TOKENS = join(PLUGIN, '../../packages/tokens')
const manifestPath = join(TOKENS, 'dist/meta/tokens.manifest.json')
const FIX = join(PLUGIN, 'fixtures')
const controlRegistryPath = join(FIX, 'registry.fixture.json')
const contrastManifestPath = join(FIX, 'contrast/manifest.json')
const surfacesPath = join(FIX, 'contrast/surfaces.json')

const dtConfig = {
  plugins: [designTokens as any],
  rules: { [dtRule]: [true, { manifestPath, controlRegistryPath }] },
}
const cpConfig = {
  plugins: [contrastPairs as any],
  rules: { [cpRule]: [true, { manifestPath, contrastManifestPath, surfacesPath, controlRegistryPath }] },
}
const bothConfig = {
  plugins: [designTokens as any, contrastPairs as any],
  rules: {
    [dtRule]: [true, { manifestPath, controlRegistryPath }],
    [cpRule]: [true, { manifestPath, contrastManifestPath, surfacesPath, controlRegistryPath }],
  },
}

interface W {
  file: string
  line: number
  column: number
  code: string
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .sort()
    .map((f) => join(dir, f))
}

/** Parse the `/* expect: code@column, … *\/` comments of a fixture into the expected multiset. */
function parseExpect(file: string): W[] {
  const out: W[] = []
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((ln, i) => {
      const m = ln.match(/\/\*\s*expect:\s*(.+?)\s*\*\//)
      if (!m) return
      for (const item of m[1]!.split(',')) {
        const mm = item.trim().match(/^([a-z-]+)@(\d+)$/)
        expect(mm, `malformed expectation "${item.trim()}" in ${file}`).not.toBeNull()
        out.push({ file, line: i + 1, column: Number(mm![2]), code: mm![1]! })
      }
    })
  return out
}

async function lintFile(file: string, config: any): Promise<{ warnings: W[]; parseErrors: number; invalidOptions: number; deprecations: number }> {
  const res = await stylelint.lint({
    code: readFileSync(file, 'utf8'),
    codeFilename: file,
    config,
    cache: false,
    ignoreDisables: true,
  })
  const r: any = res.results[0] ?? {}
  const warnings: W[] = (r.warnings ?? []).map((w: any) => ({ file, line: w.line, column: w.column, code: String(w.text).split(':')[0]!.trim() }))
  return {
    warnings,
    parseErrors: (r.parseErrors ?? []).length,
    invalidOptions: (r.invalidOptionWarnings ?? []).length,
    deprecations: (r.deprecations ?? []).length,
  }
}

const sortKey = (w: W) => `${w.file}|${w.line}|${w.column}|${w.code}`
const multiset = (ws: W[]) => ws.map(sortKey).sort()

beforeAll(() => {
  // Build the real token manifest the fixtures reference (QA-15 synthetic brands).
  execFileSync('node', [join(TOKENS, '../../tools/tokens-build/src/cli.ts'), 'build'], { cwd: TOKENS, stdio: 'pipe' })
}, 120_000)

describe('fixtures harness', () => {
  for (const [area, config, codes] of [
    ['design-tokens', dtConfig, designTokensCodes],
    ['contrast-pairs', cpConfig, contrastPairsCodes],
  ] as const) {
    describe(area, () => {
      const validDir = join(FIX, area, 'valid')
      const invalidDir = join(FIX, area, 'invalid')

      for (const file of cssFiles(validDir)) {
        it(`valid/${file.split('/').pop()} is silent`, async () => {
          expect(parseExpect(file), 'a valid fixture must have no expect: comment').toHaveLength(0)
          const { warnings, parseErrors, invalidOptions, deprecations } = await lintFile(file, config)
          expect(multiset(warnings)).toEqual([])
          expect({ parseErrors, invalidOptions, deprecations }).toEqual({ parseErrors: 0, invalidOptions: 0, deprecations: 0 })
        })
      }

      for (const file of cssFiles(invalidDir)) {
        it(`invalid/${file.split('/').pop()} matches its expectations`, async () => {
          const expected = parseExpect(file)
          expect(expected.length, 'an invalid fixture must declare at least one expect:').toBeGreaterThan(0)
          for (const e of expected) expect(codes as readonly string[], `unknown code "${e.code}"`).toContain(e.code)
          const { warnings, parseErrors, invalidOptions } = await lintFile(file, config)
          expect({ parseErrors, invalidOptions }).toEqual({ parseErrors: 0, invalidOptions: 0 })
          expect(multiset(warnings)).toEqual(multiset(expected))
        })
      }

      it('every subcode has an invalid fixture (FR-024, SC-009)', () => {
        const seen = new Set<string>()
        for (const file of cssFiles(invalidDir)) for (const e of parseExpect(file)) seen.add(e.code)
        for (const code of codes) expect(seen, `no invalid fixture covers "${code}"`).toContain(code)
      })
    })
  }

  it('the two rules do not cross-trip on the shared valid gate globs (§5 rule 5)', async () => {
    for (const area of ['design-tokens', 'contrast-pairs']) {
      for (const file of cssFiles(join(FIX, area, 'valid'))) {
        const { warnings, parseErrors, invalidOptions } = await lintFile(file, bothConfig)
        expect(multiset(warnings), `${area}/valid/${file.split('/').pop()} under both rules`).toEqual([])
        expect({ parseErrors, invalidOptions }).toEqual({ parseErrors: 0, invalidOptions: 0 })
      }
    }
  })
})

describe('resolveDataPath (§2.2)', () => {
  it('passes an absolute path through unchanged', () => {
    expect(resolveDataPath(manifestPath)).toBe(manifestPath)
  })
  it('resolves a bare package specifier from the plugin package', () => {
    const resolved = resolveDataPath('@patods/tokens/meta/tokens.manifest.json')
    expect(resolved.endsWith('packages/tokens/dist/meta/tokens.manifest.json')).toBe(true)
  })
  it('resolves a relative path from the working directory', () => {
    const resolved = resolveDataPath('./fixtures/registry.fixture.json')
    expect(resolved.startsWith('/') && resolved.endsWith('/fixtures/registry.fixture.json')).toBe(true)
  })
})
