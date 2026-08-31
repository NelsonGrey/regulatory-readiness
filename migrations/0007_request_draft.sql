-- 0007_request_draft — a contributor's in-progress answers, saved before submit.
--
-- Unlike contributor_submission (immutable versions), a draft is MUTABLE: it is
-- overwritten each time the contributor saves, and deleted once they submit. One
-- draft per request. A draft is never evidence on its own — only a submission is.

CREATE TABLE request_draft (
  request_id text PRIMARY KEY,
  tenant_id  text NOT NULL,
  payload    jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

ALTER TABLE request_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_draft FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON request_draft
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- rre_app already has SELECT/INSERT/UPDATE/DELETE via the default privileges in
-- migration 0002. The draft is deliberately mutable — no REVOKE here.
