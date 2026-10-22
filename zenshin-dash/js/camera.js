// カメラワーク（第22部、付録AA）。1つの カメラごとに 1つ（2人対戦は 2つ）
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, damp, smoothstep } from './util.js';

const V3 = THREE.Vector3;
const _a = new V3(), _b = new V3(), _sh = new V3();

export class Cam {
  constructor(camera, kind = 'land') {
    this.cam = camera; this.kind = kind;
    this.pos = new V3(0, 3, 6); this.look = new V3(); this.fov = 60; this.roll = 0; this.kick = 0;
    this.shakes = []; this.mode = 'fixed'; this.init = false; this.latD = 0; this.shakeK = 1;
    this.blend = null; this.cutK = 0;
  }
  setKind(k) { this.kind = k; }
  reset() { this.init = false; this.shakes = []; this.kick = 0; this.blend = null; this.cutT = null; }

  // ---------- 追いかけ（AA） ----------
  chaseTarget(r, H, race, outPos, outLook) {
    const P = CFG.cam[this.kind], C = CFG.cam;
    const spd = clamp(r.v / CFG.run.V_MAX, 0, 1.2), fin = race && race.inFinal(r.s) && !r.finished;
    let back = P.BACK0 + r.v * P.BACK_K, up = P.UP0 + r.v * P.UP_K, ahead = P.LOOK0 + r.v * P.LOOK_K, lookUp = P.LOOK_UP;
    if (fin) { up -= C.FINAL_DOWN; ahead += C.FINAL_LOOK; }
    const sCam = r.s - back, yG = H(sCam);
    outPos.set(this.latD * 0.85, Math.max(yG + C.GROUND_CLEAR, H(r.s) + up + r.h * 0.35), -sCam);
    outLook.set(r.d * 0.9, H(r.s + ahead) + lookUp + r.h * 0.4, -(r.s + ahead));
    return { spd, fin };
  }
  chase(r, H, dt, race) {
    const P = CFG.cam[this.kind], C = CFG.cam;
    this.latD = this.init ? damp(this.latD, r.d, C.LAT_TAU, dt) : r.d;
    const { spd, fin } = this.chaseTarget(r, H, race, _a, _b);
    if (!this.init) { this.pos.copy(_a); this.look.copy(_b); this.init = true; }
    // 前後は おくれずに ついていく（速いと はなれすぎて アバターが 小さくなるため）。横と 高さだけ なめらかに
    this.pos.lerp(_a, 1 - Math.exp(-dt / 0.06)); this.look.lerp(_b, 1 - Math.exp(-dt / 0.05));
    this.pos.z = _a.z; this.look.z = _b.z;
    let fovT = lerp(P.FOV0, P.FOV1, clamp(spd, 0, 1));
    if (fin && r.spurt > 0.3) fovT = lerp(fovT, P.FOV_SPURT, clamp(r.spurt, 0, 1));
    if (fin) fovT += C.FINAL_FOV;
    this.fovT = fovT;
    this.fov = damp(this.fov, fovT, C.FOV_TAU, dt);
    this.roll = damp(this.roll, clamp(-(r.vd || 0) * 0.6, -C.ROLL, C.ROLL) * Math.PI / 180, 0.15, dt);
    if (spd > 0.95 && !r.finished) this.topShake = true; else this.topShake = false;
  }

