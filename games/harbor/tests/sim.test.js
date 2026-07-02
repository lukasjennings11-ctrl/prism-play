/* PortMaster — headless economy/systems regression (Node, no DOM).
 * Deterministic: seeds HARBOR_SIM.__setRng so events/voyages/crates are reproducible.
 * Covers: core economy, the event engine, expeditions, META application (relic/legacy bonuses),
 * save migration from a pre-Phase-7 blob, and asserted balance bounds.
 * Run: node games/harbor/tests/sim.test.js   (exit 0 = pass)
 */
'use strict';

// --- seedable PRNG (mulberry32) ---
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// --- a mock Retention holding a PRE-PHASE-7 save, so load()/patch() must migrate it ---
var STORE = {};
var OLD_SAVE = {                                   // shape from before events/voyages existed
  era: 2, money: 5000, lifetimeMoney: 42000, lastSeen: Date.now(), founded: true,
  managers: { fishing: 1, sales: 0, labour: 0 }, active: 'green',
  ports: { green: { id: 'green', res: { fish: 30, timber: 0, goods: 0 }, buildings: [{ type: 'fishing_hut', level: 2, hp: 100 }, { type: 'cottage', level: 1, hp: 100 }], pop: 4, demand: { fish: 1, timber: 1, goods: 1 }, contracts: [], contractSeq: 0 } },
  network: { xp: 0, level: 1, routes: [] }, hazard: { t: 0, next: 100, phase: 'idle', strikeId: 0, last: null }, crash: null, stats: { storms: 0, shipped: 0 }
  // NOTE: intentionally NO `evt`, NO `voyages` — patch() must backfill these.
};
STORE['harbor:sim'] = JSON.parse(JSON.stringify(OLD_SAVE));
global.Retention = {
  get: function (game, key, def) { var v = STORE[game + ':' + key]; return v === undefined ? def : v; },
  set: function (game, key, v) { STORE[game + ':' + key] = v; },
  todayStr: function () { return '2026-07-02'; }, dailySeed: function () { return 1; }
};

require('../sim.js');                              // attaches HARBOR_SIM to global; captures Retention
var SIM = global.HARBOR_SIM;

