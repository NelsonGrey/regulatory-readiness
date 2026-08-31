-- 0015_deletion — customer deletion workflow (engine TRD §21.2).
--
-- A deletion request records the ask, an impact preview, and — once executed —
-- the row counts that were purged and the completion time. The request row is
-- the tombstone: it survives the purge as completion evidence, holding no
-- deleted content.

CREATE TABLE deletion_request (
  id            text PRIMARY KEY,
  seq           bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id     text NOT NULL,
  scope         text NOT NULL CHECK (scope IN ('tenant')),
  status        text NOT NULL CHECK (status IN ('REQUESTED', 'COMPLETED', 'CANCELLED')),
  preview       jsonb NOT NULL DEFAULT '{}'::jsonb,
  purged        jsonb,
  requested_by  text NOT NULL,
  requested_at  timestamptz NOT NULL,
  completed_by  text,
  completed_at  timestamptz
);
CREATE INDEX deletion_request_tenant_idx ON deletion_request (tenant_id, seq DESC);

ALTER TABLE deletion_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_request FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON deletion_request
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Append-only except the completion columns; never deleted.
REVOKE UPDATE, DELETE, TRUNCATE ON deletion_request FROM rre_app;
GRANT UPDATE (status, purged, completed_by, completed_at) ON deletion_request TO rre_app;

-- The purge deletes every tenant-owned row across every table (including the
-- append-only ones `rre_app` cannot touch), so it runs as the schema owner via
-- SECURITY DEFINER. `deletion_request` is deliberately excluded.
CREATE FUNCTION purge_tenant(target_tenant text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  tbl text;
  n bigint;
  deleted jsonb := '{}'::jsonb;
  tables text[] := ARRAY[
    'entity_scope_evaluation', 'regulated_entity', 'claim', 'review_decision',
    'evidence_location', 'claim_evidence_link', 'evidence_request', 'request_item',
    'access_token_grant', 'contributor_submission', 'contributor_response_item',
    'request_draft', 'readiness_snapshot', 'notification', 'document',
    'document_association', 'extraction_run', 'extraction_proposal',
    'applicability_override', 'outbox', 'audit_event'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DELETE FROM %I WHERE tenant_id = $1', tbl) USING target_tenant;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      deleted := deleted || jsonb_build_object(tbl, n);
    END IF;
  END LOOP;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION purge_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_tenant(text) TO rre_app;
