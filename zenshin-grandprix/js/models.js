// キャラクターと カート（第8部・第9部・付録J・付録T）
// 動かない 部品は 頂点の色で 1つに まとめて、描く回数を へらす
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, damp, Spring } from './util.js';
import { numberTexture, blobTexture } from './tex.js';

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
  G.limb = new THREE.CapsuleGeometry(1, 1, 3, 10).translate(0, 0.5, 0);
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
  m.scale.set(r, Math.max(0.01, len), r);
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
    this.lean = damp(this.lean, -(p.steer || 0) * 0.18, 0.1, dt);
    this.crouch = damp(this.crouch, p.crouch ? 1 : 0, 0.09, dt);
    this.fwd = damp(this.fwd, 0.14 + (p.throttle || 0) * 0.12, 0.12, dt);
    this.banzai = damp(this.banzai, p.banzai ? 1 : 0, 0.07, dt);
    this.upper.rotation.set(this.fwd + this.crouch * 0.55, 0, this.lean);
    this.upper.position.y = 0.16 - this.crouch * 0.16 + Math.sin((p.pedal || 0) * 2) * 0.012 * (p.throttle || 0);
    this.upper.position.z = this.crouch * 0.06;
    this.lookYaw = damp(this.lookYaw, (p.steer || 0) * 0.35 + (p.lookYaw || 0), 0.15, dt);
    const hs = this.springs.head.step(dt, (p.accelY || 0) * 0.4);
    this.head.rotation.set(-(this.fwd + this.crouch * 0.55) * 0.75 + hs * 0.5, this.lookYaw, -this.lean * 0.4);
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

// ---------- カート ----------
const KG = {};
function kartGeo() {
  if (KG.ready) return KG;
  const tire = r => {
    const w = r < 0.25 ? 0.16 : 0.2, c = 0.06, pts = [];
    pts.push(new THREE.Vector2(0.62 * r, -w / 2), new THREE.Vector2(r - c, -w / 2));
    for (let i = 1; i < 4; i++) { const a = -Math.PI / 2 + i / 4 * Math.PI / 2; pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, -w / 2 + c + Math.sin(a) * c)); }
    pts.push(new THREE.Vector2(r, -w / 2 + c), new THREE.Vector2(r, w / 2 - c));
    for (let i = 1; i < 4; i++) { const a = i / 4 * Math.PI / 2; pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, w / 2 - c + Math.sin(a) * c)); }
    pts.push(new THREE.Vector2(r - c, w / 2), new THREE.Vector2(0.62 * r, w / 2));
    return new THREE.LatheGeometry(pts, 26).rotateZ(Math.PI / 2);
  };
  KG.wheel = (r, side, paint) => {
    const parts = [P(tire(r), '#22252d'), P(G.cyl, '#f4f6fa', [side * 0.045, 0, 0], [0.6 * r, 0.05, 0.6 * r], [0, 0, Math.PI / 2])];
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; parts.push(P(new THREE.BoxGeometry(0.03, 0.4 * r, 0.06), '#dde2ec', [side * 0.07, Math.cos(a) * 0.22 * r, Math.sin(a) * 0.22 * r], 1, [a, 0, 0])); }
    parts.push(P(G.cyl, paint, [side * 0.085, 0, 0], [0.18 * r, 0.06, 0.18 * r], [0, 0, Math.PI / 2]));
    return mergeParts(parts);
  };
  KG.shadow = new THREE.PlaneGeometry(1.7, 2.3).rotateX(-Math.PI / 2);
  KG.beam = new THREE.ConeGeometry(2.2, 9, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 4.5);
  KG.ready = true;
  return KG;
}
let BLOB = null;

