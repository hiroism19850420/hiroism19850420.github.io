// 景色（第12〜15部、21.10、付録I・U・AB）
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, lerp, clamp, noise2, smoothstep } from './util.js';
import { U } from './world.js';
import { ZONE } from './track.js';
import { glowTexture, crackTexture, picnicTexture } from './tex.js';

const V3 = THREE.Vector3;
const QUAL = { high: 0, mid: 1, low: 2 };

// ---------- 頂点の色つきの 形を まとめる ----------
function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const T = (g, x, y, z) => g.translate(x, y, z);
function merge(list) { const g = mergeGeometries(list); g.computeVertexNormals && null; g.computeBoundingSphere(); return g; }

// 風で ゆれる 材質
function windMat(base, k) {
  const m = new THREE.MeshStandardMaterial(base);
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
        #else
        float ph = 0.0;
        #endif
        transformed.x += sin(uTime * 2.1 + ph) * ${k.toFixed(3)} * max(0.0, position.y);
        transformed.z += cos(uTime * 1.7 + ph) * ${(k * 0.6).toFixed(3)} * max(0.0, position.y);`);
  };
  return m;
}

// ---------- インスタンスを 区画ごとに まとめる ----------
class Batches {
  constructor(root) { this.root = root; this.map = new Map(); this.meshes = []; }
  add(key, geo, mat, m4, color, { cast = true, receive = true } = {}) {
    let b = this.map.get(key);
    if (!b) { b = { geo, mat, items: [], cast, receive }; this.map.set(key, b); }
    b.items.push({ m: m4.clone(), c: color ? new THREE.Color(color) : null });
  }
  build(cell = 300) {
    for (const b of this.map.values()) {
      const cells = new Map();
      for (const it of b.items) { const e = it.m.elements, k = Math.floor(e[12] / cell) + ',' + Math.floor(e[14] / cell); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); }
      for (const list of cells.values()) {
        const im = new THREE.InstancedMesh(b.geo, b.mat, list.length);
        list.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); });
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.castShadow = b.cast; im.receiveShadow = b.receive;
        this.root.add(im); this.meshes.push(im);
      }
    }
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _up = new V3(0, 1, 0);
function M(x, y, z, yaw = 0, s = 1, sy = s, tilt = 0) {
  _q.setFromEuler(new THREE.Euler(tilt, yaw, tilt * 0.6, 'YXZ'));
  return _m.compose(_p.set(x, y, z), _q, _s.set(s, sy, s));
}

// ---------- 形の 部品 ----------
function treeGeos() {
  const trunk = colored(new THREE.CylinderGeometry(0.18, 0.26, 2.6, 7).translate(0, 1.3, 0), '#8a5a3b');
  const leaves = [];
  for (const [s, x, y, z] of [[2.1, 0, 3.4, 0], [1.8, 0.9, 3.0, 0.4], [1.6, -0.7, 3.2, -0.5]]) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + noise2(p.getX(i) * 3 + x, p.getZ(i) * 3 + z, 4) * 0.08; p.setXYZ(i, p.getX(i) * k * s, p.getY(i) * k * s * 0.92, p.getZ(i) * k * s); }
    g.translate(x, y, z);
    leaves.push(g);
  }
  const lg = mergeGeometries(leaves.map(g => g.index ? g.toNonIndexed() : g));
  // 上が 明るく 下が 暗い
  const p = lg.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = clamp(0.8 + (p.getY(i) - 2.6) * 0.12, 0.72, 1.12); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
  lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  lg.computeVertexNormals();
  return { trunk, leaves: lg };
}
function firGeo() {
  const parts = [colored(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6).translate(0, 0.8, 0), '#6b4a33')];
  const tiers = [[2.0, 2.2, 1.6], [1.5, 1.9, 2.9], [1.0, 1.6, 4.0]];
  for (const [r, h, y] of tiers) {
    const g = new THREE.CylinderGeometry(r * 0.004, r, h, 9, 2).translate(0, y + h / 2 - 0.3, 0).toNonIndexed();
    g.deleteAttribute('uv');
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    const green = new THREE.Color('#2f6b4a'), snow = new THREE.Color('#f4f8fc');
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) - (y - 0.3)) / h;
      if (t < 0.05) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 7 + p.getZ(i) * 5) * 0.08);
      const c = t > 0.62 ? snow : green;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  const out = mergeGeometries(parts); out.computeVertexNormals(); return out;
}
function palmGeos(r) {
  const H = 7 + r() * 2, lean = 1.2 + r() * 1.0;
  const curve = new THREE.CubicBezierCurve3(new V3(0, 0, 0), new V3(lean * 0.3, H * 0.4, 0), new V3(lean * 0.8, H * 0.8, 0), new V3(lean, H, 0));
  const tg = new THREE.TubeGeometry(curve, 14, 0.25, 7, false);
  // 先を 細く ＋ 輪のしま
  const p = tg.attributes.position, col = new Float32Array(p.count * 3), c1 = new THREE.Color('#a7774a'), c2 = new THREE.Color('#8a6038');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = clamp(y / H, 0, 1), pt = curve.getPoint(t);
    const k = lerp(1.1, 0.75, t);
    p.setX(i, pt.x + (p.getX(i) - pt.x) * k); p.setZ(i, pt.z + (p.getZ(i) - pt.z) * k);
    const c = Math.floor(y / 0.4) % 2 ? c1 : c2; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(tg.attributes)) if (!['position', 'normal', 'color'].includes(k)) tg.deleteAttribute(k);
  const trunk = tg.toNonIndexed();
  const leaves = [];
  const top = new V3(lean, H, 0);
  for (let j = 0; j < 8; j++) {
    const a = j / 8 * Math.PI * 2 + r() * 0.3, tilt = (r() - 0.5) * 0.3;
    const pos = [], cc = [], L = 3.2, n = 10, gC = new THREE.Color('#3b8a3f'), tC = new THREE.Color('#63c35a');
    for (let i = 0; i <= n; i++) {
      const t = i / n, w = 0.45 * Math.pow(Math.sin(Math.PI * t), 0.7) + 0.02;
      const along = t * L, y = 0.6 * Math.sin(t * Math.PI * 0.8) - 0.9 * t * t + tilt * t;
      for (const sd of [-1, 1]) {
        const lx = Math.cos(a) * along - Math.sin(a) * w * sd, lz = Math.sin(a) * along + Math.cos(a) * w * sd;
        pos.push(top.x + lx, top.y + y + (sd > 0 ? 0.04 : 0), top.z + lz);
        const c = gC.clone().lerp(tC, t); cc.push(c.r, c.g, c.b);
      }
    }
    const idx = [];
    for (let i = 0; i < n; i++) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); g.setIndex(idx);
    g.computeVertexNormals();
    leaves.push(g.toNonIndexed());
  }
  const lg = mergeGeometries(leaves);
  return { trunk, leaves: lg };
}
function grassGeo(dark, light) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3, h = 0.7, w = 0.12;
    const g = new THREE.BufferGeometry();
    const ca = new THREE.Color(dark), cb = new THREE.Color(light);
    const pos = [-Math.cos(a) * w / 2, 0, -Math.sin(a) * w / 2, Math.cos(a) * w / 2, 0, Math.sin(a) * w / 2, Math.cos(a) * 0.08, h, Math.sin(a) * 0.08];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([ca.r, ca.g, ca.b, ca.r, ca.g, ca.b, cb.r, cb.g, cb.b], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    parts.push(g);
  }
  return mergeGeometries(parts);
}
function flowerGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; parts.push(colored(new THREE.CircleGeometry(0.06, 7).scale(1.2, 0.85, 1).rotateX(-Math.PI / 2).translate(Math.cos(a) * 0.07, 0.25, Math.sin(a) * 0.07), '#ffffff')); }
  parts.push(colored(new THREE.CircleGeometry(0.035, 8).rotateX(-Math.PI / 2).translate(0, 0.252, 0), '#ffd23f'));
  parts.push(colored(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 3).translate(0, 0.125, 0), '#3f8a3a'));
  return mergeGeometries(parts);
}
function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (noise2(p.getX(i) * 2 + seed, p.getZ(i) * 2, seed) * 0.3); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.6, p.getZ(i) * k); }
  g.computeVertexNormals();
  return g;
}

export function buildScenery(W, tr, course, quality, terr, ctx) {
  const root = new THREE.Group(); root.name = 'scenery';
  const disposables = [];
  const keep = o => { disposables.push(o); return o; };
  const qi = QUAL[quality] ?? 1;
  const S = course.scenery, half = course.width / 2;
  const R = rng(1000 * course.no + 7);
  const B = new Batches(root);
  const hAt = terr.heightAt;
  const grid = terr.grid;
  const X0 = grid.x0 + 30, Z0 = grid.z0 + 30, X1 = grid.x0 + (grid.nx - 1) * grid.step - 30, Z1 = grid.z0 + (grid.nz - 1) * grid.step - 30;
  const night = !!course.night;
  const anim = [];   // 毎コマ 動かす物
  const blockers = [];   // 決まった場所の 大きな物（半径）
  const blocked = (x, z, r = 0) => blockers.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + r) ** 2);
  const isWater = (x, z, h) => course.water && !course.water.river && h < 0.35;
  const inRiver = (x, z) => course.water && course.water.river && Math.abs(z - course.water.river.z) < course.water.river.half + 3;
  const roadD = (x, z) => tr.distAll(x, z);
  const glow = [];     // 光の玉（加算の点）
  const glowPoints = (pts, color, size) => pts.forEach(p => glow.push({ p, c: new THREE.Color(color), s: size }));
  ctx.glowPoints = glowPoints;

  // 群れで 置く
  const scatter = (n, minD, groupSize, spacing, fn, { maxD = 1e9, inside = 1, water = false, tries = 30 } = {}) => {
    let placed = 0, guard = 0;
    while (placed < n && guard++ < n * 8) {
      let cx, cz, ok = false;
      for (let k = 0; k < tries && !ok; k++) {
        cx = lerp(X0, X1, R()); cz = lerp(Z0, Z1, R());
        const d = roadD(cx, cz);
        if (d < minD + 4 || d > maxD) continue;
        const h = hAt(cx, cz);
        if (!water && (isWater(cx, cz, h) || inRiver(cx, cz))) continue;
        if (inside < 1) { const inner = isInside(cx, cz); if (inner && R() > inside) continue; }
        if (blocked(cx, cz, 4)) continue;
        ok = true;
      }
      if (!ok) continue;
      const gs = Math.max(1, Math.round(lerp(groupSize[0], groupSize[1], R())));
      const gr = Math.sqrt(gs) * spacing;
      for (let i = 0; i < gs && placed < n; i++) {
        const a = R() * Math.PI * 2, rr = gr * Math.sqrt(R());
        const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        if (roadD(x, z) < minD) continue;
        const h = hAt(x, z);
        if (!water && (isWater(x, z, h) || inRiver(x, z))) continue;
        if (blocked(x, z, 1)) continue;
        fn(x, h, z, placed, gs);
        placed++;
      }
    }
    return placed;
  };
  // コースの 内がわか（道で かこまれているか）：レイを 1本 出して 交わる数
  const isInside = (x, z) => {
    let cnt = 0; const N = tr.N;
    for (let i = 0; i < N; i += 2) {
      const j = (i + 2) % N;
      const ax = tr.px[i], az = tr.pz[i], bx = tr.px[j], bz = tr.pz[j];
      if ((az > z) !== (bz > z)) { const xi = ax + (z - az) * (bx - ax) / (bz - az); if (xi > x) cnt++; }
    }
    return cnt % 2 === 1;
  };

  // ---------- 決まった場所の 物（先に 置いて 場所をとる） ----------
  for (const pr of S.props || []) {
    if (pr.at) blockers.push({ x: pr.at[0], z: pr.at[1], r: { windmill: 12, barn: 14, lighthouse: 12, ferris: 26 }[pr.kind] || 8 });
    if (pr.center) blockers.push({ x: pr.center[0], z: pr.center[1], r: (pr.r || 10) + 2 });
    if (pr.kind === 'cabins') for (const c of pr.at) blockers.push({ x: c[0], z: c[1], r: 8 });
    if (pr.kind === 'lake') blockers.push({ x: pr.c[0], z: pr.c[1], r: pr.r + 3 });
  }

  // 街の ビルは 先に（看板が ビルを使う）
  const smokes = [];
  if (S.buildings) buildings(S.buildings);

  // ---------- 木 ----------
  if (S.trees) {
    const TG = treeGeos();
    const trunkM = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    const leafM = keep(windMat({ vertexColors: true, roughness: 0.75 }, 0.04));
    const greens = ['#4caf50', '#5cbf4a', '#3f9e44', '#79c95a', '#66b84f'];
    scatter(S.trees.n[qi], S.trees.minD, S.trees.group, 3.6, (x, y, z) => {
      const s = 0.75 + R() * 0.55, yaw = R() * 6.28;
      B.add('trunk', TG.trunk, trunkM, M(x, y - 0.1, z, yaw, s));
      const c = new THREE.Color(R.pick(greens)).multiplyScalar(0.92 + R() * 0.16);
      B.add('leaf', TG.leaves, leafM, M(x, y - 0.1, z, yaw, s), c);
    }, { inside: S.trees.insideK ?? 1 });
  }
  if (S.firs) {
    const FG = firGeo(), fm = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    scatter(S.firs.n[qi], S.firs.minD, S.firs.group, 3.2, (x, y, z) => {
      const s = 0.7 + R() * 0.7 + clamp(y / 30, 0, 0.4);
      B.add('fir', FG, fm, M(x, y - 0.2, z, R() * 6.28, s, s * (0.9 + R() * 0.3)));
    });
  }
  if (S.palms) {
    const palmM = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    const leafM = keep(windMat({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }, 0.025));
    const variants = [0, 1, 2].map(i => palmGeos(rng(70 + i)));
    const put = (x, y, z, yaw) => { const v = R.pick(variants), s = 0.85 + R() * 0.3; B.add('palmT' + variants.indexOf(v), v.trunk, palmM, M(x, y - 0.2, z, yaw, s)); B.add('palmL' + variants.indexOf(v), v.leaves, leafM, M(x, y - 0.2, z, yaw, s)); };
    const av = S.palms.avenue;
    if (av) for (let s = av.s0; s < av.s1; s += av.step) for (const side of [1, -1]) {
      const d = side * (half + course.shoulder + 2.5), p = tr.pos(tr.wrapS(s), d, 0, {});
      put(p.x, hAt(p.x, p.z), p.z, tr.yawAt(tr.wrapS(s)) + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + (R() - 0.5) * 0.6);
    }
    scatter(S.palms.n[qi], S.palms.minD, [2, 6], 5, (x, y, z) => { if (y < 0.6) return; put(x, y, z, R() * 6.28); });
  }
  // ---------- 花・草・岩 ----------
  if (S.flowers && S.flowers.n[qi] > 0) {
    const fg = flowerGeo(), fm = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    const cols = ['#ff6fae', '#ffd23f', '#ffffff', '#b18cff', '#ff8f6a'];
    let gc = null;
    scatter(S.flowers.n[qi], S.flowers.minD, S.flowers.group, 0.55, (x, y, z, i, gs) => {
      if (!gc || R() < 1 / Math.max(1, gs)) gc = R.pick(cols);
      B.add('flower', fg, fm, M(x, y, z, R() * 6.28, 0.8 + R() * 0.5), gc, { cast: false });
    });
  }
  if (S.grass && S.grass.n[qi] > 0) {
    const dark = course.biome === 'beach' ? '#8a9a4a' : '#3f7a2f', light = course.biome === 'beach' ? '#c8d47a' : '#9be070';
    const gg = grassGeo(dark, light), gm = keep(windMat({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }, 0.11));
    scatter(S.grass.n[qi], S.grass.minD, [3, 9], 0.8, (x, y, z) => B.add('grass', gg, gm, M(x, y - 0.02, z, R() * 6.28, 0.7 + R() * 0.7), null, { cast: false }), { maxD: 160 });
  }
  if (S.rocks) {
    const rg = [0, 1, 2, 3].map(i => rockGeo(i * 3 + 1)), rm = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }));
    const rc = course.biome === 'snow' ? ['#8a93a3', '#9aa2b0', '#7d8492'] : ['#9aa0a8', '#8a8f99', '#b0a898'];
    scatter(S.rocks.n[qi], S.rocks.minD, [1, 4], 3, (x, y, z) => {
      const i = Math.floor(R() * 4), s = 0.5 + R() * 1.6;
      B.add('rock' + i, rg[i], rm, M(x, y - 0.2 * s, z, R() * 6.28, s, s * (0.7 + R() * 0.6)), R.pick(rc));
    }, { water: course.biome === 'beach' });
  }

  // ---------- コースごとの 物 ----------
  const mat = (c, o = {}) => keep(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }));
  const add = (geo, m, x, y, z, ry = 0, cast = true) => { const o = new THREE.Mesh(keep(geo), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = cast; o.receiveShadow = true; root.add(o); return o; };
  const vm = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));

  for (const pr of S.props || []) {
    switch (pr.kind) {
      case 'windmill': {
        const [x, z] = pr.at, y = hAt(x, z) - 0.3;
        const tower = merge([colored(new THREE.CylinderGeometry(2.2, 3.2, 12, 8).translate(0, 6, 0), '#f4efe4'), colored(new THREE.ConeGeometry(2.8, 3, 8).translate(0, 13.5, 0), '#d9534f'),
          ...[0, 1, 2].map(i => colored(new THREE.BoxGeometry(0.8, 1.2, 0.1).translate(0, 4 + i * 3, 2.75 - i * 0.3), '#5a7aa8'))]);
        const t = add(tower, vm, x, y, z, Math.atan2(tr.box.cx - x, tr.box.cz - z));
        const hub = new THREE.Group(); hub.position.set(0, 11.5, 2.9); t.add(hub);
        const blades = [];
        for (let i = 0; i < 4; i++) { blades.push(colored(new THREE.BoxGeometry(0.15, 7.5, 0.1).translate(0, 3.9, 0).rotateZ(i * Math.PI / 2), '#6b4a33'), colored(new THREE.BoxGeometry(1.6, 6, 0.05).translate(0.85, 4.2, 0.05).rotateZ(i * Math.PI / 2), '#e8e0cc')); }
        blades.push(colored(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 10).rotateX(Math.PI / 2), '#6b4a33'));
        const bl = new THREE.Mesh(keep(merge(blades)), vm); bl.castShadow = true; hub.add(bl);
        anim.push((dt, t) => { bl.rotation.z = t * Math.PI * 2 / 6; });
        break;
      }
      case 'barn': {
        const [x, z] = pr.at, y = hAt(x, z) - 0.2;
        const roofS = new THREE.Shape(); roofS.moveTo(-5.8, 0); roofS.lineTo(0, 3.6); roofS.lineTo(5.8, 0); roofS.lineTo(-5.8, 0);
        const roofG = new THREE.ExtrudeGeometry(roofS, { depth: 14.8, bevelEnabled: false }).translate(0, 6, -7.4);
        const g = merge([colored(new THREE.BoxGeometry(10, 6, 14).translate(0, 3, 0), '#c94b3a'), colored(roofG, '#6b4a33'),
          colored(new THREE.BoxGeometry(4.2, 4.4, 0.2).translate(0, 2.2, 7.05), '#f4f0e8'), colored(new THREE.BoxGeometry(3.6, 3.8, 0.25).translate(0, 2.2, 7.1), '#a8392c'),
          colored(new THREE.BoxGeometry(0.25, 5.2, 0.3).rotateZ(0.75).translate(0, 2.2, 7.25), '#f4f0e8'), colored(new THREE.BoxGeometry(0.25, 5.2, 0.3).rotateZ(-0.75).translate(0, 2.2, 7.25), '#f4f0e8')]);
        add(g, vm, x, y, z, pr.rot || 0);
        break;
      }
      case 'sheep': {
        const parts = [];
        for (const [x, y, z, r] of [[0, 0.75, 0, 0.42], [0.3, 0.8, 0.1, 0.36], [-0.3, 0.78, 0.05, 0.36], [0.1, 0.95, 0.2, 0.33], [-0.1, 0.95, -0.2, 0.33], [0.32, 0.7, -0.2, 0.33], [-0.32, 0.7, -0.18, 0.33]]) parts.push(colored(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), '#f7f5ef'));
        for (const [x, z] of [[0.25, 0.2], [-0.25, 0.2], [0.25, -0.2], [-0.25, -0.2]]) parts.push(colored(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5).translate(x, 0.25, z), '#3a3a44'));
        const bodyG = keep(merge(parts));
        const headG = keep(merge([colored(new THREE.SphereGeometry(0.22, 10, 8).scale(1, 0.95, 1.2), '#3a3a44'), colored(new THREE.SphereGeometry(0.1, 8, 6).scale(1.2, 0.5, 0.6).translate(0.2, 0.05, -0.05), '#3a3a44'), colored(new THREE.SphereGeometry(0.1, 8, 6).scale(1.2, 0.5, 0.6).translate(-0.2, 0.05, -0.05), '#3a3a44'),
          colored(new THREE.SphereGeometry(0.035, 6, 5).translate(0.09, 0.06, 0.2), '#ffffff'), colored(new THREE.SphereGeometry(0.035, 6, 5).translate(-0.09, 0.06, 0.2), '#ffffff')]));
        const [cx, cz] = pr.center;
        for (let i = 0; i < pr.n; i++) {
          const sh = new THREE.Group(); root.add(sh);
          const bd = new THREE.Mesh(bodyG, vm); bd.castShadow = true; sh.add(bd);
          const hd = new THREE.Mesh(headG, vm); hd.position.set(0, 0.85, 0.55); sh.add(hd);
          const st = { x: cx + (R() - 0.5) * pr.r, z: cz + (R() - 0.5) * pr.r, tx: 0, tz: 0, yaw: R() * 6.28, wait: R() * 6, eat: 0 };
          st.tx = st.x; st.tz = st.z;
          anim.push((dt, t) => {
            st.wait -= dt;
            if (st.wait < 0) { const a = R() * 6.28, rr = Math.sqrt(R()) * pr.r * 0.8; st.tx = cx + Math.cos(a) * rr; st.tz = cz + Math.sin(a) * rr; st.wait = 8 + R() * 6; st.eat = R() < 0.3 ? 0.8 : 0; }
            const dx = st.tx - st.x, dz = st.tz - st.z, d = Math.hypot(dx, dz);
            if (d > 0.2) { const want = Math.atan2(dx, dz); st.yaw += Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw)) * Math.min(1, dt * 3); st.x += Math.sin(st.yaw) * 0.6 * dt; st.z += Math.cos(st.yaw) * 0.6 * dt; }
            else if (st.eat > 0) st.eat -= dt;
            sh.position.set(st.x, hAt(st.x, st.z) - 0.05 + (d > 0.2 ? Math.abs(Math.sin(t * 8)) * 0.04 : 0), st.z); sh.rotation.y = st.yaw;
            hd.rotation.x = st.eat > 0 ? 0.7 : Math.sin(t * 0.7 + i) * 0.1; hd.position.y = st.eat > 0 ? 0.55 : 0.85;
          });
        }
        if (pr.fence) {
          const post = keep(colored(new THREE.BoxGeometry(0.12, 1.0, 0.12).translate(0, 0.5, 0), '#a7774a')), m = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
          for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, x = cx + Math.cos(a) * (pr.r + 3), z = cz + Math.sin(a) * (pr.r + 3); if (roadD(x, z) < half + course.shoulder + 2) continue; B.add('pfence', post, m, M(x, hAt(x, z), z, a)); }
        }
        break;
      }
      case 'pond': {
        const [cx, cz] = pr.center, y = hAt(cx, cz) + 0.15;
        const g = new THREE.CircleGeometry(pr.r, 40), p = g.attributes.position;
        for (let i = 1; i < p.count; i++) { const k = 1 + noise2(p.getX(i) * 0.2, p.getY(i) * 0.2, 3) * 0.15; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
        g.rotateX(-Math.PI / 2);
        add(g, mat('#5aa9d8', { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.88, envMapIntensity: 1.2 }), cx, y, cz, 0, false);
        add(new THREE.CircleGeometry(pr.r * 1.12, 40).rotateX(-Math.PI / 2), mat('#8a6a4a', { roughness: 1 }), cx, y - 0.05, cz, 0, false);
        for (let i = 0; i < 14; i++) { const a = R() * 6.28, rr = R() * pr.r * 0.85; add(new THREE.CircleGeometry(0.5 + R() * 0.4, 10, 0.3, 5.9).rotateX(-Math.PI / 2), mat('#5cbf4a', { roughness: 0.6 }), cx + Math.cos(a) * rr, y + 0.02, cz + Math.sin(a) * rr, R() * 6, false); }
        const duckG = keep(merge([colored(new THREE.SphereGeometry(0.25, 10, 8).scale(1, 0.75, 1.3), '#ffffff'), colored(new THREE.SphereGeometry(0.14, 8, 6).translate(0, 0.28, 0.22), '#ffffff'), colored(new THREE.ConeGeometry(0.06, 0.14, 6).rotateX(Math.PI / 2).translate(0, 0.26, 0.4), '#ff9f1c'), colored(new THREE.SphereGeometry(0.025, 5, 4).translate(0.07, 0.33, 0.32), '#1d2433'), colored(new THREE.SphereGeometry(0.025, 5, 4).translate(-0.07, 0.33, 0.32), '#1d2433')]));
        for (let i = 0; i < (pr.ducks || 3); i++) {
          const d = new THREE.Mesh(duckG, vm); root.add(d); const r0 = 4 + R() * 5, ph = R() * 6.28, sp = 2 * Math.PI / (34 + R() * 12);
          anim.push((dt, t) => { const a = ph + t * sp; d.position.set(cx + Math.cos(a) * r0, y + 0.05 + Math.sin(t * 2 + i) * 0.02, cz + Math.sin(a) * r0); d.rotation.y = -a; });
        }
        break;
      }
      case 'balloons': {
        const cols = [['#ff6fae', '#ffd23f'], ['#3fa9f5', '#ffffff'], ['#56d364', '#ffd23f']];
        for (let i = 0; i < pr.n; i++) {
          const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, 0.8)) * 6 * (t < 0.15 ? 0.5 + t * 3.3 : 1), t * 14)); }
          const env = new THREE.LatheGeometry(pts, 16).toNonIndexed(), p = env.attributes.position, col = new Float32Array(p.count * 3);
          const ca = new THREE.Color(cols[i][0]), cb = new THREE.Color(cols[i][1]);
          for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)), c = Math.floor((a + Math.PI) / (Math.PI / 4)) % 2 ? ca : cb; col.set([c.r, c.g, c.b], k * 3); }
          env.setAttribute('color', new THREE.BufferAttribute(col, 3)); env.computeVertexNormals();
          const g = new THREE.Group(); const em = new THREE.Mesh(keep(env), vm); em.position.y = 3; g.add(em);
          g.add(new THREE.Mesh(keep(colored(new THREE.BoxGeometry(1.4, 1.2, 1.4), '#a7774a')), vm));
          root.add(g);
          const ang = R() * 6.28, dist = 120 + R() * 160, h = 60 + R() * 30, ph = R() * 6;
          const bx = tr.box.cx + Math.cos(ang) * dist, bz = tr.box.cz + Math.sin(ang) * dist;
          anim.push((dt, t) => { g.position.set(bx + Math.sin(t * 0.03 + ph) * 60, h + Math.sin(t * 0.2 + ph) * 3, bz + Math.cos(t * 0.025 + ph) * 40); });
        }
        break;
      }
      case 'picnic': {
        const pm = keep(new THREE.MeshStandardMaterial({ map: picnicTexture(), roughness: 0.9 }));
        for (const s of pr.s) {
          const p = tr.pos(s, pr.side * (half + course.shoulder + 9), 0, {}), y = hAt(p.x, p.z);
          add(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), pm, p.x, y + 0.03, p.z, R(), false);
          add(merge([colored(new THREE.ConeGeometry(1.8, 0.7, 8).translate(0, 2.6, 0), '#ffd23f'), colored(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0), '#ffffff')]), vm, p.x + 1, y, p.z + 1);
          add(colored(new RoundedBoxGeometry(0.5, 0.35, 0.35, 2, 0.06), '#a7774a'), vm, p.x - 0.6, y + 0.18, p.z - 0.3, R());
        }
        break;
      }
      case 'stands': standsAndCrowd(pr); break;
      case 'flags': {
        const poleG = keep(colored(new THREE.CylinderGeometry(0.05, 0.05, 4, 6).translate(0, 2, 0), '#ffffff'));
        const flagG = new THREE.PlaneGeometry(1.2, 0.8, 6, 2).translate(0.6, 3.5, 0);
        const cols = [course.color, '#ffffff', '#ffd54a'];
        let i = 0;
        for (let s = pr.s0; s < pr.s1; s += pr.step) for (const side of [1, -1]) {
          const ss = tr.wrapS(s), p = tr.pos(ss, side * (half + course.shoulder + 1.2), 0, {}), y = hAt(p.x, p.z);
          B.add('fpole', poleG, vm, M(p.x, y, p.z));
          const f = new THREE.Mesh(flagG.clone(), keep(new THREE.MeshStandardMaterial({ color: cols[i++ % 3], side: THREE.DoubleSide, roughness: 0.8 })));
          f.position.set(p.x, y, p.z); f.rotation.y = tr.yawAt(ss) + Math.PI / 2; root.add(f); keep(f.geometry);
          const base = f.geometry.attributes.position.array.slice(), ph = R() * 6;
          anim.push((dt, t, near) => { if (!near(p, 70)) return; const pa = f.geometry.attributes.position; for (let k = 0; k < pa.count; k++) { const x = base[k * 3]; pa.setZ(k, Math.sin(x * 5 - t * 7 + ph) * 0.12 * x); } pa.needsUpdate = true; });
        }
        break;
      }
      case 'umbrellas': case 'surfboards': case 'crabs': beachRow(pr); break;
      case 'beachhouse': {
        const p = tr.pos(pr.s, pr.side * (half + course.shoulder + 7), 0, {}), y = hAt(p.x, p.z), yaw = tr.yawAt(pr.s) + (pr.side < 0 ? Math.PI / 2 : -Math.PI / 2);
        const g = merge([colored(new THREE.BoxGeometry(8, 3.5, 6).translate(0, 2.55, 0), '#e8d3a8'), colored(new THREE.ConeGeometry(6.2, 2.2, 4).rotateY(Math.PI / 4).scale(1, 1, 0.78).translate(0, 5.4, 0), '#d94a4a'),
          ...[-1.5, 0, 1.5].map(x => colored(new THREE.BoxGeometry(1.3, 1.1, 0.05).translate(x, 3.6, 3.03), '#3fa9f5')),
          ...[[-3.6, -2.6], [3.6, -2.6], [-3.6, 2.6], [3.6, 2.6]].map(([x, z]) => colored(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6).translate(x, 0.4, z), '#8a6a4a'))]);
        add(g, vm, p.x, y, p.z, yaw);
        break;
      }
      case 'lighthouse': {
        const [x, z] = pr.at, y = hAt(x, z) - 0.3;
        const tower = new THREE.CylinderGeometry(2.0, 3.0, 18, 16, 6).translate(0, 9, 0).toNonIndexed(), p = tower.attributes.position, col = new Float32Array(p.count * 3);
        const cw = new THREE.Color('#f7f7f7'), cr = new THREE.Color('#d94a4a');
        for (let i = 0; i < p.count; i++) { const c = Math.floor(p.getY(i) / 3 - 0.001) % 2 ? cr : cw; col.set([c.r, c.g, c.b], i * 3); }
        tower.setAttribute('color', new THREE.BufferAttribute(col, 3));
        for (const k of Object.keys(tower.attributes)) if (!['position', 'normal', 'color'].includes(k)) tower.deleteAttribute(k);
        const g = merge([tower, colored(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 16).translate(0, 18.15, 0), '#2b2f3a'), colored(new THREE.CylinderGeometry(1.6, 1.6, 2.2, 12).translate(0, 19.4, 0), '#fff6c0'), colored(new THREE.ConeGeometry(2.0, 1.6, 12).translate(0, 21.3, 0), '#d94a4a')]);
        const lh = add(g, keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#000' })), x, y, z);
        const beamG = new THREE.ConeGeometry(3.5, 70, 16, 1, true).translate(0, -35, 0).rotateZ(Math.PI / 2);
        const beam = new THREE.Mesh(keep(beamG), keep(new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
        const piv = new THREE.Group(); piv.position.set(x, y + 19.4, z); piv.add(beam); root.add(piv);
        anim.push((dt, t) => { piv.rotation.y = t * Math.PI * 2 / 8; });
        glowPoints([new V3(x, y + 19.4, z)], '#fff6c0', 6);
        break;
      }
      case 'yachts': {
        const hull = keep(merge([colored(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.2, 1.0, 3.2), '#ffffff'), colored(new THREE.CylinderGeometry(0.08, 0.08, 7, 6).translate(0, 3.5, 0.4), '#c8ced8')]));
        const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0.6, 0, 7, 0.5, 0, 0.7, -2.6, 0, 0.6, 0.8, 0, 4.5, 0.75, 0, 0.6, 3.0], 3));
        sail.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 0.25, 0.55, 1, 0.25, 0.55, 1, 0.25, 0.55, 1], 3)); sail.computeVertexNormals(); keep(sail);
        const sm = keep(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }));
        for (let i = 0; i < pr.n; i++) {
          const g = new THREE.Group(); g.add(new THREE.Mesh(hull, vm), new THREE.Mesh(sail, sm)); root.add(g);
          const cx = tr.box.cx + (R() - 0.5) * 300, cz = 230 + R() * 160, r0 = 30 + R() * 40, ph = R() * 6;
          anim.push((dt, t) => { const a = ph + t * 0.8 / r0; g.position.set(cx + Math.cos(a) * r0, Math.sin(t * 0.9 + ph) * 0.15, cz + Math.sin(a) * r0); g.rotation.set(0, -a, Math.sin(t * 0.7 + ph) * 0.08); });
        }
        break;
      }
      case 'buoys': {
        const bg = keep(merge([colored(new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#d94a4a'), colored(new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#ffffff'), colored(new THREE.CylinderGeometry(0.05, 0.05, 1, 5).translate(0, 0.8, 0), '#2b2f3a')]));
        for (let i = 0; i < pr.n; i++) {
          let x, z, tries = 0;
          do { const a = R() * 6.28, rr = pr.r * (0.5 + R() * 0.5); x = pr.around[0] + Math.cos(a) * rr; z = pr.around[1] + Math.sin(a) * rr; } while ((hAt(x, z) > -0.5 || roadD(x, z) < 12) && tries++ < 30);
          const b = new THREE.Mesh(bg, vm); root.add(b); const ph = R() * 6;
          anim.push((dt, t) => { b.position.set(x, Math.sin(t * 1.3 + ph) * 0.2, z); b.rotation.z = Math.sin(t * 1.1 + ph) * 0.1; });
        }
        break;
      }
      case 'gulls': {
        const wg = keep(new THREE.BufferGeometry());
        wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.15, 0.7, 0.05, 0, 0, 0, -0.15, 0, 0, 0.15, -0.7, 0.05, 0, 0, 0, -0.15], 3)); wg.computeVertexNormals();
        const gm = mat('#ffffff', { side: THREE.DoubleSide });
        for (let i = 0; i < pr.n; i++) {
          const g = new THREE.Group(); const L = new THREE.Mesh(wg, gm); g.add(L); root.add(g);
          const cx = tr.box.cx + (R() - 0.5) * 200, cz = 60 + R() * 120, r0 = 20 + R() * 20, h = 25 + R() * 15, ph = R() * 6, sp = 2 * Math.PI / (20 + R() * 10);
          anim.push((dt, t) => { const a = ph + t * sp; g.position.set(cx + Math.cos(a) * r0, h + Math.sin(t * 0.5 + i) * 2, cz + Math.sin(a) * r0); g.rotation.set(0, -a, 0); L.scale.y = 1 + Math.sin(t * 9 + ph) * 3; });
        }
        break;
      }
      case 'snowmen': {
        const g = keep(merge([colored(new THREE.SphereGeometry(0.9, 14, 10).translate(0, 0.8, 0), '#ffffff'), colored(new THREE.SphereGeometry(0.65, 14, 10).translate(0, 1.95, 0), '#ffffff'), colored(new THREE.SphereGeometry(0.45, 12, 9).translate(0, 2.85, 0), '#ffffff'),
          colored(new THREE.ConeGeometry(0.07, 0.35, 6).rotateX(Math.PI / 2).translate(0, 2.85, 0.6), '#ff7a2f'), colored(new THREE.SphereGeometry(0.05, 5, 4).translate(0.14, 2.97, 0.4), '#1d2433'), colored(new THREE.SphereGeometry(0.05, 5, 4).translate(-0.14, 2.97, 0.4), '#1d2433'),
          colored(new THREE.TorusGeometry(0.5, 0.08, 6, 14).rotateX(Math.PI / 2).translate(0, 2.45, 0), '#d94a4a'), colored(new THREE.CylinderGeometry(0.25, 0.3, 0.35, 10).translate(0, 3.35, 0), '#3fa9f5'),
          colored(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4).rotateZ(1.0).translate(0.85, 2.2, 0), '#6b4a33'), colored(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4).rotateZ(-1.0).translate(-0.85, 2.2, 0), '#6b4a33')]));
        for (let i = 0; i < pr.n; i++) { const s = tr.wrapS((i + 0.3 + R() * 0.4) / pr.n * tr.L), side = R() < 0.5 ? 1 : -1, p = tr.pos(s, side * (half + course.shoulder + 4 + R() * 4), 0, {}); if (tr.zoneAt(s) !== ZONE.ground) continue; B.add('snowman', g, vm, M(p.x, hAt(p.x, p.z) - 0.1, p.z, tr.yawAt(s) + Math.PI + (R() - 0.5))); }
        break;
      }
      case 'cabins': {
        const g = keep(merge([colored(new THREE.BoxGeometry(6, 3.4, 5).translate(0, 1.7, 0), '#8a5a3b'), colored(new THREE.CylinderGeometry(3.8, 3.8, 6.6, 3).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).rotateX(0).scale(1, 0.7, 1).translate(0, 4.2, 0), '#5a3a2a'),
          colored(new THREE.CylinderGeometry(3.95, 3.95, 6.8, 3, 1, false, -0.55, 1.1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.72, 1).translate(0, 4.35, 0), '#f4f8fc'),
          colored(new THREE.BoxGeometry(0.6, 1.8, 0.6).translate(1.6, 5.4, 0.8), '#8a8f99'), colored(new THREE.BoxGeometry(1.0, 1.0, 0.1).translate(-1.4, 1.9, 2.55), '#ffd9a0'), colored(new THREE.BoxGeometry(1.0, 1.0, 0.1).translate(1.4, 1.9, 2.55), '#ffd9a0'), colored(new THREE.BoxGeometry(1.2, 2.2, 0.12).translate(0, 1.1, 2.55), '#5a3a2a')]));
        for (const [x, z] of pr.at) { add(g, vm, x, hAt(x, z) - 0.2, z, Math.atan2(tr.box.cx - x, tr.box.cz - z) + (R() - 0.5) * 0.4); ctx.smoke && ctx.smoke(new V3(x + 1.6, hAt(x, z) + 6.4, z + 0.8)); smokes.push(new V3(x, hAt(x, z) + 6.4, z)); }
        break;
      }
      case 'skilift': {
        const [x0, z0] = pr.from, [x1, z1] = pr.to;
        const pts = [];
        for (let i = 0; i < pr.towers; i++) { const t = i / (pr.towers - 1), x = lerp(x0, x1, t), z = lerp(z0, z1, t), y = hAt(x, z); pts.push(new V3(x, y, z)); add(merge([colored(new THREE.BoxGeometry(0.4, 8, 0.4).translate(0, 4, 0), '#c8ced8'), colored(new THREE.BoxGeometry(3.2, 0.25, 0.3).translate(0, 8, 0), '#c8ced8')]), vm, x, y, z, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2); }
        const yaw = Math.atan2(x1 - x0, z1 - z0), off = new V3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(1.2);
        const up = pts.map(p => p.clone().add(off).setY(p.y + 7.9)), dn = pts.map(p => p.clone().sub(off).setY(p.y + 7.9));
        for (const line of [up, dn]) { const g = new THREE.BufferGeometry().setFromPoints(line); root.add(new THREE.Line(keep(g), keep(new THREE.LineBasicMaterial({ color: '#4a4f5c' })))); }
        const chairG = keep(merge([colored(new THREE.BoxGeometry(1.2, 0.1, 0.5).translate(0, -1.6, 0), '#d94a4a'), colored(new THREE.BoxGeometry(1.2, 0.5, 0.08).translate(0, -1.35, -0.22), '#d94a4a'), colored(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4).translate(0, -0.8, 0), '#4a4f5c')]));
        const loop = [...up, ...dn.slice().reverse()]; const segL = []; let tot = 0;
        for (let i = 0; i < loop.length; i++) { const l = loop[i].distanceTo(loop[(i + 1) % loop.length]); segL.push(l); tot += l; }
        for (let c = 0; c < pr.chairs; c++) {
          const ch = new THREE.Mesh(chairG, vm); ch.castShadow = true; root.add(ch);
          anim.push((dt, t) => {
            let d = ((c / pr.chairs) * tot + t * 1.2) % tot, i = 0;
            while (d > segL[i]) { d -= segL[i]; i = (i + 1) % segL.length; }
            const a = loop[i], b = loop[(i + 1) % loop.length], f = d / segL[i];
            ch.position.lerpVectors(a, b, f); ch.rotation.y = yaw + (i >= up.length ? Math.PI : 0);
          });
        }
        break;
      }
      case 'lake': {
        const tex = keep(crackTexture()); tex.repeat.set(4, 4);
        const g = new THREE.CircleGeometry(pr.r, 48).rotateX(-Math.PI / 2);
        add(g, keep(new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', roughness: 0.08, metalness: 0.0, envMapIntensity: 1.0 })), pr.c[0], (course.terrain.lake ? course.terrain.lake.y : 0.2) + 0.05, pr.c[1], 0, false);
        break;
      }
      case 'tunnelgate': {
        const rg = rockGeo(9), rm = mat('#8a93a3', { flatShading: true, roughness: 0.95 });
        for (const s of pr.s) {
          for (let k = 0; k < 9; k++) {
            const a = k / 8 * Math.PI, rr = half + 3.4;
            const f = tr.frame(s, {}), p = tr.pos(s, -Math.cos(a) * rr, Math.sin(a) * rr * 0.82 + 0.5, {});
            const o = new THREE.Mesh(keep(rg.clone()), rm); o.position.set(p.x, p.y, p.z); o.scale.setScalar(2.2 + R() * 1.6); o.rotation.set(R() * 3, R() * 3, R() * 3); o.castShadow = true; root.add(o);
          }
        }
        break;
      }
      case 'skiflags': {
        const fg = keep(merge([colored(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5).translate(0, 0.8, 0), '#ffffff'), colored(new THREE.PlaneGeometry(0.5, 0.4).translate(0.26, 1.35, 0), '#d94a4a')]));
        const fm = keep(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }));
        for (let i = 0; i < pr.n; i++) { const s = tr.wrapS(i * tr.L / pr.n + R() * 4); if (tr.zoneAt(s) !== ZONE.ground) continue; const side = i % 2 ? 1 : -1, p = tr.pos(s, side * (half + course.shoulder + 1.0), 0, {}); B.add('skiflag', fg, fm, M(p.x, hAt(p.x, p.z), p.z, tr.yawAt(s)), i % 3 ? null : '#3fa9f5'); }
        break;
      }
      case 'lamps': cityLamps(pr); break;
      case 'neon': neonSigns(pr); break;
      case 'ferris': ferris(pr); break;
      case 'fireworks': fireworksAt = new V3(...pr.at); break;
      case 'lighttunnel': lightTunnel(pr); break;
      case 'parktrees': parkTrees(pr); break;
      case 'snowfall': snowfall = true; break;
    }
  }
  var fireworksAt = fireworksAt || null, snowfall = snowfall || false;


  // ---------- 観客席と観客 ----------
  function standsAndCrowd(pr) {
    const people = [];
    const standM = mat('#c8ced8', { roughness: 0.7 }), roofM = mat(course.color, { roughness: 0.6 });
    for (const side of [1, -1]) {
      const sMid = tr.wrapS((pr.s0 + pr.s1) / 2), len = pr.s1 - pr.s0;
      const d0 = side * (half + course.shoulder + 4.5);
      const p = tr.pos(sMid, d0, 0, {}), y = hAt(p.x, p.z), yaw = tr.yawAt(sMid);
      const grp = new THREE.Group(); grp.position.set(p.x, y, p.z); grp.rotation.y = yaw; root.add(grp);
      const steps = [];
      for (let k = 0; k < 5; k++) steps.push(new THREE.BoxGeometry(1.2, 0.6 * (k + 1), len).translate(side * (k * 1.2 + 0.6), 0.3 * (k + 1), 0));
      const st = new THREE.Mesh(keep(mergeGeometries(steps)), standM); st.castShadow = true; st.receiveShadow = true; grp.add(st);
      const roof = new THREE.Mesh(keep(new THREE.BoxGeometry(6.6, 0.2, len + 1).translate(side * 3, 5.2, 0)), roofM); roof.castShadow = true; grp.add(roof);
      for (const zz of [-len / 2, len / 2]) for (const xx of [0.2, 6]) { const c = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.12, 5.2, 6).translate(side * xx, 2.6, zz)), standM); grp.add(c); }
      const n = Math.round(len / 0.9) * 5;
      for (let k = 0; k < 5; k++) for (let i = 0; i < len / 0.9; i++) {
        if (R() < 0.12) continue;
        people.push({ grp, x: side * (k * 1.2 + 0.6), y: 0.6 * (k + 1), z: -len / 2 + 0.45 + i * 0.9 + (R() - 0.5) * 0.2, ph: R() * 6, c: R.pick(['#ff6fae', '#3fa9f5', '#ffd23f', '#56d364', '#ff7a2f', '#b18cff', '#ffffff', '#2b2f3a']), skin: R.pick(['#ffd9b8', '#e8b48a', '#a8744a']), wave: R() < 0.3, yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
    const bodyG = keep(new THREE.CapsuleGeometry(0.2, 0.36, 3, 8).translate(0, 0.42, 0)), headG = keep(new THREE.SphereGeometry(0.19, 10, 8).translate(0, 0.98, 0));
    const bm = mat('#ffffff', { roughness: 0.8 });
    const bIM = new THREE.InstancedMesh(bodyG, bm, people.length), hIM = new THREE.InstancedMesh(headG, bm, people.length);
    people.forEach((pp, i) => { bIM.setColorAt(i, new THREE.Color(pp.c)); hIM.setColorAt(i, new THREE.Color(pp.skin)); });
    bIM.castShadow = true; root.add(bIM, hIM);
    const lights = pr.penlights ? new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.07, 6, 5)), keep(new THREE.MeshBasicMaterial({ color: '#ffffff' })), people.length) : null;
    if (lights) { people.forEach((pp, i) => lights.setColorAt(i, new THREE.Color(R.pick(['#ff6fae', '#7fe0ff', '#ffd54a', '#9dff7a', '#c89bff'])))); root.add(lights); }
    const wp = new V3(), dm = new THREE.Object3D();
    crowd = { people, update(dt, t, energy) {
      people.forEach((pp, i) => {
        const e = energy * (pp.wave ? 1.2 : 1);
        dm.position.set(pp.x, pp.y + Math.abs(Math.sin(t * 6 + pp.ph)) * 0.12 * e, pp.z);
        dm.rotation.set(0, pp.yaw, 0); dm.scale.setScalar(1);
        dm.updateMatrix(); dm.matrix.premultiply(pp.grp.matrixWorld);
        bIM.setMatrixAt(i, dm.matrix); hIM.setMatrixAt(i, dm.matrix);
        if (lights) { dm.position.set(pp.x + Math.sin(t * 5 + pp.ph) * 0.25, pp.y + 1.5 + Math.abs(Math.sin(t * 5 + pp.ph)) * 0.2, pp.z); dm.updateMatrix(); dm.matrix.premultiply(pp.grp.matrixWorld); lights.setMatrixAt(i, dm.matrix); }
      });
      bIM.instanceMatrix.needsUpdate = true; hIM.instanceMatrix.needsUpdate = true; if (lights) lights.instanceMatrix.needsUpdate = true;
    }, center: tr.pos(tr.wrapS((pr.s0 + pr.s1) / 2), 0, 0, new V3()) };
    root.updateMatrixWorld(true);
    bIM.computeBoundingSphere(); hIM.computeBoundingSphere();
  }
  var crowd = crowd || null;

  function beachRow(pr) {
    const n = pr.n;
    for (let i = 0; i < n; i++) {
      const s = lerp(pr.s0, pr.s1, (i + R()) / n), d = pr.side * (half + course.shoulder + 3 + R() * 9);
      const p = tr.pos(s, d, 0, {}); const y = hAt(p.x, p.z);
      if (y < 0.4) continue;
      if (pr.kind === 'umbrellas') {
        const cA = R.pick(['#d94a4a', '#3fa9f5', '#ffd23f']);
        const cone = new THREE.ConeGeometry(1.6, 0.7, 8, 1).toNonIndexed(), cp = cone.attributes.position, col = new Float32Array(cp.count * 3);
        for (let k = 0; k < cp.count; k += 3) { const c = new THREE.Color((k / 3) % 2 ? cA : '#ffffff'); for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (k + j) * 3); }
        cone.setAttribute('color', new THREE.BufferAttribute(col, 3)); for (const kk of Object.keys(cone.attributes)) if (!['position', 'normal', 'color'].includes(kk)) cone.deleteAttribute(kk);
        cone.translate(0, 2.55, 0);
        add(merge([cone, colored(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0), '#ffffff')]), vm, p.x, y - 0.1, p.z, 0);
        const ch = merge([colored(new THREE.BoxGeometry(0.6, 0.06, 1.2).rotateX(-0.1).translate(0, 0.35, 0), '#3fa9f5'), colored(new THREE.BoxGeometry(0.6, 0.06, 0.6).rotateX(-1.0).translate(0, 0.55, -0.75), '#ffffff')]);
        add(ch, vm, p.x + 1.2, y, p.z + 0.4, R() * 6, true);
      } else if (pr.kind === 'surfboards') {
        const b = merge([colored(new THREE.SphereGeometry(1, 12, 6).scale(0.3, 1.2, 0.05).translate(0, 1.0, 0), R.pick(['#ff7a2f', '#3fa9f5', '#ffd23f', '#56d364'])), colored(new THREE.BoxGeometry(0.04, 2.2, 0.06).translate(0, 1.0, 0.02), '#ffffff')]);
        add(b, vm, p.x, y - 0.15, p.z, R() * 6).rotation.z = (R() - 0.5) * 0.3;
      } else if (pr.kind === 'crabs') {
        const cg = merge([colored(new THREE.SphereGeometry(0.25, 10, 6).scale(1, 0.5, 0.8), '#e8483b'), colored(new THREE.SphereGeometry(0.09, 6, 5).translate(0.3, 0.05, 0.15), '#e8483b'), colored(new THREE.SphereGeometry(0.09, 6, 5).translate(-0.3, 0.05, 0.15), '#e8483b'),
          colored(new THREE.SphereGeometry(0.04, 5, 4).translate(0.08, 0.2, 0.15), '#1d2433'), colored(new THREE.SphereGeometry(0.04, 5, 4).translate(-0.08, 0.2, 0.15), '#1d2433')]);
        const c = add(cg, vm, p.x, y, p.z, R() * 6, false); const base = c.position.clone(), ph = R() * 6, yaw = c.rotation.y;
        let hide = 0;
        anim.push((dt, t, near, karts) => {
          const k = Math.sin(t * 0.5 + ph) * 3;
          c.position.set(base.x + Math.cos(yaw) * k, base.y, base.z - Math.sin(yaw) * k);
          if (karts) for (const kt of karts) if (kt.wpos && kt.wpos.distanceToSquared(c.position) < 64) hide = 10;
          hide = Math.max(0, hide - dt);
          const sc = hide > 9.7 ? (hide - 9.7) / 0.3 : hide > 0 ? 0.001 : 1;
          c.scale.setScalar(Math.max(0.001, sc));
        });
      }
    }
  }

  function buildings(cfg) {
    const geo = keep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const bm = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, metalness: 0.1 }));
    bm.onBeforeCompile = sh => {
      sh.uniforms.uSeed = U.windowSeed;
      // 窓は 建物ごとの 向きと 大きさに そろえる（世界座標だと 回した建物で 窓が くずれる）
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLNor; attribute float aBid; varying float vBid;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec3 bsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));\nvLoc = transformed * bsc + vec3(0.0, instanceMatrix[3].y, 0.0);\nvLNor = objectNormal;\nvBid = aBid;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLNor; varying float vBid; uniform float uSeed;\nfloat h2(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\nfloat band(float x, float a, float b, float w){ return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x); }')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // 補間で わずかに ずれた 番号は ハッシュで ざらつきになるので、整数に もどす
          float bidF = floor(vBid + 0.5) * 7.31;
          vec3 an = abs(vLNor);
          float side = step(0.5, an.y);
          float u = an.x > an.z ? vLoc.z * sign(vLNor.x) + 31.0 : -vLoc.x * sign(vLNor.z);
          float v = vLoc.y;
          vec2 g = vec2(u / 2.6, v / 3.4);
          vec2 cell = floor(g), f = fract(g);
          vec2 fw = fwidth(g);
          vec2 aa = clamp(fw * 0.9, 0.0001, 0.5);
          float win = band(f.x, 0.18, 0.82, aa.x) * band(f.y, 0.25, 0.78, aa.y) * (1.0 - side) * step(2.0, v);
          float r = h2(vec3(cell, bidF + floor(uSeed + h2(vec3(cell, bidF)) * 3.0)));
          float lit = step(0.5, r) * step(0.25, h2(vec3(0.0, cell.y, bidF)));
          vec3 wc = mix(vec3(1.0, 0.8, 0.5), vec3(0.72, 0.88, 1.0), step(0.82, fract(r * 7.0)));
          // 遠くは 窓が つぶれて ざらつくので 平均の 明るさへ ならす
          float far = smoothstep(0.22, 0.55, max(fw.x, fw.y));
          float em = mix(win * lit * (0.75 + 0.5 * fract(r * 13.0)), 0.14, far) * (1.0 - side) * step(2.0, v);
          totalEmissiveRadiance += em * wc;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.06, 0.14), win * (1.0 - lit) * (1.0 - far));`);
    };
    const list = [];
    const cell = 24;
    for (let x = X0; x < X1; x += cell) for (let z = Z0; z < Z1; z += cell) {
      const cx = x + cell / 2, cz = z + cell / 2;
      const d = roadD(cx, cz);
      if (d < cfg.minD + 6) continue;
      if (cfg.avoidRiver && course.water && Math.abs(cz - course.water.river.z) < cfg.avoidRiver + 8) continue;
      const P = course.terrain.park;
      if (cfg.avoidPark && P && cx > P.x0 - 6 && cx < P.x1 + 6 && cz > P.z0 - 6 && cz < P.z1 + 6) continue;
      if (blocked(cx, cz, 12)) continue;
      const w = 12 + R() * 8, dep = 12 + R() * 8, far = clamp((d - 20) / 120, 0, 1);
      const h = lerp(cfg.h[0], cfg.h[1], Math.pow(R(), 1.6) * 0.7 + far * 0.3);
      const nr = tr.nearestGroundIndex(cx, cz), yaw = tr.yaw[nr];
      list.push({ cx, cz, w, dep, h, yaw, d });
    }
    list.sort((a, b) => a.d - b.d);
    const n = Math.min(cfg.n[qi], list.length);
    const im = new THREE.InstancedMesh(geo, bm, n);
    const bid = new Float32Array(n);
    const bcol = ['#262b45', '#2d3350', '#1f2440', '#30304a'];
    for (let i = 0; i < n; i++) {
      const b = list[i];
      im.setMatrixAt(i, M(b.cx, -0.5, b.cz, b.yaw, 1).multiply(new THREE.Matrix4().makeScale(b.w, b.h + 0.5, b.dep)));
      im.setColorAt(i, new THREE.Color(R.pick(bcol)));
      bid[i] = i;
    }
    geo.setAttribute('aBid', new THREE.InstancedBufferAttribute(bid, 1));
    im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true;
    root.add(im);
    cityBuildings = list.slice(0, n);
    // 窓の 明かりを ときどき 変える
    let acc = 0;
    anim.push(dt => { acc += dt; if (acc > 10) { acc = 0; U.windowSeed.value += 0.31; } });
  }
  var cityBuildings = cityBuildings || [];

  function cityLamps(pr) {
    const poleG = keep(merge([colored(new THREE.CylinderGeometry(0.1, 0.12, 6, 8).translate(0, 3, 0), '#4a5068'), colored(new THREE.BoxGeometry(0.1, 0.1, 1.6).translate(0, 6, 0.75), '#4a5068')]));
    const headG = keep(new THREE.BoxGeometry(0.6, 0.15, 0.3).translate(0, 5.95, 1.5));
    const hm = keep(new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffd9a0', emissiveIntensity: 2.0 }));
    const pts = [];
    for (let s = 0; s < tr.L; s += pr.step) for (const side of [1, -1]) {
      const ss = tr.wrapS(s + (side > 0 ? 0 : pr.step / 2)), z = tr.zoneAt(ss);
      if (z === ZONE.tunnel) continue;
      const d = side * (tr.wAt(ss) / 2 + (z === ZONE.ground ? tr.shoulderAt(ss) + 0.5 : 0.6));
      const p = tr.pos(ss, d, 0, {}), y = z === ZONE.ground ? hAt(p.x, p.z) + 0.14 : p.y + 0.7;
      const yaw = tr.yawAt(ss) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      B.add('lampPole', poleG, vm, M(p.x, y, p.z, yaw));
      B.add('lampHead', headG, hm, M(p.x, y, p.z, yaw), null, { cast: false });
      const hp = new V3(0, 5.85, 1.5).applyAxisAngle(_up, yaw).add(new V3(p.x, y, p.z));
      pts.push(hp);
    }
    glowPoints(pts, '#ffd9a0', 2.2);
    cityLampPts = pts;
  }
  var cityLampPts = cityLampPts || [];

  function neonSigns(pr) {
    const shapes = {
      star: () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.42 : 1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; },
      heart: () => { const s = new THREE.Shape(); s.moveTo(0, -0.9); s.bezierCurveTo(-1.3, 0, -0.8, 1.0, 0, 0.45); s.bezierCurveTo(0.8, 1.0, 1.3, 0, 0, -0.9); return s; },
      note: () => { const s = new THREE.Shape(); s.absellipse(-0.3, -0.6, 0.38, 0.28, 0, Math.PI * 2); s.moveTo(-0.0, -0.6); s.lineTo(0.08, 0.9); s.lineTo(0.7, 0.6); s.lineTo(0.7, 0.4); s.lineTo(0.16, 0.65); s.lineTo(0.08, -0.6); return s; },
      arrow: () => { const s = new THREE.Shape(); s.moveTo(-1, -0.3); s.lineTo(0.2, -0.3); s.lineTo(0.2, -0.75); s.lineTo(1, 0); s.lineTo(0.2, 0.75); s.lineTo(0.2, 0.3); s.lineTo(-1, 0.3); return s; },
      bolt: () => { const s = new THREE.Shape(); s.moveTo(0.2, 1); s.lineTo(-0.5, -0.05); s.lineTo(0.0, -0.05); s.lineTo(-0.25, -1); s.lineTo(0.55, 0.15); s.lineTo(0.05, 0.15); s.lineTo(0.2, 1); return s; },
      moon: () => { const s = new THREE.Shape(); s.absarc(0, 0, 1, 0.6, Math.PI * 2 - 0.6, false); s.absarc(0.45, 0, 0.75, Math.PI * 2 - 0.9, 0.9, true); return s; }
    };
    const keys = Object.keys(shapes), cols = ['#ff6fae', '#7fe0ff', '#ffd54a', '#9dff7a', '#c89bff', '#ff8f5a'];
    const geos = keys.map(k => keep(new THREE.ShapeGeometry(shapes[k](), 12)));
    const signs = [];
    const cand = cityBuildings.filter(b => b.d < 60).slice(0, pr.n * 2);
    for (let i = 0; i < Math.min(pr.n, cand.length); i++) {
      const b = cand[i * 2 % cand.length], k = i % keys.length, c = cols[(i * 5) % cols.length];
      const nr = tr.nearestGroundIndex(b.cx, b.cz), tx = tr.px[nr] - b.cx, tz = tr.pz[nr] - b.cz;
      const yaw = Math.atan2(tx, tz);
      // ビルの 道がわの 面に
      const local = new V3(Math.sin(yaw - b.yaw), 0, Math.cos(yaw - b.yaw));
      const ax = Math.abs(local.x) > Math.abs(local.z);
      const off = ax ? new V3(Math.sign(local.x) * (b.w / 2 + 0.15), 0, 0) : new V3(0, 0, Math.sign(local.z) * (b.dep / 2 + 0.15));
      const faceYaw = b.yaw + (ax ? Math.sign(local.x) * Math.PI / 2 : (local.z > 0 ? 0 : Math.PI));
      off.applyAxisAngle(_up, b.yaw);
      const m = keep(new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, fog: true }));
      const o = new THREE.Mesh(geos[k], m);
      const sz = 1.4 + R() * 1.4;
      o.position.set(b.cx + off.x, Math.min(b.h - 3, 8 + R() * 10), b.cz + off.z); o.rotation.y = faceYaw; o.scale.setScalar(sz);
      root.add(o);
      glowPoints([o.position.clone()], c, sz * 4);
      signs.push({ m, base: new THREE.Color(c), k: 1, target: 1, t: R() * 3 });
    }
    anim.push(dt => { for (const s of signs) { s.t -= dt; if (s.t < 0) { s.t = 2 + R() * 2; s.target = 0.7 + R() * 0.3; } s.k += (s.target - s.k) * Math.min(1, dt); s.m.color.copy(s.base).multiplyScalar(s.k * 1.6); } });
  }

  function ferris(pr) {
    const [x, z] = pr.at, r0 = pr.r, y0 = hAt(x, z) + r0 + 4;
    const g = new THREE.Group(); g.position.set(x, y0, z); root.add(g);
    g.rotation.y = Math.atan2(tr.box.cx - x, tr.box.cz - z) + Math.PI / 2;
    const wheel = new THREE.Group(); g.add(wheel);
    const rimM = mat('#e8ecf5', { roughness: 0.4, metalness: 0.5 });
    const parts = [];
    for (const zz of [-1.5, 1.5]) { parts.push(new THREE.TorusGeometry(r0, 0.35, 8, 64).translate(0, 0, zz).toNonIndexed()); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; parts.push(new THREE.CylinderGeometry(0.1, 0.1, r0, 5).translate(0, r0 / 2, 0).rotateZ(a).translate(0, 0, zz).toNonIndexed()); } }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; parts.push(new THREE.CylinderGeometry(0.08, 0.08, 3, 5).rotateX(Math.PI / 2).translate(Math.cos(a) * r0, Math.sin(a) * r0, 0).toNonIndexed()); }
    parts.push(new THREE.CylinderGeometry(0.8, 0.8, 3.6, 12).rotateX(Math.PI / 2).toNonIndexed());
    const wm = new THREE.Mesh(keep(mergeGeometries(parts.map(p => { for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal') p.deleteAttribute(k); return p; }))), rimM);
    wheel.add(wm);
    for (const zz of [-3, 3]) for (const sx of [-1, 1]) { const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.4, 0.6, r0 + 6, 8)), rimM); leg.position.set(sx * (r0 + 4) * 0.28, -(r0 + 4) / 2, zz); leg.rotation.z = sx * 0.3; g.add(leg); }
    const base = new THREE.Mesh(keep(new RoundedBoxGeometry(14, 2, 10, 2, 0.4)), mat('#3a3f52')); base.position.y = -r0 - 3.5; g.add(base);
    const gonds = [], gcols = ['#ff6fae', '#7fe0ff', '#ffd54a', '#9dff7a', '#c89bff', '#ff8f5a'];
    for (let i = 0; i < 16; i++) { const gd = new THREE.Mesh(keep(new RoundedBoxGeometry(2.2, 2.0, 2.2, 2, 0.4)), mat(gcols[i % 6], { roughness: 0.5, emissive: gcols[i % 6], emissiveIntensity: night ? 0.35 : 0 })); g.add(gd); gonds.push(gd); }
    const lp = [];
    for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; lp.push(new V3(Math.cos(a) * (r0 + 0.4), Math.sin(a) * (r0 + 0.4), 1.7)); }
    const lg = new THREE.BufferGeometry().setFromPoints(lp), lc = new Float32Array(64 * 3);
    lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    const lmat = keep(new THREE.PointsMaterial({ size: 1.6, map: GT(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const lpts = new THREE.Points(keep(lg), lmat); wheel.add(lpts);
    const tmpC = new THREE.Color();
    anim.push((dt, t) => {
      const a = t * Math.PI * 2 / 90;
      wheel.rotation.z = a;
      gonds.forEach((gd, i) => { const b = a + i / 16 * Math.PI * 2; gd.position.set(Math.cos(b) * r0, Math.sin(b) * r0 - 1.6, 0); });
      for (let i = 0; i < 64; i++) { tmpC.setHSL((i / 64 + t * 0.1) % 1, 0.9, 0.6); lc[i * 3] = tmpC.r; lc[i * 3 + 1] = tmpC.g; lc[i * 3 + 2] = tmpC.b; }
      lg.attributes.color.needsUpdate = true;
    });
  }

  function lightTunnel(pr) {
    const arcs = [];
    for (let s = pr.s0; s <= pr.s1; s += pr.step) {
      const g = new THREE.TorusGeometry(tr.wAt(s) / 2 + 1.5, 0.15, 6, 32, Math.PI);
      const m = keep(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      const o = new THREE.Mesh(keep(g), m);
      const p = tr.pos(s, 0, 0, {}); o.position.set(p.x, p.y, p.z); o.rotation.y = tr.yawAt(s) + Math.PI / 2;
      root.add(o); arcs.push({ m, i: arcs.length });
    }
    const tmpC = new THREE.Color();
    anim.push((dt, t) => { for (const a of arcs) { tmpC.setHSL(((a.i / 11 - t * 0.25) % 1 + 1) % 1, 0.85, 0.62); a.m.color.copy(tmpC).multiplyScalar(1.5); } });
  }

  function parkTrees(pr) {
    const TG = treeGeos();
    const tm = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })), lm = keep(new THREE.MeshStandardMaterial({ vertexColors: true, color: '#1f4a2a', roughness: 0.8 }));
    const P = course.terrain.park, pts = [];
    for (let i = 0; i < pr.n; i++) {
      const x = lerp(P.x0 + 5, P.x1 - 5, R()), z = lerp(P.z0 + 5, P.z1 - 5, R());
      if (blocked(x, z, 4)) continue;
      const y = hAt(x, z), s = 0.6 + R() * 0.3;
      B.add('ptrunk', TG.trunk, tm, M(x, y, z, R() * 6, s)); B.add('pleaf', TG.leaves, lm, M(x, y, z, R() * 6, s), '#2a5a3a');
      for (let k = 0; k < 6; k++) pts.push(new V3(x + (R() - 0.5) * 3 * s, y + (2.5 + R() * 2.5) * s, z + (R() - 0.5) * 3 * s));
    }
    glowPoints(pts, '#ffd9a0', 0.7);
  }

  // ---------- 光の玉（加算の点を まとめて） ----------
  let glowMesh = null;
  function GT() { return GLOWTEX || (GLOWTEX = glowTexture()); }
  const finishGlow = () => {
    if (!glow.length) return;
    const pos = new Float32Array(glow.length * 3), col = new Float32Array(glow.length * 3), size = new Float32Array(glow.length);
    glow.forEach((g, i) => { pos.set([g.p.x, g.p.y, g.p.z], i * 3); col.set([g.c.r, g.c.g, g.c.b], i * 3); size[i] = g.s; });
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = keep(new THREE.ShaderMaterial({
      uniforms: { uMap: { value: GT() }, uScale: { value: 400 } },
      vertexShader: `attribute float aSize; attribute vec3 color; varying vec3 vC; uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb * t.a * 0.9, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    glowMesh = new THREE.Points(geo, m); glowMesh.frustumCulled = false; root.add(glowMesh);
  };

  B.build();
  finishGlow();
  W.scene.add(root);

  // ---------- 煙・雪・花火の 予定は fx に まかせる ----------
  const near = (p, r) => !ctx.camPos || (ctx.camPos.x - p.x) ** 2 + (ctx.camPos.z - p.z) ** 2 < r * r;
  return {
    root, crowd, fireworksAt, snowfall, smokes, cityLampPts,
    update(dt, t, karts, cam) {
      if (cam) ctx.camPos = cam.position;
      if (glowMesh) glowMesh.material.uniforms.uScale.value = innerHeight / (2 * Math.tan((cam ? cam.fov : 60) * Math.PI / 360));
      for (const f of anim) f(dt, t, near, karts);
      if (crowd) {
        const pl = karts && karts.find(k => k.isPlayer);
        let e = 0.25;
        if (pl && pl.wpos) { const d = pl.wpos.distanceTo(crowd.center); e = d < 40 ? 1 : d < 90 ? 0.5 : 0.25; }
        if (this.cheer) e = 1.5;
        if (!cam || cam.position.distanceTo(crowd.center) < 220) crowd.update(dt, t, e);
      }
    },
    dispose() { W.scene.remove(root); root.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry) o.geometry.dispose(); }); disposables.forEach(d => d.dispose && d.dispose()); }
  };
}
let GLOWTEX = null;
