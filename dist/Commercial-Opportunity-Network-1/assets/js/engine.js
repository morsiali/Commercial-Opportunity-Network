/* Commercial Opportunity Network — Opportunity Engine (v3)
   Stage 1: mandatory eligibility (pass / fail / confirmation required) — a failure can never be outscored.
   Stage 2: preference scoring for eligible listings only.
   Coverage, quantities and prices are computed explicitly; money is integer fils via CON.Money.
   Evidence is reported as separate dimensions and never folded into the match score. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const Dt = CON.Dates, M = CON.Money;

  const WEIGHTS = { objective: .25, audience: .20, location: .15, budget: .15, coverage: .15, availability: .10 };
  const FACTORS = Object.keys(WEIGHTS);
  const CATEGORIES = ['food', 'beverage', 'personal_care', 'health', 'fitness', 'tech', 'finance', 'retail', 'other'];
  const FACILITIES = ['foodSampling', 'refrigeration', 'electricity', 'staffing'];
  const FAC_KEY = { foodSampling: 'foodSampling', refrigeration: 'refrigeration', electricity: 'electricity', staffing: 'staffingProvided' }; // brief need → listing field
  const FRESH = { availabilityDays: 30, evidenceMonths: 12 };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r2 = v => Math.round(v * 100) / 100;

  /* ---------- Objective (brief) ---------- */
  function normalizeObjective(o, opts) {
    const D = CON.DATA; const today = (opts && opts.today) || Dt.today();
    const out = Object.assign({}, o);
    out.objective = D.objectives.includes(o.objective) ? o.objective : 'trial';
    out.gender = ['all', 'female', 'male'].includes(o.gender) ? o.gender : 'all';
    out.ageMin = clamp(parseInt(o.ageMin, 10) || 18, 13, 99);
    out.ageMax = clamp(parseInt(o.ageMax, 10) || 60, out.ageMin + 1, 99);
    out.interests = Array.isArray(o.interests) ? o.interests.filter(i => D.interests.includes(i)) : [];
    let areas = Array.isArray(o.areas) ? o.areas.filter(a => a === 'all' || D.areas[a]) : [];
    if (!areas.length || areas.includes('all')) areas = ['all'];
    out.areas = areas;
    out.budgetMinor = Number.isSafeInteger(o.budgetMinor) ? o.budgetMinor : (o.budget != null ? safeMinor(o.budget) : 5000000);
    out.duration = clamp(parseInt(o.duration, 10) || 30, 1, 365);
    out.start = Dt.isIso(o.start) ? o.start : Dt.addDays(today, 21);
    out.end = Dt.addDays(out.start, out.duration - 1);
    out.product = String(o.product || '').slice(0, 120);
    out.success = String(o.success || '').slice(0, 200);
    out.target = o.target ? Math.max(0, Math.round(Number(o.target))) : null;
    out.productCategory = CATEGORIES.includes(o.productCategory) ? o.productCategory : null; // null = not stated yet
    const rq = o.requirements || {};
    out.requirements = {
      audience: rq.audience === 'required' ? 'required' : 'preferred',
      areas: rq.areas === 'required' ? 'required' : 'preferred',
      verifiedOnly: !!rq.verifiedOnly,
      coverage: rq.coverage === 'full' ? 'full' : 'partial_ok'
    };
    const nd = o.needs || {};
    out.needs = {}; FACILITIES.forEach(k => { out.needs[k] = !!nd[k]; });
    return out;
  }
  function safeMinor(aed) { try { return M.fromAED(aed); } catch (e) { return 5000000; } }

  /* ---------- Coverage, quantity and price ---------- */
  /* Returns how much of the campaign a listing can actually cover and what would be billed. */
  function coverage(op, brief) {
    const camp = { from: brief.start, to: brief.end, days: brief.duration };
    const win = Dt.overlap(brief.start, brief.end, op.availableFrom, op.availableTo);
    const schedDays = (op.schedule && Array.isArray(op.schedule.days) && op.schedule.days.length) ? op.schedule.days : [0, 1, 2, 3, 4, 5, 6];
    const everyDay = schedDays.length === 7;
    const res = { unit: op.unit, calendarDays: camp.days, windowDays: win ? win.days : 0, scheduleDays: schedDays, everyDay, minimumApplied: false, overMax: 0, outsideWindowDays: camp.days - (win ? win.days : 0) };
    if (!win) return Object.assign(res, { status: 'none', neededUnits: 0, purchasedUnits: 0, activationDates: [], coveredDates: [], ratio: 0 });
    if (op.unit === 'activation') {
      const events = (op.eventDates || []).filter(d => d >= win.from && d <= win.to);
      const dates = events.length ? [events[0]] : [];
      return Object.assign(res, { status: events.length ? 'event' : (op.eventDates && op.eventDates.length ? 'none' : 'event-tbc'), neededUnits: 1, purchasedUnits: events.length || !(op.eventDates && op.eventDates.length) ? 1 : 0, activationDates: dates, coveredDates: dates, eventDates: events, ratio: events.length || !(op.eventDates && op.eventDates.length) ? 1 : 0 });
    }
    const all = Dt.range(win.from, win.to);
    const activation = all.filter(d => schedDays.includes(Dt.weekday(d)));
    let needed, unitDates;
    if (op.unit === 'day') { needed = activation.length; unitDates = activation.map(d => [d]); }
    else {
      const len = op.unit === 'week' ? 7 : 30;
      unitDates = []; for (let i = 0; i < all.length; i += len) unitDates.push(all.slice(i, i + len).filter(d => schedDays.includes(Dt.weekday(d))));
      needed = unitDates.length;
    }
    const maxU = op.maxUnits && op.maxUnits > 0 ? op.maxUnits : needed;
    const minU = op.minUnits && op.minUnits > 0 ? op.minUnits : 1;
    let purchased = Math.min(needed, maxU);
    const overMax = needed - purchased;
    if (purchased < minU && needed > 0) { purchased = minU; res.minimumApplied = true; }
    const coveredDates = [].concat.apply([], unitDates.slice(0, Math.min(needed, maxU)));
    const uncoveredDates = [].concat.apply([], unitDates.slice(Math.min(needed, maxU)));
    const coveredCalendar = coveredDates.length ? Dt.diffDays(coveredDates[0], coveredDates[coveredDates.length - 1]) + 1 : 0;
    const fullWindow = win.days === camp.days;
    const status = needed === 0 ? 'none' : (overMax === 0 && fullWindow ? 'full' : 'partial');
    const ratio = needed === 0 ? 0 : r2((Math.min(needed, maxU) / needed) * (win.days / camp.days));
    return Object.assign(res, { status, neededUnits: needed, purchasedUnits: purchased, overMax, activationDates: activation, coveredDates, uncoveredDates, coveredCalendarDays: coveredCalendar, ratio });
  }
  function price(op, cov, cfg) {
    if (op.price == null || !Number.isSafeInteger(op.price)) return { onRequest: true };
    const base = M.times(op.price, cov.purchasedUnits);
    const l = M.line(base, op.setupFee || 0, cfg);
    return Object.assign(l, { units: cov.purchasedUnits, unit: op.unit, unitPrice: op.price });
  }

  /* ---------- Evidence profile (separate dimensions) ---------- */
  const METRICS = ['residents', 'members', 'visits', 'attendees', 'people', 'transactions', 'impressions', 'samples', 'leads', 'redemptions', 'units_sold'];
  function evidenceProfile(op, sup, ctx) {
    const today = (ctx && ctx.today) || Dt.today();
    const fresh = e => !e.periodEnd || Dt.diffDays(e.periodEnd.length === 7 ? e.periodEnd + '-28' : e.periodEnd, today) <= FRESH.evidenceMonths * 31;
    const best = kind => {
      const items = (op.evidence || []).filter(e => e.kind === kind);
      if (!items.length) return { level: 'insufficient', items: [] };
      const v = items.filter(e => e.verification === 'verified');
      const level = items.every(e => e.verification === 'sample') ? 'sample' : v.length ? 'verified' : items.some(e => e.verification === 'reviewed') ? 'reviewed' : 'declared';
      return { level, stale: !items.some(fresh), items };
    };
    const ver = (sup && sup.verification) || {};
    const business = ver.status || 'not_reviewed';
    const req = ['title', 'desc', 'price', 'unit', 'availableFrom', 'availableTo', 'audience', 'restrictions', 'schedule'];
    const present = req.filter(k => {
      const v = op[k];
      if (k === 'title' || k === 'desc') return v && (v.en || v.ar);
      if (k === 'restrictions') return v && FACILITIES.some(f => v[FAC_KEY[f]] != null);
      if (k === 'audience') return v && v.ageMin != null && (v.interests || []).length;
      return v != null && v !== '';
    }).length;
    const updated = op.availabilityUpdatedAt || null;
    const availability = !updated ? 'unknown' : Dt.diffDays(updated, today) <= FRESH.availabilityDays ? 'fresh' : 'stale';
    const deliveredCount = ctx && ctx.deliveredCount ? ctx.deliveredCount(op.id) : 0;
    const delivery = best('delivery');
    return {
      business, businessExpiry: ver.licenceExpiry || null,
      completeness: Math.round(present / req.length * 100),
      audience: best('audience'), delivery: Object.assign(delivery, { platformBookings: deliveredCount }),
      outcome: best('outcome'),
      availability, availabilityUpdatedAt: updated
    };
  }

  /* ---------- Stage 1: eligibility ---------- */
  function eligibility(op, sup, brief, ctx) {
    const D = CON.DATA; const today = (ctx && ctx.today) || Dt.today();
    const checks = [];
    const add = (key, status, code, p) => checks.push({ key, status, code, p: p || {} });
    const aud = op.audience || {};
    // listing state
    if (op.status !== 'active') add('listing', 'fail', 'e.listing.inactive', { status: op.status });
    // audience access is physical: a ladies-only venue cannot reach men, required or not
    if (aud.access === 'female_only' && brief.gender === 'male') add('access', 'fail', 'e.access.female_only');
    else if (aud.access === 'male_only' && brief.gender === 'female') add('access', 'fail', 'e.access.male_only');
    else if ((aud.access === 'female_only' && brief.gender !== 'female') || (aud.access === 'male_only' && brief.gender !== 'male')) add('access', 'confirm', 'e.access.restricted', { g: aud.access === 'female_only' ? 'female' : 'male' });
    else if (aud.access === 'members_only') add('access', 'confirm', 'e.access.members');
    else add('access', 'pass', 'e.access.ok');
    // audience (age / gender) when required
    if (brief.requirements.audience === 'required') {
      if (aud.ageMin == null || aud.ageMax == null) add('audience', 'confirm', 'e.audience.unknown');
      else {
        const ov = Math.min(brief.ageMax, aud.ageMax) - Math.max(brief.ageMin, aud.ageMin);
        if (ov <= 0) add('audience', 'fail', 'e.audience.age', { a: aud.ageMin, b: aud.ageMax });
        else if (brief.gender !== 'all' && aud.gender && aud.gender !== 'mixed' && aud.gender !== brief.gender) add('audience', 'confirm', 'e.audience.skew', { g: aud.gender });
        else add('audience', 'pass', 'e.audience.ok');
      }
    }
    // location when required
    if (brief.requirements.areas === 'required' && !brief.areas.includes('all')) {
      if (op.area === 'all') add('location', 'confirm', 'e.location.citywide');
      else if (brief.areas.includes(op.area)) add('location', 'pass', 'e.location.ok', { area: op.area });
      else add('location', 'fail', 'e.location.outside', { area: op.area, near: brief.areas.some(a => (D.neighbours[a] || []).includes(op.area)) });
    }
    // product category
    const r = op.restrictions || {};
    if (!brief.productCategory) { if (Array.isArray(r.categoriesAllowed) || (r.categoriesBlocked || []).length) add('category', 'confirm', 'e.category.unspecified', {}); }
    else if ((r.categoriesBlocked || []).includes(brief.productCategory)) add('category', 'fail', 'e.category.blocked', { c: brief.productCategory });
    else if (Array.isArray(r.categoriesAllowed)) add('category', r.categoriesAllowed.includes(brief.productCategory) ? 'pass' : 'fail', r.categoriesAllowed.includes(brief.productCategory) ? 'e.category.ok' : 'e.category.notallowed', { c: brief.productCategory });
    else add('category', 'confirm', 'e.category.unknown', { c: brief.productCategory });
    // facilities and operating conditions the brief requires
    FACILITIES.forEach(f => {
      if (!brief.needs[f]) return;
      const val = r[FAC_KEY[f]];
      if (val === true) add('facility', 'pass', 'e.facility.ok', { f });
      else if (val === false) add('facility', 'fail', 'e.facility.no', { f });
      else add('facility', 'confirm', 'e.facility.unknown', { f });
    });
    // availability, coverage, notice, quantities
    const cov = coverage(op, brief);
    if (cov.status === 'none') add('availability', 'fail', 'e.availability.none');
    else if (cov.status === 'partial') add('coverage', brief.requirements.coverage === 'full' ? 'fail' : 'confirm', 'e.coverage.partial', { covered: cov.coveredDates.length, needed: cov.activationDates.length, outside: cov.outsideWindowDays, overMax: cov.overMax, max: op.maxUnits });
    else if (cov.status === 'event-tbc') add('coverage', 'confirm', 'e.coverage.event_tbc');
    else add('availability', 'pass', cov.status === 'event' ? 'e.availability.event' : 'e.availability.ok', { date: cov.activationDates[0] });
    const lead = Dt.diffDays(today, brief.start);
    if (lead < (op.leadDays || 0)) add('notice', 'fail', 'e.notice.short', { need: op.leadDays, have: lead });
    if (cov.minimumApplied) add('quantity', 'confirm', 'e.quantity.minimum', { min: op.minUnits, unit: op.unit });
    // date-specific capacity
    if (ctx && ctx.capacity && cov.coveredDates && cov.coveredDates.length) {
      const free = ctx.capacity(op, cov.coveredDates);
      if (free.full.length === cov.coveredDates.length) add('capacity', 'fail', 'e.capacity.full');
      else if (free.full.length) add('capacity', 'confirm', 'e.capacity.some', { n: free.full.length });
    }
    // supplier verification
    const vs = sup && sup.verification ? sup.verification.status : 'not_reviewed';
    if (brief.requirements.verifiedOnly && vs !== 'licence_reviewed') add('verification', 'fail', 'e.verification.required');
    // budget policy (net + platform fee, excluding VAT)
    const pr = price(op, cov, ctx && ctx.money);
    if (!pr.onRequest && M.budgetBasis(pr, ctx && ctx.money) > brief.budgetMinor) add('budget', 'fail', 'e.budget.over', { cost: M.budgetBasis(pr, ctx && ctx.money) });
    if (pr.onRequest) add('budget', 'confirm', 'e.budget.on_request');
    const fails = checks.filter(c => c.status === 'fail');
    return { eligible: !fails.length, checks, fails, confirms: checks.filter(c => c.status === 'confirm'), coverage: cov, price: pr };
  }

  /* ---------- Stage 2: preference score (eligible only) ---------- */
  function preference(op, brief, el, ctx) {
    const D = CON.DATA; const aud = op.audience || {};
    const f = {}, why = {};
    const fit = (D.objectiveFit[op.type] || {})[brief.objective];
    f.objective = fit == null ? .5 : fit;
    why.objective = { code: f.objective >= .8 ? 'r.obj.high' : f.objective >= .55 ? 'r.obj.mid' : 'r.obj.low', p: { type: op.type, objective: brief.objective } };
    let age = .5, gender = 1, ints = .7, matched = [];
    if (aud.ageMin != null) { const ov = Math.max(0, Math.min(brief.ageMax, aud.ageMax) - Math.max(brief.ageMin, aud.ageMin)); age = clamp(ov / Math.max(1, brief.ageMax - brief.ageMin), 0, 1); }
    if (brief.gender !== 'all') gender = aud.gender === brief.gender ? 1 : (!aud.gender || aud.gender === 'mixed') ? .75 : .2;
    if (brief.interests.length) { matched = brief.interests.filter(i => (aud.interests || []).includes(i)); ints = (aud.interests || []).length ? matched.length / brief.interests.length : .4; }
    f.audience = r2(.4 * age + .25 * gender + .35 * ints);
    why.audience = { code: 'r.aud', p: { age: Math.round(age * 100), matched } };
    if (op.area === 'all') { f.location = .85; why.location = { code: 'r.geo.city', p: {} }; }
    else if (brief.areas.includes('all')) { f.location = .85; why.location = { code: 'r.geo.all', p: { area: op.area } }; }
    else if (brief.areas.includes(op.area)) { f.location = 1; why.location = { code: 'r.geo.in', p: { area: op.area } }; }
    else if (brief.areas.some(a => (D.neighbours[a] || []).includes(op.area))) { f.location = .6; why.location = { code: 'r.geo.near', p: { area: op.area } }; }
    else { f.location = .2; why.location = { code: 'r.geo.out', p: { area: op.area } }; }
    if (el.price.onRequest) { f.budget = .5; why.budget = { code: 'r.bud.unknown', p: {} }; }
    else { const share = M.budgetBasis(el.price, ctx && ctx.money) / brief.budgetMinor; f.budget = share <= .35 ? 1 : r2(1 - (share - .35) / .65 * .8); why.budget = { code: 'r.bud', p: { pct: Math.round(share * 100) } }; }
    f.coverage = el.coverage.status === 'full' || el.coverage.status === 'event' ? 1 : el.coverage.ratio;
    why.coverage = { code: el.coverage.status === 'partial' ? 'r.cov.partial' : el.coverage.status === 'event' ? 'r.cov.event' : el.coverage.status === 'event-tbc' ? 'r.cov.tbc' : 'r.cov.full', p: { pct: Math.round(el.coverage.ratio * 100), date: el.coverage.activationDates[0] } };
    const capFree = ctx && ctx.capacity ? ctx.capacity(op, el.coverage.coveredDates || []) : null;
    f.availability = capFree ? r2(capFree.minFreeRatio) : 1;
    why.availability = { code: 'r.avail.dates', p: { full: capFree ? capFree.full.length : 0 } };
    const factors = FACTORS.map(k => ({ key: k, weight: WEIGHTS[k], value: f[k], why: why[k] }));
    const score = Math.round(factors.reduce((s, x) => s + x.weight * x.value, 0) * 100);
    return { score, factors };
  }

  function evaluate(op, brief, ctx) {
    const sup = (ctx && ctx.suppliers || CON.DATA.suppliers).find(s => s.id === op.supplierId);
    const el = eligibility(op, sup, brief, ctx);
    const evidence = evidenceProfile(op, sup, ctx);
    const pref = el.eligible ? preference(op, brief, el, ctx) : null;
    const risks = [];
    if (evidence.business !== 'licence_reviewed') risks.push('risk.unverified');
    if (evidence.audience.level === 'insufficient') risks.push('risk.noev');
    if (evidence.availability === 'stale' || evidence.availability === 'unknown') risks.push('risk.stale');
    if (el.coverage.status === 'partial') risks.push('risk.partial');
    return { oppId: op.id, eligible: el.eligible, checks: el.checks, fails: el.fails, confirms: el.confirms, coverage: el.coverage, price: el.price, cost: el.price, evidence, score: pref ? pref.score : null, factors: pref ? pref.factors : [], risks };
  }

  const EVIDENCE_RANK = { verified: 3, reviewed: 2, declared: 1, sample: 1, insufficient: 0 };
  function rank(opps, briefIn, ctx) {
    const brief = briefIn.requirements && briefIn.budgetMinor != null && briefIn.end ? briefIn : normalizeObjective(briefIn, ctx);
    const live = opps.filter(o => o.status !== 'archived');
    const all = live.map(op => evaluate(op, brief, ctx));
    const eligible = all.filter(x => x.eligible).sort((a, b) => b.score - a.score || EVIDENCE_RANK[b.evidence.audience.level] - EVIDENCE_RANK[a.evidence.audience.level] || ((a.price.exVat || 0) - (b.price.exVat || 0)));
    const excluded = all.filter(x => !x.eligible);
    // Relaxed alternatives: excluded only because of a required location or required age band — never for physical access.
    const relaxable = new Set(['location', 'audience']);
    const relaxed = excluded.filter(x => x.fails.every(f => relaxable.has(f.key)) && !x.fails.some(f => f.key === 'access'))
      .map(x => { const op = live.find(o => o.id === x.oppId); const pref = preference(op, brief, { price: x.price, coverage: x.coverage }, ctx); return Object.assign({}, x, { score: pref.score, factors: pref.factors, relaxedOn: x.fails.map(f => f.key) }); })
      .sort((a, b) => b.score - a.score).slice(0, 4);
    const recommended = eligible.filter(x => x.score >= 45).slice(0, 8);
    const recIds = new Set(recommended.map(r => r.oppId));
    const byId = Object.fromEntries(live.map(o => [o.id, o]));
    recommended.forEach(r => {
      const type = byId[r.oppId].type;
      const pool = eligible.filter(e => !recIds.has(e.oppId));
      r.alternatives = pool.filter(e => byId[e.oppId].type === type).concat(pool.filter(e => byId[e.oppId].type !== type)).slice(0, 2).map(a => a.oppId);
    });
    return { objective: brief, all, eligible, excluded, relaxed, recommended };
  }

  /* ---------- Packages (eligible only; totals in fils; VAT shown separately) ---------- */
  function buildPackages(ranking, opps, ctx) {
    const b = ranking.objective; const byId = Object.fromEntries(opps.map(x => [x.id, x]));
    const pool = ranking.eligible.filter(e => !e.price.onRequest && e.score >= 45);
    const cfg = ctx && ctx.money;
    function assemble(id, list, capShare, maxPerType, maxItems, distinctAreas) {
      const cap = Math.floor(b.budgetMinor * capShare);
      const picked = []; let used = 0; const perType = {}; const areas = new Set();
      const tryAdd = (e, newArea) => {
        const op = byId[e.oppId]; const basis = M.budgetBasis(e.price, cfg);
        if (picked.length >= maxItems || picked.includes(e) || (perType[op.type] || 0) >= maxPerType) return;
        if (newArea && areas.has(op.area)) return;
        if (used + basis > cap) return;
        picked.push(e); used += basis; perType[op.type] = (perType[op.type] || 0) + 1; areas.add(op.area);
      };
      if (distinctAreas) list.forEach(e => tryAdd(e, true));
      list.forEach(e => tryAdd(e, false));
      const t = M.totals(picked.map(e => e.price));
      const evidence = {}; picked.forEach(e => (byId[e.oppId].evidence || []).filter(x => x.kind === 'audience').forEach(x => { (evidence[x.metric] = evidence[x.metric] || []).push({ oppId: e.oppId, value: x.value, verification: x.verification, period: x.period }); }));
      return { id, items: picked.map(e => ({ oppId: e.oppId, score: e.score, price: e.price, coverage: e.coverage })), totals: t, budgetBasis: M.budgetBasis(t, cfg), budgetUse: b.budgetMinor ? M.budgetBasis(t, cfg) / b.budgetMinor : 0, avgScore: picked.length ? Math.round(picked.reduce((s, e) => s + e.score, 0) / picked.length) : 0, typesCount: Object.keys(perType).length, areasCount: areas.size, partial: picked.filter(e => e.coverage.status === 'partial').length, evidenceByMetric: evidence };
    }
    const byValue = pool.slice().sort((x, y) => (y.score / Math.sqrt(M.budgetBasis(y.price, cfg) + 1)) - (x.score / Math.sqrt(M.budgetBasis(x.price, cfg) + 1)));
    const out = [];
    [assemble('balanced', pool, 1, 2, 7, false), assemble('lean', byValue, .6, 1, 5, false), assemble('diverse', pool, 1, 1, 7, true)].forEach(p => {
      const sig = p.items.map(i => i.oppId).sort().join('|');
      if (p.items.length && !out.some(q => q.items.map(i => i.oppId).sort().join('|') === sig)) out.push(p);
    });
    return out;
  }

  /* ---------- RFQ ---------- */
  function rfqDeadlineCheck(deadline, brief, opps, today) {
    if (!Dt.isIso(deadline)) return { ok: false, code: 'rfq.deadline.invalid' };
    if (deadline <= today) return { ok: false, code: 'rfq.deadline.past' };
    const maxLead = Math.max(0, ...opps.map(o => o.leadDays || 0));
    const latest = Dt.addDays(brief.start, -maxLead);
    if (deadline > latest) return { ok: false, code: 'rfq.deadline.notice', latest, lead: maxLead };
    return { ok: true, latest };
  }
  function generateRFQ(briefIn, opps, meta, ctx) {
    const b = briefIn.requirements ? briefIn : normalizeObjective(briefIn, ctx);
    return {
      objective: b.objective, product: b.product, productCategory: b.productCategory, success: b.success, target: b.target,
      audience: { gender: b.gender, ageMin: b.ageMin, ageMax: b.ageMax, interests: b.interests }, areas: b.areas,
      requirementsPolicy: b.requirements, needs: b.needs,
      budgetMinor: b.budgetMinor, start: b.start, end: b.end, duration: b.duration,
      lines: opps.map(op => { const cov = coverage(op, b); return { oppId: op.id, supplierId: op.supplierId, requested: { coverage: cov, price: price(op, cov, ctx && ctx.money) } }; }),
      suppliers: Array.from(new Set(opps.map(o => o.supplierId))),
      reporting: (meta && meta.reporting) || 'basic', requirements: (meta && meta.requirements) || '',
      requiredDeliverables: (meta && meta.requiredDeliverables) || [],
      responseDeadline: meta && meta.responseDeadline
    };
  }

  CON.Engine = {
    WEIGHTS, FACTORS, CATEGORIES, FACILITIES, METRICS, FRESH,
    normalizeObjective, coverage, price, eligibility, preference, evaluate, evidenceProfile, rank, buildPackages,
    rfqDeadlineCheck, generateRFQ,
    extract: (t, o) => CON.Parse.extract(t, o),
    util: { todayIso: () => Dt.today(), addDays: Dt.addDays, overlapDays: (a, b, c, d) => { const o = Dt.overlap(a, b, c, d); return o ? o.days : 0; }, diffDays: Dt.diffDays }
  };
})(typeof window !== 'undefined' ? window : globalThis);
