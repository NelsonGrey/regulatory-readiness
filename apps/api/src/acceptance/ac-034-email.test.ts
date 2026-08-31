/**
 * User-acceptance scenario for AC-034 — teammate invites are emailed. The invite
 * still returns its one-time link (the UI shows it), and a mail-provider outage
 * does not break the invite.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import type { EmailMessage, EmailSender } from '../email/sender.js'
import { buildTestApp, type InjectResponse } from './helpers.js'

const APP_URL = 'https://app.rre.test'

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

describe('AC-034 — invite emails', () => {
  const body = (r: InjectResponse) => r.json() as Record<string, any>

  const signUpAndWorkspace = async (app: FastifyInstance): Promise<string> => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/sign-up',
      headers: { 'x-user-email': 'founder@acme.test' },
      payload: { workspaceName: 'Acme Bakery' },
    })
    return body(r).workspace.id as string
  }

  it('sends the invite email with the one-time join link', async () => {
    const { sender, sent } = capturingSender()
    const app = buildTestApp({
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      emailSender: sender,
      appBaseUrl: APP_URL,
    })
    try {
      const ws = await signUpAndWorkspace(app)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/members/invites',
        headers: { 'x-user-email': 'founder@acme.test', 'x-tenant-id': ws },
        payload: { email: 'friend@acme.test', role: 'member' },
      })
      expect(res.statusCode).toBe(201)
      const token = body(res).token as string

      expect(sent).toHaveLength(1)
      expect(sent[0]!.to).toBe('friend@acme.test')
      expect(sent[0]!.subject).toContain('Acme Bakery')
      expect(sent[0]!.text).toContain(`${APP_URL}/join/${token}`)
    } finally {
      await app.close()
    }
  })

  it('still issues the invite when the mail provider throws', async () => {
    const app = buildTestApp({
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      emailSender: {
        kind: 'console',
        async send() {
          throw new Error('mail provider unavailable')
        },
      },
    })
    try {
      const ws = await signUpAndWorkspace(app)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/members/invites',
        headers: { 'x-user-email': 'founder@acme.test', 'x-tenant-id': ws },
        payload: { email: 'friend@acme.test', role: 'member' },
      })
      expect(res.statusCode).toBe(201)
      expect(body(res).token).toBeTruthy()
    } finally {
      await app.close()
    }
  })
})
