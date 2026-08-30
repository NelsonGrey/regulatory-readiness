/**
 * User-acceptance scenarios for AC-003 (entity scope + applicability) and
 * AC-004 (truthful readiness), exercised through the HTTP API.
 * Engine detailed design 02 (ENT-001, MAT-001) and 04 (AC-003, AC-004).
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { ApplicabilitySummary } from '@rre/domain'
import { buildApp } from '../app.js'
import {
  APPLICABILITY_RESULTS,
  bankEntityRequest,
  createEntity,
  getMatrix,
  TENANT,
} from './helpers.js'

describe('AC-003 — entity scope and applicability', () => {
  let app: FastifyInstance

  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    app = buildApp({ logLevel: 'error' })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }

  it('records the exact scope values, pack + snapshot, evaluation version, actor and time', async () => {
    await withApp(async (app) => {
      // Given a manager creating an accessibility entity for a bank service
      const res = await createEntity(app, bankEntityRequest())
      expect(res.statusCode).toBe(201)
      const body = res.json() as {
        entity: Record<string, unknown>
        evaluation: { snapshotKey: string; hash: string; version: number }
      }

      // Then the created record reflects the input and the controlling snapshot
      expect(body.entity).toMatchObject({
        tenantId: TENANT,
        packKey: 'eaa-accessibility',
        name: 'Acme Bank Online',
        entityIdentifier: 'acme-online',
        entityKind: 'service',
        createdBy: 'manager@acme',
      })
      expect(new Date(String(body.entity.createdAt)).toISOString()).toBe(body.entity.createdAt)
      expect(body.evaluation.snapshotKey).toBe('EAA-IE-EN549-V3.2.1-DRAFT')
      expect(body.evaluation.version).toBe(1)
      expect(body.evaluation.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    })
  })

  it('does not silently map an unsupported pack onto another pack’s rules', async () => {
    await withApp(async (app) => {
      const res = await createEntity(app, { ...bankEntityRequest(), packKey: 'not-a-real-pack' })
      expect(res.statusCode).toBe(404)
      const body = res.json() as { error: { code: string; message: string } }
      expect(body.error.code).toBe('PACK_NOT_FOUND')
      expect(body.error.message).toContain('not-a-real-pack')
    })
  })

  it('rejects a facts/entityKind contradiction instead of coercing it', async () => {
    await withApp(async (app) => {
      const req = bankEntityRequest()
      const res = await createEntity(app, {
        ...req,
        entityKind: 'service',
        facts: { ...req.facts, entityKind: 'product' },
      })
      expect(res.statusCode).toBe(422)
      expect((res.json() as { error: { code: string } }).error.code).toBe('KIND_MISMATCH')
    })
  })
})

describe('AC-004 — truthful readiness matrix', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildApp({ logLevel: 'error' })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }

  it('reconciles the state counts and never labels the result compliant or certified', async () => {
    await withApp(async (app) => {
      const created = await createEntity(app, bankEntityRequest())
      const id = (created.json() as { entity: { id: string } }).entity.id

      const res = await getMatrix(app, id)
      expect(res.statusCode).toBe(200)
      const matrix = res.json() as {
        summary: ApplicabilitySummary
        rows: Array<{ control: string; applicability: string; reason?: string }>
      }

      // counts reconcile with the rows
      const sumOfBuckets =
        matrix.summary.requiredNow +
        matrix.summary.optional +
        matrix.summary.conditional +
        matrix.summary.notApplicable +
        matrix.summary.notYetRequired +
        matrix.summary.needsSpecialistReview +
        matrix.summary.duplicate
      expect(sumOfBuckets).toBe(matrix.summary.total)
      expect(matrix.summary.total).toBe(matrix.rows.length)

      // every row carries a known applicability result
      for (const row of matrix.rows) {
        expect(APPLICABILITY_RESULTS).toContain(row.applicability)
      }

      // neutral / optional rows are not folded into "required now"
      const requiredRows = matrix.rows.filter((r) => r.applicability === 'REQUIRED_BY_SNAPSHOT')
      expect(requiredRows.length).toBe(matrix.summary.requiredNow)
      expect(matrix.rows.some((r) => r.applicability === 'NOT_APPLICABLE_TO_CLASSIFICATION')).toBe(
        true,
      )

      // no compliance / certification language anywhere in the payload
      const raw = res.body.toLowerCase()
      for (const banned of ['compliant', 'certified', 'guaranteed', '% compliance', 'accredited']) {
        expect(raw).not.toContain(banned)
      }
    })
  })

  it('applies rule modifiers: a disproportionate-burden claim makes the burden control required', async () => {
    await withApp(async (app) => {
      const req = bankEntityRequest()
      const created = await createEntity(app, {
        ...req,
        facts: {
          ...req.facts,
          usesSelfServiceTerminals: true,
          providesDownloadableDocuments: true,
          disproportionateBurdenClaimed: true,
        },
      })
      const id = (created.json() as { entity: { id: string } }).entity.id
      const matrix = (await getMatrix(app, id)).json() as {
        rows: Array<{ control: string; applicability: string }>
      }
      const burden = matrix.rows.find((r) => r.control === 'EAA-PROC-DISPROPORTIONATE-BURDEN')
      expect(burden?.applicability).toBe('REQUIRED_BY_SNAPSHOT')
    })
  })
})
