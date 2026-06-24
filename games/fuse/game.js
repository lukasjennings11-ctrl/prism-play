/* Fuse — chain-merge puzzle. Dependency-free, mobile-first.
 *
 * NOT 2048. You DRAW a path across orthogonally-touching tiles that share the
 * same number; releasing fuses the whole chain into one higher-tier tile at the
 * path's end (tier up = value * largest power-of-two <= chain length). Tiles
 * fall to fill the gaps and new ones drop in from the top. Objective-based
 * levels (reach a tile / hit a score within a move budget) give it a campaign;
 * an endless mode unlocks after the levels. Daily missions + a soft-coin economy
 * (shared/progression.js) give a reason to come back.
 *
 * Shared: juice.js (feel), retention.js (best/streak/daily), portal.js (SDK),
 * progression.js (levels/coins/missions), stage.js (level UI).
 */
(function () {
  'use strict';

  var GAME = 'fuse';
  var lerp = Juice.lerp, clamp = Juice.clamp;

  var COLS = 5, ROWS = 7;

  // value -> [gradA, gradB, text]
  var PAL = {
    2:    ['#39427a', '#2b3463', '#cfe0ff'], 4:    ['#3f5bc0', '#3348a0', '#eaf1ff'],
    8:    ['#5a4bd6', '#4838b4', '#f1ecff'], 16:   ['#2ea6b8', '#1f8a9c', '#eafcff'],
    32:   ['#2fae6b', '#1f9457', '#eafff3'], 64:   ['#7bc23b', '#5fa028', '#0f1a00'],
    128:  ['#e8c34a', '#d3a526', '#3a2e00'], 256:  ['#f0a93e', '#dc8b1f', '#3a2600'],
    512:  ['#f07c3e', '#dc5f1f', '#3a1500'], 1024: ['#f25c9a', '#dc3f7f', '#ffffff'],
    2048: ['#b15cf2', '#8c3fdc', '#ffffff'], 4096: ['#ff6bd6', '#d23fb0', '#ffffff']
  };
  var PAL_BIG = ['#ffd75c', '#ffb03f', '#3b2a00'];
  function colors(v) { var p = PAL[v] || PAL_BIG; return { a: p[0], b: p[1], text: p[2], burst: [p[0], p[1], '#fff'] }; }

  var LEVELS = [
    { name: 'Reach 32',        goal: 'reach', target: 32,   moves: 14 },
    { name: 'Reach 64',        goal: 'reach', target: 64,   moves: 16 },
    { name: 'Earn 800 points', goal: 'score', target: 800,  moves: 18 },
    { name: 'Reach 128',       goal: 'reach', target: 128,  moves: 20 },
    { name: 'Earn 2000 points',goal: 'score', target: 2000, moves: 24 },
    { name: 'Reach 256',       goal: 'reach', target: 256,  moves: 28 }
  ];

  var MISSIONS = [
    { id: 'm_merges', text: 'Make 25 fuses',       target: 25,   reward: 30 },
    { id: 'm_big',    text: 'Create a 128 tile',   target: 1,    reward: 40 },
    { id: 'm_score',  text: 'Earn 1500 points',    target: 1500, reward: 30 },
    { id: 'm_level',  text: 'Beat 2 levels',       target: 2,    reward: 35 },
    { id: 'm_chain',  text: 'Fuse a chain of 5+',  target: 1,    reward: 35 }
  ];

  // ---- DOM ----
  var canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  var wrap = document.querySelector('.board-wrap');
  var scoreEl = document.getElementById('score'), bestEl = document.getElementById('best');
  var goalEl = document.getElementById('goal'), movesEl = document.getElementById('moves');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ov-title'), ovSub = document.getElementById('ov-sub');
  var ovScore = document.getElementById('ov-score'), ovBest = document.getElementById('ov-best');
  var ovAgain = document.getElementById('ov-again'), ovContinue = document.getElementById('ov-continue');

  var particles = new Juice.Particles(), popups = new Juice.Popups(), shake = new Juice.Shake();
  var shakeOff = { x: 0, y: 0 };

  // ---- layout ----
  var CELL = 56, GW = 0, GH = 0, DPR = 1;
  function cellX(c) { return c * CELL; }
  function cellY(r) { return r * CELL; }
  function layout() {
    var bw = wrap.clientWidth || 320, bh = wrap.clientHeight || 520;
    var cw = (bw - 6) / COLS, ch = (bh - 6) / ROWS;
    CELL = clamp(Math.floor(Math.min(cw, ch)), 38, 92);
    GW = CELL * COLS; GH = CELL * ROWS;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(GW * DPR); canvas.height = Math.round(GH * DPR);
    canvas.style.width = GW + 'px'; canvas.style.height = GH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (grid) for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = grid[r][c]; if (t) { t.y = cellY(r); t.ty = cellY(r); }
    }
  }

  // ---- state ----
  var grid;                 // grid[r][c] = tile | null ; tile = {value,r,c,y,ty,pop}
  var score, best, movesLeft, over, phase; // phase: 'idle' | 'resolving' | 'end'
  var mode, level, def;     // mode: 'level' | 'endless'
  var chain;                // array of {r,c} during a drag
  var banner = null, usedContinue;

  function spawnVal() {
    var r = Math.random();
    if (r < 0.55) return 2;
    if (r < 0.85) return 4;
    if (r < 0.97) return 8;
    return 16;
  }
  function newTile(v, r, c, fromY) {
    return { value: v, r: r, c: c, y: (fromY != null ? fromY : cellY(r)), ty: cellY(r), pop: 0 };
  }

  function fillBoard() {
    grid = [];
    for (var r = 0; r < ROWS; r++) { grid.push([]); for (var c = 0; c < COLS; c++) grid[r].push(newTile(spawnVal(), r, c)); }
    var guard = 0;
    while (!adjacentEqualExists() && guard++ < 40) shuffleValues();
  }

  function adjacentEqualExists() {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = grid[r][c]; if (!t) continue;
      if (c + 1 < COLS && grid[r][c + 1] && grid[r][c + 1].value === t.value) return true;
      if (r + 1 < ROWS && grid[r + 1][c] && grid[r + 1][c].value === t.value) return true;
    }
    return false;
  }
  function shuffleValues() {
    var vals = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r][c]) vals.push(grid[r][c].value);
    for (var i = vals.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = vals[i]; vals[i] = vals[j]; vals[j] = t; }
    var k = 0;
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) if (grid[r2][c2]) { grid[r2][c2].value = vals[k++]; grid[r2][c2].pop = 0.12; }
  }

  function maxValue() { var m = 0; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r][c] && grid[r][c].value > m) m = grid[r][c].value; return m; }

  // tier up: value * largest power of two <= chain length
  function tierUp(value, len) { var k = Math.floor(Math.log(len) / Math.LN2); return value * Math.pow(2, k); }

  // ---- chain input ----
  function cellAt(clientX, clientY) {
    var b = canvas.getBoundingClientRect();
    var px = (clientX - b.left) * (GW / b.width), py = (clientY - b.top) * (GH / b.height);
    var c = Math.floor(px / CELL), r = Math.floor(py / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r: r, c: c };
  }
  function inChain(cell) { for (var i = 0; i < chain.length; i++) if (chain[i].r === cell.r && chain[i].c === cell.c) return i; return -1; }
  function adjacent(a, b) { return (a.r === b.r && Math.abs(a.c - b.c) === 1) || (a.c === b.c && Math.abs(a.r - b.r) === 1); }
  function chainValue() { return chain.length ? grid[chain[0].r][chain[0].c].value : 0; }

  function startChain(cell) {
    if (phase !== 'idle' || !cell || !grid[cell.r][cell.c]) return;
    chain = [cell];
    Juice.Audio.unlock(); Juice.Audio.play('tap'); Juice.vibrate(5);
  }
  function extendChain(cell) {
    if (phase !== 'idle' || !chain.length || !cell) return;
    var idx = inChain(cell);
    if (chain.length >= 2 && idx === chain.length - 2) { chain.pop(); Juice.Audio.play('move'); return; } // backtrack
    if (idx !== -1) return;
    var last = chain[chain.length - 1];
    var t = grid[cell.r][cell.c];
    if (!t || t.value !== chainValue() || !adjacent(last, cell)) return;
    chain.push(cell);
    grid[cell.r][cell.c].pop = 0.12;
    Juice.Audio.play('move', chain.length); Juice.vibrate(6);
  }
  function endChain() {
    if (phase !== 'idle') { chain = []; return; }
    if (chain.length >= 2) resolveMerge();
    else chain = [];
  }

  function resolveMerge() {
    var len = chain.length, val = chainValue();
    var merged = tierUp(val, len);
    var end = chain[len - 1];
    for (var i = 0; i < len - 1; i++) {
      var p = chain[i], t = grid[p.r][p.c];
      if (t) { var cx = cellX(p.c) + CELL / 2, cy = t.y + CELL / 2;
        particles.burst(cx, cy, { count: 6, colors: colors(val).burst, speed: 120, life: 0.4, size: 3 }); }
      grid[p.r][p.c] = null;
    }
    var em = grid[end.r][end.c]; em.value = merged; em.pop = 0.22;
    var ex = cellX(end.c) + CELL / 2, ey = em.y + CELL / 2;
    particles.burst(ex, ey, { count: 12 + len * 2, colors: colors(merged).burst, speed: 180, life: 0.55, size: 5 });
    popups.add(ex, ey - CELL * 0.2, '+' + merged, { color: '#fff', size: Math.min(30, 14 + Math.log(merged) / Math.LN2 * 2) });
    shake.add(Math.min(9, 2 + len), 0.2);
    Juice.Audio.play('merge', Math.log(merged) / Math.LN2); Juice.vibrate(12);
    if (merged >= 2048) Portal.happytime();

    var gain = merged + Math.floor(merged * (len - 1) * 0.5);
    score += gain;
    if (score > best) { best = score; Retention.set(GAME, 'best', best); }

    // missions
    bumpMissions(merged, len, gain);

    chain = [];
    if (mode === 'level') { movesLeft--; }
    renderHUD();
    phase = 'resolving';
    collapseAndRefill();
  }

  function collapseAndRefill() {
    for (var c = 0; c < COLS; c++) {
      var colTiles = [];
      for (var r = ROWS - 1; r >= 0; r--) if (grid[r][c]) colTiles.push(grid[r][c]);
      for (var r2 = 0; r2 < ROWS; r2++) grid[r2][c] = null;
      var rr = ROWS - 1;
      for (var k = 0; k < colTiles.length; k++) { var t = colTiles[k]; grid[rr][c] = t; t.r = rr; t.c = c; t.ty = cellY(rr); rr--; }
      var above = -1;
      while (rr >= 0) {
        var nt = newTile(spawnVal(), rr, c, cellY(above)); nt.c = c;
        grid[rr][c] = nt; rr--; above--;
      }
    }
  }

  function settled() {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = grid[r][c]; if (!t) continue;
      if (Math.abs(t.ty - t.y) > 0.4 || t.pop > 0.03) return false;
    }
    return true;
  }

  function postResolve() {
    phase = 'idle';
    if (mode === 'level') {
      if (objectiveMet()) { levelComplete(); return; }
      if (movesLeft <= 0) { levelFailed(); return; }
      if (!adjacentEqualExists()) shuffleValues();
    } else { // endless
      if (!adjacentEqualExists()) { var g = 0; while (!adjacentEqualExists() && g++ < 40) shuffleValues(); if (!adjacentEqualExists()) gameOver(); }
    }
  }

  function objectiveMet() {
    if (mode !== 'level') return false;
    return def.goal === 'reach' ? maxValue() >= def.target : score >= def.target;
  }

  // ---- missions ----
  function bumpMissions(merged, len, gain) {
    toastIf(Progress.bumpMission(GAME, 'm_merges', 1));
    if (merged >= 128) toastIf(Progress.bumpMission(GAME, 'm_big', 1));
    toastIf(Progress.bumpMission(GAME, 'm_score', gain));
    if (len >= 5) toastIf(Progress.bumpMission(GAME, 'm_chain', 1));
  }
  function toastIf(m) { if (m) Stage.toast(wrap, '✓ ' + m.text + '  +' + m.reward, 1600); }

  // ---- levels ----
  function startLevel(n) {
    if (n > LEVELS.length) { startEndless(); return; }
    mode = 'level'; level = n; def = LEVELS[n - 1];
    score = 0; movesLeft = def.moves; over = false; usedContinue = false; phase = 'idle'; chain = [];
    particles.list = []; popups.list = [];
    fillBoard(); overlay.classList.add('hidden'); renderHUD();
    var objText = def.goal === 'reach'
      ? 'Fuse your way to a <b>' + def.target + '</b> tile in <b>' + def.moves + '</b> moves.'
      : 'Score <b>' + def.target + '</b> points in <b>' + def.moves + '</b> moves.';
    Stage.levelIntro(n, objText, function () { Portal.gameStart(); });
  }
  function startEndless() {
    mode = 'endless'; level = 0; def = null;
    score = 0; movesLeft = Infinity; over = false; usedContinue = false; phase = 'idle'; chain = [];
    particles.list = []; popups.list = [];
    fillBoard(); overlay.classList.add('hidden'); renderHUD();
    Portal.gameStart();
  }

  function levelComplete() {
    phase = 'end'; Portal.gameStop();
    var stars;
    if (def.goal === 'reach') stars = movesLeft >= def.moves * 0.5 ? 3 : movesLeft >= def.moves * 0.25 ? 2 : 1;
    else stars = score >= def.target * 1.5 ? 3 : score >= def.target * 1.15 ? 2 : 1;
    Progress.completeLevel(GAME, level, stars);
    Progress.addCoins(GAME, stars * 10);
    toastIf(Progress.bumpMission(GAME, 'm_level', 1));
    Juice.Audio.play('win'); Portal.happytime();
    var last = level >= LEVELS.length;
    if (last) Progress.unlock(GAME, 'endless');
    Stage.levelComplete({
      level: level, stars: stars,
      body: '+' + (stars * 10) + ' coins' + (last ? ' · Endless mode unlocked!' : ''),
      nextLabel: last ? 'Play Endless' : 'Next level',
      onNext: function () { Portal.commercialBreak(function () { startLevel(level + 1); }); },
      onRetry: function () { startLevel(level); }
    });
  }
  function levelFailed() {
    phase = 'end'; Portal.gameStop();
    Juice.Audio.play('lose'); shake.add(8, 0.3);
    Stage.card({
      kicker: 'Level ' + level, title: 'Out of moves',
      body: def.goal === 'reach' ? 'You needed a ' + def.target + ' tile.' : 'You needed ' + def.target + ' points.',
      actions: [
        { label: 'Retry', onClick: function () { Portal.commercialBreak(function () { startLevel(level); }); } },
        { label: 'Missions', ghost: true, onClick: showMenu }
      ]
    });
  }

  function gameOver() {
    phase = 'end'; Portal.gameStop();
    Juice.Audio.play('lose'); Juice.vibrate([20, 40, 20]); shake.add(10, 0.4);
    Retention.submitScore(GAME, score);
    var isBest = score >= best && score > 0;
    ovTitle.textContent = isBest ? 'New Best! 🏆' : 'Board jammed';
    ovSub.textContent = isBest ? 'You beat your record.' : 'No more matching tiles.';
    ovScore.textContent = score; ovBest.textContent = best;
    ovContinue.style.display = (Portal.available && !usedContinue) ? '' : 'none';
    overlay.classList.remove('hidden');
  }
  function continueRun() {
    usedContinue = true; over = false; phase = 'idle';
    var g = 0; while (!adjacentEqualExists() && g++ < 60) shuffleValues();
    overlay.classList.add('hidden'); Portal.gameStart();
  }

  // ---- HUD ----
  function renderHUD() {
    scoreEl.textContent = score; bestEl.textContent = best;
    if (mode === 'level') {
      goalEl.innerHTML = 'Lv' + level + ' · ' + def.name;
      movesEl.style.display = ''; movesEl.textContent = 'Moves ' + Math.max(0, movesLeft);
    } else {
      goalEl.textContent = 'Endless'; movesEl.style.display = 'none';
    }
  }

  function showMenu() {
    var missions = Progress.dailyMissions(GAME, MISSIONS, 3);
    var coins = Progress.coins(GAME), stars = Progress.totalStars(GAME);
    var body = '<div style="font-size:13px;color:var(--muted);margin:-6px 0 10px">🪙 ' + coins + ' coins · ★ ' + stars + ' stars</div>'
      + '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:left;margin-bottom:4px">Daily missions</div>'
      + Stage.missionsHTML(missions);
    var actions = [{ label: 'Back', onClick: function () {} }];
    if (Progress.unlocked(GAME, 'endless')) actions.unshift({ label: 'Endless mode', ghost: true, onClick: startEndless });
    Stage.card({ kicker: 'Fuse', title: 'Missions', body: body, actions: actions });
  }

  // ---- update / draw ----
  function update(dt) {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = grid[r][c]; if (!t) continue;
      if (Math.abs(t.ty - t.y) > 0.4) t.y += (t.ty - t.y) * Math.min(1, dt * 14); else t.y = t.ty;
      if (t.pop > 0) t.pop = Math.max(0, t.pop - dt);
    }
    if (phase === 'resolving' && settled()) postResolve();
    particles.update(dt); popups.update(dt); shakeOff = shake.update(dt);
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawTile(t) {
    var sel = inChain({ r: t.r, c: t.c }) !== -1;
    var pad = Math.max(2, CELL * 0.06);
    var sc = t.pop > 0 ? 1 + 0.16 * Math.sin((t.pop / 0.22) * Math.PI) : 1;
    var w = (CELL - pad * 2) * sc;
    var cx = cellX(t.c) + CELL / 2, cy = t.y + CELL / 2;
    var col = colors(t.value);
    ctx.save(); ctx.translate(cx, cy);
    if (t.value >= 128) { ctx.shadowColor = col.b; ctx.shadowBlur = CELL * 0.2; }
    roundRect(-w / 2, -w / 2, w, w, w * 0.24);
    var g = ctx.createLinearGradient(-w / 2, -w / 2, w / 2, w / 2);
    g.addColorStop(0, col.a); g.addColorStop(1, col.b);
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    if (sel) { ctx.lineWidth = Math.max(2, CELL * 0.06); ctx.strokeStyle = '#fff'; ctx.stroke(); }
    ctx.fillStyle = col.text;
    var digits = ('' + t.value).length;
    var fs = CELL * (digits <= 2 ? 0.4 : digits === 3 ? 0.32 : 0.26);
    ctx.font = '800 ' + fs + 'px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.value, 0, fs * 0.04);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, GW, GH);
    ctx.save(); ctx.translate(shakeOff.x, shakeOff.y);
    // slots
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var pad = Math.max(2, CELL * 0.06);
      roundRect(cellX(c) + pad, cellY(r) + pad, CELL - pad * 2, CELL - pad * 2, CELL * 0.2);
      ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    }
    // chain connector line
    if (chain.length) {
      ctx.strokeStyle = 'rgba(123,242,208,.85)'; ctx.lineWidth = Math.max(4, CELL * 0.14);
      ctx.lineJoin = ctx.lineCap = 'round'; ctx.beginPath();
      for (var i = 0; i < chain.length; i++) {
        var p = chain[i], tt = grid[p.r][p.c];
        var x = cellX(p.c) + CELL / 2, y = (tt ? tt.y : cellY(p.r)) + CELL / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) if (grid[r2][c2]) drawTile(grid[r2][c2]);
    particles.draw(ctx); popups.draw(ctx);
    ctx.restore();
  }

  // ---- input wiring ----
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); startChain(cellAt(e.clientX, e.clientY)); });
  canvas.addEventListener('pointermove', function (e) { if (chain && chain.length) extendChain(cellAt(e.clientX, e.clientY)); });
  window.addEventListener('pointerup', function () { if (chain && chain.length) endChain(); });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  document.getElementById('new').addEventListener('click', function () {
    Portal.commercialBreak(function () { Portal.gameStop(); mode === 'endless' ? startEndless() : startLevel(level); });
  });
  document.getElementById('menu').addEventListener('click', showMenu);
  var muteBtn = document.getElementById('mute');
  muteBtn.addEventListener('click', function () {
    var m = Juice.Audio.toggleMute(); Retention.set(GAME, 'muted', m); Portal.mute(m); this.textContent = m ? '🔇' : '🔊';
  });
  ovAgain.addEventListener('click', function () { Portal.commercialBreak(function () { Portal.gameStop(); startEndless(); }); });
  ovContinue.addEventListener('click', function () { Portal.rewardedAd(continueRun, function () {}); });

  // ---- boot ----
  function boot() {
    Portal.loadingStart();
    layout();
    best = Retention.best(GAME);
    Retention.touchStreak(GAME);
    if (Retention.get(GAME, 'muted', false)) { Juice.Audio.setMuted(true); muteBtn.textContent = '🔇'; }
    chain = []; grid = null; phase = 'idle';
    fillBoard(); score = 0; mode = 'level'; level = Math.min(Progress.level(GAME), LEVELS.length); def = LEVELS[level - 1];
    movesLeft = def.moves; renderHUD();

    if (window.ResizeObserver) new ResizeObserver(layout).observe(wrap);
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
    var last = performance.now();
    (function frame(now) { var dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(frame); })(performance.now());

    Portal.init().then(function () {
      Portal.loadingStop(); Portal.mute(Juice.Audio.isMuted());
      var L = document.getElementById('loader'); if (L) L.classList.add('hidden');
      if (!Retention.get(GAME, 'taught', false)) {
        Retention.set(GAME, 'taught', true);
        Stage.card({
          kicker: 'How to play', title: 'Fuse',
          body: 'Drag across <b>touching tiles with the same number</b> to fuse them. The longer the chain, the bigger the tier you create.',
          actions: [{ label: 'Got it', onClick: function () { startLevel(level); } }]
        });
      } else { startLevel(level); }
    });
  }

  // ---- headless test hook ----
  window.__fuse = {
    state: function () {
      var g = [];
      for (var r = 0; r < ROWS; r++) { g.push([]); for (var c = 0; c < COLS; c++) g[r].push(grid[r][c] ? grid[r][c].value : 0); }
      return { grid: g, score: score, best: best, moves: movesLeft, mode: mode, level: level, phase: phase, max: maxValue(), pairs: adjacentEqualExists() };
    },
    tierUp: tierUp,
    // programmatic chain merge for tests: cells = [[r,c],...]
    chain: function (cells) {
      if (phase !== 'idle') return false;
      chain = [];
      for (var i = 0; i < cells.length; i++) {
        var cell = { r: cells[i][0], c: cells[i][1] };
        if (i === 0) startChain(cell); else extendChain(cell);
      }
      var ok = chain.length === cells.length && chain.length >= 2;
      if (ok) resolveMerge(); else chain = [];
      return ok;
    },
    tick: function (n, dt) { dt = dt || 1 / 60; for (var i = 0; i < (n || 1); i++) update(dt); },
    startLevel: startLevel, startEndless: startEndless,
    reset: function () { startLevel(Math.min(Progress.level(GAME), LEVELS.length)); }
  };

  // gameplayStop when the game-over overlay appears
  (function () {
    if (overlay && window.MutationObserver) new MutationObserver(function () {
      if (!overlay.classList.contains('hidden')) Portal.gameStop();
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  })();

  boot();
})();
