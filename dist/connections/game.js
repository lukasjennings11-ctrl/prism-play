/* Groups — daily category-grouping puzzle (Connections-style). Vanilla JS, mobile-first.
 * 16 words hide 4 groups of 4. Select 4, submit; an exact-category match locks
 * them in, anything else costs a mistake (4 allowed). Daily puzzle is
 * deterministic via Retention.dailySeed; Practice mode is unlimited & random.
 * Uses ../../shared/juice.js, ../../shared/retention.js, categories.js.
 */
(function () {
  'use strict';

  var GAME = 'connections';
  var POOL = window.CATEGORIES;
  var N_CATS = 4, N_PER_CAT = 4, MAX_MISTAKES = 4;
  var COLORS = ['var(--cat1)', 'var(--cat2)', 'var(--cat3)', 'var(--cat4)'];
  var SQUARES = ['🟩', '🟨', '🟦', '🟥'];

  // ---- DOM ----
  var gridEl    = document.getElementById('grid');
  var solvedEl  = document.getElementById('solved-rows');
  var livesEl   = document.getElementById('lives');
  var msgEl     = document.getElementById('msg');
  var streakEl  = document.getElementById('streak');
  var modeBadge = document.getElementById('mode-badge');
  var practiceBtn = document.getElementById('practice');
  var deselectBtn = document.getElementById('deselect');
  var shuffleBtn  = document.getElementById('shuffle');
  var submitBtn   = document.getElementById('submit');
  var overlay   = document.getElementById('overlay');
  var ovTitle   = document.getElementById('ov-title');
  var ovSub     = document.getElementById('ov-sub');
  var ovMistakes= document.getElementById('ov-mistakes');
  var ovStreak  = document.getElementById('ov-streak');
  var ovShare   = document.getElementById('ov-share');
  var ovClose   = document.getElementById('ov-close');

  // ---- rng helpers ----
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pickCategories(rng) {
    var idx = shuffle(POOL.map(function (_, i) { return i; }), rng).slice(0, N_CATS);
    return idx;
  }

  // ---- round setup ----
  var catIdx;   // [4] indices into POOL for this round
  var tiles;    // [16] { word, cat (0..3), solved }
  var selected; // array of tile indices
  var mistakesLeft, solvedCats, guessLog, done, win, mode;
  var best;

  function buildRound(rng) {
    catIdx = pickCategories(rng);
    var pool = [];
    for (var c = 0; c < N_CATS; c++) {
      var words = POOL[catIdx[c]].words;
      for (var w = 0; w < N_PER_CAT; w++) pool.push({ word: words[w], cat: c, solved: false });
    }
    tiles = shuffle(pool, rng);
    selected = []; mistakesLeft = MAX_MISTAKES; solvedCats = []; guessLog = []; done = false; win = false;
  }

  function todayStr() { return Retention.todayStr(); }

  function loadDailyState() {
    buildRound(Retention.dailyRng(GAME, todayStr())); // deterministic categories + shuffle
    var st = Retention.get(GAME, 'daily', null);
    var today = todayStr();
    if (st && st.date === today) {
      mistakesLeft = st.mistakesLeft; solvedCats = st.solvedCats.slice(); guessLog = st.guessLog.slice();
      done = st.done; win = st.win;
      for (var i = 0; i < tiles.length; i++) tiles[i].solved = solvedCats.indexOf(tiles[i].cat) !== -1;
    }
  }
  function saveDailyState() {
    Retention.set(GAME, 'daily', { date: todayStr(), mistakesLeft: mistakesLeft, solvedCats: solvedCats.slice(), guessLog: guessLog.slice(), done: done, win: win });
  }

  function startDaily() {
    mode = 'daily';
    modeBadge.textContent = 'Daily';
    practiceBtn.textContent = 'Practice';
    loadDailyState();
    msgEl.textContent = '';
    overlay.classList.add('hidden');
    render();
    if (done) showResultOverlay(win ? 'You found every group.' : 'Out of mistakes — groups revealed below.');
  }
  function startPractice() {
    mode = 'practice';
    modeBadge.textContent = 'Practice';
    practiceBtn.textContent = 'Daily';
    buildRound(Math.random);
    msgEl.textContent = '';
    overlay.classList.add('hidden');
    render();
  }

  // ---- interaction ----
  function toggleTile(i) {
    if (done || tiles[i].solved) return;
    Juice.Audio.unlock();
    var pos = selected.indexOf(i);
    if (pos !== -1) { selected.splice(pos, 1); }
    else if (selected.length < N_PER_CAT) { selected.push(i); Juice.Audio.play('tap'); }
    render();
  }

  function deselectAll() { selected = []; render(); }

  function shuffleRemaining() {
    var unsolvedPositions = [];
    for (var i = 0; i < tiles.length; i++) if (!tiles[i].solved) unsolvedPositions.push(i);
    var values = unsolvedPositions.map(function (i) { return tiles[i]; });
    values = shuffle(values, Math.random);
    for (var k = 0; k < unsolvedPositions.length; k++) tiles[unsolvedPositions[k]] = values[k];
    render();
  }

  function showMsg(text) {
    msgEl.textContent = text;
    setTimeout(function () { if (msgEl.textContent === text) msgEl.textContent = ''; }, 1600);
  }

  function submitGuess() {
    if (done || selected.length !== N_PER_CAT) return;
    var cats = selected.map(function (i) { return tiles[i].cat; });
    guessLog.push(cats.slice());

    var allSame = cats.every(function (c) { return c === cats[0]; });
    if (allSame) {
      var c = cats[0];
      selected.forEach(function (i) { tiles[i].solved = true; });
      solvedCats.push(c);
      selected = [];
      Juice.Audio.play('win'); Juice.vibrate([10, 15, 10]);
      showMsg(POOL[catIdx[c]].name + '!');
      if (solvedCats.length === N_CATS) { win = true; done = true; finish(); }
    } else {
      mistakesLeft--;
      var counts = {};
      cats.forEach(function (c2) { counts[c2] = (counts[c2] || 0) + 1; });
      var maxCount = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; }));
      triggerShake();
      Juice.Audio.play('lose'); Juice.vibrate(15);
      if (maxCount === 3) showMsg('One away!');
      else showMsg('Not a group');
      selected = [];
      if (mistakesLeft <= 0) { win = false; done = true; revealAll(); finish(); }
    }
    render();
  }

  function revealAll() {
    for (var c = 0; c < N_CATS; c++) {
      if (solvedCats.indexOf(c) === -1) solvedCats.push(c);
    }
    for (var i = 0; i < tiles.length; i++) tiles[i].solved = true;
  }

  function triggerShake() {
    var sel = selected.slice();
    render(sel); // render with shake class applied via param
    setTimeout(function () { render(); }, 420);
  }

  function showResultOverlay(subText) {
    ovTitle.textContent = win ? 'Solved! 🎉' : 'So close!';
    ovSub.textContent = subText;
    ovMistakes.textContent = (MAX_MISTAKES - mistakesLeft);
    ovStreak.textContent = Retention.streak(GAME);
    overlay.classList.remove('hidden');
  }

  function finish() {
    if (mode === 'daily') saveDailyState();
    var score = win ? Math.max(10, (mistakesLeft + 1) * 25) : 0;
    var sub = Retention.submitScore(GAME, score);
    if (sub.best > best) best = sub.best;
    showResultOverlay(win ? 'You found every group with ' + mistakesLeft + ' mistake' + (mistakesLeft === 1 ? '' : 's') + ' to spare.' : 'Groups revealed below.');
  }

  function buildShareText() {
    var lines = ['Groups ' + (win ? (MAX_MISTAKES - mistakesLeft) + '/' + MAX_MISTAKES + ' mistakes' : 'X')];
    for (var r = 0; r < guessLog.length; r++) lines.push(guessLog[r].map(function (c) { return SQUARES[c]; }).join(''));
    return lines.join('\n');
  }
  ovShare.addEventListener('click', function () {
    var text = buildShareText();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(showShareFeedback, showShareFeedback);
    else showShareFeedback();
  });
  function showShareFeedback() {
    var prev = ovShare.textContent; ovShare.textContent = 'Copied!';
    setTimeout(function () { ovShare.textContent = prev; }, 1200);
  }
  ovClose.addEventListener('click', function () { overlay.classList.add('hidden'); });

  // ---- render ----
  function render(shakeSet) {
    // lives
    livesEl.innerHTML = '';
    for (var m = 0; m < MAX_MISTAKES; m++) {
      var dot = document.createElement('span');
      dot.className = 'dot' + (m < (MAX_MISTAKES - mistakesLeft) ? ' used' : '');
      livesEl.appendChild(dot);
    }

    // solved rows
    solvedEl.innerHTML = '';
    for (var s = 0; s < solvedCats.length; s++) {
      var c = solvedCats[s];
      var row = document.createElement('div');
      row.className = 'solved-row';
      row.style.background = COLORS[c];
      row.style.color = '#0c0a14';
      row.textContent = POOL[catIdx[c]].name + ':  ' + POOL[catIdx[c]].words.join('  ·  ');
      solvedEl.appendChild(row);
    }

    // grid (unsolved only, in current order)
    gridEl.innerHTML = '';
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (t.solved) continue;
      var tile = document.createElement('div');
      var cls = 'tile';
      if (selected.indexOf(i) !== -1) cls += ' selected';
      if (shakeSet && shakeSet.indexOf(i) !== -1) cls += ' shake';
      tile.className = cls;
      tile.textContent = t.word;
      tile.addEventListener('pointerdown', (function (idx) { return function (e) { e.preventDefault(); toggleTile(idx); }; })(i));
      gridEl.appendChild(tile);
    }

    submitBtn.disabled = done || selected.length !== N_PER_CAT;
    deselectBtn.disabled = done || selected.length === 0;
  }

  // ---- input wiring ----
  deselectBtn.addEventListener('click', deselectAll);
  shuffleBtn.addEventListener('click', shuffleRemaining);
  submitBtn.addEventListener('click', submitGuess);
  practiceBtn.addEventListener('click', function () { if (mode === 'daily') startPractice(); else startDaily(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitGuess();
    else if (e.key === 'Escape') deselectAll();
  });

  // ---- boot ----
  function boot() {
    best = Retention.best(GAME);
    streakEl.innerHTML = '🔥 ' + Retention.touchStreak(GAME) + '&nbsp;day streak';
    startDaily();
  }

  // ---- headless test hook ----
  window.__connections = {
    select: toggleTile,
    deselectAll: deselectAll,
    submit: submitGuess,
    shuffle: shuffleRemaining,
    selectCategory: function (catNumber) { // test helper: select all 4 unsolved tiles of a given cat index (0-3)
      deselectAll();
      for (var i = 0; i < tiles.length; i++) if (tiles[i].cat === catNumber && !tiles[i].solved) toggleTile(i);
    },
    practice: startPractice,
    daily: startDaily,
    tiles: function () { return tiles.map(function (t) { return { word: t.word, cat: t.cat, solved: t.solved }; }); },
    state: function () {
      return {
        mode: mode, done: done, win: win, mistakesLeft: mistakesLeft,
        solvedCats: solvedCats.slice(), selected: selected.slice(),
        unsolvedCount: tiles.filter(function (t) { return !t.solved; }).length,
        categoryNames: catIdx.map(function (ci) { return POOL[ci].name; })
      };
    },
    reset: function () { startPractice(); }
  };

  boot();
})();
