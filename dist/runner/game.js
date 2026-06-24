/* Dash Lanes — color-switch runner. Dependency-free, mobile-first.
 *
 * NOT a lane-dodge clone. You auto-run down a track; colored GATES rush toward
 * you and you only phase through a gate if YOUR color matches it. Tap left/right
 * (or arrows) to cycle your color. Chaining correct gates builds a combo that
 * ramps speed and score; colored orbs between gates feed missions and a coin
 * economy. Objective levels ("pass N gates") form a campaign; endless unlocks
 * after. Each color also carries a glyph (●▲■) so it reads for color-blind play.
 *
 * Shared: juice.js, retention.js, portal.js, progression.js, stage.js.
 */
(function () {
  'use strict';

  var GAME = 'runner';
  var clamp = Juice.clamp, lerp = Juice.lerp;

  var COLORS = [
    { hex: '#4fd6ff', dark: '#2a9fd6', glyph: '●' }, // cyan  ●
    { hex: '#ff5db1', dark: '#d63890', glyph: '▲' }, // pink  ▲
    { hex: '#b8f542', dark: '#86c020', glyph: '■' }  // lime  ■
  ];

  var LEVELS = [
    { name: 'Pass 8 gates',  gates: 8 },
    { name: 'Pass 14 gates', gates: 14 },
    { name: 'Pass 20 gates', gates: 20 },
    { name: 'Pass 28 gates', gates: 28 },
    { name: 'Pass 36 gates', gates: 36 }
  ];

  var MISSIONS = [
    { id: 'r_gates',  text: 'Pass 40 gates',     target: 40,   reward: 30 },
    { id: 'r_orbs',   text: 'Collect 20 orbs',   target: 20,   reward: 30 },
    { id: 'r_combo',  text: 'Reach a x10 combo', target: 1,    reward: 40 },
    { id: 'r_dist',   text: 'Travel 3000m',      target: 3000, reward: 30 },
    { id: 'r_levels', text: 'Beat 2 levels',     target: 2,    reward: 35 }
  ];

  // ---- DOM ----
  var canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  var wrap = document.querySelector('.board-wrap');
  var scoreEl = document.getElementById('score'), bestEl = document.getElementById('best');
  var goalEl = document.getElementById('goal'), comboEl = document.getElementById('combo');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ov-title'), ovSub = document.getElementById('ov-sub');
  var ovScore = document.getElementById('ov-score'), ovBest = document.getElementById('ov-best');
  var ovAgain = document.getElementById('ov-again'), ovContinue = document.getElementById('ov-continue');

  var particles = new Juice.Particles(), popups = new Juice.Popups(), shake = new Juice.Shake();
  var shakeOff = { x: 0, y: 0 };

  // ---- layout ----
  var CW = 0, CH = 0, DPR = 1, PLAYER_Y = 0, PLAYER_R = 0;
  function layout() {
    var bw = wrap.clientWidth || 320, bh = wrap.clientHeight || 480;
    CW = clamp(bw, 240, 460); CH = clamp(bh, 360, Math.round(CW * 1.7));
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
    canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    PLAYER_Y = CH * 0.8; PLAYER_R = Math.min(CW * 0.07, CH * 0.05);
  }

  // ---- state ----
  var colorIdx, score, best, over, t, speed, combo, bestCombo, flash;
  var ents;            // {type:'gate'|'orb', y, color, x}
  var spawnY, gatesSpawned, gatesPassed, orbsCollected, orbsSpawned, meters, comboFlagged;
  var mode, level, def, usedContinue, started;

  var BASE_SPEED = 0;
  function reset(full) {
    colorIdx = 0; score = 0; over = false; t = 0; combo = 0; bestCombo = 0; flash = 0;
    ents = []; gatesSpawned = 0; gatesPassed = 0; orbsCollected = 0; orbsSpawned = 0;
    meters = 0; comboFlagged = false; usedContinue = false; started = false;
    BASE_SPEED = CH * 0.42; speed = BASE_SPEED;
    spawnY = -CH * 0.3;
    overlay.classList.add('hidden');
    seedEntities();
    renderHUD();
  }

  // pre-spawn the first few entities so the track is populated
  function seedEntities() {
    var y = -CH * 0.35;
    for (var i = 0; i < 4; i++) { spawnGate(y); y -= CH * 0.42; if (i % 2 === 0) spawnOrb(y + CH * 0.21); }
    spawnY = y;
  }

  function speedMult() { return 1 + Math.min(combo, 30) * 0.05; }

  function spawnGate(y) {
    if (mode === 'level' && gatesSpawned >= def.gates) return;
    // bias toward a color different from the current one to force switching
    var ci = (Math.random() * COLORS.length) | 0;
    ents.push({ type: 'gate', y: y, color: ci, passed: false });
    gatesSpawned++;
  }
  function spawnOrb(y) {
    var ci = (Math.random() * COLORS.length) | 0;
    ents.push({ type: 'orb', y: y, color: ci, x: 0.5 + (Math.random() - 0.5) * 0.4, passed: false });
    orbsSpawned++;
  }

  function cycle(dir) {
    if (over || !started) { started = true; }
    colorIdx = (colorIdx + (dir > 0 ? 1 : COLORS.length - 1)) % COLORS.length;
    Juice.Audio.unlock(); Juice.Audio.play('tap'); Juice.vibrate(5);
  }

  // ---- update ----
  function update(dt) {
    if (!over && started) {
      t += dt;
      speed = BASE_SPEED * speedMult();
      meters += speed * dt * 0.05;
      var dm = Math.floor(meters) - Math.floor(meters - speed * dt * 0.05);
      if (dm > 0) toastIf(Progress.bumpMission(GAME, 'r_dist', dm));
      score += dt * 4 * speedMult();

      // scroll + interactions
      for (var i = ents.length - 1; i >= 0; i--) {
        var e = ents[i];
        e.y += speed * dt;
        if (!e.passed && e.y >= PLAYER_Y) {
          e.passed = true;
          if (e.type === 'gate') {
            if (e.color === colorIdx) onGatePass(e);
            else { crash(e); return; }
          } else if (e.type === 'orb' && e.color === colorIdx) {
            onOrb(e);
          }
        }
        if (e.y > CH + 60) ents.splice(i, 1);
      }

      // keep the track populated as it scrolls
      spawnY += speed * dt;
      if (spawnY >= -CH * 0.15) {
        var gap = CH * (0.46 - Math.min(combo, 20) * 0.006);
        spawnGate(-CH * 0.35);
        if (Math.random() < 0.7) spawnOrb(-CH * 0.35 + gap * 0.5);
        spawnY = -CH * 0.35 - gap;
      }

      // level complete: all required gates passed
      if (mode === 'level' && gatesPassed >= def.gates) { levelComplete(); }
    }
    if (flash > 0) flash = Math.max(0, flash - dt);
    particles.update(dt); popups.update(dt); shakeOff = shake.update(dt);
  }

  function onGatePass(e) {
    combo++; bestCombo = Math.max(bestCombo, combo); gatesPassed++;
    var pts = 10 + combo * 2; score += pts;
    flash = 0.18;
    var c = COLORS[e.color];
    particles.burst(CW / 2, PLAYER_Y, { count: 12, colors: [c.hex, '#fff'], speed: 150, life: 0.45, size: 4 });
    if (combo % 5 === 0 && combo > 0) { popups.add(CW / 2, PLAYER_Y - 30, 'x' + combo + ' combo!', { color: c.hex, size: 18, life: 0.8 }); shake.add(4, 0.15); }
    Juice.Audio.play('score'); Juice.vibrate(6);
    toastIf(Progress.bumpMission(GAME, 'r_gates', 1));
    if (combo >= 10 && !comboFlagged) { comboFlagged = true; toastIf(Progress.bumpMission(GAME, 'r_combo', 1)); }
    if (score > best) { best = Math.floor(score); Retention.set(GAME, 'best', best); }
    renderHUD();
  }
  function onOrb(e) {
    orbsCollected++; var pts = 25; score += pts;
    var c = COLORS[e.color];
    particles.burst(CW * e.x, PLAYER_Y, { count: 10, colors: [c.hex, '#fff'], speed: 130, life: 0.5, size: 4 });
    popups.add(CW * e.x, PLAYER_Y - 24, '+' + pts, { color: c.hex, size: 15, life: 0.7 });
    Juice.Audio.play('pop'); Juice.vibrate(5);
    toastIf(Progress.bumpMission(GAME, 'r_orbs', 1));
    if (score > best) { best = Math.floor(score); Retention.set(GAME, 'best', best); }
    renderHUD();
  }

  function crash(e) {
    if (over) return;
    over = true; Portal.gameStop();
    Juice.Audio.play('lose'); Juice.vibrate([20, 40, 20]); shake.add(11, 0.4);
    particles.burst(CW / 2, PLAYER_Y, { count: 26, colors: [COLORS[colorIdx].hex, '#fff', COLORS[e.color].hex], speed: 220, life: 0.7, size: 5, gravity: 220 });
    if (mode === 'level') { levelFailed(); return; }
    Retention.submitScore(GAME, Math.floor(score));
    var isBest = Math.floor(score) >= best && score > 0;
    ovTitle.textContent = isBest ? 'New Best! 🏆' : 'Wrong color';
    ovSub.textContent = isBest ? 'You beat your record.' : 'Match the gate before it hits you.';
    ovScore.textContent = Math.floor(score); ovBest.textContent = best;
    ovContinue.style.display = (Portal.available && !usedContinue) ? '' : 'none';
    overlay.classList.remove('hidden');
  }
  function continueRun() {
    usedContinue = true; over = false; combo = 0;
    // clear any imminent gates so the resume is fair
    for (var i = ents.length - 1; i >= 0; i--) if (ents[i].type === 'gate' && ents[i].y > PLAYER_Y - CH * 0.4 && !ents[i].passed) ents.splice(i, 1);
    overlay.classList.add('hidden'); Portal.gameStart();
  }

  // ---- levels ----
  function startLevel(n) {
    if (n > LEVELS.length) { startEndless(); return; }
    mode = 'level'; level = n; def = LEVELS[n - 1];
    reset(true);
    renderHUD();
    Stage.levelIntro(n, 'Phase through <b>' + def.gates + '</b> gates by matching your color. Chain them for speed.', function () { started = true; Portal.gameStart(); });
  }
  function startEndless() {
    mode = 'endless'; level = 0; def = null;
    reset(true); started = true; renderHUD(); Portal.gameStart();
  }

  function levelComplete() {
    if (over) return; over = true; Portal.gameStop();
    var ratio = orbsSpawned ? orbsCollected / orbsSpawned : 0;
    var stars = ratio >= 0.7 ? 3 : ratio >= 0.4 ? 2 : 1;
    Progress.completeLevel(GAME, level, stars);
    Progress.addCoins(GAME, stars * 10);
    toastIf(Progress.bumpMission(GAME, 'r_levels', 1));
    Juice.Audio.play('win'); Portal.happytime();
    var last = level >= LEVELS.length;
    if (last) Progress.unlock(GAME, 'endless');
    Stage.levelComplete({
      level: level, stars: stars,
      body: orbsCollected + '/' + orbsSpawned + ' orbs · +' + (stars * 10) + ' coins' + (last ? ' · Endless unlocked!' : ''),
      nextLabel: last ? 'Play Endless' : 'Next level',
      onNext: function () { Portal.commercialBreak(function () { startLevel(level + 1); }); },
      onRetry: function () { startLevel(level); }
    });
  }
  function levelFailed() {
    Juice.Audio.play('lose');
    Stage.card({
      kicker: 'Level ' + level, title: 'Crashed',
      body: 'Passed ' + gatesPassed + ' / ' + def.gates + ' gates.',
      actions: [
        { label: 'Retry', onClick: function () { Portal.commercialBreak(function () { startLevel(level); }); } },
        { label: 'Missions', ghost: true, onClick: showMenu }
      ]
    });
  }

  // ---- HUD ----
  function renderHUD() {
    scoreEl.textContent = Math.floor(score); bestEl.textContent = best;
    comboEl.textContent = 'x' + (1 + combo);
    comboEl.style.color = combo >= 5 ? COLORS[colorIdx].hex : '';
    if (mode === 'level') goalEl.innerHTML = 'Lv' + level + ' · ' + gatesPassed + '/' + def.gates;
    else goalEl.textContent = 'Endless';
  }

  function toastIf(m) { if (m) Stage.toast(wrap, '✓ ' + m.text + '  +' + m.reward, 1600); }

  function showMenu() {
    var missions = Progress.dailyMissions(GAME, MISSIONS, 3);
    var coins = Progress.coins(GAME), stars = Progress.totalStars(GAME);
    var body = '<div style="font-size:13px;color:var(--muted);margin:-6px 0 10px">🪙 ' + coins + ' · ★ ' + stars + '</div>'
      + '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:left;margin-bottom:4px">Daily missions</div>'
      + Stage.missionsHTML(missions);
    var actions = [{ label: 'Back', onClick: function () {} }];
    if (Progress.unlocked(GAME, 'endless')) actions.unshift({ label: 'Endless mode', ghost: true, onClick: startEndless });
    Stage.card({ kicker: 'Dash Lanes', title: 'Missions', body: body, actions: actions });
  }

  // ---- draw ----
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function draw() {
    ctx.clearRect(0, 0, CW, CH);
    ctx.save(); ctx.translate(shakeOff.x, shakeOff.y);

    // entities
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i], c = COLORS[e.color];
      if (e.type === 'gate') {
        var gh = Math.max(10, CH * 0.03);
        var g = ctx.createLinearGradient(0, e.y - gh / 2, 0, e.y + gh / 2);
        g.addColorStop(0, c.hex); g.addColorStop(1, c.dark);
        ctx.fillStyle = g; ctx.globalAlpha = e.passed ? 0.25 : 1;
        roundRect(0, e.y - gh / 2, CW, gh, gh / 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '800 ' + (gh * 0.9) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.glyph, CW / 2, e.y);
      } else {
        var rr = PLAYER_R * 0.62, ox = CW * e.x;
        ctx.globalAlpha = e.passed ? 0.2 : 1;
        ctx.fillStyle = c.hex; ctx.beginPath(); ctx.arc(ox, e.y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = '800 ' + (rr * 1.1) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.glyph, ox, e.y);
        ctx.globalAlpha = 1;
      }
    }

    // player
    var pc = COLORS[colorIdx];
    ctx.save(); ctx.translate(CW / 2, PLAYER_Y);
    var pr = PLAYER_R * (1 + flash * 0.8);
    ctx.shadowColor = pc.hex; ctx.shadowBlur = pr * (over ? 0 : 1.1);
    var pg = ctx.createRadialGradient(-pr * 0.3, -pr * 0.3, 1, 0, 0, pr);
    pg.addColorStop(0, '#fff'); pg.addColorStop(1, pc.hex);
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.font = '800 ' + (pr * 0.95) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pc.glyph, 0, 0);
    ctx.restore();

    // color picker hint (the three colors at the very bottom)
    var sw = CW / COLORS.length;
    for (var k = 0; k < COLORS.length; k++) {
      ctx.fillStyle = COLORS[k].hex; ctx.globalAlpha = k === colorIdx ? 1 : 0.28;
      ctx.fillRect(k * sw + 4, CH - 6, sw - 8, 4);
    }
    ctx.globalAlpha = 1;

    particles.draw(ctx); popups.draw(ctx);
    ctx.restore();
  }

  // ---- input ----
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var b = canvas.getBoundingClientRect();
    cycle((e.clientX - b.left) / b.width < 0.5 ? -1 : 1);
  });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); cycle(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === ' ') { e.preventDefault(); cycle(1); }
  }, { passive: false });

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
    best = Retention.best(GAME); Retention.touchStreak(GAME);
    if (Retention.get(GAME, 'muted', false)) { Juice.Audio.setMuted(true); muteBtn.textContent = '🔇'; }
    mode = 'level'; level = Math.min(Progress.level(GAME), LEVELS.length); def = LEVELS[level - 1];
    reset(true);
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
          kicker: 'How to play', title: 'Match the color',
          body: 'Tap <b>left/right</b> to change your color. You can only pass a gate when your color <b>matches</b> it. Chain gates for speed!',
          actions: [{ label: 'Run', onClick: function () { startLevel(level); } }]
        });
      } else { startLevel(level); }
    });
  }

  // ---- headless test hook ----
  window.__runner = {
    state: function () {
      return { score: Math.floor(score), best: best, over: over, combo: combo, color: colorIdx, mode: mode, level: level,
        gatesPassed: gatesPassed, gatesNeeded: mode === 'level' ? def.gates : 0, ents: ents.length, started: started };
    },
    setColor: function (i) { colorIdx = ((i % COLORS.length) + COLORS.length) % COLORS.length; started = true; },
    cycle: cycle,
    nextGate: function () { // color index of the nearest unpassed gate above the player
      var best = null, by = -1e9;
      for (var i = 0; i < ents.length; i++) { var e = ents[i]; if (e.type === 'gate' && !e.passed && e.y > by) { by = e.y; best = e; } }
      return best ? best.color : -1;
    },
    autoMatch: function () { var g = this.nextGate(); if (g >= 0) this.setColor(g); },
    tick: function (n, dt) { dt = dt || 1 / 60; started = true; for (var i = 0; i < (n || 1); i++) update(dt); },
    startLevel: startLevel, startEndless: startEndless,
    reset: function () { startLevel(Math.min(Progress.level(GAME), LEVELS.length)); }
  };

  (function () {
    if (overlay && window.MutationObserver) new MutationObserver(function () {
      if (!overlay.classList.contains('hidden')) Portal.gameStop();
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  })();

  boot();
})();
