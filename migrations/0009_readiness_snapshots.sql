-- 0009_readiness_snapshots — immutable point-in-time readiness records (TRD §6.6, §13.4, §14).
--
-- A snapshot freezes the canonical export document for an entity against its
-- current control snapshot and approved claims. It is append-only: a later claim
-- approval or applicability change never alters an existing snapshot. Exports
-- (canonical JSON, CSV matrix) are renderings of `document` — nothing else is
-- persisted for them yet.

CREATE TABLE readiness_snapshot (
  id               text PRIMARY KEY,
  seq              bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id        text NOT NULL,
  entity_id        text NOT NULL,
  pack_key         text NOT NULL,
  snapshot_key     text NOT NULL,
  evaluation_id    text NOT NULL,
  entity_status    text NOT NULL,
  readiness_counts jsonb NOT NULL,
  document         jsonb NOT NULL,
  content_hash     text NOT NULL,
  created_by       text NOT NULL,
  created_at       timestamptz NOT NULL
);
CREATE INDEX readiness_snapshot_entity_idx ON readiness_snapshot (tenant_id, entity_id, seq DESC);

ALTER TABLE readiness_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_snapshot FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON readiness_snapshot
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Append-only to the application role, like audit_event and review_decision.
REVOKE UPDATE, DELETE, TRUNCATE ON readiness_snapshot FROM rre_app;