export class KartModel {
  constructor(id, { night = false } = {}) {
    geo(); kartGeo();
    const C = CHARS[id];
    this.id = id; this.C = C;
    const PAINT = C.kart, WHITE = '#ffffff', DARK = '#2b2f3a', METAL = '#9aa3b5';
    const g = this.group = new THREE.Group();
    const body = this.body = new THREE.Group(); g.add(body);
    // 車体（つやのある 部品）
    const gloss = [
      P(new RoundedBoxGeometry(1.0, 0.3, 1.62, 4, 0.14), PAINT, [0, 0.36, 0]),
      P(new THREE.CapsuleGeometry(0.17, 0.66, 5, 12), PAINT, [0, 0.34, 0.82], 1, [0, 0, Math.PI / 2]),
      P(new RoundedBoxGeometry(0.22, 0.2, 0.7, 3, 0.08), PAINT, [0.56, 0.33, -0.05]),
      P(new RoundedBoxGeometry(0.22, 0.2, 0.7, 3, 0.08), PAINT, [-0.56, 0.33, -0.05]),
      P(new RoundedBoxGeometry(1.1, 0.05, 0.24, 2, 0.02), PAINT, [0, 0.98, -0.78]),
      P(new THREE.BoxGeometry(0.16, 0.052, 0.242), WHITE, [0, 0.98, -0.78]),
      P(new RoundedBoxGeometry(1.04, 0.06, 1.66, 2, 0.03), WHITE, [0, 0.52, 0]),
      P(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), WHITE, [0.42, 1.0, -0.7])
    ];
    const glossM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.9 });
    this.glossM = glossM;
    const shell = new THREE.Mesh(mergeParts(gloss), glossM); shell.castShadow = true; shell.receiveShadow = true; body.add(shell);
    // つやのない 部品
    const chainA = new V3(-0.22, 0.4, 0.26), chainB = new V3(-0.44, 0.27, -0.62);
    const matte = [
      P(new RoundedBoxGeometry(0.5, 0.1, 0.46, 2, 0.04), DARK, [0, 0.47, -0.3]),
      P(new RoundedBoxGeometry(0.5, 0.46, 0.1, 2, 0.04), DARK, [0, 0.7, -0.52], 1, [-0.21, 0, 0]),
      P(new THREE.CapsuleGeometry(0.07, 1.1, 4, 10), DARK, [0, 0.22, 1.02], 1, [0, 0, Math.PI / 2]),
      P(new RoundedBoxGeometry(0.04, 0.34, 0.08, 1, 0.01), DARK, [0.36, 0.8, -0.74]),
      P(new RoundedBoxGeometry(0.04, 0.34, 0.08, 1, 0.01), DARK, [-0.36, 0.8, -0.74])
    ];
    for (const dy of [0.085, -0.085]) {
      const a = chainA.clone().setY(chainA.y + dy), b = chainB.clone().setY(chainB.y + dy * 0.7), len = a.distanceTo(b);
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
      const e = new THREE.Euler().setFromQuaternion(q);
      matte.push(P(new THREE.CylinderGeometry(0.008, 0.008, len, 4), '#4a4f5c', a.clone().add(b).multiplyScalar(0.5).toArray(), 1, [e.x, e.y, e.z]));
    }
    const matteM = vmat('kartMatte', { roughness: 0.75 });
    body.add(new THREE.Mesh(mergeParts(matte), matteM));
    // 金属
    const metal = [
      P(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), METAL, [0, 0.66, 0.29], 1, [-0.75, 0, 0]),
      P(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8), METAL, [0, 0.27, -0.62], 1, [0, 0, Math.PI / 2]),
      P(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), METAL, [0, 0.22, 0.68], 1, [0, 0, Math.PI / 2]),
      P(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 18), '#c0c7d6', [-0.42, 0.27, -0.62], 1, [0, 0, Math.PI / 2])
    ];
    for (const sx of [-1, 1]) metal.push(P(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 12), METAL, [sx * 0.22, 0.4, -0.86], 1, [Math.PI / 2, 0, 0]));
    const metalM = vmat('kartMetal', { roughness: 0.35, metalness: 0.6 });
    body.add(new THREE.Mesh(mergeParts(metal), metalM));
    // 番号（3まい）
    const nt = numberTexture(C.no, C.kart);
    const ng = mergeGeometries([
      new THREE.CircleGeometry(0.1, 20).rotateY(Math.PI / 2).translate(0.672, 0.34, -0.05),
      new THREE.CircleGeometry(0.1, 20).rotateY(-Math.PI / 2).translate(-0.672, 0.34, -0.05),
      new THREE.CircleGeometry(0.1, 20).rotateX(-1.0).translate(0, 0.53, 0.86)
    ]);
    this.numMat = new THREE.MeshStandardMaterial({ map: nt, roughness: 0.5, transparent: true });
    body.add(new THREE.Mesh(ng, this.numMat));
    // ハンドル
    const wp = this.wheelPivot = new THREE.Group(); wp.position.set(0, 0.84, 0.13); wp.rotation.x = -0.75; body.add(wp);
    const wparts = [P(new THREE.TorusGeometry(0.16, 0.03, 8, 24), DARK, [0, 0, 0], 1, [Math.PI / 2, 0, 0]), P(G.cyl, PAINT, [0, 0, 0], [0.05, 0.04, 0.05])];
    for (const a of [0, 2.1, -2.1]) wparts.push(P(new THREE.BoxGeometry(0.02, 0.012, 0.16), DARK, [Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08], 1, [0, a, 0]));
    wp.add(new THREE.Mesh(mergeParts(wparts), vmat('kartWheel', { roughness: 0.5 })));
    this.grips = [new THREE.Object3D(), new THREE.Object3D()];
    this.grips[0].position.set(0.14, 0, 0.08); this.grips[1].position.set(-0.14, 0, 0.08);
    wp.add(this.grips[0], this.grips[1]);
    // クランク
    const crank = this.crank = new THREE.Group(); crank.position.set(0, 0.4, 0.26); body.add(crank);
    crank.add(new THREE.Mesh(mergeParts([
      P(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), METAL, [0, 0, 0], 1, [0, 0, Math.PI / 2]),
      P(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20), '#c0c7d6', [-0.2, 0, 0], 1, [0, 0, Math.PI / 2])
    ]), metalM));
    this.pedals = [1, -1].map((sx, i) => {
      const arm = new THREE.Group(); arm.rotation.x = i * Math.PI; crank.add(arm);
      arm.add(new THREE.Mesh(mergeParts([P(new RoundedBoxGeometry(0.03, 0.03, 0.14, 1, 0.01), METAL, [sx * 0.15, 0, 0.06])]), metalM));
      const pp = new THREE.Group(); pp.position.set(sx * 0.17, 0, 0.12); arm.add(pp);
      pp.add(new THREE.Mesh(mergeParts([P(new RoundedBoxGeometry(0.11, 0.025, 0.07, 1, 0.01), DARK)]), matteM));
      const foot = new THREE.Object3D(); foot.position.set(0, 0.04, 0); pp.add(foot);
      return { arm, pp, foot };
    });
    // タイヤ
    this.wheels = [[0.58, 0.22, 0.68, 0.22, true], [-0.58, 0.22, 0.68, 0.22, true], [0.64, 0.27, -0.62, 0.27, false], [-0.64, 0.27, -0.62, 0.27, false]].map(([x, y, z, r, front]) => {
      const steer = new THREE.Group(); steer.position.set(x, y, z); g.add(steer);
      const spin = new THREE.Mesh(KG.wheel(r, Math.sign(x), PAINT), vmat('kartTire', { roughness: 0.82 }));
      spin.castShadow = true; steer.add(spin);
      return { steer, spin, r, front };
    });
    // 旗
    const fg = new THREE.PlaneGeometry(0.36, 0.24, 8, 4).translate(-0.18, 0, 0);
    { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setY(i, y * (1 + x / 0.36 * 0.9)); } }
    this.flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: C.second === '#ffffff' ? '#ffd54a' : C.second, side: THREE.DoubleSide, roughness: 0.8 }));
    this.flag.position.set(0.42, 1.33, -0.7); this.flag.rotation.y = Math.PI / 2;
    this.flagBase = fg.attributes.position.array.slice();
    body.add(this.flag);
    // ターボの 光・ライト
    this.nozzleMat = new THREE.MeshStandardMaterial({ color: '#ff7a2f', emissive: '#ff7a2f', emissiveIntensity: 0 });
    body.add(new THREE.Mesh(mergeGeometries([0.22, -0.22].map(x => new THREE.CircleGeometry(0.045, 12).rotateY(Math.PI).translate(x, 0.4, -0.945))), this.nozzleMat));
    this.nozzles = [new V3(0.22, 0.4, -0.97), new V3(-0.22, 0.4, -0.97)];
    this.lightMat = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#fff6d8', emissiveIntensity: night ? 2.0 : 0.15 });
    body.add(new THREE.Mesh(mergeGeometries([0.2, -0.2].map(x => new THREE.CircleGeometry(0.05, 14).translate(x, 0.42, 0.985))), this.lightMat));
    if (night) {
      const bm = new THREE.MeshBasicMaterial({ color: '#fff1c0', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      this.beam = new THREE.Mesh(KG.beam, bm); this.beam.position.set(0, 0.42, 1.0); this.beam.scale.set(1, 0.45, 1); body.add(this.beam);
    }
    BLOB = BLOB || blobTexture();
    this.blob = new THREE.Mesh(KG.shadow, new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false, opacity: 0.4, color: '#000' }));
    this.blob.position.y = 0.04; this.blob.renderOrder = 1;
    g.add(this.blob);
    // 運転手
    this.driver = new Character(id);
    this.driver.group.position.set(0, 0.52, -0.28);
    body.add(this.driver.group);
    this.squashY = 1; this.squashV = 0;
    this._feet = [new V3(), new V3()]; this._grips = [new V3(), new V3()];
  }

  land(imp) { const k = imp > 6 ? 0.82 : 1 - imp * 0.03; this.squashY = Math.min(this.squashY, k); }

  // st：{ v, steer, throttle, pedalA, roll, bob, boost, trickA, crouch, banzai, face, accelY, accelX, lookYaw, wave, clap, far }
  pose(st, dt, t) {
    for (const w of this.wheels) { w.spin.rotation.x += (st.v || 0) * dt / w.r; if (w.front) w.steer.rotation.y = (st.steer || 0) * 0.42; }
    this.wheelPivot.rotation.y = (st.steer || 0) * 2.1;
    const pa = st.pedalA || 0;
    this.crank.rotation.x = pa;
    for (const p of this.pedals) p.pp.rotation.x = -pa - p.arm.rotation.x;
    this.squashV += (-220 * (this.squashY - 1) - 14 * this.squashV) * dt; this.squashY += this.squashV * dt;
    const sy = this.squashY, sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    this.body.scale.set(sxz, sy * (st.boost ? 0.98 : 1), sxz * (st.boost ? 1.04 : 1));
    this.body.position.y = st.bob || 0;
    this.body.rotation.set(0, 0, (st.roll || 0) + (st.trickA || 0));
    if (!st.far) {
      const p = this.flag.geometry.attributes.position, b = this.flagBase, sp = 6 + (st.v || 0) * 0.4;
      for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 9 - t * sp) * 0.03 * x / 0.36); }
      p.needsUpdate = true;
    }
    this.nozzleMat.emissiveIntensity = st.boost ? 2.2 + Math.sin(t * 40) * 0.5 : 0;
    this.group.updateMatrixWorld(true);
    this.grips[0].getWorldPosition(this._grips[0]); this.grips[1].getWorldPosition(this._grips[1]);
    this.pedals[0].foot.getWorldPosition(this._feet[0]); this.pedals[1].foot.getWorldPosition(this._feet[1]);
    this.driver.setFace(st.face || 'normal');
    this.driver.pose({ grips: this._grips, feet: this._feet, steer: st.steer, crouch: st.crouch, banzai: st.banzai, throttle: st.throttle, pedal: pa, accelY: st.accelY, accelX: st.accelX, lookYaw: st.lookYaw, wave: st.wave, clap: st.clap, happy: st.face === 'happy' }, dt, t);
  }
  nozzleWorld(i, out) { return this.body.localToWorld(out.copy(this.nozzles[i])); }
  setBlob(opacity) { this.blob.material.opacity = opacity; }
}

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
