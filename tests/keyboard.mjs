// Scripted keyboard walk: Tab through every page in English and Arabic and record what receives focus.
// It checks that each focus stop is visible, has a name and shows a focus indicator, that the skip
// link is first and moves focus to the main content, and that Tab never gets stuck.
// This supports, but does not replace, the human keyboard check in docs/MANUAL_CHECKLIST.md.
// Run: npm run test:keyboard
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from '../scripts/preview.mjs';

const server = createServer();
await new Promise(r => server.listen(4180, '127.0.0.1', r));
const base = 'http://127.0.0.1:4180/';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pages = ['index.html', 'workflow.html', 'privacy.html', 'terms.html', 'platform.html#c-overview', 'platform.html#c-new', 'platform.html#c-plan-obsample', 'platform.html#c-catalog', 'platform.html#s-listing', 'platform.html#o-payments'];
const MAX = 400;
const out = [];
let failures = 0;

for (const lang of ['en', 'ar']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + 'index.html');
  await page.evaluate(l => { localStorage.clear(); localStorage.setItem('con.lang', l); }, lang);
  for (const p of pages) {
    await page.goto(base + p); await page.waitForTimeout(350);
    // Measure the settled focus style: some controls animate `all` properties, and a headless browser
    // without painted frames can report the starting value of an unfinished transition.
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' }).catch(() => {});
    const problems = [];
    const seen = [];
    let stuck = 0, last = null;
    // The platform moves focus to the view heading on each route change, so start the walk from the top.
    const firstIsSkip = await page.evaluate(() => { const f = document.querySelector('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'); return !!f && (f.classList.contains('skip-link')); });
    if (!firstIsSkip) problems.push('first focusable element is not the skip link');
    await page.evaluate(() => { const a = document.querySelector('.skip-link'); if (a) a.focus(); });
    for (let i = 0; i < MAX; i++) {
      if (i > 0) await page.keyboard.press('Tab');
      await page.waitForTimeout(20);
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { body: true };
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || (el.labels && el.labels[0] && el.labels[0].innerText) || (el.id && document.querySelector('label[for="' + el.id + '"]')?.innerText) || el.getAttribute('placeholder') || '').trim().slice(0, 60);
        const hasRing = c => (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (c.boxShadow && c.boxShadow !== 'none');
        // Visually hidden radios and checkboxes draw their focus ring on the next sibling (the visible pill).
        const sib = el.matches('input[type="radio"], input[type="checkbox"]') && el.nextElementSibling;
        const ring = hasRing(cs) || (sib && hasRing(getComputedStyle(sib)));
        const key = el.tagName + '#' + (el.id || '') + '.' + (el.getAttribute('data-act') || el.getAttribute('href') || el.name || '') + '@' + Math.round(r.top + scrollY) + ',' + Math.round(r.left);
        const dbg = [el.matches(':focus-visible'), cs.outlineStyle, cs.outlineWidth, cs.boxShadow.slice(0, 30), cs.transitionProperty.slice(0, 40), cs.transitionDuration].join('/');
        return { dbg, type: el.type || '', key, tag: el.tagName.toLowerCase(), name, ring, visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', inModal: !!document.getElementById('modal-root')?.contains(el), skip: el.classList.contains('skip-link') || el.classList.contains('skip') };
      });
      if (f.body) break;
      if (f.key === last) { stuck++; if (stuck > (f.type === 'date' ? 4 : 2)) { problems.push('focus stuck on ' + f.key); break; } continue; } else stuck = 0; // date fields have day/month/year stops
      last = f.key;
      if (seen.length && seen[0].key === f.key) break; // wrapped round
      seen.push(f);
      if (!f.visible) problems.push('invisible focus stop: ' + f.key);
      if (!f.name) problems.push('focus stop without a name: ' + f.key);
      if (!f.ring) problems.push('no focus indicator: ' + f.key + ' ' + f.dbg);
    }
    // Skip link: from the top, Tab then Enter should move focus into <main>.
    await page.goto(base + p); await page.waitForTimeout(250);
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
    const skipOk = await page.evaluate(() => { const m = document.querySelector('main'); return !!m && (m === document.activeElement || m.contains(document.activeElement) || location.hash.length > 1); });
    if (!skipOk) problems.push('skip link does not move focus to main');
    if (problems.length) failures++;
    out.push({ lang, page: p, stops: seen.length, skipOk, problems: [...new Set(problems)].slice(0, 20) });
    console.log((problems.length ? '✗ ' : '✓ ') + lang + ' ' + p + ' — ' + seen.length + ' focus stops' + (problems.length ? ' — ' + [...new Set(problems)].slice(0, 3).join('; ') : ''));
  }
  await ctx.close();
}
await browser.close(); server.close();
mkdirSync('docs/evidence', { recursive: true });
writeFileSync('docs/evidence/keyboard-walk.json', JSON.stringify({ ranAt: new Date().toISOString(), note: 'Scripted Tab walk in headless Chromium. A person still has to do the manual keyboard check (docs/MANUAL_CHECKLIST.md).', results: out }, null, 2));
process.exitCode = failures ? 1 : 0;
