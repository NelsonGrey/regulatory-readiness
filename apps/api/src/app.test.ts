import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('api', () => {
  it('GET /health returns ok', async () => {
    const app = buildApp({ logLevel: 'error' })
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', service: 'api' })
    await app.close()
  })

  it('GET /api/v1/packs lists the installed eaa-accessibility pack', async () => {
    const app = buildApp({ logLevel: 'error' })
    const res = await app.inject({ method: 'GET', url: '/api/v1/packs' })
    expect(res.statusCode).toBe(200)

    const body = res.json() as {
      packs: Array<{ packKey: string; status: string | null; valid: boolean }>
    }
    const eaa = body.packs.find((p) => p.packKey === 'eaa-accessibility')
    expect(eaa).toBeDefined()
    expect(eaa?.status).toBe('draft')
    expect(eaa?.valid).toBe(true)
    await app.close()
  })
})
