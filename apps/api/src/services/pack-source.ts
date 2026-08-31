import { createHash, randomUUID } from 'node:crypto'
import type { PackRegistry } from '../pack-registry.js'

export interface PackSourceCheckRecord {
  url: string
  packKeys: string[]
  lastHash: string | null
  lastStatus: 'pending' | 'ok' | 'unchanged' | 'changed' | 'error'
  lastCheckedAt: string | null
  lastError: string | null
  etag: string | null
  updatedAt: string
}

export interface PackSourceChangeRecord {
  id: string
  url: string
  packKeys: string[]
  fromHash: string | null
  toHash: string
  detectedAt: string
  acknowledgedBy: string | null
  acknowledgedAt: string | null
}

export interface PackSourceCheckPatch {
  packKeys: string[]
  status: PackSourceCheckRecord['lastStatus']
  hash?: string | null
  etag?: string | null
  error?: string | null
  checkedAt: string
}

export interface PackSourceRepository {
  getCheck(url: string): Promise<PackSourceCheckRecord | null>
  upsertCheck(url: string, patch: PackSourceCheckPatch): Promise<void>
  listChecks(): Promise<PackSourceCheckRecord[]>
  insertChange(c: PackSourceChangeRecord): Promise<void>
  listChanges(opts?: { includeAcknowledged?: boolean }): Promise<PackSourceChangeRecord[]>
  acknowledge(id: string, by: string, at: string): Promise<boolean>
}

export interface SweepResult {
  checked: number
  changed: number
  unchanged: number
  errors: number
}

const sha256 = (s: string): string => `sha256:${createHash('sha256').update(s).digest('hex')}`

export class PackSourceService {
  constructor(
    private readonly repo: PackSourceRepository,
    private readonly registry: PackRegistry,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  /** url → the packs that list it, from every pack manifest's `sourceUrls`. */
  private sourcesByUrl(): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const p of this.registry.list()) {
      for (const url of p.manifest?.sourceUrls ?? []) {
        const keys = map.get(url) ?? []
        if (!keys.includes(p.packKey)) keys.push(p.packKey)
        map.set(url, keys)
      }
    }
    return map
  }

  async sweep(now: Date = new Date()): Promise<SweepResult> {
    const at = now.toISOString()
    const result: SweepResult = { checked: 0, changed: 0, unchanged: 0, errors: 0 }

    for (const [url, packKeys] of this.sourcesByUrl()) {
      result.checked++
      const prev = await this.repo.getCheck(url)
      try {
        const ac = new AbortController()
        const timer = setTimeout(() => ac.abort(), this.timeoutMs)
        let res: Response
        try {
          res = await this.fetchImpl(url, {
            signal: ac.signal,
            headers: prev?.etag ? { 'if-none-match': prev.etag } : {},
            redirect: 'follow',
          })
        } finally {
          clearTimeout(timer)
        }

        if (res.status === 304) {
          result.unchanged++
          await this.repo.upsertCheck(url, { packKeys, status: 'unchanged', checkedAt: at })
          continue
        }
        if (!res.ok) {
          result.errors++
          await this.repo.upsertCheck(url, {
            packKeys,
            status: 'error',
            error: `HTTP ${res.status}`,
            checkedAt: at,
          })
          continue
        }

        const hash = sha256(await res.text())
        const etag = res.headers.get('etag')
        if (prev?.lastHash && prev.lastHash !== hash) {
          result.changed++
          await this.repo.insertChange({
            id: `psc_${randomUUID()}`,
            url,
            packKeys,
            fromHash: prev.lastHash,
            toHash: hash,
            detectedAt: at,
            acknowledgedBy: null,
            acknowledgedAt: null,
          })
          await this.repo.upsertCheck(url, {
            packKeys,
            status: 'changed',
            hash,
            etag,
            checkedAt: at,
          })
        } else {
          if (prev?.lastHash) result.unchanged++
          await this.repo.upsertCheck(url, {
            packKeys,
            status: prev?.lastHash ? 'unchanged' : 'ok',
            hash,
            etag,
            checkedAt: at,
          })
        }
      } catch (e) {
        result.errors++
        await this.repo.upsertCheck(url, {
          packKeys,
          status: 'error',
          error: e instanceof Error ? e.message : 'fetch failed',
          checkedAt: at,
        })
      }
    }
    return result
  }

  async overview(): Promise<{
    checks: PackSourceCheckRecord[]
    openChanges: PackSourceChangeRecord[]
  }> {
    const [checks, openChanges] = await Promise.all([
      this.repo.listChecks(),
      this.repo.listChanges(),
    ])
    return { checks, openChanges }
  }

  async acknowledge(id: string, by: string, now: Date = new Date()): Promise<boolean> {
    return this.repo.acknowledge(id, by, now.toISOString())
  }
}

// --- In-memory repository ----------------------------------------------------

export class InMemoryPackSourceRepository implements PackSourceRepository {
  readonly checks: PackSourceCheckRecord[] = []
  readonly changes: PackSourceChangeRecord[] = []

  async getCheck(url: string): Promise<PackSourceCheckRecord | null> {
    return this.checks.find((c) => c.url === url) ?? null
  }
  async upsertCheck(url: string, patch: PackSourceCheckPatch): Promise<void> {
    const existing = this.checks.find((c) => c.url === url)
    const row: PackSourceCheckRecord = {
      url,
      packKeys: patch.packKeys,
      lastHash: patch.hash !== undefined ? patch.hash : (existing?.lastHash ?? null),
      lastStatus: patch.status,
      lastCheckedAt: patch.checkedAt,
      lastError: patch.error ?? null,
      etag: patch.etag !== undefined ? patch.etag : (existing?.etag ?? null),
      updatedAt: patch.checkedAt,
    }
    if (existing) Object.assign(existing, row)
    else this.checks.push(row)
  }
  async listChecks(): Promise<PackSourceCheckRecord[]> {
    return [...this.checks].sort((a, b) => (a.url < b.url ? -1 : 1))
  }
  async insertChange(c: PackSourceChangeRecord): Promise<void> {
    this.changes.push({ ...c })
  }
  async listChanges(opts?: { includeAcknowledged?: boolean }): Promise<PackSourceChangeRecord[]> {
    return this.changes
      .filter((c) => opts?.includeAcknowledged || !c.acknowledgedAt)
      .sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1))
  }
  async acknowledge(id: string, by: string, at: string): Promise<boolean> {
    const c = this.changes.find((x) => x.id === id)
    if (!c || c.acknowledgedAt) return false
    c.acknowledgedBy = by
    c.acknowledgedAt = at
    return true
  }
}
