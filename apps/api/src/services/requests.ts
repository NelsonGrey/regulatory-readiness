import { randomUUID } from 'node:crypto'
import type { AvailabilityState, RequestStatus } from '@rre/domain'
import type { AuthContext } from '../auth.js'
import type { PackRegistry } from '../pack-registry.js'
import type { UnitOfWork } from '../db/uow.js'
import { issueToken, hashToken } from '../tokens.js'
import type { EmailSender } from '../email/sender.js'
import { contributorRequestEmail } from '../email/templates.js'

// --- Records ------------------------------------------------------------------

export interface EvidenceRequestRecord {
  id: string
  tenantId: string
  entityId: string
  packKey: string
  status: RequestStatus
  message: string | null
  dueAt: string | null
  createdBy: string
  createdAt: string
}

export interface RequestItemRecord {
  id: string
  tenantId: string
  requestId: string
  controlKey: string
  instructions: string | null
  requiredInRequest: boolean
}

export interface AccessGrantRecord {
  id: string
  tenantId: string
  requestId: string
  tokenPrefix: string
  tokenHash: string
  scope: string
  expiresAt: string
  maxUses: number | null
  uses: number
  revokedAt: string | null
  createdAt: string
}

export interface SubmissionRecord {
  id: string
  tenantId: string
  requestId: string
  submissionVersion: number
  submitterIdentity: string | null
  receiptId: string
  submittedAt: string
}

export interface ResponseItemRecord {
  id: string
  tenantId: string
  submissionId: string
  requestItemId: string
  controlKey: string
  value: string | null
  unit: string | null
  methodNote: string | null
  availabilityState: AvailabilityState
  comment: string | null
}

/** A contributor's in-progress answers, overwritten on each save and cleared on submit. */
export interface DraftRecord {
  requestId: string
  tenantId: string
  payload: unknown
  updatedAt: string
}

/** Transaction-scoped persistence port for the request loop. */
export interface RequestRepository {
  insertRequest(r: EvidenceRequestRecord): Promise<void>
  insertItem(i: RequestItemRecord): Promise<void>
  getRequest(id: string): Promise<EvidenceRequestRecord | null>
  listRequestsByEntity(entityId: string): Promise<EvidenceRequestRecord[]>
  listItems(requestId: string): Promise<RequestItemRecord[]>
  setRequestStatus(id: string, status: RequestStatus): Promise<void>

  insertGrant(g: AccessGrantRecord): Promise<void>
  listGrantsByRequest(requestId: string): Promise<AccessGrantRecord[]>
  revokeGrant(id: string, at: string): Promise<void>
  bumpGrantUses(id: string): Promise<void>

  insertSubmission(s: SubmissionRecord): Promise<void>
  insertResponseItem(ri: ResponseItemRecord): Promise<void>
  listSubmissions(requestId: string): Promise<SubmissionRecord[]>
  getSubmission(id: string): Promise<SubmissionRecord | null>
  listResponseItems(submissionId: string): Promise<ResponseItemRecord[]>
  maxSubmissionVersion(requestId: string): Promise<number>

  getDraft(requestId: string): Promise<DraftRecord | null>
  upsertDraft(d: DraftRecord): Promise<void>
  deleteDraft(requestId: string): Promise<void>
}

/** Resolves a token to its grant BEFORE the tenant is known (access_token_grant has no RLS). */
export type ResolveGrant = (tokenHash: string) => Promise<AccessGrantRecord | null>

// --- Operator side ---------------------------------------------------------------

export interface CreateRequestInput {
  controlKeys: string[]
  requiredControlKeys?: string[]
  message?: string
  dueAt?: string
  expiresInDays?: number
  /** When set, the contributor portal link is emailed here (best-effort). */
  recipientEmail?: string
}

export type CreateRequestResult =
  | {
      ok: true
      request: EvidenceRequestRecord
      items: RequestItemRecord[]
      token: string
      grant: AccessGrantRecord
    }
  | { ok: false; code: 'ENTITY_NOT_FOUND' | 'NO_CONTROLS' | 'INVALID_CONTROL'; message: string }

const DAY_MS = 86_400_000

type ResendResult =
  | { ok: true; token: string; grant: AccessGrantRecord; status: RequestStatus }
  | { ok: false; code: 'NOT_FOUND' | 'CLOSED'; message: string }

