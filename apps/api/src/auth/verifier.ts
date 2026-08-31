import type { FastifyRequest } from 'fastify'
import { principalFromRequest, type Principal } from '../auth.js'
import { verifyJwt, type Jwks } from './jwt.js'

/**
 * Resolves the signed-in person from a request. Swappable so a real identity
 * provider drops in without touching the routes or the membership hook.
 */
export interface PrincipalVerifier {
  verify(req: FastifyRequest): Promise<Principal | null>
}

/** Dev stand-in: trust the `x-user-email` header (see `principalFromRequest`). */
export function headerVerifier(): PrincipalVerifier {
  return { verify: async (req) => principalFromRequest(req) }
}

export interface JwtVerifierConfig {
  /** Expected `iss`. */
  issuer: string
  /** Expected `aud` (optional but recommended). */
  audience?: string
  /** A static JWKS (tests, or a pinned key). */
  jwks?: Jwks
  /** Where to fetch the JWKS (cached). */
  jwksUri?: string
  /** JWKS cache TTL in ms. */
  cacheTtlMs?: number
  fetchImpl?: typeof fetch
  now?: () => number
}

function bearer(req: FastifyRequest): string | null {
  const raw = req.headers['authorization'] ?? req.headers['Authorization' as 'authorization']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const m = /^Bearer\s+(.+)$/i.exec(value)
  return m ? m[1]! : null
}

/**
 * Accept RS256 bearer tokens from an OIDC provider. Maps `sub` → `userId`,
 * `email` → `email`, `name` → `name`. A token without a usable `sub`+`email`,
 * or that fails verification, yields `null` (→ 401 at the hook).
 */
export function jwtVerifier(cfg: JwtVerifierConfig): PrincipalVerifier {
  const doFetch = cfg.fetchImpl ?? fetch
  const ttl = cfg.cacheTtlMs ?? 10 * 60 * 1000
  let cached: { jwks: Jwks; at: number } | null = cfg.jwks ? { jwks: cfg.jwks, at: Infinity } : null

  async function jwks(): Promise<Jwks | null> {
    if (cached && Date.now() - cached.at < ttl) return cached.jwks
    if (!cfg.jwksUri) return cached?.jwks ?? null
    try {
      const res = await doFetch(cfg.jwksUri)
      if (!res.ok) return cached?.jwks ?? null
      const body = (await res.json()) as Jwks
      if (!body || !Array.isArray(body.keys)) return cached?.jwks ?? null
      cached = { jwks: body, at: Date.now() }
      return body
    } catch {
      return cached?.jwks ?? null
    }
  }

  return {
    async verify(req) {
      const token = bearer(req)
      if (!token) return null
      const set = await jwks()
      if (!set) return null
      const claims = verifyJwt(token, {
        jwks: set,
        issuer: cfg.issuer,
        audience: cfg.audience,
        now: cfg.now,
      })
      if (!claims || typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null
      return {
        userId: claims.sub,
        email: claims.email,
        name: typeof claims.name === 'string' ? claims.name : null,
      }
    },
  }
}
