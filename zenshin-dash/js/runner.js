// ランナー（アバターと ライバル）の 走りの 物理（第9部・付録K）
import { CFG } from './config.js';
import { clamp, damp } from './util.js';

const R = CFG.run;
// とくべつな 姿勢の 長さ（秒）
const SPECIAL_T = { banzai: 0.6, swatR: 0.6, swatL: 0.6, armR: 0.4, armL: 0.4, legR: 0.4, legL: 0.4, wave: 1.2 };

export class Runner {
  constructor(opt) {
    Object.assign(this, opt);
    this.s = 0; this.d = CFG.course.GATE_D[opt.gate]; this.v = 0; this.vd = 0; this.h = 0; this.vh = 0;
    this.vt = 0; this.dTarget = this.d; this.crouch = null; this.air = false; this.apex = 0;
    this.stumbleT = 0; this.safeT = 0; this.holdT = 0; this.boostT = 0; this.boostK = 0;
    this.spurt = 0; this.blockedBy = null; this.blockedT = 0; this.passing = false; this.decideT = 0;
    this.assistLat = false; this.assistOb = null;
    this.finished = false; this.finishTime = 0; this.afterGoal = 0;
    this.jumpDelay = 0; this.jumpT = 0; this.charging = false; this.jumpK = 1;
    this.phase = Math.random(); this.stepRate = 0;
    this.special = null; this.specialT = 0; this.happyT = 0; this.forceCrouch = 0; this.lookYaw = 0;
    this.stats = { ok: 0, miss: 0, perfect: 0, jump: [0, 0], dodge: [0, 0], crouch: [0, 0], hand: [0, 0],
      passes: 0, topV: 0, jamaHit: 0, jamaGot: 0, jamaDodge: 0, steps: 0 };
    this.lastPassTimes = [];
  }

