import { createPublicKey, verify as cryptoVerify } from 'node:crypto'

/**
 * Minimal RS256 JWT verification against a JWKS — enough to accept tokens from a
 * standards-compliant identity provider (Clerk, WorkOS AuthKit, Auth0, Cognito,
 * self-hosted). No dependency: `node:crypto` imports the JWK and checks the
 * PKCS#1 v1.5 signature; claims are validated here.
 */
export interface Jwk {
  kty: string
  kid?: string
  use?: string
  alg?: string
  n?: string
  e?: string
  [k: string]: unknown
}

export interface Jwks {
  keys: Jwk[]
}

export interface JwtClaims {
  sub?: string
  email?: string
  name?: string
  iss?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  [k: string]: unknown
}

export interface VerifyOptions {
  jwks: Jwks
  issuer: string
  audience?: string
  /** Clock, for tests. */
  now?: () => number
  /** Leeway in seconds for exp/nbf. */
  clockToleranceSec?: number
}

function b64urlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function decodeSegment<T>(segment: string): T | null {
  try {
    return JSON.parse(b64urlToBuffer(segment).toString('utf8')) as T
  } catch {
    return null
  }
}

/**
 * Verify a compact JWS. Returns the claims when the signature, issuer, audience
 * and time window all check out; `null` otherwise (never throws).
 */
export function verifyJwt(token: string, opts: VerifyOptions): JwtClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string]

  const header = decodeSegment<{ alg?: string; kid?: string; typ?: string }>(headerB64)
  const claims = decodeSegment<JwtClaims>(payloadB64)
  if (!header || !claims || header.alg !== 'RS256') return null

  const jwk =
    opts.jwks.keys.find((k) => k.kty === 'RSA' && (!header.kid || k.kid === header.kid)) ?? null
  if (!jwk) return null

  let ok = false
  try {
    const key = createPublicKey({ key: jwk as Record<string, unknown>, format: 'jwk' })
    ok = cryptoVerify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      key,
      b64urlToBuffer(signatureB64),
    )
  } catch {
    return null
  }
  if (!ok) return null

  const now = Math.floor((opts.now?.() ?? Date.now()) / 1000)
  const tol = opts.clockToleranceSec ?? 5
  if (typeof claims.exp === 'number' && now > claims.exp + tol) return null
  if (typeof claims.nbf === 'number' && now + tol < claims.nbf) return null
  if (claims.iss !== opts.issuer) return null
  if (opts.audience) {
    const aud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : []
    if (!aud.includes(opts.audience)) return null
  }
  return claims
}