  // ---------- そのほか（AA.1） ----------
  setFixed(p, l, fov = 60) { this.mode = 'fixed'; this.pos.copy(p); this.look.copy(l); this.fov = fov; this.roll = 0; }
  // ゲート：右前 9m、高さ 1.6m から まん中を 見る（22.3）
  gate(H) {
    this.mode = 'gate';
    // 縦と 2人（細長い 画面）は 引いて ゲート全体を 入れる
    if (this.kind === 'portrait') { this.pos.set(3.4, H(0) + 2.6, -14.5); this.look.set(-0.2, H(0) + 1.0, 0.3); this.fov = 62; }
    else if (this.kind === 'half') { this.pos.set(3.8, H(0) + 2.2, -11.5); this.look.set(-0.3, H(0) + 1.0, 0.3); this.fov = 58; }
    else { this.pos.set(5.2, H(0) + 1.6, -7.6); this.look.set(-0.4, H(0) + 1.05, 0.3); this.fov = 50; }
    this.roll = 0;
  }
  // いまの 位置から 追いかけへ sec 秒で なめらかに
  toChase(sec = 1.2) { this.blend = { from: this.pos.clone(), fromLook: this.look.clone(), fromFov: this.fov, t: 0, T: sec }; this.mode = 'chase'; this.init = false; }
  // コースの 紹介（22.7）：ゴールの 上から スタートへ
  intro(H, L, sec = 6) {
    this.mode = 'intro'; this.introT = 0; this.introLen = sec;
    const pts = [[0, 30, L + 30], [10, 24, L * 0.7], [-6, 16, L * 0.4], [6, 9, Math.min(160, L * 0.2)], [9, 4, 40], [5.2, 1.6, 7.6]];
    const looks = [[0, 0, L - 120], [0, 0, L * 0.45], [0, 0, L * 0.15], [0, 0, 20], [0, 1, 4], [-0.4, 1.05, -0.3]];
    this.introPath = new THREE.CatmullRomCurve3(pts.map(([x, y, s]) => new V3(x, y + H(s), -s)), false, 'centripetal');
    this.introLook = new THREE.CatmullRomCurve3(looks.map(([x, y, s]) => new V3(x, y + H(s), -s)), false, 'centripetal');
    this.fov = 55;
  }
  // ゴール（22.6）：横から 2秒 → まわりを 回る
  finish(r) { this.mode = 'finish'; this.finT = 0; this.finR = r; }
  orbit(center, radius = 9, height = 3, period = 40, fov = 50) { this.mode = 'orbit'; this.orb = { c: center.clone(), r: radius, h: height, T: period, a: this.orb ? this.orb.a : 0 }; this.fov = fov; }
  // カットイン（22.5）：前 ななめ 45°、3m、高さ 1.3m
  cut(target, H, sec, side = 1) {
    const base = new V3(target.d, H(target.s) + CFG.cam.CUT_H + (target.h || 0) * 0.6, -target.s);
    const d = CFG.cam.CUT_DIST * 0.71;
    this.cutTo = { pos: base.clone().add(new V3(d * side, 0.1, -d)), look: base.clone().add(new V3(0, -0.15, 0)), fov: 46 };
    this.cutT = 0; this.cutLen = sec;
  }
  goalCut(target, H, sec) {
    const base = new V3(target.d, H(target.s) + 1.0, -target.s);
    this.cutTo = { pos: base.clone().add(new V3(6, 0.6, -0.8)), look: base.clone(), fov: 40 };
    this.cutT = 0; this.cutLen = sec;
  }
  addShake(amp, dur) { this.shakes.push({ amp: amp * this.shakeK, dur, t: 0 }); }
  shake(kind) { const s = CFG.cam.SHAKE[kind]; if (s) this.addShake(s[0], s[1]); }
  kickFov(k) { this.kick += k; }

