// 道ぞいの物と 景色の物（第11〜14部、付録I・BB・BF・BS・EC）。まっすぐの 道に そって 置く
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from './config.js';
import { rng, lerp, clamp, noise2, smoothstep } from './util.js';
import { U } from './world.js';
import { colored, merge, M, V3, Chunks, windMat, flutterMat, withAttr } from './build.js';
import { crackTexture, picnicTexture, neonTexture, streakTexture } from './tex.js';
import { shoreX } from './terrain.js';
import { CHARS, CHAR_IDS } from './models.js';

const QUAL = { high: 0, mid: 1, low: 2 };
const _up = new V3(0, 1, 0);

// ---------- 形の 部品（グランプリから） ----------
function treeGeos() {
  const trunk = colored(new THREE.CylinderGeometry(0.18, 0.26, 2.6, 7).translate(0, 1.3, 0), '#7a5230');
  const leaves = [];
  for (const [s, x, y, z] of [[2.1, 0, 3.4, 0], [1.8, 0.9, 3.0, 0.4], [1.6, -0.7, 3.2, -0.5], [1.3, 0.2, 4.4, -0.2]]) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + noise2(p.getX(i) * 3 + x, p.getZ(i) * 3 + z, 4) * 0.08; p.setXYZ(i, p.getX(i) * k * s, p.getY(i) * k * s * 0.92, p.getZ(i) * k * s); }
    g.translate(x, y, z);
    leaves.push(g.index ? g.toNonIndexed() : g);
  }
  const lg = mergeGeometries(leaves);
  const p = lg.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = clamp(0.78 + (p.getY(i) - 2.6) * 0.12, 0.7, 1.14); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
  lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(lg.attributes)) if (!['position', 'normal', 'color'].includes(k)) lg.deleteAttribute(k);
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
    const pos = [], cc = [], Ln = 3.2, n = 10, gC = new THREE.Color('#3b8a3f'), tC = new THREE.Color('#63c35a');
    for (let i = 0; i <= n; i++) {
      const t = i / n, w = 0.45 * Math.pow(Math.sin(Math.PI * t), 0.7) + 0.02;
      const along = t * Ln, y = 0.6 * Math.sin(t * Math.PI * 0.8) - 0.9 * t * t + tilt * t;
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
  return { trunk, leaves: mergeGeometries(leaves), top };
}
function grassGeo(dark, light) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3, h = 0.42, w = 0.16;
    const g = new THREE.BufferGeometry();
    const ca = new THREE.Color(dark), cb = new THREE.Color(light);
    g.setAttribute('position', new THREE.Float32BufferAttribute([-Math.cos(a) * w / 2, 0, -Math.sin(a) * w / 2, Math.cos(a) * w / 2, 0, Math.sin(a) * w / 2, Math.cos(a) * 0.08, h, Math.sin(a) * 0.08], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([ca.r, ca.g, ca.b, ca.r, ca.g, ca.b, cb.r, cb.g, cb.b], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    parts.push(g);
  }
  return mergeGeometries(parts);
}
function flowerGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; parts.push(colored(new THREE.CircleGeometry(0.07, 7).scale(1.2, 0.85, 1).rotateX(-Math.PI / 2).translate(Math.cos(a) * 0.08, 0.3, Math.sin(a) * 0.08), '#ffffff')); }
  parts.push(colored(new THREE.CircleGeometry(0.04, 8).rotateX(-Math.PI / 2).translate(0, 0.302, 0), '#ffd23f'));
  parts.push(colored(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3).translate(0, 0.15, 0), '#3f8a3a'));
  return mergeGeometries(parts);
}
function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (noise2(p.getX(i) * 2 + seed, p.getZ(i) * 2, seed) * 0.3); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.6, p.getZ(i) * k); }
  g.computeVertexNormals();
  return g;
}

// ---------- 観客（スタンド と 道ぞい） ----------
class Crowd {
  constructor(root, penlights) { this.root = root; this.p = []; this.penlights = penlights; this.cheerT = 0; this.acc = 0; }
  add(o) { this.p.push(o); }
  build() {
    const n = this.p.length; if (!n) return;
    const bodyG = new THREE.CapsuleGeometry(0.2, 0.42, 2, 7).translate(0, 0.62, 0);
    const headG = new THREE.SphereGeometry(0.17, 9, 7).translate(0, 1.18, 0);
    const armG = new THREE.CapsuleGeometry(0.055, 0.34, 1, 5).translate(0, -0.2, 0);
    const flagG = new THREE.PlaneGeometry(0.36, 0.24).translate(0.2, 0.22, 0);
    const stickG = new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4).translate(0, 0.1, 0);
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 });
    const fm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: THREE.DoubleSide });
    this.keep = [bodyG, headG, armG, flagG, stickG, m, fm];
    this.body = new THREE.InstancedMesh(bodyG, m, n); this.head = new THREE.InstancedMesh(headG, m, n);
    this.armL = new THREE.InstancedMesh(armG, m, n); this.armR = new THREE.InstancedMesh(armG, m, n);
    const flags = this.p.filter(q => q.flag); this.flagN = flags.length;
    this.flag = new THREE.InstancedMesh(flagG, fm, Math.max(1, flags.length)); this.stick = new THREE.InstancedMesh(stickG, m, Math.max(1, flags.length));
    this.p.forEach((q, i) => {
      const c = new THREE.Color(q.c), sk = new THREE.Color(q.skin);
      this.body.setColorAt(i, c); this.head.setColorAt(i, sk); this.armL.setColorAt(i, sk); this.armR.setColorAt(i, sk);
    });
    flags.forEach((q, i) => { q.fi = i; this.flag.setColorAt(i, new THREE.Color(q.flag)); this.stick.setColorAt(i, new THREE.Color('#e8e2d4')); });
    if (this.penlights) {
      const lg = new THREE.SphereGeometry(0.06, 6, 5).translate(0, -0.42, 0), lm = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      this.keep.push(lg, lm);
      this.light = new THREE.InstancedMesh(lg, lm, n);
      this.p.forEach((q, i) => this.light.setColorAt(i, new THREE.Color(q.pen).multiplyScalar(2.2)));
    }
    for (const im of [this.body, this.head, this.armL, this.armR, this.flag, this.stick, this.light]) { if (!im) continue; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.castShadow = im === this.body; im.receiveShadow = true; this.root.add(im); }
    this.dm = new THREE.Object3D();
    this.update(0, 0, () => 0.3, true);
    for (const im of [this.body, this.head, this.armL, this.armR, this.flag, this.stick, this.light]) if (im) im.computeBoundingSphere();
  }
  // energy(q)：0〜1.5（近くを 走れば 大きく）
  update(dt, t, energy, force = false) {
    if (!this.body) return;
    this.acc += dt; if (!force && this.acc < 1 / 40) return; this.acc = 0;
    if (this.cheerT > 0) this.cheerT -= dt;
    const d = this.dm, cheer = this.cheerT > 0;
    const sh = new V3();
    this.p.forEach((q, i) => {
      const e = Math.min(1.6, energy(q) * (q.kind === 'jump' ? 1.2 : 1) + (cheer ? 1 : 0));
      const hop = Math.max(0, Math.sin(t * (6 + q.ph % 2) + q.ph)) * 0.14 * e;
      d.position.set(q.x, q.y + hop, q.z); d.rotation.set(0, q.yaw, 0); d.scale.setScalar(q.sc);
      d.updateMatrix();
      this.body.setMatrixAt(i, d.matrix); this.head.setMatrixAt(i, d.matrix);
      // うで（肩の 位置で 回す）
      const up = cheer ? 2.7 : e > 0.6 ? (q.kind === 'wave' || q.kind === 'flag' ? 2.6 : 1.2 * e) : 0.15;
      for (const side of [-1, 1]) {
        const raise = side > 0 ? up + (q.kind === 'wave' || cheer ? Math.sin(t * 9 + q.ph) * 0.35 : 0) : (cheer ? up : e > 0.9 ? 2.4 : 0.12);
        sh.set(side * 0.24, 1.0, 0).multiplyScalar(q.sc).applyAxisAngle(_up, q.yaw);
        d.position.set(q.x + sh.x, q.y + hop + sh.y, q.z + sh.z);
        d.rotation.set(0, q.yaw, side * raise, 'YXZ'); d.scale.setScalar(q.sc); d.updateMatrix();
        (side > 0 ? this.armR : this.armL).setMatrixAt(i, d.matrix);
        if (side > 0 && q.fi != null) {
          // 旗は 右手の 先に
          const tip = new V3(0, -0.42, 0).applyAxisAngle(new V3(0, 0, 1), side * raise).multiplyScalar(q.sc).applyAxisAngle(_up, q.yaw);
          d.position.set(q.x + sh.x + tip.x, q.y + hop + sh.y + tip.y, q.z + sh.z + tip.z); d.rotation.set(0, q.yaw, Math.sin(t * 8 + q.ph) * 0.3, 'YXZ'); d.updateMatrix();
          this.flag.setMatrixAt(q.fi, d.matrix); this.stick.setMatrixAt(q.fi, d.matrix);
        }
        if (side > 0 && this.light) this.light.setMatrixAt(i, (side > 0 ? this.armR : this.armL).instanceMatrix ? (d.position.set(q.x + sh.x, q.y + hop + sh.y, q.z + sh.z), d.rotation.set(0, q.yaw, raise, 'YXZ'), d.updateMatrix(), d.matrix) : d.matrix);
      }
    });
    for (const im of [this.body, this.head, this.armL, this.armR, this.flag, this.stick, this.light]) if (im) im.instanceMatrix.needsUpdate = true;
  }
  cheer(t = 3) { this.cheerT = t; }
  setVisible(v) { for (const im of [this.body, this.head, this.armL, this.armR, this.flag, this.stick, this.light]) if (im) im.visible = v; }
  dispose() { for (const im of [this.body, this.head, this.armL, this.armR, this.flag, this.stick, this.light]) if (im) im.dispose(); (this.keep || []).forEach(k => k.dispose()); }
}
const SKINS = ['#ffd9b8', '#f2c49a', '#e8b48a', '#c98f62', '#a8744a'];
const SHIRTS = ['#ff6fae', '#3fa9f5', '#ffd23f', '#56d364', '#ff7a2f', '#b18cff', '#ffffff', '#2b2f3a', '#e8483b', '#45c8e0'];
const PENS = ['#ff6fae', '#7fe0ff', '#ffd54a', '#9dff7a', '#c89bff'];

