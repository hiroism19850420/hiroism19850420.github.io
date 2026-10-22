// レンダラー、場面、光、空、雲、霧、海、遠景（第23部）。まっすぐの コース用に 直した
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CFG } from './config.js';
import { rng, lerp } from './util.js';
import { cloudTexture, waterNoiseTexture, setAniso } from './tex.js';

export const U = { time: { value: 0 }, windowSeed: { value: 0 } };   // シェーダーで共有する 時刻
// 霧を 弱める（遠景用）
export const fogWeak = k => `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${k.toFixed(2)} );
#endif`;

const SKY_VS = `
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 uTop, uHorizon, uSunDir, uSunColor; uniform float uNight, uTime, uWarm;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  float t = pow(max(h,0.0),0.55);
  vec3 col = mix(uHorizon, uTop, t);
  if (h < 0.0) col = uHorizon*0.92;
  float c = max(dot(d, normalize(uSunDir)), 0.0);
  if (uNight < 0.5) {
    col = mix(vec3(dot(col, vec3(0.3333))), col, 1.25);
    col += uSunColor*(pow(c,600.0)*4.0 + pow(c,12.0)*(0.18 + uWarm*0.25));
    col = mix(col, col*vec3(1.08,0.9,0.75), uWarm*(1.0-t)*0.6);
  } else {
    col += vec3(0.95,0.96,1.0)*(smoothstep(0.9993,0.9997,c)*1.3 + pow(c,40.0)*0.10);
    vec3 g = floor(d*90.0); float s = hash(g);
    if (s > 0.993 && h > 0.04) {
      vec3 f = fract(d*90.0)-0.5; float r = length(f);
      float tw = 0.7+0.3*sin(uTime*(1.0+s*3.0)+s*40.0);
      col += vec3(1.0)*smoothstep(0.14,0.0,r)*((s-0.993)/0.007*0.8+0.2)*tw*smoothstep(0.04,0.3,h);
    }
    col += vec3(0.48,0.35,0.72)*0.25*(1.0-smoothstep(0.0,0.15,h))*step(0.0,h);
  }
  gl_FragColor = vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 海（まっすぐの 浜。深さは 浜の 線の 式から 計算する）
const WATER_VS = `
uniform float uTime; uniform float uSurge; varying vec3 vWorld; varying vec3 vNormalW;
#include <fog_pars_vertex>
float wave(vec2 p, float t){ return 0.14*sin(p.x*0.06+t*0.9)+0.09*sin(p.y*0.08-t*1.1)+0.05*sin((p.x+p.y)*0.15+t*1.7); }
void main(){
  vec4 w = modelMatrix*vec4(position,1.0);
  float k = smoothstep(150.0, 20.0, w.x);
  w.y += wave(w.xz,uTime)*mix(1.0, 0.35, k) + uSurge*k;
  float e = 0.5;
  float dx = wave(w.xz+vec2(e,0.0),uTime)-wave(w.xz-vec2(e,0.0),uTime);
  float dz = wave(w.xz+vec2(0.0,e),uTime)-wave(w.xz-vec2(0.0,e),uTime);
  vNormalW = normalize(vec3(-dx/(2.0*e),1.0,-dz/(2.0*e)));
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix*w;
  gl_Position = projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const WATER_FS = `
uniform float uTime; uniform vec3 uShallow, uDeep, uSkyTop, uSkyHorizon, uSunDir, uSunColor;
uniform sampler2D uNoise; uniform vec4 uShoreA, uShoreB;
varying vec3 vWorld; varying vec3 vNormalW;
#include <fog_pars_fragment>
void main(){
  float s = -vWorld.z;
  float sx = uShoreA.x + uShoreA.y*sin(s/uShoreA.z) + uShoreA.w*sin(s/uShoreB.x);
  float ground = vWorld.x < sx ? uShoreB.z + (sx - vWorld.x)*0.16 : max(uShoreB.w, uShoreB.z - (vWorld.x - sx)*uShoreB.y);
  float depth = max(0.0, vWorld.y - ground);
  vec3 water = mix(uShallow, uDeep, smoothstep(0.3,7.0,depth));
  vec3 n1 = texture2D(uNoise, vWorld.xz*0.05+vec2(uTime*0.02,0.0)).rgb*2.0-1.0;
  vec3 n2 = texture2D(uNoise, vWorld.xz*0.07-vec2(0.0,uTime*0.025)).rgb*2.0-1.0;
  vec3 N = normalize(vNormalW+vec3(n1.x+n2.y,0.0,n1.y+n2.x)*0.12);
  vec3 V = normalize(cameraPosition-vWorld);
  float fres = 0.04+0.96*pow(1.0-max(dot(N,V),0.0),5.0);
  vec3 R = reflect(-V,N);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(max(R.y,0.0),0.55));
  vec3 col = mix(water, sky, fres*0.6);
  col += uSunColor*pow(max(dot(R,normalize(uSunDir)),0.0),220.0)*3.0;
  float f = smoothstep(0.3,0.0,depth)*smoothstep(0.55,0.95,0.5+0.5*sin(depth*26.0-uTime*2.2+n2.x*2.0))*0.75;
  f *= 0.55+0.45*n1.z;
  f += smoothstep(0.07,0.0,depth)*0.55;
  col = mix(col, vec3(1.0), clamp(f,0.0,0.85));
  float alpha = mix(0.28,0.94,smoothstep(0.0,1.6,depth));
  gl_FragColor = vec4(col,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export const World = {
  renderer: null, scene: null, camera: null, sun: null, hemi: null, sky: null,
  quality: 'mid', clouds: null, water: null, far: null, course: null,

  init(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    setAniso(r.capabilities.getMaxAnisotropy());
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, CFG.cam.NEAR, CFG.cam.FAR);
    const pm = new THREE.PMREMGenerator(r);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this.envTex;
    scene.environmentIntensity = 0.6;
    pm.dispose();
    this.hemi = new THREE.HemisphereLight(0xcfe9ff, 0x5a8f3a, 1.1);
    scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff3d6, 2.6);
    sun.castShadow = true;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
    scene.add(sun, sun.target);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 1, 1) }, uNight: { value: 0 }, uTime: U.time, uWarm: { value: 0 } }
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), this.skyMat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    scene.add(this.sky);
    scene.fog = new THREE.FogExp2(0xcfe9ff, 0.0026);
    this.cloudTex = [1, 2, 3].map(cloudTexture);
    this.waterNoise = waterNoiseTexture();
    this.resize();
    addEventListener('resize', () => this.resize());
  },

  setQuality(q) {
    this.quality = q;
    const Q = CFG.quality[q];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pr));
    const on = Q.shadow > 0;
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    if (on) {
      this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      const b = Q.shadowBox, cam = this.sun.shadow.camera;
      cam.left = -b; cam.right = b; cam.top = b; cam.bottom = -b; cam.near = 1; cam.far = 300;
      cam.updateProjectionMatrix();
    }
    this.resize();
    this.scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => x.needsUpdate = true); } });
  },

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.portrait = h > w;
  },

  // コースの 空・光・霧
  setLook(course) {
    this.course = course;
    const s = this.skyMat.uniforms;
    s.uTop.value.set(course.sky.top); s.uHorizon.value.set(course.sky.horizon);
    s.uNight.value = course.sky.night ? 1 : 0; s.uWarm.value = 0;
    const d = new THREE.Vector3(...course.sun.dir).normalize();
    s.uSunDir.value.copy(d); s.uSunColor.value.set(course.sun.color);
    this.sunDir = d;
    this.sun.color.set(course.sun.color); this.sun.intensity = course.sun.intensity;
    this.hemi.color.set(course.hemi.sky); this.hemi.groundColor.set(course.hemi.ground); this.hemi.intensity = course.hemi.intensity;
    this.scene.fog.color.set(course.fog.color); this.scene.fog.density = course.fog.density;
    this.renderer.toneMappingExposure = course.exposure;
    this.scene.environmentIntensity = course.sky.night ? 0.25 : 0.4;
    this.baseHemi = course.hemi.intensity; this.baseSun = course.sun.intensity;
    this.baseSunColor = new THREE.Color(course.sun.color);
    document.body.style.background = course.sky.horizon;
  },
  // 最後の 直線で 夕日を 強く（ビーチ、EC.2）
  setWarm(k) {
    this.skyMat.uniforms.uWarm.value = k;
    if (this.baseSunColor) this.sun.color.copy(this.baseSunColor).lerp(new THREE.Color('#ffb070'), k * 0.5);
  },

  // 影のカメラを 追う点（ちらつかないように 影の画素に そろえる）
  followShadow(x, y, z) {
    if (!this.sun.castShadow) return;
    const Q = CFG.quality[this.quality];
    const texel = (Q.shadowBox * 2) / Q.shadow;
    const d = this.sunDir || new THREE.Vector3(0, 1, 0);
    const fx = Math.round(x / texel) * texel, fz = Math.round(z / texel) * texel, fy = Math.round(y / texel) * texel;
    this.sun.target.position.set(fx, fy, fz);
    this.sun.position.set(fx + d.x * 140, fy + d.y * 140, fz + d.z * 140);
    this.sun.target.updateMatrixWorld();
  },
  setTunnel(k) {
    this.sun.intensity = this.baseSun * (1 - k);
    this.hemi.intensity = this.baseHemi * (1 - k * 0.65);
  },

  // ---------- 雲（コースに そった 細長い 範囲） ----------
  buildClouds(n, seed = 5, L = 1000) {
    if (this.clouds) { this.scene.remove(this.clouds); this.clouds.traverse(o => o.material && o.material.dispose()); this.clouds = null; }
    if (!n) return;
    const g = this.clouds = new THREE.Group(), r = rng(seed);
    g.name = 'clouds';
    const night = this.course && this.course.sky.night;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Group();
      const s = lerp(-600, L + 1200, r()), side = r() < 0.5 ? -1 : 1;
      c.position.set(side * (150 + r() * 750), 140 + r() * 120, -s);
      const scale = 60 + r() * 70, parts = 3 + Math.floor(r() * 3);
      for (let k = 0; k < parts; k++) {
        const m = new THREE.SpriteMaterial({ map: this.cloudTex[Math.floor(r() * 3)], fog: false, depthWrite: false, transparent: true, opacity: night ? 0.25 : 0.95, color: night ? 0x6070a0 : 0xffffff });
        const sp = new THREE.Sprite(m);
        sp.scale.set(scale * (0.8 + r() * 0.5), scale * 0.5 * (0.8 + r() * 0.4), 1);
        sp.position.set((r() - 0.5) * scale * 1.2, (r() - 0.5) * scale * 0.15, (r() - 0.5) * scale * 0.6);
        c.add(sp);
      }
      g.add(c);
    }
    this.scene.add(g);
  },

  // ---------- 海（ビーチ。道の 右がわ） ----------
  buildSea(course, L) {
    this.disposeWater();
    const W = course.water; if (!W) return;
    const T = course.terrain, [a1, w1, a2, w2] = T.shoreWig;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uSurge: { value: 0 }, uShallow: { value: new THREE.Color(W.shallow) }, uDeep: { value: new THREE.Color(W.deep) },
      uSkyTop: { value: new THREE.Color(course.sky.top) }, uSkyHorizon: { value: new THREE.Color(course.sky.horizon) },
      uSunDir: { value: new THREE.Vector3(...course.sun.dir).normalize() }, uSunColor: { value: new THREE.Color(course.sun.color) },
      uNoise: { value: this.waterNoise },
      uShoreA: { value: new THREE.Vector4(T.shoreX, a1, w1, a2) }, uShoreB: { value: new THREE.Vector4(w2, T.seaSlope, W.level + 0.06, T.seaMin) }
    }]);
    uniforms.uTime = U.time;
    const sA = -900, sB = L + 1400, x0 = 2, x1 = 1600;
    const geo = new THREE.PlaneGeometry(x1 - x0, sB - sA, 220, Math.round((sB - sA) / 12)).rotateX(-Math.PI / 2);
    // 浜の 近くを こまかく（x を 二乗で 寄せる）
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + (x1 - x0) / 2) / (x1 - x0); p.setX(i, x0 + Math.pow(u, 2.2) * (x1 - x0)); p.setZ(i, p.getZ(i) - (sA + sB) / 2); }
    geo.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, uniforms, transparent: true, depthWrite: false, fog: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, W.level, 0);
    mesh.renderOrder = 2; mesh.name = 'water';
    this.water = mesh; this.surge = { t: 6, k: 0, big: 0 };
    this.scene.add(mesh);
  },
  disposeWater() {
    if (!this.water) return;
    this.scene.remove(this.water); this.water.geometry.dispose(); this.water.material.dispose();
    this.water = null;
  },

  // ---------- 遠景（コースの まわり と ゴールの 先） ----------
  buildFar(course, L) {
    if (this.far) { this.scene.remove(this.far); this.far.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    const g = this.far = new THREE.Group(); g.name = 'far';
    const f = course.far, r = rng(901 + course.no);
    const fogMat = (color, extra = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...extra });
      m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', fogWeak(0.45)); };
      return m;
    };
    // 置く 場所：両わき と ゴールの 先・スタートの 後ろ
    const spots = (n, dMin, dMax, aheadN = 3, sideOnly = 0) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const side = sideOnly || (i % 2 ? 1 : -1);
        out.push([side * (dMin + r() * (dMax - dMin)), lerp(-500, L + 700, (i + r()) / n)]);
      }
      for (let i = 0; i < aheadN; i++) out.push([lerp(-dMax * 0.8, dMax * 0.8, (i + 0.5) / aheadN) + (r() - 0.5) * 120, L + dMin + 300 + r() * (dMax - dMin)]);
      return out;
    };
    const dome = (m, x, s, rad, h, rz, y = -8) => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); mesh.scale.set(rad, h, rz); mesh.position.set(x, y, -s); g.add(mesh); };
    if (f.kind === 'hills') {
      const m = fogMat(f.color), m2 = fogMat('#8fc58a');
      for (const [x, s] of spots(f.n, 620, 1150, 4)) dome(r() < 0.5 ? m : m2, x, s, 180 + r() * 160, 50 + r() * 70, (180 + r() * 160) * (0.7 + r() * 0.5));
    } else if (f.kind === 'islands') {
      const m = fogMat('#7fb07a');
      for (let i = 0; i < f.n; i++) dome(m, 520 + r() * 500, lerp(0, L + 600, (i + r()) / f.n), 120 + r() * 90, 40 + r() * 50, 90 + r() * 60, -4);
      const land = fogMat('#a9c890');
      for (const [x, s] of spots(8, 620, 1000, 0, -1)) dome(land, x, s, 160 + r() * 120, 30 + r() * 40, 160, -6);
      // 水平線の 先にも 小さな 島
      for (let i = 0; i < 2; i++) dome(m, 200 + r() * 400, L + 900 + r() * 400, 90 + r() * 60, 25 + r() * 20, 70, -4);
    } else if (f.kind === 'snowpeaks') {
      for (const [x, s] of spots(f.n, 700, 1150, 4)) {
        const rad = 120 + r() * 140, h = 120 + r() * 160, i = Math.floor(r() * 100);
        // ConeGeometry は 高さの 分割が 2 以上だと 三角形が 半分 ぬける（r169）。先を ごく細い 円柱で 作る
        const geo = new THREE.CylinderGeometry(0.002, 1, 1, 40, 28, true);
        const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
        const cLow = new THREE.Color('#8196ad'), cMid = new THREE.Color('#a9bccf'), cHi = new THREE.Color('#ffffff'), tmp = new THREE.Color();
        for (let k = 0; k < pos.count; k++) {
          const y = pos.getY(k) + 0.5, ang = Math.atan2(pos.getZ(k), pos.getX(k));
          const ridge = Math.sin(ang * 5 + i) * 0.08 + Math.sin(ang * 11 + i * 2.3) * 0.04 + Math.sin(ang * 23 + i) * 0.015;
          if (y < 0.98) { const nn = 1 + ridge * (1 - y) * 1.4; pos.setX(k, pos.getX(k) * nn); pos.setZ(k, pos.getZ(k) * nn); }
          const snowLine = 0.5 + ridge * 1.6 + Math.sin(ang * 17 + i * 5.1) * 0.03;
          const sn = Math.min(1, Math.max(0, (y - snowLine) / 0.05));
          tmp.copy(cLow).lerp(cMid, Math.min(1, y * 1.6)).lerp(cHi, sn);
          col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, fogMat('#ffffff', { vertexColors: true }));
        mesh.scale.set(rad, h, rad); mesh.position.set(x, h / 2 - 20, -s); g.add(mesh);
      }
    } else if (f.kind === 'skyline') {
      const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const mat = new THREE.MeshLambertMaterial({ color: '#141833' });
      mat.onBeforeCompile = sh => {
        sh.uniforms.uTime = U.time;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nfloat h2(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}')
          .replace('#include <emissivemap_fragment>', `vec2 cl = floor(vec2(vWP.x+vWP.z, vWP.y)/vec2(4.0,5.0)); vec2 ff = fract(vec2(vWP.x+vWP.z, vWP.y)/vec2(4.0,5.0));
            float lit = step(0.62, h2(vec3(cl,1.0))) * step(0.3,ff.x)*step(ff.x,0.7)*step(0.3,ff.y)*step(ff.y,0.7);
            totalEmissiveRadiance += vec3(1.0,0.82,0.55)*lit*0.9;`)
          .replace('#include <fog_fragment>', fogWeak(0.5));
      };
      const pts = spots(f.n - 20, 380, 820, 20);
      const im = new THREE.InstancedMesh(geo, mat, pts.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      pts.forEach(([x, s], i) => {
        const w = 18 + r() * 30, h = 30 + r() * 120;
        m4.compose(new THREE.Vector3(x, -1, -s), q.setFromAxisAngle(up, (r() - 0.5) * 0.3), new THREE.Vector3(w, h, w * (0.6 + r() * 0.8)));
        im.setMatrixAt(i, m4);
      });
      im.computeBoundingSphere();
      g.add(im);
    }
    this.scene.add(g);
  },

  update(dt) {
    U.time.value += dt;
    if (this.clouds) for (const c of this.clouds.children) { c.position.x += 1.5 * dt; if (c.position.x > 1100) c.position.x -= 2200; }
    // 浜の 大きな 波（10〜20秒おき）
    if (this.water && this.surge) {
      const S = this.surge; S.t -= dt;
      if (S.t < 0) { S.t = 10 + Math.random() * 10; S.big = 1; }
      S.k += ((S.big > 0 ? 0.55 : 0) - S.k) * Math.min(1, dt * (S.big > 0 ? 0.9 : 0.35));
      if (S.big > 0) { S.big -= dt / 2.2; }
      this.water.material.uniforms.uSurge.value = S.k + Math.sin(U.time.value * 1.57) * 0.08;
    }
  },
  render() { this.renderer.render(this.scene, this.camera); }
};
