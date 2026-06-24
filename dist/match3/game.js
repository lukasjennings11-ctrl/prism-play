/* Gem Drop — gravity-tilt match puzzle. Dependency-free, mobile-first.
 *
 * NOT a swap match-3. You TILT the whole board (swipe / arrow keys) and EVERY
 * gem slides that direction at once; lines of 3+ clear, gems cascade, and new
 * gems pour in from the trailing edge. Plan tilts to set up chain reactions.
 * Objective levels (clear N gems / hit a score within a tilt budget) form a
 * campaign; endless after. Color-blind glyphs on every gem.
 *
 * Shared: juice.js, retention.js, portal.js, progression.js, stage.js.
 */
(function () {
  'use strict';

  var GAME = 'match3';
  var clamp = Juice.clamp;

  var COLS = 7, ROWS = 8;
  // [top, bottom, glow] per color + a color-blind glyph
  var GEMS = [
    ['#ff6b8a', '#d63060', '#ff6b8a'], ['#ffb347', '#e07b00', '#ffb347'],
    ['#ffe066', '#c9a800', '#ffe066'], ['#6bf77a', '#2cba3d', '#6bf77a'],
    ['#6ab4ff', '#2470d6', '#6ab4ff'], ['#c46af7', '#8230c9', '#c46af7']
  ];
  var GLYPH = ['●', '▲', '◆', '★', '■', '⬢'];

  var LEVELS = [
    { name: 'Clear 20 gems',    goal: 'clear', target: 20,   tilts: 10 },
    { name: 'Earn 500 points',  goal: 'score', target: 500,  tilts: 12 },
    { name: 'Clear 40 gems',    goal: 'clear', target: 40,   tilts: 16 },
    { name: 'Earn 1500 points', goal: 'score', target: 1500, tilts: 20 },
    { name: 'Clear 60 gems',    goal: 'clear', target: 60,   tilts: 26 }
  ];
  var MISSIONS = [
    { id: 'm_clear',  text: 'Clear 150 gems',       target: 150,  reward: 30 },
    { id: 'm_combo',  text: 'Get a 4-chain cascade', target: 1,    reward: 40 },
    { id: 'm_levels', text: 'Beat 2 levels',         target: 2,    reward: 35 },
    { id: 'm_score',  text: 'Earn 3000 points',      target: 3000, reward: 30 },
    { id: 'm_big',    text: 'Clear a line of 5+',    target: 1,    reward: 35 }
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
  var CELL = 44, OX = 0, OY = 0, DPR = 1, GW = 0, GH = 0;
  function cx(c) { return OX + c * CELL + CELL / 2; }
  function cy(r) { return OY + r * CELL + CELL / 2; }
  function layout() {
    var bw = wrap.clientWidth || 320, bh = wrap.clientHeight || 480;
    CELL = clamp(Math.floor(Math.min((bw - 4) / COLS, (bh - 4) / ROWS)), 30, 60);
    GW = CELL * COLS; GH = CELL * ROWS;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(GW * DPR); canvas.height = Math.round(GH * DPR);
    canvas.style.width = GW + 'px'; canvas.style.height = GH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    OX = 0; OY = 0;
  }

  // ---- state ----
  // grid[r][c] = tile{color, ox, oy, scale, alpha} | null
  var grid, score, best, tiltsLeft, over, busy, mode, level, def;
  var clearedThisLevel, usedContinue;

  var FILL_FRAC = 0.58, SPAWN_PER_TILT = 4;

  function mkTile(color) { return { color: color, ox: 0, oy: 0, scale: 1, alpha: 1 }; }
  function rand(n) { return (Math.random() * n) | 0; }
  function countEmpty() { var n = 0; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (!grid[r][c]) n++; return n; }

  // board starts PARTIALLY full so tilts have room to rearrange gems
  function initBoard() {
    grid = [];
    for (var r = 0; r < ROWS; r++) { grid.push([]); for (var c = 0; c < COLS; c++) grid[r].push(null); }
    var cells = [];
    for (r = 0; r < ROWS; r++) for (var c2 = 0; c2 < COLS; c2++) cells.push([r, c2]);
    for (var i = cells.length - 1; i > 0; i--) { var j = rand(i + 1); var tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp; }
    var fillN = Math.floor(ROWS * COLS * FILL_FRAC);
    for (i = 0; i < fillN; i++) grid[cells[i][0]][cells[i][1]] = mkTile(rand(GEMS.length));
    // clear any accidental starting runs (no score)
    var guard = 0;
    while (guard++ < 40) { var res = findRuns(); if (!res.any) break; for (r = 0; r < ROWS; r++) for (c2 = 0; c2 < COLS; c2++) if (res.marked[r][c2]) grid[r][c2] = null; }
  }

  // add a few new gems at random empty cells (they slide into place on the next slide)
  function spawnGems(K, D) {
    var empties = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (!grid[r][c]) empties.push([r, c]);
    for (var i = empties.length - 1; i > 0; i--) { var j = rand(i + 1); var t = empties[i]; empties[i] = empties[j]; empties[j] = t; }
    K = Math.min(K, empties.length);
    for (i = 0; i < K; i++) {
      var rc = empties[i], g = mkTile(rand(GEMS.length)); g.scale = 0.5; g.alpha = 0;
      if (D === 'L') g.ox = CELL; else if (D === 'R') g.ox = -CELL; else if (D === 'U') g.oy = CELL; else g.oy = -CELL;
      grid[rc[0]][rc[1]] = g;
    }
  }

  // ---- tilt mechanics ----
  function slide(D) {
    var moved = false, r, c, i, line, t, n;
    if (D === 'L' || D === 'R') {
      for (r = 0; r < ROWS; r++) {
        line = []; for (c = 0; c < COLS; c++) if (grid[r][c]) line.push({ t: grid[r][c], c: c });
        for (c = 0; c < COLS; c++) grid[r][c] = null;
        n = line.length;
        for (i = 0; i < n; i++) {
          var nc = (D === 'L') ? i : COLS - n + i;
          t = line[i].t; t.ox += cx(line[i].c) - cx(nc); grid[r][nc] = t;
          if (nc !== line[i].c) moved = true;
        }
      }
    } else {
      for (c = 0; c < COLS; c++) {
        line = []; for (r = 0; r < ROWS; r++) if (grid[r][c]) line.push({ t: grid[r][c], r: r });
        for (r = 0; r < ROWS; r++) grid[r][c] = null;
        n = line.length;
        for (i = 0; i < n; i++) {
          var nr = (D === 'U') ? i : ROWS - n + i;
          t = line[i].t; t.oy += cy(line[i].r) - cy(nr); grid[nr][c] = t;
          if (nr !== line[i].r) moved = true;
        }
      }
    }
    return moved;
  }

  function findRuns() {
    var marked = [], r, c;
    for (r = 0; r < ROWS; r++) { marked.push([]); for (c = 0; c < COLS; c++) marked[r].push(false); }
    var any = false, maxRun = 0;
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS;) {
      if (!grid[r][c]) { c++; continue; }
      var col = grid[r][c].color, len = 1;
      while (c + len < COLS && grid[r][c + len] && grid[r][c + len].color === col) len++;
      if (len >= 3) { for (var i = 0; i < len; i++) marked[r][c + i] = true; any = true; maxRun = Math.max(maxRun, len); }
      c += len;
    }
    for (c = 0; c < COLS; c++) for (r = 0; r < ROWS;) {
      if (!grid[r][c]) { r++; continue; }
      var col2 = grid[r][c].color, len2 = 1;
      while (r + len2 < ROWS && grid[r + len2][c] && grid[r + len2][c].color === col2) len2++;
      if (len2 >= 3) { for (var j = 0; j < len2; j++) marked[r + j][c] = true; any = true; maxRun = Math.max(maxRun, len2); }
      r += len2;
    }
    var count = 0;
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) if (marked[r][c]) count++;
    return { any: any, marked: marked, count: count, maxRun: maxRun };
  }

  function clearRuns(res, chain) {
    var pts = res.count * 10 * chain, sx = 0, sy = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (res.marked[r][c]) {
      var t = grid[r][c]; var px = cx(c) + (t ? t.ox : 0), py = cy(r) + (t ? t.oy : 0);
      sx += px; sy += py;
      particles.burst(px, py, { count: 7, colors: [GEMS[t.color][0], GEMS[t.color][1], '#fff'], speed: 130, life: 0.5, size: 4 });
      grid[r][c] = null;
    }
    score += pts;
    if (score > best) { best = score; Retention.set(GAME, 'best', best); }
    if (res.count) popups.add(sx / res.count, sy / res.count, '+' + pts, { color: '#fff', size: Math.min(28, 14 + chain * 3) });
    shake.add(Math.min(8, 2 + chain + (res.maxRun >= 5 ? 3 : 0)), 0.18);
    Juice.Audio.play('merge', Math.min(chain + res.maxRun, 10)); Juice.vibrate(chain > 1 ? [10, 12, 10] : 8);
  }

  // clear+slide loop in direction D; mutates the clearedNow/maxRun/chain accumulator
  function resolveLoop(D, acc) {
    var guard = 0;
    while (guard++ < 120) {
      var res = findRuns();
      if (!res.any) break;
      acc.chain++;
      clearRuns(res, acc.chain);
      acc.cleared += res.count; acc.maxRun = Math.max(acc.maxRun, res.maxRun);
      slide(D);
    }
  }

  function applyTilt(D) {
    if (busy || over) return;
    var moved = slide(D);
    var acc = { chain: 0, cleared: 0, maxRun: 0 };
    resolveLoop(D, acc);
    if (!moved && acc.cleared === 0) { // nothing happened
      if (countEmpty() === 0) { if (mode === 'endless') gameOver(); else levelFailed(true); }
      return;
    }
    // replenish, then resolve anything the new gems create
    spawnGems(SPAWN_PER_TILT, D);
    slide(D);
    resolveLoop(D, acc);

    busy = true;
    clearedThisLevel += acc.cleared;
    if (acc.cleared) { toastIf(Progress.bumpMission(GAME, 'm_clear', acc.cleared)); toastIf(Progress.bumpMission(GAME, 'm_score', acc.cleared * 10)); }
    if (acc.chain >= 4) toastIf(Progress.bumpMission(GAME, 'm_combo', 1));
    if (acc.maxRun >= 5) toastIf(Progress.bumpMission(GAME, 'm_big', 1));
    if (mode === 'level') tiltsLeft--;
    renderHUD();
    pendingResolve = true; // objective/fail checked once the slide settles (update())
  }
  var pendingResolve = false;

  function settled() {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = grid[r][c]; if (!t) continue;
      if (Math.abs(t.ox) > 0.5 || Math.abs(t.oy) > 0.5 || t.scale < 0.98) return false;
    }
    return true;
  }

  function postTilt() {
    busy = false;
    var full = countEmpty() === 0;
    if (mode === 'level') {
      var met = def.goal === 'clear' ? clearedThisLevel >= def.target : score >= def.target;
      if (met) { levelComplete(); return; }
      if (tiltsLeft <= 0 || full) { levelFailed(full); return; }
    } else if (full) { gameOver(); }
  }

  function gameOver() {
    if (over) return; over = true; Portal.gameStop();
    Juice.Audio.play('lose'); Juice.vibrate([20, 40, 20]); shake.add(10, 0.4);
    Retention.submitScore(GAME, score);
    var isBest = score >= best && score > 0;
    ovTitle.textContent = isBest ? 'New Best! 🏆' : 'Board full!';
    ovSub.textContent = isBest ? 'You beat your record.' : 'No room left to slide.';
    ovScore.textContent = score; ovBest.textContent = best;
    ovContinue.style.display = (Portal.available && !usedContinue) ? '' : 'none';
    overlay.classList.remove('hidden');
  }

  // ---- levels ----
  function startLevel(n) {
    if (n > LEVELS.length) { startEndless(); return; }
    mode = 'level'; level = n; def = LEVELS[n - 1];
    score = 0; clearedThisLevel = 0; tiltsLeft = def.tilts; over = false; busy = false; usedContinue = false;
    particles.list = []; popups.list = [];
    initBoard(); overlay.classList.add('hidden'); renderHUD();
    var obj = def.goal === 'clear' ? 'Clear <b>' + def.target + '</b> gems' : 'Score <b>' + def.target + '</b>';
    Stage.levelIntro(n, obj + ' in <b>' + def.tilts + '</b> tilts. Swipe to slide every gem.', function () { Portal.gameStart(); });
  }
  function startEndless() {
    mode = 'endless'; level = 0; def = null;
    score = 0; clearedThisLevel = 0; tiltsLeft = Infinity; over = false; busy = false; usedContinue = false;
    particles.list = []; popups.list = [];
    initBoard(); overlay.classList.add('hidden'); renderHUD(); Portal.gameStart();
  }

  function levelComplete() {
    over = true; Portal.gameStop();
    var stars = tiltsLeft >= def.tilts * 0.5 ? 3 : tiltsLeft >= def.tilts * 0.25 ? 2 : 1;
    Progress.completeLevel(GAME, level, stars); Progress.addCoins(GAME, stars * 10);
    toastIf(Progress.bumpMission(GAME, 'm_levels', 1));
    Juice.Audio.play('win'); Portal.happytime();
    var last = level >= LEVELS.length; if (last) Progress.unlock(GAME, 'endless');
    Stage.levelComplete({
      level: level, stars: stars, body: '+' + (stars * 10) + ' coins' + (last ? ' · Endless unlocked!' : ''),
      nextLabel: last ? 'Play Endless' : 'Next level',
      onNext: function () { Portal.commercialBreak(function () { startLevel(level + 1); }); },
      onRetry: function () { startLevel(level); }
    });
  }
  function levelFailed(full) {
    over = true; Portal.gameStop(); Juice.Audio.play('lose'); shake.add(8, 0.3);
    Stage.card({
      kicker: 'Level ' + level, title: full ? 'Board full' : 'Out of tilts',
      body: def.goal === 'clear' ? ('Cleared ' + clearedThisLevel + ' / ' + def.target + ' gems.') : ('Scored ' + score + ' / ' + def.target + '.'),
      actions: [
        { label: 'Retry', onClick: function () { Portal.commercialBreak(function () { startLevel(level); }); } },
        { label: 'Missions', ghost: true, onClick: showMenu }
      ]
    });
  }

  // ---- HUD / menu ----
  function renderHUD() {
    scoreEl.textContent = score; bestEl.textContent = best;
    if (mode === 'level') { goalEl.innerHTML = 'Lv' + level + ' · ' + def.name; movesEl.style.display = ''; movesEl.textContent = 'Tilts ' + Math.max(0, tiltsLeft); }
    else { goalEl.textContent = 'Endless'; movesEl.style.display = 'none'; }
  }
  function toastIf(m) { if (m) Stage.toast(wrap, '✓ ' + m.text + '  +' + m.reward, 1600); }
  function showMenu() {
    var missions = Progress.dailyMissions(GAME, MISSIONS, 3);
    var body = '<div style="font-size:13px;color:var(--muted);margin:-6px 0 10px">🪙 ' + Progress.coins(GAME) + ' · ★ ' + Progress.totalStars(GAME) + '</div>'
      + '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:left;margin-bottom:4px">Daily missions</div>'
      + Stage.missionsHTML(missions);
    var actions = [{ label: 'Back', onClick: function () {} }];
    if (Progress.unlocked(GAME, 'endless')) actions.unshift({ label: 'Endless mode', ghost: true, onClick: startEndless });
    Stage.card({ kicker: 'Gem Drop', title: 'Missions', body: body, actions: actions });
  }

  // ---- update / draw ----
  function update(dt) {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = grid[r][c]; if (!t) continue;
      if (Math.abs(t.ox) > 0.5) t.ox += (0 - t.ox) * Math.min(1, dt * 16); else t.ox = 0;
      if (Math.abs(t.oy) > 0.5) t.oy += (0 - t.oy) * Math.min(1, dt * 16); else t.oy = 0;
      if (t.scale < 1) t.scale = Math.min(1, t.scale + dt * 6);
      if (t.alpha < 1) t.alpha = Math.min(1, t.alpha + dt * 6);
    }
    if (pendingResolve && settled()) { pendingResolve = false; postTilt(); }
    particles.update(dt); popups.update(dt); shakeOff = shake.update(dt);
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawTile(t, r, c) {
    var s = (CELL - 6) * t.scale; if (s <= 0) return;
    var px = cx(c) + t.ox, py = cy(r) + t.oy;
    var g = GEMS[t.color];
    ctx.globalAlpha = t.alpha;
    if (s > CELL * 0.6) { ctx.shadowColor = g[2]; ctx.shadowBlur = s * 0.3; }
    var grad = ctx.createLinearGradient(px, py - s / 2, px, py + s / 2);
    grad.addColorStop(0, g[0]); grad.addColorStop(1, g[1]);
    ctx.fillStyle = grad; roundRect(px - s / 2, py - s / 2, s, s, s * 0.26); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = t.alpha * 0.55; ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.font = '700 ' + (s * 0.42) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(GLYPH[t.color], px, py + s * 0.02);
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.clearRect(0, 0, GW, GH);
    ctx.save(); ctx.translate(shakeOff.x, shakeOff.y);
    ctx.fillStyle = 'rgba(255,255,255,.03)'; roundRect(0, 0, GW, GH, 12); ctx.fill();
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r][c]) drawTile(grid[r][c], r, c);
    particles.draw(ctx); popups.draw(ctx);
    ctx.restore();
  }

  // ---- input: swipe + arrows ----
  var sx0 = 0, sy0 = 0, sw = false;
  canvas.addEventListener('pointerdown', function (e) { sx0 = e.clientX; sy0 = e.clientY; sw = true; Juice.Audio.unlock(); });
  window.addEventListener('pointerup', function (e) {
    if (!sw) return; sw = false;
    var dx = e.clientX - sx0, dy = e.clientY - sy0, ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 18) return;
    applyTilt(ax > ay ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
  });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', function (e) {
    var D = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', a: 'L', d: 'R', w: 'U', s: 'D' }[e.key];
    if (D) { e.preventDefault(); applyTilt(D); }
  }, { passive: false });

  document.getElementById('new').addEventListener('click', function () {
    Portal.commercialBreak(function () { Portal.gameStop(); mode === 'endless' ? startEndless() : startLevel(level); });
  });
  document.getElementById('menu').addEventListener('click', showMenu);
  var muteBtn = document.getElementById('mute');
  muteBtn.addEventListener('click', function () { var m = Juice.Audio.toggleMute(); Retention.set(GAME, 'muted', m); Portal.mute(m); this.textContent = m ? '🔇' : '🔊'; });
  ovAgain.addEventListener('click', function () { Portal.commercialBreak(function () { Portal.gameStop(); startEndless(); }); });
  ovContinue.addEventListener('click', function () {
    Portal.rewardedAd(function () {
      usedContinue = true; over = false;
      var filled = []; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r][c]) filled.push([r, c]);
      for (var i = filled.length - 1; i > 0; i--) { var j = rand(i + 1); var t = filled[i]; filled[i] = filled[j]; filled[j] = t; }
      var rm = Math.min(12, filled.length);
      for (i = 0; i < rm; i++) grid[filled[i][0]][filled[i][1]] = null;
      overlay.classList.add('hidden'); renderHUD(); Portal.gameStart();
    }, function () {});
  });

  // ---- boot ----
  function boot() {
    Portal.loadingStart(); layout();
    best = Retention.best(GAME); Retention.touchStreak(GAME);
    if (Retention.get(GAME, 'muted', false)) { Juice.Audio.setMuted(true); muteBtn.textContent = '🔇'; }
    mode = 'level'; level = Math.min(Progress.level(GAME), LEVELS.length); def = LEVELS[level - 1];
    score = 0; clearedThisLevel = 0; tiltsLeft = def.tilts; over = false; busy = false;
    initBoard(); renderHUD();
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
        Stage.card({ kicker: 'How to play', title: 'Tilt to match',
          body: 'Swipe (or arrow keys) to <b>tilt the board</b> — every gem slides that way. Line up <b>3+</b> of a color to clear them; cascades score big.',
          actions: [{ label: 'Got it', onClick: function () { startLevel(level); } }] });
      } else { startLevel(level); }
    });
  }

  // ---- headless test hook ----
  window.__match3 = {
    tilt: function (d) { applyTilt(({ L: 'L', R: 'R', U: 'U', D: 'D', left: 'L', right: 'R', up: 'U', down: 'D' })[d] || d); },
    state: function () {
      var g = []; for (var r = 0; r < ROWS; r++) { g.push([]); for (var c = 0; c < COLS; c++) g[r].push(grid[r][c] ? grid[r][c].color : -1); }
      return { grid: g, score: score, best: best, tilts: tiltsLeft, mode: mode, level: level, cleared: clearedThisLevel, over: over, busy: busy };
    },
    tick: function (n, dt) { dt = dt || 1 / 60; for (var i = 0; i < (n || 1); i++) update(dt); },
    settle: function () { for (var i = 0; i < 240 && !settled(); i++) update(1 / 60); if (pendingResolve) { pendingResolve = false; postTilt(); } },
    startLevel: startLevel, startEndless: startEndless,
    reset: function () { startLevel(Math.min(Progress.level(GAME), LEVELS.length)); }
  };

  (function () { if (overlay && window.MutationObserver) new MutationObserver(function () { if (!overlay.classList.contains('hidden')) Portal.gameStop(); }).observe(overlay, { attributes: true, attributeFilter: ['class'] }); })();

  boot();
})();
