import { randomUUID } from 'node:crypto'
import { ApplicabilityResult } from '@rre/contracts'
import type { AuthContext } from '../auth.js'
import type { PackRegistry } from '../pack-registry.js'
import type { UnitOfWork } from '../db/uow.js'

type ApplicabilityResultType = (typeof ApplicabilityResult.options)[number]

export interface ApplicabilityOverrideRecord {
  id: string
  tenantId: string
  entityId: string
  controlKey: string
  result: ApplicabilityResultType
  rationale: string
  sourceRef: string | null
  effectiveEvaluationId: string
  expiresAt: string | null
  createdBy: string
  createdAt: string
  revokedAt: string | null
}

export interface OverrideRepository {
  insert(o: ApplicabilityOverrideRecord): Promise<void>
  get(id: string): Promise<ApplicabilityOverrideRecord | null>
  listByEntity(entityId: string): Promise<ApplicabilityOverrideRecord[]>
  revoke(id: string, at: string): Promise<void>
}

/** The single active override per control for an entity (latest, unrevoked, unexpired). */
export function activeOverrides(
  rows: readonly ApplicabilityOverrideRecord[],
  now: Date,
): Map<string, ApplicabilityOverrideRecord> {
  const byControl = new Map<string, ApplicabilityOverrideRecord>()
  // rows arrive newest-first; keep the first live one per control
  for (const o of rows) {
    if (byControl.has(o.controlKey)) continue
    if (o.revokedAt) continue
    if (o.expiresAt && new Date(o.expiresAt).getTime() <= now.getTime()) continue
    byControl.set(o.controlKey, o)
  }
  return byControl
}

export interface RecordOverrideInput {
  result: ApplicabilityResultType
  rationale: string
  sourceRef?: string
  expiresAt?: string
}

type Fail<C extends string> = { ok: false; code: C; message: string }

export type RecordOverrideResult =
  | { ok: true; override: ApplicabilityOverrideRecord }
  | Fail<'ENTITY_NOT_FOUND' | 'UNKNOWN_CONTROL' | 'BAD_RESULT'>

export class OverrideService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly packs: PackRegistry,
  ) {}

  async record(
    auth: AuthContext,
    entityId: string,
    controlKey: string,
    input: RecordOverrideInput,
    now: Date = new Date(),
  ): Promise<RecordOverrideResult> {
    if (!ApplicabilityResult.options.includes(input.result)) {
      return {
        ok: false,
        code: 'BAD_RESULT',
        message: `unknown applicability result "${input.result}"`,
      }
    }
    return this.uow(auth.tenantId, async (u) => {
      const found = await u.entities.get(entityId)
      if (!found) {
        return { ok: false, code: 'ENTITY_NOT_FOUND', message: `entity ${entityId} not found` }
      }
      const known = (this.packs.get(found.entity.packKey)?.loaded?.controls ?? []).some(
        (c) => c.key === controlKey,
      )
      if (!known) {
        return {
          ok: false,
          code: 'UNKNOWN_CONTROL',
          message: `no control "${controlKey}" in this pack`,
        }
      }

      const at = now.toISOString()
      const override: ApplicabilityOverrideRecord = {
        id: `aov_${randomUUID()}`,
        tenantId: auth.tenantId,
        entityId,
        controlKey,
        result: input.result,
        rationale: input.rationale.trim(),
        sourceRef: input.sourceRef?.trim() || null,
        effectiveEvaluationId: found.evaluation.id,
        expiresAt: input.expiresAt ?? null,
        createdBy: auth.actor,
        createdAt: at,
        revokedAt: null,
      }
      await u.overrides.insert(override)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'applicability.overridden',
        targetType: 'regulated_entity',
        targetId: entityId,
        occurredAt: at,
        reason: override.rationale,
        metadata: { controlKey, result: input.result, expiresAt: override.expiresAt },
      })
      return { ok: true, override }
    })
  }

  async list(auth: AuthContext, entityId: string): Promise<ApplicabilityOverrideRecord[]> {
    return this.uow(auth.tenantId, (u) => u.overrides.listByEntity(entityId))
  }

  async revoke(
    auth: AuthContext,
    overrideId: string,
    now: Date = new Date(),
  ): Promise<{ ok: true } | Fail<'NOT_FOUND' | 'ALREADY_REVOKED'>> {
    return this.uow(auth.tenantId, async (u) => {
      const o = await u.overrides.get(overrideId)
      if (!o) return { ok: false, code: 'NOT_FOUND', message: 'override not found' }
      if (o.revokedAt)
        return { ok: false, code: 'ALREADY_REVOKED', message: 'override is already revoked' }
      const at = now.toISOString()
      await u.overrides.revoke(overrideId, at)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'applicability.override_revoked',
        targetType: 'regulated_entity',
        targetId: o.entityId,
        occurredAt: at,
        metadata: { overrideId, controlKey: o.controlKey },
      })
      return { ok: true }
    })
  }
}
