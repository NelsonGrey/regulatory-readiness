/**
 * User-acceptance scenario for AC-038 — pack sources of record are monitored.
 * A platform admin runs a sweep; when a watched URL's content moves, an open
 * change is raised carrying the packs that reference it, and can be acknowledged.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { buildTestApp, type InjectResponse } from './helpers.js'

const ADMIN = 'ann@rre.test'

describe('AC-038 — pack source monitoring', () => {
  const body = (r: InjectResponse) => r.json() as Record<string, any>

  it('sweep → detect a change → acknowledge', async () => {
    const bodies = new Map<string, string>()
    const fetchImpl = (async (url: string | URL | Request) =>
      new Response(bodies.get(String(url)) ?? 'v1', { status: 200 })) as typeof fetch

    const app: FastifyInstance = buildTestApp({
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      platformAdmins: [ADMIN],
      packSourceFetch: fetchImpl,
    })
    try {
      const asAdmin = { 'x-user-email': ADMIN }

      // non-admins are refused
      const outsider = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/pack-sources',
        headers: { 'x-user-email': 'nobody@x.test' },
      })
      expect(outsider.statusCode).toBe(403)

      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/pack-sources/sweep',
        headers: asAdmin,
      })
      expect(first.statusCode).toBe(200)
      expect(body(first).checked).toBeGreaterThan(0)
      expect(body(first).changed).toBe(0)

      const overview0 = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/pack-sources',
        headers: asAdmin,
      })
      const watchedUrl = (body(overview0).checks as Array<{ url: string }>)[0]!.url
      expect(body(overview0).openChanges).toHaveLength(0)

      // the page moves
      bodies.set(watchedUrl, 'a revised guidance note')
      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/pack-sources/sweep',
        headers: asAdmin,
      })
      expect(body(second).changed).toBe(1)

      const overview1 = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/pack-sources',
        headers: asAdmin,
      })
      const open = body(overview1).openChanges as Array<{
        id: string
        url: string
        packKeys: string[]
      }>
      expect(open).toHaveLength(1)
      expect(open[0]!.url).toBe(watchedUrl)
      expect(open[0]!.packKeys.length).toBeGreaterThan(0)

      const ack = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/pack-sources/changes/${open[0]!.id}/acknowledge`,
        headers: asAdmin,
      })
      expect(ack.statusCode).toBe(200)

      const overview2 = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/pack-sources',
        headers: asAdmin,
      })
      expect(body(overview2).openChanges).toHaveLength(0)
    } finally {
      await app.close()
    }
  })
})
