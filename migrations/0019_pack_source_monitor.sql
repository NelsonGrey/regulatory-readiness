-- 0019_pack_source_monitor — watch each pack's sources of record for changes.
--
-- A sweep fetches every URL a pack lists in its manifest, hashes the body, and
-- records a change row when the hash moves. Deterministic sensing only — triage
-- (is this material? what does the pack need?) stays human, for now.
-- Control plane: no RLS, platform-scoped.

CREATE TABLE pack_source_check (
  url             text PRIMARY KEY,
  pack_keys       text[] NOT NULL,
  last_hash       text,
  last_status     text NOT NULL DEFAULT 'pending'
                    CHECK (last_status IN ('pending', 'ok', 'unchanged', 'changed', 'error')),
  last_checked_at timestamptz,
  last_error      text,
  etag            text,
  updated_at      timestamptz NOT NULL
);

CREATE TABLE pack_source_change (
  id              text PRIMARY KEY,
  url             text NOT NULL,
  pack_keys       text[] NOT NULL,
  from_hash       text,
  to_hash         text NOT NULL,
  detected_at     timestamptz NOT NULL,
  acknowledged_by text,
  acknowledged_at timestamptz
);
CREATE INDEX pack_source_change_open_idx
  ON pack_source_change (detected_at DESC)
  WHERE acknowledged_at IS NULL;
