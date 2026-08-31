import { randomUUID } from 'node:crypto'
import type { AuthContext } from '../auth.js'
import type { PackRegistry } from '../pack-registry.js'
import type { UnitOfWork } from '../db/uow.js'
import type { ObjectStore } from '../storage/object-store.js'
import type { DocumentRecord } from './documents.js'
import {
  keywordExtractor,
  type Extractor,
  type ExtractionControl,
} from '../extraction/extractor.js'
import {
  hasBlockingError,
  validateProposal,
  type ValidationFinding,
} from '../extraction/validate.js'

export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED'

export interface ExtractionRunRecord {
  id: string
  tenantId: string
  documentId: string
  entityId: string
  extractorName: string
  modelId: string
  schemaVersion: string
  documentHash: string | null
  status: RunStatus
  error: string | null
  proposalCount: number
  startedBy: string
  startedAt: string
  finishedAt: string | null
}

export interface ExtractionProposalRecord {
  id: string
  tenantId: string
  runId: string
  documentId: string
  controlKey: string
  value: string
  unit: string | null
  method: string | null
  confidence: number | null
  page: number | null
  quote: string
  validation: ValidationFinding[]
  status: ProposalStatus
  decidedBy: string | null
  decidedAt: string | null
  reason: string | null
  acceptedClaimId: string | null
  createdAt: string
}

export interface RunResultPatch {
  status: RunStatus
  error?: string | null
  proposalCount?: number
  finishedAt?: string | null
}

export interface ProposalDecisionPatch {
  status: ProposalStatus
  decidedBy: string
  decidedAt: string
  reason?: string | null
  acceptedClaimId?: string | null
}

export interface ExtractionRepository {
  insertRun(run: ExtractionRunRecord): Promise<void>
  getRun(id: string): Promise<ExtractionRunRecord | null>
  listRunsByDocument(documentId: string): Promise<ExtractionRunRecord[]>
  setRunResult(id: string, patch: RunResultPatch): Promise<void>

  insertProposal(p: ExtractionProposalRecord): Promise<void>
  getProposal(id: string): Promise<ExtractionProposalRecord | null>
  listProposalsByRun(runId: string): Promise<ExtractionProposalRecord[]>
  setProposalDecision(id: string, patch: ProposalDecisionPatch): Promise<void>
}

type Fail<C extends string> = { ok: false; code: C; message: string }

export type RunResult =
  | { ok: true; runId: string; proposalCount: number }
  | Fail<'DOCUMENT_NOT_FOUND' | 'DOCUMENT_NOT_AVAILABLE' | 'DOCUMENT_NOT_LINKED'>

export type AcceptResult =
  | { ok: true; claimId: string }
  | Fail<'PROPOSAL_NOT_FOUND' | 'NOT_PENDING' | 'NO_LOCATION' | 'VALIDATION_ERROR'>

export type RejectResult =
  { ok: true } | Fail<'PROPOSAL_NOT_FOUND' | 'NOT_PENDING' | 'REASON_REQUIRED'>

function controlHints(key: string, title: string): string[] {
  const words = title.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 3)
  const keyParts = key.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 2)
  return [...new Set([title, ...words, ...keyParts])]
}

export class ExtractionService {
  private readonly extractor: Extractor

  constructor(
    private readonly uow: UnitOfWork,
    private readonly packs: PackRegistry,
    private readonly store: ObjectStore,
    extractor?: Extractor,
  ) {
    this.extractor = extractor ?? keywordExtractor()
  }

