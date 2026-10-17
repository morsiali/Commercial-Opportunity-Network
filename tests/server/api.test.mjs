// Live-mode API tests: authorisation, idempotency, unpaid payouts, signed webhooks, concurrent reservations,
// document validation and "not configured" providers. Uses the in-memory store on an ephemeral port.
import test from 'node:test';
import assert from 'node:assert/strict';
import { signForTest } from '../../server/adapters.mjs';
import { Dates } from '../../server/core.mjs';
import { start, world, approvedRfq, register, WEBHOOK, today, START } from './_helpers.mjs';

test('health reports providers honestly; security headers on every response', async () => {
  const s = await start({ PAYMENT_PROVIDER: null, PAYOUT_PROVIDER: null, PAYMENT_WEBHOOK_SECRET: null, PRIVATE_STORAGE_DIR: null });
  try {
    const h = await s.api('GET', '/api/health');
    assert.equal(h.status, 200);
    assert.deepEqual(h.body.providers, { payments: 'not_configured', payouts: 'not_configured', notifications: 'not_configured', scanner: 'not_configured', documents: 'not_configured' });
    for (const k of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'cache-control']) assert.ok(h.headers.get(k), k);
    assert.equal((await s.api('GET', '/api/nope')).status, 404);
    assert.equal((await s.api('DELETE', '/api/health')).status, 405);
  } finally { await s.close(); }
});

test('authentication: weak passwords, bad logins, rate limit, tampered tokens', async () => {
  const s = await start();
  try {
    const weak = await s.api('POST', '/api/auth/register', { email: 'x@y.test', password: 'short', orgName: 'Xy Co', orgType: 'customer' });
    assert.equal(weak.status, 422); assert.equal(weak.body.error.code, 'PASSWORD_WEAK');
    const tok = await register(s.api, 'c@brand.test', 'customer');
    assert.equal((await s.api('POST', '/api/auth/register', { email: 'c@brand.test', password: 'correct horse battery staple', orgName: 'Dup', orgType: 'customer' })).status, 409);
    assert.equal((await s.api('GET', '/api/me', undefined, tok)).body.role, 'customer');
    assert.equal((await s.api('GET', '/api/me', undefined, tok.slice(0, -2) + 'xx')).status, 401);
    assert.equal((await s.api('GET', '/api/me')).status, 401);
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await s.api('POST', '/api/auth/login', { email: 'c@brand.test', password: 'wrong password here' })).status);
    assert.deepEqual(codes.slice(0, 5), [401, 401, 401, 401, 401]); assert.equal(codes[6], 429);
    assert.equal((await s.api('POST', '/api/auth/login', '{"email":1}', null, { 'content-type': 'text/plain' })).status, 415);
  } finally { await s.close(); }
});

test('authorisation: roles and organisations are enforced on every action', async () => {
  const s = await start();
  try {
    const w = await world(s.api);
    assert.equal((await s.api('POST', '/api/objectives', { budget: '1000', start: START }, w.S1)).status, 403, 'supplier cannot create objectives');
    assert.equal((await s.api('POST', '/api/listings', { title: { en: 'x' } }, w.A)).status, 403, 'customer cannot list');
    assert.equal((await s.api('PUT', '/api/listings/' + w.listing.id, { price: 1 }, w.S2)).status, 403, 'other supplier cannot edit');
    const { rfq, line } = await approvedRfq(s.api, w, w.A);
    assert.equal((await s.api('POST', '/api/rfqs/' + rfq.id + '/lines/' + line.id + '/unapprove', {}, w.B)).status, 403, 'other customer cannot touch RFQ');
    assert.equal((await s.api('POST', '/api/rfqs/' + rfq.id + '/checkout', { method: 'card' }, w.B, { 'idempotency-key': 'key-b-0000001' })).status, 403);
    assert.equal((await s.api('GET', '/api/rfqs', undefined, w.B)).body.length, 0, 'other customer sees nothing');
    assert.equal((await s.api('GET', '/api/rfqs', undefined, w.S2)).body.length, 0, 'uninvited supplier sees nothing');
    const supView = (await s.api('GET', '/api/rfqs', undefined, w.S1)).body[0];
    assert.equal(supView.orgId, undefined);
    assert.equal((await s.api('POST', '/api/rfqs/' + rfq.id + '/lines/' + line.id + '/offer', { input: {} }, w.S2)).status, 403, 'other supplier cannot answer');
    assert.equal((await s.api('GET', '/api/ops/audit', undefined, w.A)).status, 403);
    const audit = await s.api('GET', '/api/ops/audit?entity=offer', undefined, w.OPS);
    assert.equal(audit.status, 200); assert.ok(audit.body.some(a => a.event === 'accept' && a.actor.startsWith('user:')));
  } finally { await s.close(); }
});

