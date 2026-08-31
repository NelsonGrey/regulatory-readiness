/**
 * User-acceptance scenario for AC-012 — applicability override.
 * An approver records a reasoned override; readiness derivation honours it, the
 * matrix shows the change and its rationale, and the frozen export records it —
 * without touching the control snapshot.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, type InjectResponse } from './helpers.js'

const CONTROL = 'EAA-EN549-9-2-4-7' // "Web: keyboard focus indicator is visible" — REQUIRED for the bank fixture
const headers = { 'x-tenant-id': 't-demo', 'x-actor': 'approver@acme' }

describe('AC-012 — applicability override', () => {
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

  const json = (r: InjectResponse) => r.json() as Record<string, unknown>

  const row = (matrix: InjectResponse) =>
    (
      matrix.json() as {
        rows: Array<{
          control: string
          applicability: string
          readiness: string
          originalApplicability: string | null
          overrideRationale: string | null
        }>
      }
    ).rows.find((r) => r.control === CONTROL)

  it('records the override, derivation honours it, matrix + export show it', async () => {
    await withApp(async (app) => {
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

      const before = row(
        await app.inject({ method: 'GET', url: `/api/v1/entities/${entityId}/matrix`, headers }),
      )
      expect(before?.applicability).toBe('REQUIRED_BY_SNAPSHOT')

      const rec = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/controls/${CONTROL}/applicability-override`,
        headers,
        payload: {
          result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
          rationale:
            'focus indicators are handled by the design-system component, tracked separately',
          sourceRef: 'DS-A11Y-2026',
        },
      })
      expect(rec.statusCode).toBe(201)

      const after = row(
        await app.inject({ method: 'GET', url: `/api/v1/entities/${entityId}/matrix`, headers }),
      )
      expect(after?.applicability).toBe('NOT_APPLICABLE_TO_CLASSIFICATION')
      expect(after?.readiness).toBe('NOT_APPLICABLE')
      expect(after?.originalApplicability).toBe('REQUIRED_BY_SNAPSHOT')
      expect(after?.overrideRationale).toContain('design-system')

      // the frozen export records it
      const snap = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/readiness-snapshots`,
        headers,
      })
      const doc = (
        await app.inject({
          method: 'GET',
          url: `/api/v1/readiness-snapshots/${json(snap).id as string}/export.json`,
          headers,
        })
      ).json() as { overrides: Array<{ control: string; from: string; to: string }> }
      expect(doc.overrides).toEqual([
        expect.objectContaining({
          control: CONTROL,
          from: 'REQUIRED_BY_SNAPSHOT',
          to: 'NOT_APPLICABLE_TO_CLASSIFICATION',
        }),
      ])

      // revoking it restores the evaluated result
      const overrideId = (json(rec).override as { id: string }).id
      await app.inject({
        method: 'POST',
        url: `/api/v1/applicability-overrides/${overrideId}/revoke`,
        headers,
      })
      const restored = row(
        await app.inject({ method: 'GET', url: `/api/v1/entities/${entityId}/matrix`, headers }),
      )
      expect(restored?.applicability).toBe('REQUIRED_BY_SNAPSHOT')
      expect(restored?.originalApplicability).toBeNull()
    })
  })

  it('rejects an override with no rationale', async () => {
    await withApp(async (app) => {
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
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/controls/${CONTROL}/applicability-override`,
        headers,
        payload: { result: 'NOT_APPLICABLE_TO_CLASSIFICATION' },
      })
      expect(res.statusCode).toBe(422)
    })
  })
})
