/**
 * User-acceptance scenario for AC-035 — the contributor portal link is emailed.
 * When the operator gives a recipient on create (or resend), the no-account
 * portal link is sent there; the link is still returned to the operator too.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import type { EmailMessage, EmailSender } from '../email/sender.js'
import { bankEntityRequest, buildTestApp, type InjectResponse } from './helpers.js'

const APP_URL = 'https://app.rre.test'
const CONTROLS = ['EAA-EN549-9-1-1-1', 'EAA-EN549-9-2-1-1']

function capturingSender(): { sender: EmailSender; sent: EmailMessage[] } {
  const sent: EmailMessage[] = []
  return {
    sent,
    sender: {
      kind: 'console',
      async send(m) {
        sent.push(m)
        return { ok: true }
      },
    },
  }
}

describe('AC-035 — emailed contributor request links', () => {
  const body = (r: InjectResponse) => r.json() as Record<string, any>

  it('emails the portal link on create and again with a fresh token on resend', async () => {
    const { sender, sent } = capturingSender()
    const app: FastifyInstance = buildTestApp({
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      emailSender: sender,
      appBaseUrl: APP_URL,
    })
    try {
      const su = await app.inject({
        method: 'POST',
        url: '/api/v1/sign-up',
        headers: { 'x-user-email': 'op@acme.test' },
        payload: { workspaceName: 'Acme' },
      })
      const h = { 'x-user-email': 'op@acme.test', 'x-tenant-id': body(su).workspace.id as string }

      const ent = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: h,
        payload: bankEntityRequest(),
      })
      const entityId = body(ent).entity.id as string

      const created = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/requests`,
        headers: h,
        payload: {
          controlKeys: CONTROLS,
          message: 'thanks!',
          recipientEmail: 'vendor@supplier.test',
        },
      })
      expect(created.statusCode).toBe(201)
      const token1 = body(created).token as string

      expect(sent).toHaveLength(1)
      expect(sent[0]!.to).toBe('vendor@supplier.test')
      expect(sent[0]!.subject).toContain('Acme Bank Online')
      expect(sent[0]!.text).toContain(`${APP_URL}/contribute/${token1}`)

      const requestId = body(created).request.id as string
      const resent = await app.inject({
        method: 'POST',
        url: `/api/v1/requests/${requestId}/resend`,
        headers: h,
        payload: { recipientEmail: 'vendor@supplier.test' },
      })
      expect(resent.statusCode).toBe(201)
      const token2 = body(resent).token as string
      expect(token2).not.toBe(token1)

      expect(sent).toHaveLength(2)
      expect(sent[1]!.text).toContain(`${APP_URL}/contribute/${token2}`)
    } finally {
      await app.close()
    }
  })

  it('omits the email when no recipient is given', async () => {
    const { sender, sent } = capturingSender()
    const app = buildTestApp({
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      emailSender: sender,
    })
    try {
      const su = await app.inject({
        method: 'POST',
        url: '/api/v1/sign-up',
        headers: { 'x-user-email': 'op@acme.test' },
        payload: { workspaceName: 'Acme' },
      })
      const h = { 'x-user-email': 'op@acme.test', 'x-tenant-id': body(su).workspace.id as string }
      const ent = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: h,
        payload: bankEntityRequest(),
      })
      const created = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${body(ent).entity.id}/requests`,
        headers: h,
        payload: { controlKeys: CONTROLS },
      })
      expect(created.statusCode).toBe(201)
      expect(sent).toHaveLength(0)
    } finally {
      await app.close()
    }
  })
})
