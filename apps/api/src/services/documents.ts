import { createHash, randomUUID } from 'node:crypto'
import type { AuthContext } from '../auth.js'
import type { UnitOfWork } from '../db/uow.js'
import {
  originalKey,
  quarantineKey,
  type ObjectStore,
  type PresignedUpload,
} from '../storage/object-store.js'
import { ALLOWED_MEDIA_TYPES, scanBytes } from '../storage/scan.js'

export const DEFAULT_MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

export type DocumentStatus =
  | 'UPLOADING'
  | 'SCANNING'
  | 'AVAILABLE'
  | 'REJECTED_MALWARE'
  | 'UNSUPPORTED'
  | 'DELETED_PENDING_PURGE'
  | 'PURGED'

export type AccessClass = 'PUBLIC_CANDIDATE' | 'INTERNAL_CONFIDENTIAL' | 'PARTY_CONFIDENTIAL'
export type AssociationTarget = 'regulated_entity' | 'evidence_request' | 'claim'

export interface DocumentRecord {
  id: string
  tenantId: string
  filename: string
  mediaType: string
  sizeBytes: number
  uploadKey: string
  objectKey: string | null
  contentHash: string | null
  accessClass: AccessClass
  status: DocumentStatus
  scanNote: string | null
  ingestedBy: string
  createdAt: string
  availableAt: string | null
}

export interface DocumentAssociationRecord {
  id: string
  tenantId: string
  documentId: string
  targetType: AssociationTarget
  targetId: string
  addedBy: string
  createdAt: string
}

export interface ScanResultPatch {
  status: DocumentStatus
  objectKey?: string | null
  contentHash?: string | null
  scanNote?: string | null
  availableAt?: string | null
}

export interface DocumentRepository {
  insert(d: DocumentRecord): Promise<void>
  get(id: string): Promise<DocumentRecord | null>
  list(): Promise<DocumentRecord[]>
  setScanResult(id: string, patch: ScanResultPatch): Promise<void>
  insertAssociation(a: DocumentAssociationRecord): Promise<void>
  listAssociations(documentId: string): Promise<DocumentAssociationRecord[]>
  listByTarget(targetType: AssociationTarget, targetId: string): Promise<DocumentRecord[]>
}

export interface InitiateUploadInput {
  filename: string
  mediaType: string
  sizeBytes: number
  accessClass?: AccessClass
  /** Optionally associate the new document with an entity right away. */
  entityId?: string
}

type Fail<C extends string> = { ok: false; code: C; message: string }

export type InitiateResult =
  | { ok: true; documentId: string; upload: PresignedUpload; objectKey: string }
  | Fail<'UNSUPPORTED_MEDIA_TYPE' | 'TOO_LARGE' | 'EMPTY'>

export type FinalizeResult =
  | { ok: true; status: DocumentStatus; contentHash: string | null; scanNote: string | null }
  | Fail<'NOT_FOUND' | 'ALREADY_FINALIZED' | 'NO_UPLOAD'>

export type DownloadResult = { ok: true; url: string } | Fail<'NOT_FOUND' | 'NOT_AVAILABLE'>

export type AssociateResult =
  { ok: true; association: DocumentAssociationRecord } | Fail<'NOT_FOUND'>

export class DocumentService {
  private readonly maxBytes: number

  constructor(
    private readonly uow: UnitOfWork,
    private readonly store: ObjectStore,
    opts: { maxBytes?: number } = {},
  ) {
    this.maxBytes = opts.maxBytes ?? DEFAULT_MAX_DOCUMENT_BYTES
  }