  // 1/120 秒ごと。inp：プレイヤーは PlayerInput、ライバルは { vt, crouch }
  step(dt, race, inp) {
    const L = race.L;
    // ---- 走りたい速さ ----
    let vt;
    if (this.isPlayer) {
      const th = inp.th || 0;
      vt = th < 0.05 ? 0 : this.vmax(race) * (R.V_FLOOR + (1 - R.V_FLOOR) * Math.pow(th, R.TH_POW));
    } else vt = inp.vt || 0;
    // しゃがみ（スピードが 乗っていれば 中腰ラン）
    const wantCrouch = !!inp.crouch || this.forceCrouch > 0;
    if (wantCrouch && !this.air) {
      if (!this.crouch) this.crouch = this.v >= R.V_CARRY ? 'run' : 'walk';
      else if (this.crouch === 'run' && this.v < R.V_CWALK + 1) this.crouch = 'walk';
    } else if (!wantCrouch) this.crouch = null;
    if (this.crouch === 'walk') vt = Math.min(vt, R.V_CWALK);
    if (this.stumbleT > 0) vt = Math.min(vt, R.STUMBLE_CAP * R.V_MAX);
    if (race.inFinal(this.s)) vt *= 1 + R.SPURT_MAX * this.spurt;
    if (race.drafting(this)) vt *= 1 + R.DRAFT;
    if (this.boostT > 0) vt *= 1 + this.boostK;
    if (this.finished) { vt = Math.min(vt, R.FINISH_JOG); if (this.afterGoal > R.FINISH_STOP) vt = 0; }
    if (this.blockedBy) vt = Math.min(vt, Math.max(0, this.blockedBy.v - CFG.pack.BLOCK_DV));
    if (race.phase === 'gate') vt = 0;
    this.vt = vt;
    // ---- 慣性（足を 止めても すぐには 止まらない） ----
    const holding = this.crouch === 'run' || this.air || this.holdT > 0;
    if (this.air) this.v *= 1 - R.AIR_DRAG * dt;
    else if (vt > this.v) this.v += (vt - this.v) * (1 - Math.exp(-dt / R.TAU_UP));
    else this.v += (vt - this.v) * (1 - Math.exp(-dt / (holding ? R.TAU_HOLD : R.TAU_DOWN)));
    if (this.blockedBy && this.v > this.blockedBy.v) this.v = damp(this.v, this.blockedBy.v, 0.15, dt);
    if (race.phase === 'gate') this.v = 0;
    // ---- 前へ ----
    const s0 = this.s;
    this.s += this.v * dt;
    if (!this.finished && s0 < L && this.s >= L) race.crossLine(this, s0, dt);
    if (this.finished) this.afterGoal += this.s - s0;
    // ---- ジャンプ ----
    if (this.jumpDelay > 0) { this.jumpDelay -= dt; if (this.jumpDelay <= 0) this.launch(this.jumpT); }
    if (this.air) {
      this.h += this.vh * dt; this.vh -= R.G * dt;
      if (this.h <= 0 && this.vh < 0) { this.h = 0; this.vh = 0; this.air = false; race.emit('land', { who: this, big: this.apex >= R.LAND_FX_H }); }
    }
    // ---- 横 ----
    const latMax = this.assistLat ? R.LAT_V_ASSIST : this.passing ? R.LAT_PASS : R.LAT_V;
    const want = clamp((this.dTarget - this.d) * R.LAT_K, -latMax, latMax) * (this.air ? R.AIR_LAT_K : 1);
    const iceK = race.onIce(this) && !this.trait?.ice ? R.ICE_LAT_K : 1;
    this.vd += (want - this.vd) * (1 - Math.exp(-dt / R.LAT_TAU)) * iceK;
    this.d += this.vd * dt;
    if (Math.abs(this.d) >= R.D_MAX) { this.d = Math.sign(this.d) * R.D_MAX; if (Math.sign(this.vd) === Math.sign(this.d)) this.vd = 0; }
    // ---- 時間 ----
    for (const k of ['stumbleT', 'safeT', 'holdT', 'boostT', 'happyT', 'forceCrouch']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.boostT <= 0) this.boostK = 0;
    if (this.crouch === 'run') this.holdT = Math.max(this.holdT, 0.05);
    if (this.special) { this.specialT += dt; const lim = SPECIAL_T[this.special]; if (lim && this.specialT > lim) this.special = null; }
    this.stats.topV = Math.max(this.stats.topV, this.v);
    // ---- 足の 周期 ----
    const sr = this.isPlayer && inp.cam && inp.stepRate != null ? inp.stepRate : (this.v < 0.5 ? 0 : 1.4 + this.v * 0.17);
    this.stepRate = damp(this.stepRate, sr, 0.15, dt);
    const ph0 = this.phase;
    this.phase = (this.phase + this.stepRate / 2 * (this.crouch === 'walk' ? 0.7 : 1) * dt) % 1;
    if (!this.air && this.v > 0.3 && ((ph0 < 0.5) !== (this.phase < 0.5))) race.emit('footstep', { who: this });
  }

  vmax(race) { return R.V_MAX * (race.twoRB ? race.twoRB(this) : 1); }

  // ふつうの ジャンプ
  jump() { if (this.air || this.jumpDelay > 0) return; this.launch(R.T_JUMP); }
  // 合図の ジャンプ（9.4.2）：かならず こえるように 空中の 時間を 合わせる
  jumpOver(eta) {
    if (this.air || this.jumpDelay > 0) return;
    const T = Math.max(R.T_JUMP, eta + R.JUMP_EXTRA);
    if (T > R.T_MAX) { this.jumpDelay = T - R.T_MAX; this.jumpT = R.T_MAX; this.charging = true; }
    else this.launch(T);
  }
  launch(T) {
    this.charging = false; this.air = true; this.vh = R.G * T / 2 * (this.jumpK || 1);
    this.apex = this.vh * this.vh / (2 * R.G); this.act(R.HOLD_T);
  }
  stumble(kind, fromD = null) {
    if (this.safeT > 0) return false;
    this.v *= kind === 'jama' ? R.STUMBLE_K_JAMA : R.STUMBLE_K_OBS;
    this.stumbleT = R.STUMBLE_T; this.safeT = R.SAFE_T;
    if (fromD != null) this.vd += Math.sign(this.d - fromD || 1) * R.STUMBLE_PUSH;
    return true;
  }
  boost(k, t = R.BOOST_T) { this.boostK = Math.max(this.boostK, k); this.boostT = Math.max(this.boostT, t); }
  act(t = R.HOLD_T) { this.holdT = Math.max(this.holdT, t); }
  pose(name) { this.special = name; this.specialT = 0; }
}
