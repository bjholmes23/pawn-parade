/* Pawn Parade - simple computer player */
(function (root) {
  'use strict';
  var R = root.PPRules || (typeof require !== 'undefined' ? require('./rules.js') : null);

  // How many enemy pawns could land on this square next turn (rough).
  function threatsAt(s, arm, prog) {
    if (prog < 0 || prog > R.LAST) return 0;
    var t = R.trackIndex(arm, prog), n = 0;
    var safe = R.isSafeTrack(t);
    s.seats.forEach(function (seat) {
      var a = seat.arm; if (a === arm) return;
      if (safe) { if (R.startIdx(a) === t && s.pawns[a].some(function (p) { return p < 0; })) n++; return; }
      s.pawns[a].forEach(function (p) {
        if (p < 0 || p > R.LAST) return;
        var d = (t - R.trackIndex(a, p) + R.TRACK) % R.TRACK;
        if (d >= 1 && d <= 12 && p + d <= R.LAST) n++;
      });
    });
    return n;
  }

  function score(s, m) {
    var sc = 0, arm = m.arm;
    if (m.capture) sc += 120;
    if (m.to === R.HOME) sc += 90;
    if (m.enter) sc += 70;
    if (m.from <= R.LAST && m.to > R.LAST && m.to < R.HOME) sc += 45;
    var before = m.from >= 0 ? threatsAt(s, arm, m.from) : 0;
    var after = m.to <= R.LAST ? threatsAt(s, arm, m.to) : 0;
    sc += before * 18 - after * 30;
    if (m.to <= R.LAST && R.isSafeTrack(R.trackIndex(arm, m.to))) sc += 15;
    if (m.to < R.HOME) {
      var occ = R.occupants(s, R.squareKey(arm, m.to));
      if (occ.some(function (o) { return o.arm === arm && o.i !== m.i; })) sc += 12;
    }
    sc += m.to * 0.2;
    if (m.src === 'sum') sc -= 1;
    return sc;
  }

  function choose(s, opts, rng) {
    rng = rng || Math.random;
    var best = null, bs = -1e9;
    opts.forEach(function (m) { var v = score(s, m) + rng() * 3; if (v > bs) { bs = v; best = m; } });
    return best;
  }

  var AI = { choose: choose, score: score, threatsAt: threatsAt };
  root.PPAI = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof self !== 'undefined' ? self : globalThis);
