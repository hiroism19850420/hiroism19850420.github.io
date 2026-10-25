// カメラと 姿勢の 読みとり（第4部・第5部・付録A・F）。1〜2人
import { CFG } from './config.js';
import { clamp, lerp, smoothstep, damp, History } from './util.js';

const C = CFG.body;
const MP_VER = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// ================= 1人分の 体の 状態（F.1） =================
export class BodyState {
  constructor(who = 0) {
    this.who = who; this.subs = {};
    this.legSens = 1; this.shiftFull = 0.85; this.swap = false; this.counting = true; this.portrait = false;
    this.u = 0.16; this.asp = 4 / 3; this.now = 0;
    this.reset(); this.resetCounts();
  }
  on(n, fn) { (this.subs[n] = this.subs[n] || []).push(fn); return this; }
  emit(n, d) { (this.subs[n] || []).forEach(f => { try { f(d, this); } catch (e) { console.error(e); } }); this.events.push({ type: n, t: this.now }); }
  reset() {
    Object.assign(this, {
      seen: false, isLost: false, lostT: 0, seenT: 0, lm: null, events: [], legs: false, full: false, headOk: false, anklesOk: false, handsOk: false,
      baseY: null, prevBodyY: null, hipOffU: null, lowT: 0, crouchT: 0, vUpAvg: 0, lastJump: -9, maskT: -9, rawPrev: 0, lastSide: '', yMean: null, yState: 'up', lastPeakT: -9,
      throttle: 0, cadence: 0, stepRate: 0, legPhase: 0, lift: 0, air: false, crouch: false,
      baseX: null, baseXAcc: null, shiftRaw: 0, shift: 0, shiftNorm: 0,
      handT: [0, 0], handUp: [false, false], handArmed: [true, true],
      banzai: false, banzaiT: 0, banzaiArmed: true,
      swing: 0, wristPrev: null, wristRel: [{ ok: false, x: 0, y: 0 }, { ok: false, x: 0, y: 0 }],
      armT: [0, 0], armOut: [false, false], armArmed: [true, true], armNext: [0, 0],
      legT: [0, 0], legOut: [false, false], legArmed: [true, true], legNext: [0, 0],
      hipX: 0.5, cx: 0.5, cy: 0.5
    });
    this.histD = new History(48); this.histA = new History(48); this.histY = new History(48);
    this.stepTimes = new History(32); this.swingHist = new History(48);
  }
  resetCounts() { this.steps = 0; this.jumps = 0; this.squats = 0; this.banzais = 0; this.hands = 0; this.arms = 0; this.legs2 = 0; }
  setSens(leg = 'mid', shift = 'mid', swap = false, portrait = false) {
    this.legSens = C.LEG_SENS[leg] || 1;
    this.shiftFull = (C.SHIFT_FULL[shift] || 0.85) * (portrait ? C.SHIFT_PORTRAIT_K : 1);
    this.swap = !!swap; this.portrait = !!portrait;
  }
  // 基準の 立ち位置を 決めなおす（れんしゅう、ゲート、縦横が 変わったとき）
  recenter() { this.baseX = null; this.baseXAcc = { sum: 0, n: 0, t: 0 }; }
  // 立ちの 高さの 基準を 決めなおす（人が 入れかわった・見うしなった・1人⇔2人）
  rebaseY() {
    this.baseY = null; this.prevBodyY = null; this.hipOffU = null; this.lowT = 0; this.vUpAvg = 0;
    if (this.crouch) { this.crouch = false; this.emit('stand'); }
    this.air = false;
  }
  takeEvents() { const e = this.events; this.events = []; return e; }

  // 見えないとき
  feedNone(dt) {
    this.lm = null; this.seen = false; this.lostClock(dt);
    this.throttle = damp(this.throttle, 0, C.THR_DOWN, dt); this.shiftNorm = 0; this.swing = damp(this.swing, 0, 0.2, dt);
    this.banzaiT = 0; this.handT = [0, 0];
  }

