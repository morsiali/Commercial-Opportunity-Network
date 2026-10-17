/* Demo-only: builds the illustrative sample state by running the real domain operations
   (so the sample records obey the same rules as user records), and generates clearly
   labelled simulated supplier replies. Nothing here is used in live mode. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const Dt = CON.Dates, Dm = CON.Domain, E = CON.Engine, Of = CON.Offers;
  const clone = x => JSON.parse(JSON.stringify(x));

  function rand(seed) { let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

  /* Simulated reply for a demo RFQ line. Always marked simulated; can decline or offer partially. */
  function simulatedReply(rfq, line, op, today) {
    const r = rand(rfq.id + line.oppId);
    if (r < 0.12) return { decline: true, reason: 'Simulated reply: no capacity on the requested dates' };
    const cov = line.requested.coverage || {};
    const req = line.requested.price || {};
    const partial = r > 0.8 && (cov.purchasedUnits || 1) > 1;
    const units = partial ? Math.max(1, Math.floor((cov.purchasedUnits || 1) * 0.7)) : (cov.purchasedUnits || 1);
    const unitPrice = op.price == null ? 300000 : op.price;
    const factor = 0.9 + r * 0.15; // within -10% / +5% of list
    const basePrice = Math.round((unitPrice * units * factor) / 5000) * 5000;
    const dates = (cov.coveredDates || []).slice(0, op.unit === 'day' ? units : undefined);
    const from = dates[0] || line.window.from, to = dates[dates.length - 1] || line.window.to;
    return {
      input: { basePrice, setupFee: op.setupFee || 0, units, from, to, dates: dates.length ? dates : undefined,
        reporting: r > 0.55 ? 'detailed' : 'basic', deliverables: ['Placement as listed', r > 0.55 ? 'Daily activity log with photos' : 'End-of-campaign summary'],
        terms: r > 0.5 ? 'split' : 'full', validUntil: Dt.addDays(today, 10 + Math.round(r * 6)), notes: 'Simulated supplier reply (demo).', vatRegistered: true },
      simulated: true, req
    };
  }
  function at(d, h) { return d + 'T' + String(h || 9).padStart(2, '0') + ':00:00.000Z'; }

  function build(opts) {
    const today = (opts && opts.today) || Dt.today();
    const D = CON.DATA;
    const st = Dm.ensureState({ version: 3, mode: 'demo', createdAt: at(today), company: 'Demo Brand Co.', activeSupplierId: 's1',
      suppliers: clone(D.suppliers), opportunities: clone(D.opportunities), compare: [], events: [], kill: {}, econ: null });
    const ctxAt = (offset, role, extra) => { const d = Dt.addDays(today, offset); return Object.assign({ role, actor: role === 'customer' ? 'demo-customer' : role === 'ops' ? 'demo-operations' : role === 'supplier' ? 'demo-supplier' : 'system', today: d, now: at(d, 9 + (extra && extra.h || 0)), mode: 'demo' }, extra || {}); };

    /* 1. A completed campaign (sample) with delivery accepted and payout eligible. */
    const past = Object.assign(E.normalizeObjective({ objective: 'trial', product: 'Cold brew coffee range', productCategory: 'beverage', gender: 'all', ageMin: 22, ageMax: 50, interests: ['shoppers', 'families'], areas: ['barsha'], budget: 45000, duration: 10, start: Dt.addDays(today, -40), success: '4,000 samples handed out' }, { today: Dt.addDays(today, -55) }),
      { id: 'obpast', name: 'Cold brew sampling', sample: true, createdAt: at(Dt.addDays(today, -55)), planViewed: true, selected: ['o2'], source: 'form' });
    st.objectives.push(past);
    const r1 = Dm.createRfq(st, { objectiveId: 'obpast', oppIds: ['o2'], meta: { reporting: 'detailed' } }, ctxAt(-52, 'customer'));
    r1.sample = true;
    const l1 = r1.lines[0];
    Dm.respond(st, { rfqId: r1.id, line: l1.id, simulated: true, input: { basePrice: 3600000, setupFee: 150000, units: 10, from: past.start, to: past.end, reporting: 'detailed', deliverables: ['Staffed counter for 10 days', 'Daily sample count'], terms: 'split', validUntil: Dt.addDays(today, -38), vatRegistered: true } }, ctxAt(-51, 'system'));
    Dm.approve(st, { rfqId: r1.id, line: l1.id, acceptedDeviations: [] }, ctxAt(-49, 'customer'));
    const c1 = Dm.checkout(st, { rfqId: r1.id, method: 'card', idempotencyKey: 'seed-past-checkout', billing: { company: 'Demo Brand Co.', email: 'finance@demo-brand.test' } }, ctxAt(-48, 'customer'));
    Dm.paymentEvent(st, { eventId: 'seed-evt-past', paymentId: c1.payment.id, type: 'payment.succeeded', amount: c1.payment.amount.total, simulated: true }, Object.assign(ctxAt(-48, 'system'), { now: at(Dt.addDays(today, -48)).replace('09:00', '09:05') }));
    const b1 = st.bookings.find(b => b.paymentId === c1.payment.id);
    Dm.advanceBooking(st, { bookingId: b1.id, event: 'prepare' }, ctxAt(-45, 'supplier', { supplierId: 's2' }));
    Dm.advanceBooking(st, { bookingId: b1.id, event: 'go_live' }, ctxAt(-40, 'supplier', { supplierId: 's2' }));
    Dm.advanceBooking(st, { bookingId: b1.id, event: 'complete' }, ctxAt(-31, 'supplier', { supplierId: 's2' }));
    Dm.submitReport(st, { bookingId: b1.id, metrics: [
      { name: 'Samples handed out', value: 4180, unit: 'samples', method: 'counted', note: 'Daily tally sheets' },
      { name: 'Newsletter sign-ups', value: 312, unit: 'sign-ups', method: 'system', note: 'QR form export' },
      { name: 'Visitors passing the counter', value: 52000, unit: 'people', method: 'estimated', note: 'Mall door counters, pro-rated' }] }, ctxAt(-29, 'supplier', { supplierId: 's2' }));
    Dm.acceptDelivery(st, { bookingId: b1.id }, ctxAt(-28, 'customer'));
    [c1.payment, b1].forEach(x => { x.sample = true; });

    /* 2. An open campaign with an RFQ: one line waiting for the demo supplier, two simulated replies (one partial). */
    const cur = Object.assign(E.normalizeObjective({ objective: 'trial', product: 'Plant-based protein drink', productCategory: 'beverage', gender: 'female', ageMin: 25, ageMax: 45, interests: ['fitness', 'residents'], areas: ['marina', 'jlt', 'barsha'], budget: 100000, duration: 30, start: Dt.addDays(today, 21), success: '5,000 product trials and 500 newsletter sign-ups', target: 5000, needs: { foodSampling: true } }, { today }),
      { id: 'obsample', name: 'Protein drink launch', sample: true, createdAt: at(Dt.addDays(today, -2), 8), planViewed: true, selected: ['o4', 'o26', 'o10'], source: 'sentence',
        sentence: 'Get 5,000 women aged 25-45 in Dubai Marina, JLT and Al Barsha to try our protein drink in 30 days, budget AED 100,000.' });
    cur.extraction = CON.Parse.extract(cur.sentence, { today: Dt.addDays(today, -2) }).found;
    st.objectives.push(cur);
    const r2 = Dm.createRfq(st, { objectiveId: 'obsample', oppIds: ['o4', 'o26', 'o10'], meta: { reporting: 'basic', requirements: 'Samples are chilled cans. Brand provides two promoters per site.', responseDeadline: Dt.addDays(today, 4) } }, ctxAt(-1, 'customer'));
    r2.sample = true;
    const o26l = r2.lines.find(l => l.oppId === 'o26');
    Dm.respond(st, { rfqId: r2.id, line: o26l.id, simulated: true, input: { basePrice: 1050000, setupFee: 50000, units: 5, from: cur.start, to: cur.end, reporting: 'basic', deliverables: ['Sampling stand at reception, 5 weeks', 'Weekly member check-in count'], terms: 'full', validUntil: Dt.addDays(today, 12), notes: 'Simulated supplier reply (demo).' } }, ctxAt(-1, 'system', { h: 4 }));
    const o10l = r2.lines.find(l => l.oppId === 'o10');
    Dm.respond(st, { rfqId: r2.id, line: o10l.id, simulated: true, input: { basePrice: 1080000, setupFee: 120000, units: 3, from: cur.start, to: Dt.addDays(cur.start, 20), reporting: 'basic', deliverables: ['Counter display in 3 cafés', 'Weekly redemption count'], terms: 'split', validUntil: Dt.addDays(today, 9), notes: 'Simulated supplier reply (demo): 3 of the 5 requested weeks are available.' } }, ctxAt(-1, 'system', { h: 5 }));
    st.events.push({ type: 'objective', at: cur.createdAt }, { type: 'objective', at: past.createdAt });
    st.audit.forEach(a => { a.sample = true; });
    return st;
  }

  CON.Seed = { build, simulatedReply, rand };
})(typeof window !== 'undefined' ? window : globalThis);
