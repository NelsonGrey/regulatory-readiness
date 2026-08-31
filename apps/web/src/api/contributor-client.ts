import { ApiError, type ApiErrorShape } from './client.js'

const BASE = '/contributor/v1'

/**
 * The no-account contributor portal. The link token is the only credential —
 * no workspace header, no stored identity (engine detailed design 03).
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await res.text()
  const json = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) throw new ApiError(res.status, json as { error?: ApiErrorShape } | null)
  return json as T
}

export const contributorApi = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
}
