import { createHash } from 'node:crypto'
import type { FastifyRequest } from 'fastify'

/**
 * The authenticated caller. In production this comes from an OIDC session and the
 * tenant is bound to a Postgres `SET LOCAL app.tenant_id` per transaction
 * (ADR 0002/0003). For local development the tenant and actor are read from
 * headers — a stand-in, not the real auth path.
 */
export interface AuthContext {
  tenantId: string
  actor: string
}

export function authFromRequest(req: FastifyRequest): AuthContext | null {
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
