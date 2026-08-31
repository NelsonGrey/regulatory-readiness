const KEY = 'rre.user'

/**
 * The signed-in person. A dev stand-in for an identity-provider session — the
 * email identifies the user to the API (`x-user-email`) and across workspaces.
 * Persisted per browser.
 */
export interface SessionUser {
  email: string
  name?: string
}

export function getUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionUser
    return parsed && typeof parsed.email === 'string' && parsed.email.includes('@') ? parsed : null
  } catch {
    return null
  }
}

export function setUser(user: SessionUser): void {
  try {
    const name = user.name?.trim()
    localStorage.setItem(
      KEY,
      JSON.stringify({ email: user.email.trim(), ...(name ? { name } : {}) }),
    )
  } catch {
    /* private mode / storage disabled */
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