  // lm：MediaPipe の 関節 33（鏡うつしの前）
  feed(lm, dt, t) {
    dt = clamp(dt || 0.033, 0.001, C.FEED_DT_MAX);
    if (t == null) t = performance.now() / 1000;
    this.now = t;
    const asp = this.asp;
    const P = i => { const p = lm[i]; let x = (1 - p.x) * asp; if (this.swap) x = asp - x; return { x, y: p.y, v: p.visibility == null ? 1 : p.visibility }; };
    const ls = P(11), rs = P(12);
    this.lm = lm;
    this.seen = ls.v >= C.VIS_SHOULDER && rs.v >= C.VIS_SHOULDER && isFinite(ls.x) && isFinite(rs.x);
    if (!this.seen) { this.feedNone(dt); this.lm = lm; return; }
    this.foundClock(dt);
    const uNow = Math.max(0.04, Math.hypot(ls.x - rs.x, ls.y - rs.y));
    this.u += (uNow - this.u) * C.SMOOTH_U;
    const u = this.u;
    const sc = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    this.cx = sc.x / asp; this.cy = sc.y;
    const lh = P(23), rh = P(24), hipsOk = lh.v >= C.VIS_HIP && rh.v >= C.VIS_HIP;
    const lk = P(25), rk = P(26);
    this.legs = lk.v >= C.VIS_KNEE && rk.v >= C.VIS_KNEE;
    const la = P(27), ra = P(28), anklesOk = la.v >= C.VIS_ANKLE && ra.v >= C.VIS_ANKLE;
    const le = P(13), re = P(14), lw = P(15), rw = P(16);
    const wOk = [lw.v >= C.VIS_WRIST, rw.v >= C.VIS_WRIST];
    this.handsOk = wOk[0] && wOk[1];
    const nose = P(0);
    this.headOk = nose.v >= C.VIS_NOSE && lm[0].y > 0.03;
    this.anklesOk = anklesOk;
    const noseY = nose.v >= C.VIS_NOSE ? nose.y : sc.y - C.NOSE_FALLBACK * u;
    this.full = hipsOk && this.legs;
    const hip = hipsOk ? { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 } : sc;
    this.hipX = hip.x / asp;

    // ---- ジャンプ・しゃがみ（グランプリと 同じ） ----
    // 腰が 見えたり 見えなかったりしても 高さが とばないように、腰が 見えないときは 肩から 腰の 中ほどを おしはかる
    let bodyY;
    if (hipsOk) {
      const off = (hip.y - sc.y) / 2 / u;
      if (this.hipOffU == null) { if (this.baseY != null) this.baseY += off * u; this.hipOffU = off; }
      else this.hipOffU = damp(this.hipOffU, off, 0.5, dt);
      bodyY = (sc.y + hip.y) / 2;
    } else bodyY = sc.y + (this.hipOffU ?? 0) * u;
    if (this.baseY == null) { this.baseY = bodyY; this.prevBodyY = bodyY; }
    const lift = (this.baseY - bodyY) / u;
    // 低いまま 長く つづいたら（しゃがみっぱなしは ない）、基準の ほうが ずれたので 合わせなおす
    this.lowT = lift > C.BASE_FREEZE ? 0 : this.lowT + dt;
    if (lift > C.BASE_FREEZE || this.lowT > C.SQUAT_MAX) {
      const tau = this.lowT > C.SQUAT_MAX ? C.BASE_UNSTICK : Math.abs(lift) < C.BASE_STILL ? C.BASE_FAST : C.BASE_SLOW;
      this.baseY += (bodyY - this.baseY) * Math.min(1, dt / tau);
    }
    const vUp = (this.prevBodyY - bodyY) / u / dt;
    this.vUpAvg = damp(this.vUpAvg, vUp, 0.05, dt);
    this.prevBodyY = bodyY;
    this.lift = lift;
    if (!this.air && !this.crouch && lift > C.JUMP_H && this.vUpAvg > C.JUMP_VEL && t - this.lastJump > C.JUMP_GAP) {
      this.air = true; this.lastJump = t; this.maskT = t; if (this.counting) this.jumps++; this.emit('jump');
    } else if (this.air && lift < C.JUMP_H * C.LAND_K) { this.air = false; this.maskT = t; this.emit('land'); }
    if (!this.crouch && lift < -C.SQUAT_H) { this.crouch = true; this.crouchT = t; this.maskT = t; if (this.counting) this.squats++; this.emit('squat'); }
    else if (this.crouch && lift > -C.SQUAT_H * C.STAND_K) { this.crouch = false; this.maskT = t; this.emit('stand'); }

    // ---- 足ぶみ（しゃがんでいる間は 数えない） ----
    const ls2 = this.legSens;
    let raw;
    if (this.crouch) { raw = 0; this.legPhase = 0; }
    else if (this.legs) {
      const D = (lk.y - rk.y) / u;
      this.histD.push(t, D);
      const K = this.histD.range(t - C.WIN);
      let r = smoothstep(C.K_LO * ls2, C.K_HI * ls2, K);
      if (anklesOk) { const DA = (la.y - ra.y) / u; this.histA.push(t, DA); r = Math.max(r, smoothstep(C.K_LO * ls2, C.K_HI * ls2, this.histA.range(t - C.WIN) * C.ANKLE_K)); }
      raw = r;
      const side = D > C.STEP_TH ? 'L' : D < -C.STEP_TH ? 'R' : '';
      if (side && side !== this.lastSide) { this.lastSide = side; this.step(t); }
      this.legPhase = clamp(D / 0.5, -1, 1);
    } else {
      const Y = sc.y / u;
      const masked = this.air || t - this.maskT < C.SH_MASK;
      if (!masked) this.histY.push(t, Y);
      const B = this.histY.range(t - C.WIN);
      raw = masked ? this.rawPrev : smoothstep(C.B_LO * ls2, C.B_HI * ls2, B);
      if (!masked) {
        if (this.yMean == null) this.yMean = Y;
        this.yMean = damp(this.yMean, Y, 0.35, dt);
        const dev = Y - this.yMean, hy = Math.max(0.006, B * 0.2);
        if (this.yState !== 'down' && dev > hy && B > C.B_LO * ls2 && t - this.lastPeakT > C.STEP_GAP_SH) { this.yState = 'down'; this.lastPeakT = t; this.step(t); }
        else if (this.yState === 'down' && dev < -hy) this.yState = 'up';
      }
      this.legPhase = 0;
    }
    this.rawPrev = raw;
    const cad = this.stepTimes.countSince(t - C.CAD_WIN) / C.CAD_WIN;
    this.cadence = cad;
    this.stepRate = this.stepTimes.countSince(t - C.STEP_RATE_WIN) / C.STEP_RATE_WIN;
    const raw2 = this.crouch ? 0 : Math.max(raw, Math.min(1, cad / C.CAD_FULL) * C.CAD_W * (raw > 0.05 ? 1 : 0));
    const tauDown = this.crouch ? C.THR_DOWN_SQUAT : this.banzaiT > 0 ? C.THR_DOWN_BANZAI : C.THR_DOWN;
    if (raw2 > this.throttle) this.throttle = damp(this.throttle, raw2, C.THR_UP, dt);
    else if (!this.air) this.throttle = damp(this.throttle, raw2, tauDown, dt);

    // ---- 横に ずれる（4.5） ----
    if (this.baseXAcc) {
      this.baseXAcc.sum += hip.x; this.baseXAcc.n++; this.baseXAcc.t += dt;
      if (this.baseXAcc.t >= C.BASE_X_T) { this.baseX = this.baseXAcc.sum / this.baseXAcc.n; this.baseXAcc = null; }
    }
    if (this.baseX == null) this.baseX = hip.x;
    const sh = (hip.x - this.baseX) / u;
    this.shiftRaw = sh;
    this.shift = damp(this.shift, sh, C.SHIFT_SMOOTH, dt);
    if (Math.abs(this.shift) < C.BASE_X_OK && !this.baseXAcc) this.baseX = damp(this.baseX, hip.x, C.BASE_X_TAU, dt);
    const a = Math.abs(this.shift);
    this.shiftNorm = this.baseXAcc ? 0 : Math.sign(this.shift) * clamp((a - C.SHIFT_DEAD) / (this.shiftFull - C.SHIFT_DEAD), 0, 1);

    // ---- 手を あげる（片手・両手） ----
    const upL = wOk[0] && lw.y < noseY - C.HAND_UP * u, upR = wOk[1] && rw.y < noseY - C.HAND_UP * u;
    const downL = !wOk[0] || lw.y > sc.y + C.HAND_DOWN * u, downR = !wOk[1] || rw.y > sc.y + C.HAND_DOWN * u;
    if (upL && upR) {
      this.banzaiT += dt; this.handT = [0, 0];
      if (!this.banzai && this.banzaiArmed && this.banzaiT >= C.BANZAI_HOLD) { this.banzai = true; this.banzaiArmed = false; if (this.counting) this.banzais++; this.emit('banzai'); }
    } else {
      this.banzaiT = 0;
      if (this.banzai && (downL || downR)) { this.banzai = false; this.emit('banzaiEnd'); }
      if (downL && downR) this.banzaiArmed = true;
      for (const [i, up, down, other] of [[0, upL, downL, downR], [1, upR, downR, downL]]) {
        if (up && other) {
          this.handT[i] += dt;
          if (!this.handUp[i] && this.handArmed[i] && this.handT[i] >= C.HAND_HOLD) { this.handUp[i] = true; this.handArmed[i] = false; if (this.counting) this.hands++; this.emit(i ? 'handR' : 'handL'); }
        } else { this.handT[i] = 0; if (down) { this.handUp[i] = false; this.handArmed[i] = true; } }
      }
    }

    // ---- 腕ふり（4.8） ----
    if (wOk[0] && wOk[1]) {
      if (this.wristPrev) { const vy = (Math.abs(lw.y - this.wristPrev[0]) + Math.abs(rw.y - this.wristPrev[1])) / 2 / u / dt; this.swingHist.push(t, vy); }
      this.wristPrev = [lw.y, rw.y];
      const avg = this.swingHist.mean(t - C.SWING_WIN);
      this.swing = clamp((avg - C.SWING_LO) / (C.SWING_HI - C.SWING_LO), 0, 1);
    } else { this.wristPrev = null; this.swing = damp(this.swing, 0, 0.2, dt); }
    // アバターに 写す 手首（肩から、u。x は 外が 正、y は 上が 正）
    this.wristRel[0] = { ok: wOk[0], x: (ls.x - lw.x) / u, y: (ls.y - lw.y) / u };
    this.wristRel[1] = { ok: wOk[1], x: (rw.x - rs.x) / u, y: (rs.y - rw.y) / u };

    // ---- 手を 横に出す（4.9） ----
    const armOutNow = [
      wOk[0] && Math.abs(lw.y - ls.y) < C.ARM_Y * u && (ls.x - lw.x) / u > C.ARM_OUT && (ls.x - le.x) / u > C.ARM_ELBOW,
      wOk[1] && Math.abs(rw.y - rs.y) < C.ARM_Y * u && (rw.x - rs.x) / u > C.ARM_OUT && (re.x - rs.x) / u > C.ARM_ELBOW
    ];
    if (!(armOutNow[0] && armOutNow[1])) for (const i of [0, 1]) {
      if (armOutNow[i]) {
        this.armT[i] += dt;
        if (!this.armOut[i] && this.armArmed[i] && this.armT[i] >= C.ARM_HOLD && t >= this.armNext[i]) {
          this.armOut[i] = true; this.armArmed[i] = false; this.armNext[i] = t + C.LIMB_GAP; if (this.counting) this.arms++; this.emit(i ? 'armR' : 'armL');
        }
      } else {
        this.armT[i] = 0;
        const back = i ? (rw.x - rs.x) / u : (ls.x - lw.x) / u;
        if (!wOk[i] || back < C.ARM_BACK) { this.armOut[i] = false; this.armArmed[i] = true; }
      }
    } else this.armT = [0, 0];

    // ---- 足を 横に出す（4.10） ----
    if (!this.air && hipsOk) {
      const foot = [anklesOk ? la : lk, anklesOk ? ra : rk], th = anklesOk ? C.LEG_OUT : C.LEG_KNEE_OUT;
      const outL = (lh.x - foot[0].x) / u, outR = (foot[1].x - rh.x) / u;
      const legNow = [outL > th && outR < C.LEG_OTHER, outR > th && outL < C.LEG_OTHER];
      for (const i of [0, 1]) {
        if (legNow[i]) {
          this.legT[i] += dt;
          if (!this.legOut[i] && this.legArmed[i] && this.legT[i] >= C.LEG_HOLD && t >= this.legNext[i]) {
            this.legOut[i] = true; this.legArmed[i] = false; this.legNext[i] = t + C.LIMB_GAP; if (this.counting) this.legs2++; this.emit(i ? 'legR' : 'legL');
          }
        } else {
          this.legT[i] = 0;
          if ((i ? outR : outL) < C.LEG_BACK) { this.legOut[i] = false; this.legArmed[i] = true; }
        }
      }
    }
  }
  step(t) { this.stepTimes.push(t, 1); if (this.counting) this.steps++; this.emit('step'); }
  lostClock(dt) {
    this.seenT = 0; this.lostT += dt;
    if (!this.isLost && this.lostT >= C.LOST_T) { this.isLost = true; this.rebaseY(); this.emit('lost'); }
  }
  foundClock(dt) {
    this.lostT = 0; this.seenT += dt;
    if (this.isLost && this.seenT >= C.FOUND_T) { this.isLost = false; this.emit('found'); }
  }
}

