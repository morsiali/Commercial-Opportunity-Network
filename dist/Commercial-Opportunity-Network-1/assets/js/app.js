/* Platform: router, shell, accessible dialogs, actions, forms, drafts and boot (v3) */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App, E = CON.Engine, D = CON.DATA, Store = CON.Store, M = CON.Money, Dt = CON.Dates, Dm = CON.Domain;
  const t = A.t, esc = A.esc, ic = A.ic;
  const root = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');

  Store.load();
  Store.on(ev => { if (ev === 'save-failed') { A.storageFailed = true; CON.toast(t('toast.saveFail3'), 'alert'); const el = document.querySelector('[data-storage-warning]'); if (el) el.hidden = false; } });

  /* Screen-reader announcements */
  let live = document.getElementById('sr-live');
  if (!live) { live = document.createElement('div'); live.id = 'sr-live'; live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status'); document.body.appendChild(live); }
  A.announce = msg => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); };
  const toast = (msg, icon) => { CON.toast(msg, icon); };

  /* ---------- Routing ---------- */
  const NAV = {
    c: [['overview', 'grid'], ['new', 'plus'], ['plans', 'layers'], ['catalog', 'search'], ['compare', 'compare'], ['rfqs', 'file'], ['bookings', 'track'], ['results', 'chart']],
    s: [['overview', 'grid'], ['listings', 'store'], ['rfqs', 'inbox'], ['bookings', 'track'], ['profile', 'shield']],
    o: [['metrics', 'chart'], ['verify', 'shield'], ['rfqs', 'file'], ['payments', 'card'], ['audit', 'list'], ['pilot', 'check-circle'], ['economics', 'wallet'], ['kill', 'flag']]
  };
  const ALIAS = { c: { edit: 'new', plan: 'plans', rfq: 'plans', offers: 'rfqs', checkout: 'rfqs', payment: 'bookings', booking: 'bookings' }, s: { listing: 'listings', import: 'listings', respond: 'rfqs', booking: 'bookings' }, o: { overview: 'metrics' } };
  function parse() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    const m = h.match(/^([cso])-([a-z]+)(?:-([A-Za-z0-9_-]+))?$/);
    if (!m) return { ws: 'c', page: 'overview' };
    return { ws: m[1], page: m[2], id: m[3] };
  }
  A.go = hash => { if (location.hash === '#' + hash) render({ fresh: true }); else location.hash = hash; };
  A.notFound = () => A.head(t('nf.title'), t('nf.text')) + '<div class="panel">' + A.empty('search', t('nf.title'), t('nf.text'), '<a class="btn btn-dark btn-sm" href="#c-overview">' + t('nav.c.overview') + '</a>') + '</div>';

  function counts(ws) {
    const s = Store.state;
    if (ws === 'c') return { compare: s.compare.length, rfqs: s.rfqs.reduce((a, r) => a + r.lines.filter(l => l.status === 'offered').length, 0) };
    if (ws === 's') return { rfqs: s.rfqs.filter(r => r.lines.some(l => l.supplierId === s.activeSupplierId && l.status === 'requested')).length };
    return { verify: s.suppliers.filter(x => x.verification && x.verification.status === 'submitted').length, payments: s.payouts.filter(p => p.status === 'eligible').length + s.disputes.filter(d => d.status === 'open').length + s.refunds.filter(r => r.status === 'requested').length };
  }

  function shell(route, inner) {
    const ws = route.ws;
    const active = (ALIAS[ws] && ALIAS[ws][route.page]) || route.page;
    const cnt = counts(ws);
    const wsTitle = { c: t('ws.c'), s: t('ws.s'), o: t('ws.o') };
    return '<header class="app-top"><div class="app-top-row">' +
      '<a class="logo" href="index.html"><span class="logo-mark">' + CON.logoMark + '</span><span class="logo-text">' + t('brand1') + '<small>' + t('brand2') + '</small></span></a>' +
      '<nav class="ws-switch" aria-label="' + esc(t('ws.label')) + '">' +
      '<a href="#c-overview" class="' + (ws === 'c' ? 'active' : '') + '"' + (ws === 'c' ? ' aria-current="true"' : '') + '>' + ic('briefcase') + '<span>' + wsTitle.c + '</span></a>' +
      '<a href="#s-overview" class="' + (ws === 's' ? 'active' : '') + '"' + (ws === 's' ? ' aria-current="true"' : '') + '>' + ic('store') + '<span>' + wsTitle.s + '</span></a>' +
      '<a href="#o-metrics" class="' + (ws === 'o' ? 'active' : '') + '"' + (ws === 'o' ? ' aria-current="true"' : '') + '>' + ic('settings') + '<span>' + wsTitle.o + '</span></a></nav>' +
      '<div class="top-actions">' +
      '<button class="lang-toggle" type="button" data-act="lang" lang="' + (A.lang === 'ar' ? 'en' : 'ar') + '">' + ic('globe') + '<span>' + (A.lang === 'ar' ? 'English' : 'العربية') + '</span></button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-act="data-controls">' + ic('database') + '<span class="hide-xs">' + t('data.btn') + '</span></button>' +
      '<a class="btn btn-ghost btn-sm hide-sm" href="workflow.html">' + ic('track') + '<span>' + t('workflow') + '</span></a>' +
      '<a class="btn btn-light btn-sm hide-sm" href="index.html">' + t('website') + '</a></div></div>' +
      '<div class="demo-banner" role="note">' + ic('info') + '<span><b>' + t('demo.bannerB') + '</b> ' + t('demo.banner') + '</span></div>' +
      '<div class="demo-banner bad" data-storage-warning role="alert"' + (A.storageFailed ? '' : ' hidden') + '>' + ic('alert') + '<span>' + t('demo.storageFail') + '</span></div></header>' +
      '<div class="app-shell"><nav class="side-nav" aria-label="' + esc(wsTitle[ws]) + '"><span class="nav-title">' + wsTitle[ws] + '</span>' +
      NAV[ws].map(([p, icon]) => '<a href="#' + ws + '-' + p + '" class="' + (active === p ? 'active' : '') + '"' + (active === p ? ' aria-current="page"' : '') + '>' + ic(icon) + '<span>' + t('nav.' + ws + '.' + p) + '</span>' + (cnt[p] ? '<span class="count" aria-label="' + esc(t('nav.count', { n: cnt[p] })) + '">' + cnt[p] + '</span>' : '') + '</a>').join('') +
      '<div class="side-foot">' + ic('lock') + '<span>' + t('sideFoot3') + '</span></div></nav>' +
      '<main class="view" id="main" tabindex="-1">' + inner + '</main></div>';
  }

  /* ---------- Form state survives re-renders and language changes ---------- */
  function formKey(f) { return [f.dataset.form, f.dataset.id, f.dataset.rfq, f.dataset.line, f.dataset.obj, f.dataset.k].filter(Boolean).join(':'); }
  A.serializeForm = f => {
    const out = {};
    Array.from(f.elements).forEach(el => {
      if (!el.name || el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
      // Checkboxes with an explicit value form a list; value-less ones are on/off switches.
      if (el.type === 'checkbox') { if (el.hasAttribute('value')) { out[el.name] = out[el.name] || []; if (el.checked) out[el.name].push(el.value); } else out[el.name] = el.checked; }
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = out[el.name]; }
      else out[el.name] = el.value;
    });
    return out;
  };
  A.restoreForm = (f, vals) => {
    if (!vals) return;
    Array.from(f.elements).forEach(el => {
      if (!el.name || !(el.name in vals) || el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
      const v = vals[el.name];
      if (el.type === 'checkbox') el.checked = Array.isArray(v) ? v.includes(el.value) : !!v;
      else if (el.type === 'radio') el.checked = v === el.value;
      else if (v != null) el.value = v;
    });
  };
  function captureForms() {
    const cache = {};
    root.querySelectorAll('form[data-form]').forEach(f => { cache[formKey(f)] = A.serializeForm(f); });
    const s = root.querySelector('#f-sentence'); if (s) cache.__sentence = s.value;
    return cache;
  }
  function restoreForms(cache) {
    if (!cache) return;
    root.querySelectorAll('form[data-form]').forEach(f => { const v = cache[formKey(f)]; if (v) A.restoreForm(f, v); });
    const s = root.querySelector('#f-sentence'); if (s && cache.__sentence != null) s.value = cache.__sentence;
  }

  let lastRouteKey = '';
  function render(opts) {
    opts = opts || {};
    const route = parse();
    Store.setRole(route.ws);
    const key = route.ws + '-' + route.page + '-' + (route.id || '');
    const changed = key !== lastRouteKey;
    const view = A.views[route.ws] && A.views[route.ws][route.page === 'edit' ? 'new' : route.page];
    const cache = !changed && !opts.fresh ? captureForms() : null;
    const focusedId = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;
    if (changed) { A.ui.confirm = null; A.ui.errors = {}; A.ui.offerForm = {}; if (route.page !== 'listing') A.ui.upload = null; if (route.page !== 'profile') A.ui.docPick = null; }
    let inner;
    try { inner = view ? view(route.id) : A.notFound(); } catch (err) { console.error(err); inner = A.notFound(); }
    const y = window.scrollY;
    root.innerHTML = shell(route, inner);
    restoreForms(cache);
    const navKey = (ALIAS[route.ws] && ALIAS[route.ws][route.page]) || route.page;
    document.title = (t('nav.' + route.ws + '.' + navKey) || '') + ' · ' + t('appTitle');
    if (changed) {
      window.scrollTo(0, 0);
      if (lastRouteKey) { const h = root.querySelector('[data-view-title]'); if (h) h.focus({ preventScroll: true }); A.announce(document.title); }
    } else {
      window.scrollTo(0, y);
      if (focusedId) { const n = document.getElementById(focusedId); if (n) n.focus({ preventScroll: true }); }
    }
    lastRouteKey = key;
  }
  A.render = render;
  window.addEventListener('hashchange', () => render());

  /* ---------- Accessible dialog: labelled, focus trapped, focus returned ---------- */
  let opener = null;
  function openModal(html, small) {
    if (!modalRoot.innerHTML) opener = document.activeElement;
    modalRoot.innerHTML = '<div class="modal-back" data-act="modal-close-back"><div class="modal' + (small ? ' sm' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">' + html + '</div></div>';
    root.setAttribute('inert', ''); root.setAttribute('aria-hidden', 'true');
    const first = modalRoot.querySelector('.modal-body button, .modal-body a[href], .modal-body input, .modal-body select, .modal-body textarea') || modalRoot.querySelector('button, a[href], input, select, textarea');
    (first || modalRoot.querySelector('.modal')).focus();
  }
  function closeModal() {
    if (!modalRoot.innerHTML) return;
    modalRoot.innerHTML = '';
    root.removeAttribute('inert'); root.removeAttribute('aria-hidden');
    if (opener && document.body.contains(opener)) opener.focus(); else { const h = root.querySelector('[data-view-title]'); if (h) h.focus(); }
    opener = null;
  }
  A.openModal = openModal; A.closeModal = closeModal;
  document.addEventListener('keydown', e => {
    if (!modalRoot.innerHTML) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {
      const f = Array.from(modalRoot.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  const mHead = (title, sub) => '<div class="modal-head"><div>' + (sub ? '<span class="opp-cat">' + esc(sub) + '</span>' : '') + '<h2 id="modal-title">' + title + '</h2></div><button class="icon-btn" data-act="modal-close" aria-label="' + esc(t('close')) + '">' + ic('x') + '</button></div>';
  function oppModal(id, objId) {
    const op = Store.opp(id); if (!op) return;
    const sup = Store.supplier(op.supplierId);
    const obj = objId ? Store.objective(objId) : null;
    const res = obj ? E.evaluate(op, E.normalizeObjective(obj, { today: A.today() }), { today: A.today(), suppliers: Store.state.suppliers, capacity: Store.capacity() }) : null;
    const ev = res ? res.evidence : E.evidenceProfile(op, sup, { today: A.today() });
    const inCmp = Store.state.compare.includes(op.id);
    const sel = obj && obj.selected.includes(op.id);
    openModal(mHead(A.Lh(op.title), A.typeL(op.type) + ' · ' + A.areaL(op.area)) +
      '<div class="modal-body"><div class="meta"><span>' + ic('building') + esc(A.L(sup.name)) + '</span>' + A.verifiedBadge(sup) + (op.status !== 'active' ? A.statusBadge('opp', op.status) : '') + '</div><div class="modal-media">' + A.thumb(op) + '</div><p>' + A.Lh(op.desc) + '</p>' +
      '<div class="rec-facts">' + A.fact(t('fact.price'), op.price != null ? A.money(op.price) : t('price.request'), A.unitL(op.unit) + (op.setupFee ? ' · ' + t('setup') + ' ' + A.money(op.setupFee) : '') + ' · ' + t('exFee')) + A.fact(t('fact.capacity'), t('cap.perDate', { n: op.capacityPerDate }), op.schedule && op.schedule.days.length < 7 ? op.schedule.days.map(d => t('wd.' + d)).join(', ') : t('cov.everyDay')) + A.fact(t('fact.avail'), A.date(op.availableFrom) + ' – ' + A.date(op.availableTo), op.eventDates ? t('cov.eventDates', { d: op.eventDates.map(A.date).join(', ') }) : '') + A.fact(t('lead.t'), t('lead', { n: op.leadDays || 0 })) + '</div>' +
      '<p class="small"><b>' + t('fact.audience') + ':</b> ' + esc(A.oppAudience(op.audience)) + '</p><p class="small"><b>' + t('fact.facilities') + ':</b> ' + esc(A.facilitiesText(op.restrictions)) + '</p><p class="small"><b>' + t('fact.req') + ':</b> ' + (A.L(op.requirements) ? A.Lh(op.requirements) : t('none')) + '</p><p class="small"><b>' + t('fact.expect') + ':</b> ' + t('expect.' + op.type) + '</p>' +
      '<h3 class="h4">' + t('why.evidence') + '</h3>' + A.evidenceHtml(ev) +
      (res ? '<div class="panel" style="padding:16px"><div class="panel-head"><h3>' + t('modal.matchFor', { name: esc(obj.name) }) + '</h3>' + (res.eligible ? A.scoreRing(res.score) : A.badge('bad', t('cat.notEligible'))) + '</div>' + A.checksHtml(res.checks) + A.factorsHtml(res) + '<p class="small"><b>' + t('fact.cost') + ':</b> ' + A.priceText(res.price) + ' · ' + esc(A.coverageText(res.coverage, op)) + '</p></div>' : '') +
      '<div class="form-actions"><button class="btn btn-light btn-sm" data-act="compare" data-id="' + op.id + '" data-modal="1">' + ic('compare') + (inCmp ? t('inCompare') : t('compare')) + '</button>' + (obj ? '<button class="btn ' + (sel ? 'btn-light' : 'btn-dark') + ' btn-sm" data-act="select" data-obj="' + obj.id + '" data-id="' + op.id + '" data-modal="1">' + ic(sel ? 'check' : 'plus') + (sel ? t('selected') : t('select')) + '</button>' : '') + '</div></div>');
  }
  function rfqDocModal(id) {
    const r = Store.rfq(id); if (!r) return;
    openModal(mHead(esc(r.number), t('rfq.request')) + '<div class="modal-body"><dl class="dl">' +
      '<dt>' + t('fld.objective') + '</dt><dd>' + esc(A.objL(r.objective)) + '</dd><dt>' + t('q.product') + '</dt><dd>' + esc(r.product || '—') + '</dd><dt>' + t('fld.audience') + '</dt><dd>' + esc(A.audienceText(Object.assign({}, r.audience))) + '</dd><dt>' + t('fld.areas') + '</dt><dd>' + esc(A.areasL(r.areas)) + '</dd><dt>' + t('fld.dates') + '</dt><dd>' + A.date(r.start) + ' – ' + A.date(r.end) + '</dd><dt>' + t('fld.budget') + '</dt><dd>' + (r.shareBudget === false ? t('rfq.budgetHidden') : A.money(r.budgetMinor)) + '</dd><dt>' + t('fld.success') + '</dt><dd>' + esc(r.success || '—') + '</dd><dt>' + t('rfq.reporting') + '</dt><dd>' + t('rep.' + r.reporting) + '</dd><dt>' + t('rfq.deliverables') + '</dt><dd>' + ((r.requiredDeliverables || []).map(esc).join('<br>') || '—') + '</dd><dt>' + t('rfq.special') + '</dt><dd>' + esc(r.requirements || '—') + '</dd><dt>' + t('rfq.deadline') + '</dt><dd>' + (r.responseDeadline ? A.date(r.responseDeadline) : '—') + '</dd>' +
      '<dt>' + t('rfq.format') + '</dt><dd>' + r.lines.map(l => esc(A.oppTitle(Store.opp(l.oppId))) + ' — ' + esc(A.supName(l.supplierId))).join('<br>') + '</dd></dl></div>');
  }
  function dataModal() {
    const drafts = Store.draft.keys().length;
    openModal(mHead(t('data.title')) + '<div class="modal-body"><p>' + t('data.sub') + '</p>' +
      '<div class="rows">' +
      '<div class="row"><span class="grow"><b>' + t('data.reset') + '</b><small>' + t('data.resetD') + '</small></span><button class="btn btn-light btn-sm" data-act="reset-yes">' + ic('refresh') + t('data.resetBtn') + '</button></div>' +
      '<div class="row"><span class="grow"><b>' + t('data.drafts', { n: drafts }) + '</b><small>' + t('data.draftsD') + '</small></span><button class="btn btn-light btn-sm" data-act="drafts-clear"' + (drafts ? '' : ' disabled') + '>' + ic('trash') + t('data.draftsBtn') + '</button></div>' +
      '<div class="row"><span class="grow"><b>' + t('data.all') + '</b><small>' + t('data.allD') + '</small></span>' + (A.ui.confirm === 'clear-all' ? '<button class="btn btn-danger btn-sm" data-act="clear-all-yes">' + t('data.allYes') + '</button>' : '<button class="btn btn-danger btn-sm" data-act="clear-all">' + ic('trash') + t('data.allBtn') + '</button>') + '</div>' +
      '</div><p class="src">' + t('data.note') + ' <a href="privacy.html#your-data">' + t('data.privacy') + '</a></p></div>', true);
  }
  function sampleDocModal(supId) {
    const s = Store.supplier(supId); if (!s) return;
    openModal(mHead(t('o.v.sampleTitle')) + '<div class="modal-body"><div class="sample-doc" aria-label="' + esc(t('o.v.sampleTitle')) + '"><p class="sample-stamp">' + t('o.v.sampleStamp') + '</p><dl class="dl"><dt>' + t('s.p.nameEn') + '</dt><dd>' + esc(A.L(s.name)) + '</dd><dt>' + t('s.p.licence') + '</dt><dd>' + esc(s.licenceNumber || '—') + '</dd><dt>' + t('s.p.emirate') + '</dt><dd>' + esc(t('em.' + (s.emirate || 'Dubai'))) + '</dd><dt>' + t('o.v.expiry') + '</dt><dd>' + A.date(Dt.addDays(A.today(), 260)) + '</dd></dl></div><p class="src">' + t('o.v.sampleNote') + '</p></div>', true);
  }

  /* ---------- Domain calls with visible errors ---------- */
  function run(errKey, fn, ctxExtra) {
    const res = Store.act(fn, ctxExtra);
    if (!res.ok) {
      A.ui.errors[errKey] = res.error;
      render();
      const box = root.querySelector('.notice.bad[role="alert"]'); if (box) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      A.announce(A.errMsg(res.error));
      return null;
    }
    delete A.ui.errors[errKey];
    if (res.saved === false) A.storageFailed = true;
    return res.value === undefined ? true : res.value;
  }
  const demoId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Click actions ---------- */
  const actions = {
    'lang': () => { flushDrafts(); A.lang = A.lang === 'ar' ? 'en' : 'ar'; CON.setLang(A.lang); render(); A.announce(A.lang === 'ar' ? 'العربية' : 'English'); },
    'data-controls': () => { A.ui.confirm = null; dataModal(); },
    'reset-yes': () => { Store.reset(); closeModal(); A.ui.cat = { q: '', type: '', area: '', max: '', obj: '' }; toast(t('reset.done')); A.go('c-overview'); },
    'drafts-clear': () => { Store.draft.clear(); toast(t('data.draftsDone')); dataModal(); render({ fresh: true }); },
    'clear-all': () => { A.ui.confirm = 'clear-all'; dataModal(); },
    'clear-all-yes': () => { const n = Store.clearAll(); closeModal(); A.ui.confirm = null; toast(t('data.allDone', { n })); Store.load(); A.go('c-overview'); },
    'modal-close': () => closeModal(),
    'modal-close-back': (el, e) => { if (e.target === el) closeModal(); },
    'confirm': el => { A.ui.confirm = el.dataset.key; render(); },
    'confirm-cancel': () => { A.ui.confirm = null; render(); },
    'opp-detail': el => oppModal(el.dataset.id, el.dataset.obj || (parse().page === 'plan' ? parse().id : '')),
    'rfq-doc': el => rfqDocModal(el.dataset.id),
    'sample-doc': el => sampleDocModal(el.dataset.id),
    'plan-tab': el => { A.ui.planTab = el.dataset.tab; render(); const b = root.querySelector('[role="tab"][data-tab="' + el.dataset.tab + '"]'); if (b) b.focus(); },
    'select': el => {
      const now = Store.toggleSelected(el.dataset.obj, el.dataset.id); if (now == null) return;
      const obj = Store.objective(el.dataset.obj);
      toast(now ? t('toast.selected', { name: obj.name }) : t('toast.unselected'));
      if (el.dataset.modal) oppModal(el.dataset.id, obj.id);
      render();
    },
    'compare': el => {
      const r = Store.toggleCompare(el.dataset.id);
      toast(r === 'full' ? t('toast.cmpFull') : r === 'added' ? t('toast.cmpAdd') : t('toast.cmpRemove'), r === 'full' ? 'alert' : 'check-circle');
      if (el.dataset.modal) { const m = modalRoot.querySelector('[data-act="select"]'); oppModal(el.dataset.id, m ? m.dataset.obj : ''); }
      render();
    },
    'compare-clear': () => { Store.refresh(); Store.state.compare = []; Store.save(); render(); },
    'cmp-rfq': el => { Store.setSelected(el.dataset.obj, Store.state.compare); A.go('c-rfq-' + el.dataset.obj); },
    'use-pkg': el => { const ids = el.dataset.ids.split(',').filter(Boolean); Store.setSelected(el.dataset.obj, ids); toast(t('toast.pkg', { n: ids.length })); render(); },
    'cat-clear': () => { A.ui.cat = { q: '', type: '', area: '', max: '', obj: A.ui.cat.obj }; render({ fresh: true }); },
    'obj-delete': el => { const ok = Store.deleteObjective(el.dataset.id); A.ui.confirm = null; toast(ok ? t('toast.deleted') : t('toast.objHasRfq'), ok ? 'check-circle' : 'alert'); render(); },
    'mig-dismiss': () => { Store.refresh(); delete Store.state.migratedNotice; Store.save(); render(); },
    'draft-discard': el => { Store.draft.remove(el.dataset.key); toast(t('draft.discarded')); render({ fresh: true }); },
    'merge-dismiss': el => { const d = Store.draft.get(el.dataset.key); if (d) { delete d.extraction; Store.draft.set(el.dataset.key, d); } render(); },
    'nudge': el => {
      const r = Store.rfq(el.dataset.id); if (!r) return;
      Store.refresh(); const rr = Store.rfq(el.dataset.id);
      let sim = 0; rr.lines.forEach(l => { if (l.status === 'requested' && l.supplierId !== Store.state.activeSupplierId) { l.simulateAt = Date.now() - 1; sim++; } });
      Store.save();
      const res = Store.tick();
      toast(sim ? t('toast.nudged3', { n: res.replies.length }) : t('toast.nudgedReal3'), 'bolt');
      render();
    },
    'unapprove': el => { if (run('approve:' + el.dataset.line, (st, ctx) => Dm.unapprove(st, { rfqId: el.dataset.rfq, line: el.dataset.line }, ctx))) { toast(t('toast.unapproved')); render(); } },
    'deliver': el => { if (run('bk:' + el.dataset.id, (st, ctx) => Dm.acceptDelivery(st, { bookingId: el.dataset.id }, ctx))) { A.ui.confirm = null; toast(t('toast.delivered3')); render(); } },
    'bk-cancel': el => { if (run('bk:' + el.dataset.id, (st, ctx) => Dm.cancelBooking(st, { bookingId: el.dataset.id, reason: 'Cancelled by customer (demo)' }, ctx))) { A.ui.confirm = null; toast(t('toast.cancelled')); render(); } },
    'advance': el => { if (run('bk:' + el.dataset.id, (st, ctx) => Dm.advanceBooking(st, { bookingId: el.dataset.id, event: el.dataset.ev }, ctx))) { toast(t('toast.status', { st: t('bk.' + Store.booking(el.dataset.id).status) })); render(); } },
    'sim-pay': el => {
      const p = Store.payment(el.dataset.id); if (!p) return;
      const ok = el.dataset.ok === '1';
      if (run('pay:' + p.id, (st, ctx) => Dm.paymentEvent(st, { eventId: demoId('demo-evt-'), paymentId: p.id, type: ok ? 'payment.succeeded' : 'payment.failed', amount: p.amount.total, simulated: true, reason: 'Simulated failure (demo)' }, ctx), { role: 'system', actor: 'demo-payment-simulator' })) {
        const np = Store.payment(p.id);
        toast(np.status === 'paid' ? t('toast.paidSim') : t('toast.payFailedSim'), np.status === 'paid' ? 'check-circle' : 'alert'); render();
      }
    },
    'refund-approve': el => { if (run('ops-pay', (st, ctx) => Dm.decideRefund(st, { refundId: el.dataset.id, decision: 'approve' }, ctx))) render(); },
    'refund-reject': el => { if (run('ops-pay', (st, ctx) => Dm.decideRefund(st, { refundId: el.dataset.id, decision: 'reject', reason: 'Rejected in demo review' }, ctx))) render(); },
    'refund-process': el => { if (run('ops-pay', (st, ctx) => Dm.refundProcessed(st, { refundId: el.dataset.id, eventId: demoId('demo-rf-'), simulated: true }, ctx))) { toast(t('toast.refundSim')); render(); } },
    'release': el => { if (run('ops-pay', (st, ctx) => Dm.releasePayout(st, { payoutId: el.dataset.id }, ctx))) { toast(t('toast.released3')); render(); } },
    'metric-add': el => {
      const wrap = el.closest('form').querySelector('[data-metric-rows]');
      const n = wrap.children.length;
      const tpl = document.createElement('div');
      tpl.innerHTML = wrap.children[0].outerHTML.replace(/id="m([nvum])0"/g, 'id="m$1' + n + '"').replace(/for="m([nvum])0"/g, 'for="m$1' + n + '"');
      const row = tpl.firstChild; row.querySelectorAll('input').forEach(i => { i.value = ''; }); row.querySelector('select').value = 'counted';
      wrap.appendChild(row); row.querySelector('input').focus();
    },
    'metric-remove': el => { const wrap = el.closest('[data-metric-rows]'); if (wrap.children.length > 1) el.closest('.metric-row').remove(); else el.closest('.metric-row').querySelectorAll('input').forEach(i => { i.value = ''; }); },
    'opp-pause': el => { const op = Store.opp(el.dataset.id); if (run('listing-del', (st, ctx) => Dm.setListingStatus(st, op.id, op.status === 'active' ? 'paused' : 'active', ctx))) { toast(Store.opp(el.dataset.id).status === 'active' ? t('toast.activated') : t('toast.paused')); render(); } },
    'opp-delete': el => { const res = run('listing-del', (st, ctx) => Dm.removeListing(st, el.dataset.id, ctx)); A.ui.confirm = null; if (res) { toast(res.archived ? t('toast.archived') : t('toast.deleted')); render(); } },
    'upload-clear': () => { A.ui.upload = ''; render(); },
    'import-example': () => { A.ui.importText = A.CSV_TEMPLATE; A.ui.importRows = null; render({ fresh: true }); },
    'import-commit': () => {
      const rows = (A.ui.importRows || []).filter(r => !r.errors.length);
      const res = run('import', (st, ctx) => rows.map(r => Dm.saveListing(st, r.op, ctx)));
      if (!res) return;
      toast(t('toast.imported', { n: rows.length }));
      A.ui.importRows = null; A.ui.importText = '';
      A.go('s-listings');
    },
    'sup-register': () => openModal(mHead(t('s.register')) + '<form class="modal-body" data-form="register" novalidate><p class="muted small">' + t('s.registerSub') + '</p><div class="field"><label for="rg-name">' + t('s.p.nameEn') + '</label><input class="input" id="rg-name" name="name" required maxlength="100"></div><div class="field"><label for="rg-name-ar">' + t('s.p.nameAr') + '</label><input class="input" id="rg-name-ar" name="nameAr" lang="ar" dir="rtl" maxlength="100"></div><div class="field"><label for="rg-cat">' + t('s.p.category') + '</label><select class="select" id="rg-cat" name="category">' + D.types.map(ty => '<option value="' + ty + '">' + esc(A.typeL(ty)) + '</option>').join('') + '</select></div><div class="field"><label for="rg-lic">' + t('s.p.licence') + '</label><input class="input" id="rg-lic" name="licence" required maxlength="30"></div><div class="field"><label for="rg-contact">' + t('s.p.contact') + '</label><input class="input" id="rg-contact" name="contact" type="email" required maxlength="120"></div><label class="check"><input type="checkbox" name="vatRegistered" checked><span>' + t('s.vatReg', { pct: A.vatPct() }) + '</span></label><p class="error-text" data-error role="alert" hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('check') + t('s.registerBtn') + '</button></div></form>', true),
    'revise': el => { A.ui.offerForm[el.dataset.line] = true; render(); },
    'revise-cancel': el => { A.ui.offerForm[el.dataset.line] = false; render({ fresh: true }); },
    'withdraw': el => { if (run('respond:' + el.dataset.line, (st, ctx) => Dm.withdraw(st, { rfqId: el.dataset.rfq, line: el.dataset.line, reason: 'Withdrawn by supplier' }, ctx))) { A.ui.confirm = null; toast(t('toast.withdrawn')); render(); } },
    'scenario': el => { A.ui.scenario = el.dataset.s; render({ fresh: true }); },
    'econ-reset': () => { Store.refresh(); const s = Store.state; if (s.econ) delete s.econ[A.ui.scenario]; Store.save(); render({ fresh: true }); },
    'econ-pilot': () => {
      const m = A.metrics('user');
      if (!m.txs) { toast(t('toast.noPilot3'), 'info'); return; }
      Store.refresh(); const s = Store.state; s.econ = s.econ || {};
      const cur = Object.assign({}, (s.econ[A.ui.scenario]) || A.SCENARIOS[A.ui.scenario]);
      cur.atv = Math.round(m.atv / 100); cur.take = Math.round(m.takeRate * 1000) / 10;
      s.econ[A.ui.scenario] = cur; Store.save(); toast(t('toast.pilotUsed')); render({ fresh: true });
    }
  };
  function onAction(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.tagName === 'INPUT' && el.type === 'radio') return; // handled on change
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
  }
  root.addEventListener('click', onAction);
  modalRoot.addEventListener('click', onAction);
  root.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-act]')) { e.preventDefault(); onAction(e); return; }
    // Tabs: arrow keys move between tabs (WAI-ARIA tabs pattern, automatic activation)
    if (e.target.getAttribute && e.target.getAttribute('role') === 'tab' && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const tabs = Array.from(e.target.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
      let i = tabs.indexOf(e.target);
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'Home') i = 0; else if (e.key === 'End') i = tabs.length - 1;
      else i = (i + ((e.key === 'ArrowRight') !== rtl ? 1 : -1) + tabs.length) % tabs.length;
      e.preventDefault(); tabs[i].click();
    }
  });

  /* ---------- Drafts: saved as you type; failures are shown, not hidden ---------- */
  let draftTimer = null; let draftPending = null;
  function saveDraft(key) {
    const of = root.querySelector('form[data-draft="' + key + '"]');
    const sentence = root.querySelector('textarea[data-draft="' + key + '"]');
    const prev = Store.draft.get(key) || {};
    const next = Object.assign({}, prev);
    if (of) next.values = A.serializeForm(of);
    if (sentence) next.sentence = sentence.value;
    const ok = Store.draft.set(key, next);
    const st = root.querySelector('[data-save-status]');
    if (st) { st.textContent = ok ? t('draft.savedAt', { d: A.dateTime(new Date().toISOString()) }) : t('draft.saveFailed'); st.classList.toggle('bad', !ok); }
    if (!ok) A.storageFailed = true;
    return ok;
  }
  function queueDraft(key, field) {
    if (field && key.indexOf('obj.') === 0) {
      const d = Store.draft.get(key) || {}; d.origin = d.origin || {};
      const f = field === 'ageMin' || field === 'ageMax' ? 'age' : field;
      if (f && f !== 'sentence') { d.origin[f] = 'typed'; Store.draft.set(key, d); }
    }
    draftPending = key; clearTimeout(draftTimer); draftTimer = setTimeout(() => { saveDraft(key); draftPending = null; }, 300);
  }
  function flushDrafts() { if (draftPending) { clearTimeout(draftTimer); saveDraft(draftPending); draftPending = null; } }
  window.addEventListener('pagehide', flushDrafts);

  /* ---------- Live inputs ---------- */
  let liveTimer;
  root.addEventListener('input', e => {
    const el = e.target;
    const dk = el.closest('[data-draft]');
    if (dk) queueDraft(dk.getAttribute('data-draft'), el.name);
    if (el.dataset.live === 'cat') { A.ui.cat[el.dataset.key] = el.value; clearTimeout(liveTimer); liveTimer = setTimeout(() => { const pos = el.selectionStart; render(); const n = document.getElementById(el.id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* select */ } } }, el.tagName === 'INPUT' ? 220 : 0); }
    if (el.dataset.live === 'econ') {
      const f = el.closest('form'); const v = {};
      Object.keys(A.SCENARIOS.base).forEach(k => { v[k] = Math.max(0, Number(f.elements[k].value) || 0); });
      Store.refresh(); const s = Store.state; s.econ = s.econ || {}; s.econ[A.ui.scenario] = v; Store.save();
      document.querySelector('[data-econ-out]').innerHTML = A.econOut(A.econCalc(v));
    }
    if (el.dataset.live === 'killnote' || el.dataset.live === 'pilotnote') {
      const bucket = el.dataset.live === 'killnote' ? 'kill' : 'pilot';
      clearTimeout(liveTimer); liveTimer = setTimeout(() => { Store.refresh(); const s = Store.state; s[bucket] = s[bucket] || {}; s[bucket][el.dataset.k] = Object.assign({}, s[bucket][el.dataset.k], { note: el.value }); Store.save(); }, 300);
    }
  });
  root.addEventListener('change', e => {
    const el = e.target;
    const dk = el.closest('[data-draft]');
    if (dk) queueDraft(dk.getAttribute('data-draft'), el.name);
    if (el.dataset.live === 'cat' && el.tagName === 'SELECT') { A.ui.cat[el.dataset.key] = el.value; render(); }
    if (el.dataset.live === 'cmpobj') { A.ui.compareObj = el.value; render(); }
    if (el.dataset.live === 'auditfilter') { A.ui.auditFilter = el.value; render(); }
    if (el.dataset.act === 'map-view') { A.ui.mapView = el.value; render(); }
    if (el.dataset.live === 'supswitch') { Store.setSupplier(el.value); toast(t('toast.actingAs', { name: A.supName(el.value) })); render({ fresh: true }); }
    if (el.dataset.live === 'kill' || el.dataset.live === 'pilot') { const bucket = el.dataset.live; Store.refresh(); const s = Store.state; s[bucket] = s[bucket] || {}; s[bucket][el.dataset.k] = Object.assign({}, s[bucket][el.dataset.k], { status: el.value }); Store.save(); render(); }
    if (el.name === 'areas' && el.closest('form[data-form="objective"]')) {
      const boxes = el.closest('form').querySelectorAll('input[name="areas"]');
      if (el.value === 'all' && el.checked) boxes.forEach(b => { if (b.value !== 'all') b.checked = false; });
      else if (el.checked) boxes.forEach(b => { if (b.value === 'all') b.checked = false; });
      if (!Array.from(boxes).some(b => b.checked)) boxes[0].checked = true;
      queueDraft(el.closest('form').getAttribute('data-draft'), 'areas');
    }
    if (el.closest('form[data-form="objective"]') && ['budget', 'start', 'duration'].includes(el.name)) { flushDrafts(); render(); }
    if (el.name === 'anyCategory' && el.checked) el.closest('form').querySelectorAll('input[name="cats"]').forEach(c => { c.checked = false; });
    if (el.name === 'cats' && el.checked) { const any = el.closest('form').querySelector('input[name="anyCategory"]'); if (any) any.checked = false; }
    if (el.matches('[data-upload]') && el.files && el.files[0]) {
      A.readImage(el.files[0], 720).then(url => {
        if (url.length > 400000) { toast(t('toast.imgBig'), 'alert'); return; }
        flushDrafts(); A.ui.upload = url; render();
      }).catch(err => toast(err.message === 'type' ? t('toast.imgType') : t('toast.imgFail'), 'alert'));
    }
    if (el.matches('[data-doc-pick]') && el.files && el.files[0]) {
      const f = el.files[0];
      const meta = { fileName: f.name.slice(0, 120), size: f.size, type: f.type, storage: 'local-only' };
      const errs = Dm.validateDocument(meta);
      if (errs.length) { A.ui.docPick = null; toast(errs.map(x => t('doc.' + x.code.replace('doc.', ''))).join(' '), 'alert'); el.value = ''; }
      else A.ui.docPick = meta;
      render();
    }
    if (el.matches('[data-import-file]') && el.files && el.files[0]) {
      const fr = new FileReader();
      fr.onload = () => { A.ui.importText = String(fr.result || '').slice(0, 200000); A.ui.importRows = null; render({ fresh: true }); };
      fr.readAsText(el.files[0]);
    }
  });

  /* ---------- Forms ---------- */
  function showErr(form, msg, fieldName) {
    const p = form.querySelector('[data-error]');
    form.querySelectorAll('[aria-invalid]').forEach(x => { x.removeAttribute('aria-invalid'); x.classList.remove('invalid'); });
    if (p) { if (!p.id) p.id = 'err-' + Math.random().toString(36).slice(2, 8); p.textContent = msg; p.hidden = false; }
    if (fieldName) {
      const f = form.elements[fieldName]; const node = f && (f.length && !f.tagName ? f[0] : f);
      if (node && node.classList) { node.classList.add('invalid'); node.setAttribute('aria-invalid', 'true'); if (p) node.setAttribute('aria-describedby', ((node.getAttribute('aria-describedby') || '').replace(p.id, '') + ' ' + p.id).trim()); node.focus(); }
    } else if (p) p.focus && p.setAttribute('tabindex', '-1');
    if (!p) toast(msg, 'alert');
    A.announce(msg);
    return false;
  }
  const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  const toMinor = s => { const v = String(s == null ? '' : s).trim().replace(/,/g, ''); if (v === '') return null; try { return M.fromAED(v); } catch (e) { return undefined; } };
  const lines = s => String(s || '').split(/\n|;/).map(x => x.trim()).filter(Boolean);

  const forms = {
    extract(f) {
      const text = f.elements.sentence.value.trim();
      if (!text) { toast(t('err.sentence'), 'alert'); f.elements.sentence.focus(); return; }
      const key = f.dataset.key;
      flushDrafts(); saveDraft(key); // keep everything typed so far
      const x = CON.Parse.extract(text, { today: A.today() });
      const d = Store.draft.get(key) || {};
      d.sentence = text;
      d.extraction = { text, found: x.found, fields: x.fields, excluded: x.excluded, requirements: x.requirements, today: x.today };
      if (!d.values) { const of = root.querySelector('form[data-form="objective"]'); if (of) d.values = A.serializeForm(of); }
      const ok = Store.draft.set(key, d);
      if (!ok) A.storageFailed = true;
      render();
      const h = document.getElementById('merge-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      A.announce(x.found.length ? t('toast.extracted3', { n: x.found.length }) : t('c.extract.none'));
    },
    merge(f) {
      const key = f.dataset.key;
      flushDrafts();
      const fs = A.objFormState(f.dataset.key === 'obj.new' ? null : f.dataset.key.replace(/^obj\./, ''));
      const rows = A.mergeRows(fs);
      const chosen = Array.from(document.querySelectorAll('input[form="merge-form"][name="apply"]:checked')).map(c => rows[+c.value]).filter(Boolean);
      const d = Store.draft.get(key) || {}; d.values = Object.assign({}, fs.values); d.origin = Object.assign({}, fs.origin);
      chosen.forEach(r => {
        if (r.field === 'age') { d.values.ageMin = r.proposed[0]; d.values.ageMax = r.proposed[1]; }
        else d.values[r.field] = r.proposed;
        if (r.field === 'budget' && r.status === 'confirm') d.values.budgetConfirm = true;
        d.origin[r.field] = 'sentence';
      });
      if (!d.values.name) d.values.name = t('obj.' + (d.values.objective || 'trial')) + ' · ' + A.date(A.today());
      delete d.extraction;
      Store.draft.set(key, d);
      render({ fresh: true });
      toast(t('merge.applied', { n: chosen.length }));
    },
    objective(f) {
      flushDrafts();
      const v = A.serializeForm(f);
      const name = String(v.name || '').trim();
      if (!name) return showErr(f, t('err.name'), 'name');
      const ageMin = Number(v.ageMin), ageMax = Number(v.ageMax);
      if (!(Number.isInteger(ageMin) && Number.isInteger(ageMax) && ageMin >= 13 && ageMax <= 99 && ageMin < ageMax)) return showErr(f, t('err.age3'), 'ageMin');
      const budgetMinor = toMinor(v.budget);
      if (budgetMinor == null || budgetMinor === undefined || budgetMinor <= 0) return showErr(f, t('err.budget3'), 'budget');
      const L = CON.Parse.LIMITS;
      if ((budgetMinor < L.budgetMinFils || budgetMinor > L.budgetMaxFils) && !v.budgetConfirm) { render(); const nf = root.querySelector('form[data-form="objective"]'); return showErr(nf, t('err.budgetConfirm', { v: A.money(budgetMinor) }), 'budgetConfirm'); }
      const start = v.start;
      if (!Dt.isIso(start)) return showErr(f, t('err.date'), 'start');
      if (start < A.today()) return showErr(f, t('err.start3', { d: A.date(A.today()) }), 'start');
      const duration = Number(v.duration);
      if (!(Number.isInteger(duration) && duration >= 1 && duration <= 365)) return showErr(f, t('err.duration3'), 'duration');
      const target = v.target === '' ? null : Number(String(v.target).replace(/,/g, ''));
      if (target != null && !(Number.isInteger(target) && target >= 0 && target <= CON.Parse.LIMITS.targetMax)) return showErr(f, t('err.target'), 'target');
      const needs = {}; (v.needs || []).forEach(k => { needs[k] = true; });
      const fields = { objective: v.objective, product: v.product, productCategory: v.productCategory || null, success: v.success, target, gender: v.gender, ageMin, ageMax, interests: v.interests || [], areas: v.areas || ['all'], budgetMinor, start, duration,
        requirements: { audience: v.reqAudience, areas: v.reqAreas, coverage: v.reqCoverage, verifiedOnly: !!v.verifiedOnly }, needs };
      const d = Store.draft.get(f.dataset.draft) || {};
      const meta = { name, source: d.sentence ? 'sentence' : 'form', sentence: d.sentence || '', extraction: d.extraction ? d.extraction.found : (d.lastFound || null) };
      const obj = f.dataset.id ? Store.updateObjective(f.dataset.id, fields, meta) : Store.createObjective(fields, meta);
      Store.draft.remove(f.dataset.draft);
      toast(f.dataset.id ? t('toast.updated') : t('toast.planReady'));
      A.ui.planTab = 'rec';
      A.go('c-plan-' + obj.id);
    },
    rfq(f) {
      const fd = new FormData(f);
      const deadline = fd.get('deadline');
      const obj = Store.objective(f.dataset.obj);
      const meta = { reporting: fd.get('reporting'), requirements: String(fd.get('requirements') || '').trim(), requiredDeliverables: lines(fd.get('deliverables')), responseDeadline: deadline, shareBudget: !!fd.get('shareBudget') };
      const rfq = run('rfq:' + obj.id, (st, ctx) => { const r = Dm.createRfq(st, { objectiveId: obj.id, oppIds: obj.selected.slice(), meta }, ctx); const act = st.activeSupplierId; const now = Date.now(); r.lines.forEach((l, i) => { if (l.supplierId !== act) l.simulateAt = now + 1500 + i * 900; }); return r; });
      if (!rfq) return;
      toast(t('toast.rfqSent3', { n: rfq.suppliers.length, num: rfq.number }), 'send');
      A.go('c-offers-' + rfq.id);
    },
    approve(f) {
      const v = A.serializeForm(f);
      const devs = v.dev || [];
      const res = run('approve:' + f.dataset.line, (st, ctx) => Dm.approve(st, { rfqId: f.dataset.rfq, line: f.dataset.line, acceptedDeviations: devs, allowOverBudget: !!v.overBudget }, ctx));
      if (res) { toast(t('toast.approved3')); render({ fresh: true }); }
    },
    checkout(f) {
      const fd = new FormData(f);
      const company = String(fd.get('company') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const trn = String(fd.get('trn') || '').trim();
      if (!company) return showErr(f, t('err.company'), 'company');
      if (!isEmail(email)) return showErr(f, t('err.email'), 'email');
      if (trn && !/^\d{15}$/.test(trn)) return showErr(f, t('err.trn'), 'trn');
      if (!fd.get('ack')) return showErr(f, t('err.ack'), 'ack');
      const btn = f.querySelector('button[type="submit"]'); if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
      const res = run('checkout:' + f.dataset.rfq, (st, ctx) => { const r = Dm.checkout(st, { rfqId: f.dataset.rfq, method: fd.get('method'), billing: { company, email, trn }, idempotencyKey: f.dataset.key }, ctx); st.company = company; return r; });
      if (!res) return;
      toast(res.replay ? t('toast.coReplay', { num: res.payment.number }) : t('toast.reserved', { num: res.payment.number }), 'check-circle');
      A.go('c-payment-' + res.payment.id);
    },
    outcome(f) {
      const fd = new FormData(f);
      const nRaw = String(fd.get('newCustomers') || '').trim();
      const n = nRaw === '' ? null : Number(nRaw.replace(/,/g, ''));
      const rev = toMinor(fd.get('revenue'));
      if ((n != null && !(Number.isInteger(n) && n >= 0)) || rev === undefined) return showErr(f, t('err.number'), n != null && !(Number.isInteger(n) && n >= 0) ? 'newCustomers' : 'revenue');
      if (n == null && rev == null) return showErr(f, t('err.outcome'), 'newCustomers');
      if (run('bk:' + f.dataset.id, (st, ctx) => Dm.setOutcome(st, { bookingId: f.dataset.id, newCustomers: n, revenueMinor: rev, how: fd.get('how') }, ctx))) { toast(t('toast.saved')); render({ fresh: true }); }
    },
    dispute(f) {
      const reason = String(new FormData(f).get('reason') || '').trim();
      if (reason.length < 10) return showErr(f, t('err.code.DISPUTE_REASON_REQUIRED'), 'reason');
      if (run('bk:' + f.dataset.id, (st, ctx) => Dm.openDispute(st, { bookingId: f.dataset.id, reason }, ctx))) { toast(t('toast.disputed')); render({ fresh: true }); }
    },
    resolve(f, submitter) {
      const reason = String(new FormData(f).get('reason') || '').trim();
      if (reason.length < 5) return showErr(f, t('err.code.DISPUTE_RESOLUTION_REASON_REQUIRED'), 'reason');
      if (run('resolve:' + f.dataset.id, (st, ctx) => Dm.resolveDispute(st, { disputeId: f.dataset.id, outcome: submitter && submitter.value, reason }, ctx))) { toast(t('toast.resolved')); render({ fresh: true }); }
    },
    respond(f) {
      const fd = new FormData(f);
      const rfqId = f.dataset.rfq, line = f.dataset.line;
      if (fd.get('decision') === 'decline') {
        if (run('respond:' + line, (st, ctx) => Dm.respond(st, { rfqId, line, decline: true, reason: String(fd.get('reason') || '').trim() || t('decl.other') }, ctx))) { toast(t('toast.declined')); render({ fresh: true }); }
        return;
      }
      const base = toMinor(fd.get('basePrice')), setup = toMinor(fd.get('setupFee') || '0');
      if (base == null || base === undefined) return showErr(f, t('err.price3'), 'basePrice');
      if (setup === undefined) return showErr(f, t('err.price3'), 'setupFee');
      const from = fd.get('from'), to = fd.get('to');
      if (!Dt.isIso(from) || !Dt.isIso(to) || to < from) return showErr(f, t('err.range'), 'to');
      const valid = fd.get('validUntil');
      if (!Dt.isIso(valid) || valid < A.today()) return showErr(f, t('err.valid'), 'validUntil');
      const deliverables = lines(fd.get('deliverables'));
      if (!deliverables.length) return showErr(f, t('err.deliverables'), 'deliverables');
      const input = { basePrice: base, setupFee: setup || 0, units: Number(fd.get('units')), from, to, reporting: fd.get('reporting'), terms: fd.get('terms'), validUntil: valid, deliverables, vatRegistered: !!fd.get('vatRegistered') };
      const res = run('respond:' + line, (st, ctx) => Dm.respond(st, { rfqId, line, input }, ctx));
      if (res) { A.ui.offerForm[line] = false; toast(res.offers.length > 1 ? t('toast.revised') : t('toast.replied')); render({ fresh: true }); }
    },
    report(f) {
      const rows = Array.from(f.querySelectorAll('.metric-row')).map(r => ({ name: r.querySelector('[name="name"]').value.trim(), value: r.querySelector('[name="value"]').value, unit: r.querySelector('[name="unit"]').value.trim(), method: r.querySelector('[name="method"]').value, note: '' })).filter(m => m.name || m.value !== '');
      if (!rows.length) return showErr(f, t('err.metric'));
      for (const m of rows) { if (!m.name || m.value === '' || Number(m.value) < 0) return showErr(f, t('err.metricRow')); m.value = Number(m.value); }
      if (run('bk:' + f.dataset.id, (st, ctx) => Dm.submitReport(st, { bookingId: f.dataset.id, metrics: rows }, ctx))) { toast(t('toast.reported')); render({ fresh: true }); }
    },
    listing(f) {
      flushDrafts();
      const v = A.serializeForm(f);
      const titleEn = String(v.titleEn || '').trim(), titleAr = String(v.titleAr || '').trim();
      if (!titleEn && !titleAr) return showErr(f, t('err.title3'), 'titleEn');
      const price = toMinor(v.price), setup = toMinor(v.setupFee || '0');
      if (price === undefined) return showErr(f, t('err.price3'), 'price');
      if (setup === undefined) return showErr(f, t('err.price3'), 'setupFee');
      if (!Dt.isIso(v.availableFrom) || !Dt.isIso(v.availableTo) || v.availableTo < v.availableFrom) return showErr(f, t('err.range'), 'availableTo');
      const days = (v.days || []).map(Number);
      if (!days.length) return showErr(f, t('err.days'), 'days');
      const evDates = String(v.eventDates || '').split(/[,\s]+/).filter(Boolean);
      if (evDates.some(d => !Dt.isIso(d))) return showErr(f, t('err.eventDates'), 'eventDates');
      if (v.unit === 'activation' && !evDates.length) { /* allowed: dates to be confirmed */ }
      const ageMin = v.ageMin === '' ? null : Number(v.ageMin), ageMax = v.ageMax === '' ? null : Number(v.ageMax);
      if ((ageMin != null || ageMax != null) && !(ageMin >= 13 && ageMax <= 99 && ageMin < ageMax)) return showErr(f, t('err.age3'), 'ageMin');
      const minU = Math.max(1, parseInt(v.minUnits, 10) || 1);
      const maxU = v.maxUnits === '' ? null : parseInt(v.maxUnits, 10);
      if (maxU != null && !(maxU >= minU)) return showErr(f, t('err.units'), 'maxUnits');
      const cap = parseInt(v.capacityPerDate, 10);
      if (!(cap >= 1 && cap <= 1000)) return showErr(f, t('err.capacity'), 'capacityPerDate');
      const cats = v.anyCategory ? null : (v.cats || []);
      if (cats && !cats.length) return showErr(f, t('err.cats'), 'anyCategory');
      const tri = x => x === 'yes' ? true : x === 'no' ? false : null;
      const existing = f.dataset.id ? Store.opp(f.dataset.id) : null;
      const today = A.today();
      const evidence = (existing ? (existing.evidence || []).filter(e => e.source !== 'supplier_declared') : []);
      [0, 1].forEach(i => {
        const kind = v['evKind' + i]; const val = Number(v['evValue' + i]);
        if (!kind || !(val > 0)) return;
        const pe = v['evDate' + i] ? v['evDate' + i] : today.slice(0, 7);
        evidence.push({ kind, metric: v['evMetric' + i], period: v['evPeriod' + i], method: v['evMethod' + i], value: Math.round(val), label: t('evmet.' + v['evMetric' + i]), source: 'supplier_declared', verification: 'unverified', periodEnd: pe, reviewedAt: null, expiresAt: Dt.addDays(pe + '-28', 372) });
      });
      const op = Object.assign({}, existing || { v: 3, id: Store.uid('op'), supplierId: Store.state.activeSupplierId, baseBooked: 0, status: 'active', version: 1 }, {
        type: v.type, area: v.area,
        title: { en: titleEn, ar: titleAr }, desc: { en: String(v.descEn || '').trim(), ar: String(v.descAr || '').trim() }, requirements: { en: String(v.reqEn || '').trim(), ar: String(v.reqAr || '').trim() },
        price, unit: v.unit, setupFee: setup || 0, minUnits: minU, maxUnits: maxU,
        availableFrom: v.availableFrom, availableTo: v.availableTo, leadDays: Math.max(0, parseInt(v.leadDays, 10) || 0),
        schedule: { days }, eventDates: evDates.length ? evDates.sort() : null, capacityPerDate: cap,
        audience: { gender: v.gender, access: v.access, ageMin, ageMax, interests: v.interests || [] },
        restrictions: { categoriesAllowed: cats, categoriesBlocked: [], foodSampling: tri(v.foodSampling), refrigeration: tri(v.refrigeration), electricity: tri(v.electricity), staffingProvided: tri(v.staffingProvided) },
        services: (existing && existing.services) || { included: [], excluded: [] },
        evidence,
        image: A.ui.upload != null ? (A.ui.upload || undefined) : (existing && existing.image)
      });
      if (!op.image) delete op.image;
      delete op.demo;
      const saved = run('listing', (st, ctx) => Dm.saveListing(st, op, ctx));
      if (!saved) return;
      Store.draft.remove(f.dataset.draft);
      A.ui.upload = null;
      toast(existing ? t('toast.updatedV', { v: saved.version }) : t('toast.published'));
      A.go('s-listings');
    },
    import(f) {
      const text = f.elements.csv.value;
      A.ui.importText = text;
      const rows = A.parseCSV(text);
      if (rows.length < 2) return showErr(f, t('err.csv'));
      const head = rows[0].map(h => h.trim().toLowerCase());
      const need = ['title', 'type', 'area', 'price', 'unit', 'available_from', 'available_to'];
      const missing = need.filter(n => !head.includes(n));
      if (missing.length) return showErr(f, t('err.csvCols', { cols: missing.join(', ') }));
      const get = (r, k) => { const i = head.indexOf(k); return i >= 0 ? String(r[i] || '').trim() : ''; };
      A.ui.importRows = rows.slice(1, 201).map(r => {
        const raw = Object.fromEntries(head.map(h => [h, get(r, h)]));
        const errors = [];
        if (!raw.title && !raw.title_ar) errors.push('title');
        if (!D.types.includes(raw.type)) errors.push('type');
        if (raw.area !== 'all' && !D.areas[raw.area]) errors.push('area');
        const price = toMinor(raw.price); if (price == null || price === undefined) errors.push('price');
        const setup = toMinor(raw.setup_fee || '0'); if (setup === undefined) errors.push('price');
        if (!['day', 'week', 'month', 'activation'].includes(raw.unit)) errors.push('unit');
        if (!Dt.isIso(raw.available_from) || !Dt.isIso(raw.available_to) || raw.available_to < raw.available_from) errors.push('dates');
        const days = raw.days ? raw.days.split('|').map(Number).filter(d => d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6];
        const op = { v: 3, id: Store.uid('op'), supplierId: Store.state.activeSupplierId, type: raw.type, area: raw.area, title: { en: raw.title, ar: raw.title_ar || '' }, desc: { en: raw.description || '', ar: raw.description_ar || '' }, requirements: { en: raw.requirements || '', ar: raw.requirements_ar || '' },
          price: price || null, unit: raw.unit, setupFee: setup || 0, minUnits: 1, maxUnits: raw.unit === 'day' ? 60 : raw.unit === 'week' ? 12 : raw.unit === 'month' ? 6 : 1,
          availableFrom: raw.available_from, availableTo: raw.available_to, leadDays: 7, capacityPerDate: Math.max(1, parseInt(raw.capacity_per_date || raw.slots, 10) || 1), baseBooked: 0, schedule: { days: days.length ? days : [0, 1, 2, 3, 4, 5, 6] }, eventDates: null,
          audience: { gender: ['mixed', 'female', 'male'].includes(raw.gender) ? raw.gender : 'mixed', access: ['open', 'female_only', 'male_only', 'members_only'].includes(raw.access) ? raw.access : 'open', ageMin: parseInt(raw.age_min, 10) || null, ageMax: parseInt(raw.age_max, 10) || null, interests: (raw.interests || '').split('|').map(x => x.trim()).filter(x => D.interests.includes(x)) },
          restrictions: { categoriesAllowed: null, categoriesBlocked: [], foodSampling: null, refrigeration: null, electricity: null, staffingProvided: null }, services: { included: [], excluded: [] }, evidence: [], status: 'active', version: 1 };
        if (!errors.length) { const ve = Dm.validateListing(op); ve.forEach(e => errors.push(e.field === 'title' ? 'title' : e.field === 'price' ? 'price' : 'dates')); }
        return { raw, op, errors: Array.from(new Set(errors)) };
      });
      render({ fresh: true });
    },
    profile(f) {
      const fd = new FormData(f);
      const name = String(fd.get('name') || '').trim(), nameAr = String(fd.get('nameAr') || '').trim(), licence = String(fd.get('licence') || '').trim(), contact = String(fd.get('contact') || '').trim();
      if (!name && !nameAr) return showErr(f, t('err.name'), 'name');
      if (!/^[A-Za-z0-9\-\/]{3,30}$/.test(licence)) return showErr(f, t('err.licence3'), 'licence');
      if (!isEmail(contact)) return showErr(f, t('err.email'), 'contact');
      const before = Store.supplier(f.dataset.id).verification.status;
      const res = run('profile', (st, ctx) => { const s = Dm.updateSupplierProfile(st, { supplierId: f.dataset.id, name: { en: name, ar: nameAr }, contact, licenceNumber: licence, vatRegistered: !!fd.get('vatRegistered') }, ctx); s.emirate = fd.get('emirate'); s.category = fd.get('category'); return s; });
      if (!res) return;
      toast(before === 'licence_reviewed' && res.verification.status !== 'licence_reviewed' ? t('toast.reviewAgain') : t('toast.saved'));
      render({ fresh: true });
    },
    'verify-submit'(f, submitter) {
      const sup = Store.supplier(f.dataset.id);
      const intent = submitter && submitter.value;
      const doc = intent === 'sample' ? CON.Migrate.SAMPLE_DOC(sup.id, new Date().toISOString()) : A.ui.docPick;
      if (!doc) return showErr(f, t('err.doc3'), 'doc');
      const res = run('profile', (st, ctx) => Dm.submitVerification(st, { supplierId: sup.id, licenceNumber: sup.licenceNumber, document: doc }, ctx));
      if (!res) return;
      A.ui.docPick = null;
      toast(intent === 'sample' ? t('toast.verifySample') : t('toast.verifyLocal'));
      render({ fresh: true });
    },
    register(f) {
      const fd = new FormData(f);
      const name = String(fd.get('name') || '').trim(), licence = String(fd.get('licence') || '').trim(), contact = String(fd.get('contact') || '').trim();
      if (!name) return showErr(f, t('err.name'), 'name');
      if (!/^[A-Za-z0-9\-\/]{3,30}$/.test(licence)) return showErr(f, t('err.licence3'), 'licence');
      if (!isEmail(contact)) return showErr(f, t('err.email'), 'contact');
      Store.registerSupplier({ name, nameAr: String(fd.get('nameAr') || '').trim(), category: fd.get('category'), licence, contact, vatRegistered: !!fd.get('vatRegistered') });
      closeModal(); toast(t('toast.registered', { name }));
      A.go('s-profile');
    },
    verify(f, submitter) {
      const v = A.serializeForm(f);
      const decision = submitter && submitter.value;
      const res = run('verify:' + f.dataset.id, (st, ctx) => Dm.reviewVerification(st, { supplierId: f.dataset.id, decision, reason: v.reason, licenceExpiry: v.licenceExpiry, checks: { nameMatches: !!v.nameMatches, numberMatches: !!v.numberMatches, documentLegible: !!v.documentLegible } }, ctx));
      if (!res) return;
      toast(t('toast.v.' + decision));
      render({ fresh: true });
    },
    econ() { /* live */ },
    kill() { /* live */ },
    pilot() { /* live */ }
  };
  function onSubmit(e) {
    const f = e.target;
    if (!f.dataset || !f.dataset.form) return;
    e.preventDefault();
    const fn = forms[f.dataset.form];
    if (fn) fn(f, e.submitter);
  }
  root.addEventListener('submit', onSubmit);
  modalRoot.addEventListener('submit', onSubmit);

  /* ---------- Background: simulated replies, expiring offers and holds ---------- */
  setInterval(() => {
    const res = Store.tick();
    if (!res.replies.length && !res.expiredOffers.length && !res.expiredHolds.length) return;
    res.replies.forEach(c => toast(c.line.status === 'offered' ? t('toast.newOffer3', { name: A.supName(c.line.supplierId), num: c.rfq.number }) : t('toast.newDecline3', { name: A.supName(c.line.supplierId) }), 'inbox'));
    if (res.expiredHolds.length) toast(t('toast.holdExpired', { n: res.expiredHolds.length }), 'clock');
    const active = document.activeElement;
    const typing = active && /INPUT|TEXTAREA|SELECT/.test(active.tagName) && root.contains(active);
    if (!typing && !modalRoot.innerHTML) render();
  }, 1000);
  /* Another tab changed the stored data: reload it so this tab never writes over newer records. */
  window.addEventListener('storage', e => {
    if (e.key !== Store.KEY) return;
    Store.refresh();
    const active = document.activeElement;
    const typing = active && /INPUT|TEXTAREA|SELECT/.test(active.tagName) && root.contains(active);
    if (!typing && !modalRoot.innerHTML) render();
  });

  const skip = document.querySelector('[data-skip]');
  if (skip) skip.addEventListener('click', e => { e.preventDefault(); const m = document.getElementById('main'); if (m) m.focus(); });

  /* ---------- Boot ---------- */
  const pending = CON.storage.get('con.pendingBrief', null);
  if (pending) {
    CON.storage.remove('con.pendingBrief');
    const name = (pending.product ? pending.product : t('obj.' + (pending.objective || 'trial'))) + ' · ' + t('fromWebsite');
    const obj = Store.createObjective(pending, { name, source: 'website' });
    A.ui.planTab = 'rec';
    location.replace('#c-plan-' + obj.id);
    setTimeout(() => toast(t('toast.planReady')), 300);
  }
  render();
})();
