// Static checks: required files, internal links, platform routes and translation coverage.
import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
let failures = 0;
const ok = msg => console.log('✓ ' + msg);
const fail = msg => { failures++; console.error('✗ ' + msg); };

const pages = (await readdir(dist)).filter(f => f.endsWith('.html'));
const required = ['index.html', 'platform.html', 'privacy.html', 'terms.html', 'favicon.svg', 'assets/css/base.css', 'assets/css/site.css', 'assets/css/app.css'];
for (const f of required) { try { await access(join(dist, f)); } catch { fail('Missing ' + f); } }
ok(`${required.length} required files present`);

// Load browser scripts into a sandbox to read dictionaries
const ctx = { window: {}, console };
ctx.globalThis = ctx.window; vm.createContext(ctx);
for (const f of ['data.js', 'engine.js', 'i18n-site.js', 'i18n-app.js']) vm.runInContext(await readFile(join(dist, 'assets/js', f), 'utf8'), ctx, { filename: f });
const CON = ctx.window.CON;

// Views and routes
const viewSrc = (await Promise.all(['views-customer.js', 'views-supplier.js', 'views-ops.js'].map(f => readFile(join(dist, 'assets/js', f), 'utf8')))).join('\n');
const routes = new Set([...viewSrc.matchAll(/V\.([cso])\.(\w+) = function/g)].map(m => m[1] + '-' + m[2]));
routes.add('c-edit');

// Links in every page
let links = 0;
for (const page of pages) {
  const html = await readFile(join(dist, page), 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const href = m[1]; links++;
    if (/^(https?:|mailto:|tel:|data:)/.test(href)) continue;
    if (href === '#' || href === '') { fail(`${page}: empty link`); continue; }
    const [file, hash] = href.split('#');
    if (file) { try { await access(join(dist, file)); } catch { fail(`${page}: broken link ${href}`); continue; } }
    if (hash) {
      if ((file || page) === 'platform.html' && hash === 'main' && !file) continue; // skip link, handled in app.js
      if ((file || page) === 'platform.html') {
        const r = hash.match(/^([cso])-([a-z]+)/);
        if (!r || !routes.has(r[1] + '-' + r[2])) fail(`${page}: unknown platform route #${hash}`);
      } else {
        const target = file ? await readFile(join(dist, file), 'utf8') : html;
        if (!new RegExp(`\\sid="${hash}"`).test(target)) fail(`${page}: missing anchor #${hash}`);
      }
    }
  }
  // Static translation keys
  for (const m of html.matchAll(/data-i18n(?:-ph|-aria)?="([^"]+)"/g)) if (CON.SITE_AR[m[1]] == null) fail(`${page}: no Arabic text for "${m[1]}"`);
}
ok(`${links} links and assets checked across ${pages.length} pages`);

// App dictionary parity
const { en, ar } = CON.APP_STR;
const missingAr = Object.keys(en).filter(k => ar[k] == null);
const missingEn = Object.keys(ar).filter(k => en[k] == null);
if (missingAr.length) fail('Arabic missing app keys: ' + missingAr.join(', '));
if (missingEn.length) fail('English missing app keys: ' + missingEn.join(', '));
const appSrc = viewSrc + (await readFile(join(dist, 'assets/js/app-core.js'), 'utf8')) + (await readFile(join(dist, 'assets/js/app.js'), 'utf8'));
const literal = [...new Set([...appSrc.matchAll(/\bt\('([a-zA-Z0-9_.]+)'[,)]/g)].map(m => m[1]))];
const unknown = literal.filter(k => en[k] == null);
if (unknown.length) fail('Untranslated keys used in code: ' + unknown.join(', '));
ok(`${Object.keys(en).length} app strings in English and Arabic; ${literal.length} literal keys resolved`);

// Dynamic key families
const D = CON.DATA;
const fam = [
  ...D.types.flatMap(x => ['type.' + x, 'expect.' + x]), ...D.objectives.map(x => 'obj.' + x), ...D.interests.map(x => 'int.' + x),
  ...['objective', 'audience', 'geography', 'budget', 'timing', 'availability', 'evidence', 'confidence'].map(x => 'f.' + x),
  ...['day', 'week', 'month', 'activation'].map(x => 'unit.' + x), ...['balanced', 'lean', 'diverse'].flatMap(x => ['pkg.' + x, 'pkg.' + x + '.tag', 'pkg.' + x + '.d']),
  ...['r.obj.high', 'r.obj.mid', 'r.obj.low', 'r.aud', 'r.geo.in', 'r.geo.near', 'r.geo.out', 'r.geo.all', 'r.geo.city', 'r.bud', 'r.bud.unknown', 'r.time.full', 'r.time.partial', 'r.time.none', 'r.avail', 'r.avail.none', 'r.ev.verified', 'r.ev.declared', 'r.ev.reach', 'r.ev.none', 'r.conf'],
  ...['price', 'over', 'share', 'lead', 'partial', 'limited', 'noev', 'unverified'].map(x => 'risk.' + x),
  ...['confirmed', 'preparing', 'live', 'completed', 'delivered'].map(x => 'bk.' + x), ...['awaiting', 'offered', 'declined'].map(x => 'line.' + x),
  ...['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map(x => 'kill.' + x), ...['go', 'nogo', 'wait'].flatMap(x => ['kill.v.' + x, 'kill.vd.' + x])
];
const famMissing = fam.filter(k => en[k] == null || ar[k] == null);
if (famMissing.length) fail('Missing dynamic keys: ' + famMissing.join(', ')); else ok(`${fam.length} dynamic keys present in both languages`);

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll static checks passed');
