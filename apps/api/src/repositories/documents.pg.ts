import type { PoolClient } from 'pg'
import type {
  AccessClass,
  AssociationTarget,
  DocumentAssociationRecord,
  DocumentRecord,
  DocumentRepository,
  DocumentStatus,
  ScanResultPatch,
} from '../services/documents.js'

interface DocumentRow {
  id: string
  tenant_id: string
  filename: string
  media_type: string
  size_bytes: string
  upload_key: string
  object_key: string | null
  content_hash: string | null
  access_class: AccessClass
  status: DocumentStatus
  scan_note: string | null
  ingested_by: string
  created_at: Date
  available_at: Date | null
}

interface AssociationRow {
  id: string
  tenant_id: string
  document_id: string
  target_type: AssociationTarget
  target_id: string
  added_by: string
  created_at: Date
}

const toDoc = (r: DocumentRow): DocumentRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  filename: r.filename,
  mediaType: r.media_type,
  sizeBytes: Number(r.size_bytes),
  uploadKey: r.upload_key,
  objectKey: r.object_key,
  contentHash: r.content_hash,
  accessClass: r.access_class,
  status: r.status,
  scanNote: r.scan_note,
  ingestedBy: r.ingested_by,
  createdAt: r.created_at.toISOString(),
  availableAt: r.available_at ? r.available_at.toISOString() : null,
})

const toAssoc = (r: AssociationRow): DocumentAssociationRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  documentId: r.document_id,
  targetType: r.target_type,
  targetId: r.target_id,
  addedBy: r.added_by,
  createdAt: r.created_at.toISOString(),
})

export class PgDocumentRepository implements DocumentRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async insert(d: DocumentRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO document
         (id, tenant_id, filename, media_type, size_bytes, upload_key, object_key, content_hash,
          access_class, status, scan_note, ingested_by, created_at, available_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        d.id,
        d.tenantId,
        d.filename,
        d.mediaType,
        d.sizeBytes,
        d.uploadKey,
        d.objectKey,
        d.contentHash,
        d.accessClass,
        d.status,
        d.scanNote,
        d.ingestedBy,
        d.createdAt,
        d.availableAt,
      ],
    )
  }

  async get(id: string): Promise<DocumentRecord | null> {
    const res = await this.db.query<DocumentRow>(
      `SELECT * FROM document WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    return res.rows[0] ? toDoc(res.rows[0]) : null
  }

  async list(): Promise<DocumentRecord[]> {
    const res = await this.db.query<DocumentRow>(
      `SELECT * FROM document WHERE tenant_id = $1 ORDER BY seq DESC`,
      [this.tenantId],
    )
    return res.rows.map(toDoc)
  }

  async setScanResult(id: string, patch: ScanResultPatch): Promise<void> {
    await this.db.query(
      `UPDATE document
          SET status = $1,
              object_key = COALESCE($2, object_key),
              content_hash = COALESCE($3, content_hash),
              scan_note = $4,
              available_at = COALESCE($5, available_at)
        WHERE id = $6 AND tenant_id = $7`,
      [
        patch.status,
        patch.objectKey ?? null,
        patch.contentHash ?? null,
        patch.scanNote ?? null,
        patch.availableAt ?? null,
        id,
        this.tenantId,
      ],
    )
  }

  async insertAssociation(a: DocumentAssociationRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO document_association
         (id, tenant_id, document_id, target_type, target_id, added_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (document_id, target_type, target_id) DO NOTHING`,
      [a.id, a.tenantId, a.documentId, a.targetType, a.targetId, a.addedBy, a.createdAt],
    )
  }

  async listAssociations(documentId: string): Promise<DocumentAssociationRecord[]> {
    const res = await this.db.query<AssociationRow>(
      `SELECT * FROM document_association WHERE document_id = $1 AND tenant_id = $2 ORDER BY created_at`,
      [documentId, this.tenantId],
    )
    return res.rows.map(toAssoc)
  }

  async listByTarget(targetType: AssociationTarget, targetId: string): Promise<DocumentRecord[]> {
    const res = await this.db.query<DocumentRow>(
      `SELECT d.* FROM document d
         JOIN document_association a ON a.document_id = d.id AND a.tenant_id = d.tenant_id
        WHERE d.tenant_id = $1 AND a.target_type = $2 AND a.target_id = $3
        ORDER BY d.seq DESC`,
      [this.tenantId, targetType, targetId],
    )
    return res.rows.map(toDoc)
  }
}
