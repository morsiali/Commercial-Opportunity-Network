/* Schema converters (v2 → v3). Used for the sample data and for migrating each user's stored records. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const Dt = CON.Dates;

  /* Free-text units from v2 → typed metrics. Unlike metrics are never summed. */
  const UNIT_MAP = {
    'weekly visitors': ['audience', 'visits', 'week', 'estimated'], 'weekly visitors (mall total)': ['audience', 'visits', 'week', 'estimated'],
    'residents': ['audience', 'residents', 'total', 'counted'], 'attendees per event': ['audience', 'attendees', 'event', 'counted'],
    'packs per month': ['delivery', 'samples', 'month', 'counted'], 'member visits per week': ['audience', 'visits', 'week', 'system'],
    'active members': ['audience', 'members', 'total', 'system'], 'orders per week': ['audience', 'transactions', 'week', 'system'],
    'office workers': ['audience', 'people', 'total', 'estimated'], 'tenants': ['audience', 'people', 'total', 'estimated'],
    'registered runners (last edition)': ['audience', 'attendees', 'event', 'system'], 'guest check-ins per week': ['audience', 'visits', 'week', 'system'],
    'transactions per week': ['audience', 'transactions', 'week', 'system'],
    'samples per day': ['delivery', 'samples', 'day', 'counted'], 'leads captured': ['outcome', 'leads', 'event', 'counted'],
    'samples per week': ['delivery', 'samples', 'week', 'counted'], 'offer redemptions per month': ['outcome', 'redemptions', 'month', 'system'],
    'plays per week': ['delivery', 'impressions', 'week', 'system'], 'units sold during trial week': ['outcome', 'units_sold', 'week', 'system']
  };
  function toEvidence(v, defaults) {
    if (!v) return null;
    const key = String(v.unit || v.metric || '').toLowerCase();
    const map = UNIT_MAP[key] || [defaults.kind, 'people', 'total', 'estimated'];
    const verified = (v.source || '') === 'verified';
    // Figures on the illustrative sample listings are sample data, never verified market evidence.
    if (defaults.sample) return { kind: map[0], metric: map[1], period: map[2], method: map[3], value: Number(v.value) || 0, label: v.unit || v.metric || '', source: 'sample', verification: 'sample', periodEnd: v.date || null, reviewedAt: null, expiresAt: null };
    return {
      kind: map[0], metric: map[1], period: map[2], method: map[3], value: Number(v.value) || 0, label: v.unit || v.metric || '',
      source: verified ? 'platform_review' : 'supplier_declared', verification: verified ? 'verified' : 'unverified',
      periodEnd: v.date || null, reviewedAt: verified ? (v.date ? v.date + '-28' : null) : null,
      expiresAt: v.date ? Dt.addDays((v.date.length === 7 ? v.date + '-28' : v.date), 372) : null
    };
  }

  const FAC_NULL = { categoriesAllowed: null, categoriesBlocked: [], foodSampling: null, refrigeration: null, electricity: null, staffingProvided: null };
  function listingV2toV3(op, extras, opts) {
    if (op && op.v === 3) return op;
    const x = extras || {};
    const isDemo = !!op.demo;
    const lang = (o) => {
      if (!o) return { en: '', ar: '' };
      if (typeof o === 'string') return { en: o, ar: '' };
      // v2 copied English into Arabic for user listings; that is not a translation, so drop it.
      if (!isDemo && o.ar === o.en) return { en: o.en || '', ar: '' };
      return { en: o.en || '', ar: o.ar || '' };
    };
    const toMinor = v => (v == null || v === '' ? null : Math.round(Number(v) * 100));
    const evidence = [];
    const r = toEvidence(op.reach, { kind: 'audience', sample: isDemo }); if (r) evidence.push(r);
    (op.performance || []).forEach(p => { const e = toEvidence({ value: p.value, unit: p.metric, source: p.source, date: p.date }, { kind: 'delivery', sample: isDemo }); if (e) evidence.push(e); });
    const aud = Object.assign({ gender: 'mixed', access: 'open', ageMin: null, ageMax: null, interests: [] }, op.audience || {}, x.audience || {});
    const out = {
      v: 3, id: op.id, supplierId: op.supplierId, type: op.type, area: op.area,
      title: lang(op.title), desc: lang(op.desc), requirements: lang(op.requirements),
      price: toMinor(op.price), unit: op.unit, setupFee: toMinor(op.setupFee) || 0,
      minUnits: op.minUnits || 1, maxUnits: op.maxUnits || null,
      availableFrom: op.availableFrom, availableTo: op.availableTo, leadDays: op.leadDays || 0,
      schedule: x.schedule || { days: [0, 1, 2, 3, 4, 5, 6] }, eventDates: x.eventDates || null,
      capacityPerDate: Math.max(1, op.slotsTotal || 1), baseBooked: Math.max(0, op.slotsBooked || 0),
      audience: aud,
      restrictions: Object.assign({}, FAC_NULL, x.restrictions || {}),
      services: x.services || { included: [], excluded: [] },
      evidence: x.evidence || evidence,
      status: op.status === 'paused' ? 'paused' : (op.status === 'archived' ? 'archived' : 'active'),
      version: 1, updatedAt: (opts && opts.now) || null,
      availabilityUpdatedAt: x.availabilityUpdatedAt !== undefined ? x.availabilityUpdatedAt : ((opts && opts.today) || null),
      image: op.image, demo: isDemo || undefined
    };
    if (!out.image) delete out.image;
    if (!out.demo) delete out.demo;
    return out;
  }

  const SAMPLE_DOC = (supplierId, at) => ({ id: 'doc-sample-' + supplierId, kind: 'trade_licence', fileName: 'sample-trade-licence-' + supplierId + '.pdf', size: 184320, type: 'application/pdf', storage: 'demo-sample', simulated: true, scan: 'simulated-clean', uploadedAt: at });
  function supplierV2toV3(s, opts) {
    if (s && s.v === 3) return s;
    const at = (opts && opts.now) || null;
    const today = (opts && opts.today) || Dt.today();
    const status = s.verified === 'verified' ? 'licence_reviewed' : s.verified === 'pending' ? 'submitted' : s.verified === 'rejected' ? 'rejected' : 'not_submitted';
    // Only the illustrative demo suppliers get the simulated sample licence.
    const docs = s.demo && (s.verified === 'verified' || s.verified === 'pending') ? [SAMPLE_DOC(s.id, at)] : [];
    // v2 stored only a filename for user uploads: it is kept as a note but never treated as a document,
    // and a v2 "verified" status that rested on a filename alone is downgraded to "submitted".
    const note = s.docName && !docs.length ? 'filename-only:' + s.docName : null;
    let st = status;
    if (!s.demo && status === 'licence_reviewed') st = 'submitted';
    return {
      v: 3, id: s.id, orgId: s.orgId || 'org-' + s.id, name: s.name, category: s.category, emirate: s.emirate || 'Dubai', contact: s.contact || '', joined: s.joined || null,
      licenceNumber: s.licence || '', vatRegistered: s.vatRegistered !== false,
      verification: {
        status: st, licenceExpiry: st === 'licence_reviewed' ? Dt.addDays(today, 260) : null,
        documents: docs, legacyNote: note, simulated: st === 'licence_reviewed' || undefined,
        decisions: st === 'licence_reviewed' ? [{ at, reviewer: 'demo-operations', decision: 'approve', reason: 'Sample licence reviewed (simulated)', simulated: true }]
          : (st !== status ? [{ at, reviewer: 'system', decision: 'review_required', reason: 'Earlier status was based on a file name only' }] : []),
        reviewedSnapshot: st === 'licence_reviewed' ? { name: s.name && s.name.en, licenceNumber: s.licence || '' } : null
      },
      demo: s.demo || undefined
    };
  }

  /* ---------- Whole stored state: v2 → v3 ----------
     Sample records are regenerated from the new seed; everything the user created is converted and kept.
     Decisions made under the old rules (approvals, payout releases) are not trusted and are re-opened. */
  const legacyMinor = v => (v == null || !Number.isFinite(Number(v)) ? 0 : Math.round(Number(v) * 100));
  const BOOKING_MAP = { confirmed: 'confirmed', preparing: 'preparing', live: 'live', completed: 'completed', delivered: 'delivery_accepted', cancelled: 'cancelled' };
  function migrateStateV2(old, fresh, opts) {
    const E = CON.Engine, Of = CON.Offers, M = CON.Money;
    const now = (opts && opts.now) || new Date().toISOString();
    const today = (opts && opts.today) || Dt.today();
    const out = fresh; // a freshly seeded v3 state
    const notes = [];
    out.migratedFrom = { version: old.version || 2, at: now, notes };
    const seedOpp = new Set((CON.DATA.v2.opportunities || []).map(o => o.id));
    const seedSup = new Set((CON.DATA.v2.suppliers || []).map(o => o.id));
    out.company = old.company || out.company;
    if (old.activeSupplierId) out.activeSupplierId = old.activeSupplierId;
    (old.suppliers || []).filter(x => !seedSup.has(x.id)).forEach(x => { out.suppliers.push(supplierV2toV3(x, { now, today })); });
    (old.opportunities || []).forEach(x => {
      if (seedOpp.has(x.id)) {
        if (x.status === 'paused') { const o = out.opportunities.find(y => y.id === x.id); if (o) o.status = 'paused'; }
        return;
      }
      out.opportunities.unshift(listingV2toV3(x, null, { now, today }));
    });
    const userObj = (old.objectives || []).filter(o => !o.sample);
    userObj.forEach(o => {
      const n = Object.assign({}, o, { budgetMinor: legacyMinor(o.budget) });
      delete n.budget;
      out.objectives.unshift(E.normalizeObjective(n, { today }));
      Object.assign(out.objectives[0], { id: o.id, name: o.name, createdAt: o.createdAt, selected: o.selected || [], source: o.source, sentence: o.sentence || '', planViewed: !!o.planViewed, migrated: true });
    });
    const keepObj = new Set(userObj.map(o => o.id));
    const userRfqs = (old.rfqs || []).filter(r => !r.sample && keepObj.has(r.objectiveId));
    userRfqs.forEach(r => {
      const obj = out.objectives.find(o => o.id === r.objectiveId);
      const lines = (r.lines || []).map((l, i) => {
        const op = out.opportunities.find(o => o.id === l.oppId);
        const cov = op ? E.coverage(op, obj) : null;
        const line = { id: r.id + '-l' + (i + 1), oppId: l.oppId, supplierId: l.supplierId, status: 'requested',
          requested: cov ? { coverage: { status: cov.status, purchasedUnits: cov.purchasedUnits, neededUnits: cov.neededUnits, coveredDates: cov.coveredDates, overMax: cov.overMax }, price: E.price(op, cov) } : {},
          window: { from: obj.start, to: obj.end }, reporting: r.reporting || 'basic', requiredDeliverables: [], listingVersion: 1, offers: [], approval: null };
        const resp = l.response;
        if (resp && resp.status === 'declined') { line.status = 'declined'; line.declineReason = resp.reason || ''; }
        else if (resp && resp.status === 'offered' && op) {
          const v = {
            version: 1, at: resp.respondedAt || now, by: 'migrated', simulated: !!resp.simulated,
            basePrice: legacyMinor(resp.basePrice), setupFee: legacyMinor(resp.setupFee), units: resp.units || 1,
            from: resp.from || obj.start, to: resp.to || obj.end, reporting: resp.reporting || 'basic',
            deliverables: String(resp.deliverables || '').split(/\n|;/).map(z => z.trim()).filter(Boolean),
            terms: resp.terms === 'split' ? 'split' : 'full', validUntil: resp.validUntil || today, notes: resp.notes || '', vatRegistered: true, listingVersion: 1
          };
          v.dates = Of.datesFor(op, v.from, v.to, op.unit === 'day' ? v.units : null);
          if (!v.deliverables.length) v.deliverables = ['As described in the listing (migrated offer had no deliverables)'];
          v.deviations = Of.deviations(line, op, v); v.partial = v.deviations.some(d => d.field === 'coverage'); v.hash = Of.contentHash(v);
          line.offers.push(v); line.status = 'offered';
          if (l.approved) { line.migratedApprovalCleared = true; notes.push('approval-cleared:' + line.id); }
        }
        return line;
      });
      out.rfqs.unshift({ id: r.id, number: r.number, objectiveId: r.objectiveId, createdAt: r.createdAt, status: 'open', shareBudget: r.shareBudget !== false, mode: 'demo',
        objective: obj.objective, product: obj.product, success: obj.success, target: obj.target, audience: { gender: obj.gender, ageMin: obj.ageMin, ageMax: obj.ageMax, interests: obj.interests }, areas: obj.areas,
        requirementsPolicy: obj.requirements, needs: obj.needs, budgetMinor: obj.budgetMinor, start: obj.start, end: obj.end, duration: obj.duration,
        suppliers: r.suppliers || [], reporting: r.reporting || 'basic', requirements: r.requirements || '', requiredDeliverables: [], responseDeadline: r.responseDeadline || null, lines, migrated: true });
    });
    // Transactions and bookings made under v2: keep them as records, but re-check payment and payouts.
    const keepRfq = new Set(userRfqs.map(r => r.id));
    (old.transactions || []).filter(t => !t.sample && keepRfq.has(t.rfqId)).forEach(t => {
      const bks = (old.bookings || []).filter(b => b.txId === t.id);
      const rfq = out.rfqs.find(r => r.id === t.rfqId);
      const pay = { id: t.id, number: t.number, rfqId: t.rfqId, objectiveId: t.objectiveId, status: t.status === 'paid' ? 'paid' : 'awaiting', method: t.method === 'card' ? 'card' : 'transfer',
        amount: { net: legacyMinor(t.net), fee: legacyMinor(t.fee), vat: legacyMinor(t.vat), total: legacyMinor(t.net) + legacyMinor(t.fee) + legacyMinor(t.vat) }, lines: [], createdAt: t.createdAt, mode: 'demo', provider: 'demo-simulated',
        simulated: true, legacy: true, billing: t.billing || {}, taxNote: 'Migrated from prototype v2; amounts were floating-point and are rounded to the nearest fil.' };
      out.payments.unshift(pay);
      bks.forEach(b => {
        const op = out.opportunities.find(o => o.id === b.oppId);
        const status = BOOKING_MAP[b.status] || 'confirmed';
        const dates = op ? Of.datesFor(op, b.from, b.to, null) : [];
        const alloc = { id: 'al-m-' + b.id, oppId: b.oppId, listingVersion: 1, dates, units: 1, ref: b.id, status: status === 'cancelled' ? 'released' : 'confirmed', createdAt: t.createdAt };
        out.allocations.push(alloc);
        const net = legacyMinor(b.net), total = legacyMinor(b.total);
        const bk = { id: b.id, number: b.number, paymentId: t.id, rfqId: t.rfqId, lineId: null, objectiveId: b.objectiveId, oppId: b.oppId, supplierId: b.supplierId, status: pay.status === 'paid' ? status : 'reserved',
          money: { net, fee: 0, vat: total - net, exVat: net, total }, dates, from: b.from, to: b.to, offerVersion: 1, snapshot: op ? { id: op.id, version: 1, title: op.title, type: op.type, area: op.area, unit: op.unit, price: op.price, takenAt: now } : null,
          allocationId: alloc.id, createdAt: t.createdAt, report: b.report || null, outcome: b.outcome || null, deliveryAcceptedAt: b.delivery || null, mode: 'demo', legacy: true };
        if (rfq) { const l = rfq.lines.find(x => x.oppId === b.oppId); if (l) { bk.lineId = l.id; l.status = pay.status === 'paid' ? 'booked' : 'reserved'; l.migratedApprovalCleared = false; } }
        out.bookings.unshift(bk);
        // Payouts are never carried over as released: they restart as held and must pass the checks again.
        const po = { id: 'po-m-' + b.id, number: 'PO-M-' + (b.number || b.id), bookingId: b.id, supplierId: b.supplierId, status: 'held', amount: net, createdAt: now, legacy: true };
        if (b.payout === 'released') { po.legacyNote = 'Marked released in v2 without payment and delivery checks; re-check before any release.'; notes.push('payout-reopened:' + b.id); }
        out.payouts.unshift(po); bk.payoutId = po.id;
        pay.lines.push({ lineId: bk.lineId, oppId: b.oppId, supplierId: b.supplierId, version: 1, money: bk.money, allocationId: alloc.id });
      });
      if (rfq && rfq.lines.every(l => ['booked', 'reserved', 'declined'].includes(l.status))) rfq.status = 'awarded';
      else if (rfq && rfq.lines.some(l => ['booked', 'reserved'].includes(l.status))) rfq.status = 'partially_awarded';
    });
    out.compare = (old.compare || []).filter(id => out.opportunities.some(o => o.id === id));
    out.events = (old.events || []).concat(out.events || []);
    out.audit.push({ id: 'au-migrate', at: now, actor: 'system', entity: 'state', entityId: 'state', event: 'migrate', from: 'v' + (old.version || 2), to: 'v3', reason: notes.length + ' decisions re-opened' });
    return out;
  }

  CON.Migrate = { UNIT_MAP, toEvidence, listingV2toV3, supplierV2toV3, SAMPLE_DOC, migrateStateV2 };
})(typeof window !== 'undefined' ? window : globalThis);
