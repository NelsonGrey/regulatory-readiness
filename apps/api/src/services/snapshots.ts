import { createHash, randomUUID } from 'node:crypto'
import {
  buildCanonicalExport,
  canonicalExportToCsv,
  canonicalJson,
  readinessForEntity,
  type CanonicalExport,
  type EntityStatus,
  type ExportControlInput,
} from '@rre/domain'
import type { AuthContext } from '../auth.js'
import type { PackRegistry } from '../pack-registry.js'
import type { UnitOfWork } from '../db/uow.js'
import { approvedClaimByControl, claimStateByControl } from './claims.js'

export interface SnapshotRecord {
  id: string
  tenantId: string
  entityId: string
  packKey: string
  snapshotKey: string
  evaluationId: string
  entityStatus: EntityStatus
  readinessCounts: Record<string, number>
  document: CanonicalExport
  contentHash: string
  createdBy: string
  createdAt: string
}

/** A list row — everything but the heavy frozen document. */
export type SnapshotSummary = Omit<SnapshotRecord, 'document'>

/** Transaction-scoped persistence port for readiness snapshots (append-only). */
export interface SnapshotRepository {
  insert(s: SnapshotRecord): Promise<void>
  get(id: string): Promise<SnapshotRecord | null>
  listByEntity(entityId: string): Promise<SnapshotSummary[]>
}

function contentHash(doc: CanonicalExport): string {
  return `sha256:${createHash('sha256').update(canonicalJson(doc)).digest('hex')}`
}

export type CreateSnapshotResult =
  { ok: true; snapshot: SnapshotRecord } | { ok: false; code: 'ENTITY_NOT_FOUND'; message: string }

export class SnapshotService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly packs: PackRegistry,
  ) {}

  async create(
    auth: AuthContext,
    entityId: string,
    now: Date = new Date(),
  ): Promise<CreateSnapshotResult> {
    return this.uow(auth.tenantId, async (u) => {
      const found = await u.entities.get(entityId)
      if (!found) {
        return { ok: false, code: 'ENTITY_NOT_FOUND', message: `entity ${entityId} not found` }
      }
      const { entity, evaluation } = found

      const pack = this.packs.get(entity.packKey)
      const meta = new Map((pack?.loaded?.controls ?? []).map((c) => [c.key, c]))
      const manifest = pack?.loaded?.manifest

      const claims = await u.claims.listByEntity(entityId)
      const claimState = claimStateByControl(claims)
      const approved = approvedClaimByControl(claims)

      const readiness = readinessForEntity(
        evaluation.results.map((r) => ({ control: r.control, applicability: r.result })),
        claimState,
      )
      const readinessByControl = new Map(readiness.perControl.map((c) => [c.control, c.readiness]))

      const controls: ExportControlInput[] = evaluation.results.map((r) => {
        const c = meta.get(r.control)
        const claim = approved.get(r.control) ?? null
        return {
          key: r.control,
          title: c?.title ?? r.control,
          family: c?.family ?? 'unknown',
          standardClause: c?.standardClause ?? null,
          wcagSc: c?.wcagSc ?? null,
          accessClass: c?.accessClassDefault ?? 'PUBLIC_CANDIDATE',
          applicability: r.result,
          applicabilityReason: r.reason ?? null,
          readiness: readinessByControl.get(r.control) ?? 'MISSING',
          approvedClaim: claim
            ? {
                value: claim.value,
                unit: claim.unit,
                method: claim.methodContext,
                origin: claim.origin,
                asOfDate: claim.asOfDate,
                assertedAt: claim.assertedAt,
              }
            : null,
        }
      })

      const at = now.toISOString()
      const document = buildCanonicalExport({
        generatedAt: at,
        entity: {
          id: entity.id,
          name: entity.name,
          identifier: entity.entityIdentifier,
          kind: entity.entityKind,
          packKey: entity.packKey,
        },
        responsibleOrganization: null,
        facts: evaluation.facts,
        snapshotKey: evaluation.snapshotKey,
        packSource: {
          authority: manifest?.sourceAuthority ?? 'unknown',
          catalogVersion: manifest?.catalogVersion ?? 'unknown',
          publicationDate: manifest?.publicationDate ?? 'unknown',
          retrievedDate: manifest?.retrievedDate ?? 'unknown',
          sourceChecksum: manifest?.sourceChecksum ?? 'unknown',
          sourceUrls: manifest?.sourceUrls ?? [],
        },
        evaluation: {
          id: evaluation.id,
          hash: evaluation.hash,
          evaluatedAt: evaluation.evaluatedAt,
        },
        entityStatus: readiness.entityStatus,
        readinessCounts: readiness.counts,
        controls,
      })

      const snapshot: SnapshotRecord = {
        id: `rsnap_${randomUUID()}`,
        tenantId: auth.tenantId,
        entityId,
        packKey: entity.packKey,
        snapshotKey: evaluation.snapshotKey,
        evaluationId: evaluation.id,
        entityStatus: readiness.entityStatus,
        readinessCounts: readiness.counts,
        document,
        contentHash: contentHash(document),
        createdBy: auth.actor,
        createdAt: at,
      }
      await u.snapshots.insert(snapshot)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'readiness_snapshot.created',
        targetType: 'readiness_snapshot',
        targetId: snapshot.id,
        occurredAt: at,
        metadata: {
          entityId,
          snapshotKey: evaluation.snapshotKey,
          entityStatus: readiness.entityStatus,
          contentHash: snapshot.contentHash,
        },
      })
      await u.enqueue('entity.readiness_snapshot_created', {
        snapshotId: snapshot.id,
        entityId,
        entityStatus: readiness.entityStatus,
        contentHash: snapshot.contentHash,
      })

      return { ok: true, snapshot }
    })
  }

  async list(auth: AuthContext, entityId: string): Promise<SnapshotSummary[]> {
    return this.uow(auth.tenantId, (u) => u.snapshots.listByEntity(entityId))
  }

  async get(auth: AuthContext, id: string): Promise<SnapshotRecord | null> {
    return this.uow(auth.tenantId, (u) => u.snapshots.get(id))
  }

  async exportCsv(auth: AuthContext, id: string): Promise<string | null> {
    const snap = await this.get(auth, id)
    return snap ? canonicalExportToCsv(snap.document) : null
  }
}
