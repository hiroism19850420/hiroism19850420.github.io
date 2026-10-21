// カメラと 姿勢の 読みとり（第4部・第5部・付録F）
import { CFG } from './config.js';
import { clamp, lerp, smoothstep, damp, OneEuro, History, toDeg } from './util.js';

const C = CFG.body;
const MP_VER = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const subs = {};
export const Body = {
  mode: 'off', seen: false, full: false, legs: false, hands: false, u: 0.16, cx: 0.5, cy: 0.5,
  lift: 0, throttle: 0, cadence: 0, legPhase: 0, steer: 0, steerSrc: 'none', wheelDeg: 0, rawDeg: 0, handGap: 0,
  air: false, crouch: false, banzai: false, banzaiT: 0, banzaiArmed: true, lostT: 0, seenT: 0, isLost: false,
  steps: 0, jumps: 0, squats: 0, banzais: 0, cost: 0, every: 0, lm: null, asp: 4 / 3,
  neutral: 0, legSens: 1, steerFull: 32, swap: false, counting: true,
  on(n, fn) { (subs[n] = subs[n] || []).push(fn); return this; },
  emit(n, d) { (subs[n] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } }); },
  setNeutral(deg) { this.neutral = clamp(deg, -C.NEUTRAL_MAX, C.NEUTRAL_MAX); },
  setSens(leg = 'mid', steer = 'mid', swap = false) { this.legSens = C.LEG_SENS[leg] || 1; this.steerFull = C.STEER_FULL[steer] || 32; this.swap = !!swap; },
  resetCounts() { this.steps = 0; this.jumps = 0; this.squats = 0; this.banzais = 0; },
  reset() {
    Object.assign(this, { baseY: null, prevBodyY: null, vUpAvg: 0, lastJump: -9, maskT: -9, rawPrev: 0, lastSide: '', handsLostT: 9, blendT: 0, lastHandDeg: 0,
      throttle: 0, steer: 0, air: false, crouch: false, banzai: false, banzaiT: 0, banzaiArmed: true, lostT: 0, seenT: 0, isLost: false, prevT: null, lastPeakT: -9, yMean: null, yState: 'up' });
    this.histD = new History(48); this.histA = new History(48); this.histY = new History(48); this.stepTimes = new History(32);
    this.euro = new OneEuro(C.EURO_MIN, C.EURO_BETA, C.EURO_D);
  },

  // lm：MediaPipe の 関節 33 個（鏡うつしの前）、dt：秒、t：時刻（秒）
  feed(lm, dt, t) {
    dt = clamp(dt || 0.033, 0.001, C.FEED_DT_MAX);
    if (t == null) t = performance.now() / 1000;
    const asp = this.asp;
    const P = i => { const p = lm[i]; return { x: (1 - p.x) * asp, y: p.y, v: p.visibility == null ? 1 : p.visibility }; };
    const ls = P(11), rs = P(12);
    this.lm = lm;
    this.seen = ls.v >= C.VIS_SHOULDER && rs.v >= C.VIS_SHOULDER && isFinite(ls.x) && isFinite(rs.x);
    if (!this.seen) { this.lostClock(dt); this.relaxSteer(dt); this.throttle = damp(this.throttle, 0, C.THR_DOWN, dt); this.banzaiT = 0; return; }
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
    const lw = P(15), rw = P(16);
    this.hands = lw.v >= C.VIS_WRIST && rw.v >= C.VIS_WRIST;
    const nose = P(0);
    this.full = hipsOk && this.legs;

    // 体の 高さ（ジャンプ・しゃがみ）
    const bodyY = hipsOk ? (sc.y + (lh.y + rh.y) / 2) / 2 : sc.y;
    if (this.baseY == null) { this.baseY = bodyY; this.prevBodyY = bodyY; }
    const lift = (this.baseY - bodyY) / u;
    if (lift > C.BASE_FREEZE) {
      const tau = Math.abs(lift) < C.BASE_STILL ? C.BASE_FAST : C.BASE_SLOW;
      this.baseY += (bodyY - this.baseY) * Math.min(1, dt / tau);
    }
    const vUp = (this.prevBodyY - bodyY) / u / dt;
    this.vUpAvg = damp(this.vUpAvg, vUp, 0.05, dt);
    this.prevBodyY = bodyY;
    this.lift = lift;
    if (!this.air && !this.crouch && lift > C.JUMP_H && this.vUpAvg > C.JUMP_VEL && t - this.lastJump > C.JUMP_GAP) {
      this.air = true; this.lastJump = t; this.maskT = t; if (this.counting) this.jumps++; this.emit('jump');
    } else if (this.air && lift < C.JUMP_H * C.LAND_K) { this.air = false; this.maskT = t; this.emit('land'); }
    if (!this.crouch && lift < -C.SQUAT_H) { this.crouch = true; this.maskT = t; if (this.counting) this.squats++; this.emit('squat'); }
    else if (this.crouch && lift > -C.SQUAT_H * C.STAND_K) { this.crouch = false; this.maskT = t; this.emit('stand'); }

    // こぐ
    const ls2 = this.legSens;
    let raw;
    if (this.legs) {
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
      // 肩の ゆれ：平均より 下がるたびに 1歩（ゆれの 幅に 合わせた ヒステリシス）
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
    const raw2 = Math.max(raw, Math.min(1, cad / C.CAD_FULL) * C.CAD_W * (raw > 0.05 ? 1 : 0));
    const tauDown = this.crouch ? C.THR_DOWN_SQUAT : this.banzaiT > 0 ? C.THR_DOWN_BANZAI : C.THR_DOWN;
    if (raw2 > this.throttle) this.throttle = damp(this.throttle, raw2, C.THR_UP, dt);
    else if (!this.air) this.throttle = damp(this.throttle, raw2, tauDown, dt);

    // まわす
    let deg = null, src = 'none';
    if (this.hands) {
      const gap = Math.hypot(lw.x - rw.x, lw.y - rw.y) / u;
      this.handGap = gap;
      if (gap >= C.HANDS_MIN && gap <= C.HANDS_MAX) { deg = toDeg(Math.atan2(rw.y - lw.y, rw.x - lw.x)); this.rawDeg = deg; deg -= this.neutral; src = 'hands'; }
      else if (this.steerSrc === 'hands') { deg = this.lastHandDeg; src = 'hands'; }
      this.handsLostT = 0;
    } else this.handsLostT += dt;
    if (src === 'none' && (this.handsLostT >= C.SRC_SWITCH || this.steerSrc !== 'hands')) {
      const roll = toDeg(Math.atan2(rs.y - ls.y, rs.x - ls.x));
      const shift = hipsOk ? (sc.x - (lh.x + rh.x) / 2) / u : 0;
      deg = roll * C.LEAN_ROLL_K + shift * C.LEAN_SHIFT_K;
      src = 'lean';
    } else if (src === 'none') { deg = this.lastHandDeg; src = 'hands'; }
    if (src === 'hands') this.lastHandDeg = deg;
    if (src !== this.steerSrc) { this.blendT = C.SRC_BLEND; this.blendFrom = this.steer; this.steerSrc = src; this.euro.reset(); }
    if (deg == null) this.relaxSteer(dt);
    else {
      if (this.swap) deg = -deg;
      const f = this.euro.filter(deg, t);
      this.wheelDeg = f;
      const full = this.steerFull;
      const a = Math.max(0, Math.abs(f) - C.STEER_DEAD);
      const n = Math.pow(Math.min(1, a / (full - C.STEER_DEAD)), C.STEER_POW);
      let s = -Math.sign(f) * n;
      if (this.blendT > 0) { this.blendT -= dt; s = lerp(s, this.blendFrom, Math.max(0, this.blendT / C.SRC_BLEND)); }
      this.steer = s;
    }

    // バンザイ
    const noseY = nose.v >= C.VIS_NOSE ? nose.y : sc.y - C.NOSE_FALLBACK * u;
    const up = this.hands && lw.y < noseY - C.BANZAI_UP * u && rw.y < noseY - C.BANZAI_UP * u;
    const down = !this.hands || lw.y > sc.y || rw.y > sc.y;
    if (up) {
      this.banzaiT += dt;
      if (!this.banzai && this.banzaiArmed && this.banzaiT >= C.BANZAI_HOLD) { this.banzai = true; this.banzaiArmed = false; if (this.counting) this.banzais++; this.emit('banzai'); }
    } else {
      this.banzaiT = 0;
      if (this.banzai && down) { this.banzai = false; this.emit('banzaiEnd'); }
      if (down) this.banzaiArmed = true;
    }
    this.emit('pose', this);
  },
  step(t) { this.stepTimes.push(t, 1); if (this.counting) this.steps++; this.emit('step'); },
  relaxSteer(dt) { this.steer = Math.abs(this.steer) < dt / C.STEER_RELAX ? 0 : this.steer - Math.sign(this.steer) * dt / C.STEER_RELAX; },
  lostClock(dt) {
    this.seenT = 0; this.lostT += dt;
    if (!this.isLost && this.lostT >= C.LOST_T) { this.isLost = true; this.emit('lost'); }
  },
  foundClock(dt) {
    this.lostT = 0; this.seenT += dt;
    if (this.isLost && this.seenT >= C.FOUND_T) { this.isLost = false; this.emit('found'); }
  },

  // ---------- カメラ ----------
  video: null, pose: null, lastVT: -1, lastT: 0, nextAt: 0,
  async start(video, say = () => {}) {
    this.video = video;
    this.asp = (video.videoWidth || 640) / (video.videoHeight || 480);
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
          const make = delegate => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numPoses: 1 });
          try { this.pose = await make('GPU'); } catch (e) { this.pose = await make('CPU'); }
        } catch (e) { err = e; console.error(e); if (n === 0) say('よみこみに しっぱい。もういちど ためしています…'); }
      }
      if (!this.pose) { say(`うごきを 見る しくみを よみこめませんでした。もういちど「カメラで あそぶ」を おすか、Safari や Chrome で ひらいてね。［${where}：${String((err && err.message) || err).slice(0, 90)}］`); return false; }
    }
    say('');
    this.mode = 'cam';
    this.reset();
    return true;
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
    const gap = Math.min(C.MAX_GAP, this.cost * C.COST_K);
    this.every += ((dt * 1000) - this.every) * 0.2;
    this.nextAt = ts + gap;
    this.asp = (v.videoWidth || 640) / (v.videoHeight || 480);
    const lm = res && res.landmarks && res.landmarks[0];
    if (lm) this.feed(lm, dt, now);
    else { this.lm = null; this.seen = false; this.lostClock(dt); this.relaxSteer(dt); this.throttle = damp(this.throttle, 0, C.THR_DOWN, dt); }
    return true;
  }
};
Body.reset();

