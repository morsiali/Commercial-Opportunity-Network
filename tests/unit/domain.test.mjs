// Offers, checkout, inventory, payments, payouts, verification, archival and authorisation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CON, clone } from './_load.mjs';
const { Domain: Dm, Offers: Of, Seed, Dates: Dt, Engine: E } = CON;

const TODAY = '2026-10-17';
const at = (d, hm) => d + 'T' + (hm || '09:00') + ':00.000Z';
const cust = (d, hm) => ({ role: 'customer', actor: 'cust-1', today: d || TODAY, now: at(d || TODAY, hm), mode: 'demo' });
const supp = (sid, d, hm) => ({ role: 'supplier', actor: 'sup-' + sid, supplierId: sid, today: d || TODAY, now: at(d || TODAY, hm), mode: 'demo' });
const ops = (d, hm) => ({ role: 'ops', actor: 'ops-1', today: d || TODAY, now: at(d || TODAY, hm), mode: 'demo' });
const sys = (d, hm) => ({ role: 'system', actor: 'system', today: d || TODAY, now: at(d || TODAY, hm), mode: 'demo' });
const code = c => err => { assert.equal(err.code, c, 'expected ' + c + ' got ' + err.code + ' ' + JSON.stringify(err.details)); return true; };

function fresh() { return Seed.build({ today: TODAY }); }
function objective(st, over) {
  const o = Object.assign(E.normalizeObjective(Object.assign({ objective: 'trial', productCategory: 'beverage', areas: ['marina'], budget: 200000, duration: 14, start: Dt.addDays(TODAY, 20) }, over || {}), { today: TODAY }), { id: 'ob-t' + Math.random().toString(36).slice(2, 6), name: 'Test' });
  st.objectives.push(o); return o;
}
function offerInput(line, over) {
  const cov = line.requested.coverage;
  return Object.assign({ basePrice: line.requested.price.base, setupFee: line.requested.price.setup, units: cov.purchasedUnits, from: cov.coveredDates[0], to: cov.coveredDates[cov.coveredDates.length - 1], dates: cov.coveredDates, reporting: 'basic', deliverables: ['Placement as listed'], terms: 'full', validUntil: Dt.addDays(TODAY, 7) }, over || {});
}
/* RFQ for o4 (supplier s1, day unit, weekends) with one offer. */
function rfqWithOffer(st, over) {
  const ob = objective(st);
  const r = Dm.createRfq(st, { objectiveId: ob.id, oppIds: ['o4'] }, cust());
  const l = r.lines[0];
  Dm.respond(st, { rfqId: r.id, line: l.id, input: offerInput(l, over) }, supp('s1'));
  return { r, l, ob };
}

