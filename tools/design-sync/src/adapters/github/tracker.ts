// GitHub tracker (design-sync.md §8, §11). Divergence and capability items are GitHub issues, matched by
// a hidden fingerprint marker in the body so the same divergence always updates the same issue. The team
// owner is carried as a label + a body mention (a team cannot be an assignee). fetch is injected; tests
// run against recorded responses, never a live network. This port never writes to the repository.
import type {
  Fingerprint, OpenItem, ResolveResult, TrackedItem, TrackedItemKind, TrackerPort, UpsertResult,
} from '../../ports.ts'
import { SyncCoreError } from '../../core/errors.ts'
import type { FetchLike } from './token.ts'

export interface GitHubTrackerOptions {
  readonly fetchFn: FetchLike
  readonly token: string
  readonly repo: string // 'owner/name'
}

export function fingerprintMarker(fp: Fingerprint): string {
  return `<!-- patods-design-sync fingerprint: ${fp} -->`
}

const FP_RE = /<!-- patods-design-sync fingerprint: (sha256:[0-9a-f]{64}) -->/

interface IssueView {
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  labels: string[]
}

export async function githubRequest(opts: GitHubTrackerOptions, method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await opts.fetchFn(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${opts.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 401 || res.status === 403) throw new SyncCoreError('ACCESS_DENIED', 'report', `GitHub returned ${res.status}`)
  if (res.status === 429) throw new SyncCoreError('RATE_LIMITED', 'report', 'GitHub rate limit')
  if (res.status >= 500) throw new SyncCoreError('TOOL_UNAVAILABLE', 'report', `GitHub returned ${res.status}`)
  const json = res.status === 204 ? null : await res.json()
  return { status: res.status, json }
}

export class GitHubTracker implements TrackerPort {
  private readonly opts: GitHubTrackerOptions
  constructor(opts: GitHubTrackerOptions) {
    this.opts = opts
  }

  private async find(fp: Fingerprint): Promise<IssueView | null> {
    const q = encodeURIComponent(`repo:${this.opts.repo} in:body "${fp}"`)
    const { json } = await githubRequest(this.opts, 'GET', `/search/issues?q=${q}`)
    const items = (json as { items?: unknown[] })?.items ?? []
    for (const raw of items) {
      const view = toIssue(raw)
      if (FP_RE.exec(view.body)?.[1] === fp) return view
    }
    return null
  }

  async upsert(item: TrackedItem): Promise<UpsertResult> {
    const labels = [...item.labels, `owner:${slugLabel(item.owner.slug)}`]
    const existing = await this.find(item.fingerprint)
    if (!existing) {
      await githubRequest(this.opts, 'POST', `/repos/${this.opts.repo}/issues`, { title: item.title, body: item.body, labels })
      return { action: 'created' }
    }
    if (existing.state === 'closed') {
      await githubRequest(this.opts, 'PATCH', `/repos/${this.opts.repo}/issues/${existing.number}`, { state: 'open', title: item.title, body: item.body, labels })
      return { action: 'reopened' }
    }
    const unchanged = existing.title === item.title && existing.body === item.body && sameLabels(existing.labels, labels)
    if (unchanged) return { action: 'unchanged' }
    await githubRequest(this.opts, 'PATCH', `/repos/${this.opts.repo}/issues/${existing.number}`, { title: item.title, body: item.body, labels })
    return { action: 'updated' }
  }

  async resolve(fingerprint: Fingerprint, note: string): Promise<ResolveResult> {
    const existing = await this.find(fingerprint)
    if (!existing || existing.state === 'closed') return { action: 'not-found' }
    await githubRequest(this.opts, 'POST', `/repos/${this.opts.repo}/issues/${existing.number}/comments`, { body: note })
    await githubRequest(this.opts, 'PATCH', `/repos/${this.opts.repo}/issues/${existing.number}`, { state: 'closed' })
    return { action: 'resolved' }
  }

  async listOpen(filter?: { readonly kinds?: readonly TrackedItemKind[] }): Promise<readonly OpenItem[]> {
    const q = encodeURIComponent(`repo:${this.opts.repo} is:issue is:open label:design-sync`)
    const { json } = await githubRequest(this.opts, 'GET', `/search/issues?q=${q}`)
    const items = ((json as { items?: unknown[] })?.items ?? []).map(toIssue)
    const kinds = filter?.kinds ? new Set(filter.kinds) : null
    const out: OpenItem[] = []
    for (const issue of items) {
      const fp = FP_RE.exec(issue.body)?.[1] as Fingerprint | undefined
      if (!fp) continue
      const kind = kindFromLabels(issue.labels)
      if (kinds && !kinds.has(kind)) continue
      out.push({ fingerprint: fp, kind, detectedOn: '', due: '', url: `https://github.com/${this.opts.repo}/issues/${issue.number}` })
    }
    return out.sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0))
  }
}

function toIssue(raw: unknown): IssueView {
  const r = raw as { number?: number; title?: string; body?: string; state?: string; labels?: unknown[] }
  const labels = (r.labels ?? []).map((l) => (typeof l === 'string' ? l : (l as { name?: string }).name ?? ''))
  return { number: r.number ?? 0, title: r.title ?? '', body: r.body ?? '', state: r.state === 'closed' ? 'closed' : 'open', labels }
}

function kindFromLabels(labels: readonly string[]): TrackedItemKind {
  for (const l of labels) {
    const m = /^kind:(.+)$/.exec(l)
    if (m) return m[1] as TrackedItemKind
    if (l === 'design-sync:failure') return 'failure'
  }
  return 'divergence'
}

function slugLabel(slug: string): string {
  return slug.replace(/^@/, '').replace(/\//g, '-')
}

function sameLabels(a: readonly string[], b: readonly string[]): boolean {
  return [...a].sort().join('\u0000') === [...b].sort().join('\u0000')
}
