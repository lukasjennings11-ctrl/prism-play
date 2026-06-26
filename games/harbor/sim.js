/* HARBOR — render-agnostic economy simulation. window.HARBOR_SIM
 * No WebGL/DOM here so it runs headlessly (Node tests) and the renderer just reads state.
 * Core loop: production buildings make resources (limited by storage caps + labour from housing);
 * selling buildings convert resources -> money; money builds & upgrades more; reaching thresholds
 * advances the era (Fishing Village -> ... -> Global Hub). Persists + accrues offline via Retention.
 */
(function (g) {
  'use strict';
  var R = g.Retention || null;

  // ---- era ladder ----
  var ERAS = ['Fishing Village', 'Trading Post', 'Industrial Port', 'Metropolis', 'Megaport', 'Global Hub'];

  // ---- building catalogue (data-driven) ----
  // prod: {res:rate/s}; sells:{from,rate/s,price}; money:rate/s (direct trade); cap:{res:amount};
  // pop: housing added; jobs: workers needed; era: min era to build; cost/costMul: build price growth;
  // lvlCost: upgrade price growth; lvlGain: per-level output multiplier.
  var BT = {
    fishing_hut: { name: 'Fishing Hut', era: 0, cost: 25, costMul: 1.55, jobs: 2, prod: { fish: 0.5 }, lvlCost: 1.8, lvlGain: 1.5, max: 12 },
    jetty:       { name: 'Fishing Jetty', era: 0, cost: 60, costMul: 1.6, jobs: 1, sells: { from: 'fish', rate: 0.9, price: 3 }, lvlCost: 1.8, lvlGain: 1.45, max: 12 },
    cottage:     { name: 'Cottage', era: 0, cost: 40, costMul: 1.5, pop: 4, lvlCost: 1.65, lvlGain: 1.4, max: 24 },
    warehouse:   { name: 'Warehouse', era: 1, cost: 120, costMul: 1.7, cap: { fish: 60, timber: 60, goods: 60 }, lvlCost: 1.7, lvlGain: 1.55, max: 12 },
    market:      { name: 'Fish Market', era: 1, cost: 160, costMul: 1.75, jobs: 3, sells: { from: 'fish', rate: 1.6, price: 4.5 }, lvlCost: 1.85, lvlGain: 1.5, max: 12 },
    sawmill:     { name: 'Sawmill', era: 2, cost: 320, costMul: 1.8, jobs: 4, prod: { timber: 0.6 }, lvlCost: 1.9, lvlGain: 1.5, max: 12 },
    factory:     { name: 'Goods Factory', era: 2, cost: 520, costMul: 1.85, jobs: 6, convert: { from: 'timber', to: 'goods', rate: 0.5 }, lvlCost: 1.95, lvlGain: 1.5, max: 12 },
    dock:        { name: 'Cargo Dock', era: 2, cost: 800, costMul: 1.9, jobs: 5, sells: { from: 'goods', rate: 0.7, price: 22 }, lvlCost: 2.0, lvlGain: 1.5, max: 12 }
  };
  var BASE_CAP = { fish: 60, timber: 60, goods: 60 };

  // era advance requirements: money on hand OR cumulative + minimum building counts
  var ERA_REQ = [
    { money: 250, need: { fishing_hut: 2, cottage: 1 } },           // -> Trading Post
    { money: 1500, need: { jetty: 1, cottage: 2 } },                // -> Industrial Port
    { money: 8000, need: { warehouse: 1, market: 1 } },             // -> Metropolis
    { money: 40000, need: { factory: 1, dock: 1 } },                // -> Megaport
    { money: 200000, need: { dock: 2 } }                            // -> Global Hub
  ];

  var S = null;
  function now() { return Date.now ? Date.now() : 0; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function fresh() {
    return { era: 0, money: 120, res: { fish: 0, timber: 0, goods: 0 }, buildings: [], pop: 0, lastSeen: now(), founded: false };
  }

  function counts() { var c = {}; for (var i = 0; i < S.buildings.length; i++) { var t = S.buildings[i].type; c[t] = (c[t] || 0) + 1; } return c; }
  function countOf(type) { var n = 0; for (var i = 0; i < S.buildings.length; i++) if (S.buildings[i].type === type) n++; return n; }
  function caps() {
    var cap = { fish: BASE_CAP.fish, timber: BASE_CAP.timber, goods: BASE_CAP.goods };
    for (var i = 0; i < S.buildings.length; i++) { var b = S.buildings[i], t = BT[b.type]; if (t.cap) for (var r in t.cap) cap[r] += t.cap[r] * lvlMul(t, b.level); }
    return cap;
  }
  function pop() { var p = 0; for (var i = 0; i < S.buildings.length; i++) { var b = S.buildings[i], t = BT[b.type]; if (t.pop) p += t.pop * lvlMul(t, b.level); } return p; }
  function jobs() { var j = 0; for (var i = 0; i < S.buildings.length; i++) { var t = BT[S.buildings[i].type]; if (t.jobs) j += t.jobs; } return j; }
  function lvlMul(t, lvl) { return Math.pow(t.lvlGain, (lvl || 1) - 1); }
  function buildCost(type) { var t = BT[type]; return Math.round(t.cost * Math.pow(t.costMul, countOf(type))); }
  function upCost(b) { var t = BT[b.type]; return Math.round(t.cost * 0.6 * Math.pow(t.lvlCost, b.level)); }

  // ---- core tick ----
  function tick(dt) {
    if (!S || dt <= 0) return;
    dt = Math.min(dt, 36000);                                       // safety clamp (10h max chunk)
    var cap = caps(), p = pop(), j = jobs();
    var labor = j > 0 ? clamp(p / j, 0, 1) : 1;
    var add = { fish: 0, timber: 0, goods: 0 }, money = 0;
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i], t = BT[b.type], m = lvlMul(t, b.level);
      if (t.prod) for (var r in t.prod) add[r] += t.prod[r] * m * labor * dt;
      if (t.convert) { var avail = S.res[t.convert.from] + add[t.convert.from]; var amt = Math.min(avail, t.convert.rate * m * labor * dt); add[t.convert.from] -= amt; add[t.convert.to] += amt; }
      if (t.sells) { var have = S.res[t.sells.from] + add[t.sells.from]; var sold = Math.min(have, t.sells.rate * m * labor * dt); add[t.sells.from] -= sold; money += sold * t.sells.price; }
      if (t.money) money += t.money * m * labor * dt;
    }
    for (var k in add) { S.res[k] = clamp((S.res[k] + add[k]) || 0, 0, cap[k]); }
    S.money = Math.max(0, (S.money + money) || 0);
    S.pop = p;
  }

  // ---- actions ----
  function canBuild(type) { var t = BT[type]; return !!t && S.era >= t.era && countOf(type) < t.max && S.money >= buildCost(type); }
  function build(type) { if (!canBuild(type)) return false; S.money -= buildCost(type); S.buildings.push({ type: type, level: 1 }); save(); return true; }
  function canUpgrade(i) { var b = S.buildings[i]; return !!b && b.level < BT[b.type].max && S.money >= upCost(b); }
  function upgrade(i) { if (!canUpgrade(i)) return false; var b = S.buildings[i]; S.money -= upCost(b); b.level++; save(); return true; }

  function canAdvance() {
    if (S.era >= ERAS.length - 1) return false;
    var req = ERA_REQ[S.era]; if (!req) return false;
    if (S.money < req.money) return false;
    if (req.need) { var c = counts(); for (var k in req.need) if ((c[k] || 0) < req.need[k]) return false; }
    return true;
  }
  function advanceEra() { if (!canAdvance()) return false; S.era++; save(); return true; }

  // ---- persistence + offline ----
  function key() { return 'sim'; }
  function save() { if (R) R.set('harbor', key(), S); }
  function load() {
    var d = R && R.get('harbor', key(), null);
    if (d && d.buildings) { S = d; if (!S.res) S.res = { fish: 0, timber: 0, goods: 0 }; }
    else S = fresh();
    return S;
  }
  function applyOffline(maxSec) {
    if (!S) return 0;
    var elapsed = (now() - (S.lastSeen || now())) / 1000;
    elapsed = clamp(elapsed, 0, maxSec || 8 * 3600);
    if (elapsed > 1) tick(elapsed);
    S.lastSeen = now();
    return elapsed;
  }

  function snapshot() {
    return {
      era: S.era, eraName: ERAS[S.era], money: Math.floor(S.money),
      res: { fish: Math.floor(S.res.fish), timber: Math.floor(S.res.timber), goods: Math.floor(S.res.goods) },
      caps: caps(), pop: Math.floor(pop()), jobs: jobs(),
      buildings: S.buildings.map(function (b, i) { return { i: i, type: b.type, name: BT[b.type].name, level: b.level, up: upCost(b) }; }),
      counts: counts(), canAdvance: canAdvance(), nextEra: ERAS[S.era + 1] || null, founded: S.founded
    };
  }

  g.HARBOR_SIM = {
    BT: BT, ERAS: ERAS, ERA_REQ: ERA_REQ,
    newGame: function () { S = fresh(); save(); return snapshot(); },
    load: function () { load(); return snapshot(); },
    state: function () { return S ? snapshot() : null; },
    raw: function () { return S; },
    tick: function (dt) { tick(dt); },
    build: build, canBuild: canBuild, buildCost: buildCost,
    upgrade: upgrade, canUpgrade: canUpgrade, upCost: function (i) { return upCost(S.buildings[i]); },
    canAdvance: canAdvance, advanceEra: advanceEra,
    setFounded: function (v) { if (S) { S.founded = !!v; save(); } },
    setEra: function (n) { if (S) { S.era = clamp(n | 0, 0, ERAS.length - 1); save(); } },
    save: save, applyOffline: applyOffline, mark: function () { if (S) { S.lastSeen = now(); save(); } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
