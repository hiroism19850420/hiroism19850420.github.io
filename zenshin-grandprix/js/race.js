// レースの流れ（第17部・付録K.5）
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, rng } from './util.js';
import { Kart } from './kart.js';
import { Rival, buildRacingLine } from './ai.js';
import { CHAR_IDS } from './models.js';

const R = CFG.race, P = CFG.phys;

export class Race {
  // opts：{ laps, diff, playerChar, mode, order（グリッドの並び、プレイヤー以外）, assist, seed, strengths }
  constructor(course, track, opts) {
    this.course = course; this.track = track;
    this.laps = opts.laps || R.LAPS; this.diff = opts.diff || 'easy';
    this.line = track._line || (track._line = buildRacingLine(track));
    const r = rng(opts.seed || (Date.now() & 0xffff));
    const others = (opts.order || CHAR_IDS.filter(c => c !== opts.playerChar)).slice(0, 5);
    const ids = [...others, opts.playerChar];
    this.karts = ids.map((id, i) => {
      const k = new Kart(track, id, id === opts.playerChar);
      const [gs, gd] = R.GRID[i];
      k.reset(gs, gd); k.lap = -1; k.grid = i;
      return k;
    });
    this.player = this.karts.find(k => k.isPlayer);
    const D = CFG.ai.DIFF[this.diff];
    // 強さの くじ（グランプリでは 点数の 多いライバルほど 強くなりやすい）
    const spread = D.spread.slice();
    const rivals = this.karts.filter(k => !k.isPlayer);
    let order = rivals.map((k, i) => ({ k, w: r() + (opts.points ? (opts.points[k.id] || 0) * 0.04 : 0) }));
    order.sort((a, b) => b.w - a.w);
    this.rivals = order.map((o, i) => new Rival(o.k, this, spread[i], (opts.seed || 1) * 31 + i));
    this.player.assist = CFG.phys.ASSIST[opts.assist || D.assist];
    this.rivals.forEach(rv => rv.k.assist = 0);
    this.phase = 'intro'; this.t = 0; this.time = 0; this.lights = 0; this.events = [];
    this.order = this.karts.slice(); this.playerPos = 6; this.finishOrder = [];
    this.finalLap = false; this.rescue = false; this.slowmo = null; this.acc = 0; this.stepDt = P.DT;
    this.cue = null; this.cueSaid = {}; this.turboTips = 0; this.turboIdle = 0; this.runIdle = 0; this.runSaid = 0;
    this.topSaid = false; this.paused = false; this.speed = 1; this.rocketDone = new Set();
    this.stats = { steps: 0, jumps: 0, squats: 0, banzais: 0, turbos: 0, stars: 0, bestLap: Infinity };
    this.resetStars();
  }
  resetStars() {
    for (const st of this.track.stars) { st.alive = true; st.respawnAt = 0; st.takenBy = null; st.grow = 1; st.shrink = 0; }
    for (const c of this.track.cones) { c.state = 'stand'; c.t = 0; }
  }
  event(type, kart, v) { this.events.push({ type, kart, v, t: this.time }); }
  takeEvents() { const e = this.events; this.events = []; return e; }

  toGrid() { this.phase = 'grid'; this.gridT0 = this.t; this.lights = 0; this.event('grid'); }

  // ---------- 1コマ ----------
  update(dtFrame) {
    if (this.paused) return;
    const k = this.slowmo ? this.slowmo.k : 1;
    if (this.slowmo) { this.slowmo.left -= dtFrame; if (this.slowmo.left <= 0) { this.slowmo = null; this.event('slowmoEnd'); } }
    this.acc += dtFrame * k * this.speed;
    let n = 0;
    while (this.acc >= P.DT && n < P.MAX_SUB) {
      this.substep(P.DT);
      this.acc -= P.DT; n++;
    }
    if (n === P.MAX_SUB) this.acc = 0;
    this.alpha = this.acc / P.DT;
  }
  substep(dt) {
    this.t += dt;
    if (this.phase === 'grid') this.updateGrid(dt);
    if (this.phase === 'run' || this.phase === 'finish' || this.phase === 'done') this.time += dt;
    for (const rv of this.rivals) rv.think(dt);
    for (const kt of this.karts) { kt.prevPos.copy(kt.wpos); kt.prevQuat.copy(kt.wquat); kt.step(dt, this); }
    this.collide();
    for (const kt of this.karts) kt.computeWorld();
    if (this.phase === 'run' || this.phase === 'finish' || this.phase === 'done') {
      this.pickStars(dt); this.hitCones(); this.slipstream(dt); this.rank();
      if (this.phase === 'run') { this.cues(dt); this.rocketWatch(); }
    }
    if (this.phase === 'finish') { this.finishT += dt / (this.slowmo ? this.slowmo.k : 1); if (this.finishT >= R.RESULT_AT) { this.phase = 'done'; this.event('done'); } }
  }

