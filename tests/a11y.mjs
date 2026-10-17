// Automated accessibility scan (axe-core, WCAG 2.1 A/AA rules) of main pages and platform views in English and Arabic.
// An automated scan finds only part of the issues; see docs/MANUAL_CHECKLIST.md for keyboard and screen-reader checks.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from '../scripts/preview.mjs';
const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const server = createServer(); await new Promise(r => server.listen(4179, '127.0.0.1', r));
const base = 'http://127.0.0.1:4179/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, bypassCSP: true }); // only so the scanner script can be injected
const targets = ['index.html', 'workflow.html', 'privacy.html', 'terms.html', '404-test', 'platform.html#c-overview', 'platform.html#c-new', 'platform.html#c-plan-obsample', 'platform.html#c-catalog', 'platform.html#s-listing', 'platform.html#s-profile', 'platform.html#o-payments', 'platform.html#o-verify'];
const report = { ranAt: new Date().toISOString(), axe: null, results: [] };
await page.emulateMedia({ reducedMotion: 'reduce' }); // scan the settled page, not mid-animation
await page.goto(base + 'platform.html'); await page.evaluate(() => localStorage.clear());
for (const lang of ['en', 'ar']) for (const t of targets) {
  await page.goto(base + 'index.html'); await page.evaluate(l => localStorage.setItem('con.lang', JSON.stringify(l)), lang);
  await page.goto(base + t); await page.waitForTimeout(400); await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in', 'is-visible', 'visible')));
  await page.addScriptTag({ content: axe });
  const r = await page.evaluate(async () => { const x = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }); return { version: window.axe.version, v: x.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + ((n.any[0] || {}).data ? JSON.stringify({ fg: n.any[0].data.fgColor, bg: n.any[0].data.bgColor, r: n.any[0].data.contrastRatio, need: n.any[0].data.expectedContrastRatio }) : '')) })) }; });
  report.axe = r.version;
  report.results.push({ lang, page: t, violations: r.v });
  console.log((r.v.length ? '✗ ' : '✓ ') + lang + ' ' + t + (r.v.length ? ' — ' + r.v.map(v => v.id + '(' + v.nodes + ')').join(', ') : ''));
}
writeFileSync(new URL('../docs/evidence/a11y-axe.json', import.meta.url), JSON.stringify(report, null, 2));
await browser.close(); server.close();
if (report.results.some(r => r.violations.length)) process.exitCode = 1;
