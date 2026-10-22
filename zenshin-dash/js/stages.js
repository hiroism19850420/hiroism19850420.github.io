// 3D の 舞台（タイトル・キャラえらび・れんしゅう・けっか。付録AO・DL）
import * as THREE from 'three';
import { World } from './world.js';
import { RunnerRig, CHARS, CHAR_IDS } from './models.js';
import { CFG } from './config.js';
import { damp, lerp, clamp } from './util.js';

const V3 = THREE.Vector3;
const H0 = () => 0;
const IDLES = ['jog', 'stretch', 'wave', 'squatIdle'];

// ステージの 1匹（にせの ランナーの 状態で 動かす）
class Actor {
  constructor(id, parent, opt = {}) {
    this.rig = new RunnerRig(id); this.id = id;
    parent.add(this.rig.root);
    this.r = { s: 0, d: 0, v: 0, vd: 0, h: 0, vh: 0, air: false, crouch: null, phase: Math.random(), stepRate: 0, stumbleT: 0, special: null, happyT: 0, spurt: 0, finished: false };
    this.t = Math.random() * 4; this.idle = opt.idle ?? Math.floor(Math.random() * 4); this.mode = 'jog'; this.at = new V3(); this.yaw = 0;
  }
  // 準備運動：その場で 軽く 走る 2秒 → のび 1秒 → 手を ふる 1秒 → 屈伸 1秒
  idleStep(dt, t, o = {}) {
    this.t += dt;
    const cyc = this.t % 5, seq = (this.idle + Math.floor(this.t / 5)) % 4;
    let mode = cyc < 2 ? 'jog' : IDLES[(seq + Math.floor(cyc - 1)) % 4];
    if (o.mode) mode = o.mode === 'jogOnly' ? 'jog' : o.mode;
    const jog = mode === 'jog';
    this.r.stepRate = jog ? 2.6 : 0; this.r.v = 0;
    this.r.phase = (this.r.phase + this.r.stepRate / 2 * dt) % 1;
    this.r.happyT = o.happy ? 1 : 0;
    this.rig.update(this.r, dt, t, H0, { at: this.at, faceYaw: this.yaw, mode: jog ? null : mode, look: o.look || 0 });
  }
}