  updateGrid(dt) {
    if (this.holdGrid) { this.gridT0 += dt; return; }
    const g = this.t - this.gridT0;
    for (let i = 0; i < 4; i++) if (g >= R.LIGHTS[i] && this.lights < i + 1) { this.lights = i + 1; this.event('light', null, i + 1); }
    if (g >= R.LIGHTS[3] - P.ROCKET_PRE) this.rocketWatch();
    if (this.lights >= 4) this.start();
  }
  start() {
    this.phase = 'run'; this.time = 0;
    for (const kt of this.karts) { kt.lapStart = 0; }
    // ライバルの ロケットスタート
    for (const rv of this.rivals) if (rv.rng() < rv.D.rocket + (rv.person.rocket || 0)) { rv.k.startBoost('rocket'); this.event('rocketRival', rv.k); }
    this.event('go');
  }
  rocketWatch() {
    const pl = this.player;
    if (this.rocketDone.has(pl)) return;
    const g = this.phase === 'grid' ? (this.t - this.gridT0) - R.LIGHTS[3] : this.time;
    if (g < -P.ROCKET_PRE || g > P.ROCKET_POST) return;
    if (pl.input.throttle > P.ROCKET_THR) {
      this.rocketDone.add(pl);
      if (this.phase === 'run') { pl.startBoost('rocket'); this.event('rocket', pl); }
      else this.pendingRocket = true;
    }
    if (this.phase === 'run' && this.pendingRocket) { this.pendingRocket = false; pl.startBoost('rocket'); this.event('rocket', pl); }
  }

  // ---------- 線を こえた ----------
  crossLine(kart, f) {
    const tCross = this.time - this.stepDt * (1 - clamp(f, 0, 1));
    if (kart.lap < 0) { kart.lap = 0; kart.lapStart = Math.max(0, tCross); return; }
    const lapT = tCross - kart.lapStart;
    kart.lapTimes.push(lapT); kart.lapStart = tCross;
    kart.lap++;
    if (kart.isPlayer) this.stats.bestLap = Math.min(this.stats.bestLap, lapT);
    if (kart.lap >= this.laps) this.finishKart(kart, tCross);
    else if (kart.isPlayer) {
      if (kart.lap === this.laps - 1) { this.finalLap = true; this.event('final'); }
      else this.event('lap', kart, kart.lap + 1);
    }
  }
  finishKart(kart, t) {
    if (kart.finished) return;
    kart.finished = true; kart.finishTime = t;
    this.finishOrder.push(kart);
    kart.faceHappy = this.finishOrder.length <= 3; kart.celebrate = true;
    if (kart.isPlayer) {
      this.phase = 'finish'; this.finishT = 0;
      this.slowmo = { k: R.SLOWMO, left: R.SLOWMO_T };
      kart.autoV = 10; kart.assist = 1;
      this.predictTimes();
      this.event('goal', kart, this.finishOrder.length);
    } else {
      kart.autoV = 8;
      kart.parkD = (kart.d > 0 ? 1 : -1) * (this.track.course.width / 2 - 1.5);
      if (!this.player.finished && this.finishOrder.length === this.karts.length - 1) { this.rescue = true; this.player.vmin = P.VMIN_RESCUE; this.event('rescue'); }
    }
  }
  predictTimes() {
    const L = this.track.L;
    let last = this.player.finishTime;
    const rest = this.karts.filter(k => !k.finished).map(k => {
      const prog = Math.max(0, k.lap) * L + (k.lap < 0 ? 0 : k.s);
      const avg = Math.max(R.PREDICT_MINV, prog / Math.max(1, this.time));
      return { k, t: this.time + (this.laps * L - prog) / (avg * R.PREDICT_K) };
    }).sort((a, b) => a.t - b.t);
    for (const r of rest) { r.t = Math.max(r.t, last + R.PREDICT_GAP); last = r.t; r.k.predicted = r.t; }
  }
  // 結果の 並び（ゴールした順 → 予想タイム）
  results() {
    const list = this.karts.map(k => ({ k, t: k.finished ? k.finishTime : (k.predicted || 9999) }));
    list.sort((a, b) => a.t - b.t);
    return list;
  }

