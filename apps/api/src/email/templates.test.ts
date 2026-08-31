import { describe, expect, it } from 'vitest'
import { scanMarketingCopy } from '@rre/copy-guard'
import { contributorRequestEmail, inviteEmail } from './templates.js'

describe('inviteEmail', () => {
  const msg = inviteEmail({
    to: 'newbie@acme.test',
    workspaceName: 'Acme Bakery',
    inviterEmail: 'owner@acme.test',
    role: 'member',
    acceptUrl: 'https://app.rre.test/join/tok_abc',
    expiresAt: '2026-09-20T00:00:00.000Z',
  })

  it('addresses the invitee and carries the one-time link', () => {
    expect(msg.to).toBe('newbie@acme.test')
    expect(msg.subject).toContain('Acme Bakery')
    expect(msg.text).toContain('https://app.rre.test/join/tok_abc')
    expect(msg.text).toContain('owner@acme.test')
    expect(msg.text).toMatch(/single-use/i)
    expect(msg.html).toContain('href="https://app.rre.test/join/tok_abc"')
  })

  it('uses no forbidden compliance language', () => {
    expect(scanMarketingCopy(`${msg.subject}\n${msg.text}\n${msg.html}`)).toEqual([])
  })
})

describe('contributorRequestEmail', () => {
  const msg = contributorRequestEmail({
    to: 'supplier@vendor.test',
    entityName: 'Acme Bank Online',
    controlCount: 3,
    openUrl: 'https://app.rre.test/contribute/tok_xyz',
    message: 'Please answer by Friday.',
    dueAt: '2026-09-25T00:00:00.000Z',
  })

  it('carries the no-account portal link, the entity, the note and the due date', () => {
    expect(msg.to).toBe('supplier@vendor.test')
    expect(msg.subject).toContain('Acme Bank Online')
    expect(msg.text).toContain('https://app.rre.test/contribute/tok_xyz')
    expect(msg.text).toContain('3 items')
    expect(msg.text).toContain('Please answer by Friday.')
    expect(msg.text).toMatch(/no account/i)
  })

  it('uses no forbidden compliance language', () => {
    expect(scanMarketingCopy(`${msg.subject}\n${msg.text}\n${msg.html}`)).toEqual([])
  })
})
