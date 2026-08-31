-- 0011_documents — document intake + evidence store (engine TRD §6.5, §10, §15).
--
-- An upload lands in a quarantine object; only after a clean scan is it promoted
-- to an originals object and made downloadable. The object key, hash, size, and
-- media type are immutable once set; only the lifecycle columns move.

CREATE TABLE document (
  id           text PRIMARY KEY,
  seq          bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id    text NOT NULL,
  filename     text NOT NULL,
  media_type   text NOT NULL,
  size_bytes   bigint NOT NULL,
  upload_key   text NOT NULL,          -- quarantine object key (immutable)
  object_key   text,                   -- originals object key, set on promotion
  content_hash text,                   -- sha256:… computed at finalize
  access_class text NOT NULL DEFAULT 'INTERNAL_CONFIDENTIAL'
    CHECK (access_class IN ('PUBLIC_CANDIDATE', 'INTERNAL_CONFIDENTIAL', 'PARTY_CONFIDENTIAL')),
  status       text NOT NULL CHECK (status IN
                 ('UPLOADING', 'SCANNING', 'AVAILABLE', 'REJECTED_MALWARE', 'UNSUPPORTED',
                  'DELETED_PENDING_PURGE', 'PURGED')),
  scan_note    text,
  ingested_by  text NOT NULL,
  created_at   timestamptz NOT NULL,
  available_at timestamptz
);
CREATE INDEX document_tenant_idx ON document (tenant_id, seq DESC);

CREATE TABLE document_association (
  id          text PRIMARY KEY,
  tenant_id   text NOT NULL,
  document_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('regulated_entity', 'evidence_request', 'claim')),
  target_id   text NOT NULL,
  added_by    text NOT NULL,
  created_at  timestamptz NOT NULL,
  UNIQUE (document_id, target_type, target_id)
);
CREATE INDEX document_association_target_idx
  ON document_association (tenant_id, target_type, target_id);

ALTER TABLE document ENABLE ROW LEVEL SECURITY;
ALTER TABLE document FORCE ROW LEVEL SECURITY;
ALTER TABLE document_association ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_association FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON document
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON document_association
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- The immutable facts of a document cannot be rewritten by the app; only the
-- lifecycle columns move, and rows are never hard-deleted (purge is a status).
REVOKE UPDATE, DELETE, TRUNCATE ON document FROM rre_app;
GRANT UPDATE (object_key, content_hash, status, scan_note, available_at) ON document TO rre_app;
REVOKE UPDATE, DELETE, TRUNCATE ON document_association FROM rre_app;
