// GitHub adapter tests (design-sync.md §8, §11, T074). No live network: fetch is faked with recorded
// GitHub response bodies, and the adapters are asserted on the requests they make and the actions they
// return. Covers the CODEOWNERS owner resolution, the App-token exchange, and the tracker/alert issues.
import { describe, expect, it } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { resolveOwner } from '../src/adapters/github/owners.ts'
import { buildAppJwt, mintInstallationToken, type FetchInit, type FetchLike } from '../src/adapters/github/token.ts'
import { GitHubTracker, fingerprintMarker } from '../src/adapters/github/tracker.ts'
import { GitHubAlert } from '../src/adapters/github/alert.ts'
import type { Fingerprint, SyncAlert, TrackedItem } from '../src/ports.ts'

const CODEOWNERS = `
* @patods/maintainers
/tools/design-sync/ @patods/design-sync-owners
/tools/ @patods/maintainers
`

interface Recorded {
  url: string
  init?: FetchInit
}

function makeFetch(router: (method: string, url: string) => { status: number; body?: unknown }): { fetchFn: FetchLike; calls: Recorded[] } {
  const calls: Recorded[] = []
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({ url, init })
    const { status, body } = router(init?.method ?? 'GET', url)
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body ?? null,
      text: async () => JSON.stringify(body ?? null),
    }
  }
  return { fetchFn, calls }
}

const FP = 'sha256:0000000000000000000000000000000000000000000000000000000000000001' as Fingerprint

function divergenceItem(): TrackedItem {
  return {
    fingerprint: FP, kind: 'divergence', title: '[design-sync] alias color.bg.surface (dark)',
    body: `line\n${fingerprintMarker(FP)}`, owner: { kind: 'team', slug: '@patods/design-sync-owners', source: 'CODEOWNERS' },
    due: '2026-11-12', labels: ['design-sync', 'design-sync:divergence', 'kind:alias'],
  }
}

describe('owners', () => {
  it('resolves the sync owner team (last matching rule wins over *)', () => {
    expect(resolveOwner(CODEOWNERS, 'tools/design-sync/')!.slug).toBe('@patods/design-sync-owners')
  })
  it('falls back to * when nothing covers the path', () => {
    expect(resolveOwner('* @patods/maintainers', 'anything/else')!.slug).toBe('@patods/maintainers')
  })
  it('rejects a line with more than one team', () => {
    expect(() => resolveOwner('/tools/design-sync/ @a/x @a/y', 'tools/design-sync/')).toThrow(/single team/)
  })
})

describe('token', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString()

  it('builds a 3-part RS256 JWT with the app id as issuer', () => {
    const jwt = buildAppJwt('123', pem, 1_762_000_000)
    const parts = jwt.split('.')
    expect(parts).toHaveLength(3)
    expect(JSON.parse(Buffer.from(parts[0]!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()).iss).toBe('123')
  })
  it('exchanges the JWT for an installation token scoped to issues/members', async () => {
    const { fetchFn, calls } = makeFetch(() => ({ status: 201, body: { token: 'ghs_abc', expires_at: '2026-11-07T01:00:00Z' } }))
    const res = await mintInstallationToken(fetchFn, { appId: '123', installationId: '456', privateKeyPem: pem, nowSeconds: 1_762_000_000 })
    expect(res).toEqual({ token: 'ghs_abc', expiresAt: '2026-11-07T01:00:00Z' })
    expect(calls[0]!.url).toContain('/app/installations/456/access_tokens')
    expect(calls[0]!.init!.headers!.Authorization.startsWith('Bearer ')).toBe(true)
    expect(JSON.parse(calls[0]!.init!.body!)).toEqual({ permissions: { issues: 'write', members: 'read' } })
  })
  it('maps 403 to ACCESS_DENIED', async () => {
    const { fetchFn } = makeFetch(() => ({ status: 403 }))
    await expect(mintInstallationToken(fetchFn, { appId: '1', installationId: '2', privateKeyPem: pem, nowSeconds: 1 })).rejects.toThrow(/ACCESS_DENIED|403/)
  })
})