// ================= 読みとりの 世話役（F.3） =================
export const Detector = {
  pose: null, video: null, numPoses: 1, players: [new BodyState(0), new BodyState(1)],
  lastX: [null, null], cost: 0, every: 0, nextAt: 0, lastVT: -1, lastT: 0, mode: 'off',
  async start(video, say = () => {}, numPoses = 1) {
    this.video = video;
    if (!this.pose) {
      say('うごきを 見る じゅんび中…（はじめは すこし かかります）');
      let err = null, where = '';
      for (let n = 0; n < 2 && !this.pose; n++) {
        try {
          where = 'プログラム';
          const { PoseLandmarker, FilesetResolver } = await import(`${MP_URL}/vision_bundle.mjs`);
          where = 'wasm';
          const files = await FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
          where = 'モデル';
          const make = delegate => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numPoses, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
          try { this.pose = await make('GPU'); } catch (e) { this.pose = await make('CPU'); }
          this.numPoses = numPoses;
        } catch (e) { err = e; console.error(e); if (n === 0) say('よみこみに しっぱい。もういちど ためしています…'); }
      }
      if (!this.pose) { say(`うごきを 見る しくみを よみこめませんでした。もういちど「カメラで あそぶ」を おすか、Safari や Chrome で ひらいてね。［${where}：${String((err && err.message) || err).slice(0, 90)}］`); return false; }
    }
    say('');
    this.mode = 'cam';
    this.players.forEach(p => p.reset());
    return true;
  },
  async setNum(n) {
    if (n !== this.numPoses) this.players.forEach(p => p.rebaseY());
    if (n === this.numPoses || !this.pose) { this.numPoses = n; return; }
    this.numPoses = n; this.lastX = [null, null];
    try { await this.pose.setOptions({ numPoses: n }); } catch (e) { console.warn(e); }
  },
  // 毎コマ（main から）。読みとりは 重いので 間引く（5.3）
  tick(ts) {
    const v = this.video;
    if (this.mode !== 'cam' || !this.pose || !v || v.readyState < 2) return false;
    if (v.currentTime === this.lastVT || ts < this.nextAt) return false;
    const now = ts / 1000, dt = this.lastT ? Math.min(0.2, now - this.lastT) : 0.033;
    this.lastVT = v.currentTime; this.lastT = now;
    let res = null;
    const t0 = performance.now();
    try { res = this.pose.detectForVideo(v, ts); } catch (e) { return false; }
    this.cost += (performance.now() - t0 - this.cost) * 0.2;
    this.every += ((dt * 1000) - this.every) * 0.2;
    this.nextAt = ts + Math.min(C.MAX_GAP, this.cost * C.COST_K);
    const asp = (v.videoWidth || 640) / (v.videoHeight || 480);
    this.feedAll((res && res.landmarks) || [], dt, now, asp);
    return true;
  },
  feedAll(L, dt, now, asp = 4 / 3) {
    const assigned = this.assign(L);
    for (let i = 0; i < this.numPoses; i++) {
      const P = this.players[i]; P.asp = asp;
      // 前の コマと 腰の 位置が 大きく ちがう ＝ 別の 人に 入れかわった
      if (assigned[i] && P.lm && P.seen) { const hx = lm => (lm[23].x + lm[24].x) / 2; if (Math.abs(hx(assigned[i]) - hx(P.lm)) > C.SWAP_JUMP) P.rebaseY(); }
      if (assigned[i]) P.feed(assigned[i], dt, now); else P.feedNone(dt);
    }
  },
  // 2人の 割りあて（5.4）：鏡の x の 小さい方が P1
  assign(L) {
    if (this.numPoses === 1) return [L[0] || null];
    const hx = lm => 1 - (lm[23].x + lm[24].x) / 2;
    const items = L.slice(0, 2).map(lm => ({ lm, x: hx(lm) })).sort((a, b) => a.x - b.x);
    let out = [null, null];
    if (items.length === 2) {
      out = [items[0].lm, items[1].lm];
      const [p0, p1] = this.lastX;
      if (p0 != null && p1 != null && Math.abs(items[0].x - items[1].x) < C.ASSIGN_HYST) {
        const keep = Math.abs(items[0].x - p0) + Math.abs(items[1].x - p1) <= Math.abs(items[0].x - p1) + Math.abs(items[1].x - p0);
        if (!keep) out = [items[1].lm, items[0].lm];
      }
    } else if (items.length === 1) {
      const [p0, p1] = this.lastX, x = items[0].x;
      const toP2 = p0 != null && p1 != null ? Math.abs(x - p1) < Math.abs(x - p0) : x > 0.5;
      out = toP2 ? [null, items[0].lm] : [items[0].lm, null];
    }
    this.lastX = out.map((lm, i) => lm ? hx(lm) : this.lastX[i]);
    return out;
  }
};

