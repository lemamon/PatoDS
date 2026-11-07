// Short-lived GitHub App installation token (design-sync.md §11). The App private key is a fixed ENG-13
// secret passed only via environment variable; this module signs a 10-minute RS256 JWT and exchanges it
// for an installation token scoped to Issues:write and org Members:read (GITHUB_TOKEN cannot notify
// teams). No secret is logged or returned beyond the token the caller needs. fetch is injected so tests
// run against recorded responses with no live network.
import { createSign } from 'node:crypto'
import { SyncCoreError } from '../../core/errors.ts'

export interface FetchResponse {
  readonly status: number
  readonly ok: boolean
  json(): Promise<unknown>
  text(): Promise<string>
}
export interface FetchInit {
  method?: string
  headers?: Record<string, string>
  body?: string
}
export type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponse>

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Build a signed GitHub App JWT (RS256), valid for 10 minutes from `nowSeconds` (GitHub §auth). */
export function buildAppJwt(appId: string, privateKeyPem: string, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  // iat backdated 60s to tolerate clock skew; exp capped at 10 minutes (GitHub's maximum).
  const payload = base64url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: appId }))
  const signingInput = `${header}.${payload}`
  const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKeyPem)
  return `${signingInput}.${base64url(signature)}`
}

export interface InstallationTokenParams {
  readonly appId: string
  readonly installationId: string
  readonly privateKeyPem: string
  readonly nowSeconds: number
}

export interface InstallationToken {
  readonly token: string
  readonly expiresAt: string
}

/** Exchange the App JWT for an installation token scoped to Issues:write + org Members:read. */
export async function mintInstallationToken(fetchFn: FetchLike, params: InstallationTokenParams): Promise<InstallationToken> {
  const jwt = buildAppJwt(params.appId, params.privateKeyPem, params.nowSeconds)
  const res = await fetchFn(`https://api.github.com/app/installations/${params.installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ permissions: { issues: 'write', members: 'read' } }),
  })
  if (res.status === 401 || res.status === 403) {
    throw new SyncCoreError('ACCESS_DENIED', 'access', `GitHub App token exchange returned ${res.status}`)
  }
  if (res.status !== 201) {
    throw new SyncCoreError('TOOL_UNAVAILABLE', 'access', `GitHub App token exchange returned ${res.status}`)
  }
  const body = (await res.json()) as { token?: string; expires_at?: string }
  if (!body.token || !body.expires_at) throw new SyncCoreError('ACCESS_DENIED', 'access', 'GitHub App token response missing token/expiry')
  return { token: body.token, expiresAt: body.expires_at }
}
