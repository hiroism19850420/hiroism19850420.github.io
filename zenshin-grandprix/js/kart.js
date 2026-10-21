// カートの動き（第11部・付録K）。フレネ座標 (s, d) の上を 式で 動かす
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, damp, wrapAngle } from './util.js';
import { ZONE } from './track.js';

const P = CFG.phys;
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

export class Kart {
  constructor(track, charId, isPlayer = false) {
    this.track = track; this.id = charId; this.isPlayer = isPlayer;
    this.input = { throttle: 0, steer: 0, jump: false, banzai: false, crouch: false, legPhase: null };
    this.wpos = new THREE.Vector3(); this.wquat = new THREE.Quaternion();
    this.prevPos = new THREE.Vector3(); this.prevQuat = new THREE.Quaternion();
    this.reset(0, 0);
  }
  reset(s, d) {
    Object.assign(this, {
      s: this.track.wrapS(s), d, psi: 0, v: 0, h: 0, vh: 0, ground: true, lap: -1, prog: 0,
      boostT: 0, boostV: 0, boostVmax: 0, boostFadeT: 0, boostKind: null, turbo: false, stars: 0,
      surf: this.track.course.road, surfK: 1, surfChangedT: 9, w: 0, yawRate: 0, slip: 0, airT: 0,
      trick: false, trickT: 0, trickDone: false, finished: false, finishTime: 0, time: 0, lapTimes: [], lapStart: 0,
      jumpHeldUntil: -9, launchT: null, superDone: false, lastPad: null, crouch: false, lastCrouchT: -9, gateLateUntil: -9,
      autoV: null, assist: 0, dAim: d, icePsi: 0, tauUp: null, iceGrip: null, frozen: false, vmin: P.VMIN,
      // 見た目
      pedalA: Math.random() * 6, steerShown: 0, rollShown: 0, bob: 0, accelX: 0, accelY: 0, face: 'normal', faceT: 0,
      trickA: 0, banzaiShown: false, banzaiT: 0, crouchShown: false, wave: false, clap: false, lookYaw: 0, prevVh: 0,
      wallT: 0, stats: { steps: 0, jumps: 0, squats: 0, banzais: 0, turbos: 0, stars: 0, walls: 0 }
    });
    this.computeWorld(); this.prevPos.copy(this.wpos); this.prevQuat.copy(this.wquat);
  }

