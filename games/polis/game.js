/* POLIS — a one-screen settlement that grows into a Roman city across the ages.
 *
 * Phase 1: deterministic island generation + warm-daylight isometric renderer
 * (auto-fit, no scrolling), tile picking, selection, save/load skeleton, Portal
 * lifecycle, and the window.__polis headless hook. Economy/buildings/ages land in
 * later phases — the data structures and render hooks are stubbed for them here.
 *
 * Shared (no build step): juice.js, retention.js, portal.js, progression.js, stage.js.
 */
(function () {
  'use strict';

  var GAME = 'polis';
  var clamp = Juice.clamp;

  // ---- world constants ----
  var GRID = 9;                 // GRID x GRID logical tiles (one screen, no scroll)
  var CENTER = (GRID - 1) / 2;
  var AGE_UNLOCK_R = [2, 3, 4]; // chebyshev radius of buildable tiles per age (I, II, III)

  // terrain palette (warm daylight)
  var TER = {
    water: { top: '#6fb6d6', name: 'Water' },
    sand:  { top: '#e9d8a6', name: 'Sand'  },
    grass: { top: '#7cc28a', name: 'Grass' },
    rock:  { top: '#9aa3ad', name: 'Hills' }
  };

  // ---- building catalog (data-driven; tuned across phases) ----
  // prod: produces `base` units of res every `interval`s (rate = base/interval), scaled
  //       by adjacency and (for popCost>0 buildings) by labour efficiency.
  // adj:  per matching neighbour within radius -> mult adds to a multiplier, flat adds units.
  // pop:  population provided (housing). popCost: labour required to operate.
  // cap:  adds to storage caps. landmark: gates/symbolises an age.
  var CATALOG = [
    // --- Age I — Founding ---
    { id: 'hut', name: 'Hut', glyph: '🛖', color: '#c98b5a', age: 0, cost: { gold: 10 },
      place: { on: ['grass', 'sand'] }, pop: 3, prod: { res: 'gold', base: 1, interval: 6 },
      adj: [{ target: 'hut', kind: 'building', mult: 0.10, radius: 1 }] },
    { id: 'farm', name: 'Farm', glyph: '🌾', color: '#d9b24a', age: 0, cost: { gold: 12, wood: 5 },
      place: { on: ['grass'] }, popCost: 1, prod: { res: 'food', base: 2, interval: 4 },
      adj: [{ target: 'water', kind: 'terrain', flat: 1, radius: 1 },
            { target: 'farm', kind: 'building', mult: 0.25, radius: 1 }] },
    { id: 'lumber', name: 'Lumber Camp', glyph: '🪵', color: '#8a6b3a', age: 0, cost: { gold: 14 },
      place: { on: ['grass'] }, popCost: 1, prod: { res: 'wood', base: 1.5, interval: 5 },
      adj: [{ target: 'forest', kind: 'terrain', mult: 0.6, radius: 1 }] },

    // --- Age II — Village ---
    { id: 'house', name: 'House', glyph: '🏠', color: '#d98a4f', age: 1, cost: { wood: 25, gold: 10 },
      place: { on: ['grass', 'sand'] }, pop: 6, prod: { res: 'gold', base: 2, interval: 6 },
      adj: [{ target: 'house', kind: 'building', mult: 0.12, radius: 1 }] },
    { id: 'quarry', name: 'Quarry', glyph: '⛏️', color: '#8b94a0', age: 1, cost: { wood: 20, gold: 15 },
      place: { on: ['grass', 'rock'], near: ['rock'] }, popCost: 2, prod: { res: 'stone', base: 1.5, interval: 6 },
      adj: [{ target: 'rock', kind: 'terrain', mult: 0.5, radius: 1 }] },
    { id: 'market', name: 'Market', glyph: '🪙', color: '#e0b15a', age: 1, cost: { wood: 30, stone: 10 },
      place: { on: ['grass'] }, popCost: 1, prod: { res: 'gold', base: 3, interval: 5 },
      adj: [{ target: 'house', kind: 'building', mult: 0.20, radius: 2 }] },
    { id: 'library', name: 'Library', glyph: '📜', color: '#b06fae', age: 1, cost: { wood: 30, stone: 15 },
      place: { on: ['grass'] }, popCost: 1, prod: { res: 'know', base: 1, interval: 7 },
      adj: [{ target: 'house', kind: 'building', mult: 0.15, radius: 2 }] },
    { id: 'granary', name: 'Granary', glyph: '🏚️', color: '#bfa46a', age: 1, cost: { wood: 25, stone: 10 },
      place: { on: ['grass'] }, cap: { food: 300, wood: 200 } },

    // --- Age III — Roman City ---
    { id: 'insula', name: 'Insula', glyph: '🏘️', color: '#cf7f44', age: 2, cost: { stone: 40, gold: 20 },
      place: { on: ['grass', 'sand'] }, pop: 12, prod: { res: 'gold', base: 4, interval: 6 },
      adj: [{ target: 'insula', kind: 'building', mult: 0.10, radius: 1 }] },
    { id: 'aqueduct', name: 'Aqueduct', glyph: '💧', color: '#9fc7d8', age: 2, cost: { stone: 60, gold: 30 },
      place: { on: ['grass'] }, cap: { food: 400, know: 200 } },
    { id: 'forum', name: 'Forum', glyph: '🏛️', color: '#e8d6a0', age: 2, cost: { stone: 80, wood: 40, gold: 50 },
      place: { on: ['grass'] }, landmark: true, prod: { res: 'know', base: 3, interval: 6 },
      adj: [{ target: 'house', kind: 'building', mult: 0.10, radius: 2 },
            { target: 'insula', kind: 'building', mult: 0.10, radius: 2 }] },
    { id: 'colosseum', name: 'Colosseum', glyph: '🏟️', color: '#d8c08a', age: 2, cost: { stone: 120, gold: 80 },
      place: { on: ['grass'] }, landmark: true, prod: { res: 'gold', base: 6, interval: 5 },
      adj: [{ target: 'house', kind: 'building', mult: 0.08, radius: 3 },
            { target: 'insula', kind: 'building', mult: 0.08, radius: 3 }] }
  ];
  var DEF = {};
  for (var _i = 0; _i < CATALOG.length; _i++) DEF[CATALOG[_i].id] = CATALOG[_i];
  function defOf(id) { return DEF[id]; }

  var RES_KEYS = ['food', 'wood', 'stone', 'gold', 'know'];
  var CAP_BASE = { food: 200, wood: 200, stone: 200, gold: 500, know: 100 };

  // ---- DOM ----
  var canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  var wrap = document.querySelector('.board-wrap');
  var loader = document.getElementById('loader');
  var agePill = document.getElementById('age-pill');
  var questText = document.getElementById('quest-text');
  var panel = document.getElementById('panel');
  var panelTitle = document.getElementById('panel-title');
  var panelBody = document.getElementById('panel-body');

  var particles = new Juice.Particles(), popups = new Juice.Popups();

  // ---- state ----
  var S = null;        // full game state (serialisable)
  var sel = null;      // selected {gx,gy}
  var seed = 0;

  // layout (screen mapping), recomputed on resize
  var CW = 0, CH = 0, DPR = 1, TW = 64, originX = 0, originY = 0;

  function defaultState(sd) {
    return {
      seed: sd,
      age: 0,                       // 0-indexed age (Age I = 0)
      tiles: genTiles(sd),
      res: { food: 20, wood: 20, stone: 0, gold: 50, know: 0 },
      cap: { food: 200, wood: 200, stone: 200, gold: 500, know: 100 },
      lastSeen: Date.now(),
      quests: [], questIdx: 0,
      created: Date.now()
    };
  }

  // ---------- terrain generation (deterministic) ----------
  function genTiles(sd) {
    var rnd = Retention.mulberry32(sd >>> 0);
    var rnd2 = Retention.mulberry32((sd ^ 0x9e3779b9) >>> 0);
    var raw = [], i, j;
    for (i = 0; i < GRID; i++) { raw[i] = []; for (j = 0; j < GRID; j++) raw[i][j] = rnd(); }
    // box-blur twice for smooth blobs
    function blur(src) {
      var out = [];
      for (i = 0; i < GRID; i++) {
        out[i] = [];
        for (j = 0; j < GRID; j++) {
          var s = 0, n = 0;
          for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
            var x = i + a, y = j + b;
            if (x >= 0 && x < GRID && y >= 0 && y < GRID) { s += src[x][y]; n++; }
          }
          out[i][j] = s / n;
        }
      }
      return out;
    }
    var h = blur(blur(raw));
    // radial island falloff + normalise
    var min = 1e9, max = -1e9, H = [];
    for (i = 0; i < GRID; i++) {
      H[i] = [];
      for (j = 0; j < GRID; j++) {
        var dx = (i - CENTER) / (CENTER + 0.5), dy = (j - CENTER) / (CENTER + 0.5);
        var d = Math.sqrt(dx * dx + dy * dy);
        var v = h[i][j] * 0.55 + (1 - d * d * 0.95) * 0.7;
        H[i][j] = v; if (v < min) min = v; if (v > max) max = v;
      }
    }
    var tiles = [];
    for (i = 0; i < GRID; i++) {
      tiles[i] = [];
      for (j = 0; j < GRID; j++) {
        var nv = (H[i][j] - min) / (max - min || 1);  // 0..1
        var type, level, forest = false;
        if (nv < 0.34) { type = 'water'; level = 0; }
        else if (nv < 0.42) { type = 'sand'; level = 1; }
        else if (nv > 0.78) { type = 'rock'; level = 3; }
        else { type = 'grass'; level = nv > 0.6 ? 2 : 1; forest = rnd2() > 0.62; }
        tiles[i][j] = { gx: i, gy: j, type: type, level: level, forest: forest, b: null };
      }
    }
    // The Age-I core (chebyshev radius <= 2) is a friendly grassy plateau; hills,
    // forest and coast are saved for the outer rings that the later ages reveal.
    for (i = 0; i < GRID; i++) for (j = 0; j < GRID; j++) {
      var t = tiles[i][j];
      var ring = Math.max(Math.abs(i - CENTER), Math.abs(j - CENTER));
      if (ring <= AGE_UNLOCK_R[0]) {
        t.type = 'grass';
        t.level = (rnd() < 0.7) ? 1 : 0;
        t.forest = (ring >= 2 && rnd2() > 0.72); // a few trees only at the rim of the core
      }
    }
    // keep the very center clear (the founding plaza)
    var c = tiles[CENTER][CENTER]; c.type = 'grass'; c.level = 1; c.forest = false;
    return tiles;
  }

  function tileAt(gx, gy) { return (S.tiles[gx] && S.tiles[gx][gy]) || null; }
  function unlockR() { return AGE_UNLOCK_R[Math.min(S.age, AGE_UNLOCK_R.length - 1)]; }
  function isUnlocked(t) {
    return Math.max(Math.abs(t.gx - CENTER), Math.abs(t.gy - CENTER)) <= unlockR();
  }
  function isBuildable(t) {
    return t && isUnlocked(t) && t.type !== 'water' && !t.b;
  }

  // ---------- economy engine ----------
  var pop = 0, popUsed = 0, eff = 1;   // derived (recomputed; not serialised)

  // count neighbours of a tile matching a target terrain/building within chebyshev radius
  function countNbr(t, target, kind, radius) {
    var n = 0;
    for (var di = -radius; di <= radius; di++) for (var dj = -radius; dj <= radius; dj++) {
      if (di === 0 && dj === 0) continue;
      var o = tileAt(t.gx + di, t.gy + dj);
      if (!o) continue;
      if (kind === 'terrain') {
        if (target === 'forest') { if (o.forest) n++; }
        else if (o.type === target) n++;
      } else { // building
        if (o.b && o.b.id === target) n++;
      }
    }
    return n;
  }

  // adjacency -> { mult, flat } for a building on tile t
  function adjStats(t, def) {
    var mult = 1, flat = 0, rules = def.adj || [];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i], c = countNbr(t, r.target, r.kind, r.radius || 1);
      if (!c) continue;
      if (r.mult) mult += r.mult * c;
      if (r.flat) flat += r.flat * c;
    }
    return { mult: mult, flat: flat };
  }

  // production rate (units/sec) of the building on tile t for its resource
  function rateOf(t) {
    var def = t.b && defOf(t.b.id);
    if (!def || !def.prod) return 0;
    var lvl = t.b.level || 1;
    var a = adjStats(t, def);
    var perInterval = (def.prod.base * a.mult + a.flat) * lvl;   // level scales output
    var rate = perInterval / def.prod.interval;
    if (def.popCost > 0) rate *= eff;                            // labour-limited
    return rate;
  }

  function eachBuilding(fn) {
    for (var i = 0; i < GRID; i++) for (var j = 0; j < GRID; j++) {
      var t = S.tiles[i][j]; if (t.b) fn(t, defOf(t.b.id));
    }
  }

  // recompute population, labour efficiency, and storage caps from placed buildings
  function recompute() {
    pop = 0; popUsed = 0;
    var cap = { food: CAP_BASE.food, wood: CAP_BASE.wood, stone: CAP_BASE.stone, gold: CAP_BASE.gold, know: CAP_BASE.know };
    eachBuilding(function (t, def) {
      var lvl = t.b.level || 1;
      if (def.pop) pop += def.pop * lvl;
      if (def.popCost) popUsed += def.popCost;
      if (def.cap) for (var k in def.cap) if (cap[k] != null) cap[k] += def.cap[k] * lvl;
    });
    eff = popUsed > 0 ? clamp(pop / popUsed, 0, 1) : 1;
    S.cap = cap;
    // clamp stored resources to (possibly lowered) caps
    for (var r = 0; r < RES_KEYS.length; r++) {
      var key = RES_KEYS[r];
      if (S.res[key] > cap[key]) S.res[key] = cap[key];
    }
  }

  function affordable(def) {
    var c = def.cost || {};
    for (var k in c) if ((S.res[k] || 0) < c[k]) return false;
    return true;
  }
  function nearOk(t, def) {
    if (!def.place || !def.place.near) return true;
    for (var i = 0; i < def.place.near.length; i++) {
      if (countNbr(t, def.place.near[i], 'terrain', 1) > 0) return true;
    }
    return false;
  }
  function placeOk(t, def) {
    return def.place && def.place.on && def.place.on.indexOf(t.type) >= 0;
  }
  // why a building can't be placed here (null === ok)
  function buildBlock(t, id) {
    var def = defOf(id);
    if (!def) return 'unknown';
    if (!t) return 'no tile';
    if (def.age > S.age) return 'locked age';
    if (!isUnlocked(t)) return 'locked tile';
    if (t.b) return 'occupied';
    if (t.type === 'water') return 'water';
    if (!placeOk(t, def)) return 'terrain';
    if (!nearOk(t, def)) return 'needs ' + def.place.near.join('/');
    if (!affordable(def)) return 'cost';
    return null;
  }
  function canBuild(gx, gy, id) { return buildBlock(tileAt(gx, gy), id) === null; }

  function build(gx, gy, id) {
    var t = tileAt(gx, gy), def = defOf(id);
    if (buildBlock(t, id) !== null) return false;
    var c = def.cost || {};
    for (var k in c) S.res[k] -= c[k];
    t.b = { id: id, level: 1 };
    recompute(); save();
    return true;
  }

  // accrue production for `sec` seconds into the store, clamped to caps. Returns gains.
  function accrue(sec) {
    if (!(sec > 0)) return {};
    var gained = {};
    eachBuilding(function (t, def) {
      if (!def.prod) return;
      var r = rateOf(t); if (r <= 0) return;
      gained[def.prod.res] = (gained[def.prod.res] || 0) + r * sec;
    });
    for (var k in gained) S.res[k] = clamp((S.res[k] || 0) + gained[k], 0, S.cap[k]);
    return gained;
  }

  // total production rate per resource (units/sec) — for HUD/preview
  function ratesPerSec() {
    var out = { food: 0, wood: 0, stone: 0, gold: 0, know: 0 };
    eachBuilding(function (t, def) { if (def.prod) out[def.prod.res] += rateOf(t); });
    return out;
  }

  // preview for the build menu / ghost: cost, resulting rate, blocker
  function buildPreview(gx, gy, id) {
    var t = tileAt(gx, gy), def = defOf(id);
    if (!def) return null;
    var block = buildBlock(t, id);
    var rate = 0;
    if (def.prod && t && t.type !== 'water') {
      var a = adjStats(t, def);
      var perInterval = def.prod.base * a.mult + a.flat;
      rate = perInterval / def.prod.interval;  // unscaled by eff (preview shows potential)
    }
    return { ok: block === null, block: block, cost: def.cost || {}, prod: def.prod || null,
             rate: rate, pop: def.pop || 0, popCost: def.popCost || 0 };
  }

  // ---------- layout / iso projection ----------
  function bbox(tw, fitRing) {
    var half = tw / 2, quart = tw * 0.25, zs = tw * 0.30, base = tw * 0.16;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var i = 0; i < GRID; i++) for (var j = 0; j < GRID; j++) {
      if (Math.max(Math.abs(i - CENTER), Math.abs(j - CENTER)) > fitRing) continue;
      var t = S.tiles[i][j];
      var isoX = (i - j) * half, isoY = (i + j) * quart;
      var cy = isoY - t.level * zs, faceH = t.level * zs + base;
      if (isoX - half < minX) minX = isoX - half;
      if (isoX + half > maxX) maxX = isoX + half;
      if (cy - quart < minY) minY = cy - quart;
      if (cy + quart + faceH > maxY) maxY = cy + quart + faceH;
    }
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  function layout() {
    var bw = wrap.clientWidth || 360, bh = wrap.clientHeight || 520;
    CW = Math.max(240, bw); CH = Math.max(320, bh);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
    canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!S) return;
    // fit the camera to the unlocked area + one ring of sea; zooms out as ages expand
    var fr = Math.min(GRID - 1, unlockR() + 1);
    var b0 = bbox(100, fr);
    var availW = CW * 0.94, availH = CH * 0.78;
    var scale = Math.min(availW / (b0.maxX - b0.minX), availH / (b0.maxY - b0.minY));
    TW = 100 * scale;
    var b = bbox(TW, fr);
    originX = CW / 2 - (b.minX + b.maxX) / 2;
    originY = CH / 2 - (b.minY + b.maxY) / 2;
  }

  function isoOf(t) {
    var half = TW / 2, quart = TW * 0.25, zs = TW * 0.30;
    return {
      x: originX + (t.gx - t.gy) * half,
      y: originY + (t.gx + t.gy) * quart - t.level * zs
    };
  }

  // ---------- rendering ----------
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return 'rgb(' + clamp(r, 0, 255) + ',' + clamp(g, 0, 255) + ',' + clamp(b, 0, 255) + ')';
  }

  function drawTile(t) {
    var p = isoOf(t), half = TW / 2, quart = TW * 0.25, zs = TW * 0.30, base = TW * 0.16;
    var locked = !isUnlocked(t);
    var type = locked ? 'water' : t.type;
    var topCol = TER[type].top;
    var faceH = (locked ? 0 : t.level) * zs + base;
    var cx = p.x, cy = locked ? originY + (t.gx + t.gy) * quart : p.y;

    // side faces (front-left + front-right)
    ctx.beginPath();
    ctx.moveTo(cx - half, cy);          // L
    ctx.lineTo(cx, cy + quart);         // B
    ctx.lineTo(cx, cy + quart + faceH);
    ctx.lineTo(cx - half, cy + faceH);
    ctx.closePath();
    ctx.fillStyle = shade(topCol, 0.62); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy + quart);         // B
    ctx.lineTo(cx + half, cy);          // R
    ctx.lineTo(cx + half, cy + faceH);
    ctx.lineTo(cx, cy + quart + faceH);
    ctx.closePath();
    ctx.fillStyle = shade(topCol, 0.80); ctx.fill();

    // top diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - quart);         // T
    ctx.lineTo(cx + half, cy);          // R
    ctx.lineTo(cx, cy + quart);         // B
    ctx.lineTo(cx - half, cy);          // L
    ctx.closePath();
    if (type === 'water') {
      var g = ctx.createLinearGradient(cx, cy - quart, cx, cy + quart);
      g.addColorStop(0, '#8fd0e6'); g.addColorStop(1, '#5aa6c8');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = topCol;
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1; ctx.stroke();

    if (locked) {
      // faint "fog" over land-to-be
      ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill();
      return;
    }

    // decorations
    if (t.forest) drawTrees(cx, cy, half, quart);
    if (t.type === 'rock') drawRocks(cx, cy, half, quart);

    // building (later phases)
    if (t.b) drawBuilding(t, cx, cy, half, quart);

    // selection highlight
    if (sel && sel.gx === t.gx && sel.gy === t.gy) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - quart); ctx.lineTo(cx + half, cy);
      ctx.lineTo(cx, cy + quart); ctx.lineTo(cx - half, cy); ctx.closePath();
      ctx.strokeStyle = '#fff7ea'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(224,177,90,.9)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  function drawTrees(cx, cy, half, quart) {
    var spots = [[-0.22, -0.04], [0.18, 0.02], [-0.02, 0.16]];
    for (var i = 0; i < spots.length; i++) {
      var tx = cx + spots[i][0] * TW, ty = cy + spots[i][1] * quart * 2;
      var r = TW * 0.10;
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath(); ctx.ellipse(tx, ty + r * 0.5, r * 0.7, r * 0.3, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(tx - r * 0.12, ty - r * 0.2, r * 0.24, r * 0.7);
      ctx.fillStyle = '#3f8f57';
      ctx.beginPath(); ctx.moveTo(tx, ty - r * 1.5); ctx.lineTo(tx + r * 0.8, ty); ctx.lineTo(tx - r * 0.8, ty); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4fa869';
      ctx.beginPath(); ctx.moveTo(tx, ty - r * 1.9); ctx.lineTo(tx + r * 0.6, ty - r * 0.6); ctx.lineTo(tx - r * 0.6, ty - r * 0.6); ctx.closePath(); ctx.fill();
    }
  }

  function drawRocks(cx, cy, half, quart) {
    ctx.fillStyle = '#7f8893';
    ctx.beginPath(); ctx.ellipse(cx, cy, TW * 0.16, TW * 0.09, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#b6bdc6';
    ctx.beginPath(); ctx.ellipse(cx - TW * 0.04, cy - TW * 0.03, TW * 0.09, TW * 0.05, 0, 0, 6.28); ctx.fill();
  }

  // building rendering stub (fleshed out with the catalog in later phases)
  function drawBuilding(t, cx, cy, half, quart) {
    var b = t.b;
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath(); ctx.ellipse(cx, cy + quart * 0.3, half * 0.5, quart * 0.5, 0, 0, 6.28); ctx.fill();
    var h = TW * 0.5;
    ctx.fillStyle = b.color || '#c9772f';
    ctx.fillRect(cx - half * 0.4, cy - h * 0.5, half * 0.8, h * 0.6);
    if (b.glyph) {
      ctx.font = (TW * 0.32) + 'px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.glyph, cx, cy - h * 0.2);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, CW, CH);
    if (!S) return;
    // soft ground shadow under the island
    // painter's order: increasing gx+gy
    for (var s = 0; s <= 2 * (GRID - 1); s++) {
      for (var i = 0; i < GRID; i++) {
        var j = s - i;
        if (j < 0 || j >= GRID) continue;
        drawTile(S.tiles[i][j]);
      }
    }
    particles.draw(ctx); popups.draw(ctx);
  }

  // ---------- picking ----------
  function pickTile(px, py) {
    // reverse painter order: front-most (largest gx+gy) first
    for (var s = 2 * (GRID - 1); s >= 0; s--) {
      for (var i = GRID - 1; i >= 0; i--) {
        var j = s - i;
        if (j < 0 || j >= GRID) continue;
        var t = S.tiles[i][j], p = isoOf(t), half = TW / 2, quart = TW * 0.25;
        var dx = Math.abs(px - p.x) / half, dy = Math.abs(py - p.y) / quart;
        if (dx + dy <= 1) return t;
      }
    }
    return null;
  }

  // ---------- panel (Phase 1: tile inspector; build menu added in Phase 3) ----------
  function openPanel(t) {
    sel = { gx: t.gx, gy: t.gy };
    panelTitle.textContent = TER[t.type].name + (t.forest ? ' · Forest' : '');
    var lines = [];
    lines.push('Tile (' + t.gx + ',' + t.gy + ')');
    lines.push(isUnlocked(t) ? (isBuildable(t) ? 'Buildable' : (t.b ? 'Occupied' : 'Not buildable')) : 'Locked — unlocks in a later age');
    panelBody.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);font-size:13px;line-height:1.6">' + lines.join('<br>') + '</div>';
    panel.classList.remove('hidden');
  }
  function closePanel() { panel.classList.add('hidden'); sel = null; }

  // ---------- save / load ----------
  function save() { if (S) { S.lastSeen = Date.now(); Retention.set(GAME, 'save', S); } }
  function load() {
    var raw = Retention.get(GAME, 'save', null);
    if (raw && raw.tiles && raw.tiles.length === GRID) { S = raw; seed = raw.seed; recompute(); return true; }
    return false;
  }

  function urlSeed() {
    try { var m = /[?&]seed=(\d+)/.exec(window.location.search); return m ? (+m[1] >>> 0) : null; }
    catch (e) { return null; }
  }
  function newGame(sd) {
    seed = (sd == null) ? (Date.now() >>> 0) : (sd >>> 0);
    S = defaultState(seed);
    sel = null;
    recompute();
    layout();
    save();
  }

  // ---------- HUD ----------
  function renderHUD() {
    if (!S) return;
    setRes('food', S.res.food, S.cap.food);
    setRes('wood', S.res.wood, S.cap.wood);
    setRes('stone', S.res.stone, S.cap.stone);
    setRes('gold', S.res.gold, S.cap.gold);
    setRes('know', S.res.know, S.cap.know);
    var ageNames = ['Age I · Founding', 'Age II · Village', 'Age III · Roman City'];
    agePill.textContent = ageNames[Math.min(S.age, ageNames.length - 1)];
  }
  function setRes(key, v, cap) {
    var el = document.getElementById('r-' + key);
    if (!el) return;
    var rv = el.querySelector('.rv');
    if (rv) rv.textContent = Math.floor(v) + '';
  }

  // ---------- input ----------
  function cpt(clientX, clientY) {
    var b = canvas.getBoundingClientRect();
    return { x: (clientX - b.left) * (CW / b.width), y: (clientY - b.top) * (CH / b.height) };
  }
  canvas.addEventListener('pointerdown', function (e) {
    Juice.Audio.unlock && Juice.Audio.unlock();
    var p = cpt(e.clientX, e.clientY);
    var t = pickTile(p.x, p.y);
    if (t) { openPanel(t); Juice.Audio.play('tap'); }
    else { closePanel(); }
  });
  document.getElementById('panel-close').addEventListener('click', closePanel);
  document.getElementById('menu').addEventListener('click', function () { /* City Hall menu — Phase 4 */ });
  var muteBtn = document.getElementById('mute');
  muteBtn.addEventListener('click', function () {
    var m = Juice.Audio.toggleMute(); Retention.set(GAME, 'muted', m); Portal.mute(m);
    this.textContent = m ? '🔇' : '🔊';
  });

  // ---------- loop ----------
  function update(dt) {
    particles.update(dt); popups.update(dt);
    if (S) accrue(dt);   // live production into the store (capped)
  }

  // ---------- boot ----------
  function boot() {
    Portal.loadingStart();
    if (Retention.get(GAME, 'muted', false)) { Juice.Audio.setMuted(true); muteBtn.textContent = '🔇'; }
    var us = urlSeed();
    if (us != null) newGame(us);
    else if (!load()) newGame();
    layout(); renderHUD();
    Retention.touchStreak(GAME);

    if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(wrap);
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
    window.addEventListener('beforeunload', save);

    var last = performance.now();
    (function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt); draw(); renderHUD();
      requestAnimationFrame(frame);
    })(performance.now());

    Portal.init().then(function () {
      Portal.loadingStop(); Portal.mute(Juice.Audio.isMuted());
      if (loader) loader.classList.add('hidden');
      Portal.gameStart();
    });
  }

  // ---------- headless test hook ----------
  window.__polis = {
    newGame: newGame,
    state: function () {
      return {
        seed: S.seed, age: S.age, res: JSON.parse(JSON.stringify(S.res)),
        cap: JSON.parse(JSON.stringify(S.cap)), pop: pop, popUsed: popUsed, eff: Math.round(eff * 100) / 100,
        rates: ratesPerSec(), unlockR: unlockR(),
        buildable: countBuildable(), buildings: countBuildings()
      };
    },
    tiles: function () { return S.tiles; },
    tile: function (gx, gy) { return tileAt(gx, gy); },
    isBuildable: function (gx, gy) { return isBuildable(tileAt(gx, gy)); },
    defs: function () { return CATALOG.map(function (d) { return d.id; }); },
    canBuild: canBuild,
    buildPreview: buildPreview,
    build: build,
    rateOf: function (gx, gy) { return rateOf(tileAt(gx, gy)); },
    rates: ratesPerSec,
    accrue: function (sec) { var g = accrue(sec); recompute(); return g; },
    recompute: recompute,
    setRes: function (o) { for (var k in o) S.res[k] = o[k]; recompute(); },  // test helper
    setAge: function (a) { S.age = a; layout(); },                            // test helper
    pick: function (gx, gy) { var t = tileAt(gx, gy); if (t) openPanel(t); return t; },
    save: save, load: load,
    _S: function () { return S; }
  };
  function countBuildable() { var n = 0; for (var i = 0; i < GRID; i++) for (var j = 0; j < GRID; j++) if (isBuildable(S.tiles[i][j])) n++; return n; }
  function countBuildings() { var n = 0; for (var i = 0; i < GRID; i++) for (var j = 0; j < GRID; j++) if (S.tiles[i][j].b) n++; return n; }

  boot();
})();
