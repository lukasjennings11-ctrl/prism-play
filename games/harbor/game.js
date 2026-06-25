/* HARBOR — Phase 1: the 3D LOOK SLICE (WebGL2).
 * A detailed, semi-realistic port at a tilted 3/4 angle: reflective animated water,
 * a docked container ship, a working gantry crane casting real shadows, warehouses,
 * a city skyline, a lighthouse, day/night sun. Free orbit + zoom camera. No gameplay
 * yet — this sets the visual bar. Rendering is guarded so the sim/hook still load
 * headlessly (Node) without WebGL.
 */
(function () {
  'use strict';
  var GAME = 'harbor';
  var mat4 = (window.HGL && HGL.mat4);

  var canvas = document.getElementById('game');
  var loader = document.getElementById('loader');
  var clockEl = document.getElementById('clock');
  var hintEl = document.getElementById('hint');
  var wrap = document.querySelector('.board-wrap');

  var gl = null, E = null;
  try { gl = canvas.getContext('webgl2', { antialias: true, alpha: false }); } catch (e) {}

  // ---- camera (orbit) ----
  var cam = { az: 2.42, el: 0.56, dist: 122, tx: 0, ty: 6, tz: 4 };
  var CW = 0, CH = 0, DPR = 1;
  var tod = 0.66, todSpeed = 1 / 150, paused = false, clock = 0;

  function resize() {
    var bw = wrap.clientWidth || 360, bh = wrap.clientHeight || 560;
    CW = Math.max(240, bw); CH = Math.max(320, bh);
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
    canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
  }

  // ---- procedural detail texture (concrete/steel grit) ----
  function gritTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 9000; i++) {
      var v = 110 + Math.random() * 90 | 0; x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
    x.strokeStyle = 'rgba(60,60,60,.25)'; x.lineWidth = 1;
    for (i = 0; i < 8; i++) { var y = i * 32; x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); }
    return c;
  }

  // ---- scene ----
  var boxMesh, waterMesh, gritTex;
  var CONT = [[0.86, 0.28, 0.22], [0.18, 0.55, 0.74], [0.95, 0.72, 0.2], [0.24, 0.66, 0.42], [0.58, 0.36, 0.7], [0.9, 0.48, 0.58]];
  var statics = [];           // {t,s,ry,col,rough,emiss,tex,shadow}
  function add(t, s, col, o) { o = o || {}; statics.push({ t: t, s: s, ry: o.ry || 0, col: col, rough: o.rough == null ? 0.8 : o.rough, emiss: o.emiss || [0, 0, 0], tex: o.tex ? 1 : 0, shadow: o.shadow !== false }); }

  function buildScene() {
    statics = [];
    // ground / land behind the quay
    add([0, -0.5, 70], [260, 1, 120], [0.30, 0.34, 0.26], { rough: 1, shadow: false });
    // quay platform
    add([0, 0, 15], [150, 2.2, 22], [0.62, 0.62, 0.64], { rough: 0.9, tex: 1 });
    add([0, 0, 4.4], [150, 1.6, 1.2], [0.5, 0.5, 0.52], { rough: 0.9 }); // quay lip
    // bollards
    for (var bx = -60; bx <= 60; bx += 12) add([bx, 1.6, 5], [0.7, 1.2, 0.7], [0.18, 0.19, 0.2], { rough: 0.7 });

    // warehouses on the quay
    var wcol = [[0.55, 0.58, 0.62], [0.6, 0.5, 0.46], [0.5, 0.54, 0.58]];
    for (var i = 0; i < 5; i++) {
      var wx = -52 + i * 26, w = 18, d = 13, h = 9 + (i % 2) * 2;
      add([wx, 2.2, 24], [w, h, d], wcol[i % 3], { tex: 1, rough: 0.85 });
      add([wx, 2.2 + h, 24], [w + 1.2, 1.4, d + 1.2], [0.3, 0.32, 0.34], { rough: 0.9 }); // roof cap
    }
    // city skyline behind
    for (i = 0; i < 22; i++) {
      var cx = -80 + i * 7.6 + (i * 53 % 5), ch = 9 + (i * 37 % 22), cd = 9;
      var g = 0.4 + (i * 29 % 30) / 120;
      add([cx, 2, 52 + (i * 17 % 16)], [6.4, ch, cd], [g * 0.7, g * 0.75, g * 0.85], { rough: 0.9, tex: 1 });
    }
    // lighthouse at the western mole
    var lx = -70;
    add([lx, 0, 6], [9, 2.5, 9], [0.3, 0.31, 0.33]);                 // base rock
    for (i = 0; i < 5; i++) add([lx, 2.5 + i * 4, 6], [5 - i * 0.5, 4, 5 - i * 0.5], i % 2 ? [0.85, 0.85, 0.87] : [0.7, 0.2, 0.17]);
    add([lx, 22.5, 6], [3.2, 2.6, 3.2], [0.15, 0.16, 0.18]);          // lamp housing
    add([lx, 23, 6], [1.6, 1.6, 1.6], [0, 0, 0], { emiss: [1.2, 1.0, 0.5], shadow: false });

    // ---- the docked container ship (hull dips into the water at z<5) ----
    var sx0 = 0;          // ship center x
    add([sx0, -3.4, -6], [62, 5.6, 16], [0.16, 0.2, 0.26], { rough: 0.6, tex: 1, shadow: true });   // hull
    add([sx0, -1.2, -6], [62.4, 0.8, 16.2], [0.7, 0.2, 0.17], { rough: 0.5 });                       // boot stripe
    // container stacks on deck (deck top ~ y=2.2) — two rows across the beam
    var rng = 7, ci = 0;
    for (var cxi = -26; cxi <= 24; cxi += 5.2) {
      for (var row = -1; row <= 1; row += 2) {
        var stk = 1 + ((rng = (rng * 9301 + 49297) % 233280) / 233280 * 3 | 0);
        for (var r = 0; r < stk; r++) {
          add([sx0 + cxi, 2.2 + r * 2.4, -6 + row * 3.6], [4.8, 2.3, 6.4], CONT[(ci + r) % CONT.length], { rough: 0.7 });
        }
        ci++;
      }
    }
    // superstructure + funnel at stern (+x)
    add([sx0 + 26, 2.2, -6], [7, 8, 13], [0.9, 0.92, 0.93], { rough: 0.5 });
    add([sx0 + 27, 10.2, -6], [3, 4, 4], [0.2, 0.22, 0.24], { rough: 0.5 });
    add([sx0 + 27, 10.2, -6], [3.1, 1.2, 4.1], [0.75, 0.2, 0.17]);
  }

  // gantry crane (animated) — returns dynamic draw entries each frame
  function craneEntries() {
    var out = [], baseX = 0, h = 30, boomZ0 = 5, boomZ1 = -16;
    function E2(t, s, col, o) { o = o || {}; out.push({ t: t, s: s, ry: 0, col: col, rough: o.rough == null ? 0.5 : o.rough, emiss: o.emiss || [0, 0, 0], tex: 0, shadow: o.shadow !== false }); }
    var col = [0.93, 0.72, 0.16];
    // 4 legs
    var lx = [baseX - 11, baseX + 11], lz = [4, -14];
    for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) E2([lx[a], 0, lz[b]], [2.4, h, 2.4], col);
    // sill beams along z (joining front/back legs) at each x
    E2([lx[0], h, -5], [2.6, 2.4, 22], col); E2([lx[1], h, -5], [2.6, 2.4, 22], col);
    // portal beams across x (joining both sides) front & back
    E2([baseX, h, 4], [24, 2.4, 2.6], col); E2([baseX, h, -14], [24, 2.4, 2.6], col);
    // mid cross-ties for a trussed look
    E2([baseX, h * 0.5, 4], [24, 1.5, 1.5], col); E2([baseX, h * 0.5, -14], [24, 1.5, 1.5], col);
    // twin booms reaching across x over the ship
    E2([baseX, h + 1.9, boomZ1 + 2], [30, 2.6, 3.0], col);
    E2([baseX, h + 1.9, boomZ0], [30, 2.6, 3.0], col);
    // machinery house on the gantry top
    E2([baseX - 7, h + 2.4, -5], [7, 4.5, 9], [0.22, 0.24, 0.27], { rough: 0.5 });
    // working trolley + spreader cycle
    var ph = (clock * 0.16) % 1, carrying = ph > 0.34 && ph < 0.86, tz, drop;
    if (ph < 0.15) { tz = lerp(boomZ0, boomZ1, ph / 0.15); drop = 2; }
    else if (ph < 0.30) { tz = boomZ1; drop = lerp(2, 26, (ph - 0.15) / 0.15); }
    else if (ph < 0.36) { tz = boomZ1; drop = 26; }
    else if (ph < 0.52) { tz = boomZ1; drop = lerp(26, 2, (ph - 0.36) / 0.16); }
    else if (ph < 0.70) { tz = lerp(boomZ1, boomZ0, (ph - 0.52) / 0.18); drop = 2; }
    else if (ph < 0.84) { tz = boomZ0; drop = lerp(2, 22, (ph - 0.70) / 0.14); }
    else { tz = boomZ0; drop = lerp(22, 2, (ph - 0.84) / 0.16); }
    E2([baseX, h + 1.5, tz], [6, 1.4, 4], [0.8, 0.5, 0.12]);                       // trolley
    E2([baseX, h + 1.5 - drop, tz], [5, 0.8, 4.4], [0.12, 0.13, 0.15]);            // spreader
    if (carrying) E2([baseX, h + 0.5 - drop, tz], [4.6, 2.2, 4.2], CONT[(clock | 0) % CONT.length]);
    return out;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- day/night ----
  function skyCols() {
    // simple keyframe: 0 night, .25 dawn, .5 day, .75 dusk
    var d = Math.cos(tod * Math.PI * 2);           // 1 at midnight, -1 at noon
    var day = (1 - d) * 0.5;                        // 0 night .. 1 noon
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    var nightTop = [0.04, 0.06, 0.13], dayTop = [0.30, 0.52, 0.82];
    var nightBot = [0.08, 0.10, 0.18], dayBot = [0.66, 0.78, 0.90];
    var top = mix(nightTop, dayTop, day), bot = mix(nightBot, dayBot, day);
    // dawn/dusk warm tint near horizon when sun low
    var warm = Math.max(0, 1 - Math.abs(d) * 1.4) * (tod < 0.5 ? 1 : 1);
    bot = mix(bot, [1.0, 0.55, 0.3], warm * 0.5);
    var sunCol = mix([0.25, 0.3, 0.55], [1.15, 1.04, 0.86], day);
    return { top: top, bot: bot, sunCol: sunCol, day: day, warm: warm };
  }
  function sunDir() {
    var ang = (tod - 0.25) * Math.PI * 2;           // noon = up
    var e = Math.sin(ang) * 0.9 + 0.12;
    var y = Math.max(0.06, e);
    return norm([Math.cos(ang) * 0.7, y, 0.45]);
  }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  // ---- render ----
  function eye() {
    var ce = Math.cos(cam.el), se = Math.sin(cam.el), ca = Math.cos(cam.az), sa = Math.sin(cam.az);
    return [cam.tx + cam.dist * ce * sa, cam.ty + cam.dist * se, cam.tz + cam.dist * ce * ca];
  }
  var mView = mat4 && mat4.create(), mProj = mat4 && mat4.create(), mVP = mat4 && mat4.create(),
    mLightV = mat4 && mat4.create(), mLightP = mat4 && mat4.create(), mLightVP = mat4 && mat4.create(), mModel = mat4 && mat4.create();

  function setU(P, name, v) { var l = P.u[name]; if (l) gl.uniform3fv(l, v); }
  function drawList(P, list, depthOnly) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (depthOnly && o.shadow === false) continue;
      mat4.compose(mModel, o.t[0], o.t[1], o.t[2], o.s[0], o.s[1], o.s[2], o.ry);
      gl.uniformMatrix4fv(P.u.uModel, false, mModel);
      if (!depthOnly) {
        gl.uniform3fv(P.u.uBase, o.col); gl.uniform1f(P.u.uRough, o.rough);
        gl.uniform3fv(P.u.uEmiss, o.emiss); gl.uniform1f(P.u.uTexMix, o.tex);
      }
      gl.bindVertexArray(boxMesh.vao); gl.drawElements(gl.TRIANGLES, boxMesh.count, gl.UNSIGNED_SHORT, 0);
    }
  }

  function render() {
    if (!gl) return;
    var sky = skyCols(), sd = sunDir(), ev = eye();
    var target = [cam.tx, cam.ty, cam.tz];
    var dyn = craneEntries(), all = statics.concat(dyn);

    // shadow pass
    var sunPos = [target[0] + sd[0] * 80, target[1] + sd[1] * 80, target[2] + sd[2] * 80];
    mat4.lookAt(mLightV, sunPos, target, [0, 1, 0]);
    mat4.ortho(mLightP, -95, 95, -95, 95, 1, 220);
    mat4.mul(mLightVP, mLightP, mLightV);
    gl.bindFramebuffer(gl.FRAMEBUFFER, E.shadowFB);
    gl.viewport(0, 0, E.SH, E.SH); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
    gl.useProgram(E.P_depth.p); gl.uniformMatrix4fv(E.P_depth.u.uLightVP, false, mLightVP);
    drawList(E.P_depth, all, true);
    gl.cullFace(gl.BACK);

    // main pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(sky.bot[0], sky.bot[1], sky.bot[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    mat4.perspective(mProj, 0.85, canvas.width / canvas.height, 0.5, 600);
    mat4.lookAt(mView, ev, target, [0, 1, 0]); mat4.mul(mVP, mProj, mView);

    // sky
    gl.depthMask(false); gl.disable(gl.CULL_FACE);
    var S = E.P_sky; gl.useProgram(S.p);
    setU(S, 'uTop', sky.top); setU(S, 'uBot', sky.bot); setU(S, 'uSunCol', sky.sunCol);
    var sunScreen = [0.5 + sd[0] * 0.4, 0.35 + sd[1] * 0.5];
    if (S.u.uSun) gl.uniform2fv(S.u.uSun, sunScreen);
    gl.bindVertexArray(E.quad.vao); gl.drawElements(gl.TRIANGLES, E.quad.count, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true); gl.enable(gl.CULL_FACE);

    // scene
    var M = E.P_main; gl.useProgram(M.p);
    gl.uniformMatrix4fv(M.u.uVP, false, mVP); gl.uniformMatrix4fv(M.u.uLightVP, false, mLightVP);
    setU(M, 'uSunDir', sd); setU(M, 'uSunCol', sky.sunCol);
    setU(M, 'uAmbTop', [0.4 * (0.3 + sky.day), 0.45 * (0.3 + sky.day), 0.6 * (0.3 + sky.day)]);
    setU(M, 'uAmbBot', [0.12, 0.13, 0.15]);
    setU(M, 'uCam', ev); setU(M, 'uFog', sky.bot); gl.uniform1f(M.u.uFogD, 0.0026);
    gl.uniform1f(M.u.uShadowOn, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, E.shadowTex); if (M.u.uShadow) gl.uniform1i(M.u.uShadow, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, gritTex); if (M.u.uTex) gl.uniform1i(M.u.uTex, 1);
    drawList(M, all, false);

    // water
    var W = E.P_water; gl.useProgram(W.p);
    gl.uniformMatrix4fv(W.u.uVP, false, mVP); gl.uniform1f(W.u.uTime, clock);
    setU(W, 'uCam', ev); setU(W, 'uSunDir', sd); setU(W, 'uSunCol', sky.sunCol);
    setU(W, 'uDeep', [0.015, 0.07, 0.11]); setU(W, 'uShallow', [0.04, 0.16, 0.2]);
    setU(W, 'uSky', sky.bot); setU(W, 'uFog', sky.bot); gl.uniform1f(W.u.uFogD, 0.0026);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(waterMesh.vao); gl.drawElements(gl.TRIANGLES, waterMesh.count, gl.UNSIGNED_SHORT, 0);
    gl.enable(gl.CULL_FACE);
  }

  // ---- input: orbit + zoom ----
  var drag = false, lx = 0, ly = 0, pinch = 0;
  function pt(e) { var b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left), y: (e.clientY - b.top) }; }
  if (canvas.addEventListener) {
    canvas.addEventListener('pointerdown', function (e) { drag = true; var p = pt(e); lx = p.x; ly = p.y; });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return; var p = pt(e); var dx = p.x - lx, dy = p.y - ly; lx = p.x; ly = p.y;
      cam.az -= dx * 0.006; cam.el = clamp(cam.el - dy * 0.005, 0.16, 1.25);
      if (hintEl) hintEl.classList.add('gone');
    });
    window.addEventListener('pointerup', function () { drag = false; });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + e.deltaY * 0.0012), 45, 190); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinch) cam.dist = clamp(cam.dist * (pinch / d), 45, 190); pinch = d;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', function () { pinch = 0; });
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---- loop ----
  function frame(now) {
    var dt = Math.min(0.05, (now - (frame._l || now)) / 1000); frame._l = now;
    clock += dt; if (!paused) tod = (tod + dt * todSpeed) % 1;
    if (clockEl) { var hh = Math.floor(tod * 24), mm = Math.floor((tod * 24 % 1) * 60); clockEl.textContent = ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2); }
    render();
    requestAnimationFrame(frame);
  }

  function boot() {
    if (window.Portal) Portal.loadingStart();
    if (!gl) { if (loader) loader.innerHTML = '<div style="color:#fff;font-family:sans-serif;padding:20px;text-align:center">WebGL2 is required to play HARBOR.</div>'; return; }
    E = HGL.createEngine(gl);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    boxMesh = E.mesh(E.box(1, 1, 1)); waterMesh = E.mesh(E.plane(360, 140)); gritTex = E.texture(gritTexture());
    buildScene();
    resize();
    try { var q = window.location.search; var mt = /[?&]tod=([0-9.]+)/.exec(q); if (mt) tod = +mt[1] % 1;
      var ma = /[?&]az=(-?[0-9.]+)/.exec(q); if (ma) cam.az = +ma[1];
      var me = /[?&]el=([0-9.]+)/.exec(q); if (me) cam.el = +me[1];
      var md = /[?&]dist=([0-9.]+)/.exec(q); if (md) cam.dist = +md[1];
      if (/[?&]still\b/.test(q)) paused = true; } catch (e) {}
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
    if (window.Portal) Portal.init().then(function () {
      Portal.loadingStop(); if (loader) loader.classList.add('hidden'); Portal.gameStart();
    });
  }

  // ---- headless hook (sim grows here later; renderer-guarded) ----
  window.__harbor = {
    state: function () { return { tod: Math.round(tod * 1000) / 1000, cam: { az: cam.az, el: cam.el, dist: cam.dist }, webgl: !!gl, phase: 'look-slice-3d' }; },
    setTod: function (t) { tod = t % 1; }, pause: function (p) { paused = !!p; },
    setCam: function (o) { for (var k in o) cam[k] = o[k]; }
  };

  if (canvas && canvas.getContext) boot();
})();
