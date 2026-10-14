/* Commercial Opportunity Network — prototype data store (browser-only) */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const E = CON.Engine;
  const KEY = 'con.state.v2';
  const clone = x => JSON.parse(JSON.stringify(x));
  const U = E.util;

  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nowIso() { return new Date().toISOString(); }

  function seed() {
    const D = CON.DATA;
    const today = U.todayIso();
    const s = {
      version: 2, createdAt: nowIso(),
      company: 'Demo Brand Co.',
      activeSupplierId: 's1',
      suppliers: clone(D.suppliers),
      opportunities: clone(D.opportunities),
      objectives: [], rfqs: [], transactions: [], bookings: [],
      compare: [],
      counters: { rfq: 0, tx: 0, bk: 0 },
      kill: {},
      econ: null,
      events: []
    };
    // Past, completed booking (to show results and payout)
    const past = E.normalizeObjective({ objective: 'trial', product: 'Cold brew coffee range', gender: 'all', ageMin: 22, ageMax: 50, interests: ['shoppers', 'families'], areas: ['barsha'], budget: 40000, duration: 10, start: U.addDays(today, -40), success: '4,000 samples handed out' });
    const pastObj = Object.assign({ id: 'obpast', name: 'Cold brew sampling', sample: true, createdAt: U.addDays(today, -55) + 'T09:00:00.000Z', planViewed: true, selected: ['o2'], source: 'form' }, past);
    s.objectives.push(pastObj);
    const pastRfq = buildRfq(s, pastObj, ['o2'], { reporting: 'detailed', requirements: '' });
    pastRfq.createdAt = U.addDays(today, -52) + 'T10:00:00.000Z';
    pastRfq.number = 'RFQ-2026-0001';
    pastRfq.sample = true;
    const pr = pastRfq.lines[0];
    pr.response = { status: 'offered', basePrice: 36000, setupFee: 1500, units: 10, from: past.start, to: past.end, reporting: 'detailed', terms: 'split', validUntil: U.addDays(today, -38), deliverables: 'Staffed counter, 10 days, daily sample count', notes: '', respondedAt: U.addDays(today, -51) + 'T12:00:00.000Z' };
    pr.approved = true;
    pastRfq.status = 'awarded';
    s.rfqs.push(pastRfq);
    const tx = createTransaction(s, pastRfq, { method: 'card', company: 'Demo Brand Co.', email: 'finance@demo-brand.test', trn: '' });
    tx.createdAt = U.addDays(today, -48) + 'T09:00:00.000Z';
    tx.sample = true;
    const bk = s.bookings[s.bookings.length - 1];
    bk.sample = true;
    bk.status = 'completed';
    bk.timeline = [
      { status: 'confirmed', at: U.addDays(today, -48) + 'T09:00:00.000Z' },
      { status: 'preparing', at: U.addDays(today, -45) + 'T09:00:00.000Z' },
      { status: 'live', at: past.start + 'T10:00:00.000Z' },
      { status: 'completed', at: past.end + 'T21:00:00.000Z' }
    ];
    bk.report = { submittedAt: U.addDays(past.end, 2) + 'T09:00:00.000Z', metrics: [
      { name: 'Samples handed out', value: 4180, unit: 'samples', method: 'counted', note: 'Daily tally sheets' },
      { name: 'Newsletter sign-ups', value: 312, unit: 'sign-ups', method: 'system', note: 'QR form export' },
      { name: 'Visitors passing the counter', value: 52000, unit: 'people', method: 'estimated', note: 'Mall door counters, pro-rated' }
    ] };

    // Open sample objective with an RFQ awaiting replies
    const cur = E.normalizeObjective({ objective: 'trial', product: 'Plant-based protein drink', gender: 'female', ageMin: 25, ageMax: 45, interests: ['fitness', 'residents'], areas: ['marina', 'jlt', 'barsha'], budget: 100000, duration: 30, start: U.addDays(today, 21), success: '5,000 product trials and 500 newsletter sign-ups', target: 5000 });
    const curObj = Object.assign({ id: 'obsample', name: 'Protein drink launch', sample: true, createdAt: U.addDays(today, -2) + 'T08:30:00.000Z', planViewed: true, selected: ['o4', 'o26', 'o10'], source: 'sentence', sentence: 'Get 5,000 women aged 25-45 in Dubai Marina, JLT and Al Barsha to try our protein drink in 30 days, budget AED 100,000.' }, cur);
    curObj.extraction = E.extract(curObj.sentence).found;
    s.objectives.push(curObj);
    const rfq = buildRfq(s, curObj, ['o4', 'o26', 'o10'], { reporting: 'basic', requirements: 'Samples are chilled cans. Brand provides two promoters per site.' });
    rfq.createdAt = U.addDays(today, -1) + 'T11:00:00.000Z';
    rfq.sample = true;
    rfq.lines.forEach(l => {
      if (l.supplierId !== 's1') { const r = E.simulateResponse(l, s.opportunities.find(o => o.id === l.oppId), rfq); l.response = Object.assign(r.status === 'declined' ? r : r, { respondedAt: U.addDays(today, -1) + 'T15:00:00.000Z' }); if (l.response.status === 'declined') { l.response = Object.assign(E.simulateResponse(l, s.opportunities.find(o => o.id === l.oppId), Object.assign({}, rfq, { id: rfq.id + 'x' })), { respondedAt: U.addDays(today, -1) + 'T15:00:00.000Z' }); } }
    });
    s.rfqs.push(rfq);
    s.events.push({ type: 'objective', at: curObj.createdAt }, { type: 'objective', at: pastObj.createdAt });
    return s;
  }

  function buildRfq(s, objective, oppIds, meta) {
    const opps = oppIds.map(id => s.opportunities.find(o => o.id === id)).filter(Boolean);
    const gen = E.generateRFQ(objective, opps, meta);
    const rfq = Object.assign({ id: uid('rq'), number: 'RFQ-2026-' + String(++s.counters.rfq).padStart(4, '0'), objectiveId: objective.id, createdAt: nowIso(), status: 'open' }, gen);
    rfq.lines = gen.lines.map(l => Object.assign({}, l, { response: null, approved: false }));
    return rfq;
  }

  function createTransaction(s, rfq, billing) {
    const fee = CON.config.platformFeeRate, vat = CON.config.vatRate;
    const approved = rfq.lines.filter(l => l.approved && l.response && l.response.status === 'offered');
    const lines = approved.map(l => ({ oppId: l.oppId, supplierId: l.supplierId, n: E.normalizeOffer(l.response, rfq, { feeRate: fee, vatRate: vat }) }));
    const net = lines.reduce((a, l) => a + l.n.net, 0);
    const vatAmt = lines.reduce((a, l) => a + l.n.vat, 0);
    const feeAmt = lines.reduce((a, l) => a + l.n.platformFee, 0);
    const tx = { id: uid('tx'), number: 'TX-2026-' + String(++s.counters.tx).padStart(4, '0'), rfqId: rfq.id, objectiveId: rfq.objectiveId, createdAt: nowIso(), method: billing.method, status: billing.method === 'card' ? 'paid' : 'awaiting', net, vat: vatAmt, fee: feeAmt, total: net + vatAmt + feeAmt, billing: { company: billing.company, email: billing.email, trn: billing.trn } };
    s.transactions.push(tx);
    lines.forEach(l => {
      s.bookings.push({ id: uid('bk'), number: 'BK-2026-' + String(++s.counters.bk).padStart(4, '0'), txId: tx.id, rfqId: rfq.id, objectiveId: rfq.objectiveId, oppId: l.oppId, supplierId: l.supplierId, net: l.n.net, total: l.n.total, from: (rfq.lines.find(x => x.oppId === l.oppId).response.from) || rfq.start, to: (rfq.lines.find(x => x.oppId === l.oppId).response.to) || rfq.end, status: 'confirmed', timeline: [{ status: 'confirmed', at: nowIso() }], report: null, outcome: null, delivery: null, payout: 'held' });
      const op = s.opportunities.find(o => o.id === l.oppId); if (op) op.slotsBooked = Math.min(op.slotsTotal || 0, (op.slotsBooked || 0) + 1);
    });
    rfq.status = 'awarded';
    return tx;
  }

  let state = null;
  const listeners = [];
  const Store = {
    load() {
      const saved = CON.storage.get(KEY, null);
      state = saved && saved.version === 2 ? saved : seed();
      if (!saved) Store.save();
      return state;
    },
    get state() { return state; },
    save() {
      const ok = CON.storage.set(KEY, state);
      if (!ok) listeners.forEach(fn => fn('save-failed'));
      return ok;
    },
    reset() { CON.storage.remove(KEY); state = seed(); Store.save(); },
    on(fn) { listeners.push(fn); },
    uid,
    opp(id) { return state.opportunities.find(o => o.id === id); },
    supplier(id) { return state.suppliers.find(s => s.id === id); },
    objective(id) { return state.objectives.find(o => o.id === id); },
    rfq(id) { return state.rfqs.find(r => r.id === id); },
    booking(id) { return state.bookings.find(b => b.id === id); },
    tx(id) { return state.transactions.find(t => t.id === id); },

    /* Objectives */
    createObjective(fields, meta) {
      const o = E.normalizeObjective(fields);
      const obj = Object.assign({ id: uid('ob'), name: meta.name || '', createdAt: nowIso(), selected: [], planViewed: false, source: meta.source || 'form', sentence: meta.sentence || '', extraction: meta.extraction || null }, o);
      state.objectives.unshift(obj);
      state.events.push({ type: 'objective', at: obj.createdAt });
      Store.save();
      return obj;
    },
    updateObjective(id, fields, meta) {
      const obj = Store.objective(id); if (!obj) return null;
      Object.assign(obj, E.normalizeObjective(Object.assign({}, obj, fields)), { name: meta.name || obj.name, sentence: meta.sentence != null ? meta.sentence : obj.sentence, extraction: meta.extraction || obj.extraction, updatedAt: nowIso() });
      Store.save();
      return obj;
    },
    deleteObjective(id) {
      state.objectives = state.objectives.filter(o => o.id !== id);
      Store.save();
    },
    rankFor(obj) { return E.rank(state.opportunities.filter(o => o.status === 'active'), obj, { suppliers: state.suppliers }); },

    /* RFQs */
    sendRfq(objectiveId, oppIds, meta) {
      const obj = Store.objective(objectiveId);
      const rfq = buildRfq(state, obj, oppIds, meta);
      const t = Date.now();
      rfq.shareBudget = meta.shareBudget !== false;
      rfq.lines.forEach((l, i) => { if (l.supplierId !== state.activeSupplierId) l.simulateAt = t + 1500 + i * 900; });
      state.rfqs.unshift(rfq);
      Store.save();
      return rfq;
    },
    /* Process due simulated replies; returns list of {rfq, line} that changed */
    tick(force) {
      const changed = [];
      const t = Date.now();
      state.rfqs.forEach(r => r.lines.forEach(l => {
        if (!l.response && l.simulateAt && (force || l.simulateAt <= t)) {
          const op = Store.opp(l.oppId);
          l.response = Object.assign(E.simulateResponse(l, op, r), { respondedAt: nowIso() });
          delete l.simulateAt;
          changed.push({ rfq: r, line: l });
        }
      }));
      if (changed.length) Store.save();
      return changed;
    },
    respond(rfqId, oppId, response) {
      const r = Store.rfq(rfqId); const l = r && r.lines.find(x => x.oppId === oppId);
      if (!l) return false;
      l.response = Object.assign({}, response, { respondedAt: nowIso() });
      delete l.simulateAt;
      Store.save();
      return true;
    },
    nudge(rfqId) {
      const r = Store.rfq(rfqId); if (!r) return 0;
      let n = 0;
      r.lines.forEach(l => { if (!l.response && l.supplierId !== state.activeSupplierId) { l.simulateAt = Date.now() - 1; n++; } else if (!l.response) { l.nudgedAt = nowIso(); } });
      Store.save();
      return n;
    },
    setApproved(rfqId, oppId, on) {
      const r = Store.rfq(rfqId); const l = r && r.lines.find(x => x.oppId === oppId);
      if (l) { l.approved = !!on; Store.save(); }
    },
    checkout(rfqId, billing) {
      const r = Store.rfq(rfqId);
      const tx = createTransaction(state, r, billing);
      Store.save();
      return tx;
    },

    /* Bookings */
    advance(bookingId, status) {
      const b = Store.booking(bookingId); if (!b) return;
      b.status = status; b.timeline.push({ status, at: nowIso() });
      Store.save();
    },
    submitReport(bookingId, metrics) {
      const b = Store.booking(bookingId); if (!b) return;
      b.report = { submittedAt: nowIso(), metrics };
      Store.save();
    },
    confirmDelivery(bookingId) {
      const b = Store.booking(bookingId); if (!b) return;
      b.status = 'delivered'; b.delivery = nowIso(); b.timeline.push({ status: 'delivered', at: b.delivery });
      b.payout = 'ready';
      Store.save();
    },
    setOutcome(bookingId, outcome) {
      const b = Store.booking(bookingId); if (!b) return;
      b.outcome = Object.assign({ at: nowIso() }, outcome);
      Store.save();
    },
    releasePayout(bookingId) { const b = Store.booking(bookingId); if (b && b.payout === 'ready') { b.payout = 'released'; b.payoutAt = nowIso(); Store.save(); } },
    markPaid(txId) { const t = Store.tx(txId); if (t) { t.status = 'paid'; t.paidAt = nowIso(); Store.save(); } },

    /* Suppliers */
    saveOpportunity(op) {
      const i = state.opportunities.findIndex(o => o.id === op.id);
      if (i >= 0) state.opportunities[i] = op; else state.opportunities.unshift(op);
      return Store.save();
    },
    deleteOpportunity(id) { state.opportunities = state.opportunities.filter(o => o.id !== id); state.compare = state.compare.filter(x => x !== id); Store.save(); },
    setSupplier(id) { state.activeSupplierId = id; Store.save(); },
    saveSupplier(sup) {
      const i = state.suppliers.findIndex(s => s.id === sup.id);
      if (i >= 0) state.suppliers[i] = sup; else state.suppliers.push(sup);
      Store.save();
    },
    verify(id, decision, note) { const s = Store.supplier(id); if (s) { s.verified = decision; s.verifyNote = note || ''; s.verifiedAt = nowIso(); Store.save(); } },

    /* Compare */
    toggleCompare(id) {
      const i = state.compare.indexOf(id);
      if (i >= 0) state.compare.splice(i, 1);
      else { if (state.compare.length >= 4) return 'full'; state.compare.push(id); }
      Store.save();
      return i >= 0 ? 'removed' : 'added';
    }
  };
  CON.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);
