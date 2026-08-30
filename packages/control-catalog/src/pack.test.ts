import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadInstalledPacks, loadPack, validatePack, type LoadedPack } from './index.js'

const PACKS_ROOT = fileURLToPath(new URL('../../../packs', import.meta.url))
const EAA_DIR = fileURLToPath(new URL('../../../packs/eaa-accessibility', import.meta.url))

describe('loadPack', () => {
  let pack: LoadedPack

  beforeAll(async () => {
    pack = await loadPack(EAA_DIR)
  })

  it('parses the eaa-accessibility pack', () => {
    expect(pack.manifest.packKey).toBe('eaa-accessibility')
    expect(pack.manifest.jurisdiction).toBe('IE')
    expect(pack.controls).toHaveLength(20)
    expect(pack.computedChecksum).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('validates: draft pack is ok with only a checksum warning', () => {
    const { ok, issues } = validatePack(pack)
    expect(ok).toBe(true)
    expect(issues.some((i) => i.severity === 'error')).toBe(false)
    expect(issues.map((i) => i.code)).toContain('CHECKSUM_UNVERIFIED')
  })

  it('all known-outcome applicability vectors pass', () => {
    const { issues } = validatePack(pack)
    expect(issues.filter((i) => i.code === 'TEST_VECTOR')).toEqual([])
  })

  it('flags a control-count mismatch', () => {
    const broken = structuredClone(pack)
    broken.testVectors.controlCount = 999
    const { ok, issues } = validatePack(broken)
    expect(ok).toBe(false)
    expect(issues.some((i) => i.code === 'CONTROL_COUNT')).toBe(true)
  })

  it('flags a duplicate control key', () => {
    const broken = structuredClone(pack)
    broken.controls.push({ ...broken.controls[0]! })
    broken.testVectors.controlCount = broken.controls.length
    const { ok, issues } = validatePack(broken)
    expect(ok).toBe(false)
    expect(issues.some((i) => i.code === 'DUPLICATE_CONTROL_KEY')).toBe(true)
  })

  it('flags a rule targeting an unknown control', () => {
    const broken = structuredClone(pack)
    broken.applicability.rules.push({
      id: 'bogus',
      when: { always: true },
      target: { controls: ['EAA-DOES-NOT-EXIST'] },
      result: 'REQUIRED_BY_SNAPSHOT',
    })
    const { ok, issues } = validatePack(broken)
    expect(ok).toBe(false)
    expect(issues.some((i) => i.code === 'UNKNOWN_CONTROL')).toBe(true)
  })

  it('requires the computed checksum and two reviewers once status is active', () => {
    const active = structuredClone(pack)
    active.manifest.status = 'active'
    const { ok, issues } = validatePack(active)
    expect(ok).toBe(false)
    expect(issues.some((i) => i.code === 'CHECKSUM_MISMATCH')).toBe(true)
    expect(issues.some((i) => i.code === 'REVIEW_GATE')).toBe(true)
  })
})

describe('loadInstalledPacks', () => {
  it('discovers and validates the eaa-accessibility pack', async () => {
    const installed = await loadInstalledPacks(PACKS_ROOT)
    const eaa = installed.find((p) => p.packKey === 'eaa-accessibility')
    expect(eaa).toBeDefined()
    expect(eaa?.valid).toBe(true)
    expect(eaa?.manifest?.status).toBe('draft')
  })

  it('returns [] for a missing directory', async () => {
    expect(await loadInstalledPacks('/no/such/path')).toEqual([])
  })
})
