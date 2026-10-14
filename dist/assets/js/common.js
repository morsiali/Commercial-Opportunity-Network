/* Commercial Opportunity Network — shared runtime (storage, language, icons, toasts) */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};

  /* ---------- Safe storage (falls back to memory when blocked) ---------- */
  const memory = {};
  CON.storage = {
    get(key, fallback) {
      try {
        const raw = root.localStorage.getItem(key);
        if (raw == null) return key in memory ? memory[key] : fallback;
        return JSON.parse(raw);
      } catch (e) { return key in memory ? memory[key] : fallback; }
    },
    set(key, value) {
      memory[key] = value;
      try { root.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) {
      delete memory[key];
      try { root.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- Contact configuration (change in one place) ---------- */
  CON.config = {
    contactEmail: 'visionseven@gmail.com',
    platformFeeRate: 0.07,
    vatRate: 0.05,
    currency: 'AED'
  };

  /* ---------- Icons (inline SVG sprite) ---------- */
  const P = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
    'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    users: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M16 13.5h.01"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z"/>',
    compare: '<rect x="3.5" y="5" width="7" height="14" rx="1.8"/><rect x="13.5" y="5" width="7" height="14" rx="1.8"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/>',
    inbox: '<path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20"/><path d="M6.5 5h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5l2.5-8Z"/>',
    handshake: '<path d="m11 17 2 2a1.4 1.4 0 0 0 2-2"/><path d="m14 14 2.5 2.5a1.4 1.4 0 0 0 2-2l-3.8-3.8a2.8 2.8 0 0 0-4 0l-.9.9a1.4 1.4 0 0 1-2-2L10.6 7a4 4 0 0 1 5 0L18 9l3 0"/><path d="M3 9h3l6 6"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
    track: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    shield: '<path d="M12 3 5 6v5.5c0 4.4 3 7.9 7 9.5 4-1.6 7-5.1 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15M10.5 21v-3h3v3"/>',
    store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8M10 20v-4.5h4V20"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    coffee: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3M14 3v3"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    bed: '<path d="M3 18V7M3 13h18v5M21 13v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="10.5" r="1.8"/>',
    ticket: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4V7.5Z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9S10.5 4 8 4.5 7 9 12 9ZM12 9s1.5-5 4-4.5S17 9 12 9Z"/>',
    cap: '<path d="m2.5 9.5 9.5-5 9.5 5-9.5 5-9.5-5Z"/><path d="M6.5 11.6V16c0 1.3 2.5 3 5.5 3s5.5-1.7 5.5-3v-4.4M21.5 9.5V15"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z"/><path d="M10 20v-5.5h4V20"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="m4 18 5-5 4 4 2.5-2.5L20 19"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h11"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'chevron-left': '<path d="m15 6-6 6 6 6"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    map: '<path d="m9 4-5.5 2v14L9 18l6 2 5.5-2V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/>',
    megaphone: '<path d="M3.5 10v4a1 1 0 0 0 1 1H7l7 4.5V4.5L7 9H4.5a1 1 0 0 0-1 1Z"/><path d="M18 9a4 4 0 0 1 0 6M8 15l1 5"/>',
    office: '<path d="M3 21h18M5 21V8l7-4v17M12 9h7v12M8 10h.01M8 13.5h.01M8 17h.01M15.5 13h.01M15.5 16.5h.01"/>',
    tent: '<path d="M3 20 12 4l9 16H3Z"/><path d="m12 4-1 2M12 20l-3.5-6M12 20l3.5-6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    quote: '<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>',
    whatsapp: '<path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6l-3.9.9Z"/><path d="M9 9.5c.3 2.3 2.2 4.2 4.5 4.6l1-1.1 1.8.8-.3 1.6c-3.8.3-7.3-3.2-7-7l1.6-.3.8 1.8L9 9.5Z"/>'
  };
  CON.iconNames = Object.keys(P);
  CON.icon = function (name, cls) {
    return '<svg class="i i-' + name + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.info) + '</svg>';
  };
  CON.logoMark = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="7" r="2.4" fill="#fff"/><circle cx="18" cy="7" r="2.4" fill="#5fb4ff"/><circle cx="12" cy="17.5" r="2.6" fill="#fff"/><path d="M7.8 8.6 10.6 15.5M16.2 8.6 13.4 15.5M8.4 7h7.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".75"/></svg>';
  /* Replace <i data-icon="name"></i> placeholders in static markup */
  CON.hydrateIcons = function (scope) {
    (scope || document).querySelectorAll('i[data-icon]').forEach(function (el) {
      const tpl = document.createElement('template');
      tpl.innerHTML = CON.icon(el.getAttribute('data-icon'), el.getAttribute('data-class') || '');
      el.replaceWith(tpl.content.firstChild);
    });
    (scope || document).querySelectorAll('[data-logo-mark]').forEach(function (el) { el.innerHTML = CON.logoMark; });
  };

  /* ---------- HTML escape ---------- */
  CON.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; });
  };

  /* ---------- Language ---------- */
  CON.getLang = function () {
    const l = CON.storage.get('con.lang', null);
    return l === 'ar' ? 'ar' : 'en';
  };
  CON.applyDir = function (lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };
  CON.setLang = function (lang) {
    CON.storage.set('con.lang', lang);
    CON.applyDir(lang);
    document.dispatchEvent(new CustomEvent('con:lang', { detail: lang }));
  };
  /* Static-page translation: English lives in the markup, Arabic in CON.SITE_AR */
  CON.translateStatic = function (lang, dict) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (el.__en == null) el.__en = el.innerHTML;
      const key = el.getAttribute('data-i18n');
      el.innerHTML = lang === 'ar' && dict[key] != null ? dict[key] : el.__en;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      if (el.__enPh == null) el.__enPh = el.getAttribute('placeholder') || '';
      const key = el.getAttribute('data-i18n-ph');
      el.setAttribute('placeholder', lang === 'ar' && dict[key] != null ? dict[key] : el.__enPh);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      if (el.__enAria == null) el.__enAria = el.getAttribute('aria-label') || '';
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', lang === 'ar' && dict[key] != null ? dict[key] : el.__enAria);
    });
    CON.hydrateIcons();
  };

  /* ---------- Toasts ---------- */
  CON.toast = function (msg, icon) {
    let rootEl = document.getElementById('toast-root');
    if (!rootEl) { rootEl = document.createElement('div'); rootEl.id = 'toast-root'; document.body.appendChild(rootEl); }
    rootEl.className = 'toast-root';
    rootEl.setAttribute('aria-live', 'polite');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = CON.icon(icon || 'check-circle') + '<div>' + CON.esc(msg) + '</div>';
    rootEl.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, 3600);
  };

  /* ---------- Clipboard with fallback ---------- */
  CON.copy = function (text, okMsg, failMsg) {
    function fallback() {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand && document.execCommand('copy');
        ta.remove();
        CON.toast(ok ? okMsg : failMsg, ok ? 'check-circle' : 'info');
      } catch (e) { CON.toast(failMsg, 'info'); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { CON.toast(okMsg, 'check-circle'); }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  };

  /* ---------- Formatting ---------- */
  CON.fmtNum = function (n, lang) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-AE', { maximumFractionDigits: 0 }).format(n);
  };
  CON.fmtAED = function (n, lang) {
    if (n == null || isNaN(n)) return '—';
    return (lang === 'ar' ? CON.fmtNum(n, lang) + ' د.إ' : 'AED ' + CON.fmtNum(n, lang));
  };
  CON.fmtDate = function (iso, lang) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return '—';
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  };

  /* Apply stored direction as early as possible */
  if (typeof document !== 'undefined') CON.applyDir(CON.getLang());
})(typeof window !== 'undefined' ? window : globalThis);
