import { beforeEach, describe, expect, it } from 'vitest'
import { buildTestApp } from '../acceptance/helpers.js'

const bankFacts = {
  offeredToConsumersInIE: true,
  serviceType: 'consumer_banking',
  operatorRole: 'provider',
  isMicroEnterprise: false,
  hasWebsite: true,
  hasMobileApp: true,
  hasNonWebSoftware: false,
  providesDownloadableDocuments: false,
  usesSelfServiceTerminals: false,
  disproportionateBurdenClaimed: false,
  fundamentalAlterationClaimed: false,
}

const createBody = {
  packKey: 'eaa-accessibility',
  name: 'Acme Bank Online',
  entityIdentifier: 'acme-online',
  entityKind: 'service',
  facts: bankFacts,
}

type App = ReturnType<typeof buildTestApp>

describe('POST /api/v1/entities + matrix', () => {
  let app: App

  beforeEach(() => {
    app = buildTestApp({ logLevel: 'error' })
  })

  it('creates an entity with an immutable scope evaluation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers: { 'x-tenant-id': 't-alpha', 'x-actor': 'manager@acme' },
      payload: createBody,
    })
    expect(res.statusCode).toBe(201)

    const body = res.json() as {
      entity: { id: string; tenantId: string; packKey: string; createdBy: string }
      evaluation: { hash: string; snapshotKey: string; version: number }
    }
    expect(body.entity.id).toMatch(/^ent_/)
    expect(body.entity.tenantId).toBe('t-alpha')
    expect(body.entity.createdBy).toBe('manager@acme')
    expect(body.evaluation.snapshotKey).toBe('EAA-IE-EN549-V3.2.1-DRAFT')
    expect(body.evaluation.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(body.evaluation.version).toBe(1)
  })

  it('returns a truthful applicability matrix', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers: { 'x-tenant-id': 't-alpha' },
      payload: createBody,
    })
    const { entity } = created.json() as { entity: { id: string } }

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${entity.id}/matrix`,
      headers: { 'x-tenant-id': 't-alpha' },
    })
    expect(res.statusCode).toBe(200)

    const matrix = res.json() as {
      summary: { total: number; requiredNow: number; notApplicable: number; optional: number }
      entityStatus: string
      readinessCounts: Record<string, number>
      rows: Array<{
        control: string
        applicability: string
        readiness: string
        pendingClaims: number
      }>
    }
    expect(matrix.summary.total).toBe(20)
    expect(matrix.summary.requiredNow).toBeGreaterThan(0)

    // With no claims yet, every required control is MISSING and the entity is BLOCKED.
    expect(matrix.entityStatus).toBe('BLOCKED')
    expect(matrix.readinessCounts.MISSING).toBeGreaterThan(0)

    const rows = new Map(matrix.rows.map((r) => [r.control, r]))
    expect(rows.get('EAA-EN549-9-1-1-1')).toMatchObject({
      applicability: 'REQUIRED_BY_SNAPSHOT',
      readiness: 'MISSING',
      pendingClaims: 0,
    })
    expect(rows.get('EAA-EN549-10-1-1-1')).toMatchObject({
      applicability: 'NOT_APPLICABLE_TO_CLASSIFICATION',
      readiness: 'NOT_APPLICABLE',
    })
    expect(rows.get('EAA-EN549-9-2-4-11')?.applicability).toBe('OPTIONAL_IF_AVAILABLE')
  })

  it('does not disclose an entity to another tenant', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers: { 'x-tenant-id': 't-alpha' },
      payload: createBody,
    })
    const { entity } = created.json() as { entity: { id: string } }

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${entity.id}/matrix`,
      headers: { 'x-tenant-id': 't-bravo' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects missing required facts with a field-level error', async () => {
    const { usesSelfServiceTerminals: _omit, ...partial } = bankFacts
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers: { 'x-tenant-id': 't-alpha' },
      payload: { ...createBody, facts: partial },
    })
    expect(res.statusCode).toBe(422)
    const body = res.json() as { error: { code: string; issues?: Array<{ fact: string }> } }
    expect(body.error.code).toBe('INVALID_FACTS')
    expect(body.error.issues?.some((i) => i.fact === 'usesSelfServiceTerminals')).toBe(true)
  })

  it('404s for an unknown pack', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers: { 'x-tenant-id': 't-alpha' },
      payload: { ...createBody, packKey: 'no-such-pack' },
    })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { error: { code: string } }).error.code).toBe('PACK_NOT_FOUND')
  })

  it('401s without a tenant header', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/entities', payload: createBody })
    expect(res.statusCode).toBe(401)
  })

  it('lists the workspace entities, newest first, scoped to the tenant', async () => {
    for (const id of ['first', 'second']) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { 'x-tenant-id': 't-alpha', 'x-actor': 'manager@acme' },
        payload: { ...createBody, entityIdentifier: id, name: `Acme ${id}` },
      })
    }
    await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers: { 'x-tenant-id': 't-bravo' },
      payload: { ...createBody, entityIdentifier: 'other' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entities',
      headers: { 'x-tenant-id': 't-alpha' },
    })
    expect(res.statusCode).toBe(200)
    const { entities } = res.json() as {
      entities: Array<{ name: string; packKey: string; snapshotKey: string }>
    }
    expect(entities.map((e) => e.name).sort()).toEqual(['Acme first', 'Acme second'])
    expect(entities.every((e) => e.packKey === 'eaa-accessibility')).toBe(true)
    expect(entities.every((e) => e.snapshotKey === 'EAA-IE-EN549-V3.2.1-DRAFT')).toBe(true)
  })
})
