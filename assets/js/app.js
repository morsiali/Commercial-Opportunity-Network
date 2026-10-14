/* Platform: router, shell, actions and boot */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App, E = CON.Engine, D = CON.DATA, Store = CON.Store;
  const t = A.t, esc = A.esc, ic = A.ic;
  const root = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');

  Store.load();
  Store.on(ev => { if (ev === 'save-failed') CON.toast(t('toast.saveFail'), 'alert'); });

  /* ---------- Routing ---------- */
  const NAV = {
    c: [['overview', 'grid'], ['new', 'plus'], ['plans', 'layers'], ['catalog', 'search'], ['compare', 'compare'], ['rfqs', 'file'], ['bookings', 'track'], ['results', 'chart']],
    s: [['overview', 'grid'], ['listings', 'store'], ['rfqs', 'inbox'], ['bookings', 'track'], ['profile', 'shield']],
    o: [['metrics', 'chart'], ['verify', 'shield'], ['rfqs', 'file'], ['payments', 'card'], ['economics', 'wallet'], ['kill', 'flag']]
  };
  const ALIAS = { c: { edit: 'new', plan: 'plans', rfq: 'plans', offers: 'rfqs', checkout: 'rfqs', booking: 'bookings' }, s: { listing: 'listings', import: 'listings', respond: 'rfqs', booking: 'bookings' }, o: { overview: 'metrics' } };
  function parse() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    const m = h.match(/^([cso])-([a-z]+)(?:-([A-Za-z0-9]+))?$/);
    if (!m) return { ws: 'c', page: 'overview' };
    return { ws: m[1], page: m[2], id: m[3] };
  }
  A.go = hash => { if (location.hash === '#' + hash) render(); else location.hash = hash; };
  A.notFound = () => A.head(t('nf.title'), t('nf.text')) + '<div class="panel">' + A.empty('search', t('nf.title'), t('nf.text'), '<a class="btn btn-dark btn-sm" href="#c-overview">' + t('nav.c.overview') + '</a>') + '</div>';

  function counts(ws) {
    const s = Store.state;
    if (ws === 'c') return { compare: s.compare.length, rfqs: s.rfqs.filter(r => r.status === 'open').reduce((a, r) => a + r.lines.filter(l => l.response && l.response.status === 'offered').length, 0) };
    if (ws === 's') return { rfqs: s.rfqs.filter(r => r.status === 'open' && r.lines.some(l => l.supplierId === s.activeSupplierId && !l.response)).length };
    return { verify: s.suppliers.filter(x => x.verified === 'pending').length };
  }

  function shell(route, inner) {
    const ws = route.ws;
    const active = (ALIAS[ws] && ALIAS[ws][route.page]) || route.page;
    const cnt = counts(ws);
    const wsTitle = { c: t('ws.c'), s: t('ws.s'), o: t('ws.o') };
    return '<header class="app-top"><div class="app-top-row">' +
      '<a class="logo" href="index.html"><span class="logo-mark">' + CON.logoMark + '</span><span class="logo-text">' + t('brand1') + '<small>' + t('brand2') + '</small></span></a>' +
      '<nav class="ws-switch" aria-label="' + esc(t('ws.label')) + '">' +
      '<a href="#c-overview" class="' + (ws === 'c' ? 'active' : '') + '">' + ic('briefcase') + '<span>' + wsTitle.c + '</span></a>' +
      '<a href="#s-overview" class="' + (ws === 's' ? 'active' : '') + '">' + ic('store') + '<span>' + wsTitle.s + '</span></a>' +
      '<a href="#o-metrics" class="' + (ws === 'o' ? 'active' : '') + '">' + ic('settings') + '<span>' + wsTitle.o + '</span></a></nav>' +
      '<div class="top-actions"><span class="demo-flag">' + ic('info') + t('demoFlag') + '</span>' +
      '<button class="lang-toggle" type="button" data-act="lang">' + ic('globe') + '<span>' + (A.lang === 'ar' ? 'English' : 'العربية') + '</span></button>' +
      '<button class="btn btn-ghost btn-sm hide-sm" type="button" data-act="reset">' + ic('refresh') + '<span>' + t('reset') + '</span></button>' +
      '<a class="btn btn-ghost btn-sm hide-sm" href="workflow.html">' + ic('track') + '<span>' + t('workflow') + '</span></a>' +
      '<a class="btn btn-light btn-sm hide-sm" href="index.html">' + t('website') + '</a></div></div></header>' +
      '<div class="app-shell"><nav class="side-nav" aria-label="' + esc(wsTitle[ws]) + '"><span class="nav-title">' + wsTitle[ws] + '</span>' +
      NAV[ws].map(([p, icon]) => '<a href="#' + ws + '-' + p + '" class="' + (active === p ? 'active' : '') + '"' + (active === p ? ' aria-current="page"' : '') + '>' + ic(icon) + '<span>' + t('nav.' + ws + '.' + p) + '</span>' + (cnt[p] ? '<span class="count">' + cnt[p] + '</span>' : '') + '</a>').join('') +
      '<div class="side-foot">' + ic('lock') + '<span>' + t('sideFoot') + '</span></div></nav>' +
      '<main class="view" id="main">' + inner + '</main></div>';
  }

  let lastRouteKey = '';
  function render(opts) {
    const route = parse();
    const key = route.ws + '-' + route.page + '-' + (route.id || '');
    const view = A.views[route.ws] && A.views[route.ws][route.page === 'edit' ? 'new' : route.page];
    if (key !== lastRouteKey) { A.ui.confirm = null; if (route.page !== 'listing') A.ui.upload = null; if (!(route.ws === 'c' && route.page === 'new')) A.ui.extraction = null; }
    let inner;
    try { inner = view ? view(route.id) : A.notFound(); } catch (err) { console.error(err); inner = A.notFound(); }
    const y = window.scrollY;
    root.innerHTML = shell(route, inner);
    document.title = (t('nav.' + route.ws + '.' + ((ALIAS[route.ws] && ALIAS[route.ws][route.page]) || route.page)) || '') + ' · ' + t('appTitle');
    if (key !== lastRouteKey && !(opts && opts.keep)) window.scrollTo(0, 0); else window.scrollTo(0, y);
    lastRouteKey = key;
  }
  A.render = render;
  window.addEventListener('hashchange', () => render());

  /* ---------- Modal ---------- */
  function openModal(html, small) {
    modalRoot.innerHTML = '<div class="modal-back" data-act="modal-close-back"><div class="modal' + (small ? ' sm' : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    const f = modalRoot.querySelector('button, a, input, select, textarea'); if (f) f.focus();
  }
  function closeModal() { modalRoot.innerHTML = ''; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalRoot.innerHTML) closeModal(); });
  function oppModal(id, objId) {
    const op = Store.opp(id); if (!op) return;
    const sup = Store.supplier(op.supplierId);
    const obj = objId ? Store.objective(objId) : null;
    const res = obj ? E.scoreOpportunity(op, obj, { suppliers: Store.state.suppliers }) : null;
    const inCmp = Store.state.compare.includes(op.id);
    const sel = obj && obj.selected.includes(op.id);
    openModal('<div class="modal-head"><div><span class="opp-cat">' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + '</span><h2>' + esc(A.oppTitle(op)) + '</h2><div class="meta" style="margin-top:6px"><span>' + ic('building') + esc(A.L(sup.name)) + '</span>' + A.verifiedBadge(sup) + '</div></div><button class="icon-btn" data-act="modal-close" aria-label="' + esc(t('close')) + '">' + ic('x') + '</button></div>' +
      '<div class="modal-body"><div class="modal-media">' + A.thumb(op) + '</div><p>' + esc(A.L(op.desc)) + '</p>' +
      '<div class="rec-facts">' + A.fact(t('fact.price'), op.price != null ? A.money(op.price) : t('price.request'), A.unitL(op.unit) + (op.setupFee ? ' · ' + t('setup') + ' ' + A.money(op.setupFee) : '')) + '<div class="fact"><small>' + t('fact.reach') + '</small>' + A.reachHtml(op) + '</div>' + A.fact(t('fact.avail'), t('slots', { left: Math.max(0, op.slotsTotal - op.slotsBooked), total: op.slotsTotal }), A.date(op.availableFrom) + ' – ' + A.date(op.availableTo)) + A.fact(t('lead.t'), t('lead', { n: op.leadDays || 0 })) + '</div>' +
      '<p class="small"><b>' + t('fact.audience') + ':</b> ' + esc(A.oppAudience(op.audience)) + '</p><p class="small"><b>' + t('fact.req') + ':</b> ' + esc(A.L(op.requirements) || t('none')) + '</p><p class="small"><b>' + t('fact.expect') + ':</b> ' + t('expect.' + op.type) + '</p>' + A.sourcesHtml(op, sup) +
      (res ? '<div class="panel" style="padding:16px"><div class="panel-head"><h2>' + t('modal.matchFor', { name: esc(obj.name) }) + '</h2>' + A.scoreRing(res.score) + '</div>' + A.factorsHtml(res) + A.risksHtml(res.risks) + '<p class="small"><b>' + t('fact.cost') + ':</b> ' + (res.cost.subtotal == null ? t('price.request') : A.money(res.cost.subtotal)) + ' · ' + esc(A.costLine(res.cost)) + '</p></div>' : '') +
      '<div class="form-actions"><button class="btn btn-light btn-sm" data-act="compare" data-id="' + op.id + '" data-modal="1">' + ic('compare') + (inCmp ? t('inCompare') : t('compare')) + '</button>' + (obj ? '<button class="btn ' + (sel ? 'btn-light' : 'btn-dark') + ' btn-sm" data-act="select" data-obj="' + obj.id + '" data-id="' + op.id + '" data-modal="1">' + ic(sel ? 'check' : 'plus') + (sel ? t('selected') : t('select')) + '</button>' : '') + '</div></div>');
  }
  function rfqDocModal(id) {
    const r = Store.rfq(id); if (!r) return;
    openModal('<div class="modal-head"><div><span class="opp-cat">' + t('rfq.request') + '</span><h2>' + esc(r.number) + '</h2></div><button class="icon-btn" data-act="modal-close" aria-label="' + esc(t('close')) + '">' + ic('x') + '</button></div><div class="modal-body"><dl class="dl">' +
      '<dt>' + t('fld.objective') + '</dt><dd>' + esc(A.objL(r.objective)) + '</dd><dt>' + t('q.product') + '</dt><dd>' + esc(r.product || '—') + '</dd><dt>' + t('fld.audience') + '</dt><dd>' + esc(A.audienceText(r.audience)) + '</dd><dt>' + t('fld.areas') + '</dt><dd>' + esc(A.areasL(r.areas)) + '</dd><dt>' + t('fld.dates') + '</dt><dd>' + A.date(r.start) + ' – ' + A.date(r.end) + '</dd><dt>' + t('fld.budget') + '</dt><dd>' + (r.shareBudget === false ? t('rfq.budgetHidden') : A.money(r.budget)) + '</dd><dt>' + t('fld.success') + '</dt><dd>' + esc(r.success || '—') + '</dd><dt>' + t('rfq.reporting') + '</dt><dd>' + t('rep.' + r.reporting) + '</dd><dt>' + t('rfq.special') + '</dt><dd>' + esc(r.requirements || '—') + '</dd><dt>' + t('rfq.deadline') + '</dt><dd>' + A.date(r.responseDeadline) + '</dd>' +
      '<dt>' + t('rfq.format') + '</dt><dd>' + r.lines.map(l => esc(A.oppTitle(Store.opp(l.oppId))) + ' — ' + esc(A.supName(l.supplierId))).join('<br>') + '</dd></dl></div>');
  }

  /* ---------- Click actions ---------- */
  const actions = {
    'lang': () => { A.lang = A.lang === 'ar' ? 'en' : 'ar'; CON.setLang(A.lang); render({ keep: true }); },
    'reset': () => openModal('<div class="modal-head"><h2>' + t('reset.title') + '</h2><button class="icon-btn" data-act="modal-close" aria-label="' + esc(t('close')) + '">' + ic('x') + '</button></div><div class="modal-body"><p>' + t('reset.text') + '</p><div class="form-actions"><button class="btn btn-danger btn-sm" data-act="reset-yes">' + ic('refresh') + t('reset.yes') + '</button><button class="btn btn-ghost btn-sm" data-act="modal-close">' + t('cancel') + '</button></div></div>', true),
    'reset-yes': () => { Store.reset(); closeModal(); A.ui.cat = { q: '', type: '', area: '', max: '', obj: '' }; CON.toast(t('reset.done')); A.go('c-overview'); },
    'modal-close': () => closeModal(),
    'modal-close-back': (el, e) => { if (e.target === el) closeModal(); },
    'confirm': el => { A.ui.confirm = el.dataset.key; render({ keep: true }); },
    'confirm-cancel': () => { A.ui.confirm = null; render({ keep: true }); },
    'opp-detail': el => oppModal(el.dataset.id, el.dataset.obj || (parse().page === 'plan' ? parse().id : '')),
    'rfq-doc': el => rfqDocModal(el.dataset.id),
    'plan-tab': el => { A.ui.planTab = el.dataset.tab; render({ keep: true }); },
    'select': el => {
      const obj = Store.objective(el.dataset.obj); if (!obj) return;
      const id = el.dataset.id; const i = obj.selected.indexOf(id);
      if (i >= 0) obj.selected.splice(i, 1); else obj.selected.push(id);
      Store.save();
      CON.toast(i >= 0 ? t('toast.unselected') : t('toast.selected', { name: obj.name }));
      if (el.dataset.modal) oppModal(id, obj.id);
      render({ keep: true });
    },
    'compare': el => {
      const r = Store.toggleCompare(el.dataset.id);
      CON.toast(r === 'full' ? t('toast.cmpFull') : r === 'added' ? t('toast.cmpAdd') : t('toast.cmpRemove'), r === 'full' ? 'alert' : 'check-circle');
      if (el.dataset.modal) { const m = modalRoot.querySelector('[data-act="select"]'); oppModal(el.dataset.id, m ? m.dataset.obj : ''); }
      render({ keep: true });
    },
    'compare-clear': () => { Store.state.compare = []; Store.save(); render({ keep: true }); },
    'cmp-rfq': el => {
      const obj = Store.objective(el.dataset.obj); if (!obj) return;
      obj.selected = Store.state.compare.slice(); Store.save();
      A.go('c-rfq-' + obj.id);
    },
    'use-pkg': el => {
      const obj = Store.objective(el.dataset.obj); if (!obj) return;
      obj.selected = el.dataset.ids.split(',').filter(Boolean); Store.save();
      CON.toast(t('toast.pkg', { n: obj.selected.length }));
      render({ keep: true });
    },
    'cat-clear': () => { A.ui.cat = { q: '', type: '', area: '', max: '', obj: A.ui.cat.obj }; render({ keep: true }); },
    'obj-delete': el => { Store.deleteObjective(el.dataset.id); A.ui.confirm = null; CON.toast(t('toast.deleted')); render({ keep: true }); },
    'nudge': el => {
      const n = Store.nudge(el.dataset.id);
      const changed = Store.tick();
      CON.toast(n ? t('toast.nudged', { n: changed.length || n }) : t('toast.nudgedReal'), 'bolt');
      render({ keep: true });
    },
    'approve': el => { Store.setApproved(el.dataset.rfq, el.dataset.id, el.checked); render({ keep: true }); },
    'deliver': el => { Store.confirmDelivery(el.dataset.id); A.ui.confirm = null; CON.toast(t('toast.delivered')); render({ keep: true }); },
    'advance': el => { Store.advance(el.dataset.id, el.dataset.status); CON.toast(t('toast.status', { st: t('bk.' + el.dataset.status) })); render({ keep: true }); },
    'metric-add': el => {
      const wrap = el.closest('form').querySelector('[data-metric-rows]');
      const n = wrap.children.length;
      const tpl = document.createElement('div');
      tpl.innerHTML = wrap.children[0].outerHTML.replace(/id="m([nvum])0"/g, 'id="m$1' + n + '"').replace(/for="m([nvum])0"/g, 'for="m$1' + n + '"');
      const row = tpl.firstChild; row.querySelectorAll('input').forEach(i => { i.value = ''; }); row.querySelector('select').value = 'counted';
      wrap.appendChild(row);
    },
    'metric-remove': el => { const wrap = el.closest('[data-metric-rows]'); if (wrap.children.length > 1) el.closest('.metric-row').remove(); else el.closest('.metric-row').querySelectorAll('input').forEach(i => { i.value = ''; }); },
    'opp-pause': el => { const op = Store.opp(el.dataset.id); op.status = op.status === 'active' ? 'paused' : 'active'; Store.save(); CON.toast(op.status === 'active' ? t('toast.activated') : t('toast.paused')); render({ keep: true }); },
    'opp-delete': el => { Store.deleteOpportunity(el.dataset.id); A.ui.confirm = null; CON.toast(t('toast.deleted')); render({ keep: true }); },
    'upload-clear': () => { A.ui.upload = ''; render({ keep: true }); },
    'import-example': () => { A.ui.importText = A.CSV_TEMPLATE; A.ui.importRows = null; render({ keep: true }); },
    'import-commit': () => {
      const rows = (A.ui.importRows || []).filter(r => !r.errors.length);
      rows.forEach(r => Store.saveOpportunity(r.op));
      CON.toast(t('toast.imported', { n: rows.length }));
      A.ui.importRows = null; A.ui.importText = '';
      A.go('s-listings');
    },
    'sup-register': () => openModal('<div class="modal-head"><h2>' + t('s.register') + '</h2><button class="icon-btn" data-act="modal-close" aria-label="' + esc(t('close')) + '">' + ic('x') + '</button></div><form class="modal-body" data-form="register" novalidate><p class="muted small">' + t('s.registerSub') + '</p><div class="field"><label for="rg-name">' + t('s.p.name') + '</label><input class="input" id="rg-name" name="name" required maxlength="100"></div><div class="field"><label for="rg-cat">' + t('s.p.category') + '</label><select class="select" id="rg-cat" name="category">' + D.types.map(ty => '<option value="' + ty + '">' + esc(A.typeL(ty)) + '</option>').join('') + '</select></div><div class="field"><label for="rg-lic">' + t('s.p.licence') + '</label><input class="input" id="rg-lic" name="licence" required maxlength="40"></div><div class="field"><label for="rg-contact">' + t('s.p.contact') + '</label><input class="input" id="rg-contact" name="contact" type="email" required maxlength="120"></div><p class="error-text" data-error hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('check') + t('s.registerBtn') + '</button></div></form>', true),
    'mark-paid': el => { Store.markPaid(el.dataset.id); CON.toast(t('toast.paid')); render({ keep: true }); },
    'release': el => { Store.releasePayout(el.dataset.id); CON.toast(t('toast.released')); render({ keep: true }); },
    'scenario': el => { A.ui.scenario = el.dataset.s; render({ keep: true }); },
    'econ-reset': () => { const s = Store.state; if (s.econ) delete s.econ[A.ui.scenario]; Store.save(); render({ keep: true }); },
    'econ-pilot': () => {
      const m = A.metrics();
      if (!m.txs) { CON.toast(t('toast.noPilot'), 'info'); return; }
      const s = Store.state; s.econ = s.econ || {};
      const cur = Object.assign({}, (s.econ[A.ui.scenario]) || A.SCENARIOS[A.ui.scenario]);
      cur.atv = Math.round(m.gmv / m.txs); cur.take = Math.round(m.takeRate * 1000) / 10;
      s.econ[A.ui.scenario] = cur; Store.save(); CON.toast(t('toast.pilotUsed')); render({ keep: true });
    }
  };
  function onAction(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
  }
  root.addEventListener('click', onAction);
  modalRoot.addEventListener('click', onAction);
  root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-act]')) { e.preventDefault(); onAction(e); } });

  /* ---------- Live inputs ---------- */
  let liveTimer;
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.live === 'cat') { A.ui.cat[el.dataset.key] = el.value; clearTimeout(liveTimer); liveTimer = setTimeout(() => { const pos = el.selectionStart; render({ keep: true }); const n = document.getElementById(el.id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* select */ } } }, el.tagName === 'INPUT' ? 220 : 0); }
    if (el.dataset.live === 'econ') {
      const f = el.closest('form'); const v = {};
      Object.keys(A.SCENARIOS.base).forEach(k => { v[k] = Math.max(0, Number(f.elements[k].value) || 0); });
      const s = Store.state; s.econ = s.econ || {}; s.econ[A.ui.scenario] = v; Store.save();
      document.querySelector('[data-econ-out]').innerHTML = A.econOut(A.econCalc(v));
    }
    if (el.dataset.live === 'killnote') { const s = Store.state; s.kill[el.dataset.k] = Object.assign({}, s.kill[el.dataset.k], { note: el.value }); clearTimeout(liveTimer); liveTimer = setTimeout(() => Store.save(), 300); }
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.live === 'cat' && el.tagName === 'SELECT') { A.ui.cat[el.dataset.key] = el.value; render({ keep: true }); }
    if (el.dataset.live === 'cmpobj') { A.ui.compareObj = el.value; render({ keep: true }); }
    if (el.dataset.live === 'supswitch') { Store.setSupplier(el.value); CON.toast(t('toast.actingAs', { name: A.supName(el.value) })); render({ keep: true }); }
    if (el.dataset.live === 'kill') { const s = Store.state; s.kill[el.dataset.k] = Object.assign({}, s.kill[el.dataset.k], { status: el.value }); Store.save(); render({ keep: true }); }
    if (el.name === 'areas' && el.closest('form[data-form="objective"]')) {
      const boxes = el.closest('form').querySelectorAll('input[name="areas"]');
      if (el.value === 'all' && el.checked) boxes.forEach(b => { if (b.value !== 'all') b.checked = false; });
      else if (el.checked) boxes.forEach(b => { if (b.value === 'all') b.checked = false; });
      if (!Array.from(boxes).some(b => b.checked)) boxes[0].checked = true;
    }
    if (el.matches('[data-upload]') && el.files && el.files[0]) {
      A.readImage(el.files[0], 720).then(url => {
        if (url.length > 400000) { CON.toast(t('toast.imgBig'), 'alert'); return; }
        const form = el.closest('form'); const snapshot = new FormData(form);
        A.ui.upload = url; A.ui.listingDraft = Object.fromEntries(snapshot.entries()); A.ui.listingDraft.interests = snapshot.getAll('interests');
        render({ keep: true }); restoreDraft();
      }).catch(() => CON.toast(t('toast.imgFail'), 'alert'));
    }
    if (el.matches('[data-import-file]') && el.files && el.files[0]) {
      const fr = new FileReader();
      fr.onload = () => { A.ui.importText = String(fr.result || ''); A.ui.importRows = null; render({ keep: true }); };
      fr.readAsText(el.files[0]);
    }
  });
  function restoreDraft() {
    const d = A.ui.listingDraft; if (!d) return;
    const f = root.querySelector('form[data-form="listing"]'); if (!f) return;
    Object.keys(d).forEach(k => { if (k === 'interests') { f.querySelectorAll('input[name="interests"]').forEach(c => { c.checked = d.interests.includes(c.value); }); } else if (f.elements[k] && f.elements[k].type !== 'file') f.elements[k].value = d[k]; });
    A.ui.listingDraft = null;
  }

  /* ---------- Forms ---------- */
  function showErr(form, msg, fieldName) {
    const p = form.querySelector('[data-error]');
    form.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
    if (fieldName) { const f = form.elements[fieldName]; const node = f && (f.length && !f.tagName ? f[0] : f); if (node && node.classList) { node.classList.add('invalid'); node.focus(); } }
    if (p) { p.textContent = msg; p.hidden = false; } else CON.toast(msg, 'alert');
    return false;
  }
  const forms = {
    extract(f) {
      const text = f.elements.sentence.value.trim();
      if (!text) { CON.toast(t('err.sentence'), 'alert'); f.elements.sentence.focus(); return; }
      const x = E.extract(text);
      A.ui.extraction = { text, found: x.found, fields: x.fields };
      const route = parse();
      const formEl = root.querySelector('form[data-form="objective"]');
      const snapshot = formEl ? new FormData(formEl) : null;
      render({ keep: true });
      const of = root.querySelector('form[data-form="objective"]');
      if (snapshot) { const nm = snapshot.get('name'); if (nm) of.elements.name.value = nm; }
      const F = x.fields;
      if (F.objective) of.querySelectorAll('input[name="objective"]').forEach(r => { r.checked = r.value === F.objective; });
      if (F.gender) of.querySelectorAll('input[name="gender"]').forEach(r => { r.checked = r.value === F.gender; });
      if (F.ageMin) { of.elements.ageMin.value = F.ageMin; of.elements.ageMax.value = F.ageMax; }
      if (F.interests) of.querySelectorAll('input[name="interests"]').forEach(c => { c.checked = F.interests.includes(c.value); });
      if (F.areas) of.querySelectorAll('input[name="areas"]').forEach(c => { c.checked = F.areas.includes(c.value); });
      if (F.budget) of.elements.budget.value = F.budget;
      if (F.duration) of.elements.duration.value = F.duration;
      if (F.target) of.elements.target.value = F.target;
      if (!of.elements.name.value) of.elements.name.value = t('obj.' + (F.objective || 'trial')) + ' · ' + A.date(E.util.todayIso());
      CON.toast(x.found.length ? t('toast.extracted', { n: x.found.length }) : t('c.extract.none'), x.found.length ? 'check-circle' : 'info');
      void route;
    },
    objective(f) {
      const fd = new FormData(f);
      const name = String(fd.get('name') || '').trim();
      if (!name) return showErr(f, t('err.name'), 'name');
      const ageMin = Number(fd.get('ageMin')), ageMax = Number(fd.get('ageMax'));
      if (!(ageMin >= 16 && ageMax <= 80 && ageMin < ageMax)) return showErr(f, t('err.age'), 'ageMin');
      const budget = Number(fd.get('budget'));
      if (!(budget >= 5000)) return showErr(f, t('err.budget'), 'budget');
      const start = fd.get('start');
      if (!start || start < E.util.todayIso()) return showErr(f, t('err.start'), 'start');
      const duration = Number(fd.get('duration'));
      if (!(duration >= 1 && duration <= 180)) return showErr(f, t('err.duration'), 'duration');
      const fields = { objective: fd.get('objective'), product: fd.get('product'), success: fd.get('success'), target: fd.get('target') ? Number(fd.get('target')) : null, gender: fd.get('gender'), ageMin, ageMax, interests: fd.getAll('interests'), areas: fd.getAll('areas'), budget, start, duration };
      const ex = A.ui.extraction;
      const meta = { name, source: ex ? 'sentence' : 'form', sentence: ex ? ex.text : '', extraction: ex ? ex.found : null };
      let obj;
      if (f.dataset.id) { obj = Store.updateObjective(f.dataset.id, fields, meta); CON.toast(t('toast.updated')); }
      else { obj = Store.createObjective(fields, meta); CON.toast(t('toast.planReady')); }
      A.ui.extraction = null; A.ui.planTab = 'rec';
      A.go('c-plan-' + obj.id);
    },
    rfq(f) {
      const fd = new FormData(f);
      const deadline = fd.get('deadline');
      if (!deadline || deadline <= E.util.todayIso()) return showErr(f, t('err.deadline'), 'deadline');
      const obj = Store.objective(f.dataset.obj);
      const rfq = Store.sendRfq(obj.id, obj.selected.slice(), { reporting: fd.get('reporting'), requirements: String(fd.get('requirements') || '').trim(), responseDeadline: deadline });
      rfq.shareBudget = !!fd.get('shareBudget'); Store.save();
      CON.toast(t('toast.rfqSent', { n: rfq.suppliers.length, num: rfq.number }), 'send');
      A.go('c-offers-' + rfq.id);
    },
    checkout(f) {
      const fd = new FormData(f);
      const company = String(fd.get('company') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const trn = String(fd.get('trn') || '').trim();
      if (!company) return showErr(f, t('err.company'), 'company');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showErr(f, t('err.email'), 'email');
      if (trn && !/^\d{15}$/.test(trn)) return showErr(f, t('err.trn'), 'trn');
      if (!fd.get('ack')) return showErr(f, t('err.ack'), 'ack');
      const tx = Store.checkout(f.dataset.rfq, { method: fd.get('method'), company, email, trn });
      Store.state.company = company; Store.save();
      CON.toast(tx.status === 'paid' ? t('toast.paidDemo', { num: tx.number }) : t('toast.booked', { num: tx.number }), 'check-circle');
      A.go('c-bookings');
    },
    outcome(f) {
      const fd = new FormData(f);
      const n = fd.get('newCustomers') === '' ? null : Number(fd.get('newCustomers'));
      const rev = fd.get('revenue') === '' ? null : Number(fd.get('revenue'));
      if ((n != null && (n < 0 || !Number.isFinite(n))) || (rev != null && (rev < 0 || !Number.isFinite(rev)))) return showErr(f, t('err.number'), 'newCustomers');
      if (n == null && rev == null) return showErr(f, t('err.outcome'), 'newCustomers');
      Store.setOutcome(f.dataset.id, { newCustomers: n, revenue: rev, how: fd.get('how') });
      CON.toast(t('toast.saved')); render({ keep: true });
    },
    respond(f) {
      const fd = new FormData(f);
      if (fd.get('decision') === 'decline') {
        Store.respond(f.dataset.rfq, f.dataset.id, { status: 'declined', reason: fd.get('reason') });
        CON.toast(t('toast.declined')); render({ keep: true }); return;
      }
      const base = Number(fd.get('basePrice')), setup = Number(fd.get('setupFee') || 0);
      if (!(base > 0)) return showErr(f, t('err.price'), 'basePrice');
      if (setup < 0) return showErr(f, t('err.number'), 'setupFee');
      const from = fd.get('from'), to = fd.get('to');
      if (!from || !to || to < from) return showErr(f, t('err.range'), 'to');
      const valid = fd.get('validUntil');
      if (!valid || valid < E.util.todayIso()) return showErr(f, t('err.valid'), 'validUntil');
      const r = Store.rfq(f.dataset.rfq); const l = r.lines.find(x => x.oppId === f.dataset.id);
      Store.respond(f.dataset.rfq, f.dataset.id, { status: 'offered', basePrice: base, setupFee: setup, units: l.requested.units, from, to, reporting: fd.get('reporting'), terms: fd.get('terms'), validUntil: valid, deliverables: String(fd.get('deliverables') || '').trim(), notes: '' });
      CON.toast(t('toast.replied')); render({ keep: true });
    },
    report(f) {
      const rows = Array.from(f.querySelectorAll('.metric-row')).map(r => ({ name: r.querySelector('[name="name"]').value.trim(), value: r.querySelector('[name="value"]').value, unit: r.querySelector('[name="unit"]').value.trim(), method: r.querySelector('[name="method"]').value, note: '' })).filter(m => m.name || m.value !== '');
      if (!rows.length) return showErr(f, t('err.metric'));
      for (const m of rows) { if (!m.name || m.value === '' || Number(m.value) < 0) return showErr(f, t('err.metricRow')); m.value = Number(m.value); }
      Store.submitReport(f.dataset.id, rows);
      CON.toast(t('toast.reported')); render({ keep: true });
    },
    listing(f) {
      const fd = new FormData(f);
      const title = String(fd.get('title') || '').trim();
      if (!title) return showErr(f, t('err.title'), 'title');
      const price = Number(fd.get('price'));
      if (!(price > 0)) return showErr(f, t('err.price'), 'price');
      const from = fd.get('availableFrom'), to = fd.get('availableTo');
      if (!from || !to || to < from) return showErr(f, t('err.range'), 'availableTo');
      const minU = Math.max(1, Number(fd.get('minUnits')) || 1), maxU = Math.max(minU, Number(fd.get('maxUnits')) || minU);
      const ageMin = Number(fd.get('ageMin')), ageMax = Number(fd.get('ageMax'));
      if (!(ageMin >= 16 && ageMax <= 80 && ageMin < ageMax)) return showErr(f, t('err.age'), 'ageMin');
      const existing = f.dataset.id ? Store.opp(f.dataset.id) : null;
      const rv = fd.get('reachValue'), pv = fd.get('perfValue');
      const op = Object.assign({}, existing || { id: Store.uid('op'), slotsBooked: 0, status: 'active' }, {
        supplierId: existing ? existing.supplierId : Store.state.activeSupplierId,
        type: fd.get('type'), area: fd.get('area'),
        title: { en: title, ar: title }, desc: { en: String(fd.get('desc') || '').trim(), ar: String(fd.get('desc') || '').trim() },
        price, unit: fd.get('unit'), setupFee: Math.max(0, Number(fd.get('setupFee')) || 0), minUnits: minU, maxUnits: maxU,
        availableFrom: from, availableTo: to, leadDays: Math.max(0, Number(fd.get('leadDays')) || 0),
        slotsTotal: Math.max(1, Number(fd.get('slotsTotal')) || 1),
        audience: { gender: fd.get('gender'), ageMin, ageMax, interests: fd.getAll('interests') },
        reach: rv ? { value: Number(rv), unit: String(fd.get('reachUnit') || '').trim() || t('s.l.reachUnitDefault'), source: 'supplier-declared', date: fd.get('reachDate') || E.util.todayIso().slice(0, 7) } : null,
        performance: pv && fd.get('perfMetric') ? [{ metric: String(fd.get('perfMetric')).trim(), value: Number(pv), source: 'supplier-declared', date: fd.get('perfDate') || E.util.todayIso().slice(0, 7) }] : [],
        requirements: { en: String(fd.get('requirements') || '').trim(), ar: String(fd.get('requirements') || '').trim() },
        image: A.ui.upload != null ? (A.ui.upload || undefined) : (existing && existing.image)
      });
      if (!op.image) delete op.image;
      delete op.demo;
      const ok = Store.saveOpportunity(op);
      A.ui.upload = null;
      CON.toast(ok ? (existing ? t('toast.updated') : t('toast.published')) : t('toast.saveFail'), ok ? 'check-circle' : 'alert');
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
        if (!raw.title) errors.push('title');
        if (!D.types.includes(raw.type)) errors.push('type');
        if (raw.area !== 'all' && !D.areas[raw.area]) errors.push('area');
        if (!(Number(raw.price) > 0)) errors.push('price');
        if (!['day', 'week', 'month', 'activation'].includes(raw.unit)) errors.push('unit');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.available_from) || !/^\d{4}-\d{2}-\d{2}$/.test(raw.available_to) || raw.available_to < raw.available_from) errors.push('dates');
        const op = { id: Store.uid('op'), supplierId: Store.state.activeSupplierId, type: raw.type, area: raw.area, title: { en: raw.title, ar: raw.title }, desc: { en: raw.description || '', ar: raw.description || '' }, price: Number(raw.price) || null, unit: raw.unit, setupFee: Number(raw.setup_fee) || 0, minUnits: 1, maxUnits: raw.unit === 'day' ? 60 : raw.unit === 'week' ? 12 : raw.unit === 'month' ? 6 : 1, availableFrom: raw.available_from, availableTo: raw.available_to, leadDays: 7, slotsTotal: Math.max(1, Number(raw.slots) || 1), slotsBooked: 0, audience: { gender: ['mixed', 'female', 'male'].includes(raw.gender) ? raw.gender : 'mixed', ageMin: Number(raw.age_min) || 18, ageMax: Number(raw.age_max) || 60, interests: (raw.interests || '').split('|').map(x => x.trim()).filter(x => D.interests.includes(x)) }, reach: null, performance: [], requirements: { en: raw.requirements || '', ar: raw.requirements || '' }, status: 'active' };
        return { raw, op, errors };
      });
      render({ keep: true });
    },
    profile(f, submitter) {
      const fd = new FormData(f);
      const name = String(fd.get('name') || '').trim(), licence = String(fd.get('licence') || '').trim(), contact = String(fd.get('contact') || '').trim();
      if (!name) return showErr(f, t('err.name'), 'name');
      if (!licence) return showErr(f, t('err.licence'), 'licence');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)) return showErr(f, t('err.email'), 'contact');
      const sup = Store.supplier(f.dataset.id);
      const file = f.elements.doc.files && f.elements.doc.files[0];
      Object.assign(sup, { name: { en: name, ar: (sup.name.en === name ? sup.name.ar : name) }, licence, contact, emirate: fd.get('emirate'), category: fd.get('category') });
      if (file) sup.docName = file.name;
      const intent = submitter && submitter.value;
      if (intent === 'verify') { if (!sup.docName) return showErr(f, t('err.doc'), 'doc'); sup.verified = 'pending'; sup.verifyNote = ''; }
      Store.saveSupplier(sup);
      CON.toast(intent === 'verify' ? t('toast.verifySent') : t('toast.saved'));
      render({ keep: true });
    },
    register(f) {
      const fd = new FormData(f);
      const name = String(fd.get('name') || '').trim(), licence = String(fd.get('licence') || '').trim(), contact = String(fd.get('contact') || '').trim();
      if (!name) return showErr(f, t('err.name'), 'name');
      if (!licence) return showErr(f, t('err.licence'), 'licence');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)) return showErr(f, t('err.email'), 'contact');
      const sup = { id: Store.uid('sp'), name: { en: name, ar: name }, category: fd.get('category'), verified: 'none', licence, emirate: 'Dubai', contact, joined: E.util.todayIso() };
      Store.saveSupplier(sup); Store.setSupplier(sup.id);
      closeModal(); CON.toast(t('toast.registered', { name }));
      A.go('s-profile');
    },
    verify(f, submitter) {
      const decision = submitter && submitter.value;
      Store.verify(f.dataset.id, decision, f.elements.note.value.trim());
      CON.toast(decision === 'verified' ? t('toast.verified') : t('toast.rejected'));
      render({ keep: true });
    },
    econ() { /* live */ },
    kill() { /* live */ }
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

  /* ---------- Simulated supplier replies ---------- */
  setInterval(() => {
    const changed = Store.tick();
    if (!changed.length) return;
    changed.forEach(c => CON.toast(c.line.response.status === 'offered' ? t('toast.newOffer', { name: A.supName(c.line.supplierId), num: c.rfq.number }) : t('toast.newDecline', { name: A.supName(c.line.supplierId) }), 'inbox'));
    const active = document.activeElement;
    const typing = active && /INPUT|TEXTAREA|SELECT/.test(active.tagName) && root.contains(active);
    if (!typing) render({ keep: true });
  }, 1000);

  const skip = document.querySelector('[data-skip]');
  if (skip) skip.addEventListener('click', e => { e.preventDefault(); const m = document.getElementById('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } });

  /* ---------- Boot ---------- */
  const pending = CON.storage.get('con.pendingBrief', null);
  if (pending) {
    CON.storage.remove('con.pendingBrief');
    const name = (pending.product ? pending.product : t('obj.' + (pending.objective || 'trial'))) + ' · ' + t('fromWebsite');
    const obj = Store.createObjective(pending, { name, source: 'website' });
    A.ui.planTab = 'rec';
    location.replace('#c-plan-' + obj.id);
    setTimeout(() => CON.toast(t('toast.planReady')), 300);
  }
  render();
})();