// ================= 合成した 姿勢（付録A） =================
const BASE = [];
(() => {
  const set = (i, x, y) => { BASE[i] = { x, y }; };
  set(0, 0.5, 0.23);
  for (let i = 1; i <= 10; i++) set(i, 0.5 + ((i % 2) ? -0.015 : 0.015) * Math.ceil(i / 2) * 0.5, 0.21 + (i > 8 ? 0.04 : 0));
  set(11, 0.58, 0.33); set(12, 0.42, 0.33); set(13, 0.6, 0.44); set(14, 0.4, 0.44); set(15, 0.56, 0.47); set(16, 0.44, 0.47);
  for (let i = 17; i <= 22; i++) set(i, i % 2 ? 0.565 : 0.435, 0.48);
  set(23, 0.555, 0.56); set(24, 0.445, 0.56); set(25, 0.555, 0.72); set(26, 0.445, 0.72); set(27, 0.555, 0.88); set(28, 0.445, 0.88);
  set(29, 0.555, 0.89); set(30, 0.445, 0.89); set(31, 0.56, 0.9); set(32, 0.44, 0.9);
})();
// spec：{ run:{f,a,b}, jump:{h,T,t0}, squat, squatT, banzai, banzaiT, hand:'L'|'R', handT, armOut, armT, legOut, legT, shift, swing:{f,a}, hide:[], scale, offX, jitter }
export function synthPose(spec = {}, t = 0) {
  const u = 0.16;
  const lm = BASE.map(p => ({ x: p.x, y: p.y, visibility: 0.95 }));
  const cx = 0.5, cy = 0.33;
  // 画像の 座標：人の 左（11, 13, 15, 23…）は 画像の 右（x 大）。外へ ＝ 左は x が ふえる、右は へる
  const side = s => s === 'L' ? { w: 15, e: 13, s: 11, hip: 23, k: 25, a: 27, dir: 1 } : { w: 16, e: 14, s: 12, hip: 24, k: 26, a: 28, dir: -1 };
  const ramp = (t0, len = 0.1) => t0 == null ? 1 : clamp((t - t0) / len, 0, 1);
  if (spec.run) {
    const { f = 2, a = 0.4, b = 0.08 } = spec.run, ph = Math.PI * f * t;
    lm[25].y -= a * u * Math.max(0, Math.sin(ph)); lm[26].y -= a * u * Math.max(0, -Math.sin(ph));
    lm[27].y -= a * u * 0.8 * Math.max(0, Math.sin(ph)); lm[28].y -= a * u * 0.8 * Math.max(0, -Math.sin(ph));
    const bob = b * u * Math.abs(Math.sin(ph)) - b * u / 2;
    for (let i = 0; i <= 24; i++) lm[i].y -= bob;
    // ふつうの 腕の ふり（小さく）
    const sw = Math.sin(ph) * 0.12 * u; lm[15].y += sw; lm[16].y -= sw;
  }
  if (spec.swing) {
    const { f = 2.5, a = 0.6 } = spec.swing, sw = Math.sin(2 * Math.PI * f * t) * a * u;
    lm[15].y += sw; lm[16].y -= sw; lm[13].y += sw * 0.5; lm[14].y -= sw * 0.5;
  }
  if (spec.hand) {
    const S = side(spec.hand), k = ramp(spec.handT);
    lm[S.w].x = lerp(lm[S.w].x, lm[S.s].x + S.dir * 0.05 * u, k); lm[S.w].y = lerp(lm[S.w].y, lm[0].y - 0.6 * u, k);
    lm[S.e].x = (lm[S.s].x + lm[S.w].x) / 2; lm[S.e].y = (lm[S.s].y + lm[S.w].y) / 2;
  }
  if (spec.armOut) {
    const S = side(spec.armOut), k = ramp(spec.armT);
    lm[S.w].x = lerp(lm[S.w].x, lm[S.s].x + S.dir * 1.35 * u, k); lm[S.w].y = lerp(lm[S.w].y, lm[S.s].y + 0.05 * u, k);
    lm[S.e].x = lerp(lm[S.e].x, lm[S.s].x + S.dir * 0.7 * u, k); lm[S.e].y = lerp(lm[S.e].y, lm[S.s].y + 0.02 * u, k);
  }
  if (spec.legOut) {
    const S = side(spec.legOut), k = ramp(spec.legT);
    lm[S.a].x = lerp(lm[S.a].x, lm[S.hip].x + S.dir * 1.05 * u, k); lm[S.a].y = lerp(lm[S.a].y, lm[S.a].y - 0.25 * u, k);
    lm[S.k].x = lerp(lm[S.k].x, lm[S.hip].x + S.dir * 0.5 * u, k);
    for (const i of [S.a + 2, S.a + 4]) { lm[i].x = lm[S.a].x; lm[i].y = lm[S.a].y + 0.01; }
  }
  if (spec.jump) { const { h = 0.4, T = 0.35, t0 = 0 } = spec.jump, tt = t - t0; if (tt >= 0 && tt <= T) { const k = h * u * Math.sin(Math.PI * tt / T); for (const p of lm) p.y -= k; } }
  if (spec.squat) { const q = spec.squat * u, k = spec.squatT != null ? clamp((t - spec.squatT) / 0.15, 0, 1) : 1; for (let i = 0; i <= 24; i++) lm[i].y += q * k; lm[25].y += q * 0.3 * k; lm[26].y += q * 0.3 * k; }
  if (spec.banzai) {
    const k = ramp(spec.banzaiT);
    for (const [w, s, sgn] of [[15, 11, 1], [16, 12, -1]]) {
      const tx = lm[s].x + sgn * 0.1 * u, ty = lm[0].y - 0.6 * u;
      lm[w].x = lerp(lm[w].x, tx, k); lm[w].y = lerp(lm[w].y, ty, k);
      lm[w - 2].x = (lm[s].x + lm[w].x) / 2; lm[w - 2].y = (lm[s].y + lm[w].y) / 2;
    }
  }
  // 横に ずれる（右が正 → 画像の x は へる）
  if (spec.shift) { const k = spec.shiftT != null ? ramp(spec.shiftT, 0.3) : 1; for (const p of lm) p.x -= spec.shift * u * k; }
  for (const i of spec.hide || []) lm[i].visibility = 0.1;
  const j = (spec.jitter ?? 0.01) * u;
  lm.forEach((p, i) => { p.x += Math.sin(t * 13.1 + i * 1.7) * j; p.y += Math.cos(t * 11.3 + i * 2.3) * j; });
  if (spec.scale) for (const p of lm) { p.x = cx + (p.x - cx) * spec.scale; p.y = cy + (p.y - cy) * spec.scale; }
  if (spec.offX) for (const p of lm) p.x += spec.offX;
  return lm;
}
// 2人（左右に 並べる）。鏡に 直したあと 左に 来るのは 画像の 右の人。P1 は 画像の 右（offX +0.22）
export function synthTwo(a = {}, b = {}, t = 0) {
  return [synthPose({ scale: 0.8, ...a, offX: 0.22 + (a.offX || 0) }, t), synthPose({ scale: 0.8, ...b, offX: -0.22 + (b.offX || 0) }, t)];
}

