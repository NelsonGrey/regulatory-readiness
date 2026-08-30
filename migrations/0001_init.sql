-- 0001_init — regulated entities and their immutable scope evaluations.
-- Tenancy: pooled model with row-level security (ADR 0002). Every tenant-owned
-- row carries tenant_id and pack_key; RLS is FORCEd so it applies even when the
-- app connects as the table owner (the dev case).

CREATE TABLE regulated_entity (
  id                    text PRIMARY KEY,
  tenant_id             text NOT NULL,
  pack_key              text NOT NULL,
  name                  text NOT NULL,
  entity_identifier     text NOT NULL,
  entity_kind           text NOT NULL CHECK (entity_kind IN ('product', 'service')),
  created_at            timestamptz NOT NULL,
  created_by            text NOT NULL,
  current_evaluation_id text NOT NULL,
  UNIQUE (tenant_id, entity_identifier)
);

CREATE TABLE entity_scope_evaluation (
  id           text PRIMARY KEY,
  entity_id    text NOT NULL,
  tenant_id    text NOT NULL,
  pack_key     text NOT NULL,
  snapshot_key text NOT NULL,
  version      integer NOT NULL,
  facts        jsonb NOT NULL,
  results      jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL,
  evaluated_by text NOT NULL,
  hash         text NOT NULL,
  UNIQUE (entity_id, version)
);

CREATE INDEX regulated_entity_tenant_idx ON regulated_entity (tenant_id);
CREATE INDEX entity_scope_evaluation_tenant_idx ON entity_scope_evaluation (tenant_id);
CREATE INDEX entity_scope_evaluation_entity_idx ON entity_scope_evaluation (entity_id);

ALTER TABLE regulated_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulated_entity FORCE ROW LEVEL SECURITY;
ALTER TABLE entity_scope_evaluation ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_scope_evaluation FORCE ROW LEVEL SECURITY;

-- current_setting(..., true) returns NULL when unset, so an unset session sees
-- and writes nothing (fail closed).
CREATE POLICY tenant_isolation ON regulated_entity
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON entity_scope_evaluation
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
