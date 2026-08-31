/**
 * User-acceptance scenario for AC-032 — a real identity provider behind the
 * membership hook. With a JWT verifier wired in (no header stand-in), an RS256
 * bearer token from the IdP resolves to the person; the membership + role checks
 * then apply exactly as before.
 */
import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { jwtVerifier } from '../auth/verifier.js'
import type { Jwks } from '../auth/jwt.js'
import { bankEntityRequest, type InjectResponse } from './helpers.js'

const ISS = 'https://idp.example'
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwks: Jwks = {
  keys: [{ ...(publicKey.export({ format: 'jwk' }) as { kty: string }), kid: 'k1', alg: 'RS256' }],
}
const b64url = (b: Buffer | string): string => Buffer.from(b).toString('base64url')

function token(sub: string, email: string): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'k1' }))
  const payload = b64url(
    JSON.stringify({ sub, email, iss: ISS, exp: Math.floor(Date.now() / 1000) + 3600 }),
  )
  return `${header}.${payload}.${b64url(sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey))}`
}

describe('AC-032 — JWT identity behind the membership hook', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildApp({
      logLevel: 'error',
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      principalVerifier: jwtVerifier({ issuer: ISS, jwks }),
      // devAuth stays off — the token is the only way in
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }
  const body = (r: InjectResponse) => r.json() as Record<string, any>

  it('a bearer token signs up, then works on feature routes; a bad token is refused', async () => {
    await withApp(async (app) => {
      const founder = token('idp_user_1', 'founder@acme.test')

      const signup = await app.inject({
        method: 'POST',
        url: '/api/v1/sign-up',
        headers: { authorization: `Bearer ${founder}` },
        payload: { workspaceName: 'Acme' },
      })
      expect(signup.statusCode).toBe(201)
      const ws = body(signup).workspace.id as string

      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { authorization: `Bearer ${founder}`, 'x-tenant-id': ws },
        payload: bankEntityRequest(),
      })
      expect(created.statusCode).toBe(201)
      expect(body(created).entity.createdBy).toBe('founder@acme.test')

      // no token → 401
      const anon = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { 'x-tenant-id': ws },
        payload: bankEntityRequest(),
      })
      expect(anon.statusCode).toBe(401)

      // a syntactically-fine but unverifiable token → 401
      const bad = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { authorization: 'Bearer aaa.bbb.ccc', 'x-tenant-id': ws },
        payload: bankEntityRequest(),
      })
      expect(bad.statusCode).toBe(401)

      // a valid token for someone who is not a member → 403
      const outsider = token('idp_user_2', 'outsider@nope.test')
      const forbidden = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { authorization: `Bearer ${outsider}`, 'x-tenant-id': ws },
        payload: bankEntityRequest(),
      })
      expect(forbidden.statusCode).toBe(403)
    })
  })
})
