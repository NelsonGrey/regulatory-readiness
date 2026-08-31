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

export interface ContributorRequestEmailInput {
  to: string
  entityName: string
  controlCount: number
  openUrl: string
  message?: string
  dueAt?: string
}

/** "Please provide information" — carries the no-account contributor portal link. */
export function contributorRequestEmail(input: ContributorRequestEmailInput): EmailMessage {
  const due = input.dueAt ? `\n\nRequested by: ${new Date(input.dueAt).toUTCString()}.` : ''
  const note = input.message ? `\n\nA note from the requester:\n${input.message}` : ''
  const text = [
    `You've been asked to provide information about "${input.entityName}" —`,
    `${input.controlCount} item${input.controlCount === 1 ? '' : 's'} to fill in. No account needed.`,
    ``,
    `Open the form: ${input.openUrl}${note}${due}`,
    ``,
    `This link is time-limited and personal to you. If it wasn't expected, ignore this email.`,
  ].join('\n')

  const html = [
    `<p>You've been asked to provide information about <strong>${esc(input.entityName)}</strong> — `,
    `${input.controlCount} item${input.controlCount === 1 ? '' : 's'} to fill in. No account needed.</p>`,
    `<p><a href="${esc(input.openUrl)}">Open the form</a></p>`,
    input.message
      ? `<p style="border-left:3px solid #ccc;padding-left:10px;color:#444">${esc(input.message)}</p>`
      : '',
    input.dueAt
      ? `<p style="color:#666;font-size:13px">Requested by ${esc(new Date(input.dueAt).toUTCString())}.</p>`
      : '',
    `<p style="color:#666;font-size:13px">This link is time-limited and personal to you. `,
    `If it wasn't expected, ignore this email.</p>`,
  ].join('')

  return { to: input.to, subject: `Information requested: ${input.entityName}`, text, html }
}
