/* Platform: shared helpers and UI components */
(function () {
  'use strict';
  const CON = window.CON;
  const A = CON.App = CON.App || {};
  const E = CON.Engine, D = CON.DATA, Store = CON.Store;

  A.lang = CON.getLang();
  A.ui = { planTab: 'rec', cat: { q: '', type: '', area: '', max: '', obj: '' }, compareObj: '', scenario: 'conservative', confirm: null, extraction: null, importRows: null, upload: null };

  A.t = function (key, p) {
    const dict = CON.APP_STR[A.lang] || CON.APP_STR.en;
    let s = dict[key];
    if (s == null) s = CON.APP_STR.en[key];
    if (s == null) return key;
    if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m));
    return s;
  };
  const t = A.t;
  A.L = x => x == null ? '' : typeof x === 'string' ? x : (x[A.lang] || x.en || '');
  A.term = s => (A.lang === 'ar' && CON.AR_TERMS && CON.AR_TERMS[s]) || s;
  A.esc = CON.esc;
  A.ic = CON.icon;
  A.money = n => CON.fmtAED(n, A.lang);
  A.num = n => CON.fmtNum(n, A.lang);
  A.date = d => CON.fmtDate(d, A.lang);
  A.typeL = ty => t('type.' + ty);
  A.objL = o => t('obj.' + o);
  A.areaL = a => a === 'all' ? t('area.all') : (D.areas[a] ? D.areas[a][A.lang] : a);
  A.areasL = list => (list || []).map(A.areaL).join(', ');
  A.intL = i => t('int.' + i);
  A.unitL = u => t('unit.' + u);
  A.supName = id => { const s = Store.supplier(id); return s ? A.L(s.name) : '—'; };
  A.oppTitle = op => op ? A.L(op.title) : t('missing');
  A.since = iso => {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return t('time.now');
    if (diff < 3600) return t('time.min', { n: Math.round(diff / 60) });
    if (diff < 86400) return t('time.hr', { n: Math.round(diff / 3600) });
    return t('time.day', { n: Math.round(diff / 86400) });
  };

  /* ---------- Components ---------- */
  A.thumb = op => op && op.image ? '<img src="' + A.esc(op.image) + '" alt="">' : CON.illus(op ? op.type : 'mall_activation');
  A.scoreRing = (score, label, size) => {
    const r = 26, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score || 0)) / 100);
    return '<div class="score"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + '><svg viewBox="0 0 62 62"><circle class="bg" cx="31" cy="31" r="' + r + '"/><circle class="fg" cx="31" cy="31" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg><b>' + (score == null ? '—' : score) + '</b>' + (label ? '<small>' + A.esc(label) + '</small>' : '') + '</div>';
  };
  A.badge = (cls, text) => '<span class="badge ' + cls + '">' + A.esc(text) + '</span>';
  A.verifiedBadge = sup => {
    if (!sup) return '';
    if (sup.verified === 'verified') return A.badge('ok', t('ver.verified'));
    if (sup.verified === 'pending') return A.badge('warn', t('ver.pending'));
    if (sup.verified === 'rejected') return A.badge('bad', t('ver.rejected'));
    return A.badge('', t('ver.none'));
  };
  A.statusBadge = (kind, st) => {
    const map = {
      line: { awaiting: 'warn', offered: 'ok', declined: 'bad' },
      bk: { confirmed: 'info', preparing: 'info', live: 'ok', completed: 'ok', delivered: 'ok' },
      tx: { paid: 'ok', awaiting: 'warn' },
      payout: { held: '', ready: 'warn', released: 'ok' },
      rfq: { open: 'info', awarded: 'ok', closed: '' },
      opp: { active: 'ok', paused: '' }
    };
    return A.badge((map[kind] || {})[st] || '', t(kind + '.' + st));
  };
  A.lineStatus = l => !l.response ? 'awaiting' : l.response.status === 'declined' ? 'declined' : 'offered';
  A.sampleTag = x => x && x.sample ? '<span class="tag">' + t('sample') + '</span>' : '';

  A.reason = why => {
    if (!why) return '';
    const p = Object.assign({}, why.p || {});
    if (p.type) p.type = A.typeL(p.type);
    if (p.objective) p.objective = A.objL(p.objective).toLowerCase();
    if (p.area) p.area = A.areaL(p.area);
    if (Array.isArray(p.matched)) p.matched = p.matched.length ? p.matched.map(A.intL).join(', ') : t('none');
    return t(why.code, p);
  };
  A.factorsHtml = res => '<div class="factors">' + res.factors.map(f => {
    const pct = Math.round(f.value * 100);
    const cls = pct < 35 ? 'vlow' : pct < 60 ? 'low' : '';
    return '<div class="factor"><span class="factor-name">' + A.esc(t('f.' + f.key)) + ' <small>' + t('weight') + ' ' + Math.round(f.weight * 100) + '%</small></span><span class="factor-val">' + pct + '</span><span class="factor-bar"><i class="' + cls + '" style="width:' + pct + '%"></i></span><span class="factor-why">' + A.esc(A.reason(f.why)) + '</span></div>';
  }).join('') + '</div>';
  A.risksHtml = risks => risks && risks.length ? '<div class="chips">' + risks.map(r => '<span class="risk">' + A.ic('alert') + A.esc(t(r)) + '</span>').join('') + '</div>' : '';
  A.reachHtml = op => {
    if (!op.reach) return '<b>' + t('na') + '</b><em>' + t('reach.none') + '</em>';
    return '<b>' + A.num(op.reach.value) + '</b><em>' + A.esc(A.term(op.reach.unit)) + ' · ' + t('src.' + op.reach.source) + '</em>';
  };
  A.costLine = cost => cost.subtotal == null ? t('price.request') : t('cost.line', { units: A.num(cost.units), unit: A.unitL(cost.unit).toLowerCase(), setup: A.money(cost.setup) });
  A.sourcesHtml = (op, sup) => {
    const parts = [];
    parts.push(t('src.listing', { date: A.date((sup && sup.joined) || '') }));
    if (op.reach) parts.push(t('src.reachFrom', { src: t('src.' + op.reach.source), date: op.reach.date }));
    (op.performance || []).forEach(p => parts.push(t('src.perf', { metric: A.term(p.metric), value: A.num(p.value), src: t('src.' + p.source), date: p.date })));
    return '<p class="src"><b>' + t('sources') + ':</b> ' + parts.map(A.esc).join(' · ') + '</p>';
  };
  A.empty = (icon, title, text, action) => '<div class="empty">' + A.ic(icon) + '<b>' + A.esc(title) + '</b><p>' + A.esc(text) + '</p>' + (action || '') + '</div>';
  A.head = (title, sub, actions, crumb) => '<div class="view-head"><div>' + (crumb ? '<a class="crumb" href="' + crumb.href + '">' + A.ic('arrow-left') + A.esc(crumb.label) + '</a>' : '') + '<h1>' + A.esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>';
  A.kpi = (icon, label, value, note) => '<div class="kpi"><small>' + A.ic(icon) + A.esc(label) + '</small><b>' + value + '</b>' + (note ? '<span>' + A.esc(note) + '</span>' : '') + '</div>';
  A.fact = (label, value, note) => '<div class="fact"><small>' + A.esc(label) + '</small><b>' + value + '</b>' + (note ? '<em>' + A.esc(note) + '</em>' : '') + '</div>';

  A.audienceText = o => (o.gender === 'all' ? t('g.all') : t('g.' + o.gender)) + ', ' + o.ageMin + '–' + o.ageMax + (o.interests && o.interests.length ? ' · ' + o.interests.map(A.intL).join(', ') : '');
  A.oppAudience = a => a ? ((a.gender === 'mixed' ? t('g.mixed') : t('g.' + a.gender)) + ', ' + a.ageMin + '–' + a.ageMax + ((a.interests || []).length ? ' · ' + a.interests.map(A.intL).join(', ') : '')) : t('na');

  /* Normalised offer helper */
  A.norm = (l, rfq) => E.normalizeOffer(l.response, rfq, { feeRate: CON.config.platformFeeRate, vatRate: CON.config.vatRate });

  /* Image upload → compressed data URL */
  A.readImage = (file, maxW) => new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('type'));
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

  /* Schematic Dubai map */
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
    g += '<text x="' + (A.lang === 'ar' ? 150 : 60) + '" y="70" font-size="14" font-weight="700" fill="#6a9ad6" text-anchor="' + (A.lang === 'ar' ? 'end' : 'start') + '">' + A.esc(t('map.sea')) + '</text>';
    Object.keys(D.areas).forEach(k => {
      const a = D.areas[k]; const x = X(a.lng), y = Y(a.lat);
      g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="#9aa0ad"/><text x="' + (x + 7).toFixed(1) + '" y="' + (y + 16).toFixed(1) + '" font-size="11" fill="#6b7180" font-weight="600">' + A.esc(a[A.lang]) + '</text>';
    });
    const byArea = {};
    items.forEach((it, i) => {
      if (!D.areas[it.op.area]) return;
      const n = byArea[it.op.area] = (byArea[it.op.area] || 0) + 1;
      const a = D.areas[it.op.area];
      const x = X(a.lng) + (n - 1) * 16, y = Y(a.lat) - 16 - (n - 1) * 6;
      const sel = selected.includes(it.op.id);
      const col = it.score >= 75 ? '#157efc' : it.score >= 60 ? '#58a8ff' : '#f59e0b';
      g += '<g class="map-pin" data-act="opp-detail" data-id="' + it.op.id + '" tabindex="0" role="button" aria-label="' + A.esc(A.oppTitle(it.op)) + '"><circle class="pin" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="13" fill="' + (sel ? '#0a0d14' : col) + '" stroke="#fff" stroke-width="3"/><text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" font-size="11" font-weight="800" fill="#fff" text-anchor="middle">' + (i + 1) + '</text></g>';
    });
    g += '<text x="' + (W - 16) + '" y="' + (H - 14) + '" font-size="11" fill="#9aa0ad" text-anchor="end">' + A.esc(t('map.note')) + '</text></svg>';
    return g;
  };
})();
