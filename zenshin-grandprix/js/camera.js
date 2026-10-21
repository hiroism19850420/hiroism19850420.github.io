// カメラワーク（第20部）
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, damp, smoothstep, wrapAngle } from './util.js';
import { ZONE } from './track.js';

const C = CFG.cam;
const V3 = THREE.Vector3;
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const Cam = {
  mode: 'free', cam: null, track: null, heightAt: null,
  pos: new V3(), look: new V3(), yaw: 0, fov: 60, shakeT: 0, shakeA: 0, shakeKick: 0, tunnelK: 0,
  init(cam) { this.cam = cam; },
  setTrack(tr, heightAt) { this.track = tr; this.heightAt = heightAt; },
  shake(a, t) { if (a > this.shakeA * (this.shakeT > 0 ? 1 : 0)) { this.shakeA = a; this.shakeT = t; this.shakeT0 = t; } },
  kick(back) { this.shakeKick = back; },

  // 追いかけカメラ（すぐに 目標へ）
  snapChase(k) { this.mode = 'chase'; this.yaw = k.yawW; this.chase(k, 1, true); },

  chase(k, dt, snap = false) {
    const tr = this.track;
    const v = k.v;
    this.yaw = snap ? k.yawW : this.yaw + wrapAngle(k.yawW - this.yaw) * (1 - Math.exp(-dt / C.YAW_LAG));
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.tunnelK = damp(this.tunnelK, tr.zoneAt(k.s) === ZONE.tunnel ? 1 : 0, C.TUNNEL_TAU, dt);
    const D = lerp(C.DIST0 + v * C.DIST_K, C.TUNNEL_DIST, this.tunnelK), H = lerp(C.H0 + v * C.H_K, C.TUNNEL_H, this.tunnelK);
    const groundY = k.wpos.y - (k.ground ? 0 : k.h * (1 - C.AIR_FOLLOW));
    const tx = k.wpos.x - fx * D, tz = k.wpos.z - fz * D;
    let ty = groundY + H;
    // 地面に もぐらない
    if (this.heightAt) ty = Math.max(ty, this.heightAt(tx, tz) + C.GROUND_CLEAR);
    const rd = tr.surfaceY ? tr.pos(k.s - D, 0, 0, this._rp || (this._rp = {})).y : ty;
    ty = Math.max(ty, rd + 1.0);
    if (snap) this.pos.set(tx, ty, tz);
    else {
      // 前後・左右・上下で ちがう 時定数（ざっくり：水平と 上下）
      this.pos.x = damp(this.pos.x, tx, C.TAU_LAT, dt); this.pos.z = damp(this.pos.z, tz, C.TAU_LAT, dt);
      this.pos.y = damp(this.pos.y, ty, C.TAU_UP, dt);
      // 距離が 開きすぎないように（速いとき）
      const dx = this.pos.x - k.wpos.x, dz = this.pos.z - k.wpos.z, dd = Math.hypot(dx, dz);
      if (dd > D * 1.25) { this.pos.x = k.wpos.x + dx / dd * D * 1.25; this.pos.z = k.wpos.z + dz / dd * D * 1.25; }
    }
    const L = C.LOOK0 + v * C.LOOK_K;
    const ly = (k.ground ? k.wpos.y : k.wpos.y - k.h * (1 - C.AIR_LOOK)) + C.LOOK_UP;
    this.look.set(k.wpos.x + fx * L, ly, k.wpos.z + fz * L);
    const boost = k.boostT > 0 ? 1 : k.boostFadeT > 0 ? 0.5 : 0;
    const fovT = Math.min(C.FOV_MAX, C.FOV0 + (v / CFG.phys.VMAX) * C.FOV_V + boost * C.FOV_BOOST) + (innerHeight > innerWidth ? C.FOV_PORTRAIT : 0);
    this.fov = snap ? fovT : damp(this.fov, fovT, C.FOV_TAU, dt);
  },

  // コースしょうかい：[s, 高さ, 横, 見るs, 見る高さ, {at}] を なめらかに
  setIntro(path, dur) {
    const tr = this.track;
    const pts = path.map(p => tr.pos(tr.wrapS(p[0]), p[2], p[1], new V3()));
    const looks = path.map(p => p[5] && p[5].at ? new V3(...p[5].at) : tr.pos(tr.wrapS(p[3]), 0, p[4], new V3()));
    this.introCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.introLook = new THREE.CatmullRomCurve3(looks, false, 'centripetal');
    this.introT = 0; this.introDur = dur; this.mode = 'intro';
  },
  // grid へ：今の 位置から 追いかけカメラへ 1.2 秒で
  toGrid(k) {
    this.from = { p: this.cam.position.clone(), l: this.look.clone(), fov: this.cam.fov };
    this.gridT = 0; this.mode = 'grid'; this.gridKart = k;
  },
  setOrbit(center, r, h, w, look = 0.9) { this.mode = 'orbit'; this.orbit = { c: center, r, h, w, a: this.orbit ? this.orbit.a : 0, look }; },
  setGoal(k) { this.mode = 'goal'; this.goalKart = k; this.goalA = this.yaw + Math.PI * 0.85; this.goalPos = this.cam.position.clone(); },
  setFixed(p, l, fov = 50) { this.mode = 'fixed'; this.pos.copy(p); this.look.copy(l); this.fov = fov; },
  setPath(fn) { this.mode = 'fn'; this.fn = fn; },

  update(dt, ctx = {}) {
    const cam = this.cam;
    switch (this.mode) {
      case 'chase': if (ctx.kart) this.chase(ctx.kart, dt); break;
      case 'intro': {
        this.introT += dt;
        const t = easeIO(clamp(this.introT / this.introDur, 0, 1));
        this.introCurve.getPoint(t, this.pos); this.introLook.getPoint(t, this.look);
        this.fov = 52;
        break;
      }
      case 'grid': {
        const k = this.gridKart;
        this.gridT += dt;
        this.chase(k, dt, true);
        const t = easeIO(clamp(this.gridT / CFG.race.CAM_TO_GRID, 0, 1));
        if (t < 1) { this.pos.lerpVectors(this.from.p, this.pos, t); this.look.lerpVectors(this.from.l, this.look, t); this.fov = lerp(this.from.fov, this.fov, t); }
        else { this.pos.y += Math.sin(this.gridT * 7) * 0.015; }
        break;
      }
      case 'goal': {
        const k = this.goalKart;
        this.goalA += C.ORBIT_W * dt;
        const tp = new V3(k.wpos.x + Math.sin(this.goalA) * C.ORBIT_R, k.wpos.y + C.ORBIT_H, k.wpos.z + Math.cos(this.goalA) * C.ORBIT_R);
        if (this.heightAt) tp.y = Math.max(tp.y, this.heightAt(tp.x, tp.z) + 1);
        this.pos.x = damp(this.pos.x, tp.x, 0.3, dt); this.pos.y = damp(this.pos.y, tp.y, 0.3, dt); this.pos.z = damp(this.pos.z, tp.z, 0.3, dt);
        this.look.set(k.wpos.x, k.wpos.y + 0.9, k.wpos.z);
        this.fov = damp(this.fov, 55, 0.5, dt);
        break;
      }
      case 'orbit': {
        const o = this.orbit; o.a += o.w * dt;
        this.pos.set(o.c.x + Math.sin(o.a) * o.r, o.c.y + o.h, o.c.z + Math.cos(o.a) * o.r);
        this.look.set(o.c.x, o.c.y + o.look, o.c.z);
        this.fov = 50;
        break;
      }
      case 'fn': this.fn(dt, this); break;
      case 'fixed': break;
    }
    cam.position.copy(this.pos);
    // ゆれ
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeT0) * this.shakeA, t = performance.now() / 1000;
      cam.position.x += (Math.sin(t * 53) + Math.sin(t * 31)) * 0.5 * k;
      cam.position.y += (Math.sin(t * 47 + 1) + Math.sin(t * 29)) * 0.5 * k;
    }
    if (this.shakeKick > 0.001) {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      cam.position.x -= fx * this.shakeKick; cam.position.z -= fz * this.shakeKick;
      this.shakeKick = damp(this.shakeKick, 0, 0.15, dt);
    }
    cam.lookAt(this.look);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
};
