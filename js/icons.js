/* Pawn Parade - inline SVG icons (no emoji fonts needed) */
(function (root) {
  'use strict';
  var I = {};
  function svg(inner, vb) { return '<svg viewBox="' + (vb || '0 0 24 24') + '" aria-hidden="true" focusable="false">' + inner + '</svg>'; }
  I.person = svg('<circle cx="12" cy="7.5" r="4.2" fill="currentColor"/><path d="M3.5 21c0-4.7 3.8-8 8.5-8s8.5 3.3 8.5 8z" fill="currentColor"/>');
  I.robot = svg('<rect x="4" y="7" width="16" height="12" rx="3.5" fill="currentColor"/><rect x="11" y="2.5" width="2" height="4" fill="currentColor"/><circle cx="12" cy="2.6" r="1.6" fill="currentColor"/><circle cx="9" cy="12.5" r="1.9" fill="#fff"/><circle cx="15" cy="12.5" r="1.9" fill="#fff"/><rect x="8.5" y="15.6" width="7" height="1.6" rx=".8" fill="#fff"/><rect x="1.5" y="10.5" width="2" height="5" rx="1" fill="currentColor"/><rect x="20.5" y="10.5" width="2" height="5" rx="1" fill="currentColor"/>');
  I.off = svg('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>');
  I.sound = svg('<path d="M3 9.5h4l5-4.5v14l-5-4.5H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>');
  I.mute = svg('<path d="M3 9.5h4l5-4.5v14l-5-4.5H3z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>');
  I.help = svg('<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9.2 9.3a2.9 2.9 0 115 2c-1 .9-2.2 1.4-2.2 3" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.5" fill="currentColor"/>');
  I.home = svg('<path d="M3 11.5L12 4l9 7.5" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5V20h5v-5h3v5h5v-9.5L12 5z" fill="currentColor"/>');
  I.play = svg('<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>');
  I.again = svg('<path d="M19 12a7 7 0 11-2.1-5" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M18.5 2.5v5h-5" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  I.star = svg('<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="#f0a500" stroke="#c98500" stroke-width="1"/>');
  I.trophy = svg('<path d="M7 3h10v6a5 5 0 01-10 0z" fill="#ffc83d" stroke="#b8860b" stroke-width="1.2"/><path d="M7 5H3.5a3.5 3.5 0 004 4M17 5h3.5a3.5 3.5 0 01-4 4" stroke="#b8860b" stroke-width="1.6" fill="none"/><rect x="10.8" y="13.5" width="2.4" height="4" fill="#e0a800"/><rect x="7.5" y="17.5" width="9" height="3.5" rx="1" fill="#8a5a2b"/>');
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  I.die = function (n, fill) {
    var s = '<rect x="2" y="2" width="20" height="20" rx="5" fill="' + (fill || '#fff') + '" stroke="#5b3a1a" stroke-width="1.5"/>';
    (PIPS[n] || []).forEach(function (k) { s += '<circle cx="' + (7 + (k % 3) * 5) + '" cy="' + (7 + Math.floor(k / 3) * 5) + '" r="1.9" fill="#2b1a0e"/>'; });
    return svg(s);
  };
  I.pawn = function (color, dark) {
    return svg('<circle cx="12" cy="12" r="9" fill="' + color + '" stroke="' + dark + '" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6"/><circle cx="9" cy="8.5" r="2" fill="rgba(255,255,255,.7)"/>');
  };
  I.PIPS = PIPS;
  root.PPIcons = I;
})(typeof self !== 'undefined' ? self : globalThis);
