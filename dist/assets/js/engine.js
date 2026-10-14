/* Commercial Opportunity Network — Opportunity Engine
   Deterministic, explainable functions: requirement extraction, matching, packaging,
   RFQ generation and offer normalisation. No randomness except the seeded demo responder. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};

  const WEIGHTS = { objective: .22, audience: .18, geography: .15, budget: .13, timing: .12, availability: .08, evidence: .06, confidence: .06 };
  const FACTORS = Object.keys(WEIGHTS);
  const DAY = 86400000;

  /* ---------- Date helpers (UTC, ISO yyyy-mm-dd) ---------- */
  function toDay(iso) { const p = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function isoOf(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(iso, n) { return isoOf(toDay(iso) + n * DAY); }
  function todayIso(d) { const x = d || new Date(); return isoOf(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())); }
  function overlapDays(aFrom, aTo, bFrom, bTo) {
    const s = Math.max(toDay(aFrom), toDay(bFrom)); const e = Math.min(toDay(aTo), toDay(bTo));
    return e < s ? 0 : Math.round((e - s) / DAY) + 1;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round2 = v => Math.round(v * 100) / 100;

  /* ---------- Objective normalisation ---------- */
  function normalizeObjective(o) {
    const D = CON.DATA;
    const out = Object.assign({}, o);
    out.objective = D.objectives.includes(o.objective) ? o.objective : 'trial';
    out.gender = ['all', 'female', 'male'].includes(o.gender) ? o.gender : 'all';
    out.ageMin = clamp(parseInt(o.ageMin, 10) || 18, 16, 80);
    out.ageMax = clamp(parseInt(o.ageMax, 10) || 60, out.ageMin, 80);
    out.interests = Array.isArray(o.interests) ? o.interests.filter(i => D.interests.includes(i)) : [];
    let areas = Array.isArray(o.areas) ? o.areas.filter(a => a === 'all' || D.areas[a]) : [];
    if (!areas.length || areas.includes('all')) areas = ['all'];
    out.areas = areas;
    out.budget = Math.max(1000, Math.round(Number(o.budget) || 50000));
    out.duration = clamp(parseInt(o.duration, 10) || 30, 1, 365);
    out.start = /^\d{4}-\d{2}-\d{2}$/.test(o.start || '') ? o.start : addDays(todayIso(), 21);
    out.end = addDays(out.start, out.duration - 1);
    out.product = String(o.product || '').slice(0, 120);
    out.success = String(o.success || '').slice(0, 200);
    out.target = o.target ? Math.max(0, Math.round(Number(o.target))) : null;
    return out;
  }

  /* ---------- Requirement extraction (rule-based; replace with an LLM call in production) ---------- */
  function extract(text) {
    const D = CON.DATA;
    const t = String(text || '');
    const lower = t.toLowerCase().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const found = [];
    const fields = {};
    const rawOf = mm => t.slice(mm.index, mm.index + mm[0].length).trim().replace(/[.,;:]+$/, '');
    const num = s => { let v = parseFloat(String(s).replace(/[,٬\s]/g, '')); return isNaN(v) ? null : v; };

    // Budget: "AED 100,000", "100k AED", "100,000 dirhams", "درهم"
    let m = lower.match(/(?:aed|dhs?|د\.?إ)\s*([\d.,]+)\s*(k|m|thousand|million|ألف|مليون)?/) ||
            lower.match(/([\d.,]+)\s*(k|m|thousand|million|ألف|مليون)?\s*(?:aed|dhs?|dirhams?|درهم|د\.?إ)/);
    if (m) {
      let v = num(m[1]);
      const mult = m[2];
      if (v != null) {
        if (mult === 'k' || mult === 'thousand' || mult === 'ألف') v *= 1000;
        if (mult === 'm' || mult === 'million' || mult === 'مليون') v *= 1000000;
        fields.budget = Math.round(v); found.push({ key: 'budget', value: fields.budget, raw: rawOf(m) });
      }
    }
    // Duration
    m = lower.match(/(\d+)\s*(days?|weeks?|months?|يوم|أيام|يوماً|أسبوع|أسابيع|شهر|أشهر)/);
    if (m) {
      const n = parseInt(m[1], 10); const u = m[2];
      let days = n;
      if (/week|أسبوع|أسابيع/.test(u)) days = n * 7;
      if (/month|شهر|أشهر/.test(u)) days = n * 30;
      fields.duration = clamp(days, 1, 365); found.push({ key: 'duration', value: fields.duration, raw: rawOf(m) });
    }
    // Target count: "5,000 new customers", "2000 trials", "500 leads"
    m = lower.match(/([\d][\d,]*)\s*(?:new\s+)?(customers?|clients?|trials?|samples?|leads?|sign-?ups?|visitors?|عميل|عملاء|تجربة|عينة|زائر)/);
    if (m) { const v = num(m[1]); if (v && v !== fields.budget) { fields.target = v; found.push({ key: 'target', value: v, raw: rawOf(m) }); } }
    // Objective keywords (first match wins in this order)
    const objRules = [
      ['trial', /(trial|sampl|taste|try|تجربة|تذوق|عينات)/],
      ['launch', /(launch|introduc|new product|إطلاق)/],
      ['leads', /(lead|sign-?up|registration|demo request|عملاء محتملين|تسجيل)/],
      ['footfall', /(footfall|foot traffic|store visits|visit(?:s|ors) to|زيارات|حركة)/],
      ['acquisition', /(acquire|acquisition|new customers|customers|استقطاب|عملاء جدد|عملاء)/],
      ['awareness', /(awareness|visibility|brand recall|الوعي|انتشار)/]
    ];
    for (const [key, re] of objRules) { const mm = lower.match(re); if (mm) { fields.objective = key; found.push({ key: 'objective', value: key, raw: rawOf(mm) }); break; } }
    // Gender
    m = lower.match(/\b(women|woman|female|ladies|mothers|mums|moms)\b|نساء|سيدات|أمهات|إناث/);
    if (m) { fields.gender = 'female'; found.push({ key: 'gender', value: 'female', raw: rawOf(m) }); }
    else { m = lower.match(/\b(men|male|fathers|dads)\b|رجال|ذكور|آباء/); if (m) { fields.gender = 'male'; found.push({ key: 'gender', value: 'male', raw: rawOf(m) }); } }
    // Age range: "25-45", "25–45", "aged 25 to 45", "25 إلى 45"
    m = lower.match(/(\d{2})\s*(?:-|–|—|to|إلى|الى)\s*(\d{2})(?!\d)/);
    if (m) {
      const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (a >= 14 && b <= 90 && a < b) { fields.ageMin = a; fields.ageMax = b; found.push({ key: 'age', value: a + '–' + b, raw: rawOf(m) }); }
    }
    // Interests
    const intRules = { families: /famil|parents|kids|عائل|أسر/, professionals: /professional|office|corporate|موظف|مهني/, fitness: /fitness|gym|sport|active|لياقة|رياض/, students: /student|universit|college|طلاب|جامع/, tourists: /tourist|visitor|سياح/, affluent: /affluent|premium|luxury|high-income|فاخر|ميسور/, foodies: /food|coffee|café|cafe|مقاه|طعام/, shoppers: /shopper|mall|retail|تسوق/, residents: /resident|communit|سكان|مجتمع/ };
    const ints = [];
    Object.keys(intRules).forEach(k => { const mm = lower.match(intRules[k]); if (mm) ints.push(k); });
    if (ints.length) { fields.interests = ints; found.push({ key: 'interests', value: ints.join(', '), raw: '' }); }
    // Areas
    const areaRules = { marina: /marina|jbr|مارينا/, jlt: /\bjlt\b|lakes towers|أبراج بحيرات/, palm: /palm|نخلة/, barsha: /barsha|برشاء/, hills: /dubai hills|هيلز/, jvc: /\bjvc\b|jumeirah village|قرية جميرا/, downtown: /downtown|وسط/, bizbay: /business bay|الخليج التجاري/, difc: /\bdifc\b|المالي/, jumeirah: /jumeirah(?! village| lakes)|جميرا(?! الدائرية)/, deira: /deira|ديرة/, burdubai: /bur dubai|بر دبي/, festival: /festival|فستيفال/, mirdif: /mirdif|مردف/, dso: /silicon oasis|\bdso\b|السيليكون/, academic: /academic city|الأكاديمية/ };
    const ars = [];
    Object.keys(areaRules).forEach(k => { if (areaRules[k].test(lower)) ars.push(k); });
    if (ars.length) { fields.areas = ars; found.push({ key: 'areas', value: ars.join(', '), raw: '' }); }
    else if (/dubai|دبي/.test(lower)) { fields.areas = ['all']; found.push({ key: 'areas', value: 'all', raw: 'Dubai' }); }
    return { fields, found };
  }

  /* ---------- Cost ---------- */
  function itemCost(opp, objective) {
    const o = objective;
    const span = opp.availableFrom && opp.availableTo ? overlapDays(o.start, o.end, opp.availableFrom, opp.availableTo) : o.duration;
    const days = span > 0 ? span : o.duration;
    let units;
    if (opp.unit === 'day') units = days;
    else if (opp.unit === 'week') units = Math.ceil(days / 7);
    else if (opp.unit === 'month') units = Math.ceil(days / 30);
    else units = 1;
    units = clamp(units, opp.minUnits || 1, opp.maxUnits || units);
    const base = opp.price != null ? opp.price * units : null;
    const setup = opp.setupFee || 0;
    return { units, unit: opp.unit, base, setup, subtotal: base == null ? null : base + setup };
  }

  /* ---------- Factor scoring ---------- */
  function scoreOpportunity(opp, objectiveIn, ctx) {
    const D = CON.DATA;
    const o = objectiveIn.end ? objectiveIn : normalizeObjective(objectiveIn);
    const today = (ctx && ctx.today) || todayIso();
    const suppliers = (ctx && ctx.suppliers) || D.suppliers;
    const sup = suppliers.find(s => s.id === opp.supplierId);
    const f = {}; const why = {}; const risks = [];
    const aud = opp.audience || {};

    // Objective fit
    const fit = (D.objectiveFit[opp.type] || {})[o.objective];
    f.objective = fit == null ? .5 : fit;
    why.objective = { code: f.objective >= .8 ? 'r.obj.high' : f.objective >= .55 ? 'r.obj.mid' : 'r.obj.low', p: { type: opp.type, objective: o.objective } };

    // Audience
    let ageScore = .5, genderScore = 1, intScore = .7, matched = [];
    if (aud.ageMin != null && aud.ageMax != null) {
      const ov = Math.max(0, Math.min(o.ageMax, aud.ageMax) - Math.max(o.ageMin, aud.ageMin));
      const span = Math.max(1, o.ageMax - o.ageMin);
      ageScore = clamp(ov / span, 0, 1);
    }
    if (o.gender !== 'all') {
      if (aud.gender === o.gender) genderScore = 1;
      else if (aud.gender === 'mixed' || !aud.gender) genderScore = .75;
      else genderScore = .2;
    } else if (aud.gender && aud.gender !== 'mixed') genderScore = .7;
    if (o.interests.length) {
      matched = o.interests.filter(i => (aud.interests || []).includes(i));
      intScore = (aud.interests || []).length ? matched.length / o.interests.length : .4;
    }
    f.audience = round2(.4 * ageScore + .25 * genderScore + .35 * intScore);
    why.audience = { code: 'r.aud', p: { age: Math.round(ageScore * 100), matched: matched, gender: aud.gender || 'mixed' } };

    // Geography
    if (opp.area === 'all') { f.geography = .9; why.geography = { code: 'r.geo.city', p: {} }; }
    else if (o.areas.includes('all')) { f.geography = .85; why.geography = { code: 'r.geo.all', p: { area: opp.area } }; }
    else if (o.areas.includes(opp.area)) { f.geography = 1; why.geography = { code: 'r.geo.in', p: { area: opp.area } }; }
    else if (o.areas.some(a => (D.neighbours[a] || []).includes(opp.area))) { f.geography = .6; why.geography = { code: 'r.geo.near', p: { area: opp.area } }; }
    else { f.geography = .2; why.geography = { code: 'r.geo.out', p: { area: opp.area } }; }

    // Budget fit
    const cost = itemCost(opp, o);
    if (cost.subtotal == null) { f.budget = .5; why.budget = { code: 'r.bud.unknown', p: {} }; risks.push('risk.price'); }
    else {
      const share = cost.subtotal / o.budget;
      if (share > 1) { f.budget = 0; risks.push('risk.over'); }
      else if (share <= .35) f.budget = 1;
      else f.budget = round2(1 - (share - .35) / .65 * .8);
      if (share > .5 && share <= 1) risks.push('risk.share');
      why.budget = { code: 'r.bud', p: { pct: Math.round(share * 100) } };
    }

    // Timing
    const ov = overlapDays(o.start, o.end, opp.availableFrom, opp.availableTo);
    if (opp.unit === 'activation') f.timing = ov > 0 ? 1 : 0;
    else f.timing = round2(clamp(ov / o.duration, 0, 1));
    const lead = Math.round((toDay(o.start) - toDay(today)) / DAY);
    if (lead < (opp.leadDays || 0)) { f.timing = round2(f.timing * .5); risks.push('risk.lead'); }
    if (f.timing === 0) why.timing = { code: 'r.time.none', p: {} };
    else if (f.timing < 1) { why.timing = { code: 'r.time.partial', p: { pct: Math.round(clamp(ov / o.duration, 0, 1) * 100), lead: opp.leadDays } }; if (ov < o.duration && opp.unit !== 'activation') risks.push('risk.partial'); }
    else why.timing = { code: 'r.time.full', p: {} };

    // Availability
    const left = Math.max(0, (opp.slotsTotal || 0) - (opp.slotsBooked || 0));
    if (opp.status !== 'active' || !opp.slotsTotal) { f.availability = opp.status === 'active' ? .5 : 0; }
    else f.availability = left === 0 ? 0 : round2(.5 + .5 * left / opp.slotsTotal);
    if (left > 0 && left <= 2) risks.push('risk.limited');
    why.availability = { code: left === 0 ? 'r.avail.none' : 'r.avail', p: { left, total: opp.slotsTotal || 0 } };

    // Historical evidence
    const perf = opp.performance || [];
    if (perf.some(p => p.source === 'verified')) { f.evidence = 1; why.evidence = { code: 'r.ev.verified', p: {} }; }
    else if (perf.length) { f.evidence = .6; why.evidence = { code: 'r.ev.declared', p: {} }; }
    else if (opp.reach) { f.evidence = .35; why.evidence = { code: 'r.ev.reach', p: {} }; }
    else { f.evidence = .15; why.evidence = { code: 'r.ev.none', p: {} }; risks.push('risk.noev'); }

    // Data confidence
    let c = 0;
    if (sup && sup.verified === 'verified') c += .3; else risks.push('risk.unverified');
    if (opp.price != null) c += .15;
    if (opp.reach && opp.reach.source) c += opp.reach.source === 'verified' ? .2 : .12;
    if (aud.ageMin != null && (aud.interests || []).length) c += .15;
    if (opp.availableFrom && opp.availableTo) c += .1;
    if (opp.desc && (opp.desc.en || opp.desc.ar || typeof opp.desc === 'string')) c += .1;
    f.confidence = round2(clamp(c, 0, 1));
    why.confidence = { code: 'r.conf', p: { pct: Math.round(f.confidence * 100) } };

    const factors = FACTORS.map(k => ({ key: k, weight: WEIGHTS[k], value: f[k], why: why[k] }));
    const score = Math.round(factors.reduce((s, x) => s + x.weight * x.value, 0) * 100);
    const excluded = f.budget === 0 ? 'over' : f.timing === 0 ? 'timing' : f.availability === 0 ? 'full' : null;
    const confidenceLevel = f.confidence >= .75 ? 'high' : f.confidence >= .5 ? 'medium' : 'low';
    return { oppId: opp.id, score, factors, cost, risks: Array.from(new Set(risks)), excluded, confidenceLevel };
  }

  /* ---------- Ranking with alternatives ---------- */
  function rank(opps, objectiveIn, ctx) {
    const o = normalizeObjective(objectiveIn);
    const scored = opps.filter(x => x.status !== 'paused').map(op => scoreOpportunity(op, o, ctx));
    scored.sort((a, b) => b.score - a.score || (a.cost.subtotal || 0) - (b.cost.subtotal || 0));
    const eligible = scored.filter(s => !s.excluded && s.score >= 45);
    const recommended = eligible.slice(0, 8);
    const byId = Object.fromEntries(opps.map(x => [x.id, x]));
    const recIds = new Set(recommended.map(r => r.oppId));
    const used = {};
    recommended.forEach(r => {
      const type = byId[r.oppId].type;
      const pool = eligible.filter(e => !recIds.has(e.oppId));
      const same = pool.filter(e => byId[e.oppId].type === type);
      const near = pool.filter(e => byId[e.oppId].type !== type)
        .sort((a, b) => ((used[a.oppId] || 0) - (used[b.oppId] || 0)) || (Math.abs(a.score - r.score) - Math.abs(b.score - r.score)));
      r.alternatives = same.concat(near).slice(0, 2).map(a => a.oppId);
      r.alternatives.forEach(id => { used[id] = (used[id] || 0) + 1; });
    });
    return { objective: o, all: scored, eligible, recommended };
  }

  /* ---------- Packages ---------- */
  function buildPackages(ranking, opps, feeRate) {
    const fee = feeRate == null ? .07 : feeRate;
    const o = ranking.objective;
    const byId = Object.fromEntries(opps.map(x => [x.id, x]));
    const pool = ranking.eligible.filter(e => e.cost.subtotal != null);
    function assemble(id, list, capShare, maxPerType, maxItems, distinctAreas) {
      const cap = o.budget * capShare / (1 + fee);
      const picked = []; let sum = 0; const perType = {}; const seenAreas = new Set();
      const tryAdd = (e, requireNewArea) => {
        const op = byId[e.oppId];
        if (picked.length >= maxItems || picked.includes(e)) return;
        if ((perType[op.type] || 0) >= maxPerType) return;
        if (requireNewArea && seenAreas.has(op.area)) return;
        if (sum + e.cost.subtotal > cap) return;
        picked.push(e); sum += e.cost.subtotal; perType[op.type] = (perType[op.type] || 0) + 1; seenAreas.add(op.area);
      };
      if (distinctAreas) list.forEach(e => tryAdd(e, true));
      list.forEach(e => tryAdd(e, false));
      const subtotal = Math.round(sum);
      const platformFee = Math.round(subtotal * fee);
      const avgScore = picked.length ? Math.round(picked.reduce((s, e) => s + e.score, 0) / picked.length) : 0;
      const conf = picked.length ? round2(picked.reduce((s, e) => s + e.factors.find(f => f.key === 'confidence').value, 0) / picked.length) : 0;
      const declaredReach = picked.reduce((s, e) => { const r = byId[e.oppId].reach; return s + (r ? 1 : 0); }, 0);
      return { id, items: picked.map(e => ({ oppId: e.oppId, score: e.score, cost: e.cost })), subtotal, platformFee, total: subtotal + platformFee, budgetUse: o.budget ? round2((subtotal + platformFee) / o.budget) : 0, avgScore, confidence: conf, typesCount: Object.keys(perType).length, areasCount: seenAreas.size, withReachData: declaredReach };
    }
    const byScore = pool.slice();
    const byValue = pool.slice().sort((a, b) => (b.score / Math.sqrt(b.cost.subtotal + 1)) - (a.score / Math.sqrt(a.cost.subtotal + 1)));
    const out = [];
    [assemble('balanced', byScore, 1, 2, 7, false), assemble('lean', byValue, .6, 1, 5, false), assemble('diverse', byScore, 1, 1, 7, true)]
      .forEach(p => {
        const sig = p.items.map(i => i.oppId).sort().join('|');
        if (p.items.length && !out.some(q => q.items.map(i => i.oppId).sort().join('|') === sig)) out.push(p);
      });
    return out;
  }

  /* ---------- RFQ ---------- */
  function generateRFQ(objectiveIn, oppList, meta) {
    const o = normalizeObjective(objectiveIn);
    const bySupplier = {};
    oppList.forEach(op => { (bySupplier[op.supplierId] = bySupplier[op.supplierId] || []).push(op.id); });
    return {
      objective: o.objective, product: o.product, success: o.success, target: o.target,
      audience: { gender: o.gender, ageMin: o.ageMin, ageMax: o.ageMax, interests: o.interests },
      areas: o.areas, budget: o.budget, start: o.start, end: o.end, duration: o.duration,
      lines: oppList.map(op => ({ oppId: op.id, supplierId: op.supplierId, requested: itemCost(op, o) })),
      suppliers: Object.keys(bySupplier),
      reporting: (meta && meta.reporting) || 'basic',
      requirements: (meta && meta.requirements) || '',
      responseDeadline: (meta && meta.responseDeadline) || addDays(todayIso(), 5)
    };
  }

  /* ---------- Offer normalisation ---------- */
  function normalizeOffer(resp, rfq, opts) {
    const fee = opts && opts.feeRate != null ? opts.feeRate : .07;
    const vatRate = opts && opts.vatRate != null ? opts.vatRate : .05;
    const base = Math.max(0, Number(resp.basePrice) || 0);
    const setup = Math.max(0, Number(resp.setupFee) || 0);
    const net = base + setup;
    const vat = Math.round(net * vatRate);
    const platformFee = Math.round(net * fee);
    const total = net + vat + platformFee;
    const days = Math.max(1, overlapDays(resp.from || rfq.start, resp.to || rfq.end, resp.from || rfq.start, resp.to || rfq.end));
    const covered = overlapDays(rfq.start, rfq.end, resp.from || rfq.start, resp.to || rfq.end);
    const dateMatch = covered >= rfq.duration ? 'full' : covered > 0 ? 'partial' : 'none';
    return { net, vat, platformFee, total, perDay: Math.round(net / days), days, dateMatch, coverage: round2(covered / rfq.duration), reporting: resp.reporting || 'none', terms: resp.terms || 'upfront' };
  }

  /* ---------- Seeded demo responder (simulates suppliers you are not acting as) ---------- */
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }
  function simulateResponse(line, opp, rfq) {
    const r = seeded(rfq.id + line.oppId);
    if (r < .12) return { status: 'declined', reason: 'capacity' };
    const req = line.requested;
    const factor = .88 + r * .22; // -12% to +10% versus list price
    const base = Math.round(((req.base || 0) * factor) / 50) * 50;
    const setup = Math.round((req.setup || 0) * (r > .5 ? 1 : .8));
    const partial = r > .82;
    return {
      status: 'offered', basePrice: base, setupFee: setup, units: req.units,
      from: partial ? addDays(rfq.start, 3) : rfq.start, to: rfq.end,
      reporting: r > .6 ? 'detailed' : r > .25 ? 'basic' : 'none',
      terms: r > .66 ? 'net30' : r > .33 ? 'split' : 'upfront',
      validUntil: addDays(todayIso(), 14),
      deliverables: '', notes: '', simulated: true
    };
  }

  CON.Engine = { WEIGHTS, FACTORS, normalizeObjective, extract, itemCost, scoreOpportunity, rank, buildPackages, generateRFQ, normalizeOffer, simulateResponse, util: { toDay, isoOf, addDays, todayIso, overlapDays } };
})(typeof window !== 'undefined' ? window : globalThis);
