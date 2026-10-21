// 体・キーボード・タッチを 1つの 入力に まとめる（4.7、4.9）
import { CFG } from './config.js';
import { clamp, damp } from './util.js';

const K = CFG.keys, MN = CFG.menu;

export const Input = {
  body: null,           // Body（カメラのとき）
  throttle: 0, steer: 0, crouch: false, banzaiHeld: false, legPhase: null,
  queue: [],            // 'jump' 'banzai' 'menuL' 'menuR' 'ok' 'back' 'pause'
  override: null,       // dbg.input
  keys: new Set(),
  kThr: 0, kTap: 0, kSteer: 0, touchSteer: 0, touchPedal: 0, touchHold: false,
  steps: 0,             // カメラなしの 歩数（数えるだけ）
  menu: { armed: true, rep: 0, holdOk: 0, holdBack: 0, lock: 0, dir: 0 },
  enabled: true,

  init() {
    addEventListener('keydown', e => {
      if (e.repeat) { if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault(); this.keys.add(e.code); return; }
      this.keys.add(e.code);
      const c = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
      if (c === 'Space') { this.kTap = Math.min(1.2, this.kTap + K.TAP_ADD); this.steps++; this.queue.push('tap'); }
      if (c === 'KeyJ') this.queue.push('jump');
      if (c === 'KeyB') this.queue.push('banzai');
      if (c === 'Enter') { this.queue.push('banzai'); this.queue.push('ok'); }
      if (c === 'Escape') { this.queue.push('back'); this.queue.push('pause'); }
      if (c === 'KeyP') this.queue.push('pause');
      if (c === 'ArrowLeft' || c === 'KeyA') this.queue.push('menuL');
      if (c === 'ArrowRight' || c === 'KeyD') this.queue.push('menuR');
      if (c === 'ArrowUp' || c === 'KeyW') this.queue.push('menuL');
      if (c === 'ArrowDown') this.queue.push('menuR');
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // タッチ
    const tb = (id, down, up) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('on'); el.setPointerCapture(e.pointerId); down(); });
      const end = e => { el.classList.remove('on'); up && up(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    };
    tb('tL', () => this.touchSteer = 1, () => this.touchSteer = 0);
    tb('tR', () => this.touchSteer = -1, () => this.touchSteer = 0);
    tb('tPedal', () => { this.kTap = Math.min(1.2, this.kTap + K.TAP_ADD); this.touchHold = true; this.holdT = 0; this.steps++; }, () => this.touchHold = false);
    tb('tJump', () => this.queue.push('jump'));
    tb('tSquat', () => this.touchSquat = true, () => this.touchSquat = false);
    tb('tTurbo', () => this.queue.push('banzai'));
  },
  has(c) { return this.keys.has(c); },
  take(name) { const i = this.queue.indexOf(name); if (i < 0) return false; this.queue.splice(i, 1); return true; },
  clear() { this.queue.length = 0; },

  // 毎コマ（race のとき menu = false）
  update(dt, menu = false) {
    // キーボード
    const up = this.has('ArrowUp') || this.has('KeyW');
    this.kThr = up ? Math.min(1, this.kThr + dt / K.THR_RISE) : Math.max(0, this.kThr - dt / K.THR_RISE);
    this.kTap = damp(this.kTap, 0, K.TAP_FALL, dt);
    if (this.touchHold) { this.holdT = (this.holdT || 0) + dt; this.kTap = Math.max(this.kTap, K.TOUCH_THR); }
    if (up) { this.holdSteps = (this.holdSteps || 0) + dt * K.HOLD_STEPS; if (this.holdSteps >= 1) { this.holdSteps -= 1; this.steps++; } }
    const L = this.has('ArrowLeft') || this.has('KeyA') ? 1 : 0, R = this.has('ArrowRight') || this.has('KeyD') ? 1 : 0;
    const want = (L - R) || this.touchSteer;
    if (want) this.kSteer = clamp(this.kSteer + Math.sign(want) * dt / K.STEER_RISE, -1, 1) * (Math.sign(this.kSteer) === Math.sign(want) || this.kSteer === 0 ? 1 : 0.5);
    else this.kSteer = Math.abs(this.kSteer) < dt / K.STEER_FALL ? 0 : this.kSteer - Math.sign(this.kSteer) * dt / K.STEER_FALL;
    const kThrottle = Math.min(1, Math.max(this.kThr, this.kTap));
    const kCrouch = this.has('ArrowDown') || this.has('KeyS') || !!this.touchSquat;
    // 体
    const B = this.body && this.body.mode === 'cam' ? this.body : null;
    const bThr = B ? B.throttle : 0, bSteer = B ? B.steer : 0;
    this.throttle = Math.max(kThrottle, bThr);
    this.steer = Math.abs(this.kSteer) > Math.abs(bSteer) ? this.kSteer : bSteer;
    this.crouch = kCrouch || (B ? B.crouch : false);
    this.banzaiHeld = (B ? B.banzaiT > 0.05 : false) || this.has('KeyB') || this.has('Enter');
    this.legPhase = B && B.legs && B.throttle > 0.05 ? B.legPhase : null;
    if (this.override) {
      const o = this.override;
      if (o.throttle != null) this.throttle = o.throttle;
      if (o.steer != null) this.steer = o.steer;
      if (o.crouch != null) this.crouch = o.crouch;
      if (o.legPhase !== undefined) this.legPhase = o.legPhase;
    }
    if (menu) this.updateMenu(dt, B); else { this.menu.holdOk = 0; this.menu.holdBack = 0; }
  },
  updateMenu(dt, B) {
    const M = this.menu;
    M.lock = Math.max(0, M.lock - dt);
    if (B) {
      const s = B.steer;
      if (Math.abs(s) < MN.STEER_REL) { M.armed = true; M.rep = 0; }
      const dir = s < -MN.STEER_TH ? 1 : s > MN.STEER_TH ? -1 : 0;
      if (dir) {
        if (M.armed) { this.queue.push(dir > 0 ? 'menuR' : 'menuL'); M.armed = false; M.rep = MN.REPEAT; }
        else if ((M.rep -= dt) <= 0) { this.queue.push(dir > 0 ? 'menuR' : 'menuL'); M.rep = MN.REPEAT; }
      }
      // けってい（バンザイを つづける）
      if (B.banzaiT > 0.02 && M.lock <= 0) M.holdOk = Math.min(1, M.holdOk + dt / MN.OK_HOLD);
      else M.holdOk = Math.max(0, M.holdOk - dt / MN.HOLD_RELAX);
      if (M.holdOk >= 1) { M.holdOk = 0; M.lock = MN.OK_LOCK; this.queue.push('ok'); this.queue.push('bodyOk'); }
      // もどる（しゃがむ を つづける）
      if (B.crouch && M.lock <= 0) M.holdBack = Math.min(1, M.holdBack + dt / MN.BACK_HOLD);
      else M.holdBack = Math.max(0, M.holdBack - dt / MN.HOLD_RELAX);
      if (M.holdBack >= 1) { M.holdBack = 0; M.lock = MN.OK_LOCK; this.queue.push('back'); }
    }
  }
};
