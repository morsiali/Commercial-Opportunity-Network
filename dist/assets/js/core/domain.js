/* Domain operations shared by the browser demo and the server API.
   Every function takes (state, args, ctx) and mutates the state document only through the state
   machines, records an audit entry, and throws a structured DomainError on any rule violation.
   ctx = { role: 'customer'|'supplier'|'ops'|'system', actor, supplierId?, now: ISO, today: YYYY-MM-DD, mode: 'demo'|'live', money? } */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const Dt = CON.Dates, M = CON.Money, S = CON.States, Inv = CON.Inventory, Of = CON.Offers, E = CON.Engine;
  const DomainError = S.DomainError;
  const T = S.transition;

  const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const DOC_MAX_BYTES = 10 * 1024 * 1024;
  const TERMINAL_LINE = ['reserved', 'booked', 'declined', 'withdrawn', 'expired', 'cancelled'];

  function c(ctx) {
    const now = (ctx && ctx.now) || new Date().toISOString();
    return Object.assign({ role: 'system', actor: 'system', mode: 'demo' }, ctx || {}, { now, today: (ctx && ctx.today) || Dt.today(Dt.TZ_DEFAULT, now) });
  }
  function ensureState(st) {
    ['suppliers', 'opportunities', 'objectives', 'rfqs', 'payments', 'bookings', 'payouts', 'disputes', 'refunds', 'allocations', 'audit'].forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
    if (!st.idem || typeof st.idem !== 'object') st.idem = {};
    if (!st.processedEvents || typeof st.processedEvents !== 'object') st.processedEvents = {};
    st.counters = Object.assign({ rfq: 0, pay: 0, bk: 0, po: 0, dp: 0, rf: 0 }, st.counters || {});
    return st;
  }
  function id(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(st, key, prefix, ctx) { st.counters[key] = (st.counters[key] || 0) + 1; return prefix + '-' + ctx.today.slice(0, 4) + '-' + String(st.counters[key]).padStart(4, '0'); }
  function meta(ctx, reason, data) { return { at: ctx.now, actor: ctx.actor, reason: reason || '', data }; }
  function need(cond, code, details) { if (!cond) throw new DomainError(code, details); }
  function authorize(ctx, roles, supplierId) {
    if (ctx.role === 'system') return;
    if (!roles.includes(ctx.role)) throw new DomainError('FORBIDDEN', { role: ctx.role, allowed: roles });
    if (ctx.role === 'supplier' && supplierId && ctx.supplierId !== supplierId) throw new DomainError('FORBIDDEN', { reason: 'not_owner' });
  }
  const find = (arr, k, v, code) => { const x = arr.find(o => o[k] === v); if (!x && code) throw new DomainError(code, { [k]: v }); return x; };
  const opp = (st, oid) => st.opportunities.find(o => o.id === oid);
  const sup = (st, sid) => st.suppliers.find(s => s.id === sid);

  /* ---------- Listings ---------- */
  const LISTING_MATERIAL = ['price', 'unit', 'setupFee', 'minUnits', 'maxUnits', 'availableFrom', 'availableTo', 'leadDays', 'schedule', 'eventDates', 'capacityPerDate', 'audience', 'restrictions', 'area', 'type'];
  function validateListing(op) {
    const errs = [];
    const t = op.title || {};
    if (!String(t.en || '').trim() && !String(t.ar || '').trim()) errs.push({ field: 'title', code: 'listing.title.required' });
    if (op.price != null && (!Number.isSafeInteger(op.price) || op.price < 0)) errs.push({ field: 'price', code: 'listing.price.invalid' });
    if (!Number.isSafeInteger(op.setupFee || 0) || (op.setupFee || 0) < 0) errs.push({ field: 'setupFee', code: 'listing.price.invalid' });
    if (!['day', 'week', 'month', 'activation'].includes(op.unit)) errs.push({ field: 'unit', code: 'listing.unit.invalid' });
    if (!Dt.isIso(op.availableFrom)) errs.push({ field: 'availableFrom', code: 'listing.date.invalid' });
    if (!Dt.isIso(op.availableTo)) errs.push({ field: 'availableTo', code: 'listing.date.invalid' });
    if (Dt.isIso(op.availableFrom) && Dt.isIso(op.availableTo) && op.availableTo < op.availableFrom) errs.push({ field: 'availableTo', code: 'listing.date.order' });
    if (!Number.isSafeInteger(op.capacityPerDate) || op.capacityPerDate < 1 || op.capacityPerDate > 1000) errs.push({ field: 'capacityPerDate', code: 'listing.capacity.invalid' });
    if (op.maxUnits != null && op.maxUnits !== '' && (!Number.isSafeInteger(op.maxUnits) || op.maxUnits < (op.minUnits || 1))) errs.push({ field: 'maxUnits', code: 'listing.units.invalid' });
    if (op.schedule && (!Array.isArray(op.schedule.days) || !op.schedule.days.length || op.schedule.days.some(d => d < 0 || d > 6))) errs.push({ field: 'schedule', code: 'listing.schedule.invalid' });
    if (op.eventDates && (!Array.isArray(op.eventDates) || !op.eventDates.every(Dt.isIso))) errs.push({ field: 'eventDates', code: 'listing.date.invalid' });
    return errs;
  }
  function saveListing(st, op, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['supplier', 'ops'], op.supplierId);
    const errs = validateListing(op);
    if (errs.length) throw new DomainError('LISTING_INVALID', { errors: errs });
    const i = st.opportunities.findIndex(o => o.id === op.id);
    const prev = i >= 0 ? st.opportunities[i] : null;
    if (prev) authorize(ctx, ['supplier', 'ops'], prev.supplierId);
    const out = Object.assign({ v: 3, status: 'active', version: 1, baseBooked: 0, evidence: [] }, op);
    if (prev) {
      const changed = LISTING_MATERIAL.filter(k => JSON.stringify(prev[k]) !== JSON.stringify(out[k]));
      out.version = (prev.version || 1) + (changed.length ? 1 : 0);
      if (changed.some(k => ['availableFrom', 'availableTo', 'schedule', 'eventDates', 'capacityPerDate'].includes(k))) out.availabilityUpdatedAt = ctx.today;
      else out.availabilityUpdatedAt = prev.availabilityUpdatedAt || null;
      out.status = prev.status === 'archived' ? 'archived' : out.status;
      st.opportunities[i] = out;
      S.audit(st.audit, 'listing', out.id, 'update', meta(ctx, '', { version: out.version, changed }));
    } else {
      out.availabilityUpdatedAt = ctx.today;
      st.opportunities.unshift(out);
      S.audit(st.audit, 'listing', out.id, 'create', meta(ctx));
    }
    out.updatedAt = ctx.now;
    return out;
  }
  function listingReferenced(st, oid) {
    return st.rfqs.some(r => r.lines.some(l => l.oppId === oid)) || st.bookings.some(b => b.oppId === oid) || st.allocations.some(a => a.oppId === oid && ['held', 'confirmed'].includes(a.status));
  }
  /* Delete is only allowed for listings nothing refers to; otherwise the listing is archived. */
  function removeListing(st, oid, ctx) {
    ctx = c(ctx); ensureState(st);
    const op = find(st.opportunities, 'id', oid, 'LISTING_NOT_FOUND');
    authorize(ctx, ['supplier', 'ops'], op.supplierId);
    if (listingReferenced(st, oid)) {
      const from = op.status; op.status = 'archived'; op.archivedAt = ctx.now;
      S.audit(st.audit, 'listing', oid, 'archive', meta(ctx, 'Referenced by RFQs or bookings', { from }));
      return { archived: true, listing: op };
    }
    st.opportunities = st.opportunities.filter(o => o.id !== oid);
    if (Array.isArray(st.compare)) st.compare = st.compare.filter(x => x !== oid);
    S.audit(st.audit, 'listing', oid, 'delete', meta(ctx));
    return { deleted: true };
  }
  function setListingStatus(st, oid, status, ctx) {
    ctx = c(ctx); const op = find(st.opportunities, 'id', oid, 'LISTING_NOT_FOUND');
    authorize(ctx, ['supplier', 'ops'], op.supplierId);
    need(['active', 'paused', 'archived'].includes(status), 'LISTING_STATUS_INVALID', { status });
    const from = op.status; op.status = status;
    S.audit(st.audit, 'listing', oid, 'status', meta(ctx, '', { from, to: status }));
    return op;
  }

  /* ---------- RFQs and offers ---------- */
  function createRfq(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['customer']);
    const obj = find(st.objectives, 'id', args.objectiveId, 'OBJECTIVE_NOT_FOUND');
    const brief = E.normalizeObjective(obj, { today: ctx.today });
    const ops = (args.oppIds || []).map(x => opp(st, x)).filter(o => o && o.status === 'active');
    need(ops.length, 'RFQ_NO_LISTINGS');
    need(brief.start >= ctx.today, 'RFQ_START_PAST', { start: brief.start });
    const m = args.meta || {};
    if (m.responseDeadline) {
      const chk = E.rfqDeadlineCheck(m.responseDeadline, brief, ops, ctx.today);
      if (!chk.ok) throw new DomainError('RFQ_DEADLINE_INVALID', chk);
    }
    const gen = E.generateRFQ(brief, ops, m, { today: ctx.today, money: ctx.money });
    const rfq = Object.assign({ id: id('rq'), number: num(st, 'rfq', 'RFQ', ctx), objectiveId: obj.id, createdAt: ctx.now, status: 'open', shareBudget: m.shareBudget !== false, mode: ctx.mode }, gen);
    rfq.lines = gen.lines.map((l, i) => ({
      id: rfq.id + '-l' + (i + 1), oppId: l.oppId, supplierId: l.supplierId, status: 'requested',
      requested: { coverage: { status: l.requested.coverage.status, purchasedUnits: l.requested.coverage.purchasedUnits, neededUnits: l.requested.coverage.neededUnits, coveredDates: l.requested.coverage.coveredDates, overMax: l.requested.coverage.overMax }, price: l.requested.price },
      window: { from: brief.start, to: brief.end }, reporting: gen.reporting, requiredDeliverables: gen.requiredDeliverables,
      listingVersion: (opp(st, l.oppId) || {}).version || 1, offers: [], approval: null
    }));
    st.rfqs.unshift(rfq);
    S.audit(st.audit, 'rfq', rfq.id, 'create', meta(ctx, '', { lines: rfq.lines.length }));
    return rfq;
  }
  function lineOf(st, rfqId, key) {
    const r = find(st.rfqs, 'id', rfqId, 'RFQ_NOT_FOUND');
    const l = r.lines.find(x => x.id === key || x.oppId === key);
    need(l, 'RFQ_LINE_NOT_FOUND', { rfqId, line: key });
    return { r, l };
  }
  function respond(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    const { r, l } = lineOf(st, args.rfqId, args.line);
    authorize(ctx, ['supplier', 'system'], l.supplierId);
    need(['open', 'partially_awarded'].includes(r.status), 'RFQ_CLOSED', { status: r.status });
    if (r.responseDeadline && ctx.today > r.responseDeadline) throw new DomainError('RFQ_DEADLINE_PASSED', { deadline: r.responseDeadline });
    if (args.decline) {
      T(st.audit, 'offer', l, 'decline', meta(ctx, String(args.reason || '').slice(0, 300)));
      l.declineReason = String(args.reason || '').slice(0, 300);
      l.approval = null;
      return l;
    }
    const op = opp(st, l.oppId);
    need(op, 'LISTING_NOT_FOUND', { oppId: l.oppId });
    const v = Of.buildVersion(l, op, args.input || {}, ctx);
    v.version = l.offers.length + 1; v.at = ctx.now; v.by = ctx.actor; v.simulated = !!args.simulated;
    const wasApproved = !!l.approval;
    if (l.status === 'requested') T(st.audit, 'offer', l, 'offer', meta(ctx, '', { version: v.version }));
    else T(st.audit, 'offer', l, 'revise', meta(ctx, 'Offer revised', { version: v.version }));
    l.offers.push(v);
    if (wasApproved) { S.audit(st.audit, 'offer', l.id, 'approval_invalidated', meta(ctx, 'Material revision after approval', { previous: l.approval.version, current: v.version })); l.approval = null; }
    return l;
  }
  function withdraw(st, args, ctx) {
    ctx = c(ctx); const { l } = lineOf(st, args.rfqId, args.line);
    authorize(ctx, ['supplier'], l.supplierId);
    T(st.audit, 'offer', l, 'withdraw', meta(ctx, args.reason)); l.approval = null; return l;
  }
  function lineContext(st, r, l, ctx, extra) {
    return Object.assign({ today: ctx.today, now: ctx.now, listing: opp(st, l.oppId), supplier: sup(st, l.supplierId), state: st, verifiedOnly: !!(r.requirementsPolicy && r.requirementsPolicy.verifiedOnly), ref: l.id }, extra || {});
  }
  function budgetUse(st, r, cfg, exceptLineId) {
    return r.lines.filter(x => x.id !== exceptLineId && (x.status === 'accepted' || x.status === 'reserved' || x.status === 'booked') && Of.current(x)).reduce((t, x) => t + M.budgetBasis(Of.money(Of.current(x), cfg), cfg), 0);
  }
  function approve(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['customer']);
    const { r, l } = lineOf(st, args.rfqId, args.line);
    const v = Of.current(l);
    const accepted = Array.isArray(args.acceptedDeviations) ? args.acceptedDeviations : [];
    const res = Of.validate(Object.assign({}, l, { approval: null }), lineContext(st, r, l, ctx, { acceptedDeviations: accepted, stage: 'approval' }));
    if (!res.ok) throw new DomainError('OFFER_NOT_APPROVABLE', { errors: res.errors, warnings: res.warnings });
    const use = budgetUse(st, r, ctx.money, l.id) + M.budgetBasis(Of.money(v, ctx.money), ctx.money);
    if (use > r.budgetMinor && !args.allowOverBudget) throw new DomainError('OFFER_OVER_BUDGET', { budgetMinor: r.budgetMinor, wouldUse: use });
    if (l.status === 'accepted') T(st.audit, 'offer', l, 'unaccept', meta(ctx, 'Re-approval'));
    T(st.audit, 'offer', l, 'accept', meta(ctx, '', { version: v.version, acceptedDeviations: accepted }));
    l.approval = { version: v.version, hash: v.hash, at: ctx.now, by: ctx.actor, acceptedDeviations: accepted.filter(f => v.deviations.some(d => d.field === f)), overBudget: use > r.budgetMinor };
    return { line: l, warnings: res.warnings };
  }
  function unapprove(st, args, ctx) {
    ctx = c(ctx); authorize(ctx, ['customer']);
    const { l } = lineOf(st, args.rfqId, args.line);
    if (l.status !== 'accepted') return l;
    T(st.audit, 'offer', l, 'unaccept', meta(ctx)); l.approval = null; return l;
  }
  /* Offers past their validity date move to expired (approval with them). */
  function expireOffers(st, ctx) {
    ctx = c(ctx); ensureState(st);
    const out = [];
    st.rfqs.forEach(r => r.lines.forEach(l => {
      const v = Of.current(l);
      if (v && ['offered', 'accepted'].includes(l.status) && v.validUntil < ctx.today) { T(st.audit, 'offer', l, 'expire', meta(ctx, 'Offer validity ended')); l.approval = null; out.push(l); }
    }));
    return out;
  }

  /* ---------- Checkout, payment and holds ---------- */
  function snapshotListing(op, s) {
    return { id: op.id, version: op.version || 1, title: op.title, type: op.type, area: op.area, unit: op.unit, price: op.price, setupFee: op.setupFee, supplierName: s ? s.name : null, supplierVerification: s && s.verification ? s.verification.status : null, takenAt: null };
  }
  function checkout(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['customer']);
    const key = args.idempotencyKey;
    need(key && /^[A-Za-z0-9_-]{8,80}$/.test(key), 'IDEMPOTENCY_KEY_REQUIRED');
    if (st.idem[key]) { const p = st.payments.find(x => x.id === st.idem[key]); if (p) return { payment: p, replay: true }; }
    const r = find(st.rfqs, 'id', args.rfqId, 'RFQ_NOT_FOUND');
    need(['card', 'transfer'].includes(args.method), 'PAYMENT_METHOD_INVALID');
    Inv.sweep(st, st.audit, ctx.now);
    const accepted = r.lines.filter(l => l.status === 'accepted');
    need(accepted.length, 'CHECKOUT_NOTHING_APPROVED');
    const stale = accepted.filter(l => !Of.approvalValid(l));
    if (stale.length) throw new DomainError('CHECKOUT_APPROVAL_STALE', { lines: stale.map(l => l.id) });
    const failures = [];
    accepted.forEach(l => { const res = Of.validate(l, lineContext(st, r, l, ctx, { stage: 'checkout' })); if (!res.ok) failures.push({ line: l.id, oppId: l.oppId, errors: res.errors }); });
    if (failures.length) throw new DomainError('CHECKOUT_VALIDATION_FAILED', { lines: failures });
    const holds = Inv.holdAll(st, st.audit, accepted.map(l => ({ op: opp(st, l.oppId), dates: Of.current(l).dates, ref: l.id })), { now: ctx.now, method: args.method, actor: ctx.actor });
    const lines = accepted.map((l, i) => { const v = Of.current(l); const mny = Of.money(v, ctx.money); return { lineId: l.id, oppId: l.oppId, supplierId: l.supplierId, version: v.version, hash: v.hash, money: mny, allocationId: holds[i].id }; });
    const totals = M.totals(lines.map(x => x.money));
    const b = args.billing || {};
    const pay = {
      id: id('py'), number: num(st, 'pay', 'PAY', ctx), rfqId: r.id, objectiveId: r.objectiveId, status: 'awaiting', method: args.method,
      amount: totals, lines, createdAt: ctx.now, expiresAt: holds[0].expiresAt, idempotencyKey: key, mode: ctx.mode,
      provider: ctx.mode === 'demo' ? 'demo-simulated' : (args.provider || 'unconfigured'),
      billing: { company: String(b.company || '').slice(0, 120), email: String(b.email || '').slice(0, 160), trn: String(b.trn || '').slice(0, 20) },
      taxNote: 'Tax treatment pending accountant confirmation (docs/TAX_AND_FEES.md)'
    };
    st.payments.unshift(pay);
    st.idem[key] = pay.id;
    S.audit(st.audit, 'payment', pay.id, 'create', meta(ctx, '', { total: totals.total, lines: lines.length, method: args.method }));
    accepted.forEach((l, i) => {
      T(st.audit, 'offer', l, 'reserve', meta(ctx, '', { payment: pay.id }));
      const op = opp(st, l.oppId); const s = sup(st, l.supplierId); const v = Of.current(l);
      const snap = snapshotListing(op, s); snap.takenAt = ctx.now;
      const bk = { id: id('bk'), number: num(st, 'bk', 'BK', ctx), paymentId: pay.id, rfqId: r.id, lineId: l.id, objectiveId: r.objectiveId, oppId: l.oppId, supplierId: l.supplierId,
        status: 'reserved', money: lines[i].money, dates: v.dates.slice(), from: v.dates[0], to: v.dates[v.dates.length - 1], offerVersion: v.version, offer: JSON.parse(JSON.stringify(v)), snapshot: snap,
        allocationId: holds[i].id, createdAt: ctx.now, report: null, outcome: null, deliveryAcceptedAt: null, mode: ctx.mode };
      st.bookings.unshift(bk);
      S.audit(st.audit, 'booking', bk.id, 'create', meta(ctx, '', { payment: pay.id }));
      const po = { id: id('po'), number: num(st, 'po', 'PO', ctx), bookingId: bk.id, supplierId: l.supplierId, status: 'held', amount: lines[i].money.net, createdAt: ctx.now };
      st.payouts.unshift(po); bk.payoutId = po.id;
      S.audit(st.audit, 'payout', po.id, 'create', meta(ctx, 'Held until payment, delivery acceptance and checks pass'));
    });
    const open = r.lines.filter(l => !TERMINAL_LINE.includes(l.status));
    if (!open.length && S.can('rfq', r.status, 'award')) T(st.audit, 'rfq', r, 'award', meta(ctx));
    else if (open.length && r.status === 'open') T(st.audit, 'rfq', r, 'partial_award', meta(ctx));
    return { payment: pay, replay: false };
  }
  /* Payment provider events (webhooks in live mode; explicit simulation buttons in the demo). Idempotent by eventId. */
  function paymentEvent(st, ev, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['system', 'ops']);
    need(ev && ev.eventId, 'PAYMENT_EVENT_ID_REQUIRED');
    if (st.processedEvents[ev.eventId]) return { duplicate: true };
    const p = find(st.payments, 'id', ev.paymentId, 'PAYMENT_NOT_FOUND');
    const bks = st.bookings.filter(b => b.paymentId === p.id);
    const r = st.rfqs.find(x => x.id === p.rfqId);
    if (ev.type === 'payment.succeeded') {
      need(ev.amount === p.amount.total, 'PAYMENT_AMOUNT_MISMATCH', { expected: p.amount.total, received: ev.amount });
      if (p.status !== 'awaiting') { st.processedEvents[ev.eventId] = ctx.now; return { ignored: true, status: p.status }; }
      T(st.audit, 'payment', p, 'pay', meta(ctx, '', { eventId: ev.eventId, simulated: !!ev.simulated }));
      p.paidAt = ctx.now; p.simulated = !!ev.simulated;
      bks.forEach(b => {
        try { Inv.confirm(st, st.audit, b.allocationId, meta(ctx)); T(st.audit, 'booking', b, 'confirm', meta(ctx, 'Payment received'));
          const l = r && r.lines.find(x => x.id === b.lineId); if (l && l.status === 'reserved') T(st.audit, 'offer', l, 'book', meta(ctx));
        } catch (e) {
          if (e.code !== 'RESERVATION_EXPIRED') throw e;
          T(st.audit, 'booking', b, 'expire', meta(ctx, 'Hold expired before payment arrived'));
          const l = r && r.lines.find(x => x.id === b.lineId); if (l && l.status === 'reserved') T(st.audit, 'offer', l, 'expire', meta(ctx));
          cancelPayout(st, b, ctx, 'Booking expired');
          requestRefundInternal(st, b, b.money.total, 'Hold expired before payment arrived', ctx);
        }
      });
    } else if (ev.type === 'payment.failed') {
      if (p.status !== 'awaiting') { st.processedEvents[ev.eventId] = ctx.now; return { ignored: true, status: p.status }; }
      T(st.audit, 'payment', p, 'fail', meta(ctx, String(ev.reason || 'Payment failed')));
      releaseFor(st, p, bks, r, ctx, 'Payment failed');
    } else throw new DomainError('PAYMENT_EVENT_UNKNOWN', { type: ev.type });
    st.processedEvents[ev.eventId] = ctx.now;
    return { payment: p };
  }
  function releaseFor(st, p, bks, r, ctx, reason) {
    bks.forEach(b => {
      Inv.release(st, st.audit, b.allocationId, meta(ctx, reason));
      if (S.can('booking', b.status, 'cancel')) T(st.audit, 'booking', b, 'cancel', meta(ctx, reason));
      else if (S.can('booking', b.status, 'expire')) T(st.audit, 'booking', b, 'expire', meta(ctx, reason));
      cancelPayout(st, b, ctx, reason);
      const l = r && r.lines.find(x => x.id === b.lineId);
      if (l && l.status === 'reserved') T(st.audit, 'offer', l, 'release', meta(ctx, reason)); // back to accepted: the customer may retry
    });
  }
  /* Expire holds whose time ran out and the payments waiting on them. */
  function expireHolds(st, ctx) {
    ctx = c(ctx); ensureState(st);
    Inv.sweep(st, st.audit, ctx.now);
    const out = [];
    st.payments.filter(p => p.status === 'awaiting').forEach(p => {
      const bks = st.bookings.filter(b => b.paymentId === p.id);
      const allExpired = bks.length && bks.every(b => { const a = st.allocations.find(x => x.id === b.allocationId); return !a || a.status === 'expired'; });
      if (allExpired) {
        T(st.audit, 'payment', p, 'expire', meta(ctx, 'Hold expired before payment'));
        releaseFor(st, p, bks, st.rfqs.find(x => x.id === p.rfqId), ctx, 'Hold expired before payment');
        out.push(p);
      }
    });
    return out;
  }

  /* ---------- Delivery, disputes, refunds, payouts ---------- */
  const SUPPLIER_EVENTS = ['prepare', 'go_live', 'complete'];
  function advanceBooking(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    const b = find(st.bookings, 'id', args.bookingId, 'BOOKING_NOT_FOUND');
    const ev = args.event;
    need(SUPPLIER_EVENTS.includes(ev), 'BOOKING_EVENT_INVALID', { event: ev });
    authorize(ctx, ['supplier', 'ops'], b.supplierId);
    const p = st.payments.find(x => x.id === b.paymentId);
    need(p && (p.status === 'paid' || p.status === 'partially_refunded'), 'PAYMENT_NOT_COMPLETED', { status: p && p.status });
    if (ev === 'go_live') need(ctx.today >= b.from, 'BOOKING_NOT_STARTED', { from: b.from });
    T(st.audit, 'booking', b, ev, meta(ctx));
    return b;
  }
  const METHODS = ['counted', 'system', 'estimated', 'declared'];
  function submitReport(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    const b = find(st.bookings, 'id', args.bookingId, 'BOOKING_NOT_FOUND');
    authorize(ctx, ['supplier'], b.supplierId);
    need(['live', 'completed'].includes(b.status), 'BOOKING_STATUS', { status: b.status });
    const metrics = (args.metrics || []).map(x => ({ name: String(x.name || '').slice(0, 80), value: Number(x.value), unit: String(x.unit || '').slice(0, 40), method: METHODS.includes(x.method) ? x.method : 'declared', note: String(x.note || '').slice(0, 300) }));
    need(metrics.length && metrics.every(x => x.name && Number.isFinite(x.value) && x.value >= 0), 'REPORT_INVALID');
    b.report = { submittedAt: ctx.now, by: ctx.actor, metrics, verification: 'supplier_declared' };
    S.audit(st.audit, 'booking', b.id, 'report', meta(ctx, '', { metrics: metrics.length }));
    return b;
  }
  function acceptDelivery(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['customer']);
    const b = find(st.bookings, 'id', args.bookingId, 'BOOKING_NOT_FOUND');
    need(b.report, 'BOOKING_REPORT_REQUIRED');
    T(st.audit, 'booking', b, 'accept_delivery', meta(ctx));
    b.deliveryAcceptedAt = ctx.now;
    refreshPayout(st, b, ctx);
    return b;
  }
  function setOutcome(st, args, ctx) {
    ctx = c(ctx); authorize(ctx, ['customer']);
    const b = find(st.bookings, 'id', args.bookingId, 'BOOKING_NOT_FOUND');
    need(['delivery_accepted', 'completed'].includes(b.status), 'BOOKING_STATUS', { status: b.status });
    const n = args.newCustomers == null || args.newCustomers === '' ? null : Number(args.newCustomers);
    need(n == null || (Number.isSafeInteger(n) && n >= 0), 'OUTCOME_INVALID', { field: 'newCustomers' });
    const rev = args.revenueMinor == null ? null : args.revenueMinor;
    need(rev == null || (Number.isSafeInteger(rev) && rev >= 0), 'OUTCOME_INVALID', { field: 'revenue' });
    need(n != null || rev != null, 'OUTCOME_EMPTY');
    b.outcome = { at: ctx.now, newCustomers: n, revenueMinor: rev, how: ['code', 'form', 'pos', 'other'].includes(args.how) ? args.how : 'other', source: 'customer_declared' };
    S.audit(st.audit, 'booking', b.id, 'outcome', meta(ctx));
    return b;
  }
  function openDispute(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['customer']);
    const b = find(st.bookings, 'id', args.bookingId, 'BOOKING_NOT_FOUND');
    const reason = String(args.reason || '').trim();
    need(reason.length >= 10, 'DISPUTE_REASON_REQUIRED');
    T(st.audit, 'booking', b, 'dispute', meta(ctx, reason));
    const d = { id: id('dp'), number: num(st, 'dp', 'DSP', ctx), bookingId: b.id, status: 'open', reason: reason.slice(0, 1000), openedAt: ctx.now, by: ctx.actor };
    st.disputes.unshift(d); b.disputeId = d.id;
    S.audit(st.audit, 'dispute', d.id, 'open', meta(ctx, reason));
    const po = st.payouts.find(x => x.id === b.payoutId);
    if (po && S.can('payout', po.status, 'withhold')) T(st.audit, 'payout', po, 'withhold', meta(ctx, 'Dispute opened'));
    return d;
  }
  function resolveDispute(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['ops']);
    const d = find(st.disputes, 'id', args.disputeId, 'DISPUTE_NOT_FOUND');
    const b = find(st.bookings, 'id', d.bookingId, 'BOOKING_NOT_FOUND');
    const note = String(args.reason || '').trim();
    need(note.length >= 5, 'DISPUTE_RESOLUTION_REASON_REQUIRED');
    if (args.outcome === 'supplier') {
      T(st.audit, 'dispute', d, 'resolve_supplier', meta(ctx, note));
      T(st.audit, 'booking', b, 'resolve_delivered', meta(ctx, note)); b.deliveryAcceptedAt = ctx.now;
      const po = st.payouts.find(x => x.id === b.payoutId); if (po && po.status === 'withheld') T(st.audit, 'payout', po, 'hold', meta(ctx, 'Dispute resolved'));
      refreshPayout(st, b, ctx);
    } else if (args.outcome === 'customer') {
      T(st.audit, 'dispute', d, 'resolve_customer', meta(ctx, note));
      T(st.audit, 'booking', b, 'resolve_refund', meta(ctx, note));
      cancelPayout(st, b, ctx, 'Refund to customer');
      requestRefundInternal(st, b, b.money.total, note, ctx);
    } else throw new DomainError('DISPUTE_OUTCOME_INVALID');
    d.resolvedAt = ctx.now; d.resolution = note;
    return d;
  }
  function cancelBooking(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['customer', 'ops']);
    const b = find(st.bookings, 'id', args.bookingId, 'BOOKING_NOT_FOUND');
    need(S.can('booking', b.status, 'cancel'), 'BOOKING_CANCEL_NOT_ALLOWED', { status: b.status });
    const reason = String(args.reason || 'Cancelled').slice(0, 300);
    T(st.audit, 'booking', b, 'cancel', meta(ctx, reason));
    Inv.release(st, st.audit, b.allocationId, meta(ctx, reason));
    cancelPayout(st, b, ctx, reason);
    const p = st.payments.find(x => x.id === b.paymentId);
    if (p && (p.status === 'paid' || p.status === 'partially_refunded')) requestRefundInternal(st, b, b.money.total, reason, ctx);
    return b;
  }
  function requestRefundInternal(st, b, amount, reason, ctx) {
    const rf = { id: id('rf'), number: num(st, 'rf', 'RFD', ctx), bookingId: b.id, paymentId: b.paymentId, amount, status: 'requested', reason: String(reason || '').slice(0, 300), createdAt: ctx.now };
    st.refunds.unshift(rf);
    S.audit(st.audit, 'refund', rf.id, 'request', meta(ctx, reason, { amount }));
    return rf;
  }
  function decideRefund(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['ops']);
    const rf = find(st.refunds, 'id', args.refundId, 'REFUND_NOT_FOUND');
    if (args.decision === 'reject') { T(st.audit, 'refund', rf, 'reject', meta(ctx, args.reason)); return rf; }
    if (rf.status === 'requested') T(st.audit, 'refund', rf, 'approve', meta(ctx, args.reason));
    return rf;
  }
  /* Refund money movement happens through the payment adapter; this records its confirmed result. */
  function refundProcessed(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['system', 'ops']);
    if (args.eventId && st.processedEvents[args.eventId]) return { duplicate: true };
    const rf = find(st.refunds, 'id', args.refundId, 'REFUND_NOT_FOUND');
    need(rf.status === 'approved' || rf.status === 'failed', 'REFUND_NOT_APPROVED', { status: rf.status });
    T(st.audit, 'refund', rf, 'process', meta(ctx, '', { simulated: !!args.simulated }));
    rf.processedAt = ctx.now; rf.simulated = !!args.simulated;
    const p = find(st.payments, 'id', rf.paymentId, 'PAYMENT_NOT_FOUND');
    const refunded = st.refunds.filter(x => x.paymentId === p.id && x.status === 'processed').reduce((t, x) => t + x.amount, 0);
    p.refunded = refunded;
    T(st.audit, 'payment', p, refunded >= p.amount.total ? 'refund_full' : 'refund_partial', meta(ctx, '', { refunded }));
    if (args.eventId) st.processedEvents[args.eventId] = ctx.now;
    return rf;
  }
  function cancelPayout(st, b, ctx, reason) {
    const po = st.payouts.find(x => x.id === b.payoutId);
    if (po && S.can('payout', po.status, 'cancel')) T(st.audit, 'payout', po, 'cancel', meta(ctx, reason));
  }

  /* The five conditions a payout must meet before release. All are re-checked at release time. */
  function payoutGuards(st, bookingId, ctx) {
    ctx = c(ctx);
    const b = st.bookings.find(x => x.id === bookingId);
    const p = b && st.payments.find(x => x.id === b.paymentId);
    const s = b && sup(st, b.supplierId);
    const v = s && s.verification;
    const refunds = b ? st.refunds.filter(x => x.bookingId === b.id && ['requested', 'approved', 'processed', 'failed'].includes(x.status)) : [];
    return [
      { guard: 'payment_received', ok: !!(p && (p.status === 'paid' || (p.status === 'partially_refunded' && !refunds.length))) },
      { guard: 'delivery_accepted', ok: !!(b && b.status === 'delivery_accepted') },
      { guard: 'no_open_dispute', ok: !!(b && !st.disputes.some(d => d.bookingId === b.id && ['open', 'under_review'].includes(d.status))) },
      { guard: 'no_refund_outstanding', ok: refunds.length === 0 },
      { guard: 'supplier_licence_reviewed', ok: !!(v && v.status === 'licence_reviewed' && (!v.licenceExpiry || v.licenceExpiry >= ctx.today)) }
    ];
  }
  function refreshPayout(st, b, ctx) {
    const po = st.payouts.find(x => x.id === b.payoutId);
    if (!po || po.status !== 'held') return po;
    if (payoutGuards(st, b.id, ctx).every(g => g.ok)) T(st.audit, 'payout', po, 'make_eligible', meta(ctx, 'All payout checks passed'));
    return po;
  }
  function releasePayout(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['ops']);
    const po = find(st.payouts, 'id', args.payoutId, 'PAYOUT_NOT_FOUND');
    if (po.status === 'released') return { payout: po, replay: true };
    const b = find(st.bookings, 'id', po.bookingId, 'BOOKING_NOT_FOUND');
    if (po.status === 'held') refreshPayout(st, b, ctx);
    const g = payoutGuards(st, b.id, ctx);
    const failed = g.filter(x => !x.ok).map(x => x.guard);
    if (failed.length) throw new DomainError('PAYOUT_GUARDS_FAILED', { failed });
    need(po.status === 'eligible', 'PAYOUT_NOT_ELIGIBLE', { status: po.status });
    T(st.audit, 'payout', po, 'release', meta(ctx, args.reason || '', { simulated: ctx.mode === 'demo' }));
    po.releasedAt = ctx.now; po.simulated = ctx.mode === 'demo';
    return { payout: po, replay: false };
  }

  /* ---------- Supplier verification ---------- */
  function validateDocument(doc) {
    const errs = [];
    if (!doc || typeof doc !== 'object') return [{ code: 'doc.missing' }];
    if (!DOC_TYPES.includes(doc.type)) errs.push({ code: 'doc.type', allowed: DOC_TYPES });
    if (!Number.isSafeInteger(doc.size) || doc.size <= 0 || doc.size > DOC_MAX_BYTES) errs.push({ code: 'doc.size', max: DOC_MAX_BYTES });
    if (!['demo-sample', 'server', 'local-only'].includes(doc.storage)) errs.push({ code: 'doc.storage' });
    return errs;
  }
  function submitVerification(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    const s = find(st.suppliers, 'id', args.supplierId, 'SUPPLIER_NOT_FOUND');
    authorize(ctx, ['supplier'], s.id);
    const doc = args.document;
    const errs = validateDocument(doc);
    if (errs.length) throw new DomainError('DOCUMENT_INVALID', { errors: errs });
    const lic = String(args.licenceNumber || '').trim();
    need(/^[A-Za-z0-9\-\/]{3,30}$/.test(lic), 'LICENCE_NUMBER_INVALID');
    s.licenceNumber = lic;
    const v = s.verification = s.verification || { status: 'not_submitted', documents: [], decisions: [] };
    v.documents = (v.documents || []).concat([Object.assign({ id: id('doc'), uploadedAt: ctx.now }, doc)]);
    const from = v.status; v.status = 'submitted'; v.submittedAt = ctx.now;
    S.audit(st.audit, 'verification', s.id, 'submit', meta(ctx, '', { from, storage: doc.storage, simulated: !!doc.simulated }));
    return s;
  }
  function reviewVerification(st, args, ctx) {
    ctx = c(ctx); ensureState(st);
    authorize(ctx, ['ops']);
    const s = find(st.suppliers, 'id', args.supplierId, 'SUPPLIER_NOT_FOUND');
    const v = s.verification || {};
    const reason = String(args.reason || '').trim();
    if (args.decision === 'approve') {
      const doc = (v.documents || []).slice().reverse().find(d => d.storage === 'server' || d.storage === 'demo-sample');
      need(doc, 'VERIFICATION_NO_REVIEWABLE_DOCUMENT');
      if (doc.storage === 'demo-sample') need(ctx.mode === 'demo', 'VERIFICATION_SAMPLE_NOT_ALLOWED_LIVE');
      if (doc.storage === 'server') need(doc.scan === 'clean', 'VERIFICATION_DOCUMENT_NOT_SCANNED', { scan: doc.scan || 'pending' });
      const ch = args.checks || {};
      need(ch.nameMatches && ch.numberMatches && ch.documentLegible, 'VERIFICATION_CHECKS_INCOMPLETE', { checks: ch });
      need(Dt.isIso(args.licenceExpiry) && args.licenceExpiry > ctx.today, 'VERIFICATION_EXPIRY_INVALID');
      v.status = 'licence_reviewed'; v.licenceExpiry = args.licenceExpiry; v.reviewedAt = ctx.now; v.simulated = doc.storage === 'demo-sample';
      v.reviewedSnapshot = { name: s.name && (s.name.en || s.name.ar), licenceNumber: s.licenceNumber, documentId: doc.id };
    } else if (args.decision === 'reject' || args.decision === 'request_info') {
      need(reason.length >= 5, 'VERIFICATION_REASON_REQUIRED');
      v.status = args.decision === 'reject' ? 'rejected' : 'info_requested';
    } else throw new DomainError('VERIFICATION_DECISION_INVALID');
    v.decisions = (v.decisions || []).concat([{ at: ctx.now, reviewer: ctx.actor, decision: args.decision, reason, checks: args.checks || null, simulated: ctx.mode === 'demo' }]);
    s.verification = v;
    S.audit(st.audit, 'verification', s.id, args.decision, meta(ctx, reason));
    return s;
  }
  /* A supplier changing their legal name or licence number after review needs a new review. */
  function updateSupplierProfile(st, args, ctx) {
    ctx = c(ctx); const s = find(st.suppliers, 'id', args.supplierId, 'SUPPLIER_NOT_FOUND');
    authorize(ctx, ['supplier', 'ops'], s.id);
    const before = { name: s.name && (s.name.en || s.name.ar), licenceNumber: s.licenceNumber };
    if (args.name) s.name = args.name;
    if (args.contact != null) s.contact = String(args.contact).slice(0, 160);
    if (args.licenceNumber != null) s.licenceNumber = String(args.licenceNumber).trim();
    if (args.vatRegistered != null) s.vatRegistered = !!args.vatRegistered;
    const after = { name: s.name && (s.name.en || s.name.ar), licenceNumber: s.licenceNumber };
    const v = s.verification;
    if (v && v.status === 'licence_reviewed' && (before.name !== after.name || before.licenceNumber !== after.licenceNumber)) {
      v.status = 'submitted'; v.decisions = (v.decisions || []).concat([{ at: ctx.now, reviewer: 'system', decision: 'review_required', reason: 'Legal name or licence number changed' }]);
      S.audit(st.audit, 'verification', s.id, 'review_required', meta(ctx, 'Profile changed after review'));
    }
    return s;
  }

  CON.Domain = {
    DOC_TYPES, DOC_MAX_BYTES, ensureState, authorize, validateListing, saveListing, removeListing, setListingStatus, listingReferenced,
    createRfq, respond, withdraw, approve, unapprove, expireOffers, budgetUse,
    checkout, paymentEvent, expireHolds, advanceBooking, submitReport, acceptDelivery, setOutcome,
    openDispute, resolveDispute, cancelBooking, decideRefund, refundProcessed, payoutGuards, releasePayout,
    validateDocument, submitVerification, reviewVerification, updateSupplierProfile
  };
})(typeof window !== 'undefined' ? window : globalThis);