  // 毎コマ（本当の 時間）。ctx：{ runner, H, race }
  update(dt, ctx = {}) {
    const H = ctx.H;
    switch (this.mode) {
      case 'chase': if (ctx.runner && H) this.chase(ctx.runner, H, dt, ctx.race); break;
      case 'intro': {
        this.introT += dt;
        const k = smoothstep(0, 1, Math.min(1, this.introT / this.introLen));
        const kk = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.introPath.getPoint(kk, this.pos); this.introLook.getPoint(Math.min(1, kk * 1.02), this.look);
        this.fov = lerp(62, 50, kk);
        break;
      }
      case 'finish': {
        const r = this.finR; if (!r || !H) break;
        this.finT += dt;
        const c = _a.set(r.d, H(r.s) + 1.0, -r.s);
        if (this.finT < 2) { _b.set(r.d + 6, H(r.s) + 1.6, -(r.s - 1.5)); this.pos.lerp(_b, 1 - Math.exp(-dt / 0.15)); this.look.lerp(c, 1 - Math.exp(-dt / 0.08)); this.fov = damp(this.fov, 52, 0.4, dt); }
        else {
          if (!this.orb || this.orb.target !== r) { this.orb = { r: 5, h: 2.2, T: 12, a: Math.atan2(this.pos.x - c.x, this.pos.z - c.z), target: r }; }
          this.orb.a += dt * Math.PI * 2 / this.orb.T;
          _b.set(c.x + Math.sin(this.orb.a) * this.orb.r, H(r.s) + this.orb.h, c.z + Math.cos(this.orb.a) * this.orb.r);
          this.pos.lerp(_b, 1 - Math.exp(-dt / 0.3)); this.look.lerp(c, 1 - Math.exp(-dt / 0.1)); this.fov = damp(this.fov, 50, 0.5, dt);
        }
        this.roll = damp(this.roll, 0, 0.2, dt);
        break;
      }
      case 'orbit': {
        const o = this.orb; o.a += dt * Math.PI * 2 / o.T;
        this.pos.set(o.c.x + Math.sin(o.a) * o.r, o.c.y + o.h, o.c.z + Math.cos(o.a) * o.r);
        this.look.copy(o.c).add(_a.set(0, 1.0, 0));
        break;
      }
    }
    this.kick = damp(this.kick, 0, 0.12, dt);
    if (this.topShake) this.jitter = CFG.cam.SHAKE.top[0] * this.shakeK; else this.jitter = 0;
  }

  // カメラに 書く（ゆれ・かたむき・視野角・カットイン・ゲートからの つなぎ）
  apply(dt) {
    let p = _a.copy(this.pos), l = _b.copy(this.look), f = this.fov + this.kick;
    if (this.blend) {
      const B = this.blend; B.t += dt;
      const k = smoothstep(0, 1, Math.min(1, B.t / B.T));
      p.lerpVectors(B.from, this.pos, k); l.lerpVectors(B.fromLook, this.look, k); f = lerp(B.fromFov, this.fov, k) + this.kick;
      if (B.t >= B.T) this.blend = null;
    }
    if (this.cutT != null) {
      this.cutT += dt;
      const a = CFG.cam.CUT_IN, b = this.cutLen, c = CFG.cam.CUT_OUT;
      const k = this.cutT < a ? smoothstep(0, a, this.cutT) : this.cutT < b ? 1 : 1 - smoothstep(b, b + c, this.cutT);
      p.lerp(this.cutTo.pos, k); l.lerp(this.cutTo.look, k); f = lerp(f, this.cutTo.fov, k);
      this.cutK = k;
      if (this.cutT > b + c) { this.cutT = null; this.cutK = 0; }
    }
    _sh.set(0, 0, 0);
    for (const s of this.shakes) { s.t += dt; const k = Math.max(0, 1 - s.t / Math.max(0.01, s.dur)); _sh.x += (Math.random() - 0.5) * 2 * s.amp * k; _sh.y += (Math.random() - 0.5) * 2 * s.amp * k; }
    if (this.jitter) { _sh.x += (Math.random() - 0.5) * this.jitter * 2; _sh.y += (Math.random() - 0.5) * this.jitter * 2; }
    this.shakes = this.shakes.filter(s => s.t < s.dur);
    this.cam.position.copy(p).add(_sh);
    this.cam.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
    this.cam.lookAt(l);
    if (Math.abs(this.cam.fov - f) > 0.01) { this.cam.fov = f; this.cam.updateProjectionMatrix(); }
  }
}
