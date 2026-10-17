// Two-stage matching: eligibility before scoring, coverage, evidence and packages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CON } from './_load.mjs';
const E = CON.Engine, D = CON.DATA, Dt = CON.Dates;
const today = '2026-10-17';
const ctx = { today, suppliers: D.suppliers };
const brief = o => E.normalizeObjective(Object.assign({ objective: 'leads', budget: 100000, duration: 30, start: Dt.addDays(today, 21) }, o), { today });

test('a ladies-only venue is never recommended for men 35–55 in Dubai Marina (H7)', () => {
  const b = brief({ gender: 'male', ageMin: 35, ageMax: 55, areas: ['marina'], requirements: { audience: 'required', areas: 'required' } });
  const r = E.rank(D.opportunities, b, ctx);
  const ids = r.recommended.map(x => x.oppId).concat(r.eligible.map(x => x.oppId), r.relaxed.map(x => x.oppId));
  assert.ok(!ids.includes('o26'));
  assert.ok(r.all.find(x => x.oppId === 'o26').fails.some(f => f.code === 'e.access.female_only'));
  r.eligible.forEach(x => { const op = D.opportunities.find(o => o.id === x.oppId); assert.ok(op.area === 'marina' || op.area === 'all', x.oppId + ' outside Marina'); });
  // Relaxed alternatives are listed separately and say which requirement they relax.
  r.relaxed.forEach(x => assert.ok(x.relaxedOn.length && x.relaxedOn.every(k => ['location', 'audience'].includes(k))));
});

test('preferred (not required) location still ranks outside areas but never above an eligibility failure', () => {
  const b = brief({ gender: 'male', ageMin: 35, ageMax: 55, areas: ['marina'] });
  const r = E.rank(D.opportunities, b, ctx);
  assert.ok(r.eligible.length > 4);
  assert.ok(!r.eligible.some(x => x.oppId === 'o26'));
  r.excluded.forEach(x => assert.ok(x.fails.length > 0));
});

test('a 90-day brief against a listing capped at 60 daily units is partial, never full (§7)', () => {
  const op = Object.assign({}, D.opportunities.find(o => o.id === 'o2'), { maxUnits: 60, availableTo: '2027-12-31' });
  const b = brief({ objective: 'trial', duration: 90, areas: ['barsha'] });
  const c = E.coverage(op, b);
  assert.equal(c.status, 'partial'); assert.equal(c.neededUnits, 90); assert.equal(c.purchasedUnits, 60); assert.equal(c.overMax, 30);
  assert.equal(c.uncoveredDates.length, 30);
  const p = E.price(op, c);
  assert.equal(p.base, op.price * 60);
  const strict = E.eligibility(op, null, Object.assign({}, b, { requirements: Object.assign({}, b.requirements, { coverage: 'full' }) }), ctx);
  assert.ok(strict.checks.some(x => x.code === 'e.coverage.partial' && x.status === 'fail'));
});

test('activation dates differ from calendar span for weekend-only listings', () => {
  const op = D.opportunities.find(o => o.id === 'o4');
  const c = E.coverage(op, brief({ objective: 'trial', duration: 28, start: '2026-11-08', areas: ['marina'] }));
  assert.equal(c.calendarDays, 28); assert.equal(c.neededUnits, 8); assert.equal(c.everyDay, false);
  c.activationDates.forEach(d => assert.ok([6, 0].includes(Dt.weekday(d))));
});

test('facility needs and product category are eligibility checks, unknowns need confirmation', () => {
  const b = brief({ objective: 'trial', areas: ['all'], productCategory: 'food', needs: { refrigeration: true } });
  const o1 = E.eligibility(D.opportunities.find(o => o.id === 'o1'), null, b, ctx); // refrigeration: false
  assert.ok(o1.checks.some(x => x.code === 'e.facility.no' && x.status === 'fail'));
  const o12 = E.eligibility(D.opportunities.find(o => o.id === 'o12'), null, b, ctx); // unknown
  assert.ok(o12.checks.some(x => x.code === 'e.facility.unknown' && x.status === 'confirm'));
  const o8 = E.eligibility(D.opportunities.find(o => o.id === 'o8'), null, brief({ productCategory: 'finance', areas: ['all'] }), ctx);
  assert.ok(o8.checks.some(x => x.code === 'e.category.notallowed'));
});

