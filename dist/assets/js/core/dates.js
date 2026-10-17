/* Calendar dates as ISO strings (YYYY-MM-DD), resolved in the business time zone (default Asia/Dubai). */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const DAY = 86400000;
  const TZ_DEFAULT = 'Asia/Dubai';

  function isIso(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(s); }
  function isValid(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return false;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1) return false;
    return d <= daysInMonth(y, mo);
  }
  function daysInMonth(y, mo) { return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }
  function make(y, mo, d) { return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function toMs(iso) { const p = iso.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function fromMs(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(iso, n) { return fromMs(toMs(iso) + n * DAY); }
  function diffDays(a, b) { return Math.round((toMs(b) - toMs(a)) / DAY); }
  function weekday(iso) { return new Date(toMs(iso)).getUTCDay(); } // 0 = Sunday
  /* Today in the business time zone, independent of the device's own zone. */
  function today(tz, now) {
    const d = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz || TZ_DEFAULT, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      const g = t => parts.find(p => p.type === t).value;
      return g('year') + '-' + g('month') + '-' + g('day');
    } catch (e) {
      // Fallback: Asia/Dubai is UTC+4 with no daylight saving.
      return fromMs(d.getTime() + 4 * 3600000);
    }
  }
  function range(from, to) { const out = []; if (!isIso(from) || !isIso(to) || to < from) return out; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
  function overlap(aFrom, aTo, bFrom, bTo) { const s = aFrom > bFrom ? aFrom : bFrom; const e = aTo < bTo ? aTo : bTo; return e < s ? null : { from: s, to: e, days: diffDays(s, e) + 1 }; }

  CON.Dates = { TZ_DEFAULT, DAY, isIso, isValid, daysInMonth, make, addDays, diffDays, weekday, today, range, overlap, toMs, fromMs };
})(typeof window !== 'undefined' ? window : globalThis);
