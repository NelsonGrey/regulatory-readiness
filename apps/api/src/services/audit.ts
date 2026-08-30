import type { AuthContext } from '../auth.js'
import type { AuditQuery, AuditRecord, UnitOfWork } from '../db/uow.js'

export const AUDIT_PAGE_DEFAULT = 50
export const AUDIT_PAGE_MAX = 200

export type AuditFilter = Partial<Omit<AuditQuery, 'limit'>> & { limit?: number }

export interface AuditPage {
  events: AuditRecord[]
  /** Pass as `before` to fetch the next (older) page; `null` when there is no more. */
  nextBefore: string | null
}

/** AUD-001 — read the tenant's audit trail. Read path only; RLS scopes the tenant. */
export class AuditService {
  constructor(private readonly uow: UnitOfWork) {}

  async list(auth: AuthContext, filter: AuditFilter): Promise<AuditPage> {
    const limit = Math.min(Math.max(filter.limit ?? AUDIT_PAGE_DEFAULT, 1), AUDIT_PAGE_MAX)
    const query: AuditQuery = {
      targetType: filter.targetType,
      targetId: filter.targetId,
      action: filter.action,
      since: filter.since,
      before: filter.before,
      limit,
    }
    const events = await this.uow(auth.tenantId, (u) => u.queryAudit(query))
    const nextBefore = events.length === limit ? (events[events.length - 1]?.seq ?? null) : null
    return { events, nextBefore }
  }
}
