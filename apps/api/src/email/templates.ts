import type { EmailMessage } from './sender.js'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface InviteEmailInput {
  to: string
  workspaceName: string
  inviterEmail: string
  role: string
  acceptUrl: string
  expiresAt: string
}

/** "You've been invited to a workspace" — carries the one-time accept link. */
export function inviteEmail(input: InviteEmailInput): EmailMessage {
  const expires = new Date(input.expiresAt).toUTCString()
  const text = [
    `${input.inviterEmail} has invited you to the "${input.workspaceName}" workspace on the`,
    `Regulatory Readiness Engine as a ${input.role}.`,
    ``,
    `Accept the invite: ${input.acceptUrl}`,
    ``,
    `This link is single-use and expires ${expires}. If you weren't expecting this, ignore it.`,
  ].join('\n')

  const html = [
    `<p><strong>${esc(input.inviterEmail)}</strong> has invited you to the `,
    `<strong>${esc(input.workspaceName)}</strong> workspace on the Regulatory Readiness Engine `,
    `as a ${esc(input.role)}.</p>`,
    `<p><a href="${esc(input.acceptUrl)}">Accept the invite</a></p>`,
    `<p style="color:#666;font-size:13px">This link is single-use and expires ${esc(expires)}. `,
    `If you weren't expecting this, ignore this email.</p>`,
  ].join('')

  return {
    to: input.to,
    subject: `You've been invited to "${input.workspaceName}"`,
    text,
    html,
  }
}
