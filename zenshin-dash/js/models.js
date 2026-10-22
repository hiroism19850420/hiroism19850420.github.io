// キャラクターと カート（第8部・第9部・付録J・付録T）
// 動かない 部品は 頂点の色で 1つに まとめて、描く回数を へらす
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from './config.js';
import { clamp, damp, lerp, Spring } from './util.js';
import { blobTexture, bibTexture, labelTexture } from './tex.js';

const V3 = THREE.Vector3;
export const CHARS = {
  mimi:  { no: 1, name: 'ミミ', animal: 'rabbit',  body: '#fff4f6', second: '#ffb3c8', kart: '#ff6fae', goggle: '#ffd54a', say: 'スタートは まかせて！' },
  goro:  { no: 2, name: 'ゴロ', animal: 'bear',    body: '#b5784a', second: '#f1d2a8', kart: '#e8483b', goggle: '#3fa9f5', say: 'ちからもち だよ！' },
  tama:  { no: 3, name: 'タマ', animal: 'cat',     body: '#ffb347', second: '#fff1dc', kart: '#ffd23f', goggle: '#ff6fae', say: 'カーブは とくい！' },
  kero:  { no: 4, name: 'ケロ', animal: 'frog',    body: '#7ccf4f', second: '#e9f7c8', kart: '#2fbf71', goggle: '#ff7a2f', say: 'ジャンプ だいすき！' },
  pen:   { no: 5, name: 'ペン', animal: 'penguin', body: '#2f3f6e', second: '#ffffff', kart: '#3f8cff', goggle: '#ffd54a', say: 'こおりの みちは まかせて！' },
  pochi: { no: 6, name: 'ポチ', animal: 'dog',     body: '#f4e6cc', second: '#8a5a3b', kart: '#9b6bff', goggle: '#56d364', say: 'ほしを あつめるのが すき！' }
};
export const CHAR_IDS = ['mimi', 'goro', 'tama', 'kero', 'pen', 'pochi'];