  // ---------- 順位 ----------
  rank() {
    const L = this.track.L;
    for (const k of this.karts) k.prog = k.finished ? 1e9 - k.finishTime : k.lap * L + k.s;
    this.order = this.karts.slice().sort((a, b) => b.prog - a.prog);
    const pos = this.order.indexOf(this.player) + 1;
    if (pos !== this.playerPos && this.phase === 'run') { this.event(pos < this.playerPos ? 'up' : 'down', this.player, pos); }
    this.playerPos = pos;
    if (pos === 1 && !this.topSaid && this.time > 3 && this.phase === 'run') { this.topSaid = true; this.event('top'); }
  }

  // ---------- 当たり ----------
  collide() {
    const ks = this.karts, tr = this.track;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i], b = ks[j];
      if (Math.abs(a.h - b.h) > P.CAR_DH) continue;
      const ds = tr.dsWrap(a.s, b.s), dd = b.d - a.d, dist = Math.hypot(ds, dd);
      const p = P.CAR_R * 2 - dist;
      if (p <= 0) continue;
      const nx = dist > 1e-4 ? ds / dist : 0, ny = dist > 1e-4 ? dd / dist : 1;
      a.d -= ny * p * P.CAR_PUSH_D; b.d += ny * p * P.CAR_PUSH_D;
      a.s = tr.wrapS(a.s - nx * p * P.CAR_PUSH_S); b.s = tr.wrapS(b.s + nx * p * P.CAR_PUSH_S);
      // 速さを へらすのは ぶつかった 瞬間の 1回だけ
      const key = a.id < b.id ? a.id + b.id : b.id + a.id;
      this.bumpAt = this.bumpAt || {};
      if (this.phase !== 'grid' && this.t - (this.bumpAt[key] || -9) > 0.5) {
        this.bumpAt[key] = this.t;
        const [back, front] = ds > 0 ? [a, b] : [b, a];
        back.v *= P.CAR_LOSS_BACK; front.v *= P.CAR_LOSS_FRONT;
        a.psi -= Math.sign(ny) * P.CAR_PSI; b.psi += Math.sign(ny) * P.CAR_PSI;
        this.event('bump', a, b);
        if (a.isPlayer || b.isPlayer) (a.isPlayer ? a : b).setFace('oops', 0.5);
      }
    }
  }

  // ---------- 星 ----------
  pickStars(dt) {
    const tr = this.track, pl = this.player;
    for (const st of tr.stars) {
      if (!st.alive) {
        // 出しなおし
        // プレイヤーが 取った星：1周して、星の 60m 手前まで 来たら 出す。ライバルが 取った星：4秒で 出す
        const respawn = st.takenBy === pl ? pl.prog > st.progTaken + tr.L - P.STAR_RESPAWN_AHEAD : this.time > st.respawnAt;
        if (respawn) { st.alive = true; st.grow = 0; }
        continue;
      }
      for (const k of this.karts) {
        const ds = tr.dsWrap(k.s, st.s);
        if (Math.abs(ds) > 2) continue;
        const kh = k.h + 0.6, sh = st.y;
        if (Math.hypot(ds, st.d - k.d, sh - kh) < P.STAR_R + (st.sky ? 0.4 : 0)) {
          st.alive = false; st.shrink = 0.2; st.takenBy = k; st.progTaken = k.prog; st.respawnAt = this.time + (k.isPlayer ? 1e9 : P.STAR_RIVAL_BACK);
          const before = Math.floor(k.stars / 5);
          k.addStars(1);
          this.event('star', k, st);
          if (k.isPlayer && Math.floor(k.stars / 5) > before && k.stars <= 15) this.event('gauge', k);
          break;
        }
      }
    }
  }
  // ---------- コーン ----------
  hitCones() {
    const tr = this.track;
    for (const c of tr.cones) {
      if (c.state !== 'stand') continue;
      for (const k of this.karts) {
        if (!k.ground) continue;
        const ds = tr.dsWrap(k.s, c.s) - P.CONE_FRONT * Math.cos(k.psi), dd = c.d - k.d;
        if (Math.hypot(ds, dd) < P.CONE_HIT) {
          c.state = 'fly'; c.t = 0; c.bounced = false;
          const f = tr.frame(k.s, {}), yaw = tr.yawAt(k.s) + k.psi;
          const fx = Math.sin(yaw), fz = Math.cos(yaw), side = Math.sign(dd) || 1;
          c.v.set(fx * k.v * 0.7 + f.lfx * side * 3, 4 + k.v * 0.15, fz * k.v * 0.7 + f.lfz * side * 3);
          c.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(8 + Math.random() * 6);
          k.v *= P.CONE_LOSS;
          this.event('cone', k, c);
          break;
        }
      }
    }
  }
  // ---------- 風よけ ----------
  slipstream(dt) {
    const tr = this.track;
    for (const k of this.karts) {
      if (!k.ground || k.finished) { k.slip = Math.max(0, k.slip - P.SLIP_DECAY * dt); continue; }
      let behind = false;
      for (const o of this.karts) { if (o === k) continue; const ds = tr.dsWrap(k.s, o.s); if (ds > P.SLIP_S0 && ds < P.SLIP_S1 && Math.abs(o.d - k.d) < P.SLIP_D && o.v > 8) { behind = true; break; } }
      if (behind) { k.slip += dt; k.slipping = true; if (k.slip >= P.SLIP_T) { k.slip = 0; k.startBoost('slip'); this.event('slip', k); } }
      else { k.slip = Math.max(0, k.slip - P.SLIP_DECAY * dt); k.slipping = false; }
    }
  }
  // ---------- くぐりゲート ----------
  gatePass(kart, gate) {
    const ok = kart.crouch || (this.time - kart.lastCrouchT) < P.GATE_PRE;
    if (ok) this.slide(kart);
    else { kart.gateLateUntil = this.time + P.GATE_POST; this.event('gateMiss', kart, gate); }
    this.event('gateWobble', kart, gate);
  }
  slide(kart) {
    kart.gateLateUntil = -9;
    kart.startBoost('slide'); kart.addStars(1);
    this.event('slide', kart);
  }

  // ---------- 合図（17.5） ----------
  cues(dt) {
    const pl = this.player, tr = this.track;
    if (pl.finished) { this.cue = null; return; }
    let cue = null;
    const r = tr.nextRamp(pl.s, pl.d, 60);
    if (r) {
      const t = tr.dsWrap(pl.s, r.s) / Math.max(pl.v, 6);
      if (t >= 0 && t <= R.CUE_T) cue = { kind: 'jump', p: 1 - t / R.CUE_T, now: t <= R.CUE_NOW, id: r };
    }
    const g = tr.nextGate(pl.s, 60);
    if (!cue && g) {
      const t = tr.dsWrap(pl.s, g.s) / Math.max(pl.v, 6);
      if (t >= 0 && t <= R.CUE_T) cue = { kind: 'squat', p: 1 - t / R.CUE_T, now: t <= P.GATE_PRE, id: g };
    }
    if (cue) {
      const key = cue.kind + ':' + (cue.id.s | 0) + ':' + pl.lap;
      if (!this.cueSaid[key]) { this.cueSaid[key] = true; if (pl.lap < R.CUE_VOICE_LAPS) this.event('cueVoice', pl, cue.kind); }
    }
    // 足ぶみの 合図
    if (pl.input.throttle < 0.15 && pl.boostT <= 0) this.runIdle += dt; else this.runIdle = 0;
    if (!cue && this.runIdle > R.RUN_CUE_T) { cue = { kind: 'run', p: 1, now: false }; if (!this.runCueOn) { this.runCueOn = true; if (this.runSaid < R.RUN_CUE_VOICE) { this.runSaid++; this.event('cueVoice', pl, 'run'); } } }
    else if (this.runIdle === 0) this.runCueOn = false;
    // ターボの 合図
    this.turboIdle += dt;
    if (pl.turbo) this.turboIdle = 0;
    if (pl.stars >= 5 && this.turboIdle > R.TURBO_CUE_IDLE && this.turboTips < R.TURBO_CUE_MAX && tr.kMax(pl.s, pl.s + R.TURBO_CUE_CLEAR) < 1 / R.TURBO_CUE_R) {
      this.turboTips++; this.turboIdle = -20; this.event('turboTip', pl);
    }
    this.cue = cue;
  }
}
