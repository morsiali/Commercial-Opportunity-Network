/* Platform: supplier workspace views (v3) */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App, E = CON.Engine, D = CON.DATA, Store = CON.Store, M = CON.Money, Dt = CON.Dates, Of = CON.Offers, S = CON.States;
  const t = A.t, esc = A.esc, ic = A.ic;
  const V = A.views = A.views || {};
  V.s = {};
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
  const dec = minor => minor == null ? '' : M.toDecimalString(minor).replace(/\.00$/, '');
  const errBox = key => A.ui.errors[key] ? A.errHtml(A.ui.errors[key]) : '';

  const me = () => Store.supplier(Store.state.activeSupplierId);
  const myRfqs = () => Store.state.rfqs.filter(r => r.lines.some(l => l.supplierId === Store.state.activeSupplierId));
  const myLines = r => r.lines.filter(l => l.supplierId === Store.state.activeSupplierId);

  A.supplierSwitch = function () {
    const s = Store.state;
    return '<div class="panel" style="padding:14px 16px"><div class="form-actions" style="justify-content:space-between"><div class="field" style="flex:1;min-width:220px"><label for="sup-switch">' + t('s.actingAs') + '</label><select class="select" id="sup-switch" data-live="supswitch">' + s.suppliers.map(x => '<option value="' + x.id + '"' + (x.id === s.activeSupplierId ? ' selected' : '') + '>' + esc(A.L(x.name)) + '</option>').join('') + '</select><span class="hint">' + t('s.actingHint') + '</span></div><button class="btn btn-light btn-sm" data-act="sup-register" style="align-self:end">' + ic('plus') + t('s.register') + '</button></div></div>';
  };

  V.s.overview = function () {
    const sup = me(); const s = Store.state;
    const awaiting = myRfqs().filter(r => myLines(r).some(l => l.status === 'requested'));
    const listings = s.opportunities.filter(o => o.supplierId === sup.id);
    const bks = s.bookings.filter(b => b.supplierId === sup.id);
    const inProg = bks.filter(b => ['confirmed', 'preparing', 'live'].includes(b.status));
    const pos = s.payouts.filter(p => p.supplierId === sup.id);
    const released = M.sum(pos.filter(p => p.status === 'released').map(p => p.amount));
    const held = M.sum(pos.filter(p => ['held', 'eligible', 'withheld'].includes(p.status)).map(p => p.amount));
    const v = sup.verification || {};
    return A.supplierSwitch() + A.head(A.L(sup.name), t('s.overview.sub'), '<a class="btn btn-dark" href="#s-listing">' + ic('plus') + '<span>' + t('s.addListing') + '</span></a>') +
      (v.status !== 'licence_reviewed' ? '<div class="notice warn">' + ic('shield') + '<div><b>' + t('s.verify3.' + (v.status || 'not_submitted')) + '</b> ' + t('s.verify.why3') + ' <a href="#s-profile">' + t('nav.s.profile') + '</a></div></div>' : '') +
      '<div class="kpis">' + A.kpi('inbox', t('s.k.awaiting'), A.num(awaiting.length)) + A.kpi('store', t('s.k.listings'), A.num(listings.filter(o => o.status === 'active').length), t('s.k.of', { n: listings.length })) + A.kpi('track', t('s.k.inprog'), A.num(inProg.length)) + A.kpi('wallet', t('s.k.payouts'), A.money(released), t('s.k.held', { v: A.money(held) })) + '</div>' +
      '<div class="grid-2"><section class="panel"><div class="panel-head"><h2>' + t('nav.s.rfqs') + '</h2><a class="btn btn-ghost btn-xs" href="#s-rfqs">' + t('viewAll') + '</a></div><div class="rows">' +
      (myRfqs().slice(0, 5).map(r => { const pending = myLines(r).some(l => l.status === 'requested'); return '<div class="row"><span class="row-ico">' + ic('file') + '</span><span class="grow"><b>' + esc(r.number) + '</b><small>' + esc(A.objL(r.objective)) + ' · ' + A.date(r.start) + ' · ' + t('s.lines', { n: myLines(r).length }) + '</small></span>' + (pending ? '<a class="btn btn-blue btn-xs" href="#s-respond-' + r.id + '">' + t('s.respond') + '</a>' : A.badge('ok', t('s.answered'))) + '</div>'; }).join('') || A.empty('inbox', t('s.noRfqs'), t('s.noRfqsText'))) +
      '</div></section><section class="panel"><div class="panel-head"><h2>' + t('nav.s.bookings') + '</h2><a class="btn btn-ghost btn-xs" href="#s-bookings">' + t('viewAll') + '</a></div><div class="rows">' +
      (bks.slice(0, 5).map(b => '<div class="row"><span class="row-ico">' + ic('track') + '</span><span class="grow"><b>' + esc(b.number) + '</b><small>' + esc(b.snapshot ? A.L(b.snapshot.title) : A.oppTitle(Store.opp(b.oppId))) + '</small></span>' + A.statusBadge('bk', b.status) + '</div>').join('') || A.empty('track', t('s.noBookings'), t('s.noBookingsText'))) +
      '</div></section></div>';
  };

  V.s.listings = function () {
    const sup = me();
    const list = Store.state.opportunities.filter(o => o.supplierId === sup.id);
    return A.supplierSwitch() + A.head(t('nav.s.listings'), t('s.listings.sub'), '<a class="btn btn-light btn-sm" href="#s-import">' + ic('upload') + '<span>' + t('s.import') + '</span></a><a class="btn btn-dark btn-sm" href="#s-listing">' + ic('plus') + '<span>' + t('s.addListing') + '</span></a>') +
      errBox('listing-del') +
      (list.length ? '<div class="panel tight"><div class="rows" style="padding:0 18px">' + list.map(op => '<div class="row"><div class="rec-thumb" style="width:64px;flex:none">' + A.thumb(op) + '</div><span class="grow"><b>' + A.Lh(op.title) + '</b><small>' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + ' · ' + (op.price != null ? A.money(op.price) + ' ' + esc(A.unitL(op.unit).toLowerCase()) : t('price.request')) + ' · ' + t('cap.perDate', { n: op.capacityPerDate }) + ' · v' + (op.version || 1) + (op.availabilityUpdatedAt ? ' · ' + t('ev.updated', { d: A.date(op.availabilityUpdatedAt) }) : '') + '</small></span>' + A.statusBadge('opp', op.status) +
        '<span class="inline-confirm">' + (A.ui.confirm === 'opp:' + op.id ? '<span class="small">' + (CON.Domain.listingReferenced(Store.state, op.id) ? t('s.archiveQ') : t('confirmDelete')) + '</span><button class="btn btn-danger btn-xs" data-act="opp-delete" data-id="' + op.id + '">' + (CON.Domain.listingReferenced(Store.state, op.id) ? t('s.archive') : t('delete')) + '</button><button class="btn btn-ghost btn-xs" data-act="confirm-cancel">' + t('cancel') + '</button>' :
          (op.status !== 'archived' ? '<a class="btn btn-light btn-xs" href="#s-listing-' + op.id + '">' + ic('edit') + t('edit') + '</a><button class="btn btn-ghost btn-xs" data-act="opp-pause" data-id="' + op.id + '">' + (op.status === 'active' ? t('pause') : t('activate')) + '</button><button class="btn btn-ghost btn-xs" data-act="confirm" data-key="opp:' + op.id + '" aria-label="' + esc(t('delete') + ' ' + A.oppTitle(op)) + '">' + ic('trash') + '</button>' : '<span class="muted small">' + t('s.archivedNote') + '</span>')) + '</span></div>').join('') + '</div></div>' : '<div class="panel">' + A.empty('store', t('s.noListings'), t('s.noListingsText'), '<a class="btn btn-dark btn-sm" href="#s-listing">' + t('s.addListing') + '</a>') + '</div>');
  };

  const triSel = (name, id, cur) => '<select class="select" id="' + id + '" name="' + name + '">' + opt('', t('unknown'), cur == null ? '' : cur) + opt('yes', t('yes'), cur === true ? 'yes' : '') + opt('no', t('no'), cur === false ? 'no' : '') + '</select>';
  V.s.listing = function (id) {
    const editing = id ? Store.opp(id) : null;
    if (id && !editing) return A.notFound();
    if (editing && editing.supplierId !== Store.state.activeSupplierId) return A.supplierSwitch() + '<div class="panel">' + A.empty('lock', t('s.notYours'), t('s.notYoursListing')) + '</div>';
    const today = A.today();
    const o = editing || { type: 'residential_sampling', area: 'marina', unit: 'day', price: null, setupFee: 0, minUnits: 1, maxUnits: 30, capacityPerDate: 1, availableFrom: today, availableTo: Dt.addDays(today, 120), leadDays: 7, schedule: { days: [0, 1, 2, 3, 4, 5, 6] }, eventDates: null, audience: { gender: 'mixed', access: 'open', ageMin: 22, ageMax: 50, interests: [] }, restrictions: { categoriesAllowed: null, foodSampling: null, refrigeration: null, electricity: null, staffingProvided: null }, evidence: [], title: { en: '', ar: '' }, desc: { en: '', ar: '' }, requirements: { en: '', ar: '' }, status: 'active' };
    const au = o.audience || {}; const rs = o.restrictions || {};
    const up = A.ui.upload != null ? A.ui.upload : (o.image || '');
    const ev = (o.evidence || []).filter(e => e.source === 'supplier_declared');
    const evRow = (e, i) => '<div class="form-grid-3 ev-row"><div class="field"><label for="ek' + i + '">' + t('s.ev.kind') + '</label><select class="select" id="ek' + i + '" name="evKind' + i + '">' + opt('', t('none'), e ? e.kind : '') + ['audience', 'delivery', 'outcome'].map(k => opt(k, t('evd.' + k), e && e.kind)).join('') + '</select></div>' +
      '<div class="field"><label for="ev' + i + '">' + t('s.ev.value') + '</label><input class="input" id="ev' + i + '" name="evValue' + i + '" inputmode="numeric" value="' + esc(e ? e.value : '') + '"></div>' +
      '<div class="field"><label for="em' + i + '">' + t('s.ev.metric') + '</label><select class="select" id="em' + i + '" name="evMetric' + i + '">' + E.METRICS.map(k => opt(k, t('evmet.' + k), e && e.metric)).join('') + '</select></div>' +
      '<div class="field"><label for="ep' + i + '">' + t('s.ev.period') + '</label><select class="select" id="ep' + i + '" name="evPeriod' + i + '">' + ['day', 'week', 'month', 'event', 'total'].map(k => opt(k, t('per.' + k), e && e.period)).join('') + '</select></div>' +
      '<div class="field"><label for="eh' + i + '">' + t('s.ev.method') + '</label><select class="select" id="eh' + i + '" name="evMethod' + i + '">' + ['counted', 'system', 'estimated'].map(k => opt(k, t('evm.' + k), e && e.method)).join('') + '</select></div>' +
      '<div class="field"><label for="ed' + i + '">' + t('s.ev.date') + '</label><input class="input" id="ed' + i + '" name="evDate' + i + '" type="month" value="' + esc(e && e.periodEnd ? e.periodEnd.slice(0, 7) : '') + '"></div></div>';
    const key = 'listing.' + (editing ? editing.id : 'new');
    const draft = Store.draft.get(key);
    return A.supplierSwitch() + A.head(editing ? t('s.editListing') : t('s.addListing'), t('s.listing.sub3'), '', { href: '#s-listings', label: t('nav.s.listings') }) +
      (draft ? '<div class="notice">' + ic('file') + '<div>' + t('draft.restored', { d: A.dateTime(draft.savedAt) }) + ' <button class="link-btn" type="button" data-act="draft-discard" data-key="' + key + '">' + t('draft.discard') + '</button></div></div>' : '') +
      (editing && CON.Domain.listingReferenced(Store.state, editing.id) ? '<div class="notice">' + ic('info') + '<div>' + t('s.versionNote', { v: editing.version || 1 }) + '</div></div>' : '') +
      errBox('listing') +
      '<form class="panel" data-form="listing" data-id="' + (editing ? editing.id : '') + '" data-draft="' + key + '" novalidate>' +
      '<div class="panel-head"><div><h2>' + t('s.l.basics') + '</h2><p>' + t('s.l.bilingual') + '</p></div></div><div class="form-grid">' +
      '<div class="field"><label for="l-title">' + t('s.l.titleEn') + ' <span class="req" aria-hidden="true">*</span></label><input class="input" id="l-title" name="titleEn" lang="en" dir="ltr" maxlength="100" value="' + esc(o.title.en || '') + '" placeholder="' + esc(t('s.l.titlePh')) + '"></div>' +
      '<div class="field"><label for="l-title-ar">' + t('s.l.titleAr') + '</label><input class="input" id="l-title-ar" name="titleAr" lang="ar" dir="rtl" maxlength="100" value="' + esc(o.title.ar || '') + '"><span class="hint">' + t('s.l.arHint') + '</span></div>' +
      '<div class="field"><label for="l-type">' + t('cat.type') + '</label><select class="select" id="l-type" name="type">' + D.types.map(ty => opt(ty, A.typeL(ty), o.type)).join('') + '</select></div>' +
      '<div class="field"><label for="l-area">' + t('cat.area') + '</label><select class="select" id="l-area" name="area">' + opt('all', t('area.cityWide'), o.area) + Object.keys(D.areas).map(a => opt(a, A.areaL(a), o.area)).join('') + '</select></div>' +
      '<div class="field"><label for="l-desc">' + t('s.l.descEn') + '</label><textarea class="textarea" id="l-desc" name="descEn" lang="en" dir="ltr" maxlength="500" placeholder="' + esc(t('s.l.descPh')) + '">' + esc(o.desc.en || '') + '</textarea></div>' +
      '<div class="field"><label for="l-desc-ar">' + t('s.l.descAr') + '</label><textarea class="textarea" id="l-desc-ar" name="descAr" lang="ar" dir="rtl" maxlength="500">' + esc(o.desc.ar || '') + '</textarea></div>' +
      '</div><div class="panel-head"><h2>' + t('s.l.pricing') + '</h2></div><div class="form-grid-3">' +
      '<div class="field"><label for="l-price">' + t('s.l.price3') + '</label><input class="input" id="l-price" name="price" inputmode="decimal" value="' + esc(dec(o.price)) + '"><span class="hint">' + t('s.l.priceHint') + '</span></div>' +
      '<div class="field"><label for="l-unit">' + t('s.l.unit') + '</label><select class="select" id="l-unit" name="unit">' + ['day', 'week', 'month', 'activation'].map(u => opt(u, A.unitL(u), o.unit)).join('') + '</select></div>' +
      '<div class="field"><label for="l-setup">' + t('s.l.setup3') + '</label><input class="input" id="l-setup" name="setupFee" inputmode="decimal" value="' + esc(dec(o.setupFee || 0)) + '"></div>' +
      '<div class="field"><label for="l-min">' + t('s.l.min') + '</label><input class="input" id="l-min" name="minUnits" type="number" min="1" value="' + esc(o.minUnits || 1) + '"></div>' +
      '<div class="field"><label for="l-max">' + t('s.l.max') + '</label><input class="input" id="l-max" name="maxUnits" type="number" min="1" value="' + esc(o.maxUnits || '') + '"></div>' +
      '<div class="field"><label for="l-cap">' + t('s.l.capacity') + '</label><input class="input" id="l-cap" name="capacityPerDate" type="number" min="1" max="1000" value="' + esc(o.capacityPerDate || 1) + '"><span class="hint">' + t('s.l.capacityHint') + '</span></div>' +
      '</div><div class="panel-head"><h2>' + t('s.l.availability') + '</h2></div><div class="form-grid-3">' +
      '<div class="field"><label for="l-from">' + t('s.l.from') + '</label><input class="input" id="l-from" name="availableFrom" type="date" required value="' + esc(o.availableFrom) + '"></div>' +
      '<div class="field"><label for="l-to">' + t('s.l.to') + '</label><input class="input" id="l-to" name="availableTo" type="date" required value="' + esc(o.availableTo) + '"></div>' +
      '<div class="field"><label for="l-lead">' + t('s.l.lead') + '</label><input class="input" id="l-lead" name="leadDays" type="number" min="0" max="180" value="' + esc(o.leadDays || 0) + '"></div>' +
      '<fieldset class="field" style="grid-column:1/-1"><legend class="label">' + t('s.l.schedule') + '</legend><div class="chip-group">' + [1, 2, 3, 4, 5, 6, 0].map(d => '<label class="chip"><input type="checkbox" name="days" value="' + d + '"' + ((o.schedule && o.schedule.days || []).includes(d) ? ' checked' : '') + '><span>' + t('wd.' + d) + '</span></label>').join('') + '</div><span class="hint">' + t('s.l.scheduleHint') + '</span></fieldset>' +
      '<div class="field" style="grid-column:1/-1"><label for="l-events">' + t('s.l.events') + '</label><input class="input" id="l-events" name="eventDates" value="' + esc((o.eventDates || []).join(', ')) + '" placeholder="2026-12-12, 2027-01-16"><span class="hint">' + t('s.l.eventsHint') + '</span></div>' +
      '</div><div class="panel-head"><h2>' + t('s.l.audience') + '</h2></div><div class="form-grid-3">' +
      '<div class="field"><label for="l-gender">' + t('s.l.gender') + '</label><select class="select" id="l-gender" name="gender">' + ['mixed', 'female', 'male'].map(g => opt(g, t('g.' + g), au.gender)).join('') + '</select></div>' +
      '<div class="field"><label for="l-access">' + t('s.l.access') + '</label><select class="select" id="l-access" name="access">' + ['open', 'female_only', 'male_only', 'members_only'].map(g => opt(g, t('acc.' + g), au.access || 'open')).join('') + '</select><span class="hint">' + t('s.l.accessHint') + '</span></div>' +
      '<div class="field"><label for="l-amin">' + t('fld.ageMin') + '</label><input class="input" id="l-amin" name="ageMin" type="number" min="13" max="99" value="' + esc(au.ageMin || '') + '"></div>' +
      '<div class="field"><label for="l-amax">' + t('fld.ageMax') + '</label><input class="input" id="l-amax" name="ageMax" type="number" min="13" max="99" value="' + esc(au.ageMax || '') + '"></div>' +
      '<fieldset class="field" style="grid-column:1/-1"><legend class="label">' + t('fld.interests') + '</legend><div class="chip-group">' + D.interests.map(i => '<label class="chip"><input type="checkbox" name="interests" value="' + i + '"' + ((au.interests || []).includes(i) ? ' checked' : '') + '><span>' + esc(A.intL(i)) + '</span></label>').join('') + '</div></fieldset>' +
      '</div><div class="panel-head"><div><h2>' + t('s.l.facilities') + '</h2><p>' + t('s.l.facilitiesSub') + '</p></div></div><div class="form-grid-3">' +
      ['foodSampling', 'refrigeration', 'electricity', 'staffingProvided'].map(k => '<div class="field"><label for="lf-' + k + '">' + A.facL(k) + '</label>' + triSel(k, 'lf-' + k, rs[k]) + '</div>').join('') +
      '<fieldset class="field" style="grid-column:1/-1"><legend class="label">' + t('s.l.categories') + '</legend><label class="check"><input type="checkbox" name="anyCategory"' + (!Array.isArray(rs.categoriesAllowed) ? ' checked' : '') + '><span>' + t('fac.anyCat') + '</span></label><div class="chip-group">' + E.CATEGORIES.map(c => '<label class="chip"><input type="checkbox" name="cats" value="' + c + '"' + (Array.isArray(rs.categoriesAllowed) && rs.categoriesAllowed.includes(c) ? ' checked' : '') + '><span>' + esc(A.catL(c)) + '</span></label>').join('') + '</div><span class="hint">' + t('s.l.categoriesHint') + '</span></fieldset>' +
      '</div><div class="panel-head"><div><h2>' + t('s.l.evidence') + '</h2><p>' + t('s.l.evidenceSub3') + '</p></div></div>' +
      evRow(ev[0], 0) + evRow(ev[1], 1) +
      '<p class="src">' + t('s.l.declared3') + '</p>' +
      '<div class="panel-head"><h2>' + t('s.l.rules') + '</h2></div><div class="form-grid">' +
      '<div class="field"><label for="l-req">' + t('s.l.reqEn') + '</label><textarea class="textarea" id="l-req" name="reqEn" lang="en" dir="ltr" maxlength="400" placeholder="' + esc(t('s.l.reqPh')) + '">' + esc(o.requirements.en || '') + '</textarea></div>' +
      '<div class="field"><label for="l-req-ar">' + t('s.l.reqAr') + '</label><textarea class="textarea" id="l-req-ar" name="reqAr" lang="ar" dir="rtl" maxlength="400">' + esc(o.requirements.ar || '') + '</textarea></div>' +
      '<div class="field"><label for="l-img">' + t('s.l.image') + '</label><input class="input" id="l-img" type="file" accept="image/png,image/jpeg,image/webp" data-upload style="padding-top:10px"><span class="hint">' + t('s.l.imageHint3') + '</span></div>' +
      '<div class="field"><span class="label">' + t('s.l.preview') + '</span><div class="upload-preview">' + (up ? '<img src="' + esc(up) + '" alt="' + esc(t('s.l.previewAlt')) + '">' : CON.illus(o.type)) + '</div>' + (up ? '<button class="link-btn small" type="button" data-act="upload-clear">' + t('s.l.removeImg') + '</button>' : '') + '</div>' +
      '</div><p class="error-text" data-error role="alert" hidden></p>' +
      '<div class="form-actions"><button class="btn btn-dark" type="submit">' + ic('check') + '<span>' + (editing ? t('save') : t('s.publish')) + '</span></button><a class="btn btn-ghost" href="#s-listings">' + t('cancel') + '</a><span class="muted small" data-save-status aria-live="polite"></span></div></form>';
  };

  A.CSV_TEMPLATE = 'title,title_ar,type,area,price,unit,setup_fee,available_from,available_to,capacity_per_date,days,age_min,age_max,gender,access,interests,description,requirements\n"Weekend lobby sampling, 4 towers",,residential_sampling,jvc,550,day,0,2026-11-01,2027-02-28,6,6|0,25,50,mixed,open,residents|families,"Staffed table in four lobbies, 5–9 pm","Sealed samples only"\n"Juice bar counter display",,cafe_partnership,difc,2900.50,week,400,2026-11-01,2027-03-31,4,,22,45,mixed,open,professionals|foodies,"Counter display in two juice bars",""';

  V.s.import = function () {
    const rows = A.ui.importRows;
    let preview = '';
    if (rows) {
      const ok = rows.filter(r => !r.errors.length).length;
      preview = '<section class="panel"><div class="panel-head"><h2>' + t('imp.preview', { ok, n: rows.length }) + '</h2>' + (ok ? '<button class="btn btn-dark btn-sm" data-act="import-commit">' + ic('upload') + t('imp.commit', { n: ok }) + '</button>' : '') + '</div><div class="table-wrap"><table class="t"><thead><tr><th scope="col">#</th><th scope="col">' + t('s.l.titleEn') + '</th><th scope="col">' + t('cat.type') + '</th><th scope="col">' + t('cat.area') + '</th><th scope="col" class="num">' + t('s.l.price3') + '</th><th scope="col">' + t('th.status') + '</th></tr></thead><tbody>' +
        rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(r.op ? A.L(r.op.title) : '—') + '</td><td>' + esc(r.op && D.types.includes(r.op.type) ? A.typeL(r.op.type) : (r.raw.type || '—')) + '</td><td>' + esc(r.op ? A.areaL(r.op.area) : '—') + '</td><td class="num">' + (r.op && r.op.price != null ? A.money(r.op.price) : '—') + '</td><td>' + (r.errors.length ? A.badge('bad', r.errors.map(e => t('imp.e.' + e)).join(', ')) : A.badge('ok', t('imp.ready'))) + '</td></tr>').join('') + '</tbody></table></div></section>';
    }
    return A.head(t('s.import'), t('imp.sub'), '', { href: '#s-listings', label: t('nav.s.listings') }) +
      '<form class="panel" data-form="import" novalidate><div class="panel-head"><div><h2>' + t('imp.paste') + '</h2><p>' + t('imp.pasteSub') + '</p></div><div class="head-actions"><button class="btn btn-light btn-sm" type="button" data-act="import-example">' + ic('file') + t('imp.example') + '</button><label class="btn btn-light btn-sm" for="imp-file">' + ic('upload') + t('imp.file') + '</label><input class="sr-only" id="imp-file" type="file" accept=".csv,text/csv" data-import-file></div></div>' +
      '<div class="field"><label class="sr-only" for="imp-text">CSV</label><textarea class="textarea code" id="imp-text" name="csv" style="min-height:160px;white-space:pre">' + esc(A.ui.importText || '') + '</textarea></div>' +
      '<details class="why"><summary>' + t('imp.columns') + ic('chevron-down') + '</summary><div class="why-body"><div class="code">' + esc(A.CSV_TEMPLATE.split('\n')[0]) + '</div><p class="small muted">' + t('imp.columnsHelp3', { types: D.types.join(', '), areas: Object.keys(D.areas).concat('all').join(', ') }) + '</p></div></details>' +
      '<p class="error-text" data-error role="alert" hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('search') + t('imp.check') + '</button></div></form>' + preview;
  };

  V.s.rfqs = function () {
    const list = myRfqs();
    return A.supplierSwitch() + A.head(t('nav.s.rfqs'), t('s.rfqs.sub')) +
      (list.length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.rfq') + '</th><th scope="col">' + t('th.goal') + '</th><th scope="col">' + t('th.dates') + '</th><th scope="col">' + t('s.yourLines') + '</th><th scope="col">' + t('th.status') + '</th><th scope="col"><span class="sr-only">' + t('actions') + '</span></th></tr></thead><tbody>' +
        list.map(r => { const ls = myLines(r); const pending = ls.some(l => l.status === 'requested'); return '<tr><td>' + esc(r.number) + ' ' + A.sampleTag(r) + '<br><small class="muted">' + A.since(r.createdAt) + '</small></td><td>' + esc(A.objL(r.objective)) + '</td><td>' + A.date(r.start) + ' – ' + A.date(r.end) + '</td><td>' + ls.map(l => esc(A.oppTitle(Store.opp(l.oppId))) + ' ' + A.statusBadge('line', l.status)).join('<br>') + '</td><td>' + A.statusBadge('rfq', r.status) + '</td><td><a class="btn ' + (pending ? 'btn-blue' : 'btn-light') + ' btn-xs" href="#s-respond-' + r.id + '">' + (pending ? t('s.respond') : t('open')) + '</a></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="panel">' + A.empty('inbox', t('s.noRfqs'), t('s.noRfqsText')) + '</div>');
  };

  function offerForm(r, l, op, prev) {
    const req = l.requested || {}; const cov = req.coverage || {}; const pr = req.price || {};
    const dates = cov.coveredDates || [];
    const v = prev || { basePrice: pr.base, setupFee: pr.setup || 0, units: cov.purchasedUnits || 1, from: dates[0] || r.start, to: dates[dates.length - 1] || r.end, reporting: r.reporting, terms: 'split', validUntil: Dt.addDays(A.today(), 14), deliverables: [], vatRegistered: me().vatRegistered !== false, notes: '' };
    const k = l.id;
    return '<form class="panel" data-form="respond" data-rfq="' + r.id + '" data-line="' + l.id + '" novalidate><div class="panel-head"><div><h2>' + esc(A.oppTitle(op)) + '</h2><p>' + t('s.requested3', { units: A.num(cov.purchasedUnits || 0), unit: t('uw.' + op.unit), dates: dates.length, est: A.priceText(pr) }) + '</p></div>' + (prev ? A.badge('warn', t('s.revising', { v: prev.version })) : '') + '</div>' +
      (prev && l.status === 'accepted' ? '<div class="notice warn">' + ic('alert') + '<div>' + t('s.reviseWarn') + '</div></div>' : '') +
      errBox('respond:' + l.id) +
      (prev ? '' : '<fieldset class="seg" role="radiogroup" aria-label="' + esc(t('s.decision')) + '"><label><input type="radio" name="decision" value="offer" checked><span>' + t('s.offer') + '</span></label><label><input type="radio" name="decision" value="decline"><span>' + t('s.decline') + '</span></label></fieldset>') +
      '<div class="form-grid-3">' +
      '<div class="field"><label for="rb-' + k + '">' + t('off.base3') + '</label><input class="input" id="rb-' + k + '" name="basePrice" inputmode="decimal" value="' + esc(dec(v.basePrice)) + '"><span class="hint">' + t('off.baseHint') + '</span></div>' +
      '<div class="field"><label for="rs-' + k + '">' + t('off.setup3') + '</label><input class="input" id="rs-' + k + '" name="setupFee" inputmode="decimal" value="' + esc(dec(v.setupFee)) + '"></div>' +
      '<div class="field"><label for="ru-' + k + '">' + t('off.units', { unit: t('uw.' + op.unit) }) + '</label><input class="input" id="ru-' + k + '" name="units" type="number" min="1" value="' + esc(v.units) + '"></div>' +
      '<div class="field"><label for="rf-' + k + '">' + t('s.l.from') + '</label><input class="input" id="rf-' + k + '" name="from" type="date" value="' + esc(v.from) + '"></div>' +
      '<div class="field"><label for="rt-' + k + '">' + t('s.l.to') + '</label><input class="input" id="rt-' + k + '" name="to" type="date" value="' + esc(v.to) + '"></div>' +
      '<div class="field"><label for="rv-' + k + '">' + t('off.valid') + '</label><input class="input" id="rv-' + k + '" name="validUntil" type="date" min="' + A.today() + '" value="' + esc(v.validUntil) + '"></div>' +
      '<div class="field"><label for="rr-' + k + '">' + t('off.reporting') + '</label><select class="select" id="rr-' + k + '" name="reporting">' + ['basic', 'detailed', 'none'].map(x => opt(x, t('rep.' + x), v.reporting)).join('') + '</select></div>' +
      '<div class="field"><label for="rp-' + k + '">' + t('off.terms') + '</label><select class="select" id="rp-' + k + '" name="terms">' + ['full', 'split'].map(x => opt(x, t('terms.' + x), v.terms)).join('') + '</select></div>' +
      '<div class="field"><label for="rd-' + k + '">' + t('s.declineReason') + '</label><input class="input" id="rd-' + k + '" name="reason" maxlength="200" placeholder="' + esc(t('s.declinePh')) + '"></div>' +
      '<div class="field" style="grid-column:1/-1"><label for="rn-' + k + '">' + t('s.deliverables3') + ' <span class="req" aria-hidden="true">*</span></label><textarea class="textarea" id="rn-' + k + '" name="deliverables" maxlength="800" placeholder="' + esc(t('s.deliverablesPh')) + '">' + esc((v.deliverables || []).join('\n')) + '</textarea>' + ((l.requiredDeliverables || []).length ? '<span class="hint">' + t('s.reqDeliverables', { list: l.requiredDeliverables.join(', ') }) + '</span>' : '') + '</div>' +
      '<label class="check" style="grid-column:1/-1"><input type="checkbox" name="vatRegistered"' + (v.vatRegistered ? ' checked' : '') + '><span>' + t('s.vatReg', { pct: A.vatPct() }) + '</span></label>' +
      '</div><p class="error-text" data-error role="alert" hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('send') + (prev ? t('s.sendRevision') : t('s.sendReply')) + '</button>' + (prev ? '<button class="btn btn-ghost btn-sm" type="button" data-act="revise-cancel" data-line="' + l.id + '">' + t('cancel') + '</button>' : '') + '<span class="muted small">' + t('s.feeNote3', { fee: A.feePct() }) + '</span></div></form>';
  }

  V.s.respond = function (id) {
    const r = Store.rfq(id); if (!r) return A.notFound();
    const ls = myLines(r);
    const back = { href: '#s-rfqs', label: t('nav.s.rfqs') };
    if (!ls.length) return A.supplierSwitch() + A.head(r.number, '', '', back) + '<div class="panel">' + A.empty('inbox', t('s.notYours'), t('s.notYoursText')) + '</div>';
    const deadlinePassed = r.responseDeadline && A.today() > r.responseDeadline;
    return A.supplierSwitch() + A.head(r.number, t('s.respond.sub'), '', back) +
      (deadlinePassed ? '<div class="notice bad">' + ic('clock') + '<div>' + t('s.deadlinePassed', { d: A.date(r.responseDeadline) }) + '</div></div>' : '') +
      '<div class="doc"><div class="doc-head"><div><small>' + t('rfq.request') + '</small><h2>' + esc(A.objL(r.objective)) + (r.product ? ' · ' + esc(r.product) : '') + '</h2></div><div><small>' + t('rfq.deadline') + '</small><h2>' + (r.responseDeadline ? A.date(r.responseDeadline) : '—') + '</h2></div></div><div class="doc-body"><dl class="dl">' +
      '<dt>' + t('fld.audience') + '</dt><dd>' + esc(A.audienceText(Object.assign({}, r.audience))) + ' · ' + t('req.' + ((r.requirementsPolicy || {}).audience || 'preferred')) + '</dd>' +
      '<dt>' + t('fld.areas') + '</dt><dd>' + esc(A.areasL(r.areas)) + ' · ' + t('req.' + ((r.requirementsPolicy || {}).areas || 'preferred')) + '</dd>' +
      '<dt>' + t('fld.dates') + '</dt><dd>' + A.date(r.start) + ' – ' + A.date(r.end) + ' (' + t('days', { n: r.duration }) + ')</dd>' +
      '<dt>' + t('fld.category') + '</dt><dd>' + (r.productCategory ? esc(A.catL(r.productCategory)) : t('fld.categoryNone')) + '</dd>' +
      '<dt>' + t('fld.needs') + '</dt><dd>' + (E.FACILITIES.filter(k => r.needs && r.needs[k]).map(A.facL).join(', ') || t('none')) + '</dd>' +
      '<dt>' + t('fld.budget') + '</dt><dd>' + (r.shareBudget === false ? t('rfq.budgetHidden') : A.money(r.budgetMinor) + ' ' + t('rfq.budgetTotal')) + '</dd>' +
      '<dt>' + t('fld.success') + '</dt><dd>' + esc(r.success || '—') + '</dd>' +
      '<dt>' + t('rfq.reporting') + '</dt><dd>' + t('rep.' + r.reporting) + '</dd>' +
      '<dt>' + t('rfq.deliverables') + '</dt><dd>' + ((r.requiredDeliverables || []).map(esc).join('<br>') || '—') + '</dd>' +
      '<dt>' + t('rfq.special') + '</dt><dd>' + esc(r.requirements || '—') + '</dd></dl></div></div>' +
      ls.map(l => {
        const op = Store.opp(l.oppId); const v = Of.current(l);
        if (l.status === 'requested') return deadlinePassed ? '<section class="panel"><h2>' + esc(A.oppTitle(op)) + '</h2><p class="muted">' + t('s.closedNote') + '</p></section>' : offerForm(r, l, op, null);
        if (A.ui.offerForm[l.id] && v && ['offered', 'accepted'].includes(l.status)) return offerForm(r, l, op, v);
        const mny = v ? Of.money(v) : null;
        return '<section class="panel"><div class="panel-head"><div><h2>' + esc(A.oppTitle(op)) + '</h2><p>' + (v ? t('s.yourReply3', { v: v.version, at: A.dateTime(v.at) }) : '') + '</p></div>' + A.statusBadge('line', l.status) + '</div>' +
          errBox('respond:' + l.id) +
          (v ? '<div class="brief-sum">' + A.fact(t('off.base'), A.money(v.basePrice)) + A.fact(t('off.setup'), A.money(v.setupFee)) + A.fact(t('s.youReceive'), A.money(mny.net), t('s.feeNote3', { fee: A.feePct() })) + A.fact(t('off.dates'), A.date(v.dates[0]) + ' – ' + A.date(v.dates[v.dates.length - 1]), t('co.datesN', { n: v.dates.length })) + A.fact(t('off.reporting'), t('rep.' + v.reporting)) + A.fact(t('off.valid'), A.date(v.validUntil)) + '</div>' +
            (v.deviations.length ? '<div class="notice warn">' + ic('alert') + '<div><b>' + t('s.devTitle') + '</b><ul class="plain">' + v.deviations.map(d => '<li>' + esc(A.devText(d)) + '</li>').join('') + '</ul></div></div>' : '') +
            (l.offers.length > 1 ? '<details class="why"><summary>' + t('s.history', { n: l.offers.length }) + ic('chevron-down') + '</summary><div class="why-body"><ul class="plain">' + l.offers.map(x => '<li>v' + x.version + ' · ' + A.dateTime(x.at) + ' · ' + A.money(x.basePrice + x.setupFee) + ' · ' + t('co.datesN', { n: x.dates.length }) + '</li>').join('') + '</ul></div></details>' : '') : '<p>' + esc(l.declineReason || t('line.' + l.status)) + '</p>') +
          (l.status === 'accepted' ? '<div class="notice ok">' + ic('check-circle') + '<div>' + t('s.approvedNote3', { v: l.approval.version }) + '</div></div>' : '') +
          (l.status === 'booked' ? '<div class="notice ok">' + ic('check-circle') + '<div>' + t('s.bookedNote') + ' <a href="#s-bookings">' + t('nav.s.bookings') + '</a></div></div>' : '') +
          (['offered', 'accepted'].includes(l.status) && !deadlinePassed ? '<div class="form-actions"><button class="btn btn-light btn-sm" data-act="revise" data-line="' + l.id + '">' + ic('edit') + t('s.revise') + '</button>' + (A.ui.confirm === 'withdraw:' + l.id ? '<span class="small">' + t('s.withdrawQ') + '</span><button class="btn btn-danger btn-sm" data-act="withdraw" data-rfq="' + r.id + '" data-line="' + l.id + '">' + t('s.withdraw') + '</button><button class="btn btn-ghost btn-sm" data-act="confirm-cancel">' + t('cancel') + '</button>' : '<button class="btn btn-ghost btn-sm" data-act="confirm" data-key="withdraw:' + l.id + '">' + ic('x') + t('s.withdraw') + '</button>') + '</div>' : '') +
          '</section>';
      }).join('');
  };

  V.s.bookings = function () {
    const sup = me();
    const list = Store.state.bookings.filter(b => b.supplierId === sup.id);
    return A.supplierSwitch() + A.head(t('nav.s.bookings'), t('s.bookings.sub')) + (list.length ? A.bookingRows(list, 's') : '<div class="panel">' + A.empty('track', t('s.noBookings'), t('s.noBookingsText')) + '</div>');
  };

  V.s.booking = function (id) {
    const b = Store.booking(id); if (!b) return A.notFound();
    const mine = b.supplierId === Store.state.activeSupplierId;
    const p = Store.payment(b.paymentId); const po = Store.payout(b.payoutId);
    const next = { confirmed: 'prepare', preparing: 'go_live', live: 'complete' }[b.status];
    const paid = p && ['paid', 'partially_refunded'].includes(p.status);
    const blockReason = !paid ? t('s.waitPayment') : next === 'go_live' && A.today() < b.from ? t('s.goLiveFrom', { d: A.date(b.from) }) : '';
    const rows = (b.report && b.report.metrics.length ? b.report.metrics : [{ name: '', value: '', unit: '', method: 'counted', note: '' }]);
    const guards = CON.Domain.payoutGuards(Store.state, b.id, Store.ctx());
    return A.supplierSwitch() + A.head(b.number + ' · ' + (b.snapshot ? A.L(b.snapshot.title) : A.oppTitle(Store.opp(b.oppId))), t('s.booking.sub'), '', { href: '#s-bookings', label: t('nav.s.bookings') }) +
      (!mine ? '<div class="notice warn">' + ic('info') + '<div>' + t('s.otherSupplier', { name: esc(A.supName(b.supplierId)) }) + '</div></div>' : '') +
      errBox('bk:' + b.id) +
      '<section class="panel">' + A.timeline(b) + (next && mine ? '<div class="form-actions"><button class="btn btn-dark btn-sm" data-act="advance" data-id="' + b.id + '" data-ev="' + next + '"' + (blockReason ? ' disabled aria-describedby="adv-why"' : '') + '>' + ic('arrow') + t('s.markAs', { st: t('bk.' + { prepare: 'preparing', go_live: 'live', complete: 'completed' }[next]) }) + '</button>' + (blockReason ? '<span class="muted small" id="adv-why">' + blockReason + '</span>' : '') + '</div>' : '') + '</section>' +
      '<div class="brief-sum">' + A.fact(t('th.dates'), A.date(b.from) + ' – ' + A.date(b.to), t('co.datesN', { n: (b.dates || []).length })) + A.fact(t('s.youReceive'), A.money(b.money.net)) + A.fact(t('bk.payment'), p ? esc(t('pay.' + p.status)) : '—') + A.fact(t('bk.payout'), po ? esc(t('payout.' + po.status)) : '—') + A.fact(t('th.status'), esc(t('bk.' + b.status))) + A.fact(t('s.buyer'), esc((p && p.billing.company) || Store.state.company)) + '</div>' +
      '<section class="panel tight"><div class="panel-head"><div><h2>' + t('guard.title') + '</h2><p>' + t('guard.sub') + '</p></div></div><ul class="checks">' + guards.map(g => '<li class="ck ' + (g.ok ? 'pass' : 'fail') + '">' + ic(g.ok ? 'check' : 'clock') + '<span>' + t('guard.' + g.guard) + '</span></li>').join('') + '</ul></section>' +
      A.snapshotHtml(b) +
      (mine && ['live', 'completed'].includes(b.status) ? '<form class="panel" data-form="report" data-id="' + b.id + '" novalidate><div class="panel-head"><div><h2>' + t('rep.title') + '</h2><p>' + t('s.report.sub') + '</p></div></div><div class="metric-rows" data-metric-rows>' +
        rows.map((m, i) => '<div class="metric-row"><div class="field"><label for="mn' + i + '">' + t('rep.metric') + '</label><input class="input" id="mn' + i + '" name="name" maxlength="60" value="' + esc(A.term(m.name)) + '" placeholder="' + esc(t('s.metricPh')) + '"></div><div class="field"><label for="mv' + i + '">' + t('rep.value') + '</label><input class="input" id="mv' + i + '" name="value" type="number" min="0" value="' + esc(m.value) + '"></div><div class="field"><label for="mu' + i + '">' + t('rep.unit') + '</label><input class="input" id="mu' + i + '" name="unit" maxlength="30" value="' + esc(A.term(m.unit)) + '"></div><div class="field"><label for="mm' + i + '">' + t('rep.method') + '</label><select class="select" id="mm' + i + '" name="method">' + ['counted', 'system', 'estimated'].map(k => opt(k, t('meth.' + k), m.method)).join('') + '</select></div><button class="icon-btn" type="button" data-act="metric-remove" aria-label="' + esc(t('remove')) + '">' + ic('x') + '</button></div>').join('') +
        '</div><div class="form-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="metric-add">' + ic('plus') + t('s.addMetric') + '</button></div><p class="src">' + t('s.report.note') + '</p><p class="error-text" data-error role="alert" hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('send') + (b.report ? t('s.updateReport') : t('s.submitReport')) + '</button></div></form>' : '<section class="panel"><h2>' + t('rep.title') + '</h2>' + A.reportHtml(b) + '</section>');
  };

  V.s.profile = function () {
    const sup = me();
    const v = sup.verification || { status: 'not_submitted', documents: [], decisions: [] };
    const pick = A.ui.docPick;
    return A.supplierSwitch() + A.head(t('nav.s.profile'), t('s.profile.sub')) +
      errBox('profile') +
      '<form class="panel" data-form="profile" data-id="' + sup.id + '" novalidate><div class="panel-head"><h2>' + t('s.p.business') + '</h2>' + A.verifiedBadge(sup) + '</div>' +
      '<div class="form-grid"><div class="field"><label for="p-name">' + t('s.p.nameEn') + '</label><input class="input" id="p-name" name="name" required maxlength="100" value="' + esc(sup.name.en || '') + '"></div>' +
      '<div class="field"><label for="p-name-ar">' + t('s.p.nameAr') + '</label><input class="input" id="p-name-ar" name="nameAr" lang="ar" dir="rtl" maxlength="100" value="' + esc(sup.name.ar || '') + '"></div>' +
      '<div class="field"><label for="p-lic">' + t('s.p.licence') + '</label><input class="input" id="p-lic" name="licence" required maxlength="30" value="' + esc(sup.licenceNumber || '') + '"><span class="hint">' + t('s.p.licenceHint') + '</span></div>' +
      '<div class="field"><label for="p-em">' + t('s.p.emirate') + '</label><select class="select" id="p-em" name="emirate">' + ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].map(e => '<option value="' + e + '"' + (sup.emirate === e ? ' selected' : '') + '>' + esc(t('em.' + e)) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="p-cat">' + t('s.p.category') + '</label><select class="select" id="p-cat" name="category">' + D.types.map(ty => '<option value="' + ty + '"' + (sup.category === ty ? ' selected' : '') + '>' + esc(A.typeL(ty)) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="p-contact">' + t('s.p.contact') + '</label><input class="input" id="p-contact" name="contact" type="email" required maxlength="120" value="' + esc(sup.contact || '') + '"></div>' +
      '<label class="check span-2"><input type="checkbox" name="vatRegistered"' + (sup.vatRegistered !== false ? ' checked' : '') + '><span>' + t('s.vatReg', { pct: A.vatPct() }) + '</span></label></div>' +
      '<p class="error-text" data-error role="alert" hidden></p><div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('check') + t('save') + '</button><span class="muted small">' + t('s.p.reviewReset') + '</span></div></form>' +
      '<section class="panel"><div class="panel-head"><div><h2>' + t('s.v.title') + '</h2><p>' + t('s.v.sub') + '</p></div>' + A.verifiedBadge(sup) + '</div>' +
      (v.legacyNote ? '<div class="notice warn">' + ic('alert') + '<div>' + t('s.v.legacy', { name: esc(v.legacyNote.replace(/^filename-only:/, '')) }) + '</div></div>' : '') +
      (v.licenceExpiry ? '<p class="small">' + t('s.v.expiry', { d: A.date(v.licenceExpiry) }) + '</p>' : '') +
      ((v.documents || []).length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('s.v.doc') + '</th><th scope="col">' + t('s.v.storage') + '</th><th scope="col">' + t('s.v.uploaded') + '</th></tr></thead><tbody>' + v.documents.map(d => '<tr><td>' + esc(d.fileName) + ' <small class="muted">(' + Math.round((d.size || 0) / 1024) + ' KB)</small></td><td>' + A.badge(d.storage === 'demo-sample' ? 'info' : d.storage === 'server' ? 'ok' : 'warn', t('stor.' + d.storage)) + '</td><td>' + A.dateTime(d.uploadedAt) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">' + t('s.v.noDocs') + '</p>') +
      ((v.decisions || []).length ? '<details class="why"><summary>' + t('s.v.history') + ic('chevron-down') + '</summary><div class="why-body"><ul class="plain">' + v.decisions.map(d => '<li>' + A.dateTime(d.at) + ' · ' + esc(t('vd.' + d.decision)) + (d.reason ? ' · ' + esc(d.reason) : '') + (d.simulated ? ' · ' + t('simulated') : '') + '</li>').join('') + '</ul></div></details>' : '') +
      (v.status !== 'licence_reviewed' ? '<form data-form="verify-submit" data-id="' + sup.id + '" novalidate><div class="form-grid"><div class="field span-2"><label for="p-doc">' + t('s.p.doc3') + '</label><input class="input" id="p-doc" name="doc" type="file" accept="application/pdf,image/jpeg,image/png" data-doc-pick style="padding-top:10px" aria-describedby="p-doc-hint"><span class="hint" id="p-doc-hint">' + (pick ? t('s.p.docPicked', { name: esc(pick.fileName), kb: Math.round(pick.size / 1024) }) : t('s.p.docHint3')) + '</span></div></div>' +
        '<div class="notice">' + ic('info') + '<div>' + t('s.p.demoUpload') + '</div></div>' +
        '<p class="error-text" data-error role="alert" hidden></p><div class="form-actions"><button class="btn btn-blue btn-sm" type="submit" name="intent" value="file"' + (pick ? '' : ' disabled') + '>' + ic('upload') + t('s.p.submitFile') + '</button><button class="btn btn-light btn-sm" type="submit" name="intent" value="sample">' + ic('file') + t('s.p.useSample') + '</button></div></form>' : '') +
      '</section>';
  };
})();