// ---------- 部品を まとめる 道具 ----------
const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _qq = new THREE.Quaternion();
// p(geo, color, [x,y,z], [sx,sy,sz], [rx,ry,rz])
function P(geo, color, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0]) {
  if (typeof scl === 'number') scl = [scl, scl, scl];
  _e.set(rot[0], rot[1], rot[2]); _qq.setFromEuler(_e);
  return { geo, color, m: new THREE.Matrix4().compose(new V3(...pos), _qq.clone(), new V3(...scl)) };
}
const colCache = new Map();
function lin(hex) { if (!colCache.has(hex)) colCache.set(hex, new THREE.Color(hex)); return colCache.get(hex); }
function mergeParts(parts) {
  const list = parts.map(({ geo, color, m }) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m);
    const c = lin(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  const out = mergeGeometries(list);
  list.forEach(g => g.dispose());
  out.computeBoundingSphere();
  return out;
}
const MAT = {};
function vmat(key, o) { return MAT[key] || (MAT[key] = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#ffffff', ...o })); }

// ---------- 共有の 形 ----------
const G = {};
function geo() {
  if (G.ready) return G;
  G.sphere = new THREE.SphereGeometry(1, 22, 16);
  G.sphereLo = new THREE.SphereGeometry(1, 12, 9);
  G.cap = len => new THREE.CapsuleGeometry(1, len, 5, 12);
  // 腕・足：両はしの 丸い 先の 中心が y = 0 と y = 3.5（placeSeg で 長さに 合わせて ちぢめる）
  G.limb = new THREE.CapsuleGeometry(1, 3.5, 3, 10).translate(0, 1.75, 0);
  G.cone = new THREE.ConeGeometry(1, 1, 14, 1);
  G.arc = (r, t, a) => new THREE.TorusGeometry(r, t, 6, 14, a);
  G.disc = new THREE.CircleGeometry(1, 18);
  G.cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
  G.ready = true;
  return G;
}

// ---------- 2骨 IK ----------
const _d = new V3(), _p = new V3(), _q = new THREE.Quaternion(), _y = new V3(0, 1, 0);
function solveIK(A, T, a, b, pole, outMid, outEnd) {
  _d.subVectors(T, A);
  let c = _d.length();
  const dir = _d.normalize();
  c = clamp(c, 0.02, a + b - 0.002);
  const ang = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1));
  _p.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (_p.lengthSq() < 1e-6) _p.set(0, 1, 0).addScaledVector(dir, -dir.y);
  _p.normalize();
  outMid.copy(A).addScaledVector(dir, Math.cos(ang) * a).addScaledVector(_p, Math.sin(ang) * a);
  outEnd.copy(A).addScaledVector(dir, c);
}
function placeSeg(m, A, B, r) {
  _d.subVectors(B, A);
  const len = _d.length();
  m.position.copy(A);
  _q.setFromUnitVectors(_y, _d.normalize());
  m.quaternion.copy(_q);
  m.scale.set(r, Math.max(0.01, len) / 3.5, r);
}

// ---------- キャラクター ----------
export class Character {
  constructor(id) {
    geo();
    const C = CHARS[id];
    this.id = id; this.C = C;
    const A = C.animal, BODY = C.body, SEC = C.second, DARK = '#1d2433', WHITE = '#ffffff';
    const skinM = vmat('skin', { roughness: 0.62 });
    const g = this.group = new THREE.Group();
    g.scale.setScalar(A === 'bear' ? 1.06 : 1);
    // 上半身
    const upper = this.upper = new THREE.Group(); upper.position.set(0, 0.16, 0); g.add(upper);
    const tp = [P(G.cap(1.1), BODY, [0, 0.24, 0], 0.2)];
    if (A !== 'dog') tp.push(P(G.sphere, A === 'penguin' ? WHITE : SEC, [0, 0.2, 0.13], [0.16 * (A === 'frog' ? 1.3 : A === 'penguin' ? 1.4 : 1), 0.16 * (A === 'penguin' ? 1.4 : 1.2), 0.08]));
    if (A === 'rabbit') tp.push(P(G.sphereLo, WHITE, [0, 0.05, -0.22], 0.08));
    const torso = new THREE.Mesh(mergeParts(tp), skinM); torso.castShadow = true; upper.add(torso);
    // 頭
    const head = this.head = new THREE.Group(); head.position.set(0, 0.70, 0.02); upper.add(head);
    const hp = [P(G.sphere, BODY, [0, 0, 0], 0.3)];
    this.headParts(hp, C);
    const headMesh = new THREE.Mesh(mergeParts(hp), skinM); headMesh.castShadow = true; head.add(headMesh);
    // 目
    const big = A === 'frog' ? 1.3 : 1;
    const eyePos = sx => A === 'frog' ? [sx * 0.15, 0.27, 0.14] : [sx * 0.11, 0.04, 0.25];
    const en = [], eh = [];
    for (const sx of [-1, 1]) {
      const [ex, ey, ez] = eyePos(sx);
      en.push(P(G.sphere, WHITE, [ex, 0, ez], 0.085 * big));
      en.push(P(G.sphere, DARK, [ex, -0.005, ez + 0.045 * big], 0.055 * big));
      en.push(P(G.sphereLo, '#ffffff', [ex - 0.018 * big, 0.022 * big, ez + 0.092 * big], 0.019 * big));
      eh.push(P(G.arc(0.06 * big, 0.016, Math.PI), DARK, [ex, -0.01, ez + 0.07]));
    }
    this.eyeY = eyePos(1)[1];
    this.eyesN = new THREE.Mesh(mergeParts(en), vmat('eye', { roughness: 0.25 })); this.eyesN.position.y = this.eyeY; head.add(this.eyesN);
    this.eyesH = new THREE.Mesh(mergeParts(eh), skinM); this.eyesH.position.y = this.eyeY; this.eyesH.visible = false; head.add(this.eyesH);
    // ほっぺ
    const ck = [];
    for (const sx of [-1, 1]) ck.push(P(G.disc, '#ff8fab', [sx * 0.19, -0.08, 0.235], 0.055, [0, sx * 0.68, 0]));
    const cheek = new THREE.Mesh(mergeParts(ck), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.55, roughness: 0.9, depthWrite: false }));
    head.add(cheek);
    // 口
    const mY = A === 'frog' ? -0.1 : -0.12, mZ = A === 'frog' ? 0.25 : 0.285;
    const arcA = A === 'frog' ? Math.PI * 0.66 : Math.PI * 0.78;
    const mouthM = vmat('mouth', { roughness: 0.5 });
    this.mSmile = new THREE.Mesh(mergeParts([P(G.arc(A === 'frog' ? 0.14 : 0.045, 0.012, arcA), '#5a2a2a', [0, mY + 0.03, mZ], 1, [0, 0, Math.PI + (Math.PI - arcA) / 2])]), mouthM); head.add(this.mSmile);
    this.mOpen = new THREE.Mesh(mergeParts([P(G.sphereLo, '#5a2a2a', [0, 0, 0], [0.045, 0.035, 0.02]), P(G.sphereLo, '#ff6f8a', [0, -0.012, 0.004], [0.027, 0.014, 0.016])]), mouthM);
    this.mOpen.position.set(0, mY + 0.005, mZ - 0.01); this.mOpen.visible = false; head.add(this.mOpen);
    this.mOh = new THREE.Mesh(mergeParts([P(G.arc(0.03, 0.011, Math.PI * 2), '#5a2a2a', [0, mY + 0.01, mZ])]), mouthM); this.mOh.visible = false; head.add(this.mOh);
    // 耳（ばね）
    this.ears = [];
    if (A === 'rabbit' || A === 'dog') for (const sx of [-1, 1]) {
      const piv = new THREE.Group();
      let ep;
      if (A === 'rabbit') { piv.position.set(sx * 0.1, 0.24, -0.02); piv.rotation.set(-0.17, 0, -sx * 0.21); ep = [P(G.cap(3.6), BODY, [0, 0.21, 0], [0.075, 0.075, 0.042]), P(G.cap(4.2), SEC, [0, 0.22, 0.03], [0.05, 0.055, 0.02])]; }
      else { piv.position.set(sx * 0.24, 0.12, 0); piv.rotation.set(0, 0, sx * (Math.PI - 0.35)); ep = [P(G.cap(0.9), SEC, [0, 0.13, 0], [0.04, 0.09, 0.09])]; }
      const em = new THREE.Mesh(mergeParts(ep), skinM); em.castShadow = true; piv.add(em); head.add(piv);
      piv.userData.base = piv.rotation.clone();
      this.ears.push(piv);
    }
    // しっぽ
    if (A === 'cat' || A === 'dog') {
      const tail = this.tail = new THREE.Group(); tail.position.set(0, A === 'cat' ? 0.0 : 0.06, -0.22); upper.add(tail);
      if (A === 'cat') {
        const curve = new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(0, 0.15, -0.12), new V3(0, 0.35, -0.1), new V3(0.05, 0.48, 0.02)]);
        tail.add(new THREE.Mesh(mergeParts([P(new THREE.TubeGeometry(curve, 10, 0.04, 7), BODY)]), skinM));
      } else tail.add(new THREE.Mesh(mergeParts([P(G.cone, BODY, [0, 0.09, 0], [0.04, 0.18, 0.04])]), skinM));
    }
    // 腕・足
    const limbM = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.62 });
    const handM = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.62 });
    const shoeC = A === 'penguin' ? '#ff9f1c' : A === 'frog' ? BODY : new THREE.Color(C.kart).multiplyScalar(0.7).getStyle();
    const shoeM = new THREE.MeshStandardMaterial({ color: shoeC, roughness: 0.55 });
    this.arm = [0, 1].map(i => {
      const up = new THREE.Mesh(G.limb, limbM), fo = new THREE.Mesh(G.limb, limbM);
      const hand = new THREE.Mesh(G.sphereLo, handM); hand.scale.setScalar(A === 'frog' ? 0.09 : 0.075); if (A === 'frog') hand.scale.y = 0.05;
      up.castShadow = fo.castShadow = true;
      upper.add(up, fo, hand);
      return { up, fo, hand, sh: new V3((i ? -1 : 1) * 0.2, 0.42, 0.02), mid: new V3(), end: new V3(), cur: new V3(), init: false };
    });
    this.leg = [0, 1].map(i => {
      const th = new THREE.Mesh(G.limb, limbM), sn = new THREE.Mesh(G.limb, limbM);
      const foot = A === 'penguin' || A === 'frog' ? new THREE.Mesh(G.sphereLo, shoeM) : new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.09, 0.2, 2, 0.04), shoeM);
      if (A === 'penguin' || A === 'frog') foot.scale.set(0.09, 0.04, 0.13);
      th.castShadow = sn.castShadow = true;
      g.add(th, sn, foot);
      return { th, sn, foot, hip: new V3((i ? -1 : 1) * 0.1, 0.1, 0.08), mid: new V3(), end: new V3() };
    });
    this.springs = { earL: new Spring(90, 7, 0.9), earR: new Spring(90, 7, 0.9), tail: new Spring(60, 5, 0.8), head: new Spring(160, 14, 0.2) };
    this.face = 'normal'; this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    this.lean = 0; this.fwd = 0.14; this.crouch = 0; this.banzai = 0; this.lookYaw = 0;
    this._v = [new V3(), new V3(), new V3()];
  }

  headParts(hp, C) {
    const A = C.animal, BODY = C.body, SEC = C.second;
    switch (A) {
      case 'rabbit': hp.push(P(G.sphereLo, SEC, [0, -0.06, 0.295], 0.035)); break;
      case 'bear':
        for (const sx of [-1, 1]) { hp.push(P(G.sphere, BODY, [sx * 0.22, 0.24, -0.02], 0.11), P(G.sphere, '#8a5532', [sx * 0.22, 0.24, 0.04], [0.065, 0.065, 0.03])); }
        hp.push(P(G.sphere, SEC, [0, -0.1, 0.2], [0.14, 0.105, 0.084]), P(G.sphereLo, '#3a2418', [0, -0.05, 0.31], [0.058, 0.04, 0.04]));
        break;
      case 'cat':
        for (const sx of [-1, 1]) {
          hp.push(P(G.cone, BODY, [sx * 0.17, 0.27, 0], [0.11, 0.2, 0.11], [0, 0, -sx * 0.31]), P(G.cone, '#ffd9b0', [sx * 0.17, 0.26, 0.03], [0.065, 0.12, 0.05], [0, 0, -sx * 0.31]));
          for (const k of [-1, 0, 1]) hp.push(P(G.cyl, '#5a3a2a', [sx * 0.27, -0.09 + k * 0.02, 0.22], [0.006, 0.18, 0.006], [0, 0, Math.PI / 2 + k * 0.21 * sx]));
        }
        hp.push(P(G.sphere, SEC, [0, -0.1, 0.21], [0.1, 0.075, 0.07]), P(G.sphereLo, '#ff8fab', [0, -0.05, 0.3], [0.03, 0.021, 0.02]));
        for (const k of [-1, 0, 1]) hp.push(P(G.arc(0.2, 0.02, 0.9), '#e08a2a', [k * 0.07, 0.17, -0.02], 1, [0, Math.PI / 2, Math.PI / 2 - 0.45]));
        break;
      case 'frog': for (const sx of [-1, 1]) hp.push(P(G.sphere, BODY, [sx * 0.15, 0.25, 0.06], 0.14)); break;
      case 'penguin':
        for (const sx of [-1, 1]) hp.push(P(G.sphere, '#ffffff', [sx * 0.07, 0.0, 0.17], [0.17, 0.2, 0.085]));
        hp.push(P(G.cone, '#ff9f1c', [0, -0.07, 0.33], [0.06, 0.12, 0.05], [Math.PI / 2, 0, 0]));
        for (const k of [-1, 0, 1]) hp.push(P(G.cone, BODY, [k * 0.04, 0.32, 0], [0.025, 0.08, 0.025], [0, 0, k * 0.4]));
        break;
      case 'dog':
        hp.push(P(G.sphere, SEC, [-0.11, 0.05, 0.215], [0.12, 0.12, 0.06]), P(G.sphere, '#fff8ea', [0, -0.1, 0.21], [0.11, 0.08, 0.075]), P(G.sphereLo, '#2a1d16', [0, -0.05, 0.31], 0.05));
        break;
    }
    // ゴーグル
    if (A !== 'frog') {
      hp.push(P(new THREE.TorusGeometry(0.295, 0.024, 6, 30), C.goggle, [0, 0.12, -0.01], 1, [Math.PI / 2 + 0.35, 0, 0]));
      for (const sx of [-1, 1]) {
        hp.push(P(G.cyl, C.goggle, [sx * 0.1, 0.27, 0.16], [0.075, 0.05, 0.075], [-0.75, 0, 0]));
        hp.push(P(G.cyl, '#bfe8ff', [sx * 0.1, 0.275, 0.166], [0.058, 0.052, 0.058], [-0.75, 0, 0]));
      }
    } else hp.push(P(new THREE.TorusGeometry(0.29, 0.022, 6, 28), C.goggle, [0, 0.05, 0], 1, [Math.PI / 2, 0, 0]));
  }

  setFace(f) {
    if (f === this.face) return; this.face = f;
    const happy = f === 'happy';
    this.eyesN.visible = !happy; this.eyesH.visible = happy;
    this.mSmile.visible = f === 'normal';
    this.mOpen.visible = f === 'effort' || f === 'happy';
    this.mOh.visible = f === 'oops';
    this.mOpen.scale.set(1, f === 'happy' ? 1.4 : 1, 1);
  }

  // p：{ grips:[V3,V3]（世界）, feet:[V3,V3]（世界）, steer, crouch, banzai, throttle, pedal, accelY, accelX, lookYaw, wave, clap, happy }
  pose(p, dt, t) {
    // 走る体（RunnerRig）は fwd・roll・twist を 直接 わたす（付録T T.1）
    const run = p.fwd != null;
    this.lean = run ? (p.roll || 0) : damp(this.lean, -(p.steer || 0) * 0.18, 0.1, dt);
    this.crouch = damp(this.crouch, p.crouch ? 1 : 0, 0.09, dt);
    this.fwd = run ? p.fwd : damp(this.fwd, 0.14 + (p.throttle || 0) * 0.12, 0.12, dt);
    this.banzai = damp(this.banzai, p.banzai ? 1 : 0, 0.07, dt);
    const tilt = this.fwd + (run ? 0 : this.crouch * 0.55);
    this.upper.rotation.set(tilt, p.twist || 0, this.lean);
    this.upper.position.y = 0.16 - (run ? 0 : this.crouch * 0.16) + Math.sin((p.pedal || 0) * 2) * 0.012 * (p.throttle || 0);
    this.upper.position.z = run ? 0 : this.crouch * 0.06;
    this.lookYaw = damp(this.lookYaw, (p.steer || 0) * 0.35 + (p.lookYaw || 0), 0.15, dt);
    const hs = this.springs.head.step(dt, (p.accelY || 0) * 0.4);
    this.head.rotation.set(-tilt * (run ? 0.7 : 0.75) + hs * 0.5, this.lookYaw - (p.twist || 0) * 0.6, -this.lean * 0.4);
    const ay = p.accelY || 0, ax = p.accelX || 0;
    if (this.ears.length) {
      const l = this.springs.earL.step(dt, -ay * 0.6 + ax * 0.4), r = this.springs.earR.step(dt, -ay * 0.6 - ax * 0.4);
      const b0 = this.ears[0].userData.base, b1 = this.ears[1].userData.base;
      if (this.C.animal === 'rabbit') { this.ears[0].rotation.set(b0.x + l, 0, b0.z + l * 0.3); this.ears[1].rotation.set(b1.x + r, 0, b1.z - r * 0.3); }
      else { this.ears[0].rotation.set(b0.x + l * 0.8, 0, b0.z); this.ears[1].rotation.set(b1.x + r * 0.8, 0, b1.z); }
    }
    if (this.tail) this.tail.rotation.z = this.springs.tail.step(dt, ax * 0.5 + Math.sin(t * 9) * (p.happy ? 30 : 0));
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 0.12; this.blinkT = 3 + Math.random() * 3; }
    if (this.blink > 0) this.blink -= dt;
    const eyeSY = this.blink > 0 ? 0.12 : this.face === 'effort' ? 0.6 : this.face === 'oops' ? 1.25 : 1;
    this.eyesN.scale.set(this.face === 'oops' ? 1.12 : 1, eyeSY, 1);
    // 腕
    this.group.updateMatrixWorld(true);
    const inv = this._inv || (this._inv = new THREE.Matrix4());
    inv.copy(this.upper.matrixWorld).invert();
    const pole = this._v[0];
    for (let i = 0; i < 2; i++) {
      const Ar = this.arm[i], side = i ? -1 : 1;
      const tgt = this._v[1];
      if (p.grips) tgt.copy(p.grips[i]).applyMatrix4(inv); else tgt.set(side * 0.16, 0.18, 0.25);
      const up = this._v[2];
      let k = this.banzai;
      if (p.wave && i === 0) { up.set(0.28 + Math.sin(t * 12) * 0.12, 0.78, 0.12); k = 1; }
      else if (p.clap) { up.set(side * (0.04 + Math.abs(Math.sin(t * 8)) * 0.13), 0.42, 0.3); k = 1; }
      else up.set(side * 0.17, 0.86, 0.05);
      if (k > 0.001) tgt.lerp(up, k);
      if (!Ar.init) { Ar.cur.copy(tgt); Ar.init = true; }
      Ar.cur.lerp(tgt, 1 - Math.exp(-dt / 0.04));
      pole.set(side, -0.7, -0.4);
      solveIK(Ar.sh, Ar.cur, 0.22, 0.21, pole, Ar.mid, Ar.end);
      placeSeg(Ar.up, Ar.sh, Ar.mid, 0.068);
      placeSeg(Ar.fo, Ar.mid, Ar.end, 0.062);
      Ar.hand.position.copy(Ar.end);
    }
    // 足
    const ginv = this._ginv || (this._ginv = new THREE.Matrix4());
    ginv.copy(this.group.matrixWorld).invert();
    for (let i = 0; i < 2; i++) {
      const Lg = this.leg[i], side = i ? -1 : 1;
      const tgt = this._v[1];
      if (p.feet) tgt.copy(p.feet[i]).applyMatrix4(ginv); else tgt.set(side * 0.1, -0.2, 0.45);
      pole.set(side * 0.15, 1, 0.6);
      solveIK(Lg.hip, tgt, 0.31, 0.3, pole, Lg.mid, Lg.end);
      placeSeg(Lg.th, Lg.hip, Lg.mid, 0.078);
      placeSeg(Lg.sn, Lg.mid, Lg.end, 0.066);
      Lg.foot.position.set(Lg.end.x, Lg.end.y - 0.02, Lg.end.z + 0.03);
    }
  }
}


