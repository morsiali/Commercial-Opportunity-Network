/* Platform: operations workspace (human-assisted back office for the pilot, v3) */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App, Store = CON.Store, M = CON.Money, Dm = CON.Domain, Dt = CON.Dates;
  const t = A.t, esc = A.esc, ic = A.ic;
  const V = A.views = A.views || {};
  V.o = {};
  const errBox = key => A.ui.errors[key] ? A.errHtml(A.ui.errors[key]) : '';

  /* Metrics are computed separately for sample records and for records created in this browser,
     and simulated supplier replies are counted apart from real ones. */
  A.metrics = function (scope) {
    const s = Store.state;
    const keep = x => scope === 'sample' ? !!x.sample : scope === 'all' ? true : !x.sample;
    const objs = s.objectives.filter(keep);
    const rfqs = s.rfqs.filter(keep);
    const lines = [].concat.apply([], rfqs.map(r => r.lines));
    const replied = lines.filter(l => l.status !== 'requested');
    const simulated = replied.filter(l => (l.offers || []).some(v => v.simulated) || l.simulated);
    const pays = s.payments.filter(keep).filter(p => ['paid', 'partially_refunded', 'refunded'].includes(p.status));
    const gmv = M.sum(pays.map(p => p.amount.net));
    const fees = M.sum(pays.map(p => p.amount.fee));
    const bks = s.bookings.filter(keep);
    const live = bks.filter(b => !['cancelled', 'expired'].includes(b.status));
    const paidIds = new Set(pays.map(p => p.id));
    const refunds = s.refunds.filter(r => r.status === 'processed' && bks.some(b => b.id === r.bookingId));
    const refundedBk = new Set(refunds.map(r => r.bookingId));
    const pos = s.payouts.filter(p => bks.some(b => b.id === p.bookingId));
    const finance = {
      booked: M.sum(live.map(b => b.money.total)),                                             // all bookings not cancelled or expired, incl. VAT
      paid: M.sum(pays.map(p => p.amount.total)),                                               // payments received, incl. VAT
      refunds: M.sum(refunds.map(r => r.amount)),
      feesEarned: M.sum(bks.filter(b => b.status === 'delivery_accepted' && !refundedBk.has(b.id)).map(b => b.money.fee)), // fee on accepted delivery
      feesCollected: M.sum(bks.filter(b => paidIds.has(b.paymentId)).map(b => b.money.fee)),    // fee inside payments received
      liabilities: M.sum(pos.filter(p => ['held', 'eligible', 'releasing', 'withheld'].includes(p.status) && bks.some(b => b.id === p.bookingId && paidIds.has(b.paymentId))).map(p => p.amount)),
      released: M.sum(pos.filter(p => p.status === 'released').map(p => p.amount))
    };
    finance.net = finance.feesEarned - M.sum(refunds.map(r => { const b = bks.find(x => x.id === r.bookingId); return b ? b.money.fee : 0; }));
    const firsts = rfqs.map(r => { const ts = r.lines.map(l => (l.offers || [])[0]).filter(Boolean).map(v => Date.parse(v.at) - Date.parse(r.createdAt)); return ts.length ? Math.min.apply(null, ts) : null; }).filter(x => x != null && x >= 0);
    const invited = new Set(); const responding = new Set();
    rfqs.forEach(r => r.lines.forEach(l => { invited.add(l.supplierId); if (l.status !== 'requested') responding.add(l.supplierId); }));
    const awarded = rfqs.filter(r => ['awarded', 'partially_awarded'].includes(r.status)).length;
    return {
      objs: objs.length, viewed: objs.filter(o => o.planViewed).length,
      rfqs: rfqs.length, lines: lines.length, replied: replied.length, simulated: simulated.length, real: replied.length - simulated.length,
      responseRate: lines.length ? replied.length / lines.length : null,
      awarded, conversion: rfqs.length ? awarded / rfqs.length : null,
      txs: pays.length, gmv, fees, finance, atv: pays.length ? Math.round(gmv / pays.length) : null,
      takeRate: gmv ? fees / gmv : null,
      ttfo: firsts.length ? firsts.reduce((a, b) => a + b, 0) / firsts.length / 3600000 : null,
      retention: invited.size ? responding.size / invited.size : null, invited: invited.size, responding: responding.size
    };
  };
  const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
  function metricBlock(m, scope) {
    return '<section class="panel' + (scope === 'sample' ? ' soft' : '') + '"><div class="panel-head"><div><h2>' + t('m.scope.' + scope) + '</h2><p>' + t('m.scopeSub.' + scope) + '</p></div></div><div class="kpis">' +
      A.kpi('target', t('m.completion'), pct(m.objs ? m.viewed / m.objs : null), t('m.completionN', { a: m.viewed, b: m.objs })) +
      A.kpi('file', t('m.rfqs'), A.num(m.rfqs), t('m.rfqsN')) +
      A.kpi('inbox', t('m.response'), pct(m.responseRate), t('m.responseN3', { a: m.replied, b: m.lines, s: m.simulated })) +
      A.kpi('handshake', t('m.conversion'), pct(m.conversion), t('m.conversionN', { a: m.awarded, b: m.rfqs })) +
      A.kpi('wallet', t('m.atv'), m.atv == null ? '—' : A.money(m.atv), t('m.paidOnly')) +
      A.kpi('chart', t('m.take'), pct(m.takeRate), t('m.takeN', { v: A.money(m.fees) })) +
      A.kpi('clock', t('m.ttfo'), m.ttfo == null ? '—' : t('m.hours', { n: m.ttfo.toFixed(1) }), m.simulated ? t('m.ttfoSim') : '') +
      A.kpi('users', t('m.retention'), pct(m.retention), t('m.retentionN', { a: m.responding, b: m.invited })) +
      '</div><div class="table-wrap"><table class="t"><caption class="sr-only">' + t('fin.title') + '</caption><tbody>' +
      ['booked', 'paid', 'refunds', 'feesEarned', 'feesCollected', 'liabilities', 'released', 'net'].map(k => '<tr><th scope="row">' + t('fin.' + k) + '<br><small class="muted">' + t('fin.' + k + '.d') + '</small></th><td class="num">' + A.money(m.finance[k]) + '</td></tr>').join('') +
      '</tbody></table></div></section>';
  }

  V.o.metrics = function () {
    return A.head(t('nav.o.metrics'), t('o.metrics.sub3')) +
      '<div class="notice">' + ic('info') + '<div>' + t('m.honest') + ' <a href="#o-pilot">' + t('nav.o.pilot') + '</a></div></div>' +
      metricBlock(A.metrics('user'), 'user') + metricBlock(A.metrics('sample'), 'sample') +
      '<section class="panel"><div class="panel-head"><h2>' + t('m.defs') + '</h2></div><dl class="dl">' + ['completion', 'response', 'conversion', 'atv', 'take', 'ttfo', 'retention'].map(k => '<dt>' + t('m.' + k) + '</dt><dd>' + t('md.' + k) + '</dd>').join('') + '</dl></section>' +
      '<section class="panel"><div class="panel-head"><h2>' + t('m.notTracked') + '</h2></div><div class="rows">' +
      ['m.nt1', 'm.nt2', 'm.nt3'].map(k => '<div class="row"><span class="row-ico">' + ic('info') + '</span><span class="grow"><b>' + t(k) + '</b><small>' + t(k + 'd') + '</small></span></div>').join('') + '</div></section>';
  };

  /* ---------- Verification review ---------- */
  V.o.verify = function () {
    const s = Store.state;
    const queue = s.suppliers.filter(x => x.verification && ['submitted', 'info_requested'].includes(x.verification.status));
    const others = s.suppliers.filter(x => !queue.includes(x));
    return A.head(t('nav.o.verify'), t('o.verify.sub3')) +
      '<section class="panel"><div class="panel-head"><h2>' + t('o.queue', { n: queue.length }) + '</h2></div>' +
      (queue.length ? queue.map(x => {
        const v = x.verification; const docs = v.documents || [];
        const reviewable = docs.filter(d => d.storage === 'demo-sample' || d.storage === 'server');
        return '<form class="panel tight" data-form="verify" data-id="' + x.id + '" novalidate><div class="panel-head"><div><h3>' + esc(A.L(x.name)) + '</h3><p class="small">' + esc(A.typeL(x.category)) + ' · ' + t('s.p.licence') + ' ' + esc(x.licenceNumber || '—') + ' · ' + esc(t('em.' + (x.emirate || 'Dubai'))) + '</p></div>' + A.verifiedBadge(x) + '</div>' +
          errBox('verify:' + x.id) +
          (v.legacyNote ? '<div class="notice warn">' + ic('alert') + '<div>' + t('o.v.legacy') + '</div></div>' : '') +
          '<ul class="plain small">' + (docs.length ? docs.map(d => '<li>' + ic('file') + ' ' + esc(d.fileName) + ' · ' + A.badge(d.storage === 'demo-sample' ? 'info' : d.storage === 'server' ? 'ok' : 'warn', t('stor.' + d.storage)) + (d.storage === 'demo-sample' ? ' <button class="link-btn" type="button" data-act="sample-doc" data-id="' + x.id + '">' + t('o.v.viewSample') + '</button>' : '') + '</li>').join('') : '<li>' + t('s.v.noDocs') + '</li>') + '</ul>' +
          (reviewable.length ? '<fieldset class="field"><legend class="label">' + t('o.v.checks') + '</legend>' + ['nameMatches', 'numberMatches', 'documentLegible'].map(k => '<label class="check"><input type="checkbox" name="' + k + '"><span>' + t('o.v.' + k) + '</span></label>').join('') + '</fieldset>' +
            '<div class="form-grid"><div class="field"><label for="vx-' + x.id + '">' + t('o.v.expiry') + '</label><input class="input" id="vx-' + x.id + '" name="licenceExpiry" type="date" min="' + Dt.addDays(A.today(), 1) + '"></div>' : '<div class="notice">' + ic('info') + '<div>' + t('o.v.noReviewable') + '</div></div><div class="form-grid">') +
          '<div class="field"><label for="vn-' + x.id + '">' + t('o.v.reason') + '</label><input class="input" id="vn-' + x.id + '" name="reason" maxlength="200" placeholder="' + esc(t('o.notePh')) + '"></div></div>' +
          '<div class="form-actions">' + (reviewable.length ? '<button class="btn btn-dark btn-xs" type="submit" name="decision" value="approve">' + ic('check') + t('o.approve3') + '</button>' : '') + '<button class="btn btn-light btn-xs" type="submit" name="decision" value="request_info">' + ic('info') + t('o.requestInfo') + '</button><button class="btn btn-danger btn-xs" type="submit" name="decision" value="reject">' + ic('x') + t('o.reject') + '</button></div>' +
          (s.mode === 'demo' || true ? '<p class="src">' + t('o.v.demoNote') + '</p>' : '') + '</form>';
      }).join('') : A.empty('shield', t('o.queueEmpty'), t('o.queueEmptyText'))) + '</section>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.supplier') + '</th><th scope="col">' + t('s.p.category') + '</th><th scope="col">' + t('s.p.licence') + '</th><th scope="col">' + t('th.status') + '</th><th scope="col">' + t('s.v.expiryShort') + '</th><th scope="col" class="num">' + t('o.listings') + '</th></tr></thead><tbody>' +
      others.map(x => '<tr><td>' + esc(A.L(x.name)) + '</td><td>' + esc(A.typeL(x.category)) + '</td><td>' + esc(x.licenceNumber || '—') + '</td><td>' + A.verifiedBadge(x) + '</td><td>' + (x.verification && x.verification.licenceExpiry ? A.date(x.verification.licenceExpiry) : '—') + '</td><td class="num">' + s.opportunities.filter(o => o.supplierId === x.id).length + '</td></tr>').join('') + '</tbody></table></div>';
  };

  V.o.rfqs = function () {
    const s = Store.state;
    return A.head(t('nav.o.rfqs'), t('o.rfqs.sub')) +
      (s.rfqs.length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.rfq') + '</th><th scope="col">' + t('th.sent') + '</th><th scope="col">' + t('o.progress') + '</th><th scope="col">' + t('o.pendingWith') + '</th><th scope="col">' + t('th.status') + '</th><th scope="col"><span class="sr-only">' + t('actions') + '</span></th></tr></thead><tbody>' +
        s.rfqs.map(r => { const wait = r.lines.filter(l => l.status === 'requested'); return '<tr><td><a href="#c-offers-' + r.id + '">' + esc(r.number) + '</a> ' + A.sampleTag(r) + '</td><td>' + A.since(r.createdAt) + '</td><td><div class="meter" style="width:120px" aria-hidden="true"><i style="width:' + Math.round((r.lines.length - wait.length) / r.lines.length * 100) + '%"></i></div><small class="muted">' + (r.lines.length - wait.length) + ' / ' + r.lines.length + '</small></td><td>' + (wait.map(l => esc(A.supName(l.supplierId))).join('<br>') || '—') + '</td><td>' + A.statusBadge('rfq', r.status) + '</td><td>' + (wait.length ? '<button class="btn btn-light btn-xs" data-act="nudge" data-id="' + r.id + '">' + ic('bolt') + t('off.nudge') + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="panel">' + A.empty('file', t('rfqs.empty'), t('o.rfqsEmpty')) + '</div>');
  };

  /* ---------- Payments, holds, refunds, disputes and payouts ---------- */
  V.o.payments = function () {
    const s = Store.state;
    const ctx = Store.ctx();
    const disputes = s.disputes.filter(d => ['open', 'under_review'].includes(d.status));
    const refunds = s.refunds.filter(r => ['requested', 'approved', 'failed'].includes(r.status));
    return A.head(t('nav.o.payments'), t('o.payments.sub3')) +
      errBox('ops-pay') +
      '<section class="panel"><div class="panel-head"><h2>' + t('o.incoming') + '</h2></div>' + (s.payments.length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('o.tx') + '</th><th scope="col">' + t('co.company') + '</th><th scope="col">' + t('co.method') + '</th><th scope="col" class="num">' + t('off.net') + '</th><th scope="col" class="num">' + t('o.fee') + '</th><th scope="col" class="num">' + t('off.vatShort') + '</th><th scope="col" class="num">' + t('off.total') + '</th><th scope="col">' + t('th.status') + '</th><th scope="col"><span class="sr-only">' + t('actions') + '</span></th></tr></thead><tbody>' +
        s.payments.map(x => '<tr><td><a href="#c-payment-' + x.id + '">' + esc(x.number) + '</a> ' + A.sampleTag(x) + (x.legacy ? ' <span class="tag">' + t('legacy') + '</span>' : '') + '<br><small class="muted">' + A.dateTime(x.createdAt) + '</small></td><td>' + esc(x.billing.company || '—') + '</td><td>' + t('pm.' + x.method) + '</td><td class="num">' + A.money(x.amount.net) + '</td><td class="num">' + A.money(x.amount.fee) + '</td><td class="num">' + A.money(x.amount.vat) + '</td><td class="num">' + A.money(x.amount.total) + '</td><td>' + A.statusBadge('pay', x.status) + (x.status === 'awaiting' && x.expiresAt ? '<br><small class="muted">' + t('pay.holdUntil') + ' ' + A.dateTime(x.expiresAt) + '</small>' : '') + '</td><td>' + (x.status === 'awaiting' ? '<button class="btn btn-dark btn-xs" data-act="sim-pay" data-id="' + x.id + '" data-ok="1">' + t('o.simReceived') + '</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : A.empty('card', t('o.noTx'), t('o.noTxText'))) + '<p class="src">' + t('o.payNote') + '</p></section>' +
      '<section class="panel"><div class="panel-head"><h2>' + t('o.disputes', { n: disputes.length }) + '</h2></div>' + (disputes.length ? disputes.map(d => { const b = Store.booking(d.bookingId); return '<form class="panel tight" data-form="resolve" data-id="' + d.id + '" novalidate><div class="panel-head"><div><h3>' + esc(d.number) + ' · ' + esc(b ? b.number : '') + '</h3><p class="small">' + esc(d.reason) + '</p></div>' + A.statusBadge('dsp', d.status) + '</div>' + errBox('resolve:' + d.id) + '<div class="field"><label for="rs-' + d.id + '">' + t('o.resolution') + '</label><input class="input" id="rs-' + d.id + '" name="reason" maxlength="300" required></div><div class="form-actions"><button class="btn btn-dark btn-xs" type="submit" name="outcome" value="supplier">' + t('o.resolveSupplier') + '</button><button class="btn btn-danger btn-xs" type="submit" name="outcome" value="customer">' + t('o.resolveCustomer') + '</button></div></form>'; }).join('') : A.empty('flag', t('o.noDisputes'), t('o.noDisputesText'))) + '</section>' +
      '<section class="panel"><div class="panel-head"><h2>' + t('o.refunds', { n: refunds.length }) + '</h2></div>' + (refunds.length ? '<div class="rows">' + refunds.map(r => '<div class="row"><span class="row-ico">' + ic('refresh') + '</span><span class="grow"><b>' + esc(r.number) + ' · ' + A.money(r.amount) + '</b><small>' + esc(r.reason) + '</small></span>' + A.statusBadge('rf', r.status) + (r.status === 'requested' ? '<button class="btn btn-dark btn-xs" data-act="refund-approve" data-id="' + r.id + '">' + t('o.approveRefund') + '</button><button class="btn btn-ghost btn-xs" data-act="refund-reject" data-id="' + r.id + '">' + t('o.rejectRefund') + '</button>' : '') + (['approved', 'failed'].includes(r.status) ? '<button class="btn btn-dark btn-xs" data-act="refund-process" data-id="' + r.id + '">' + t('o.simRefund') + '</button>' : '') + '</div>').join('') + '</div>' : A.empty('refresh', t('o.noRefunds'), t('o.noRefundsText'))) + '</section>' +
      '<section class="panel"><div class="panel-head"><div><h2>' + t('o.payouts') + '</h2><p>' + t('o.payoutsSub3') + '</p></div></div>' + (s.payouts.length ? '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('th.booking') + '</th><th scope="col">' + t('th.supplier') + '</th><th scope="col" class="num">' + t('s.youReceive') + '</th><th scope="col">' + t('bk.payout') + '</th><th scope="col">' + t('guard.title') + '</th><th scope="col"><span class="sr-only">' + t('actions') + '</span></th></tr></thead><tbody>' +
        s.payouts.map(po => { const b = Store.booking(po.bookingId); const g = b ? Dm.payoutGuards(s, b.id, ctx) : []; const ok = g.length && g.every(x => x.ok); return '<tr><td>' + (b ? '<a href="#c-booking-' + b.id + '">' + esc(b.number) + '</a> ' + A.statusBadge('bk', b.status) : '—') + (po.legacyNote ? '<br><small class="muted">' + t('o.legacyPayout') + '</small>' : '') + '</td><td>' + esc(A.supName(po.supplierId)) + '</td><td class="num">' + A.money(po.amount) + '</td><td>' + A.statusBadge('payout', po.status) + (po.simulated ? ' <span class="tag sim">' + t('simulated') + '</span>' : '') + '</td><td><ul class="checks compact">' + g.map(x => '<li class="ck ' + (x.ok ? 'pass' : 'fail') + '">' + ic(x.ok ? 'check' : 'x') + '<span>' + t('guard.' + x.guard) + '</span></li>').join('') + '</ul></td><td>' + (po.status === 'eligible' && ok ? '<button class="btn btn-dark btn-xs" data-act="release" data-id="' + po.id + '">' + t('o.release3') + '</button>' : po.status === 'released' ? '' : '<span class="muted small">' + t('o.notReady') + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : A.empty('wallet', t('o.noTx'), t('o.noTxText'))) + '</section>';
  };

  /* ---------- Audit log ---------- */
  V.o.audit = function () {
    const s = Store.state;
    const f = A.ui.auditFilter || '';
    const list = s.audit.slice().reverse().filter(a => !f || a.entity === f).slice(0, 300);
    const ents = Array.from(new Set(s.audit.map(a => a.entity)));
    return A.head(t('nav.o.audit'), t('o.audit.sub')) +
      '<div class="panel"><div class="field" style="max-width:280px"><label for="au-f">' + t('o.audit.filter') + '</label><select class="select" id="au-f" data-live="auditfilter"><option value="">' + t('all') + '</option>' + ents.map(e => '<option value="' + e + '"' + (e === f ? ' selected' : '') + '>' + esc(t('ent.' + e)) + '</option>').join('') + '</select></div></div>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th scope="col">' + t('o.audit.when') + '</th><th scope="col">' + t('o.audit.who') + '</th><th scope="col">' + t('o.audit.what') + '</th><th scope="col">' + t('o.audit.change') + '</th><th scope="col">' + t('o.audit.reason') + '</th></tr></thead><tbody>' +
      list.map(a => '<tr><td>' + A.dateTime(a.at) + (a.sample ? ' <span class="tag">' + t('sample') + '</span>' : '') + '</td><td>' + esc(a.actor) + '</td><td>' + esc(t('ent.' + a.entity)) + ' <small class="muted">' + esc(a.entityId) + '</small></td><td>' + esc(a.event) + (a.from || a.to ? '<br><small class="muted">' + esc((a.from || '—') + ' → ' + (a.to || '—')) + '</small>' : '') + '</td><td>' + esc(a.reason || '') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<p class="muted small">' + t('o.audit.note', { n: s.audit.length }) + '</p>';
  };

  /* ---------- Pilot validation checklist (business evidence still to collect) ---------- */
  A.PILOT = ['wtp', 'repeat', 'response', 'availability', 'timesaved', 'support', 'margin', 'fee', 'tax', 'legal', 'payments', 'verification', 'privacy'];
  V.o.pilot = function () {
    const s = Store.state; s.pilot = s.pilot || {};
    const done = A.PILOT.filter(k => s.pilot[k] && s.pilot[k].status === 'validated').length;
    return A.head(t('nav.o.pilot'), t('o.pilot.sub')) +
      '<section class="panel soft"><div class="panel-head"><div><h2>' + t('pv.progress', { a: done, b: A.PILOT.length }) + '</h2><p>' + t('pv.note') + '</p></div></div></section>' +
      A.PILOT.map(k => { const cur = s.pilot[k] || {}; return '<form class="panel" data-form="pilot" data-k="' + k + '" novalidate><div class="panel-head"><div><h2>' + t('pv.' + k) + '</h2><p>' + t('pv.' + k + '.d') + '</p></div><div class="seg" role="radiogroup" aria-label="' + esc(t('th.status')) + '">' + ['open', 'in_progress', 'validated', 'failed'].map(st => '<label><input type="radio" name="status" value="' + st + '" data-live="pilot" data-k="' + k + '"' + ((cur.status || 'open') === st ? ' checked' : '') + '><span>' + t('pvs.' + st) + '</span></label>').join('') + '</div></div><div class="field"><label for="pv-' + k + '">' + t('kill.evidence') + '</label><textarea class="textarea" id="pv-' + k + '" name="note" maxlength="600" style="min-height:64px" data-live="pilotnote" data-k="' + k + '" placeholder="' + esc(t('pv.ph')) + '">' + esc(cur.note || '') + '</textarea></div></form>'; }).join('');
  };

  A.SCENARIOS = CON.Econ.SCENARIOS;
  A.econCalc = CON.Econ.calc;

  V.o.economics = function () {
    const sc = A.ui.scenario;
    const s = Store.state;
    const saved = (s.econ && s.econ[sc]) || A.SCENARIOS[sc];
    const r = A.econCalc(saved);
    const field = (k, label, step, suffix) => '<div class="field"><label for="ec-' + k + '">' + t(label) + (suffix ? ' <span class="muted">(' + suffix + ')</span>' : '') + '</label><input class="input" id="ec-' + k + '" name="' + k + '" type="number" min="0" step="' + step + '" value="' + (saved[k] != null ? saved[k] : A.SCENARIOS[sc][k]) + '" data-live="econ"></div>';
    return A.head(t('nav.o.economics'), t('o.econ.sub')) +
      '<div class="notice warn">' + ic('info') + '<div>' + t('ec.assumptions') + '</div></div>' +
      '<div class="scenario-tabs tabs" role="group" aria-label="' + esc(t('ec.scenario')) + '">' + ['stress', 'conservative', 'base'].map(k => '<button type="button" aria-pressed="' + (sc === k) + '" class="' + (sc === k ? 'active' : '') + '" data-act="scenario" data-s="' + k + '">' + t('sc.' + k) + '</button>').join('') + '</div>' +
      '<form class="panel" data-form="econ" novalidate><div class="panel-head"><div><h2>' + t('ec.inputs') + '</h2><p>' + t('ec.inputsSub') + '</p></div><div class="head-actions"><button class="btn btn-light btn-sm" type="button" data-act="econ-pilot">' + ic('database') + t('ec.usePilot') + '</button><button class="btn btn-ghost btn-sm" type="button" data-act="econ-reset">' + ic('refresh') + t('ec.reset') + '</button></div></div>' +
      '<div class="form-grid-3">' + field('atv', 'ec.atv', 500, 'AED') + field('take', 'ec.take', .5, '%') + field('proc', 'ec.proc', .1, '%') + field('ai', 'ec.ai', 1, 'AED') + field('support', 'ec.support', 10, 'AED') + field('refunds', 'ec.refunds', .5, '%') + field('fixed', 'ec.fixed', 1000, 'AED') + field('cac', 'ec.cac', 100, 'AED') + field('freq', 'ec.freq', 1, '') + '</div></form>' +
      '<div class="econ-out" data-econ-out aria-live="polite">' + A.econOut(r) + '</div>' +
      '<p class="muted small">' + t('ec.note') + '</p>';
  };
  A.econOut = r => A.kpi('wallet', t('ec.rev'), A.aed(Math.round(r.rev)), t('ec.perTx')) + A.kpi('minus', t('ec.var'), A.aed(Math.round(r.varCost)), t('ec.perTx')) +
    A.kpi('chart', t('ec.contrib'), '<span style="color:' + (r.contrib > 0 ? 'var(--ok)' : 'var(--bad)') + '">' + A.aed(Math.round(r.contrib)) + '</span>', t('ec.margin', { p: Math.round(r.margin * 100) })) +
    A.kpi('target', t('ec.breakeven'), r.breakEven == null ? t('ec.never') : A.num(r.breakEven), t('ec.perMonth')) +
    A.kpi('users', t('ec.payback'), r.payTx == null ? t('ec.never') : r.payTx.toFixed(1), r.payMonths == null ? '' : t('ec.months', { n: r.payMonths.toFixed(1) })) +
    A.kpi('flag', t('ec.year1'), '<span style="color:' + (r.yearContrib > 0 ? 'var(--ok)' : 'var(--bad)') + '">' + A.aed(Math.round(r.yearContrib)) + '</span>', t('ec.afterCac'));

  A.KILLS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'];
  V.o.kill = function () {
    const s = Store.state; const m = A.metrics('user');
    const hints = { k1: t('kh.k1'), k2: t('kh.k2', { v: pct(m.responseRate) }), k3: t('kh.k3', { n: s.opportunities.length, sup: s.suppliers.length }), k4: t('kh.k4', { v: pct(m.conversion) }), k5: t('kh.k5', { n: m.txs }), k6: t('kh.k6') };
    const states = A.KILLS.map(k => (s.kill[k] && s.kill[k].status) || 'untested');
    const verdict = states.includes('triggered') ? 'nogo' : states.every(x => x === 'cleared') ? 'go' : 'wait';
    return A.head(t('nav.o.kill'), t('o.kill.sub')) +
      '<section class="panel ' + (verdict === 'nogo' ? 'warn' : 'soft') + '"><div class="panel-head"><div><small class="muted">' + t('kill.verdict') + '</small><div class="verdict ' + verdict + '">' + t('kill.v.' + verdict) + '</div></div><span class="muted small">' + t('kill.count', { c: states.filter(x => x === 'cleared').length, w: states.filter(x => x === 'watching').length, tr: states.filter(x => x === 'triggered').length }) + '</span></div><p class="small">' + t('kill.vd.' + verdict) + '</p><p class="src">' + t('kill.userOnly') + '</p></section>' +
      A.KILLS.map(k => { const cur = s.kill[k] || {}; return '<form class="panel" data-form="kill" data-k="' + k + '" novalidate><div class="panel-head"><div><h2>' + t('kill.' + k) + '</h2><p>' + esc(hints[k]) + '</p></div><div class="seg" role="radiogroup" aria-label="' + esc(t('th.status')) + '">' + ['untested', 'watching', 'triggered', 'cleared'].map(st => '<label><input type="radio" name="status" value="' + st + '" data-live="kill" data-k="' + k + '"' + ((cur.status || 'untested') === st ? ' checked' : '') + '><span>' + t('ks.' + st) + '</span></label>').join('') + '</div></div><div class="field"><label for="kn-' + k + '">' + t('kill.evidence') + '</label><textarea class="textarea" id="kn-' + k + '" name="note" maxlength="500" style="min-height:70px" data-live="killnote" data-k="' + k + '" placeholder="' + esc(t('kill.evidencePh')) + '">' + esc(cur.note || '') + '</textarea></div></form>'; }).join('');
  };
})();
