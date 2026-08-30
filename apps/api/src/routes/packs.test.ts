import { describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'

describe('GET /api/v1/packs/:packKey', () => {
  it('returns the entity-facts schema and control families for eaa-accessibility', async () => {
    const app = buildApp({ logLevel: 'error' })
    const res = await app.inject({ method: 'GET', url: '/api/v1/packs/eaa-accessibility' })
    expect(res.statusCode).toBe(200)

    const body = res.json() as {
      packKey: string
      snapshotKey: string
      controlCount: number
      controlFamilies: Array<{ family: string; count: number }>
      entityFacts: Array<{ name: string; type: string; required: boolean; enumValues?: string[] }>
      copy: { limitationStatement: string; forbiddenPhrases: string[] }
    }

    expect(body.packKey).toBe('eaa-accessibility')
    expect(body.snapshotKey).toBe('EAA-IE-EN549-V3.2.1-DRAFT')
    expect(body.controlCount).toBe(20)

    const web = body.controlFamilies.find((f) => f.family === 'web')
    expect(web?.count).toBe(9)

    const offered = body.entityFacts.find((f) => f.name === 'offeredToConsumersInIE')
    expect(offered).toMatchObject({ type: 'boolean', required: true })

    const serviceType = body.entityFacts.find((f) => f.name === 'serviceType')
    expect(serviceType?.type).toBe('enum')
    expect(serviceType?.enumValues).toContain('consumer_banking')

    expect(body.copy.forbiddenPhrases).toContain('fully accessible')

    await app.close()
  })

  it('404s for an unknown pack', async () => {
    const app = buildApp({ logLevel: 'error' })
    const res = await app.inject({ method: 'GET', url: '/api/v1/packs/no-such-pack' })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { error: { code: string } }).error.code).toBe('PACK_NOT_FOUND')
    await app.close()
  })
})