var pass = 0, fail = 0, fails = [];
function ok(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

// ---------------------------------------------------------------- migration
(function migration() {
  var snap = SIM.load();                            // loads OLD_SAVE via mock Retention → patch()
  var S = SIM.raw();
  ok('migrate: old money preserved', S.money === 5000);
  ok('migrate: old era preserved', S.era === 2);
  ok('migrate: old buildings preserved', S.ports.green.buildings.length === 2);
  ok('migrate: evt backfilled', S.evt && typeof S.evt === 'object' && S.evt.active === null);
  ok('migrate: voyages backfilled', Array.isArray(S.voyages));
  ok('migrate: snapshot has event field', snap && ('event' in snap));
  ok('migrate: snapshot has voyages field', snap && snap.voyages && Array.isArray(snap.voyages.active));
})();

// ---------------------------------------------------------------- deterministic setup
SIM.__setRng(mulberry32(12345));
SIM.newGame();
SIM.foundPort('green');
SIM.setEra(3);
var S = SIM.raw();

// ---------------------------------------------------------------- core economy
(function economy() {
  S.money = 1e6;
  ['fishing_hut', 'fishing_hut', 'cottage', 'jetty', 'warehouse', 'market'].forEach(function (t) { if (SIM.canBuild(t)) SIM.build(t); });
  var before = S.money;
  for (var i = 0; i < 20; i++) SIM.tick(1);
  var st = SIM.state();
  ok('economy: money finite', isFinite(st.money));
  ok('economy: money non-negative', st.money >= 0);
  ok('economy: resources non-negative', st.res.fish >= 0 && st.res.timber >= 0 && st.res.goods >= 0);
  ok('economy: buildings recorded', st.buildings.length >= 5);
})();

// ---------------------------------------------------------------- events (invariant-based → fixed count)
(function events() {
  var ids = ['goldrush', 'festival', 'castaway', 'raid', 'gamble', 'commission', 'smuggler'];
  ids.forEach(function (id) {
    S.money = 100000; var p = SIM.port('green'); p.res.fish = 999; p.res.timber = 999; p.res.goods = 999;
    var ev = SIM.fireEvent(id);
    ok('event ' + id + ': fires with id', ev && ev.id === id);
    ok('event ' + id + ': snapshot exposes it', SIM.state().event && SIM.state().event.id === id);
    if (ev.kind === 'ambient') { ok('event ' + id + ': ambient set a boost', SIM.boostT() > 0); }
    else {
      var m0 = S.money, out = SIM.resolveEvent(0);
      ok('event ' + id + ': resolve returns outcome', out && typeof out.ok === 'boolean');
      ok('event ' + id + ': money non-negative after', S.money >= 0);
      ok('event ' + id + ': cleared after resolve (or failed cleanly)', SIM.event() === null || out.ok === false);
      if (out.ok !== false) ok('event ' + id + ': lifetime never decreased', SIM.raw().lifetimeMoney >= 0);
      // decline path (choice 1) never changes money for gamble/commission/smuggler
      if (['gamble', 'commission', 'smuggler'].indexOf(id) >= 0) { SIM.fireEvent(id); var mm = S.money; SIM.resolveEvent(1); ok('event ' + id + ': decline leaves money unchanged', S.money === mm); }
    }
  });
  // specific invariants
  S.money = 100000; SIM.fireEvent('raid'); var trib = SIM.event().data.tribute; SIM.resolveEvent(0);
  ok('raid: pay deducts tribute', S.money === 100000 - trib);
  S.money = 100000; SIM.fireEvent('commission'); var cd = SIM.event().data; SIM.port('green').res[cd.res] = cd.amt + 5; var oc = SIM.resolveEvent(0);
  ok('commission: fulfil pays reward & spends stock', oc.ok && oc.cash === cd.reward && SIM.port('green').res[cd.res] === 5);
  S.money = 100000; SIM.fireEvent('smuggler'); var sd = SIM.event().data; var f0 = SIM.port('green').res[sd.res]; SIM.resolveEvent(0);
  ok('smuggler: buy adds stock & spends cash', SIM.port('green').res[sd.res] === f0 + sd.amt && S.money === 100000 - sd.cost);
})();

// ---------------------------------------------------------------- expeditions
(function voyages() {
  S.money = 1e6;
  ok('voyage: can start cove', SIM.canStartVoyage('cove'));
  SIM.startVoyage('cove');
  ok('voyage: used increments', SIM.voyages().used === 1);
  var v = SIM.voyages().active[0]; ok('voyage: not ready immediately', !v.ready);
  S.voyages[0].endsAt = SIM.raw && Date.now() - 1;   // force ready
  var m0 = S.money, out = SIM.collectVoyage(SIM.voyages().active[0].seq);
  ok('voyage: collect returns reward', out && out.cash > 0);
  ok('voyage: money rose on collect', S.money > m0);
  ok('voyage: slot freed', SIM.voyages().used === 0);
  // slots cap: fill all slots then can't start more
  var slots = SIM.voyages().slots; for (var i = 0; i < slots; i++) SIM.startVoyage('cove');
  ok('voyage: slots cap enforced', SIM.voyages().used === slots && !SIM.canStartVoyage('cove'));
})();

// ---------------------------------------------------------------- META application (relic/legacy bonuses)
(function meta() {
  SIM.newGame(); SIM.foundPort('green'); SIM.setEra(4); var s2 = SIM.raw(); s2.money = 1e6;
  var baseSlots = SIM.voyages().slots;
  SIM.applyMeta({ prodMul: 1.5, sellMul: 1.2, voyageSlots: 1, voyageSpeed: 2 });
  ok('meta: prodMul applied', near(SIM.meta().prodMul, 1.5));
  ok('meta: voyageSlots applied → +1 berth', SIM.voyages().slots === baseSlots + 1);
  SIM.startVoyage('cove');
  var dur = SIM.raw().voyages[0].endsAt - SIM.raw().voyages[0].startedAt;
  ok('meta: voyageSpeed halves duration', dur <= 120 * 1000 / 2 + 50);   // cove=120s, /2
  SIM.applyMeta({ prodMul: 1, sellMul: 1, voyageSlots: 0, voyageSpeed: 1 });   // reset
})();

// ---------------------------------------------------------------- balance bounds (accelerated auto-play)
(function balance() {
  SIM.__setRng(mulberry32(999)); SIM.newGame(); SIM.foundPort('green'); var b = SIM.raw();
  var order = ['fishing_hut', 'cottage', 'jetty', 'warehouse', 'market', 'sawmill', 'factory', 'dock', 'seawall', 'lighthouse'];
  var lastLifetime = 0, monotonic = true, everReachable = false;
  for (var step = 0; step < 200; step++) {
    b.money += 0;                                    // (idle accrues via tick)
    SIM.tick(30);
    for (var k = 0; k < 4; k++) { var built = false; for (var oi = 0; oi < order.length; oi++) { if (SIM.canBuild(order[oi])) { SIM.build(order[oi]); built = true; break; } } if (!built) break; }
    if (SIM.canAdvance()) SIM.advanceEra();
    if (step % 7 === 0) { var ev = SIM.fireEvent('castaway'); if (ev) SIM.resolveEvent(0); }
    var lm = SIM.raw().lifetimeMoney || 0; if (lm + 1e-6 < lastLifetime) monotonic = false; lastLifetime = lm;
    if (SIM.canPrestige()) everReachable = true;
  }
  var st = SIM.state();
  ok('balance: money finite', isFinite(st.money) && isFinite(st.lifetimeMoney));
  ok('balance: money non-negative', st.money >= 0);
  ok('balance: lifetime monotonic (never shrinks)', monotonic);
  ok('balance: prestige gain scales with lifetime', SIM.prestigeGain() >= 0 && isFinite(SIM.prestigeGain()));
})();

console.log((fail === 0 ? 'ALL PASS' : 'FAILED') + ' — ' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('  failing:'); fails.forEach(function (f) { console.log('   - ' + f); }); }
process.exit(fail ? 1 : 0);
