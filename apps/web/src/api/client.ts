import { getTenant } from '../workspace.js'

const BASE = '/api/v1'

export interface ApiErrorShape {
  code?: string
  message: string
  issues?: Array<{ fact?: string; message: string; code?: string }>
}

export class ApiError extends Error implements ApiErrorShape {
  code?: string
  issues?: ApiErrorShape['issues']
  status: number

  constructor(status: number, body: { error?: ApiErrorShape } | null) {
    super(body?.error?.message ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = body?.error?.code
    this.issues = body?.error?.issues
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': getTenant(),
      'x-actor': 'operator@local',
      'x-user-email': 'operator@local',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await res.text()
  const json = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) throw new ApiError(res.status, json as { error?: ApiErrorShape } | null)
  return json as T
}

async function requestText(path: string): Promise<string> {
  const res = await fetch(BASE + path, {
    method: 'GET',
    headers: {
      'x-tenant-id': getTenant(),
      'x-actor': 'operator@local',
      'x-user-email': 'operator@local',
    },
  })
  const text = await res.text()
  if (!res.ok) {
    let body: { error?: ApiErrorShape } | null = null
    try {
      body = JSON.parse(text) as { error?: ApiErrorShape }
    } catch {
      body = null
    }
    throw new ApiError(res.status, body)
  }
  return text
}

// The upload / download URLs come from the server and may be root-relative
// (local object store) or absolute (S3 presigned) — fetch them verbatim.
async function requestBlob(url: string): Promise<Blob> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-tenant-id': getTenant(),
      'x-actor': 'operator@local',
      'x-user-email': 'operator@local',
    },
  })
  if (!res.ok) throw new ApiError(res.status, null)
  return res.blob()
}

async function putBytes(url: string, body: BodyInit): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/octet-stream',
      'x-tenant-id': getTenant(),
      'x-actor': 'operator@local',
      'x-user-email': 'operator@local',
    },
    body,
  })
  if (!res.ok) throw new ApiError(res.status, null)
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  getText: (path: string) => requestText(path),
  getBlob: (url: string) => requestBlob(url),
  putBytes: (url: string, body: BodyInit) => putBytes(url, body),
}
