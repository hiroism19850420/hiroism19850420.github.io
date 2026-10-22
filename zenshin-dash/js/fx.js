// 効果：パーティクル・紙ふぶき・花火・雪・速さの線（第22部・付録AA.5）
import * as THREE from 'three';
import { CFG } from './config.js';
import { particleAtlas, ringTexture } from './tex.js';
import { U } from './world.js';
import { clamp, lerp } from './util.js';

const VS = `
attribute float aSize; attribute vec4 aColor; attribute float aRot; attribute float aFrame;
varying vec4 vColor; varying float vRot; varying float vFrame;
uniform float uScale;
#include <fog_pars_vertex>
void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.5, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  vColor = aColor; vRot = aRot; vFrame = aFrame;
  #include <fog_vertex>
}`;
const FS = `
uniform sampler2D uAtlas; uniform float uAdd;
varying vec4 vColor; varying float vRot; varying float vFrame;
#include <fog_pars_fragment>
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  vec2 cell = vec2(mod(vFrame, 2.0), 1.0 - floor(vFrame / 2.0)) * 0.5;
  vec4 t = texture2D(uAtlas, cell + clamp(p, 0.0, 1.0) * 0.5);
  float a = vColor.a * t.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb * t.rgb, a);
  if (uAdd > 0.5) gl_FragColor = vec4(vColor.rgb * t.rgb * a, 1.0);
  #include <fog_fragment>
}`;
// フレーム：0 けむり、1 キラキラ、2 まる、3 雪

class Pool {
  constructor(n, additive, atlas) {
    this.n = n; this.count = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n); this.rot = new Float32Array(n); this.frame = new Float32Array(n);
    this.p = [];
    for (let i = 0; i < n; i++) this.p.push({ alive: false });
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aFrame', new THREE.BufferAttribute(this.frame, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAtlas: { value: atlas }, uScale: { value: 400 }, uAdd: { value: additive ? 1 : 0 } }])
    });
    this.mat.uniforms.uAtlas.value = atlas;
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
    this.next = 0;
  }
  spawn(o) {
    // 空きを さがす（なければ いちばん古い）
    let idx = -1;
    for (let k = 0; k < this.n; k++) { const i = (this.next + k) % this.n; if (!this.p[i].alive) { idx = i; break; } }
    if (idx < 0) idx = this.next;
    this.next = (idx + 1) % this.n;
    const p = this.p[idx];
    p.alive = true; p.age = 0; p.life = o.life;
    p.x = o.x; p.y = o.y; p.z = o.z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.g = o.g || 0; p.drag = o.drag || 0; p.s0 = o.s0; p.s1 = o.s1 ?? o.s0;
    p.c0 = o.c0; p.c1 = o.c1 || o.c0; p.a0 = o.a0 ?? 1; p.a1 = o.a1 ?? 0; p.rot = o.rot || Math.random() * 6; p.spin = o.spin || 0; p.frame = o.frame || 0;
    p.twinkle = o.twinkle || 0; p.trail = o.trail || null; p.trailT = 0; p.onDie = o.onDie || null; p.floor = o.floor;
    return p;
  }
  update(dt, fx) {
    let n = 0;
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i];
      if (!p.alive) { this.size[i] = 0; continue; }
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; this.size[i] = 0; if (p.onDie) p.onDie(p, fx); continue; }
      p.vy -= p.g * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor != null && p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      p.rot += p.spin * dt;
      if (p.trail) { p.trailT -= dt; if (p.trailT <= 0) { p.trailT = 0.03; fx.add.spawn({ x: p.x, y: p.y, z: p.z, life: 0.5, s0: 0.35, s1: 0.05, c0: p.trail, a0: 0.8, a1: 0, frame: 2 }); } }
      const t = p.age / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      let a = lerp(p.a0, p.a1, t);
      if (p.twinkle && t > 0.6) a *= 0.5 + 0.5 * Math.sin(p.age * 40 + i);
      this.col[i * 4] = lerp(p.c0[0], p.c1[0], t); this.col[i * 4 + 1] = lerp(p.c0[1], p.c1[1], t); this.col[i * 4 + 2] = lerp(p.c0[2], p.c1[2], t); this.col[i * 4 + 3] = a;
      this.size[i] = lerp(p.s0, p.s1, t); this.rot[i] = p.rot; this.frame[i] = p.frame;
      n++;
    }
    this.count = n;
    const g = this.geo.attributes;
    g.position.needsUpdate = g.aColor.needsUpdate = g.aSize.needsUpdate = g.aRot.needsUpdate = g.aFrame.needsUpdate = true;
  }
  clear() { for (const p of this.p) p.alive = false; }
}


