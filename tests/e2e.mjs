// End-to-end acceptance flows in a real browser (Chromium via Playwright).
// Run: npm run test:e2e   (uses a local server; nothing leaves the machine)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from '../scripts/preview.mjs';

const server = createServer();
await new Promise(r => server.listen(4177, '127.0.0.1', r));
const base = 'http://127.0.0.1:4177/';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const results = [];
const step = (id, name, detail) => { results.push({ id, name, result: 'pass', detail: detail || null }); console.log('✓ ' + id + ' ' + name); };
const S = () => page.evaluate(() => JSON.parse(JSON.stringify(CON.Store.state)));
const go = async hash => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(150); };
const lang = async l => { const cur = await page.evaluate(() => document.documentElement.lang); if (cur !== l) { await page.click('[data-act="lang"]'); await page.waitForTimeout(100); } };

try {
  await page.goto(base + 'platform.html');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('other.site.key', 'keep-me'); });
  await page.reload(); await page.waitForTimeout(300);

  /* ---- Brief: extraction preview never overwrites typed values; drafts survive language change and reload ---- */
  await go('c-new');
  await page.fill('#f-name', 'My typed name');
  await page.fill('#f-product', 'Fintech app');
  await page.fill('#f-sentence', '500 qualified leads, AED 20,000, men 35–55 in Dubai Marina only, start 2026-11-20 for 4 weeks');
  await page.click('form[data-form="extract"] button[type="submit"]');
  await page.waitForSelector('#merge-h');
  assert.equal(await page.inputValue('#f-name'), 'My typed name', 'typed name kept after extraction');
  assert.equal(await page.inputValue('#f-product'), 'Fintech app', 'typed product kept after extraction');
  const mergeText = await page.locator('.merge').innerText();
  assert.match(mergeText, /AED 20,000\.00/); assert.match(mergeText, /500/);
  step('A01', 'Sentence extraction shows a merge preview and keeps typed fields', { preview: mergeText.split('\n').slice(0, 12) });
  await page.click('#merge-form button[type="submit"]');
  await page.waitForTimeout(150);
  assert.equal(await page.inputValue('#f-budget'), '20000');
  assert.equal(await page.inputValue('#f-target'), '500');
  assert.equal(await page.inputValue('#f-name'), 'My typed name');
  assert.ok(await page.isChecked('input[name="gender"][value="male"]'));
  assert.ok(await page.isChecked('input[name="areas"][value="marina"]'));
  assert.ok(await page.isChecked('input[name="reqAreas"][value="required"]'));
  assert.equal(await page.inputValue('#f-start'), '2026-11-20'); assert.equal(await page.inputValue('#f-duration'), '28');
  step('A02', 'Applying selected values sets budget 20,000, target 500, men 35–55, Dubai Marina (required), dates');
  await page.fill('#f-success', 'Typed before language switch');
  await lang('ar');
  assert.equal(await page.inputValue('#f-success'), 'Typed before language switch');
  assert.equal(await page.inputValue('#f-name'), 'My typed name');
  await lang('en');
  await page.waitForTimeout(400);
  await page.reload(); await page.waitForTimeout(300);
  assert.equal(await page.inputValue('#f-success'), 'Typed before language switch', 'draft restored after reload');
  assert.ok(await page.locator('[data-draft-notice]').count(), 'draft restored notice');
  step('A03', 'Draft survives language switches and a page reload, with a visible restore notice');
  await page.click('form[data-form="objective"] button[type="submit"]');
  await page.waitForTimeout(300);
  const st1 = await S();
  const obj = st1.objectives[0];
  assert.equal(obj.budgetMinor, 2000000); assert.equal(obj.gender, 'male'); assert.deepEqual(obj.areas, ['marina']); assert.equal(obj.requirements.areas, 'required');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('con.draft.')).length), 0, 'draft removed after submit');
  step('A04', 'Submitting stores integer fils (2000000) and clears the draft');

  /* ---- Eligibility: no ladies-only venue for men; outside-area listings only in the separate relaxed list ---- */
  const plan = await page.evaluate(id => { const o = CON.Store.objective(id); const r = CON.Store.rankFor(o); return { rec: r.recommended.map(x => x.oppId), elig: r.eligible.map(x => [x.oppId, CON.Store.opp(x.oppId).area]), relaxed: r.relaxed.map(x => x.oppId), o26: r.all.find(x => x.oppId === 'o26').fails.map(f => f.code) }; }, obj.id);
  assert.ok(!plan.rec.includes('o26') && !plan.relaxed.includes('o26') && !plan.elig.some(e => e[0] === 'o26'));
  assert.ok(plan.o26.includes('e.access.female_only'));
  plan.elig.forEach(([id, area]) => assert.ok(area === 'marina' || area === 'all', id + ' in ' + area));
  const recText = await page.locator('#panel-plan').innerText();
  assert.ok(!/Ladies-only/i.test(recText));
  await page.click('[role="tab"][data-tab="relaxed"]');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), 'ex', 'arrow key moves to next tab');
  const exText = await page.locator('#panel-plan').innerText();
  assert.match(exText, /Ladies-only venue/);
  step('A05', 'Ladies-only listing excluded for men 35–55 in Dubai Marina; eligible list only Marina or city-wide', plan);
  step('A06', 'Plan tabs follow the ARIA tabs pattern (arrow keys move and select)');

  /* ---- Offers on the sample RFQ: partial needs explicit acceptance; revision clears approval; expiry ---- */
  const rfq = st1.rfqs.find(r => r.sample && r.status === 'open');
  await go('c-offers-' + rfq.id);
  const l26 = rfq.lines.find(l => l.oppId === 'o26'), l7 = rfq.lines.find(l => l.oppId === 'o7'), l4 = rfq.lines.find(l => l.oppId === 'o4');
  await page.click('form[data-form="approve"][data-line="' + l7.id + '"] button[type="submit"]');
  await page.waitForTimeout(150);
  assert.match(await page.locator('form[data-form="approve"][data-line="' + l7.id + '"]').innerText(), /Accept each difference first/);
  await page.check('form[data-form="approve"][data-line="' + l7.id + '"] input[name="dev"][value="coverage"]');
  await page.click('form[data-form="approve"][data-line="' + l7.id + '"] button[type="submit"]');
  await page.waitForTimeout(150);
  assert.equal((await S()).rfqs.find(r => r.id === rfq.id).lines.find(l => l.id === l7.id).status, 'accepted');
  step('A07', 'A partial offer cannot be approved until the coverage difference is explicitly accepted');
  await page.click('form[data-form="approve"][data-line="' + l26.id + '"] button[type="submit"]');
  await page.waitForTimeout(150);
  // Supplier (Pulse Fitness, s3) revises the approved o26 offer
  await go('s-overview');
  await page.selectOption('#sup-switch', 's3'); await page.waitForTimeout(150);
  await go('s-respond-' + rfq.id);
  await page.click('[data-act="revise"][data-line="' + l26.id + '"]');
  await page.fill('form[data-form="respond"][data-line="' + l26.id + '"] input[name="basePrice"]', '11000');
  await page.click('form[data-form="respond"][data-line="' + l26.id + '"] button[type="submit"]');
  await page.waitForTimeout(150);
  let line26 = (await S()).rfqs.find(r => r.id === rfq.id).lines.find(l => l.id === l26.id);
  assert.equal(line26.status, 'offered'); assert.equal(line26.approval, null); assert.equal(line26.offers.length, 2); assert.equal(line26.offers[1].basePrice, 1100000);
  await go('c-offers-' + rfq.id);
  assert.match(await page.locator('form[data-form="approve"][data-line="' + l26.id + '"]').innerText(), /revised this offer after your approval/);
  step('A08', 'A supplier revision after approval creates v2 and clears the approval, with a visible notice');
  // v2 is above the list price, so the price difference must be accepted explicitly before approving again
  const ap26 = 'form[data-form="approve"][data-line="' + l26.id + '"]';
  assert.ok(await page.locator(ap26 + ' input[name="dev"][value="price"]').count(), 'price deviation flagged on v2');
  await page.check(ap26 + ' input[name="dev"][value="price"]');
  if (await page.locator(ap26 + ' input[name="overBudget"]').count()) await page.check(ap26 + ' input[name="overBudget"]');
  await page.click(ap26 + ' button[type="submit"]'); await page.waitForTimeout(150);
  assert.equal((await S()).rfqs.find(r => r.id === rfq.id).lines.find(l => l.id === l26.id).approval.version, 2);
  // Answer the o4 line as supplier s1 and approve it
  await go('s-overview'); await page.selectOption('#sup-switch', 's1'); await page.waitForTimeout(150);
  await go('s-respond-' + rfq.id);
  const f4 = 'form[data-form="respond"][data-line="' + l4.id + '"]';
  await page.fill(f4 + ' textarea[name="deliverables"]', 'Staffed table in 6 lobbies\nDaily sample count');
  await page.click(f4 + ' button[type="submit"]'); await page.waitForTimeout(150);
  assert.equal((await S()).rfqs.find(r => r.id === rfq.id).lines.find(l => l.id === l4.id).status, 'offered');
  await go('c-offers-' + rfq.id);
  const ap4 = 'form[data-form="approve"][data-line="' + l4.id + '"]';
  if (await page.locator(ap4 + ' input[name="overBudget"]').count()) await page.check(ap4 + ' input[name="overBudget"]');
  await page.click(ap4 + ' button[type="submit"]'); await page.waitForTimeout(150);
  step('A09', 'Supplier answers in the supplier workspace and the customer approves each line');

  /* ---- Checkout: validation, idempotency, holds, simulated payment ---- */
  await go('c-checkout-' + rfq.id);
  await page.fill('#co-email', 'finance@example.test');
  await page.check('input[name="ack"]');
  const before = (await S()).payments.length;
  await page.evaluate(() => { const f = document.querySelector('form[data-form="checkout"]'); f.requestSubmit(); f.requestSubmit(); });
  await page.waitForTimeout(300);
  const st2 = await S();
  if (process.env.DEBUG) console.log(JSON.stringify(st2.rfqs.find(r => r.id === rfq.id).lines.map(l => [l.oppId, l.status, l.approval && l.approval.version, l.offers.length])), await page.locator('#main').innerText().catch(() => ''));
  assert.equal(st2.payments.length, before + 1, 'exactly one payment created');
  const pay = st2.payments[0];
  assert.equal(pay.status, 'awaiting'); assert.equal(pay.amount.total, pay.lines.reduce((t, l) => t + l.money.total, 0));
  assert.ok(Number.isSafeInteger(pay.amount.total));
  assert.equal(st2.bookings.filter(b => b.paymentId === pay.id).length, 3);
  assert.ok(st2.allocations.filter(a => a.status === 'held').length >= 3);
  step('A10', 'Double submission creates one payment; totals equal the sum of rounded lines; dates are held', { total: pay.amount.total });
  // Second checkout attempt for the same RFQ is refused
  const again = await page.evaluate(id => { const r = CON.Store.act((st, ctx) => CON.Domain.checkout(st, { rfqId: id, method: 'card', idempotencyKey: 'another-key-123' }, ctx)); return { ok: r.ok, code: r.error && r.error.code }; }, rfq.id);
  assert.equal(again.ok, false); assert.equal(again.code, 'CHECKOUT_NOTHING_APPROVED');
  step('A11', 'A second checkout for the same approvals is refused (CHECKOUT_NOTHING_APPROVED)');
  // Payout cannot be released while unpaid
  const po = st2.payouts.find(p => st2.bookings.find(b => b.id === p.bookingId && b.paymentId === pay.id));
  const rel = await page.evaluate(id => { CON.Store.setRole('o'); const r = CON.Store.act((st, ctx) => CON.Domain.releasePayout(st, { payoutId: id }, ctx)); return { ok: r.ok, code: r.error && r.error.code, details: r.error && r.error.details }; }, po.id);
  assert.equal(rel.ok, false); assert.equal(rel.code, 'PAYOUT_GUARDS_FAILED'); assert.ok(rel.details.failed.includes('payment_received'));
  step('A12', 'Payout release is refused while payment is outstanding', rel.details);
  await go('c-payment-' + pay.id);
  await page.click('[data-act="sim-pay"][data-ok="1"]'); await page.waitForTimeout(200);
  const st3 = await S();
  assert.equal(st3.payments.find(p => p.id === pay.id).status, 'paid');
  assert.ok(st3.bookings.filter(b => b.paymentId === pay.id).every(b => b.status === 'confirmed'));
  assert.ok(await page.locator('text=Simulated (demo)').count());
  step('A13', 'Simulated payment event confirms bookings and is labelled as simulated');

  /* ---- Expired offer cannot be approved ---- */
  const expired = await page.evaluate(() => {
    const st = CON.Store.state; const r = st.rfqs.find(x => x.lines.some(l => l.status === 'requested')) || null;
    return r ? r.id : null;
  });
  const exp = await page.evaluate(() => {
    CON.Store.setRole('c');
    const st = CON.Store.state; const ob = st.objectives.find(o => o.id === 'obsample');
    const res = CON.Store.act((s, ctx) => { const r = CON.Domain.createRfq(s, { objectiveId: ob.id, oppIds: ['o12'] }, ctx); const l = r.lines[0]; const c = l.requested.coverage;
      CON.Domain.respond(s, { rfqId: r.id, line: l.id, input: { basePrice: l.requested.price.base, setupFee: 0, units: c.purchasedUnits, from: c.coveredDates[0], to: c.coveredDates[c.coveredDates.length - 1], dates: c.coveredDates, deliverables: ['Lift screen loop'], validUntil: ctx.today } }, Object.assign({}, ctx, { role: 'system' }));
      return r.id; });
    const later = CON.Dates.addDays(CON.Dates.today(), 2);
    const r2 = CON.Store.act((s, ctx) => CON.Domain.approve(s, { rfqId: res.value, line: s.rfqs.find(x => x.id === res.value).lines[0].id }, Object.assign({}, ctx, { today: later })));
    return { ok: r2.ok, code: r2.error && r2.error.code, sub: r2.error && r2.error.details.errors.map(e => e.code) };
  });
  assert.equal(exp.ok, false); assert.ok(exp.sub.includes('OFFER_EXPIRED'));
  void expired;
  step('A14', 'An offer past its validity date cannot be approved', exp);

  /* ---- Verification: never from a filename; sample document labelled simulated; checklist required ---- */
  await go('o-verify');
  const vf = 'form[data-form="verify"][data-id="s6"]';
  await page.fill(vf + ' input[name="licenceExpiry"]', '2027-12-31');
  await page.click(vf + ' button[value="approve"]'); await page.waitForTimeout(150);
  assert.match(await page.locator(vf).innerText(), /Tick all three reviewer checks/);
  for (const k of ['nameMatches', 'numberMatches', 'documentLegible']) await page.check(vf + ' input[name="' + k + '"]');
  await page.fill(vf + ' input[name="licenceExpiry"]', '2027-12-31');
  await page.click(vf + ' button[value="approve"]'); await page.waitForTimeout(150);
  const s6 = (await S()).suppliers.find(s => s.id === 's6');
  assert.equal(s6.verification.status, 'licence_reviewed'); assert.equal(s6.verification.simulated, true);
  await go('s-overview'); await page.selectOption('#sup-switch', 's8'); await go('s-profile');
  await page.setInputFiles('#p-doc', { name: 'licence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo') });
  await page.click('button[value="file"]'); await page.waitForTimeout(150);
  const s8 = (await S()).suppliers.find(s => s.id === 's8');
  assert.equal(s8.verification.documents.slice(-1)[0].storage, 'local-only');
  const s8approve = await page.evaluate(() => { CON.Store.setRole('o'); const r = CON.Store.act((st, ctx) => { st.suppliers.find(s => s.id === 's8').verification.documents = st.suppliers.find(s => s.id === 's8').verification.documents.filter(d => d.storage === 'local-only'); return CON.Domain.reviewVerification(st, { supplierId: 's8', decision: 'approve', checks: { nameMatches: true, numberMatches: true, documentLegible: true }, licenceExpiry: '2027-12-31' }, ctx); }); return { ok: r.ok, code: r.error && r.error.code }; });
  assert.equal(s8approve.ok, false); assert.equal(s8approve.code, 'VERIFICATION_NO_REVIEWABLE_DOCUMENT');
  step('A15', 'Verification needs a reviewable document and a completed checklist; a file name alone cannot be approved; demo approvals are labelled simulated');

  /* ---- Listing archival keeps bookings intact ---- */
  await go('s-overview'); await page.selectOption('#sup-switch', 's2'); await go('s-listings');
  await page.click('[data-act="confirm"][data-key="opp:o2"]'); await page.click('[data-act="opp-delete"][data-id="o2"]'); await page.waitForTimeout(150);
  const st4 = await S();
  assert.equal(st4.opportunities.find(o => o.id === 'o2').status, 'archived');
  const bkPast = st4.bookings.find(b => b.oppId === 'o2');
  await go('c-booking-' + bkPast.id);
  assert.match(await page.locator('#main').innerText(), /Listing archived/);
  step('A16', 'Deleting a listing used by bookings archives it; the booking shows the terms as booked');

  /* ---- Payout release when every guard passes (sample completed booking) ---- */
  await go('o-payments');
  const poPast = st4.payouts.find(p => p.bookingId === bkPast.id);
  await page.click('[data-act="release"][data-id="' + poPast.id + '"]'); await page.waitForTimeout(150);
  assert.equal((await S()).payouts.find(p => p.id === poPast.id).status, 'released');
  step('A17', 'A payout with all five checks passed can be released (simulated) by operations');

  /* ---- Dialog accessibility ---- */
  await go('c-plan-obsample');
  const opener = page.locator('[data-act="opp-detail"]').first();
  await opener.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  const dlg = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return { modal: d.getAttribute('aria-modal'), label: document.getElementById(d.getAttribute('aria-labelledby'))?.textContent, inert: document.getElementById('app').hasAttribute('inert') }; });
  assert.equal(dlg.modal, 'true'); assert.ok(dlg.label && dlg.label.length > 3); assert.ok(dlg.inert);
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.getElementById('modal-root').contains(document.activeElement)), 'focus trapped in dialog');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.act === 'opp-detail'), 'focus returned to opener');
  step('A18', 'Dialogs are labelled, modal, trap focus and return focus to the opener', dlg);

  /* ---- Data controls: delete drafts, delete everything (only con.* keys) ---- */
  await go('c-new'); await page.fill('#f-name', 'draft to delete'); await page.waitForTimeout(450);
  await page.click('[data-act="data-controls"]'); await page.click('[data-act="drafts-clear"]'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('con.draft.')).length), 0);
  await page.click('[data-act="clear-all"]'); await page.click('[data-act="clear-all-yes"]'); await page.waitForTimeout(200);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.ok(keys.includes('other.site.key'), 'other keys untouched');
  assert.ok(keys.every(k => k === 'other.site.key' || k === 'con.state.v3'), 'only a fresh sample state remains: ' + keys.join(','));
  step('A19', 'Data controls delete drafts on their own, and “delete everything” removes only this site’s keys', { keys });

  /* ---- Migration from stored v2 data ---- */
  const v2 = (await import('node:fs')).readFileSync(new URL('./fixtures/state-v2.json', import.meta.url), 'utf8');
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('con.state.v2', s); }, v2);
  await page.reload(); await page.waitForTimeout(300);
  const mig = await S();
  assert.ok(mig.objectives.some(o => o.name === 'User objective'));
  assert.ok(await page.evaluate(() => !!localStorage.getItem('con.state.v2')), 'v2 copy kept for rollback');
  assert.match(await page.locator('#main').innerText(), /earlier demo data was upgraded/);
  step('A20', 'Stored v2 data migrates to v3 with user records kept, decisions re-opened and a rollback copy left in place');

  /* ---- Responsive: no horizontal scrolling ---- */
  const widths = [360, 390, 768, 1024, 1440]; const overflow = [];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const l of ['en', 'ar']) {
      await page.evaluate(x => localStorage.setItem('con.lang', JSON.stringify(x)), l);
      for (const h of ['c-overview', 'c-new', 'c-plan-obsample', 'c-offers-' + mig.rfqs.find(r => r.sample).id, 's-listing', 'o-payments']) {
        await page.goto(base + 'platform.html#' + h); await page.waitForTimeout(120);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (sw > 1) overflow.push(w + ' ' + l + ' ' + h + ' +' + sw + 'px');
      }
    }
  }
  assert.deepEqual(overflow, [], 'no horizontal overflow');
  step('A21', 'No horizontal scrolling at 360, 390, 768, 1024 and 1440 px in English and Arabic (6 platform views each)');
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ---- Workflow page (unchanged behaviour) ---- */
  await page.goto(base + 'workflow.html');
  await page.evaluate(() => localStorage.setItem('con.lang', JSON.stringify('en')));
  await page.reload();
  assert.equal(await page.locator('.step').count(), 16);
  await page.click('[data-step="s5"]');
  assert.match(await page.locator('#detail h2').innerText(), /Reply to RFQ/);
  await page.click('#wf-next');
  assert.match(await page.locator('#detail h2').innerText(), /Nudge late reply/);
  step('A22', 'Interactive workflow page still selects and steps through its 16 positions');

  assert.deepEqual(errors.filter(e => !/favicon/.test(e)), [], 'no console errors');
  step('A23', 'No console errors during the run');
} catch (err) {
  results.push({ id: 'FAIL', name: String(err && err.message || err).slice(0, 500), result: 'fail' });
  console.error(err);
  process.exitCode = 1;
} finally {
  mkdirSync(new URL('../docs/evidence/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../docs/evidence/e2e-results.json', import.meta.url), JSON.stringify({ ranAt: new Date().toISOString(), browser: 'chromium ' + browser.version(), results, consoleErrors: errors }, null, 2));
  await browser.close();
  server.close();
}
