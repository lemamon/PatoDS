// Resolve the sync-owner team from a CODEOWNERS file (design-sync.md §8, §11, DSN-02). The owner of the
// config's ownerPath is the RoleRef used on every tracked item and alert. A path with no covering line,
// or a line that names more than one team, is a configuration error (CLI code 2).
import type { RoleRef } from '../../ports.ts'
import { SyncCoreError } from '../../core/errors.ts'

interface Rule {
  readonly pattern: string
  readonly owners: readonly string[]
}

function parse(codeowners: string): Rule[] {
  const rules: Rule[] = []
  for (const raw of codeowners.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const parts = line.split(/\s+/)
    const pattern = parts[0]!
    const owners = parts.slice(1).filter((o) => o.startsWith('@'))
    if (owners.length > 0) rules.push({ pattern, owners })
  }
  return rules
}

function normalize(p: string): string {
  return p.replace(/^\/+/, '').replace(/\/+$/, '')
}

function covers(target: string, pat: string): boolean {
  return pat !== '' && (target === pat || target.startsWith(`${pat}/`))
}

/**
 * Resolve the team that owns `ownerPath`: the most specific covering line (DSN-02). A directory pattern
 * covers its subtree; the catch-all `*` is the least specific. Most-specific-wins (rather than GitHub's
 * raw last-match) keeps a broad later line like `/tools/` from overriding `/tools/design-sync/`.
 */
export function resolveOwner(codeowners: string, ownerPath: string): RoleRef | null {
  const target = normalize(ownerPath)
  let matched: Rule | null = null
  let bestSpecificity = -2
  for (const rule of parse(codeowners)) {
    const pat = normalize(rule.pattern)
    const specificity = rule.pattern === '*' ? -1 : covers(target, pat) ? pat.split('/').length : -2
    if (specificity >= 0 || rule.pattern === '*') {
      if (specificity >= bestSpecificity) {
        matched = rule
        bestSpecificity = specificity
      }
    }
  }
  if (!matched) return null
  if (matched.owners.length > 1) {
    throw new SyncCoreError('CONFIG_INVALID', 'config', `CODEOWNERS line for "${matched.pattern}" names ${matched.owners.length} owners; the sync owner must be a single team (DSN-02)`)
  }
  const slug = matched.owners[0]!
  return { kind: 'team', slug, source: 'CODEOWNERS' }
}
