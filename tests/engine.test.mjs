// Unit tests for the Opportunity Engine (node --test)
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../dist/assets/js/data.js');
await import('../dist/assets/js/engine.js');
const { CON } = globalThis;
const E = CON.Engine, D = CON.DATA;
const today = '2026-10-14';
const brief = { objective: 'trial', budget: 100000, duration: 30, start: '2026-11-05', areas: ['marina'], ageMin: 25, ageMax: 45, gender: 'all', interests: ['residents'] };

test('extracts structured requirements from a plain sentence', () => {
  const { fields } = E.extract('I want to acquire 5,000 new customers in Dubai within 45 days with a budget of AED 100,000. Women 25–45.');
  assert.equal(fields.budget, 100000);
  assert.equal(fields.duration, 45);
  assert.equal(fields.target, 5000);
  assert.equal(fields.objective, 'acquisition');
  assert.equal(fields.gender, 'female');
  assert.deepEqual([fields.ageMin, fields.ageMax], [25, 45]);
  assert.deepEqual(fields.areas, ['all']);
});

test('extracts from Arabic text with "k" style amounts and weeks', () => {
  assert.equal(E.extract('ميزانية 50 ألف درهم').fields.budget, 50000);
  assert.equal(E.extract('budget 60k AED over 6 weeks').fields.budget, 60000);
  assert.equal(E.extract('budget 60k AED over 6 weeks').fields.duration, 42);
  assert.deepEqual(E.extract('إطلاق في دبي مارينا').fields.areas, ['marina']);
});

test('match score is the weighted sum of eight visible factors', () => {
  const op = D.opportunities.find(o => o.id === 'o4');
  const r = E.scoreOpportunity(op, brief, { today });
  assert.equal(r.factors.length, 8);
  const sumW = r.factors.reduce((a, f) => a + f.weight, 0);
  assert.ok(Math.abs(sumW - 1) < 1e-9, 'weights sum to 1');
  const manual = Math.round(r.factors.reduce((a, f) => a + f.weight * f.value, 0) * 100);
  assert.equal(r.score, manual);
  r.factors.forEach(f => { assert.ok(f.value >= 0 && f.value <= 1); assert.ok(f.why && f.why.code); });
  assert.equal(r.cost.subtotal, 620 * 30);
});

test('over-budget and out-of-date listings are excluded, never silently ranked', () => {
  const op = D.opportunities.find(o => o.id === 'o16'); // AED 28,000 event in January
  const poor = E.scoreOpportunity(op, Object.assign({}, brief, { budget: 20000 }), { today });
  assert.equal(poor.excluded, 'over');
  const off = E.scoreOpportunity(op, Object.assign({}, brief, { start: '2026-11-05', duration: 10 }), { today });
  assert.equal(off.excluded, 'timing');
});

test('missing evidence lowers confidence instead of inventing numbers', () => {
  const noData = D.opportunities.find(o => o.id === 'o3');
  const r = E.scoreOpportunity(noData, brief, { today });
  assert.equal(r.factors.find(f => f.key === 'evidence').value, 0.15);
  assert.ok(r.risks.includes('risk.noev'));
  assert.equal(noData.reach, null);
});

test('unverified suppliers carry a visible risk and lower confidence', () => {
  const op = D.opportunities.find(o => o.supplierId === 's6');
  const r = E.scoreOpportunity(op, brief, { today });
  assert.ok(r.risks.includes('risk.unverified'));
});

test('packages stay within budget with the platform fee on its own line', () => {
  const rk = E.rank(D.opportunities, brief, { today });
  const pk = E.buildPackages(rk, D.opportunities, 0.07);
  assert.ok(pk.length >= 1);
  for (const p of pk) {
    assert.equal(p.platformFee, Math.round(p.subtotal * 0.07));
    assert.equal(p.total, p.subtotal + p.platformFee);
    assert.ok(p.total <= brief.budget + 1, `${p.id} total ${p.total} within budget`);
  }
  const lean = pk.find(p => p.id === 'lean');
  if (lean) assert.ok(lean.total <= brief.budget * 0.6 + 1);
});

test('recommendations come with up to two alternatives that are not themselves recommended', () => {
  const rk = E.rank(D.opportunities, brief, { today });
  const rec = new Set(rk.recommended.map(r => r.oppId));
  rk.recommended.forEach(r => { assert.ok(r.alternatives.length <= 2); r.alternatives.forEach(a => assert.ok(!rec.has(a))); });
});

test('RFQ groups lines by supplier and carries the brief', () => {
  const ops = ['o4', 'o5', 'o7'].map(id => D.opportunities.find(o => o.id === id));
  const rfq = E.generateRFQ(brief, ops, { reporting: 'detailed' });
  assert.deepEqual(rfq.suppliers.sort(), ['s1', 's3']);
  assert.equal(rfq.lines.length, 3);
  assert.equal(rfq.reporting, 'detailed');
  assert.equal(rfq.end, '2026-12-04');
});

test('offer normalisation adds VAT and fee and checks date coverage', () => {
  const rfq = { start: '2026-11-05', end: '2026-12-04', duration: 30 };
  const n = E.normalizeOffer({ basePrice: 10000, setupFee: 1000, from: '2026-11-05', to: '2026-12-04' }, rfq, { feeRate: 0.07, vatRate: 0.05 });
  assert.equal(n.net, 11000); assert.equal(n.vat, 550); assert.equal(n.platformFee, 770); assert.equal(n.total, 12320);
  assert.equal(n.dateMatch, 'full');
  const partial = E.normalizeOffer({ basePrice: 1000, setupFee: 0, from: '2026-11-20', to: '2026-12-04' }, rfq);
  assert.equal(partial.dateMatch, 'partial');
});

test('simulated supplier replies are deterministic for the same RFQ', () => {
  const op = D.opportunities.find(o => o.id === 'o7');
  const rfq = Object.assign({ id: 'rqTEST' }, E.generateRFQ(brief, [op]));
  const a = E.simulateResponse(rfq.lines[0], op, rfq); const b = E.simulateResponse(rfq.lines[0], op, rfq);
  assert.deepEqual(a, b);
});