  // ---------- 1回の計算 ----------
  step(dt, race) {
    const tr = this.track, inp = this.input;
    if (this.frozen) { this.visual(dt, race, 0); return; }
    const running = race.phase === 'run' || race.phase === 'finish' || race.phase === 'done';
    const thr = running ? inp.throttle : 0;
    const steer = clamp(inp.steer, -1, 1);
    // しゃがみ（ゲートの判定のために 時刻を 覚える）
    if (inp.crouch && !this.crouch) { this.lastCrouchT = race.time; if (race.time < this.gateLateUntil) race.slide(this); }
    this.crouch = !!inp.crouch;

    // 路面
    const surf = this.ground ? tr.surface(this.s, this.d) : 'air';
    if (surf !== this.surf) { this.surfChangedT = 0; this.surf = surf; }
    this.surfChangedT += dt;
    const sp = CFG.surf[surf] || [1, 1];
    this.surfK = damp(this.surfK, surf === 'air' ? this.surfK : sp[0], P.SURF_BLEND, dt);
    const grip = surf === 'ice' && this.iceGrip ? this.iceGrip : (surf === 'air' ? 1 : sp[1]);

    // 加速の 残り
    if (this.boostT > 0) { this.boostT -= dt; if (this.boostT <= 0) { this.boostT = 0; this.boostFadeT = P.BOOST_FADE; } }
    if (this.boostT <= 0 && this.boostFadeT > 0) {
      this.boostFadeT -= dt; this.boostV = this.boostVmax * Math.max(0, this.boostFadeT / P.BOOST_FADE);
      if (this.boostFadeT <= 0) { this.boostV = 0; this.turbo = false; this.boostKind = null; }
    }

    // 目標の 速さ
    const vmin = this.vmin * (surf === 'air' ? 1 : this.surfK);
    let vt = this.vmin + (P.VMAX - this.vmin) * thr;
    vt *= this.surfK;
    vt -= tr.slopeAt(this.s) * P.SLOPE_K;
    if (this.boostV > 0) vt = Math.max(vt, P.VMAX * P.BOOST_FLOOR) + this.boostV;
    vt = Math.max(vt, vmin);
    if (!running) vt = 0;
    if (this.autoV != null) vt = this.autoV;

    // 速さ
    if (this.ground) {
      const tauUp = this.surfChangedT < P.RECOVER_T ? P.TAU_UP_RECOVER : (this.tauUp || P.TAU_UP);
      this.v = vt > this.v ? damp(this.v, vt, tauUp, dt) : damp(this.v, vt, P.TAU_DOWN, dt);
    } else this.v -= this.v * P.AIR_DRAG * dt;
    if (!running) this.v = 0;

    // 向き
    const capW = Math.min(P.OMEGA_MAX, this.v / P.R_MIN);
    let w = steer * capW;
    if (this.assist > 0 && running) {
      const sA = this.s + this.v * P.ASSIST_LOOK;
      const wRoad = tr.kAt(sA) * this.v;
      const half = tr.wAt(this.s) / 2;
      const back = -this.psi * P.ASSIST_PSI - (this.d - this.dAim) / half * P.ASSIST_D * Math.min(1, this.v / 10);
      const A = this.assist * (1 - Math.abs(steer) * P.ASSIST_STEER_CUT);
      w += A * (wRoad + back * (Math.abs(steer) < 0.2 ? 1 : 0.3));
      if (Math.abs(steer) < 0.2) { this.dAim *= Math.pow(P.ASSIST_CENTER, dt); this.dAim = clamp(this.dAim, -half + 1.5, half - 1.5); }
      else this.dAim = this.d;
    }
    w = clamp(w, -capW * 1.15, capW * 1.15);
    if (!this.ground) w *= P.AIR_STEER;
    this.w = lerp(this.w, w, 1 - Math.exp(-dt * P.GRIP_RATE * grip));
    this.yawRate = this.w;

    // フレネの式
    const k = tr.kAt(this.s);
    const kd = Math.max(P.KD_MIN, 1 - k * this.d);
    let psiMove = this.psi;
    if (surf === 'ice' && grip < 0.8) { this.icePsi = damp(this.icePsi, this.psi, P.ICE_LAG, dt); psiMove = this.icePsi; }
    else this.icePsi = this.psi;
    const ds = this.v * Math.cos(psiMove) / kd * dt;
    const dd = this.v * Math.sin(psiMove) * dt;
    this.psi += this.w * dt - k * ds;
    if (Math.abs(this.psi) > P.PSI_MAX) this.psi -= Math.sign(this.psi) * (Math.abs(this.psi) - P.PSI_MAX) * Math.min(1, P.PSI_BACK * dt * 60);
    const sOld = this.s;
    this.s += ds; this.d += dd;
    this.wrapLap(sOld, race);

    // かべ
    const dmax = tr.wAt(this.s) / 2 + tr.shoulderAt(this.s) - P.WALL_HALF;
    if (Math.abs(this.d) > dmax) {
      const side = Math.sign(this.d);
      this.d = side * dmax;
      const vn = this.v * Math.sin(this.psi) * side;
      if (vn > 0.2) {
        this.psi -= side * Math.abs(this.psi) * P.WALL_BOUNCE;
        this.v *= 1 - Math.min(P.WALL_LOSS_MAX, vn * P.WALL_LOSS_K);
        if (race.time - this.wallT > 0.25) { this.wallT = race.time; this.stats.walls++; race.event('wall', this, vn); if (vn > 2) this.setFace('oops', 0.5); }
      } else if (this.v > 4 && race.time - (this.scrapeT || 0) > 0.3) { this.scrapeT = race.time; race.event('scrape', this); }
      this.dAim = clamp(this.dAim, -dmax + 1, dmax - 1);
    }

    // 高さ
    const rampH = tr.rampHeight(this.s, this.d);
    if (this.ground) {
      const ramp = tr.rampEndCrossed(sOld, this.s, this.d);
      if (ramp) this.launch(ramp, race);
      else {
        this.h = rampH;
        if (inp.jump) this.onJump(race);
        // すきまに 落ちそうなら（台を通らずに すきまへ）
        const gap = tr.inGap(this.s);
        if (gap && !this.gapRescue) this.rescueGap(gap, race);
      }
    } else {
      this.vh -= P.G * dt;
      this.h += this.vh * dt;
      this.airT += dt;
      if (inp.jump && this.launchT != null && race.time - this.launchT <= P.SUPER_POST && !this.superDone && this.lastRamp) {
        this.vh += this.v * P.RAMP_K * P.SUPER_LATE_K; this.superDone = true; this.addStars(2); race.event('super', this);
      }
      if (inp.banzai && !this.trickDone && this.timeToLand() > P.TRICK_MIN) { this.trick = true; this.trickDone = true; this.trickT = 0; race.event('trick', this); }
      const gap = tr.inGap(this.s);
      if (this.h <= rampH && this.vh < 0) {
        if (gap) { if (this.h < -0.6) this.rescueGap(gap, race); }
        else this.land(race);
      }
    }
    if (this.trick) { this.trickT += dt; this.trickA = Math.min(1, this.trickT / P.TRICK_TIME) * Math.PI * 2; if (this.trickT >= P.TRICK_TIME) this.trickA = 0; }

    // 加速パネル
    if (this.ground) {
      const pad = tr.padAt(this.s, this.d);
      if (pad && pad !== this.lastPad) { this.startBoost('pad'); race.event('pad', this); }
      this.lastPad = pad;
    }
    // ゲート
    const gate = tr.gateCrossed(sOld, this.s);
    if (gate) race.gatePass(this, gate);
    // ターボ
    if (inp.banzai && this.ground && race.phase === 'run' && !this.finished) {
      if (this.stars >= P.STARS_PER_TURBO) { this.stars -= P.STARS_PER_TURBO; this.startBoost('turbo'); this.turbo = true; this.stats.turbos++; race.event('turbo', this); }
      else race.event('noStar', this);
    }
    inp.jump = false; inp.banzai = false;
    if (running) this.time += dt;
    this.visual(dt, race, thr);
  }

