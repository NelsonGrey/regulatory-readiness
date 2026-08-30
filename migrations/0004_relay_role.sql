-- 0004_relay_role — the outbox relay role.
--
-- The relay is a trusted system component that must see EVERY tenant's
-- unpublished outbox rows, so it is granted BYPASSRLS. It has no access to
-- business tables or audit_event, and can only touch the outbox bookkeeping
-- columns (published_at, attempts) — never payload or topic.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rre_relay') THEN
    CREATE ROLE rre_relay LOGIN PASSWORD 'rre_relay'
      NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO rre_relay;
GRANT SELECT ON outbox TO rre_relay;
GRANT UPDATE (published_at, attempts) ON outbox TO rre_relay;