// ---------- 合成した 姿勢（付録A） ----------
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
// spec：{ stand, run:{f,a,b}, wheel:度, lean:度, jump:{h,T,t0}, squat:q, banzai, hide:[], scale, jitter }
export function synthPose(spec = {}, t = 0) {
  const u = 0.16;
  const lm = BASE.map(p => ({ x: p.x, y: p.y, visibility: 0.95 }));
  const cx = 0.5, cy = 0.33;
  if (spec.wheel != null) {
    // MediaPipe の 生の座標（鏡の前）：画面の 右がわの手 ＝ x の 小さい方。θ > 0 で 鏡のあと 右がわの手が 下がる
    const th = spec.wheel * Math.PI / 180, r = 0.65 * u, hx = cx, hy = cy + 0.75 * u, ax = 1 / (spec.asp || 4 / 3);
    lm[16].x = hx - Math.cos(th) * r * ax; lm[16].y = hy + Math.sin(th) * r;
    lm[15].x = hx + Math.cos(th) * r * ax; lm[15].y = hy - Math.sin(th) * r;
    lm[14].x = (lm[12].x + lm[16].x) / 2 - 0.02; lm[14].y = (lm[12].y + lm[16].y) / 2 + 0.03;
    lm[13].x = (lm[11].x + lm[15].x) / 2 + 0.02; lm[13].y = (lm[11].y + lm[15].y) / 2 + 0.03;
  }
  if (spec.run) {
    const { f = 2, a = 0.4, b = 0.08 } = spec.run, ph = Math.PI * f * t;
    lm[25].y -= a * u * Math.max(0, Math.sin(ph)); lm[26].y -= a * u * Math.max(0, -Math.sin(ph));
    lm[27].y -= a * u * 0.8 * Math.max(0, Math.sin(ph)); lm[28].y -= a * u * 0.8 * Math.max(0, -Math.sin(ph));
    const bob = b * u * Math.abs(Math.sin(ph)) - b * u / 2;
    for (let i = 0; i <= 24; i++) lm[i].y -= bob;
  }
  if (spec.lean) {
    const a = spec.lean * Math.PI / 180;
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const asp = spec.asp || 4 / 3, dx = (lm[i].x - cx) * asp, dy = lm[i].y - cy;
      // MediaPipe の 座標で 回す（鏡のあと 右へ 傾く ＝ 生の座標で 左へ）。横は 縦横比を もどして 回す
      lm[i].x = cx + (dx * Math.cos(-a) - dy * Math.sin(-a)) / asp; lm[i].y = cy + dx * Math.sin(-a) + dy * Math.cos(-a);
    }
  }
  if (spec.jump) {
    const { h = 0.4, T = 0.35, t0 = 0 } = spec.jump, tt = t - t0;
    if (tt >= 0 && tt <= T) { const k = h * u * Math.sin(Math.PI * tt / T); for (const p of lm) p.y -= k; }
  }
  if (spec.squat) {
    const q = spec.squat * u, k = spec.squatT != null ? clamp((t - spec.squatT) / 0.15, 0, 1) : 1;
    for (let i = 0; i <= 24; i++) lm[i].y += q * k;
    lm[25].y += q * 0.3 * k; lm[26].y += q * 0.3 * k;
  }
  if (spec.banzai) {
    const k = spec.banzaiT != null ? clamp((t - spec.banzaiT) / 0.1, 0, 1) : 1;
    for (const [w, s, sgn] of [[15, 11, 1], [16, 12, -1]]) {
      const tx = lm[s].x + sgn * 0.1 * u, ty = lm[0].y - 0.6 * u;
      lm[w].x = lerp(lm[w].x, tx, k); lm[w].y = lerp(lm[w].y, ty, k);
      lm[w - 2].x = (lm[s].x + lm[w].x) / 2; lm[w - 2].y = (lm[s].y + lm[w].y) / 2;
    }
  }
  for (const i of spec.hide || []) lm[i].visibility = 0.1;
  const j = (spec.jitter ?? 0.01) * u;
  lm.forEach((p, i) => { p.x += Math.sin(t * 13.1 + i * 1.7) * j; p.y += Math.cos(t * 11.3 + i * 2.3) * j; });
  if (spec.scale) for (const p of lm) { p.x = cx + (p.x - cx) * spec.scale; p.y = cy + (p.y - cy) * spec.scale; }
  return lm;
}

