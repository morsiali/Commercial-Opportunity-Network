// External service adapters. Anything not configured reports "not configured" and the operation that needs it
// is refused with a 503 — nothing is simulated in live mode. A "test" provider exists only when NODE_ENV=test.
import { createHmac, timingSafeEqual, randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import net from 'node:net';

export class NotConfigured extends Error { constructor(what) { super(what + ' is not configured'); this.code = what.toUpperCase().replace(/\W+/g, '_') + '_NOT_CONFIGURED'; this.status = 503; } }

/* Signed webhook format: header  X-CON-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, t + "." + rawBody)> */
export function verifySignature(rawBody, header, secret, toleranceSec) {
  if (!secret) throw new NotConfigured('payment webhook secret');
  const parts = Object.fromEntries(String(header || '').split(',').map(x => x.trim().split('=')));
  const t = Number(parts.t); const sig = parts.v1;
  if (!t || !sig || !/^[0-9a-f]{64}$/.test(sig)) return { ok: false, reason: 'malformed' };
  if (Math.abs(Date.now() / 1000 - t) > (toleranceSec || 300)) return { ok: false, reason: 'stale' };
  const want = createHmac('sha256', secret).update(t + '.' + rawBody).digest();
  const got = Buffer.from(sig, 'hex');
  return { ok: got.length === want.length && timingSafeEqual(got, want), reason: 'mismatch' };
}
export function signForTest(rawBody, secret, t) { const ts = t || Math.floor(Date.now() / 1000); return 't=' + ts + ',v1=' + createHmac('sha256', secret).update(ts + '.' + rawBody).digest('hex'); }

export function paymentsAdapter(env) {
  const provider = env.PAYMENT_PROVIDER || '';
  const testOnly = provider === 'test' && env.NODE_ENV === 'test';
  return {
    name: provider || 'not_configured',
    configured: testOnly || (provider && provider !== 'test' && !!env.PAYMENT_WEBHOOK_SECRET),
    async createPayment(payment) {
      if (testOnly) return { providerRef: 'test_' + payment.id, nextAction: null };
      // A real provider integration (e.g. a UAE-licensed gateway) goes here. Until then, refuse.
      throw new NotConfigured('payment provider');
    },
    verifyWebhook(rawBody, headers) { return verifySignature(rawBody, headers['x-con-signature'], env.PAYMENT_WEBHOOK_SECRET); }
  };
}
export function payoutsAdapter(env) {
  const provider = env.PAYOUT_PROVIDER || '';
  const testOnly = provider === 'test' && env.NODE_ENV === 'test';
  return {
    name: provider || 'not_configured', configured: testOnly,
    async transfer(payout) { if (testOnly) return { providerRef: 'test_po_' + payout.id }; throw new NotConfigured('payout provider'); }
  };
}
export function notificationsAdapter(env) {
  const provider = env.NOTIFICATIONS_PROVIDER || '';
  return { name: provider || 'not_configured', configured: false, async send() { return { sent: false, reason: 'not_configured' }; } };
}

/* Malware scanning via clamd (INSTREAM). Without CLAMAV_HOST, documents stay "pending" and cannot be approved. */
export function scannerAdapter(env) {
  const host = env.CLAMAV_HOST, port = Number(env.CLAMAV_PORT || 3310);
  return {
    name: host ? 'clamav' : 'not_configured', configured: !!host,
    scan(buf) {
      if (!host) return Promise.resolve('pending');
      return new Promise(resolve => {
        const sock = net.createConnection({ host, port }, () => {
          sock.write('zINSTREAM\0');
          for (let i = 0; i < buf.length; i += 65536) { const chunk = buf.subarray(i, i + 65536); const len = Buffer.alloc(4); len.writeUInt32BE(chunk.length); sock.write(len); sock.write(chunk); }
          sock.write(Buffer.alloc(4));
        });
        let out = '';
        sock.setTimeout(30000, () => { sock.destroy(); resolve('error'); });
        sock.on('data', d => { out += d.toString(); });
        sock.on('end', () => resolve(/OK/.test(out) && !/FOUND/.test(out) ? 'clean' : /FOUND/.test(out) ? 'infected' : 'error'));
        sock.on('error', () => resolve('error'));
      });
    }
  };
}

/* Private document storage on disk, outside the public site. Files are named by random id; content is checked by signature. */
const SIGNATURES = { 'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff] };
export function sniffType(buf) { for (const [type, sig] of Object.entries(SIGNATURES)) if (sig.every((b, i) => buf[i] === b)) return type; return null; }
export function documentStore(env) {
  const dir = env.PRIVATE_STORAGE_DIR;
  return {
    configured: !!dir,
    async save(buf) {
      if (!dir) throw new NotConfigured('private document storage');
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const id = 'doc_' + randomBytes(12).toString('hex');
      const path = join(dir, id);
      await writeFile(path, buf, { mode: 0o600, flag: 'wx' });
      return { id, path, sha256: createHash('sha256').update(buf).digest('hex') };
    },
    async read(path) { return readFile(path); }
  };
}
