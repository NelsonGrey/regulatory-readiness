import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import type { CanonicalExport, EntityScopeEvaluation, RegulatedEntity } from '@rre/domain'
import { createPool, migrate, withTenant } from '@rre/db'
import { pgUnitOfWork, type UnitOfWork } from '../db/uow.js'
import { pgResolveGrant } from './requests.pg.js'

const adminUrl = process.env.TEST_DATABASE_URL
// The app connects as the non-superuser `rre_app` role (migrations 0002/0003) so
// RLS and the audit_event append-only REVOKE are actually enforced.
const appUrl =
  process.env.TEST_DATABASE_URL_APP ?? adminUrl?.replace(/\/\/[^:]+:[^@]+@/, '//rre_app:rre_app@')

const suite = adminUrl ? describe : describe.skip

const AT = '2026-08-30T12:00:00.000Z'

const makeEntity = (tenantId: string, id: string): RegulatedEntity => ({
  id,
  tenantId,
  packKey: 'eaa-accessibility',
  name: `Entity ${id}`,
  entityIdentifier: `id-${id}`,
  entityKind: 'service',
  createdAt: AT,
  createdBy: 'tester',
  currentEvaluationId: `${id}-eval`,
})

const makeEvaluation = (tenantId: string, id: string): EntityScopeEvaluation => ({
  id: `${id}-eval`,
  entityId: id,
  tenantId,
  packKey: 'eaa-accessibility',
  snapshotKey: 'SNAP-1',
  version: 1,
  facts: { hasWebsite: true, entityKind: 'service' },
  results: [{ control: 'C-1', result: 'REQUIRED_BY_SNAPSHOT' }],
  evaluatedAt: AT,
  evaluatedBy: 'tester',
  hash: 'sha256:deadbeef',
})

const audit = (targetId: string) => ({
  actorType: 'user' as const,
  actorId: 'tester',
  action: 'entity.created',
  targetType: 'regulated_entity',
  targetId,
  occurredAt: AT,
})

