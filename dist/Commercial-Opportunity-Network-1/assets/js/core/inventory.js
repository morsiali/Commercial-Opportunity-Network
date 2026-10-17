/* Date-specific inventory. Each listing has a capacity per activation date; holds and confirmed
   reservations consume capacity on each of their dates. Holds expire. A hold covers all requested
   dates or none of them (no partial holds). */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const S = CON.States;

  const HOLD_MINUTES = { card: 30, transfer: 48 * 60, default: 30 };
  const ACTIVE = ['held', 'confirmed'];

  function ensure(state) { if (!Array.isArray(state.allocations)) state.allocations = []; return state.allocations; }
  function isLive(a, nowMs) { return a.status === 'confirmed' || (a.status === 'held' && (!a.expiresAt || Date.parse(a.expiresAt) > nowMs)); }

  function usedOn(state, oppId, date, nowMs, excludeRef) {
    let n = 0;
    ensure(state).forEach(a => { if (a.oppId === oppId && a.ref !== excludeRef && ACTIVE.includes(a.status) && isLive(a, nowMs) && a.dates.includes(date)) n += a.units || 1; });
    return n;
  }
  function free(state, op, date, nowMs, excludeRef) {
    const cap = Math.max(0, (op.capacityPerDate || 1) - (op.baseBooked || 0));
    return Math.max(0, cap - usedOn(state, op.id, date, nowMs == null ? Date.now() : nowMs, excludeRef));
  }
  /* Engine capacity callback: which of these dates are full, and the tightest free ratio. */
  function capacityFn(state, nowMs) {
    return (op, dates) => {
      const capTotal = Math.max(1, op.capacityPerDate || 1);
      const full = []; let minFree = capTotal;
      (dates || []).forEach(d => { const f = free(state, op, d, nowMs); if (f <= 0) full.push(d); if (f < minFree) minFree = f; });
      return { full, minFreeRatio: (dates && dates.length) ? minFree / capTotal : (capTotal - (op.baseBooked || 0)) / capTotal };
    };
  }

  /* Expire stale holds. Returns the expired allocations. */
  function sweep(state, log, now) {
    const nowMs = now ? Date.parse(now) : Date.now();
    const out = [];
    ensure(state).forEach(a => {
      if (a.status === 'held' && a.expiresAt && Date.parse(a.expiresAt) <= nowMs) {
        S.transition(log, 'reservation', a, 'expire', { at: new Date(nowMs).toISOString(), reason: 'Hold expired before payment' });
        out.push(a);
      }
    });
    return out;
  }

  /* Atomically hold one unit on every date for every requested line.
     requests: [{ op, dates, ref }]. Throws INVENTORY_UNAVAILABLE listing every conflicting date. */
  function holdAll(state, log, requests, opts) {
    const o = opts || {};
    const nowMs = o.now ? Date.parse(o.now) : Date.now();
    sweep(state, log, new Date(nowMs).toISOString());
    const conflicts = [];
    requests.forEach(r => {
      if (!r.op || r.op.status !== 'active') { conflicts.push({ oppId: r.op ? r.op.id : r.oppId, reason: 'listing_unavailable' }); return; }
      if (!r.dates || !r.dates.length) { conflicts.push({ oppId: r.op.id, reason: 'no_dates' }); return; }
      const full = r.dates.filter(d => free(state, r.op, d, nowMs, r.ref) < 1);
      if (full.length) conflicts.push({ oppId: r.op.id, reason: 'capacity', dates: full });
    });
    if (conflicts.length) throw new S.DomainError('INVENTORY_UNAVAILABLE', { conflicts });
    const minutes = o.holdMinutes || HOLD_MINUTES[o.method] || HOLD_MINUTES.default;
    const expiresAt = new Date(nowMs + minutes * 60000).toISOString();
    const at = new Date(nowMs).toISOString();
    return requests.map(r => {
      const a = { id: 'al-' + Math.random().toString(36).slice(2, 10), oppId: r.op.id, listingVersion: r.op.version || 1, dates: r.dates.slice(), units: 1, ref: r.ref, status: 'held', createdAt: at, expiresAt };
      ensure(state).push(a);
      S.audit(log, 'reservation', a.id, 'hold', { at, actor: o.actor, data: { oppId: a.oppId, dates: a.dates.length, expiresAt } });
      return a;
    });
  }
  function confirm(state, log, allocationId, meta) {
    const a = ensure(state).find(x => x.id === allocationId);
    if (!a) throw new S.DomainError('RESERVATION_NOT_FOUND', { allocationId });
    if (a.status === 'held' && a.expiresAt && Date.parse(a.expiresAt) <= Date.parse((meta && meta.at) || new Date().toISOString())) {
      S.transition(log, 'reservation', a, 'expire', Object.assign({}, meta, { reason: 'Hold expired before payment' }));
      throw new S.DomainError('RESERVATION_EXPIRED', { allocationId });
    }
    if (a.status === 'confirmed') return a; // idempotent
    S.transition(log, 'reservation', a, 'confirm', meta);
    delete a.expiresAt;
    return a;
  }
  function release(state, log, allocationId, meta) {
    const a = ensure(state).find(x => x.id === allocationId);
    if (!a || a.status === 'released' || a.status === 'expired') return a || null;
    S.transition(log, 'reservation', a, 'release', meta);
    return a;
  }

  CON.Inventory = { HOLD_MINUTES, free, usedOn, capacityFn, sweep, holdAll, confirm, release };
})(typeof window !== 'undefined' ? window : globalThis);
