// 形を 作る 道具と、道に そった 区画（第10部 10.8、付録S S.4）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from './config.js';
import { U } from './world.js';

export const V3 = THREE.Vector3;

// 頂点の色つきの 形（位置・法線・色 だけに する）
export function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
// 頂点ごとに 色を 決める（f(x, y, z) → THREE.Color）
export function paint(geo, f) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const p = g.attributes.position, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = f(p.getX(i), p.getY(i), p.getZ(i), i); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export function merge(list) { const g = mergeGeometries(list); list.forEach(x => x.dispose()); g.computeBoundingSphere(); return g; }
// 頂点に 1つの 値を つける（aWave など）
export function withAttr(geo, name, f) {
  const p = geo.attributes.position, a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = f(p.getX(i), p.getY(i), p.getZ(i), i);
  geo.setAttribute(name, new THREE.BufferAttribute(a, 1));
  return geo;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _eu = new THREE.Euler();
export function M(x, y, z, yaw = 0, s = 1, sy = s, tilt = 0) {
  _eu.set(tilt, yaw, tilt * 0.6, 'YXZ'); _q.setFromEuler(_eu);
  return _m.compose(_p.set(x, y, z), _q, _s.set(s, sy, s));
}

// 風で ゆれる 材質（上ほど ゆれる）
export function windMat(base, k) {
  const m = new THREE.MeshStandardMaterial(base);
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
        #else
        float ph = position.x * 0.3 + position.z * 0.2;
        #endif
        transformed.x += sin(uTime * 2.1 + ph) * ${k.toFixed(3)} * max(0.0, position.y);
        transformed.z += cos(uTime * 1.7 + ph) * ${(k * 0.6).toFixed(3)} * max(0.0, position.y);`);
  };
  m.customProgramCacheKey = () => 'wind' + k;
  return m;
}
// はためく 布（aWave：0 = 柱がわ、1 = 先。z の 向きに ゆらす）
export function flutterMat(base, amp = 0.12, speed = 8) {
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...base });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aWave;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = position.x * 0.37 + position.z * 0.21;
        transformed.z += sin(uTime * ${speed.toFixed(1)} - aWave * 5.0 + ph) * ${amp.toFixed(3)} * aWave;
        transformed.y += sin(uTime * ${(speed * 0.7).toFixed(1)} - aWave * 4.0 + ph) * ${(amp * 0.25).toFixed(3)} * aWave;`);
  };
  m.customProgramCacheKey = () => 'flutter' + amp + speed;
  return m;
}