  async run(
    auth: AuthContext,
    entityId: string,
    documentId: string,
    now: Date = new Date(),
  ): Promise<RunResult> {
    type Prep =
      | { fail: 'DOCUMENT_NOT_FOUND' | 'DOCUMENT_NOT_AVAILABLE' | 'DOCUMENT_NOT_LINKED' }
      | { fail: null; doc: DocumentRecord; packKey: string }

    const prep: Prep = await this.uow(auth.tenantId, async (u): Promise<Prep> => {
      const doc = await u.documents.get(documentId)
      if (!doc) return { fail: 'DOCUMENT_NOT_FOUND' }
      if (doc.status !== 'AVAILABLE' || !doc.objectKey) return { fail: 'DOCUMENT_NOT_AVAILABLE' }
      const linked = (await u.documents.listByTarget('regulated_entity', entityId)).some(
        (d) => d.id === documentId,
      )
      if (!linked) return { fail: 'DOCUMENT_NOT_LINKED' }
      const found = await u.entities.get(entityId)
      return { fail: null, doc, packKey: found?.entity.packKey ?? doc.uploadKey }
    })
    if (prep.fail) {
      return { ok: false, code: prep.fail, message: prep.fail.toLowerCase().replace(/_/g, ' ') }
    }

    const pack = this.packs.get(prep.packKey)
    const controls: ExtractionControl[] = (pack?.loaded?.controls ?? []).map((c) => ({
      key: c.key,
      title: c.title,
      hints: controlHints(c.key, c.title),
    }))

    const at = now.toISOString()
    const runId = `xrun_${randomUUID()}`
    const run: ExtractionRunRecord = {
      id: runId,
      tenantId: auth.tenantId,
      documentId,
      entityId,
      extractorName: this.extractor.name,
      modelId: this.extractor.modelId,
      schemaVersion: this.extractor.schemaVersion,
      documentHash: prep.doc.contentHash,
      status: 'RUNNING',
      error: null,
      proposalCount: 0,
      startedBy: auth.actor,
      startedAt: at,
      finishedAt: null,
    }

    let proposals: ExtractionProposalRecord[] = []
    let error: string | null = null
    try {
      const bytes = await this.store.getBytes(prep.doc.objectKey!)
      const found = await this.extractor.extract({
        documentId,
        text: bytes.toString('utf8'),
        controls,
      })
      proposals = found.map((p) => ({
        id: `xprp_${randomUUID()}`,
        tenantId: auth.tenantId,
        runId,
        documentId,
        controlKey: p.controlKey,
        value: p.value,
        unit: p.unit,
        method: p.method,
        confidence: p.confidence,
        page: p.location.page,
        quote: p.location.quote,
        validation: validateProposal({ value: p.value, unit: p.unit }),
        status: 'PENDING' as const,
        decidedBy: null,
        decidedAt: null,
        reason: null,
        acceptedClaimId: null,
        createdAt: at,
      }))
    } catch (err) {
      error = String(err)
    }

    return this.uow(auth.tenantId, async (u) => {
      await u.extraction.insertRun(run)
      for (const p of proposals) await u.extraction.insertProposal(p)
      await u.extraction.setRunResult(runId, {
        status: error ? 'FAILED' : 'COMPLETED',
        error,
        proposalCount: proposals.length,
        finishedAt: now.toISOString(),
      })
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'extraction.run',
        targetType: 'document',
        targetId: documentId,
        occurredAt: at,
        metadata: {
          runId,
          entityId,
          model: this.extractor.modelId,
          proposalCount: proposals.length,
          status: error ? 'FAILED' : 'COMPLETED',
        },
      })
      await u.enqueue('document.extracted', {
        documentId,
        entityId,
        runId,
        proposalCount: proposals.length,
      })
      if (error) return { ok: false, code: 'DOCUMENT_NOT_AVAILABLE', message: error }
      return { ok: true, runId, proposalCount: proposals.length }
    })
  }

  async list(auth: AuthContext, documentId: string): Promise<ExtractionRunRecord[]> {
    return this.uow(auth.tenantId, (u) => u.extraction.listRunsByDocument(documentId))
  }

  async get(
    auth: AuthContext,
    runId: string,
  ): Promise<{ run: ExtractionRunRecord; proposals: ExtractionProposalRecord[] } | null> {
    return this.uow(auth.tenantId, async (u) => {
      const run = await u.extraction.getRun(runId)
      if (!run) return null
      return { run, proposals: await u.extraction.listProposalsByRun(runId) }
    })
  }

  async acceptProposal(
    auth: AuthContext,
    proposalId: string,
    now: Date = new Date(),
  ): Promise<AcceptResult> {
    return this.uow(auth.tenantId, async (u) => {
      const p = await u.extraction.getProposal(proposalId)
      if (!p) return { ok: false, code: 'PROPOSAL_NOT_FOUND', message: 'proposal not found' }
      if (p.status !== 'PENDING') {
        return { ok: false, code: 'NOT_PENDING', message: `proposal is ${p.status}` }
      }
      if (!p.quote.trim()) {
        return {
          ok: false,
          code: 'NO_LOCATION',
          message: 'a proposal with no source location cannot be accepted',
        }
      }
      if (hasBlockingError(p.validation)) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'the proposal fails a required validator',
        }
      }

      const run = await u.extraction.getRun(p.runId)
      const entityId = run!.entityId
      const found = await u.entities.get(entityId)
      const at = now.toISOString()
      const claimId = `clm_${randomUUID()}`
      const revision = (await u.claims.maxRevision(entityId, p.controlKey)) + 1

      await u.claims.insert({
        id: claimId,
        tenantId: auth.tenantId,
        entityId,
        controlKey: p.controlKey,
        packKey: found?.entity.packKey ?? '',
        origin: 'EXTRACTION_ACCEPTED',
        revision,
        supersedesClaimId: null,
        status: 'PENDING_REVIEW',
        value: p.value,
        unit: p.unit,
        methodContext: p.method,
        asOfDate: null,
        note: `accepted from extraction ${p.runId}`,
        evidenceUrl: null,
        assertedBy: auth.actor,
        assertedAt: at,
      })

      const locationId = `evl_${randomUUID()}`
      await u.claims.linkEvidence(
        {
          id: locationId,
          tenantId: auth.tenantId,
          documentId: p.documentId,
          page: p.page,
          sheet: null,
          cell: null,
          bbox: null,
          quote: p.quote,
          locationHash: `sha256:${Buffer.from(`${p.documentId}:${p.page ?? ''}:${p.quote}`)
            .toString('hex')
            .slice(0, 64)}`,
          createdBy: auth.actor,
          createdAt: at,
        },
        {
          id: `cel_${randomUUID()}`,
          tenantId: auth.tenantId,
          claimId,
          evidenceLocationId: locationId,
          supportType: 'SUPPORTS',
          addedBy: auth.actor,
          createdAt: at,
        },
      )

      await u.extraction.setProposalDecision(proposalId, {
        status: 'ACCEPTED',
        decidedBy: auth.actor,
        decidedAt: at,
        acceptedClaimId: claimId,
      })
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'extraction.proposal_accepted',
        targetType: 'extraction_proposal',
        targetId: proposalId,
        occurredAt: at,
        metadata: { runId: p.runId, controlKey: p.controlKey, claimId, entityId },
      })
      return { ok: true, claimId }
    })
  }

  async rejectProposal(
    auth: AuthContext,
    proposalId: string,
    reason: string,
    now: Date = new Date(),
  ): Promise<RejectResult> {
    if (!reason.trim()) {
      return { ok: false, code: 'REASON_REQUIRED', message: 'a reason is required to reject' }
    }
    return this.uow(auth.tenantId, async (u) => {
      const p = await u.extraction.getProposal(proposalId)
      if (!p) return { ok: false, code: 'PROPOSAL_NOT_FOUND', message: 'proposal not found' }
      if (p.status !== 'PENDING') {
        return { ok: false, code: 'NOT_PENDING', message: `proposal is ${p.status}` }
      }
      const at = now.toISOString()
      await u.extraction.setProposalDecision(proposalId, {
        status: 'REJECTED',
        decidedBy: auth.actor,
        decidedAt: at,
        reason: reason.trim(),
      })
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'extraction.proposal_rejected',
        targetType: 'extraction_proposal',
        targetId: proposalId,
        occurredAt: at,
        reason: reason.trim(),
        metadata: { runId: p.runId, controlKey: p.controlKey },
      })
      return { ok: true }
    })
  }
}
