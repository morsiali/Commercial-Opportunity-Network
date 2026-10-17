/* Legal pages: header, language and copy */
(function () {
  'use strict';
  const CON = window.CON;
  let lang = CON.getLang();
  let apply = function () {
    CON.translateStatic(lang, CON.SITE_AR);
    document.querySelectorAll('[data-contact-email]').forEach(el => { el.textContent = CON.config.contactEmail; });
  };
  document.querySelectorAll('[data-lang-toggle]').forEach(b => b.addEventListener('click', () => { lang = lang === 'ar' ? 'en' : 'ar'; CON.setLang(lang); apply(); }));
  const menuBtn = document.querySelector('.menu-btn'); const menu = document.getElementById('mobile-menu');
  menuBtn.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.innerHTML = CON.icon(open ? 'x' : 'menu'); });
  document.querySelectorAll('[data-copy-email]').forEach(b => b.addEventListener('click', () => CON.copy(CON.config.contactEmail, CON.SITE_STR[lang].copied, CON.SITE_STR[lang].copyFail)));
  /* Data controls (privacy page): each kind of stored data can be deleted on its own. */
  const box = document.getElementById('data-controls');
  function keys() { try { return Object.keys(window.localStorage).filter(k => k.indexOf('con.') === 0); } catch (e) { return null; } }
  const GROUPS = [
    ['records', k => /^con\.state\./.test(k)], ['drafts', k => k.indexOf('con.draft.') === 0], ['ea', k => k === 'con.earlyAccess'],
    ['pending', k => k === 'con.pendingBrief'], ['lang', k => k === 'con.lang']
  ];
  function renderControls(msg) {
    if (!box) return;
    const d = CON.SITE_STR[lang].dc; const all = keys();
    if (all === null) { box.textContent = d.blocked; return; }
    box.innerHTML = GROUPS.map(([g, test]) => { const n = all.filter(test).length; return '<div class="dc-row"><span><b>' + CON.esc(d[g]) + '</b><small>' + CON.esc(d[g + 'D']) + '</small></span><em class="muted small">' + (n ? CON.esc(d.stored) : CON.esc(d.none)) + '</em><button class="btn btn-light btn-sm" type="button" data-dc="' + g + '"' + (n ? '' : ' disabled') + '>' + CON.esc(d.del) + '</button></div>'; }).join('') +
      '<div class="dc-row"><span><b>' + CON.esc(d.all) + '</b><small>' + CON.esc(d.allD) + '</small></span><em class="muted small">' + (all.length ? CON.esc(d.stored) : CON.esc(d.none)) + '</em><button class="btn btn-danger btn-sm" type="button" data-dc="all"' + (all.length ? '' : ' disabled') + '>' + CON.esc(d.del) + '</button></div>' +
      (msg ? '<p class="small" role="status">' + CON.esc(msg) + '</p>' : '');
  }
  if (box) box.addEventListener('click', e => {
    const b = e.target.closest('[data-dc]'); if (!b) return;
    const g = b.dataset.dc; const all = keys() || [];
    const test = g === 'all' ? () => true : GROUPS.find(x => x[0] === g)[1];
    all.filter(test).forEach(k => CON.storage.remove(k));
    if (g === 'lang' || g === 'all') { lang = 'en'; CON.applyDir('en'); }
    apply(); renderControls(CON.SITE_STR[lang].dc.done);
  });
  const baseApply = apply;
  apply = function () { baseApply(); renderControls(); };
  apply();
})();
