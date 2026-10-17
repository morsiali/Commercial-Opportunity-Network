// Same rules against PostgreSQL: migrations, row-locked transactions under concurrency, idempotency, append-only audit.
// Runs only when PG_TEST_URL points at a disposable database, e.g. postgres://postgres@localhost:54329/con_test
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, world, approvedRfq } from './_helpers.mjs';
import { postgresStore } from '../../server/store-postgres.mjs';

const url = process.env.PG_TEST_URL;
test('PostgreSQL store: migrations, concurrent last-unit checkout, idempotency, append-only audit and document metadata', { skip: !url && 'PG_TEST_URL not set' }, async () => {
  const { default: pg } = await import('pg');
  const admin = new pg.Client({ connectionString: url }); await admin.connect();
  await admin.query('DROP TABLE IF EXISTS platform_state, audit_log, documents, schema_migrations CASCADE');
  const s = await start({}, () => postgresStore({ url }));
  try {
    const mig = await admin.query('SELECT version FROM schema_migrations');
    assert.deepEqual(mig.rows.map(r => r.version), [1]);
    const w = await world(s.api);
    const a = await approvedRfq(s.api, w, w.A);
    const b = await approvedRfq(s.api, w, w.B);
    const [ra, rb] = await Promise.all([
      s.api('POST', '/api/rfqs/' + a.rfq.id + '/checkout', { method: 'card' }, w.A, { 'idempotency-key': 'pg-concurrent-a' }),
      s.api('POST', '/api/rfqs/' + b.rfq.id + '/checkout', { method: 'card' }, w.B, { 'idempotency-key': 'pg-concurrent-b' })
    ]);
    assert.deepEqual([ra.status, rb.status].sort(), [201, 409]);
    const winner = ra.status === 201 ? { r: ra, rfq: a.rfq, tok: w.A, key: 'pg-concurrent-a' } : { r: rb, rfq: b.rfq, tok: w.B, key: 'pg-concurrent-b' };
    const replay = await s.api('POST', '/api/rfqs/' + winner.rfq.id + '/checkout', { method: 'card' }, winner.tok, { 'idempotency-key': winner.key });
    assert.equal(replay.status, 200); assert.equal(replay.body.payment.id, winner.r.body.payment.id);
    const doc = (await admin.query('SELECT doc FROM platform_state WHERE id = 1')).rows[0].doc;
    assert.equal(doc.payments.length, 1); assert.equal(doc.allocations.filter(x => x.status === 'held').length, 1);
    const n = Number((await admin.query('SELECT count(*) FROM audit_log')).rows[0].count);
    assert.ok(n >= 10, 'audit entries copied to audit_log: ' + n);
    // Document metadata lands in its own table, with the hash used by the backup integrity check.
    const me = (await s.api('GET', '/api/me', undefined, w.S1)).body;
    const up = await s.api('POST', '/api/suppliers/' + me.supplierId + '/documents?name=licence.pdf', Buffer.from('%PDF-1.4 test licence'), w.S1, { 'content-type': 'application/pdf' });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    const rows = (await admin.query('SELECT supplier_id, mime, scan, sha256 FROM documents')).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].supplier_id, me.supplierId); assert.equal(rows[0].mime, 'application/pdf'); assert.equal(rows[0].scan, 'pending'); assert.match(rows[0].sha256, /^[0-9a-f]{64}$/);
    await assert.rejects(admin.query('DELETE FROM audit_log'), /append-only/);
    await assert.rejects(admin.query("UPDATE audit_log SET event = 'x'"), /append-only/);
  } finally { await s.close(); await admin.end(); }
});
