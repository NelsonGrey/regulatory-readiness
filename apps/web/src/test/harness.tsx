import { render, type RenderResult } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { vi } from 'vitest'
import { routes } from '../router.js'

export interface RouteStub {
  method?: string
  /** Substring match against the request pathname. */
  path: string
  status?: number
  body: unknown
}

/**
 * Install a `fetch` mock that answers from `stubs` (first match wins). Records
 * every request so tests can assert what the UI sent.
 */
export function mockApi(stubs: RouteStub[]): {
  calls: Array<{ method: string; url: string; body?: unknown }>
} {
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  // Most specific (longest path) first, so `/packs/:key` wins over `/packs`.
  const ordered = [...stubs].sort((a, b) => b.path.length - a.path.length)

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      let body: unknown
      if (init?.body !== undefined && init.body !== null) {
        const raw = init.body
        if (typeof raw === 'string') {
          try {
            body = JSON.parse(raw)
          } catch {
            body = raw
          }
        } else {
          body = '[binary]'
        }
      }
      calls.push({ method, url, body })

      const stub = ordered.find(
        (s) => (s.method ?? 'GET').toUpperCase() === method && url.includes(s.path),
      )
      const status = stub?.status ?? (stub ? 200 : 404)
      const payload = stub
        ? stub.body
        : { error: { code: 'NO_STUB', message: `no stub for ${method} ${url}` } }
      const isString = typeof payload === 'string'
      const nullBody = status === 204 || status === 205 || status === 304 || payload == null
      const responseBody = nullBody
        ? null
        : isString
          ? (payload as string)
          : JSON.stringify(payload)

      return new Response(responseBody, {
        status,
        headers: { 'content-type': isString ? 'text/plain' : 'application/json' },
      })
    }),
  )

  return { calls }
}

export function renderRoute(initialPath: string): RenderResult {
  const router = createMemoryRouter(routes, {
    initialEntries: [initialPath],
    future: { v7_relativeSplatPath: true },
  })
  return render(<RouterProvider router={router} future={{ v7_startTransition: true }} />)
}
