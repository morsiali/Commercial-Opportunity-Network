/* Offers: versioned supplier responses to RFQ lines, deviation detection, and the validation that
   runs at approval and again at checkout. A material revision invalidates any earlier approval. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const Dt = CON.Dates, M = CON.Money, S = CON.States, Inv = CON.Inventory;
  const DomainError = S.DomainError;

  /* Fields that define the commercial deal. Changing any of them is a material revision. */
  const MATERIAL = ['basePrice', 'setupFee', 'units', 'dates', 'reporting', 'deliverables', 'terms', 'validUntil', 'vatRegistered'];
  const REPORTING_RANK = { none: 0, basic: 1, detailed: 2 };

  function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function contentHash(offer) { const o = {}; MATERIAL.forEach(k => { o[k] = offer[k] === undefined ? null : offer[k]; }); return hash(JSON.stringify(o)); }

  /* Activation dates an offer covers, from a date window and the listing schedule. */
  function datesFor(op, from, to, units) {
    if (!Dt.isIso(from) || !Dt.isIso(to) || to < from) return [];
    if (op.unit === 'activation') {
      const ev = (op.eventDates || []).filter(d => d >= from && d <= to);
      return ev.length ? ev.slice(0, Math.max(1, units || 1)) : (op.eventDates && op.eventDates.length ? [] : [from]);
    }
    const days = (op.schedule && op.schedule.days && op.schedule.days.length) ? op.schedule.days : [0, 1, 2, 3, 4, 5, 6];
    const list = Dt.range(from, to).filter(d => days.includes(Dt.weekday(d)));
    if (op.unit === 'day' && units) return list.slice(0, units);
    return list;
  }

  /* Validate a supplier's offer input and build an offer version. */
  function buildVersion(line, op, input, ctx) {
    const errors = [];
    const today = (ctx && ctx.today) || Dt.today();
    const int = (v, k, min) => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; if (!Number.isSafeInteger(n) || n < (min || 0)) { errors.push({ field: k, code: 'offer.field.invalid' }); return null; } return n; };
    const basePrice = int(input.basePrice, 'basePrice', 0);
    const setupFee = int(input.setupFee == null ? 0 : input.setupFee, 'setupFee', 0);
    const units = int(input.units, 'units', 1);
    if (!Dt.isIso(input.from)) errors.push({ field: 'from', code: 'offer.field.date' });
    if (!Dt.isIso(input.to)) errors.push({ field: 'to', code: 'offer.field.date' });
    if (Dt.isIso(input.from) && Dt.isIso(input.to) && input.to < input.from) errors.push({ field: 'to', code: 'offer.field.order' });
    if (!Dt.isIso(input.validUntil)) errors.push({ field: 'validUntil', code: 'offer.field.date' });
    else if (input.validUntil < today) errors.push({ field: 'validUntil', code: 'offer.validity.past' });
    const reporting = REPORTING_RANK[input.reporting] != null ? input.reporting : 'basic';
    const deliverables = (Array.isArray(input.deliverables) ? input.deliverables : String(input.deliverables || '').split(/\n|;/)).map(s => String(s).trim()).filter(Boolean).slice(0, 20);
    if (!deliverables.length) errors.push({ field: 'deliverables', code: 'offer.field.deliverables' });
    if (errors.length) throw new DomainError('OFFER_INVALID', { errors });
    const dates = Array.isArray(input.dates) && input.dates.every(Dt.isIso) ? input.dates.slice().sort() : datesFor(op, input.from, input.to, op.unit === 'day' ? units : null);
    if (!dates.length) throw new DomainError('OFFER_INVALID', { errors: [{ field: 'from', code: 'offer.field.nodates' }] });
    const v = {
      basePrice, setupFee, units, from: input.from, to: input.to, dates, reporting, deliverables,
      terms: input.terms === 'split' ? 'split' : 'full', validUntil: input.validUntil, notes: String(input.notes || '').slice(0, 1000),
      vatRegistered: input.vatRegistered !== false, listingVersion: op.version || 1
    };
    v.deviations = deviations(line, op, v);
    v.partial = v.deviations.some(d => d.field === 'coverage');
    v.hash = contentHash(v);
    return v;
  }

  /* Differences between what was requested and what is offered. Each needs explicit customer acceptance. */
  function deviations(line, op, v) {
    const out = [];
    const req = line.requested || {};
    const cov = req.coverage || {};
    const reqDates = cov.coveredDates || [];
    const missing = reqDates.filter(d => !v.dates.includes(d));
    if ((cov.purchasedUnits && v.units < cov.purchasedUnits) || missing.length) out.push({ field: 'coverage', requestedUnits: cov.purchasedUnits || null, offeredUnits: v.units, missingDates: missing.length, requestedDates: reqDates.length, offeredDates: v.dates.length });
    if (line.window && (v.dates[0] < line.window.from || v.dates[v.dates.length - 1] > line.window.to)) out.push({ field: 'dates', outside: v.dates.filter(d => d < line.window.from || d > line.window.to).length });
    if (req.price && !req.price.onRequest) {
      const offeredNet = v.basePrice + v.setupFee;
      if (offeredNet > req.price.net) out.push({ field: 'price', requestedNet: req.price.net, offeredNet });
    }
    if ((REPORTING_RANK[v.reporting] || 0) < (REPORTING_RANK[line.reporting] || 0)) out.push({ field: 'reporting', requested: line.reporting, offered: v.reporting });
    const reqDel = line.requiredDeliverables || [];
    const lower = v.deliverables.map(x => x.toLowerCase());
    const missingDel = reqDel.filter(d => !lower.some(x => x.includes(String(d).toLowerCase())));
    if (missingDel.length) out.push({ field: 'deliverables', missing: missingDel });
    return out;
  }

  function current(line) { return line.offers && line.offers.length ? line.offers[line.offers.length - 1] : null; }
  function approvalValid(line) {
    const v = current(line);
    return !!(v && line.approval && line.approval.version === v.version && line.approval.hash === v.hash);
  }
  /* Money for one offer version. */
  function money(v, cfg) { return M.line(M.add(v.basePrice), v.setupFee, Object.assign({}, cfg || {}, { supplierVatRegistered: v.vatRegistered })); }

  /* Checks that run at approval and again at checkout. Returns { ok, errors, warnings }. */
  function validate(line, ctx) {
    const errors = [], warnings = [];
    const v = current(line);
    const today = ctx.today || Dt.today();
    if (!v) { errors.push({ code: 'OFFER_MISSING' }); return { ok: false, errors, warnings }; }
    if (!['offered', 'accepted'].includes(line.status)) errors.push({ code: 'OFFER_STATUS', status: line.status });
    if (v.validUntil < today) errors.push({ code: 'OFFER_EXPIRED', validUntil: v.validUntil });
    const op = ctx.listing;
    if (!op || op.status !== 'active') errors.push({ code: 'LISTING_UNAVAILABLE', status: op ? op.status : 'missing' });
    else if ((op.version || 1) !== v.listingVersion) warnings.push({ code: 'LISTING_CHANGED_SINCE_OFFER', from: v.listingVersion, to: op.version });
    if (v.dates[0] < today) errors.push({ code: 'OFFER_DATES_PAST', first: v.dates[0] });
    else if (op && op.leadDays && Dt.diffDays(today, v.dates[0]) < op.leadDays && ctx.stage === 'checkout') warnings.push({ code: 'OFFER_NOTICE_SHORT', lead: op.leadDays });
    if (op && (v.dates[0] < op.availableFrom || v.dates[v.dates.length - 1] > op.availableTo)) errors.push({ code: 'OFFER_OUTSIDE_AVAILABILITY' });
    if (ctx.state && op && op.status === 'active') {
      const nowMs = ctx.now ? Date.parse(ctx.now) : Date.now();
      const full = v.dates.filter(d => Inv.free(ctx.state, op, d, nowMs, ctx.ref) < 1);
      if (full.length) errors.push({ code: 'INVENTORY_UNAVAILABLE', dates: full });
    }
    const sup = ctx.supplier;
    const ver = sup && sup.verification;
    const verOk = !!(ver && ver.status === 'licence_reviewed' && (!ver.licenceExpiry || ver.licenceExpiry >= today));
    if (!verOk) (ctx.verifiedOnly ? errors : warnings).push({ code: 'SUPPLIER_NOT_REVIEWED', status: ver ? ver.status : 'unknown' });
    const accepted = (line.approval && line.approval.acceptedDeviations) || ctx.acceptedDeviations || [];
    const unaccepted = v.deviations.filter(d => !accepted.includes(d.field));
    if (unaccepted.length) errors.push({ code: 'OFFER_DEVIATION_UNACCEPTED', fields: unaccepted.map(d => d.field) });
    return { ok: !errors.length, errors, warnings };
  }

  CON.Offers = { MATERIAL, REPORTING_RANK, contentHash, datesFor, buildVersion, deviations, current, approvalValid, money, validate };
})(typeof window !== 'undefined' ? window : globalThis);