test('checkout is idempotent; an unpaid payout cannot be released; signed webhooks only', async () => {
  const s = await start();
  try {
    const w = await world(s.api);
    const { rfq } = await approvedRfq(s.api, w, w.A);
    assert.equal((await s.api('POST', '/api/rfqs/' + rfq.id + '/checkout', { method: 'card' }, w.A)).status, 422, 'Idempotency-Key required');
    const c1 = await s.api('POST', '/api/rfqs/' + rfq.id + '/checkout', { method: 'card', billing: { company: 'A LLC' } }, w.A, { 'idempotency-key': 'checkout-key-001' });
    assert.equal(c1.status, 201, JSON.stringify(c1.body));
    const c2 = await s.api('POST', '/api/rfqs/' + rfq.id + '/checkout', { method: 'card', billing: { company: 'A LLC' } }, w.A, { 'idempotency-key': 'checkout-key-001' });
    assert.equal(c2.status, 200); assert.equal(c2.body.replay, true); assert.equal(c2.body.payment.id, c1.body.payment.id);
    const c3 = await s.api('POST', '/api/rfqs/' + rfq.id + '/checkout', { method: 'card' }, w.A, { 'idempotency-key': 'checkout-key-002' });
    assert.equal(c3.status, 409); assert.equal(c3.body.error.code, 'CHECKOUT_NOTHING_APPROVED');
    assert.equal((await s.api('GET', '/api/payments', undefined, w.A)).body.length, 1);
    const pay = c1.body.payment;
    const payouts = await s.store.read(st => st.payouts.slice());
    const rel = await s.api('POST', '/api/ops/payouts/' + payouts[0].id + '/release', {}, w.OPS);
    assert.equal(rel.status, 409); assert.equal(rel.body.error.code, 'PAYOUT_GUARDS_FAILED');
    assert.ok(rel.body.error.details.failed.includes('payment_received'));
    // Webhooks
    const ev = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded', paymentId: pay.id, amount: pay.amount.total });
    assert.equal((await s.api('POST', '/api/webhooks/payments', ev, null, { 'content-type': 'application/json', 'x-con-signature': signForTest(ev, 'wrong-secret') })).status, 401);
    assert.equal((await s.api('POST', '/api/webhooks/payments', ev, null, { 'content-type': 'application/json', 'x-con-signature': signForTest(ev, WEBHOOK, Math.floor(Date.now() / 1000) - 3600) })).status, 401, 'stale signature');
    const tampered = ev.replace(String(pay.amount.total), String(pay.amount.total - 100));
    assert.equal((await s.api('POST', '/api/webhooks/payments', tampered, null, { 'content-type': 'application/json', 'x-con-signature': signForTest(ev, WEBHOOK) })).status, 401, 'body changed after signing');
    const ok = await s.api('POST', '/api/webhooks/payments', ev, null, { 'content-type': 'application/json', 'x-con-signature': signForTest(ev, WEBHOOK) });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const dup = await s.api('POST', '/api/webhooks/payments', ev, null, { 'content-type': 'application/json', 'x-con-signature': signForTest(ev, WEBHOOK) });
    assert.deepEqual(dup.body, { duplicate: true });
    assert.equal((await s.api('GET', '/api/payments', undefined, w.A)).body[0].status, 'paid');
    assert.equal((await s.api('GET', '/api/bookings', undefined, w.S1)).body[0].status, 'confirmed');
    const rel2 = await s.api('POST', '/api/ops/payouts/' + payouts[0].id + '/release', {}, w.OPS);
    assert.equal(rel2.status, 409); assert.ok(rel2.body.error.details.failed.includes('delivery_accepted'));
  } finally { await s.close(); }
});