export class RequestService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly packs: PackRegistry,
    private readonly email?: EmailSender,
    private readonly appBaseUrl = 'http://localhost:5173',
  ) {}

  private async emailContributorLink(
    recipient: string,
    token: string,
    entityName: string,
    controlCount: number,
    message: string | null,
    dueAt: string | null,
  ): Promise<void> {
    if (!this.email) return
    try {
      await this.email.send(
        contributorRequestEmail({
          to: recipient,
          entityName,
          controlCount,
          openUrl: `${this.appBaseUrl}/contribute/${token}`,
          message: message ?? undefined,
          dueAt: dueAt ?? undefined,
        }),
      )
    } catch {
      // best-effort — the link is still returned to the operator
    }
  }

  async createRequest(
    auth: AuthContext,
    entityId: string,
    input: CreateRequestInput,
    now: Date = new Date(),
  ): Promise<CreateRequestResult> {
    if (input.controlKeys.length === 0) {
      return { ok: false, code: 'NO_CONTROLS', message: 'at least one control is required' }
    }

    let entityName = ''
    const result = await this.uow(auth.tenantId, async (u): Promise<CreateRequestResult> => {
      const found = await u.entities.get(entityId)
      if (!found) {
        return { ok: false, code: 'ENTITY_NOT_FOUND', message: `entity ${entityId} not found` }
      }
      entityName = found.entity.name
      const pack = this.packs.get(found.entity.packKey)
      const known = new Set(pack?.loaded?.controls.map((c) => c.key) ?? [])
      const applByControl = new Map(found.evaluation.results.map((r) => [r.control, r.result]))

      for (const key of input.controlKeys) {
        if (!known.has(key)) {
          return { ok: false, code: 'INVALID_CONTROL', message: `unknown control "${key}"` }
        }
        const appl = applByControl.get(key)
        if (appl === 'NOT_APPLICABLE_TO_CLASSIFICATION' || appl === 'DUPLICATE_SOURCE_FIELD') {
          return {
            ok: false,
            code: 'INVALID_CONTROL',
            message: `control "${key}" does not apply to this entity`,
          }
        }
      }

      const at = now.toISOString()
      const request: EvidenceRequestRecord = {
        id: `req_${randomUUID()}`,
        tenantId: auth.tenantId,
        entityId,
        packKey: found.entity.packKey,
        status: 'DRAFT',
        message: input.message ?? null,
        dueAt: input.dueAt ?? null,
        createdBy: auth.actor,
        createdAt: at,
      }
      await u.requests.insertRequest(request)

      const requiredSet = new Set(input.requiredControlKeys ?? input.controlKeys)
      const items: RequestItemRecord[] = []
      for (const key of input.controlKeys) {
        const item: RequestItemRecord = {
          id: `rqi_${randomUUID()}`,
          tenantId: auth.tenantId,
          requestId: request.id,
          controlKey: key,
          instructions: null,
          requiredInRequest: requiredSet.has(key),
        }
        await u.requests.insertItem(item)
        items.push(item)
      }

      const issued = issueToken()
      const grant: AccessGrantRecord = {
        id: `tkn_${randomUUID()}`,
        tenantId: auth.tenantId,
        requestId: request.id,
        tokenPrefix: issued.prefix,
        tokenHash: issued.hash,
        scope: 'contributor_submit',
        expiresAt: new Date(now.getTime() + (input.expiresInDays ?? 14) * DAY_MS).toISOString(),
        maxUses: null,
        uses: 0,
        revokedAt: null,
        createdAt: at,
      }
      await u.requests.insertGrant(grant)

      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'request.created',
        targetType: 'evidence_request',
        targetId: request.id,
        occurredAt: at,
        metadata: { entityId, controlCount: items.length, tokenPrefix: issued.prefix },
      })
      await u.enqueue('request.created', {
        requestId: request.id,
        entityId,
        packKey: found.entity.packKey,
        controlCount: items.length,
      })

      return { ok: true, request, items, token: issued.token, grant }
    })

    if (result.ok && input.recipientEmail) {
      await this.emailContributorLink(
        input.recipientEmail,
        result.token,
        entityName,
        result.items.length,
        result.request.message,
        result.request.dueAt,
      )
    }
    return result
  }

  async listRequests(auth: AuthContext, entityId: string): Promise<EvidenceRequestRecord[]> {
    return this.uow(auth.tenantId, (u) => u.requests.listRequestsByEntity(entityId))
  }

  async getDetail(
    auth: AuthContext,
    requestId: string,
  ): Promise<{
    request: EvidenceRequestRecord
    items: RequestItemRecord[]
    grants: Array<{
      tokenPrefix: string
      expiresAt: string
      revokedAt: string | null
      uses: number
    }>
    submissions: Array<{
      id: string
      version: number
      submittedAt: string
      responses: Array<{
        id: string
        controlKey: string
        value: string | null
        unit: string | null
        availabilityState: AvailabilityState
      }>
    }>
    draftUpdatedAt: string | null
  } | null> {
    return this.uow(auth.tenantId, async (u) => {
      const request = await u.requests.getRequest(requestId)
      if (!request) return null
      const items = await u.requests.listItems(requestId)
      const draft = await u.requests.getDraft(requestId)
      const grants = (await u.requests.listGrantsByRequest(requestId)).map((g) => ({
        tokenPrefix: g.tokenPrefix,
        expiresAt: g.expiresAt,
        revokedAt: g.revokedAt,
        uses: g.uses,
      }))
      const submissions = await Promise.all(
        (await u.requests.listSubmissions(requestId)).map(async (s) => ({
          id: s.id,
          version: s.submissionVersion,
          submittedAt: s.submittedAt,
          responses: (await u.requests.listResponseItems(s.id)).map((ri) => ({
            id: ri.id,
            controlKey: ri.controlKey,
            value: ri.value,
            unit: ri.unit,
            availabilityState: ri.availabilityState,
          })),
        })),
      )
      return { request, items, grants, submissions, draftUpdatedAt: draft?.updatedAt ?? null }
    })
  }

  async send(auth: AuthContext, requestId: string, now: Date = new Date()): Promise<boolean> {
    return this.uow(auth.tenantId, async (u) => {
      const request = await u.requests.getRequest(requestId)
      if (!request) return false
      await u.requests.setRequestStatus(requestId, 'SENT')
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'request.sent',
        targetType: 'evidence_request',
        targetId: requestId,
        occurredAt: now.toISOString(),
      })
      await u.enqueue('request.sent', { requestId, entityId: request.entityId })
      return true
    })
  }

  async revoke(auth: AuthContext, requestId: string, now: Date = new Date()): Promise<boolean> {
    return this.uow(auth.tenantId, async (u) => {
      const request = await u.requests.getRequest(requestId)
      if (!request) return false
      const at = now.toISOString()
      for (const g of await u.requests.listGrantsByRequest(requestId)) {
        if (!g.revokedAt) await u.requests.revokeGrant(g.id, at)
      }
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'request.revoked',
        targetType: 'evidence_request',
        targetId: requestId,
        occurredAt: at,
      })
      await u.enqueue('request.revoked', { requestId, entityId: request.entityId })
      return true
    })
  }

  /**
   * Revoke every live grant and mint a fresh one — the operator's "the link
   * expired / was lost, send a new one" action. Reactivates a request that had
   * lapsed (`DRAFT` / `EXPIRED` / `CANCELLED` → `SENT`). The plaintext token is
   * returned exactly once, like `createRequest`.
   */
  async resend(
    auth: AuthContext,
    requestId: string,
    input: { expiresInDays?: number; recipientEmail?: string } = {},
    now: Date = new Date(),
  ): Promise<ResendResult> {
    let mail: {
      entityName: string
      controlCount: number
      message: string | null
      dueAt: string | null
    } | null = null
    const result = await this.uow(auth.tenantId, async (u): Promise<ResendResult> => {
      const request = await u.requests.getRequest(requestId)
      if (!request) return { ok: false, code: 'NOT_FOUND', message: 'request not found' }
      if (request.status === 'CLOSED') {
        return { ok: false, code: 'CLOSED', message: 'a closed request cannot be reissued' }
      }
      const entity = await u.entities.get(request.entityId)
      const items = await u.requests.listItems(requestId)
      mail = {
        entityName: entity?.entity.name ?? request.entityId,
        controlCount: items.length,
        message: request.message,
        dueAt: request.dueAt,
      }

      const at = now.toISOString()
      for (const g of await u.requests.listGrantsByRequest(requestId)) {
        if (!g.revokedAt) await u.requests.revokeGrant(g.id, at)
      }

      const issued = issueToken()
      const grant: AccessGrantRecord = {
        id: `tkn_${randomUUID()}`,
        tenantId: auth.tenantId,
        requestId,
        tokenPrefix: issued.prefix,
        tokenHash: issued.hash,
        scope: 'contributor_submit',
        expiresAt: new Date(now.getTime() + (input.expiresInDays ?? 14) * DAY_MS).toISOString(),
        maxUses: null,
        uses: 0,
        revokedAt: null,
        createdAt: at,
      }
      await u.requests.insertGrant(grant)

      const reactivated =
        request.status === 'DRAFT' || request.status === 'EXPIRED' || request.status === 'CANCELLED'
      const status: RequestStatus = reactivated ? 'SENT' : request.status
      if (reactivated) await u.requests.setRequestStatus(requestId, 'SENT')

      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'request.link_reissued',
        targetType: 'evidence_request',
        targetId: requestId,
        occurredAt: at,
        metadata: { tokenPrefix: issued.prefix, reactivated },
      })
      await u.enqueue('request.link_reissued', { requestId, entityId: request.entityId })

      return { ok: true, token: issued.token, grant, status }
    })

    if (result.ok && input.recipientEmail && mail) {
      const m: {
        entityName: string
        controlCount: number
        message: string | null
        dueAt: string | null
      } = mail
      await this.emailContributorLink(
        input.recipientEmail,
        result.token,
        m.entityName,
        m.controlCount,
        m.message,
        m.dueAt,
      )
    }
    return result
  }

  async acceptResponseItem(
    auth: AuthContext,
    submissionId: string,
    responseItemId: string,
    now: Date = new Date(),
  ): Promise<
    | { ok: true; claimId: string }
    | { ok: false; code: 'NOT_FOUND' | 'NOT_A_VALUE'; message: string }
  > {
    return this.uow(auth.tenantId, async (u) => {
      const submission = await u.requests.getSubmission(submissionId)
      if (!submission) return { ok: false, code: 'NOT_FOUND', message: 'submission not found' }
      const item = (await u.requests.listResponseItems(submissionId)).find(
        (ri) => ri.id === responseItemId,
      )
      if (!item) return { ok: false, code: 'NOT_FOUND', message: 'response item not found' }
      if (item.availabilityState !== 'VALUE_SUPPLIED' || !item.value) {
        return { ok: false, code: 'NOT_A_VALUE', message: 'this response has no value to accept' }
      }
      const request = await u.requests.getRequest(submission.requestId)
      const revision = (await u.claims.maxRevision(request!.entityId, item.controlKey)) + 1
      const at = now.toISOString()
      const claimId = `clm_${randomUUID()}`
      await u.claims.insert({
        id: claimId,
        tenantId: auth.tenantId,
        entityId: request!.entityId,
        controlKey: item.controlKey,
        packKey: request!.packKey,
        origin: 'SUPPLIER_ASSERTION',
        revision,
        supersedesClaimId: null,
        status: 'PENDING_REVIEW',
        value: item.value,
        unit: item.unit,
        methodContext: item.methodNote,
        asOfDate: null,
        note: `from submission ${submissionId}`,
        evidenceUrl: null,
        assertedBy: auth.actor,
        assertedAt: at,
      })
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'claim.asserted',
        targetType: 'claim',
        targetId: claimId,
        occurredAt: at,
        metadata: {
          entityId: request!.entityId,
          controlKey: item.controlKey,
          origin: 'SUPPLIER_ASSERTION',
          submissionId,
        },
      })
      return { ok: true, claimId }
    })
  }
}

