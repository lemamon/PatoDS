// FR-001 scan: no token defined outside the single source. Detects declared custom properties in
// the project prefix, setProperty calls using that prefix, and DTCG documents ($value) outside
// packages/tokens/src and the versioned allowlist.
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const PREFIX = 'patods'
const DECL = new RegExp(`--${PREFIX}-[a-z0-9-]+\\s*:`, 'i')
const SETPROP = new RegExp(`setProperty\\(\\s*['\"\`]--${PREFIX}-`, 'i')
const SCAN_EXT = /\.(css|scss|sass|less|vue|svelte|html?|tsx?|jsx?|mjs|cjs)$/i

export interface ScanFinding {
  code: string
  file: string
  message: string
}

/** Detects out-of-source token definitions in a file's content. */
export function scanText(file: string, text: string): ScanFinding[] {
  const out: ScanFinding[] = []
  if (file.endsWith('.tokens.json')) {
    out.push({ code: 'FR001-DTCG-OUTSIDE-SOURCE', file, message: '.tokens.json file outside the single source.' })
    return out
  }
  if (SCAN_EXT.test(file)) {
    if (DECL.test(text)) {
      out.push({ code: 'FR001-CSS-VAR-DECL', file, message: `Custom property --${PREFIX}-* declared outside the source.` })
    }
    if (SETPROP.test(text)) {
      out.push({ code: 'FR001-SETPROPERTY', file, message: `setProperty('--${PREFIX}-…') outside the source.` })
    }
  }
  return out
}

function matchesAllow(file: string, allow: { path: string }[]): boolean {
  for (const a of allow) {
    const prefix = a.path.replace(/\*+$/, '')
    if (file === a.path || file.startsWith(prefix)) return true
  }
  return false
}

/** Scans the repository's tracked files. */
export async function scanRepo(root: string): Promise<ScanFinding[]> {
  const allowFile = JSON.parse(await readFile(join(root, 'quality/scan-allowlist.json'), 'utf8'))
  const allow: { path: string }[] = allowFile.allow ?? []
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const out: ScanFinding[] = []
  for (const file of tracked) {
    if (matchesAllow(file, allow)) continue
    // Test and fixture files are not shipped; FR-001 applies to the shipped source.
    if (/(^|\/)(test|tests|fixtures|__tests__)\//.test(file) || /\.(test|spec)\.[tj]sx?$/.test(file)) continue
    if (!SCAN_EXT.test(file) && !file.endsWith('.tokens.json')) continue
    let text = ''
    try {
      text = await readFile(join(root, file), 'utf8')
    } catch {
      continue
    }
    out.push(...scanText(file, text))
  }
  return out
}
