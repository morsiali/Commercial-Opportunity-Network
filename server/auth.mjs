// Password hashing (scrypt), signed bearer tokens (HMAC-SHA256) and a small login rate limiter.
import { scrypt as _scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(_scrypt);

const N = 16384, R = 8, P = 1, KEYLEN = 64;
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) throw Object.assign(new Error('PASSWORD_WEAK'), { code: 'PASSWORD_WEAK', status: 400 });
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64url'), Buffer.from(key).toString('base64url')].join('$');
}
export async function verifyPassword(password, stored) {
  try {
    const [alg, n, r, p, salt, hash] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const key = await scrypt(String(password), Buffer.from(salt, 'base64url'), KEYLEN, { N: +n, r: +r, p: +p });
    const want = Buffer.from(hash, 'base64url');
    return want.length === key.length && timingSafeEqual(want, Buffer.from(key));
  } catch { return false; }
}

export function signToken(payload, secret, ttlSeconds) {
  const body = Buffer.from(JSON.stringify(Object.assign({}, payload, { exp: Math.floor(Date.now() / 1000) + (ttlSeconds || 8 * 3600) }))).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}
export function verifyToken(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', secret).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}

/* Fixed-window limiter, per key (e.g. IP + email). */
export function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return key => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now - h.start > windowMs) { hits.set(key, { start: now, n: 1 }); return true; }
    h.n++;
    return h.n <= limit;
  };
}