  onJump(race) {
    const r = this.track.nextRamp(this.s, this.d, 40);
    if (r && Math.abs(this.d - (r.d || 0)) < r.width / 2 + 0.3) {
      const t = this.track.dsWrap(this.s, r.s) / Math.max(this.v, 1);
      if (t >= 0 && t <= P.SUPER_PRE) { this.jumpHeldUntil = race.time + t + 0.08; this.jumpAnim = 0.4; return; }
    }
    if (this.track.rampHeight(this.s, this.d) > 0.05) { this.jumpHeldUntil = race.time + 0.3; return; }   // 台の上：ためる
    this.vh = P.HOP_V; this.ground = false; this.airT = 0; this.trickDone = true; this.launchT = null; this.lastRamp = null;
    race.event('hop', this);
  }
  launch(ramp, race) {
    let vh = this.v * P.RAMP_K;
    const superOk = race.time <= this.jumpHeldUntil;
    if (superOk) { vh *= P.SUPER_K; this.addStars(2); race.event('super', this); }
    if (ramp.gapRef) {
      const g = ramp.gapRef;
      this.v = Math.max(this.v, P.GAP_VMIN);
      const len = this.track.dsWrap(ramp.s, g.s1) + P.GAP_EXTRA;
      const t = len / this.v;
      vh = Math.max(vh, P.G * t / 2 - ramp.h / t);
    }
    this.h = ramp.h; this.vh = vh; this.ground = false; this.airT = 0; this.trickDone = false; this.trick = false;
    this.launchT = race.time; this.superDone = superOk; this.lastRamp = ramp; this.gapRescue = false;
    race.event('launch', this, superOk);
  }
  land(race) {
    const imp = -this.vh;
    this.h = 0; this.vh = 0; this.ground = true; this.launchT = null;
    if (this.trick) { this.trick = false; this.trickA = 0; this.startBoost('trick'); this.addStars(1); race.event('trickLand', this); }
    race.event('land', this, imp);
  }
  rescueGap(gap, race) {
    // すきまの 終わりへ ふわっと 置きなおす（罰の演出は しない）
    this.s = this.track.wrapS(gap.s1 + 2); this.h = 0.8; this.vh = 1.5; this.ground = false; this.gapRescue = true;
    this.v = Math.max(this.v, 10);
    race.event('rescue', this);
  }
  timeToLand() {
    if (this.ground) return 0;
    const a = -0.5 * P.G, b = this.vh, c = this.h;
    const disc = b * b - 4 * a * c;
    return disc < 0 ? 0 : (-b - Math.sqrt(disc)) / (2 * a);
  }
  addStars(n) { this.stars = Math.min(P.STARS_MAX, this.stars + n); this.stats.stars += n; }
  startBoost(kind) {
    const [t, v] = P.BOOSTS[kind];
    const was = this.boostT > 0 || this.boostFadeT > 0;
    this.boostT = Math.max(this.boostT, t);
    this.boostVmax = Math.max(was ? this.boostVmax : 0, v);
    this.boostV = this.boostVmax; this.boostFadeT = 0;
    this.v += P.KICK;
    this.boostKind = kind;
    if (kind === 'turbo') this.banzaiT = 0.5;
  }
  wrapLap(sOld, race) {
    const L = this.track.L;
    if (this.s >= L) { this.s -= L; const f = (L - sOld) / Math.max(1e-6, (this.s + L) - sOld); race.crossLine(this, f); }
    else if (this.s < 0) { this.s += L; if (this.lap >= 0 && sOld < 30) this.lap--; }
  }
  setFace(f, t = 0) { this.face = f; this.faceT = t; }

