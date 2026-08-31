/**
 * Workspace roles (engine TRD §3 — tenancy control plane). A person's rights in
 * a workspace come from their `membership.role`; the contributor portal is a
 * separate token-as-principal path and is deliberately not a role here.
 */
export type Role = 'owner' | 'admin' | 'member'

export const ROLE_RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 }

export type Capability = 'read' | 'write' | 'manage_members' | 'manage_billing' | 'delete_workspace'

const CAPABILITIES: Record<Role, Capability[]> = {
  member: ['read', 'write'],
  admin: ['read', 'write', 'manage_members'],
  owner: ['read', 'write', 'manage_members', 'manage_billing', 'delete_workspace'],
}

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability)
}

/** True when `role` is at least as privileged as `min`. */
export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

export const ROLES: readonly Role[] = ['owner', 'admin', 'member']
