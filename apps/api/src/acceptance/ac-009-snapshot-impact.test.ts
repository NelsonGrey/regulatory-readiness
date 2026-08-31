/**
 * User-acceptance scenario for AC-009 — control-snapshot impact.
 * The impact view lists which entities on a pack are evaluated against an older
 * control snapshot than the one installed; adopting is a re-evaluation.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { bankEntityRequest, buildTestApp } from './helpers.js'

const headers = { 'x-tenant-id': 't-demo', 'x-actor': 'manager@acme' }

describe('AC-009 — control-snapshot impact', () => {
  const withApp = async (
    fn: (app: FastifyInstance, stores: InMemoryStores) => Promise<void>,
  ): Promise<void> => {
    const stores = createInMemoryStores()
    const app = buildTestApp({ logLevel: 'error', unitOfWork: inMemoryUnitOfWork(stores) })
    try {
      await fn(app, stores)
    } finally {
      await app.close()
    }
  }

  it('reports entities on a stale snapshot and clears them once adopted', async () => {
    await withApp(async (app, stores) => {
      const entityId = (
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/entities',
            headers,
            payload: bankEntityRequest(),
          })
        ).json() as {
          entity: { id: string }
        }
      ).entity.id

      // fresh entity → nothing impacted
      let impact = await app.inject({
        method: 'GET',
        url: '/api/v1/packs/eaa-accessibility/impact',
        headers,
      })
      expect(impact.statusCode).toBe(200)
      expect((impact.json() as { impacted: unknown[]; upToDate: number }).impacted).toHaveLength(0)
      expect((impact.json() as { upToDate: number }).upToDate).toBe(1)

      // simulate the pack having moved forward under this entity
      const ev = [...stores.evaluations.values()].find((e) => e.entityId === entityId)!
      ev.snapshotKey = 'EAA-IE-EN549-OLD'

      impact = await app.inject({
        method: 'GET',
        url: '/api/v1/packs/eaa-accessibility/impact',
        headers,
      })
      const report = impact.json() as {
        upToDate: number
        impacted: Array<{ entityId: string; snapshotKey: string; addedControls: string[] }>
      }
      expect(report.upToDate).toBe(0)
      expect(report.impacted).toHaveLength(1)
      expect(report.impacted[0]?.snapshotKey).toBe('EAA-IE-EN549-OLD')

      // adopt = re-evaluate
      await app.inject({ method: 'POST', url: `/api/v1/entities/${entityId}/re-evaluate`, headers })
      impact = await app.inject({
        method: 'GET',
        url: '/api/v1/packs/eaa-accessibility/impact',
        headers,
      })
      expect((impact.json() as { impacted: unknown[] }).impacted).toHaveLength(0)
    })
  })

  it('404s an unknown pack', async () => {
    await withApp(async (app) => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/packs/nope/impact', headers })
      expect(res.statusCode).toBe(404)
    })
  })
})