suite('Postgres unit of work + RLS (integration)', () => {
  let adminPool: Pool
  let appPool: Pool
  let uow: UnitOfWork

  beforeAll(async () => {
    adminPool = createPool(adminUrl as string)
    await migrate(adminPool)
    appPool = createPool(appUrl as string)
    uow = pgUnitOfWork(appPool)
  })

  afterEach(async () => {
    await adminPool.query(
      `TRUNCATE regulated_entity, entity_scope_evaluation, audit_event, outbox, claim,
        review_decision, evidence_request, request_item, access_token_grant,
        contributor_submission, contributor_response_item, request_draft, readiness_snapshot,
        notification, document, document_association, evidence_location, claim_evidence_link,
        extraction_run, extraction_proposal, applicability_override`,
    )
  })

  afterAll(async () => {
    await appPool.end()
    await adminPool.end()
  })

  it('commits entity + audit + outbox in one transaction and reads them back', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'e1'), makeEvaluation('t-alpha', 'e1'))
      await u.audit(audit('e1'))
      await u.enqueue('entity.readiness_evaluated', { entityId: 'e1' })
    })

    const got = await uow('t-alpha', (u) => u.entities.get('e1'))
    expect(got?.entity.name).toBe('Entity e1')
    expect(got?.evaluation.facts).toEqual({ hasWebsite: true, entityKind: 'service' })

    const [auditRows, outboxRows] = await withTenant(appPool, 't-alpha', async (c) => [
      (await c.query('SELECT action FROM audit_event WHERE target_id = $1', ['e1'])).rows,
      (await c.query('SELECT topic, published_at FROM outbox WHERE published_at IS NULL')).rows,
    ])
    expect(auditRows).toEqual([{ action: 'entity.created' }])
    expect(outboxRows).toEqual([{ topic: 'entity.readiness_evaluated', published_at: null }])
  })

  it('rolls back the entity AND the audit event when the unit of work throws', async () => {
    await expect(
      uow('t-alpha', async (u) => {
        await u.entities.create(makeEntity('t-alpha', 'e2'), makeEvaluation('t-alpha', 'e2'))
        await u.audit(audit('e2'))
        throw new Error('deliberate failure')
      }),
    ).rejects.toThrow('deliberate failure')

    const counts = await withTenant(appPool, 't-alpha', async (c) => ({
      entities: (await c.query(`SELECT count(*)::int AS n FROM regulated_entity`)).rows[0].n,
      audit: (await c.query(`SELECT count(*)::int AS n FROM audit_event`)).rows[0].n,
    }))
    expect(counts).toEqual({ entities: 0, audit: 0 })
  })

  it('does not return another tenant’s entity, and RLS hides its rows entirely', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'e3'), makeEvaluation('t-alpha', 'e3'))
      await u.audit(audit('e3'))
    })

    expect(await uow('t-bravo', (u) => u.entities.get('e3'))).toBeNull()

    const seenByBravo = await withTenant(appPool, 't-bravo', async (c) => ({
      entities: (await c.query('SELECT id FROM regulated_entity')).rows,
      audit: (await c.query('SELECT id FROM audit_event')).rows,
    }))
    expect(seenByBravo).toEqual({ entities: [], audit: [] })
  })

  it('queryAudit returns the tenant’s events (newest first) and nothing for another tenant', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'e3a'), makeEvaluation('t-alpha', 'e3a'))
      await u.audit(audit('e3a'))
    })
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'e3b'), makeEvaluation('t-alpha', 'e3b'))
      await u.audit(audit('e3b'))
    })

    const forAlpha = await uow('t-alpha', (u) => u.queryAudit({ limit: 10 }))
    expect(forAlpha.map((e) => e.targetId)).toEqual(['e3b', 'e3a'])
    expect(forAlpha[0]?.seq).toMatch(/^\d+$/)
    expect(Number(forAlpha[0]!.seq)).toBeGreaterThan(Number(forAlpha[1]!.seq))

    const filtered = await uow('t-alpha', (u) => u.queryAudit({ targetId: 'e3a', limit: 10 }))
    expect(filtered).toHaveLength(1)

    const forBravo = await uow('t-bravo', (u) => u.queryAudit({ limit: 10 }))
    expect(forBravo).toEqual([])
  })

  it('forbids UPDATE and DELETE on audit_event for the application role (append-only)', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'e4'), makeEvaluation('t-alpha', 'e4'))
      await u.audit(audit('e4'))
    })

    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query(`UPDATE audit_event SET action = 'tampered'`)),
    ).rejects.toThrow(/permission denied/i)

    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query('DELETE FROM audit_event')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('claims and review decisions are tenant-scoped; review_decision is append-only', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'ec'), makeEvaluation('t-alpha', 'ec'))
      await u.claims.insert({
        id: 'clm_1',
        tenantId: 't-alpha',
        entityId: 'ec',
        controlKey: 'C-1',
        packKey: 'eaa-accessibility',
        origin: 'INTERNAL_ASSERTION',
        revision: 1,
        supersedesClaimId: null,
        status: 'PENDING_REVIEW',
        value: 'v',
        unit: null,
        methodContext: null,
        asOfDate: null,
        note: null,
        evidenceUrl: null,
        assertedBy: 'tester',
        assertedAt: AT,
      })
      await u.claims.recordDecision({
        id: 'rvd_1',
        tenantId: 't-alpha',
        claimId: 'clm_1',
        decision: 'APPROVED',
        reason: null,
        reviewer: 'tester',
        decidedAt: AT,
      })
      await u.claims.setStatus('clm_1', 'APPROVED')
    })

    expect(await uow('t-alpha', (u) => u.claims.get('clm_1'))).toMatchObject({ status: 'APPROVED' })
    expect(await uow('t-bravo', (u) => u.claims.get('clm_1'))).toBeNull()

    const bravoSees = await withTenant(appPool, 't-bravo', async (c) => ({
      claims: (await c.query('SELECT id FROM claim')).rows,
      decisions: (await c.query('SELECT id FROM review_decision')).rows,
    }))
    expect(bravoSees).toEqual({ claims: [], decisions: [] })

    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query(`UPDATE review_decision SET reason = 'x'`)),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query(`UPDATE claim SET value = 'tampered'`)),
    ).rejects.toThrow(/permission denied/i)
  })

  it('two approved claims for one control surface as CONFLICTING via the readiness derivation', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'ek'), makeEvaluation('t-alpha', 'ek'))
    })
    // Insert two APPROVED claims directly (the service prevents this; the DB does not).
    for (const id of ['clm_a', 'clm_b']) {
      await withTenant(appPool, 't-alpha', (c) =>
        c.query(
          `INSERT INTO claim (id, tenant_id, entity_id, control_key, pack_key, origin, revision,
             status, value, asserted_by, asserted_at)
           VALUES ($1,'t-alpha','ek','C-1','eaa-accessibility','INTERNAL_ASSERTION',
             ${id === 'clm_a' ? 1 : 2},'APPROVED',$2,'u', now())`,
          [id, id],
        ),
      )
    }
    const claims = await uow('t-alpha', (u) => u.claims.listByEntity('ek'))
    expect(claims.filter((c) => c.status === 'APPROVED')).toHaveLength(2)
  })

  it('requests / submissions are RLS-scoped; grants resolve by hash without a tenant; submissions are append-only', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'er'), makeEvaluation('t-alpha', 'er'))
      await u.requests.insertRequest({
        id: 'req_1',
        tenantId: 't-alpha',
        entityId: 'er',
        packKey: 'eaa-accessibility',
        status: 'DRAFT',
        message: null,
        dueAt: null,
        createdBy: 'tester',
        createdAt: AT,
      })
      await u.requests.insertItem({
        id: 'rqi_1',
        tenantId: 't-alpha',
        requestId: 'req_1',
        controlKey: 'C-1',
        instructions: null,
        requiredInRequest: true,
      })
      await u.requests.insertGrant({
        id: 'tkn_1',
        tenantId: 't-alpha',
        requestId: 'req_1',
        tokenPrefix: 'abcd1234',
        tokenHash: 'hash-xyz',
        scope: 'contributor_submit',
        expiresAt: '2099-01-01T00:00:00.000Z',
        maxUses: null,
        uses: 0,
        revokedAt: null,
        createdAt: AT,
      })
      await u.requests.insertSubmission({
        id: 'sub_1',
        tenantId: 't-alpha',
        requestId: 'req_1',
        submissionVersion: 1,
        submitterIdentity: 'Jane',
        receiptId: 'rcpt_1',
        submittedAt: AT,
      })
    })

    // grant resolves by hash from a plain pool with no app.tenant_id set
    const grant = await pgResolveGrant(adminPool, 'hash-xyz')
    expect(grant?.requestId).toBe('req_1')
    expect(grant?.tenantId).toBe('t-alpha')

    // another tenant sees no request / submission rows at all
    const bravo = await withTenant(appPool, 't-bravo', async (c) => ({
      requests: (await c.query('SELECT id FROM evidence_request')).rows,
      submissions: (await c.query('SELECT id FROM contributor_submission')).rows,
    }))
    expect(bravo).toEqual({ requests: [], submissions: [] })
    expect(await uow('t-bravo', (u) => u.requests.getRequest('req_1'))).toBeNull()

    // contributor_submission is append-only; the grant can only change bookkeeping columns
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query(`DELETE FROM contributor_submission`)),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) =>
        c.query(`UPDATE access_token_grant SET request_id = 'x'`),
      ),
    ).rejects.toThrow(/permission denied/i)
    await withTenant(appPool, 't-alpha', (c) =>
      c.query(`UPDATE access_token_grant SET uses = uses + 1, revoked_at = now()`),
    )
  })

  it('request_draft is RLS-scoped and mutable (upsert overwrites, submit-style delete works)', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'ed'), makeEvaluation('t-alpha', 'ed'))
      await u.requests.insertRequest({
        id: 'req_d',
        tenantId: 't-alpha',
        entityId: 'ed',
        packKey: 'eaa-accessibility',
        status: 'SENT',
        message: null,
        dueAt: null,
        createdBy: 'tester',
        createdAt: AT,
      })
      await u.requests.upsertDraft({
        requestId: 'req_d',
        tenantId: 't-alpha',
        payload: { items: [{ requestItemId: 'rqi_d', value: 'v1' }] },
        updatedAt: AT,
      })
    })

    // upsert overwrites in place — still one row, new payload
    await uow('t-alpha', (u) =>
      u.requests.upsertDraft({
        requestId: 'req_d',
        tenantId: 't-alpha',
        payload: { items: [{ requestItemId: 'rqi_d', value: 'v2' }] },
        updatedAt: '2026-08-31T00:00:00.000Z',
      }),
    )
    const draft = await uow('t-alpha', (u) => u.requests.getDraft('req_d'))
    expect(draft?.payload).toEqual({ items: [{ requestItemId: 'rqi_d', value: 'v2' }] })

    // another tenant sees nothing
    expect(await uow('t-bravo', (u) => u.requests.getDraft('req_d'))).toBeNull()
    const bravoRows = await withTenant(appPool, 't-bravo', (c) =>
      c.query('SELECT request_id FROM request_draft'),
    )
    expect(bravoRows.rows).toEqual([])

    // delete (what submit does) clears it
    await uow('t-alpha', (u) => u.requests.deleteDraft('req_d'))
    expect(await uow('t-alpha', (u) => u.requests.getDraft('req_d'))).toBeNull()
  })

  it('readiness_snapshot is RLS-scoped and append-only to the app role', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'es'), makeEvaluation('t-alpha', 'es'))
      await u.snapshots.insert({
        id: 'rsnap_1',
        tenantId: 't-alpha',
        entityId: 'es',
        packKey: 'eaa-accessibility',
        snapshotKey: 'SNAP-1',
        evaluationId: 'es-eval',
        entityStatus: 'REVIEW_NEEDED',
        readinessCounts: { EVIDENCED: 0, MISSING: 1 },
        document: {
          schemaVersion: '1.0',
          controls: [],
          exceptions: [],
        } as unknown as CanonicalExport,
        contentHash: 'sha256:cafe',
        createdBy: 'tester',
        createdAt: AT,
      })
    })

    const got = await uow('t-alpha', (u) => u.snapshots.get('rsnap_1'))
    expect(got?.contentHash).toBe('sha256:cafe')
    expect(await uow('t-alpha', (u) => u.snapshots.listByEntity('es'))).toHaveLength(1)

    expect(await uow('t-bravo', (u) => u.snapshots.get('rsnap_1'))).toBeNull()
    const bravoRows = await withTenant(appPool, 't-bravo', (c) =>
      c.query('SELECT id FROM readiness_snapshot'),
    )
    expect(bravoRows.rows).toEqual([])

    await expect(
      withTenant(appPool, 't-alpha', (c) =>
        c.query(`UPDATE readiness_snapshot SET content_hash = 'x'`),
      ),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query('DELETE FROM readiness_snapshot')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('notification is RLS-scoped; only read_at is updatable by the app role', async () => {
    const insert = (id: string, tenant: string) =>
      withTenant(appPool, tenant, (c) =>
        c.query(
          `INSERT INTO notification (id, tenant_id, event_topic, title, body, created_at)
           VALUES ($1, $2, 'request.submitted', 'A supplier submitted', 'body', $3)`,
          [id, tenant, AT],
        ),
      )
    await insert('ntf_a', 't-alpha')
    await insert('ntf_a2', 't-alpha')
    await insert('ntf_b', 't-bravo')

    const alpha = await uow('t-alpha', (u) =>
      u.notifications.list({ unreadOnly: false, limit: 10 }),
    )
    expect(alpha.map((n) => n.id).sort()).toEqual(['ntf_a', 'ntf_a2'])
    expect(await uow('t-alpha', (u) => u.notifications.countUnread())).toBe(2)

    expect(await uow('t-alpha', (u) => u.notifications.markRead('ntf_a', AT))).toBe(true)
    expect(await uow('t-alpha', (u) => u.notifications.markRead('ntf_b', AT))).toBe(false) // other tenant
    expect(await uow('t-alpha', (u) => u.notifications.countUnread())).toBe(1)

    // another tenant sees nothing
    const bravoRows = await withTenant(appPool, 't-bravo', (c) =>
      c.query('SELECT id FROM notification WHERE tenant_id = $1', ['t-alpha']),
    )
    expect(bravoRows.rows).toEqual([])

    // title/body are immutable to rre_app; read_at is not
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query(`UPDATE notification SET title = 'x'`)),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query('DELETE FROM notification')),
    ).rejects.toThrow(/permission denied/i)
    await withTenant(appPool, 't-alpha', (c) =>
      c.query('UPDATE notification SET read_at = now() WHERE id = $1', ['ntf_a2']),
    )
  })

  it('document + association are RLS-scoped; only lifecycle columns are mutable', async () => {
    await uow('t-alpha', async (u) => {
      await u.documents.insert({
        id: 'doc_1',
        tenantId: 't-alpha',
        filename: 'a.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 10,
        uploadKey: 'quarantine/t-alpha/doc_1',
        objectKey: null,
        contentHash: null,
        accessClass: 'INTERNAL_CONFIDENTIAL',
        status: 'UPLOADING',
        scanNote: null,
        ingestedBy: 'tester',
        createdAt: AT,
        availableAt: null,
      })
      await u.documents.insertAssociation({
        id: 'dass_1',
        tenantId: 't-alpha',
        documentId: 'doc_1',
        targetType: 'regulated_entity',
        targetId: 'ent_1',
        addedBy: 'tester',
        createdAt: AT,
      })
      await u.documents.setScanResult('doc_1', {
        status: 'AVAILABLE',
        objectKey: 'originals/t-alpha/doc_1',
        contentHash: 'sha256:beef',
        availableAt: AT,
      })
    })

    const got = await uow('t-alpha', (u) => u.documents.get('doc_1'))
    expect(got).toMatchObject({ status: 'AVAILABLE', objectKey: 'originals/t-alpha/doc_1' })
    expect(
      await uow('t-alpha', (u) => u.documents.listByTarget('regulated_entity', 'ent_1')),
    ).toHaveLength(1)

    expect(await uow('t-bravo', (u) => u.documents.get('doc_1'))).toBeNull()
    const bravoRows = await withTenant(appPool, 't-bravo', (c) =>
      c.query('SELECT id FROM document'),
    )
    expect(bravoRows.rows).toEqual([])

    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query(`UPDATE document SET filename = 'x'`)),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query('DELETE FROM document_association')),
    ).rejects.toThrow(/permission denied/i)
    await withTenant(appPool, 't-alpha', (c) =>
      c.query(`UPDATE document SET status = 'DELETED_PENDING_PURGE' WHERE id = 'doc_1'`),
    )
  })

  it('evidence links are RLS-scoped and append-only; an approved claim with one reads as evidenced', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'ee'), makeEvaluation('t-alpha', 'ee'))
      await u.claims.insert({
        id: 'clm_e',
        tenantId: 't-alpha',
        entityId: 'ee',
        controlKey: 'C-1',
        packKey: 'eaa-accessibility',
        origin: 'INTERNAL_ASSERTION',
        revision: 1,
        supersedesClaimId: null,
        status: 'APPROVED',
        value: 'v',
        unit: null,
        methodContext: null,
        asOfDate: null,
        note: null,
        evidenceUrl: null,
        assertedBy: 'tester',
        assertedAt: AT,
      })
      await u.documents.insert({
        id: 'doc_e',
        tenantId: 't-alpha',
        filename: 'e.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 10,
        uploadKey: 'quarantine/t-alpha/doc_e',
        objectKey: 'originals/t-alpha/doc_e',
        contentHash: 'sha256:beef',
        accessClass: 'INTERNAL_CONFIDENTIAL',
        status: 'AVAILABLE',
        scanNote: null,
        ingestedBy: 'tester',
        createdAt: AT,
        availableAt: AT,
      })
      await u.claims.linkEvidence(
        {
          id: 'evl_e',
          tenantId: 't-alpha',
          documentId: 'doc_e',
          page: 3,
          sheet: null,
          cell: null,
          bbox: null,
          quote: 'here',
          locationHash: 'sha256:loc',
          createdBy: 'tester',
          createdAt: AT,
        },
        {
          id: 'cel_e',
          tenantId: 't-alpha',
          claimId: 'clm_e',
          evidenceLocationId: 'evl_e',
          supportType: 'SUPPORTS',
          addedBy: 'tester',
          createdAt: AT,
        },
      )
    })

    const byEntity = await uow('t-alpha', (u) => u.claims.listEvidenceByEntity('ee'))
    expect(byEntity).toEqual([
      expect.objectContaining({
        claimId: 'clm_e',
        documentId: 'doc_e',
        documentFilename: 'e.pdf',
        page: 3,
      }),
    ])

    expect(await uow('t-bravo', (u) => u.claims.listEvidenceByClaim('clm_e'))).toEqual([])
    const bravoRows = await withTenant(appPool, 't-bravo', (c) =>
      c.query('SELECT id FROM claim_evidence_link'),
    )
    expect(bravoRows.rows).toEqual([])

    await expect(
      withTenant(appPool, 't-alpha', (c) =>
        c.query(`UPDATE claim_evidence_link SET support_type = 'CONTEXT'`),
      ),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query('DELETE FROM evidence_location')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('extraction runs + proposals are RLS-scoped; only the outcome columns are mutable', async () => {
    await uow('t-alpha', async (u) => {
      await u.extraction.insertRun({
        id: 'xrun_1',
        tenantId: 't-alpha',
        documentId: 'doc_1',
        entityId: 'ent_1',
        extractorName: 'keyword',
        modelId: 'keyword-lines@1',
        schemaVersion: '1.0',
        documentHash: 'sha256:beef',
        status: 'RUNNING',
        error: null,
        proposalCount: 0,
        startedBy: 'tester',
        startedAt: AT,
        finishedAt: null,
      })
      await u.extraction.insertProposal({
        id: 'xprp_1',
        tenantId: 't-alpha',
        runId: 'xrun_1',
        documentId: 'doc_1',
        controlKey: 'C-1',
        value: 'v',
        unit: null,
        method: null,
        confidence: 0.6,
        page: null,
        quote: 'a line',
        validation: [],
        status: 'PENDING',
        decidedBy: null,
        decidedAt: null,
        reason: null,
        acceptedClaimId: null,
        createdAt: AT,
      })
      await u.extraction.setRunResult('xrun_1', {
        status: 'COMPLETED',
        proposalCount: 1,
        finishedAt: AT,
      })
      await u.extraction.setProposalDecision('xprp_1', {
        status: 'REJECTED',
        decidedBy: 'tester',
        decidedAt: AT,
        reason: 'nope',
      })
    })

    expect(await uow('t-alpha', (u) => u.extraction.getRun('xrun_1'))).toMatchObject({
      status: 'COMPLETED',
      proposalCount: 1,
    })
    expect(
      (await uow('t-alpha', (u) => u.extraction.listProposalsByRun('xrun_1')))[0],
    ).toMatchObject({
      status: 'REJECTED',
      reason: 'nope',
    })
    expect(await uow('t-bravo', (u) => u.extraction.getRun('xrun_1'))).toBeNull()

    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query(`UPDATE extraction_run SET model_id = 'x'`)),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query(`UPDATE extraction_proposal SET value = 'x'`)),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query('DELETE FROM extraction_proposal')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('applicability_override is RLS-scoped and append-only except for revoked_at', async () => {
    await uow('t-alpha', async (u) => {
      await u.overrides.insert({
        id: 'aov_1',
        tenantId: 't-alpha',
        entityId: 'ent_1',
        controlKey: 'C-1',
        result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
        rationale: 'covered elsewhere',
        sourceRef: null,
        effectiveEvaluationId: 'eval_1',
        expiresAt: null,
        createdBy: 'tester',
        createdAt: AT,
        revokedAt: null,
      })
      await u.overrides.revoke('aov_1', AT)
    })

    expect(await uow('t-alpha', (u) => u.overrides.get('aov_1'))).toMatchObject({ revokedAt: AT })
    expect(await uow('t-bravo', (u) => u.overrides.get('aov_1'))).toBeNull()
    const bravoRows = await withTenant(appPool, 't-bravo', (c) =>
      c.query('SELECT id FROM applicability_override'),
    )
    expect(bravoRows.rows).toEqual([])

    await expect(
      withTenant(appPool, 't-alpha', (c) =>
        c.query(`UPDATE applicability_override SET rationale = 'x'`),
      ),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      withTenant(appPool, 't-alpha', (c) => c.query('DELETE FROM applicability_override')),
    ).rejects.toThrow(/permission denied/i)
    await withTenant(appPool, 't-alpha', (c) =>
      c.query('UPDATE applicability_override SET revoked_at = now() WHERE id = $1', ['aov_1']),
    )
  })

  it('isolates evaluations by pack_key within a tenant', async () => {
    await uow('t-alpha', async (u) => {
      await u.entities.create(makeEntity('t-alpha', 'e5'), makeEvaluation('t-alpha', 'e5'))
    })
    // A later evaluation of the same entity, on a different pack, for the same tenant.
    await withTenant(appPool, 't-alpha', (c) =>
      c.query(
        `INSERT INTO entity_scope_evaluation
           (id, entity_id, tenant_id, pack_key, snapshot_key, version, facts, results, evaluated_at, evaluated_by, hash)
         VALUES ('x-eval','e5','t-alpha','cra','CRA-SNAP',2,'{}'::jsonb,'[]'::jsonb, now(),'u','sha256:x')`,
      ),
    )

    const perPack = await withTenant(appPool, 't-alpha', async (c) => ({
      eaa: (
        await c.query(
          `SELECT count(*)::int AS n FROM entity_scope_evaluation WHERE pack_key = 'eaa-accessibility'`,
        )
      ).rows[0].n,
      cra: (
        await c.query(
          `SELECT count(*)::int AS n FROM entity_scope_evaluation WHERE pack_key = 'cra'`,
        )
      ).rows[0].n,
    }))
    expect(perPack).toEqual({ eaa: 1, cra: 1 })
  })
})