// ================= 走る体（第8部、付録T） =================
const RUN = () => CFG.run;
let BLOBTEX = null, STARG = null;
function starGeo() {
  if (STARG) return STARG;
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.045 : 0.1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  STARG = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }).translate(0, 0, -0.01);
  return STARG;
}
const _qx90 = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);

export class RunnerRig {
  constructor(id, { tag = null, ghosts = 0 } = {}) {
    geo();
    this.id = id; this.C = CHARS[id];
    const team = this.C.kart;
    this.c = new Character(id);
    this.root = new THREE.Group(); this.root.name = 'runner-' + id;
    this.body = new THREE.Group(); this.root.add(this.body);
    this.body.add(this.c.group);
    this.c.group.rotation.y = Math.PI;                  // キャラの 前（+z）を 走る向き（−z）へ
    this.own = [];                                      // この 体だけの 形と 材質（こわすとき 捨てる）
    // ---- ゼッケン（胴の 前と 後ろ、まるく そわせる） ----
    const bibTex = bibTexture(team, this.C.no);
    const bibM = new THREE.MeshStandardMaterial({ map: bibTex, roughness: 0.7, transparent: true, alphaTest: 0.05 });
    this.own.push(bibTex, bibM);
    for (const [t0, z] of [[-0.48, 1], [Math.PI - 0.48, -1]]) {
      const g = new THREE.CylinderGeometry(0.212, 0.212, 0.15, 10, 1, true, t0, 0.96);
      const m = new THREE.Mesh(g, bibM); m.position.set(0, 0.25, z > 0 ? 0.004 : -0.004); this.c.upper.add(m); this.own.push(g);
    }
    // ---- くつ（1.15倍） ----
    for (const L of this.c.leg) L.foot.scale.multiplyScalar(1.15);
    // ---- 手首の バンド ----
    const bandM = new THREE.MeshStandardMaterial({ color: team, roughness: 0.6 }), bandG = new THREE.TorusGeometry(0.058, 0.018, 6, 14);
    this.own.push(bandM, bandG);
    this.bands = [0, 1].map(() => { const b = new THREE.Mesh(bandG, bandM); this.c.upper.add(b); return b; });
    // ---- はちまきの 帯（頭の 後ろ） ----
    this.tails = [];
    const tailM = new THREE.MeshStandardMaterial({ color: team, roughness: 0.7, side: THREE.DoubleSide }); this.own.push(tailM);
    for (const sx of [-1, 1]) {
      const g = new THREE.PlaneGeometry(0.055, 0.42, 1, 8);
      const m = new THREE.Mesh(g, tailM); m.frustumCulled = false; m.castShadow = true;
      m.position.set(sx * 0.045, 0.13, -0.285); this.c.head.add(m); this.own.push(g);
      this.tails.push({ m, g, sx, ph: Math.random() * 6 });
    }
    // ---- まるい 影 ----
    if (!BLOBTEX) BLOBTEX = blobTexture();
    const blobG = new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), blobM = new THREE.MeshBasicMaterial({ map: BLOBTEX, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.blob = new THREE.Mesh(blobG, blobM); this.own.push(blobG, blobM);
    this.blob.renderOrder = 1; this.blob.position.y = 0.03; this.root.add(this.blob);
    // ---- 名前の 札・「！」・よろけの 星 ----
    if (tag) { const tt = labelTexture(tag, team), tm = new THREE.SpriteMaterial({ map: tt, transparent: true }); this.tag = new THREE.Sprite(tm); this.tag.scale.set(1.0, 0.375, 1); this.tag.position.y = 1.85; this.body.add(this.tag); this.own.push(tt, tm); }
    const bt = labelTexture('！', '#ff3b30'), bm = new THREE.SpriteMaterial({ map: bt, depthTest: false, transparent: true }); this.own.push(bt, bm);
    this.bang = new THREE.Sprite(bm); this.bang.scale.set(0.9, 0.34, 1); this.bang.position.y = 1.55; this.bang.visible = false; this.bang.renderOrder = 6; this.body.add(this.bang);
    this.stars = new THREE.Group(); this.stars.position.set(0, 0.35, 0); this.c.head.add(this.stars);
    const starM = new THREE.MeshStandardMaterial({ color: '#ffd54a', emissive: '#ffb000', emissiveIntensity: 0.6, roughness: 0.4 }); this.own.push(starM);
    for (let i = 0; i < 3; i++) this.stars.add(new THREE.Mesh(starGeo(), starM));
    this.stars.visible = false;
    // ---- 状態 ----
    this.hip = 0.48; this.fwd = 0.2; this.roll = 0; this.twist = 0; this.yaw = 0; this.squashT = 0; this.wasAir = false;
    this.spec = null; this.specT = 0; this.mode = 'run'; this.modeT = 0;
    this._f = [new V3(), new V3()]; this._h = [new V3(), new V3()];
    this._fw = [new V3(), new V3()]; this._hw = [new V3(), new V3()];
    this._sh = [new V3(), new V3()];
    this.ghosts = []; this.gi = 0; this.ghostT = 0;
    if (ghosts > 0) this.makeGhosts(ghosts);
  }

  // 肩の 位置（体の ローカル）
  shoulder(i, out) { const sx = i ? -1 : 1; return out.set(sx * 0.2, 0.42, 0.02).applyEuler(this.c.upper.rotation).add(this.c.upper.position); }

  // r：Runner（または 同じ形の もの）、H：道の高さ、x：{ windup, mirror, look, mode, cheer, ghost, faceYaw }
  update(r, dt, t, H, x = {}) {
    const R = RUN(), V = r.v || 0, spd = clamp(V / R.V_MAX, 0, 1.2);
    const mode = x.mode || (r.finished ? (x.cheer ? 'cheer' : 'tired') : 'run');
    if (mode !== this.mode) { this.mode = mode; this.modeT = 0; } this.modeT += dt;
    const air = !!r.air, crouch = r.crouch;
    // ---- 姿勢の 段 ----
    let hip = 0.47, fwd = 0.12 + 0.34 * spd, bobA = 0.04 * spd, strideK = 1, armK = 1, liftK = 1;
    if (crouch === 'run') { hip = 0.33; fwd = 0.72; bobA = 0.015; strideK = 0.7; armK = 0.45; liftK = 0.6; }
    if (crouch === 'walk') { hip = 0.30; fwd = 0.58; bobA = 0.01; strideK = 0.45; armK = 0.3; liftK = 0.5; }
    if (r.charging) { hip -= 0.1; fwd += 0.15; }
    if (air) fwd = 0.42;
    if (r.stumbleT > 0) { strideK *= 0.5; fwd += 0.1; }
    if ((r.spurt || 0) > 0.3 && !crouch) armK *= 1.45;
    const still = (V < 0.4 && (r.stepRate || 0) < 0.3) || mode === 'stretch' || mode === 'squatIdle' || mode === 'wave';
    if (still) { hip = 0.5; fwd = 0.06; bobA = 0; }
    if (mode === 'ready') { hip = 0.43; fwd = 0.42; }
    if (mode === 'set') { hip = 0.4; fwd = 0.6; }
    if (mode === 'tired') { hip = 0.36; fwd = 0.95; }
    if (mode === 'stretch') { hip = 0.5; fwd = -0.08; }
    if (mode === 'squatIdle') { hip = 0.32 + 0.14 * (0.5 + 0.5 * Math.cos(this.modeT * 3.5)); fwd = 0.3; }
    this.hip = damp(this.hip, hip, 0.07, dt); this.fwd = damp(this.fwd, fwd, air ? 0.05 : 0.09, dt);
    // ---- 着地の しずみ ----
    if (this.wasAir && !air) this.squashT = 0.16;
    this.wasAir = air;
    this.squashT = Math.max(0, this.squashT - dt);
    const squash = -Math.sin((this.squashT / 0.16) * Math.PI) * 0.08;
    // ---- 体の 位置 ----
    const ph = r.phase || 0;
    const bob = still ? 0 : Math.abs(Math.sin((ph - 0.21) * 2 * Math.PI)) * bobA;
    if (x.at) this.root.position.copy(x.at); else this.root.position.set(r.d, H(r.s), -r.s);
    this.body.position.y = (r.h || 0) + this.hip + bob + squash;
    // 横へ 動く向きへ 体を むける・かたむける
    const vd = r.vd || 0;
    this.yaw = damp(this.yaw, -Math.atan2(vd, Math.max(V, 3)) * 0.7, 0.1, dt);
    this.root.rotation.y = this.yaw + (x.faceYaw || 0);
    let roll = clamp(vd * 0.07, -0.35, 0.35), twist = 0;
    if (Math.abs(vd) > 4) roll *= 1.4;
    // ---- 足（体の ローカル：前 +z、腰の 下） ----
    const A = clamp(0.13 + V * 0.008, 0.13, 0.3) * strideK * clamp(V / 2.5, 0.2, 1), LIFT = (0.09 + 0.27 * spd) * liftK;
    const sh = [this.shoulder(0, this._sh[0]), this.shoulder(1, this._sh[1])];
    const lead = Math.floor((ph + 0.25) * 2) % 2;                              // 空中で 前に 出す 足
    for (let i = 0; i < 2; i++) {
      const sx = i ? -1 : 1, tt = (ph + i * 0.5) % 1, f = this._f[i];
      if (air) {
        if (i === lead) f.set(sx * 0.1, -this.hip + 0.16, 0.36);
        else f.set(sx * 0.12, -this.hip + 0.3, -0.16);
      } else if (still) {
        f.set(sx * 0.12, -this.hip + 0.04, 0.04 + (mode === 'ready' || mode === 'set' ? (i ? -0.22 : 0.18) : 0));
      } else {
        const st = 0.42;
        let z, y;
        if (tt < st) { z = A - 2 * A * (tt / st); y = 0; }
        else { const w = (tt - st) / (1 - st); z = -A + 2 * A * (3 * w * w - 2 * w * w * w) + Math.sin(Math.PI * w) * A * 0.35 * spd; y = LIFT * Math.sin(Math.PI * w); }
        // 足ぶみ だけでも 足を あげる
        if (V < 2.5 && (r.stepRate || 0) > 0.3) y = Math.max(y, tt >= st ? 0.16 * Math.sin(Math.PI * (tt - st) / (1 - st)) : 0);
        f.set(sx * (0.11 + (Math.abs(vd) > 4 && Math.sign(vd) === -sx ? -0.08 : 0)), -this.hip + 0.04 + y, z + 0.03);
      }
    }
    // ---- 手 ----
    const B = (0.1 + 0.22 * spd) * armK;
    for (let i = 0; i < 2; i++) {
      const sx = i ? -1 : 1, h = this._h[i], s = sh[i];
      if (air) {
        const fwdArm = i !== lead;
        h.set(sx * 0.24, s.y - (fwdArm ? 0.04 : 0.2), s.z + (fwdArm ? 0.3 : -0.22));
      } else if (still) {
        h.set(sx * 0.26, s.y - 0.38, s.z + 0.04);
        if (mode === 'ready' || mode === 'set') h.set(sx * 0.22, s.y - 0.3, s.z + (i ? 0.2 : -0.18));
      } else if (crouch) {
        const tt = (ph + i * 0.5) % 1, sw = -Math.cos(2 * Math.PI * tt);
        h.set(sx * 0.2, s.y - 0.24, s.z + 0.16 + B * sw);
      } else {
        const tt = (ph + i * 0.5) % 1, sw = -Math.cos(2 * Math.PI * tt);
        h.set(sx * 0.22, s.y - 0.27 + 0.11 * Math.max(0, sw) * (0.4 + spd), s.z + 0.05 + B * sw);
      }
      if (r.charging) h.set(sx * 0.26, s.y - 0.28, s.z - 0.25);
    }
    // ---- とくべつな 姿勢（第8部 8.7） ----
    const sp = x.windup || (r.stumbleT > 0 ? 'stumble' : r.special) || (mode !== 'run' ? mode : null);
    if (sp !== this.spec) { this.spec = sp; this.specT = 0; } this.specT += dt;
    const k = this.specT;
    switch (sp) {
      case 'banzai': { const p = Math.min(1, k / 0.12), push = k > 0.25 ? Math.min(1, (k - 0.25) / 0.1) : 0; for (let i = 0; i < 2; i++) { const sx = i ? -1 : 1; this._h[i].lerp(_v.set(sx * 0.36, sh[i].y + 0.38, sh[i].z - 0.04 + push * 0.26), p); } this.fwd = Math.min(this.fwd, 0.12); break; }
      case 'swatR': case 'swatL': {
        const i = sp === 'swatR' ? 1 : 0, sx = i ? -1 : 1, up = Math.min(1, k / 0.12), out = k > 0.2 ? Math.min(1, (k - 0.2) / 0.15) : 0;
        this._h[i].lerp(_v.set(sx * (0.25 + out * 0.3), sh[i].y + 0.4 - out * 0.15, sh[i].z + 0.12), up); twist = sx * 0.2 * out; break;
      }
      case 'armR': case 'armL': { const i = sp === 'armR' ? 1 : 0, sx = i ? -1 : 1; this._h[i].set(sx * 0.62, sh[i].y - 0.02, sh[i].z + 0.06); twist = sx * 0.25; roll += -sx * 0.08; break; }
      case 'legR': case 'legL': { const i = sp === 'legR' ? 1 : 0, sx = i ? -1 : 1; this._f[i].set(sx * 0.42, -this.hip + 0.14, 0.06); roll += sx * 0.2; break; }
      case 'windupArmR': case 'windupArmL': { const i = sp === 'windupArmR' ? 1 : 0, sx = i ? -1 : 1; this._h[i].set(sx * 0.3, sh[i].y + 0.1, sh[i].z - 0.32); twist = -sx * 0.25; break; }
      case 'windupLegR': case 'windupLegL': { const i = sp === 'windupLegR' ? 1 : 0, sx = i ? -1 : 1; this._f[i].set(sx * 0.2, -this.hip + 0.18, -0.32); break; }
      case 'stumble': {
        roll += Math.sin(t * 19) * 0.3;
        for (let i = 0; i < 2; i++) { const sx = i ? -1 : 1, a = t * 15 + i * Math.PI; this._h[i].set(sx * 0.38, sh[i].y + Math.sin(a) * 0.25, sh[i].z + Math.cos(a) * 0.25); }
        break;
      }
      case 'cheer': {
        this.body.position.y += Math.max(0, Math.sin(this.modeT * 9)) * 0.18;
        for (let i = 0; i < 2; i++) { const sx = i ? -1 : 1; this._h[i].set(sx * 0.24, sh[i].y + 0.42, sh[i].z + 0.05 + Math.sin(this.modeT * 9 + i) * 0.05); }
        break;
      }
      case 'tired': {
        this.body.position.y += Math.sin(this.modeT * 7) * 0.03;
        for (let i = 0; i < 2; i++) { const sx = i ? -1 : 1; this._h[i].set(sx * 0.14, -this.hip + 0.32, 0.26); this._f[i].set(sx * 0.14, -this.hip + 0.04, 0.04); }
        break;
      }
      case 'wave': this._h[1].set(-0.34, sh[1].y + 0.4 + Math.sin(t * 10) * 0.06, sh[1].z + 0.08 + Math.sin(t * 10) * 0.08); break;
      case 'stretch': for (let i = 0; i < 2; i++) { const sx = i ? -1 : 1; this._h[i].set(sx * (0.12 + 0.04 * Math.sin(this.modeT * 2)), sh[i].y + 0.42, sh[i].z - 0.02); } roll += Math.sin(this.modeT * 1.6) * 0.18; break;
      case 'squatIdle': for (let i = 0; i < 2; i++) { const sx = i ? -1 : 1; this._h[i].set(sx * 0.2, sh[i].y - 0.06, sh[i].z + 0.36); this._f[i].set(sx * 0.16, -this.hip + 0.04, 0.06); } break;
    }
    // ---- カメラの 体の まね ----
    if (x.mirror) this.applyMirror(x.mirror, sh);
    this.roll = damp(this.roll, roll, 0.08, dt); this.twist = damp(this.twist, twist, 0.08, dt);
    // ---- 世界の 点に 直して Character へ ----
    this.root.updateMatrixWorld(true);
    const M = this.c.group.matrixWorld;
    for (let i = 0; i < 2; i++) { this._fw[i].copy(this._f[i]).applyMatrix4(M); this._hw[i].copy(this._h[i]).applyMatrix4(M); }
    const face = r.stumbleT > 0 || (r.blockedT || 0) > 1 ? 'oops' : (r.happyT > 0 || mode === 'cheer') ? 'happy' : (spd > 0.75 || (r.spurt || 0) > 0.3) ? 'effort' : 'normal';
    this.c.setFace(face);
    this.c.pose({ grips: this._hw, feet: this._fw, fwd: this.fwd, roll: this.roll, twist: this.twist, accelY: (air ? -(r.vh || 0) * 0.15 : 0) + bob * 30, accelX: vd * 0.3, happy: face === 'happy', lookYaw: x.look || 0 }, dt, t);
    // ---- バンド・帯・星・札 ----
    for (let i = 0; i < 2; i++) { const A2 = this.c.arm[i]; this.bands[i].position.lerpVectors(A2.mid, A2.end, 0.78); this.bands[i].quaternion.copy(A2.fo.quaternion).multiply(_qx90); }
    this.updateTails(t, spd, air);
    this.stars.visible = r.stumbleT > 0;
    if (this.stars.visible) this.stars.children.forEach((s, i) => { const a = t * 6 + i * 2.094; s.position.set(Math.cos(a) * 0.28, Math.sin(t * 9 + i) * 0.03, Math.sin(a) * 0.28); s.rotation.y = t * 8; });
    this.bang.visible = !!x.windup;
    if (this.bang.visible) this.bang.scale.set(0.9 + Math.abs(Math.sin(t * 12)) * 0.12, 0.34 + Math.abs(Math.sin(t * 12)) * 0.05, 1);
    // ---- 影 ----
    const hh = r.h || 0;
    this.blob.scale.setScalar(1 + hh * 0.35); this.blob.material.opacity = 0.55 / (1 + hh * 1.4);
    // ---- 残像 ----
    if (this.ghosts.length) this.stepGhosts(dt, x.ghost);
  }

  applyMirror(B, sh) {
    for (let i = 0; i < 2; i++) {
      const w = B.wristRel && B.wristRel[i];
      if (!w || !w.ok) continue;
      if (!(w.y > 0.25 || Math.abs(w.x) > 0.95)) continue;          // あげた か 横に 出した ときだけ
      const sx = i ? -1 : 1;
      this._h[i].lerp(_v.set(sh[i].x + sx * w.x * 0.33, sh[i].y + w.y * 0.33, sh[i].z + 0.1), 0.7);   // 1u = 0.33m
    }
  }

  updateTails(t, spd, air) {
    const flow = clamp(spd * 1.2 + (air ? 0.3 : 0), 0, 1);
    for (const T of this.tails) {
      const p = T.g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = clamp(1 - (p.getY(i) + 0.21) / 0.42, 0, 1), x0 = i % 2 ? 0.0275 : -0.0275;     // v：0 = 根もと → 1 = 先
        const ang = lerp(0.25, 1.45, flow) + Math.sin(t * (8 + flow * 10) + v * 5 + T.ph) * (0.08 + 0.18 * flow) * v;
        const len = v * 0.42;
        p.setXYZ(i, x0 + T.sx * v * 0.05, -Math.cos(ang) * len, -Math.sin(ang) * len);
      }
      p.needsUpdate = true; T.g.computeVertexNormals();
    }
  }

