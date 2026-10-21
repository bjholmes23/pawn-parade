/* Pawn Parade - pure rules engine (no DOM). Works in browser and Node. */
(function (root) {
  'use strict';
  var TRACK = 68;          // squares on the outer loop
  var LAST = 64;           // last track progress (your home-entry square)
  var PATH0 = 65;          // first home-path progress
  var HOME = 72;           // home center
  var SAFE_LOCAL = [4, 8, 12]; // per arm: 12 safe squares total
  var CAPTURE_BONUS = 20, HOME_BONUS = 10;

  function startIdx(arm) { return arm * 17 + 12; }
  function trackIndex(arm, prog) { return (startIdx(arm) + prog) % TRACK; }
  function isSafeTrack(t) { return SAFE_LOCAL.indexOf(t % 17) !== -1; }
  function squareKey(arm, prog) {
    if (prog < 0) return 'N' + arm;
    if (prog <= LAST) return 'T' + trackIndex(arm, prog);
    if (prog < HOME) return 'H' + arm + '_' + (prog - PATH0);
    return 'X' + arm;
  }
  function isSafeKey(key) { return key.charAt(0) === 'T' ? isSafeTrack(+key.slice(1)) : true; }

  function newGame(seats) {
    var pawns = {};
    seats.forEach(function (s) { pawns[s.arm] = [-1, -1, -1, -1]; });
    return {
      seats: seats.map(function (s) { return { arm: s.arm, kind: s.kind }; }),
      pawns: pawns, turn: 0, phase: 'roll', dice: null, used: [true, true],
      doubles: 0, bonus: [], winner: null, turnCount: 0, moveCount: 0
    };
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function currentArm(s) { return s.seats[s.turn].arm; }

  function occupants(s, key) {
    var out = [];
    for (var a in s.pawns) {
      var arr = s.pawns[a];
      for (var i = 0; i < 4; i++) if (squareKey(+a, arr[i]) === key) out.push({ arm: +a, i: i });
    }
    return out;
  }
  function isBlockade(s, key) {
    if (key.charAt(0) === 'N' || key.charAt(0) === 'X') return false;
    var o = occupants(s, key);
    return o.length >= 2 && o[0].arm === o[1].arm;
  }

  // Returns a move object or null if illegal.
  function legalMove(s, arm, i, value, src) {
    var p = s.pawns[arm][i];
    if (p >= HOME) return null;
    var m = { arm: arm, i: i, from: p, to: 0, path: [], capture: null, enter: false, value: value, src: src };
    if (p < 0) {
      if (value !== 5 || src === 'bonus') return null;
      var occ = occupants(s, squareKey(arm, 0));
      var own = occ.filter(function (o) { return o.arm === arm; });
      var opp = occ.filter(function (o) { return o.arm !== arm; });
      if (own.length >= 2) return null;
      if (opp.length >= 2 && opp[0].arm === opp[1].arm) return null; // enemy blockade on your start
      if (opp.length) m.capture = opp[opp.length - 1]; // entering bumps an enemy off your own start
      m.to = 0; m.path = [0]; m.enter = true;
      return m;
    }
    var to = p + value;
    if (to > HOME) return null; // exact count needed for home
    for (var q = p + 1; q <= to; q++) {
      m.path.push(q);
      if (q < to && isBlockade(s, squareKey(arm, q))) return null; // can't pass a blockade
    }
    m.to = to;
    if (to === HOME) return m;
    var key = squareKey(arm, to);
    var o2 = occupants(s, key);
    if (o2.length >= 2) return null; // max 2 per square (also: can't land on a blockade)
    if (o2.length === 1 && o2[0].arm !== arm && !isSafeKey(key)) m.capture = o2[0];
    return m;
  }

  function values(s) {
    if (s.phase !== 'move') return [];
    if (s.bonus.length) return [{ v: s.bonus[0], src: 'bonus' }];
    var v = [];
    if (!s.used[0]) v.push({ v: s.dice[0], src: 'd0' });
    if (!s.used[1]) v.push({ v: s.dice[1], src: 'd1' });
    if (!s.used[0] && !s.used[1]) v.push({ v: s.dice[0] + s.dice[1], src: 'sum' });
    return v;
  }
  function options(s) {
    var arm = currentArm(s), out = [];
    values(s).forEach(function (x) {
      for (var i = 0; i < 4; i++) { var m = legalMove(s, arm, i, x.v, x.src); if (m) out.push(m); }
    });
    return out;
  }

  function nextTurn(s) {
    s.turn = (s.turn + 1) % s.seats.length;
    s.phase = 'roll'; s.doubles = 0; s.bonus = []; s.used = [true, true];
  }

  // After any change: forfeit unusable bonuses, then end dice / grant extra roll.
  function settle(s) {
    var res = { forfeit: [], ended: false, again: false };
    while (s.phase === 'move') {
      if (options(s).length) return res;
      if (s.bonus.length) { res.forfeit.push(s.bonus.shift()); continue; }
      if (s.dice[0] === s.dice[1]) { s.phase = 'roll'; s.used = [true, true]; res.again = true; }
      else { nextTurn(s); res.ended = true; }
    }
    return res;
  }

  function roll(s, a, b) {
    if (s.phase !== 'roll') throw new Error('not roll phase');
    s.dice = [a, b]; s.used = [false, false]; s.turnCount++;
    var dbl = a === b;
    s.doubles = dbl ? s.doubles + 1 : 0;
    var info = { doubles: dbl, penalty: null, forfeit: [], ended: false, again: false };
    if (dbl && s.doubles >= 3) {
      var arm = currentArm(s), best = -1, bi = -1;
      s.pawns[arm].forEach(function (p, i) { if (p >= 0 && p <= LAST && p > best) { best = p; bi = i; } });
      if (bi >= 0) { info.penalty = { arm: arm, i: bi, from: best }; s.pawns[arm][bi] = -1; }
      nextTurn(s); info.ended = true;
      return info;
    }
    s.phase = 'move';
    var r = settle(s);
    info.forfeit = r.forfeit; info.ended = r.ended; info.again = r.again;
    return info;
  }

  function apply(s, m) {
    if (s.phase !== 'move') throw new Error('not move phase');
    var chk = legalMove(s, m.arm, m.i, m.value, m.src);
    if (!chk || chk.to !== m.to || m.arm !== currentArm(s)) throw new Error('illegal move');
    s.pawns[m.arm][m.i] = m.to; s.moveCount++;
    if (m.src === 'bonus') s.bonus.shift();
    else if (m.src === 'sum') s.used = [true, true];
    else s.used[m.src === 'd0' ? 0 : 1] = true;
    var ev = { move: m, captured: null, bonusAdded: [], forfeit: [], ended: false, again: false, win: null };
    if (chk.capture) {
      var c = chk.capture;
      ev.captured = { arm: c.arm, i: c.i, from: s.pawns[c.arm][c.i] };
      s.pawns[c.arm][c.i] = -1;
      s.bonus.push(CAPTURE_BONUS); ev.bonusAdded.push(CAPTURE_BONUS);
    }
    if (m.to === HOME) {
      if (s.pawns[m.arm].every(function (p) { return p === HOME; })) {
        s.winner = m.arm; s.phase = 'over'; ev.win = m.arm; return ev;
      }
      s.bonus.push(HOME_BONUS); ev.bonusAdded.push(HOME_BONUS);
    }
    var r = settle(s);
    ev.forfeit = r.forfeit; ev.ended = r.ended; ev.again = r.again;
    return ev;
  }

  var R = {
    TRACK: TRACK, LAST: LAST, PATH0: PATH0, HOME: HOME, CAPTURE_BONUS: CAPTURE_BONUS, HOME_BONUS: HOME_BONUS,
    startIdx: startIdx, trackIndex: trackIndex, isSafeTrack: isSafeTrack, squareKey: squareKey, isSafeKey: isSafeKey,
    newGame: newGame, clone: clone, currentArm: currentArm, occupants: occupants, isBlockade: isBlockade,
    legalMove: legalMove, options: options, roll: roll, apply: apply, settle: settle, nextTurn: nextTurn
  };
  root.PPRules = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof self !== 'undefined' ? self : globalThis);
