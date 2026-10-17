/* Platform: shared helpers and UI components */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App = CON.App || {};
  const E = CON.Engine, D = CON.DATA, Store = CON.Store, M = CON.Money, Dt = CON.Dates;

  A.lang = CON.getLang();
  A.ui = { planTab: 'rec', planView: 'cards', cat: { q: '', type: '', area: '', max: '', obj: '' }, compareObj: '', scenario: 'conservative', confirm: null, importRows: null, upload: null, errors: {}, coKeys: {}, includeSample: false, offerForm: {} };

  A.t = function (key, p) {
    const dict = CON.APP_STR[A.lang] || CON.APP_STR.en;
    let s = dict[key];
    if (s == null) s = CON.APP_STR.en[key];
    if (s == null) { const m = CON.missingKeys = CON.missingKeys || new Set(); if (!m.has(key)) { m.add(key); console.warn('[i18n] missing key: ' + key); } return key; } /* reported so tests fail on untranslated text */
    if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m));
    return s;
  };
  const t = A.t;
  /* Bilingual field: falls back to the other language and says so, never silently. */
  A.Lx = x => {
    if (x == null) return { text: '', fallback: false };
    if (typeof x === 'string') return { text: x, fallback: false };
    const own = x[A.lang], other = x[A.lang === 'ar' ? 'en' : 'ar'];
    if (own && String(own).trim()) return { text: own, fallback: false };
    return { text: other || '', fallback: !!(other && String(other).trim()) };
  };
  A.L = x => A.Lx(x).text;
  A.Lh = x => { const r = A.Lx(x); return A.esc(r.text) + (r.fallback ? ' <span class="tag fallback" lang="' + (A.lang === 'ar' ? 'en' : 'ar') + '">' + A.esc(t(A.lang === 'ar' ? 'lang.enShown' : 'lang.arShown')) + '</span>' : ''); };
  A.term = s => (A.lang === 'ar' && CON.AR_TERMS && CON.AR_TERMS[s]) || s;
  A.esc = CON.esc;
  A.ic = CON.icon;
  A.money = minor => M.format(minor, A.lang);
  A.aed = n => CON.fmtAED(n, A.lang); // plain AED numbers in planning models (not transactions)
  A.num = n => CON.fmtNum(n, A.lang);
  A.date = d => CON.fmtDate(d, A.lang);
  A.today = () => Dt.today();
  A.feePct = () => (M.DEFAULTS.platformFeeBps / 100).toString();
  A.vatPct = () => (M.DEFAULTS.vatBps / 100).toString();
  A.typeL = ty => t('type.' + ty);
  A.objL = o => t('obj.' + o);
  A.areaL = a => a === 'all' ? t('area.all') : (D.areas[a] ? D.areas[a][A.lang] : a);
  A.areasL = list => (list || []).map(A.areaL).join(', ');
  A.intL = i => t('int.' + i);
  A.unitL = u => t('unit.' + u);
  A.catL = c => t('pc.' + c);
  A.facL = f => t('fac.' + f);
  A.supName = id => { const s = Store.supplier(id); return s ? A.L(s.name) : '—'; };
  A.oppTitle = op => op ? A.L(op.title) : t('missing');
  A.since = iso => {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 0) return A.date(iso.slice(0, 10));
    if (diff < 60) return t('time.now');
    if (diff < 3600) return t('time.min', { n: Math.round(diff / 60) });
    if (diff < 86400) return t('time.hr', { n: Math.round(diff / 3600) });
    return t('time.day', { n: Math.round(diff / 86400) });
  };
  A.dateTime = iso => { if (!iso) return '—'; try { return new Intl.DateTimeFormat(A.lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return iso; } };

  /* ---------- Components ---------- */
  A.thumb = op => op && op.image ? '<img src="' + A.esc(op.image) + '" alt="">' : CON.illus(op ? op.type : 'mall_activation');
  A.scoreRing = (score, label, size) => {
    const r = 26, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score || 0)) / 100);
    return '<div class="score"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + ' role="img" aria-label="' + A.esc((label || t('match')) + ' ' + (score == null ? '—' : score) + '/100') + '"><svg viewBox="0 0 62 62" aria-hidden="true"><circle class="bg" cx="31" cy="31" r="' + r + '"/><circle class="fg" cx="31" cy="31" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg><b aria-hidden="true">' + (score == null ? '—' : score) + '</b>' + (label ? '<small aria-hidden="true">' + A.esc(label) + '</small>' : '') + '</div>';
  };
  A.badge = (cls, text) => '<span class="badge ' + cls + '">' + A.esc(text) + '</span>';
  /* Verification wording is specific: what was reviewed, and whether the review was simulated. */
  A.verifiedBadge = sup => {
    if (!sup) return '';
    const v = sup.verification || {};
    const exp = v.licenceExpiry && v.licenceExpiry < A.today();
    if (v.status === 'licence_reviewed' && !exp) return A.badge('ok', t(v.simulated ? 'ver.reviewedSim' : 'ver.reviewed'));
    if (v.status === 'licence_reviewed' && exp) return A.badge('bad', t('ver.expired'));
    if (v.status === 'submitted') return A.badge('warn', t('ver.pending'));
    if (v.status === 'info_requested') return A.badge('warn', t('ver.info'));
    if (v.status === 'rejected') return A.badge('bad', t('ver.rejected'));
    return A.badge('', t('ver.none'));
  };
  const BADGE = {
    line: { requested: 'warn', offered: 'ok', accepted: 'info', reserved: 'info', booked: 'ok', declined: 'bad', withdrawn: 'bad', expired: 'bad', cancelled: '' },
    bk: { reserved: 'warn', confirmed: 'info', preparing: 'info', live: 'ok', completed: 'ok', delivery_accepted: 'ok', disputed: 'bad', cancelled: '', expired: '', refunded: '' },
    pay: { awaiting: 'warn', paid: 'ok', failed: 'bad', cancelled: '', expired: '', partially_refunded: 'warn', refunded: '' },
    payout: { held: '', eligible: 'warn', released: 'ok', withheld: 'bad', cancelled: '' },
    rfq: { open: 'info', partially_awarded: 'info', awarded: 'ok', closed: '', cancelled: '', expired: '' },
    opp: { active: 'ok', paused: '', archived: '' },
    dsp: { open: 'bad', under_review: 'warn', resolved_supplier: 'ok', resolved_customer: 'ok', withdrawn: '' },
    rf: { requested: 'warn', approved: 'info', processed: 'ok', rejected: '', failed: 'bad' }
  };
  A.statusBadge = (kind, st) => A.badge((BADGE[kind] || {})[st] || '', t(kind + '.' + st));
  A.sampleTag = x => x && x.sample ? '<span class="tag">' + t('sample') + '</span>' : '';
  A.simTag = x => x && x.simulated ? '<span class="tag sim">' + t('simulated') + '</span>' : '';

  /* Structured errors → readable, specific messages. */
  A.errMsg = err => {
    if (!err) return '';
    const d = err.details || {};
    const key = 'err.code.' + err.code;
    const p = Object.assign({}, d);
    if (d.validUntil) p.validUntil = A.date(d.validUntil);
    if (d.dates) p.dates = d.dates.slice(0, 4).map(A.date).join(', ') + (d.dates.length > 4 ? ' …' : '');
    if (d.failed) p.failed = d.failed.map(g => t('guard.' + g)).join(', ');
    if (d.fields) p.fields = d.fields.map(f => t('dev.' + f)).join(', ');
    if (d.budgetMinor != null) p.budget = A.money(d.budgetMinor);
    if (d.wouldUse != null) p.wouldUse = A.money(d.wouldUse);
    if (d.latest) p.latest = A.date(d.latest);
    let msg = t(key, p);
    if (msg === key) msg = t('err.code.generic', { code: err.code });
    if (typeof d.code === 'string' && d.code !== err.code) msg += ' ' + A.errMsg({ code: d.code, details: Object.assign({}, d, { code: null }) });
    const sub = (d.errors || []).concat(d.lines ? [].concat.apply([], d.lines.map(l => (l.errors || []).map(e => Object.assign({ line: l.oppId }, e)))) : []);
    if (sub.length) msg += ' ' + sub.map(e => { const s2 = A.errMsg({ code: e.code || e.field, details: e }); return (e.line ? A.oppTitle(Store.opp(e.line)) + ': ' : '') + s2; }).join(' · ');
    return msg;
  };
  A.errHtml = err => err ? '<div class="notice bad" role="alert">' + A.ic('alert') + '<div>' + A.esc(A.errMsg(err)) + '</div></div>' : '';

  A.reason = why => {
    if (!why) return '';
    const p = Object.assign({}, why.p || {});
    if (p.type) p.type = A.typeL(p.type);
    if (p.objective) p.objective = A.objL(p.objective).toLowerCase();
    if (p.area) p.area = A.areaL(p.area);
    if (p.c) p.c = A.catL(p.c);
    if (p.f) p.f = A.facL(p.f);
    if (Array.isArray(p.matched)) p.matched = p.matched.length ? p.matched.map(A.intL).join(', ') : t('none');
    if (p.from) p.from = A.date(p.from);
    if (p.lead != null) p.lead = String(p.lead);
    return t(why.code, p);
  };
  A.factorsHtml = res => !res.factors ? '' : '<div class="factors">' + res.factors.map(f => {
    const pct = Math.round(f.value * 100);
    const cls = pct < 35 ? 'vlow' : pct < 60 ? 'low' : '';
    return '<div class="factor"><span class="factor-name">' + A.esc(t('f.' + f.key)) + ' <small>' + t('weight') + ' ' + Math.round(f.weight * 100) + '%</small></span><span class="factor-val">' + pct + '</span><span class="factor-bar" aria-hidden="true"><i class="' + cls + '" style="width:' + pct + '%"></i></span><span class="factor-why">' + A.esc(A.reason(f.why)) + '</span></div>';
  }).join('') + '</div>';
  /* Eligibility checks: pass / confirmation required / fail, each with its reason. */
  A.checksHtml = (checks, only) => {
    const list = (checks || []).filter(c => !only || only.includes(c.status));
    if (!list.length) return '';
    return '<ul class="checks">' + list.map(c => '<li class="ck ' + c.status + '">' + A.ic(c.status === 'pass' ? 'check' : c.status === 'fail' ? 'x' : 'alert') + '<span><b>' + A.esc(t('cks.' + c.status)) + '</b> ' + A.esc(A.reason(c)) + '</span></li>').join('') + '</ul>';
  };
  A.risksHtml = risks => risks && risks.length ? '<div class="chips">' + risks.map(r => '<span class="risk">' + A.ic('alert') + A.esc(t(r)) + '</span>').join('') + '</div>' : '';

  /* Coverage: quantity, activation dates and calendar span are shown separately. */
  A.coverageText = (cov, op) => {
    if (!cov) return '';
    if (cov.status === 'none') return t('cov.none');
    if (cov.status === 'event') return t('cov.event', { d: cov.activationDates.map(A.date).join(', ') });
    if (cov.status === 'event-tbc') return t('cov.eventTbc');
    const unit = t('uw.' + op.unit);
    let s = t('cov.units', { n: A.num(cov.purchasedUnits), unit, act: A.num(cov.coveredDates.length), span: A.num(cov.calendarDays) });
    if (!cov.everyDay) s += ' · ' + t('cov.days', { days: cov.scheduleDays.map(d => t('wd.' + d)).join(', ') });
    if (cov.status === 'partial') s += ' · ' + t('cov.partial', { missing: A.num((cov.uncoveredDates || []).length + 0), outside: A.num(cov.outsideWindowDays || 0), max: op.maxUnits || '—' });
    if (cov.minimumApplied) s += ' · ' + t('cov.min', { n: op.minUnits });
    return s;
  };
  A.covBadge = cov => cov ? A.badge(cov.status === 'full' || cov.status === 'event' ? 'ok' : cov.status === 'partial' || cov.status === 'event-tbc' ? 'warn' : 'bad', t('covs.' + cov.status)) : '';
  A.priceText = p => !p || p.onRequest ? t('price.request') : A.money(p.exVat);

  /* Evidence profile: one row per dimension, with its source and freshness. */
  A.evidenceHtml = ev => {
    if (!ev) return '';
    const lv = x => A.badge(x.level === 'verified' ? 'ok' : x.level === 'reviewed' ? 'info' : x.level === 'declared' ? 'warn' : '', t('evl.' + x.level)) + (x.stale ? ' ' + A.badge('bad', t('ev.stale')) : '');
    const items = x => (x.items || []).map(i => A.num(i.value) + ' ' + A.esc(A.term(i.label || i.metric)) + ' · ' + A.esc(t('evm.' + i.method)) + ' · ' + A.esc(t('evs.' + i.source)) + (i.periodEnd ? ' · ' + A.esc(i.periodEnd) : '')).join('<br>');
    const row = (k, val, note) => '<tr><th scope="row">' + A.esc(t('evd.' + k)) + '</th><td>' + val + '</td><td class="small muted">' + (note || '') + '</td></tr>';
    return '<div class="table-wrap"><table class="t ev"><tbody>' +
      row('business', A.badge(ev.business === 'licence_reviewed' ? 'ok' : ev.business === 'submitted' ? 'warn' : '', t('evb.' + ev.business)), ev.businessExpiry ? t('ev.expires', { d: A.date(ev.businessExpiry) }) : '') +
      row('completeness', ev.completeness + '%', '') +
      row('audience', lv(ev.audience), items(ev.audience)) +
      row('availability', A.badge(ev.availability === 'fresh' ? 'ok' : ev.availability === 'stale' ? 'bad' : '', t('eva.' + ev.availability)), ev.availabilityUpdatedAt ? t('ev.updated', { d: A.date(ev.availabilityUpdatedAt) }) : '') +
      row('delivery', lv(ev.delivery), items(ev.delivery) + (ev.delivery.platformBookings ? (items(ev.delivery) ? '<br>' : '') + t('ev.platformBookings', { n: ev.delivery.platformBookings }) : '')) +
      row('outcome', lv(ev.outcome), items(ev.outcome)) +
      '</tbody></table></div><p class="src">' + t('ev.note') + '</p>';
  };
  A.empty = (icon, title, text, action) => '<div class="empty">' + A.ic(icon) + '<b>' + A.esc(title) + '</b><p>' + A.esc(text) + '</p>' + (action || '') + '</div>';
  A.head = (title, sub, actions, crumb) => '<div class="view-head"><div>' + (crumb ? '<a class="crumb" href="' + crumb.href + '">' + A.ic('arrow-left') + A.esc(crumb.label) + '</a>' : '') + '<h1 tabindex="-1" data-view-title>' + A.esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>';
  A.kpi = (icon, label, value, note) => '<div class="kpi"><small>' + A.ic(icon) + A.esc(label) + '</small><b>' + value + '</b>' + (note ? '<span>' + A.esc(note) + '</span>' : '') + '</div>';
  A.fact = (label, value, note) => '<div class="fact"><small>' + A.esc(label) + '</small><b>' + value + '</b>' + (note ? '<em>' + A.esc(note) + '</em>' : '') + '</div>';
  /* Accessible tablist: arrow keys handled in app.js. */
  A.tabs = (id, items, active, act) => '<div class="tabs" role="tablist" aria-label="' + A.esc(t('tabs.label')) + '">' + items.map(([k, label, count]) => '<button type="button" role="tab" id="tab-' + id + '-' + k + '" aria-controls="panel-' + id + '" aria-selected="' + (active === k) + '" tabindex="' + (active === k ? '0' : '-1') + '" class="' + (active === k ? 'active' : '') + '" data-act="' + act + '" data-tab="' + k + '">' + A.esc(label) + (count != null ? '<span class="c">' + count + '</span>' : '') + '</button>').join('') + '</div>';

  A.audienceText = o => (o.gender === 'all' ? t('g.all') : t('g.' + o.gender)) + ', ' + o.ageMin + '–' + o.ageMax + (o.interests && o.interests.length ? ' · ' + o.interests.map(A.intL).join(', ') : '');
  A.oppAudience = a => a ? ((a.gender === 'mixed' ? t('g.mixed') : t('g.' + a.gender)) + (a.ageMin ? ', ' + a.ageMin + '–' + a.ageMax : '') + ((a.interests || []).length ? ' · ' + a.interests.map(A.intL).join(', ') : '') + (a.access && a.access !== 'open' ? ' · ' + t('acc.' + a.access) : '')) : t('na');
  A.facilitiesText = r => {
    if (!r) return t('na');
    const parts = ['foodSampling', 'refrigeration', 'electricity', 'staffingProvided'].map(k => A.facL(k) + ': ' + t(r[k] === true ? 'yes' : r[k] === false ? 'no' : 'unknown'));
    parts.push(t('fac.categories') + ': ' + (Array.isArray(r.categoriesAllowed) ? r.categoriesAllowed.map(A.catL).join(', ') : t('fac.anyCat')));
    return parts.join(' · ');
  };

  /* Image upload → compressed data URL */
  A.readImage = (file, maxW) => new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('type'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('size'));
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, (maxW || 720) / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', .72));
      };
      img.onerror = () => reject(new Error('decode'));
      img.src = fr.result;
    };
    fr.onerror = () => reject(new Error('read'));
    fr.readAsDataURL(file);
  });

  /* Simple CSV parser (quotes supported) */
  A.parseCSV = text => {
    const rows = []; let row = [], cur = '', q = false;
    const s = String(text || '').replace(/\r\n?/g, '\n');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  };

  /* Schematic Dubai map (decorative position aid). The same data is always available as a table. */
  A.mapSvg = (items, selected) => {
    const W = 800, H = 470;
    const X = lng => 40 + (lng - 55.08) / (55.46 - 55.08) * (W - 80);
    const Y = lat => H - 40 - (lat - 25.02) / (25.30 - 25.02) * (H - 80);
    const coast = [[55.02, 24.98], [55.10, 25.05], [55.13, 25.075], [55.145, 25.10], [55.18, 25.125], [55.215, 25.15], [55.24, 25.19], [55.265, 25.215], [55.285, 25.24], [55.30, 25.258], [55.315, 25.275], [55.34, 25.30], [55.36, 25.33]];
    const coastPts = coast.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
    const sea = 'M0,0 L' + coastPts.split(' ').join(' L') + ' L' + W + ',0 Z';
    let g = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + A.esc(t('map.aria')) + '"><defs><pattern id="mapdots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#c9d6ea"/></pattern></defs>';
    g += '<rect width="' + W + '" height="' + H + '" fill="#fbfcfe"/><rect width="' + W + '" height="' + H + '" fill="url(#mapdots)"/>';
    g += '<path d="' + sea + '" fill="#dcecff"/><polyline points="' + coastPts + '" fill="none" stroke="#9cc6f5" stroke-width="2"/>';
    g += '<text x="' + (A.lang === 'ar' ? 150 : 60) + '" y="70" font-size="14" font-weight="700" fill="#4f7fbf" text-anchor="' + (A.lang === 'ar' ? 'end' : 'start') + '">' + A.esc(t('map.sea')) + '</text>';
    Object.keys(D.areas).forEach(k => {
      const a = D.areas[k]; const x = X(a.lng), y = Y(a.lat);
      g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="#7d8494"/><text x="' + (x + 7).toFixed(1) + '" y="' + (y + 16).toFixed(1) + '" font-size="11" fill="#555b68" font-weight="600">' + A.esc(a[A.lang]) + '</text>';
    });
    const byArea = {};
    items.forEach((it, i) => {
      if (!D.areas[it.op.area]) return;
      const n = byArea[it.op.area] = (byArea[it.op.area] || 0) + 1;
      const a = D.areas[it.op.area];
      const x = X(a.lng) + (n - 1) * 16, y = Y(a.lat) - 16 - (n - 1) * 6;
      const sel = selected.includes(it.op.id);
      const col = it.score >= 75 ? '#157efc' : it.score >= 60 ? '#3d8fe6' : '#b86e00';
      g += '<g class="map-pin" data-act="opp-detail" data-id="' + it.op.id + '" tabindex="0" role="button" aria-label="' + A.esc((i + 1) + '. ' + A.oppTitle(it.op) + ' — ' + A.areaL(it.op.area)) + '"><circle class="pin" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="13" fill="' + (sel ? '#0a0d14' : col) + '" stroke="#fff" stroke-width="3"/><text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" font-size="11" font-weight="800" fill="#fff" text-anchor="middle" aria-hidden="true">' + (i + 1) + '</text></g>';
    });
    g += '<text x="' + (W - 16) + '" y="' + (H - 14) + '" font-size="11" fill="#6b7180" text-anchor="end">' + A.esc(t('map.note')) + '</text></svg>';
    return g;
  };
  A.mapTable = (items, selected) => '<div class="table-wrap"><table class="t"><caption class="sr-only">' + A.esc(t('map.tableCap')) + '</caption><thead><tr><th scope="col">#</th><th scope="col">' + t('th.opportunity') + '</th><th scope="col">' + t('cat.area') + '</th><th scope="col" class="num">' + t('match') + '</th><th scope="col">' + t('selected') + '</th></tr></thead><tbody>' +
    items.map((it, i) => '<tr><td>' + (i + 1) + '</td><td><button class="link-btn" type="button" data-act="opp-detail" data-id="' + it.op.id + '">' + A.esc(A.oppTitle(it.op)) + '</button></td><td>' + A.esc(A.areaL(it.op.area)) + '</td><td class="num">' + it.score + '</td><td>' + (selected.includes(it.op.id) ? t('yes') : t('no')) + '</td></tr>').join('') + '</tbody></table></div>';
})();
