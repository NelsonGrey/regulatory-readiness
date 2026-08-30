-- 0002_app_role — the dedicated application role.
--
-- The API must connect as a role that is NOT a superuser and does NOT have
-- BYPASSRLS, otherwise the row-level security policies from 0001 are silently
-- skipped (superusers bypass RLS, and FORCE ROW LEVEL SECURITY does not apply to
-- them). Migrations keep running as the owner; the app connects as `rre_app`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rre_app') THEN
    CREATE ROLE rre_app LOGIN PASSWORD 'rre_app'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO rre_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rre_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rre_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rre_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rre_app;
