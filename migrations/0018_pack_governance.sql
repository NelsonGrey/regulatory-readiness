-- 0018_pack_governance — activate a control pack as governed data, not a deploy.
--
-- The pack bundle still lives on disk (validated + checksummed at load). These
-- tables record the two-person review and the activation decision against a
-- specific computed checksum, so a `draft` bundle can be flipped to `active`
-- without editing its manifest. Control plane: no RLS, platform-scoped.

CREATE TABLE pack_review (
  id         text PRIMARY KEY,
  pack_key   text NOT NULL,
  checksum   text NOT NULL,
  reviewer   text NOT NULL,
  note       text,
  created_at timestamptz NOT NULL,
  UNIQUE (pack_key, checksum, reviewer)
);
CREATE INDEX pack_review_key_idx ON pack_review (pack_key, checksum);

CREATE TABLE pack_activation (
  pack_key      text PRIMARY KEY,
  checksum      text NOT NULL,
  status        text NOT NULL CHECK (status IN ('active', 'withdrawn')),
  activated_by  text NOT NULL,
  activated_at  timestamptz NOT NULL,
  withdrawn_by  text,
  withdrawn_at  timestamptz
);
