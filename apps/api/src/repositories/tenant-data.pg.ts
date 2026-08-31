import type { PoolClient } from 'pg'
import {
  TENANT_TABLES,
  type TableCounts,
  type TenantDataRepository,
} from '../services/tenant-admin.js'

export class PgTenantDataRepository implements TenantDataRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async counts(): Promise<TableCounts> {
    const out: TableCounts = {}
    for (const table of TENANT_TABLES) {
      const res = await this.db.query<{ n: string }>(
        `SELECT count(*) AS n FROM ${table} WHERE tenant_id = $1`,
        [this.tenantId],
      )
      const n = Number(res.rows[0]?.n ?? 0)
      if (n > 0) out[table] = n
    }
    return out
  }

  async dump(): Promise<Record<string, unknown[]>> {
    const out: Record<string, unknown[]> = {}
    for (const table of TENANT_TABLES) {
      const res = await this.db.query(
        // `document` bytes never live in Postgres — only the metadata row is dumped.
        `SELECT * FROM ${table} WHERE tenant_id = $1 ORDER BY 1`,
        [this.tenantId],
      )
      if (res.rows.length > 0) out[table] = res.rows
    }
    return out
  }

  async purge(): Promise<TableCounts> {
    const res = await this.db.query<{ purge_tenant: TableCounts }>(
      `SELECT purge_tenant($1) AS purge_tenant`,
      [this.tenantId],
    )
    return res.rows[0]?.purge_tenant ?? {}
  }
}
