/**
 * User-acceptance scenario for AC-021b — customer data export + tenant deletion
 * (engine TRD §21). An operator downloads a full copy of their workspace data,
 * then runs a double-confirmed delete: every tenant row and object is purged,
 * a COMPLETED tombstone remains, and another tenant is entirely unaffected.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, type InjectResponse } from './helpers.js'

const headers = { 'x-tenant-id': 't-demo', 'x-actor': 'owner@acme' }
const otherHeaders = { 'x-tenant-id': 't-other', 'x-actor': 'owner@else' }

describe('AC-021b — data export + tenant deletion', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildApp({
      logLevel: 'error',
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }

  const body = (r: InjectResponse) => r.json() as Record<string, unknown>

  const createEntity = async (app: FastifyInstance, h: typeof headers): Promise<string> => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers: h,
      payload: bankEntityRequest(),
    })
    return (res.json() as { entity: { id: string } }).entity.id
  }

  it('exports the workspace, then purges it on a double-confirmed delete', async () => {
    await withApp(async (app) => {
      await createEntity(app, headers)
      await createEntity(app, otherHeaders)

      // 1. Full export comes back as a JSON attachment scoped to the tenant.
      const exported = await app.inject({ method: 'GET', url: '/api/v1/export/tenant', headers })
      expect(exported.statusCode).toBe(200)
      expect(exported.headers['content-disposition']).toContain('attachment')
      const bundle = exported.json() as {
        tenantId: string
        counts: Record<string, number>
        tables: Record<string, Array<{ tenantId: string }> | undefined>
      }
      expect(bundle.tenantId).toBe('t-demo')
      expect(bundle.counts.regulated_entity).toBe(1)
      expect((bundle.tables.regulated_entity ?? []).every((r) => r.tenantId === 't-demo')).toBe(
        true,
      )

      // 2. A delete request needs the workspace id typed as confirmation.
      const bad = await app.inject({
        method: 'POST',
        url: '/api/v1/deletion-requests',
        headers,
        payload: { confirmation: 'not-it' },
      })
      expect(bad.statusCode).toBe(422)
      expect(body(bad).error).toMatchObject({ code: 'CONFIRMATION_MISMATCH' })

      const requested = await app.inject({
        method: 'POST',
        url: '/api/v1/deletion-requests',
        headers,
        payload: { confirmation: 't-demo' },
      })
      expect(requested.statusCode).toBe(201)
      const deletionRequestId = body(requested).deletionRequestId as string
      expect((body(requested).preview as Record<string, number>).regulated_entity).toBe(1)

      // 3. Execution repeats the confirmation and then purges.
      const executed = await app.inject({
        method: 'POST',
        url: `/api/v1/deletion-requests/${deletionRequestId}/execute`,
        headers,
        payload: { confirmation: 't-demo' },
      })
      expect(executed.statusCode).toBe(200)
      expect((body(executed).purged as Record<string, number>).regulated_entity).toBe(1)

      // 4. A fresh export shows every business table emptied; only the
      //    deletion.completed audit tombstone remains.
      const reExport = await app.inject({ method: 'GET', url: '/api/v1/export/tenant', headers })
      expect((reExport.json() as { counts: Record<string, number> }).counts).toEqual({
        audit_event: 1,
      })

      const list = await app.inject({ method: 'GET', url: '/api/v1/deletion-requests', headers })
      const rows = (list.json() as { deletionRequests: Array<{ status: string }> }).deletionRequests
      expect(rows).toHaveLength(1)
      expect(rows[0]!.status).toBe('COMPLETED')

      // 5. The other tenant is untouched.
      const otherExport = await app.inject({
        method: 'GET',
        url: '/api/v1/export/tenant',
        headers: otherHeaders,
      })
      expect(
        (otherExport.json() as { counts: Record<string, number> }).counts.regulated_entity,
      ).toBe(1)

      // 6. The request cannot be executed a second time.
      const again = await app.inject({
        method: 'POST',
        url: `/api/v1/deletion-requests/${deletionRequestId}/execute`,
        headers,
        payload: { confirmation: 't-demo' },
      })
      expect(again.statusCode).toBe(409)
    })
  })

  it('401s without a tenant header', async () => {
    await withApp(async (app) => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/export/tenant' })
      expect(res.statusCode).toBe(401)
    })
  })
})
