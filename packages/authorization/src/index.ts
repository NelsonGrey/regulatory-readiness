/**
 * Roles, capabilities, and the capability matrix. Authorization is always
 * enforced server-side on every object and action (engine TRD §15.3);
 * this package is the single place the matrix lives.
 *
 * Contributor and reviewer principals are NOT workspace roles — they are scoped
 * token principals handled separately (engine TRD §15.3, detailed design 03).
 */

export const WORKSPACE_ROLES = [
  'ORG_ADMIN',
  'COMPLIANCE_MANAGER',
  'TECHNICAL_APPROVER',
  'REVIEWER',
  'SUPPLIER_CONTRIBUTOR',
  'PLATFORM_SUPPORT',
] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export const CAPABILITIES = [
  'portfolio.view',
  'entity.create',
  'entity.editFacts',
  'control.assignOwner',
  'request.send',
  'evidence.upload',
  'claim.review',
  'conflict.resolve',
  'snapshot.create',
  'export.create',
  'share.create',
  'users.manage',
  'security.manage',
  'audit.viewAll',
] as const
export type Capability = (typeof CAPABILITIES)[number]

/**
 * Coarse role → capability grants (engine detailed design 01 §3, TRD §15.1).
 * Object-level and pack/tenant scoping are enforced on top of this by the API.
 */
const MATRIX: Record<WorkspaceRole, ReadonlySet<Capability>> = {
  ORG_ADMIN: new Set(CAPABILITIES),
  COMPLIANCE_MANAGER: new Set<Capability>([
    'portfolio.view',
    'entity.create',
    'entity.editFacts',
    'control.assignOwner',
    'request.send',
    'evidence.upload',
    'claim.review',
    'conflict.resolve',
    'snapshot.create',
    'export.create',
    'share.create',
    'audit.viewAll',
  ]),
  TECHNICAL_APPROVER: new Set<Capability>([
    'portfolio.view',
    'evidence.upload',
    'claim.review',
    'conflict.resolve',
    'snapshot.create',
  ]),
  REVIEWER: new Set<Capability>([]),
  SUPPLIER_CONTRIBUTOR: new Set<Capability>([]),
  PLATFORM_SUPPORT: new Set<Capability>([]),
}

/** True if the role is granted the capability at the workspace level. */
export function can(role: WorkspaceRole, capability: Capability): boolean {
  return MATRIX[role].has(capability)
}
