import { describe, expect, it } from 'vitest'
import { can } from './index.js'

describe('can', () => {
  it('grants ORG_ADMIN everything', () => {
    expect(can('ORG_ADMIN', 'security.manage')).toBe(true)
    expect(can('ORG_ADMIN', 'users.manage')).toBe(true)
  })

  it('does not let a manager manage users or security', () => {
    expect(can('COMPLIANCE_MANAGER', 'users.manage')).toBe(false)
    expect(can('COMPLIANCE_MANAGER', 'security.manage')).toBe(false)
    expect(can('COMPLIANCE_MANAGER', 'request.send')).toBe(true)
  })

  it('does not let a technical approver send requests or create shares', () => {
    expect(can('TECHNICAL_APPROVER', 'request.send')).toBe(false)
    expect(can('TECHNICAL_APPROVER', 'share.create')).toBe(false)
    expect(can('TECHNICAL_APPROVER', 'claim.review')).toBe(true)
  })

  it('grants reviewers and contributors no workspace capabilities', () => {
    expect(can('REVIEWER', 'portfolio.view')).toBe(false)
    expect(can('SUPPLIER_CONTRIBUTOR', 'evidence.upload')).toBe(false)
  })
})
