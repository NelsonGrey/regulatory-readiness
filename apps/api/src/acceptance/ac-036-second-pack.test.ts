/**
 * User-acceptance scenario for AC-036 — the engine is regulation-agnostic. A
 * second, unrelated control pack (EU Batteries Regulation / battery passport) is
 * created, evaluated, and served through the same endpoints with no engine code
 * change: different entity facts, different controls, different applicability.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { buildTestApp, type InjectResponse } from './helpers.js'

const PACK = 'eu-battery-passport'
const headers = { 'x-user-email': 'ops@battery.test', 'x-tenant-id': 't-batt' }

const evBattery = {
  packKey: PACK,
  name: 'PowerCell EV-90',
  entityIdentifier: 'powercell-ev-90',
  entityKind: 'product' as const,
  facts: {
    entityKind: 'product',
    placedOnMarketInEU: true,
    batteryCategory: 'ev',
    ratedCapacityGt2kWh: true,
    containsCobaltNickelLithiumLead: true,
    belowDueDiligenceThreshold: false,
  } as Record<string, string | number | boolean>,
}

const portableBattery = {
  ...evBattery,
  name: 'PowerCell AA',
  entityIdentifier: 'powercell-aa',
  facts: {
    entityKind: 'product',
    placedOnMarketInEU: true,
    batteryCategory: 'portable',
    ratedCapacityGt2kWh: false,
    containsCobaltNickelLithiumLead: false,
    belowDueDiligenceThreshold: true,
  } as Record<string, string | number | boolean>,
}

describe('AC-036 — a second, unrelated control pack', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildTestApp({ unitOfWork: inMemoryUnitOfWork(createInMemoryStores()) })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }
  const body = (r: InjectResponse) => r.json() as Record<string, any>

  it('is listed, has its own schema, and drives entity evaluation', async () => {
    await withApp(async (app) => {
      const list = await app.inject({ method: 'GET', url: '/api/v1/packs' })
      const keys = (body(list).packs as Array<{ packKey: string; valid: boolean }>).map(
        (p) => p.packKey,
      )
      expect(keys).toEqual(expect.arrayContaining(['eaa-accessibility', 'eu-battery-passport']))
      expect(
        (body(list).packs as Array<{ packKey: string; valid: boolean }>).find(
          (p) => p.packKey === PACK,
        )?.valid,
      ).toBe(true)

      const detail = await app.inject({ method: 'GET', url: `/api/v1/packs/${PACK}` })
      expect(body(detail).controlCount).toBe(8)
      expect(body(detail).snapshotKey).toBe('BATT-EU-2023-1542-V1-DRAFT')
      const factNames = (body(detail).entityFacts as Array<{ name: string }>).map((f) => f.name)
      expect(factNames).toEqual(
        expect.arrayContaining(['batteryCategory', 'containsCobaltNickelLithiumLead']),
      )

      // an EV battery: carbon-footprint + SoH + due-diligence all required
      const ev = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers,
        payload: evBattery,
      })
      expect(ev.statusCode).toBe(201)
      expect(body(ev).evaluation.snapshotKey).toBe('BATT-EU-2023-1542-V1-DRAFT')
      const evMatrix = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${body(ev).entity.id}/matrix`,
        headers,
      })
      const evRows = new Map(
        (body(evMatrix).rows as Array<{ control: string; applicability: string }>).map((r) => [
          r.control,
          r.applicability,
        ]),
      )
      expect(evRows.get('BATT-CF-DECLARATION')).toBe('REQUIRED_BY_SNAPSHOT')
      expect(evRows.get('BATT-PERF-SOH-DATA')).toBe('REQUIRED_BY_SNAPSHOT')
      expect(evRows.get('BATT-DD-POLICY')).toBe('REQUIRED_BY_SNAPSHOT')

      // a portable battery below the threshold: those same controls fall away
      const pb = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers,
        payload: portableBattery,
      })
      expect(pb.statusCode).toBe(201)
      const pbMatrix = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${body(pb).entity.id}/matrix`,
        headers,
      })
      const pbRows = new Map(
        (body(pbMatrix).rows as Array<{ control: string; applicability: string }>).map((r) => [
          r.control,
          r.applicability,
        ]),
      )
      expect(pbRows.get('BATT-CF-DECLARATION')).toBe('NOT_APPLICABLE_TO_CLASSIFICATION')
      expect(pbRows.get('BATT-CF-PERFORMANCE-CLASS')).toBe('NOT_APPLICABLE_TO_CLASSIFICATION')
      expect(pbRows.get('BATT-DD-POLICY')).toBe('NOT_APPLICABLE_TO_CLASSIFICATION')
      expect(pbRows.get('BATT-EOL-COLLECTION-INFO')).toBe('REQUIRED_BY_SNAPSHOT')
    })
  })

  it('rejects facts that do not match the battery-passport schema', async () => {
    await withApp(async (app) => {
      const bad = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers,
        payload: {
          ...evBattery,
          facts: { ...evBattery.facts, serviceType: 'consumer_banking' },
        },
      })
      expect(bad.statusCode).toBe(422)
      expect(body(bad).error.code).toBe('INVALID_FACTS')
    })
  })
})