// ---------- 鏡（付録W.1） ----------
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
export function drawMirror(cv, video, B) {
  const w = 640, h = Math.round(640 / (B.asp || 4 / 3));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const c = cv.getContext('2d');
  if (video && video.readyState >= 2) { c.save(); c.translate(w, 0); c.scale(-1, 1); c.drawImage(video, 0, 0, w, h); c.restore(); }
  else { c.fillStyle = '#0b1630'; c.fillRect(0, 0, w, h); }
  const lm = B.lm; if (!lm) return;
  const P = i => ({ x: (1 - lm[i].x) * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  c.lineCap = 'round'; c.strokeStyle = '#fff'; c.lineWidth = w * 0.012;
  const line = (a, b) => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); };
  const dot = (p, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); };
  for (const [a, b] of BONES) { const p = P(a), q = P(b); if (p.v > 0.4 && q.v > 0.4) line(p, q); }
  if (B.steerSrc === 'hands' && B.hands) { c.strokeStyle = '#ffd54a'; c.lineWidth = w * 0.016; line(P(15), P(16)); }
  if (P(15).v > 0.4) dot(P(15), w * 0.035, '#3fa9f5');
  if (P(16).v > 0.4) dot(P(16), w * 0.035, '#ff5a5a');
  if (B.legs) { dot(P(25), w * 0.025, '#7ee081'); dot(P(26), w * 0.025, '#7ee081'); }
}
