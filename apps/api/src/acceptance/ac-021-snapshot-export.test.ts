/**
 * User-acceptance scenario for AC-021 — readiness snapshot + canonical export.
 * An operator freezes readiness for an entity; the export is generated only
 * from that immutable snapshot, later approvals do not change it, and no
 * forbidden compliance language appears in the output.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { scanMarketingCopy } from '@rre/copy-guard'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, type InjectResponse, buildTestApp } from './helpers.js'

const CONTROL = 'EAA-EN549-9-2-1-1'
const headers = { 'x-tenant-id': 't-demo', 'x-actor': 'manager@acme' }

describe('AC-021 — readiness snapshot + export', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildTestApp({
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

  async function createEntity(app: FastifyInstance): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers,
      payload: bankEntityRequest(),
    })
    return (res.json() as { entity: { id: string } }).entity.id
  }

  it('freezes readiness, exports only from the snapshot, and stays immutable', async () => {
    await withApp(async (app) => {
      const entityId = await createEntity(app)

      const created = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/readiness-snapshots`,
        headers,
      })
      expect(created.statusCode).toBe(201)
      const snapshotId = body(created).id as string
      const hashAtFreeze = body(created).contentHash as string
      expect(hashAtFreeze).toMatch(/^sha256:[0-9a-f]{64}$/)

      // The canonical JSON export comes back as an attachment, from the frozen doc.
      const json = await app.inject({
        method: 'GET',
        url: `/api/v1/readiness-snapshots/${snapshotId}/export.json`,
        headers,
      })
      expect(json.statusCode).toBe(200)
      expect(json.headers['content-disposition']).toContain('attachment')
      const doc = json.json() as { schemaVersion: string; verdict: { statement: string } }
      expect(doc.schemaVersion).toBe('1.0')
      expect(doc.verdict.statement).toContain('snapshot')
      expect(scanMarketingCopy(json.body)).toEqual([])

      // The CSV rendering is the same snapshot.
      const csv = await app.inject({
        method: 'GET',
        url: `/api/v1/readiness-snapshots/${snapshotId}/export.csv`,
        headers,
      })
      expect(csv.statusCode).toBe(200)
      expect(csv.headers['content-type']).toContain('text/csv')
      expect(csv.body.split('\r\n')[0]).toContain('control,title')

      // Approve a claim AFTER the snapshot — the frozen snapshot must not move.
      const asserted = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/controls/${CONTROL}/claims`,
        headers,
        payload: { value: 'captions present' },
      })
      const claimId = (asserted.json() as { claim: { id: string } }).claim.id
      await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claimId}/decisions`,
        headers,
        payload: { decision: 'APPROVED' },
      })

      const reread = await app.inject({
        method: 'GET',
        url: `/api/v1/readiness-snapshots/${snapshotId}`,
        headers,
      })
      expect((reread.json() as { contentHash: string }).contentHash).toBe(hashAtFreeze)

      // A fresh snapshot reflects the approval and has a different hash.
      const next = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/readiness-snapshots`,
        headers,
      })
      expect(body(next).contentHash).not.toBe(hashAtFreeze)
    })
  })

  it('404s the export for an unknown snapshot', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/readiness-snapshots/rsnap_missing/export.json`,
        headers,
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
