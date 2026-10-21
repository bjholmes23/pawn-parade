/* Pawn Parade - UI controller */
(function () {
  'use strict';
  var R = window.PPRules, AI = window.PPAI, B = window.PPBoard, S = window.PPSound, I = window.PPIcons;
  var ARMS = B.ARMS;
  var SEAT_ORDER = [2, 3, 0, 1]; // Red, Green, Blue, Yellow (clockwise turn order)

  var params = new URLSearchParams(location.search);
  var DEMO = params.get('demo') === '1';
  var SPEED = params.has('speed') ? Math.max(0, parseFloat(params.get('speed')) || 0) : (DEMO ? 0.12 : 1);
  var MAX_GAMES = params.has('games') ? parseInt(params.get('games'), 10) : Infinity;
  var T = { dice: 650, hop: 150, enter: 320, fly: 420, aiRoll: 600, aiMove: 480, msg: 850 };
  Object.keys(T).forEach(function (k) { T[k] = Math.round(T[k] * SPEED); });

  // Seeded RNG (mulberry32) so ?seed= gives repeatable games
  var seed = params.has('seed') ? (parseInt(params.get('seed'), 10) || 1) : (Math.random() * 2147483647) | 0;
  function rng() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function rollDie() { return 1 + Math.floor(rng() * 6); }

  var STATS = window.PP_STATS = { games: 0, winners: [], rolls: [], moves: [], errors: [], demo: DEMO, speed: SPEED };
  window.addEventListener('error', function (e) { STATS.errors.push(String(e.message || e)); });
  window.addEventListener('unhandledrejection', function (e) { STATS.errors.push('rejection: ' + String(e.reason && e.reason.stack || e.reason)); });

  function $(id) { return document.getElementById(id); }
  var canvas = $('board'), ctx = canvas.getContext('2d'), wrap = $('boardWrap');
  var size = 300, dirty = true;

  // ---------- state ----------
  var state = null, disp = null, gen = 0, paused = false;
  var moving = {}, hl = {}, targets = [], choice = null, pendingRoll = null, tweens = [], confetti = [];
  var lastDice = [5, 5], seatsCfg = loadSeats();

  function loadSeats() {
    var d = { 2: 'human', 3: 'ai', 0: 'human', 1: 'ai' };
    try {
      var old = localStorage.getItem('pp_seats'); // migrate key from the first test build
      if (old !== null) { if (localStorage.getItem('pawnparade_seats') === null) localStorage.setItem('pawnparade_seats', old); localStorage.removeItem('pp_seats'); }
    } catch (e) {}
    try { var s = JSON.parse(localStorage.getItem('pawnparade_seats') || 'null'); if (s && typeof s === 'object') return Object.assign(d, s); } catch (e) {}
    return d;
  }
  function saveSeats() { try { localStorage.setItem('pawnparade_seats', JSON.stringify(seatsCfg)); } catch (e) {} }

  // ---------- timing ----------
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function wait(ms) { await sleep(ms > 0 ? ms : 0); while (paused) await sleep(100); }
  function tween(ms, fn) {
    if (ms <= 0) { fn(1); dirty = true; return sleep(0); }
    return new Promise(function (res) { tweens.push({ t0: performance.now(), ms: ms, fn: fn, res: res }); });
  }

  // ---------- render loop ----------
  var nowT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    nowT = now;
    if (tweens.length) {
      var keep = [];
      tweens.forEach(function (tw) {
        var k = Math.max(0, Math.min(1, (now - tw.t0) / tw.ms)); tw.fn(k);
        if (k >= 1) tw.res(); else keep.push(tw);
      });
      tweens = keep; dirty = true;
    }
    if (confetti.length) {
      confetti.forEach(function (f) { f.x += f.vx; f.y += f.vy; f.vy += 0.00012; f.rot += f.vr; });
      confetti = confetti.filter(function (f) { return f.y < 1.15; }); dirty = true;
    }
    var pulsing = Object.keys(hl).length || targets.length;
    if (dirty || pulsing) { render(); dirty = false; }
  }
  function render() {
    if (!disp) return;
    var active = {};
    state.seats.forEach(function (s) { active[s.arm] = true; });
    B.draw(ctx, size, {
      disp: disp, moving: moving, hl: hl, sel: choice && choice.sel, targets: targets,
      turnArm: R.currentArm(state), phase: state.phase, t: nowT, confetti: confetti, active: active
    });
  }
  function resize() {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    var css = Math.max(160, Math.floor(Math.min(w, h)));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    size = css;
    canvas.style.width = css + 'px'; canvas.style.height = css + 'px';
    canvas.width = Math.round(css * dpr); canvas.height = Math.round(css * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }

  // ---------- panel ----------
  function setDie(el, n) { el.innerHTML = I.die(n); el.dataset.v = n; }
  function setMsg(t) { $('msg').textContent = t; }
  function updatePanel() {
    var arm = R.currentArm(state), A = ARMS[arm], seat = state.seats[state.turn];
    var root = document.documentElement;
    root.style.setProperty('--pc', A.color); root.style.setProperty('--pd', A.dark);
    $('turnPawn').innerHTML = I.pawn(A.color, A.dark);
    $('turnName').textContent = A.name;
    $('turnKind').innerHTML = seat.kind === 'ai' ? I.robot : I.person;
    var used = state.phase === 'move' ? state.used : [true, true];
    if (state.phase === 'roll' && !state.dice) used = [false, false];
    setDie($('die0'), lastDice[0]); setDie($('die1'), lastDice[1]);
    $('die0').classList.toggle('used', !!used[0]); $('die1').classList.toggle('used', !!used[1]);
    var bonus = state.phase === 'move' && state.bonus.length ? state.bonus[0] : 0;
    var chip = $('bonus');
    chip.classList.toggle('hidden', !bonus);
    if (bonus) chip.innerHTML = '<span class="ic">' + I.star + '</span>+' + bonus;
    var canRoll = !!pendingRoll;
    var btn = $('rollBtn');
    btn.disabled = !canRoll; btn.classList.toggle('ready', canRoll);
    $('rollIc').innerHTML = seat.kind === 'ai' ? I.robot : I.die(5);
    $('rollTxt').textContent = seat.kind === 'ai' ? '...' : 'Roll';
    $('panel').style.setProperty('--pc', A.color);
  }
  function updateMute() { $('muteBtn').innerHTML = S.muted ? I.mute : I.sound; }

  // ---------- animations ----------
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function pawnPoint(arm, i) { var L = B.layout(disp)[arm + '_' + i]; return L ? { x: L.x, y: L.y, r: L.r } : null; }
  async function hop(key, arm, from, to, ms, high, r1, r2) {
    await tween(ms, function (k) {
      var e = ease(k);
      moving[key] = { arm: arm, x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), r: lerp(r1, r2, e), lift: Math.sin(Math.PI * k) * (high || 0.6) };
    });
  }
  async function flyHome(arm, i, toProg, my) {
    var key = arm + '_' + i, from = pawnPoint(arm, i); if (!from) return;
    var tp = B.progPt(arm, i, toProg);
    moving[key] = { arm: arm, x: from.x, y: from.y, r: from.r, lift: 0 };
    await hop(key, arm, from, { x: tp[0], y: tp[1] }, T.fly, 1.2, from.r, toProg < 0 ? 0.42 : 0.27);
    if (my !== gen) return;
    delete moving[key]; disp[arm][i] = toProg; dirty = true;
  }
  async function animateMove(ev, my) {
    var m = ev.move, key = m.arm + '_' + m.i;
    var cur = pawnPoint(m.arm, m.i);
    moving[key] = { arm: m.arm, x: cur.x, y: cur.y, r: cur.r, lift: 0 };
    if (m.enter) S.enter();
    for (var n = 0; n < m.path.length; n++) {
      var q = m.path[n], p = B.progPt(m.arm, m.i, q), nx = { x: p[0], y: p[1] };
      var r2 = q >= R.HOME ? 0.27 : 0.4;
      await hop(key, m.arm, cur, nx, m.enter ? T.enter : T.hop, m.enter ? 1.2 : 0.6, cur.r, r2);
      if (my !== gen) return;
      if (!m.enter) S.hop();
      cur = { x: nx.x, y: nx.y, r: r2 };
    }
    disp[m.arm][m.i] = m.to;
    if (ev.captured) {
      var c = ev.captured; S.bump();
      delete moving[key]; dirty = true;
      await flyHome(c.arm, c.i, -1, my);
    }
    delete moving[key]; disp = R.clone(state.pawns); dirty = true;
    if (m.to === R.HOME) S.home(); else if (!ev.captured) S.land();
  }
  async function animateDice(a, b) {
    var d0 = $('die0'), d1 = $('die1');
    d0.classList.remove('used'); d1.classList.remove('used');
    S.rattle();
    if (T.dice > 0) {
      d0.classList.add('rolling'); d1.classList.add('rolling');
      var end = performance.now() + T.dice;
      while (performance.now() < end) {
        setDie(d0, 1 + Math.floor(Math.random() * 6)); setDie(d1, 1 + Math.floor(Math.random() * 6));
        await sleep(70);
      }
      d0.classList.remove('rolling'); d1.classList.remove('rolling');
    }
    lastDice = [a, b]; setDie(d0, a); setDie(d1, b); S.land();
  }

  // ---------- human input ----------
  function waitRoll() { return new Promise(function (res) { pendingRoll = res; updatePanel(); }); }
  function doRoll() {
    if (!pendingRoll) return;
    var r = pendingRoll; pendingRoll = null; S.tap(); updatePanel(); r();
  }
  function waitChoice(opts) {
    return new Promise(function (res) {
      choice = { opts: opts, res: res, sel: null }; hl = {}; targets = [];
      opts.forEach(function (o) { hl[o.arm + '_' + o.i] = true; });
      dirty = true;
    });
  }
  function pick(opt) {
    var c = choice; choice = null; hl = {}; targets = []; dirty = true;
    if (c) c.res(opt);
  }
  var SRC_RANK = { d0: 0, d1: 1, bonus: 2, sum: 3 };
  function destsFor(arm, i) {
    var mine = choice.opts.filter(function (o) { return o.arm === arm && o.i === i; });
    mine.sort(function (a, b) { return SRC_RANK[a.src] - SRC_RANK[b.src]; });
    var seen = {}, out = [];
    mine.forEach(function (o) { if (!seen[o.to]) { seen[o.to] = 1; out.push(o); } });
    return out;
  }
  function tapAt(ux, uy) {
    if (!choice) return;
    var best = null, bd;
    if (choice.sel) {
      bd = 0.75;
      targets.forEach(function (tg) { var d = Math.hypot(tg.x - ux, tg.y - uy); if (d < bd) { bd = d; best = tg; } });
      if (best) { S.tap(); return pick(best.opt); }
    }
    var lay = B.layout(disp); bd = 0.95; best = null;
    Object.keys(hl).forEach(function (k) { var L = lay[k]; if (!L) return; var d = Math.hypot(L.x - ux, L.y - uy); if (d < bd) { bd = d; best = k; } });
    if (best) {
      var parts = best.split('_'), arm = +parts[0], i = +parts[1];
      var ds = destsFor(arm, i);
      if (ds.length === 1) { S.tap(); return pick(ds[0]); }
      choice.sel = best; S.tap();
      targets = ds.map(function (o) {
        var p = B.progPt(arm, i, o.to);
        return { x: p[0], y: p[1], label: o.src === 'bonus' ? '+' + o.value : String(o.value), opt: o };
      });
      setMsg('Pick a spot');
      dirty = true; return;
    }
    if (choice.sel) { choice.sel = null; targets = []; setMsg('Tap a glowing pawn'); dirty = true; }
  }
  canvas.addEventListener('pointerdown', function (e) {
    S.unlock(); e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    tapAt(B.toCells(size, e.clientX - rect.left), B.toCells(size, e.clientY - rect.top));
  });

  // ---------- game loop ----------
  async function loop(my) {
    var alive = function () { return my === gen; };
    while (alive() && state.phase !== 'over') {
      var seat = state.seats[state.turn], arm = seat.arm, ai = seat.kind === 'ai', A = ARMS[arm];
      updatePanel(); dirty = true;
      if (state.phase === 'roll') {
        setMsg(ai ? 'Thinking...' : (state.doubles ? 'Roll again!' : 'Roll!'));
        if (ai) await wait(T.aiRoll); else await waitRoll();
        if (!alive()) return;
        var a = rollDie(), b = rollDie();
        await animateDice(a, b);
        if (!alive()) return;
        var info = R.roll(state, a, b);
        STATS.rollsThisGame++;
        if (info.penalty) {
          setMsg('3 doubles! Oops!'); S.oops(); updatePanel();
          await flyHome(info.penalty.arm, info.penalty.i, -1, my);
          disp = R.clone(state.pawns);
          await wait(T.msg); continue;
        }
        if (info.doubles) S.doubles();
        if (info.ended || info.again) {
          setMsg(info.again ? 'No moves. Roll again!' : 'No moves'); S.nope(); updatePanel();
          await wait(T.msg); continue;
        }
        if (info.doubles) { setMsg('Doubles!'); }
        continue;
      }
      if (state.phase === 'move') {
        var opts = R.options(state), opt;
        updatePanel();
        if (ai) { if (!info || !info.doubles) setMsg('Thinking...'); await wait(T.aiMove); if (!alive()) return; opt = AI.choose(state, opts, rng); }
        else { setMsg(state.bonus.length ? 'Bonus! Tap a pawn' : 'Tap a glowing pawn'); opt = await waitChoice(opts); }
        if (!alive()) return;
        var ev = R.apply(state, opt);
        STATS.movesThisGame++;
        updatePanel();
        await animateMove(ev, my);
        if (!alive()) return;
        info = null;
        if (ev.win != null) break;
        var bits = [];
        if (ev.captured) bits.push('Bump! +20');
        if (opt.to === R.HOME) bits.push('Home! +10');
        if (ev.forfeit.length) bits.push('No move for +' + ev.forfeit.join(' +'));
        if (ev.again) bits.push('Doubles: roll again!');
        if (bits.length) { setMsg(bits.join(' ')); updatePanel(); await wait(T.msg); }
        else if (ev.ended) await wait(T.msg / 3);
      }
    }
    if (alive() && state.phase === 'over') await showWinner(state.winner, my);
  }

  async function showWinner(arm, my) {
    var A = ARMS[arm];
    STATS.games++; STATS.winners.push(A.name); STATS.rolls.push(STATS.rollsThisGame); STATS.moves.push(STATS.movesThisGame);
    hl = {}; targets = []; pendingRoll = null; updatePanel(); setMsg(A.name + ' wins!');
    S.win();
    confetti = [];
    var cols = ARMS.map(function (x) { return x.color; }).concat(['#ffffff', '#ffd23f']);
    for (var k = 0; k < 140; k++) confetti.push({ x: Math.random(), y: -Math.random() * 0.5, vx: (Math.random() - 0.5) * 0.004, vy: 0.003 + Math.random() * 0.006, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, color: cols[k % cols.length] });
    $('winText').textContent = A.name + ' wins!';
    $('winText').style.color = A.dark;
    $('winPawn').innerHTML = I.pawn(A.color, A.dark);
    await wait(T.msg);
    if (my !== gen) return;
    show('winner', true);
    if (DEMO && STATS.games < MAX_GAMES) { await wait(Math.max(300, T.msg)); if (my === gen) restart(); }
    else if (DEMO) STATS.done = true;
  }

  function seatsFromCfg() {
    return SEAT_ORDER.filter(function (a) { return seatsCfg[a] && seatsCfg[a] !== 'off'; }).map(function (a) { return { arm: a, kind: seatsCfg[a] }; });
  }
  function startGame(seats) {
    gen++; var my = gen;
    moving = {}; hl = {}; targets = []; choice = null; pendingRoll = null; tweens = []; confetti = [];
    state = R.newGame(seats); disp = R.clone(state.pawns); lastDice = [5, 5];
    STATS.rollsThisGame = 0; STATS.movesThisGame = 0;
    ['setup', 'winner', 'confirm', 'help'].forEach(function (id) { show(id, false); });
    paused = false;
    resize(); updatePanel(); setMsg('Roll!');
    loop(my).catch(function (e) { STATS.errors.push('loop: ' + (e && e.stack || e)); console.error(e); });
  }
  function restart() { startGame(state ? state.seats : seatsFromCfg()); }

  // ---------- overlays ----------
  function show(id, on) {
    $(id).classList.toggle('show', on);
    paused = ['help', 'confirm'].some(function (x) { return $(x).classList.contains('show'); });
  }
  function buildSetup() {
    var box = $('seats'); box.innerHTML = '';
    SEAT_ORDER.forEach(function (a) {
      var A = ARMS[a], row = document.createElement('div');
      row.className = 'seat'; row.style.setProperty('--sc', A.color); row.style.setProperty('--sd', A.dark);
      row.innerHTML = '<span class="pawn-ic">' + I.pawn(A.color, A.dark) + '</span><span class="nm">' + A.name + '</span><div class="seg"></div>';
      var seg = row.querySelector('.seg');
      [['human', 'Me', I.person], ['ai', 'Robot', I.robot], ['off', 'Off', I.off]].forEach(function (k) {
        var b = document.createElement('button');
        b.type = 'button'; b.dataset.arm = a; b.dataset.kind = k[0]; b.setAttribute('aria-label', A.name + ' ' + k[1]);
        b.innerHTML = '<span class="ic">' + k[2] + '</span>' + k[1];
        b.addEventListener('click', function () {
          S.unlock(); seatsCfg[a] = k[0]; saveSeats(); S.tap(); refreshSetup();
        });
        seg.appendChild(b);
      });
      box.appendChild(row);
    });
    refreshSetup();
  }
  function refreshSetup() {
    document.querySelectorAll('#seats .seat').forEach(function (row, n) {
      var a = SEAT_ORDER[n];
      row.classList.toggle('off', seatsCfg[a] === 'off');
      row.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.kind === seatsCfg[a]); });
    });
    var n = seatsFromCfg().length;
    $('startBtn').disabled = n < 2;
  }
  function buildHelp() {
    var red = ARMS[2], blue = ARMS[0];
    var ic = function (s) { return '<span>' + s + '</span>'; };
    var items = [
      [ic(I.die(3)) + ic(I.die(4)), 'Roll 2 dice', 'Move one pawn per die, or one pawn the total.'],
      [ic(I.die(5)), '5 = come out!', 'A 5 on a die (or 5 in total) brings a pawn out.'],
      [ic(I.die(6)) + ic(I.die(6)), 'Doubles = roll again', '3 doubles in a row: oops! Your front pawn goes back.'],
      [ic(I.pawn(red.color, red.dark)) + ic(I.pawn(blue.color, blue.dark)), 'Bump = +20', 'Land on a pawn to send it back. Then move 20!'],
      [ic(I.star), 'Star = safe', 'No bumping on star squares.'],
      [ic(I.pawn(blue.color, blue.dark)) + ic(I.pawn(blue.color, blue.dark)), '2 together = wall', 'Nobody can pass a wall.'],
      [ic(I.home), 'Home = +10', 'Need the exact number to get home.'],
      [ic(I.trophy), 'All 4 home = win!', '']
    ];
    $('helpList').innerHTML = items.map(function (it) {
      return '<li><div class="hi">' + it[0] + '</div><div>' + it[1] + (it[2] ? '<small>' + it[2] + '</small>' : '') + '</div></li>';
    }).join('');
  }
  function fillIcons() {
    document.querySelectorAll('[data-icon]').forEach(function (el) { var v = I[el.dataset.icon]; if (typeof v === 'string') el.innerHTML = v; });
  }

  // ---------- wiring ----------
  function onTapBtn(id, fn) { $(id).addEventListener('click', function (e) { S.unlock(); fn(e); }); }
  onTapBtn('rollBtn', doRoll);
  onTapBtn('startBtn', function () { if (seatsFromCfg().length >= 2) startGame(seatsFromCfg()); });
  onTapBtn('helpBtn', function () { show('help', true); });
  onTapBtn('setupHelp', function () { show('help', true); });
  onTapBtn('helpClose', function () { show('help', false); });
  onTapBtn('muteBtn', function () { S.setMuted(!S.muted); updateMute(); S.tap(); });
  onTapBtn('menuBtn', function () { if (state && state.phase !== 'over') show('confirm', true); else toSetup(); });
  onTapBtn('noQuit', function () { show('confirm', false); });
  onTapBtn('yesQuit', function () { toSetup(); });
  onTapBtn('againBtn', function () { restart(); });
  onTapBtn('winMenu', function () { toSetup(); });
  function toSetup() {
    gen++; pendingRoll = null; choice = null; hl = {}; targets = []; confetti = [];
    ['winner', 'confirm', 'help'].forEach(function (id) { show(id, false); });
    refreshSetup(); show('setup', true);
  }
  document.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && pendingRoll && !paused) { e.preventDefault(); doRoll(); }
    if (e.key === 'Escape') { show('help', false); show('confirm', false); }
  });
  ['touchend', 'pointerdown'].forEach(function (ev) { document.addEventListener(ev, function () { S.unlock(); }, { passive: true }); });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);

  // Debug hooks for automated tests
  window.PP_DEBUG = {
    state: function () { return state; },
    canRoll: function () { return !!pendingRoll; },
    // CSS-pixel page coordinates of tappable things (glowing pawns, then targets)
    tapPoints: function () {
      if (!choice) return { pawns: [], targets: [] };
      var rect = canvas.getBoundingClientRect(), lay = B.layout(disp);
      var f = function (x, y) { return { x: rect.left + B.toPx(size, x), y: rect.top + B.toPx(size, y) }; };
      return {
        pawns: Object.keys(hl).map(function (k) { return f(lay[k].x, lay[k].y); }),
        targets: targets.map(function (t) { return f(t.x, t.y); })
      };
    },
    seed: function () { return seed; }
  };

  // ---------- boot ----------
  fillIcons(); buildSetup(); buildHelp(); updateMute();
  state = R.newGame(seatsFromCfg().length >= 2 ? seatsFromCfg() : [{ arm: 2, kind: 'human' }, { arm: 0, kind: 'ai' }]);
  disp = R.clone(state.pawns);
  resize(); updatePanel();
  requestAnimationFrame(frame);
  if (DEMO) startGame(SEAT_ORDER.map(function (a) { return { arm: a, kind: 'ai' }; }));
})();
