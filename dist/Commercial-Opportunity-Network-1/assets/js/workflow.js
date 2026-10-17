/* Interactive workflow page */
(function () {
  'use strict';
  const CON = window.CON;
  const W = CON.WORKFLOW;
  const esc = CON.esc, ic = CON.icon;
  let lang = CON.getLang();

  const T = {
    en: { lanes: { brand: 'Brand', platform: 'Platform', supplier: 'Supplier', ops: 'Operations' }, all: 'All roles', step: 'Step', of: 'of', before: 'Before any project', each: 'Each project', side: 'Supporting task', what: 'What happens', where: 'Screen', result: 'Result', open: 'Open this screen', prev: 'Previous step', next: 'Next step', play: 'Play the workflow', pause: 'Pause', payment: 'payment', who: 'Who moves it', tryHint: 'Click any step, or press play.', setsBy: 'Set at', noStep: 'On registration', counter: (i, n) => `Step ${i} of ${n}`, roleN: n => `${n} steps` },
    ar: { lanes: { brand: 'العلامة', platform: 'المنصة', supplier: 'المورد', ops: 'العمليات' }, all: 'كل الأدوار', step: 'خطوة', of: 'من', before: 'قبل أي مشروع', each: 'كل مشروع', side: 'مهمة مساندة', what: 'ما يحدث', where: 'الشاشة', result: 'النتيجة', open: 'افتح هذه الشاشة', prev: 'الخطوة السابقة', next: 'الخطوة التالية', play: 'شغّل سير العمل', pause: 'إيقاف مؤقت', payment: 'الدفع', who: 'من يغيّرها', tryHint: 'انقر أي خطوة، أو اضغط تشغيل.', setsBy: 'تُضبط في', noStep: 'عند التسجيل', counter: (i, n) => `الخطوة ${i} من ${n}`, roleN: n => `${n} خطوات` }
  };
  const t = () => T[lang];
  const L = s => s[lang] || s.en;
  const byId = Object.fromEntries(W.steps.map(s => [s.id, s]));
  const lanes = ['brand', 'platform', 'supplier', 'ops'];
  const gridRow = r => (r === 1 ? 2 : r + 1);

  const board = document.getElementById('board');
  const detail = document.getElementById('detail');
  const chips = document.getElementById('role-chips');
  const counter = document.getElementById('wf-counter');
  const bar = document.getElementById('wf-progress');
  const playBtn = document.getElementById('wf-play');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let role = 'all';
  let current = 's1';
  let timer = null;
  let recordId = 'booking';

  const visibleOrder = () => W.order.filter(id => role === 'all' || byId[id].lane === role);

  /* ---------- Build the board ---------- */
  function buildBoard() {
    let h = '';
    lanes.forEach((ln, i) => {
      h += '<div class="lane-bg" style="grid-column:' + (i + 1) + '" aria-hidden="true"></div>';
      h += '<div class="lane-head" data-lane="' + ln + '" style="grid-column:' + (i + 1) + '"><span class="lane-dot"></span>' + esc(t().lanes[ln]) + '</div>';
    });
    h += '<div class="pre-label">' + esc(t().before) + '</div>';
    h += '<div class="board-sep" style="--o-sep:' + 2 + '">' + esc(t().each) + '</div>';
    W.steps.forEach(s => {
      const o = W.order.indexOf(s.id) + (s.pre ? 0 : 3);
      const d = L(s);
      h += '<div role="button" tabindex="0" class="step' + (s.side ? ' side' : '') + '" data-step="' + s.id + '" data-lane="' + s.lane + '" style="grid-column:' + (lanes.indexOf(s.lane) + 1) + ';grid-row:' + gridRow(s.row) + ';--o:' + o + '" aria-pressed="false">' +
        (s.num ? '<span class="num">' + s.num + '</span>' : '') +
        '<span class="lane-tag"><span class="lane-dot"></span>' + esc(t().lanes[s.lane]) + (s.side ? ' · ' + esc(t().side) : '') + '</span>' +
        '<b>' + esc(d.title) + '</b><small>' + esc(d.sub) + '</small>' +
        '<div class="inline-detail"></div></div>';
    });
    h += '<svg class="wires" aria-hidden="true"><defs><marker id="wf-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#b6bdc9"/></marker><marker id="wf-a-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#157efc"/></marker></defs><g id="wire-g"></g></svg>';
    board.innerHTML = h;
  }

  /* ---------- Connectors, measured from the real layout ---------- */
  function drawWires() {
    const g = document.getElementById('wire-g');
    if (!g || window.innerWidth <= 760) { if (g) g.innerHTML = ''; return; }
    const box = board.getBoundingClientRect();
    const rect = id => { const el = board.querySelector('[data-step="' + id + '"]'); const r = el.getBoundingClientRect(); return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top, cx: (r.left + r.right) / 2 - box.left, cy: (r.top + r.bottom) / 2 - box.top, w: r.width }; };
    let out = '';
    W.edges.forEach(([a, b, opt]) => {
      opt = opt || {};
      const A = rect(a), B = rect(b);
      let d;
      if (Math.abs(A.cx - B.cx) < 4) {
        const x = opt.offset ? A.l + A.w * (lang === 'ar' ? 1 - opt.offset : opt.offset) : A.cx;
        d = 'M' + x + ' ' + A.b + 'V' + (B.t - 1);
      } else if (Math.abs(A.cy - B.cy) < 4) {
        const right = B.cx > A.cx;
        d = 'M' + (right ? A.r : A.l) + ' ' + A.cy + 'H' + (right ? B.l - 1 : B.r + 1);
      } else {
        const right = B.cx > A.cx;
        const endX = B.cx - (opt.endShift ? (right ? opt.endShift : -opt.endShift) : 0);
        d = 'M' + (right ? A.r : A.l) + ' ' + A.cy + 'H' + endX + 'V' + (B.t - 1);
      }
      const hot = a === current || b === current;
      const dim = role !== 'all' && !(byId[a].lane === role || byId[b].lane === role);
      out += '<path d="' + d + '" class="' + (opt.dashed ? 'dashed ' : '') + (hot ? 'hot ' : '') + (dim ? 'dim' : '') + '" marker-end="url(#' + (hot ? 'wf-a-hot' : 'wf-a') + ')"/>';
      if (opt.label) {
        const x = (opt.offset ? A.l + A.w * (lang === 'ar' ? 1 - opt.offset : opt.offset) : A.cx) + (lang === 'ar' ? 8 : -8);
        out += '<text x="' + x + '" y="' + ((A.b + B.t) / 2) + '" text-anchor="' + (lang === 'ar' ? 'start' : 'end') + '">' + esc(t().payment) + '</text>';
      }
    });
    g.innerHTML = out;
  }

  /* ---------- Detail ---------- */
  function detailHtml(s, compact) {
    const d = L(s);
    const ord = visibleOrder(); const i = ord.indexOf(s.id);
    return (compact ? '' : '<div class="detail-head"><span class="lane-badge" data-lane="' + s.lane + '"><span class="lane-dot"></span>' + esc(t().lanes[s.lane]) + (s.side ? ' · ' + esc(t().side) : s.num ? ' · ' + esc(t().step) + ' ' + s.num : '') + '</span><h2>' + esc(d.title) + '</h2></div>') +
      '<p>' + esc(d.does) + '</p>' +
      '<dl class="dl-mini"><div><dt>' + esc(t().where) + '</dt><dd>' + esc(d.screen) + '</dd></div><div><dt>' + esc(t().result) + '</dt><dd>' + esc(d.result) + '</dd></div></dl>' +
      '<a class="btn btn-dark btn-sm" href="platform.html#' + s.href + '"><span>' + esc(t().open) + '</span>' + ic('arrow-up-right') + '</a>' +
      (compact ? '' : '<div class="detail-nav"><button class="btn btn-light btn-sm" type="button" data-nav="-1"' + (i <= 0 ? ' disabled' : '') + '>' + ic('arrow-left', 'flip') + '<span>' + esc(t().prev) + '</span></button><button class="btn btn-light btn-sm" type="button" data-nav="1"' + (i >= ord.length - 1 ? ' disabled' : '') + '><span>' + esc(t().next) + '</span>' + ic('arrow', 'flip') + '</button></div>');
  }

  function select(id, opts) {
    if (!byId[id]) return;
    current = id;
    const ord = visibleOrder();
    const idx = ord.indexOf(id);
    const fullIdx = W.order.indexOf(id);
    board.querySelectorAll('.step').forEach(el => {
      const sid = el.dataset.step;
      const on = sid === id;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
      el.classList.toggle('done', W.order.indexOf(sid) < fullIdx);
      el.classList.toggle('dim', role !== 'all' && byId[sid].lane !== role);
      el.querySelector('.inline-detail').innerHTML = on ? detailHtml(byId[sid], true) : '';
    });
    detail.innerHTML = detailHtml(byId[id], false);
    counter.textContent = idx >= 0 ? t().counter(idx + 1, ord.length) : '';
    bar.style.width = (idx >= 0 ? ((idx + 1) / ord.length) * 100 : 0) + '%';
    drawWires();
    CON.hydrateIcons(detail); CON.hydrateIcons(board);
    if (opts && opts.scroll) {
      const el = window.innerWidth <= 760 ? board.querySelector('[data-step="' + id + '"]') : (window.innerWidth <= 1100 ? null : null);
      if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
  }

  function step(dir) {
    const ord = visibleOrder();
    let i = ord.indexOf(current);
    if (i < 0) i = dir > 0 ? -1 : ord.length;
    const n = i + dir;
    if (n < 0 || n >= ord.length) return false;
    select(ord[n], { scroll: true });
    return true;
  }

  function setPlaying(on) {
    if (timer) { clearInterval(timer); timer = null; }
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.setAttribute('aria-label', on ? t().pause : t().play);
    playBtn.innerHTML = on ? '<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>';
    if (on) {
      const ord = visibleOrder();
      if (ord.indexOf(current) === ord.length - 1 || ord.indexOf(current) < 0) select(ord[0], { scroll: true });
      timer = setInterval(() => { if (!step(1)) setPlaying(false); }, 2200);
    }
  }

  /* ---------- Role chips ---------- */
  function buildChips() {
    const count = ln => W.steps.filter(s => s.lane === ln).length;
    chips.innerHTML = '<button type="button" data-role="all" aria-pressed="' + (role === 'all') + '">' + esc(t().all) + '</button>' +
      lanes.map(ln => '<button type="button" data-role="' + ln + '" data-lane="' + ln + '" aria-pressed="' + (role === ln) + '" title="' + esc(t().roleN(count(ln))) + '"><span class="lane-dot"></span>' + esc(t().lanes[ln]) + '</button>').join('');
  }

  /* ---------- Status explorer ---------- */
  function buildStatus() {
    const tabs = document.getElementById('status-tabs');
    const card = document.getElementById('status-card');
    tabs.innerHTML = W.records.map(r => '<button type="button" role="tab" data-record="' + r.id + '" aria-selected="' + (r.id === recordId) + '">' + esc(L(r.name)) + '</button>').join('');
    const rec = W.records.find(r => r.id === recordId);
    card.innerHTML = '<div class="status-chain">' + rec.states.map((st, i) => (i ? '<span class="arrow">' + ic('arrow') + '</span>' : '') +
      '<button type="button" class="status-chip" data-goto="' + (st.step || '') + '"' + (st.step ? '' : ' disabled') + '><b>' + esc(L(st)) + '</b><small>' + esc(st.step ? t().setsBy + ': ' + (byId[st.step].num ? t().step + ' ' + byId[st.step].num + ' · ' : '') + L(byId[st.step]).title : t().noStep) + '</small></button>').join('') + '</div>' +
      '<div class="status-who">' + ic('users') + '<span><b>' + esc(t().who) + ':</b> ' + esc(L(rec.who)) + '</span></div>';
  }

  /* ---------- Events ---------- */
  board.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const b = e.target.closest('.step');
    if (!b) return;
    setPlaying(false);
    if (b.dataset.step === current && window.innerWidth <= 760) return;
    select(b.dataset.step, { scroll: window.innerWidth <= 760 });
    if (window.innerWidth > 760 && window.innerWidth <= 1100) detail.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  });
  board.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('step')) { e.preventDefault(); setPlaying(false); select(e.target.dataset.step, { scroll: window.innerWidth <= 760 }); } });
  detail.addEventListener('click', e => { const b = e.target.closest('[data-nav]'); if (b) { setPlaying(false); step(Number(b.dataset.nav)); } });
  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-role]'); if (!b) return;
    setPlaying(false);
    role = b.dataset.role;
    buildChips();
    const ord = visibleOrder();
    select(ord.includes(current) ? current : ord[0]);
  });
  document.getElementById('wf-prev').addEventListener('click', () => { setPlaying(false); step(-1); });
  document.getElementById('wf-next').addEventListener('click', () => { setPlaying(false); step(1); });
  playBtn.addEventListener('click', () => setPlaying(!timer));
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return;
    const rtl = document.documentElement.dir === 'rtl';
    if (e.key === 'ArrowRight') { setPlaying(false); step(rtl ? -1 : 1); }
    if (e.key === 'ArrowLeft') { setPlaying(false); step(rtl ? 1 : -1); }
  });
  document.getElementById('status-tabs').addEventListener('click', e => { const b = e.target.closest('[data-record]'); if (b) { recordId = b.dataset.record; buildStatus(); CON.hydrateIcons(); } });
  document.getElementById('status-card').addEventListener('click', e => {
    const b = e.target.closest('[data-goto]'); if (!b || !b.dataset.goto) return;
    setPlaying(false);
    if (role !== 'all' && byId[b.dataset.goto].lane !== role) { role = 'all'; buildChips(); }
    select(b.dataset.goto);
    document.getElementById('workflow').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawWires, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWires);

  /* ---------- Language ---------- */
  function render() {
    lang = CON.getLang();
    buildChips(); buildBoard(); buildStatus();
    select(current);
    setPlaying(!!timer);
    CON.hydrateIcons();
  }
  document.addEventListener('con:lang', render);

  const start = (location.hash || '').replace('#', '');
  if (byId[start]) current = start;
  render();
  window.addEventListener('load', drawWires);
})();