export const Stages = {
  root: null, actors: [], mode: null, t: 0, cam: null,
  init(cam) { this.cam = cam; },
  clear() {
    if (this.root) { World.scene.remove(this.root); this.actors.forEach(a => a.rig.dispose()); this.root.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); }); }
    if (this.light) { World.scene.remove(this.light, this.light.target); this.light = null; }
    this.root = null; this.actors = []; this.mode = null;
  },
  ensure() { if (!this.root) { this.root = new THREE.Group(); this.root.name = 'stage'; World.scene.add(this.root); } },

  // ---------- タイトル（AO.1）：スタートの 少し 先で 6匹が 準備運動 ----------
  title(c3d) {
    this.clear(); this.ensure(); this.mode = 'title';
    const s = 24, base = new V3(0, c3d.heightAt(s), -s);
    this.center = base;
    CHAR_IDS.forEach((id, i) => {
      const a = new Actor(id, this.root, { idle: i % 4 });
      const ang = i / 6 * Math.PI * 2;
      a.at.set(base.x + Math.sin(ang) * 2.6, base.y + 0.02, base.z + Math.cos(ang) * 2.6);
      a.yaw = ang + Math.PI;                 // 外を 向く（root の −z が 前）
      this.actors.push(a);
    });
    if (World.portrait) this.cam.orbit(base, 11.5, 3.4, 40, 56); else this.cam.orbit(base, 8.5, 2.6, 40, 50);
  },

  // ---------- キャラえらび（AO.2）：回る 台の 輪 ----------
  charSelect(c3d, index, taken = null) {
    this.clear(); this.ensure(); this.mode = 'char';
    const s = 70, x = -54, base = new V3(x, c3d.groundAt(x, s) + 0.05, -s);
    this.center = base;
    const ring = new THREE.Group(); ring.position.copy(base); this.root.add(ring); this.ring = ring;
    const R = 7;
    const topM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
    this.peds = CHAR_IDS.map((id, i) => {
      const a = i / 6 * Math.PI * 2;
      const ped = new THREE.Group(); ped.position.set(Math.sin(a) * R, 0, Math.cos(a) * R); ring.add(ped);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.3, 32), topM); top.position.y = 0.15; top.receiveShadow = true; top.castShadow = true; ped.add(top);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 40), new THREE.MeshStandardMaterial({ color: CHARS[id].kart, roughness: 0.4, emissive: CHARS[id].kart, emissiveIntensity: 0.25 }));
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; ped.add(rim);
      const act = new Actor(id, ped, { idle: i % 4 }); act.at.set(0, 0.3, 0); act.yaw = a + Math.PI; act.ped = ped; act.a = a;
      this.actors.push(act);
      return ped;
    });
    this.sel = index; this.ringA = -index / 6 * Math.PI * 2; ring.rotation.y = this.ringA; this.taken = taken;
    const sl = new THREE.SpotLight('#ffffff', 60, 30, 0.45, 0.6); this.light = sl;
    const front = new V3(0, 0, R).add(base);
    sl.position.set(front.x, base.y + 9, front.z + 6); sl.target.position.copy(front); World.scene.add(sl, sl.target);
    const portrait = World.portrait;
    const camP = new V3(base.x, base.y + (portrait ? 3.2 : 3.0), base.z + R + (portrait ? 10.5 : 8.2)), look = new V3(base.x, base.y + (portrait ? 0.75 : 0.45), base.z + R);
    this.cam.setFixed(camP, look, portrait ? 52 : 40);
    this.picked = -1;
  },
  charSelectSet(i) { this.sel = i; },
  charPicked(i) { this.picked = i; this.pickT = 0; },
  setTaken(id) { this.taken = id; },

  // ---------- れんしゅう（AO.3）：回る 台の 上で まねる ----------
  prep(c3d, id, B, jama = false) {
    this.clear(); this.ensure(); this.mode = 'prep';
    const s = -12, x = -48, base = new V3(x, c3d.groundAt(x, s) + 0.05, -s);
    this.center = base;
    const ped = new THREE.Group(); ped.position.copy(base); this.root.add(ped); this.ped = ped;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.3, 0.3, 40), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 })); top.position.y = 0.15; top.receiveShadow = true; ped.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.08, 8, 48), new THREE.MeshStandardMaterial({ color: CHARS[id].kart, roughness: 0.4, emissive: CHARS[id].kart, emissiveIntensity: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; ped.add(rim);
    const act = new Actor(id, ped); act.at.set(0, 0.3, 0); act.yaw = 0; this.actors.push(act); this.me = act;
    this.body = B; this.spin = 0; this.hold = false; this.jump = 0;
    // じゃまの かかし（左右 0.9m）
    this.dummies = [];
    if (jama) for (const side of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(side * 1.25, 0.3, 0); ped.add(g);
      const straw = new THREE.MeshStandardMaterial({ color: '#e8c25a', roughness: 0.9 }), cloth = new THREE.MeshStandardMaterial({ color: side < 0 ? '#3fa9f5' : '#ff6fae', roughness: 0.8 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), new THREE.MeshStandardMaterial({ color: '#7a5230' })); pole.position.y = 0.75; g.add(pole);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 3, 8), cloth); body.position.y = 1.0; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9), straw); head.position.y = 1.5; g.add(head);
      const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#7a5230' })); arms.rotation.z = Math.PI / 2; arms.position.y = 1.15; g.add(arms);
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.dummies.push({ g, side, a: 0, v: 0 });
    }
    // 左に 鏡が 出るので、台は 画面の 右がわに（縦は 下半分に）
    this.placeCam();
  },
  placeCam() {
    const base = this.center; if (!base) return;
    if (this.mode === 'prep') {
      if (World.portrait) this.cam.setFixed(new V3(base.x, base.y + 2.4, base.z + 6.4), new V3(base.x, base.y + 1.75, base.z), 50);
      else { const camP = new V3(base.x + 3.0, base.y + 2.2, base.z + 4.3), right = new V3(4.3, 0, -3.0).normalize(); this.cam.setFixed(camP, new V3(base.x, base.y + 0.95, base.z).addScaledVector(right, -1.4), 45); }
    }
  },
  hitDummy(side) { const d = this.dummies && this.dummies.find(x => x.side === side); if (d) d.v += 7; return d ? d.g : null; },

  // ---------- けっかの 背景（AO.5）：ゴールの 先で よろこぶ ----------
  result(c3d, order) {
    this.clear(); this.ensure(); this.mode = 'result';
    const s = c3d.L + 26, base = new V3(0, c3d.heightAt(s), -s);
    this.center = base;
    const spots = [[0, 0], [-1.6, 1.2], [1.6, 1.2], [-3.0, 2.3], [0, 2.6], [3.0, 2.3]];
    order.forEach((id, i) => {
      const a = new Actor(id, this.root, { idle: i % 4 });
      const [dx, dz] = spots[i];
      a.at.set(base.x + dx, base.y + 0.02, base.z + dz); a.yaw = Math.PI;   // カメラ（ゴールがわ）を 向く
      a.rank = i + 1;
      this.actors.push(a);
    });
    this.cam.orbit(base, 7.5, 2.4, 50, 48);
    this.cam.orb.a = 0;
  },

  update(dt, t) {
    if (!this.root) return;
    this.t += dt;
    if (this.mode === 'title') for (const a of this.actors) a.idleStep(dt, t);
    if (this.mode === 'char') {
      const want = -this.sel / 6 * Math.PI * 2;
      let d = want - this.ringA; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.ringA += d * (1 - Math.exp(-dt / 0.12));
      this.ring.rotation.y = this.ringA;
      this.ring.updateMatrixWorld(true);
      this.actors.forEach((a, i) => {
        const front = i === this.sel, picked = this.picked === i, taken = this.taken && a.id === this.taken;
        if (picked) { this.pickT += dt; a.r.h = Math.max(0, Math.sin(Math.min(1, this.pickT / 0.6) * Math.PI)) * 0.6; a.r.air = a.r.h > 0.02; }
        else { a.r.h = 0; a.r.air = false; }
        a.at.y = 0.3;
        a.idleStep(dt, t, { mode: picked ? 'cheer' : taken ? 'wave' : front ? null : 'jogOnly', happy: picked || front });
      });
    }
    if (this.mode === 'prep') {
      const a = this.me, B = this.body || {};
      if (!this.hold) this.spin += dt * Math.PI * 2 / 14;
      else this.spin = damp(this.spin, Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2, 0.4, dt);
      this.ped.rotation.y = this.spin;
      this.ped.updateMatrixWorld(true);
      // からだを まねる
      const r = a.r;
      r.stepRate = B.seen ? (B.stepRate || 0) : 0; r.v = 0;
      r.phase = (r.phase + r.stepRate / 2 * dt) % 1;
      if (B.air && this.jump <= 0) this.jump = 0.45;
      if (this.jump > 0) { this.jump -= dt; const k = 1 - this.jump / 0.45; r.h = Math.sin(k * Math.PI) * 0.6; r.air = this.jump > 0.02; } else { r.h = 0; r.air = false; }
      r.crouch = B.crouch ? 'walk' : null;
      a.at.set(clamp(B.shift || 0, -1.2, 1.2) * 0.4, 0.3, 0);
      a.rig.update(r, dt, t, H0, { at: a.at, faceYaw: 0, mirror: B.seen ? B : null });
      for (const d of this.dummies) { d.v += (-d.a * 120 - d.v * 6) * dt; d.a += d.v * dt; d.g.rotation.z = -d.side * d.a * 0.1; }
    }
    if (this.mode === 'result') {
      for (const a of this.actors) {
        const k = a.rank;
        if (k === 1) { a.r.h = Math.max(0, Math.sin(this.t * 6)) * 0.45; a.r.air = a.r.h > 0.02; }
        a.idleStep(dt, t, { mode: k === 1 ? 'cheer' : k <= 3 ? 'wave' : 'tired', happy: k <= 3 });
      }
    }
  }
};
