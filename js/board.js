/* Pawn Parade - board geometry + canvas drawing */
(function (root) {
  'use strict';
  var R = root.PPRules;
  var ARMS = [
    { name: 'Blue',   color: '#2f80ed', dark: '#1a4f9e', light: '#d4e5fc', soft: '#8bb8f5' },
    { name: 'Yellow', color: '#f6c026', dark: '#a87900', light: '#fdf1c2', soft: '#f9d977' },
    { name: 'Red',    color: '#ec4b48', dark: '#a3201e', light: '#fbd5d4', soft: '#f39391' },
    { name: 'Green',  color: '#26b35f', dark: '#14703a', light: '#cdf0da', soft: '#7fd6a2' }
  ];
  var N = 19;

  // rotate a point (cell units) 90deg clockwise k times around board center
  function rot(x, y, k) { for (var i = 0; i < k; i++) { var nx = N - y; y = x; x = nx; } return [x, y]; }
  function arm0Local(l) { if (l < 8) return [8, 7 - l]; if (l === 8) return [9, 0]; return [10, l - 9]; }
  function trackCell(t) { var c = arm0Local(t % 17); return rot(c[0], c[1], Math.floor(t / 17)).concat(); }
  function trackPt(t) { var c = arm0Local(t % 17); return rot(c[0] + 0.5, c[1] + 0.5, Math.floor(t / 17)); }
  function pathPt(a, j) { return rot(9.5, 1.5 + j, a); }
  function nestCenter(a) { return rot(15, 4, a); }
  var NEST_OFF = [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]];
  function nestSlot(a, i) { return rot(15 + NEST_OFF[i][0], 4 + NEST_OFF[i][1], a); }
  var HOME_OFF = [[8.95, 8.42], [9.5, 8.42], [10.05, 8.42], [9.5, 8.95]];
  function homeSlot(a, i) { return rot(HOME_OFF[i][0], HOME_OFF[i][1], a); }
  // point for a pawn of arm a, index i, at progress p (ignoring stacking)
  function progPt(a, i, p) {
    if (p < 0) return nestSlot(a, i);
    if (p >= R.HOME) return homeSlot(a, i);
    if (p <= R.LAST) return trackPt(R.trackIndex(a, p));
    return pathPt(a, p - R.PATH0);
  }

  // Compute drawn positions of all pawns (cell units). disp: {arm:[prog x4]}; skip: set of keys
  function layout(disp, skip) {
    var groups = {}, out = {};
    Object.keys(disp).forEach(function (a) {
      a = +a;
      disp[a].forEach(function (p, i) {
        var k = a + '_' + i; if (skip && skip[k]) return;
        if (p < 0 || p >= R.HOME) {
          var pt = progPt(a, i, p);
          out[k] = { x: pt[0], y: pt[1], r: p < 0 ? 0.42 : 0.27, arm: a, i: i, p: p };
        } else {
          var sk = R.squareKey(a, p);
          (groups[sk] = groups[sk] || []).push({ a: a, i: i, p: p });
        }
      });
    });
    Object.keys(groups).forEach(function (sk) {
      var g = groups[sk];
      g.forEach(function (e, n) {
        var pt = progPt(e.a, e.i, e.p), off = g.length > 1 ? (n === 0 ? -0.2 : 0.2) : 0;
        out[e.a + '_' + e.i] = { x: pt[0] + off, y: pt[1] + off, r: g.length > 1 ? 0.33 : 0.4, arm: e.a, i: e.i, p: e.p };
      });
    });
    return out;
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (var k = 0; k < 10; k++) {
      var ang = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  function drawPawn(ctx, x, y, r, arm, lift) {
    var A = ARMS[arm]; lift = Math.max(0, lift || 0); r = Math.max(1, r);
    ctx.save();
    ctx.fillStyle = 'rgba(40,20,0,' + (0.28 - lift * 0.12) + ')';
    ctx.beginPath(); ctx.ellipse(x + r * 0.12, y + r * 0.28 + lift * r * 0.6, r * (1 - lift * 0.2), r * 0.6 * (1 - lift * 0.2), 0, 0, Math.PI * 2); ctx.fill();
    y -= lift * r * 1.4;
    var s = 1 + lift * 0.18; r *= s;
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, A.soft); g.addColorStop(0.7, A.color); g.addColorStop(1, A.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12); ctx.strokeStyle = A.dark; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
    ctx.restore();
  }

  // view: {disp, moving:{key:{x,y,lift}}, hl:{key:true}, sel:key|null, targets:[{x,y,label}], turnArm, t, confetti, active:{arm:true}}
  function draw(ctx, size, view) {
    var m = size * 0.015, c = (size - 2 * m) / N;
    function X(u) { return m + u * c; }
    ctx.clearRect(0, 0, size, size);
    // board base
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = size * 0.02; ctx.shadowOffsetY = size * 0.008;
    rr(ctx, m * 0.3, m * 0.3, size - m * 0.6, size - m * 0.6, c * 0.9); ctx.fillStyle = '#8a5a2b'; ctx.fill();
    ctx.restore();
    rr(ctx, X(0) - m * 0.2, X(0) - m * 0.2, N * c + m * 0.4, N * c + m * 0.4, c * 0.7); ctx.fillStyle = '#fff8ea'; ctx.fill();

    // nests
    for (var a = 0; a < 4; a++) {
      var A = ARMS[a], on = !view.active || view.active[a];
      var q = rot(11, 0, a), q2 = rot(19, 8, a);
      var qx = Math.min(q[0], q2[0]), qy = Math.min(q[1], q2[1]);
      rr(ctx, X(qx + 0.25), X(qy + 0.25), 7.5 * c, 7.5 * c, c * 0.9);
      ctx.fillStyle = on ? A.light : '#efe8da'; ctx.fill();
      ctx.lineWidth = c * 0.12; ctx.strokeStyle = on ? A.color : '#d8cfbf'; ctx.stroke();
      var nc = nestCenter(a);
      ctx.beginPath(); ctx.arc(X(nc[0]), X(nc[1]), c * 2.75, 0, Math.PI * 2);
      ctx.fillStyle = on ? A.color : '#ddd3c2'; ctx.fill();
      ctx.beginPath(); ctx.arc(X(nc[0]), X(nc[1]), c * 2.35, 0, Math.PI * 2);
      ctx.fillStyle = on ? A.soft : '#e8e0d0'; ctx.fill();
      if (view.turnArm === a && view.phase !== 'over') {
        ctx.beginPath(); ctx.arc(X(nc[0]), X(nc[1]), c * 3.05, 0, Math.PI * 2);
        ctx.lineWidth = c * 0.22; ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.35 * Math.sin(view.t / 250)) + ')'; ctx.stroke();
      }
      for (var i = 0; i < 4; i++) {
        var s = nestSlot(a, i);
        ctx.beginPath(); ctx.arc(X(s[0]), X(s[1]), c * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fill();
      }
    }
    // track
    for (var t = 0; t < R.TRACK; t++) {
      var cell = trackCell(t), arm = Math.floor(t / 17), loc = t % 17;
      // rot gives the cell's far corner for k odd; normalize by using center point
      var p = trackPt(t), x0 = X(p[0] - 0.5), y0 = X(p[1] - 0.5);
      var isStart = loc === 12, safe = R.isSafeTrack(t);
      rr(ctx, x0 + c * 0.05, y0 + c * 0.05, c * 0.9, c * 0.9, c * 0.18);
      ctx.fillStyle = isStart ? ARMS[arm].color : (safe ? '#ffe9a8' : '#ffffff'); ctx.fill();
      ctx.lineWidth = Math.max(1, c * 0.05); ctx.strokeStyle = isStart ? ARMS[arm].dark : '#e2cfa8'; ctx.stroke();
      if (safe) star(ctx, X(p[0]), X(p[1]), c * 0.34, isStart ? 'rgba(255,255,255,0.9)' : '#f0a500');
    }
    // home paths
    for (a = 0; a < 4; a++) for (var j = 0; j < 7; j++) {
      var hp = pathPt(a, j);
      rr(ctx, X(hp[0] - 0.45), X(hp[1] - 0.45), c * 0.9, c * 0.9, c * 0.18);
      ctx.fillStyle = ARMS[a].soft; ctx.fill();
      ctx.lineWidth = Math.max(1, c * 0.05); ctx.strokeStyle = ARMS[a].color; ctx.stroke();
      // chevron pointing to center
      ctx.save(); ctx.translate(X(hp[0]), X(hp[1])); ctx.rotate(a * Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(-c * 0.18, -c * 0.08); ctx.lineTo(0, c * 0.1); ctx.lineTo(c * 0.18, -c * 0.08);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = c * 0.08; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
    // center home triangles
    var cx = X(9.5), cy = X(9.5);
    for (a = 0; a < 4; a++) {
      var e1 = rot(8, 8, a), e2 = rot(11, 8, a);
      ctx.beginPath(); ctx.moveTo(X(e1[0]), X(e1[1])); ctx.lineTo(X(e2[0]), X(e2[1])); ctx.lineTo(cx, cy); ctx.closePath();
      ctx.fillStyle = ARMS[a].color; ctx.fill(); ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = c * 0.08; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, c * 0.42, 0, Math.PI * 2); ctx.fillStyle = '#fff8ea'; ctx.fill();
    star(ctx, cx, cy, c * 0.32, '#f0a500');

    // targets
    (view.targets || []).forEach(function (tg) {
      var pulse = 0.5 + 0.5 * Math.sin(view.t / 160);
      ctx.beginPath(); ctx.arc(X(tg.x), X(tg.y), c * (0.42 + pulse * 0.06), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      ctx.setLineDash([c * 0.14, c * 0.1]); ctx.lineWidth = c * 0.1; ctx.strokeStyle = ARMS[view.turnArm].dark; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ARMS[view.turnArm].dark; ctx.font = '800 ' + Math.round(c * (tg.label.length > 2 ? 0.36 : 0.5)) + 'px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tg.label, X(tg.x), X(tg.y) + c * 0.03);
    });

    // pawns
    var lay = layout(view.disp, view.moving);
    var keys = Object.keys(lay).sort(function (k1, k2) { return lay[k1].y - lay[k2].y; });
    keys.forEach(function (k) {
      var L = lay[k];
      if (view.hl && view.hl[k]) {
        var pul = 0.5 + 0.5 * Math.sin(view.t / 180);
        ctx.beginPath(); ctx.arc(X(L.x), X(L.y), c * (L.r + 0.16 + pul * 0.08), 0, Math.PI * 2);
        ctx.fillStyle = view.sel === k ? 'rgba(255,214,0,0.9)' : 'rgba(255,240,120,' + (0.45 + pul * 0.4) + ')'; ctx.fill();
        ctx.lineWidth = c * 0.07; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      }
      drawPawn(ctx, X(L.x), X(L.y), c * L.r, L.arm, 0);
    });
    Object.keys(view.moving || {}).forEach(function (k) {
      var mv = view.moving[k];
      drawPawn(ctx, X(mv.x), X(mv.y), c * (mv.r || 0.4), mv.arm, mv.lift || 0);
    });

    // confetti
    (view.confetti || []).forEach(function (f) {
      ctx.save(); ctx.translate(f.x * size, f.y * size); ctx.rotate(f.rot);
      ctx.fillStyle = f.color; ctx.fillRect(-c * 0.18, -c * 0.08, c * 0.36, c * 0.16); ctx.restore();
    });
  }

  function toCells(size, px) { var m = size * 0.015, c = (size - 2 * m) / N; return (px - m) / c; }
  function toPx(size, u) { var m = size * 0.015, c = (size - 2 * m) / N; return m + u * c; }

  root.PPBoard = { ARMS: ARMS, N: N, draw: draw, layout: layout, progPt: progPt, nestSlot: nestSlot, homeSlot: homeSlot, toCells: toCells, toPx: toPx, drawPawn: drawPawn };
})(typeof self !== 'undefined' ? self : globalThis);