  async initiateUpload(
    auth: AuthContext,
    input: InitiateUploadInput,
    now: Date = new Date(),
  ): Promise<InitiateResult> {
    if (!ALLOWED_MEDIA_TYPES.has(input.mediaType)) {
      return {
        ok: false,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `media type "${input.mediaType}" is not accepted`,
      }
    }
    if (input.sizeBytes <= 0) {
      return {
        ok: false,
        code: 'EMPTY',
        message: 'the declared file size must be greater than zero',
      }
    }
    if (input.sizeBytes > this.maxBytes) {
      return { ok: false, code: 'TOO_LARGE', message: `exceeds the ${this.maxBytes}-byte limit` }
    }

    const documentId = `doc_${randomUUID()}`
    const uploadKey = quarantineKey(auth.tenantId, documentId)
    const at = now.toISOString()

    const doc: DocumentRecord = {
      id: documentId,
      tenantId: auth.tenantId,
      filename: input.filename,
      mediaType: input.mediaType,
      sizeBytes: input.sizeBytes,
      uploadKey,
      objectKey: null,
      contentHash: null,
      accessClass: input.accessClass ?? 'INTERNAL_CONFIDENTIAL',
      status: 'UPLOADING',
      scanNote: null,
      ingestedBy: auth.actor,
      createdAt: at,
      availableAt: null,
    }

    await this.uow(auth.tenantId, async (u) => {
      await u.documents.insert(doc)
      if (input.entityId) {
        await u.documents.insertAssociation({
          id: `dass_${randomUUID()}`,
          tenantId: auth.tenantId,
          documentId,
          targetType: 'regulated_entity',
          targetId: input.entityId,
          addedBy: auth.actor,
          createdAt: at,
        })
      }
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'document.upload_initiated',
        targetType: 'document',
        targetId: documentId,
        occurredAt: at,
        metadata: {
          filename: input.filename,
          mediaType: input.mediaType,
          entityId: input.entityId,
        },
      })
    })

    return {
      ok: true,
      documentId,
      upload: await this.store.presignUpload(uploadKey),
      objectKey: uploadKey,
    }
  }

  async finalizeUpload(
    auth: AuthContext,
    documentId: string,
    now: Date = new Date(),
  ): Promise<FinalizeResult> {
    const at = now.toISOString()
    const doc = await this.uow(auth.tenantId, (u) => u.documents.get(documentId))
    if (!doc) return { ok: false, code: 'NOT_FOUND', message: 'document not found' }
    if (doc.status !== 'UPLOADING') {
      return { ok: false, code: 'ALREADY_FINALIZED', message: `document is ${doc.status}` }
    }

    const head = await this.store.head(doc.uploadKey)
    if (!head) return { ok: false, code: 'NO_UPLOAD', message: 'no uploaded object was found' }

    const bytes = await this.store.getBytes(doc.uploadKey)
    const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    const verdict = scanBytes(bytes, doc.mediaType, this.maxBytes)

    let patch: ScanResultPatch
    let notified: 'document.available' | 'document.rejected'
    if (verdict.ok) {
      const objectKey = originalKey(auth.tenantId, documentId)
      await this.store.promote(doc.uploadKey, objectKey)
      patch = { status: 'AVAILABLE', objectKey, contentHash: hash, availableAt: at, scanNote: null }
      notified = 'document.available'
    } else {
      patch = { status: verdict.status, contentHash: hash, scanNote: verdict.note }
      notified = 'document.rejected'
    }

    await this.uow(auth.tenantId, async (u) => {
      await u.documents.setScanResult(documentId, patch)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: notified,
        targetType: 'document',
        targetId: documentId,
        occurredAt: at,
        metadata: { status: patch.status, contentHash: hash, scanNote: patch.scanNote ?? null },
      })
      await u.enqueue(notified, {
        documentId,
        status: patch.status,
        sizeBytes: head.size,
      })
    })

    return {
      ok: true,
      status: patch.status,
      contentHash: hash,
      scanNote: patch.scanNote ?? null,
    }
  }

  async list(auth: AuthContext, opts: { entityId?: string } = {}): Promise<DocumentRecord[]> {
    return this.uow(auth.tenantId, (u) =>
      opts.entityId
        ? u.documents.listByTarget('regulated_entity', opts.entityId)
        : u.documents.list(),
    )
  }

  async get(
    auth: AuthContext,
    id: string,
  ): Promise<{ document: DocumentRecord; associations: DocumentAssociationRecord[] } | null> {
    return this.uow(auth.tenantId, async (u) => {
      const document = await u.documents.get(id)
      if (!document) return null
      return { document, associations: await u.documents.listAssociations(id) }
    })
  }

  async downloadUrl(auth: AuthContext, id: string): Promise<DownloadResult> {
    const doc = await this.uow(auth.tenantId, (u) => u.documents.get(id))
    if (!doc) return { ok: false, code: 'NOT_FOUND', message: 'document not found' }
    if (doc.status !== 'AVAILABLE' || !doc.objectKey) {
      return { ok: false, code: 'NOT_AVAILABLE', message: `document is ${doc.status}` }
    }
    return { ok: true, url: await this.store.downloadUrl(doc.objectKey) }
  }

  async associate(
    auth: AuthContext,
    documentId: string,
    target: { targetType: AssociationTarget; targetId: string },
    now: Date = new Date(),
  ): Promise<AssociateResult> {
    return this.uow(auth.tenantId, async (u) => {
      const doc = await u.documents.get(documentId)
      if (!doc) return { ok: false, code: 'NOT_FOUND', message: 'document not found' }
      const at = now.toISOString()
      const association: DocumentAssociationRecord = {
        id: `dass_${randomUUID()}`,
        tenantId: auth.tenantId,
        documentId,
        targetType: target.targetType,
        targetId: target.targetId,
        addedBy: auth.actor,
        createdAt: at,
      }
      await u.documents.insertAssociation(association)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'document.associated',
        targetType: 'document',
        targetId: documentId,
        occurredAt: at,
        metadata: { targetType: target.targetType, targetId: target.targetId },
      })
      return { ok: true, association }
    })
  }
}
