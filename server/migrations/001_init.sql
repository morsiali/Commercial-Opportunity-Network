-- 001: platform state document, append-only audit log, private document metadata.
-- All writes to platform_state happen inside a transaction holding the row lock (SELECT ... FOR UPDATE),
-- so concurrent requests are serialised and cannot double-book the same capacity.
CREATE TABLE IF NOT EXISTS platform_state (
  id          integer PRIMARY KEY CHECK (id = 1),
  version     bigint      NOT NULL,
  doc         jsonb       NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
  seq         bigserial   PRIMARY KEY,
  entity      text        NOT NULL,
  entity_id   text        NOT NULL,
  event       text        NOT NULL,
  actor       text        NOT NULL,
  entry       jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_entity ON audit_log (entity, entity_id);
-- The audit log is append-only for the application role.
CREATE OR REPLACE FUNCTION audit_log_no_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$;
DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_no_change();
CREATE TABLE IF NOT EXISTS documents (
  id          text        PRIMARY KEY,
  supplier_id text        NOT NULL,
  file_name   text        NOT NULL,
  mime        text        NOT NULL,
  size_bytes  integer     NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256      text        NOT NULL,
  scan        text        NOT NULL,
  stored_path text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
