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
const ctx = { window: { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } }, console, Intl, Date, BigInt, Number, Math, JSON, Object, Array, Set, String, RegExp, Error };
ctx.globalThis = ctx.window; vm.createContext(ctx);
for (const f of ['common.js', 'core/dates.js', 'core/money.js', 'core/states.js', 'core/migrate.js', 'data.js', 'core/parse.js', 'engine.js', 'core/inventory.js', 'core/offers.js', 'core/domain.js', 'i18n-site.js', 'i18n-app.js', 'i18n-app3.js']) vm.runInContext(await readFile(join(dist, 'assets/js', f), 'utf8'), ctx, { filename: f });
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
    if (href.startsWith('/Commercial-Opportunity-Network/')) { try { await access(join(dist, href.replace('/Commercial-Opportunity-Network/', '').split('#')[0])); } catch { fail(`${page}: broken link ${href}`); } continue; }
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

// Dynamic key families (v3)
const D = CON.DATA;
const E = CON.Engine;
const coreSrc = (await Promise.all(['core/domain.js', 'core/offers.js', 'core/inventory.js', 'core/states.js', 'engine.js', 'core/parse.js'].map(f => readFile(join(dist, 'assets/js', f), 'utf8')))).join('\n');
const errCodes = [...new Set([...coreSrc.matchAll(/(?:DomainError|need)\([^']*'([A-Z_]+)'/g)].map(m => m[1]))].filter(c => !['STATE_UNKNOWN', 'STATE_UNKNOWN_MACHINE', 'DISPUTE_OUTCOME_INVALID', 'PAYMENT_EVENT_ID_REQUIRED', 'PAYMENT_EVENT_UNKNOWN', 'RESERVATION_NOT_FOUND', 'RFQ_LINE_NOT_FOUND', 'VERIFICATION_DECISION_INVALID', 'LISTING_STATUS_INVALID', 'PAYOUT_NOT_FOUND', 'BOOKING_NOT_FOUND', 'PAYMENT_NOT_FOUND', 'REFUND_NOT_FOUND', 'DISPUTE_NOT_FOUND', 'RFQ_NOT_FOUND', 'OBJECTIVE_NOT_FOUND', 'SUPPLIER_NOT_FOUND'].includes(c));
const eCodes = [...new Set([...coreSrc.matchAll(/'(e\.[a-z_]+\.[a-z_]+|r\.[a-z]+(?:\.[a-z]+)?|risk\.[a-z]+)'/g)].map(m => m[1]))];
const notes = [...new Set([...coreSrc.matchAll(/push\('\w+', [^;]*?'(?:recognized|review|confirm|conflict|ambiguous|invalid|past|derived)', '([a-z-]+)'/g)].map(m => m[1]))];
const STATES = CON.States.MACHINES;
const fam = [
  ...D.types.flatMap(x => ['type.' + x, 'expect.' + x]), ...D.objectives.map(x => 'obj.' + x), ...D.interests.map(x => 'int.' + x),
  ...E.FACTORS.map(x => 'f.' + x), ...['day', 'week', 'month', 'activation'].flatMap(x => ['unit.' + x, 'uw.' + x]), ...['balanced', 'lean', 'diverse'].flatMap(x => ['pkg.' + x, 'pkg.' + x + '.tag', 'pkg.' + x + '.d']),
  ...eCodes, ...errCodes.map(c => 'err.code.' + c),
  ...Object.keys(STATES.booking).map(x => 'bk.' + x), ...['cancelled', 'expired', 'refunded', 'disputed'].map(x => 'bk.' + x + '.d'),
  ...Object.keys(STATES.offer).map(x => 'line.' + x), ...Object.keys(STATES.payment).map(x => 'pay.' + x), ...Object.keys(STATES.payout).map(x => 'payout.' + x),
  ...Object.keys(STATES.rfq).map(x => 'rfq.' + x), ...Object.keys(STATES.dispute).map(x => 'dsp.' + x), ...Object.keys(STATES.refund).map(x => 'rf.' + x), ...['active', 'paused', 'archived'].map(x => 'opp.' + x),
  ...['payment_received', 'delivery_accepted', 'no_open_dispute', 'no_refund_outstanding', 'supplier_licence_reviewed'].map(x => 'guard.' + x),
  ...['coverage', 'dates', 'price', 'reporting', 'deliverables'].map(x => 'dev.' + x), ...['full', 'partial', 'none', 'event', 'event-tbc'].map(x => 'covs.' + x),
  ...['verified', 'reviewed', 'declared', 'insufficient'].map(x => 'evl.' + x), ...['business', 'completeness', 'audience', 'availability', 'delivery', 'outcome'].map(x => 'evd.' + x),
  ...['licence_reviewed', 'submitted', 'rejected', 'not_submitted', 'info_requested', 'not_reviewed'].map(x => 'evb.' + x), ...['fresh', 'stale', 'unknown'].map(x => 'eva.' + x),
  ...['counted', 'system', 'estimated'].flatMap(x => ['evm.' + x, 'meth.' + x]), ...['platform_review', 'supplier_declared'].map(x => 'evs.' + x), ...E.METRICS.map(x => 'evmet.' + x),
  ...['day', 'week', 'month', 'event', 'total'].map(x => 'per.' + x), ...['open', 'female_only', 'male_only', 'members_only'].map(x => 'acc.' + x), ...E.CATEGORIES.map(x => 'pc.' + x),
  ...E.FACILITIES.concat(['staffingProvided']).map(x => 'fac.' + x), ...[0, 1, 2, 3, 4, 5, 6].map(x => 'wd.' + x),
  ...['recognized', 'review', 'confirm', 'conflict', 'ambiguous', 'invalid', 'past', 'derived'].map(x => 'xs.' + x), ...notes.map(x => 'xn.' + x),
  ...['LISTING_CHANGED_SINCE_OFFER', 'OFFER_NOTICE_SHORT', 'SUPPLIER_NOT_REVIEWED'].map(x => 'warn.' + x), ...['demo-sample', 'local-only', 'server'].map(x => 'stor.' + x),
  ...['card', 'transfer'].flatMap(x => ['pm.' + x, 'pm.' + x + '.d3']), ...['full', 'split'].map(x => 'terms.' + x), ...['basic', 'detailed', 'none'].map(x => 'rep.' + x),
  ...['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map(x => 'kill.' + x), ...['go', 'nogo', 'wait'].flatMap(x => ['kill.v.' + x, 'kill.vd.' + x])
];
const famMissing = fam.filter(k => en[k] == null || ar[k] == null);
if (famMissing.length) fail('Missing dynamic keys: ' + famMissing.join(', ')); else ok(`${fam.length} dynamic keys present in both languages`);

// No fixed tax or fee percentages in user-facing strings (they must come from configuration)
const pctRe = /(?:^|[^\d.])[57]\s?%|[٥٧]\s?٪/;
const strBad = Object.entries(en).concat(Object.entries(ar)).filter(([, v]) => typeof v === 'string' && pctRe.test(v)).map(([k]) => k);
const siteBad = Object.entries(CON.SITE_AR).filter(([, v]) => pctRe.test(String(v).replace(/<span data-(fee|vat)>[^<]*<\/span>/g, ''))).map(([k]) => k);
let htmlBad = [];
for (const page of pages) { const html = (await readFile(join(dist, page), 'utf8')).replace(/<span data-(fee|vat)>[^<]*<\/span>/g, ''); if (pctRe.test(html.replace(/<[^>]+>/g, ' '))) htmlBad.push(page); }
if (strBad.length || siteBad.length || htmlBad.length) fail('Fixed fee/VAT percentages in copy: ' + strBad.concat(siteBad, htmlBad).join(', ')); else ok('Fee and VAT percentages in copy come from configuration');

// Head metadata and crawl files
for (const page of pages) {
  const html = await readFile(join(dist, page), 'utf8');
  if (!/http-equiv="Content-Security-Policy"/.test(html)) fail(page + ': no Content-Security-Policy');
  if (!/<meta name="description" content="[^"]{20,}">/.test(html)) fail(page + ': no description');
  if (page !== '404.html' && !/<link rel="canonical"/.test(html)) fail(page + ': no canonical link');
  if ((page === 'platform.html' || page === '404.html') && !/name="robots" content="noindex"/.test(html)) fail(page + ': should be noindex');
}
for (const f of ['robots.txt', 'sitemap.xml', '404.html', 'assets/og-image.png']) { try { await access(join(dist, f)); } catch { fail('Missing ' + f); } }
ok('CSP, descriptions, canonical links, noindex, robots.txt, sitemap.xml and 404 page present');

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll static checks passed');