test('two concurrent payout releases transfer the money once; a failed transfer returns the payout to eligible', async () => {
  let transfers = 0, failNext = false;
  const counting = { name: 'counting', configured: true, async transfer(po, opts) { transfers++; assert.equal(opts.idempotencyKey, 'payout_' + po.id); await new Promise(r => setTimeout(r, 40)); if (failNext) { failNext = false; throw Object.assign(new Error('provider down'), { code: 'PROVIDER_ERROR', status: 502 }); } return { providerRef: 'cnt_' + transfers }; } };
  const s = await start({}, null, { payouts: counting });
  try {
    const w = await world(s.api);
    const { rfq } = await approvedRfq(s.api, w, w.A);
    const c1 = await s.api('POST', '/api/rfqs/' + rfq.id + '/checkout', { method: 'card', billing: { company: 'A LLC' } }, w.A, { 'idempotency-key': 'checkout-key-po1' });
    const pay = c1.body.payment;
    const ev = JSON.stringify({ id: 'evt_po1', type: 'payment.succeeded', paymentId: pay.id, amount: pay.amount.total });
    assert.equal((await s.api('POST', '/api/webhooks/payments', ev, null, { 'content-type': 'application/json', 'x-con-signature': signForTest(ev, WEBHOOK) })).status, 200);
    // Test setup only: fast-forward delivery and the licence review, which have their own tests.
    const poId = await s.store.transact(st => { const b = st.bookings[0]; b.status = 'delivery_accepted'; const sp = st.suppliers.find(x => x.id === b.supplierId); sp.verification = Object.assign({}, sp.verification, { status: 'licence_reviewed', licenceExpiry: null }); return b.payoutId; });
    failNext = true;
    const failed = await s.api('POST', '/api/ops/payouts/' + poId + '/release', {}, w.OPS);
    assert.equal(failed.status, 502, JSON.stringify(failed.body));
    assert.equal(await s.store.read(st => st.payouts.find(p => p.id === poId).status), 'eligible', 'a failed transfer returns the payout to eligible');
    const [r1, r2] = await Promise.all([1, 2].map(() => s.api('POST', '/api/ops/payouts/' + poId + '/release', {}, w.OPS)));
    const codes = [r1, r2].map(r => r.status + ':' + (r.body.error ? r.body.error.code : (r.body.replay ? 'replay' : 'released'))).sort();
    assert.equal(transfers, 2, 'one failed attempt plus exactly one successful transfer: ' + codes.join(', '));
    assert.ok(codes.includes('200:released'), codes.join(', '));
    assert.ok(codes.some(c => c === '409:PAYOUT_RELEASE_IN_PROGRESS' || c === '200:replay'), codes.join(', '));
    const audit = await s.store.read(st => st.audit.filter(a => a.entity === 'payout' && a.entityId === poId).map(a => a.event));
    assert.deepEqual(audit.filter(e => e === 'release'), ['release']);
    assert.ok(audit.includes('release_failed'));
  } finally { await s.close(); }
});

test('concurrent checkouts for the last unit: exactly one succeeds', async () => {
  const s = await start();
  try {
    const w = await world(s.api);
    const a = await approvedRfq(s.api, w, w.A);
    const b = await approvedRfq(s.api, w, w.B);
    const [ra, rb] = await Promise.all([
      s.api('POST', '/api/rfqs/' + a.rfq.id + '/checkout', { method: 'card' }, w.A, { 'idempotency-key': 'concurrent-a-1' }),
      s.api('POST', '/api/rfqs/' + b.rfq.id + '/checkout', { method: 'card' }, w.B, { 'idempotency-key': 'concurrent-b-1' })
    ]);
    const statuses = [ra.status, rb.status].sort();
    assert.deepEqual(statuses, [201, 409], JSON.stringify([ra.body, rb.body]));
    const loser = ra.status === 409 ? ra : rb;
    assert.equal(loser.body.error.code, 'CHECKOUT_VALIDATION_FAILED');
    assert.ok(JSON.stringify(loser.body).includes('INVENTORY_UNAVAILABLE'));
    const held = await s.store.read(st => st.allocations.filter(x => x.status === 'held').length);
    assert.equal(held, 1);
  } finally { await s.close(); }
});