  // ---------- 見た目の 値 ----------
  visual(dt, race, thr) {
    const inp = this.input;
    // ペダル
    if (inp.legPhase != null) {
      const target = Math.asin(clamp(inp.legPhase, -1, 1));
      const alt = Math.PI - target;
      const cur = this.pedalA % (Math.PI * 2);
      const d1 = wrapAngle(target - cur), d2 = wrapAngle(alt - cur);
      this.pedalA += (Math.abs(d1) < Math.abs(d2) ? d1 : d2) * Math.min(1, dt / 0.06);
    } else this.pedalA += inp.throttle * 2.2 * Math.PI * 2 * dt * (race.phase === 'grid' || this.v > 0.5 || inp.throttle > 0.05 ? 1 : 0);
    this.steerShown = damp(this.steerShown, inp.steer, 0.08, dt);
    const aLat = this.v * this.w;
    this.accelX = damp(this.accelX, aLat, 0.08, dt);
    this.rollShown = damp(this.rollShown, clamp(aLat * 0.012, -0.1, 0.1), 0.12, dt);
    const ay = (this.vh - this.prevVh) / Math.max(dt, 1e-3); this.prevVh = this.vh;
    this.accelY = clamp(ay, -60, 60) * (this.ground ? 0.2 : 0.05);
    const s = this.s;
    let bob = (Math.sin(s * 1.7) * 0.5 + Math.sin(s * 4.3 + 1) * 0.5) * 0.008 * (this.v / 20);
    if (['grass', 'sand', 'snow'].includes(this.surf)) bob *= 3;
    if (this.surf === 'plank') bob += Math.sin(s * 6.3) * 0.012 * Math.min(1, this.v / 10);
    bob += Math.sin(this.pedalA * 2) * 0.01 * thr;
    this.bob = this.ground ? bob : 0;
    if (this.faceT > 0) { this.faceT -= dt; if (this.faceT <= 0) this.face = 'normal'; }
    else if (this.face !== 'happy' || !this.finished) this.face = (thr > 0.75 || this.turbo) ? 'effort' : 'normal';
    if (this.finished && this.faceHappy) this.face = 'happy';
    if (this.banzaiT > 0) this.banzaiT -= dt;
    this.banzaiShown = this.banzaiT > 0 || this.trick || !!this.banzaiHold || (this.finished && this.celebrate);
    this.crouchShown = this.crouch;
    if (this.jumpAnim > 0) this.jumpAnim -= dt;
  }

  // 描画の 位置と 向き
  computeWorld() {
    const tr = this.track;
    const p = tr.pos(this.s, this.d, this.h, this._p || (this._p = {}));
    this.wpos.set(p.x, p.y, p.z);
    const yaw = tr.yawAt(this.s) + this.psi;
    let pitch;
    if (this.ground) {
      let sl = tr.slopeAt(this.s);
      const rh0 = tr.rampHeight(this.s - 0.5, this.d), rh1 = tr.rampHeight(this.s + 0.5, this.d);
      sl += rh1 - rh0;
      pitch = -Math.atan(sl);
    } else pitch = -clamp(Math.atan2(this.vh, Math.max(this.v, 1)) * 0.7, -0.3, 0.35);
    this.pitchShown = this.pitchShown == null ? pitch : damp(this.pitchShown, pitch, 0.06, 1 / 60);
    const bank = (Math.abs(this.d) <= tr.wAt(this.s) / 2 ? tr.bankAt(this.s) : 0);
    _e.set(this.pitchShown, yaw, -bank, 'YXZ');
    this.wquat.setFromEuler(_e);
    this.yawW = yaw;
  }
}
