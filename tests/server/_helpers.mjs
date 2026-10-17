// Shared helpers for the live-mode API tests.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../server/app.mjs';
import { memoryStore } from '../../server/store-memory.mjs';
import { Dates } from '../../server/core.mjs';

export const SECRET = 'test-auth-secret-0123456789-abcdefghijklmnop';
export const WEBHOOK = 'test-webhook-secret-xyz';
export async function start(extraEnv, storeFactory, adapters) {
  const store = storeFactory ? await storeFactory() : memoryStore();
  await store.init();
  const env = Object.assign({ NODE_ENV: 'test', AUTH_SECRET: SECRET, PAYMENT_PROVIDER: 'test', PAYOUT_PROVIDER: 'test', PAYMENT_WEBHOOK_SECRET: WEBHOOK, PRIVATE_STORAGE_DIR: await mkdtemp(join(tmpdir(), 'con-docs-')), OPS_BOOTSTRAP_EMAIL: 'ops@example.test', OPS_BOOTSTRAP_PASSWORD: 'ops-password-long-enough', LOGIN_RATE_LIMIT: '5' }, extraEnv || {});
  Object.keys(env).forEach(k => { if (env[k] === null) delete env[k]; });
  const app = createApp({ store, env, adapters });
  await app.bootstrapOps();
  const srv = app.server();
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const api = async (method, path, body, token, headers) => {
    const h = Object.assign({}, headers || {});
    if (token) h.authorization = 'Bearer ' + token;
    let payload;
    if (body !== undefined && !(body instanceof Buffer) && typeof body !== 'string') { h['content-type'] = 'application/json'; payload = JSON.stringify(body); } else payload = body;
    const res = await fetch(base + path, { method, headers: h, body: payload });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };
  return { api, store, base, close: async () => { await new Promise(r => srv.close(r)); await store.close(); } };
}
export const today = Dates.today();
export const START = Dates.addDays(today, 20);
export async function register(api, email, orgType, extra) {
  const r = await api('POST', '/api/auth/register', Object.assign({ email, password: 'correct horse battery staple', name: email.split('@')[0], orgName: email.split('@')[0] + ' LLC', orgType }, extra || {}));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.token;
}
export const login = async (api, email, password) => (await api('POST', '/api/auth/login', { email, password })).body.token;
export async function world(api) {
  const A = await register(api, 'a@brand.test', 'customer');
  const B = await register(api, 'b@brand.test', 'customer');
  const S1 = await register(api, 's1@venue.test', 'supplier', { licenceNumber: 'DED-1111', category: 'mall_activation' });
  const S2 = await register(api, 's2@venue.test', 'supplier', { licenceNumber: 'DED-2222' });
  const OPS = await login(api, 'ops@example.test', 'ops-password-long-enough');
  const listing = await api('POST', '/api/listings', { type: 'mall_activation', area: 'marina', title: { en: 'Atrium stand', ar: '' }, price: 500000, unit: 'day', setupFee: 0, minUnits: 1, maxUnits: 10, capacityPerDate: 1, availableFrom: today, availableTo: Dates.addDays(today, 120), leadDays: 3, schedule: { days: [0, 1, 2, 3, 4, 5, 6] }, audience: { gender: 'mixed', access: 'open', ageMin: 18, ageMax: 60, interests: [] } }, S1);
  assert.equal(listing.status, 201, JSON.stringify(listing.body));
  return { A, B, S1, S2, OPS, listing: listing.body };
}
export async function approvedRfq(api, w, token) {
  const ob = await api('POST', '/api/objectives', { name: 'Test', objective: 'trial', budget: '200000', start: START, duration: 3, areas: ['marina'] }, token);
  assert.equal(ob.status, 201, JSON.stringify(ob.body));
  const rfq = await api('POST', '/api/rfqs', { objectiveId: ob.body.id, oppIds: [w.listing.id] }, token);
  assert.equal(rfq.status, 201, JSON.stringify(rfq.body));
  const line = rfq.body.lines[0]; const cov = line.requested.coverage;
  const off = await api('POST', '/api/rfqs/' + rfq.body.id + '/lines/' + line.id + '/offer', { input: { basePrice: 1500000, setupFee: 0, units: cov.purchasedUnits, from: cov.coveredDates[0], to: cov.coveredDates[cov.coveredDates.length - 1], dates: cov.coveredDates, deliverables: ['Stand for 3 days'], validUntil: Dates.addDays(today, 7) } }, w.S1);
  assert.equal(off.status, 200, JSON.stringify(off.body));
  const ap = await api('POST', '/api/rfqs/' + rfq.body.id + '/lines/' + line.id + '/approve', { acceptedDeviations: [] }, token);
  assert.equal(ap.status, 200, JSON.stringify(ap.body));
  return { rfq: rfq.body, line };
}

