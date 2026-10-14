// End-to-end flow test in a real browser: npm i && npx playwright install chromium && npm run test:e2e
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from '../scripts/preview.mjs';

const server = createServer();
await new Promise(r => server.listen(4177, '127.0.0.1', r));
const base = 'http://127.0.0.1:4177/';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const step = (name) => console.log('✓ ' + name);
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('con.state.v2')));

try {
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Website brief wizard → plan
  await page.click('label.obj:has(input[value="acquisition"])');
  await page.fill('#wz-product', 'Oat milk');
  await page.click('[data-wz-next]');
  await page.click('[data-wz-next]');
  await page.fill('#wz-budget', '80000');
  await page.click('[data-wz-next]');
  await page.waitForURL('**/platform.html#c-plan-*');
  assert.ok(await page.locator('.rec').count() > 0);
  step('website brief creates a ranked plan');

  // Package → RFQ (make sure the supplier we act as is included)
  await page.click('[data-act="plan-tab"][data-tab="pkg"]');
  await page.click('[data-act="use-pkg"] >> nth=0');
  const s0 = await state();
  const obj = s0.objectives[0];
  if (!obj.selected.includes('o4')) {
    await page.evaluate((id) => { const s = JSON.parse(localStorage.getItem('con.state.v2')); s.objectives.find(o => o.id === id).selected.push('o4'); localStorage.setItem('con.state.v2', JSON.stringify(s)); }, obj.id);
    await page.reload();
  }
  await page.click('[data-act="plan-tab"][data-tab="rec"]').catch(() => {});
  await page.goto(base + 'platform.html#c-rfq-' + obj.id);
  await page.click('form[data-form="rfq"] button[type="submit"]');
  await page.waitForURL('**#c-offers-*');
  const rfqId = page.url().split('#c-offers-')[1];
  step('RFQ generated and sent');

  // Simulated replies + supplier reply
  await page.waitForTimeout(9000);
  await page.goto(base + 'platform.html#s-respond-' + rfqId);
  const forms = await page.locator('form[data-form="respond"]').count();
  assert.ok(forms >= 1, 'supplier has an RFQ to answer');
  for (let i = 0; i < forms; i++) await page.locator('form[data-form="respond"] button[type="submit"]').first().click();
  step('supplier replied with a structured offer');

  // Compare, approve, checkout
  await page.goto(base + 'platform.html#c-offers-' + rfqId);
  const approve = page.locator('[data-act="approve"]');
  assert.ok(await approve.count() >= 2, 'at least two offers to compare');
  await approve.nth(0).check(); await approve.nth(1).check();
  await page.click('.selbar a.btn-blue');
  await page.click('form[data-form="checkout"] button[type="submit"]');
  assert.match(await page.locator('[data-error]').innerText(), /email/i);
  await page.fill('#co-email', 'finance@example.ae');
  await page.check('input[name="ack"]');
  await page.click('form[data-form="checkout"] button[type="submit"]');
  await page.waitForURL('**#c-bookings');
  const s1 = await state();
  const bookings = s1.bookings.filter(b => b.rfqId === rfqId);
  assert.equal(bookings.length, 2);
  step('offers normalised, approved and paid (simulated)');

  // Supplier executes and reports; buyer confirms; operations releases payout
  const bk = bookings.find(b => b.supplierId === 's1') || bookings[0];
  await page.evaluate((sid) => { const s = JSON.parse(localStorage.getItem('con.state.v2')); s.activeSupplierId = sid; localStorage.setItem('con.state.v2', JSON.stringify(s)); }, bk.supplierId);
  await page.goto(base + 'platform.html#s-booking-' + bk.id); await page.reload();
  for (let i = 0; i < 3; i++) await page.click('[data-act="advance"]');
  await page.fill('form[data-form="report"] input[name="name"]', 'Samples handed out');
  await page.fill('form[data-form="report"] input[name="value"]', '2100');
  await page.click('form[data-form="report"] button[type="submit"]');
  await page.goto(base + 'platform.html#c-booking-' + bk.id);
  await page.click('[data-act="confirm"]'); await page.click('[data-act="deliver"]');
  await page.fill('#out-n', '120'); await page.click('form[data-form="outcome"] button[type="submit"]');
  await page.goto(base + 'platform.html#o-payments');
  await page.click('[data-act="release"] >> nth=0');
  const s2 = await state();
  assert.equal(s2.bookings.find(b => b.id === bk.id).payout, 'released');
  step('execution tracked, results reported, payout released');

  // Arabic / RTL
  await page.click('[data-act="lang"]');
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  step('Arabic right-to-left layout');

  // Interactive workflow page
  await page.goto(base + 'workflow.html');
  await page.evaluate(() => localStorage.setItem('con.lang', JSON.stringify('en')));
  await page.reload();
  assert.equal(await page.locator('.step').count(), 16);
  assert.ok(await page.locator('#wire-g path').count() >= 14, 'connectors drawn');
  await page.click('[data-step="s5"]');
  assert.match(await page.locator('#detail h2').innerText(), /Reply to RFQ/);
  await page.click('#wf-next');
  assert.match(await page.locator('#detail h2').innerText(), /Nudge late reply/);
  await page.click('#role-chips [data-role="supplier"]');
  assert.equal(await page.locator('.step.dim').count(), 12);
  await page.click('#role-chips [data-role="all"]');
  await page.click('#status-tabs [data-record="payout"]');
  await page.click('.status-chip:has-text("Released")');
  assert.match(await page.locator('#detail h2').innerText(), /Release payout/);
  await page.click('#wf-play'); await page.waitForTimeout(5000);
  assert.match(await page.locator('#detail h2').innerText(), /Weekly review/);
  assert.equal(await page.locator('#wf-play').getAttribute('aria-pressed'), 'false', 'play stops at the last step');
  await page.click('#detail [data-nav="-1"]');
  assert.match(await page.locator('#detail h2').innerText(), /Release payout/);
  step('interactive workflow: select, next, filter, status explorer, play');

  assert.deepEqual(errors, [], 'no console errors');
  step('no console errors');
} finally {
  await browser.close();
  server.close();
}
