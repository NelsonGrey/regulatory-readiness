-- 0006_requests — the contributor request loop (engine detailed design 02/03).
--
-- An operator builds a scoped request; an outside party opens it via an
-- unguessable expiring token (no workspace account) and submits values.
-- Submissions are immutable versions.

CREATE TABLE evidence_request (
  id         text PRIMARY KEY,
  seq        bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id  text NOT NULL,
  entity_id  text NOT NULL,
  pack_key   text NOT NULL,
  status     text NOT NULL CHECK (status IN
               ('DRAFT', 'SENT', 'IN_PROGRESS', 'SUBMITTED', 'CLOSED', 'CANCELLED', 'EXPIRED')),
  message    text,
  due_at     timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX evidence_request_entity_idx ON evidence_request (tenant_id, entity_id);

CREATE TABLE request_item (
  id                  text PRIMARY KEY,
  tenant_id           text NOT NULL,
  request_id          text NOT NULL,
  control_key         text NOT NULL,
  instructions        text,
  required_in_request boolean NOT NULL DEFAULT true,
  UNIQUE (request_id, control_key)
);
CREATE INDEX request_item_request_idx ON request_item (tenant_id, request_id);

-- No RLS: the portal looks this up by unguessable hash BEFORE the tenant is
-- known. The row reveals only request_id + tenant_id + scope; every further
-- portal operation runs under the resolved tenant's RLS.
CREATE TABLE access_token_grant (
  id           text PRIMARY KEY,
  tenant_id    text NOT NULL,
  request_id   text NOT NULL,
  token_prefix text NOT NULL,
  token_hash   text NOT NULL UNIQUE,
  scope        text NOT NULL DEFAULT 'contributor_submit',
  expires_at   timestamptz NOT NULL,
  max_uses     integer,
  uses         integer NOT NULL DEFAULT 0,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL
);
CREATE INDEX access_token_grant_prefix_idx ON access_token_grant (token_prefix);

CREATE TABLE contributor_submission (
  id                 text PRIMARY KEY,
  seq                bigint GENERATED ALWAYS AS IDENTITY,
  tenant_id          text NOT NULL,
  request_id         text NOT NULL,
  submission_version integer NOT NULL,
  submitter_identity text,
  receipt_id         text NOT NULL,
  submitted_at       timestamptz NOT NULL,
  UNIQUE (request_id, submission_version)
);
CREATE INDEX contributor_submission_request_idx ON contributor_submission (tenant_id, request_id);

CREATE TABLE contributor_response_item (
  id                 text PRIMARY KEY,
  tenant_id          text NOT NULL,
  submission_id      text NOT NULL,
  request_item_id    text NOT NULL,
  control_key        text NOT NULL,
  value              text,
  unit               text,
  method_note        text,
  availability_state text NOT NULL CHECK (availability_state IN
                       ('VALUE_SUPPLIED', 'UNAVAILABLE', 'UNKNOWN',
                        'NOT_APPLICABLE', 'NEEDS_CLARIFICATION')),
  comment            text
);
CREATE INDEX contributor_response_item_submission_idx
  ON contributor_response_item (tenant_id, submission_id);

ALTER TABLE evidence_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_request FORCE ROW LEVEL SECURITY;
ALTER TABLE request_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_item FORCE ROW LEVEL SECURITY;
ALTER TABLE contributor_submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_submission FORCE ROW LEVEL SECURITY;
ALTER TABLE contributor_response_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_response_item FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON evidence_request
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON request_item
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON contributor_submission
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON contributor_response_item
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Submissions and their items are append-only to the application role.
REVOKE UPDATE, DELETE, TRUNCATE ON contributor_submission FROM rre_app;
REVOKE UPDATE, DELETE, TRUNCATE ON contributor_response_item FROM rre_app;
-- The token grant: read/insert freely, update only bookkeeping columns.
REVOKE UPDATE ON access_token_grant FROM rre_app;
GRANT UPDATE (uses, revoked_at) ON access_token_grant TO rre_app;
