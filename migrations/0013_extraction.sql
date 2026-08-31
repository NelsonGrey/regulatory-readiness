-- 0013_extraction — AI/OCR extraction runs and proposals (engine TRD §6.5, §11).
--
-- An extraction run records the adapter + model + schema version + input hashes
-- for reproducibility. Each proposal is a candidate value for one control with a
-- REQUIRED source location; a human accepts (→ a claim + evidence link) or
-- rejects it. No proposal ever becomes an approved value without that gate.

CREATE TABLE extraction_run (
  id             text PRIMARY KEY,
  seq            bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id      text NOT NULL,
  document_id    text NOT NULL,
  entity_id      text NOT NULL,
  extractor_name text NOT NULL,
  model_id       text NOT NULL,
  schema_version text NOT NULL,
  document_hash  text,
  status         text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  error          text,
  proposal_count integer NOT NULL DEFAULT 0,
  started_by     text NOT NULL,
  started_at     timestamptz NOT NULL,
  finished_at    timestamptz
);
CREATE INDEX extraction_run_document_idx ON extraction_run (tenant_id, document_id, seq DESC);

CREATE TABLE extraction_proposal (
  id           text PRIMARY KEY,
  seq          bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id    text NOT NULL,
  run_id       text NOT NULL,
  document_id  text NOT NULL,
  control_key  text NOT NULL,
  value        text NOT NULL,
  unit         text,
  method       text,
  confidence   numeric,
  page         integer,
  quote        text NOT NULL,
  validation   jsonb NOT NULL DEFAULT '[]'::jsonb,
  status       text NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED')),
  decided_by   text,
  decided_at   timestamptz,
  reason       text,
  accepted_claim_id text,
  created_at   timestamptz NOT NULL
);
CREATE INDEX extraction_proposal_run_idx ON extraction_proposal (tenant_id, run_id);

ALTER TABLE extraction_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_run FORCE ROW LEVEL SECURITY;
ALTER TABLE extraction_proposal ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_proposal FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON extraction_run
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON extraction_proposal
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Runs and proposals are append-oriented: the run's outcome columns and a
-- proposal's decision columns move once; nothing else changes, nothing is deleted.
REVOKE UPDATE, DELETE, TRUNCATE ON extraction_run FROM rre_app;
GRANT UPDATE (status, error, proposal_count, finished_at) ON extraction_run TO rre_app;
REVOKE UPDATE, DELETE, TRUNCATE ON extraction_proposal FROM rre_app;
GRANT UPDATE (status, decided_by, decided_at, reason, accepted_claim_id) ON extraction_proposal TO rre_app;
