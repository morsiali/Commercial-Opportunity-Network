// v2 → v3 migration of a stored state produced by the original prototype code (tests/fixtures/state-v2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CON, clone } from './_load.mjs';
const v2 = JSON.parse(readFileSync(new URL('../fixtures/state-v2.json', import.meta.url)));
const TODAY = '2026-10-17';
const run = () => CON.Migrate.migrateStateV2(clone(v2), CON.Seed.build({ today: TODAY }), { today: TODAY, now: TODAY + 'T09:00:00.000Z' });

test('user-created records survive migration; sample records are regenerated', () => {
  const s = run();
  assert.equal(s.version, 3);
  assert.ok(s.objectives.some(o => o.name === 'User objective' && o.budgetMinor === 2000000));
  assert.ok(s.opportunities.some(o => o.id === 'op-user'));
  assert.ok(s.suppliers.some(x => x.id === 'su-user'));
  const userRfq = v2.rfqs.find(r => !r.sample);
  assert.ok(s.rfqs.some(r => r.id === userRfq.id));
  assert.equal(s.objectives.filter(o => o.id === 'obsample').length, 1);
});

test('legacy money is converted to integer fils', () => {
  const s = run();
  const op = s.opportunities.find(o => o.id === 'op-user');
  assert.equal(op.price, 100030);
  s.payments.forEach(p => assert.ok(Number.isSafeInteger(p.amount.total)));
});

test('a v2 "verified" status based only on a filename is downgraded and cannot be approved without a document', () => {
  const s = run();
  const su = s.suppliers.find(x => x.id === 'su-user');
  assert.equal(su.verification.status, 'submitted');
  assert.equal(su.verification.documents.length, 0);
  assert.match(su.verification.legacyNote, /^filename-only:/);
  assert.throws(() => CON.Domain.reviewVerification(s, { supplierId: 'su-user', decision: 'approve', checks: { nameMatches: true, numberMatches: true, documentLegible: true }, licenceExpiry: '2027-10-01' }, { role: 'ops', today: TODAY, now: TODAY + 'T10:00:00Z', mode: 'demo' }), e => e.code === 'VERIFICATION_NO_REVIEWABLE_DOCUMENT');
  const lst = s.opportunities.find(o => o.id === 'op-user');
  assert.equal(lst.title.ar, ''); // copied English is not a translation
});

test('a payout released in v2 without payment is re-opened as held and cannot be released (H12)', () => {
  const s = run();
  const po = s.payouts.find(p => p.legacy && p.legacyNote);
  assert.ok(po); assert.equal(po.status, 'held');
  assert.throws(() => CON.Domain.releasePayout(s, { payoutId: po.id }, { role: 'ops', today: TODAY, now: TODAY + 'T10:00:00Z', mode: 'demo' }), e => e.code === 'PAYOUT_GUARDS_FAILED' && e.details.failed.includes('payment_received'));
  assert.ok(s.audit.some(a => a.event === 'migrate'));
});

test('migrated bookings occupy date-specific capacity', () => {
  const s = run();
  const bk = s.bookings.find(b => b.legacy);
  const a = s.allocations.find(x => x.id === bk.allocationId);
  assert.ok(a && a.dates.length > 0);
});
