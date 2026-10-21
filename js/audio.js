/* Pawn Parade - tiny WebAudio sound effects (no files) */
(function (root) {
  'use strict';
  var S = { ctx: null, muted: false };
  try {
    // migrate the old key from the first test build, then read the new one
    var old = localStorage.getItem('pp_muted');
    if (old !== null) { if (localStorage.getItem('pawnparade_muted') === null) localStorage.setItem('pawnparade_muted', old); localStorage.removeItem('pp_muted'); }
    S.muted = localStorage.getItem('pawnparade_muted') === '1';
  } catch (e) {}
  S.unlock = function () {
    try {
      if (!S.ctx) { var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return; S.ctx = new AC(); }
      if (S.ctx.state === 'suspended') S.ctx.resume();
    } catch (e) {}
  };
  S.setMuted = function (m) { S.muted = m; try { localStorage.setItem('pawnparade_muted', m ? '1' : '0'); } catch (e) {} };
  function ok() { return S.ctx && !S.muted && S.ctx.state === 'running'; }
  function tone(f, dur, o) {
    if (!ok()) return; o = o || {};
    var ctx = S.ctx, t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    var v = o.vol || 0.18;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ctx.destination); osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(dur, o) {
    if (!ok()) return; o = o || {};
    var ctx = S.ctx, t0 = ctx.currentTime + (o.delay || 0), n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = o.freq || 1800; f.Q.value = 1.2;
    g.gain.value = o.vol || 0.25; src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t0);
  }
  S.rattle = function () { for (var k = 0; k < 5; k++) noise(0.05, { delay: k * 0.09, freq: 1400 + Math.random() * 1600, vol: 0.3 }); };
  S.land = function () { tone(220, 0.12, { type: 'triangle', vol: 0.2 }); noise(0.06, { freq: 900, vol: 0.2 }); };
  S.hop = function () { tone(520 + Math.random() * 60, 0.08, { type: 'sine', slide: 780, vol: 0.12 }); };
  S.enter = function () { tone(392, 0.12, { type: 'triangle' }); tone(587, 0.18, { type: 'triangle', delay: 0.1 }); };
  S.bump = function () { tone(660, 0.35, { type: 'square', slide: 140, vol: 0.09 }); noise(0.15, { freq: 500, vol: 0.3 }); };
  S.home = function () { [523, 659, 784, 1046].forEach(function (f, k) { tone(f, 0.18, { type: 'triangle', delay: k * 0.09 }); }); };
  S.doubles = function () { tone(880, 0.12, { type: 'sine', vol: 0.15 }); tone(1175, 0.2, { type: 'sine', delay: 0.1, vol: 0.15 }); };
  S.nope = function () { tone(196, 0.22, { type: 'sawtooth', vol: 0.06, slide: 150 }); };
  S.oops = function () { tone(440, 0.5, { type: 'triangle', slide: 110, vol: 0.18 }); };
  S.tap = function () { tone(700, 0.05, { type: 'sine', vol: 0.08 }); };
  S.win = function () { [523, 659, 784, 659, 784, 1046].forEach(function (f, k) { tone(f, k === 5 ? 0.5 : 0.16, { type: 'triangle', delay: k * 0.13, vol: 0.2 }); }); };
  root.PPSound = S;
})(typeof self !== 'undefined' ? self : globalThis);
