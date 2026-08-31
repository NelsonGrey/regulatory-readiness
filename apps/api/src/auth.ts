import { createHash } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import type { Role } from './rbac.js'

/**
 * The authenticated caller for a workspace-scoped request. Populated by the
 * membership pre-handler (`auth-hook.ts`) once the signed-in person has been
 * resolved to a `membership` in the `x-tenant-id` workspace. `actor` is the
 * person's email (or `dev@local` under the dev stand-in).
 */
export interface AuthContext {
  tenantId: string
  actor: string
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the membership pre-handler for every workspace-scoped route. */
    auth?: AuthContext
    /** The caller's role in `auth.tenantId`, for per-route capability checks. */
    workspaceRole?: Role
  }
}

export function authFromRequest(req: FastifyRequest): AuthContext | null {
  if (req.auth) return req.auth
  // Fallback for routes not behind the membership hook (kept for safety).
  const tenantId = req.headers['x-tenant-id']
  if (typeof tenantId !== 'string' || tenantId.length === 0) return null
  const actor = req.headers['x-actor']
  return { tenantId, actor: typeof actor === 'string' && actor.length > 0 ? actor : 'dev-user' }
}

/**
 * A signed-in person, independent of any workspace. Real deployments derive this
 * from the identity provider's verified session; the dev stand-in reads
 * `x-user-email` (falling back to `x-actor`) and derives a stable id from it.
 */
export interface Principal {
  userId: string
  email: string
  name?: string | null
}

export function principalFromRequest(req: FastifyRequest): Principal | null {
  const header = req.headers['x-user-email'] ?? req.headers['x-actor']
  const email = Array.isArray(header) ? header[0] : header
  if (typeof email !== 'string' || !email.includes('@')) return null
  const name = req.headers['x-user-name']
  return {
    userId: `usr_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24)}`,
    email,
    name: typeof name === 'string' && name.length > 0 ? name : null,
  }
}
