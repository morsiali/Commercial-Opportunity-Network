// Reproduces audit findings against the running demo. Usage: node tests/repro/repro-before.mjs [baseUrl]
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:4176/';
const out = {};
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base + 'platform.html#c-overview');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(400);

out.parser = await page.evaluate(() => {
  const x = s => window.CON.Engine.extract(s).fields;
  return {
    'H1 "500 qualified leads, AED 20,000, men 35–55" budget': x('500 qualified leads, AED 20,000, men 35–55').budget,
    'H2a "AED 100k"': x('AED 100k').budget,
    'H2b "100k AED"': x('100k AED').budget,
    'H2c "AED 1.5 million"': x('AED 1.5 million').budget,
    'H2d "١٠٠٬٠٠٠ درهم"': x('١٠٠٬٠٠٠ درهم').budget,
    'H2e "١٬٥٠٠٫٥٠ درهم"': x('١٬٥٠٠٫٥٠ درهم').budget,
    'H3a "500 qualified leads" target/objective': [x('500 qualified leads').target, x('500 qualified leads').objective],
    'H3b "5,000 new customers"': [x('5,000 new customers').target, x('5,000 new customers').objective],
    'H3c "New customers, not sampling" objective': x('New customers, not sampling').objective,
    'H3d "AED 5000 budget for 5000 customers" target': x('AED 5000 budget for 5000 customers').target,
    'H4 "start on 1 December 2026" start': x('start on 1 December 2026').start || null
  };
});

out.matching = await page.evaluate(() => {
  const E = window.CON.Engine, S = window.CON.Store.state;
  const brief = { objective: 'leads', gender: 'male', ageMin: 35, ageMax: 55, areas: ['marina'], budget: 100000, duration: 30, start: E.util.addDays(E.util.todayIso(), 21) };
  const r = E.rank(S.opportunities, brief, { suppliers: S.suppliers });
  const rec = r.recommended.map(x => { const o = S.opportunities.find(y => y.id === x.oppId); return { id: o.id, gender: o.audience.gender, area: o.area, score: x.score }; });
  const o4 = S.opportunities.find(o => o.id === 'o4');
  const c = E.itemCost(o4, E.normalizeObjective({ objective: 'trial', budget: 100000, duration: 90, start: E.util.addDays(E.util.todayIso(), 21), areas: ['marina'] }));
  const sc = E.scoreOpportunity(o4, { objective: 'trial', budget: 100000, duration: 90, start: E.util.addDays(E.util.todayIso(), 21), areas: ['marina'] }, { suppliers: S.suppliers });
  return {
    'H7 men 35–55, Dubai Marina required: recommended female-only venues': rec.filter(x => x.gender === 'female'),
    'H7 recommended outside Dubai Marina': rec.filter(x => x.area !== 'marina' && x.area !== 'all').length + ' of ' + rec.length,
    'H8 90-day request vs listing maxUnits 60 (per day)': { unitsPriced: c.units, timingFactor: sc.factors.find(f => f.key === 'timing').value, maxUnits: o4.maxUnits },
    'H9 float: normalizeOffer(1000.10 + 0.20 setup)': E.normalizeOffer({ basePrice: 1000.10, setupFee: 0.20 }, { start: '2026-11-01', end: '2026-11-30', duration: 30 })
  };
});

out.store = await page.evaluate(() => {
  const St = window.CON.Store, E = window.CON.Engine, s = St.state;
  const res = {};
  // H10 expired offer approvable + purchasable
  const r = s.rfqs.find(x => x.status === 'open');
  const offered = r.lines.find(l => l.response && l.response.status === 'offered');
  offered.response.validUntil = '2020-01-01';
  St.setApproved(r.id, offered.oppId, true);
  res['H10 expired offer approved'] = offered.approved;
  // H11 revision keeps approval
  St.respond(r.id, offered.oppId, Object.assign({}, offered.response, { basePrice: offered.response.basePrice * 2 }));
  res['H11 approval kept after material revision'] = r.lines.find(l => l.oppId === offered.oppId).approved;
  // H13 duplicate checkout
  const before = s.transactions.length;
  try { St.checkout(r.id, { method: 'bank', company: 'X', email: 'a@b.ae' }); St.checkout(r.id, { method: 'bank', company: 'X', email: 'a@b.ae' }); } catch (e) { res.err = String(e); }
  res['H13 transactions created by two checkout calls'] = s.transactions.length - before;
  // H12 unpaid payout release
  const bk = s.bookings[s.bookings.length - 1];
  const tx = St.tx(bk.txId);
  St.advance(bk.id, 'completed'); St.confirmDelivery(bk.id); St.releasePayout(bk.id);
  res['H12 payout released while payment status is'] = { payment: tx.status, payout: St.booking(bk.id).payout };
  // H14 overbooking: slots counter capped silently
  const op = St.opp(bk.oppId); res['H14 slots after double checkout'] = { booked: op.slotsBooked, total: op.slotsTotal };
  // H15 deleting a referenced listing
  St.deleteOpportunity(bk.oppId);
  res['H15 booking listing after delete'] = St.opp(bk.oppId) ? 'still present' : 'missing (booking now shows "Removed listing")';
  // H16 verification from filename
  const sup = s.suppliers.find(x => x.id === 's6'); sup.docName = 'licence.pdf'; St.verify('s6', 'verified', '');
  res['H16 verified with only a filename'] = St.supplier('s6').verified;
  // H21 synthetic data counted in pilot metrics
  res['H21 sample/simulated records in data'] = { sampleRfqs: s.rfqs.filter(x => x.sample).length, simulatedReplies: s.rfqs.reduce((a, x) => a + x.lines.filter(l => l.response && l.response.simulated).length, 0) };
  return res;
});

// H5 extraction re-render drops manual fields; H6 language switch drops draft
await page.goto(base + 'platform.html#c-new'); await page.waitForTimeout(300);
await page.fill('#f-product', 'Oat milk'); await page.fill('#f-success', '300 sign-ups');
await page.fill('#f-sentence', 'budget AED 20,000');
await page.click('form[data-form="extract"] button');
await page.waitForTimeout(300);
out.ui = { 'H5 after extraction: product / success': [await page.inputValue('#f-product'), await page.inputValue('#f-success')] };
await page.fill('#f-product', 'Oat milk'); await page.click('[data-act="lang"]'); await page.waitForTimeout(300);
out.ui['H6 after language switch: product'] = await page.inputValue('#f-product');
// H20 dialog semantics
await page.click('[data-act="lang"]');
await page.goto(base + 'platform.html#c-catalog'); await page.waitForTimeout(300);
await page.click('.cat-card [data-act="opp-detail"] >> nth=0'); await page.waitForTimeout(200);
out.ui['H20 dialog attributes'] = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return { labelledby: d.getAttribute('aria-labelledby'), label: d.getAttribute('aria-label') }; });
await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
out.ui['H20 focus inside dialog after 8 Tabs'] = await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'));
await browser.close();
const json = JSON.stringify(out, null, 2);
await writeFile(new URL('../../docs/evidence/' + (process.env.OUT || 'repro-before.json'), import.meta.url), json);
console.log(json);
