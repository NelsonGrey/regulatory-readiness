-- 0010_notifications — in-app notification feed (engine TRD §20 notifications).
--
-- The worker's notify consumer turns selected domain events (delivered via the
-- outbox -> relay -> SQS path) into per-tenant notification rows. Operators read
-- them and mark them read; nothing else about a row changes.

CREATE TABLE notification (
  id          text PRIMARY KEY,
  seq         bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id   text NOT NULL,
  event_topic text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  entity_id   text,
  target_type text,
  target_id   text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL
);
CREATE INDEX notification_tenant_idx ON notification (tenant_id, seq DESC);
CREATE INDEX notification_unread_idx ON notification (tenant_id, seq DESC) WHERE read_at IS NULL;

ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON notification
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- The only mutable column is read_at (mark-as-read). No deletes.
REVOKE UPDATE, DELETE, TRUNCATE ON notification FROM rre_app;
GRANT UPDATE (read_at) ON notification TO rre_app;
