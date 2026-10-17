// Captures screenshots of key screens. Usage: PREFIX=before node tests/repro/screens.mjs [baseUrl]
import { chromium } from 'playwright';
import { createServer } from '../../scripts/preview.mjs';
// Without a base URL, serve the current dist/ on a local port for the duration of the run.
const server = process.argv[2] ? null : createServer();
if (server) await new Promise(r => server.listen(4183, '127.0.0.1', r));
const base = process.argv[2] || 'http://127.0.0.1:4183/';
const prefix = process.env.PREFIX || 'after';
const dir = new URL('../../docs/screenshots/', import.meta.url).pathname;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base + 'platform.html#c-overview'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(500);
const shot = async (name, hash, prep) => { await page.goto(base + hash); await page.waitForTimeout(600); if (prep) await prep(); await page.screenshot({ path: dir + prefix + '-' + name + '.png', fullPage: false }); };
await shot('new-objective', 'platform.html#c-new');
await shot('plan', 'platform.html#c-plan-obsample');
const rfq = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('con.state')))).rfqs.find(r => r.status === 'open').id);
await shot('offers', 'platform.html#c-offers-' + rfq, async () => { await page.evaluate(() => window.scrollTo(0, 700)); });
const bk = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('con.state')))).bookings[0].id);
await shot('booking', 'platform.html#c-booking-' + bk);
await shot('listing-form', 'platform.html#s-listing');
await shot('verification', 'platform.html#s-profile');
await shot('ops-metrics', 'platform.html#o-metrics');
// Early access: fictional details (example.test), submitted locally. Nothing is sent; the page only prepares an email.
await page.emulateMedia({ reducedMotion: 'reduce' });
await shot('home-early-access', 'index.html', async () => {
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
  await page.fill('#ct-name', 'Test Person'); await page.fill('#ct-company', 'Example Trading LLC'); await page.fill('#ct-email', 'person@example.test');
  await page.click('#contact-form [type="submit"]'); await page.waitForTimeout(300);
  await page.evaluate(() => { const el = document.getElementById('contact-done'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 140); });
  await page.waitForTimeout(300);
});
await page.setViewportSize({ width: 390, height: 844 });
await shot('mobile-plan', 'platform.html#c-plan-obsample');
await browser.close();
if (server) server.close();
console.log('saved', prefix);
