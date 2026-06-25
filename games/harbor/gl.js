/* HARBOR — hand-rolled WebGL2 micro-engine (zero dependency).
 * window.HGL = { mat4, vec3, geom, createEngine(gl) }
 *
 * Provides: column-major mat4/vec3 math, box/plane geometry, a directional sun with a
 * PCF shadow map, hemisphere ambient, distance fog and ACES tonemapping, an animated
 * fresnel water plane, a sky gradient, and a simple object renderer. No instancing yet
 * (object counts are small); added in a later phase for perf.
 */
(function (global) {
  'use strict';

  // ---------------- mat4 (column-major) ----------------
  var mat4 = {
    create: function () { var o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    identity: function (o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    clone: function (a) { return new Float32Array(a); },
    mul: function (o, a, b) {
      var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      for (var i = 0; i < 4; i++) {
        var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
        o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      }
      return o;
    },
    perspective: function (o, fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o.fill(0); o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
      return o;
    },
    ortho: function (o, l, r, b, t, n, f) {
      var lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
      o.fill(0); o[0] = -2 * lr; o[5] = -2 * bt; o[10] = 2 * nf;
      o[12] = (l + r) * lr; o[13] = (t + b) * bt; o[14] = (f + n) * nf; o[15] = 1; return o;
    },
    lookAt: function (o, eye, center, up) {
      var z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
      var zl = Math.hypot(z0, z1, z2) || 1; z0 /= zl; z1 /= zl; z2 /= zl;
      var x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
      var xl = Math.hypot(x0, x1, x2) || 1; x0 /= xl; x1 /= xl; x2 /= xl;
      var y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
      o[0] = x0; o[1] = y0; o[2] = z0; o[3] = 0; o[4] = x1; o[5] = y1; o[6] = z1; o[7] = 0;
      o[8] = x2; o[9] = y2; o[10] = z2; o[11] = 0;
      o[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
      o[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
      o[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]); o[15] = 1; return o;
    },
    compose: function (o, tx, ty, tz, sx, sy, sz, ry) {
      // translate * rotateY * scale  (enough for our props)
      var c = Math.cos(ry || 0), s = Math.sin(ry || 0);
      o[0] = c * sx; o[1] = 0; o[2] = -s * sx; o[3] = 0;
      o[4] = 0; o[5] = sy; o[6] = 0; o[7] = 0;
      o[8] = s * sz; o[9] = 0; o[10] = c * sz; o[11] = 0;
      o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1; return o;
    }
  };

  // ---------------- geometry ----------------
  // box centered on x/z, resting on y=0..h by default (origin at base center)
  function box(w, h, d) {
    var x = w / 2, z = d / 2, P = [], N = [], U = [], I = [];
    function face(verts, nx, ny, nz) {
      var b = P.length / 3;
      for (var i = 0; i < 4; i++) { P.push(verts[i][0], verts[i][1], verts[i][2]); N.push(nx, ny, nz); }
      U.push(0, 0, 1, 0, 1, 1, 0, 1);
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    face([[-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z]], 0, 0, 1);   // +z
    face([[x, 0, -z], [-x, 0, -z], [-x, h, -z], [x, h, -z]], 0, 0, -1); // -z
    face([[x, 0, z], [x, 0, -z], [x, h, -z], [x, h, z]], 1, 0, 0);   // +x
    face([[-x, 0, -z], [-x, 0, z], [-x, h, z], [-x, h, -z]], -1, 0, 0); // -x
    face([[-x, h, z], [x, h, z], [x, h, -z], [-x, h, -z]], 0, 1, 0);   // top
    face([[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]], 0, -1, 0);  // bottom
    return { positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(U), indices: new Uint16Array(I) };
  }
  function plane(size, seg) {
    var P = [], N = [], U = [], I = [], s = seg || 1, h = size / 2;
    for (var j = 0; j <= s; j++) for (var i = 0; i <= s; i++) {
      P.push(-h + size * i / s, 0, -h + size * j / s); N.push(0, 1, 0); U.push(i / s, j / s);
    }
    for (j = 0; j < s; j++) for (i = 0; i < s; i++) {
      var a = j * (s + 1) + i, b = a + 1, c = a + (s + 1), d = c + 1;
      I.push(a, c, b, b, c, d);
    }
    return { positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(U), indices: new Uint16Array(I) };
  }

  // ---------------- shaders ----------------
  var V_MAIN = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aN; layout(location=2) in vec2 aUV;
  uniform mat4 uVP, uModel, uLightVP;
  out vec3 vN; out vec3 vW; out vec2 vUV; out vec4 vLP;
  void main(){ vec4 wp=uModel*vec4(aPos,1.0); vW=wp.xyz; vN=mat3(uModel)*aN; vUV=aUV; vLP=uLightVP*wp; gl_Position=uVP*wp; }`;

  var F_MAIN = `#version 300 es
  precision highp float;
  in vec3 vN; in vec3 vW; in vec2 vUV; in vec4 vLP;
  uniform vec3 uSunDir, uSunCol, uAmbTop, uAmbBot, uCam, uFog, uBase, uEmiss;
  uniform float uFogD, uRough, uTexMix, uShadowOn;
  uniform sampler2D uShadow; uniform sampler2D uTex;
  out vec4 frag;
  float shadow(vec4 lp){
    if(uShadowOn<0.5) return 1.0;
    vec3 p=lp.xyz/lp.w*0.5+0.5;
    if(p.z>1.0||p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0) return 1.0;
    float bias=0.0016; float s=0.0; vec2 tx=vec2(1.0/2048.0);
    for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
      float d=texture(uShadow,p.xy+vec2(float(x),float(y))*tx).r;
      s+=(p.z-bias>d)?0.0:1.0;
    }
    return s/9.0;
  }
  vec3 aces(vec3 x){ float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
  void main(){
    vec3 N=normalize(vN);
    vec3 base=uBase;
    if(uTexMix>0.0){ vec3 t=texture(uTex,vUV).rgb; base=mix(base,base*(0.6+0.8*t.r),uTexMix); }
    float ndl=max(dot(N,uSunDir),0.0);
    float sh=shadow(vLP);
    vec3 amb=mix(uAmbBot,uAmbTop,N.y*0.5+0.5);
    vec3 V=normalize(uCam-vW); vec3 H=normalize(uSunDir+V);
    float spec=pow(max(dot(N,H),0.0), mix(4.0,64.0,1.0-uRough))*(1.0-uRough)*sh*ndl;
    vec3 col = base*(amb + uSunCol*ndl*sh) + uSunCol*spec*0.6 + uEmiss;
    float dist=length(uCam-vW); float f=1.0-exp(-uFogD*dist);
    col=mix(col,uFog,clamp(f,0.0,1.0));
    frag=vec4(aces(col*1.28),1.0);
  }`;

  var V_DEPTH = `#version 300 es
  layout(location=0) in vec3 aPos; uniform mat4 uLightVP, uModel;
  void main(){ gl_Position=uLightVP*uModel*vec4(aPos,1.0); }`;
  var F_DEPTH = `#version 300 es
  precision highp float; void main(){}`;

  var V_SKY = `#version 300 es
  layout(location=0) in vec3 aPos; out vec2 vUv;
  void main(){ vUv=aPos.xy*0.5+0.5; gl_Position=vec4(aPos.xy,0.999,1.0); }`;
  var F_SKY = `#version 300 es
  precision highp float; in vec2 vUv; uniform vec3 uTop,uBot,uSunCol; uniform vec2 uSun; out vec4 frag;
  void main(){ vec3 c=mix(uBot,uTop,pow(vUv.y,0.8));
    float d=distance(vUv,uSun); c+=uSunCol*smoothstep(0.045,0.0,d)*1.3; c+=uSunCol*smoothstep(0.26,0.02,d)*0.12;
    frag=vec4(c,1.0); }`;

  var V_WATER = `#version 300 es
  layout(location=0) in vec3 aPos;
  uniform mat4 uVP; uniform float uTime; out vec3 vW; out vec3 vN;
  void main(){
    vec3 p=aPos; float t=uTime;
    float h=sin(p.x*0.18+t*1.1)*0.10 + sin(p.z*0.23-t*0.9)*0.09 + sin((p.x+p.z)*0.4+t*1.7)*0.04;
    p.y+=h;
    float dx=cos(p.x*0.18+t*1.1)*0.18*0.10 + cos((p.x+p.z)*0.4+t*1.7)*0.4*0.04;
    float dz=cos(p.z*0.23-t*0.9)*0.23*0.09 + cos((p.x+p.z)*0.4+t*1.7)*0.4*0.04;
    vN=normalize(vec3(-dx,1.0,-dz)); vW=p; gl_Position=uVP*vec4(p,1.0);
  }`;
  var F_WATER = `#version 300 es
  precision highp float; in vec3 vW; in vec3 vN;
  uniform vec3 uCam,uSunDir,uSunCol,uDeep,uShallow,uSky,uFog; uniform float uFogD;
  out vec4 frag;
  vec3 aces(vec3 x){ float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
  void main(){
    vec3 N=normalize(vN); vec3 V=normalize(uCam-vW);
    float fres=pow(1.0-max(dot(N,V),0.0),3.0);
    vec3 water=mix(uDeep,uShallow,clamp(N.y*0.5+0.3,0.0,1.0));
    vec3 col=mix(water,uSky,clamp(fres*0.9,0.0,1.0));
    vec3 H=normalize(uSunDir+V); float spec=pow(max(dot(N,H),0.0),200.0);
    col+=uSunCol*spec*1.6;
    float dist=length(uCam-vW); float f=1.0-exp(-uFogD*dist); col=mix(col,uFog,clamp(f,0.0,1.0));
    frag=vec4(aces(col*1.2),1.0);
  }`;

  // ---------------- engine ----------------
  function createEngine(gl) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src);
      return s;
    }
    function prog(vs, fs) {
      var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
      var u = {}; var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
      return { p: p, u: u };
    }
    function mesh(data) {
      var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      function buf(arr, loc, size) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); }
      buf(data.positions, 0, 3); if (data.normals) buf(data.normals, 1, 3); if (data.uvs) buf(data.uvs, 2, 2);
      var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return { vao: vao, count: data.indices.length };
    }
    function texture(canvas) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }
    // shadow framebuffer (depth texture)
    var SH = 2048;
    var shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SH, SH, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var shadowFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    var P_main = prog(V_MAIN, F_MAIN), P_depth = prog(V_DEPTH, F_DEPTH), P_sky = prog(V_SKY, F_SKY), P_water = prog(V_WATER, F_WATER);
    var quad = mesh({ positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]) });

    return {
      gl: gl, mat4: mat4, box: box, plane: plane, mesh: mesh, texture: texture,
      SH: SH, shadowFB: shadowFB, shadowTex: shadowTex,
      P_main: P_main, P_depth: P_depth, P_sky: P_sky, P_water: P_water, quad: quad
    };
  }

  global.HGL = { mat4: mat4, geom: { box: box, plane: plane }, createEngine: createEngine };
})(window);