  // ---- 残像（付録T T.4） ----
  makeGhosts(n) {
    const parts = [];
    this.c.group.traverse(o => { if (o.isMesh && o.geometry && o.material && !o.material.transparent) parts.push(o); });
    for (let k = 0; k < n; k++) {
      const g = new THREE.Group(); g.matrixAutoUpdate = false;
      const mat = new THREE.MeshBasicMaterial({ color: this.C.kart, transparent: true, opacity: 0.22, depthWrite: false, fog: true }); this.own.push(mat);
      for (const o of parts) { const m = new THREE.Mesh(o.geometry, mat); m.matrixAutoUpdate = false; m.userData.src = o; g.add(m); }
      g.visible = false; g.userData = { age: 9, mat };
      this.ghosts.push(g);
    }
    this.ghostRoot = new THREE.Group(); this.ghostRoot.name = 'ghosts'; this.ghosts.forEach(g => this.ghostRoot.add(g));
  }
  stepGhosts(dt, on) {
    this.ghostT -= dt;
    if (on && this.ghostT <= 0) {
      this.ghostT = CFG.fx.AFTER_EVERY;
      const g = this.ghosts[this.gi++ % this.ghosts.length];
      g.children.forEach(m => m.matrix.copy(m.userData.src.matrixWorld));
      g.visible = true; g.userData.age = 0;
    }
    for (const g of this.ghosts) {
      if (!g.visible) continue;
      g.userData.age += dt;
      const a = 1 - g.userData.age / 0.15;
      if (a <= 0) { g.visible = false; continue; }
      g.userData.mat.opacity = 0.22 * a;
    }
  }
  setShadow(on) { this.c.group.traverse(o => { if (o.isMesh) o.castShadow = on && !(o.material.transparent && !o.userData.fade); }); }
  // カメラの 前を ふさぐ ライバルを うすく する（材質は この体だけの 写しへ 切りかえる）
  setFade(a) {
    a = a > 0.97 ? 1 : a;
    if (a === (this._fade ?? 1)) return;
    if (!this._fm) {
      this._fm = []; const copy = new Map();
      this.c.group.traverse(o => {
        if (!o.isMesh || o.material.transparent) return;
        let m = copy.get(o.material);
        if (!m) { m = o.material.clone(); m.transparent = true; copy.set(o.material, m); this.own.push(m); }
        this._fm.push([o, o.material, m]);
      });
      this._fmats = [...copy.values()];
    }
    for (const [o, m0, m1] of this._fm) { o.material = a < 1 ? m1 : m0; o.userData.fade = a < 1; }
    for (const m of this._fmats) m.opacity = a;
    this._fade = a;
  }
  dispose() { this.own.forEach(o => o.dispose && o.dispose()); }
}
const _v = new V3();