test('evidence is reported per dimension with source and freshness, and unlike metrics are never summed', () => {
  const op = D.opportunities.find(o => o.id === 'o12');
  const ev = E.evidenceProfile(op, D.suppliers.find(s => s.id === op.supplierId), { today });
  ['business', 'completeness', 'audience', 'delivery', 'outcome', 'availability'].forEach(k => assert.ok(k in ev, k));
  assert.equal(ev.audience.level, 'sample');
  const r = E.rank(D.opportunities, brief({ objective: 'awareness', areas: ['marina'] }), ctx);
  const pk = E.buildPackages(r, D.opportunities, {});
  pk.forEach(p => { Object.values(p.evidenceByMetric || {}).forEach(v => assert.ok(!('total' in v) || typeof v.total === 'number')); assert.equal(p.totals.total, p.items.reduce((t, i) => t + i.price.total, 0)); });
  const stale = E.evidenceProfile(D.opportunities.find(o => o.id === 'o3'), null, { today });
  assert.equal(stale.availability, 'stale');
});

test('match scores are only computed for eligible listings and never exceed 100', () => {
  const r = E.rank(D.opportunities, brief({ areas: ['marina'], gender: 'male', requirements: { areas: 'required' } }), ctx);
  r.all.forEach(x => { if (!x.eligible) assert.equal(x.score, null); else assert.ok(x.score >= 0 && x.score <= 100); });
});

test('RFQ response deadline must leave the supplier notice period', () => {
  const b = brief({ start: '2026-11-20' });
  const ops = [D.opportunities.find(o => o.id === 'o16')];
  assert.equal(E.rfqDeadlineCheck('2026-11-19', b, ops, today).code, 'rfq.deadline.notice');
  assert.equal(E.rfqDeadlineCheck('2026-10-17', b, ops, today).code, 'rfq.deadline.past');
  assert.equal(E.rfqDeadlineCheck('2026-02-30', b, ops, today).code, 'rfq.deadline.invalid');
});

test('a staffing need is checked against the listing staffing field', () => {
  const b = brief({ objective: 'trial', areas: ['all'], needs: { staffing: true } });
  const o10 = E.eligibility(D.opportunities.find(o => o.id === 'o10'), null, b, ctx); // staffingProvided: true
  assert.ok(o10.checks.some(x => x.key === 'facility' && x.status === 'pass'));
  const o1 = E.eligibility(D.opportunities.find(o => o.id === 'o1'), null, b, ctx); // staffingProvided: false
  assert.ok(o1.checks.some(x => x.code === 'e.facility.no'));
});

test('sample listings never present their figures as verified market evidence (acceptance 22)', () => {
  D.opportunities.forEach(op => {
    (op.evidence || []).forEach(e => { assert.equal(e.verification, 'sample', op.id); assert.equal(e.source, 'sample', op.id); });
    const ev = E.evidenceProfile(op, D.suppliers.find(s => s.id === op.supplierId), { today });
    ['audience', 'delivery', 'outcome'].forEach(k => assert.ok(['sample', 'insufficient'].includes(ev[k].level), op.id + ' ' + k));
  });
  D.suppliers.filter(s => s.verification.status === 'licence_reviewed').forEach(s => assert.equal(s.verification.simulated, true, s.id));
});

test('unit economics formulas: break-even, payback and refund losses', () => {
  const r = CON.Econ.calc({ atv: 10000, take: 10, proc: 2, ai: 10, support: 100, refunds: 1, fixed: 10000, cac: 2000, freq: 4 });
  // fee 1000; charged 11000 × 2% = 220; + 10 + 100 + 100 refunds = 430 variable; contribution 570
  assert.equal(r.rev, 1000); assert.equal(r.varCost, 430); assert.equal(r.contrib, 570);
  assert.equal(r.breakEven, Math.ceil(10000 / 570));
  assert.ok(Math.abs(r.payMonths - (2000 / 570) / (4 / 12)) < 1e-9);
  assert.equal(r.yearContrib, 570 * 4 - 2000);
  assert.equal(CON.Econ.calc({ atv: 1000, take: 1, proc: 5, ai: 50, support: 50, refunds: 0, fixed: 1, cac: 1, freq: 1 }).breakEven, null);
});
