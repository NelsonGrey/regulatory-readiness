/**
 * Transactional email. `console` is the default — it logs the message so dev and
 * tests see exactly what would be sent; a real adapter (Resend below) posts it.
 */
export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface EmailSender {
  readonly kind: 'console' | 'resend'
  send(message: EmailMessage): Promise<{ ok: boolean; id?: string }>
}

export function consoleEmailSender(
  log: (event: string, meta: Record<string, unknown>) => void = (e, m) =>
    console.log(e, JSON.stringify(m)),
): EmailSender {
  return {
    kind: 'console',
    async send(message) {
      log('email.send (console)', {
        to: message.to,
        subject: message.subject,
        preview: message.text.slice(0, 200),
      })
      return { ok: true }
    },
  }
}

export interface ResendConfig {
  apiKey: string
  /** The verified `From:` address, e.g. `Regulatory Readiness <hello@rre.example>`. */
  from: string
  fetchImpl?: typeof fetch
}

/** Resend (`https://api.resend.com/emails`) — a single JSON POST, no SDK. */
export function resendEmailSender(cfg: ResendConfig): EmailSender {
  const doFetch = cfg.fetchImpl ?? fetch
  return {
    kind: 'resend',
    async send(message) {
      const res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cfg.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: cfg.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
      })
      if (!res.ok) return { ok: false }
      const body = (await res.json().catch(() => ({}))) as { id?: string }
      return { ok: true, id: body.id }
    },
  }
}
