import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { InMemoryPackSourceRepository, PackSourceService } from './pack-source.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))

type Entry = { body?: string; status?: number; etag?: string }
function fakeFetch(map: Map<string, Entry>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const e = map.get(String(url)) ?? { body: 'seed', status: 200 }
    if (e.status === 304) return new Response(null, { status: 304 })
    return new Response(e.body ?? '', {
      status: e.status ?? 200,
      headers: e.etag ? { etag: e.etag } : {},
    })
  }) as typeof fetch
}

describe('PackSourceService', () => {
  let registry: PackRegistry
  let repo: InMemoryPackSourceRepository
  let map: Map<string, Entry>
  let urls: string[]

  beforeEach(async () => {
    registry = await PackRegistry.load(PACKS_DIR)
    repo = new InMemoryPackSourceRepository()
    urls = [...new Set(registry.list().flatMap((p) => p.manifest?.sourceUrls ?? []))]
    map = new Map(urls.map((u) => [u, { body: `body-of ${u}`, status: 200 }]))
  })

  const svc = (): PackSourceService => new PackSourceService(repo, registry, fakeFetch(map))

  it('first sweep records a hash for every source URL, no changes', async () => {
    const r = await svc().sweep()
    expect(r.checked).toBe(urls.length)
    expect(r.changed).toBe(0)
    const { checks } = await svc().overview()
    expect(checks).toHaveLength(urls.length)
    expect(checks.every((c) => c.lastHash?.startsWith('sha256:'))).toBe(true)
    expect(checks.every((c) => c.lastStatus === 'ok')).toBe(true)
  })

  it('a re-sweep with the same bodies detects nothing', async () => {
    await svc().sweep()
    const r = await svc().sweep()
    expect(r.unchanged).toBe(urls.length)
    expect(r.changed).toBe(0)
    expect((await svc().overview()).openChanges).toHaveLength(0)
  })

  it('a changed body raises one open change carrying the referencing pack(s)', async () => {
    await svc().sweep()
    const target = urls[0]!
    map.set(target, { body: 'the page was revised', status: 200 })

    const r = await svc().sweep()
    expect(r.changed).toBe(1)

    const { openChanges } = await svc().overview()
    expect(openChanges).toHaveLength(1)
    expect(openChanges[0]).toMatchObject({ url: target })
    expect(openChanges[0]!.fromHash).not.toBe(openChanges[0]!.toHash)
    const referencing = registry
      .list()
      .filter((p) => p.manifest?.sourceUrls.includes(target))
      .map((p) => p.packKey)
    expect(openChanges[0]!.packKeys).toEqual(referencing)
  })

  it('acknowledging a change clears it from the open list, and cannot be repeated', async () => {
    await svc().sweep()
    map.set(urls[0]!, { body: 'changed', status: 200 })
    await svc().sweep()
    const id = (await svc().overview()).openChanges[0]!.id

    expect(await svc().acknowledge(id, 'ann@rre.test')).toBe(true)
    expect((await svc().overview()).openChanges).toHaveLength(0)
    expect(await svc().acknowledge(id, 'ann@rre.test')).toBe(false)
  })

  it('a failing fetch is recorded as an error, not a change', async () => {
    map.set(urls[0]!, { status: 500 })
    const r = await svc().sweep()
    expect(r.errors).toBe(1)
    const check = (await svc().overview()).checks.find((c) => c.url === urls[0])!
    expect(check).toMatchObject({ lastStatus: 'error', lastError: 'HTTP 500' })
    expect((await svc().overview()).openChanges).toHaveLength(0)
  })

  it('a 304 Not Modified counts as unchanged', async () => {
    await svc().sweep()
    map.set(urls[0]!, { status: 304 })
    const r = await svc().sweep()
    expect(r.unchanged).toBeGreaterThanOrEqual(1)
    expect(r.changed).toBe(0)
  })
})
