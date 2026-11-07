// GitHub alert (design-sync.md §4.4, §11, DSN-02, FR-026). On any failure (codes 2–5) the core calls
// raise(); this adapter opens or updates an issue labelled design-sync:failure that mentions the owner
// team, so the sync owner is notified (the next verified run resolves it via the tracker). It shares the
// issue repository with the tracker. fetch is injected; tests run against recorded responses.
import type { AlertPort, SyncAlert } from '../../ports.ts'
import { fingerprintMarker, githubRequest, type GitHubTrackerOptions } from './tracker.ts'

export type GitHubAlertOptions = GitHubTrackerOptions

export class GitHubAlert implements AlertPort {
  private readonly opts: GitHubAlertOptions
  constructor(opts: GitHubAlertOptions) {
    this.opts = opts
  }

  async raise(alert: SyncAlert): Promise<void> {
    const title = `[design-sync] failure ${alert.error.code} on ${alert.tool}`
    const ownerLabel = `owner:${alert.owner.slug.replace(/^@/, '').replace(/\//g, '-')}`
    const body = [
      `${alert.owner.slug} — design-sync failed on \`${alert.tool}\`.`,
      '',
      `- code: ${alert.error.code}`,
      `- phase: ${alert.error.phase}`,
      `- message: ${alert.error.message}`,
      `- completed operations: ${alert.error.completedOperations ?? 'n/a'}`,
      alert.runUrl ? `- run: ${alert.runUrl}` : '- run: (local)',
      '',
      fingerprintMarker(alert.fingerprint),
    ].join('\n')
    const labels = ['design-sync', 'design-sync:failure', `severity:${alert.severity}`, ownerLabel]

    const existing = await this.find(alert.fingerprint)
    if (!existing) {
      await githubRequest(this.opts, 'POST', `/repos/${this.opts.repo}/issues`, { title, body, labels })
      return
    }
    await githubRequest(this.opts, 'PATCH', `/repos/${this.opts.repo}/issues/${existing}`, { state: 'open', title, body, labels })
  }

  private async find(fp: SyncAlert['fingerprint']): Promise<number | null> {
    const q = encodeURIComponent(`repo:${this.opts.repo} in:body "${fp}"`)
    const { json } = await githubRequest(this.opts, 'GET', `/search/issues?q=${q}`)
    const items = (json as { items?: { number?: number; body?: string }[] })?.items ?? []
    for (const it of items) {
      if ((it.body ?? '').includes(fp)) return it.number ?? null
    }
    return null
  }
}