test('documents: type, content signature and size are checked; unscanned documents cannot be approved', async () => {
  const s = await start();
  try {
    const w = await world(s.api);
    const me = (await s.api('GET', '/api/me', undefined, w.S1)).body;
    const up = (buf, type, tok, sid) => s.api('POST', '/api/suppliers/' + (sid || me.supplierId) + '/documents?name=licence.pdf', buf, tok || w.S1, { 'content-type': type });
    assert.equal((await up(Buffer.from('hello'), 'text/plain')).status, 415);
    assert.equal((await up(Buffer.from('MZ\x90\x00 not a pdf'), 'application/pdf')).status, 422, 'content must match type');
    assert.equal((await up(Buffer.alloc(11 * 1024 * 1024, 0x25), 'application/pdf')).status, 413);
    assert.equal((await up(Buffer.from('%PDF-1.4 test'), 'application/pdf', w.S2, me.supplierId)).status, 403);
    const ok = await up(Buffer.from('%PDF-1.4\n% sample licence for tests\n'), 'application/pdf');
    assert.equal(ok.status, 201, JSON.stringify(ok.body)); assert.equal(ok.body.scan, 'pending');
    const rv = await s.api('POST', '/api/ops/suppliers/' + me.supplierId + '/review', { decision: 'approve', checks: { nameMatches: true, numberMatches: true, documentLegible: true }, licenceExpiry: Dates.addDays(today, 300) }, w.OPS);
    assert.equal(rv.status, 409); assert.equal(rv.body.error.code, 'VERIFICATION_DOCUMENT_NOT_SCANNED');
    const docId = ok.body.verification.documents.slice(-1)[0].ref;
    assert.equal((await fetch(s.base + '/api/ops/documents/' + docId, { headers: { authorization: 'Bearer ' + w.S1 } })).status, 403, 'suppliers cannot fetch documents back through the reviewer route');
    const got = await fetch(s.base + '/api/ops/documents/' + docId, { headers: { authorization: 'Bearer ' + w.OPS } });
    assert.equal(got.status, 200); assert.match(got.headers.get('content-disposition'), /^attachment/);
    assert.equal(Buffer.from(await got.arrayBuffer()).toString(), '%PDF-1.4\n% sample licence for tests\n');
  } finally { await s.close(); }
});

test('providers that are not configured refuse the action and leave no state behind', async () => {
  const s = await start({ PAYMENT_PROVIDER: null, PAYOUT_PROVIDER: null, PAYMENT_WEBHOOK_SECRET: null, PRIVATE_STORAGE_DIR: null });
  try {
    const w = await world(s.api);
    const { rfq } = await approvedRfq(s.api, w, w.A);
    const c = await s.api('POST', '/api/rfqs/' + rfq.id + '/checkout', { method: 'card' }, w.A, { 'idempotency-key': 'nocfg-key-0001' });
    assert.equal(c.status, 503); assert.equal(c.body.error.code, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
    const st = await s.store.read(x => ({ pays: x.payments.length, holds: x.allocations.length }));
    assert.deepEqual(st, { pays: 0, holds: 0 });
    const wh = await s.api('POST', '/api/webhooks/payments', '{}', null, { 'content-type': 'application/json', 'x-con-signature': 't=1,v1=' + '0'.repeat(64) });
    assert.equal(wh.status, 503);
    const me = (await s.api('GET', '/api/me', undefined, w.S1)).body;
    assert.equal((await s.api('POST', '/api/suppliers/' + me.supplierId + '/documents', Buffer.from('%PDF-1.4'), w.S1, { 'content-type': 'application/pdf' })).status, 503);
    const notes = await s.store.read(x => x.audit.filter(a => a.entity === 'notification').map(a => a.event));
    assert.ok(notes.length && notes.every(e => e === 'skipped_not_configured'), 'RFQ notifications recorded as not sent');
  } finally { await s.close(); }
});

test('request limits: JSON only, body size capped', async () => {
  const s = await start();
  try {
    const big = JSON.stringify({ email: 'x'.repeat(200 * 1024) });
    assert.equal((await s.api('POST', '/api/auth/login', big, null, { 'content-type': 'application/json' })).status, 413);
    assert.equal((await s.api('POST', '/api/auth/login', '{bad json', null, { 'content-type': 'application/json' })).status, 400);
  } finally { await s.close(); }
});