// ================= 景色を 組み立てる =================
// ground：terrain の { heightAtS }、glow：GlowPoints、fx：{ smoke(pos) } など
export function buildScenery(course, L, H, ground, quality, glow) {
  const root = new THREE.Group(); root.name = 'scenery';
  const big = new THREE.Group(); big.name = 'sceneryBig'; root.add(big);     // 遠くの 大きな物（区画で 消さない）
  const ch = new Chunks(root), keep = [];
  const K = (o) => { keep.push(o); return o; };
  const qi = QUAL[quality] ?? 1;
  const C = CFG.course, S = course.scenery, T = course.terrain;
  const R = rng(1000 * course.no + L);
  const night = !!course.sky.night;
  const sMin = -C.PRE - 140, sMax = L + C.POST + 280;
  const hAt = (x, s) => ground.heightAtS(x, s);
  const anim = [];          // 毎コマ 動かす：(dt, t, ctx)
  const blockers = [];
  const blocked = (x, s, r = 0) => blockers.some(b => (b.x - x) ** 2 + (b.s - s) ** 2 < (b.r + r) ** 2);
  const inSea = (x, s) => T.kind === 'beach' && x > shoreX(T, s) - 1.5;
  const nearStands = (x, s, pad = 0) => Math.abs(x) < 24 + pad && (Math.abs(s - 2) < 32 + pad || Math.abs(s - L) < 32 + pad);
  const vm = K(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 }));
  const mat = (c, o = {}) => K(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }));
  const add = (geo, m, x, y, s, ry = 0, { cast = true, bigObj = false } = {}) => {
    const o = new THREE.Mesh(K(geo), m); o.position.set(x, y, -s); o.rotation.y = ry; o.castShadow = cast; o.receiveShadow = true;
    if (bigObj) big.add(o); else ch.addObj(s, o);
    return o;
  };
  const holder = (x, y, s, bigObj = true) => { const g = new THREE.Group(); g.position.set(x, y, -s); (bigObj ? big : ch.group(ch.ci(s))).add(g); return g; };
  // 割合 f と くり返し every から 置く s の 列
  const spotsOf = pr => {
    if (pr.every && pr.f == null) { const out = []; for (let s = pr.every * 0.5; s < L + 60; s += pr.every) out.push(s); return out; }
    const base = (pr.f ?? 0.5) * L, out = [];
    if (!pr.every) return [base];
    for (let k = -6; k <= 6; k++) { const s = base + k * pr.every; if (s >= 40 && s <= L + 100) out.push(s); }
    return out.length ? out : [base];
  };
  const xOf = (pr, i = 0) => Array.isArray(pr.x) ? lerp(pr.x[0], pr.x[1], R()) : pr.x;

  // ---- 群れで 置く（per100 = 100m あたり）----
  const scatter = (cfg, fn, { spacing = 3, water = false, pad = 0 } = {}) => {
    const n100 = cfg.per100 ? cfg.per100[qi] : 0; if (!n100) return 0;
    const left = cfg.maxX < 0, right = !!cfg.shore;
    const lo = left ? -cfg.maxX : cfg.minX, hi = left ? -cfg.minX : cfg.maxX;
    const group = cfg.group || [1, 4];
    const total = Math.round(n100 * (sMax - sMin) / 100);
    let placed = 0, guard = 0;
    while (placed < total && guard++ < total * 8) {
      const cs = lerp(sMin, sMax, R()), sg = left ? -1 : right ? 1 : (R() < 0.5 ? -1 : 1);
      const cx = sg * lerp(lo, hi, R());
      const gs = Math.max(1, Math.round(lerp(group[0], group[1], R())));
      const gr = Math.sqrt(gs) * spacing;
      for (let i = 0; i < gs && placed < total; i++) {
        const a = R() * 6.28, rr = gr * Math.sqrt(R());
        const x = cx + Math.cos(a) * rr, s = cs + Math.sin(a) * rr, ax = Math.abs(x);
        if (ax < Math.max(C.ROAD_W / 2 + C.CURB + C.SHOULDER + 0.2, lo - 1) || ax > hi + 4) continue;
        if (!water && inSea(x, s)) continue;
        if (nearStands(x, s, pad)) continue;
        if (blocked(x, s, 1)) continue;
        fn(x, hAt(x, s), s, placed, gs);
        placed++;
      }
    }
    return placed;
  };

  // ================= 決まった場所の 大きな物（先に 場所を とる） =================
  for (const pr of S.props || []) {
    const r0 = { windmill: 14, barn: 14, lighthouse: 14, ferris: 28, beachhouse: 10, sheep: (pr.r || 20) + 6, pond: (pr.r || 14) + 4, cabins: 30, skilift: 12 }[pr.kind];
    if (r0 && pr.x != null && !Array.isArray(pr.x)) for (const s of spotsOf(pr)) blockers.push({ x: pr.x, s, r: r0 });
  }

  // ---- 観客席（スタートと ゴール） ----
  const crowd = new Crowd(root, !!(S.crowd && S.crowd.penlights));
  const standsCrowd = new Crowd(root, (S.props || []).some(p => p.kind === 'stands' && p.penlights));
  const teamCols = CHAR_IDS.map(id => CHARS[id].kart);
  const standM = mat('#c8ced8', { roughness: 0.7 }), roofM = mat(course.color, { roughness: 0.6 });
  const stands = (sMid, len) => {
    for (const side of [1, -1]) {
      const x0 = side * 9.2, y = hAt(x0, sMid);
      const grp = holder(x0, y, sMid);
      const steps = [];
      for (let k = 0; k < 5; k++) steps.push(new THREE.BoxGeometry(1.2, 0.55 * (k + 1), len).translate(side * (k * 1.2 + 0.6), 0.275 * (k + 1) - 0.1, 0));
      const st = new THREE.Mesh(K(mergeGeometries(steps)), standM); st.castShadow = true; st.receiveShadow = true; grp.add(st);
      const roof = new THREE.Mesh(K(new THREE.BoxGeometry(6.8, 0.22, len + 1).translate(side * 3, 5.4, 0)), roofM); roof.castShadow = true; grp.add(roof);
      const back = new THREE.Mesh(K(new THREE.BoxGeometry(0.2, 5.4, len + 1).translate(side * 6.3, 2.7, 0)), standM); grp.add(back);
      for (const zz of [-len / 2, 0, len / 2]) { const c = new THREE.Mesh(K(new THREE.CylinderGeometry(0.12, 0.12, 5.4, 6).translate(side * 0.1, 2.7, zz)), standM); grp.add(c); }
      for (let k = 0; k < 5; k++) for (let i = 0; i < len / 0.85; i++) {
        if (R() < 0.1) continue;
        const lx = side * (k * 1.2 + 0.6), ly = 0.55 * (k + 1) - 0.1, lz = -len / 2 + 0.42 + i * 0.85 + (R() - 0.5) * 0.2;
        standsCrowd.add({ x: x0 + lx, y: y + ly, z: -sMid + lz, yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, sc: 0.85 + R() * 0.25, ph: R() * 6, c: R.pick(SHIRTS), skin: R.pick(SKINS), kind: R() < 0.3 ? 'wave' : R() < 0.4 ? 'flag' : 'jump', flag: R() < 0.25 ? R.pick(teamCols) : null, pen: R.pick(PENS), stand: true });
      }
    }
  };
  for (const pr of S.props || []) if (pr.kind === 'stands') pr.at === 'start' ? stands(-4, 36) : stands(L + 4, 40);

  // ================= 木・花・草・岩 =================
  if (S.trees) {
    const TG = treeGeos();
    const trunkM = K(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    const leafM = K(windMat({ vertexColors: true, roughness: 0.75 }, 0.035));
    const greens = ['#4fae3a', '#5cbf4a', '#3f9e44', '#79c95a', '#66b84f', '#7ccf4a', '#8fd65a'];
    scatter(S.trees, (x, y, s) => {
      const near = 1 + clamp((24 - Math.abs(x)) / 24, 0, 1) * 0.3, sc = (0.8 + R() * 0.55) * near, yaw = R() * 6.28;
      ch.addInst(s, 'trunk', TG.trunk, trunkM, M(x, y - 0.1, -s, yaw, sc));
      ch.addInst(s, 'leaf', TG.leaves, leafM, M(x, y - 0.1, -s, yaw, sc), new THREE.Color(R.pick(greens)).multiplyScalar(0.92 + R() * 0.16));
    }, { spacing: 4 });
  }
  if (S.bushes) {
    const bg = (() => { const parts = []; for (const [r, x, y, z] of [[0.75, 0, 0.45, 0], [0.55, 0.55, 0.35, 0.2], [0.5, -0.5, 0.32, -0.15]]) { const g = new THREE.IcosahedronGeometry(r, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + noise2(p.getX(i) * 4 + x, p.getZ(i) * 4, 6) * 0.1; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); } parts.push(g.translate(x, y, z).toNonIndexed()); } const m = mergeGeometries(parts); const p = m.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const v = clamp(0.72 + p.getY(i) * 0.35, 0.65, 1.1); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; } m.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.deleteAttribute('uv'); m.computeVertexNormals(); return m; })();
    const bm = K(windMat({ vertexColors: true, roughness: 0.8 }, 0.025));
    scatter(S.bushes, (x, y, s) => ch.addInst(s, 'bush', bg, bm, M(x, y - 0.05, -s, R() * 6.28, 0.7 + R() * 0.7), new THREE.Color(R.pick(['#3f9e44', '#4fae3a', '#5cbf4a', '#367f3a'])).multiplyScalar(0.9 + R() * 0.2)), { spacing: 1.6 });
  }
  if (S.firs) {
    const FG = firGeo(), fm = K(windMat({ vertexColors: true, roughness: 0.85 }, 0.012));
    scatter(S.firs, (x, y, s) => { const sc = 0.75 + R() * 0.8 + clamp((Math.abs(x) - 30) / 120, 0, 0.5); ch.addInst(s, 'fir', FG, fm, M(x, y - 0.2, -s, R() * 6.28, sc, sc * (0.9 + R() * 0.35))); }, { spacing: 3.4 });
  }
  if (S.palms) {
    const palmM = K(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    const leafM = K(windMat({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }, 0.025));
    const variants = [0, 1, 2].map(i => palmGeos(rng(70 + i)));
    const put = (x, y, s, yaw) => { const vi = Math.floor(R() * 3), v = variants[vi], sc = 0.85 + R() * 0.3; ch.addInst(s, 'palmT' + vi, v.trunk, palmM, M(x, y - 0.2, -s, yaw, sc)); ch.addInst(s, 'palmL' + vi, v.leaves, leafM, M(x, y - 0.2, -s, yaw, sc)); };
    const av = S.palms.avenue;
    if (av) for (let s = -C.PRE; s < L + C.POST; s += av.every) { if (nearStands(av.x, s)) continue; put(av.x, hAt(av.x, s), s, Math.PI + (R() - 0.5) * 0.7); }
    scatter(S.palms, (x, y, s) => put(x, y, s, R() * 6.28), { spacing: 5 });
  }
  if (S.flowers && S.flowers.per100[qi] > 0) {
    const fg = flowerGeo(), fm = K(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    const cols = ['#ff6fae', '#ffd23f', '#ffffff', '#b18cff', '#ff8f6a', '#ff5a4a'];
    let gc = null;
    scatter(S.flowers, (x, y, s, i, gs) => { if (!gc || R() < 1 / Math.max(1, gs)) gc = R.pick(cols); ch.addInst(s, 'flower', fg, fm, M(x, y, -s, R() * 6.28, 0.8 + R() * 0.6), gc, { cast: false }); }, { spacing: 0.45 });
  }
  if (S.grass && S.grass.per100[qi] > 0) {
    const beach = T.kind === 'beach';
    const gg = grassGeo(beach ? '#9aa85a' : '#5fa83f', beach ? '#d8e08a' : '#b8ee88'), gm = K(windMat({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }, 0.1));
    scatter(S.grass, (x, y, s) => ch.addInst(s, 'grass', gg, gm, M(x, y - 0.02, -s, R() * 6.28, 0.6 + R() * 0.7), null, { cast: false }), { spacing: 0.45 });
  }
  if (S.rocks) {
    const rg = [0, 1, 2, 3].map(i => rockGeo(i * 3 + 1)), rm = K(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }));
    const rc = T.kind === 'snow' ? ['#8a93a3', '#9aa2b0', '#7d8492'] : T.kind === 'beach' ? ['#8a8f99', '#6f7480', '#a09a90'] : ['#9aa0a8', '#8a8f99', '#b0a898'];
    scatter(S.rocks, (x, y, s) => { const i = Math.floor(R() * 4), sc = 0.5 + R() * 1.6; ch.addInst(s, 'rock' + i, rg[i], rm, M(x, y - 0.2 * sc, -s, R() * 6.28, sc, sc * (0.7 + R() * 0.6)), R.pick(rc)); }, { water: !!S.rocks.shore, spacing: 2.5 });
  }

  // ================= コースごとの 物 =================
  let fireworksAt = null, snowfall = false, smokes = [], lampPts = [], streaks = null;
  const ambient = { butterflies: 0, gulls: 0 };
  for (const pr of S.props || []) {
    switch (pr.kind) {
      // ----- はらっぱ -----
      case 'windmill': for (const s of spotsOf(pr)) {
        const x = pr.x, y = hAt(x, s) - 0.3;
        const tower = merge([colored(new THREE.CylinderGeometry(1.5, 2.5, 12, 10).translate(0, 6, 0), '#f4efe4'), colored(new THREE.ConeGeometry(2.1, 3, 10).translate(0, 13.5, 0), '#d9534f'),
          ...[0, 1, 2].map(i => colored(new THREE.BoxGeometry(0.8, 1.2, 0.1).translate(0, 3 + i * 3, 2.35 - i * 0.28), '#5a7aa8')), colored(new THREE.BoxGeometry(1.4, 2.2, 0.2).translate(0, 1.1, 2.45), '#8a5a30')]);
        const t = add(tower, vm, x, y, s, Math.atan2(-x, 80), { bigObj: true });
        const hub = new THREE.Group(); hub.position.set(0, 11.5, 2.3); t.add(hub);
        const blades = [];
        for (let i = 0; i < 4; i++) blades.push(colored(new THREE.BoxGeometry(0.15, 7.2, 0.1).translate(0, 3.8, 0).rotateZ(i * Math.PI / 2), '#6b4a33'), colored(new THREE.BoxGeometry(1.5, 5.8, 0.05).translate(0.82, 4.1, 0.05).rotateZ(i * Math.PI / 2), '#e8e2d4'));
        blades.push(colored(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 10).rotateX(Math.PI / 2), '#6b4a33'));
        const bl = new THREE.Mesh(K(merge(blades)), vm); bl.castShadow = true; hub.add(bl);
        const ph = R() * 6;
        anim.push((dt, tt) => { bl.rotation.z = ph + tt * Math.PI * 2 * 0.3; });
      } break;
      case 'barn': for (const s of spotsOf(pr)) {
        const x = pr.x, y = hAt(x, s) - 0.2;
        const roofS = new THREE.Shape(); roofS.moveTo(-5.8, 0); roofS.lineTo(0, 3.6); roofS.lineTo(5.8, 0); roofS.lineTo(-5.8, 0);
        const roofG = new THREE.ExtrudeGeometry(roofS, { depth: 8.8, bevelEnabled: false }).translate(0, 6, -4.4);
        const g = merge([colored(new THREE.BoxGeometry(10, 6, 8).translate(0, 3, 0), '#c8483b'), colored(roofG, '#6b4a33'),
          colored(new THREE.BoxGeometry(4.2, 4.4, 0.2).translate(0, 2.2, 4.05), '#f4f0e8'), colored(new THREE.BoxGeometry(3.6, 3.8, 0.25).translate(0, 2.2, 4.1), '#a8392c'),
          colored(new THREE.BoxGeometry(0.25, 5.2, 0.3).rotateZ(0.75).translate(0, 2.2, 4.25), '#f4f0e8'), colored(new THREE.BoxGeometry(0.25, 5.2, 0.3).rotateZ(-0.75).translate(0, 2.2, 4.25), '#f4f0e8'),
          colored(new THREE.BoxGeometry(10.2, 0.25, 8.2).translate(0, 6.0, 0), '#f4f0e8')]);
        add(g, vm, x, y, s, Math.PI / 2 + (pr.rot || 0), { bigObj: true });
        // 干し草の ロール
        for (let i = 0; i < 3; i++) add(colored(new THREE.CylinderGeometry(0.75, 0.75, 1.1, 16).rotateZ(Math.PI / 2), '#e8c25a'), vm, x + 8 + i * 1.8, hAt(x + 8, s) + 0.7, s + 3 + R() * 2, R(), { bigObj: true });
      } break;
      case 'sheep': for (const s0 of spotsOf(pr)) {
        const parts = [];
        for (const [x, y, z, r] of [[0, 0.75, 0, 0.42], [0.3, 0.8, 0.1, 0.36], [-0.3, 0.78, 0.05, 0.36], [0.1, 0.95, 0.2, 0.33], [-0.1, 0.95, -0.2, 0.33], [0.32, 0.7, -0.2, 0.33], [-0.32, 0.7, -0.18, 0.33]]) parts.push(colored(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), '#f7f5ef'));
        for (const [x, z] of [[0.25, 0.2], [-0.25, 0.2], [0.25, -0.2], [-0.25, -0.2]]) parts.push(colored(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5).translate(x, 0.25, z), '#3a3a44'));
        const bodyG = K(merge(parts));
        const headG = K(merge([colored(new THREE.SphereGeometry(0.22, 10, 8).scale(1, 0.95, 1.2), '#3a3a44'), colored(new THREE.SphereGeometry(0.1, 8, 6).scale(1.2, 0.5, 0.6).translate(0.2, 0.05, -0.05), '#3a3a44'), colored(new THREE.SphereGeometry(0.1, 8, 6).scale(1.2, 0.5, 0.6).translate(-0.2, 0.05, -0.05), '#3a3a44'),
          colored(new THREE.SphereGeometry(0.035, 6, 5).translate(0.09, 0.06, 0.2), '#ffffff'), colored(new THREE.SphereGeometry(0.035, 6, 5).translate(-0.09, 0.06, 0.2), '#ffffff')]));
        const cx = pr.x, cs = s0;
        for (let i = 0; i < pr.n; i++) {
          const sh = new THREE.Group(); big.add(sh);
          const bd = new THREE.Mesh(bodyG, vm); bd.castShadow = true; sh.add(bd);
          const hd = new THREE.Mesh(headG, vm); hd.position.set(0, 0.85, 0.55); sh.add(hd);
          const st = { x: cx + (R() - 0.5) * pr.r, s: cs + (R() - 0.5) * pr.r, tx: 0, ts: 0, yaw: R() * 6.28, wait: R() * 6, eat: R() < 0.5 ? 5 : 0 };
          st.tx = st.x; st.ts = st.s;
          sh.position.set(st.x, hAt(st.x, st.s) - 0.05, -st.s); sh.rotation.y = st.yaw;
          anim.push((dt, t, ctx) => {
            if (Math.abs(ctx.camS - st.s) > 300) return;
            st.wait -= dt;
            if (st.wait < 0) { const a = R() * 6.28, rr = Math.sqrt(R()) * pr.r * 0.8; st.tx = cx + Math.cos(a) * rr; st.ts = cs + Math.sin(a) * rr; st.wait = 8 + R() * 6; st.eat = R() < 0.4 ? 4 : 0; }
            const dx = st.tx - st.x, dz = -(st.ts - st.s), d = Math.hypot(dx, dz);
            if (d > 0.2) { const want = Math.atan2(dx, dz); st.yaw += Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw)) * Math.min(1, dt * 3); st.x += Math.sin(st.yaw) * 0.6 * dt; st.s -= Math.cos(st.yaw) * 0.6 * dt; }
            else if (st.eat > 0) st.eat -= dt;
            const look = Math.abs(ctx.camS - st.s) < 30;      // ランナーが 近くを 通ると 顔を あげる
            sh.position.set(st.x, hAt(st.x, st.s) - 0.05 + (d > 0.2 ? Math.abs(Math.sin(t * 8 + i)) * 0.04 : 0), -st.s); sh.rotation.y = st.yaw;
            const eating = st.eat > 0 && !look;
            hd.rotation.x = eating ? 0.7 : -0.15 + Math.sin(t * 0.7 + i) * 0.1; hd.position.y = eating ? 0.55 : 0.88;
            hd.rotation.y = look ? Math.sin(t * 1.5 + i) * 0.5 : 0;
          });
        }
        // 柵
        const post = K(colored(new THREE.BoxGeometry(0.12, 1.0, 0.12).translate(0, 0.5, 0), '#a7774a'));
        for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2, x = cx + Math.cos(a) * (pr.r + 3), s = cs + Math.sin(a) * (pr.r + 3); if (Math.abs(x) < 9) continue; ch.addInst(s, 'pfence', post, vm, M(x, hAt(x, s), -s, -a)); }
      } break;
      case 'pond': for (const s0 of spotsOf(pr)) {
        const cx = pr.x, y = hAt(cx, s0) + 0.12;
        const g = new THREE.CircleGeometry(pr.r, 48), p = g.attributes.position;
        for (let i = 1; i < p.count; i++) { const k = 1 + noise2(p.getX(i) * 0.2, p.getY(i) * 0.2, 3) * 0.15; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
        g.rotateX(-Math.PI / 2);
        add(g, mat('#5aa9d8', { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9, envMapIntensity: 1.3 }), cx, y, s0, 0, { cast: false, bigObj: true });
        add(new THREE.CircleGeometry(pr.r * 1.14, 48).rotateX(-Math.PI / 2), mat('#8a6a4a', { roughness: 1 }), cx, y - 0.06, s0, 0, { cast: false, bigObj: true });
        for (let i = 0; i < 14; i++) { const a = R() * 6.28, rr = R() * pr.r * 0.85; add(new THREE.CircleGeometry(0.5 + R() * 0.4, 10, 0.3, 5.9).rotateX(-Math.PI / 2), mat('#5cbf4a', { roughness: 0.6 }), cx + Math.cos(a) * rr, y + 0.02, s0 + Math.sin(a) * rr, R() * 6, { cast: false, bigObj: true }); }
        // 葦（あし）
        const reedG = K(colored(new THREE.CylinderGeometry(0.02, 0.03, 1.4, 4).translate(0, 0.7, 0), '#6b8a3a'));
        for (let i = 0; i < 40; i++) { const a = R() * 6.28, rr = pr.r * (1.0 + R() * 0.12); ch.addInst(s0 + Math.sin(a) * rr, 'reed', reedG, vm, M(cx + Math.cos(a) * rr, y - 0.1, -(s0 + Math.sin(a) * rr), 0, 0.7 + R() * 0.6, 0.7 + R() * 0.6, (R() - 0.5) * 0.3), null, { cast: false }); }
        const duckG = K(merge([colored(new THREE.SphereGeometry(0.25, 10, 8).scale(1, 0.75, 1.3), '#ffffff'), colored(new THREE.SphereGeometry(0.14, 8, 6).translate(0, 0.28, 0.22), '#ffffff'), colored(new THREE.ConeGeometry(0.06, 0.14, 6).rotateX(Math.PI / 2).translate(0, 0.26, 0.4), '#ff9f1c'), colored(new THREE.SphereGeometry(0.025, 5, 4).translate(0.07, 0.33, 0.32), '#1d2433'), colored(new THREE.SphereGeometry(0.025, 5, 4).translate(-0.07, 0.33, 0.32), '#1d2433')]));
        for (let i = 0; i < (pr.ducks || 3); i++) {
          const d = new THREE.Mesh(duckG, vm); big.add(d); const r0 = 3 + R() * (pr.r * 0.5), ph = R() * 6.28, sp = 2 * Math.PI / (34 + R() * 12);
          anim.push((dt, t) => { const a = ph + t * sp; d.position.set(cx + Math.cos(a) * r0, y + 0.05 + Math.sin(t * 2 + i) * 0.02, -(s0 + Math.sin(a) * r0)); d.rotation.y = a + Math.PI; });
        }
      } break;
      case 'picnic': {
        const pm = K(new THREE.MeshStandardMaterial({ map: K(picnicTexture()), roughness: 0.9 }));
        for (let s = 120; s < L - 40; s += pr.every) {
          const x = pr.side * pr.x + pr.side * 2, y = hAt(x, s);
          if (nearStands(x, s)) continue;
          add(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), pm, x, y + 0.03, s, R(), { cast: false });
          add(merge([colored(new THREE.ConeGeometry(1.8, 0.7, 8).translate(0, 2.6, 0), '#ffd23f'), colored(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0), '#ffffff')]), vm, x + 1, y, s - 1);
          add(colored(new RoundedBoxGeometry(0.5, 0.35, 0.35, 2, 0.06), '#a7774a'), vm, x - 0.6, y + 0.18, s + 0.3, R());
          for (let k = 0; k < 3; k++) crowd.add({ x: x - 1.2 + k * 0.9, y, z: -(s - 1.8), yaw: -pr.side * Math.PI / 2, sc: k === 2 ? 0.62 : 0.9 + R() * 0.15, ph: R() * 6, c: R.pick(SHIRTS), skin: R.pick(SKINS), kind: 'wave', flag: k === 2 ? R.pick(teamCols) : null, pen: R.pick(PENS), s });
        }
      } break;
      case 'sunflowers': {
        const sunDir = new V3(...course.sun.dir); const yaw = Math.atan2(sunDir.x, sunDir.z);
        const fg = K(merge([
          colored(new THREE.CylinderGeometry(0.025, 0.035, 1.6, 5).translate(0, 0.8, 0), '#4f8a2f'),
          colored(new THREE.SphereGeometry(0.12, 6, 4).scale(1.6, 0.25, 0.8).translate(0.12, 0.9, 0), '#5aa83a'),
          ...Array.from({ length: 12 }, (_, i) => colored(new THREE.CircleGeometry(0.09, 6).scale(0.55, 1.4, 1).translate(0, 0.17, 0).rotateZ(i / 12 * Math.PI * 2).translate(0, 1.62, 0.03), '#ffd23f')),
          colored(new THREE.CircleGeometry(0.13, 14).translate(0, 1.62, 0.04), '#6b4a2a')]).rotateX(-0.25));
        const fm = K(windMat({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }, 0.02));
        for (let s0 = 100; s0 < L + 60; s0 += pr.every) for (let s = s0; s < s0 + pr.len; s += 0.75) for (const dx of [0, -0.8, -1.6]) {
          const x = pr.x + dx + (R() - 0.5) * 0.25; if (nearStands(x, s)) continue;
          ch.addInst(s, 'sunflower', fg, fm, M(x, hAt(x, s) - 0.05, -s, yaw + (R() - 0.5) * 0.4, 0.85 + R() * 0.35));
        }
      } break;
      case 'balloons': {
        const cols = [['#ff6fae', '#ffd23f'], ['#3fa9f5', '#ffffff'], ['#56d364', '#ffd23f'], ['#ff7a2f', '#ffffff']];
        for (let i = 0; i < pr.n; i++) {
          const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, 0.8)) * 6 * (t < 0.15 ? 0.5 + t * 3.3 : 1), t * 14)); }
          const env = new THREE.LatheGeometry(pts, 16).toNonIndexed(), p = env.attributes.position, col = new Float32Array(p.count * 3);
          const ca = new THREE.Color(cols[i % 4][0]), cb = new THREE.Color(cols[i % 4][1]);
          for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)), c = Math.floor((a + Math.PI) / (Math.PI / 4)) % 2 ? ca : cb; col.set([c.r, c.g, c.b], k * 3); }
          env.setAttribute('color', new THREE.BufferAttribute(col, 3)); env.deleteAttribute('uv'); env.computeVertexNormals();
          const g = new THREE.Group(); const em = new THREE.Mesh(K(env), vm); em.position.y = 3; g.add(em);
          g.add(new THREE.Mesh(K(colored(new THREE.BoxGeometry(1.4, 1.2, 1.4), '#a7774a')), vm));
          big.add(g);
          const s = lerp(L * 0.15, L * 1.1, (i + R()) / pr.n), x = (i % 2 ? 1 : -1) * (90 + R() * 160), h = 55 + R() * 35, ph = R() * 6;
          anim.push((dt, t) => { g.position.set(x + Math.sin(t * 0.03 + ph) * 30, h + Math.sin(t * 0.2 + ph) * 3, -s + Math.cos(t * 0.025 + ph) * 20); });
        }
      } break;
      case 'butterflies': ambient.butterflies = pr.n; break;
      // ----- ビーチ -----
      case 'umbrellas': {
        for (let s0 = 50; s0 < L + 80; s0 += pr.every) for (let i = 0; i < pr.n; i++) {
          const x = lerp(pr.x[0], pr.x[1], R()), s = s0 + (R() - 0.5) * 30, y = hAt(x, s); if (nearStands(x, s)) continue;
          const cA = R.pick(['#d94a4a', '#3fa9f5', '#ffd23f', '#56d364']);
          const cone = new THREE.ConeGeometry(1.5, 0.7, 8, 1).toNonIndexed(), cp = cone.attributes.position, col = new Float32Array(cp.count * 3);
          for (let k = 0; k < cp.count; k += 3) { const c = new THREE.Color((k / 3) % 2 ? cA : '#ffffff'); for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (k + j) * 3); }
          cone.setAttribute('color', new THREE.BufferAttribute(col, 3)); cone.deleteAttribute('uv'); cone.translate(0, 2.4, 0);
          add(merge([cone, colored(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6).translate(0, 1.15, 0), '#ffffff')]), vm, x, y - 0.1, s, 0).rotation.z = (R() - 0.5) * 0.2;
          add(merge([colored(new THREE.BoxGeometry(0.6, 0.06, 1.3).rotateX(-0.1).translate(0, 0.35, 0), cA), colored(new THREE.BoxGeometry(0.6, 0.06, 0.6).rotateX(-1.0).translate(0, 0.55, -0.8), '#ffffff')]), vm, x + 1.3, y, s - 0.4, R() * 6);
          add(new THREE.PlaneGeometry(0.8, 1.7).rotateX(-Math.PI / 2), mat(R.pick(['#ff6fae', '#45c8e0', '#ffd23f']), { roughness: 0.9 }), x - 1.1, y + 0.03, s + 0.3, R(), { cast: false });
        }
      } break;
      case 'surfboards': for (let s0 = 70; s0 < L + 60; s0 += pr.every) for (let i = 0; i < pr.n; i++) {
        const x = pr.x - i * 0.7, s = s0 + i * 0.4, y = hAt(x, s);
        const b = merge([colored(new THREE.SphereGeometry(1, 12, 6).scale(0.3, 1.2, 0.05).translate(0, 1.0, 0), R.pick(['#ff7a2f', '#3fa9f5', '#ffd23f', '#56d364', '#ff6fae'])), colored(new THREE.BoxGeometry(0.04, 2.2, 0.06).translate(0, 1.0, 0.02), '#ffffff')]);
        add(b, vm, x, y - 0.25, s, Math.PI / 2 + (R() - 0.5) * 0.4).rotation.z = (R() - 0.5) * 0.25;
      } break;
      case 'crabs': {
        const cg = K(merge([colored(new THREE.SphereGeometry(0.25, 10, 6).scale(1, 0.5, 0.8), '#e8483b'), colored(new THREE.SphereGeometry(0.1, 6, 5).translate(0.3, 0.06, 0.15), '#ff6a4a'), colored(new THREE.SphereGeometry(0.1, 6, 5).translate(-0.3, 0.06, 0.15), '#ff6a4a'),
          colored(new THREE.SphereGeometry(0.045, 5, 4).translate(0.08, 0.2, 0.15), '#1d2433'), colored(new THREE.SphereGeometry(0.045, 5, 4).translate(-0.08, 0.2, 0.15), '#1d2433'),
          ...[-1, 1].flatMap(sx => [0, 1, 2].map(k => colored(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 3).rotateZ(sx * 1.1).translate(sx * 0.27, 0.02, -0.1 + k * 0.1), '#c83a2b')))]));
        for (let s0 = 40; s0 < L + 60; s0 += pr.every) for (let i = 0; i < pr.n; i++) {
          const side = R() < 0.6 ? -1 : 1, x = side * (5.6 + R() * 5), s = s0 + R() * 20;
          if (inSea(x, s) || nearStands(x, s)) continue;
          const c = new THREE.Mesh(cg, vm); c.castShadow = false; big.add(c);
          const st = { x, s, x0: x, flee: 0, dir: side, ph: R() * 6, gone: 0 };
          anim.push((dt, t, ctx) => {
            if (Math.abs(ctx.camS - st.s) > 120) { c.visible = false; return; }
            c.visible = st.gone < 1;
            const near = ctx.nearRunner(st.x, st.s, 7);
            if (near && st.flee <= 0) st.flee = 2.5;
            if (st.flee > 0) { st.flee -= dt; st.x += st.dir * 4.5 * dt; if (Math.abs(st.x) > 16) st.gone = Math.min(1, st.gone + dt * 2); }
            else st.x = st.x0 + Math.sin(t * 0.6 + st.ph) * 1.2;
            c.position.set(st.x, hAt(st.x, st.s) + 0.06 + Math.abs(Math.sin(t * 14 + st.ph)) * (st.flee > 0 ? 0.04 : 0.01), -st.s);
            c.rotation.y = st.ph; c.scale.setScalar(1 - st.gone * 0.999);
          });
        }
      } break;
      case 'beachhouse': for (const s of spotsOf(pr)) {
        const x = pr.x, y = hAt(x, s);
        const g = merge([colored(new THREE.BoxGeometry(8, 3.5, 6).translate(0, 2.55, 0), '#e8d3a8'), colored(new THREE.ConeGeometry(6.2, 2.2, 4).rotateY(Math.PI / 4).scale(1, 1, 0.78).translate(0, 5.4, 0), '#d94a4a'),
          ...[-1.5, 0, 1.5].map(xx => colored(new THREE.BoxGeometry(1.3, 1.1, 0.05).translate(xx, 3.6, 3.03), '#3fa9f5')),
          colored(new THREE.BoxGeometry(9, 0.25, 3).translate(0, 0.8, 4.4), '#c9a070'),
          ...[[-3.6, -2.6], [3.6, -2.6], [-3.6, 2.6], [3.6, 2.6], [-4.2, 5.6], [4.2, 5.6]].map(([xx, z]) => colored(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6).translate(xx, 0.5, z), '#8a6a4a'))]);
        add(g, vm, x, y, s, Math.PI / 2, { bigObj: true });
      } break;
      case 'lighthouse': {
        const s = pr.f * L, x = pr.x, y = hAt(x, s) - 0.3;
        const tower = new THREE.CylinderGeometry(2.0, 3.0, 18, 16, 6).translate(0, 9, 0).toNonIndexed(), p = tower.attributes.position, col = new Float32Array(p.count * 3);
        const cw = new THREE.Color('#f7f7f7'), cr = new THREE.Color('#d94a4a');
        for (let i = 0; i < p.count; i++) { const c = Math.floor(p.getY(i) / 3 - 0.001) % 2 ? cr : cw; col.set([c.r, c.g, c.b], i * 3); }
        tower.setAttribute('color', new THREE.BufferAttribute(col, 3)); tower.deleteAttribute('uv');
        const g = merge([tower, colored(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 16).translate(0, 18.15, 0), '#2b2f3a'), colored(new THREE.CylinderGeometry(1.6, 1.6, 2.2, 12).translate(0, 19.4, 0), '#fff6c0'), colored(new THREE.ConeGeometry(2.0, 1.6, 12).translate(0, 21.3, 0), '#d94a4a'),
          colored(new THREE.CylinderGeometry(6, 7, 3, 12).translate(0, -1.2, 0), '#8a8f99')]);
        add(g, vm, x, Math.max(y, -1), s, 0, { bigObj: true });
        const beam = new THREE.Mesh(K(new THREE.ConeGeometry(3.5, 70, 16, 1, true).translate(0, -35, 0).rotateZ(Math.PI / 2)), K(new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
        const piv = new THREE.Group(); piv.position.set(x, Math.max(y, -1) + 19.4, -s); piv.add(beam); big.add(piv);
        anim.push((dt, t) => { piv.rotation.y = t * Math.PI * 2 / 8; });
        if (glow) glow.add(new V3(x, Math.max(y, -1) + 19.4, -s), '#fff6c0', 7);
      } break;
      case 'yachts': {
        const hull = K(merge([colored(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.2, 1.0, 3.2), '#ffffff'), colored(new THREE.CylinderGeometry(0.08, 0.08, 7, 6).translate(0, 3.5, 0.4), '#c8ced8')]));
        const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0.6, 0, 7, 0.5, 0, 0.7, -2.6, 0, 0.6, 0.8, 0, 4.5, 0.75, 0, 0.6, 3.0], 3));
        sail.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 0.25, 0.55, 1, 0.25, 0.55, 1, 0.25, 0.55, 1], 3)); sail.computeVertexNormals(); K(sail);
        const sm = K(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }));
        for (let i = 0; i < pr.n; i++) {
          const g = new THREE.Group(); g.add(new THREE.Mesh(hull, vm), new THREE.Mesh(sail, sm)); big.add(g);
          const cx = 80 + R() * 260, cs = lerp(0.2, 1.1, (i + R()) / pr.n) * L, r0 = 20 + R() * 30, ph = R() * 6, lv = course.water.level;
          anim.push((dt, t) => { const a = ph + t * 0.8 / r0; g.position.set(cx + Math.cos(a) * r0, lv + Math.sin(t * 0.9 + ph) * 0.15, -cs + Math.sin(a) * r0); g.rotation.set(0, -a, Math.sin(t * 0.7 + ph) * 0.08); });
        }
      } break;
      case 'buoys': {
        const bg = K(merge([colored(new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#d94a4a'), colored(new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#ffffff'), colored(new THREE.CylinderGeometry(0.05, 0.05, 1, 5).translate(0, 0.8, 0), '#2b2f3a')]));
        const lv = course.water.level;
        for (let i = 0; i < pr.n; i++) {
          const x = lerp(pr.x[0], pr.x[1], R()), s = lerp(0, L + 200, (i + R()) / pr.n);
          const b = new THREE.Mesh(bg, vm); ch.addObj(s, b); const ph = R() * 6;
          anim.push((dt, t) => { b.position.set(x, lv + Math.sin(t * 1.3 + ph) * 0.2, -s); b.rotation.z = Math.sin(t * 1.1 + ph) * 0.1; });
        }
      } break;
      case 'gulls': ambient.gulls = pr.n; break;
      case 'shells': break;   // 道の 模様（テクスチャ）
      // ----- ゆきみち -----
      case 'snowmen': {
        const g = K(merge([colored(new THREE.SphereGeometry(0.6, 14, 10).translate(0, 0.55, 0), '#ffffff'), colored(new THREE.SphereGeometry(0.45, 14, 10).translate(0, 1.4, 0), '#ffffff'), colored(new THREE.SphereGeometry(0.3, 12, 9).translate(0, 2.05, 0), '#ffffff'),
          colored(new THREE.ConeGeometry(0.05, 0.26, 6).rotateX(Math.PI / 2).translate(0, 2.05, 0.4), '#ff7a2f'), colored(new THREE.SphereGeometry(0.035, 5, 4).translate(0.1, 2.14, 0.26), '#1d2433'), colored(new THREE.SphereGeometry(0.035, 5, 4).translate(-0.1, 2.14, 0.26), '#1d2433'),
          colored(new THREE.TorusGeometry(0.34, 0.06, 6, 14).rotateX(Math.PI / 2).translate(0, 1.75, 0), '#d94a4a'), colored(new THREE.CylinderGeometry(0.18, 0.22, 0.26, 10).translate(0, 2.4, 0), '#3fa9f5'),
          colored(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 4).rotateZ(1.0).translate(0.6, 1.55, 0), '#6b4a33'), colored(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 4).rotateZ(-1.0).translate(-0.6, 1.55, 0), '#6b4a33')]));
        let i = 0;
        for (let s = 70; s < L + 100; s += pr.every) { const side = i++ % 2 ? 1 : -1, x = side * (9 + R() * 5); if (nearStands(x, s)) continue; ch.addInst(s, 'snowman', g, vm, M(x, hAt(x, s) - 0.1, -s, (side > 0 ? -1 : 1) * 1.2 + (R() - 0.5) * 0.6)); }
      } break;
      case 'cabins': for (const s0 of spotsOf(pr)) {
        const g = K(merge([colored(new THREE.BoxGeometry(6, 3.4, 5).translate(0, 1.7, 0), '#8a5a3b'), colored(new THREE.CylinderGeometry(3.8, 3.8, 6.6, 3).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.7, 1).translate(0, 4.2, 0), '#5a3a2a'),
          colored(new THREE.CylinderGeometry(3.95, 3.95, 6.8, 3, 1, false, -0.55, 1.1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.72, 1).translate(0, 4.35, 0), '#f4f8fc'),
          colored(new THREE.BoxGeometry(0.6, 1.8, 0.6).translate(1.6, 5.4, 0.8), '#8a8f99'), colored(new THREE.BoxGeometry(1.0, 1.0, 0.1).translate(-1.4, 1.9, 2.55), '#ffd9a0'), colored(new THREE.BoxGeometry(1.0, 1.0, 0.1).translate(1.4, 1.9, 2.55), '#ffd9a0'), colored(new THREE.BoxGeometry(1.2, 2.2, 0.12).translate(0, 1.1, 2.55), '#5a3a2a')]));
        const winM = K(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, emissive: '#ffb860', emissiveIntensity: 0 }));
        for (let k = 0; k < (pr.n || 3); k++) {
          const x = lerp(pr.x[0], pr.x[1], R()), s = s0 + (k - 1) * 18 + (R() - 0.5) * 6, y = hAt(x, s) - 0.2, yaw = Math.atan2(-x, 30) + (R() - 0.5) * 0.4;
          add(g, vm, x, y, s, yaw, { bigObj: true });
          const chim = new V3(1.6, 6.4, 0.8).applyAxisAngle(_up, yaw).add(new V3(x, y, -s));
          smokes.push(chim);
          if (glow) for (const dx of [-1.4, 1.4]) glow.add(new V3(dx, 1.9, 2.62).applyAxisAngle(_up, yaw).add(new V3(x, y, -s)), '#ffc070', 1.2);
        }
      } break;
      case 'skilift': for (const s0 of spotsOf(pr)) {
        const x0 = pr.x, sa = s0, x1 = pr.x + 150, sb = s0 + 120, towers = 6, chairs = 14;
        const pts = [];
        for (let i = 0; i < towers; i++) { const t = i / (towers - 1), x = lerp(x0, x1, t), s = lerp(sa, sb, t), y = hAt(x, s); pts.push(new V3(x, y, -s)); add(merge([colored(new THREE.BoxGeometry(0.4, 8, 0.4).translate(0, 4, 0), '#c8ced8'), colored(new THREE.BoxGeometry(3.2, 0.25, 0.3).translate(0, 8, 0), '#c8ced8')]), vm, x, y, s, Math.atan2(x1 - x0, -(sb - sa)) + Math.PI / 2, { bigObj: true }); }
        const yaw = Math.atan2(x1 - x0, -(sb - sa)), off = new V3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(1.2);
        const up = pts.map(p => p.clone().add(off).setY(p.y + 7.9)), dn = pts.map(p => p.clone().sub(off).setY(p.y + 7.9));
        for (const line of [up, dn]) big.add(new THREE.Line(K(new THREE.BufferGeometry().setFromPoints(line)), K(new THREE.LineBasicMaterial({ color: '#4a4f5c' }))));
        const chairG = K(merge([colored(new THREE.BoxGeometry(1.2, 0.1, 0.5).translate(0, -1.6, 0), '#d94a4a'), colored(new THREE.BoxGeometry(1.2, 0.5, 0.08).translate(0, -1.35, -0.22), '#d94a4a'), colored(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4).translate(0, -0.8, 0), '#4a4f5c')]));
        const loop = [...up, ...dn.slice().reverse()]; const segL = []; let tot = 0;
        for (let i = 0; i < loop.length; i++) { const l = loop[i].distanceTo(loop[(i + 1) % loop.length]); segL.push(l); tot += l; }
        for (let c = 0; c < chairs; c++) {
          const chm = new THREE.Mesh(chairG, vm); chm.castShadow = true; big.add(chm);
          anim.push((dt, t) => {
            let d = ((c / chairs) * tot + t * 1.2) % tot, i = 0;
            while (d > segL[i]) { d -= segL[i]; i = (i + 1) % segL.length; }
            const a = loop[i], b = loop[(i + 1) % loop.length], f = d / segL[i];
            chm.position.lerpVectors(a, b, f); chm.rotation.y = yaw + (i >= up.length ? Math.PI : 0);
          });
        }
      } break;
      case 'skiflags': {
        const fg = K(merge([colored(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5).translate(0, 0.8, 0), '#ffffff'), colored(new THREE.PlaneGeometry(0.5, 0.4).translate(0.26, 1.35, 0), '#ffffff')]));
        const fm = K(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }));
        let i = 0;
        for (let s = 40; s < L + 80; s += pr.every) { const x = pr.x + (i % 2 ? 2.2 : -0.6) + 6; if (!nearStands(x, s)) ch.addInst(s, 'skiflag', fg, fm, M(x, hAt(x, s), -s, R() * 0.4), i % 2 ? '#3f8ff5' : '#e8483b', { cast: false }); i++; }
      } break;
      case 'snowfall': snowfall = true; break;
      // ----- よぞら -----
      case 'neon': {
        const words = ['ダッシュ', 'はしれ', 'GO!', 'ファイト', 'びゅーん', 'ゴール↑'], cols = ['#ff6fae', '#7fe0ff', '#ffd54a', '#9dff7a', '#c89bff', '#ff8f5a'];
        const texs = words.map((w, i) => K(neonTexture(w, cols[i])));
        const signs = [];
        let i = 0;
        for (let s = 30; s < L + 120; s += pr.every) {
          const side = i % 2 ? 1 : -1, x = side * lerp(pr.x[0], pr.x[1], R()), y = hAt(x, s), k = i++ % words.length;
          if (nearStands(x, s, -10)) continue;
          const pole = add(colored(new THREE.CylinderGeometry(0.08, 0.1, 5.2, 6).translate(0, 2.6, 0), '#3a3f52'), vm, x, y, s, 0);
          const m = K(new THREE.MeshBasicMaterial({ map: texs[k], color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true, toneMapped: false }));
          const o = new THREE.Mesh(K(new THREE.PlaneGeometry(3.2, 1.2)), m); o.position.set(x, y + 5.0, -s); o.rotation.y = -side * 0.9; ch.addObj(s, o);
          const back = new THREE.Mesh(K(new THREE.BoxGeometry(3.3, 1.3, 0.08)), mat('#111428', { roughness: 0.5 })); back.position.set(x, y + 5.0, -s); back.rotation.y = -side * 0.9; back.translateZ(-0.06); ch.addObj(s, back);
          if (glow) glow.add(new V3(x, y + 5.0, -s), cols[k], 5);
          signs.push({ m, k: 1, target: 1, t: R() * 3, mode: Math.floor(R() * 3), ph: R() * 6 });
        }
        anim.push((dt, t, ctx) => {
          const fast = ctx.final ? 2.2 : 1;
          for (const sg of signs) {
            sg.t -= dt * fast; if (sg.t < 0) { sg.t = 2 + R() * 3; sg.mode = Math.floor(R() * 3); }
            const v = sg.mode === 0 ? 1 : sg.mode === 1 ? (Math.sin(t * 10 * fast + sg.ph) > -0.3 ? 1 : 0.25) : 0.65 + 0.35 * Math.sin(t * 3 * fast + sg.ph);
            sg.m.color.setScalar(v * 1.3);
          }
        });
      } break;
      case 'lighttunnel': {
        const s0 = pr.f * L, arcs = [];
        const ring = K(new THREE.TorusGeometry(6, 0.15, 6, 40, Math.PI));
        for (let s = s0; s <= Math.min(s0 + pr.len, L - 20); s += pr.step) {
          const m = K(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
          const o = new THREE.Mesh(ring, m); o.position.set(0, H(s) - 0.3, -s); ch.addObj(s, o); arcs.push({ m, i: arcs.length });
          if (glow) for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI; glow.add(new V3(Math.cos(a) * 6, H(s) - 0.3 + Math.sin(a) * 6, -s), '#ffffff', 0.9); }
        }
        const tmpC = new THREE.Color();
        anim.push((dt, t) => { for (const a of arcs) { tmpC.setHSL(((a.i / 11 - t * 0.25) % 1 + 1) % 1, 0.9, 0.58); a.m.color.copy(tmpC).multiplyScalar(1.15); } });
      } break;
      case 'ferris': {
        const x = pr.x, s = pr.f * L, r0 = 20, y0 = hAt(x, s) + r0 + 4;
        const g = new THREE.Group(); g.position.set(x, y0, -s); big.add(g);
        g.rotation.y = Math.PI / 2 + 0.5;
        const wheel = new THREE.Group(); g.add(wheel);
        const rimM = mat('#e8ecf5', { roughness: 0.4, metalness: 0.5 });
        const parts = [];
        const strip = p => { for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal') p.deleteAttribute(k); return p; };
        for (const zz of [-1.5, 1.5]) { parts.push(strip(new THREE.TorusGeometry(r0, 0.35, 8, 64).translate(0, 0, zz).toNonIndexed())); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; parts.push(strip(new THREE.CylinderGeometry(0.1, 0.1, r0, 5).translate(0, r0 / 2, 0).rotateZ(a).translate(0, 0, zz).toNonIndexed())); } }
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; parts.push(strip(new THREE.CylinderGeometry(0.08, 0.08, 3, 5).rotateX(Math.PI / 2).translate(Math.cos(a) * r0, Math.sin(a) * r0, 0).toNonIndexed())); }
        parts.push(strip(new THREE.CylinderGeometry(0.8, 0.8, 3.6, 12).rotateX(Math.PI / 2).toNonIndexed()));
        wheel.add(new THREE.Mesh(K(mergeGeometries(parts)), rimM));
        for (const zz of [-3, 3]) for (const sx of [-1, 1]) { const leg = new THREE.Mesh(K(new THREE.CylinderGeometry(0.4, 0.6, r0 + 6, 8)), rimM); leg.position.set(sx * (r0 + 4) * 0.28, -(r0 + 4) / 2, zz); leg.rotation.z = sx * 0.3; g.add(leg); }
        const gonds = [], gcols = ['#ff6fae', '#7fe0ff', '#ffd54a', '#9dff7a', '#c89bff', '#ff8f5a'];
        for (let i = 0; i < 16; i++) { const gd = new THREE.Mesh(K(new RoundedBoxGeometry(2.2, 2.0, 2.2, 2, 0.4)), mat(gcols[i % 6], { roughness: 0.5, emissive: gcols[i % 6], emissiveIntensity: night ? 0.45 : 0 })); g.add(gd); gonds.push(gd); }
        const lp = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; lp.push(new V3(Math.cos(a) * (r0 + 0.4), Math.sin(a) * (r0 + 0.4), 1.7)); }
        const lg = K(new THREE.BufferGeometry().setFromPoints(lp)), lc = new Float32Array(64 * 3);
        lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
        const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const q = c.getContext('2d'); const gr = q.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); return K(t); })();
        wheel.add(new THREE.Points(lg, K(new THREE.PointsMaterial({ size: 1.8, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
        const tmpC = new THREE.Color();
        anim.push((dt, t) => {
          const a = t * Math.PI * 2 / 90; wheel.rotation.z = a;
          gonds.forEach((gd, i) => { const b = a + i / 16 * Math.PI * 2; gd.position.set(Math.cos(b) * r0, Math.sin(b) * r0 - 1.6, 0); });
          for (let i = 0; i < 64; i++) { tmpC.setHSL((i / 64 + t * 0.1) % 1, 0.9, 0.6); lc[i * 3] = tmpC.r; lc[i * 3 + 1] = tmpC.g; lc[i * 3 + 2] = tmpC.b; }
          lg.attributes.color.needsUpdate = true;
        });
      } break;
      case 'fireworks': fireworksAt = { x: pr.x, s: pr.f * L, y: 70 }; break;
      case 'parktrees': {
        const TG = treeGeos();
        const tm = K(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })), lm = K(windMat({ vertexColors: true, roughness: 0.8 }, 0.02));
        for (let s0 = 60; s0 < L + 100; s0 += pr.every) for (let i = 0; i < pr.n; i++) {
          const x = lerp(pr.x[0], pr.x[1], R()), s = s0 + (R() - 0.5) * 30, y = hAt(x, s), sc = 0.65 + R() * 0.3;
          if (nearStands(x, s)) continue;
          ch.addInst(s, 'ptrunk', TG.trunk, tm, M(x, y, -s, R() * 6, sc)); ch.addInst(s, 'pleaf', TG.leaves, lm, M(x, y, -s, R() * 6, sc), '#2a5a3a');
          if (glow) for (let k = 0; k < 7; k++) glow.add(new V3(x + (R() - 0.5) * 3 * sc, y + (2.5 + R() * 2.5) * sc, -s + (R() - 0.5) * 3 * sc), R.pick(['#ffd9a0', '#ffd9a0', '#ff9ad0', '#9ad8ff']), 0.7);
        }
      } break;
    }
  }

  // ---- 街：ビル（区画、窓の シェーダー） ----
  if (S.buildings) {
    const cfg = S.buildings;
    const geo = K(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const bm = K(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, metalness: 0.1 }));
    bm.onBeforeCompile = sh => {
      sh.uniforms.uSeed = U.windowSeed;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLNor; varying float vBid;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec3 bsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));\nvLoc = transformed * bsc + vec3(0.0, instanceMatrix[3].y, 0.0);\nvLNor = objectNormal;\nvBid = instanceMatrix[3].x * 0.731 + instanceMatrix[3].z * 0.377;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLNor; varying float vBid; uniform float uSeed;\nfloat h2(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\nfloat band(float x, float a, float b, float w){ return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x); }')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float bidF = floor(vBid * 10.0) * 0.1;
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
          float far = smoothstep(0.22, 0.55, max(fw.x, fw.y));
          float em = mix(win * lit * (0.75 + 0.5 * fract(r * 13.0)), 0.14, far) * (1.0 - side) * step(2.0, v);
          totalEmissiveRadiance += em * wc;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.06, 0.14), win * (1.0 - lit) * (1.0 - far));`);
    };
    const bcol = ['#262b45', '#2d3350', '#1f2440', '#30304a', '#2a2f4a'];
    const n100 = cfg.per100[qi];
    for (const side of [-1, 1]) {
      // 道に 面した 1列目（すき間なく 並べる）と、その後ろ
      for (const row of [0, 1, 2]) {
        let s = sMin + R() * 10;
        while (s < sMax) {
          const w = 12 + R() * 9, dep = 10 + R() * 9, gap = 1 + R() * 4;
          const xIn = row === 0 ? cfg.minX : row === 1 ? cfg.minX + 26 + R() * 10 : cfg.minX + 58 + R() * 40;
          const x = side * (xIn + dep / 2), sc = s + w / 2;
          if (R() < (row === 0 ? 0.85 : 0.6) * clamp(n100 / 6, 0.4, 1.4) && !nearStands(x, sc, 6) && !blocked(x, sc, 12)) {
            const far = row / 2, h = lerp(cfg.h[0], cfg.h[1], Math.pow(R(), 1.5) * 0.65 + far * 0.35);
            const y = hAt(x, sc) - 0.5;
            ch.addInst(sc, 'bld', geo, bm, M(x, y, -sc, 0, 1).multiply(new THREE.Matrix4().makeScale(dep, h + 0.5, w)), R.pick(bcol));
            // 屋上の 赤い 灯
            if (glow && h > 40 && R() < 0.6) glow.add(new V3(x, y + h + 0.6, -sc), '#ff4a4a', 1.4);
          }
          s += w + gap;
        }
      }
    }
    let acc = 0;
    anim.push(dt => { acc += dt; if (acc > 10) { acc = 0; U.windowSeed.value += 0.31; } });
  }
  // ---- 街灯（よぞら） ----
  if (S.lamps) {
    const poleG = K(merge([colored(new THREE.CylinderGeometry(0.1, 0.13, 6, 8).translate(0, 3, 0), '#4a5068'), colored(new THREE.BoxGeometry(0.1, 0.1, 1.6).translate(0, 6, 0.75), '#4a5068')]));
    const headG = K(new THREE.BoxGeometry(0.6, 0.15, 0.32).translate(0, 5.95, 1.5));
    const hm = K(new THREE.MeshStandardMaterial({ color: '#ffe6a0', emissive: '#ffe6a0', emissiveIntensity: 2.2 }));
    const stex = K(streakTexture());
    const sm = K(new THREE.MeshBasicMaterial({ map: stex, color: '#ffcf8a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    const sg = K(new THREE.PlaneGeometry(1.1, 6).rotateX(-Math.PI / 2));
    for (let s = -C.PRE + 10; s < L + C.POST; s += S.lamps.every) for (const side of [1, -1]) {
      const ss = s + (side > 0 ? 0 : S.lamps.every / 2), x = side * S.lamps.x, y = hAt(x, ss), yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      ch.addInst(ss, 'lampPole', poleG, vm, M(x, y, -ss, yaw));
      ch.addInst(ss, 'lampHead', headG, hm, M(x, y, -ss, yaw), null, { cast: false });
      const hp = new V3(0, 5.85, 1.5).applyAxisAngle(_up, yaw).add(new V3(x, y, -ss));
      lampPts.push(hp); if (glow) glow.add(hp, '#ffd9a0', 2.4);
      // ぬれた 道に 映る 光の すじ（カメラへ のびる）
      ch.addInst(ss, 'streak', sg, sm, M(hp.x * 0.78, H(ss) + 0.035, -ss + 2.6, 0), null, { cast: false, receive: false });
    }
  }

  // ---- 道ぞいの 観客 ----
  if (S.crowd) {
    const cr = S.crowd, left = cr.x[1] < 0;
    for (let s0 = cr.every * 0.6; s0 < L - 30; s0 += cr.every) {
      for (const side of left ? [-1] : [-1, 1]) {
        const n = Math.round(lerp(cr.n[0], cr.n[1], R()));
        const xa = Math.abs(cr.x[0]), xb = Math.abs(cr.x[1]), x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
        for (let k = 0; k < n; k++) {
          const x = side * lerp(x0, x1, R()), s = s0 + (side > 0 ? 12 : 0) + (R() - 0.5) * 6;
          if (nearStands(x, s) || inSea(x, s)) continue;
          const kid = R() < 0.3;
          crowd.add({ x, y: hAt(x, s), z: -s, s, yaw: side > 0 ? -Math.PI / 2 + 0.5 : Math.PI / 2 - 0.5, sc: kid ? 0.62 + R() * 0.1 : 0.88 + R() * 0.18, ph: R() * 6, c: R.pick(SHIRTS), skin: R.pick(SKINS), kind: R() < 0.4 ? 'wave' : R() < 0.5 ? 'jump' : 'flag', flag: (kid || R() < 0.3) ? R.pick(teamCols) : null, pen: R.pick(PENS) });
        }
      }
    }
  }
  crowd.build(); standsCrowd.build();

  // ---- まわりを 飛ぶ 生き物（カメラの まわりに 出しつづける） ----
  const flyers = [];
  if (ambient.butterflies) {
    const wing = K(new THREE.CircleGeometry(0.12, 6, 0, Math.PI).rotateZ(-Math.PI / 2).translate(0.0, 0, 0));
    const wm = K(new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.7 }));
    const n = Math.min(24, Math.round(ambient.butterflies * (qi === 2 ? 0.4 : 0.8)));
    const imL = new THREE.InstancedMesh(wing, wm, n), imR = new THREE.InstancedMesh(wing, wm, n);
    const cols = ['#ffd23f', '#ffffff', '#ff9ad0', '#9ad8ff', '#ffb347'];
    for (let i = 0; i < n; i++) { const c = new THREE.Color(R.pick(cols)); imL.setColorAt(i, c); imR.setColorAt(i, c); flyers.push({ i, s: 0, x: 0, y: 1, ph: R() * 6, sp: 0.8 + R() * 0.6, alive: false }); }
    imL.frustumCulled = imR.frustumCulled = false; root.add(imL, imR);
    const d = new THREE.Object3D();
    anim.push((dt, t, ctx) => {
      for (const f of flyers) {
        if (!f.alive || f.s < ctx.camS - 8 || f.s > ctx.camS + 120) { f.alive = true; f.s = ctx.camS + 20 + R() * 90; f.x = (R() < 0.5 ? -1 : 1) * (6 + R() * 10); f.y = 0.8 + R() * 1.4; f.bx = f.x; }
        f.x = f.bx + Math.sin(t * 0.7 * f.sp + f.ph) * 2; const y = hAt(f.x, f.s) + f.y + Math.sin(t * 1.9 + f.ph) * 0.4;
        f.s += Math.sin(t * 0.5 + f.ph) * dt * 0.8;
        const flap = Math.sin(t * 22 * f.sp + f.ph) * 1.1;
        for (const [im, sg] of [[imL, 1], [imR, -1]]) { d.position.set(f.x, y, -f.s); d.rotation.set(0, f.ph + t * 0.3, sg * flap, 'YXZ'); d.scale.set(sg, 1, 1); d.updateMatrix(); im.setMatrixAt(f.i, d.matrix); }
      }
      imL.instanceMatrix.needsUpdate = imR.instanceMatrix.needsUpdate = true;
    });
  }
  if (ambient.gulls) {
    const wg = K(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, 0.8, 0.06, 0, 0, 0, -0.18, 0, 0, 0.18, -0.8, 0.06, 0, 0, 0, -0.18], 3)); wg.computeVertexNormals();
    const gm = K(new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.8 }));
    const gulls = [];
    for (let i = 0; i < ambient.gulls; i++) { const g = new THREE.Mesh(wg, gm); root.add(g); gulls.push({ g, s: R() * L, x: 20 + R() * 60, h: 12 + R() * 14, r: 12 + R() * 18, ph: R() * 6, sp: 2 * Math.PI / (14 + R() * 10) }); }
    anim.push((dt, t, ctx) => {
      for (const q of gulls) {
        if (q.s < ctx.camS - 30 || q.s > ctx.camS + 260) { q.s = ctx.camS + 60 + R() * 180; }
        const a = q.ph + t * q.sp;
        q.g.position.set(q.x + Math.cos(a) * q.r, q.h + Math.sin(t * 0.5 + q.ph) * 2, -q.s + Math.sin(a) * q.r);
        q.g.rotation.set(0, -a, Math.sin(a) * 0.3); q.g.scale.y = 1 + Math.sin(t * 7 + q.ph) * 3;
      }
    });
  }

  ch.build();
  return {
    root, chunks: ch, crowd, standsCrowd, fireworksAt, snowfall, smokes, lampPts,
    // ctx：{ camS, camPos, nearRunner(x, s, r), playerS, final }
    update(dt, t, ctx) {
      for (const f of anim) f(dt, t, ctx);
      const ps = ctx.playerS ?? ctx.camS;
      crowd.update(dt, t, q => { const ds = Math.abs((q.s ?? -q.z) - ps); return ds < 18 ? 1.2 : ds < 50 ? 0.6 : 0.2; });
      const cs = ctx.camS, nearSt = Math.abs(cs) < 260 || Math.abs(cs - L) < 460;
      standsCrowd.setVisible(nearSt);
      if (nearSt) standsCrowd.update(dt, t, q => { const ds = Math.abs(-q.z - ps); return ds < 60 ? 1 : 0.35; });
    },
    cheer(t = 3) { standsCrowd.cheer(t); crowd.cheer(t * 0.6); },
    dispose() { crowd.dispose(); standsCrowd.dispose(); ch.dispose(); keep.forEach(k => k && k.dispose && k.dispose()); }
  };
}
