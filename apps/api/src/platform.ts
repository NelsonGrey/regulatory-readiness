/**
 * Platform-level (cross-tenant) authorisation. A thin allowlist of operator
 * emails — the same dev stand-in style as the rest of auth; a real deployment
 * would back this with an IdP group or org role.
 */
export function isPlatformAdmin(
  email: string | undefined | null,
  admins: readonly string[],
): boolean {
  if (!email) return false
  const e = email.toLowerCase()
  return admins.some((a) => a.trim().toLowerCase() === e)
}
