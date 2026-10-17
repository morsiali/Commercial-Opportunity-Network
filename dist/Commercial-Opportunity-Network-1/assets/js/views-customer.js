/* Platform: brand / customer workspace views */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App, E = CON.Engine, D = CON.DATA, Store = CON.Store;
  const t = A.t, esc = A.esc, ic = A.ic;
  const V = A.views = A.views || {};
  V.c = {};

  function offersToReview(r) { return r.status === 'open' ? r.lines.filter(l => l.response && l.response.status === 'offered').length : 0; }

  /* ---------- Overview ---------- */
  V.c.overview = function () {
    const s = Store.state;
    const openRfqs = s.rfqs.filter(r => r.status === 'open');
    const toReview = openRfqs.reduce((a, r) => a + offersToReview(r), 0);
    const booked = s.transactions.reduce((a, x) => a + x.total, 0);
    const todos = [];
    openRfqs.forEach(r => {
      const n = offersToReview(r); const wait = r.lines.filter(l => !l.response).length;
      if (n) todos.push({ icon: 'compare', text: t('todo.offers', { n, rfq: r.number }), href: '#c-offers-' + r.id, cta: t('todo.compare') });
      else if (wait) todos.push({ icon: 'clock', text: t('todo.waiting', { n: wait, rfq: r.number }), href: '#c-offers-' + r.id, cta: t('open') });
    });
    s.bookings.filter(b => b.status === 'completed').forEach(b => todos.push({ icon: 'check-circle', text: t('todo.confirm', { bk: b.number }), href: '#c-booking-' + b.id, cta: t('open') }));
    s.bookings.filter(b => b.status === 'delivered' && !b.outcome).forEach(b => todos.push({ icon: 'chart', text: t('todo.outcome', { bk: b.number }), href: '#c-booking-' + b.id, cta: t('open') }));
    s.objectives.filter(o => !o.planViewed).forEach(o => todos.push({ icon: 'layers', text: t('todo.plan', { name: o.name }), href: '#c-plan-' + o.id, cta: t('open') }));
    if (!todos.length) todos.push({ icon: 'target', text: t('todo.new'), href: '#c-new', cta: t('c.newObjective') });

    return A.head(t('c.overview.title'), t('c.overview.sub', { company: esc(s.company) }), '<a class="btn btn-dark" href="#c-new">' + ic('plus') + '<span>' + t('c.newObjective') + '</span></a>') +
      '<div class="kpis">' +
      A.kpi('target', t('k.objectives'), A.num(s.objectives.length)) +
      A.kpi('file', t('k.openRfqs'), A.num(openRfqs.length)) +
      A.kpi('compare', t('k.toReview'), A.num(toReview)) +
      A.kpi('wallet', t('k.booked'), A.money(booked), t('k.bookedNote')) +
      '</div>' +
      '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h2>' + t('c.next') + '</h2></div><div class="rows">' + todos.slice(0, 6).map(x => '<div class="row"><span class="row-ico">' + ic(x.icon) + '</span><span class="grow"><b>' + esc(x.text) + '</b></span><a class="btn btn-light btn-xs" href="' + x.href + '">' + esc(x.cta) + '</a></div>').join('') + '</div></section>' +
      '<section class="panel"><div class="panel-head"><h2>' + t('c.recent') + '</h2><a class="btn btn-ghost btn-xs" href="#c-plans">' + t('viewAll') + '</a></div><div class="rows">' +
      (s.objectives.slice(0, 5).map(o => '<div class="row"><span class="row-ico">' + ic('target') + '</span><span class="grow"><b>' + esc(o.name) + ' ' + A.sampleTag(o) + '</b><small>' + esc(A.objL(o.objective)) + ' · ' + A.money(o.budget) + ' · ' + A.date(o.start) + '</small></span><a class="btn btn-light btn-xs" href="#c-plan-' + o.id + '">' + t('c.openPlan') + '</a></div>').join('') || A.empty('target', t('c.noObjectives'), t('c.noObjectivesText'))) +
      '</div></section></div>' +
      '<section class="panel soft"><div class="panel-head"><h2>' + t('c.journey') + '</h2></div><div class="chips">' +
      ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9', 'j10', 'j11', 'j12'].map((k, i) => '<span class="tag">' + (i + 1) + ' · ' + t(k) + '</span>').join('') + '</div></section>';
  };

  /* ---------- New / edit objective ---------- */
  V.c.new = function (id) {
    const editing = id ? Store.objective(id) : null;
    const o = editing || E.normalizeObjective({ objective: 'trial', gender: 'all', ageMin: 25, ageMax: 45, areas: ['all'], budget: 100000, duration: 30 });
    const ex = A.ui.extraction;
    const val = (k, d) => esc(o[k] != null ? o[k] : d);
    const objCards = D.objectives.map(k => '<label class="obj"><input type="radio" name="objective" value="' + k + '"' + (o.objective === k ? ' checked' : '') + '><span>' + ic({ trial: 'gift', acquisition: 'users', launch: 'bolt', footfall: 'store', leads: 'inbox', awareness: 'megaphone' }[k]) + '<b>' + esc(A.objL(k)) + '</b></span></label>').join('');
    const chips = (name, list, sel, labelFn, type) => '<div class="chip-group">' + list.map(v => '<label class="chip"><input type="' + (type || 'checkbox') + '" name="' + name + '" value="' + v + '"' + (sel.includes(v) ? ' checked' : '') + '><span>' + esc(labelFn(v)) + '</span></label>').join('') + '</div>';
    return A.head(editing ? t('c.edit.title') : t('c.new.title'), t('c.new.sub'), '', { href: editing ? '#c-plan-' + editing.id : '#c-plans', label: editing ? t('c.backPlan') : t('nav.c.plans') }) +
      '<section class="panel soft"><div class="panel-head"><div><h2>' + t('c.sentence.title') + '</h2><p>' + t('c.sentence.sub') + '</p></div></div>' +
      '<form data-form="extract" class="form-actions" novalidate style="align-items:stretch"><div class="field" style="flex:1;min-width:240px"><label class="sr-only" for="f-sentence">' + t('c.sentence.title') + '</label><textarea class="textarea" id="f-sentence" name="sentence" maxlength="400" placeholder="' + esc(t('c.sentence.ph')) + '">' + esc((editing && editing.sentence) || (ex && ex.text) || '') + '</textarea></div><div style="display:grid;align-content:end"><button class="btn btn-dark" type="submit">' + ic('file') + '<span>' + t('c.sentence.btn') + '</span></button></div></form>' +
      (ex ? '<div class="notice' + (ex.found.length ? '' : ' warn') + '">' + ic(ex.found.length ? 'check-circle' : 'info') + '<div><b>' + (ex.found.length ? t('c.extract.ok', { n: ex.found.length }) : t('c.extract.none')) + '</b><div class="understood" style="margin-top:8px">' + ex.found.map(f => '<span><b>' + esc(t('x.' + f.key)) + '</b> ' + esc(f.key === 'objective' ? A.objL(f.value) : f.key === 'budget' ? A.money(f.value) : f.key === 'gender' ? t('g.' + f.value) : f.key === 'areas' ? (f.value === 'all' ? t('area.all') : String(f.value).split(', ').map(A.areaL).join(', ')) : f.key === 'interests' ? String(f.value).split(', ').map(A.intL).join(', ') : f.key === 'duration' ? t('days', { n: f.value }) : String(f.value)) + (f.raw ? ' <q>' + esc(f.raw) + '</q>' : '') + '</span>').join('') + '</div><p class="src" style="margin-top:8px">' + t('c.extract.note') + '</p></div></div>' : '') +
      '</section>' +
      '<form class="panel" data-form="objective" data-id="' + (editing ? editing.id : '') + '" novalidate>' +
      '<div class="form-grid">' +
      '<div class="field span-2"><label for="f-name">' + t('fld.name') + '</label><input class="input" id="f-name" name="name" maxlength="80" required value="' + esc(editing ? editing.name : '') + '" placeholder="' + esc(t('fld.namePh')) + '"></div>' +
      '<div class="field span-2"><span class="label">1 · ' + t('q.achieve') + '</span><div class="objective-grid">' + objCards + '</div></div>' +
      '<div class="field"><label for="f-product">2 · ' + t('q.product') + '</label><input class="input" id="f-product" name="product" maxlength="80" value="' + val('product', '') + '" placeholder="' + esc(t('fld.productPh')) + '"></div>' +
      '<div class="field"><label for="f-success">3 · ' + t('q.success') + '</label><input class="input" id="f-success" name="success" maxlength="160" value="' + val('success', '') + '" placeholder="' + esc(t('fld.successPh')) + '"></div>' +
      '<div class="field"><label for="f-target">' + t('fld.target') + '</label><input class="input" id="f-target" name="target" type="number" min="0" inputmode="numeric" value="' + (o.target || '') + '" placeholder="5000"><span class="hint">' + t('fld.targetHint') + '</span></div>' +
      '<div class="field"><span class="label">4 · ' + t('q.who') + '</span>' + chips('gender', ['all', 'female', 'male'], [o.gender], v => t('g.' + v), 'radio') + '</div>' +
      '<div class="field"><label for="f-agemin">' + t('fld.ageMin') + '</label><input class="input" id="f-agemin" name="ageMin" type="number" min="16" max="80" value="' + o.ageMin + '"></div>' +
      '<div class="field"><label for="f-agemax">' + t('fld.ageMax') + '</label><input class="input" id="f-agemax" name="ageMax" type="number" min="16" max="80" value="' + o.ageMax + '"></div>' +
      '<div class="field span-2"><span class="label">' + t('fld.interests') + '</span>' + chips('interests', D.interests, o.interests || [], A.intL) + '</div>' +
      '<div class="field span-2"><span class="label">5 · ' + t('q.where') + '</span>' + chips('areas', ['all'].concat(Object.keys(D.areas)), o.areas, A.areaL) + '</div>' +
      '<div class="field"><label for="f-budget">6 · ' + t('q.budget') + '</label><div class="input-wrap">' + ic('wallet') + '<input class="input" id="f-budget" name="budget" type="number" min="5000" step="500" required value="' + o.budget + '"></div><span class="hint">' + t('fld.budgetHint') + '</span></div>' +
      '<div class="field"><label for="f-start">7 · ' + t('q.start') + '</label><div class="input-wrap">' + ic('calendar') + '<input class="input" id="f-start" name="start" type="date" required min="' + E.util.todayIso() + '" value="' + (editing ? o.start : E.util.addDays(E.util.todayIso(), 21)) + '"></div></div>' +
      '<div class="field"><label for="f-duration">' + t('fld.duration') + '</label><div class="input-wrap">' + ic('clock') + '<input class="input" id="f-duration" name="duration" type="number" min="1" max="180" required value="' + o.duration + '"></div></div>' +
      '</div>' +
      '<p class="error-text" data-error hidden></p>' +
      '<div class="form-actions"><button class="btn btn-dark" type="submit">' + ic('layers') + '<span>' + (editing ? t('c.saveRegenerate') : t('c.generate')) + '</span></button><span class="muted small">' + t('c.private') + '</span></div>' +
      '</form>';
  };

  /* ---------- Plans list ---------- */
  V.c.plans = function () {
    const s = Store.state;
    const rows = s.objectives.map(o => {
      const rfqs = s.rfqs.filter(r => r.objectiveId === o.id);
      return '<tr><td><a href="#c-plan-' + o.id + '">' + esc(o.name) + '</a> ' + A.sampleTag(o) + '<br><small class="muted">' + esc(o.product || '—') + '</small></td><td>' + esc(A.objL(o.objective)) + '</td><td>' + esc(A.areasL(o.areas)) + '</td><td class="num">' + A.money(o.budget) + '</td><td>' + A.date(o.start) + ' · ' + t('days', { n: o.duration }) + '</td><td class="num">' + rfqs.length + '</td><td><div class="inline-confirm">' + (A.ui.confirm === 'obj:' + o.id ? '<span class="small">' + t('confirmDelete') + '</span><button class="btn btn-danger btn-xs" data-act="obj-delete" data-id="' + o.id + '">' + t('delete') + '</button><button class="btn btn-ghost btn-xs" data-act="confirm-cancel">' + t('cancel') + '</button>' : '<a class="btn btn-light btn-xs" href="#c-plan-' + o.id + '">' + t('open') + '</a>' + (rfqs.length ? '' : '<button class="btn btn-ghost btn-xs" data-act="confirm" data-key="obj:' + o.id + '" aria-label="' + esc(t('delete')) + '">' + ic('trash') + '</button>')) + '</div></td></tr>';
    }).join('');
    return A.head(t('nav.c.plans'), t('c.plans.sub'), '<a class="btn btn-dark" href="#c-new">' + ic('plus') + '<span>' + t('c.newObjective') + '</span></a>') +
      (s.objectives.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.objective') + '</th><th>' + t('th.goal') + '</th><th>' + t('th.where') + '</th><th class="num">' + t('th.budget') + '</th><th>' + t('th.dates') + '</th><th class="num">' + t('th.rfqs') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="panel">' + A.empty('target', t('c.noObjectives'), t('c.noObjectivesText'), '<a class="btn btn-dark" href="#c-new">' + t('c.newObjective') + '</a>') + '</div>');
  };

  /* ---------- Plan ---------- */
  function recCard(r, i, obj) {
    const op = Store.opp(r.oppId); const sup = Store.supplier(op.supplierId);
    const sel = obj.selected.includes(op.id);
    const inCmp = Store.state.compare.includes(op.id);
    const left = Math.max(0, (op.slotsTotal || 0) - (op.slotsBooked || 0));
    return '<article class="rec' + (sel ? ' selected' : '') + '">' +
      '<div class="rec-thumb">' + A.thumb(op) + '</div>' +
      '<div class="rec-main">' +
      '<div class="rec-title"><span class="rank">#' + (i + 1) + '</span><h3>' + esc(A.oppTitle(op)) + '</h3></div>' +
      '<div class="meta"><span>' + ic(D.typeIcons[op.type]) + esc(A.typeL(op.type)) + '</span><span>' + ic('pin') + esc(A.areaL(op.area)) + '</span><span>' + ic('building') + esc(A.L(sup.name)) + '</span>' + A.verifiedBadge(sup) + '</div>' +
      '<div class="rec-facts">' +
      A.fact(t('fact.cost'), r.cost.subtotal == null ? t('price.request') : A.money(r.cost.subtotal), A.costLine(r.cost)) +
      '<div class="fact"><small>' + t('fact.reach') + '</small>' + A.reachHtml(op) + '</div>' +
      A.fact(t('fact.avail'), t('slots', { left, total: op.slotsTotal || 0 }), A.date(op.availableFrom) + ' – ' + A.date(op.availableTo)) +
      A.fact(t('fact.conf'), t('conf.' + r.confidenceLevel), t('fact.expect') + ': ' + t('expect.' + op.type)) +
      '</div>' + A.risksHtml(r.risks) +
      '<details class="why"><summary>' + t('why') + ic('chevron-down') + '</summary><div class="why-body">' + A.factorsHtml(r) +
      '<p class="small"><b>' + t('fact.audience') + ':</b> ' + esc(A.oppAudience(op.audience)) + '</p>' +
      '<p class="small"><b>' + t('fact.req') + ':</b> ' + esc(A.L(op.requirements) || t('none')) + '</p>' +
      A.sourcesHtml(op, sup) +
      (r.alternatives && r.alternatives.length ? '<div class="chips"><span class="small muted">' + t('alternatives') + ':</span>' + r.alternatives.map(id => { const a = Store.opp(id); return '<button class="alt-link" type="button" data-act="opp-detail" data-id="' + id + '" data-obj="' + obj.id + '">' + esc(A.oppTitle(a)) + '</button>'; }).join('') + '</div>' : '') +
      '</div></details></div>' +
      '<div class="rec-side">' + A.scoreRing(r.score, t('match')) + '<div class="rec-gap"></div>' +
      '<button class="sel-toggle' + (sel ? ' on' : '') + '" type="button" data-act="select" data-obj="' + obj.id + '" data-id="' + op.id + '" aria-pressed="' + sel + '">' + ic(sel ? 'check' : 'plus') + (sel ? t('selected') : t('select')) + '</button>' +
      '<button class="btn btn-ghost btn-xs" type="button" data-act="compare" data-id="' + op.id + '" aria-pressed="' + inCmp + '">' + ic('compare') + (inCmp ? t('inCompare') : t('compare')) + '</button>' +
      '<button class="btn btn-ghost btn-xs" type="button" data-act="opp-detail" data-id="' + op.id + '" data-obj="' + obj.id + '">' + ic('eye') + t('details') + '</button>' +
      '</div></article>';
  }

  V.c.plan = function (id) {
    const obj = Store.objective(id);
    if (!obj) return A.notFound();
    if (!obj.planViewed) { obj.planViewed = true; Store.save(); }
    const rk = Store.rankFor(obj);
    const pk = E.buildPackages(rk, Store.state.opportunities, CON.config.platformFeeRate);
    const excluded = rk.all.filter(x => x.excluded || x.score < 45);
    const tab = A.ui.planTab;
    const selCost = obj.selected.reduce((a, oid) => { const r = rk.all.find(x => x.oppId === oid); return a + (r && r.cost.subtotal || 0); }, 0);
    const found = obj.extraction || [];

    let body = '';
    if (tab === 'rec') {
      body = rk.recommended.length ? '<div class="opp-list">' + rk.recommended.map((r, i) => recCard(r, i, obj)).join('') + '</div>' : '<div class="panel">' + A.empty('search', t('plan.none'), t('plan.noneText'), '<a class="btn btn-dark" href="#c-edit-' + obj.id + '">' + t('c.editBrief') + '</a>') + '</div>';
    } else if (tab === 'pkg') {
      body = pk.length ? '<div class="pkgs">' + pk.map(p => {
        const ids = p.items.map(i => i.oppId);
        const chosen = ids.length === obj.selected.length && ids.every(x => obj.selected.includes(x));
        const optional = rk.recommended.filter(r => !ids.includes(r.oppId)).slice(0, 2);
        return '<article class="pkg' + (chosen ? ' chosen' : '') + '"><div><span class="opp-cat">' + t('pkg.' + p.id + '.tag') + '</span><h3>' + t('pkg.' + p.id) + '</h3><p class="muted small">' + t('pkg.' + p.id + '.d') + '</p></div>' +
          '<div><span class="pkg-total">' + A.money(p.total) + '</span><div class="muted small">' + t('pkg.exVat') + '</div></div>' +
          '<ul>' + p.items.map(it => { const op = Store.opp(it.oppId); return '<li><span><button class="link-btn" type="button" data-act="opp-detail" data-id="' + op.id + '" data-obj="' + obj.id + '">' + esc(A.oppTitle(op)) + '</button><small>' + esc(A.supName(op.supplierId)) + ' · ' + esc(A.areaL(op.area)) + ' · ' + t('match') + ' ' + it.score + '</small></span><b>' + A.money(it.cost.subtotal) + '</b></li>'; }).join('') + '</ul>' +
          '<div class="sum-row"><span>' + t('pkg.subtotal') + '</span><b>' + A.money(p.subtotal) + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.fee', { pct: Math.round(CON.config.platformFeeRate * 100) }) + '</span><b>' + A.money(p.platformFee) + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.budgetUse') + '</span><b>' + Math.round(p.budgetUse * 100) + '%</b></div><div class="meter"><i style="width:' + Math.min(100, Math.round(p.budgetUse * 100)) + '%"></i></div>' +
          '<div class="sum-row"><span>' + t('pkg.avg') + '</span><b>' + p.avgScore + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.mix') + '</span><b>' + t('pkg.mixV', { types: p.typesCount, areas: p.areasCount }) + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.reach') + '</span><b>' + t('pkg.reachV', { n: p.withReachData, total: p.items.length }) + '</b></div>' +
          (optional.length ? '<div class="small"><b>' + t('pkg.optional') + ':</b> ' + optional.map(r => esc(A.oppTitle(Store.opp(r.oppId))) + ' (' + A.money(r.cost.subtotal) + ')').join(', ') + '</div>' : '') +
          '<button class="btn ' + (chosen ? 'btn-light' : 'btn-dark') + ' btn-sm" type="button" data-act="use-pkg" data-obj="' + obj.id + '" data-ids="' + ids.join(',') + '">' + ic(chosen ? 'check' : 'layers') + (chosen ? t('pkg.inUse') : t('pkg.use')) + '</button></article>';
      }).join('') + '</div><p class="muted small">' + t('pkg.note') + '</p>' : '<div class="panel">' + A.empty('layers', t('pkg.none'), t('pkg.noneText')) + '</div>';
    } else if (tab === 'map') {
      const items = rk.recommended.map(r => ({ op: Store.opp(r.oppId), score: r.score }));
      const city = items.filter(i => i.op.area === 'all');
      body = '<div class="map-wrap">' + A.mapSvg(items, obj.selected) + '<div class="map-legend"><span><i style="background:#157efc"></i>' + t('map.l1') + '</span><span><i style="background:#58a8ff"></i>' + t('map.l2') + '</span><span><i style="background:#f59e0b"></i>' + t('map.l3') + '</span><span><i style="background:#0a0d14"></i>' + t('map.l4') + '</span></div></div>' +
        (city.length ? '<p class="muted small">' + t('map.city') + ': ' + city.map(c => esc(A.oppTitle(c.op))).join(', ') + '</p>' : '');
    } else {
      body = excluded.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.opportunity') + '</th><th>' + t('th.supplier') + '</th><th class="num">' + t('match') + '</th><th>' + t('th.reason') + '</th><th></th></tr></thead><tbody>' + excluded.map(x => { const op = Store.opp(x.oppId); return '<tr><td>' + esc(A.oppTitle(op)) + '<br><small class="muted">' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + '</small></td><td>' + esc(A.supName(op.supplierId)) + '</td><td class="num">' + x.score + '</td><td>' + esc(x.excluded ? t('ex.' + x.excluded) : t('ex.low')) + '</td><td><button class="btn btn-ghost btn-xs" data-act="opp-detail" data-id="' + op.id + '" data-obj="' + obj.id + '">' + t('details') + '</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="panel">' + A.empty('check-circle', t('ex.noneT'), t('ex.none')) + '</div>';
    }

    return A.head(obj.name, t('plan.sub'), '<a class="btn btn-light btn-sm" href="#c-edit-' + obj.id + '">' + ic('edit') + '<span>' + t('c.editBrief') + '</span></a><a class="btn btn-light btn-sm" href="#c-catalog">' + ic('search') + '<span>' + t('nav.c.catalog') + '</span></a>', { href: '#c-plans', label: t('nav.c.plans') }) +
      '<div class="brief-sum">' +
      A.fact(t('fld.objective'), esc(A.objL(obj.objective)), obj.product || '') +
      A.fact(t('fld.audience'), esc(A.audienceText(obj))) +
      A.fact(t('fld.areas'), esc(A.areasL(obj.areas))) +
      A.fact(t('fld.budget'), A.money(obj.budget), t('exVat')) +
      A.fact(t('fld.dates'), A.date(obj.start) + ' – ' + A.date(obj.end), t('days', { n: obj.duration })) +
      A.fact(t('fld.success'), esc(obj.success || '—'), obj.target ? t('fld.targetV', { n: A.num(obj.target) }) : '') +
      '</div>' +
      '<section class="panel soft"><div class="panel-head"><div><h2>' + t('plan.read') + '</h2><p>' + t('plan.readSub', { n: rk.all.length, m: rk.eligible.length }) + '</p></div></div>' +
      (obj.sentence ? '<p class="small"><b>' + t('plan.yourWords') + ':</b> <q>' + esc(obj.sentence) + '</q></p>' : '') +
      '<div class="understood">' +
      '<span><b>' + t('fld.objective') + '</b> ' + esc(A.objL(obj.objective)) + '</span>' +
      '<span><b>' + t('fld.audience') + '</b> ' + esc(A.audienceText(obj)) + '</span>' +
      '<span><b>' + t('fld.areas') + '</b> ' + esc(A.areasL(obj.areas)) + '</span>' +
      '<span><b>' + t('fld.budget') + '</b> ' + A.money(obj.budget) + '</span>' +
      '<span><b>' + t('fld.dates') + '</b> ' + A.date(obj.start) + ' – ' + A.date(obj.end) + '</span>' +
      '</div>' + (found.filter(f => f.raw).length ? '<div class="understood"><span class="small muted" style="border:0;background:none;padding:0">' + t('plan.recognised') + '</span>' + found.filter(f => f.raw).map(f => '<span><b>' + esc(t('x.' + f.key)) + '</b> <q>' + esc(f.raw) + '</q></span>').join('') + '</div>' : '') +
      '<p class="src">' + t('plan.engineNote') + '</p></section>' +
      '<div class="tabs" role="tablist">' +
      ['rec', 'pkg', 'map', 'ex'].map(k => '<button type="button" role="tab" aria-selected="' + (tab === k) + '" class="' + (tab === k ? 'active' : '') + '" data-act="plan-tab" data-tab="' + k + '">' + t('tab.' + k) + (k === 'rec' ? '<span class="c">' + rk.recommended.length + '</span>' : k === 'pkg' ? '<span class="c">' + pk.length + '</span>' : k === 'ex' ? '<span class="c">' + excluded.length + '</span>' : '') + '</button>').join('') + '</div>' +
      body +
      '<div class="selbar"><span><b>' + t('sel.count', { n: obj.selected.length }) + '</b> <span class="muted">· ' + t('sel.est', { v: A.money(selCost) }) + '</span></span><span class="form-actions"><a class="btn btn-light btn-sm" href="#c-compare">' + ic('compare') + t('nav.c.compare') + ' (' + Store.state.compare.length + ')</a>' + (obj.selected.length ? '<a class="btn btn-blue btn-sm" href="#c-rfq-' + obj.id + '">' + ic('send') + t('sel.rfq') + '</a>' : '<span class="btn btn-blue btn-sm" aria-disabled="true">' + ic('send') + t('sel.rfq') + '</span>') + '</span></div>';
  };

  /* ---------- Catalogue ---------- */
  V.c.catalog = function () {
    const s = Store.state; const f = A.ui.cat;
    const obj = f.obj ? Store.objective(f.obj) : null;
    let list = s.opportunities.filter(o => o.status === 'active');
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(o => (A.oppTitle(o) + ' ' + A.L(o.desc) + ' ' + A.supName(o.supplierId) + ' ' + A.typeL(o.type) + ' ' + A.areaL(o.area)).toLowerCase().includes(q)); }
    if (f.type) list = list.filter(o => o.type === f.type);
    if (f.area) list = list.filter(o => o.area === f.area);
    if (f.max) list = list.filter(o => o.price != null && o.price <= Number(f.max));
    let scored = list.map(o => ({ op: o, res: obj ? E.scoreOpportunity(o, obj, { suppliers: s.suppliers }) : null }));
    if (obj) scored.sort((a, b) => b.res.score - a.res.score); else scored.sort((a, b) => A.oppTitle(a.op).localeCompare(A.oppTitle(b.op)));
    const opt = (v, l, cur) => '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
    return A.head(t('nav.c.catalog'), t('cat.sub', { n: s.opportunities.filter(o => o.status === 'active').length })) +
      '<div class="panel"><div class="filters">' +
      '<div class="field f-search"><label for="cf-q">' + t('cat.search') + '</label><div class="input-wrap">' + ic('search') + '<input class="input" id="cf-q" data-live="cat" data-key="q" value="' + esc(f.q) + '" placeholder="' + esc(t('cat.searchPh')) + '"></div></div>' +
      '<div class="field"><label for="cf-type">' + t('cat.type') + '</label><select class="select" id="cf-type" data-live="cat" data-key="type">' + opt('', t('all'), f.type) + D.types.map(ty => opt(ty, A.typeL(ty), f.type)).join('') + '</select></div>' +
      '<div class="field"><label for="cf-area">' + t('cat.area') + '</label><select class="select" id="cf-area" data-live="cat" data-key="area">' + opt('', t('all'), f.area) + opt('all', t('area.cityWide'), f.area) + Object.keys(D.areas).map(a => opt(a, A.areaL(a), f.area)).join('') + '</select></div>' +
      '<div class="field"><label for="cf-max">' + t('cat.max') + '</label><select class="select" id="cf-max" data-live="cat" data-key="max">' + opt('', t('any'), f.max) + [2500, 5000, 10000, 20000].map(v => opt(v, A.money(v), f.max)).join('') + '</select></div>' +
      '<div class="field"><label for="cf-obj">' + t('cat.scoreFor') + '</label><select class="select" id="cf-obj" data-live="cat" data-key="obj">' + opt('', t('cat.noScore'), f.obj) + s.objectives.map(o => opt(o.id, o.name, f.obj)).join('') + '</select></div>' +
      '</div></div>' +
      (scored.length ? '<div class="cat-grid">' + scored.map(({ op, res }) => {
        const sup = Store.supplier(op.supplierId); const inCmp = s.compare.includes(op.id); const sel = obj && obj.selected.includes(op.id);
        return '<article class="cat-card"><div class="cat-media">' + A.thumb(op) + (res ? '<span class="score-badge">' + (res.excluded ? t('ex.short.' + res.excluded) : t('match') + ' ' + res.score) + '</span>' : '') + '</div><div class="cat-body">' +
          '<span class="opp-cat">' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + '</span><h3>' + esc(A.oppTitle(op)) + '</h3>' +
          '<div class="meta"><span>' + esc(A.L(sup.name)) + '</span>' + A.verifiedBadge(sup) + '</div>' +
          '<div class="cat-price"><b>' + (op.price != null ? A.money(op.price) : t('price.request')) + '</b><span class="muted small">' + esc(A.unitL(op.unit)) + '</span></div>' +
          '<div class="cat-actions"><button class="btn btn-light btn-xs" data-act="opp-detail" data-id="' + op.id + '"' + (obj ? ' data-obj="' + obj.id + '"' : '') + '>' + ic('eye') + t('details') + '</button><button class="btn btn-ghost btn-xs" data-act="compare" data-id="' + op.id + '" aria-pressed="' + inCmp + '">' + ic('compare') + (inCmp ? t('inCompare') : t('compare')) + '</button>' +
          (obj ? '<button class="btn ' + (sel ? 'btn-blue' : 'btn-ghost') + ' btn-xs" data-act="select" data-obj="' + obj.id + '" data-id="' + op.id + '" aria-pressed="' + !!sel + '">' + ic(sel ? 'check' : 'plus') + (sel ? t('selected') : t('addPlan')) + '</button>' : '') +
          '</div></div></article>';
      }).join('') + '</div>' : '<div class="panel">' + A.empty('search', t('cat.none'), t('cat.noneText'), '<button class="btn btn-light btn-sm" data-act="cat-clear">' + t('cat.clear') + '</button>') + '</div>');
  };

  /* ---------- Compare ---------- */
  V.c.compare = function () {
    const s = Store.state;
    const ops = s.compare.map(id => Store.opp(id)).filter(Boolean);
    if (!ops.length) return A.head(t('nav.c.compare'), t('cmp.sub')) + '<div class="panel">' + A.empty('compare', t('cmp.empty'), t('cmp.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-catalog">' + t('nav.c.catalog') + '</a>') + '</div>';
    const objId = A.ui.compareObj || (s.objectives[0] && s.objectives[0].id) || '';
    const obj = objId ? Store.objective(objId) : null;
    const res = ops.map(op => obj ? E.scoreOpportunity(op, obj, { suppliers: s.suppliers }) : null);
    const minCost = obj ? Math.min.apply(null, res.map(r => r.cost.subtotal == null ? Infinity : r.cost.subtotal)) : null;
    const maxScore = obj ? Math.max.apply(null, res.map(r => r.score)) : null;
    const row = (label, cells) => '<tr><th scope="row">' + esc(label) + '</th>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
    let rows = '';
    rows += '<tr><th scope="row"></th>' + ops.map(op => '<td><div class="rec-thumb" style="width:100%;aspect-ratio:16/9">' + A.thumb(op) + '</div><b style="display:block;margin-top:8px">' + esc(A.oppTitle(op)) + '</b><button class="btn btn-ghost btn-xs" data-act="compare" data-id="' + op.id + '">' + ic('x') + t('remove') + '</button></td>').join('') + '</tr>';
    rows += row(t('th.supplier'), ops.map(op => esc(A.supName(op.supplierId)) + ' ' + A.verifiedBadge(Store.supplier(op.supplierId))));
    rows += row(t('cat.type'), ops.map(op => esc(A.typeL(op.type))));
    rows += row(t('cat.area'), ops.map(op => esc(A.areaL(op.area))));
    rows += row(t('fact.price'), ops.map(op => (op.price != null ? A.money(op.price) : t('price.request')) + ' <span class="muted small">' + esc(A.unitL(op.unit)) + '</span>' + (op.setupFee ? '<br><small class="muted">' + t('setup') + ' ' + A.money(op.setupFee) + '</small>' : '')));
    if (obj) {
      rows += row(t('fact.cost'), res.map(r => '<span class="' + (r.cost.subtotal === minCost ? 'best' : '') + '">' + (r.cost.subtotal == null ? t('price.request') : A.money(r.cost.subtotal)) + '</span><br><small class="muted">' + esc(A.costLine(r.cost)) + '</small>'));
      rows += row(t('match'), res.map(r => '<span class="' + (r.score === maxScore ? 'best' : '') + '">' + r.score + '</span>' + (r.excluded ? ' · ' + esc(t('ex.short.' + r.excluded)) : '')));
      E.FACTORS.forEach(k => { rows += row(t('f.' + k), res.map(r => { const f = r.factors.find(x => x.key === k); return Math.round(f.value * 100) + ' <small class="muted">' + esc(A.reason(f.why)) + '</small>'; })); });
      rows += row(t('risks'), res.map(r => A.risksHtml(r.risks) || '—'));
    }
    rows += row(t('fact.audience'), ops.map(op => esc(A.oppAudience(op.audience))));
    rows += row(t('fact.reach'), ops.map(op => '<div class="fact" style="background:none;padding:0">' + A.reachHtml(op) + '</div>'));
    rows += row(t('fact.avail'), ops.map(op => A.date(op.availableFrom) + ' – ' + A.date(op.availableTo) + '<br><small class="muted">' + t('slots', { left: Math.max(0, op.slotsTotal - op.slotsBooked), total: op.slotsTotal }) + ' · ' + t('lead', { n: op.leadDays || 0 }) + '</small>'));
    rows += row(t('fact.req'), ops.map(op => esc(A.L(op.requirements) || '—')));
    return A.head(t('nav.c.compare'), t('cmp.sub'), '<button class="btn btn-ghost btn-sm" data-act="compare-clear">' + ic('x') + t('cmp.clear') + '</button>') +
      '<div class="panel"><div class="form-grid"><div class="field"><label for="cmp-obj">' + t('cmp.for') + '</label><select class="select" id="cmp-obj" data-live="cmpobj">' + '<option value="">' + t('cat.noScore') + '</option>' + s.objectives.map(o => '<option value="' + o.id + '"' + (o.id === objId ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select></div><div class="field" style="align-content:end">' + (obj ? '<button class="btn btn-dark" data-act="cmp-rfq" data-obj="' + obj.id + '">' + ic('send') + t('cmp.rfq') + '</button>' : '') + '</div></div></div>' +
      '<div class="table-wrap"><table class="t cmp"><tbody>' + rows + '</tbody></table></div>';
  };

  /* ---------- RFQ compose ---------- */
  V.c.rfq = function (id) {
    const obj = Store.objective(id); if (!obj) return A.notFound();
    const ops = obj.selected.map(x => Store.opp(x)).filter(Boolean);
    const back = { href: '#c-plan-' + obj.id, label: t('c.backPlan') };
    if (!ops.length) return A.head(t('rfq.title'), '', '', back) + '<div class="panel">' + A.empty('send', t('rfq.empty'), t('rfq.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-plan-' + obj.id + '">' + t('c.backPlan') + '</a>') + '</div>';
    const sups = Array.from(new Set(ops.map(o => o.supplierId)));
    const deadline = E.util.addDays(E.util.todayIso(), 5);
    return A.head(t('rfq.title'), t('rfq.sub'), '', back) +
      '<form data-form="rfq" data-obj="' + obj.id + '" novalidate class="view" style="gap:16px">' +
      '<div class="doc"><div class="doc-head"><div><small>' + t('rfq.draft') + '</small><h2>' + esc(obj.name) + '</h2></div><div><small>' + t('rfq.to') + '</small><h2>' + t('rfq.suppliersN', { n: sups.length }) + '</h2></div></div><div class="doc-body">' +
      '<dl class="dl">' +
      '<dt>' + t('fld.objective') + '</dt><dd>' + esc(A.objL(obj.objective)) + '</dd>' +
      '<dt>' + t('q.product') + '</dt><dd>' + esc(obj.product || '—') + '</dd>' +
      '<dt>' + t('fld.audience') + '</dt><dd>' + esc(A.audienceText(obj)) + '</dd>' +
      '<dt>' + t('fld.areas') + '</dt><dd>' + esc(A.areasL(obj.areas)) + '</dd>' +
      '<dt>' + t('fld.dates') + '</dt><dd>' + A.date(obj.start) + ' – ' + A.date(obj.end) + ' (' + t('days', { n: obj.duration }) + ')</dd>' +
      '<dt>' + t('fld.success') + '</dt><dd>' + esc(obj.success || '—') + (obj.target ? ' · ' + t('fld.targetV', { n: A.num(obj.target) }) : '') + '</dd>' +
      '</dl>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('rfq.format') + '</th><th>' + t('th.supplier') + '</th><th class="num">' + t('rfq.qty') + '</th><th class="num">' + t('rfq.listEst') + '</th></tr></thead><tbody>' + ops.map(op => { const c = E.itemCost(op, obj); return '<tr><td>' + esc(A.oppTitle(op)) + '<br><small class="muted">' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + '</small></td><td>' + esc(A.supName(op.supplierId)) + '</td><td class="num">' + A.num(c.units) + ' × ' + esc(A.unitL(c.unit).toLowerCase()) + '</td><td class="num">' + (c.subtotal == null ? t('price.request') : A.money(c.subtotal)) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="rq-report">' + t('rfq.reporting') + '</label><select class="select" id="rq-report" name="reporting"><option value="basic">' + t('rep.basic') + '</option><option value="detailed">' + t('rep.detailed') + '</option><option value="none">' + t('rep.none') + '</option></select></div>' +
      '<div class="field"><label for="rq-deadline">' + t('rfq.deadline') + '</label><input class="input" type="date" id="rq-deadline" name="deadline" min="' + E.util.addDays(E.util.todayIso(), 1) + '" value="' + deadline + '" required></div>' +
      '<div class="field span-2"><label for="rq-req">' + t('rfq.special') + '</label><textarea class="textarea" id="rq-req" name="requirements" maxlength="600" placeholder="' + esc(t('rfq.specialPh')) + '"></textarea></div>' +
      '<label class="check span-2"><input type="checkbox" name="shareBudget" checked> <span>' + t('rfq.shareBudget', { v: A.money(obj.budget) }) + '</span></label>' +
      '</div></div></div>' +
      '<div class="notice">' + ic('info') + '<div>' + t('rfq.simNote', { name: esc(A.supName(Store.state.activeSupplierId)) }) + '</div></div>' +
      '<p class="error-text" data-error hidden></p>' +
      '<div class="form-actions"><button class="btn btn-dark" type="submit">' + ic('send') + '<span>' + t('rfq.send', { n: sups.length }) + '</span></button><a class="btn btn-ghost" href="#c-plan-' + obj.id + '">' + t('cancel') + '</a></div>' +
      '</form>';
  };

  /* ---------- RFQs list ---------- */
  V.c.rfqs = function () {
    const s = Store.state;
    if (!s.rfqs.length) return A.head(t('nav.c.rfqs'), t('rfqs.sub')) + '<div class="panel">' + A.empty('file', t('rfqs.empty'), t('rfqs.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-plans">' + t('nav.c.plans') + '</a>') + '</div>';
    return A.head(t('nav.c.rfqs'), t('rfqs.sub')) +
      '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.rfq') + '</th><th>' + t('th.objective') + '</th><th>' + t('th.sent') + '</th><th class="num">' + t('th.replies') + '</th><th>' + t('th.status') + '</th><th></th></tr></thead><tbody>' +
      s.rfqs.map(r => { const o = Store.objective(r.objectiveId); const rep = r.lines.filter(l => l.response).length; return '<tr><td><a href="#c-offers-' + r.id + '">' + esc(r.number) + '</a> ' + A.sampleTag(r) + '</td><td>' + esc(o ? o.name : '—') + '</td><td>' + A.date(r.createdAt.slice(0, 10)) + '</td><td class="num">' + rep + ' / ' + r.lines.length + '</td><td>' + A.statusBadge('rfq', r.status) + '</td><td><a class="btn btn-light btn-xs" href="#c-offers-' + r.id + '">' + (r.status === 'open' ? t('rfqs.compare') : t('open')) + '</a></td></tr>'; }).join('') + '</tbody></table></div>';
  };

  /* ---------- Offers (normalised comparison) ---------- */
  V.c.offers = function (id) {
    const r = Store.rfq(id); if (!r) return A.notFound();
    const obj = Store.objective(r.objectiveId);
    const offered = r.lines.filter(l => l.response && l.response.status === 'offered');
    const waiting = r.lines.filter(l => !l.response);
    const norms = offered.map(l => A.norm(l, r));
    const minTotal = norms.length ? Math.min.apply(null, norms.map(n => n.total)) : 0;
    const approved = offered.filter(l => l.approved);
    const approvedTotal = approved.reduce((a, l) => a + A.norm(l, r).total, 0);
    const actSup = Store.state.activeSupplierId;
    const row = (label, cells, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + esc(label) + '</th>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
    let table = '';
    if (offered.length) {
      table += row(t('th.supplier'), offered.map(l => '<b>' + esc(A.supName(l.supplierId)) + '</b>' + (l.response.simulated ? '<br><span class="tag">' + t('simulated') + '</span>' : '')));
      table += row(t('th.opportunity'), offered.map(l => '<button class="link-btn" data-act="opp-detail" data-id="' + l.oppId + '">' + esc(A.oppTitle(Store.opp(l.oppId))) + '</button>'));
      table += row(t('off.base'), offered.map(l => A.money(l.response.basePrice)));
      table += row(t('off.setup'), offered.map(l => A.money(l.response.setupFee)));
      table += row(t('off.net'), norms.map(n => A.money(n.net)));
      table += row(t('off.vat', { pct: Math.round(CON.config.vatRate * 100) }), norms.map(n => A.money(n.vat)));
      table += row(t('off.fee', { pct: Math.round(CON.config.platformFeeRate * 100) }), norms.map(n => A.money(n.platformFee)));
      table += row(t('off.total'), norms.map(n => '<span class="' + (n.total === minTotal && norms.length > 1 ? 'best' : '') + '">' + A.money(n.total) + '</span>' + (n.total === minTotal && norms.length > 1 ? '<br><small class="muted">' + t('off.lowest') + '</small>' : '')), 'total');
      table += row(t('off.perDay'), norms.map(n => A.money(n.perDay) + ' <small class="muted">' + t('off.overDays', { n: n.days }) + '</small>'));
      table += row(t('off.dates'), offered.map((l, i) => A.badge(norms[i].dateMatch === 'full' ? 'ok' : norms[i].dateMatch === 'partial' ? 'warn' : 'bad', t('dm.' + norms[i].dateMatch) + (norms[i].dateMatch === 'partial' ? ' ' + Math.round(norms[i].coverage * 100) + '%' : '')) + '<br><small class="muted">' + A.date(l.response.from) + ' – ' + A.date(l.response.to) + '</small>'));
      table += row(t('off.reporting'), offered.map(l => esc(t('rep.' + (l.response.reporting || 'none')))));
      table += row(t('off.terms'), offered.map(l => esc(t('terms.' + (l.response.terms || 'upfront')))));
      table += row(t('off.valid'), offered.map(l => A.date(l.response.validUntil)));
      table += row(t('off.notes'), offered.map(l => esc(l.response.deliverables || l.response.notes || '—')));
      if (r.status === 'open') table += row(t('off.approve'), offered.map(l => '<label class="check"><input type="checkbox" data-act="approve" data-rfq="' + r.id + '" data-id="' + l.oppId + '"' + (l.approved ? ' checked' : '') + '><span>' + t('off.approveThis') + '</span></label>'));
    }
    return A.head(r.number + (obj ? ' · ' + obj.name : ''), t('off.sub'), '<button class="btn btn-light btn-sm" data-act="rfq-doc" data-id="' + r.id + '">' + ic('file') + t('off.viewRfq') + '</button>' + (waiting.length && r.status === 'open' ? '<button class="btn btn-light btn-sm" data-act="nudge" data-id="' + r.id + '">' + ic('bolt') + t('off.nudge') + '</button>' : ''), { href: '#c-rfqs', label: t('nav.c.rfqs') }) +
      (r.status === 'awarded' ? '<div class="notice ok">' + ic('check-circle') + '<div>' + t('off.awarded') + ' <a href="#c-bookings">' + t('nav.c.bookings') + '</a></div></div>' : '') +
      '<section class="panel"><div class="panel-head"><h2>' + t('off.status') + '</h2><span class="muted small">' + t('off.deadline', { d: A.date(r.responseDeadline) }) + '</span></div><div class="rows">' +
      r.lines.map(l => { const st = A.lineStatus(l); return '<div class="row"><span class="row-ico">' + ic(st === 'offered' ? 'check-circle' : st === 'declined' ? 'x' : 'clock') + '</span><span class="grow"><b>' + esc(A.supName(l.supplierId)) + '</b><small>' + esc(A.oppTitle(Store.opp(l.oppId))) + (l.response && l.response.respondedAt ? ' · ' + A.since(l.response.respondedAt) : '') + (st === 'declined' && l.response.reason ? ' · ' + esc(t('decl.' + l.response.reason)) : '') + '</small></span>' + A.statusBadge('line', st) + (st === 'awaiting' && l.supplierId === actSup ? '<a class="btn btn-blue btn-xs" href="#s-respond-' + r.id + '">' + t('off.answerAs') + '</a>' : '') + '</div>'; }).join('') +
      '</div>' + (waiting.some(l => l.supplierId === actSup) ? '<div class="notice">' + ic('info') + '<div>' + t('off.actNote', { name: esc(A.supName(actSup)) }) + '</div></div>' : '') + '</section>' +
      (offered.length ? '<div class="panel-head"><h2>' + t('off.compare') + '</h2><span class="muted small">' + t('off.normNote') + '</span></div><div class="table-wrap"><table class="t cmp"><tbody>' + table + '</tbody></table></div>' : '<div class="panel">' + A.empty('clock', t('off.none'), t('off.noneText')) + '</div>') +
      (r.status === 'open' && offered.length ? '<div class="selbar"><span><b>' + t('off.approvedN', { n: approved.length }) + '</b> <span class="muted">· ' + A.money(approvedTotal) + ' ' + t('inclVat') + '</span></span>' + (approved.length ? '<a class="btn btn-blue btn-sm" href="#c-checkout-' + r.id + '">' + ic('card') + t('off.checkout') + '</a>' : '<span class="btn btn-blue btn-sm" aria-disabled="true">' + ic('card') + t('off.checkout') + '</span>') + '</div>' : '');
  };

  /* ---------- Checkout ---------- */
  V.c.checkout = function (id) {
    const r = Store.rfq(id); if (!r) return A.notFound();
    const back = { href: '#c-offers-' + r.id, label: t('off.back') };
    if (r.status !== 'open') return A.head(t('co.title'), '', '', back) + '<div class="panel">' + A.empty('check-circle', t('co.done'), t('co.doneText'), '<a class="btn btn-dark btn-sm" href="#c-bookings">' + t('nav.c.bookings') + '</a>') + '</div>';
    const approved = r.lines.filter(l => l.approved && l.response && l.response.status === 'offered');
    if (!approved.length) return A.head(t('co.title'), '', '', back) + '<div class="panel">' + A.empty('card', t('co.empty'), t('co.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-offers-' + r.id + '">' + t('off.back') + '</a>') + '</div>';
    const ns = approved.map(l => A.norm(l, r));
    const sum = k => ns.reduce((a, n) => a + n[k], 0);
    return A.head(t('co.title'), t('co.sub'), '', back) +
      '<div class="grid-2" style="align-items:start">' +
      '<section class="panel"><div class="panel-head"><h2>' + t('co.summary') + '</h2></div><div class="table-wrap"><table class="t" style="min-width:420px"><thead><tr><th>' + t('th.opportunity') + '</th><th class="num">' + t('off.net') + '</th><th class="num">' + t('off.total') + '</th></tr></thead><tbody>' +
      approved.map((l, i) => '<tr><td>' + esc(A.oppTitle(Store.opp(l.oppId))) + '<br><small class="muted">' + esc(A.supName(l.supplierId)) + '</small></td><td class="num">' + A.money(ns[i].net) + '</td><td class="num">' + A.money(ns[i].total) + '</td></tr>').join('') +
      '<tr><td>' + t('off.net') + '</td><td></td><td class="num">' + A.money(sum('net')) + '</td></tr>' +
      '<tr><td>' + t('off.vat', { pct: 5 }) + '</td><td></td><td class="num">' + A.money(sum('vat')) + '</td></tr>' +
      '<tr><td>' + t('off.fee', { pct: Math.round(CON.config.platformFeeRate * 100) }) + '</td><td></td><td class="num">' + A.money(sum('platformFee')) + '</td></tr>' +
      '<tr class="total"><td>' + t('co.total') + '</td><td></td><td class="num">' + A.money(sum('total')) + '</td></tr></tbody></table></div>' +
      '<div class="notice">' + ic('shield') + '<div>' + t('co.escrow') + '</div></div></section>' +
      '<form class="panel" data-form="checkout" data-rfq="' + r.id + '" novalidate><div class="panel-head"><h2>' + t('co.billing') + '</h2></div>' +
      '<div class="field"><label for="co-company">' + t('co.company') + '</label><input class="input" id="co-company" name="company" required maxlength="100" value="' + esc(Store.state.company) + '"></div>' +
      '<div class="field"><label for="co-email">' + t('co.email') + '</label><input class="input" id="co-email" name="email" type="email" required maxlength="120" placeholder="finance@company.ae"></div>' +
      '<div class="field"><label for="co-trn">' + t('co.trn') + '</label><input class="input" id="co-trn" name="trn" inputmode="numeric" maxlength="15" placeholder="100000000000003"><span class="hint">' + t('co.trnHint') + '</span></div>' +
      '<div class="field"><span class="label">' + t('co.method') + '</span><div class="rows">' +
      ['card', 'bank', 'invoice'].map((m, i) => '<label class="check row" style="cursor:pointer"><input type="radio" name="method" value="' + m + '"' + (i === 0 ? ' checked' : '') + '><span class="grow"><b>' + t('pm.' + m) + '</b><small>' + t('pm.' + m + '.d') + '</small></span></label>').join('') + '</div></div>' +
      '<label class="check"><input type="checkbox" name="ack" required><span>' + t('co.ack') + '</span></label>' +
      '<p class="error-text" data-error hidden></p>' +
      '<button class="btn btn-dark" type="submit">' + ic('lock') + '<span>' + t('co.pay', { v: A.money(sum('total')) }) + '</span></button></form></div>';
  };

  /* ---------- Bookings ---------- */
  A.bookingRows = (list, base) => list.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.booking') + '</th><th>' + t('th.opportunity') + '</th><th>' + t('th.supplier') + '</th><th>' + t('th.dates') + '</th><th>' + t('th.status') + '</th><th class="num">' + t('off.total') + '</th><th></th></tr></thead><tbody>' +
    list.map(b => '<tr><td><a href="#' + base + '-booking-' + b.id + '">' + esc(b.number) + '</a> ' + A.sampleTag(b) + '</td><td>' + esc(A.oppTitle(Store.opp(b.oppId))) + '</td><td>' + esc(A.supName(b.supplierId)) + '</td><td>' + A.date(b.from) + ' – ' + A.date(b.to) + '</td><td>' + A.statusBadge('bk', b.status) + '</td><td class="num">' + A.money(base === 's' ? b.net : b.total) + '</td><td><a class="btn btn-light btn-xs" href="#' + base + '-booking-' + b.id + '">' + t('open') + '</a></td></tr>').join('') + '</tbody></table></div>' : '';

  V.c.bookings = function () {
    const list = Store.state.bookings.slice().reverse();
    return A.head(t('nav.c.bookings'), t('bk.sub')) + (list.length ? A.bookingRows(list, 'c') : '<div class="panel">' + A.empty('track', t('bk.empty'), t('bk.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-rfqs">' + t('nav.c.rfqs') + '</a>') + '</div>');
  };

  A.timeline = b => {
    const steps = ['confirmed', 'preparing', 'live', 'completed', 'delivered'];
    const idx = steps.indexOf(b.status);
    return '<div class="timeline">' + steps.map((st, i) => { const ev = b.timeline.find(x => x.status === st); return '<div class="tl-step ' + (i < idx || (i === idx && i === steps.length - 1) ? 'done' : i === idx ? 'now done' : '') + '"><span class="dot">' + (i <= idx ? ic('check') : '') + '</span><b>' + t('bk.' + st) + '</b><small>' + (ev ? A.date(ev.at.slice(0, 10)) : '') + '</small></div>'; }).join('') + '</div>';
  };
  A.reportHtml = b => {
    if (!b.report) return A.empty('chart', t('rep.noneYet'), t('rep.noneYetText'));
    return '<div class="table-wrap"><table class="t" style="min-width:480px"><thead><tr><th>' + t('rep.metric') + '</th><th class="num">' + t('rep.value') + '</th><th>' + t('rep.method') + '</th><th>' + t('rep.note') + '</th></tr></thead><tbody>' +
      b.report.metrics.map(m => '<tr><td>' + esc(A.term(m.name)) + '</td><td class="num">' + A.num(m.value) + ' <small class="muted">' + esc(A.term(m.unit)) + '</small></td><td>' + A.badge(m.method === 'counted' || m.method === 'system' ? 'ok' : 'warn', t('meth.' + m.method)) + '</td><td>' + esc(A.term(m.note) || '—') + '</td></tr>').join('') + '</tbody></table></div><p class="src">' + t('rep.submitted', { d: A.date(b.report.submittedAt.slice(0, 10)) }) + '</p>';
  };

  V.c.booking = function (id) {
    const b = Store.booking(id); if (!b) return A.notFound();
    const op = Store.opp(b.oppId); const tx = Store.tx(b.txId);
    const o = b.outcome;
    const cpo = o && o.newCustomers > 0 ? Math.round(b.total / o.newCustomers) : null;
    const ros = o && o.revenue > 0 ? (o.revenue / b.total) : null;
    return A.head(b.number + ' · ' + A.oppTitle(op), t('bk.detailSub'), '', { href: '#c-bookings', label: t('nav.c.bookings') }) +
      '<section class="panel">' + A.timeline(b) + '</section>' +
      '<div class="brief-sum">' + A.fact(t('th.supplier'), esc(A.supName(b.supplierId))) + A.fact(t('th.dates'), A.date(b.from) + ' – ' + A.date(b.to)) + A.fact(t('off.total'), A.money(b.total), t('inclVat')) + A.fact(t('bk.payment'), tx ? t('tx.' + tx.status) : '—', tx ? t('pm.' + tx.method) : '') + A.fact(t('bk.payout'), t('payout.' + b.payout)) + A.fact(t('th.status'), t('bk.' + b.status)) + '</div>' +
      (b.status === 'completed' ? '<div class="notice warn">' + ic('info') + '<div><b>' + t('bk.confirmQ') + '</b><br>' + t('bk.confirmText') + '<div class="form-actions" style="margin-top:10px">' + (A.ui.confirm === 'deliver:' + b.id ? '<button class="btn btn-dark btn-sm" data-act="deliver" data-id="' + b.id + '">' + ic('check') + t('bk.confirmYes') + '</button><button class="btn btn-ghost btn-sm" data-act="confirm-cancel">' + t('cancel') + '</button>' : '<button class="btn btn-dark btn-sm" data-act="confirm" data-key="deliver:' + b.id + '">' + ic('check-circle') + t('bk.confirm') + '</button>') + '</div></div></div>' : '') +
      '<section class="panel"><div class="panel-head"><div><h2>' + t('rep.title') + '</h2><p>' + t('rep.sub') + '</p></div></div>' + A.reportHtml(b) + '</section>' +
      '<form class="panel" data-form="outcome" data-id="' + b.id + '" novalidate><div class="panel-head"><div><h2>' + t('out.title') + '</h2><p>' + t('out.sub') + '</p></div></div>' +
      '<div class="form-grid-3"><div class="field"><label for="out-n">' + t('out.customers') + '</label><input class="input" id="out-n" name="newCustomers" type="number" min="0" value="' + (o ? o.newCustomers || '' : '') + '"></div>' +
      '<div class="field"><label for="out-rev">' + t('out.revenue') + '</label><input class="input" id="out-rev" name="revenue" type="number" min="0" value="' + (o ? o.revenue || '' : '') + '"></div>' +
      '<div class="field"><label for="out-how">' + t('out.how') + '</label><select class="select" id="out-how" name="how">' + ['code', 'form', 'pos', 'other'].map(k => '<option value="' + k + '"' + (o && o.how === k ? ' selected' : '') + '>' + t('how.' + k) + '</option>').join('') + '</select></div></div>' +
      '<p class="error-text" data-error hidden></p>' +
      '<div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('check') + t('save') + '</button></div>' +
      (o ? '<div class="kpis">' + A.kpi('users', t('out.customers'), o.newCustomers ? A.num(o.newCustomers) : '—') + A.kpi('wallet', t('out.cpo'), cpo != null ? A.money(cpo) : '—', t('out.calc')) + A.kpi('chart', t('out.revenue'), o.revenue ? A.money(o.revenue) : '—') + A.kpi('target', t('out.ros'), ros != null ? ros.toFixed(2) + '×' : '—', t('out.calc')) + '</div>' : '') +
      '</form>';
  };

  /* ---------- Results ---------- */
  V.c.results = function () {
    const list = Store.state.bookings.filter(b => b.report || b.outcome);
    const spend = list.reduce((a, b) => a + b.total, 0);
    const cust = list.reduce((a, b) => a + (b.outcome && b.outcome.newCustomers || 0), 0);
    return A.head(t('nav.c.results'), t('res.sub')) +
      '<div class="kpis">' + A.kpi('wallet', t('res.spend'), A.money(spend)) + A.kpi('chart', t('res.reported'), A.num(list.filter(b => b.report).length)) + A.kpi('users', t('out.customers'), cust ? A.num(cust) : '—') + A.kpi('target', t('out.cpo'), cust ? A.money(Math.round(spend / cust)) : '—', t('out.calc')) + '</div>' +
      (list.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.booking') + '</th><th>' + t('th.opportunity') + '</th><th class="num">' + t('res.spend') + '</th><th>' + t('res.supplierSays') + '</th><th>' + t('res.youSay') + '</th><th class="num">' + t('out.cpo') + '</th></tr></thead><tbody>' +
        list.map(b => { const m = b.report && b.report.metrics[0]; const o = b.outcome; return '<tr><td><a href="#c-booking-' + b.id + '">' + esc(b.number) + '</a></td><td>' + esc(A.oppTitle(Store.opp(b.oppId))) + '</td><td class="num">' + A.money(b.total) + '</td><td>' + (m ? A.num(m.value) + ' ' + esc(A.term(m.unit)) + ' · ' + t('meth.' + m.method) : '—') + '</td><td>' + (o && o.newCustomers ? t('res.newC', { n: A.num(o.newCustomers) }) : '<a href="#c-booking-' + b.id + '">' + t('res.add') + '</a>') + '</td><td class="num">' + (o && o.newCustomers ? A.money(Math.round(b.total / o.newCustomers)) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="panel">' + A.empty('chart', t('res.empty'), t('res.emptyText')) + '</div>') +
      '<p class="muted small">' + t('res.note') + '</p>';
  };
})();
