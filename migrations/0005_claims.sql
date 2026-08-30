-- 0005_claims — claims and review decisions (engine TRD §12, §13).
--
-- A claim's value/identity is immutable (editing creates a new revision); only
-- the workflow fields (status, supersedes_claim_id) change. review_decision is
-- append-only, like audit_event.

CREATE TABLE claim (
  id                  text PRIMARY KEY,
  seq                 bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id           text NOT NULL,
  entity_id           text NOT NULL,
  control_key         text NOT NULL,
  pack_key            text NOT NULL,
  origin              text NOT NULL CHECK (origin IN
                        ('SUPPLIER_ASSERTION', 'INTERNAL_ASSERTION',
                         'EXTRACTION_ACCEPTED', 'IMPORTED_APPROVED_DATA')),
  revision            integer NOT NULL,
  supersedes_claim_id text,
  status              text NOT NULL CHECK (status IN
                        ('ASSERTED', 'PENDING_REVIEW', 'APPROVED',
                         'REJECTED', 'SUPERSEDED', 'WITHDRAWN')),
  value               text NOT NULL,
  unit                text,
  method_context      text,
  asof_date           date,
  note                text,
  evidence_url        text,
  asserted_by         text NOT NULL,
  asserted_at         timestamptz NOT NULL,
  UNIQUE (entity_id, control_key, revision)
);
CREATE INDEX claim_tenant_entity_idx ON claim (tenant_id, entity_id);
CREATE INDEX claim_control_idx ON claim (tenant_id, entity_id, control_key);

CREATE TABLE review_decision (
  id         text PRIMARY KEY,
  seq        bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id  text NOT NULL,
  claim_id   text NOT NULL,
  decision   text NOT NULL CHECK (decision IN
               ('APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED', 'SUPERSEDED')),
  reason     text,
  reviewer   text NOT NULL,
  decided_at timestamptz NOT NULL
);
CREATE INDEX review_decision_claim_idx ON review_decision (tenant_id, claim_id);

ALTER TABLE claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim FORCE ROW LEVEL SECURITY;
ALTER TABLE review_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_decision FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON claim
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON review_decision
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

REVOKE UPDATE ON claim FROM rre_app;
GRANT UPDATE (status, supersedes_claim_id) ON claim TO rre_app;
REVOKE UPDATE, DELETE, TRUNCATE ON review_decision FROM rre_app;
