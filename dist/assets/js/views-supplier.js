/* Platform: supplier workspace views */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App, E = CON.Engine, D = CON.DATA, Store = CON.Store;
  const t = A.t, esc = A.esc, ic = A.ic;
  const V = A.views = A.views || {};
  V.s = {};

  const me = () => Store.supplier(Store.state.activeSupplierId);
  const myRfqs = () => Store.state.rfqs.filter(r => r.lines.some(l => l.supplierId === Store.state.activeSupplierId));
  const myLines = r => r.lines.filter(l => l.supplierId === Store.state.activeSupplierId);

  A.supplierSwitch = function () {
    const s = Store.state;
    return '<div class="panel" style="padding:14px 16px"><div class="form-actions" style="justify-content:space-between"><div class="field" style="flex:1;min-width:220px"><label for="sup-switch">' + t('s.actingAs') + '</label><select class="select" id="sup-switch" data-live="supswitch">' + s.suppliers.map(x => '<option value="' + x.id + '"' + (x.id === s.activeSupplierId ? ' selected' : '') + '>' + esc(A.L(x.name)) + '</option>').join('') + '</select></div><button class="btn btn-light btn-sm" data-act="sup-register" style="align-self:end">' + ic('plus') + t('s.register') + '</button></div></div>';
  };

  V.s.overview = function () {
    const sup = me(); const s = Store.state;
    const awaiting = myRfqs().filter(r => r.status === 'open' && myLines(r).some(l => !l.response));
    const listings = s.opportunities.filter(o => o.supplierId === sup.id);
    const bks = s.bookings.filter(b => b.supplierId === sup.id);
    const inProg = bks.filter(b => ['confirmed', 'preparing', 'live'].includes(b.status));
    const released = bks.filter(b => b.payout === 'released').reduce((a, b) => a + b.net, 0);
    const held = bks.filter(b => b.payout !== 'released').reduce((a, b) => a + b.net, 0);
    return A.supplierSwitch() + A.head(A.L(sup.name), t('s.overview.sub'), '<a class="btn btn-dark" href="#s-listing">' + ic('plus') + '<span>' + t('s.addListing') + '</span></a>') +
      (sup.verified !== 'verified' ? '<div class="notice warn">' + ic('shield') + '<div><b>' + t('s.verify.' + (sup.verified || 'none')) + '</b> ' + t('s.verify.why') + ' <a href="#s-profile">' + t('nav.s.profile') + '</a></div></div>' : '') +
      '<div class="kpis">' + A.kpi('inbox', t('s.k.awaiting'), A.num(awaiting.length)) + A.kpi('store', t('s.k.listings'), A.num(listings.filter(o => o.status === 'active').length), t('s.k.of', { n: listings.length })) + A.kpi('track', t('s.k.inprog'), A.num(inProg.length)) + A.kpi('wallet', t('s.k.payouts'), A.money(released), t('s.k.held', { v: A.money(held) })) + '</div>' +
      '<div class="grid-2"><section class="panel"><div class="panel-head"><h2>' + t('nav.s.rfqs') + '</h2><a class="btn btn-ghost btn-xs" href="#s-rfqs">' + t('viewAll') + '</a></div><div class="rows">' +
      (myRfqs().slice(0, 5).map(r => { const pending = myLines(r).some(l => !l.response); return '<div class="row"><span class="row-ico">' + ic('file') + '</span><span class="grow"><b>' + esc(r.number) + '</b><small>' + esc(A.objL(r.objective)) + ' · ' + A.date(r.start) + ' · ' + t('s.lines', { n: myLines(r).length }) + '</small></span>' + (pending && r.status === 'open' ? '<a class="btn btn-blue btn-xs" href="#s-respond-' + r.id + '">' + t('s.respond') + '</a>' : A.badge('ok', t('s.answered'))) + '</div>'; }).join('') || A.empty('inbox', t('s.noRfqs'), t('s.noRfqsText'))) +
      '</div></section><section class="panel"><div class="panel-head"><h2>' + t('nav.s.bookings') + '</h2><a class="btn btn-ghost btn-xs" href="#s-bookings">' + t('viewAll') + '</a></div><div class="rows">' +
      (bks.slice(-5).reverse().map(b => '<div class="row"><span class="row-ico">' + ic('track') + '</span><span class="grow"><b>' + esc(b.number) + '</b><small>' + esc(A.oppTitle(Store.opp(b.oppId))) + '</small></span>' + A.statusBadge('bk', b.status) + '</div>').join('') || A.empty('track', t('s.noBookings'), t('s.noBookingsText'))) +
      '</div></section></div>';
  };

  V.s.listings = function () {
    const sup = me();
    const list = Store.state.opportunities.filter(o => o.supplierId === sup.id);
    return A.supplierSwitch() + A.head(t('nav.s.listings'), t('s.listings.sub'), '<a class="btn btn-light btn-sm" href="#s-import">' + ic('upload') + '<span>' + t('s.import') + '</span></a><a class="btn btn-dark btn-sm" href="#s-listing">' + ic('plus') + '<span>' + t('s.addListing') + '</span></a>') +
      (list.length ? '<div class="panel tight"><div class="rows" style="padding:0 18px">' + list.map(op => '<div class="row"><div class="rec-thumb" style="width:64px;flex:none">' + A.thumb(op) + '</div><span class="grow"><b>' + esc(A.oppTitle(op)) + '</b><small>' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + ' · ' + (op.price != null ? A.money(op.price) + ' ' + esc(A.unitL(op.unit).toLowerCase()) : t('price.request')) + ' · ' + t('slots', { left: Math.max(0, op.slotsTotal - op.slotsBooked), total: op.slotsTotal }) + '</small></span>' + A.statusBadge('opp', op.status) +
        '<span class="inline-confirm">' + (A.ui.confirm === 'opp:' + op.id ? '<span class="small">' + t('confirmDelete') + '</span><button class="btn btn-danger btn-xs" data-act="opp-delete" data-id="' + op.id + '">' + t('delete') + '</button><button class="btn btn-ghost btn-xs" data-act="confirm-cancel">' + t('cancel') + '</button>' :
          '<a class="btn btn-light btn-xs" href="#s-listing-' + op.id + '">' + ic('edit') + t('edit') + '</a><button class="btn btn-ghost btn-xs" data-act="opp-pause" data-id="' + op.id + '">' + (op.status === 'active' ? t('pause') : t('activate')) + '</button><button class="btn btn-ghost btn-xs" data-act="confirm" data-key="opp:' + op.id + '" aria-label="' + esc(t('delete')) + '">' + ic('trash') + '</button>') + '</span></div>').join('') + '</div></div>' : '<div class="panel">' + A.empty('store', t('s.noListings'), t('s.noListingsText'), '<a class="btn btn-dark btn-sm" href="#s-listing">' + t('s.addListing') + '</a>') + '</div>');
  };

  V.s.listing = function (id) {
    const editing = id ? Store.opp(id) : null;
    if (id && !editing) return A.notFound();
    const o = editing || { type: 'residential_sampling', area: 'marina', unit: 'day', price: '', setupFee: 0, minUnits: 1, maxUnits: 30, availableFrom: E.util.todayIso(), availableTo: E.util.addDays(E.util.todayIso(), 120), leadDays: 7, slotsTotal: 4, slotsBooked: 0, audience: { gender: 'mixed', ageMin: 22, ageMax: 50, interests: [] }, reach: null, performance: [], title: { en: '' }, desc: { en: '' }, requirements: { en: '' }, status: 'active' };
    const au = o.audience || {};
    const up = A.ui.upload != null ? A.ui.upload : (o.image || '');
    const opt = (v, l, cur) => '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
    const perf = (o.performance || [])[0] || {};
    return A.head(editing ? t('s.editListing') : t('s.addListing'), t('s.listing.sub'), '', { href: '#s-listings', label: t('nav.s.listings') }) +
      '<form class="panel" data-form="listing" data-id="' + (editing ? editing.id : '') + '" novalidate>' +
      '<div class="panel-head"><h2>' + t('s.l.basics') + '</h2></div><div class="form-grid">' +
      '<div class="field span-2"><label for="l-title">' + t('s.l.title') + '</label><input class="input" id="l-title" name="title" required maxlength="100" value="' + esc(A.L(o.title)) + '" placeholder="' + esc(t('s.l.titlePh')) + '"></div>' +
      '<div class="field"><label for="l-type">' + t('cat.type') + '</label><select class="select" id="l-type" name="type">' + D.types.map(ty => opt(ty, A.typeL(ty), o.type)).join('') + '</select></div>' +
      '<div class="field"><label for="l-area">' + t('cat.area') + '</label><select class="select" id="l-area" name="area">' + opt('all', t('area.cityWide'), o.area) + Object.keys(D.areas).map(a => opt(a, A.areaL(a), o.area)).join('') + '</select></div>' +
      '<div class="field span-2"><label for="l-desc">' + t('s.l.desc') + '</label><textarea class="textarea" id="l-desc" name="desc" maxlength="500" placeholder="' + esc(t('s.l.descPh')) + '">' + esc(A.L(o.desc)) + '</textarea></div>' +
      '</div><div class="panel-head"><h2>' + t('s.l.pricing') + '</h2></div><div class="form-grid-3">' +
      '<div class="field"><label for="l-price">' + t('s.l.price') + '</label><input class="input" id="l-price" name="price" type="number" min="0" required value="' + esc(o.price) + '"></div>' +
      '<div class="field"><label for="l-unit">' + t('s.l.unit') + '</label><select class="select" id="l-unit" name="unit">' + ['day', 'week', 'month', 'activation'].map(u => opt(u, A.unitL(u), o.unit)).join('') + '</select></div>' +
      '<div class="field"><label for="l-setup">' + t('s.l.setup') + '</label><input class="input" id="l-setup" name="setupFee" type="number" min="0" value="' + esc(o.setupFee || 0) + '"></div>' +
      '<div class="field"><label for="l-min">' + t('s.l.min') + '</label><input class="input" id="l-min" name="minUnits" type="number" min="1" value="' + esc(o.minUnits || 1) + '"></div>' +
      '<div class="field"><label for="l-max">' + t('s.l.max') + '</label><input class="input" id="l-max" name="maxUnits" type="number" min="1" value="' + esc(o.maxUnits || 1) + '"></div>' +
      '<div class="field"><label for="l-slots">' + t('s.l.slots') + '</label><input class="input" id="l-slots" name="slotsTotal" type="number" min="1" value="' + esc(o.slotsTotal || 1) + '"></div>' +
      '</div><div class="panel-head"><h2>' + t('s.l.availability') + '</h2></div><div class="form-grid-3">' +
      '<div class="field"><label for="l-from">' + t('s.l.from') + '</label><input class="input" id="l-from" name="availableFrom" type="date" required value="' + esc(o.availableFrom) + '"></div>' +
      '<div class="field"><label for="l-to">' + t('s.l.to') + '</label><input class="input" id="l-to" name="availableTo" type="date" required value="' + esc(o.availableTo) + '"></div>' +
      '<div class="field"><label for="l-lead">' + t('s.l.lead') + '</label><input class="input" id="l-lead" name="leadDays" type="number" min="0" value="' + esc(o.leadDays || 0) + '"></div>' +
      '</div><div class="panel-head"><h2>' + t('s.l.audience') + '</h2></div><div class="form-grid-3">' +
      '<div class="field"><label for="l-gender">' + t('s.l.gender') + '</label><select class="select" id="l-gender" name="gender">' + ['mixed', 'female', 'male'].map(g => opt(g, t('g.' + g), au.gender)).join('') + '</select></div>' +
      '<div class="field"><label for="l-amin">' + t('fld.ageMin') + '</label><input class="input" id="l-amin" name="ageMin" type="number" min="16" max="80" value="' + esc(au.ageMin || 22) + '"></div>' +
      '<div class="field"><label for="l-amax">' + t('fld.ageMax') + '</label><input class="input" id="l-amax" name="ageMax" type="number" min="16" max="80" value="' + esc(au.ageMax || 50) + '"></div>' +
      '<div class="field" style="grid-column:1/-1"><span class="label">' + t('fld.interests') + '</span><div class="chip-group">' + D.interests.map(i => '<label class="chip"><input type="checkbox" name="interests" value="' + i + '"' + ((au.interests || []).includes(i) ? ' checked' : '') + '><span>' + esc(A.intL(i)) + '</span></label>').join('') + '</div></div>' +
      '</div><div class="panel-head"><div><h2>' + t('s.l.evidence') + '</h2><p>' + t('s.l.evidenceSub') + '</p></div></div><div class="form-grid-3">' +
      '<div class="field"><label for="l-reach">' + t('s.l.reach') + '</label><input class="input" id="l-reach" name="reachValue" type="number" min="0" value="' + esc(o.reach ? o.reach.value : '') + '"></div>' +
      '<div class="field"><label for="l-reachu">' + t('s.l.reachUnit') + '</label><input class="input" id="l-reachu" name="reachUnit" maxlength="60" value="' + esc(o.reach ? A.term(o.reach.unit) : '') + '" placeholder="' + esc(t('s.l.reachUnitPh')) + '"></div>' +
      '<div class="field"><label for="l-reachd">' + t('s.l.reachDate') + '</label><input class="input" id="l-reachd" name="reachDate" type="month" value="' + esc(o.reach ? o.reach.date : '') + '"></div>' +
      '<div class="field"><label for="l-pm">' + t('s.l.perfMetric') + '</label><input class="input" id="l-pm" name="perfMetric" maxlength="60" value="' + esc(perf.metric ? A.term(perf.metric) : '') + '" placeholder="' + esc(t('s.l.perfPh')) + '"></div>' +
      '<div class="field"><label for="l-pv">' + t('s.l.perfValue') + '</label><input class="input" id="l-pv" name="perfValue" type="number" min="0" value="' + esc(perf.value || '') + '"></div>' +
      '<div class="field"><label for="l-pd">' + t('s.l.reachDate') + '</label><input class="input" id="l-pd" name="perfDate" type="month" value="' + esc(perf.date || '') + '"></div>' +
      '</div><p class="src">' + t('s.l.declared') + '</p>' +
      '<div class="panel-head"><h2>' + t('s.l.rules') + '</h2></div><div class="form-grid">' +
      '<div class="field span-2"><label for="l-req">' + t('fact.req') + '</label><textarea class="textarea" id="l-req" name="requirements" maxlength="400" placeholder="' + esc(t('s.l.reqPh')) + '">' + esc(A.L(o.requirements)) + '</textarea></div>' +
      '<div class="field"><label for="l-img">' + t('s.l.image') + '</label><input class="input" id="l-img" type="file" accept="image/*" data-upload style="padding-top:10px"><span class="hint">' + t('s.l.imageHint') + '</span></div>' +
      '<div class="field"><span class="label">' + t('s.l.preview') + '</span><div class="upload-preview">' + (up ? '<img src="' + esc(up) + '" alt="">' : CON.illus(o.type)) + '</div>' + (up ? '<button class="link-btn small" type="button" data-act="upload-clear">' + t('s.l.removeImg') + '</button>' : '') + '</div>' +
      '</div><p class="error-text" data-error hidden></p>' +
      '<div class="form-actions"><button class="btn btn-dark" type="submit">' + ic('check') + '<span>' + (editing ? t('save') : t('s.publish')) + '</span></button><a class="btn btn-ghost" href="#s-listings">' + t('cancel') + '</a></div></form>';
  };

  A.CSV_TEMPLATE = 'title,type,area,price,unit,setup_fee,available_from,available_to,slots,age_min,age_max,gender,interests,description,requirements\n"Weekend lobby sampling, 4 towers",residential_sampling,jvc,550,day,0,2026-11-01,2027-02-28,6,25,50,mixed,residents|families,"Staffed table in four lobbies, 5–9 pm","Sealed samples only"\n"Juice bar counter display",cafe_partnership,difc,2900,week,400,2026-11-01,2027-03-31,4,22,45,mixed,professionals|foodies,"Counter display in two juice bars",""';

  V.s.import = function () {
    const rows = A.ui.importRows;
    let preview = '';
    if (rows) {
      const ok = rows.filter(r => !r.errors.length).length;
      preview = '<section class="panel"><div class="panel-head"><h2>' + t('imp.preview', { ok, n: rows.length }) + '</h2>' + (ok ? '<button class="btn btn-dark btn-sm" data-act="import-commit">' + ic('upload') + t('imp.commit', { n: ok }) + '</button>' : '') + '</div><div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>' + t('s.l.title') + '</th><th>' + t('cat.type') + '</th><th>' + t('cat.area') + '</th><th class="num">' + t('s.l.price') + '</th><th>' + t('th.status') + '</th></tr></thead><tbody>' +
        rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(r.op ? A.L(r.op.title) : '—') + '</td><td>' + esc(r.op && D.types.includes(r.op.type) ? A.typeL(r.op.type) : (r.raw.type || '—')) + '</td><td>' + esc(r.op ? A.areaL(r.op.area) : '—') + '</td><td class="num">' + (r.op && r.op.price != null ? A.money(r.op.price) : '—') + '</td><td>' + (r.errors.length ? A.badge('bad', r.errors.map(e => t('imp.e.' + e)).join(', ')) : A.badge('ok', t('imp.ready'))) + '</td></tr>').join('') + '</tbody></table></div></section>';
    }
    return A.head(t('s.import'), t('imp.sub'), '', { href: '#s-listings', label: t('nav.s.listings') }) +
      '<form class="panel" data-form="import" novalidate><div class="panel-head"><div><h2>' + t('imp.paste') + '</h2><p>' + t('imp.pasteSub') + '</p></div><div class="head-actions"><button class="btn btn-light btn-sm" type="button" data-act="import-example">' + ic('file') + t('imp.example') + '</button><label class="btn btn-light btn-sm" for="imp-file">' + ic('upload') + t('imp.file') + '</label><input class="sr-only" id="imp-file" type="file" accept=".csv,text/csv" data-import-file></div></div>' +
      '<div class="field"><label class="sr-only" for="imp-text">CSV</label><textarea class="textarea code" id="imp-text" name="csv" style="min-height:160px;white-space:pre">' + esc(A.ui.importText || '') + '</textarea></div>' +
      '<details class="why"><summary>' + t('imp.columns') + ic('chevron-down') + '</summary><div class="why-body"><div class="code">' + esc(A.CSV_TEMPLATE.split('\n')[0]) + '</div><p class="small muted">' + t('imp.columnsHelp', { types: D.types.join(', '), areas: Object.keys(D.areas).concat('all').join(', ') }) + '</p></div></details>' +
      '<p class="error-text" data-error hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('search') + t('imp.check') + '</button></div></form>' + preview;
  };

  V.s.rfqs = function () {
    const list = myRfqs();
    return A.supplierSwitch() + A.head(t('nav.s.rfqs'), t('s.rfqs.sub')) +
      (list.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.rfq') + '</th><th>' + t('th.goal') + '</th><th>' + t('th.dates') + '</th><th>' + t('s.yourLines') + '</th><th>' + t('th.status') + '</th><th></th></tr></thead><tbody>' +
        list.map(r => { const ls = myLines(r); const pending = ls.some(l => !l.response); const awarded = ls.some(l => l.approved && r.status === 'awarded'); return '<tr><td>' + esc(r.number) + ' ' + A.sampleTag(r) + '<br><small class="muted">' + A.since(r.createdAt) + '</small></td><td>' + esc(A.objL(r.objective)) + '</td><td>' + A.date(r.start) + ' – ' + A.date(r.end) + '</td><td>' + ls.map(l => esc(A.oppTitle(Store.opp(l.oppId)))).join('<br>') + '</td><td>' + (awarded ? A.badge('ok', t('s.awarded')) : r.status !== 'open' ? A.badge('', t('s.closed')) : pending ? A.badge('warn', t('s.needsReply')) : A.badge('info', t('s.answered'))) + '</td><td><a class="btn ' + (pending && r.status === 'open' ? 'btn-blue' : 'btn-light') + ' btn-xs" href="#s-respond-' + r.id + '">' + (pending && r.status === 'open' ? t('s.respond') : t('open')) + '</a></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="panel">' + A.empty('inbox', t('s.noRfqs'), t('s.noRfqsText')) + '</div>');
  };

  V.s.respond = function (id) {
    const r = Store.rfq(id); if (!r) return A.notFound();
    const ls = myLines(r);
    const back = { href: '#s-rfqs', label: t('nav.s.rfqs') };
    if (!ls.length) return A.supplierSwitch() + A.head(r.number, '', '', back) + '<div class="panel">' + A.empty('inbox', t('s.notYours'), t('s.notYoursText')) + '</div>';
    const opt = (v, l, cur) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>';
    return A.supplierSwitch() + A.head(r.number, t('s.respond.sub'), '', back) +
      '<div class="doc"><div class="doc-head"><div><small>' + t('rfq.request') + '</small><h2>' + esc(A.objL(r.objective)) + (r.product ? ' · ' + esc(r.product) : '') + '</h2></div><div><small>' + t('rfq.deadline') + '</small><h2>' + A.date(r.responseDeadline) + '</h2></div></div><div class="doc-body"><dl class="dl">' +
      '<dt>' + t('fld.audience') + '</dt><dd>' + esc(A.audienceText(Object.assign({}, r.audience))) + '</dd>' +
      '<dt>' + t('fld.areas') + '</dt><dd>' + esc(A.areasL(r.areas)) + '</dd>' +
      '<dt>' + t('fld.dates') + '</dt><dd>' + A.date(r.start) + ' – ' + A.date(r.end) + ' (' + t('days', { n: r.duration }) + ')</dd>' +
      '<dt>' + t('fld.budget') + '</dt><dd>' + (r.shareBudget === false ? t('rfq.budgetHidden') : A.money(r.budget) + ' ' + t('rfq.budgetTotal')) + '</dd>' +
      '<dt>' + t('fld.success') + '</dt><dd>' + esc(r.success || '—') + '</dd>' +
      '<dt>' + t('rfq.reporting') + '</dt><dd>' + t('rep.' + r.reporting) + '</dd>' +
      '<dt>' + t('rfq.special') + '</dt><dd>' + esc(r.requirements || '—') + '</dd></dl></div></div>' +
      ls.map(l => {
        const op = Store.opp(l.oppId); const req = l.requested; const res = l.response;
        if (res) {
          const n = res.status === 'offered' ? A.norm(l, r) : null;
          return '<section class="panel"><div class="panel-head"><div><h2>' + esc(A.oppTitle(op)) + '</h2><p>' + t('s.yourReply') + ' · ' + A.since(res.respondedAt) + '</p></div>' + A.statusBadge('line', A.lineStatus(l)) + '</div>' +
            (n ? '<div class="brief-sum">' + A.fact(t('off.base'), A.money(res.basePrice)) + A.fact(t('off.setup'), A.money(res.setupFee)) + A.fact(t('s.youReceive'), A.money(n.net), t('s.feeNote')) + A.fact(t('off.dates'), A.date(res.from) + ' – ' + A.date(res.to)) + A.fact(t('off.reporting'), t('rep.' + res.reporting)) + A.fact(t('off.terms'), t('terms.' + res.terms)) + '</div>' : '<p>' + t('decl.' + (res.reason || 'other')) + '</p>') +
            (l.approved ? '<div class="notice ok">' + ic('check-circle') + '<div>' + t('s.approvedNote') + '</div></div>' : '') + '</section>';
        }
        if (r.status !== 'open') return '<section class="panel"><h2>' + esc(A.oppTitle(op)) + '</h2><p class="muted">' + t('s.closedNote') + '</p></section>';
        return '<form class="panel" data-form="respond" data-rfq="' + r.id + '" data-id="' + l.oppId + '" novalidate><div class="panel-head"><div><h2>' + esc(A.oppTitle(op)) + '</h2><p>' + t('s.requested', { units: A.num(req.units), unit: A.unitL(req.unit).toLowerCase(), est: req.subtotal == null ? t('price.request') : A.money(req.subtotal) }) + '</p></div></div>' +
          '<div class="chip-group"><label class="chip"><input type="radio" name="decision" value="offer" checked><span>' + t('s.offer') + '</span></label><label class="chip"><input type="radio" name="decision" value="decline"><span>' + t('s.decline') + '</span></label></div>' +
          '<div class="form-grid-3">' +
          '<div class="field"><label for="rb-' + l.oppId + '">' + t('off.base') + '</label><input class="input" id="rb-' + l.oppId + '" name="basePrice" type="number" min="0" value="' + (req.base || '') + '"></div>' +
          '<div class="field"><label for="rs-' + l.oppId + '">' + t('off.setup') + '</label><input class="input" id="rs-' + l.oppId + '" name="setupFee" type="number" min="0" value="' + (req.setup || 0) + '"></div>' +
          '<div class="field"><label for="rv-' + l.oppId + '">' + t('off.valid') + '</label><input class="input" id="rv-' + l.oppId + '" name="validUntil" type="date" value="' + E.util.addDays(E.util.todayIso(), 14) + '"></div>' +
          '<div class="field"><label for="rf-' + l.oppId + '">' + t('s.l.from') + '</label><input class="input" id="rf-' + l.oppId + '" name="from" type="date" value="' + r.start + '"></div>' +
          '<div class="field"><label for="rt-' + l.oppId + '">' + t('s.l.to') + '</label><input class="input" id="rt-' + l.oppId + '" name="to" type="date" value="' + r.end + '"></div>' +
          '<div class="field"><label for="rr-' + l.oppId + '">' + t('off.reporting') + '</label><select class="select" id="rr-' + l.oppId + '" name="reporting">' + ['basic', 'detailed', 'none'].map(k => opt(k, t('rep.' + k), r.reporting)).join('') + '</select></div>' +
          '<div class="field"><label for="rp-' + l.oppId + '">' + t('off.terms') + '</label><select class="select" id="rp-' + l.oppId + '" name="terms">' + ['upfront', 'split', 'net30'].map(k => opt(k, t('terms.' + k), 'split')).join('') + '</select></div>' +
          '<div class="field"><label for="rd-' + l.oppId + '">' + t('s.declineReason') + '</label><select class="select" id="rd-' + l.oppId + '" name="reason">' + ['capacity', 'dates', 'category', 'other'].map(k => opt(k, t('decl.' + k), 'capacity')).join('') + '</select></div>' +
          '<div class="field" style="grid-column:1/-1"><label for="rn-' + l.oppId + '">' + t('s.deliverables') + '</label><textarea class="textarea" id="rn-' + l.oppId + '" name="deliverables" maxlength="400" placeholder="' + esc(t('s.deliverablesPh')) + '"></textarea></div>' +
          '</div><p class="error-text" data-error hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('send') + t('s.sendReply') + '</button><span class="muted small">' + t('s.feeNote') + '</span></div></form>';
      }).join('');
  };

  V.s.bookings = function () {
    const sup = me();
    const list = Store.state.bookings.filter(b => b.supplierId === sup.id).reverse();
    return A.supplierSwitch() + A.head(t('nav.s.bookings'), t('s.bookings.sub')) + (list.length ? A.bookingRows(list, 's') : '<div class="panel">' + A.empty('track', t('s.noBookings'), t('s.noBookingsText')) + '</div>');
  };

  V.s.booking = function (id) {
    const b = Store.booking(id); if (!b) return A.notFound();
    const next = { confirmed: 'preparing', preparing: 'live', live: 'completed' }[b.status];
    const rows = (b.report && b.report.metrics.length ? b.report.metrics : [{ name: '', value: '', unit: '', method: 'counted', note: '' }]);
    const opt = (v, l, cur) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>';
    return A.supplierSwitch() + A.head(b.number + ' · ' + A.oppTitle(Store.opp(b.oppId)), t('s.booking.sub'), '', { href: '#s-bookings', label: t('nav.s.bookings') }) +
      (b.supplierId !== Store.state.activeSupplierId ? '<div class="notice warn">' + ic('info') + '<div>' + t('s.otherSupplier', { name: esc(A.supName(b.supplierId)) }) + '</div></div>' : '') +
      '<section class="panel">' + A.timeline(b) + (next && b.supplierId === Store.state.activeSupplierId ? '<div class="form-actions"><button class="btn btn-dark btn-sm" data-act="advance" data-id="' + b.id + '" data-status="' + next + '">' + ic('arrow') + t('s.markAs', { st: t('bk.' + next) }) + '</button></div>' : '') + '</section>' +
      '<div class="brief-sum">' + A.fact(t('th.dates'), A.date(b.from) + ' – ' + A.date(b.to)) + A.fact(t('s.youReceive'), A.money(b.net)) + A.fact(t('bk.payout'), t('payout.' + b.payout)) + A.fact(t('th.status'), t('bk.' + b.status)) + A.fact(t('th.booking'), esc(b.number)) + A.fact(t('s.buyer'), esc(Store.state.company)) + '</div>' +
      (b.supplierId === Store.state.activeSupplierId ? '<form class="panel" data-form="report" data-id="' + b.id + '" novalidate><div class="panel-head"><div><h2>' + t('rep.title') + '</h2><p>' + t('s.report.sub') + '</p></div></div><div class="metric-rows" data-metric-rows>' +
        rows.map((m, i) => '<div class="metric-row"><div class="field"><label for="mn' + i + '">' + t('rep.metric') + '</label><input class="input" id="mn' + i + '" name="name" maxlength="60" value="' + esc(A.term(m.name)) + '" placeholder="' + esc(t('s.metricPh')) + '"></div><div class="field"><label for="mv' + i + '">' + t('rep.value') + '</label><input class="input" id="mv' + i + '" name="value" type="number" min="0" value="' + esc(m.value) + '"></div><div class="field"><label for="mu' + i + '">' + t('rep.unit') + '</label><input class="input" id="mu' + i + '" name="unit" maxlength="30" value="' + esc(A.term(m.unit)) + '"></div><div class="field"><label for="mm' + i + '">' + t('rep.method') + '</label><select class="select" id="mm' + i + '" name="method">' + ['counted', 'system', 'estimated'].map(k => opt(k, t('meth.' + k), m.method)).join('') + '</select></div><button class="icon-btn" type="button" data-act="metric-remove" aria-label="' + esc(t('remove')) + '">' + ic('x') + '</button></div>').join('') +
        '</div><div class="form-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="metric-add">' + ic('plus') + t('s.addMetric') + '</button></div><p class="src">' + t('s.report.note') + '</p><p class="error-text" data-error hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('send') + (b.report ? t('s.updateReport') : t('s.submitReport')) + '</button></div></form>' : '<section class="panel"><h2>' + t('rep.title') + '</h2>' + A.reportHtml(b) + '</section>');
  };

  V.s.profile = function () {
    const sup = me();
    return A.supplierSwitch() + A.head(t('nav.s.profile'), t('s.profile.sub')) +
      '<form class="panel" data-form="profile" data-id="' + sup.id + '" novalidate><div class="panel-head"><h2>' + t('s.p.business') + '</h2>' + A.verifiedBadge(sup) + '</div>' +
      '<div class="form-grid"><div class="field span-2"><label for="p-name">' + t('s.p.name') + '</label><input class="input" id="p-name" name="name" required maxlength="100" value="' + esc(A.L(sup.name)) + '"></div>' +
      '<div class="field"><label for="p-lic">' + t('s.p.licence') + '</label><input class="input" id="p-lic" name="licence" required maxlength="40" value="' + esc(sup.licence || '') + '"></div>' +
      '<div class="field"><label for="p-em">' + t('s.p.emirate') + '</label><select class="select" id="p-em" name="emirate">' + ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].map(e => '<option value="' + e + '"' + (sup.emirate === e ? ' selected' : '') + '>' + esc(t('em.' + e)) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="p-cat">' + t('s.p.category') + '</label><select class="select" id="p-cat" name="category">' + D.types.map(ty => '<option value="' + ty + '"' + (sup.category === ty ? ' selected' : '') + '>' + esc(A.typeL(ty)) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="p-contact">' + t('s.p.contact') + '</label><input class="input" id="p-contact" name="contact" type="email" required maxlength="120" value="' + esc(sup.contact || '') + '"></div>' +
      '<div class="field span-2"><label for="p-doc">' + t('s.p.doc') + '</label><input class="input" id="p-doc" name="doc" type="file" accept=".pdf,image/*" style="padding-top:10px"><span class="hint">' + (sup.docName ? t('s.p.docOn', { name: esc(sup.docName) }) : t('s.p.docHint')) + '</span></div></div>' +
      (sup.verifyNote ? '<div class="notice">' + ic('info') + '<div><b>' + t('s.p.note') + ':</b> ' + esc(sup.verifyNote) + '</div></div>' : '') +
      '<p class="error-text" data-error hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit" name="intent" value="save">' + ic('check') + t('save') + '</button>' + (sup.verified !== 'verified' && sup.verified !== 'pending' ? '<button class="btn btn-blue btn-sm" type="submit" name="intent" value="verify">' + ic('shield') + t('s.p.submit') + '</button>' : '') + '</div></form>';
  };
})();
