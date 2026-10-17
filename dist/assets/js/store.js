/* Commercial Opportunity Network — demo data store (browser only, v3).
   All commercial rules live in CON.Domain; this file only loads, migrates and saves the state document
   in this browser's localStorage, and builds the request context for the current workspace. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const Dt = CON.Dates, Dm = CON.Domain, E = CON.Engine, S = CON.States;
  const KEY = 'con.state.v3';
  const LEGACY = ['con.state.v2'];
  const DRAFT_PREFIX = 'con.draft.';

  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nowIso() { return new Date().toISOString(); }

  let state = null;
  let role = { ws: 'c' };
  const listeners = [];
  const emit = (ev, data) => listeners.forEach(fn => { try { fn(ev, data); } catch (e) { /* listener error */ } });

  function fresh() { return CON.Seed.build({ today: Dt.today() }); }
  function readSaved() { const s = CON.storage.get(KEY, null); return s && s.version === 3 ? s : null; }

  const Store = {
    KEY, DRAFT_PREFIX,
    load() {
      const saved = readSaved();
      if (saved) { state = Dm.ensureState(saved); return state; }
      const legacy = CON.storage.get(LEGACY[0], null);
      if (legacy && legacy.version === 2) {
        try {
          state = CON.Migrate.migrateStateV2(legacy, fresh(), { today: Dt.today(), now: nowIso() });
          state.migratedNotice = true;
        } catch (e) { state = fresh(); state.migrationFailed = String(e && e.code || e); }
        // The v2 record is left in place, untouched, as a rollback copy.
      } else state = fresh();
      Store.save();
      return state;
    },
    get state() { return state; },
    /* Pick up changes made in another tab before mutating. */
    refresh() { const s = readSaved(); if (s) state = Dm.ensureState(s); return state; },
    save() {
      const ok = CON.storage.set(KEY, state);
      if (!ok) emit('save-failed');
      return ok;
    },
    reset() { CON.storage.remove(KEY); state = fresh(); Store.save(); },
    on(fn) { listeners.push(fn); },
    uid,
    setRole(ws) { role = { ws }; },
    ctx(extra) {
      const now = nowIso();
      const base = { now, today: Dt.today(Dt.TZ_DEFAULT, now), mode: 'demo' };
      if (role.ws === 's') Object.assign(base, { role: 'supplier', actor: 'demo-supplier:' + state.activeSupplierId, supplierId: state.activeSupplierId });
      else if (role.ws === 'o') Object.assign(base, { role: 'ops', actor: 'demo-operations' });
      else Object.assign(base, { role: 'customer', actor: 'demo-customer' });
      return Object.assign(base, extra || {});
    },
    /* Run a domain operation against the latest stored state. Returns { ok, value } or { ok:false, error }. */
    act(fn, ctxExtra) {
      Store.refresh();
      const snapshot = JSON.stringify(state);
      try {
        const value = fn(state, Store.ctx(ctxExtra));
        const saved = Store.save();
        return { ok: true, value, saved };
      } catch (err) {
        state = JSON.parse(snapshot); // nothing half-applied
        if (err && err.code) return { ok: false, error: err };
        console.error(err);
        return { ok: false, error: { code: 'UNEXPECTED', details: { message: String(err && err.message || err) } } };
      }
    },
    opp(id) { return state.opportunities.find(o => o.id === id); },
    supplier(id) { return state.suppliers.find(s => s.id === id); },
    objective(id) { return state.objectives.find(o => o.id === id); },
    rfq(id) { return state.rfqs.find(r => r.id === id); },
    booking(id) { return state.bookings.find(b => b.id === id); },
    payment(id) { return state.payments.find(p => p.id === id); },
    payout(id) { return state.payouts.find(p => p.id === id); },
    capacity() { return CON.Inventory.capacityFn(state, Date.now()); },
    rankFor(obj) {
      return E.rank(state.opportunities, obj, { today: Dt.today(), suppliers: state.suppliers, capacity: Store.capacity() });
    },

    /* Objectives (customer drafts and briefs) */
    createObjective(fields, meta) {
      const o = E.normalizeObjective(fields, { today: Dt.today() });
      const obj = Object.assign(o, { id: uid('ob'), name: meta.name || '', createdAt: nowIso(), selected: [], planViewed: false, source: meta.source || 'form', sentence: meta.sentence || '', extraction: meta.extraction || null });
      Store.refresh();
      state.objectives.unshift(obj);
      state.events.push({ type: 'objective', at: obj.createdAt });
      S.audit(state.audit, 'objective', obj.id, 'create', { actor: 'demo-customer' });
      Store.save();
      return obj;
    },
    updateObjective(id, fields, meta) {
      Store.refresh();
      const obj = Store.objective(id); if (!obj) return null;
      const keep = { id: obj.id, name: meta.name || obj.name, createdAt: obj.createdAt, selected: obj.selected, planViewed: obj.planViewed, source: obj.source, sample: obj.sample,
        sentence: meta.sentence != null ? meta.sentence : obj.sentence, extraction: meta.extraction || obj.extraction, updatedAt: nowIso() };
      const next = Object.assign(E.normalizeObjective(fields, { today: Dt.today() }), keep);
      const i = state.objectives.indexOf(obj); state.objectives[i] = next;
      S.audit(state.audit, 'objective', id, 'update', { actor: 'demo-customer' });
      Store.save();
      return next;
    },
    deleteObjective(id) {
      Store.refresh();
      if (state.rfqs.some(r => r.objectiveId === id)) return false;
      state.objectives = state.objectives.filter(o => o.id !== id);
      Store.save();
      return true;
    },
    toggleSelected(objId, oppId) {
      Store.refresh();
      const obj = Store.objective(objId); if (!obj) return null;
      const i = obj.selected.indexOf(oppId);
      if (i >= 0) obj.selected.splice(i, 1); else obj.selected.push(oppId);
      Store.save();
      return i < 0;
    },
    setSelected(objId, ids) { Store.refresh(); const obj = Store.objective(objId); if (obj) { obj.selected = ids.slice(); Store.save(); } },

    /* Demo-only simulated supplier replies, clearly labelled as simulated. */
    scheduleSimulated(rfq) {
      const t = Date.now();
      rfq.lines.forEach((l, i) => { if (l.supplierId !== state.activeSupplierId) l.simulateAt = t + 1500 + i * 900; });
    },
    tick(force) {
      Store.refresh();
      const changed = [];
      const t = Date.now();
      const ctx = Store.ctx({ role: 'system', actor: 'demo-simulator' });
      state.rfqs.forEach(r => r.lines.forEach(l => {
        if (l.status === 'requested' && l.simulateAt && (force || l.simulateAt <= t)) {
          delete l.simulateAt;
          const op = Store.opp(l.oppId);
          if (!op) return;
          const rep = CON.Seed.simulatedReply(r, l, op, ctx.today);
          try {
            Dm.respond(state, rep.decline ? { rfqId: r.id, line: l.id, decline: true, reason: rep.reason } : { rfqId: r.id, line: l.id, input: rep.input, simulated: true }, ctx);
            l.simulated = true;
            changed.push({ rfq: r, line: l });
          } catch (e) { l.simulationError = e.code || 'error'; }
        }
      }));
      const expiredOffers = Dm.expireOffers(state, ctx);
      const expiredHolds = Dm.expireHolds(state, ctx);
      if (changed.length || expiredOffers.length || expiredHolds.length) Store.save();
      return { replies: changed, expiredOffers, expiredHolds };
    },

    /* Drafts: unsaved form input, kept separately from records so it can be deleted on its own. */
    draft: {
      get(key) { return CON.storage.get(DRAFT_PREFIX + key, null); },
      set(key, value) { return CON.storage.set(DRAFT_PREFIX + key, Object.assign({}, value, { savedAt: nowIso() })); },
      remove(key) { CON.storage.remove(DRAFT_PREFIX + key); },
      keys() { try { return Object.keys(root.localStorage).filter(k => k.indexOf(DRAFT_PREFIX) === 0); } catch (e) { return []; } },
      clear() { Store.draft.keys().forEach(k => CON.storage.remove(k)); }
    },
    /* Removes every key this site created in this browser (con.*), and nothing else. */
    clearAll() {
      let keys = [];
      try { keys = Object.keys(root.localStorage).filter(k => k.indexOf('con.') === 0); } catch (e) { /* storage blocked */ }
      keys.forEach(k => CON.storage.remove(k));
      [KEY].concat(LEGACY).forEach(k => CON.storage.remove(k));
      return keys.length;
    },

    toggleCompare(id) {
      Store.refresh();
      const i = state.compare.indexOf(id);
      if (i >= 0) state.compare.splice(i, 1);
      else { if (state.compare.length >= 4) return 'full'; state.compare.push(id); }
      Store.save();
      return i >= 0 ? 'removed' : 'added';
    },
    setSupplier(id) { Store.refresh(); state.activeSupplierId = id; Store.save(); },
    registerSupplier(sup) {
      Store.refresh();
      const s = { v: 3, id: uid('sp'), orgId: uid('org-'), name: { en: sup.name, ar: sup.nameAr || '' }, category: sup.category, emirate: 'Dubai', contact: sup.contact, joined: Dt.today(), licenceNumber: sup.licence, vatRegistered: !!sup.vatRegistered,
        verification: { status: 'not_submitted', licenceExpiry: null, documents: [], decisions: [], reviewedSnapshot: null } };
      state.suppliers.push(s); state.activeSupplierId = s.id;
      S.audit(state.audit, 'supplier', s.id, 'register', { actor: 'demo-supplier:' + s.id });
      Store.save();
      return s;
    }
  };
  CON.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);
