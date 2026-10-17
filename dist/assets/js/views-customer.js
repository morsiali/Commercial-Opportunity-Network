/* Platform: brand / customer workspace views (v3) */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App, E = CON.Engine, D = CON.DATA, Store = CON.Store, M = CON.Money, Dt = CON.Dates, Of = CON.Offers, Dm = CON.Domain;
  const t = A.t, esc = A.esc, ic = A.ic;
  const V = A.views = A.views || {};
  V.c = {};
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
  const errBox = key => A.ui.errors[key] ? A.errHtml(A.ui.errors[key]) : '';

  function offersToReview(r) { return r.lines.filter(l => l.status === 'offered').length; }

  /* ---------- Overview ---------- */
  V.c.overview = function () {
    const s = Store.state;
    const openRfqs = s.rfqs.filter(r => ['open', 'partially_awarded'].includes(r.status));
    const toReview = openRfqs.reduce((a, r) => a + offersToReview(r), 0);
    const committed = s.payments.filter(p => ['paid', 'partially_refunded'].includes(p.status)).reduce((a, p) => a + p.amount.total - (p.refunded || 0), 0);
    const todos = [];
    openRfqs.forEach(r => {
      const n = offersToReview(r); const wait = r.lines.filter(l => l.status === 'requested').length;
      if (n) todos.push({ icon: 'compare', text: t('todo.offers', { n, rfq: r.number }), href: '#c-offers-' + r.id, cta: t('todo.compare') });
      else if (wait) todos.push({ icon: 'clock', text: t('todo.waiting', { n: wait, rfq: r.number }), href: '#c-offers-' + r.id, cta: t('open') });
      if (r.lines.some(l => l.status === 'accepted')) todos.push({ icon: 'card', text: t('todo.checkout', { rfq: r.number }), href: '#c-checkout-' + r.id, cta: t('off.checkout') });
    });
    s.payments.filter(p => p.status === 'awaiting').forEach(p => todos.push({ icon: 'clock', text: t('todo.payment', { num: p.number, d: A.dateTime(p.expiresAt) }), href: '#c-payment-' + p.id, cta: t('open') }));
    s.bookings.filter(b => b.status === 'completed').forEach(b => todos.push({ icon: 'check-circle', text: t('todo.confirm', { bk: b.number }), href: '#c-booking-' + b.id, cta: t('open') }));
    s.bookings.filter(b => b.status === 'delivery_accepted' && !b.outcome).forEach(b => todos.push({ icon: 'chart', text: t('todo.outcome', { bk: b.number }), href: '#c-booking-' + b.id, cta: t('open') }));
    s.objectives.filter(o => !o.planViewed).forEach(o => todos.push({ icon: 'layers', text: t('todo.plan', { name: o.name }), href: '#c-plan-' + o.id, cta: t('open') }));
    if (!todos.length) todos.push({ icon: 'target', text: t('todo.new'), href: '#c-new', cta: t('c.newObjective') });
    const drafts = Store.draft.keys().length;
    return A.head(t('c.overview.title'), t('c.overview.sub', { company: esc(s.company) }), '<a class="btn btn-dark" href="#c-new">' + ic('plus') + '<span>' + t('c.newObjective') + '</span></a>') +
      (s.migratedNotice ? '<div class="notice">' + ic('info') + '<div><b>' + t('mig.title') + '</b> ' + t('mig.text', { n: (s.migratedFrom && s.migratedFrom.notes.length) || 0 }) + ' <button class="link-btn" data-act="mig-dismiss">' + t('dismiss') + '</button></div></div>' : '') +
      '<div class="kpis">' +
      A.kpi('target', t('k.objectives'), A.num(s.objectives.length), drafts ? t('k.drafts', { n: drafts }) : '') +
      A.kpi('file', t('k.openRfqs'), A.num(openRfqs.length)) +
      A.kpi('compare', t('k.toReview'), A.num(toReview)) +
      A.kpi('wallet', t('k.booked'), A.money(committed), t('k.bookedNote')) +
      '</div>' +
      '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h2>' + t('c.next') + '</h2></div><div class="rows">' + todos.slice(0, 7).map(x => '<div class="row"><span class="row-ico">' + ic(x.icon) + '</span><span class="grow"><b>' + esc(x.text) + '</b></span><a class="btn btn-light btn-xs" href="' + x.href + '">' + esc(x.cta) + '</a></div>').join('') + '</div></section>' +
      '<section class="panel"><div class="panel-head"><h2>' + t('c.recent') + '</h2><a class="btn btn-ghost btn-xs" href="#c-plans">' + t('viewAll') + '</a></div><div class="rows">' +
      (s.objectives.slice(0, 5).map(o => '<div class="row"><span class="row-ico">' + ic('target') + '</span><span class="grow"><b>' + esc(o.name) + ' ' + A.sampleTag(o) + '</b><small>' + esc(A.objL(o.objective)) + ' · ' + A.money(o.budgetMinor) + ' · ' + A.date(o.start) + '</small></span><a class="btn btn-light btn-xs" href="#c-plan-' + o.id + '">' + t('c.openPlan') + '</a></div>').join('') || A.empty('target', t('c.noObjectives'), t('c.noObjectivesText'))) +
      '</div></section></div>' +
      '<section class="panel soft"><div class="panel-head"><div><h2>' + t('c.journey') + '</h2><p>' + t('c.journeySub') + '</p></div></div><ol class="chips journey">' +
      ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9', 'j10', 'j11', 'j12'].map((k, i) => '<li class="tag">' + (i + 1) + ' · ' + t(k) + '</li>').join('') + '</ol></section>';
  };

  /* ---------- New / edit objective (drafts are kept per form, in this browser) ---------- */
  const DEF = () => ({ name: '', objective: 'trial', product: '', productCategory: '', success: '', target: '', gender: 'all', ageMin: '25', ageMax: '45', interests: [], areas: ['all'], budget: '100000', start: Dt.addDays(A.today(), 21), duration: '30', reqAudience: 'preferred', reqAreas: 'preferred', reqCoverage: 'partial_ok', verifiedOnly: false, needs: [], budgetConfirm: false });
  function valuesFromObjective(o) {
    return { name: o.name || '', objective: o.objective, product: o.product || '', productCategory: o.productCategory || '', success: o.success || '', target: o.target ? String(o.target) : '', gender: o.gender, ageMin: String(o.ageMin), ageMax: String(o.ageMax), interests: (o.interests || []).slice(), areas: (o.areas || ['all']).slice(), budget: M.toDecimalString(o.budgetMinor).replace(/\.00$/, ''), start: o.start, duration: String(o.duration),
      reqAudience: o.requirements.audience, reqAreas: o.requirements.areas, reqCoverage: o.requirements.coverage, verifiedOnly: !!o.requirements.verifiedOnly, needs: Object.keys(o.needs || {}).filter(k => o.needs[k]), budgetConfirm: false };
  }
  A.objDraftKey = id => 'obj.' + (id || 'new');
  A.objFormState = function (id) {
    const editing = id ? Store.objective(id) : null;
    const draft = Store.draft.get(A.objDraftKey(id));
    const base = editing ? valuesFromObjective(editing) : DEF();
    const values = Object.assign({}, base, draft && draft.values || {});
    return { editing, draft, values, origin: (draft && draft.origin) || {}, sentence: draft ? draft.sentence || '' : (editing && editing.sentence) || '', extraction: draft && draft.extraction || null };
  };
  /* Rows for the merge preview: what the sentence proposes versus what the form holds. */
  A.mergeRows = function (fs) {
    const ex = fs.extraction; if (!ex) return [];
    const F = ex.fields || {};
    const v = fs.values;
    const rows = [];
    const typed = k => fs.origin[k] === 'typed';
    const statusOf = key => { const f = (ex.found || []).filter(x => x.key === key); return f.length ? f[f.length - 1] : null; };
    const add = (key, field, proposed, display, cur, curDisplay, status, note, extra) => {
      const applicable = ['recognized', 'derived', 'review', 'confirm'].includes(status) && proposed != null;
      const same = JSON.stringify(cur) === JSON.stringify(proposed);
      rows.push(Object.assign({ key, field, proposed, display, cur, curDisplay, status, note, applicable, same, checked: applicable && !same && (status === 'recognized' || status === 'derived') && !typed(field) }, extra || {}));
    };
    const st = k => statusOf(k) || {};
    if (st('objective').key) add('objective', 'objective', F.objective, A.objL(F.objective), v.objective, A.objL(v.objective), st('objective').status, st('objective').note);
    if (st('target').key) add('target', 'target', F.target != null ? String(F.target) : null, F.target != null ? A.num(F.target) : '—', v.target, v.target || '—', st('target').status, st('target').note, { candidates: st('target').candidates });
    if (st('gender').key) add('gender', 'gender', F.gender, t('g.' + F.gender), v.gender, t('g.' + v.gender), st('gender').status, st('gender').note);
    if (st('age').key) add('age', 'age', F.ageMin != null ? [String(F.ageMin), String(F.ageMax)] : null, F.ageMin != null ? F.ageMin + '–' + F.ageMax : '—', [v.ageMin, v.ageMax], v.ageMin + '–' + v.ageMax, st('age').status, st('age').note);
    if (st('areas').key) add('areas', 'areas', F.areas, A.areasL(F.areas), v.areas, A.areasL(v.areas), st('areas').status, st('areas').note);
    (ex.found || []).filter(x => x.key === 'budget').forEach(b => {
      const dec = b.value != null ? M.toDecimalString(b.value).replace(/\.00$/, '') : null;
      add('budget', 'budget', dec, b.value != null ? A.money(b.value) : esc(b.raw || ''), v.budget, v.budget ? 'AED ' + v.budget : '—', b.status, b.note, { raw: b.raw, candidates: b.candidates ? b.candidates.map(A.money) : null });
    });
    if (F.start || st('start').key) add('start', 'start', F.start || null, F.start ? A.date(F.start) : '—', v.start, A.date(v.start), st('start').status || 'derived', st('start').note);
    if (st('end').key) rows.push({ key: 'end', field: null, proposed: F.end, display: F.end ? A.date(F.end) : esc(st('end').raw || ''), cur: null, curDisplay: '—', status: st('end').status, note: st('end').note, applicable: false, info: true });
    (ex.found || []).filter(x => x.key === 'duration').forEach(d => add('duration', 'duration', d.value != null ? String(d.value) : null, d.value != null ? t('days', { n: d.value }) : '—', v.duration, t('days', { n: v.duration }), d.status, d.note, { candidates: d.candidates }));
    (ex.found || []).filter(x => x.key === 'date').forEach(d => rows.push({ key: 'date', field: null, display: esc(d.raw || ''), status: d.status, note: d.note, applicable: false, info: true }));
    const rq = ex.requirements || {};
    if (rq.audience === 'required') add('reqAudience', 'reqAudience', 'required', t('req.required'), v.reqAudience, t('req.' + v.reqAudience), 'recognized', 'strict-word');
    if (rq.areas === 'required') add('reqAreas', 'reqAreas', 'required', t('req.required'), v.reqAreas, t('req.' + v.reqAreas), 'recognized', 'strict-word');
    return rows;
  };

  V.c.new = function (id) {
    const fs = A.objFormState(id);
    const editing = fs.editing;
    if (id && !editing) return A.notFound();
    const v = fs.values;
    const today = A.today();
    const draftNote = fs.draft ? '<div class="notice" data-draft-notice>' + ic('file') + '<div>' + t('draft.restored', { d: A.dateTime(fs.draft.savedAt) }) + ' <button class="link-btn" type="button" data-act="draft-discard" data-key="' + A.objDraftKey(id) + '">' + t('draft.discard') + '</button></div></div>' : '';
    const rows = A.mergeRows(fs);
    const ex = fs.extraction;
    const objCards = D.objectives.map(k => '<label class="obj"><input type="radio" name="objective" value="' + k + '"' + (v.objective === k ? ' checked' : '') + '><span>' + ic({ trial: 'gift', acquisition: 'users', launch: 'bolt', footfall: 'store', leads: 'inbox', awareness: 'megaphone' }[k]) + '<b>' + esc(A.objL(k)) + '</b></span></label>').join('');
    const chips = (name, list, sel, labelFn, type) => '<div class="chip-group" role="group">' + list.map(x => '<label class="chip"><input type="' + (type || 'checkbox') + '" name="' + name + '" value="' + x + '"' + (sel.includes(x) ? ' checked' : '') + '><span>' + esc(labelFn(x)) + '</span></label>').join('') + '</div>';
    const origin = k => fs.origin[k] === 'sentence' ? ' <span class="tag src-tag">' + t('orig.sentence') + '</span>' : fs.origin[k] === 'typed' ? '' : (!editing ? ' <span class="tag def-tag">' + t('orig.default') + '</span>' : '');
    const req = ' <span class="req" aria-hidden="true">*</span>';
    const reqToggle = (name, cur) => '<div class="seg" role="radiogroup" aria-label="' + esc(t('req.label')) + '">' + ['required', 'preferred'].map(x => '<label><input type="radio" name="' + name + '" value="' + x + '"' + (cur === x ? ' checked' : '') + '><span>' + t('req.' + x) + '</span></label>').join('') + '</div>';
    const budgetMinor = (() => { try { return M.fromAED(String(v.budget || '').replace(/,/g, '')); } catch (e) { return null; } })();
    const budgetOut = budgetMinor != null && (budgetMinor < CON.Parse.LIMITS.budgetMinFils || budgetMinor > CON.Parse.LIMITS.budgetMaxFils);
    const merge = ex ? '<section class="panel merge" aria-labelledby="merge-h"><div class="panel-head"><div><h2 id="merge-h">' + t('merge.title') + '</h2><p>' + t('merge.sub') + '</p></div></div>' +
      (rows.length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('merge.apply') + '</th><th scope="col">' + t('merge.field') + '</th><th scope="col">' + t('merge.now') + '</th><th scope="col">' + t('merge.proposed') + '</th><th scope="col">' + t('merge.status') + '</th></tr></thead><tbody>' +
        rows.map((r, i) => '<tr class="' + (r.same ? 'same' : '') + '"><td>' + (r.applicable && !r.same ? '<input type="checkbox" form="merge-form" name="apply" value="' + i + '" id="mg-' + i + '"' + (r.checked ? ' checked' : '') + ' aria-label="' + esc(t('merge.applyField', { f: t('x.' + r.key) })) + '">' : (r.same ? ic('check') : '—')) + '</td><td><label for="mg-' + i + '">' + esc(t('x.' + r.key)) + '</label></td><td>' + esc(r.curDisplay == null ? '—' : r.curDisplay) + '</td><td>' + r.display + (r.raw ? ' <q>' + esc(r.raw) + '</q>' : '') + (r.candidates ? '<br><small class="muted">' + t('merge.candidates') + ': ' + esc(r.candidates.join(', ')) + '</small>' : '') + '</td><td>' + A.badge(r.status === 'recognized' || r.status === 'derived' ? 'ok' : r.status === 'review' ? 'info' : r.status === 'confirm' ? 'warn' : 'bad', t('xs.' + r.status)) + (r.note ? '<br><small class="muted">' + esc(t('xn.' + r.note)) + '</small>' : '') + (r.same ? '<br><small class="muted">' + t('merge.same') + '</small>' : (fs.origin[r.field] === 'typed' && r.applicable ? '<br><small class="muted">' + t('merge.typed') + '</small>' : '')) + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p>' + t('c.extract.none') + '</p>') +
      ((ex.excluded && ex.excluded.objectives && ex.excluded.objectives.length) ? '<p class="small"><b>' + t('merge.excluded') + ':</b> ' + ex.excluded.objectives.map(A.objL).map(esc).join(', ') + '</p>' : '') +
      '<p class="src">' + t('c.extract.note', { tz: 'Asia/Dubai', d: A.date(ex.today) }) + '</p>' +
      '<form id="merge-form" data-form="merge" data-key="' + A.objDraftKey(id) + '" class="form-actions" novalidate>' + (rows.some(r => r.applicable && !r.same) ? '<button class="btn btn-dark btn-sm" type="submit">' + ic('check') + t('merge.applyBtn') + '</button>' : '') + '<button class="btn btn-ghost btn-sm" type="button" data-act="merge-dismiss" data-key="' + A.objDraftKey(id) + '">' + t('dismiss') + '</button></form></section>' : '';

    return A.head(editing ? t('c.edit.title') : t('c.new.title'), t('c.new.sub'), '', { href: editing ? '#c-plan-' + editing.id : '#c-plans', label: editing ? t('c.backPlan') : t('nav.c.plans') }) +
      draftNote +
      '<section class="panel soft"><div class="panel-head"><div><h2>' + t('c.sentence.title') + '</h2><p>' + t('c.sentence.sub') + '</p></div></div>' +
      '<form data-form="extract" data-key="' + A.objDraftKey(id) + '" data-obj="' + (editing ? editing.id : '') + '" class="form-actions" novalidate style="align-items:stretch"><div class="field" style="flex:1;min-width:240px"><label class="sr-only" for="f-sentence">' + t('c.sentence.title') + '</label><textarea class="textarea" id="f-sentence" name="sentence" maxlength="400" data-draft="' + A.objDraftKey(id) + '" placeholder="' + esc(t('c.sentence.ph')) + '">' + esc(fs.sentence) + '</textarea></div><div style="display:grid;align-content:end"><button class="btn btn-dark" type="submit">' + ic('file') + '<span>' + t('c.sentence.btn') + '</span></button></div></form>' +
      '<p class="muted small">' + t('c.sentence.keeps') + '</p></section>' +
      merge +
      '<form class="panel" data-form="objective" data-id="' + (editing ? editing.id : '') + '" data-draft="' + A.objDraftKey(id) + '" novalidate aria-describedby="obj-err">' +
      '<div class="form-grid">' +
      '<div class="field span-2"><label for="f-name">' + t('fld.name') + req + origin('name') + '</label><input class="input" id="f-name" name="name" maxlength="80" required value="' + esc(v.name) + '" placeholder="' + esc(t('fld.namePh')) + '"></div>' +
      '<fieldset class="field span-2"><legend class="label">1 · ' + t('q.achieve') + origin('objective') + '</legend><div class="objective-grid">' + objCards + '</div></fieldset>' +
      '<div class="field"><label for="f-product">2 · ' + t('q.product') + '</label><input class="input" id="f-product" name="product" maxlength="80" value="' + esc(v.product) + '" placeholder="' + esc(t('fld.productPh')) + '"></div>' +
      '<div class="field"><label for="f-cat">' + t('fld.category') + '</label><select class="select" id="f-cat" name="productCategory">' + opt('', t('fld.categoryNone'), v.productCategory) + E.CATEGORIES.map(c => opt(c, A.catL(c), v.productCategory)).join('') + '</select><span class="hint">' + t('fld.categoryHint') + '</span></div>' +
      '<div class="field"><label for="f-success">3 · ' + t('q.success') + '</label><input class="input" id="f-success" name="success" maxlength="160" value="' + esc(v.success) + '" placeholder="' + esc(t('fld.successPh')) + '"></div>' +
      '<div class="field"><label for="f-target">' + t('fld.target') + origin('target') + '</label><input class="input" id="f-target" name="target" inputmode="numeric" value="' + esc(v.target) + '" placeholder="5000"><span class="hint">' + t('fld.targetHint') + '</span></div>' +
      '<fieldset class="field span-2"><legend class="label">4 · ' + t('q.who') + origin('gender') + '</legend>' + chips('gender', ['all', 'female', 'male'], [v.gender], x => t('g.' + x), 'radio') + '</fieldset>' +
      '<div class="field"><label for="f-agemin">' + t('fld.ageMin') + origin('age') + '</label><input class="input" id="f-agemin" name="ageMin" type="number" min="13" max="99" value="' + esc(v.ageMin) + '"></div>' +
      '<div class="field"><label for="f-agemax">' + t('fld.ageMax') + '</label><input class="input" id="f-agemax" name="ageMax" type="number" min="13" max="99" value="' + esc(v.ageMax) + '"></div>' +
      '<fieldset class="field span-2"><legend class="label">' + t('req.audience') + '</legend>' + reqToggle('reqAudience', v.reqAudience) + '<span class="hint">' + t('req.audienceHint') + '</span></fieldset>' +
      '<fieldset class="field span-2"><legend class="label">' + t('fld.interests') + '</legend>' + chips('interests', D.interests, v.interests || [], A.intL) + '</fieldset>' +
      '<fieldset class="field span-2"><legend class="label">5 · ' + t('q.where') + origin('areas') + '</legend>' + chips('areas', ['all'].concat(Object.keys(D.areas)), v.areas, A.areaL) + '</fieldset>' +
      '<fieldset class="field span-2"><legend class="label">' + t('req.areas') + '</legend>' + reqToggle('reqAreas', v.reqAreas) + '<span class="hint">' + t('req.areasHint') + '</span></fieldset>' +
      '<div class="field"><label for="f-budget">6 · ' + t('q.budget') + req + origin('budget') + '</label><div class="input-wrap">' + ic('wallet') + '<input class="input" id="f-budget" name="budget" inputmode="decimal" required value="' + esc(v.budget) + '" aria-describedby="f-budget-hint"></div><span class="hint" id="f-budget-hint">' + t('fld.budgetHint3', { fee: A.feePct() }) + '</span>' +
      (budgetOut ? '<label class="check"><input type="checkbox" name="budgetConfirm"' + (v.budgetConfirm ? ' checked' : '') + '><span>' + t('fld.budgetConfirm', { v: A.money(budgetMinor) }) + '</span></label>' : '') + '</div>' +
      '<div class="field"><label for="f-start">7 · ' + t('q.start') + req + origin('start') + '</label><div class="input-wrap">' + ic('calendar') + '<input class="input" id="f-start" name="start" type="date" required min="' + today + '" value="' + esc(v.start) + '" aria-describedby="f-start-hint"></div><span class="hint" id="f-start-hint">' + t('fld.todayDubai', { d: A.date(today) }) + '</span></div>' +
      '<div class="field"><label for="f-duration">' + t('fld.duration') + req + origin('duration') + '</label><div class="input-wrap">' + ic('clock') + '<input class="input" id="f-duration" name="duration" type="number" min="1" max="365" required value="' + esc(v.duration) + '"></div><span class="hint">' + (Dt.isIso(v.start) && +v.duration > 0 ? t('fld.endsOn', { d: A.date(Dt.addDays(v.start, +v.duration - 1)) }) : '') + '</span></div>' +
      '<fieldset class="field span-2"><legend class="label">' + t('req.coverage') + '</legend><div class="seg" role="radiogroup">' + ['partial_ok', 'full'].map(x => '<label><input type="radio" name="reqCoverage" value="' + x + '"' + (v.reqCoverage === x ? ' checked' : '') + '><span>' + t('reqc.' + x) + '</span></label>').join('') + '</div></fieldset>' +
      '<fieldset class="field span-2"><legend class="label">' + t('fld.needs') + '</legend>' + chips('needs', E.FACILITIES, v.needs || [], A.facL) + '<span class="hint">' + t('fld.needsHint') + '</span></fieldset>' +
      '<label class="check span-2"><input type="checkbox" name="verifiedOnly"' + (v.verifiedOnly ? ' checked' : '') + '><span>' + t('fld.verifiedOnly') + '</span></label>' +
      '</div>' +
      '<p class="error-text" id="obj-err" data-error role="alert" hidden></p>' +
      '<div class="form-actions"><button class="btn btn-dark" type="submit">' + ic('layers') + '<span>' + (editing ? t('c.saveRegenerate') : t('c.generate')) + '</span></button><span class="muted small" data-save-status aria-live="polite">' + (fs.draft ? t('draft.savedAt', { d: A.dateTime(fs.draft.savedAt) }) : t('c.private')) + '</span></div>' +
      '</form>';
  };

  /* ---------- Plans list ---------- */
  V.c.plans = function () {
    const s = Store.state;
    const rows = s.objectives.map(o => {
      const rfqs = s.rfqs.filter(r => r.objectiveId === o.id);
      return '<tr><td><a href="#c-plan-' + o.id + '">' + esc(o.name) + '</a> ' + A.sampleTag(o) + '<br><small class="muted">' + esc(o.product || '—') + '</small></td><td>' + esc(A.objL(o.objective)) + '</td><td>' + esc(A.areasL(o.areas)) + '</td><td class="num">' + A.money(o.budgetMinor) + '</td><td>' + A.date(o.start) + ' · ' + t('days', { n: o.duration }) + '</td><td class="num">' + rfqs.length + '</td><td><div class="inline-confirm">' + (A.ui.confirm === 'obj:' + o.id ? '<span class="small">' + t('confirmDelete') + '</span><button class="btn btn-danger btn-xs" data-act="obj-delete" data-id="' + o.id + '">' + t('delete') + '</button><button class="btn btn-ghost btn-xs" data-act="confirm-cancel">' + t('cancel') + '</button>' : '<a class="btn btn-light btn-xs" href="#c-plan-' + o.id + '">' + t('open') + '</a>' + (rfqs.length ? '' : '<button class="btn btn-ghost btn-xs" data-act="confirm" data-key="obj:' + o.id + '" aria-label="' + esc(t('delete') + ' ' + o.name) + '">' + ic('trash') + '</button>')) + '</div></td></tr>';
    }).join('');
    return A.head(t('nav.c.plans'), t('c.plans.sub'), '<a class="btn btn-dark" href="#c-new">' + ic('plus') + '<span>' + t('c.newObjective') + '</span></a>') +
      (s.objectives.length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.objective') + '</th><th scope="col">' + t('th.goal') + '</th><th scope="col">' + t('th.where') + '</th><th scope="col" class="num">' + t('th.budget') + '</th><th scope="col">' + t('th.dates') + '</th><th scope="col" class="num">' + t('th.rfqs') + '</th><th scope="col"><span class="sr-only">' + t('actions') + '</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="panel">' + A.empty('target', t('c.noObjectives'), t('c.noObjectivesText'), '<a class="btn btn-dark" href="#c-new">' + t('c.newObjective') + '</a>') + '</div>');
  };

  /* ---------- Plan ---------- */
  function recCard(r, i, obj, mode) {
    const op = Store.opp(r.oppId); const sup = Store.supplier(op.supplierId);
    const sel = obj.selected.includes(op.id);
    const inCmp = Store.state.compare.includes(op.id);
    const confirms = r.checks.filter(c => c.status === 'confirm');
    const fails = r.checks.filter(c => c.status === 'fail');
    return '<article class="rec' + (sel ? ' selected' : '') + (mode === 'relaxed' ? ' relaxed' : '') + '" aria-labelledby="rec-' + op.id + '">' +
      '<div class="rec-thumb">' + A.thumb(op) + '</div>' +
      '<div class="rec-main">' +
      '<div class="rec-title">' + (mode === 'relaxed' ? '' : '<span class="rank">#' + (i + 1) + '</span>') + '<h3 id="rec-' + op.id + '">' + A.Lh(op.title) + '</h3></div>' +
      '<div class="meta"><span>' + ic(D.typeIcons[op.type]) + esc(A.typeL(op.type)) + '</span><span>' + ic('pin') + esc(A.areaL(op.area)) + '</span><span>' + ic('building') + esc(A.L(sup.name)) + '</span>' + A.verifiedBadge(sup) + '</div>' +
      (mode === 'relaxed' ? '<div class="notice warn">' + ic('alert') + '<div><b>' + t('relax.title') + '</b> ' + fails.map(c => esc(A.reason(c))).join(' · ') + '</div></div>' : '') +
      '<div class="rec-facts">' +
      A.fact(t('fact.cost'), A.priceText(r.price), r.price.onRequest ? '' : t('fact.costNote', { fee: A.feePct() })) +
      A.fact(t('fact.coverage'), A.covBadge(r.coverage), A.coverageText(r.coverage, op)) +
      A.fact(t('fact.audienceEv'), A.badge(r.evidence.audience.level === 'verified' ? 'ok' : r.evidence.audience.level === 'declared' ? 'warn' : '', t('evl.' + r.evidence.audience.level)), r.evidence.audience.items[0] ? A.num(r.evidence.audience.items[0].value) + ' ' + A.term(r.evidence.audience.items[0].label) : t('ev.noneShort')) +
      A.fact(t('fact.avail'), A.badge(r.evidence.availability === 'fresh' ? 'ok' : r.evidence.availability === 'stale' ? 'bad' : '', t('eva.' + r.evidence.availability)), A.date(op.availableFrom) + ' – ' + A.date(op.availableTo)) +
      '</div>' +
      (confirms.length ? '<div class="confirm-box"><b>' + ic('alert') + t('cks.confirmTitle', { n: confirms.length }) + '</b>' + A.checksHtml(confirms) + '</div>' : '') +
      A.risksHtml(r.risks.filter(x => x !== 'risk.partial')) +
      '<details class="why"><summary>' + t('why') + ic('chevron-down') + '</summary><div class="why-body">' +
      (r.factors.length ? '<h4>' + t('why.score') + '</h4>' + A.factorsHtml(r) : '') +
      '<h4>' + t('why.checks') + '</h4>' + A.checksHtml(r.checks) +
      '<h4>' + t('why.evidence') + '</h4>' + A.evidenceHtml(r.evidence) +
      '<p class="small"><b>' + t('fact.audience') + ':</b> ' + esc(A.oppAudience(op.audience)) + '</p>' +
      '<p class="small"><b>' + t('fact.facilities') + ':</b> ' + esc(A.facilitiesText(op.restrictions)) + '</p>' +
      '<p class="small"><b>' + t('fact.req') + ':</b> ' + (A.L(op.requirements) ? A.Lh(op.requirements) : t('none')) + '</p>' +
      (r.alternatives && r.alternatives.length ? '<div class="chips"><span class="small muted">' + t('alternatives') + ':</span>' + r.alternatives.map(aid => { const a = Store.opp(aid); return '<button class="alt-link" type="button" data-act="opp-detail" data-id="' + aid + '" data-obj="' + obj.id + '">' + esc(A.oppTitle(a)) + '</button>'; }).join('') + '</div>' : '') +
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
    const pk = E.buildPackages(rk, Store.state.opportunities, {});
    const tab = A.ui.planTab;
    const selected = obj.selected.map(oid => rk.all.find(x => x.oppId === oid)).filter(Boolean);
    const selTotal = M.sum(selected.filter(x => x.eligible && !x.price.onRequest).map(x => x.price.exVat));
    const selIneligible = selected.filter(x => !x.eligible);
    const found = obj.extraction || [];
    const rq = obj.requirements;

    let body = '';
    if (tab === 'rec') {
      body = rk.recommended.length ? '<div class="opp-list">' + rk.recommended.map((r, i) => recCard(r, i, obj)).join('') + '</div>' : '<div class="panel">' + A.empty('search', t('plan.none'), t('plan.noneText'), '<a class="btn btn-dark" href="#c-edit-' + obj.id + '">' + t('c.editBrief') + '</a>') + '</div>';
      if (rk.relaxed.length) body += '<p class="muted small">' + t('relax.hint', { n: rk.relaxed.length }) + ' <button class="link-btn" data-act="plan-tab" data-tab="relaxed">' + t('tab.relaxed') + '</button></p>';
    } else if (tab === 'pkg') {
      body = pk.length ? '<div class="pkgs">' + pk.map(p => {
        const ids = p.items.map(i => i.oppId);
        const chosen = ids.length === obj.selected.length && ids.every(x => obj.selected.includes(x));
        const ev = Object.keys(p.evidenceByMetric);
        return '<article class="pkg' + (chosen ? ' chosen' : '') + '"><div><span class="opp-cat">' + t('pkg.' + p.id + '.tag') + '</span><h3>' + t('pkg.' + p.id) + '</h3><p class="muted small">' + t('pkg.' + p.id + '.d') + '</p></div>' +
          '<div><span class="pkg-total">' + A.money(p.totals.exVat) + '</span><div class="muted small">' + t('pkg.exVat3', { fee: A.feePct() }) + '</div></div>' +
          '<ul>' + p.items.map(it => { const op = Store.opp(it.oppId); return '<li><span><button class="link-btn" type="button" data-act="opp-detail" data-id="' + op.id + '" data-obj="' + obj.id + '">' + esc(A.oppTitle(op)) + '</button><small>' + esc(A.supName(op.supplierId)) + ' · ' + esc(A.areaL(op.area)) + ' · ' + t('match') + ' ' + it.score + (it.coverage.status === 'partial' ? ' · ' + t('covs.partial') : '') + '</small></span><b>' + A.money(it.price.exVat) + '</b></li>'; }).join('') + '</ul>' +
          '<div class="sum-row"><span>' + t('pkg.subtotal') + '</span><b>' + A.money(p.totals.net) + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.fee', { pct: A.feePct() }) + '</span><b>' + A.money(p.totals.fee) + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.vat', { pct: A.vatPct() }) + '</span><b>' + A.money(p.totals.vat) + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.total') + '</span><b>' + A.money(p.totals.total) + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.budgetUse') + '</span><b>' + Math.round(p.budgetUse * 100) + '%</b></div><div class="meter" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(p.budgetUse * 100)) + '%"></i></div>' +
          '<div class="sum-row"><span>' + t('pkg.avg') + '</span><b>' + p.avgScore + '</b></div>' +
          '<div class="sum-row"><span>' + t('pkg.mix') + '</span><b>' + t('pkg.mixV', { types: p.typesCount, areas: p.areasCount }) + '</b></div>' +
          (p.partial ? '<div class="sum-row"><span>' + t('covs.partial') + '</span><b>' + p.partial + '</b></div>' : '') +
          '<div class="small"><b>' + t('pkg.evidence') + ':</b> ' + (ev.length ? ev.map(k => esc(t('evmet.' + k)) + ': ' + p.evidenceByMetric[k].map(x => A.num(x.value) + (x.verification === 'verified' ? ' ✓' : '')).join(' / ')).join(' · ') : t('ev.noneShort')) + '<br><span class="muted">' + t('pkg.evidenceNote') + '</span></div>' +
          '<button class="btn ' + (chosen ? 'btn-light' : 'btn-dark') + ' btn-sm" type="button" data-act="use-pkg" data-obj="' + obj.id + '" data-ids="' + ids.join(',') + '">' + ic(chosen ? 'check' : 'layers') + (chosen ? t('pkg.inUse') : t('pkg.use')) + '</button></article>';
      }).join('') + '</div><p class="muted small">' + t('pkg.note3') + '</p>' : '<div class="panel">' + A.empty('layers', t('pkg.none'), t('pkg.noneText')) + '</div>';
    } else if (tab === 'map') {
      const items = rk.recommended.map(r => ({ op: Store.opp(r.oppId), score: r.score }));
      const city = items.filter(i => i.op.area === 'all');
      body = '<div class="seg" role="radiogroup" aria-label="' + esc(t('map.viewLabel')) + '">' + ['map', 'table'].map(k => '<label><input type="radio" name="mapview" value="' + k + '" data-act="map-view"' + ((A.ui.mapView || 'map') === k ? ' checked' : '') + '><span>' + t('map.v.' + k) + '</span></label>').join('') + '</div>' +
        ((A.ui.mapView || 'map') === 'map' ? '<div class="map-wrap">' + A.mapSvg(items, obj.selected) + '<div class="map-legend"><span><i style="background:#157efc"></i>' + t('map.l1') + '</span><span><i style="background:#3d8fe6"></i>' + t('map.l2') + '</span><span><i style="background:#b86e00"></i>' + t('map.l3') + '</span><span><i style="background:#0a0d14"></i>' + t('map.l4') + '</span></div></div>' : '') +
        A.mapTable(items, obj.selected) +
        (city.length ? '<p class="muted small">' + t('map.city') + ': ' + city.map(c => esc(A.oppTitle(c.op))).join(', ') + '</p>' : '');
    } else if (tab === 'relaxed') {
      body = '<p class="muted">' + t('relax.sub') + '</p>' + (rk.relaxed.length ? '<div class="opp-list">' + rk.relaxed.map((r, i) => recCard(r, i, obj, 'relaxed')).join('') + '</div>' : '<div class="panel">' + A.empty('check-circle', t('relax.none'), t('relax.noneText')) + '</div>');
    } else {
      const lowScore = rk.eligible.filter(x => x.score < 45);
      body = (rk.excluded.length || lowScore.length) ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.opportunity') + '</th><th scope="col">' + t('th.supplier') + '</th><th scope="col">' + t('th.reason') + '</th><th scope="col"><span class="sr-only">' + t('actions') + '</span></th></tr></thead><tbody>' +
        rk.excluded.map(x => { const op = Store.opp(x.oppId); return '<tr><td>' + esc(A.oppTitle(op)) + '<br><small class="muted">' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + '</small></td><td>' + esc(A.supName(op.supplierId)) + '</td><td>' + A.checksHtml(x.fails) + '</td><td><button class="btn btn-ghost btn-xs" data-act="opp-detail" data-id="' + op.id + '" data-obj="' + obj.id + '">' + t('details') + '</button></td></tr>'; }).join('') +
        lowScore.map(x => { const op = Store.opp(x.oppId); return '<tr><td>' + esc(A.oppTitle(op)) + '<br><small class="muted">' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + '</small></td><td>' + esc(A.supName(op.supplierId)) + '</td><td>' + t('ex.lowScore', { n: x.score }) + '</td><td><button class="btn btn-ghost btn-xs" data-act="opp-detail" data-id="' + op.id + '" data-obj="' + obj.id + '">' + t('details') + '</button></td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="panel">' + A.empty('check-circle', t('ex.noneT'), t('ex.none')) + '</div>';
    }

    return A.head(obj.name, t('plan.sub'), '<a class="btn btn-light btn-sm" href="#c-edit-' + obj.id + '">' + ic('edit') + '<span>' + t('c.editBrief') + '</span></a><a class="btn btn-light btn-sm" href="#c-catalog">' + ic('search') + '<span>' + t('nav.c.catalog') + '</span></a>', { href: '#c-plans', label: t('nav.c.plans') }) +
      '<div class="brief-sum">' +
      A.fact(t('fld.objective'), esc(A.objL(obj.objective)), obj.product || '') +
      A.fact(t('fld.audience'), esc(A.audienceText(obj)), t('req.' + rq.audience)) +
      A.fact(t('fld.areas'), esc(A.areasL(obj.areas)), t('req.' + rq.areas)) +
      A.fact(t('fld.budget'), A.money(obj.budgetMinor), t('fld.budgetBasis', { fee: A.feePct() })) +
      A.fact(t('fld.dates'), A.date(obj.start) + ' – ' + A.date(obj.end), t('days', { n: obj.duration }) + ' · ' + t('reqc.' + rq.coverage)) +
      A.fact(t('fld.success'), esc(obj.success || '—'), obj.target ? t('fld.targetV', { n: A.num(obj.target) }) : '') +
      '</div>' +
      '<section class="panel soft"><div class="panel-head"><div><h2>' + t('plan.read') + '</h2><p>' + t('plan.readSub3', { n: rk.all.length, m: rk.eligible.length, x: rk.excluded.length }) + '</p></div></div>' +
      (obj.sentence ? '<p class="small"><b>' + t('plan.yourWords') + ':</b> <q>' + esc(obj.sentence) + '</q></p>' : '') +
      (found.filter(f => f.raw).length ? '<div class="understood"><span class="small muted" style="border:0;background:none;padding:0">' + t('plan.recognised') + '</span>' + found.filter(f => f.raw).map(f => '<span><b>' + esc(t('x.' + f.key)) + '</b> <q>' + esc(f.raw) + '</q> ' + A.badge(f.status === 'recognized' ? 'ok' : 'warn', t('xs.' + f.status)) + '</span>').join('') + '</div>' : '') +
      '<p class="src">' + t('plan.engineNote3') + '</p></section>' +
      A.tabs('plan', [['rec', t('tab.rec'), rk.recommended.length], ['pkg', t('tab.pkg'), pk.length], ['map', t('tab.map')], ['relaxed', t('tab.relaxed'), rk.relaxed.length], ['ex', t('tab.ex'), rk.excluded.length]], tab, 'plan-tab') +
      '<div id="panel-plan" role="tabpanel" aria-labelledby="tab-plan-' + tab + '">' + body + '</div>' +
      '<div class="selbar"><span><b>' + t('sel.count', { n: obj.selected.length }) + '</b> <span class="muted">· ' + t('sel.est3', { v: A.money(selTotal) }) + '</span>' + (selIneligible.length ? ' <span class="badge bad">' + t('sel.ineligible', { n: selIneligible.length }) + '</span>' : '') + '</span><span class="form-actions"><a class="btn btn-light btn-sm" href="#c-compare">' + ic('compare') + t('nav.c.compare') + ' (' + Store.state.compare.length + ')</a>' + (obj.selected.length ? '<a class="btn btn-blue btn-sm" href="#c-rfq-' + obj.id + '">' + ic('send') + t('sel.rfq') + '</a>' : '<span class="btn btn-blue btn-sm" aria-disabled="true">' + ic('send') + t('sel.rfq') + '</span>') + '</span></div>';
  };

  /* ---------- Catalogue ---------- */
  V.c.catalog = function () {
    const s = Store.state; const f = A.ui.cat;
    const obj = f.obj ? Store.objective(f.obj) : null;
    let list = s.opportunities.filter(o => o.status === 'active');
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(o => (A.L(o.title) + ' ' + (o.title.en || '') + ' ' + (o.title.ar || '') + ' ' + A.L(o.desc) + ' ' + A.supName(o.supplierId) + ' ' + A.typeL(o.type) + ' ' + A.areaL(o.area)).toLowerCase().includes(q)); }
    if (f.type) list = list.filter(o => o.type === f.type);
    if (f.area) list = list.filter(o => o.area === f.area);
    if (f.max) list = list.filter(o => o.price != null && o.price <= Number(f.max) * 100);
    const ctx = { today: A.today(), suppliers: s.suppliers, capacity: Store.capacity() };
    const brief = obj ? E.normalizeObjective(obj, { today: A.today() }) : null;
    let scored = list.map(o => ({ op: o, res: brief ? E.evaluate(o, brief, ctx) : null }));
    if (brief) scored.sort((a, b) => (b.res.eligible - a.res.eligible) || ((b.res.score || 0) - (a.res.score || 0))); else scored.sort((a, b) => A.oppTitle(a.op).localeCompare(A.oppTitle(b.op)));
    return A.head(t('nav.c.catalog'), t('cat.sub', { n: s.opportunities.filter(o => o.status === 'active').length })) +
      '<div class="panel"><div class="filters">' +
      '<div class="field f-search"><label for="cf-q">' + t('cat.search') + '</label><div class="input-wrap">' + ic('search') + '<input class="input" id="cf-q" type="search" data-live="cat" data-key="q" value="' + esc(f.q) + '" placeholder="' + esc(t('cat.searchPh')) + '"></div></div>' +
      '<div class="field"><label for="cf-type">' + t('cat.type') + '</label><select class="select" id="cf-type" data-live="cat" data-key="type">' + opt('', t('all'), f.type) + D.types.map(ty => opt(ty, A.typeL(ty), f.type)).join('') + '</select></div>' +
      '<div class="field"><label for="cf-area">' + t('cat.area') + '</label><select class="select" id="cf-area" data-live="cat" data-key="area">' + opt('', t('all'), f.area) + opt('all', t('area.cityWide'), f.area) + Object.keys(D.areas).map(a => opt(a, A.areaL(a), f.area)).join('') + '</select></div>' +
      '<div class="field"><label for="cf-max">' + t('cat.max') + '</label><select class="select" id="cf-max" data-live="cat" data-key="max">' + opt('', t('any'), f.max) + [2500, 5000, 10000, 20000].map(v => opt(v, A.money(v * 100), f.max)).join('') + '</select></div>' +
      '<div class="field"><label for="cf-obj">' + t('cat.scoreFor') + '</label><select class="select" id="cf-obj" data-live="cat" data-key="obj">' + opt('', t('cat.noScore'), f.obj) + s.objectives.map(o => opt(o.id, o.name, f.obj)).join('') + '</select></div>' +
      '</div><p class="sr-only" aria-live="polite">' + t('cat.count', { n: scored.length }) + '</p></div>' +
      (scored.length ? '<div class="cat-grid">' + scored.map(({ op, res }) => {
        const sup = Store.supplier(op.supplierId); const inCmp = s.compare.includes(op.id); const sel = obj && obj.selected.includes(op.id);
        return '<article class="cat-card"><div class="cat-media">' + A.thumb(op) + (res ? '<span class="score-badge' + (res.eligible ? '' : ' no') + '">' + (res.eligible ? t('match') + ' ' + res.score : t('cat.notEligible')) + '</span>' : '') + '</div><div class="cat-body">' +
          '<span class="opp-cat">' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + '</span><h3>' + A.Lh(op.title) + '</h3>' +
          '<div class="meta"><span>' + esc(A.L(sup.name)) + '</span>' + A.verifiedBadge(sup) + '</div>' +
          '<div class="cat-price"><b>' + (op.price != null ? A.money(op.price) : t('price.request')) + '</b><span class="muted small">' + esc(A.unitL(op.unit)) + ' · ' + t('exFee') + '</span></div>' +
          (res && !res.eligible ? '<div class="small">' + A.checksHtml(res.fails.slice(0, 2)) + '</div>' : '') +
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
    const ctx = { today: A.today(), suppliers: s.suppliers, capacity: Store.capacity() };
    const brief = obj ? E.normalizeObjective(obj, { today: A.today() }) : null;
    const res = ops.map(op => brief ? E.evaluate(op, brief, ctx) : null);
    const row = (label, cells) => '<tr><th scope="row">' + esc(label) + '</th>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
    let rows = '';
    rows += '<tr><th scope="row"><span class="sr-only">' + t('th.opportunity') + '</span></th>' + ops.map(op => '<td><div class="rec-thumb" style="width:100%;aspect-ratio:16/9">' + A.thumb(op) + '</div><b style="display:block;margin-top:8px">' + A.Lh(op.title) + '</b><button class="btn btn-ghost btn-xs" data-act="compare" data-id="' + op.id + '">' + ic('x') + t('remove') + '</button></td>').join('') + '</tr>';
    rows += row(t('th.supplier'), ops.map(op => esc(A.supName(op.supplierId)) + ' ' + A.verifiedBadge(Store.supplier(op.supplierId))));
    rows += row(t('cat.type'), ops.map(op => esc(A.typeL(op.type))));
    rows += row(t('cat.area'), ops.map(op => esc(A.areaL(op.area))));
    rows += row(t('fact.price'), ops.map(op => (op.price != null ? A.money(op.price) : t('price.request')) + ' <span class="muted small">' + esc(A.unitL(op.unit)) + '</span>' + (op.setupFee ? '<br><small class="muted">' + t('setup') + ' ' + A.money(op.setupFee) + '</small>' : '')));
    if (brief) {
      rows += row(t('cmp.eligible'), res.map(r => r.eligible ? A.badge('ok', t('yes')) + (r.confirms.length ? ' ' + A.badge('warn', t('cks.confirmN', { n: r.confirms.length })) : '') : A.badge('bad', t('no')) + A.checksHtml(r.fails)));
      rows += row(t('fact.cost'), res.map(r => A.priceText(r.price) + (r.price.onRequest ? '' : '<br><small class="muted">' + t('fact.costNote', { fee: A.feePct() }) + '</small>')));
      rows += row(t('fact.coverage'), res.map((r, i) => A.covBadge(r.coverage) + '<br><small class="muted">' + esc(A.coverageText(r.coverage, ops[i])) + '</small>'));
      rows += row(t('match'), res.map(r => r.eligible ? String(r.score) : '—'));
      E.FACTORS.forEach(k => { rows += row(t('f.' + k), res.map(r => { const f = r.factors.find(x => x.key === k); return f ? Math.round(f.value * 100) + ' <small class="muted">' + esc(A.reason(f.why)) + '</small>' : '—'; })); });
      rows += row(t('why.evidence'), res.map(r => t('evd.audience') + ': ' + t('evl.' + r.evidence.audience.level) + '<br>' + t('evd.delivery') + ': ' + t('evl.' + r.evidence.delivery.level) + '<br>' + t('evd.availability') + ': ' + t('eva.' + r.evidence.availability)));
      rows += row(t('risks'), res.map(r => A.risksHtml(r.risks) || '—'));
    }
    rows += row(t('fact.audience'), ops.map(op => esc(A.oppAudience(op.audience))));
    rows += row(t('fact.facilities'), ops.map(op => esc(A.facilitiesText(op.restrictions))));
    rows += row(t('fact.avail'), ops.map(op => A.date(op.availableFrom) + ' – ' + A.date(op.availableTo) + '<br><small class="muted">' + t('cap.perDate', { n: op.capacityPerDate }) + ' · ' + t('lead', { n: op.leadDays || 0 }) + '</small>'));
    rows += row(t('fact.req'), ops.map(op => A.L(op.requirements) ? A.Lh(op.requirements) : '—'));
    return A.head(t('nav.c.compare'), t('cmp.sub'), '<button class="btn btn-ghost btn-sm" data-act="compare-clear">' + ic('x') + t('cmp.clear') + '</button>') +
      '<div class="panel"><div class="form-grid"><div class="field"><label for="cmp-obj">' + t('cmp.for') + '</label><select class="select" id="cmp-obj" data-live="cmpobj">' + '<option value="">' + t('cat.noScore') + '</option>' + s.objectives.map(o => '<option value="' + o.id + '"' + (o.id === objId ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select></div><div class="field" style="align-content:end">' + (obj ? '<button class="btn btn-dark" data-act="cmp-rfq" data-obj="' + obj.id + '">' + ic('send') + t('cmp.rfq') + '</button>' : '') + '</div></div></div>' +
      '<div class="table-wrap"><table class="t cmp"><caption class="sr-only">' + t('nav.c.compare') + '</caption><tbody>' + rows + '</tbody></table></div>';
  };

  /* ---------- RFQ compose ---------- */
  V.c.rfq = function (id) {
    const obj = Store.objective(id); if (!obj) return A.notFound();
    const ops = obj.selected.map(x => Store.opp(x)).filter(o => o && o.status === 'active');
    const back = { href: '#c-plan-' + obj.id, label: t('c.backPlan') };
    if (!ops.length) return A.head(t('rfq.title'), '', '', back) + '<div class="panel">' + A.empty('send', t('rfq.empty'), t('rfq.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-plan-' + obj.id + '">' + t('c.backPlan') + '</a>') + '</div>';
    const brief = E.normalizeObjective(obj, { today: A.today() });
    const sups = Array.from(new Set(ops.map(o => o.supplierId)));
    const latest = E.rfqDeadlineCheck(Dt.addDays(A.today(), 1), brief, ops, A.today());
    const maxLead = Math.max(0, ...ops.map(o => o.leadDays || 0));
    const latestDate = Dt.addDays(brief.start, -maxLead);
    const def = Dt.addDays(A.today(), 5) < latestDate ? Dt.addDays(A.today(), 5) : latestDate;
    const startPast = brief.start < A.today();
    return A.head(t('rfq.title'), t('rfq.sub'), '', back) +
      errBox('rfq:' + obj.id) +
      (startPast ? '<div class="notice bad">' + ic('alert') + '<div>' + t('rfq.startPast') + ' <a href="#c-edit-' + obj.id + '">' + t('c.editBrief') + '</a></div></div>' : '') +
      (!latest.ok && latest.code === 'rfq.deadline.notice' ? '<div class="notice warn">' + ic('alert') + '<div>' + t('rfq.noticeTight', { lead: maxLead, d: A.date(latestDate) }) + '</div></div>' : '') +
      '<form data-form="rfq" data-obj="' + obj.id + '" novalidate class="view" style="gap:16px">' +
      '<div class="doc"><div class="doc-head"><div><small>' + t('rfq.draft') + '</small><h2>' + esc(obj.name) + '</h2></div><div><small>' + t('rfq.to') + '</small><h2>' + t('rfq.suppliersN', { n: sups.length }) + '</h2></div></div><div class="doc-body">' +
      '<dl class="dl">' +
      '<dt>' + t('fld.objective') + '</dt><dd>' + esc(A.objL(obj.objective)) + '</dd>' +
      '<dt>' + t('q.product') + '</dt><dd>' + esc(obj.product || '—') + (obj.productCategory ? ' · ' + esc(A.catL(obj.productCategory)) : '') + '</dd>' +
      '<dt>' + t('fld.audience') + '</dt><dd>' + esc(A.audienceText(obj)) + ' · ' + t('req.' + obj.requirements.audience) + '</dd>' +
      '<dt>' + t('fld.areas') + '</dt><dd>' + esc(A.areasL(obj.areas)) + ' · ' + t('req.' + obj.requirements.areas) + '</dd>' +
      '<dt>' + t('fld.dates') + '</dt><dd>' + A.date(obj.start) + ' – ' + A.date(obj.end) + ' (' + t('days', { n: obj.duration }) + ')</dd>' +
      '<dt>' + t('fld.needs') + '</dt><dd>' + (E.FACILITIES.filter(k => obj.needs[k]).map(A.facL).join(', ') || t('none')) + '</dd>' +
      '<dt>' + t('fld.success') + '</dt><dd>' + esc(obj.success || '—') + (obj.target ? ' · ' + t('fld.targetV', { n: A.num(obj.target) }) : '') + '</dd>' +
      '</dl>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('rfq.format') + '</th><th scope="col">' + t('th.supplier') + '</th><th scope="col">' + t('fact.coverage') + '</th><th scope="col" class="num">' + t('rfq.listEst') + '</th></tr></thead><tbody>' + ops.map(op => { const c = E.coverage(op, brief); const p = E.price(op, c); return '<tr><td>' + esc(A.oppTitle(op)) + '<br><small class="muted">' + esc(A.typeL(op.type)) + ' · ' + esc(A.areaL(op.area)) + ' · ' + t('lead', { n: op.leadDays || 0 }) + '</small></td><td>' + esc(A.supName(op.supplierId)) + '</td><td>' + A.covBadge(c) + '<br><small class="muted">' + esc(A.coverageText(c, op)) + '</small></td><td class="num">' + A.priceText(p) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="rq-report">' + t('rfq.reporting') + '</label><select class="select" id="rq-report" name="reporting">' + ['basic', 'detailed', 'none'].map(k => opt(k, t('rep.' + k), 'basic')).join('') + '</select></div>' +
      '<div class="field"><label for="rq-deadline">' + t('rfq.deadline') + '</label><input class="input" type="date" id="rq-deadline" name="deadline" min="' + Dt.addDays(A.today(), 1) + '" max="' + latestDate + '" value="' + def + '" required aria-describedby="rq-dl-hint"><span class="hint" id="rq-dl-hint">' + t('rfq.deadlineHint', { d: A.date(latestDate), lead: maxLead }) + '</span></div>' +
      '<div class="field span-2"><label for="rq-deliv">' + t('rfq.deliverables') + '</label><textarea class="textarea" id="rq-deliv" name="deliverables" maxlength="600" placeholder="' + esc(t('rfq.deliverablesPh')) + '"></textarea><span class="hint">' + t('rfq.deliverablesHint') + '</span></div>' +
      '<div class="field span-2"><label for="rq-req">' + t('rfq.special') + '</label><textarea class="textarea" id="rq-req" name="requirements" maxlength="600" placeholder="' + esc(t('rfq.specialPh')) + '"></textarea></div>' +
      '<label class="check span-2"><input type="checkbox" name="shareBudget" checked> <span>' + t('rfq.shareBudget', { v: A.money(obj.budgetMinor) }) + '</span></label>' +
      '</div></div></div>' +
      '<div class="notice">' + ic('info') + '<div>' + t('rfq.simNote3', { name: esc(A.supName(Store.state.activeSupplierId)) }) + '</div></div>' +
      '<p class="error-text" data-error role="alert" hidden></p>' +
      '<div class="form-actions"><button class="btn btn-dark" type="submit"' + (startPast ? ' disabled' : '') + '>' + ic('send') + '<span>' + t('rfq.send', { n: sups.length }) + '</span></button><a class="btn btn-ghost" href="#c-plan-' + obj.id + '">' + t('cancel') + '</a></div>' +
      '</form>';
  };

  /* ---------- RFQs list ---------- */
  V.c.rfqs = function () {
    const s = Store.state;
    if (!s.rfqs.length) return A.head(t('nav.c.rfqs'), t('rfqs.sub')) + '<div class="panel">' + A.empty('file', t('rfqs.empty'), t('rfqs.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-plans">' + t('nav.c.plans') + '</a>') + '</div>';
    return A.head(t('nav.c.rfqs'), t('rfqs.sub')) +
      '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.rfq') + '</th><th scope="col">' + t('th.objective') + '</th><th scope="col">' + t('th.sent') + '</th><th scope="col" class="num">' + t('th.replies') + '</th><th scope="col">' + t('th.status') + '</th><th scope="col"><span class="sr-only">' + t('actions') + '</span></th></tr></thead><tbody>' +
      s.rfqs.map(r => { const o = Store.objective(r.objectiveId); const rep = r.lines.filter(l => l.status !== 'requested').length; return '<tr><td><a href="#c-offers-' + r.id + '">' + esc(r.number) + '</a> ' + A.sampleTag(r) + '</td><td>' + esc(o ? o.name : '—') + '</td><td>' + A.date(r.createdAt.slice(0, 10)) + '</td><td class="num">' + rep + ' / ' + r.lines.length + '</td><td>' + A.statusBadge('rfq', r.status) + '</td><td><a class="btn btn-light btn-xs" href="#c-offers-' + r.id + '">' + (offersToReview(r) ? t('rfqs.compare') : t('open')) + '</a></td></tr>'; }).join('') + '</tbody></table></div>';
  };

  /* ---------- Offers (versioned, normalised comparison) ---------- */
  function devText(d) {
    if (d.field === 'coverage') return t('dev.coverageT', { off: d.offeredDates, req: d.requestedDates, units: d.offeredUnits, reqUnits: d.requestedUnits || '—' });
    if (d.field === 'dates') return t('dev.datesT', { n: d.outside });
    if (d.field === 'price') return t('dev.priceT', { off: A.money(d.offeredNet), req: A.money(d.requestedNet) });
    if (d.field === 'reporting') return t('dev.reportingT', { off: t('rep.' + d.offered), req: t('rep.' + d.requested) });
    if (d.field === 'deliverables') return t('dev.deliverablesT', { list: d.missing.join(', ') });
    return d.field;
  }
  A.devText = devText;
  V.c.offers = function (id) {
    const r = Store.rfq(id); if (!r) return A.notFound();
    const obj = Store.objective(r.objectiveId);
    const s = Store.state;
    const withOffer = r.lines.filter(l => Of.current(l));
    const today = A.today();
    const actSup = s.activeSupplierId;
    const accepted = r.lines.filter(l => l.status === 'accepted');
    const acceptedTotal = M.sum(accepted.map(l => Of.money(Of.current(l)).total));
    const used = Dm.budgetUse(s, r);
    const row = (label, cells, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + esc(label) + '</th>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
    const invalidated = l => s.audit.some(a => a.entityId === l.id && a.event === 'approval_invalidated') && l.status === 'offered';
    let table = '';
    if (withOffer.length) {
      const vs = withOffer.map(Of.current);
      const ms = vs.map(v => Of.money(v));
      const minTotal = Math.min.apply(null, ms.map(m => m.total));
      table += row(t('th.supplier'), withOffer.map(l => '<b>' + esc(A.supName(l.supplierId)) + '</b> ' + A.verifiedBadge(Store.supplier(l.supplierId)) + (Of.current(l).simulated ? '<br><span class="tag sim">' + t('simulated') + '</span>' : '')));
      table += row(t('th.opportunity'), withOffer.map(l => '<button class="link-btn" data-act="opp-detail" data-id="' + l.oppId + '">' + esc(A.oppTitle(Store.opp(l.oppId))) + '</button>'));
      table += row(t('off.version'), withOffer.map((l, i) => 'v' + vs[i].version + ' · ' + A.dateTime(vs[i].at) + (l.offers.length > 1 ? '<br><small class="muted">' + t('off.revisedN', { n: l.offers.length - 1 }) + '</small>' : '') + '<br>' + A.statusBadge('line', l.status)));
      table += row(t('off.base'), vs.map(v => A.money(v.basePrice)));
      table += row(t('off.setup'), vs.map(v => A.money(v.setupFee)));
      table += row(t('off.net'), ms.map(m => A.money(m.net)));
      table += row(t('off.fee', { pct: A.feePct() }), ms.map(m => A.money(m.fee)));
      table += row(t('off.vat3', { pct: A.vatPct() }), ms.map((m, i) => A.money(m.vat) + '<br><small class="muted">' + (vs[i].vatRegistered ? t('off.vatSplit', { s: A.money(m.vatSupplier), f: A.money(m.vatFee) }) : t('off.noVatSupplier')) + '</small>'));
      table += row(t('off.total'), ms.map(m => '<span class="' + (m.total === minTotal && ms.length > 1 ? 'best' : '') + '">' + A.money(m.total) + '</span>'), 'total');
      table += row(t('off.coverage'), withOffer.map((l, i) => { const c = l.requested.coverage || {}; return t('off.covT', { units: vs[i].units, dates: vs[i].dates.length, req: (c.coveredDates || []).length }) + (vs[i].partial ? ' ' + A.badge('warn', t('covs.partial')) : ''); }));
      table += row(t('off.dates'), vs.map(v => A.date(v.dates[0]) + ' – ' + A.date(v.dates[v.dates.length - 1])));
      table += row(t('off.reporting'), vs.map(v => esc(t('rep.' + v.reporting))));
      table += row(t('off.deliverables'), vs.map(v => '<ul class="plain">' + v.deliverables.map(d => '<li>' + esc(d) + '</li>').join('') + '</ul>'));
      table += row(t('off.terms'), vs.map(v => esc(t('terms.' + v.terms))));
      table += row(t('off.valid'), vs.map(v => A.date(v.validUntil) + (v.validUntil < today ? ' ' + A.badge('bad', t('off.expired')) : '')));
      table += row(t('off.deviations'), vs.map(v => v.deviations.length ? '<ul class="plain">' + v.deviations.map(d => '<li>' + A.badge('warn', t('dev.' + d.field)) + ' ' + esc(devText(d)) + '</li>').join('') + '</ul>' : A.badge('ok', t('off.noDev'))));
      table += row(t('off.approve'), withOffer.map((l, i) => {
        const v = vs[i];
        const err = A.ui.errors['approve:' + l.id];
        if (l.status === 'accepted') return A.badge('ok', t('off.approvedV', { v: l.approval.version })) + (l.approval.acceptedDeviations.length ? '<br><small class="muted">' + t('off.acceptedDev', { list: l.approval.acceptedDeviations.map(f => t('dev.' + f)).join(', ') }) + '</small>' : '') + '<br><button class="btn btn-ghost btn-xs" data-act="unapprove" data-rfq="' + r.id + '" data-line="' + l.id + '">' + t('off.unapprove') + '</button>';
        if (l.status !== 'offered') return A.statusBadge('line', l.status);
        if (v.validUntil < today) return A.badge('bad', t('off.expiredNoApprove'));
        const wouldUse = used + M.budgetBasis(Of.money(v));
        return '<form data-form="approve" data-rfq="' + r.id + '" data-line="' + l.id + '" novalidate>' +
          (invalidated(l) ? '<div class="notice warn small">' + ic('refresh') + '<div>' + t('off.invalidated') + '</div></div>' : '') +
          (l.migratedApprovalCleared ? '<div class="notice small">' + ic('info') + '<div>' + t('off.migrated') + '</div></div>' : '') +
          v.deviations.map(d => '<label class="check small"><input type="checkbox" name="dev" value="' + d.field + '"><span>' + t('off.acceptDev', { d: devText(d) }) + '</span></label>').join('') +
          (wouldUse > r.budgetMinor ? '<label class="check small"><input type="checkbox" name="overBudget"><span>' + t('off.overBudget', { v: A.money(wouldUse), b: A.money(r.budgetMinor) }) + '</span></label>' : '') +
          (err ? A.errHtml(err) : '') +
          '<button class="btn btn-dark btn-xs" type="submit">' + ic('check') + t('off.approveV', { v: v.version }) + '</button></form>';
      }));
    }
    return A.head(r.number + (obj ? ' · ' + obj.name : ''), t('off.sub3'), '<button class="btn btn-light btn-sm" data-act="rfq-doc" data-id="' + r.id + '">' + ic('file') + t('off.viewRfq') + '</button>' + (r.lines.some(l => l.status === 'requested') ? '<button class="btn btn-light btn-sm" data-act="nudge" data-id="' + r.id + '">' + ic('bolt') + t('off.nudge') + '</button>' : ''), { href: '#c-rfqs', label: t('nav.c.rfqs') }) +
      (['awarded', 'partially_awarded'].includes(r.status) ? '<div class="notice ok">' + ic('check-circle') + '<div>' + t('off.awarded3') + ' <a href="#c-bookings">' + t('nav.c.bookings') + '</a></div></div>' : '') +
      '<section class="panel"><div class="panel-head"><h2>' + t('off.status') + '</h2><span class="muted small">' + (r.responseDeadline ? t('off.deadline', { d: A.date(r.responseDeadline) }) : '') + '</span></div><div class="rows">' +
      r.lines.map(l => { const v = Of.current(l); return '<div class="row"><span class="row-ico">' + ic(l.status === 'requested' ? 'clock' : ['declined', 'withdrawn', 'expired'].includes(l.status) ? 'x' : 'check-circle') + '</span><span class="grow"><b>' + esc(A.supName(l.supplierId)) + '</b><small>' + esc(A.oppTitle(Store.opp(l.oppId))) + (v ? ' · v' + v.version + ' · ' + A.since(v.at) : '') + (l.status === 'declined' && l.declineReason ? ' · ' + esc(l.declineReason) : '') + '</small></span>' + A.statusBadge('line', l.status) + (l.status === 'requested' && l.supplierId === actSup ? '<a class="btn btn-blue btn-xs" href="#s-respond-' + r.id + '">' + t('off.answerAs') + '</a>' : '') + '</div>'; }).join('') +
      '</div>' + (r.lines.some(l => l.status === 'requested' && l.supplierId === actSup) ? '<div class="notice">' + ic('info') + '<div>' + t('off.actNote', { name: esc(A.supName(actSup)) }) + '</div></div>' : '') + '</section>' +
      (withOffer.length ? '<div class="panel-head"><h2>' + t('off.compare') + '</h2><span class="muted small">' + t('off.normNote3') + '</span></div><div class="table-wrap"><table class="t cmp"><caption class="sr-only">' + t('off.compare') + '</caption><tbody>' + table + '</tbody></table></div>' : '<div class="panel">' + A.empty('clock', t('off.none'), t('off.noneText')) + '</div>') +
      (accepted.length || withOffer.some(l => l.status === 'offered') ? '<div class="selbar"><span><b>' + t('off.approvedN', { n: accepted.length }) + '</b> <span class="muted">· ' + A.money(acceptedTotal) + ' ' + t('inclVat') + '</span></span>' + (accepted.length ? '<a class="btn btn-blue btn-sm" href="#c-checkout-' + r.id + '">' + ic('card') + t('off.checkout') + '</a>' : '<span class="btn btn-blue btn-sm" aria-disabled="true">' + ic('card') + t('off.checkout') + '</span>') + '</div>' : '');
  };

  /* ---------- Checkout ---------- */
  V.c.checkout = function (id) {
    const r = Store.rfq(id); if (!r) return A.notFound();
    const back = { href: '#c-offers-' + r.id, label: t('off.back') };
    const s = Store.state;
    const accepted = r.lines.filter(l => l.status === 'accepted');
    const pend = s.payments.filter(p => p.rfqId === r.id && p.status === 'awaiting');
    if (!accepted.length) return A.head(t('co.title'), '', '', back) + (pend.length ? '<div class="notice">' + ic('clock') + '<div>' + t('co.pending', { num: pend[0].number }) + ' <a href="#c-payment-' + pend[0].id + '">' + t('open') + '</a></div></div>' : '') + '<div class="panel">' + A.empty('card', t('co.empty'), t('co.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-offers-' + r.id + '">' + t('off.back') + '</a>') + '</div>';
    const now = new Date().toISOString();
    const checks = accepted.map(l => ({ l, stale: !Of.approvalValid(l), res: Of.validate(l, { today: A.today(), now, listing: Store.opp(l.oppId), supplier: Store.supplier(l.supplierId), state: s, verifiedOnly: !!(r.requirementsPolicy && r.requirementsPolicy.verifiedOnly), ref: l.id, stage: 'checkout' }) }));
    const blocked = checks.filter(c => c.stale || !c.res.ok);
    const ms = accepted.map(l => Of.money(Of.current(l)));
    const tot = M.totals(ms);
    if (!A.ui.coKeys[r.id]) A.ui.coKeys[r.id] = 'co-' + r.id + '-' + Math.random().toString(36).slice(2, 10);
    return A.head(t('co.title'), t('co.sub3'), '', back) +
      errBox('checkout:' + r.id) +
      (blocked.length ? '<div class="notice bad" role="alert">' + ic('alert') + '<div><b>' + t('co.blocked') + '</b><ul class="plain">' + blocked.map(c => '<li>' + esc(A.oppTitle(Store.opp(c.l.oppId))) + ': ' + esc(c.stale ? t('err.code.CHECKOUT_APPROVAL_STALE') : c.res.errors.map(e => A.errMsg({ code: e.code, details: e })).join(' · ')) + '</li>').join('') + '</ul></div></div>' : '') +
      '<div class="grid-2" style="align-items:start">' +
      '<section class="panel"><div class="panel-head"><h2>' + t('co.summary') + '</h2></div><div class="table-wrap"><table class="t" style="min-width:420px"><thead><tr><th scope="col">' + t('th.opportunity') + '</th><th scope="col" class="num">' + t('off.net') + '</th><th scope="col" class="num">' + t('off.feeShort') + '</th><th scope="col" class="num">' + t('off.vatShort') + '</th><th scope="col" class="num">' + t('off.total') + '</th></tr></thead><tbody>' +
      accepted.map((l, i) => '<tr><td>' + esc(A.oppTitle(Store.opp(l.oppId))) + '<br><small class="muted">' + esc(A.supName(l.supplierId)) + ' · v' + Of.current(l).version + ' · ' + t('co.datesN', { n: Of.current(l).dates.length }) + '</small>' + checks[i].res.warnings.map(w => '<br><span class="badge warn">' + esc(t('warn.' + w.code)) + '</span>').join('') + '</td><td class="num">' + A.money(ms[i].net) + '</td><td class="num">' + A.money(ms[i].fee) + '</td><td class="num">' + A.money(ms[i].vat) + '</td><td class="num">' + A.money(ms[i].total) + '</td></tr>').join('') +
      '<tr class="total"><td>' + t('co.total') + '</td><td class="num">' + A.money(tot.net) + '</td><td class="num">' + A.money(tot.fee) + '</td><td class="num">' + A.money(tot.vat) + '</td><td class="num">' + A.money(tot.total) + '</td></tr></tbody></table></div>' +
      '<p class="src">' + t('co.taxNote', { vat: A.vatPct(), fee: A.feePct() }) + '</p>' +
      '<div class="notice">' + ic('shield') + '<div>' + t('co.escrow3') + '</div></div></section>' +
      '<form class="panel" data-form="checkout" data-rfq="' + r.id + '" data-key="' + A.ui.coKeys[r.id] + '" novalidate><div class="panel-head"><h2>' + t('co.billing') + '</h2></div>' +
      '<div class="notice warn">' + ic('info') + '<div>' + t('co.demoPay') + '</div></div>' +
      '<div class="field"><label for="co-company">' + t('co.company') + '</label><input class="input" id="co-company" name="company" required maxlength="100" autocomplete="organization" value="' + esc(s.company) + '"></div>' +
      '<div class="field"><label for="co-email">' + t('co.email') + '</label><input class="input" id="co-email" name="email" type="email" required maxlength="120" autocomplete="email" placeholder="finance@company.example"><span class="hint">' + t('co.emailHint') + '</span></div>' +
      '<div class="field"><label for="co-trn">' + t('co.trn') + '</label><input class="input" id="co-trn" name="trn" inputmode="numeric" maxlength="15" placeholder="100000000000003"><span class="hint">' + t('co.trnHint') + '</span></div>' +
      '<fieldset class="field"><legend class="label">' + t('co.method') + '</legend><div class="rows">' +
      ['card', 'transfer'].map((m, i) => '<label class="check row" style="cursor:pointer"><input type="radio" name="method" value="' + m + '"' + (i === 0 ? ' checked' : '') + '><span class="grow"><b>' + t('pm.' + m) + '</b><small>' + t('pm.' + m + '.d3', { h: m === 'card' ? 30 : 48 }) + '</small></span></label>').join('') + '</div></fieldset>' +
      '<label class="check"><input type="checkbox" name="ack" required><span>' + t('co.ack3') + '</span></label>' +
      '<p class="error-text" data-error role="alert" hidden></p>' +
      '<button class="btn btn-dark" type="submit"' + (blocked.length ? ' disabled aria-disabled="true"' : '') + '>' + ic('lock') + '<span>' + t('co.reserve', { v: A.money(tot.total) }) + '</span></button></form></div>';
  };

  /* ---------- Payment status (holds, simulated provider events in the demo) ---------- */
  V.c.payment = function (id) {
    const p = Store.payment(id); if (!p) return A.notFound();
    const bks = Store.state.bookings.filter(b => b.paymentId === p.id);
    const expMs = p.expiresAt ? Date.parse(p.expiresAt) - Date.now() : 0;
    return A.head(p.number, t('pay.sub'), '', { href: '#c-bookings', label: t('nav.c.bookings') }) +
      errBox('pay:' + p.id) +
      '<div class="brief-sum">' + A.fact(t('th.status'), A.statusBadge('pay', p.status)) + A.fact(t('co.method'), t('pm.' + p.method)) + A.fact(t('off.total'), A.money(p.amount.total), t('inclVat')) +
      (p.status === 'awaiting' ? A.fact(t('pay.holdUntil'), A.dateTime(p.expiresAt), expMs > 0 ? t('pay.minsLeft', { n: Math.max(1, Math.round(expMs / 60000)) }) : t('pay.expiring')) : '') +
      (p.paidAt ? A.fact(t('pay.paidAt'), A.dateTime(p.paidAt), p.simulated ? t('simulated') : '') : '') + (p.refunded ? A.fact(t('pay.refunded'), A.money(p.refunded)) : '') + '</div>' +
      (p.status === 'awaiting' ? '<section class="panel warn"><div class="panel-head"><div><h2>' + t('pay.demoTitle') + '</h2><p>' + t('pay.demoSub') + '</p></div></div><div class="form-actions"><button class="btn btn-dark btn-sm" data-act="sim-pay" data-id="' + p.id + '" data-ok="1">' + ic('check') + t(p.method === 'card' ? 'pay.simCard' : 'pay.simTransfer') + '</button><button class="btn btn-ghost btn-sm" data-act="sim-pay" data-id="' + p.id + '" data-ok="0">' + ic('x') + t('pay.simFail') + '</button></div><p class="src">' + t('pay.liveNote') + '</p></section>' : '') +
      '<section class="panel"><div class="panel-head"><h2>' + t('pay.bookings') + '</h2></div>' + A.bookingRows(bks, 'c') + '</section>';
  };

  /* ---------- Bookings ---------- */
  A.bookingRows = (list, base) => list.length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.booking') + '</th><th scope="col">' + t('th.opportunity') + '</th><th scope="col">' + t('th.supplier') + '</th><th scope="col">' + t('th.dates') + '</th><th scope="col">' + t('th.status') + '</th><th scope="col" class="num">' + (base === 's' ? t('s.youReceive') : t('off.total')) + '</th><th scope="col"><span class="sr-only">' + t('actions') + '</span></th></tr></thead><tbody>' +
    list.map(b => '<tr><td><a href="#' + base + '-booking-' + b.id + '">' + esc(b.number) + '</a> ' + A.sampleTag(b) + '</td><td>' + esc(b.snapshot ? A.L(b.snapshot.title) : A.oppTitle(Store.opp(b.oppId))) + '</td><td>' + esc(A.supName(b.supplierId)) + '</td><td>' + A.date(b.from) + ' – ' + A.date(b.to) + '<br><small class="muted">' + t('co.datesN', { n: (b.dates || []).length }) + '</small></td><td>' + A.statusBadge('bk', b.status) + '</td><td class="num">' + A.money(base === 's' ? b.money.net : b.money.total) + '</td><td><a class="btn btn-light btn-xs" href="#' + base + '-booking-' + b.id + '">' + t('open') + '</a></td></tr>').join('') + '</tbody></table></div>' : '';

  V.c.bookings = function () {
    const list = Store.state.bookings;
    return A.head(t('nav.c.bookings'), t('bk.sub')) + (list.length ? A.bookingRows(list, 'c') : '<div class="panel">' + A.empty('track', t('bk.empty'), t('bk.emptyText'), '<a class="btn btn-dark btn-sm" href="#c-rfqs">' + t('nav.c.rfqs') + '</a>') + '</div>');
  };

  const STEPS = ['reserved', 'confirmed', 'preparing', 'live', 'completed', 'delivery_accepted'];
  A.timeline = b => {
    const hist = Store.state.audit.filter(a => a.entity === 'booking' && a.entityId === b.id && a.to);
    const idx = STEPS.indexOf(b.status);
    const terminal = idx < 0;
    const reached = st => st === 'reserved' || hist.some(h => h.to === st);
    return (terminal ? '<div class="notice ' + (b.status === 'disputed' ? 'warn' : '') + '">' + ic('info') + '<div><b>' + t('bk.' + b.status) + '</b> ' + t('bk.' + b.status + '.d') + '</div></div>' : '') +
      '<ol class="timeline">' + STEPS.map((st, i) => { const ev = st === 'reserved' ? { at: b.createdAt } : hist.find(x => x.to === st); const done = reached(st) && (terminal || i <= idx); return '<li class="tl-step ' + (done ? (i === idx ? 'now done' : 'done') : '') + '"' + (i === idx ? ' aria-current="step"' : '') + '><span class="dot" aria-hidden="true">' + (done ? ic('check') : '') + '</span><b>' + t('bk.' + st) + '</b><small>' + (ev && done ? A.date(ev.at.slice(0, 10)) : '') + '</small></li>'; }).join('') + '</ol>';
  };
  A.reportHtml = b => {
    if (!b.report) return A.empty('chart', t('rep.noneYet'), t('rep.noneYetText'));
    return '<div class="table-wrap"><table class="t" style="min-width:480px"><thead><tr><th scope="col">' + t('rep.metric') + '</th><th scope="col" class="num">' + t('rep.value') + '</th><th scope="col">' + t('rep.method') + '</th><th scope="col">' + t('rep.note') + '</th></tr></thead><tbody>' +
      b.report.metrics.map(m => '<tr><td>' + esc(A.term(m.name)) + '</td><td class="num">' + A.num(m.value) + ' <small class="muted">' + esc(A.term(m.unit)) + '</small></td><td>' + A.badge(m.method === 'counted' || m.method === 'system' ? 'ok' : 'warn', t('meth.' + m.method)) + '</td><td>' + esc(A.term(m.note) || '—') + '</td></tr>').join('') + '</tbody></table></div><p class="src">' + t('rep.submitted3', { d: A.date(b.report.submittedAt.slice(0, 10)) }) + '</p>';
  };
  A.snapshotHtml = b => {
    const op = Store.opp(b.oppId); const sn = b.snapshot;
    if (!sn) return '';
    const changed = !op || op.status === 'archived' || (op.version || 1) !== sn.version;
    return '<section class="panel tight"><div class="panel-head"><div><h2>' + t('snap.title') + '</h2><p>' + t('snap.sub', { v: sn.version, d: A.date((sn.takenAt || b.createdAt).slice(0, 10)) }) + '</p></div>' + (changed ? A.badge('warn', !op ? t('snap.deleted') : op.status === 'archived' ? t('snap.archived') : t('snap.changed')) : '') + '</div>' +
      '<dl class="dl"><dt>' + t('th.opportunity') + '</dt><dd>' + A.Lh(sn.title) + '</dd><dt>' + t('cat.type') + '</dt><dd>' + esc(A.typeL(sn.type)) + ' · ' + esc(A.areaL(sn.area)) + '</dd><dt>' + t('th.supplier') + '</dt><dd>' + esc(sn.supplierName ? A.L(sn.supplierName) : A.supName(b.supplierId)) + '</dd><dt>' + t('off.deliverables') + '</dt><dd>' + (b.offer ? b.offer.deliverables.map(esc).join('<br>') : '—') + '</dd></dl></section>';
  };

  V.c.booking = function (id) {
    const b = Store.booking(id); if (!b) return A.notFound();
    const p = Store.payment(b.paymentId); const po = Store.payout(b.payoutId);
    const o = b.outcome;
    const cpo = o && o.newCustomers > 0 ? Math.round(b.money.total / o.newCustomers) : null;
    const ros = o && o.revenueMinor > 0 ? (o.revenueMinor / b.money.total) : null;
    const canCancel = CON.States.can('booking', b.status, 'cancel');
    const canDispute = CON.States.can('booking', b.status, 'dispute');
    return A.head(b.number + ' · ' + (b.snapshot ? A.L(b.snapshot.title) : A.oppTitle(Store.opp(b.oppId))), t('bk.detailSub'), '', { href: '#c-bookings', label: t('nav.c.bookings') }) +
      errBox('bk:' + b.id) +
      '<section class="panel">' + A.timeline(b) + '</section>' +
      '<div class="brief-sum">' + A.fact(t('th.supplier'), esc(A.supName(b.supplierId))) + A.fact(t('th.dates'), A.date(b.from) + ' – ' + A.date(b.to), t('co.datesN', { n: (b.dates || []).length })) + A.fact(t('off.total'), A.money(b.money.total), t('inclVat')) +
      A.fact(t('bk.payment'), p ? '<a href="#c-payment-' + p.id + '">' + esc(t('pay.' + p.status)) + '</a>' : '—', p ? t('pm.' + p.method) : '') + A.fact(t('bk.payout'), po ? esc(t('payout.' + po.status)) : '—') + A.fact(t('th.status'), esc(t('bk.' + b.status))) + '</div>' +
      (b.status === 'completed' ? '<div class="notice warn">' + ic('info') + '<div><b>' + t('bk.confirmQ') + '</b><br>' + t('bk.confirmText3') + '<div class="form-actions" style="margin-top:10px">' + (!b.report ? '<span class="muted small">' + t('bk.needReport') + '</span>' : A.ui.confirm === 'deliver:' + b.id ? '<button class="btn btn-dark btn-sm" data-act="deliver" data-id="' + b.id + '">' + ic('check') + t('bk.confirmYes') + '</button><button class="btn btn-ghost btn-sm" data-act="confirm-cancel">' + t('cancel') + '</button>' : '<button class="btn btn-dark btn-sm" data-act="confirm" data-key="deliver:' + b.id + '">' + ic('check-circle') + t('bk.confirm') + '</button>') + '</div></div></div>' : '') +
      (canDispute ? '<details class="panel tight"><summary class="panel-head"><h2>' + t('dsp.openTitle') + '</h2></summary><form data-form="dispute" data-id="' + b.id + '" novalidate><div class="field"><label for="dsp-r">' + t('dsp.reason') + '</label><textarea class="textarea" id="dsp-r" name="reason" minlength="10" maxlength="1000" required></textarea><span class="hint">' + t('dsp.hint') + '</span></div><p class="error-text" data-error role="alert" hidden></p><button class="btn btn-danger btn-sm" type="submit">' + ic('flag') + t('dsp.submit') + '</button></form></details>' : '') +
      (canCancel ? '<div class="form-actions">' + (A.ui.confirm === 'cancel:' + b.id ? '<span class="small">' + t('bk.cancelQ') + '</span><button class="btn btn-danger btn-sm" data-act="bk-cancel" data-id="' + b.id + '">' + t('bk.cancelYes') + '</button><button class="btn btn-ghost btn-sm" data-act="confirm-cancel">' + t('cancel') + '</button>' : '<button class="btn btn-ghost btn-sm" data-act="confirm" data-key="cancel:' + b.id + '">' + ic('x') + t('bk.cancel') + '</button>') + '<span class="muted small">' + t('bk.cancelNote') + '</span></div>' : '') +
      A.snapshotHtml(b) +
      '<section class="panel"><div class="panel-head"><div><h2>' + t('rep.title') + '</h2><p>' + t('rep.sub3') + '</p></div></div>' + A.reportHtml(b) + '</section>' +
      (['completed', 'delivery_accepted'].includes(b.status) ? '<form class="panel" data-form="outcome" data-id="' + b.id + '" novalidate><div class="panel-head"><div><h2>' + t('out.title') + '</h2><p>' + t('out.sub') + '</p></div></div>' +
        '<div class="form-grid-3"><div class="field"><label for="out-n">' + t('out.customers') + '</label><input class="input" id="out-n" name="newCustomers" inputmode="numeric" value="' + (o && o.newCustomers != null ? o.newCustomers : '') + '"></div>' +
        '<div class="field"><label for="out-rev">' + t('out.revenue') + '</label><input class="input" id="out-rev" name="revenue" inputmode="decimal" value="' + (o && o.revenueMinor != null ? M.toDecimalString(o.revenueMinor) : '') + '"></div>' +
        '<div class="field"><label for="out-how">' + t('out.how') + '</label><select class="select" id="out-how" name="how">' + ['code', 'form', 'pos', 'other'].map(k => opt(k, t('how.' + k), o && o.how)).join('') + '</select></div></div>' +
        '<p class="error-text" data-error role="alert" hidden></p>' +
        '<div class="form-actions"><button class="btn btn-dark btn-sm" type="submit">' + ic('check') + t('save') + '</button><span class="muted small">' + t('out.declared') + '</span></div>' +
        (o ? '<div class="kpis">' + A.kpi('users', t('out.customers'), o.newCustomers != null ? A.num(o.newCustomers) : '—') + A.kpi('wallet', t('out.cpo'), cpo != null ? A.money(cpo) : '—', t('out.calc')) + A.kpi('chart', t('out.revenue'), o.revenueMinor != null ? A.money(o.revenueMinor) : '—') + A.kpi('target', t('out.ros'), ros != null ? ros.toFixed(2) + '×' : '—', t('out.calc')) + '</div>' : '') +
        '</form>' : '');
  };

  /* ---------- Results ---------- */
  V.c.results = function () {
    const list = Store.state.bookings.filter(b => b.report || b.outcome);
    const spend = M.sum(list.map(b => b.money.total));
    const withCust = list.filter(b => b.outcome && b.outcome.newCustomers);
    const cust = withCust.reduce((a, b) => a + b.outcome.newCustomers, 0);
    const custSpend = M.sum(withCust.map(b => b.money.total));
    return A.head(t('nav.c.results'), t('res.sub')) +
      '<div class="kpis">' + A.kpi('wallet', t('res.spend'), A.money(spend)) + A.kpi('chart', t('res.reported'), A.num(list.filter(b => b.report).length)) + A.kpi('users', t('out.customers'), cust ? A.num(cust) : '—', t('out.declared')) + A.kpi('target', t('out.cpo'), cust ? A.money(Math.round(custSpend / cust)) : '—', t('res.cpoBasis')) + '</div>' +
      (list.length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.booking') + '</th><th scope="col">' + t('th.opportunity') + '</th><th scope="col" class="num">' + t('res.spend') + '</th><th scope="col">' + t('res.supplierSays') + '</th><th scope="col">' + t('res.youSay') + '</th><th scope="col" class="num">' + t('out.cpo') + '</th></tr></thead><tbody>' +
        list.map(b => { const ms = (b.report && b.report.metrics) || []; const o = b.outcome; return '<tr><td><a href="#c-booking-' + b.id + '">' + esc(b.number) + '</a> ' + A.sampleTag(b) + '</td><td>' + esc(b.snapshot ? A.L(b.snapshot.title) : A.oppTitle(Store.opp(b.oppId))) + '</td><td class="num">' + A.money(b.money.total) + '</td><td>' + (ms.length ? ms.map(m => A.num(m.value) + ' ' + esc(A.term(m.unit)) + ' · ' + t('meth.' + m.method)).join('<br>') : '—') + '</td><td>' + (o && o.newCustomers ? t('res.newC', { n: A.num(o.newCustomers) }) : '<a href="#c-booking-' + b.id + '">' + t('res.add') + '</a>') + '</td><td class="num">' + (o && o.newCustomers ? A.money(Math.round(b.money.total / o.newCustomers)) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="panel">' + A.empty('chart', t('res.empty'), t('res.emptyText')) + '</div>') +
      '<p class="muted small">' + t('res.note3') + '</p>';
  };
})();
