// Deterministic brief extraction: money, targets, objectives, negation, audience and dates (Asia/Dubai).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CON } from './_load.mjs';
const P = CON.Parse;
const X = (s, today = '2026-10-17') => P.extract(s, { today });
const st = (r, key) => (r.found.find(f => f.key === key) || {}).status;

test('budget cases from the specification', () => {
  const cases = [
    ['500 qualified leads, AED 20,000, men 35–55', 2000000],
    ['AED 100k', 10000000], ['100k AED', 10000000], ['AED 1.5 million', 150000000],
    ['١٠٠٬٠٠٠ درهم', 10000000], ['١٬٥٠٠٫٥٠ درهم', 150050], ['ميزانية 50 ألف درهم', 5000000],
    ['budget 60k AED over 6 weeks', 6000000], ['AED 2.5m', 250000000]
  ];
  for (const [s, fils] of cases) assert.equal(X(s).fields.budgetMinor, fils, s);
  assert.equal(X('١٬٥٠٠٫٥٠ درهم').fields.budget, '1500.50');
});

test('the lead target and the budget are not confused', () => {
  const r = X('500 qualified leads, AED 20,000, men 35–55');
  assert.equal(r.fields.target, 500); assert.equal(r.fields.objective, 'leads');
  assert.equal(r.fields.gender, 'male'); assert.deepEqual([r.fields.ageMin, r.fields.ageMax], [35, 55]);
  const r2 = X('AED 5000 budget for 5000 customers');
  assert.equal(r2.fields.budgetMinor, 500000); assert.equal(r2.fields.target, 5000);
});

test('implausible, ambiguous, negative and conflicting amounts require confirmation and are not applied', () => {
  for (const s of ['AED 50', 'AED 5 billion', 'AED 2bn']) { const r = X(s); assert.equal(st(r, 'budget'), 'confirm', s); assert.equal(r.fields.budgetMinor, undefined, s); }
  assert.equal(st(X('AED 1.500'), 'budget'), 'ambiguous');
  assert.equal(st(X('AED 20,000 and AED 30,000'), 'budget'), 'conflict');
  assert.equal(st(X('budget -AED 5,000'), 'budget'), 'invalid');
  assert.equal(X('AED 1.505').fields.budgetMinor, undefined);
});

test('negated objectives are excluded, not selected', () => {
  const r = X('New customers, not sampling');
  assert.equal(r.fields.objective, 'acquisition'); assert.deepEqual(r.excluded.objectives, ['trial']);
  const r2 = X('We do not want sampling, we want leads');
  assert.equal(r2.fields.objective, 'leads');
});

test('strict audience and area words become requirements', () => {
  const r = X('women only in Dubai Marina');
  assert.equal(r.fields.gender, 'female'); assert.deepEqual(r.fields.areas, ['marina']);
  assert.deepEqual(r.requirements, { audience: 'required', areas: 'required' });
  assert.deepEqual(X('women in Dubai Marina').requirements, {});
});

test('dates: start, deadline, duration; impossible dates rejected; past dates flagged', () => {
  const a = X('launch by 15 Dec, 6 weeks, budget AED 60k');
  assert.equal(a.fields.end, '2026-12-15'); assert.equal(a.fields.duration, 42); assert.equal(a.fields.start, '2026-11-04');
  assert.equal(st(a, 'end'), 'review'); // year assumed
  const b = X('start 1 December 2026 for 30 days');
  assert.equal(b.fields.start, '2026-12-01'); assert.equal(b.fields.duration, 30);
  const c = X('budget 31 February 2027');
  assert.equal(st(c, 'date'), 'invalid'); assert.equal(c.fields.budgetMinor, undefined);
  assert.equal(st(X('start 2026-09-01 for 10 days'), 'start'), 'past');
  assert.equal(X('ابدأ غداً لمدة أسبوعين', '2026-10-17').fields.duration, 14);
});

test('"today" follows Asia/Dubai, not the device clock', () => {
  // 21:30 UTC on 16 Oct is 01:30 on 17 Oct in Dubai.
  assert.equal(CON.Dates.today('Asia/Dubai', Date.parse('2026-10-16T21:30:00Z')), '2026-10-17');
  assert.equal(CON.Dates.today('Asia/Dubai', Date.parse('2026-10-16T19:59:00Z')), '2026-10-16');
});

test('normalisation keeps character positions aligned for highlighting', () => {
  const s = 'ميزانية ١٠٠٬٠٠٠ درهم';
  assert.equal(P.normalize(s).length, s.length);
  const f = X(s).found.find(x => x.key === 'budget');
  assert.ok(s.includes(f.raw));
});
