// 入力を まとめる（体・タッチ・キーボード、2人分。第4部 4.12〜4.15、付録AB）
import { CFG } from './config.js';
import { clamp, damp } from './util.js';

const MN = CFG.menu, KC = CFG.keys, T = CFG.touch;
const KEYS = [
  { run: ['ArrowUp', 'KeyW'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], crouch: ['ArrowDown', 'KeyS'], swing: ['KeyR'],
    jump: ['Space'], banzai: ['KeyB'], handL: ['KeyQ'], handR: ['KeyE'], armL: ['KeyZ'], armR: ['KeyX'], legL: ['KeyC'], legR: ['KeyV'] },
  { run: ['Numpad8'], left: ['Numpad4'], right: ['Numpad6'], crouch: ['Numpad5'], swing: ['NumpadAdd'],
    jump: ['Numpad0'], banzai: ['Numpad1'], handL: ['Numpad7'], handR: ['Numpad9'], armL: [], armR: [], legL: [], legR: [] }
];
const now = () => performance.now() / 1000;
const interp = (map, x) => { if (x <= map[0][0]) return map[0][1]; for (let i = 1; i < map.length; i++) if (x <= map[i][0]) { const [a, va] = map[i - 1], [b, vb] = map[i]; return va + (vb - va) * (x - a) / (b - a); } return map[map.length - 1][1]; };

// ---------- プレイヤーごとの 入れ物（AB.1） ----------
class PlayerInput {
  constructor(who) { this.who = who; this.reset(); }
  reset() {
    Object.assign(this, { th: 0, shiftNorm: 0, crouch: false, bothUp: false, swing: 0, stepRate: null, cam: false, q: [],
      kTh: 0, kTap: 0, kShift: 0, kCrouch: false, kSwing: 0, tapTimes: [], lastFoot: null, tTh: 0, tCrouch: false, tSwing: 0, tShift: 0, steps: 0 });
  }
  push(ev) { this.q.push({ ev, t: now() }); }
  // 0.6秒 以内の できごとが あれば 取り出す
  took(ev) { const n = now(), i = this.q.findIndex(e => e.ev === ev && n - e.t < 0.6); if (i < 0) return false; this.q.splice(i, 1); return true; }
  has(ev) { const n = now(); return this.q.some(e => e.ev === ev && n - e.t < 0.6); }
  clearOld() { const n = now(); if (this.q.length) this.q = this.q.filter(e => n - e.t < 0.6); }
}

