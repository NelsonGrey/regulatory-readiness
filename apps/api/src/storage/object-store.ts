/**
 * Object storage abstraction (engine TRD §80.11 — providers behind an internal
 * interface). Upload lands in a quarantine namespace; only a scanned, promoted
 * object in the originals namespace is downloadable.
 *
 * `local` is the default: bytes live in memory and are served by the API's own
 * `/documents/:id/content` route (no S3 needed for dev, tests, or CI). `s3` uses
 * short-lived presigned URLs against a real bucket (see `object-store.s3.ts`).
 */
export interface PresignedUpload {
  /** Where the client PUTs the bytes. Relative (local) or absolute (S3). */
  url: string
  /** HTTP method for the upload (always PUT here). */
  method: 'PUT'
}

export interface ObjectStore {
  readonly kind: 'local' | 's3'
  /**
   * A presigned/relative URL the client PUTs the raw bytes to. The real size and
   * type check happens at finalize (against the fetched bytes), so the URL
   * itself is unconstrained.
   */
  presignUpload(key: string): Promise<PresignedUpload>
  /** Size of an object, or null if it does not exist. */
  head(key: string): Promise<{ size: number } | null>
  /** Read the whole object (used to hash + scan before promotion). */
  getBytes(key: string): Promise<Buffer>
  /** Copy quarantine → originals after a clean scan. The source is left in place. */
  promote(fromKey: string, toKey: string): Promise<void>
  /** A URL to download a promoted object. Relative (local) or presigned (S3). */
  downloadUrl(key: string): Promise<string>
  /** Local only: accept an upload from the API's own content route. */
  put?(key: string, bytes: Buffer): Promise<void>
}

export function quarantineKey(tenantId: string, documentId: string): string {
  return `quarantine/${tenantId}/${documentId}`
}

export function originalKey(tenantId: string, documentId: string): string {
  return `originals/${tenantId}/${documentId}`
}

/** In-memory store: the API both issues the upload URL and serves the bytes. */
export function createLocalObjectStore(): ObjectStore {
  const blobs = new Map<string, Buffer>()
  return {
    kind: 'local',
    async presignUpload(key) {
      return {
        url: `/api/v1/documents/content/${encodeURIComponent(key)}`,
        method: 'PUT' as const,
      }
    },
    async head(key) {
      const b = blobs.get(key)
      return b ? { size: b.byteLength } : null
    },
    async getBytes(key) {
      const b = blobs.get(key)
      if (!b) throw new Error(`object not found: ${key}`)
      return b
    },
    async promote(fromKey, toKey) {
      const b = blobs.get(fromKey)
      if (!b) throw new Error(`object not found: ${fromKey}`)
      blobs.set(toKey, b)
    },
    async downloadUrl(key) {
      return `/api/v1/documents/content/${encodeURIComponent(key)}`
    },
    async put(key, bytes) {
      blobs.set(key, bytes)
    },
  }
}