// --- Contributor side ----------------------------------------------------------

export interface ContributorItemView {
  requestItemId: string
  controlKey: string
  title: string
  instructions: string | null
  required: boolean
}

export interface ContributorView {
  requestingOrganization: string
  entityName: string
  dueAt: string | null
  status: RequestStatus
  items: ContributorItemView[]
  /** The contributor's last saved draft (verbatim payload), or null. */
  draft: unknown
}

export interface SubmitItemInput {
  requestItemId: string
  value?: string
  unit?: string
  methodNote?: string
  availabilityState: AvailabilityState
  comment?: string
}

export interface SubmitInput {
  submitterIdentity?: string
  items: SubmitItemInput[]
}

export interface DraftItemInput {
  requestItemId: string
  value?: string
  unit?: string
  methodNote?: string
  availabilityState?: AvailabilityState
  comment?: string
}

export interface DraftInput {
  submitterIdentity?: string
  items: DraftItemInput[]
}

export type ContributorResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string }

function grantUsable(g: AccessGrantRecord | null, now: Date): g is AccessGrantRecord {
  return (
    !!g &&
    !g.revokedAt &&
    new Date(g.expiresAt).getTime() > now.getTime() &&
    (g.maxUses == null || g.uses < g.maxUses)
  )
}

export class ContributorService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly resolveGrant: ResolveGrant,
    private readonly packs: PackRegistry,
  ) {}

  async view(token: string, now: Date = new Date()): Promise<ContributorResult<ContributorView>> {
    const grant = await this.resolveGrant(hashToken(token))
    if (!grantUsable(grant, now)) {
      return {
        ok: false,
        code: 'INVALID_LINK',
        message: 'this link is invalid, expired, or revoked',
      }
    }
    return this.uow(grant.tenantId, async (u) => {
      const request = await u.requests.getRequest(grant.requestId)
      if (!request) return { ok: false, code: 'INVALID_LINK', message: 'request not found' }
      const entity = await u.entities.get(request.entityId)
      const items = await u.requests.listItems(grant.requestId)
      const draft = await u.requests.getDraft(grant.requestId)
      const pack = this.packs.get(request.packKey)
      const meta = new Map((pack?.loaded?.controls ?? []).map((c) => [c.key, c]))
      return {
        ok: true,
        data: {
          requestingOrganization: entity?.entity.name ?? 'the requesting organization',
          entityName: entity?.entity.name ?? request.entityId,
          dueAt: request.dueAt,
          status: request.status,
          items: items.map((i) => ({
            requestItemId: i.id,
            controlKey: i.controlKey,
            title: meta.get(i.controlKey)?.title ?? i.controlKey,
            instructions: i.instructions,
            required: i.requiredInRequest,
          })),
          draft: draft?.payload ?? null,
        },
      }
    })
  }

  async saveDraft(
    token: string,
    input: DraftInput,
    now: Date = new Date(),
  ): Promise<ContributorResult<{ savedAt: string }>> {
    const grant = await this.resolveGrant(hashToken(token))
    if (!grantUsable(grant, now)) {
      return {
        ok: false,
        code: 'INVALID_LINK',
        message: 'this link is invalid, expired, or revoked',
      }
    }
    return this.uow(grant.tenantId, async (u) => {
      const request = await u.requests.getRequest(grant.requestId)
      if (!request) return { ok: false, code: 'INVALID_LINK', message: 'request not found' }
      const known = new Set((await u.requests.listItems(grant.requestId)).map((i) => i.id))
      for (const it of input.items) {
        if (!known.has(it.requestItemId)) {
          return {
            ok: false,
            code: 'UNKNOWN_ITEM',
            message: `item ${it.requestItemId} is not part of this request`,
          }
        }
      }
      const at = now.toISOString()
      await u.requests.upsertDraft({
        requestId: grant.requestId,
        tenantId: grant.tenantId,
        payload: { submitterIdentity: input.submitterIdentity ?? null, items: input.items },
        updatedAt: at,
      })
      await u.audit({
        actorType: 'token',
        actorId: grant.id,
        action: 'request.draft_saved',
        targetType: 'evidence_request',
        targetId: grant.requestId,
        occurredAt: at,
        metadata: { itemCount: input.items.length },
      })
      return { ok: true, data: { savedAt: at } }
    })
  }

  async submit(
    token: string,
    input: SubmitInput,
    now: Date = new Date(),
  ): Promise<
    ContributorResult<{
      receiptId: string
      submittedAt: string
      itemCount: number
      version: number
    }>
  > {
    const grant = await this.resolveGrant(hashToken(token))
    if (!grantUsable(grant, now)) {
      return {
        ok: false,
        code: 'INVALID_LINK',
        message: 'this link is invalid, expired, or revoked',
      }
    }

    return this.uow(grant.tenantId, async (u) => {
      const request = await u.requests.getRequest(grant.requestId)
      if (!request) return { ok: false, code: 'INVALID_LINK', message: 'request not found' }

      const items = await u.requests.listItems(grant.requestId)
      const byId = new Map(items.map((i) => [i.id, i]))
      const answered = new Map(input.items.map((i) => [i.requestItemId, i]))

      for (const provided of input.items) {
        if (!byId.has(provided.requestItemId)) {
          return {
            ok: false,
            code: 'UNKNOWN_ITEM',
            message: `item ${provided.requestItemId} is not part of this request`,
          }
        }
        if (provided.availabilityState === 'VALUE_SUPPLIED' && !provided.value?.trim()) {
          return {
            ok: false,
            code: 'MISSING_VALUE',
            message: `item ${provided.requestItemId} is marked supplied but has no value`,
          }
        }
      }
      const missing = items
        .filter((i) => i.requiredInRequest && !answered.has(i.id))
        .map((i) => i.id)
      if (missing.length > 0) {
        return {
          ok: false,
          code: 'INCOMPLETE',
          message: `required items unanswered: ${missing.join(', ')}`,
        }
      }

      const version = (await u.requests.maxSubmissionVersion(grant.requestId)) + 1
      const submissionId = `sub_${randomUUID()}`
      const receiptId = `rcpt_${randomUUID().slice(0, 12)}`
      const at = now.toISOString()

      await u.requests.insertSubmission({
        id: submissionId,
        tenantId: grant.tenantId,
        requestId: grant.requestId,
        submissionVersion: version,
        submitterIdentity: input.submitterIdentity ?? null,
        receiptId,
        submittedAt: at,
      })
      for (const provided of input.items) {
        await u.requests.insertResponseItem({
          id: `rsi_${randomUUID()}`,
          tenantId: grant.tenantId,
          submissionId,
          requestItemId: provided.requestItemId,
          controlKey: byId.get(provided.requestItemId)!.controlKey,
          value: provided.value ?? null,
          unit: provided.unit ?? null,
          methodNote: provided.methodNote ?? null,
          availabilityState: provided.availabilityState,
          comment: provided.comment ?? null,
        })
      }
      await u.requests.setRequestStatus(grant.requestId, 'SUBMITTED')
      await u.requests.bumpGrantUses(grant.id)
      await u.requests.deleteDraft(grant.requestId)
      await u.audit({
        actorType: 'token',
        actorId: grant.id,
        action: 'request.submitted',
        targetType: 'evidence_request',
        targetId: grant.requestId,
        occurredAt: at,
        metadata: { submissionId, version, itemCount: input.items.length },
      })
      await u.enqueue('request.submitted', {
        requestId: grant.requestId,
        entityId: request.entityId,
        submissionId,
        version,
      })

      return {
        ok: true,
        data: { receiptId, submittedAt: at, itemCount: input.items.length, version },
      }
    })
  }

  async receipt(
    token: string,
    now: Date = new Date(),
  ): Promise<
    ContributorResult<{
      status: RequestStatus
      latestSubmission: { receiptId: string; version: number; submittedAt: string } | null
      note: string
    }>
  > {
    const grant = await this.resolveGrant(hashToken(token))
    if (!grant || (grant.revokedAt && grantExpiredLongAgo(grant, now))) {
      return { ok: false, code: 'INVALID_LINK', message: 'this link is invalid' }
    }
    return this.uow(grant.tenantId, async (u) => {
      const request = await u.requests.getRequest(grant.requestId)
      if (!request) return { ok: false, code: 'INVALID_LINK', message: 'request not found' }
      const subs = await u.requests.listSubmissions(grant.requestId)
      const latest = subs.sort((a, b) => b.submissionVersion - a.submissionVersion)[0] ?? null
      return {
        ok: true,
        data: {
          status: request.status,
          latestSubmission: latest
            ? {
                receiptId: latest.receiptId,
                version: latest.submissionVersion,
                submittedAt: latest.submittedAt,
              }
            : null,
          note: 'Received for review; not yet accepted or approved.',
        },
      }
    })
  }
}

function grantExpiredLongAgo(_g: AccessGrantRecord, _now: Date): boolean {
  // The receipt stays reachable after revocation so the contributor keeps proof.
  return false
}
