// PostgreSQL store: the state document lives in one row; every write runs in a transaction that holds
// that row's lock, so concurrent requests are serialised. New audit entries are copied to an append-only table.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Domain } from './core.mjs';

export async function postgresStore(opts) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: opts.url, max: opts.max || 10, ssl: opts.ssl ? { rejectUnauthorized: opts.sslRejectUnauthorized !== false } : undefined });
  async function migrate() {
    const c = await pool.connect();
    try {
      await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const done = new Set((await c.query('SELECT version FROM schema_migrations')).rows.map(r => r.version));
      const dir = join(import.meta.dirname, 'migrations');
      for (const f of (await readdir(dir)).filter(x => /^\d+_.*\.sql$/.test(x)).sort()) {
        const v = parseInt(f, 10); if (done.has(v)) continue;
        await c.query('BEGIN');
        try { await c.query(await readFile(join(dir, f), 'utf8')); await c.query('INSERT INTO schema_migrations (version) VALUES ($1)', [v]); await c.query('COMMIT'); }
        catch (e) { await c.query('ROLLBACK'); throw e; }
      }
      const initial = Domain.ensureState({ version: 3, mode: 'live', createdAt: new Date().toISOString(), users: [], orgs: [], memberships: [], documents: [], compare: [], events: [], kill: {} });
      await c.query('INSERT INTO platform_state (id, version, doc) VALUES (1, 1, $1) ON CONFLICT (id) DO NOTHING', [initial]);
    } finally { c.release(); }
  }
  return {
    kind: 'postgres',
    async init() { await migrate(); },
    async transact(fn) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const row = (await c.query('SELECT version, doc FROM platform_state WHERE id = 1 FOR UPDATE')).rows[0];
        const state = Domain.ensureState(row.doc);
        const auditBefore = state.audit.length, docsBefore = (state.documents || []).length;
        const value = await fn(state);
        await c.query('UPDATE platform_state SET doc = $1, version = version + 1, updated_at = now() WHERE id = 1', [state]);
        for (const a of state.audit.slice(auditBefore)) await c.query('INSERT INTO audit_log (entity, entity_id, event, actor, entry) VALUES ($1, $2, $3, $4, $5)', [a.entity, String(a.entityId), a.event, a.actor, a]);
        // Document metadata is also kept in its own table, so backups can be checked against the files on disk.
        for (const d of (state.documents || []).slice(docsBefore)) await c.query('INSERT INTO documents (id, supplier_id, file_name, mime, size_bytes, sha256, scan, stored_path) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING', [d.id, d.supplierId, d.fileName, d.mime, d.size, d.sha256, d.scan, d.path]);
        await c.query('COMMIT');
        return value;
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    },
    async read(fn) { const row = (await pool.query('SELECT doc FROM platform_state WHERE id = 1')).rows[0]; return fn(Domain.ensureState(row.doc)); },
    async auditCount() { return Number((await pool.query('SELECT count(*) FROM audit_log')).rows[0].count); },
    async close() { await pool.end(); }
  };
}
