-- 0016_accounts — workspaces, people, memberships, invites (SaaS tenancy control plane).
--
-- These four tables are the control plane, not tenant business data: they are
-- read BEFORE a tenant context exists (sign-in, "my workspaces", accepting an
-- invite by token). Like `access_token_grant` (migration 0006) they therefore
-- carry NO row-level security and are scoped in the service layer — every repo
-- method takes an explicit tenant id or user id and bakes it into the query.
--
-- House style: no foreign keys (tenant isolation + application logic instead).
-- `rre_app` already has blanket DML on new tables via ALTER DEFAULT PRIVILEGES
-- (migration 0002), so no per-table GRANT is needed here.

CREATE TABLE app_user (
  id           text PRIMARY KEY,
  email        text NOT NULL UNIQUE,
  name         text,
  locale       text NOT NULL DEFAULT 'en',
  created_at   timestamptz NOT NULL,
  last_seen_at timestamptz
);

CREATE TABLE tenant (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  plan       text NOT NULL DEFAULT 'trial'
               CHECK (plan IN ('trial', 'starter', 'growth', 'suspended')),
  locale     text NOT NULL DEFAULT 'en',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE membership (
  id         text PRIMARY KEY,
  tenant_id  text NOT NULL,
  user_id    text NOT NULL,
  role       text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_by text,
  created_at timestamptz NOT NULL,
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX membership_user_idx ON membership (user_id);
CREATE INDEX membership_tenant_idx ON membership (tenant_id);

CREATE TABLE tenant_invite (
  id               text PRIMARY KEY,
  tenant_id        text NOT NULL,
  email            text NOT NULL,
  role             text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  token_prefix     text NOT NULL,
  token_hash       text NOT NULL UNIQUE,
  expires_at       timestamptz NOT NULL,
  accepted_at      timestamptz,
  accepted_user_id text,
  revoked_at       timestamptz,
  created_by       text NOT NULL,
  created_at       timestamptz NOT NULL
);
CREATE INDEX tenant_invite_prefix_idx ON tenant_invite (token_prefix);
CREATE INDEX tenant_invite_tenant_idx ON tenant_invite (tenant_id);
