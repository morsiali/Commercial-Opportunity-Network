/* Marketing site interactions */
(function () {
  'use strict';
  const CON = window.CON;
  let lang = CON.getLang();
  const S = () => CON.SITE_STR[lang];

  /* ---------- Language ---------- */
  function applyLang() {
    CON.translateStatic(lang, CON.SITE_AR);
    document.querySelectorAll('[data-contact-email]').forEach(el => { el.textContent = CON.config.contactEmail; });
    rotIndex = 0; setRotator(true);
    renderDemo();
    const menuBtn = document.querySelector('.menu-btn');
    if (menuBtn) menuBtn.setAttribute('aria-label', menuBtn.getAttribute('aria-expanded') === 'true' ? S().menuClose : S().menuOpen);
  }
  document.querySelectorAll('[data-lang-toggle]').forEach(b => b.addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    CON.setLang(lang);
    applyLang();
  }));

  /* ---------- Header ---------- */
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const menuBtn = document.querySelector('.menu-btn');
  const menu = document.getElementById('mobile-menu');
  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? S().menuClose : S().menuOpen);
    menuBtn.innerHTML = CON.icon(open ? 'x' : 'menu');
  }
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 1080 && !menu.hidden) setMenu(false); });

  /* ---------- Rotating headline word ---------- */
  const rot = document.querySelector('[data-rotate]');
  let rotIndex = 0;
  function setRotator(instant) {
    const words = S().rotate;
    const w = words[rotIndex % words.length];
    if (instant) { rot.textContent = w; return; }
    rot.classList.add('swap');
    setTimeout(() => { rot.textContent = w; rot.classList.remove('swap'); }, 320);
  }
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) setInterval(() => { rotIndex++; setRotator(false); }, 2600);

  /* ---------- Reveal on scroll (content is visible without JS) ---------- */
  if ('IntersectionObserver' in window && !reduce) {
    const els = document.querySelectorAll('.reveal');
    const vh = window.innerHeight;
    els.forEach(el => { if (el.getBoundingClientRect().top < vh) el.classList.add('in'); });
    document.documentElement.classList.add('js-motion');
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => { if (!el.classList.contains('in')) io.observe(el); });
    // Safety: never leave content hidden
    setTimeout(() => els.forEach(el => el.classList.add('in')), 4000);
  }

  /* ---------- Marquee duplication for a seamless loop ---------- */
  const track = document.querySelector('[data-marquee]');
  if (track) {
    const clone = track.innerHTML;
    track.insertAdjacentHTML('beforeend', clone);
    Array.from(track.children).slice(track.children.length / 2).forEach(c => c.setAttribute('aria-hidden', 'true'));
  }

  /* ---------- Opportunity rail ---------- */
  CON.hydrateIllus();
  const rail = document.querySelector('[data-rail]');
  document.querySelectorAll('[data-carousel]').forEach(btn => btn.addEventListener('click', () => {
    const card = rail.querySelector('.opp-card');
    const step = card ? card.getBoundingClientRect().width + 18 : 320;
    const dir = btn.getAttribute('data-carousel') === 'next' ? 1 : -1;
    const rtl = document.documentElement.dir === 'rtl' ? -1 : 1;
    rail.scrollBy({ left: step * dir * rtl, behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------- Brief wizard ---------- */
  const form = document.getElementById('brief-form');
  const steps = form.querySelectorAll('[data-step]');
  const inds = form.querySelectorAll('[data-step-ind]');
  const back = form.querySelector('[data-wz-back]');
  const errEl = document.getElementById('wz-error');
  let step = 1;
  const startInput = document.getElementById('wz-start');
  const todayIso = CON.Engine.util.todayIso();
  startInput.min = todayIso;
  startInput.value = CON.Engine.util.addDays(todayIso, 21);

  // "All Dubai" is exclusive with specific areas
  form.addEventListener('change', e => {
    if (e.target.name !== 'areas') return;
    const boxes = form.querySelectorAll('input[name="areas"]');
    if (e.target.value === 'all' && e.target.checked) boxes.forEach(b => { if (b.value !== 'all') b.checked = false; });
    else if (e.target.value !== 'all' && e.target.checked) boxes.forEach(b => { if (b.value === 'all') b.checked = false; });
    if (!Array.from(boxes).some(b => b.checked)) boxes[0].checked = true;
  });

  function showStep(n) {
    step = n;
    steps.forEach(s => { s.hidden = Number(s.dataset.step) !== n; });
    inds.forEach(i => {
      const k = Number(i.dataset.stepInd);
      i.classList.toggle('is-active', k === n);
      i.classList.toggle('is-done', k < n);
    });
    back.hidden = n === 1;
    errEl.hidden = true;
  }
  back.addEventListener('click', () => showStep(Math.max(1, step - 1)));

  function validate() {
    const fd = new FormData(form);
    form.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
    if (step === 2) {
      const a = Number(fd.get('ageMin')), b = Number(fd.get('ageMax'));
      if (!(a >= 16 && b <= 80 && a < b)) { document.getElementById('wz-agemin').classList.add('invalid'); return S().errAge; }
    }
    if (step === 3) {
      if (!(Number(fd.get('budget')) >= 5000)) { document.getElementById('wz-budget').classList.add('invalid'); return S().errBudget; }
      const d = Number(fd.get('duration'));
      if (!(d >= 1 && d <= 180)) { document.getElementById('wz-days').classList.add('invalid'); return S().errDays; }
      if (!fd.get('start') || fd.get('start') < todayIso) { startInput.classList.add('invalid'); return S().errDate; }
    }
    return null;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = validate();
    if (err) {
      if (step === 2) { const s2 = form.querySelector('[data-step="2"]'); let p = s2.querySelector('.error-text'); if (!p) { p = document.createElement('p'); p.className = 'error-text'; p.setAttribute('role', 'alert'); s2.appendChild(p); } p.textContent = err; p.hidden = false; }
      else { errEl.textContent = err; errEl.hidden = false; }
      return;
    }
    const s2err = form.querySelector('[data-step="2"] .error-text'); if (s2err) s2err.hidden = true;
    if (step < 3) { showStep(step + 1); return; }
    const fd = new FormData(form);
    const brief = {
      objective: fd.get('objective'), product: fd.get('product') || '', gender: fd.get('gender'),
      ageMin: Number(fd.get('ageMin')), ageMax: Number(fd.get('ageMax')), areas: fd.getAll('areas'),
      budget: Number(fd.get('budget')), duration: Number(fd.get('duration')), start: fd.get('start'),
      success: fd.get('success') || '', interests: [], source: 'website'
    };
    CON.storage.set('con.pendingBrief', brief);
    const btn = form.querySelector('[data-wz-next]');
    btn.setAttribute('aria-disabled', 'true');
    btn.innerHTML = '<span>' + CON.esc(S().generating) + '</span>';
    window.location.href = 'platform.html#c-new';
  });

  /* ---------- Live match-score demo ---------- */
  const demoOpp = CON.DATA.opportunities.find(o => o.id === 'o4');
  const range = document.getElementById('demo-budget');
  const out = document.querySelector('[data-demo-budget-out]');
  const list = document.querySelector('[data-demo-factors]');
  const arc = document.querySelector('[data-demo-arc]');
  const scoreEl = document.querySelector('[data-demo-score]');
  const foot = document.querySelector('.demo-foot');
  function renderDemo() {
    const objective = (document.querySelector('input[name="demo-obj"]:checked') || {}).value || 'trial';
    const budget = Number(range.value);
    const E = CON.Engine, M = CON.Money, Dt = CON.Dates;
    const today = Dt.today();
    const brief = E.normalizeObjective({ objective, budgetMinor: M.fromAED(budget), duration: 30, start: Dt.addDays(today, 21), areas: ['marina'], ageMin: 25, ageMax: 45, gender: 'all', interests: ['residents', 'professionals'] }, { today });
    const res = E.evaluate(demoOpp, brief, { today, suppliers: CON.DATA.suppliers });
    out.textContent = M.format(M.fromAED(budget), lang, { compact: true });
    const shown = res.eligible ? res.score : 0;
    scoreEl.textContent = res.eligible ? String(res.score) : '—';
    arc.style.strokeDashoffset = String(169.6 * (1 - shown / 100));
    if (res.eligible) {
      list.innerHTML = res.factors.map(f => {
        const pct = Math.round(f.value * 100);
        const cls = pct < 35 ? 'vlow' : pct < 60 ? 'low' : '';
        return '<li class="factor"><span class="factor-name">' + CON.esc(S().f[f.key]) + ' <small>' + S().weight + ' ' + Math.round(f.weight * 100) + '%</small></span><span class="factor-val">' + pct + '</span><span class="factor-bar" aria-hidden="true"><i class="' + cls + '" style="width:' + pct + '%"></i></span></li>';
      }).join('');
      foot.textContent = S().demoFoot(M.format(res.price.exVat, lang), res.coverage.coveredDates.length, (CON.config.platformFeeBps / 100).toString());
    } else {
      list.innerHTML = '<li class="factor"><span class="factor-name">' + CON.esc(S().notEligible) + '</span></li>';
      foot.textContent = S().budgetOver;
    }
  }
  range.addEventListener('input', renderDemo);
  document.querySelectorAll('input[name="demo-obj"]').forEach(r => r.addEventListener('change', renderDemo));

  /* ---------- FAQ: one open at a time ---------- */
  const faqs = document.querySelectorAll('.faq-item');
  faqs.forEach(d => d.addEventListener('toggle', () => { if (d.open) faqs.forEach(o => { if (o !== d) o.open = false; }); }));

  /* ---------- Copy email ---------- */
  document.querySelectorAll('[data-copy-email]').forEach(b => b.addEventListener('click', () => CON.copy(CON.config.contactEmail, S().copied, S().copyFail)));

  /* ---------- Early access ---------- */
  const cform = document.getElementById('contact-form');
  const cerr = document.getElementById('ct-error');
  const done = document.getElementById('contact-done');
  const msgEl = document.getElementById('contact-msg');
  const mailto = document.getElementById('contact-mailto');
  let lastMsg = '';
  cform.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(cform);
    const d = { name: String(fd.get('name') || '').trim(), company: String(fd.get('company') || '').trim(), email: String(fd.get('email') || '').trim(), role: fd.get('role'), message: String(fd.get('message') || '').trim() };
    cform.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
    const bad = [];
    if (!d.name) bad.push('ct-name');
    if (!d.company) bad.push('ct-company');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) bad.push('ct-email');
    if (bad.length) { bad.forEach(id => document.getElementById(id).classList.add('invalid')); cerr.textContent = S().errContact; cerr.hidden = false; document.getElementById(bad[0]).focus(); return; }
    cerr.hidden = true;
    lastMsg = S().msg(d);
    msgEl.textContent = lastMsg;
    mailto.href = 'mailto:' + CON.config.contactEmail + '?subject=' + encodeURIComponent(S().msgSubject) + '&body=' + encodeURIComponent(lastMsg);
    // Nothing is stored or sent: the message is only prepared for the visitor to send themselves.
    done.hidden = false;
    done.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  });
  document.getElementById('contact-copy').addEventListener('click', () => CON.copy(CON.config.contactEmail + '\n\n' + lastMsg, S().copied, S().copyFail));

  /* ---------- Details saved by an earlier version: shown, and deletable on their own ---------- */
  const legacyEA = CON.storage.get('con.earlyAccess', null);
  if (legacyEA && legacyEA.length && cform) {
    const n = document.createElement('div');
    n.className = 'proto-note'; n.setAttribute('role', 'status');
    n.innerHTML = CON.icon('info') + '<span>' + CON.esc(S().legacyEA) + ' <button type="button" class="link-btn" data-del-ea>' + CON.esc(S().legacyEADel) + '</button></span>';
    cform.prepend(n);
    n.querySelector('[data-del-ea]').addEventListener('click', () => { CON.storage.remove('con.earlyAccess'); n.textContent = S().legacyEADone; });
  }

  /* ---------- Boot ---------- */
  applyLang();
})();
