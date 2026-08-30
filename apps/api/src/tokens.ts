import { createHash, randomBytes } from 'node:crypto'

export interface IssuedToken {
  /** The plaintext token — shown to the operator once, never stored. */
  token: string
  /** First bytes, stored for an indexed lookup before hash verification. */
  prefix: string
  /** SHA-256 hex of the token — the only thing persisted. */
  hash: string
}

/** 192 bits of entropy (engine TRD-REQ-001: ≥128), URL-safe. */
export function issueToken(): IssuedToken {
  const token = randomBytes(24).toString('base64url')
  return { token, prefix: token.slice(0, 8), hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