// ---------- 顔の絵（ポートレート） ----------
export function renderPortraits(renderer) {
  const out = {};
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(1, 2, 3); scene.add(dl);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 10);
  const rt = new THREE.WebGLRenderTarget(192, 192, { colorSpace: THREE.SRGBColorSpace });
  const buf = new Uint8Array(192 * 192 * 4);
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 192; const tg = tmp.getContext('2d');
  const prevT = renderer.getRenderTarget(), prevC = new THREE.Color(); renderer.getClearColor(prevC); const prevA = renderer.getClearAlpha();
  for (const id of CHAR_IDS) {
    const ch = new Character(id);
    scene.add(ch.group);
    ch.pose({}, 0.016, 0);
    ch.group.updateMatrixWorld(true);
    const hp = new V3(); ch.head.getWorldPosition(hp);
    for (const face of ['normal', 'happy']) {
      ch.setFace(face);
      cam.position.set(hp.x + 0.55, hp.y + 0.08, hp.z + 1.95); cam.lookAt(hp.x, hp.y + 0.04, hp.z);
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, 192, 192, buf);
      const img = tg.createImageData(192, 192);
      for (let y = 0; y < 192; y++) img.data.set(buf.subarray((191 - y) * 192 * 4, (192 - y) * 192 * 4), y * 192 * 4);
      tg.putImageData(img, 0, 0);
      const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(48, 48, 48, 0, Math.PI * 2); g.fill();
      g.fillStyle = CHARS[id].kart; g.beginPath(); g.arc(48, 48, 44, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(48, 48, 44, 0, Math.PI * 2); g.clip(); g.drawImage(tmp, -8, -2, 112, 112); g.restore();
      (out[id] = out[id] || {})[face] = c.toDataURL('image/png');
    }
    scene.remove(ch.group);
  }
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA);
  rt.dispose();
  return out;
}
