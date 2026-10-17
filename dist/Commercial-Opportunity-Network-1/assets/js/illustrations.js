/* Generated illustrations for opportunity types (no external images) */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const palettes = {
    mall_activation: ['#0f4fd1', '#4aa8ff'], residential_sampling: ['#0b6b5c', '#3fd0a8'], gym_partnership: ['#16213f', '#3c63d9'],
    cafe_partnership: ['#6b3a1e', '#e0a46a'], indoor_media: ['#0b1730', '#2b9aff'], office_activation: ['#253246', '#8aa5c8'],
    hotel_activation: ['#5a2a52', '#d68ac4'], event_sponsorship: ['#7a1f2b', '#ff8a5b'], popup_space: ['#1d3c8a', '#9ad0ff'],
    university_activation: ['#2a2a7a', '#8b8bff'], retail_partnership: ['#1f5a2c', '#9be07a'], digital_retargeting: ['#0e2a4a', '#5fe0ff']
  };
  let n = 0;
  CON.illus = function (type) {
    const pal = palettes[type] || palettes.mall_activation;
    const id = 'g' + (++n);
    const icon = (CON.DATA && CON.DATA.typeIcons[type]) || 'layers';
    const glyph = CON.icon(icon).replace('<svg ', '<svg x="140" y="80" width="120" height="120" ').replace('stroke-width="1.8"', 'stroke-width="1.3"');
    let dots = '';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 9; x++) {
      const op = ((x * 7 + y * 13) % 10) / 22 + .06;
      dots += '<circle cx="' + (232 + x * 18) + '" cy="' + (176 + y * 18) + '" r="1.6" fill="#fff" opacity="' + op.toFixed(2) + '"/>';
    }
    return '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/><stop offset="1" stop-color="' + pal[1] + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'r" cx=".5" cy=".45" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="400" height="300" fill="url(#' + id + ')"/>' +
      '<circle cx="200" cy="140" r="150" fill="url(#' + id + 'r)"/>' +
      dots +
      '<rect x="40" y="36" width="96" height="26" rx="13" fill="#fff" fill-opacity=".18"/><circle cx="56" cy="49" r="5" fill="#fff"/><rect x="68" y="45" width="54" height="8" rx="4" fill="#fff" fill-opacity=".7"/>' +
      '<rect x="128" y="68" width="144" height="144" rx="36" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".35"/>' +
      '<g color="#fff">' + glyph + '</g>' +
      '<rect x="40" y="236" width="150" height="34" rx="12" fill="#fff" fill-opacity=".92"/><rect x="54" y="248" width="60" height="10" rx="5" fill="' + pal[0] + '" fill-opacity=".85"/><rect x="122" y="248" width="54" height="10" rx="5" fill="' + pal[1] + '" fill-opacity=".7"/>' +
      '</svg>';
  };
  CON.hydrateIllus = function (scope) {
    (scope || document).querySelectorAll('[data-illus]').forEach(function (el) {
      if (!el.firstChild) el.innerHTML = CON.illus(el.getAttribute('data-illus'));
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
