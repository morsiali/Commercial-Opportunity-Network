// Live-mode JSON API built on node:http and the shared domain modules.
// Every state change runs inside store.transact (serialised), goes through CON.Domain rules and is audited.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { Domain, Engine, Dates, States, Money } from './core.mjs';
import { hashPassword, verifyPassword, signToken, verifyToken, rateLimiter } from './auth.mjs';
import { paymentsAdapter, payoutsAdapter, notificationsAdapter, scannerAdapter, documentStore, sniffType, NotConfigured } from './adapters.mjs';

const JSON_LIMIT = 100 * 1024;
const UPLOAD_LIMIT = Domain.DOC_MAX_BYTES;
const uid = p => p + '_' + randomBytes(9).toString('base64url');

class HttpError extends Error { constructor(status, code, details) { super(code); this.status = status; this.code = code; this.details = details || {}; } }
function statusFor(code) {
  if (code === 'FORBIDDEN') return 403;
  if (/_NOT_FOUND$/.test(code)) return 404;
  if (/_NOT_CONFIGURED$/.test(code)) return 503;
  if (/(_INVALID|_REQUIRED|_INCOMPLETE|_EMPTY|_WEAK|_MISMATCH)$/.test(code) || code === 'OFFER_INVALID' || code === 'IDEMPOTENCY_KEY_REQUIRED') return 422;
  return 409; // rule or state conflicts
}

const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer',
  'cache-control': 'no-store', 'cross-origin-resource-policy': 'same-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