export const Input = {
  players: [new PlayerInput(0), new PlayerInput(1)],
  queue: [],                 // メニューの できごと：menuL menuR ok back pause tap bodyOk
  keys: new Set(),
  mode: 'key',               // cam / touch / key
  body: null,                // [BodyState, BodyState]（カメラのとき）
  race: null,                // タッチの うごきボタンが 合図を 見る
  menuWho: 0,                // メニューを 体で 動かす 人（2人の 2P えらびは 1）
  menu: { holdOk: 0, holdBack: 0, lock: 0, repL: 0, repR: 0 },
  override: null,            // dbg
  actTimes: [],

  init() {
    addEventListener('keydown', e => {
      const c = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
      if (e.repeat) { this.keys.add(c); return; }
      this.keys.add(c);
      // メニュー
      if (c === 'Enter' || c === 'NumpadEnter') this.queue.push('ok');
      if (c === 'Escape') { this.queue.push('back'); this.queue.push('pause'); }
      if (c === 'KeyP') this.queue.push('pause');
      if (c === 'ArrowLeft' || c === 'KeyA' || c === 'ArrowUp' || c === 'KeyW') this.queue.push('menuL');
      if (c === 'ArrowRight' || c === 'KeyD' || c === 'ArrowDown' || c === 'KeyS') this.queue.push('menuR');
      // レースの できごと
      KEYS.forEach((K, who) => {
        const p = this.players[who];
        for (const ev of ['jump', 'banzai', 'handL', 'handR', 'armL', 'armR', 'legL', 'legR']) if (K[ev].includes(c)) p.push(ev);
        if (K.run.includes(c)) { p.kTap = Math.min(0.4, p.kTap + KC.TAP_ADD); p.steps++; }
      });
      if (c === 'Space') this.queue.push('tap');
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.initTouch();
  },
  take(name) { const i = this.queue.indexOf(name); if (i < 0) return false; this.queue.splice(i, 1); return true; },
  clear() { this.queue.length = 0; this.players.forEach(p => { p.q = []; p.tapTimes = []; p.tTh = 0; p.tCrouch = false; }); },
  anyKey(list) { return list.some(k => this.keys.has(k)); },

  // ---------- タッチ（AB.3） ----------
  initTouch() {
    const bind = (id, down, up) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (_) {} down(e); });
      const end = () => { el.classList.remove('on'); up && up(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    };
    const p = this.players[0];
    bind('tFootL', () => this.tapFoot(p, 'L'));
    bind('tFootR', () => this.tapFoot(p, 'R'));
    bind('tAct', () => this.tapAct(p, true), () => this.tapAct(p, false));
    bind('tJamaArm', () => this.tapJama(p, 'arm'));
    bind('tJamaLeg', () => this.tapJama(p, 'leg'));
    // 画面を 横に なぞる（40px で いっぱい）
    let sx = null;
    const gl = document.getElementById('gl');
    if (gl) {
      gl.addEventListener('pointerdown', e => { if (this.mode === 'touch') sx = e.clientX; });
      gl.addEventListener('pointermove', e => { if (sx != null) p.tShift = clamp((e.clientX - sx) / T.SWIPE_PX, -1, 1); });
      const end = () => { sx = null; p.tShift = 0; };
      gl.addEventListener('pointerup', end); gl.addEventListener('pointercancel', end);
    }
  },
  tapFoot(p, foot) {
    p.tapTimes.push({ t: now(), w: foot === p.lastFoot ? T.SAME_FOOT : 1 }); p.lastFoot = foot; p.steps++;
    this.onFoot && this.onFoot(foot);
  },
  // うごきボタン：いまの 合図に 合わせた 動き（4.13.2）
  actKind() {
    const r = this.race; if (!r) return 'jump';
    const me = r.players[0];
    const jw = r.jama && r.jama.windFor ? r.jama.windFor(me) : null;
    if (jw) return jw.kind === 'arm' ? 'crouch' : 'jump';
    const cue = r.cueOf(me);
    if (cue) return cue.base === 'dodge' ? (cue.side === 'R' ? 'dodgeR' : 'dodgeL') : cue.base === 'hand' ? (cue.side === 'R' ? 'handR' : 'handL') : cue.base;
    if (r.inFinal(me.s)) return 'spurt';
    return 'jump';
  },
  tapAct(p, down) {
    const kind = this.actKind();
    if (kind === 'crouch') { p.tCrouch = down; return; }
    if (!down) return;
    if (kind === 'spurt') { this.actTimes.push(now()); return; }
    p.push(kind);
  },
  // じゃまボタン：横に いる ライバルの がわへ
  tapJama(p, kind) {
    const r = this.race; if (!r || !r.jama) return;
    const me = r.players[0];
    const side = r.jama.sideOf(me, 1) ? 1 : r.jama.sideOf(me, -1) ? -1 : 0;
    if (!side) { p.push(kind + 'R'); return; }
    p.push(kind + (side > 0 ? 'R' : 'L'));
  },
  touchUpdate(p, dt) {
    const n = now();
    p.tapTimes = p.tapTimes.filter(x => n - x.t < T.TAP_WIN);
    const rate = p.tapTimes.reduce((a, x) => a + x.w, 0) / T.TAP_WIN;
    const last = p.tapTimes.length ? n - p.tapTimes[p.tapTimes.length - 1].t : 9;
    let th = interp(T.TAP_MAP, rate);
    if (last > T.TAP_DECAY) th *= Math.max(0, 1 - (last - T.TAP_DECAY) / T.TAP_DECAY);
    p.tTh = damp(p.tTh, th, 0.15, dt);
    this.actTimes = this.actTimes.filter(x => n - x < 1);
    p.tSwing = this.actTimes.length ? clamp(this.actTimes.length / 4, 0, 1) : damp(p.tSwing, 0, 0.3, dt);
  },

  // ---------- 毎コマ（AB.2） ----------
  update(dt, menu) {
    this.menu.lock = Math.max(0, this.menu.lock - dt);
    for (const p of this.players) {
      const B = this.body && this.body[p.who];
      const cam = this.mode === 'cam' && B && B.seen;
      const th = cam ? B.throttle : 0, sh = cam ? B.shiftNorm : 0, cr = cam ? B.crouch : false, up = cam ? B.banzai || B.banzaiT > 0.05 : false, sw = cam ? B.swing : 0;
      if (B && this.mode === 'cam') for (const e of B.takeEvents()) this.fromBody(p, e.type, menu);
      // キーボード
      const K = KEYS[p.who];
      const run = this.anyKey(K.run);
      p.kTh = run ? Math.max(KC.THR, p.kTh) : damp(p.kTh, 0, 0.3, dt); p.kTap = damp(p.kTap, 0, 0.6, dt);
      p.kShift = (this.anyKey(K.right) ? 1 : 0) - (this.anyKey(K.left) ? 1 : 0);
      if (menu) p.kShift = 0;
      p.kCrouch = this.anyKey(K.crouch);
      p.kSwing = this.anyKey(K.swing) ? KC.SWING : 0;
      if (p.who === 0) this.touchUpdate(p, dt);
      // 合わせる
      p.th = clamp(Math.max(th, p.kTh + p.kTap, p.tTh), 0, 1);
      p.shiftNorm = sh !== 0 ? sh : (p.kShift || p.tShift || 0);
      p.crouch = cr || p.kCrouch || p.tCrouch;
      p.bothUp = up || this.anyKey(K.banzai);
      p.swing = Math.max(sw, p.kSwing, p.tSwing);
      p.stepRate = cam ? B.stepRate : null; p.cam = !!cam;
      if (this.override && this.override[p.who]) Object.assign(p, this.override[p.who]);
      p.clearOld();
    }
    if (menu) this.updateMenu(dt); else { this.menu.holdOk = 0; this.menu.holdBack = 0; }
  },
  fromBody(p, type, menu) {
    if (menu) {
      if (p.who !== this.menuWho) return;
      if (type === 'handR') this.queue.push('menuR');
      if (type === 'handL') this.queue.push('menuL');
      return;
    }
    if (['jump', 'banzai', 'handL', 'handR', 'armL', 'armR', 'legL', 'legR'].includes(type)) p.push(type);
  },
  // 体の メニュー操作（付録F F.4）
  updateMenu(dt) {
    const M = this.menu, B = this.mode === 'cam' && this.body ? this.body[this.menuWho] : null;
    if (!B || !B.seen) { M.holdOk = Math.max(0, M.holdOk - dt * 2); M.holdBack = Math.max(0, M.holdBack - dt * 2); return; }
    // 片手を あげたまま 0.8秒ごとに もう1つ
    for (const [i, key, ev] of [[1, 'repR', 'menuR'], [0, 'repL', 'menuL']]) {
      if (B.handUp[i] && !B.banzai) { M[key] += dt; if (M[key] > MN.HAND_REPEAT) { M[key] = 0; this.queue.push(ev); } } else M[key] = 0;
    }
    // 両手 1秒 → けってい、しゃがみ 1秒 → もどる
    if ((B.banzaiT > 0.02 || (B.handUp[0] && B.handUp[1])) && M.lock <= 0) M.holdOk = Math.min(1, M.holdOk + dt / MN.OK_HOLD);
    else M.holdOk = Math.max(0, M.holdOk - dt * 1.5);
    if (M.holdOk >= 1) { M.holdOk = 0; M.lock = 0.8; this.queue.push('ok'); this.queue.push('bodyOk'); }
    if (B.crouch && M.lock <= 0) M.holdBack = Math.min(1, M.holdBack + dt / MN.BACK_HOLD);
    else M.holdBack = Math.max(0, M.holdBack - dt * 1.5);
    if (M.holdBack >= 1) { M.holdBack = 0; M.lock = 0.8; this.queue.push('back'); }
  }
};
