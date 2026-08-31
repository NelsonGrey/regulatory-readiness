-- 0012_claim_evidence — link documents to claims as evidence (engine TRD §6.5, §12).
--
-- An evidence location pins a spot inside an AVAILABLE document (page / sheet /
-- cell / bounding box + quoted text); a claim-evidence link attaches one or more
-- locations to a specific claim revision. Both are append-only: a wrong link is
-- corrected by re-asserting the claim, not by editing history.

CREATE TABLE evidence_location (
  id            text PRIMARY KEY,
  seq           bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id     text NOT NULL,
  document_id   text NOT NULL,
  page          integer,
  sheet         text,
  cell          text,
  bbox          jsonb,
  quote         text,
  location_hash text NOT NULL,
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL
);
CREATE INDEX evidence_location_document_idx ON evidence_location (tenant_id, document_id);

CREATE TABLE claim_evidence_link (
  id                   text PRIMARY KEY,
  tenant_id            text NOT NULL,
  claim_id             text NOT NULL,
  evidence_location_id text NOT NULL,
  support_type         text NOT NULL DEFAULT 'SUPPORTS'
    CHECK (support_type IN ('SUPPORTS', 'CONTEXT', 'CONTRADICTS')),
  added_by             text NOT NULL,
  created_at           timestamptz NOT NULL,
  UNIQUE (claim_id, evidence_location_id)
);
CREATE INDEX claim_evidence_link_claim_idx ON claim_evidence_link (tenant_id, claim_id);

ALTER TABLE evidence_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_location FORCE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence_link FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON evidence_location
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON claim_evidence_link
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

REVOKE UPDATE, DELETE, TRUNCATE ON evidence_location FROM rre_app;
REVOKE UPDATE, DELETE, TRUNCATE ON claim_evidence_link FROM rre_app;
