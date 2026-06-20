/* Kickle — daily footballer guessing puzzle.
 * 6 guesses. Each guess reveals: nationality, club, position, age, league, kit number.
 * Green = exact. Yellow = close (same continent / adjacent position / age ±2 / kit ±5).
 * Uses shared/juice.js and shared/retention.js.
 * Player data: 2024-25 season snapshot.
 */
(function () {
  'use strict';

  var GAME = 'kickle';
  var MAX = 6;

  // ---- Player data (2024-25 season) ----
  // Fields: n(name), f(flag emoji), nat(3-letter code), club, pos, age, lge, kit
  var PLAYERS = [
    // Premier League — Arsenal
    {n:'Bukayo Saka',            f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Arsenal',      pos:'MID',age:22,lge:'EPL',  kit:7},
    {n:'Martin Ødegaard',        f:'🇳🇴',nat:'NOR',club:'Arsenal',      pos:'MID',age:25,lge:'EPL',  kit:8},
    {n:'Declan Rice',            f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Arsenal',      pos:'MID',age:25,lge:'EPL',  kit:41},
    {n:'David Raya',             f:'🇪🇸',nat:'ESP',club:'Arsenal',      pos:'GK', age:29,lge:'EPL',  kit:22},
    {n:'Gabriel',                f:'🇧🇷',nat:'BRA',club:'Arsenal',      pos:'DEF',age:26,lge:'EPL',  kit:6},
    {n:'Leandro Trossard',       f:'🇧🇪',nat:'BEL',club:'Arsenal',      pos:'MID',age:29,lge:'EPL',  kit:19},
    // Premier League — Chelsea
    {n:'Cole Palmer',            f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Chelsea',      pos:'MID',age:22,lge:'EPL',  kit:20},
    {n:'Nicolas Jackson',        f:'🇸🇳',nat:'SEN',club:'Chelsea',      pos:'FWD',age:23,lge:'EPL',  kit:15},
    {n:'Reece James',            f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Chelsea',      pos:'DEF',age:24,lge:'EPL',  kit:24},
    {n:'Enzo Fernández',         f:'🇦🇷',nat:'ARG',club:'Chelsea',      pos:'MID',age:23,lge:'EPL',  kit:8},
    {n:'Pedro Neto',             f:'🇵🇹',nat:'POR',club:'Chelsea',      pos:'MID',age:24,lge:'EPL',  kit:7},
    // Premier League — Liverpool
    {n:'Mohamed Salah',          f:'🇪🇬',nat:'EGY',club:'Liverpool',    pos:'FWD',age:32,lge:'EPL',  kit:11},
    {n:'Virgil van Dijk',        f:'🇳🇱',nat:'NED',club:'Liverpool',    pos:'DEF',age:33,lge:'EPL',  kit:4},
    {n:'Alisson',                f:'🇧🇷',nat:'BRA',club:'Liverpool',    pos:'GK', age:31,lge:'EPL',  kit:1},
    {n:'Cody Gakpo',             f:'🇳🇱',nat:'NED',club:'Liverpool',    pos:'FWD',age:25,lge:'EPL',  kit:18},
    {n:'Luis Díaz',              f:'🇨🇴',nat:'COL',club:'Liverpool',    pos:'FWD',age:27,lge:'EPL',  kit:7},
    // Premier League — Manchester City
    {n:'Erling Haaland',         f:'🇳🇴',nat:'NOR',club:'Man City',     pos:'FWD',age:24,lge:'EPL',  kit:9},
    {n:'Kevin De Bruyne',        f:'🇧🇪',nat:'BEL',club:'Man City',     pos:'MID',age:33,lge:'EPL',  kit:17},
    {n:'Phil Foden',             f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Man City',     pos:'MID',age:24,lge:'EPL',  kit:47},
    {n:'Rodri',                  f:'🇪🇸',nat:'ESP',club:'Man City',     pos:'MID',age:28,lge:'EPL',  kit:16},
    {n:'Ederson',                f:'🇧🇷',nat:'BRA',club:'Man City',     pos:'GK', age:31,lge:'EPL',  kit:31},
    {n:'Rúben Dias',             f:'🇵🇹',nat:'POR',club:'Man City',     pos:'DEF',age:27,lge:'EPL',  kit:3},
    {n:'Bernardo Silva',         f:'🇵🇹',nat:'POR',club:'Man City',     pos:'MID',age:30,lge:'EPL',  kit:20},
    // Premier League — Manchester United
    {n:'Bruno Fernandes',        f:'🇵🇹',nat:'POR',club:'Man United',   pos:'MID',age:29,lge:'EPL',  kit:8},
    {n:'Marcus Rashford',        f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Man United',   pos:'FWD',age:26,lge:'EPL',  kit:10},
    {n:'Rasmus Højlund',         f:'🇩🇰',nat:'DEN',club:'Man United',   pos:'FWD',age:21,lge:'EPL',  kit:11},
    {n:'Casemiro',               f:'🇧🇷',nat:'BRA',club:'Man United',   pos:'MID',age:32,lge:'EPL',  kit:18},
    // Premier League — Tottenham
    {n:'Son Heung-min',          f:'🇰🇷',nat:'KOR',club:'Tottenham',    pos:'FWD',age:31,lge:'EPL',  kit:7},
    {n:'James Maddison',         f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Tottenham',    pos:'MID',age:27,lge:'EPL',  kit:10},
    {n:'Dominic Solanke',        f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Tottenham',    pos:'FWD',age:26,lge:'EPL',  kit:19},
    // Premier League — Newcastle
    {n:'Alexander Isak',         f:'🇸🇪',nat:'SWE',club:'Newcastle',    pos:'FWD',age:24,lge:'EPL',  kit:14},
    {n:'Bruno Guimarães',        f:'🇧🇷',nat:'BRA',club:'Newcastle',    pos:'MID',age:26,lge:'EPL',  kit:39},
    // Premier League — Aston Villa
    {n:'Ollie Watkins',          f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Aston Villa',  pos:'FWD',age:28,lge:'EPL',  kit:11},
    {n:'Emiliano Martínez',      f:'🇦🇷',nat:'ARG',club:'Aston Villa',  pos:'GK', age:31,lge:'EPL',  kit:1},
    {n:'Youri Tielemans',        f:'🇧🇪',nat:'BEL',club:'Aston Villa',  pos:'MID',age:27,lge:'EPL',  kit:8},
    // Premier League — Brighton / West Ham
    {n:'Kaoru Mitoma',           f:'🇯🇵',nat:'JPN',club:'Brighton',     pos:'MID',age:26,lge:'EPL',  kit:22},
    {n:'Jarrod Bowen',           f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'West Ham',    pos:'MID',age:27,lge:'EPL',  kit:20},
    {n:'Mohammed Kudus',         f:'🇬🇭',nat:'GHA',club:'West Ham',     pos:'MID',age:23,lge:'EPL',  kit:14},
    // La Liga — Real Madrid
    {n:'Vinicius Jr',            f:'🇧🇷',nat:'BRA',club:'Real Madrid',  pos:'FWD',age:24,lge:'LaLiga',kit:7},
    {n:'Jude Bellingham',        f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Real Madrid',  pos:'MID',age:20,lge:'LaLiga',kit:5},
    {n:'Kylian Mbappé',          f:'🇫🇷',nat:'FRA',club:'Real Madrid',  pos:'FWD',age:25,lge:'LaLiga',kit:9},
    {n:'Thibaut Courtois',       f:'🇧🇪',nat:'BEL',club:'Real Madrid',  pos:'GK', age:32,lge:'LaLiga',kit:1},
    {n:'Federico Valverde',      f:'🇺🇾',nat:'URU',club:'Real Madrid',  pos:'MID',age:26,lge:'LaLiga',kit:8},
    {n:'Antonio Rüdiger',        f:'🇩🇪',nat:'GER',club:'Real Madrid',  pos:'DEF',age:31,lge:'LaLiga',kit:22},
    {n:'Luka Modrić',            f:'🇭🇷',nat:'CRO',club:'Real Madrid',  pos:'MID',age:38,lge:'LaLiga',kit:10},
    // La Liga — Barcelona
    {n:'Robert Lewandowski',     f:'🇵🇱',nat:'POL',club:'Barcelona',    pos:'FWD',age:35,lge:'LaLiga',kit:9},
    {n:'Pedri',                  f:'🇪🇸',nat:'ESP',club:'Barcelona',    pos:'MID',age:21,lge:'LaLiga',kit:8},
    {n:'Gavi',                   f:'🇪🇸',nat:'ESP',club:'Barcelona',    pos:'MID',age:19,lge:'LaLiga',kit:6},
    {n:'Lamine Yamal',           f:'🇪🇸',nat:'ESP',club:'Barcelona',    pos:'MID',age:16,lge:'LaLiga',kit:19},
    {n:'Raphinha',               f:'🇧🇷',nat:'BRA',club:'Barcelona',    pos:'MID',age:27,lge:'LaLiga',kit:11},
    {n:'Marc-André ter Stegen',  f:'🇩🇪',nat:'GER',club:'Barcelona',    pos:'GK', age:32,lge:'LaLiga',kit:1},
    // La Liga — Atlético Madrid
    {n:'Antoine Griezmann',      f:'🇫🇷',nat:'FRA',club:'Atlético',     pos:'FWD',age:33,lge:'LaLiga',kit:7},
    {n:'Jan Oblak',              f:'🇸🇮',nat:'SVN',club:'Atlético',     pos:'GK', age:31,lge:'LaLiga',kit:13},
    // Bundesliga — Bayern Munich
    {n:'Harry Kane',             f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nat:'ENG',club:'Bayern Munich',pos:'FWD',age:30,lge:'Bundesliga',kit:9},
    {n:'Manuel Neuer',           f:'🇩🇪',nat:'GER',club:'Bayern Munich',pos:'GK', age:38,lge:'Bundesliga',kit:1},
    {n:'Jamal Musiala',          f:'🇩🇪',nat:'GER',club:'Bayern Munich',pos:'MID',age:21,lge:'Bundesliga',kit:42},
    {n:'Joshua Kimmich',         f:'🇩🇪',nat:'GER',club:'Bayern Munich',pos:'MID',age:29,lge:'Bundesliga',kit:6},
    {n:'Leroy Sané',             f:'🇩🇪',nat:'GER',club:'Bayern Munich',pos:'MID',age:28,lge:'Bundesliga',kit:10},
    {n:'Alphonso Davies',        f:'🇨🇦',nat:'CAN',club:'Bayern Munich',pos:'DEF',age:23,lge:'Bundesliga',kit:19},
    {n:'Thomas Müller',          f:'🇩🇪',nat:'GER',club:'Bayern Munich',pos:'MID',age:34,lge:'Bundesliga',kit:25},
    // Bundesliga — Bayer Leverkusen
    {n:'Florian Wirtz',          f:'🇩🇪',nat:'GER',club:'Leverkusen',   pos:'MID',age:21,lge:'Bundesliga',kit:10},
    {n:'Granit Xhaka',           f:'🇨🇭',nat:'SUI',club:'Leverkusen',   pos:'MID',age:31,lge:'Bundesliga',kit:34},
    {n:'Alejandro Grimaldo',     f:'🇪🇸',nat:'ESP',club:'Leverkusen',   pos:'DEF',age:28,lge:'Bundesliga',kit:31},
    // Bundesliga — Dortmund
    {n:'Gregor Kobel',           f:'🇨🇭',nat:'SUI',club:'Dortmund',     pos:'GK', age:26,lge:'Bundesliga',kit:1},
    {n:'Julian Brandt',          f:'🇩🇪',nat:'GER',club:'Dortmund',     pos:'MID',age:28,lge:'Bundesliga',kit:19},
    // Serie A — Inter Milan
    {n:'Lautaro Martínez',       f:'🇦🇷',nat:'ARG',club:'Inter Milan',  pos:'FWD',age:26,lge:'Serie A',  kit:10},
    {n:'Marcus Thuram',          f:'🇫🇷',nat:'FRA',club:'Inter Milan',  pos:'FWD',age:26,lge:'Serie A',  kit:9},
    {n:'Nicolò Barella',         f:'🇮🇹',nat:'ITA',club:'Inter Milan',  pos:'MID',age:27,lge:'Serie A',  kit:23},
    {n:'Alessandro Bastoni',     f:'🇮🇹',nat:'ITA',club:'Inter Milan',  pos:'DEF',age:25,lge:'Serie A',  kit:95},
    // Serie A — AC Milan
    {n:'Rafael Leão',            f:'🇵🇹',nat:'POR',club:'AC Milan',     pos:'FWD',age:24,lge:'Serie A',  kit:10},
    {n:'Theo Hernández',         f:'🇫🇷',nat:'FRA',club:'AC Milan',     pos:'DEF',age:26,lge:'Serie A',  kit:19},
    // Serie A — Juventus
    {n:'Dušan Vlahović',         f:'🇷🇸',nat:'SRB',club:'Juventus',     pos:'FWD',age:24,lge:'Serie A',  kit:9},
    {n:'Kenan Yıldız',           f:'🇹🇷',nat:'TUR',club:'Juventus',     pos:'MID',age:18,lge:'Serie A',  kit:10},
    // Serie A — Napoli
    {n:'Khvicha Kvaratskhelia',  f:'🇬🇪',nat:'GEO',club:'Napoli',       pos:'MID',age:23,lge:'Serie A',  kit:77},
    {n:'Victor Osimhen',         f:'🇳🇬',nat:'NGA',club:'Napoli',       pos:'FWD',age:25,lge:'Serie A',  kit:9},
    // Ligue 1 — PSG
    {n:'Ousmane Dembélé',        f:'🇫🇷',nat:'FRA',club:'PSG',          pos:'FWD',age:27,lge:'Ligue 1',  kit:10},
    {n:'Achraf Hakimi',          f:'🇲🇦',nat:'MAR',club:'PSG',          pos:'DEF',age:25,lge:'Ligue 1',  kit:2},
    {n:'Marquinhos',             f:'🇧🇷',nat:'BRA',club:'PSG',          pos:'DEF',age:30,lge:'Ligue 1',  kit:5},
    {n:'Gianluigi Donnarumma',   f:'🇮🇹',nat:'ITA',club:'PSG',          pos:'GK', age:25,lge:'Ligue 1',  kit:99},
    // Saudi Pro League
    {n:'Cristiano Ronaldo',      f:'🇵🇹',nat:'POR',club:'Al-Nassr',     pos:'FWD',age:39,lge:'Saudi Pro',kit:7},
    {n:'N\'Golo Kanté',          f:'🇫🇷',nat:'FRA',club:'Al-Ittihad',   pos:'MID',age:33,lge:'Saudi Pro',kit:7},
    {n:'Karim Benzema',          f:'🇫🇷',nat:'FRA',club:'Al-Ittihad',   pos:'FWD',age:36,lge:'Saudi Pro',kit:9},
    {n:'Neymar',                 f:'🇧🇷',nat:'BRA',club:'Al-Hilal',     pos:'FWD',age:32,lge:'Saudi Pro',kit:10},
  ];

  // ---- Continent groupings (for nationality yellow clue) ----
  var CONT = {
    EUR: ['ENG','GER','FRA','ESP','ITA','POR','BEL','NED','NOR','DEN','SWE','SUI','POL','CRO','SRB','SVN','TUR','GEO'],
    SAM: ['BRA','ARG','COL','URU'],
    AFR: ['EGY','SEN','GHA','MAR','NGA'],
    ASI: ['JPN','KOR'],
    NAM: ['CAN','MEX','USA'],
  };

  function continent(nat) {
    for (var c in CONT) if (CONT[c].indexOf(nat) >= 0) return c;
    return 'OTH';
  }

  // ---- Position adjacency ----
  var POS_ORDER = ['GK','DEF','MID','FWD'];
  function posDist(a, b) { return Math.abs(POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b)); }

  // ---- League display labels ----
  var LGE_LABEL = {
    'EPL':       'EPL',
    'LaLiga':    'Liga',
    'Bundesliga':'BuLi',
    'Serie A':   'SA',
    'Ligue 1':   'L1',
    'Saudi Pro': 'SPL',
  };

  // ---- Evaluate one guess against the answer ----
  function evaluate(g, a) {
    var ageDiff = g.age - a.age;
    return {
      nat:    g.nat  === a.nat  ? 'green' : continent(g.nat) === continent(a.nat) ? 'yellow' : 'grey',
      club:   g.club === a.club ? 'green' : 'grey',
      pos:    g.pos  === a.pos  ? 'green' : posDist(g.pos, a.pos) === 1 ? 'yellow' : 'grey',
      age:    g.age  === a.age  ? 'green' : Math.abs(ageDiff) <= 2 ? 'yellow' : 'grey',
      ageDir: ageDiff < 0 ? '↑' : ageDiff > 0 ? '↓' : '',
      lge:    g.lge  === a.lge  ? 'green' : 'grey',
      kit:    g.kit  === a.kit  ? 'green' : Math.abs(g.kit - a.kit) <= 5 ? 'yellow' : 'grey',
    };
  }

  // ---- Daily player ----
  function pickAnswer(dateStr) {
    var rng = Retention.dailyRng(GAME, dateStr);
    return PLAYERS[(rng() * PLAYERS.length) | 0];
  }

  // ---- State ----
  var dateStr, answer, guesses, results, gameOver;

  function resetState(d) {
    dateStr  = d;
    answer   = pickAnswer(d);
    guesses  = [];
    results  = [];
    gameOver = false;
  }

  // ---- DOM ----
  var searchEl   = document.getElementById('search');
  var dropEl     = document.getElementById('dropdown');
  var listEl     = document.getElementById('guess-list');
  var msgEl      = document.getElementById('msg');
  var streakEl   = document.getElementById('streak');
  var overlay    = document.getElementById('overlay');
  var ovTitle    = document.getElementById('ov-title');
  var ovPlayer   = document.getElementById('ov-player');
  var ovSub      = document.getElementById('ov-sub');
  var ovGuesses  = document.getElementById('ov-guesses');
  var ovStreak   = document.getElementById('ov-streak');
  var ovGrid     = document.getElementById('ov-grid');
  var ovShare    = document.getElementById('ov-share');
  var ovClose    = document.getElementById('ov-close');

  // ---- Render a guess row ----
  function renderRow(player, res) {
    var row = document.createElement('div');
    row.className = 'guess-row';

    var name = document.createElement('div');
    name.className = 'guess-name';
    name.textContent = player.f + ' ' + player.n;
    row.appendChild(name);

    var attrs = document.createElement('div');
    attrs.className = 'guess-attrs';

    function badge(cls, val, sub) {
      var b = document.createElement('div');
      b.className = 'attr ' + cls;
      b.innerHTML = '<span class="val">' + val + '</span>' + (sub ? '<span class="dir">' + sub + '</span>' : '');
      return b;
    }

    attrs.appendChild(badge(res.nat,  player.nat, ''));
    var clubShort = player.club.length > 9 ? player.club.slice(0,8) + '…' : player.club;
    attrs.appendChild(badge(res.club, clubShort, ''));
    attrs.appendChild(badge(res.pos,  player.pos, ''));
    attrs.appendChild(badge(res.age,  player.age, res.age !== 'green' ? res.ageDir : ''));
    attrs.appendChild(badge(res.lge,  LGE_LABEL[player.lge] || player.lge, ''));
    attrs.appendChild(badge(res.kit,  '#' + player.kit, ''));

    row.appendChild(attrs);
    listEl.appendChild(row);
  }

  // ---- Autocomplete ----
  var dropItems = [];
  var dropActive = -1;

  function showDrop(items) {
    dropItems = items;
    dropActive = -1;
    dropEl.innerHTML = '';
    if (!items.length) { dropEl.classList.add('hidden'); return; }
    items.forEach(function (p, i) {
      var li = document.createElement('div');
      li.className = 'drop-item';
      li.innerHTML = '<span class="flag">' + p.f + '</span><span>' + p.n + '<br><span class="meta">' + p.club + ' · ' + p.lge + '</span></span>';
      li.addEventListener('mousedown', function (e) {
        e.preventDefault();
        commitGuess(p);
      });
      dropEl.appendChild(li);
    });
    dropEl.classList.remove('hidden');
  }

  function hideDrop() { dropEl.classList.add('hidden'); dropItems = []; dropActive = -1; }

  function updateActive(n) {
    var children = dropEl.querySelectorAll('.drop-item');
    children.forEach(function (el, i) {
      el.classList.toggle('active', i === n);
    });
    dropActive = n;
  }

  searchEl.addEventListener('input', function () {
    var q = searchEl.value.trim().toLowerCase();
    if (!q) { hideDrop(); return; }
    var matches = PLAYERS.filter(function (p) {
      return p.n.toLowerCase().indexOf(q) >= 0;
    }).slice(0, 8);
    showDrop(matches);
  });

  searchEl.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var next = Math.min(dropActive + 1, dropItems.length - 1);
      updateActive(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      var prev = Math.max(dropActive - 1, 0);
      updateActive(prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (dropActive >= 0 && dropItems[dropActive]) {
        commitGuess(dropItems[dropActive]);
      } else if (dropItems.length === 1) {
        commitGuess(dropItems[0]);
      }
    } else if (e.key === 'Escape') {
      hideDrop();
    }
  });

  searchEl.addEventListener('blur', function () {
    setTimeout(hideDrop, 150);
  });

  // ---- Submit a guess ----
  function commitGuess(player) {
    if (gameOver) return;
    // Check if already guessed
    for (var i = 0; i < guesses.length; i++) {
      if (guesses[i].n === player.n) {
        flash('Already guessed ' + player.n + '!');
        searchEl.value = '';
        hideDrop();
        return;
      }
    }

    var res = evaluate(player, answer);
    guesses.push(player);
    results.push(res);

    renderRow(player, res);

    searchEl.value = '';
    hideDrop();

    // Persist progress
    saveState();

    var won = player.n === answer.n;
    if (won || guesses.length >= MAX) {
      gameOver = true;
      Retention.touchStreak(GAME);
      setTimeout(function () { showOverlay(won); }, 500);
    } else {
      var left = MAX - guesses.length;
      flash(left + ' guess' + (left === 1 ? '' : 'es') + ' left');
    }

    if (Juice) Juice.pop(searchEl, 0.4);
  }

  // ---- Flash message ----
  function flash(txt) {
    msgEl.textContent = txt;
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { msgEl.textContent = ''; }, 2400);
  }

  // ---- Overlay ----
  function showOverlay(won) {
    ovTitle.textContent  = won ? '⚽ Got it!' : '❌ Hard luck';
    ovPlayer.textContent = answer.f + ' ' + answer.n;
    ovSub.textContent    = won
      ? 'You found ' + answer.n + ' in ' + guesses.length + ' ' + (guesses.length === 1 ? 'guess' : 'guesses') + '!'
      : answer.club + ' · ' + answer.pos + ' · ' + answer.lge;
    ovGuesses.textContent = won ? guesses.length + '/' + MAX : 'X/' + MAX;
    ovStreak.textContent  = Retention.streak(GAME);

    // Emoji grid
    ovGrid.innerHTML = '';
    results.forEach(function (res) {
      var row = document.createElement('div');
      row.className = 'ov-grid-row';
      ['nat','club','pos','age','lge','kit'].forEach(function (k) {
        var s = document.createElement('span');
        s.className = res[k] === 'green' ? 'g' : res[k] === 'yellow' ? 'y' : 'x';
        row.appendChild(s);
      });
      ovGrid.appendChild(row);
    });

    overlay.classList.remove('hidden');
    if (Juice) Juice.screenShake(0.5);
  }

  // ---- Share ----
  function buildShareText() {
    var won      = guesses.length && guesses[guesses.length - 1].n === answer.n;
    var score    = won ? guesses.length + '/' + MAX : 'X/' + MAX;
    var emojiMap = {green:'🟩', yellow:'🟨', grey:'⬜'};
    var grid = results.map(function (res) {
      return ['nat','club','pos','age','lge','kit'].map(function (k) {
        return emojiMap[res[k]];
      }).join('');
    }).join('\n');
    return 'Kickle ' + dateStr + ' ' + score + '\n' + grid + '\nprismplay.app';
  }

  ovShare.addEventListener('click', function () {
    var text = buildShareText();
    if (navigator.share) {
      navigator.share({ title: 'Kickle', text: text });
    } else {
      navigator.clipboard.writeText(text).then(function () {
        ovShare.textContent = 'Copied!';
        setTimeout(function () { ovShare.textContent = 'Share result'; }, 2000);
      });
    }
  });

  ovClose.addEventListener('click', function () {
    overlay.classList.add('hidden');
  });

  // ---- Persist / restore ----
  function saveState() {
    Retention.set(GAME, 'state', {
      date:    dateStr,
      guesses: guesses.map(function (p) { return p.n; }),
      over:    gameOver,
    });
  }

  function loadState() {
    var saved = Retention.get(GAME, 'state', null);
    if (!saved || saved.date !== dateStr) return false;
    var restored = saved.guesses.map(function (name) {
      return PLAYERS.find(function (p) { return p.n === name; });
    }).filter(Boolean);
    if (!restored.length) return false;
    restored.forEach(function (p) {
      var res = evaluate(p, answer);
      guesses.push(p);
      results.push(res);
      renderRow(p, res);
    });
    gameOver = saved.over;
    if (gameOver) setTimeout(function () { showOverlay(guesses[guesses.length - 1].n === answer.n); }, 200);
    return true;
  }

  // ---- Init ----
  function init() {
    var today = Retention.todayStr();
    resetState(today);

    streakEl.textContent = '🔥 ' + Retention.streak(GAME) + ' day streak';

    var restored = loadState();

    if (gameOver) {
      searchEl.disabled = true;
    } else {
      searchEl.focus();
      if (!restored) {
        var left = MAX - guesses.length;
        flash(left + ' guess' + (left === 1 ? '' : 'es') + ' remaining today');
      }
    }
  }

  init();
})();
