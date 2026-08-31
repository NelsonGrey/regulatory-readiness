/**
 * Upload gate (engine TRD §10.2). This is a stand-in for the production pipeline
 * (GuardDuty Malware Protection for S3 / ClamAV on Fargate, ARCHITECTURE_AWS §4):
 * media-type allow-list, size ceiling, and the EICAR test signature. It runs
 * against the fetched bytes at finalize, before the object is promoted out of
 * quarantine.
 */

/** Accepted upload media types (TRD §10.1). */
export const ALLOWED_MEDIA_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'message/rfc822',
])

// The standard anti-virus test string — safe, and exactly what it is for.
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

export type ScanVerdict =
  { ok: true } | { ok: false; status: 'REJECTED_MALWARE' | 'UNSUPPORTED'; note: string }

export function scanBytes(bytes: Buffer, mediaType: string, maxBytes: number): ScanVerdict {
  if (bytes.byteLength === 0) {
    return { ok: false, status: 'UNSUPPORTED', note: 'the uploaded file is empty' }
  }
  if (bytes.byteLength > maxBytes) {
    return { ok: false, status: 'UNSUPPORTED', note: `exceeds the ${maxBytes}-byte limit` }
  }
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return { ok: false, status: 'UNSUPPORTED', note: `media type "${mediaType}" is not accepted` }
  }
  if (bytes.includes(EICAR)) {
    return { ok: false, status: 'REJECTED_MALWARE', note: 'a test malware signature was matched' }
  }
  return { ok: true }
}
