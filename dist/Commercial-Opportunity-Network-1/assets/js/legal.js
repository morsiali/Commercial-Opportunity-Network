/* Legal pages: header, language and copy */
(function () {
  'use strict';
  const CON = window.CON;
  let lang = CON.getLang();
  function apply() {
    CON.translateStatic(lang, CON.SITE_AR);
    document.querySelectorAll('[data-contact-email]').forEach(el => { el.textContent = CON.config.contactEmail; });
  }
  document.querySelectorAll('[data-lang-toggle]').forEach(b => b.addEventListener('click', () => { lang = lang === 'ar' ? 'en' : 'ar'; CON.setLang(lang); apply(); }));
  const menuBtn = document.querySelector('.menu-btn'); const menu = document.getElementById('mobile-menu');
  menuBtn.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.innerHTML = CON.icon(open ? 'x' : 'menu'); });
  document.querySelectorAll('[data-copy-email]').forEach(b => b.addEventListener('click', () => CON.copy(CON.config.contactEmail, CON.SITE_STR[lang].copied, CON.SITE_STR[lang].copyFail)));
  apply();
})();
