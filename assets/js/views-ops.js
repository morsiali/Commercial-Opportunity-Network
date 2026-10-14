/* Platform: operations workspace (human-assisted backend for the pilot) */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App, Store = CON.Store;
  const t = A.t, esc = A.esc, ic = A.ic;
  const V = A.views = A.views || {};
  V.o = {};

  A.metrics = function () {
    const s = Store.state;
    const objs = s.objectives.length;
    const viewed = s.objectives.filter(o => o.planViewed).length;
    const lines = s.rfqs.reduce((a, r) => a + r.lines.length, 0);
    const replied = s.rfqs.reduce((a, r) => a + r.lines.filter(l => l.response).length, 0);
    const offered = s.rfqs.reduce((a, r) => a + r.lines.filter(l => l.response && l.response.status === 'offered').length, 0);
    const awarded = s.rfqs.filter(r => r.status === 'awarded').length;
    const gmv = s.transactions.reduce((a, x) => a + x.net, 0);
    const fees = s.transactions.reduce((a, x) => a + x.fee, 0);
    const firsts = s.rfqs.map(r => { const ts = r.lines.filter(l => l.response && l.response.respondedAt).map(l => new Date(l.response.respondedAt) - new Date(r.createdAt)); return ts.length ? Math.min.apply(null, ts) : null; }).filter(x => x != null && x >= 0);
    const invited = new Set(); const responding = new Set();
    s.rfqs.forEach(r => r.lines.forEach(l => { invited.add(l.supplierId); if (l.response) responding.add(l.supplierId); }));
    return {
      objs, viewed, completion: objs ? viewed / objs : null,
      rfqs: s.rfqs.length, lines, replied, offered, responseRate: lines ? replied / lines : null,
      awarded, conversion: s.rfqs.length ? awarded / s.rfqs.length : null,
      txs: s.transactions.length, gmv, fees, atv: s.transactions.length ? s.transactions.reduce((a, x) => a + x.total, 0) / s.transactions.length : null,
      takeRate: gmv ? fees / gmv : null,
      ttfo: firsts.length ? firsts.reduce((a, b) => a + b, 0) / firsts.length / 3600000 : null,
      retention: invited.size ? responding.size / invited.size : null, invited: invited.size, responding: responding.size,
      repeat: s.transactions.length >= 2
    };
  };
  const pct = v => v == null ? '—' : Math.round(v * 100) + '%';

  V.o.metrics = function () {
    const m = A.metrics();
    return A.head(t('nav.o.metrics'), t('o.metrics.sub')) +
      '<div class="kpis">' +
      A.kpi('target', t('m.completion'), pct(m.completion), t('m.completionN', { a: m.viewed, b: m.objs })) +
      A.kpi('file', t('m.rfqs'), A.num(m.rfqs), t('m.rfqsN')) +
      A.kpi('inbox', t('m.response'), pct(m.responseRate), t('m.responseN', { a: m.replied, b: m.lines })) +
      A.kpi('handshake', t('m.conversion'), pct(m.conversion), t('m.conversionN', { a: m.awarded, b: m.rfqs })) +
      A.kpi('wallet', t('m.atv'), m.atv == null ? '—' : A.money(Math.round(m.atv)), t('inclVat')) +
      A.kpi('chart', t('m.take'), pct(m.takeRate), t('m.takeN', { v: A.money(m.fees) })) +
      A.kpi('clock', t('m.ttfo'), m.ttfo == null ? '—' : t('m.hours', { n: m.ttfo.toFixed(1) })) +
      A.kpi('users', t('m.retention'), pct(m.retention), t('m.retentionN', { a: m.responding, b: m.invited })) +
      '</div>' +
      '<section class="panel"><div class="panel-head"><h2>' + t('m.notTracked') + '</h2></div><div class="rows">' +
      ['m.nt1', 'm.nt2', 'm.nt3'].map(k => '<div class="row"><span class="row-ico">' + ic('info') + '</span><span class="grow"><b>' + t(k) + '</b><small>' + t(k + 'd') + '</small></span></div>').join('') + '</div></section>' +
      '<p class="muted small">' + t('m.note') + '</p>';
  };

  V.o.verify = function () {
    const s = Store.state;
    const pending = s.suppliers.filter(x => x.verified === 'pending');
    const others = s.suppliers.filter(x => x.verified !== 'pending');
    return A.head(t('nav.o.verify'), t('o.verify.sub')) +
      '<section class="panel"><div class="panel-head"><h2>' + t('o.queue', { n: pending.length }) + '</h2></div>' +
      (pending.length ? '<div class="rows">' + pending.map(x => '<form class="row" data-form="verify" data-id="' + x.id + '" novalidate><span class="row-ico">' + ic('building') + '</span><span class="grow"><b>' + esc(A.L(x.name)) + '</b><small>' + esc(A.typeL(x.category)) + ' · ' + t('s.p.licence') + ' ' + esc(x.licence || '—') + ' · ' + esc(t('em.' + (x.emirate || 'Dubai'))) + (x.docName ? ' · ' + esc(x.docName) : '') + '</small></span><input class="input" name="note" maxlength="140" style="max-width:220px;height:36px" placeholder="' + esc(t('o.notePh')) + '" aria-label="' + esc(t('o.notePh')) + '"><button class="btn btn-dark btn-xs" type="submit" name="decision" value="verified">' + ic('check') + t('o.approve') + '</button><button class="btn btn-danger btn-xs" type="submit" name="decision" value="rejected">' + ic('x') + t('o.reject') + '</button></form>').join('') + '</div>' : A.empty('shield', t('o.queueEmpty'), t('o.queueEmptyText'))) + '</section>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.supplier') + '</th><th>' + t('s.p.category') + '</th><th>' + t('s.p.licence') + '</th><th>' + t('th.status') + '</th><th class="num">' + t('o.listings') + '</th></tr></thead><tbody>' +
      others.map(x => '<tr><td>' + esc(A.L(x.name)) + '</td><td>' + esc(A.typeL(x.category)) + '</td><td>' + esc(x.licence || '—') + '</td><td>' + A.verifiedBadge(x) + '</td><td class="num">' + s.opportunities.filter(o => o.supplierId === x.id).length + '</td></tr>').join('') + '</tbody></table></div>';
  };

  V.o.rfqs = function () {
    const s = Store.state;
    return A.head(t('nav.o.rfqs'), t('o.rfqs.sub')) +
      (s.rfqs.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.rfq') + '</th><th>' + t('th.sent') + '</th><th>' + t('o.progress') + '</th><th>' + t('o.pendingWith') + '</th><th>' + t('th.status') + '</th><th></th></tr></thead><tbody>' +
        s.rfqs.map(r => { const wait = r.lines.filter(l => !l.response); return '<tr><td><a href="#c-offers-' + r.id + '">' + esc(r.number) + '</a></td><td>' + A.since(r.createdAt) + '</td><td><div class="meter" style="width:120px"><i style="width:' + Math.round((r.lines.length - wait.length) / r.lines.length * 100) + '%"></i></div><small class="muted">' + (r.lines.length - wait.length) + ' / ' + r.lines.length + '</small></td><td>' + (wait.map(l => esc(A.supName(l.supplierId)) + (l.nudgedAt ? ' <small class="muted">(' + t('o.nudged') + ')</small>' : '')).join('<br>') || '—') + '</td><td>' + A.statusBadge('rfq', r.status) + '</td><td>' + (wait.length && r.status === 'open' ? '<button class="btn btn-light btn-xs" data-act="nudge" data-id="' + r.id + '">' + ic('bolt') + t('off.nudge') + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="panel">' + A.empty('file', t('rfqs.empty'), t('o.rfqsEmpty')) + '</div>');
  };

  V.o.payments = function () {
    const s = Store.state;
    const bks = s.bookings.slice().reverse();
    return A.head(t('nav.o.payments'), t('o.payments.sub')) +
      '<section class="panel"><div class="panel-head"><h2>' + t('o.incoming') + '</h2></div>' + (s.transactions.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('o.tx') + '</th><th>' + t('co.company') + '</th><th>' + t('co.method') + '</th><th class="num">' + t('off.net') + '</th><th class="num">' + t('o.fee') + '</th><th class="num">' + t('off.total') + '</th><th>' + t('th.status') + '</th><th></th></tr></thead><tbody>' +
        s.transactions.slice().reverse().map(x => '<tr><td>' + esc(x.number) + ' ' + A.sampleTag(x) + '<br><small class="muted">' + A.date(x.createdAt.slice(0, 10)) + '</small></td><td>' + esc(x.billing.company) + '</td><td>' + t('pm.' + x.method) + '</td><td class="num">' + A.money(x.net) + '</td><td class="num">' + A.money(x.fee) + '</td><td class="num">' + A.money(x.total) + '</td><td>' + A.statusBadge('tx', x.status) + '</td><td>' + (x.status === 'awaiting' ? '<button class="btn btn-dark btn-xs" data-act="mark-paid" data-id="' + x.id + '">' + t('o.markPaid') + '</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : A.empty('card', t('o.noTx'), t('o.noTxText'))) + '</section>' +
      '<section class="panel"><div class="panel-head"><div><h2>' + t('o.payouts') + '</h2><p>' + t('o.payoutsSub') + '</p></div></div>' + (bks.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>' + t('th.booking') + '</th><th>' + t('th.supplier') + '</th><th>' + t('th.status') + '</th><th class="num">' + t('s.youReceive') + '</th><th>' + t('bk.payout') + '</th><th></th></tr></thead><tbody>' +
        bks.map(b => { const tx = Store.tx(b.txId); return '<tr><td><a href="#c-booking-' + b.id + '">' + esc(b.number) + '</a></td><td>' + esc(A.supName(b.supplierId)) + '</td><td>' + A.statusBadge('bk', b.status) + '</td><td class="num">' + A.money(b.net) + '</td><td>' + A.statusBadge('payout', b.payout) + '</td><td>' + (b.payout === 'ready' && tx && tx.status === 'paid' ? '<button class="btn btn-dark btn-xs" data-act="release" data-id="' + b.id + '">' + t('o.release') + '</button>' : b.payout === 'ready' ? '<small class="muted">' + t('o.waitPay') + '</small>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : A.empty('wallet', t('o.noTx'), t('o.noTxText'))) + '</section>';
  };

  A.SCENARIOS = {
    stress: { atv: 8000, take: 5, proc: 2.5, ai: 15, support: 350, fixed: 60000, cac: 6000, freq: 2 },
    conservative: { atv: 15000, take: 7, proc: 2.5, ai: 10, support: 250, fixed: 45000, cac: 4000, freq: 3 },
    base: { atv: 25000, take: 8, proc: 2.2, ai: 8, support: 180, fixed: 45000, cac: 3000, freq: 4 }
  };
  A.econCalc = v => {
    const rev = v.atv * v.take / 100;
    const varCost = v.atv * v.proc / 100 + v.ai + v.support;
    const contrib = rev - varCost;
    return { rev, varCost, contrib, margin: rev ? contrib / rev : 0, breakEven: contrib > 0 ? Math.ceil(v.fixed / contrib) : null, payTx: contrib > 0 ? v.cac / contrib : null, payMonths: contrib > 0 && v.freq > 0 ? (v.cac / contrib) / (v.freq / 12) : null, yearContrib: contrib * v.freq - v.cac };
  };

  V.o.economics = function () {
    const sc = A.ui.scenario;
    const s = Store.state;
    const saved = (s.econ && s.econ[sc]) || A.SCENARIOS[sc];
    const r = A.econCalc(saved);
    const field = (k, label, step, suffix) => '<div class="field"><label for="ec-' + k + '">' + t(label) + (suffix ? ' <span class="muted">(' + suffix + ')</span>' : '') + '</label><input class="input" id="ec-' + k + '" name="' + k + '" type="number" min="0" step="' + step + '" value="' + saved[k] + '" data-live="econ"></div>';
    return A.head(t('nav.o.economics'), t('o.econ.sub')) +
      '<div class="scenario-tabs tabs">' + ['stress', 'conservative', 'base'].map(k => '<button type="button" class="' + (sc === k ? 'active' : '') + '" data-act="scenario" data-s="' + k + '">' + t('sc.' + k) + '</button>').join('') + '</div>' +
      '<form class="panel" data-form="econ" novalidate><div class="panel-head"><div><h2>' + t('ec.inputs') + '</h2><p>' + t('ec.inputsSub') + '</p></div><div class="head-actions"><button class="btn btn-light btn-sm" type="button" data-act="econ-pilot">' + ic('database') + t('ec.usePilot') + '</button><button class="btn btn-ghost btn-sm" type="button" data-act="econ-reset">' + ic('refresh') + t('ec.reset') + '</button></div></div>' +
      '<div class="form-grid-3">' + field('atv', 'ec.atv', 500, 'AED') + field('take', 'ec.take', .5, '%') + field('proc', 'ec.proc', .1, '%') + field('ai', 'ec.ai', 1, 'AED') + field('support', 'ec.support', 10, 'AED') + field('fixed', 'ec.fixed', 1000, 'AED') + field('cac', 'ec.cac', 100, 'AED') + field('freq', 'ec.freq', 1, '') + '</div></form>' +
      '<div class="econ-out" data-econ-out>' + A.econOut(r) + '</div>' +
      '<p class="muted small">' + t('ec.note') + '</p>';
  };
  A.econOut = r => A.kpi('wallet', t('ec.rev'), A.money(Math.round(r.rev)), t('ec.perTx')) + A.kpi('minus', t('ec.var'), A.money(Math.round(r.varCost)), t('ec.perTx')) +
    A.kpi('chart', t('ec.contrib'), '<span style="color:' + (r.contrib > 0 ? 'var(--ok)' : 'var(--bad)') + '">' + A.money(Math.round(r.contrib)) + '</span>', t('ec.margin', { p: Math.round(r.margin * 100) })) +
    A.kpi('target', t('ec.breakeven'), r.breakEven == null ? t('ec.never') : A.num(r.breakEven), t('ec.perMonth')) +
    A.kpi('users', t('ec.payback'), r.payTx == null ? t('ec.never') : r.payTx.toFixed(1), r.payMonths == null ? '' : t('ec.months', { n: r.payMonths.toFixed(1) })) +
    A.kpi('flag', t('ec.year1'), '<span style="color:' + (r.yearContrib > 0 ? 'var(--ok)' : 'var(--bad)') + '">' + A.money(Math.round(r.yearContrib)) + '</span>', t('ec.afterCac'));

  A.KILLS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'];
  V.o.kill = function () {
    const s = Store.state; const m = A.metrics();
    const hints = { k1: t('kh.k1'), k2: t('kh.k2', { v: pct(m.responseRate) }), k3: t('kh.k3', { n: s.opportunities.length, sup: s.suppliers.length }), k4: t('kh.k4', { v: pct(m.conversion) }), k5: t('kh.k5', { n: m.txs }), k6: t('kh.k6') };
    const states = A.KILLS.map(k => (s.kill[k] && s.kill[k].status) || 'untested');
    const verdict = states.includes('triggered') ? 'nogo' : states.every(x => x === 'cleared') ? 'go' : 'wait';
    return A.head(t('nav.o.kill'), t('o.kill.sub')) +
      '<section class="panel ' + (verdict === 'nogo' ? 'warn' : 'soft') + '"><div class="panel-head"><div><small class="muted">' + t('kill.verdict') + '</small><div class="verdict ' + verdict + '">' + t('kill.v.' + verdict) + '</div></div><span class="muted small">' + t('kill.count', { c: states.filter(x => x === 'cleared').length, w: states.filter(x => x === 'watching').length, tr: states.filter(x => x === 'triggered').length }) + '</span></div><p class="small">' + t('kill.vd.' + verdict) + '</p></section>' +
      A.KILLS.map(k => { const cur = s.kill[k] || {}; return '<form class="panel" data-form="kill" data-k="' + k + '" novalidate><div class="panel-head"><div><h2>' + t('kill.' + k) + '</h2><p>' + esc(hints[k]) + '</p></div><div class="chip-group">' + ['untested', 'watching', 'triggered', 'cleared'].map(st => '<label class="chip"><input type="radio" name="status" value="' + st + '" data-live="kill" data-k="' + k + '"' + ((cur.status || 'untested') === st ? ' checked' : '') + '><span>' + t('ks.' + st) + '</span></label>').join('') + '</div></div><div class="field"><label for="kn-' + k + '">' + t('kill.evidence') + '</label><textarea class="textarea" id="kn-' + k + '" name="note" maxlength="500" style="min-height:70px" data-live="killnote" data-k="' + k + '" placeholder="' + esc(t('kill.evidencePh')) + '">' + esc(cur.note || '') + '</textarea></div></form>'; }).join('');
  };
})();
