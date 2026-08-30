/**
 * UAT for AC-006 (least-disclosure request) and AC-007 (contributor completion
 * without an account), through the operator API and the contributor portal.
 */
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PackRegistry } from '../pack-registry.js'
import { buildApp } from '../app.js'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest } from './helpers.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const op = { 'x-tenant-id': 't-demo', 'x-actor': 'manager@acme' }
const REQUESTED = ['EAA-EN549-9-1-1-1', 'EAA-EN549-9-2-1-1']

let registry: PackRegistry
beforeAll(async () => {
  registry = await PackRegistry.load(PACKS_DIR)
})

function freshApp(): FastifyInstance {
  const stores = createInMemoryStores()
  return buildApp({
    logLevel: 'error',
    packRegistry: registry,
    unitOfWork: inMemoryUnitOfWork(stores),
    resolveGrant: async (hash) => stores.grants.find((g) => g.tokenHash === hash) ?? null,
  })
}

async function createEntity(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/entities',
    headers: op,
    payload: bankEntityRequest(),
  })
  return (res.json() as { entity: { id: string } }).entity.id
}

async function createRequest(app: FastifyInstance, entityId: string) {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/entities/${entityId}/requests`,
    headers: op,
    payload: { controlKeys: REQUESTED, message: 'please supply' },
  })
  return res
}

describe('AC-006 — least-disclosure request', () => {
  it('the request and the contributor view expose only the requested controls', async () => {
    const app = freshApp()
    try {
      const entityId = await createEntity(app)
      const created = await createRequest(app, entityId)
      expect(created.statusCode).toBe(201)
      const body = created.json() as {
        request: { id: string }
        items: Array<{ controlKey: string }>
        token: string
        contributorPath: string
      }
      expect(body.items.map((i) => i.controlKey).sort()).toEqual([...REQUESTED].sort())
      expect(body.token).toMatch(/^[A-Za-z0-9_-]{20,}$/)

      const view = await app.inject({ method: 'GET', url: body.contributorPath })
      expect(view.statusCode).toBe(200)
      expect(view.headers['cache-control']).toBe('no-store')
      expect(view.headers['referrer-policy']).toBe('no-referrer')

      const seen = view.json() as {
        entityName: string
        items: Array<{ controlKey: string; required: boolean }>
      }
      expect(seen.items.map((i) => i.controlKey).sort()).toEqual([...REQUESTED].sort())
      // no other workspace / entity data
      expect(view.body).not.toContain('EAA-EN549-10-1-1-1')
      expect(view.body).not.toContain('t-demo')
    } finally {
      await app.close()
    }
  })

  it('the operator request detail never returns the plaintext token', async () => {
    const app = freshApp()
    try {
      const entityId = await createEntity(app)
      const { request, token } = (await createRequest(app, entityId)).json() as {
        request: { id: string }
        token: string
      }
      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/requests/${request.id}`,
        headers: op,
      })
      expect(detail.body).not.toContain(token)
      expect(
        (detail.json() as { grants: Array<{ tokenPrefix: string }> }).grants[0]?.tokenPrefix,
      ).toHaveLength(8)
    } finally {
      await app.close()
    }
  })
})

describe('AC-007 — contributor completion without an account', () => {
  it('submits values with no account, gets a receipt, and the operator can accept one into review', async () => {
    const app = freshApp()
    try {
      const entityId = await createEntity(app)
      const created = (await createRequest(app, entityId)).json() as {
        request: { id: string }
        items: Array<{ id: string; controlKey: string }>
        token: string
        contributorPath: string
      }

      const submit = await app.inject({
        method: 'POST',
        url: `${created.contributorPath}/submit`,
        payload: {
          submitterIdentity: 'Jane at Vendor Co',
          items: created.items.map((i) => ({
            requestItemId: i.id,
            availabilityState: 'VALUE_SUPPLIED',
            value: `evidence for ${i.controlKey}`,
          })),
        },
      })
      expect(submit.statusCode).toBe(201)
      const receipt = submit.json() as { receiptId: string; itemCount: number; note: string }
      expect(receipt.receiptId).toMatch(/^rcpt_/)
      expect(receipt.itemCount).toBe(2)
      expect(receipt.note).toMatch(/not yet accepted or approved/i)

      // operator sees the submission (not the token) and accepts one response into review
      const detail = (
        await app.inject({
          method: 'GET',
          url: `/api/v1/requests/${created.request.id}`,
          headers: op,
        })
      ).json() as {
        request: { status: string }
        submissions: Array<{ id: string; responses: Array<{ id: string; controlKey: string }> }>
      }
      expect(detail.request.status).toBe('SUBMITTED')
      const sub = detail.submissions[0]!
      const responseId = sub.responses.find((r) => r.controlKey === 'EAA-EN549-9-1-1-1')!.id

      const accept = await app.inject({
        method: 'POST',
        url: `/api/v1/submissions/${sub.id}/items/${responseId}/accept`,
        headers: op,
      })
      expect(accept.statusCode).toBe(201)

      const queue = (
        await app.inject({
          method: 'GET',
          url: `/api/v1/entities/${entityId}/review-queue`,
          headers: op,
        })
      ).json() as { items: Array<{ controlKey: string; origin: string; value: string }> }
      expect(queue.items).toHaveLength(1)
      expect(queue.items[0]).toMatchObject({
        controlKey: 'EAA-EN549-9-1-1-1',
        origin: 'SUPPLIER_ASSERTION',
      })
    } finally {
      await app.close()
    }
  })

  it('blocks submission when a required item is unanswered', async () => {
    const app = freshApp()
    try {
      const entityId = await createEntity(app)
      const created = (await createRequest(app, entityId)).json() as {
        items: Array<{ id: string }>
        contributorPath: string
      }
      const res = await app.inject({
        method: 'POST',
        url: `${created.contributorPath}/submit`,
        payload: {
          items: [
            {
              requestItemId: created.items[0]!.id,
              availabilityState: 'VALUE_SUPPLIED',
              value: 'only one',
            },
          ],
        },
      })
      expect(res.statusCode).toBe(422)
      expect((res.json() as { error: { code: string } }).error.code).toBe('INCOMPLETE')
    } finally {
      await app.close()
    }
  })

  it('a revoked link and a garbage token both return the same generic response', async () => {
    const app = freshApp()
    try {
      const entityId = await createEntity(app)
      const created = (await createRequest(app, entityId)).json() as {
        request: { id: string }
        contributorPath: string
      }
      await app.inject({
        method: 'POST',
        url: `/api/v1/requests/${created.request.id}/revoke`,
        headers: op,
      })

      const revoked = await app.inject({ method: 'GET', url: created.contributorPath })
      expect(revoked.statusCode).toBe(404)
      expect((revoked.json() as { error: { code: string } }).error.code).toBe('INVALID_LINK')

      const garbage = await app.inject({
        method: 'GET',
        url: '/contributor/v1/requests/not-a-token',
      })
      expect(garbage.statusCode).toBe(404)
      expect((garbage.json() as { error: { code: string } }).error.code).toBe('INVALID_LINK')
    } finally {
      await app.close()
    }
  })
})