// よぞら：足首の 光の すじ（0.6秒、加算の リボン。付録AD AD.5）
class Trail {
  constructor(scene, color) {
    this.n = 24; this.pts = [];
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 2 * 3); this.col = new Float32Array(this.n * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < this.n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    this.c = new THREE.Color(color).multiplyScalar(1.6); this.scene = scene; scene.add(this.mesh);
  }
  push(p) { this.pts.unshift({ x: p.x, y: p.y, z: p.z, t: 0 }); if (this.pts.length > this.n) this.pts.pop(); }
  reset() { this.pts = []; this.pos.fill(0); this.col.fill(0); this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; }
  update(dt) {
    for (const q of this.pts) q.t += dt;
    while (this.pts.length && this.pts[this.pts.length - 1].t > 0.6) this.pts.pop();
    const P = this.pos, Cc = this.col, w = 0.06, m = this.pts.length;
    for (let i = 0; i < this.n; i++) {
      const q = this.pts[Math.min(i, m - 1)];
      if (!q) { P.fill(0, i * 6, i * 6 + 6); Cc.fill(0, i * 6, i * 6 + 6); continue; }
      const k = i < m ? Math.max(0, 1 - q.t / 0.6) * (1 - i / this.n) : 0;
      P.set([q.x - w, q.y, q.z, q.x + w, q.y, q.z], i * 6);
      Cc.set([this.c.r * k, this.c.g * k, this.c.b * k, this.c.r * k, this.c.g * k, this.c.b * k], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); }
}

const C = c => { const x = new THREE.Color(c); return [x.r, x.g, x.b]; };
const COLORS = {
  grass: C('#7bbf4a'), sand: C('#e8d3a0'), snow: C('#ffffff'), snowroad: C('#ffffff'), packed: C('#d8c49a'), walk: C('#b0b6c6'), road: C('#9aa0ad'),
  water: C('#e8f6ff'), flame0: C('#ffe08a'), flame1: C('#ff6a2a'), turbo0: C('#bff2ff'), turbo1: C('#3f8cff'), gold: C('#ffd54a'), white: C('#ffffff'), spark: C('#fff2b0')
};
export const FX_COLORS = COLORS;

export const FX = {
  scene: null, norm: null, add: null, confettiMesh: null, conf: [], fireQueue: [], snow: null, quality: 'mid', trails: [], rings: null, streaks: null,
  init(scene, quality) {
    this.scene = scene; this.quality = quality;
    const atlas = particleAtlas();
    const n = CFG.quality[quality].particles;
    this.norm = new Pool(Math.floor(n * 0.55), false, atlas);
    this.add = new Pool(Math.floor(n * 0.45), true, atlas);
    scene.add(this.norm.points, this.add.points);
    // 紙ふぶき（回る四角）
    const cn = quality === 'low' ? 150 : 400;
    const cg = new THREE.PlaneGeometry(0.12, 0.18);
    this.confMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6 });
    this.confettiMesh = new THREE.InstancedMesh(cg, this.confMat, cn);
    this.confettiMesh.frustumCulled = false;
    const cols = ['#ff6fae', '#ffd23f', '#3fa9f5', '#56d364', '#ff7a2f', '#b18cff'].map(c => new THREE.Color(c));
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < cn; i++) { this.conf.push({ alive: false }); this.confettiMesh.setColorAt(i, cols[i % cols.length]); this.confettiMesh.setMatrixAt(i, zero); }
    this.confettiMesh.count = cn;
    scene.add(this.confettiMesh);
    this.dummy = new THREE.Object3D();
    this.initDash(scene);
  },
  setQuality(q) { this.quality = q; },
  scale(cam) { const s = innerHeight / (2 * Math.tan(cam.fov * Math.PI / 360)); this.norm.mat.uniforms.uScale.value = s; this.add.mat.uniforms.uScale.value = s; },
  lowK() { return this.quality === 'low' ? 0.33 : 1; },

  // ---------- 1つずつの 効果 ----------
  dust(pos, surf, v, back) {
    if (Math.random() > this.lowK()) return;
    const c = COLORS[surf] || COLORS.road;
    this.norm.spawn({ x: pos.x + (Math.random() - 0.5) * 0.4, y: pos.y + 0.1, z: pos.z + (Math.random() - 0.5) * 0.4, vx: back.x * (1 + Math.random() * 2) + (Math.random() - 0.5), vy: 1 + Math.random() * 2, vz: back.z * (1 + Math.random() * 2) + (Math.random() - 0.5), life: 0.6, s0: 0.3, s1: 1.0 + v * 0.02, c0: c, a0: surf === 'snow' || surf === 'snowroad' ? 0.65 : 0.5, a1: 0, frame: 0, drag: 1.5 });
    if (surf === 'grass' && Math.random() < 0.35) this.norm.spawn({ x: pos.x, y: pos.y + 0.1, z: pos.z, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, g: 12, life: 0.5, s0: 0.15, s1: 0.12, c0: COLORS.grass, a0: 1, a1: 0.8, frame: 2 });
  },
  splash(pos, n = 2) {
    for (let i = 0; i < n; i++) this.norm.spawn({ x: pos.x, y: pos.y + 0.15, z: pos.z, vx: (Math.random() - 0.5) * 6, vy: 2.5 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 6, g: 16, life: 0.5, s0: 0.22, s1: 0.35, c0: COLORS.water, a0: 0.85, a1: 0, frame: 2 });
  },
  flame(pos, dir, turbo) {
    this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * 4 + (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.2) * 0.6, vz: dir.z * 4 + (Math.random() - 0.5) * 0.6, life: 0.22, s0: 0.55, s1: 0.1, c0: turbo ? COLORS.turbo0 : COLORS.flame0, c1: turbo ? COLORS.turbo1 : COLORS.flame1, a0: 1, a1: 0.2, frame: 2 });
  },
  sparkle(pos, color = COLORS.gold, n = 14) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, sp = 4 + Math.random() * 3; this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * Math.cos(b) * sp, vy: Math.sin(b) * sp, vz: Math.sin(a) * Math.cos(b) * sp, drag: 5, life: 0.5, s0: 0.5, s1: 0, c0: color, c1: COLORS.white, a0: 1, a1: 0.4, frame: 1, spin: 4 }); }
    this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, life: 0.35, s0: 0.6, s1: 3.2, c0: C('#ffe9a0'), a0: 0.8, a1: 0, frame: 2 });
  },
  landRing(pos, surf) {
    const c = COLORS[surf] || COLORS.road;
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; this.norm.spawn({ x: pos.x, y: pos.y + 0.1, z: pos.z, vx: Math.cos(a) * 4, vy: 0.6, vz: Math.sin(a) * 4, drag: 3, life: 0.5, s0: 0.5, s1: 1.4, c0: c, a0: 0.55, a1: 0, frame: 0 }); }
  },
  sparks(pos, dir) {
    for (let i = 0; i < 8; i++) this.add.spawn({ x: pos.x, y: pos.y + 0.4, z: pos.z, vx: dir.x * 4 + (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3, vz: dir.z * 4 + (Math.random() - 0.5) * 4, g: 14, life: 0.3, s0: 0.25, s1: 0.1, c0: COLORS.spark, a0: 1, a1: 0, frame: 1 });
  },
  rocketSmoke(pos, back) {
    for (let i = 0; i < 30; i++) this.norm.spawn({ x: pos.x + (Math.random() - 0.5), y: pos.y + 0.3, z: pos.z + (Math.random() - 0.5), vx: back.x * 3 + (Math.random() - 0.5) * 5, vy: 0.5 + Math.random(), vz: back.z * 3 + (Math.random() - 0.5) * 5, drag: 2, life: 1.2, s0: 0.6, s1: 2.0, c0: COLORS.white, a0: 0.7, a1: 0, frame: 0 });
  },
  wind(pos, fwd) {
    const a = Math.random() * Math.PI * 2, r = 1.0 + Math.random() * 0.6;
    this.add.spawn({ x: pos.x + Math.cos(a) * r * fwd.z, y: pos.y + 0.6 + Math.sin(a) * r * 0.6, z: pos.z - Math.cos(a) * r * fwd.x, vx: -fwd.x * 18, vy: 0, vz: -fwd.z * 18, life: 0.25, s0: 0.25, s1: 0.05, c0: COLORS.white, a0: 0.35, a1: 0, frame: 2 });
  },
  smoke(pos) { this.norm.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: 0.4 + Math.random() * 0.3, vy: 1.2, vz: (Math.random() - 0.5) * 0.3, life: 4, s0: 0.8, s1: 3.0, c0: C('#d8dde6'), a0: 0.5, a1: 0, frame: 0 }); },
  glowPuff(pos, color, size = 1.2) { this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, life: 0.4, s0: size, s1: size * 2, c0: color, a0: 0.7, a1: 0, frame: 2 }); },

  // ================= ぜんしんダッシュ で 足した 効果（第24部、付録AD） =================
  initDash(scene) {
    // 光の 輪（加算の 板、12まで）
    this.ringTex = ringTexture();
    this.rings = [];
    const rg = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      m.visible = false; m.renderOrder = 5; scene.add(m); this.rings.push({ m, t: 9, life: 0.4, r1: 1, flat: true });
    }
    // 3D の 風の すじ（細長い 板、120本。インスタンスの 色で 明るさ）
    const sg = new THREE.BoxGeometry(0.035, 0.035, 1);
    this.streakMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.streakIM = new THREE.InstancedMesh(sg, this.streakMat, 120); this.streakIM.frustumCulled = false; this.streakIM.count = 0;
    this.streakIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3);
    scene.add(this.streakIM);
    this.streaks = []; for (let i = 0; i < 120; i++) this.streaks.push({ alive: false });
    this.trails = [];
    this._sd = new THREE.Object3D(); this._c = new THREE.Color();
  },
  // 足の 土けむり（AD.1）。surf：meadow / beach / snow / city
  footDust(pos, surf, spd, team) {
    const n = Math.round((2 + spd * 3) * this.lowK());
    const col = C({ meadow: '#d9a27c', beach: '#ead7a8', snow: '#ffffff', city: '#9aa3b5', wet: '#d8f0ff' }[surf] || '#d9a27c');
    for (let i = 0; i < n; i++) this.norm.spawn({ x: pos.x + (Math.random() - 0.5) * 0.25, y: pos.y + 0.06, z: pos.z + (Math.random() - 0.5) * 0.25, vx: (Math.random() - 0.5) * 1.2, vy: 0.4 + Math.random() * 0.8, vz: (1.5 + Math.random() * 2) * spd, drag: 2.5, life: 0.35 + Math.random() * 0.25, s0: (0.22 + Math.random() * 0.25) * (0.6 + spd), s1: (0.6 + spd) * 0.9, c0: col, a0: surf === 'snow' ? 0.7 : 0.5, a1: 0, frame: 0 });
    if (surf === 'snow') for (let i = 0; i < 4; i++) this.norm.spawn({ x: pos.x, y: pos.y + 0.1, z: pos.z, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random(), vz: 1 + Math.random() * 2, g: 6, life: 0.6, s0: 0.12, s1: 0.1, c0: COLORS.white, a0: 1, a1: 0.5, frame: 3 });
    if (surf === 'wet') for (let i = 0; i < 3; i++) this.norm.spawn({ x: pos.x, y: pos.y + 0.1, z: pos.z, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 1.5, vz: 1 + Math.random() * 2, g: 14, life: 0.45, s0: 0.14, s1: 0.2, c0: COLORS.water, a0: 0.85, a1: 0, frame: 2 });
    if (surf === 'city' && team) this.add.spawn({ x: pos.x, y: pos.y + 0.05, z: pos.z, vy: 0.2, life: 0.3, s0: 0.45, s1: 0.2, c0: C(team), a0: 0.7, a1: 0, frame: 2 });
  },
  // 風の すじ（AD.2）：まわりの 空気に 置いて、走りぬける
  windStreaks(pos, v, dt, k = 1) {
    const F = CFG.fx, spd = v / CFG.run.V_MAX;
    if (spd < F.WIND_FROM || !this.streaks) return;
    this._wAcc = (this._wAcc || 0) + F.WIND_MAX * (spd - F.WIND_FROM) / (1 - F.WIND_FROM) * dt * k * (this.quality === 'low' ? 0.4 : 1);
    while (this._wAcc > 1) {
      this._wAcc--;
      const st = this.streaks.find(s => !s.alive); if (!st) break;
      const side = Math.random() < 0.5 ? -1 : 1, up = Math.random();
      st.alive = true; st.t = 0; st.life = 0.32;
      st.x = pos.x + side * (0.55 + Math.random() * 1.6) * (up > 0.75 ? 0.3 : 1); st.y = pos.y + 0.2 + up * 2.2; st.z = pos.z - (2 + Math.random() * 6);
      st.len = 0.5 + spd * 2.4 + Math.random() * 0.8;
    }
  },
  updateStreaks(dt) {
    if (!this.streaks) return;
    const d = this._sd, im = this.streakIM; let n = 0;
    for (const st of this.streaks) {
      if (!st.alive) continue;
      st.t += dt; if (st.t > st.life) { st.alive = false; continue; }
      const k = st.t / st.life, a = Math.sin(Math.PI * k) * 0.55;
      d.position.set(st.x, st.y, st.z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, st.len); d.updateMatrix();
      im.setMatrixAt(n, d.matrix); this._c.setScalar(a); im.setColorAt(n, this._c); n++;
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  },
  // 光の 輪（AD.5）
  ring(pos, r1 = 1.6, color = '#ffffff', flat = true, life = 0.4) {
    if (!this.rings) return;
    const R = this.rings.find(r => !r.m.visible) || this.rings.reduce((a, b) => a.t > b.t ? a : b);
    R.t = 0; R.life = life; R.r1 = r1; R.flat = flat; R.m.visible = true; R.m.material.color.set(color);
    R.m.position.copy(pos); if (flat) { R.m.rotation.set(-Math.PI / 2, 0, 0); R.m.position.y += 0.06; }
  },
  updateRings(dt, cam) {
    if (!this.rings) return;
    for (const R of this.rings) {
      if (!R.m.visible) continue;
      R.t += dt; const k = R.t / R.life;
      if (k >= 1) { R.m.visible = false; continue; }
      const s = (0.3 + (R.r1 - 0.3) * (1 - Math.pow(1 - k, 3))) * 2;
      R.m.scale.set(s, s, s); R.m.material.opacity = 0.85 * (1 - k);
      if (!R.flat && cam) R.m.quaternion.copy(cam.quaternion);
    }
  },
  // 星の しぶき（合図が できた）
  stars(pos, n = 12, perfect = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, sp = 3 + Math.random() * 3.5;
      this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * Math.cos(b) * sp, vy: Math.sin(b) * sp + 1.5, vz: Math.sin(a) * Math.cos(b) * sp, g: 4, drag: 1.2, life: 0.6 + Math.random() * 0.2, s0: perfect ? 0.6 : 0.45, s1: 0.05, c0: perfect ? COLORS.white : COLORS.gold, c1: COLORS.gold, a0: 1, a1: 0.3, frame: 1, spin: 6, twinkle: 1 });
    }
    this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, life: 0.3, s0: 0.8, s1: perfect ? 4 : 2.8, c0: C('#fff1a8'), a0: 0.8, a1: 0, frame: 2 });
    if (perfect) this.ring(pos, 2.4, '#ffd54a', false, 0.45);
  },
  // 当たりの 火花（じゃま）
  hitSparks(pos, dir = null) {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 4;
      const vx = (dir ? dir.x * 0.7 : 0) + Math.cos(a) * sp * 0.6, vz = (dir ? dir.z * 0.7 : 0) + Math.sin(a) * sp * 0.6;
      this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx, vy: 1 + Math.random() * 4, vz, g: 10, life: 0.3, s0: 0.3, s1: 0.05, c0: Math.random() < 0.5 ? COLORS.spark : COLORS.white, a0: 1, a1: 0, frame: 1 });
    }
    this.ring(pos, 1.8, '#ffffff', false, 0.3);
  },
  // マンガの 土けむり（どっしりに ぶつかった）
  puffCartoon(pos, color = '#ffffff') {
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; this.norm.spawn({ x: pos.x + Math.cos(a) * 0.3, y: pos.y + Math.sin(a) * 0.3, z: pos.z + 0.2, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2 + 0.5, vz: 0.6, drag: 4, life: 0.55, s0: 0.6, s1: 1.6, c0: C(color), a0: 0.9, a1: 0, frame: 0 }); }
  },
  // 葉っぱ・雪・つららの かけら（くぐり棒）
  leaf(pos, color = '#7ccf4a') {
    const c = C(color);
    this.norm.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 0.8, vz: (Math.random() - 0.5) * 1.5, g: 1.6, drag: 1.2, life: 1.6 + Math.random() * 0.6, s0: 0.2, s1: 0.16, c0: c, a0: 1, a1: 0.6, frame: 2, spin: 3, floor: pos.y - 2.2 });
  },
  snowPuff(pos) { for (let i = 0; i < 16; i++) this.norm.spawn({ x: pos.x + (Math.random() - 0.5) * 2, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 2, g: 5, drag: 1.5, life: 0.9, s0: 0.25, s1: 0.5, c0: COLORS.white, a0: 0.9, a1: 0, frame: 3 }); },
  puff(pos, color = '#ffffff') { for (let i = 0; i < 6; i++) this.norm.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 1.5, vy: 0.5 + Math.random(), vz: (Math.random() - 0.5) * 1.5, drag: 3, life: 0.5, s0: 0.25, s1: 0.8, c0: C(color), a0: 0.7, a1: 0, frame: 0 }); },
  // ボールが はじけて 星に
  starBurst(pos, color = '#ffd54a') {
    for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, sp = 4 + Math.random() * 3; this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * Math.cos(b) * sp, vy: Math.sin(b) * sp, vz: Math.sin(a) * Math.cos(b) * sp, drag: 3, life: 0.5, s0: 0.5, s1: 0.05, c0: C(color), c1: COLORS.white, a0: 1, a1: 0.3, frame: 1, spin: 5 }); }
    this.ring(pos, 1.2, color, false, 0.3);
  },
  // ロケットスタート
  rocketBlast(pos) {
    for (let i = 0; i < 22; i++) this.norm.spawn({ x: pos.x + (Math.random() - 0.5) * 0.8, y: pos.y + 0.2, z: pos.z + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 6, vy: 0.5 + Math.random() * 1.5, vz: 2 + Math.random() * 4, drag: 2.2, life: 1.0, s0: 0.5, s1: 2.0, c0: COLORS.white, a0: 0.75, a1: 0, frame: 0 });
    for (let i = 0; i < 12; i++) this.add.spawn({ x: pos.x + (Math.random() - 0.5) * 0.5, y: pos.y + 0.3, z: pos.z, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: 3 + Math.random() * 3, life: 0.3, s0: 0.7, s1: 0.1, c0: COLORS.flame0, c1: COLORS.flame1, a0: 1, a1: 0.2, frame: 2 });
    this.ring(pos, 2.6, '#ffffff', true, 0.45);
  },
  // ゲートの 火花と 紙ふぶき
  gateSparks(points, top) {
    for (const p of points) for (let i = 0; i < 5; i++) this.add.spawn({ x: p.x, y: p.y + Math.random() * 1.2, z: p.z, vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 3, vz: -2 - Math.random() * 4, g: 12, life: 0.35, s0: 0.25, s1: 0.05, c0: COLORS.spark, a0: 1, a1: 0, frame: 1 });
    if (top) this.confetti(top, this.quality === 'low' ? 30 : CFG.fx.CONFETTI_GATE, 4, 1.5, { x: 0, y: 3, z: -2, spread: 5 });
  },
  // 紙の門を やぶった（前へ 40枚）
  paperBurst(pos) { this.confetti(pos, this.quality === 'low' ? 18 : 40, 3.5, 1.4, { x: 0, y: 2.5, z: -5, spread: 6 }); },
  // ---------- 炎の オーラ（AD.4） ----------
  makeAura(team) {
    const g = new THREE.CylinderGeometry(0.32, 0.6, 1.9, this.quality === 'low' ? 8 : 20, 1, true).translate(0, 0.95, 0);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uT: U.time, uA: { value: 0 }, uC1: { value: new THREE.Color('#ffb020') }, uC2: { value: new THREE.Color(team) } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uT, uA; uniform vec3 uC1, uC2; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          float y = vUv.y;
          float fl = n(vec2(vUv.x * 8.0, y * 3.0 - uT * 4.0)) * 0.7 + n(vec2(vUv.x * 16.0, y * 6.0 - uT * 7.0)) * 0.3;
          float a = smoothstep(1.0, 0.25, y) * smoothstep(0.0, 0.12, y) * (fl * 1.5 - 0.35);
          float rim = pow(1.0 - abs(dot(vN, vV)), 1.2) * 0.8 + 0.2;
          vec3 c = mix(uC1, uC2, smoothstep(0.1, 0.9, y));
          gl_FragColor = vec4(c * 1.4, clamp(a * rim * uA, 0.0, 1.0));
        }`
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = false;
    return mesh;
  },
  embers(pos, team) { this.add.spawn({ x: pos.x + (Math.random() - 0.5) * 0.8, y: pos.y + Math.random() * 1.4, z: pos.z + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 0.6, vy: 1.5 + Math.random() * 1.5, vz: 2 + Math.random() * 2, life: 0.6, s0: 0.18, s1: 0.04, c0: COLORS.flame0, c1: C(team), a0: 1, a1: 0, frame: 1 }); },
  // ---------- 夜の 光の すじ（AD.5 trail） ----------
  addTrail(color) { const tr = new Trail(this.scene, color); this.trails.push(tr); return tr; },
  removeTrails() { for (const t of this.trails) t.dispose(); this.trails = []; },

  // ---------- 紙ふぶき ----------
  confetti(center, n = 400, spread = 6, height = 6, vel = null) {
    const N = this.conf.length;
    let k = 0;
    for (let i = 0; i < N && k < n; i++) {
      const c = this.conf[i]; if (c.alive) continue;
      c.alive = true; c.t = 0; c.life = 5 + Math.random() * 2;
      c.p = vel ? new THREE.Vector3(center.x + (Math.random() - 0.5) * spread, center.y + (Math.random() - 0.5) * height, center.z + (Math.random() - 0.5) * spread)
        : new THREE.Vector3(center.x + (Math.random() - 0.5) * spread * 2, center.y + height * (0.6 + Math.random() * 0.6), center.z + (Math.random() - 0.5) * spread * 2);
      c.v = vel ? new THREE.Vector3(vel.x + (Math.random() - 0.5) * vel.spread, vel.y + Math.random() * vel.spread * 0.6, vel.z + (Math.random() - 0.5) * vel.spread) : null;
      if (vel) c.life = 2.5 + Math.random() * 1.5;
      c.ax = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); c.w = 4 + Math.random() * 6; c.ph = Math.random() * 6; c.q = new THREE.Quaternion();
      k++;
    }
  },
  // ---------- 花火 ----------
  firework(pos, shape = 'ball', colors = null) {
    const cols = colors || [['#ff6fae', '#ffd54a', '#7fe0ff', '#9dff7a', '#ffffff', '#c89bff', '#ff8f5a'][Math.floor(Math.random() * 7)]];
    const shell = this.add.spawn({ x: pos.x + (Math.random() - 0.5) * 6, y: pos.y - 45, z: pos.z + (Math.random() - 0.5) * 6, vy: 30, g: 12, life: 1.25, s0: 0.7, s1: 0.5, c0: COLORS.white, a0: 1, a1: 1, frame: 2, trail: C('#ffe0a0') });
    shell.onDie = (p, fx) => fx.burst(new THREE.Vector3(p.x, p.y, p.z), shape, cols);
    if (this.onFirework) this.onFirework('up', pos);
  },
  burst(pos, shape, cols) {
    const n = this.quality === 'low' ? 60 : 90 + Math.floor(Math.random() * 50);
    const cc = cols.map(C);
    const dirs = [];
    if (shape === 'heart') { for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; const x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); dirs.push(new THREE.Vector3(x / 17, y / 17, (Math.random() - 0.5) * 0.1)); } }
    else if (shape === 'star') { for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, r = 0.6 + 0.4 * Math.abs(Math.cos(t * 2.5)); dirs.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, (Math.random() - 0.5) * 0.15)); } }
    else for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); dirs.push(new THREE.Vector3(r * Math.cos(a), u, r * Math.sin(a))); }
    // 平らな 形は カメラのほうへ 向ける
    const camQ = this.camQuat;
    dirs.forEach((d, i) => {
      if (shape !== 'ball' && camQ) d.applyQuaternion(camQ);
      const sp = 12 + Math.random() * 6;
      this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: d.x * sp, vy: d.y * sp, vz: d.z * sp, g: 4, drag: 1.6, life: 1.6, s0: 0.9, s1: 0.25, c0: cc[i % cc.length], c1: COLORS.white, a0: 1, a1: 0.1, frame: 2, twinkle: 1 });
    });
    if (this.onFirework) this.onFirework('boom', pos);
  },
  // ---------- 雪 ----------
  setSnow(on) {
    if (this.snow) { this.scene.remove(this.snow.points); this.snow.geo.dispose(); this.snow.mat.dispose(); this.snow = null; }
    if (!on) return;
    const n = { high: 1500, mid: 900, low: 300 }[this.quality];
    const pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; ph[i] = Math.random() * 6; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uScale: { value: 400 }, uAtlas: { value: this.norm.mat.uniforms.uAtlas.value } },
      vertexShader: `attribute float aPh; uniform float uT; uniform vec3 uCam; uniform float uScale; varying float vA;
        void main(){ vec3 p = position; p.y = mod(p.y - uT * 1.2, 30.0); p.x += sin(uT * 0.8 + aPh) * 0.6; p.z += cos(uT * 0.6 + aPh * 1.3) * 0.6;
          vec3 w = uCam + vec3(mod(p.x - uCam.x + 30.0, 60.0) - 30.0, p.y - 8.0, mod(p.z - uCam.z + 30.0, 60.0) - 30.0);
          vec4 mv = viewMatrix * vec4(w, 1.0); gl_PointSize = (0.08 + fract(aPh) * 0.08) * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; vA = 0.9; }`,
      fragmentShader: `uniform sampler2D uAtlas; varying float vA; void main(){ vec4 t = texture2D(uAtlas, vec2(0.5, 0.0) + gl_PointCoord * 0.5); if (t.a < 0.05) discard; gl_FragColor = vec4(vec3(1.0), t.a * vA); }`,
      transparent: true, depthWrite: false
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
    this.scene.add(pts);
    this.snow = { points: pts, geo, mat };
  },

  update(dt, cam) {
    this.scale(cam);
    this.camQuat = cam.quaternion;
    this.norm.update(dt, this); this.add.update(dt, this);
    this.updateRings(dt, cam); this.updateStreaks(dt); for (const tr of this.trails) tr.update(dt);
    // 紙ふぶき
    const m = this.confettiMesh, d = this.dummy; let any = false;
    const qq = this._qq || (this._qq = new THREE.Quaternion());
    for (let i = 0; i < this.conf.length; i++) {
      const c = this.conf[i];
      if (c.alive) {
        c.t += dt;
        if (c.t > c.life) c.alive = false;
      }
      if (!c.alive) { if (c.shown) { d.scale.setScalar(0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); c.shown = false; any = true; } continue; }
      if (c.v) { c.v.y -= 9 * dt; c.v.multiplyScalar(Math.exp(-2.2 * dt)); c.p.addScaledVector(c.v, dt); if (c.v.y < -1.4) c.v.y = -1.4; }
      c.p.y -= 1.4 * dt; c.p.x += Math.sin(c.t * 2 + c.ph) * 0.8 * dt; c.p.z += Math.cos(c.t * 1.7 + c.ph) * 0.5 * dt;
      c.q.multiply(qq.setFromAxisAngle(c.ax, c.w * dt));
      d.position.copy(c.p); d.quaternion.copy(c.q); d.scale.setScalar(c.t > c.life - 0.5 ? (c.life - c.t) * 2 : 1);
      d.updateMatrix(); m.setMatrixAt(i, d.matrix); c.shown = true; any = true;
    }
    m.count = this.conf.length; if (any) m.instanceMatrix.needsUpdate = true;
    if (this.snow) { this.snow.mat.uniforms.uT.value += dt; this.snow.mat.uniforms.uCam.value.copy(cam.position); this.snow.mat.uniforms.uScale.value = this.norm.mat.uniforms.uScale.value; }
  },
  clear() { this.norm.clear(); this.add.clear(); for (const c of this.conf) c.alive = false; for (const r of this.rings || []) r.m.visible = false; for (const st of this.streaks || []) st.alive = false; if (this.streakIM) this.streakIM.count = 0; this.trails.forEach(t => t.reset()); },
  dispose() { if (!this.scene) return; this.setSnow(false); }
};
