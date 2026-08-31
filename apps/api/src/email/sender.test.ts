import { describe, expect, it, vi } from 'vitest'
import { consoleEmailSender, resendEmailSender } from './sender.js'

const msg = { to: 'pat@acme.test', subject: 'Hi', text: 'body', html: '<p>body</p>' }

describe('resendEmailSender', () => {
  it('POSTs to the Resend API with auth and the message body', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'eml_1' }), { status: 200 }),
    )
    const sender = resendEmailSender({ apiKey: 're_test', from: 'RRE <hi@rre.test>', fetchImpl })

    expect(await sender.send(msg)).toEqual({ ok: true, id: 'eml_1' })

    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect(init?.headers).toMatchObject({ authorization: 'Bearer re_test' })
    expect(JSON.parse(init?.body as string)).toEqual({
      from: 'RRE <hi@rre.test>',
      to: 'pat@acme.test',
      subject: 'Hi',
      text: 'body',
      html: '<p>body</p>',
    })
  })

  it('reports failure on a non-2xx response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 422 }))
    const sender = resendEmailSender({ apiKey: 're_x', from: 'x', fetchImpl })
    expect(await sender.send(msg)).toEqual({ ok: false })
  })
})

describe('consoleEmailSender', () => {
  it('logs the message and reports ok', async () => {
    const log = vi.fn()
    const sender = consoleEmailSender(log)
    expect(await sender.send(msg)).toEqual({ ok: true })
    expect(log).toHaveBeenCalledWith(
      'email.send (console)',
      expect.objectContaining({ to: 'pat@acme.test', subject: 'Hi' }),
    )
  })
})
