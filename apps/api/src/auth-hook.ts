import type { FastifyInstance } from 'fastify'
import { principalFromRequest } from './auth.js'
import type { AccountsService } from './services/accounts.js'

/**
 * Path prefixes under `/api/v1` that are NOT workspace-scoped: the tenancy
 * control plane manages its own auth (`accounts.ts` resolves principal + role
 * per route), and `/packs` is public catalogue data (no tenant scope).
 */
const OPEN_PREFIXES = [
  '/api/v1/sign-up',
  '/api/v1/workspaces',
  '/api/v1/members',
  '/api/v1/invites',
  '/api/v1/packs',
]

function isOpen(path: string): boolean {
  return OPEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

export interface WorkspaceAuthOptions {
  accounts: AccountsService
  /**
   * Dev stand-in: when no real `membership` backs the request, synthesise an
   * `owner` from the headers (still requires `x-tenant-id`). Production leaves
   * this off — a request without a membership is refused.
   */
  devAuth: boolean
}

/**
 * Bind every workspace-scoped route to a `membership` (engine TRD §3). Resolves
 * the signed-in person and their role in the `x-tenant-id` workspace once, then
 * decorates the request; handlers read `req.auth` / `req.workspaceRole`.
 */
export function registerWorkspaceAuth(app: FastifyInstance, opts: WorkspaceAuthOptions): void {
  app.addHook('preHandler', async (req, reply) => {
    const path = req.routeOptions?.url ?? req.url.split('?')[0] ?? req.url
    if (isOpen(path)) return

    const tenantHeader = req.headers['x-tenant-id']
    const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader
    if (!tenantId) {
      return reply
        .code(401)
        .send({ error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } })
    }

    const principal = principalFromRequest(req)
    if (!principal) {
      if (opts.devAuth) {
        req.auth = { tenantId, actor: 'dev@local' }
        req.workspaceRole = 'owner'
        return
      }
      return reply.code(401).send({
        error: { code: 'NO_PRINCIPAL', message: 'x-user-email (signed-in identity) is required' },
      })
    }

    const role = await opts.accounts.membershipRole(tenantId, principal.email)
    if (!role) {
      if (opts.devAuth) {
        req.auth = { tenantId, actor: principal.email }
        req.workspaceRole = 'owner'
        return
      }
      return reply.code(403).send({
        error: { code: 'NOT_A_MEMBER', message: 'you are not a member of this workspace' },
      })
    }

    req.auth = { tenantId, actor: principal.email }
    req.workspaceRole = role
  })
}
