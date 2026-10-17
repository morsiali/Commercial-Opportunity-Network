// Local lab measurements: transfer size, request count, DOMContentLoaded, load and largest contentful
// paint for each page, served from this machine without network throttling. These are not Lighthouse
// scores and not field Core Web Vitals; they are a baseline to compare before and after a change.
// Run: npm run perf
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from '../scripts/preview.mjs';

const server = createServer();
await new Promise(r => server.listen(4182, '127.0.0.1', r));
const base = 'http://127.0.0.1:4182/';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pages = ['index.html', 'workflow.html', 'privacy.html', 'platform.html#c-overview', 'platform.html#c-plan-obsample'];
const RUNS = 5;
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const out = [];

for (const p of pages) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    let bytes = 0, requests = 0;
    page.on('response', async res => { requests++; try { bytes += (await res.body()).length; } catch { /* redirects have no body */ } });
    await page.addInitScript(() => { window.__lcp = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); });
    await page.goto(base + p, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, lcp: window.__lcp, domNodes: document.getElementsByTagName('*').length }; });
    runs.push({ ...m, bytes, requests });
    await ctx.close();
  }
  const r = { page: p, runs: RUNS, medianMs: { domContentLoaded: Math.round(median(runs.map(x => x.dcl))), load: Math.round(median(runs.map(x => x.load))), largestContentfulPaint: Math.round(median(runs.map(x => x.lcp))) }, transferKB: Math.round(median(runs.map(x => x.bytes)) / 102.4) / 10, requests: median(runs.map(x => x.requests)), domNodes: median(runs.map(x => x.domNodes)) };
  out.push(r);
  console.log(p.padEnd(32) + ' ' + String(r.transferKB).padStart(7) + ' KB  ' + String(r.requests).padStart(3) + ' req  DCL ' + r.medianMs.domContentLoaded + ' ms  load ' + r.medianMs.load + ' ms  LCP ' + r.medianMs.largestContentfulPaint + ' ms  ' + r.domNodes + ' nodes');
}
await browser.close(); server.close();

const assets = [];
const walk = d => readdirSync(d, { withFileTypes: true }).forEach(e => { const f = join(d, e.name); if (e.isDirectory()) walk(f); else assets.push({ file: f.replace(/^dist\//, ''), kb: Math.round(statSync(f).size / 102.4) / 10 }); });
walk('dist/assets');
assets.sort((a, b) => b.kb - a.kb);
mkdirSync('docs/evidence', { recursive: true });
writeFileSync('docs/evidence/perf.json', JSON.stringify({ ranAt: new Date().toISOString(), method: 'Headless Chromium, local server, no throttling, no compression, median of ' + RUNS + ' cold loads. Not Lighthouse and not field data.', pages: out, largestAssets: assets.slice(0, 12) }, null, 2));
