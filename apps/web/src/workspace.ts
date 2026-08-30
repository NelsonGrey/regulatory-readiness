const KEY = 'rre.tenant'
const DEFAULT_TENANT = 'demo-tenant'

/** Dev stand-in for the authenticated workspace. Persisted per browser. */
export function getTenant(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_TENANT
  } catch {
    return DEFAULT_TENANT
  }
}

export function setTenant(value: string): void {
  try {
    localStorage.setItem(KEY, value.trim() || DEFAULT_TENANT)
  } catch {
    /* private mode / storage disabled — fall back to the default */
  }
}
