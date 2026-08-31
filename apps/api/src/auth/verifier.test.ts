import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'
import { headerVerifier, jwtVerifier } from './verifier.js'
import { verifyJwt, type Jwks } from './jwt.js'

const ISS = 'https://idp.test'
const AUD = 'rre-api'

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const other = generateKeyPairSync('rsa', { modulusLength: 2048 })

const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>
const jwks: Jwks = { keys: [{ ...(jwk as { kty: string }), kid: 'k1', use: 'sig', alg: 'RS256' }] }

const b64url = (b: Buffer | string): string => Buffer.from(b).toString('base64url')

function mint(
  claims: Record<string, unknown>,
  opts: { kid?: string; key?: typeof privateKey } = {},
): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: opts.kid ?? 'k1' }))
  const payload = b64url(JSON.stringify(claims))
  const s = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), opts.key ?? privateKey)
  return `${header}.${payload}.${b64url(s)}`
}

const future = Math.floor(Date.now() / 1000) + 3600
const req = (headers: Record<string, string>): FastifyRequest =>
  ({ headers }) as unknown as FastifyRequest

describe('verifyJwt', () => {
  const base = { sub: 'user_1', email: 'a@acme.test', iss: ISS, aud: AUD, exp: future }

  it('accepts a well-formed, correctly-signed token', () => {
    expect(verifyJwt(mint(base), { jwks, issuer: ISS, audience: AUD })).toMatchObject({
      sub: 'user_1',
      email: 'a@acme.test',
    })
  })

  it('rejects a bad issuer, bad audience, or expired token', () => {
    expect(verifyJwt(mint({ ...base, iss: 'https://evil' }), { jwks, issuer: ISS })).toBeNull()
    expect(verifyJwt(mint(base), { jwks, issuer: ISS, audience: 'someone-else' })).toBeNull()
    expect(
      verifyJwt(mint({ ...base, exp: Math.floor(Date.now() / 1000) - 10 }), { jwks, issuer: ISS }),
    ).toBeNull()
  })

  it('rejects a token signed by an unknown key or tampered', () => {
    expect(verifyJwt(mint(base, { key: other.privateKey }), { jwks, issuer: ISS })).toBeNull()
    const t = mint(base)
    const tampered = `${t.slice(0, -4)}AAAA`
    expect(verifyJwt(tampered, { jwks, issuer: ISS })).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifyJwt('not.a.jwt', { jwks, issuer: ISS })).toBeNull()
    expect(verifyJwt('', { jwks, issuer: ISS })).toBeNull()
  })
})

describe('jwtVerifier', () => {
  it('maps sub/email/name from a valid bearer token', async () => {
    const v = jwtVerifier({ issuer: ISS, audience: AUD, jwks })
    const token = mint({
      sub: 'u_9',
      email: 'pat@acme.test',
      name: 'Pat',
      iss: ISS,
      aud: AUD,
      exp: future,
    })
    expect(await v.verify(req({ authorization: `Bearer ${token}` }))).toEqual({
      userId: 'u_9',
      email: 'pat@acme.test',
      name: 'Pat',
    })
  })

  it('returns null without a bearer token, or when email is absent', async () => {
    const v = jwtVerifier({ issuer: ISS, jwks })
    expect(await v.verify(req({}))).toBeNull()
    const noEmail = mint({ sub: 'u_1', iss: ISS, exp: future })
    expect(await v.verify(req({ authorization: `Bearer ${noEmail}` }))).toBeNull()
  })

  it('fetches the JWKS from jwksUri and caches it', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200 }))
    const v = jwtVerifier({ issuer: ISS, jwksUri: 'https://idp.test/jwks', fetchImpl })
    const token = mint({ sub: 'u_2', email: 'x@acme.test', iss: ISS, exp: future })

    expect(await v.verify(req({ authorization: `Bearer ${token}` }))).toMatchObject({
      userId: 'u_2',
    })
    expect(await v.verify(req({ authorization: `Bearer ${token}` }))).toMatchObject({
      userId: 'u_2',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('headerVerifier', () => {
  it('reads x-user-email (dev stand-in)', async () => {
    const v = headerVerifier()
    const p = await v.verify(req({ 'x-user-email': 'dev@acme.test', 'x-user-name': 'Dev' }))
    expect(p).toMatchObject({ email: 'dev@acme.test', name: 'Dev' })
    expect(p?.userId).toMatch(/^usr_[0-9a-f]{24}$/)
    expect(await v.verify(req({}))).toBeNull()
  })
})