export function createApp({ store, env, adapters }) {
  const E = env || {};
  if (!E.AUTH_SECRET || E.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must be set to at least 32 characters (see .env.example)');
  const payments = paymentsAdapter(E), payouts = (adapters && adapters.payouts) || payoutsAdapter(E), notify = notificationsAdapter(E), scanner = scannerAdapter(E), docs = documentStore(E);
  const loginLimit = rateLimiter(Number(E.LOGIN_RATE_LIMIT || 10), 15 * 60 * 1000);
  const registerLimit = rateLimiter(Number(E.REGISTER_RATE_LIMIT || 20), 60 * 60 * 1000);
  const hsts = E.HSTS === '1';

  function send(res, status, body) {
    const h = Object.assign({ 'content-type': 'application/json; charset=utf-8' }, SECURITY_HEADERS);
    if (hsts) h['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
    res.writeHead(status, h); res.end(JSON.stringify(body));
  }
  /* Reads a body up to `limit` bytes. Oversized bodies are drained (up to a hard cap) and answered with 413,
     so well-behaved clients get a clean response; a reverse proxy should enforce limits as well. */
  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const declared = Number(req.headers['content-length'] || 0);
      if (declared > limit * 8) { reject(new HttpError(413, 'BODY_TOO_LARGE', { limit })); req.on('error', () => {}); return; }
      const chunks = []; let n = 0; let over = false;
      req.on('data', c => { n += c.length; if (n > limit) { over = true; chunks.length = 0; if (n > limit * 8) req.destroy(); } else if (!over) chunks.push(c); });
      req.on('end', () => over ? reject(new HttpError(413, 'BODY_TOO_LARGE', { limit })) : resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  async function json(req) {
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) throw new HttpError(415, 'CONTENT_TYPE_JSON_REQUIRED');
    const buf = await readBody(req, JSON_LIMIT);
    try { const v = JSON.parse(buf.toString('utf8') || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; return v; } catch { throw new HttpError(400, 'JSON_INVALID'); }
  }
  const ip = req => (E.TRUST_PROXY === '1' && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '-';

  /* Who is calling: from the signed token, resolved against current users and memberships. */
  async function principal(req) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const p = m && verifyToken(m[1], E.AUTH_SECRET);
    if (!p) throw new HttpError(401, 'AUTH_REQUIRED');
    return store.read(st => {
      const user = st.users.find(u => u.id === p.uid && !u.disabled);
      if (!user) throw new HttpError(401, 'AUTH_REQUIRED');
      const mem = st.memberships.find(x => x.userId === user.id);
      const org = mem && st.orgs.find(o => o.id === mem.orgId);
      if (!org) throw new HttpError(403, 'FORBIDDEN', { reason: 'no_membership' });
      const role = org.type === 'ops' ? 'ops' : org.type === 'supplier' ? 'supplier' : 'customer';
      return { userId: user.id, email: user.email, role, orgId: org.id, supplierId: org.supplierId || null, membershipRole: mem.role };
    });
  }
  const ctxFor = (pr, extra) => { const now = new Date().toISOString(); return Object.assign({ role: pr.role, actor: 'user:' + pr.userId, orgId: pr.orgId, supplierId: pr.supplierId, mode: 'live', now, today: Dates.today(Dates.TZ_DEFAULT, now), money: {} }, extra || {}); };
  const sys = () => { const now = new Date().toISOString(); return { role: 'system', actor: 'system', mode: 'live', now, today: Dates.today(Dates.TZ_DEFAULT, now) }; };
  const need = (cond, status, code, details) => { if (!cond) throw new HttpError(status, code, details); };
  const ownerCheck = (pr, rec) => { if (pr.role === 'customer' && rec.orgId !== pr.orgId) throw new HttpError(404, 'NOT_FOUND'); };

  /* Views: what each role may see. */
  const view = {
    rfqFor(pr, r) {
      if (pr.role === 'ops') return r;
      if (pr.role === 'customer') return r.orgId === pr.orgId ? r : null;
      const lines = r.lines.filter(l => l.supplierId === pr.supplierId);
      if (!lines.length) return null;
      const out = Object.assign({}, r, { lines, orgId: undefined });
      if (r.shareBudget === false) delete out.budgetMinor;
      return out;
    },
    bookingFor(pr, b) { if (pr.role === 'ops') return b; if (pr.role === 'customer') return b.orgId === pr.orgId ? b : null; return b.supplierId === pr.supplierId ? Object.assign({}, b, { orgId: undefined }) : null; },
    paymentFor(pr, p) { if (pr.role === 'ops') return p; if (pr.role === 'customer') return p.orgId === pr.orgId ? p : null; return null; }
  };
  const audit = (st, entity, id, event, actor, reason, data) => States.audit(st.audit, entity, id, event, { at: new Date().toISOString(), actor, reason, data });

  const routes = [];
  const route = (method, pattern, handler) => { const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '$'); routes.push({ method, re, keys, handler }); };

  /* ---------- Health and auth ---------- */
  route('GET', '/api/health', async () => [200, { ok: true, mode: 'live', storage: store.kind, providers: { payments: payments.configured ? payments.name : 'not_configured', payouts: payouts.configured ? payouts.name : 'not_configured', notifications: 'not_configured', scanner: scanner.configured ? scanner.name : 'not_configured', documents: docs.configured ? 'configured' : 'not_configured' }, feeBps: Money.DEFAULTS.platformFeeBps, vatBps: Money.DEFAULTS.vatBps }]);
  route('POST', '/api/auth/register', async (req) => {
    need(registerLimit(ip(req)), 429, 'RATE_LIMITED');
    const b = await json(req);
    const email = String(b.email || '').trim().toLowerCase();
    need(/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 160, 422, 'EMAIL_INVALID');
    need(['customer', 'supplier'].includes(b.orgType), 422, 'ORG_TYPE_INVALID');
    const orgName = String(b.orgName || '').trim().slice(0, 120); need(orgName.length >= 2, 422, 'ORG_NAME_REQUIRED');
    let hash; try { hash = await hashPassword(b.password); } catch (e) { throw new HttpError(422, 'PASSWORD_WEAK', { min: 12 }); }
    const out = await store.transact(st => {
      need(!st.users.some(u => u.email === email), 409, 'EMAIL_TAKEN');
      const now = new Date().toISOString();
      const user = { id: uid('usr'), email, name: String(b.name || '').slice(0, 120), passwordHash: hash, createdAt: now };
      const org = { id: uid('org'), name: orgName, type: b.orgType, createdAt: now };
      if (b.orgType === 'supplier') {
        const lic = String(b.licenceNumber || '').trim();
        need(/^[A-Za-z0-9\-\/]{3,30}$/.test(lic), 422, 'LICENCE_NUMBER_INVALID');
        const sp = { v: 3, id: uid('sp'), orgId: org.id, name: { en: orgName, ar: String(b.orgNameAr || '').slice(0, 120) }, category: String(b.category || 'other'), emirate: 'Dubai', contact: email, joined: Dates.today(), licenceNumber: lic, vatRegistered: b.vatRegistered !== false,
          verification: { status: 'not_submitted', licenceExpiry: null, documents: [], decisions: [], reviewedSnapshot: null } };
        st.suppliers.push(sp); org.supplierId = sp.id;
      }
      st.users.push(user); st.orgs.push(org); st.memberships.push({ userId: user.id, orgId: org.id, role: 'owner', createdAt: now });
      audit(st, 'user', user.id, 'register', 'user:' + user.id, '', { orgType: b.orgType });
      return { userId: user.id };
    });
    return [201, { token: signToken({ uid: out.userId }, E.AUTH_SECRET, Number(E.TOKEN_TTL || 28800)) }];
  });
  route('POST', '/api/auth/login', async (req) => {
    const b = await json(req);
    const email = String(b.email || '').trim().toLowerCase();
    need(loginLimit(ip(req) + '|' + email), 429, 'RATE_LIMITED');
    const user = await store.read(st => st.users.find(u => u.email === email && !u.disabled));
    const ok = await verifyPassword(String(b.password || ''), user ? user.passwordHash : 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA');
    need(user && ok, 401, 'LOGIN_FAILED');
    return [200, { token: signToken({ uid: user.id }, E.AUTH_SECRET, Number(E.TOKEN_TTL || 28800)) }];
  });
  route('GET', '/api/me', async (req, pr) => [200, { userId: pr.userId, email: pr.email, role: pr.role, orgId: pr.orgId, supplierId: pr.supplierId }], { auth: true });

  /* ---------- Listings ---------- */
  const LISTING_FIELDS = ['type', 'area', 'title', 'desc', 'requirements', 'price', 'unit', 'setupFee', 'minUnits', 'maxUnits', 'availableFrom', 'availableTo', 'leadDays', 'schedule', 'eventDates', 'capacityPerDate', 'audience', 'restrictions', 'services'];
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
  route('GET', '/api/listings', async () => [200, await store.read(st => st.opportunities.filter(o => o.status === 'active').map(o => Object.assign({}, o, { baseBooked: undefined })))]);
  route('POST', '/api/listings', async (req, pr) => {
    need(pr.role === 'supplier', 403, 'FORBIDDEN');
    const b = await json(req);
    const op = Object.assign({ v: 3, id: uid('op'), supplierId: pr.supplierId, status: 'active', version: 1, baseBooked: 0, evidence: [], schedule: { days: [0, 1, 2, 3, 4, 5, 6] }, restrictions: {}, audience: { gender: 'mixed', access: 'open' }, title: { en: '', ar: '' }, desc: { en: '', ar: '' }, requirements: { en: '', ar: '' } }, pick(b, LISTING_FIELDS));
    return [201, await store.transact(st => Domain.saveListing(st, op, ctxFor(pr)))];
  }, { auth: true });
  route('PUT', '/api/listings/:id', async (req, pr, p) => {
    const b = await json(req);
    return [200, await store.transact(st => { const cur = st.opportunities.find(o => o.id === p.id); need(cur, 404, 'LISTING_NOT_FOUND'); return Domain.saveListing(st, Object.assign({}, cur, pick(b, LISTING_FIELDS)), ctxFor(pr)); })];
  }, { auth: true });
  route('DELETE', '/api/listings/:id', async (req, pr, p) => [200, await store.transact(st => Domain.removeListing(st, p.id, ctxFor(pr)))], { auth: true });
  route('POST', '/api/listings/:id/status', async (req, pr, p) => { const b = await json(req); return [200, await store.transact(st => Domain.setListingStatus(st, p.id, b.status, ctxFor(pr)))]; }, { auth: true });

  /* ---------- Objectives and plans ---------- */
  route('POST', '/api/objectives', async (req, pr) => {
    need(pr.role === 'customer', 403, 'FORBIDDEN');
    const b = await json(req);
    let budgetMinor = b.budgetMinor;
    if (budgetMinor == null && b.budget != null) { try { budgetMinor = Money.fromAED(String(b.budget)); } catch { throw new HttpError(422, 'BUDGET_INVALID'); } }
    need(Number.isSafeInteger(budgetMinor) && budgetMinor > 0, 422, 'BUDGET_INVALID');
    const today = Dates.today();
    need(Dates.isIso(b.start) && b.start >= today, 422, 'START_INVALID', { today });
    const o = Engine.normalizeObjective(Object.assign({}, b, { budgetMinor }), { today });
    const obj = Object.assign(o, { id: uid('ob'), orgId: pr.orgId, name: String(b.name || '').slice(0, 80) || 'Objective', createdAt: new Date().toISOString(), selected: [], source: 'api' });
    await store.transact(st => { st.objectives.unshift(obj); audit(st, 'objective', obj.id, 'create', 'user:' + pr.userId); });
    return [201, obj];
  }, { auth: true });
  route('GET', '/api/objectives', async (req, pr) => [200, await store.read(st => st.objectives.filter(o => pr.role === 'ops' || o.orgId === pr.orgId))], { auth: true });
  route('GET', '/api/objectives/:id/plan', async (req, pr, p) => [200, await store.read(st => {
    const o = st.objectives.find(x => x.id === p.id); need(o && (pr.role === 'ops' || o.orgId === pr.orgId), 404, 'OBJECTIVE_NOT_FOUND');
    const r = Engine.rank(st.opportunities, o, { today: Dates.today(), suppliers: st.suppliers, capacity: (op, d) => (globalThis.CON.Inventory.capacityFn(st, Date.now()))(op, d) });
    const slim = x => ({ oppId: x.oppId, eligible: x.eligible, score: x.score, checks: x.checks, coverage: { status: x.coverage.status, purchasedUnits: x.coverage.purchasedUnits, coveredDates: x.coverage.coveredDates.length }, price: x.price, evidence: x.evidence, risks: x.risks });
    return { eligible: r.eligible.map(slim), relaxed: r.relaxed.map(slim), excluded: r.excluded.map(slim) };
  })], { auth: true });

  /* ---------- RFQs and offers ---------- */
  route('POST', '/api/rfqs', async (req, pr) => {
    const b = await json(req);
    const rfq = await store.transact(st => {
      const r = Domain.createRfq(st, { objectiveId: b.objectiveId, oppIds: b.oppIds, meta: b.meta || {} }, ctxFor(pr));
      // Supplier notifications: sent only through a configured provider; otherwise recorded as skipped.
      r.suppliers.forEach(sid => audit(st, 'notification', r.id, notify.configured ? 'queued' : 'skipped_not_configured', 'system', 'RFQ to supplier ' + sid));
      return r;
    });
    return [201, rfq];
  }, { auth: true });
  route('GET', '/api/rfqs', async (req, pr) => [200, await store.read(st => st.rfqs.map(r => view.rfqFor(pr, r)).filter(Boolean))], { auth: true });
  const lineAction = (fn) => async (req, pr, p) => { const b = req.method === 'POST' && (req.headers['content-type'] || '').startsWith('application/json') ? await json(req) : {}; return [200, await store.transact(st => fn(st, b, ctxFor(pr), p))]; };
  route('POST', '/api/rfqs/:id/lines/:line/offer', lineAction((st, b, ctx, p) => Domain.respond(st, { rfqId: p.id, line: p.line, input: b.input || b }, ctx)), { auth: true });
  route('POST', '/api/rfqs/:id/lines/:line/decline', lineAction((st, b, ctx, p) => Domain.respond(st, { rfqId: p.id, line: p.line, decline: true, reason: b.reason }, ctx)), { auth: true });
  route('POST', '/api/rfqs/:id/lines/:line/withdraw', lineAction((st, b, ctx, p) => Domain.withdraw(st, { rfqId: p.id, line: p.line, reason: b.reason }, ctx)), { auth: true });
  route('POST', '/api/rfqs/:id/lines/:line/approve', lineAction((st, b, ctx, p) => Domain.approve(st, { rfqId: p.id, line: p.line, acceptedDeviations: b.acceptedDeviations, allowOverBudget: !!b.allowOverBudget }, ctx)), { auth: true });
  route('POST', '/api/rfqs/:id/lines/:line/unapprove', lineAction((st, b, ctx, p) => Domain.unapprove(st, { rfqId: p.id, line: p.line }, ctx)), { auth: true });

  /* ---------- Checkout and payment events ---------- */
  route('POST', '/api/rfqs/:id/checkout', async (req, pr, p) => {
    need(pr.role === 'customer', 403, 'FORBIDDEN');
    const key = String(req.headers['idempotency-key'] || '');
    need(/^[A-Za-z0-9_-]{8,80}$/.test(key), 422, 'IDEMPOTENCY_KEY_REQUIRED');
    if (!payments.configured) throw new NotConfigured('payment provider');
    const b = await json(req);
    const res = await store.transact(st => Domain.checkout(st, { rfqId: p.id, method: b.method, billing: b.billing, idempotencyKey: pr.orgId + '_' + key, provider: payments.name }, ctxFor(pr)));
    if (res.replay) return [200, { payment: res.payment, replay: true }];
    try {
      const intent = await payments.createPayment(res.payment);
      const pay = await store.transact(st => { const x = st.payments.find(y => y.id === res.payment.id); x.providerRef = intent.providerRef; return x; });
      return [201, { payment: pay, nextAction: intent.nextAction || null }];
    } catch (e) {
      // The provider refused: release the holds instead of leaving a payment that can never complete.
      await store.transact(st => Domain.paymentEvent(st, { eventId: 'provider-error-' + res.payment.id, paymentId: res.payment.id, type: 'payment.failed', reason: 'Payment provider error' }, sys()));
      throw new HttpError(502, 'PAYMENT_PROVIDER_ERROR');
    }
  }, { auth: true });
  route('POST', '/api/webhooks/payments', async (req) => {
    const raw = (await readBody(req, JSON_LIMIT)).toString('utf8');
    const v = payments.verifyWebhook(raw, req.headers);
    need(v.ok, 401, 'WEBHOOK_SIGNATURE_INVALID', { reason: v.reason });
    let ev; try { ev = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON_INVALID'); }
    const out = await store.transact(st => Domain.paymentEvent(st, { eventId: String(ev.id || ''), paymentId: ev.paymentId, type: ev.type, amount: ev.amount, reason: ev.reason }, sys()));
    return [200, out.duplicate ? { duplicate: true } : { ok: true }];
  });
  route('GET', '/api/payments', async (req, pr) => [200, await store.read(st => st.payments.map(x => view.paymentFor(pr, x)).filter(Boolean))], { auth: true });

  /* ---------- Bookings ---------- */
  route('GET', '/api/bookings', async (req, pr) => [200, await store.read(st => st.bookings.map(b => view.bookingFor(pr, b)).filter(Boolean))], { auth: true });
  const bk = fn => async (req, pr, p) => { const b = (req.headers['content-type'] || '').startsWith('application/json') ? await json(req) : {}; return [200, await store.transact(st => fn(st, b, ctxFor(pr), p))]; };
  route('POST', '/api/bookings/:id/advance', bk((st, b, ctx, p) => Domain.advanceBooking(st, { bookingId: p.id, event: b.event }, ctx)), { auth: true });
  route('POST', '/api/bookings/:id/report', bk((st, b, ctx, p) => Domain.submitReport(st, { bookingId: p.id, metrics: b.metrics }, ctx)), { auth: true });
  route('POST', '/api/bookings/:id/accept-delivery', bk((st, b, ctx, p) => Domain.acceptDelivery(st, { bookingId: p.id }, ctx)), { auth: true });
  route('POST', '/api/bookings/:id/dispute', bk((st, b, ctx, p) => Domain.openDispute(st, { bookingId: p.id, reason: b.reason }, ctx)), { auth: true });
  route('POST', '/api/bookings/:id/cancel', bk((st, b, ctx, p) => Domain.cancelBooking(st, { bookingId: p.id, reason: b.reason }, ctx)), { auth: true });
  route('POST', '/api/bookings/:id/outcome', bk((st, b, ctx, p) => Domain.setOutcome(st, Object.assign({}, b, { bookingId: p.id }), ctx)), { auth: true });

  /* ---------- Supplier verification documents ---------- */
  route('POST', '/api/suppliers/:id/documents', async (req, pr, p) => {
    need(pr.role === 'supplier' && pr.supplierId === p.id, 403, 'FORBIDDEN');
    if (!docs.configured) throw new NotConfigured('private document storage');
    const declared = String(req.headers['content-type'] || '').split(';')[0];
    need(Domain.DOC_TYPES.includes(declared), 415, 'DOCUMENT_TYPE_NOT_ALLOWED', { allowed: Domain.DOC_TYPES });
    const buf = await readBody(req, UPLOAD_LIMIT);
    need(buf.length > 0, 422, 'DOCUMENT_EMPTY');
    need(sniffType(buf) === declared, 422, 'DOCUMENT_CONTENT_MISMATCH');
    const name = String(new URL(req.url, 'http://x').searchParams.get('name') || 'licence').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    const saved = await docs.save(buf);
    const scan = await scanner.scan(buf);
    const sup = await store.transact(st => {
      const s = Domain.submitVerification(st, { supplierId: p.id, licenceNumber: (st.suppliers.find(x => x.id === p.id) || {}).licenceNumber, document: { fileName: name, size: buf.length, type: declared, storage: 'server', scan, ref: saved.id, sha256: saved.sha256 } }, ctxFor(pr));
      st.documents.push({ id: saved.id, supplierId: p.id, fileName: name, mime: declared, size: buf.length, sha256: saved.sha256, scan, path: saved.path, createdAt: new Date().toISOString() });
      return s;
    });
    return [201, { verification: Object.assign({}, sup.verification, { documents: sup.verification.documents.map(d => Object.assign({}, d, { path: undefined })) }), scan }];
  }, { auth: true });

  /* ---------- Operations ---------- */
  const ops = (pr) => need(pr.role === 'ops', 403, 'FORBIDDEN');
  route('GET', '/api/ops/audit', async (req, pr) => { ops(pr); const ent = new URL(req.url, 'http://x').searchParams.get('entity'); return [200, await store.read(st => st.audit.filter(a => !ent || a.entity === ent).slice(-500))]; }, { auth: true });
  // Reviewer access to a private document: operations only, served as a download with no inline rendering.
  route('GET', '/api/ops/documents/:id', async (req, pr, p) => {
    ops(pr);
    const d = await store.read(st => st.documents.find(x => x.id === p.id));
    need(d, 404, 'DOCUMENT_NOT_FOUND');
    const buf = await docs.read(d.path);
    await store.transact(st => audit(st, 'document', d.id, 'viewed', 'user:' + pr.userId));
    return [200, { __raw: buf, type: d.mime, name: d.fileName }];
  }, { auth: true });
  route('POST', '/api/ops/suppliers/:id/review', async (req, pr, p) => { ops(pr); const b = await json(req); return [200, await store.transact(st => Domain.reviewVerification(st, Object.assign({}, b, { supplierId: p.id }), ctxFor(pr)))]; }, { auth: true });
  route('POST', '/api/ops/disputes/:id/resolve', async (req, pr, p) => { ops(pr); const b = await json(req); return [200, await store.transact(st => Domain.resolveDispute(st, { disputeId: p.id, outcome: b.outcome, reason: b.reason }, ctxFor(pr)))]; }, { auth: true });
  route('POST', '/api/ops/refunds/:id/decide', async (req, pr, p) => { ops(pr); const b = await json(req); return [200, await store.transact(st => Domain.decideRefund(st, { refundId: p.id, decision: b.decision, reason: b.reason }, ctxFor(pr)))]; }, { auth: true });
  route('POST', '/api/ops/payouts/:id/release', async (req, pr, p) => {
    ops(pr);
    // Checks first, so a refused release always says why; then the money movement provider.
    const guards = await store.read(st => { const po = st.payouts.find(x => x.id === p.id); need(po, 404, 'PAYOUT_NOT_FOUND'); return { po, g: Domain.payoutGuards(st, po.bookingId, ctxFor(pr)) }; });
    const failed = guards.g.filter(x => !x.ok).map(x => x.guard);
    need(!failed.length, 409, 'PAYOUT_GUARDS_FAILED', { failed });
    if (guards.po.status === 'released') return [200, { payout: guards.po, replay: true }];
    if (!payouts.configured) throw new NotConfigured('payout provider');
    // Claim inside a transaction (guards re-checked), transfer with the payout id as idempotency key, then record.
    const claim = await store.transact(st => Domain.claimPayoutRelease(st, { payoutId: p.id }, ctxFor(pr)));
    if (claim.replay) return [200, { payout: claim.payout, replay: true }];
    let transfer;
    try { transfer = await payouts.transfer(claim.payout, { idempotencyKey: 'payout_' + p.id }); } catch (e) {
      await store.transact(st => Domain.failPayoutRelease(st, { payoutId: p.id, reason: e.code || e.message }, ctxFor(pr)));
      throw e;
    }
    return [200, await store.transact(st => { const r = Domain.releasePayout(st, { payoutId: p.id }, ctxFor(pr)); r.payout.providerRef = transfer.providerRef; return r; })];
  }, { auth: true });

  /* ---------- Dispatcher ---------- */
  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      const candidates = routes.filter(r => r.re.test(url.pathname));
      if (!candidates.length) throw new HttpError(404, 'NOT_FOUND');
      const r = candidates.find(x => x.method === req.method);
      if (!r) throw new HttpError(405, 'METHOD_NOT_ALLOWED');
      const m = r.re.exec(url.pathname); const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const pr = r.auth ? await principal(req) : null;
      const [status, body] = await r.handler(req, pr, params);
      if (body && body.__raw) {
        res.writeHead(status, Object.assign({}, SECURITY_HEADERS, { 'content-type': body.type, 'content-disposition': 'attachment; filename="' + body.name.replace(/"/g, '') + '"', 'content-length': body.__raw.length }));
        return res.end(body.__raw);
      }
      send(res, status, body);
    } catch (e) {
      const code = e.code || 'INTERNAL';
      const status = e.status || (e.name === 'DomainError' ? statusFor(code) : 500);
      if (status === 500) console.error(e);
      send(res, status, { error: { code: status === 500 ? 'INTERNAL' : code, details: status === 500 ? {} : (e.details || {}) } });
    }
  }
  // Handlers declared with (req, pr, ...) need a signed-in principal.
  routes.forEach(r => { r.auth = r.handler.length >= 2; });
  /* First operations account, from environment variables, only when none exists yet. */
  async function bootstrapOps() {
    if (!E.OPS_BOOTSTRAP_EMAIL || !E.OPS_BOOTSTRAP_PASSWORD) return false;
    const hash = await hashPassword(E.OPS_BOOTSTRAP_PASSWORD);
    return store.transact(st => {
      if (st.orgs.some(o => o.type === 'ops')) return false;
      const now = new Date().toISOString();
      const org = { id: uid('org'), name: 'Operations', type: 'ops', createdAt: now };
      const user = { id: uid('usr'), email: E.OPS_BOOTSTRAP_EMAIL.toLowerCase(), name: 'Operations', passwordHash: hash, createdAt: now };
      st.orgs.push(org); st.users.push(user); st.memberships.push({ userId: user.id, orgId: org.id, role: 'owner', createdAt: now });
      audit(st, 'user', user.id, 'bootstrap_ops', 'system');
      return true;
    });
  }
  return { handle, bootstrapOps, server: () => http.createServer(handle) };
}
