-- 0003_audit_and_outbox — append-only audit trail + transactional outbox (ADR 0004).
--
-- A command handler writes its business rows, the audit_event row, and any
-- outbox rows in ONE transaction; the API returns success only after commit.

CREATE TABLE audit_event (
  id             text PRIMARY KEY,
  seq            bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id      text NOT NULL,
  actor_type     text NOT NULL CHECK (actor_type IN ('user', 'token', 'system', 'support')),
  actor_id       text NOT NULL,
  action         text NOT NULL,
  target_type    text NOT NULL,
  target_id      text NOT NULL,
  occurred_at    timestamptz NOT NULL,
  correlation_id text,
  reason         text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_event_tenant_seq_idx ON audit_event (tenant_id, seq);
CREATE INDEX audit_event_target_idx ON audit_event (tenant_id, target_type, target_id);

CREATE TABLE outbox (
  id           text PRIMARY KEY,
  seq          bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id    text NOT NULL,
  topic        text NOT NULL,
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts     integer NOT NULL DEFAULT 0
);
CREATE INDEX outbox_unpublished_idx ON outbox (seq) WHERE published_at IS NULL;

ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON audit_event
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON outbox
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- audit_event is append-only to the application role: it may read and insert,
-- never update or delete. Corrections are new events.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_event FROM rre_app;