describe('GitHubTracker', () => {
  const opts = (fetchFn: FetchLike) => ({ fetchFn, token: 'ghs_x', repo: 'patods/ds' })

  it('creates an issue when none exists', async () => {
    const { fetchFn, calls } = makeFetch((method) => (method === 'GET' ? { status: 200, body: { items: [] } } : { status: 201, body: { number: 10 } }))
    const res = await new GitHubTracker(opts(fetchFn)).upsert(divergenceItem())
    expect(res.action).toBe('created')
    const post = calls.find((c) => (c.init?.method ?? 'GET') === 'POST')!
    const body = JSON.parse(post.init!.body!)
    expect(body.labels).toContain('design-sync:divergence')
    expect(body.labels).toContain('owner:patods-design-sync-owners')
  })

  it('updates an existing open issue matched by fingerprint', async () => {
    const existing = { number: 7, title: 'old', body: `x\n${fingerprintMarker(FP)}`, state: 'open', labels: [{ name: 'design-sync' }] }
    const { fetchFn, calls } = makeFetch((method) => (method === 'GET' ? { status: 200, body: { items: [existing] } } : { status: 200, body: { number: 7 } }))
    const res = await new GitHubTracker(opts(fetchFn)).upsert(divergenceItem())
    expect(res.action).toBe('updated')
    expect(calls.some((c) => c.init?.method === 'PATCH' && c.url.endsWith('/issues/7'))).toBe(true)
  })

  it('resolves by commenting and closing', async () => {
    const existing = { number: 7, title: 't', body: `x\n${fingerprintMarker(FP)}`, state: 'open', labels: [] }
    const { fetchFn, calls } = makeFetch((method, url) => {
      if (method === 'GET') return { status: 200, body: { items: [existing] } }
      if (url.endsWith('/comments')) return { status: 201, body: {} }
      return { status: 200, body: { number: 7 } }
    })
    const res = await new GitHubTracker(opts(fetchFn)).resolve(FP, 'converged')
    expect(res.action).toBe('resolved')
    expect(calls.some((c) => c.url.endsWith('/comments'))).toBe(true)
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(true)
  })

  it('lists open items, parsing the fingerprint marker', async () => {
    const issue = { number: 3, title: 't', body: `b\n${fingerprintMarker(FP)}`, state: 'open', labels: [{ name: 'design-sync' }, { name: 'kind:alias' }] }
    const { fetchFn } = makeFetch(() => ({ status: 200, body: { items: [issue] } }))
    const open = await new GitHubTracker(opts(fetchFn)).listOpen()
    expect(open[0]!.fingerprint).toBe(FP)
    expect(open[0]!.kind).toBe('alias')
  })
})

describe('GitHubAlert', () => {
  it('opens a failure issue mentioning the owner', async () => {
    const alert: SyncAlert = {
      fingerprint: FP, severity: 'error',
      error: { code: 'VERIFY_MISMATCH', phase: 'verify', message: 'residual', completedOperations: 3 },
      owner: { kind: 'team', slug: '@patods/design-sync-owners', source: 'CODEOWNERS' }, tool: 'memory:sandbox', runUrl: 'https://ci/run/1',
    }
    const { fetchFn, calls } = makeFetch((method) => (method === 'GET' ? { status: 200, body: { items: [] } } : { status: 201, body: { number: 1 } }))
    await new GitHubAlert({ fetchFn, token: 'x', repo: 'patods/ds' }).raise(alert)
    const post = calls.find((c) => (c.init?.method ?? 'GET') === 'POST')!
    const body = JSON.parse(post.init!.body!)
    expect(body.labels).toContain('design-sync:failure')
    expect(body.body).toContain('@patods/design-sync-owners')
    expect(body.body).toContain(FP)
  })
})
