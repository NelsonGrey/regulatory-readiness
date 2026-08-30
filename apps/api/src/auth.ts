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