// ================= 鏡（5.7） =================
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
// players：表示する BodyState の 配列（1〜2）
export function drawMirror(cv, video, players, { two = false, w = 640 } = {}) {
  const asp = (players[0] && players[0].asp) || 4 / 3;
  const h = Math.round(w / asp);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const c = cv.getContext('2d');
  if (video && video.readyState >= 2) { c.save(); c.translate(w, 0); c.scale(-1, 1); c.drawImage(video, 0, 0, w, h); c.restore(); }
  else { c.fillStyle = '#0b1630'; c.fillRect(0, 0, w, h); }
  players.forEach((B, k) => {
    const lm = B && B.lm; if (!lm) return;
    const flip = B.swap;
    const P = i => ({ x: (flip ? lm[i].x : 1 - lm[i].x) * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
    const col = two ? (k ? '#3fa9f5' : '#ff7a2f') : '#ffffff';
    c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = w * 0.012;
    const line = (a, b) => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); };
    const dot = (p, r, cc) => { c.fillStyle = cc; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); };
    for (const [a, b] of BONES) { const p = P(a), q = P(b); if (p.v > 0.4 && q.v > 0.4) line(p, q); }
    if (P(15).v > 0.4) dot(P(15), w * 0.032, B.handUp && B.handUp[0] ? '#ffd54a' : '#3fa9f5');
    if (P(16).v > 0.4) dot(P(16), w * 0.032, B.handUp && B.handUp[1] ? '#ffd54a' : '#ff5a5a');
    for (const i of [27, 28]) if (P(i).v > 0.4) dot(P(i), w * 0.022, '#7ee081');
    if (two) {
      const n = P(0);
      c.font = `800 ${Math.round(w * 0.06)}px 'M PLUS Rounded 1c', sans-serif`; c.textAlign = 'center';
      c.lineWidth = w * 0.012; c.strokeStyle = '#1d2b53'; c.strokeText(k ? '2P' : '1P', n.x, n.y - w * 0.06);
      c.fillStyle = col; c.fillText(k ? '2P' : '1P', n.x, n.y - w * 0.06);
    }
  });
}
