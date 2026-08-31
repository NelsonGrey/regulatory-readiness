-- 0014_applicability_overrides — a recorded, reasoned change to one control's
-- applicability for one entity (engine TRD §13.3). It never touches the global
-- control snapshot or the frozen scope evaluation; readiness derivation layers
-- the active override on top.

CREATE TABLE applicability_override (
  id                     text PRIMARY KEY,
  seq                    bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id              text NOT NULL,
  entity_id              text NOT NULL,
  control_key            text NOT NULL,
  result                 text NOT NULL CHECK (result IN
                           ('REQUIRED_BY_SNAPSHOT', 'OPTIONAL_IF_AVAILABLE', 'CONDITIONAL_FACT_REQUIRED',
                            'NOT_YET_REQUIRED_BY_SNAPSHOT', 'DUPLICATE_SOURCE_FIELD',
                            'NOT_APPLICABLE_TO_CLASSIFICATION', 'NEEDS_SPECIALIST_REVIEW')),
  rationale              text NOT NULL,
  source_ref             text,
  effective_evaluation_id text NOT NULL,
  expires_at             timestamptz,
  created_by             text NOT NULL,
  created_at             timestamptz NOT NULL,
  revoked_at             timestamptz
);
CREATE INDEX applicability_override_entity_idx
  ON applicability_override (tenant_id, entity_id, seq DESC);

ALTER TABLE applicability_override ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicability_override FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON applicability_override
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Append-only except for withdrawal (revoked_at). No deletes — the record stays.
REVOKE UPDATE, DELETE, TRUNCATE ON applicability_override FROM rre_app;
GRANT UPDATE (revoked_at) ON applicability_override TO rre_app;
