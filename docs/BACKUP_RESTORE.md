# Backup and restore (live mode)

There are two things to back up, and **both** are needed for a complete restore:

1. **The PostgreSQL database.** It holds the `platform_state`, `audit_log`, `documents` and `schema_migrations` tables.
2. **The private document directory** set by `PRIVATE_STORAGE_DIR`. It holds the licence files, which the `documents` table references by path and SHA-256 hash.

This procedure has not been run against a production host yet. Run a restore drill in staging before launch, and record the result.

## Backup

```bash
# 1. Database: a consistent logical dump (safe while the server runs)
pg_dump --format=custom --no-owner --file "con-$(date -u +%Y%m%dT%H%MZ).dump" "$DATABASE_URL"

# 2. Documents: copy after the dump, so every file the dump references exists in the copy
tar -C "$PRIVATE_STORAGE_DIR" -czf "con-docs-$(date -u +%Y%m%dT%H%MZ).tgz" .
```

- Encrypt both files at rest, store them off the host, and restrict access to operations staff.
- Keep them for at least as long as the retention period in the privacy notice. The lawyer confirms that period.
- A suggested schedule is a nightly dump plus the provider's point-in-time recovery if it offers one. Run the restore drill monthly.

## Restore

```bash
# Stop the API first so nothing writes during the restore.
createdb con_restore
pg_restore --no-owner --dbname "postgres://…/con_restore" con-YYYYMMDDTHHMMZ.dump
mkdir -m 700 /srv/con-docs-restore && tar -C /srv/con-docs-restore -xzf con-docs-YYYYMMDDTHHMMZ.tgz
# Point DATABASE_URL and PRIVATE_STORAGE_DIR at the restored copies, start the API, then check:
curl -s http://127.0.0.1:8787/api/health
```

## Integrity check after a restore

- [ ] `SELECT count(*) FROM audit_log` matches the count at backup time. The audit log is append-only, so any shortfall means data loss.
- [ ] For each row in `documents`, the file exists and its SHA-256 matches:

  ```bash
  sha256sum "$PRIVATE_STORAGE_DIR"/doc_*
  ```

  Compare the output with `SELECT id, sha256 FROM documents`.
- [ ] Payments still in `awaiting`, and payouts in `releasing`, are reconciled against the provider reports before anyone retries them (`docs/PROVIDERS.md`).

## Demo mode

Demo data lives only in the visitor's browser. There is nothing to back up on the server.