test('a material revision after approval invalidates the approval (H11)', () => {
  const st = fresh(); const { r, l } = rfqWithOffer(st);
  Dm.approve(st, { rfqId: r.id, line: l.id }, cust());
  assert.equal(l.status, 'accepted'); assert.ok(Of.approvalValid(l));
  Dm.respond(st, { rfqId: r.id, line: l.id, input: offerInput(l, { basePrice: l.requested.price.base + 50000 }) }, supp('s1'));
  assert.equal(l.status, 'offered'); assert.equal(l.approval, null); assert.equal(l.offers.length, 2);
  assert.ok(st.audit.some(a => a.event === 'approval_invalidated' && a.entityId === l.id));
  assert.throws(() => Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-revise-1' }, cust()), code('CHECKOUT_NOTHING_APPROVED'));
});

test('an expired offer cannot be approved or checked out (H10)', () => {
  const st = fresh(); const { r, l } = rfqWithOffer(st, { validUntil: Dt.addDays(TODAY, 2) });
  const later = Dt.addDays(TODAY, 3);
  assert.throws(() => Dm.approve(st, { rfqId: r.id, line: l.id }, cust(later)), err => err.code === 'OFFER_NOT_APPROVABLE' && err.details.errors.some(e => e.code === 'OFFER_EXPIRED'));
  Dm.approve(st, { rfqId: r.id, line: l.id }, cust());
  assert.throws(() => Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-expired-1' }, cust(later)), err => err.code === 'CHECKOUT_VALIDATION_FAILED' && err.details.lines[0].errors.some(e => e.code === 'OFFER_EXPIRED'));
  Dm.expireOffers(st, cust(later));
  assert.equal(l.status, 'expired');
});

test('a partial offer needs explicit acceptance of the coverage deviation', () => {
  const st = fresh(); const ob = objective(st);
  const r = Dm.createRfq(st, { objectiveId: ob.id, oppIds: ['o4'] }, cust()); const l = r.lines[0];
  const cov = l.requested.coverage;
  Dm.respond(st, { rfqId: r.id, line: l.id, input: offerInput(l, { units: cov.purchasedUnits - 1, dates: cov.coveredDates.slice(0, -1), to: cov.coveredDates[cov.coveredDates.length - 2] }) }, supp('s1'));
  const v = Of.current(l);
  assert.ok(v.partial); assert.deepEqual(v.deviations.map(d => d.field), ['coverage']);
  assert.throws(() => Dm.approve(st, { rfqId: r.id, line: l.id }, cust()), err => err.details.errors.some(e => e.code === 'OFFER_DEVIATION_UNACCEPTED'));
  Dm.approve(st, { rfqId: r.id, line: l.id, acceptedDeviations: ['coverage'] }, cust());
  assert.deepEqual(l.approval.acceptedDeviations, ['coverage']);
});

test('checkout is idempotent and a second checkout cannot create a second transaction (H13)', () => {
  const st = fresh(); const { r, l } = rfqWithOffer(st);
  Dm.approve(st, { rfqId: r.id, line: l.id }, cust());
  const a = Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-same-0001' }, cust());
  const b = Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-same-0001' }, cust());
  assert.equal(a.payment.id, b.payment.id); assert.equal(b.replay, true);
  assert.throws(() => Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-other-0002' }, cust()), code('CHECKOUT_NOTHING_APPROVED'));
  assert.equal(st.payments.filter(p => p.rfqId === r.id).length, 1);
  assert.equal(st.bookings.filter(x => x.rfqId === r.id).length, 1);
});

test('payment events are idempotent and the amount must match', () => {
  const st = fresh(); const { r, l } = rfqWithOffer(st);
  Dm.approve(st, { rfqId: r.id, line: l.id }, cust());
  const { payment } = Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-pay-0001' }, cust());
  assert.throws(() => Dm.paymentEvent(st, { eventId: 'ev-1', paymentId: payment.id, type: 'payment.succeeded', amount: payment.amount.total - 1 }, sys(TODAY, '09:05')), code('PAYMENT_AMOUNT_MISMATCH'));
  Dm.paymentEvent(st, { eventId: 'ev-2', paymentId: payment.id, type: 'payment.succeeded', amount: payment.amount.total }, sys(TODAY, '09:05'));
  const auditCount = st.audit.length;
  assert.deepEqual(Dm.paymentEvent(st, { eventId: 'ev-2', paymentId: payment.id, type: 'payment.succeeded', amount: payment.amount.total }, sys(TODAY, '09:06')), { duplicate: true });
  assert.equal(st.audit.length, auditCount);
  const bk = st.bookings.find(x => x.paymentId === payment.id);
  assert.equal(payment.status, 'paid'); assert.equal(bk.status, 'confirmed'); assert.equal(l.status, 'booked');
  assert.throws(() => Dm.paymentEvent(st, { eventId: 'ev-3', paymentId: payment.id, type: 'payment.succeeded', amount: payment.amount.total }, { role: 'customer', now: at(TODAY) }), code('FORBIDDEN'));
});

test('a payout cannot be released before payment, delivery acceptance and checks (H12)', () => {
  const st = fresh(); const { r, l } = rfqWithOffer(st);
  Dm.approve(st, { rfqId: r.id, line: l.id }, cust());
  const { payment } = Dm.checkout(st, { rfqId: r.id, method: 'transfer', idempotencyKey: 'key-po-00001' }, cust());
  const bk = st.bookings.find(x => x.paymentId === payment.id);
  const po = st.payouts.find(x => x.bookingId === bk.id);
  assert.throws(() => Dm.releasePayout(st, { payoutId: po.id }, ops()), err => err.code === 'PAYOUT_GUARDS_FAILED' && err.details.failed.includes('payment_received') && err.details.failed.includes('delivery_accepted'));
  assert.throws(() => Dm.advanceBooking(st, { bookingId: bk.id, event: 'prepare' }, supp('s1')), code('PAYMENT_NOT_COMPLETED'));
  Dm.paymentEvent(st, { eventId: 'ev-po-1', paymentId: payment.id, type: 'payment.succeeded', amount: payment.amount.total }, sys(Dt.addDays(TODAY, 1)));
  const d0 = bk.from;
  Dm.advanceBooking(st, { bookingId: bk.id, event: 'prepare' }, supp('s1', Dt.addDays(TODAY, 2)));
  assert.throws(() => Dm.advanceBooking(st, { bookingId: bk.id, event: 'go_live' }, supp('s1', Dt.addDays(TODAY, 2))), code('BOOKING_NOT_STARTED'));
  Dm.advanceBooking(st, { bookingId: bk.id, event: 'go_live' }, supp('s1', d0));
  Dm.advanceBooking(st, { bookingId: bk.id, event: 'complete' }, supp('s1', bk.to));
  assert.throws(() => Dm.acceptDelivery(st, { bookingId: bk.id }, cust(bk.to)), code('BOOKING_REPORT_REQUIRED'));
  Dm.submitReport(st, { bookingId: bk.id, metrics: [{ name: 'Samples', value: 900, unit: 'samples', method: 'counted' }] }, supp('s1', bk.to));
  assert.throws(() => Dm.submitReport(st, { bookingId: bk.id, metrics: [] }, supp('s2', bk.to)), code('FORBIDDEN'));
  Dm.openDispute(st, { bookingId: bk.id, reason: 'Two of the sampling days were not staffed.' }, cust(bk.to));
  assert.equal(po.status, 'withheld');
  assert.throws(() => Dm.releasePayout(st, { payoutId: po.id }, ops(bk.to)), err => err.details.failed.includes('no_open_dispute'));
  const dsp = st.disputes.find(x => x.bookingId === bk.id);
  Dm.resolveDispute(st, { disputeId: dsp.id, outcome: 'supplier', reason: 'Staffing logs confirm all days.' }, ops(bk.to));
  assert.equal(bk.status, 'delivery_accepted'); assert.equal(po.status, 'eligible');
  assert.throws(() => Dm.releasePayout(st, { payoutId: po.id }, cust(bk.to)), code('FORBIDDEN'));
  const rel = Dm.releasePayout(st, { payoutId: po.id }, ops(bk.to));
  assert.equal(rel.payout.status, 'released');
  assert.equal(Dm.releasePayout(st, { payoutId: po.id }, ops(bk.to)).replay, true);
});

test('expired supplier licence blocks payout release', () => {
  const st = fresh();
  const bk = st.bookings[0]; const po = st.payouts.find(x => x.bookingId === bk.id);
  assert.equal(po.status, 'eligible');
  const s2 = st.suppliers.find(s => s.id === bk.supplierId);
  s2.verification.licenceExpiry = Dt.addDays(TODAY, -1);
  assert.throws(() => Dm.releasePayout(st, { payoutId: po.id }, ops()), err => err.details.failed.includes('supplier_licence_reviewed'));
});

test('holds expire, release capacity, and late payments are refunded rather than confirmed', () => {
  const st = fresh(); const { r, l } = rfqWithOffer(st);
  Dm.approve(st, { rfqId: r.id, line: l.id }, cust());
  const { payment } = Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-hold-0001' }, cust(TODAY, '09:00'));
  const alloc = st.allocations.find(a => a.ref === l.id);
  assert.equal(alloc.status, 'held');
  Dm.paymentEvent(st, { eventId: 'ev-late', paymentId: payment.id, type: 'payment.succeeded', amount: payment.amount.total }, sys(TODAY, '09:45'));
  const bk = st.bookings.find(x => x.paymentId === payment.id);
  assert.equal(alloc.status, 'expired'); assert.equal(bk.status, 'expired');
  assert.ok(st.refunds.some(x => x.bookingId === bk.id && x.status === 'requested'));
  const po = st.payouts.find(x => x.bookingId === bk.id); assert.equal(po.status, 'cancelled');
});

test('expireHolds cancels unpaid checkouts and returns lines to accepted so the customer can retry', () => {
  const st = fresh(); const { r, l } = rfqWithOffer(st);
  Dm.approve(st, { rfqId: r.id, line: l.id }, cust());
  const { payment } = Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-hold-0002' }, cust(TODAY, '09:00'));
  Dm.expireHolds(st, sys(TODAY, '10:00'));
  assert.equal(payment.status, 'expired'); assert.equal(l.status, 'accepted'); assert.ok(Of.approvalValid(l));
  const again = Dm.checkout(st, { rfqId: r.id, method: 'card', idempotencyKey: 'key-hold-0003' }, cust(TODAY, '10:01'));
  assert.notEqual(again.payment.id, payment.id);
});

test('date-specific capacity: two customers cannot both reserve the last unit (H14)', () => {
  const st = fresh();
  const op = st.opportunities.find(o => o.id === 'o4'); op.capacityPerDate = 1; op.baseBooked = 0;
  const A = rfqWithOffer(st); const B = rfqWithOffer(st);
  Dm.approve(st, { rfqId: A.r.id, line: A.l.id }, cust()); Dm.approve(st, { rfqId: B.r.id, line: B.l.id }, cust());
  Dm.checkout(st, { rfqId: A.r.id, method: 'card', idempotencyKey: 'key-cap-000A' }, cust());
  assert.throws(() => Dm.checkout(st, { rfqId: B.r.id, method: 'card', idempotencyKey: 'key-cap-000B' }, cust()), err => err.code === 'CHECKOUT_VALIDATION_FAILED' && err.details.lines[0].errors.some(e => e.code === 'INVENTORY_UNAVAILABLE'));
  // Non-overlapping dates on the same listing are still bookable.
  const free = CON.Inventory.free(st, op, Dt.addDays(A.l.requested.coverage.coveredDates.slice(-1)[0], 7), Date.parse(at(TODAY)));
  assert.equal(free, 1);
});

test('atomic hold: if any line has no capacity, no line is held', () => {
  const st = fresh();
  const o4 = st.opportunities.find(o => o.id === 'o4');
  const o12 = st.opportunities.find(o => o.id === 'o12'); o12.capacityPerDate = 1; o12.baseBooked = 1;
  const before = st.allocations.length;
  assert.throws(() => CON.Inventory.holdAll(st, st.audit, [{ op: o4, dates: ['2026-11-07'], ref: 'x1' }, { op: o12, dates: ['2026-11-07'], ref: 'x2' }], { now: at(TODAY) }), code('INVENTORY_UNAVAILABLE'));
  assert.equal(st.allocations.length, before);
});

test('a listing referenced by bookings is archived, not deleted, and bookings keep a snapshot (H15)', () => {
  const st = fresh();
  const bk = st.bookings[0];
  const res = Dm.removeListing(st, bk.oppId, supp(bk.supplierId));
  assert.equal(res.archived, true);
  assert.ok(st.opportunities.find(o => o.id === bk.oppId));
  assert.equal(bk.snapshot.title.en, st.opportunities.find(o => o.id === bk.oppId).title.en);
  const tmp = Dm.saveListing(st, Object.assign(clone(st.opportunities.find(o => o.id === 'o4')), { id: 'o-new', status: 'active' }), supp('s1'));
  assert.equal(Dm.removeListing(st, tmp.id, supp('s1')).deleted, true);
  assert.throws(() => Dm.removeListing(st, 'o4', supp('s2')), code('FORBIDDEN'));
});

test('listing validation rejects impossible values and versions material edits', () => {
  const st = fresh();
  const o4 = clone(st.opportunities.find(o => o.id === 'o4'));
  assert.throws(() => Dm.saveListing(st, Object.assign({}, o4, { price: 12.5 }), supp('s1')), code('LISTING_INVALID'));
  assert.throws(() => Dm.saveListing(st, Object.assign({}, o4, { availableTo: '2026-02-30' }), supp('s1')), code('LISTING_INVALID'));
  const saved = Dm.saveListing(st, Object.assign({}, o4, { price: o4.price + 1000 }), supp('s1'));
  assert.equal(saved.version, o4.version + 1);
  const saved2 = Dm.saveListing(st, Object.assign({}, saved, { desc: { en: 'New words', ar: '' } }), supp('s1'));
  assert.equal(saved2.version, saved.version);
});

test('verification is never granted from a filename; demo uses a labelled sample document (H16)', () => {
  const st = fresh();
  const s = st.suppliers.find(x => x.id === 's6'); // submitted, demo sample document
  s.verification.documents = [];
  assert.throws(() => Dm.reviewVerification(st, { supplierId: 's6', decision: 'approve', checks: { nameMatches: true, numberMatches: true, documentLegible: true }, licenceExpiry: '2027-10-01' }, ops()), code('VERIFICATION_NO_REVIEWABLE_DOCUMENT'));
  assert.throws(() => Dm.submitVerification(st, { supplierId: 's6', licenceNumber: 'DED-1', document: { fileName: 'licence.exe', size: 100, type: 'application/x-msdownload', storage: 'local-only' } }, supp('s6')), code('DOCUMENT_INVALID'));
  Dm.submitVerification(st, { supplierId: 's6', licenceNumber: 'DED-6630-902', document: { fileName: 'licence.pdf', size: 20000, type: 'application/pdf', storage: 'local-only' } }, supp('s6'));
  assert.throws(() => Dm.reviewVerification(st, { supplierId: 's6', decision: 'approve', checks: { nameMatches: true, numberMatches: true, documentLegible: true }, licenceExpiry: '2027-10-01' }, ops()), code('VERIFICATION_NO_REVIEWABLE_DOCUMENT'));
  Dm.submitVerification(st, { supplierId: 's6', licenceNumber: 'DED-6630-902', document: CON.Migrate.SAMPLE_DOC('s6', at(TODAY)) }, supp('s6'));
  assert.throws(() => Dm.reviewVerification(st, { supplierId: 's6', decision: 'approve', checks: { nameMatches: true }, licenceExpiry: '2027-10-01' }, ops()), code('VERIFICATION_CHECKS_INCOMPLETE'));
  assert.throws(() => Dm.reviewVerification(st, { supplierId: 's6', decision: 'approve', checks: { nameMatches: true, numberMatches: true, documentLegible: true }, licenceExpiry: '2027-10-01' }, Object.assign(ops(), { mode: 'live' })), code('VERIFICATION_SAMPLE_NOT_ALLOWED_LIVE'));
  Dm.reviewVerification(st, { supplierId: 's6', decision: 'approve', checks: { nameMatches: true, numberMatches: true, documentLegible: true }, licenceExpiry: '2027-10-01' }, ops());
  assert.equal(s.verification.status, 'licence_reviewed'); assert.equal(s.verification.simulated, true);
  Dm.updateSupplierProfile(st, { supplierId: 's6', licenceNumber: 'DED-0000-000' }, supp('s6'));
  assert.equal(s.verification.status, 'submitted');
});

test('suppliers can only respond to their own RFQ lines; RFQ deadline before notice period is rejected', () => {
  const st = fresh(); const ob = objective(st);
  const r = Dm.createRfq(st, { objectiveId: ob.id, oppIds: ['o4'] }, cust());
  assert.throws(() => Dm.respond(st, { rfqId: r.id, line: r.lines[0].id, input: offerInput(r.lines[0]) }, supp('s2')), code('FORBIDDEN'));
  assert.throws(() => Dm.createRfq(st, { objectiveId: ob.id, oppIds: ['o4'], meta: { responseDeadline: Dt.addDays(ob.start, -2) } }, cust()), err => err.code === 'RFQ_DEADLINE_INVALID' && err.details.code === 'rfq.deadline.notice');
  assert.throws(() => Dm.createRfq(st, { objectiveId: ob.id, oppIds: ['o4'], meta: { responseDeadline: TODAY } }, cust()), err => err.details.code === 'rfq.deadline.past');
  assert.throws(() => Dm.createRfq(st, { objectiveId: ob.id, oppIds: ['o4'] }, supp('s1')), code('FORBIDDEN'));
});

test('state machines refuse undefined transitions with a structured error', () => {
  const st = fresh(); const bk = st.bookings[0];
  assert.throws(() => Dm.advanceBooking(st, { bookingId: bk.id, event: 'prepare' }, supp(bk.supplierId)), err => err.code === 'STATE_TRANSITION_NOT_ALLOWED' && err.details.from === 'delivery_accepted');
  const e = (() => { try { CON.States.next('payment', 'failed', 'pay'); } catch (x) { return x; } })();
  assert.deepEqual(JSON.parse(JSON.stringify(e)).error.code, 'STATE_TRANSITION_NOT_ALLOWED');
});

test('the sample seed obeys the same rules: totals reconcile and audit covers every transition', () => {
  const st = fresh();
  const p = st.payments[0];
  assert.equal(p.amount.total, p.lines.reduce((t, l) => t + l.money.total, 0));
  assert.ok(Number.isSafeInteger(p.amount.total));
  const kinds = new Set(st.audit.map(a => a.entity));
  ['rfq', 'offer', 'payment', 'booking', 'payout', 'reservation'].forEach(k => assert.ok(kinds.has(k), k));
});

test('an offer whose dates do not overlap the campaign cannot be approved', () => {
  const st = fresh(); const ob = objective(st);
  const r = Dm.createRfq(st, { objectiveId: ob.id, oppIds: ['o4'] }, cust()); const l = r.lines[0];
  const later = Dt.addDays(ob.end, 14);
  const weekend = [later, Dt.addDays(later, 1), Dt.addDays(later, 2)].filter(d => [6, 0].includes(Dt.weekday(d)));
  Dm.respond(st, { rfqId: r.id, line: l.id, input: offerInput(l, { dates: weekend, from: weekend[0], to: weekend[weekend.length - 1], units: weekend.length }) }, supp('s1'));
  const v = Of.current(l);
  assert.throws(() => Dm.approve(st, { rfqId: r.id, line: l.id, acceptedDeviations: v.deviations.map(d => d.field) }, cust()), err => err.details.errors.some(e => e.code === 'OFFER_NO_DATE_OVERLAP'));
});

test('a booking snapshot keeps supplier identity, scope, prices, fees, taxes, terms and evidence', () => {
  const st = fresh(); const bk = st.bookings[0];
  ['title', 'desc', 'evidence', 'supplierName', 'supplierLicence', 'supplierVerification', 'price', 'unit', 'version'].forEach(k => assert.ok(k in bk.snapshot, k));
  ['net', 'fee', 'vat', 'total'].forEach(k => assert.ok(Number.isSafeInteger(bk.money[k]), k));
  assert.ok(bk.offer && bk.offer.deliverables.length && bk.dates.length);
});