// ---------- 光の 玉（加算の 点を まとめて 1回で 描く） ----------
let GLOWTEX = null;
function glowTex() {
  if (GLOWTEX) return GLOWTEX;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  GLOWTEX = new THREE.CanvasTexture(c); GLOWTEX.colorSpace = THREE.SRGBColorSpace;
  return GLOWTEX;
}
export class GlowPoints {
  constructor() { this.list = []; this.mesh = null; }
  add(p, color, size) { this.list.push({ p: p.clone ? p.clone() : new V3(p[0], p[1], p[2]), c: new THREE.Color(color), s: size }); }
  build(root) {
    if (!this.list.length) return null;
    const n = this.list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n);
    this.list.forEach((g, i) => { pos.set([g.p.x, g.p.y, g.p.z], i * 3); col.set([g.c.r, g.c.g, g.c.b], i * 3); size[i] = g.s; ph[i] = Math.random() * 6.28; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: glowTex() }, uScale: { value: 400 }, uTime: U.time, uTw: { value: 0 } },
      vertexShader: `attribute float aSize; attribute float aPh; attribute vec3 color; varying vec3 vC; uniform float uScale; uniform float uTime; uniform float uTw;
        void main(){ vC = color * (1.0 - uTw + uTw * (0.6 + 0.4 * sin(uTime * 3.0 + aPh))); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb * t.a, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.mesh = new THREE.Points(geo, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    root.add(this.mesh);
    return this.mesh;
  }
  scale(cam, h) { if (this.mesh) this.mesh.material.uniforms.uScale.value = h / (2 * Math.tan(cam.fov * Math.PI / 360)); }
  dispose() { if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); } }
}

// ---------- 道に そった 帯の 形（s に そって 断面を のばす） ----------
// prof：断面の 点 [[x, y], …]（y は 道の 高さ から）、H：道の高さ、ds：刻み
export function sweep(prof, sA, sB, H, { ds = 2, color = '#ffffff', closed = false, yAt = null } = {}) {
  const rows = [];
  for (let s = sA; s < sB; s += ds) rows.push(s);
  rows.push(sB);
  const np = prof.length, pos = [], idx = [];
  for (const s of rows) { const y0 = yAt ? yAt(s) : H(s); for (const [x, y] of prof) pos.push(x, y0 + y, -s); }
  const segs = closed ? np : np - 1;
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < segs; i++) {
    const a = j * np + i, b = j * np + (i + 1) % np, c = a + np, d = b + np;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const out = g.toNonIndexed(); g.dispose();
  out.computeVertexNormals();
  return colored(out, color);
}

// ---------- 区画（150m ごと） ----------
export class Chunks {
  constructor(root) {
    this.root = root; this.size = CFG.course.CHUNK;
    this.groups = new Map(); this.geos = new Map(); this.insts = new Map(); this.meshes = [];
  }
  ci(s) { return Math.floor(s / this.size); }
  group(ci) {
    let g = this.groups.get(ci);
    if (!g) { g = new THREE.Group(); g.userData.ci = ci; g.name = 'chunk' + ci; this.groups.set(ci, g); this.root.add(g); }
    return g;
  }
  // 世界の 座標の 形を 区画ごとに 1つに まとめる
  addGeo(s, key, mat, geo, { cast = true, receive = true } = {}) {
    const k = this.ci(s) + '|' + key;
    let b = this.geos.get(k);
    if (!b) { b = { ci: this.ci(s), mat, list: [], cast, receive }; this.geos.set(k, b); }
    b.list.push(geo);
  }
  // 同じ 形を たくさん（インスタンス）
  addInst(s, key, geo, mat, m4, color, { cast = true, receive = true } = {}) {
    const k = this.ci(s) + '|' + key;
    let b = this.insts.get(k);
    if (!b) { b = { ci: this.ci(s), geo, mat, items: [], cast, receive }; this.insts.set(k, b); }
    b.items.push({ m: m4.clone(), c: color ? new THREE.Color(color) : null });
  }
  addObj(s, obj) { this.group(this.ci(s)).add(obj); return obj; }
  build() {
    for (const b of this.geos.values()) {
      const g = b.list.length === 1 ? b.list[0] : mergeGeometries(b.list);
      if (b.list.length > 1) b.list.forEach(x => x.dispose());
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.receive;
      this.group(b.ci).add(mesh); this.meshes.push(mesh);
    }
    for (const b of this.insts.values()) {
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.items.length);
      b.items.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.castShadow = b.cast; im.receiveShadow = b.receive;
      this.group(b.ci).add(im); this.meshes.push(im);
    }
    this.geos.clear(); this.insts.clear();
  }
  // カメラの s（2人なら 2つの s の 間）から 前 450m、後ろ 40m だけ 見せる
  cull(sA, sB = sA) {
    const C = CFG.course, a = Math.min(sA, sB) - C.VIEW_BEHIND, b = Math.max(sA, sB) + C.VIEW_AHEAD;
    for (const [ci, g] of this.groups) { const s0 = ci * this.size, s1 = s0 + this.size; g.visible = s1 > a && s0 < b; }
  }
  dispose() {
    const done = new Set();
    this.root.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !done.has(o.geometry)) { done.add(o.geometry); o.geometry.dispose(); } });
  }
}
