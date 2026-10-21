// ライバル（第16部・付録K.4）
import { CFG } from './config.js';
import { clamp, damp, rng } from './util.js';

const A = CFG.ai;

// 走るすじ（16.2）
export function buildRacingLine(tr) {
  const N = tr.N, line = new Float32Array(N), ks = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0, n = 0;
    for (let k = -10; k <= 25; k++) { sum += tr.k[(i + k + N) % N]; n++; }
    ks[i] = sum / n;
  }
  for (let i = 0; i < N; i++) {
    const half = tr.w[i] / 2 - A.LINE_MARGIN;
    line[i] = clamp(ks[i] * A.LINE_K, -half, half);
  }
  const sm = (arr, win) => { const h = Math.floor(win / 2), out = new Float32Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let k = -h; k <= h; k++) s += arr[(i + k + N) % N]; out[i] = s / (2 * h + 1); } arr.set(out); };
  sm(line, A.LINE_SMOOTH); sm(line, A.LINE_SMOOTH);
  return { line, ks };
}

export class Rival {
  constructor(kart, race, strength, seed) {
    this.k = kart; this.race = race; this.strength = strength;
    this.D = A.DIFF[race.diff];
    this.person = A.PERSON[kart.id] || {};
    this.rng = rng(seed);
    this.bias = 0; this.biasT = 0; this.avoidD = 0; this.passing = null; this.steer = 0;
    this.wobW = 2 * Math.PI / (0.9 + this.rng() * 0.5); this.ph = this.rng() * 6;
    this.rampDone = null; this.gateDone = null; this.crouchUntil = -9; this.hopT = 20 + this.rng() * 40; this.turboWait = 0;
    if (kart.id === 'pen') kart.iceGrip = this.person.iceGrip;
  }
  lineAt(s) { const tr = this.k.track; return tr._f(this.race.line.line, s); }
  ksAt(s) { const tr = this.k.track; return tr._f(this.race.line.ks, s); }
  starLine(s) {
    // 近くの 星の列の d（ポチ）
    const tr = this.k.track;
    for (const st of tr.stars) { const x = tr.dsWrap(s, st.s); if (x > 0 && x < 30 && st.alive && !st.sky) return st.d; }
    return null;
  }
  think(dt) {
    const k = this.k, tr = k.track, race = this.race, D = this.D;
    if (k.finished) { k.input.throttle = 0.3; k.input.steer = this.follow(dt, this.lineAt(k.s) + (k.parkD || 0)); return; }
    // 好きなずれ
    this.biasT -= dt;
    if (this.biasT <= 0) { this.bias = (this.rng() * 2 - 1) * A.BIAS_MAX; this.biasT = A.BIAS_T[0] + this.rng() * (A.BIAS_T[1] - A.BIAS_T[0]); }
    const kNow = Math.abs(this.ksAt(k.s));
    let dT = this.lineAt(k.s) + this.bias * (kNow < 1 / 150 ? 1 : A.BIAS_CURVE);
    if (this.person.stars) { const sd = this.starLine(k.s); if (sd != null) dT = sd; }
    dT += this.avoid(dt);
    const half = tr.wAt(k.s) / 2 - A.LINE_MARGIN;
    dT = clamp(dT, -half, half);
    k.input.steer = this.follow(dt, dT);
    // 速さ
    const rb = this.rubber();
    const vTop = D.base * this.strength * (this.person.speed || 1) * rb;
    const kMax = Math.max(1 / 1000, tr.kMax(k.s, k.s + Math.max(8, k.v * 1.2)));
    const vCurve = Math.sqrt(D.alat * (this.person.alat || 1) / kMax);
    let vWant = Math.min(vTop, vCurve, CFG.phys.VMAX);
    vWant = this.dontPush(vWant);
    const thr = clamp((vWant - CFG.phys.VMIN) / (CFG.phys.VMAX - CFG.phys.VMIN), 0, 1);
    k.input.throttle = clamp(thr + Math.sin(race.time * this.wobW + this.ph) * A.THR_WOBBLE, 0, 1);
    k.tauUp = race.time < A.START_T ? A.START_TAU : null;
    this.actions(dt);
  }
  follow(dt, dT) {
    const k = this.k, tr = k.track;
    const look = Math.max(A.LOOK_MIN, k.v * A.LOOK_K);
    const dAhead = this.lineAt(k.s + look) + (dT - this.lineAt(k.s));
    const psiAim = Math.atan2(dAhead - k.d, look);
    const capW = Math.max(0.1, Math.min(CFG.phys.OMEGA_MAX, k.v / CFG.phys.R_MIN));
    const want = (tr.kAt(k.s) * k.v + (psiAim - k.psi) * A.PSI_GAIN) / capW;
    this.steer = damp(this.steer, clamp(want, -1, 1), A.STEER_SMOOTH, dt);
    return this.steer;
  }
  rubber() {
    const race = this.race, D = this.D, pl = race.player;
    if (pl.finished || race.phase !== 'run') return 1;
    const gap = this.k.prog - pl.prog;
    const ahead = race.finalLap ? D.rbAhead / 2 : D.rbAhead;
    if (gap > A.RB_AHEAD0) return 1 - Math.min(ahead, (gap - A.RB_AHEAD0) / A.RB_AHEAD_DIV);
    if (gap < -A.RB_BEHIND0) return 1 + Math.min(D.rbBehind, (-gap - A.RB_BEHIND0) / A.RB_BEHIND_DIV);
    return 1;
  }
  avoid(dt) {
    const k = this.k, tr = k.track;
    let target = 0;
    for (const o of this.race.karts) {
      if (o === k) continue;
      const ds = tr.dsWrap(k.s, o.s);
      if (ds > 0 && ds < A.AVOID_AHEAD && Math.abs(o.d - k.d) < A.AVOID_LANE && k.v > o.v + A.AVOID_DV) {
        const half = tr.wAt(k.s) / 2;
        target = (half - o.d) > (o.d + half) ? A.AVOID_D : -A.AVOID_D;
        this.passing = o;
      }
    }
    if (this.passing && tr.dsWrap(this.passing.s, k.s) > 3) this.passing = null;
    if (this.passing && !target) target = Math.sign(this.avoidD) * A.AVOID_D;
    this.avoidD = damp(this.avoidD, target, target ? A.AVOID_IN : A.AVOID_OUT, dt);
    return this.avoidD;
  }
  dontPush(vWant) {
    const k = this.k, pl = this.race.player;
    const ds = k.track.dsWrap(k.s, pl.s);
    if (ds > 0 && ds < A.NO_PUSH_BACK && Math.abs(pl.d - k.d) < 1.6) return Math.min(vWant, pl.v + A.NO_PUSH_DV);
    return vWant;
  }
  actions(dt) {
    const k = this.k, tr = k.track, D = this.D, p = this.person, race = this.race;
    if (race.phase !== 'run') return;
    // ジャンプ台
    const r = tr.nextRamp(k.s, k.d, 40);
    if (r && r !== this.rampDone) {
      const t = tr.dsWrap(k.s, r.s) / Math.max(k.v, 1);
      if (t < 0.3 && t >= 0) { this.rampDone = r; if (this.rng() < D.sjump + (p.sjump || 0)) { k.input.jump = true; } }
    }
    if (!r) this.rampDone = null;
    // ゲート
    const g = tr.nextGate(k.s, 40);
    if (g && g !== this.gateDone) {
      const t = tr.dsWrap(k.s, g.s) / Math.max(k.v, 1);
      if (t < 0.4) { this.gateDone = g; this.crouchUntil = this.rng() < D.slide ? race.time + 0.75 : -9; }
    }
    if (!g) this.gateDone = null;
    k.input.crouch = race.time < this.crouchUntil;
    // トリック
    if (!k.ground && !k.trickDone && k.timeToLand() > 0.35 && this.rng() < (D.trick + (p.trick || 0)) * 0.05) k.input.banzai = true;
    // ターボ
    this.turboWait -= dt;
    if (k.ground && k.stars >= 5 && this.turboWait <= 0 && this.wantTurbo()) { k.input.banzai = true; this.turboWait = 2; }
    // ときどき ぴょん
    this.hopT -= dt;
    if (this.hopT < 0 && k.ground) { this.hopT = 40 + this.rng() * 40; k.input.jump = true; }
  }
  wantTurbo() {
    const k = this.k, tr = k.track, mode = this.person.turbo === 'often' ? 'straight' : this.D.turbo;
    const straight = tr.kMax(k.s, k.s + 60) < 1 / 50;
    if (mode === 'full') return k.stars >= 15 && straight;
    if (mode === 'straight') return straight;
    // smart：前に 近いカート、または 最後の直線
    if (!straight) return false;
    const lastLap = k.lap >= this.race.laps - 1;
    if (lastLap && tr.dsWrap(k.s, 0) < 120 && tr.dsWrap(k.s, 0) > 0) return true;
    return this.race.karts.some(o => o !== k && tr.dsWrap(k.s, o.s) > 0 && tr.dsWrap(k.s, o.s) < 25);
  }
}
