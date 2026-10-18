// ゲーム全体の制御（画面遷移・入力・ループ・効果音・共通描画）
'use strict';

const app = document.getElementById('app');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');
const DBG = /[?&]dbg\b/.test(location.search);


/* ---------- 画面サイズ（16:9 を保ってウィンドウに合わせる） ---------- */
let viewScale = 1;
function fit() {
  viewScale = Math.min(window.innerWidth / W, window.innerHeight / H);
  app.style.transform = `translate(-50%, -50%) scale(${viewScale})`;
  const k = Math.min(3, viewScale * (window.devicePixelRatio || 1));
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  canvas._k = canvas.width / W;
}
window.addEventListener('resize', fit);
fit();

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}

/* ---------- 入力 ---------- */
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'KeyZ', 'KeyX', 'KeyP']);
const Input = {
  down: new Set(),
  hit: new Set(),
  clicks: [],
  capture: false, // ステージ中は true：矢印・Space のブラウザ既定動作とボタン操作を止める
  isDown(...codes) { return codes.some(c => this.down.has(c)); },
  pressed(...codes) { return codes.some(c => this.hit.has(c)); },
  takeClick() { return this.clicks.shift() || null; },
  endFrame() { this.hit.clear(); this.clicks.length = 0; },
  clear() { this.down.clear(); this.hit.clear(); this.clicks.length = 0; }
};
window.addEventListener('keydown', e => {
  Sfx.init();
  if (Input.capture && GAME_KEYS.has(e.code)) {
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }
  if (Loop.paused && Loop.running()) { Loop.resume(); Input.clear(); return; }
  if (!e.repeat) Input.hit.add(e.code);
  Input.down.add(e.code);
  if (!Input.capture) Screens.onKey(e);
});
window.addEventListener('keyup', e => { Input.down.delete(e.code); });
window.addEventListener('blur', () => Input.clear());
canvas.addEventListener('pointerdown', e => {
  Sfx.init();
  if (Loop.paused && Loop.running()) { Loop.resume(); Input.clear(); return; }
  Input.clicks.push(canvasPoint(e));
});

/* ---------- ゲームループ（常に1本だけ。切り替え時に前のループは止まる） ---------- */
const Loop = {
  token: 0, raf: 0, last: 0, paused: false, active: false, pausable: false,
  run(update, draw, opts = {}) {
    this.stop();
    const my = ++this.token;
    this.active = true;
    this.pausable = !!opts.pausable;
    this.paused = false;
    this.last = performance.now();
    const tick = t => {
      if (my !== this.token) return;
      let dt = (t - this.last) / 1000;
      this.last = t;
      if (dt > 1 / 20) dt = 1 / 20;
      if (dt < 0) dt = 0;
      if (!this.paused) {
        if (this.pausable && Input.pressed('KeyP')) { this.paused = true; Input.clear(); }
        else update(dt);
        Input.endFrame();
        if (my !== this.token) return; // update 内で画面が切り替わった
      }
      ctx.setTransform(canvas._k, 0, 0, canvas._k, 0, 0);
      draw(ctx);
      if (this.paused) drawPause(ctx);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  },
  stop() {
    this.token++;
    cancelAnimationFrame(this.raf);
    this.active = false;
    this.paused = false;
  },
  running() { return this.active && this.pausable; },
  resume() { this.paused = false; this.last = performance.now(); }
};
document.addEventListener('visibilitychange', () => {
  if (Sfx.ac) { if (document.hidden) Sfx.ac.suspend(); else Sfx.ac.resume(); }
  if (document.hidden) {
    Input.clear();
    if (Loop.running()) Loop.paused = true;
  } else {
    Loop.last = performance.now();
  }
});
function drawPause(c) {
  c.fillStyle = 'rgba(255,255,255,0.82)';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#111';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `bold 34px ${FONT}`;
  c.fillText('一時停止中', W / 2, H / 2 - 18);
  c.font = `18px ${FONT}`;
  c.fillStyle = '#555';
  c.fillText('何かキーを押すか、画面をクリックすると再開します', W / 2, H / 2 + 26);
}

/* ---------- 効果音（WebAudio。素材ファイルは使わない） ---------- */
const Sfx = {
  ac: null, master: null, muted: false,
  init() {
    if (!this.ac) {
      try {
        this.ac = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ac.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ac.destination);
      } catch (e) { this.ac = null; }
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
    if (this.ac && typeof Music !== 'undefined') Music.start();
  },
  tone(freq, dur, type = 'square', vol = 0.12, slideTo = 0, delay = 0) {
    if (!this.ac || this.muted) return;
    const t0 = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol, freq, delay = 0) {
    if (!this.ac || this.muted) return;
    const t0 = this.ac.currentTime + delay;
    if (!this.nbuf) {
      this.nbuf = this.ac.createBuffer(1, this.ac.sampleRate, this.ac.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    src.buffer = this.nbuf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq / 8), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  },
  // 「ぱふぱふぱふ ぱふぁ〜〜〜」と下がっていく、間の抜けたトロンボーン
  trombone() {
    if (!this.ac || this.muted) return;
    const notes = [[392, 0.32], [370, 0.32], [349, 0.32], [330, 1.3]];
    let t = this.ac.currentTime + 0.05;
    notes.forEach(([f, d], i) => {
      const o = this.ac.createOscillator(), g = this.ac.createGain(), lp = this.ac.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      if (i === 3) {
        const lfo = this.ac.createOscillator(), lg = this.ac.createGain();
        lfo.frequency.value = 6; lg.gain.value = 9;
        lfo.connect(lg); lg.connect(o.frequency);
        lfo.start(t); lfo.stop(t + d);
        o.frequency.linearRampToValueAtTime(f * 0.94, t + d);
      }
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
      g.gain.setValueAtTime(0.16, t + d * 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(lp); lp.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + d + 0.02);
      t += d;
    });
  },
  play(name) {
    switch (name) {
      case 'boom': this.noise(0.7, 0.6, 1800); this.tone(110, 0.5, 'sine', 0.35, 35); break;
      case 'firework': this.tone(500 + Math.random() * 600, 0.25, 'sine', 0.03, 1800); this.noise(0.5, 0.18, 4000 + Math.random() * 3000, 0.22); break;
      case 'taunt': this.trombone(); break;
      case 'fanfare': [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(([f, d]) => this.tone(f, d === 0.36 ? 0.7 : 0.14, 'square', 0.08, 0, d)); [[392, 0.36], [523, 0.36]].forEach(([f, d]) => this.tone(f, 0.7, 'square', 0.05, 0, d)); break;
      case 'jump': this.tone(330, 0.14, 'square', 0.07, 660); break;
      case 'stomp': this.tone(180, 0.1, 'triangle', 0.2, 90); this.tone(500, 0.06, 'square', 0.05, 0, 0.04); break;
      case 'fail': this.tone(392, 0.18, 'square', 0.08); this.tone(311, 0.18, 'square', 0.08, 0, 0.18); this.tone(247, 0.4, 'square', 0.08, 180, 0.36); break;
      case 'clear': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'square', 0.07, 0, i * 0.1)); break;
      case 'shoot': this.tone(880, 0.06, 'square', 0.04, 440); break;
      case 'pop': this.tone(300, 0.12, 'triangle', 0.15, 60); break;
      case 'hit': this.tone(160, 0.35, 'sawtooth', 0.09, 50); break;
      case 'move': this.tone(1200, 0.025, 'square', 0.025); break;
      case 'rotate': this.tone(700, 0.04, 'square', 0.03, 900); break;
      case 'lock': this.tone(140, 0.07, 'triangle', 0.14); break;
      case 'line': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.1, 'square', 0.06, 0, i * 0.06)); break;
      case 'cursor': this.tone(990, 0.04, 'square', 0.04); break;
      case 'select': this.tone(660, 0.06, 'square', 0.05); this.tone(990, 0.08, 'square', 0.05, 0, 0.06); break;
      case 'type': this.tone(1500, 0.015, 'square', 0.012); break;
      case 'print': this.tone(2200 + Math.random() * 300, 0.02, 'square', 0.012); break;
      case 'button': this.tone(520, 0.05, 'triangle', 0.12); break;
      case 'chime': [784, 659, 523].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.08, 0, i * 0.35)); break;
      case 'tick': this.tone(1000, 0.03, 'sine', 0.06); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.06); this.tone(1319, 0.3, 'square', 0.06, 0, 0.07); break;
      case 'bump': this.tone(120, 0.08, 'triangle', 0.2); break;
    }
  }
};

/* ---------- BGM（WebAudio で鳴らすオリジナル曲。素材ファイルは使わない） ---------- */
// 1文字＝16分音符。「.」は休み、「-」は前の音をのばす
const SONGS = {
  title: { bpm: 76, lead: 'sine', vol: 0.05, bars: [
    ['C5 . E5 . G5 . E5 . C5 . E5 . G5 . E5 .', 'C3 - - - - - - - G2 - - - - - - -'],
    ['A4 . C5 . E5 . C5 . A4 . C5 . E5 . C5 .', 'A2 - - - - - - - E3 - - - - - - -'],
    ['F4 . A4 . C5 . A4 . F4 . A4 . C5 . A4 .', 'F2 - - - - - - - C3 - - - - - - -'],
    ['G4 . B4 . D5 . B4 . G4 . B4 . D5 . B4 .', 'G2 - - - - - - - D3 - - - - - - -']] },
  stage1: { bpm: 150, lead: 'square', vol: 0.035, bars: [
    ['C5 . C5 E5 . G5 . . E5 . C5 . D5 . E5 .', 'C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 .'],
    ['F5 . . E5 . D5 . . C5 . D5 . G4 . . .', 'F3 . C4 . F3 . C4 . G3 . D4 . G3 . D4 .'],
    ['C5 . C5 E5 . G5 . . A5 . G5 . E5 . C5 .', 'C3 . G3 . C3 . G3 . A2 . E3 . A2 . E3 .'],
    ['D5 . E5 . D5 . C5 . . . G4 . C5 . . .', 'G2 . D3 . G2 . D3 . C3 . G3 . C3 . . .']] },
  stage2: { bpm: 168, lead: 'sawtooth', vol: 0.03, bars: [
    ['A4 . A4 C5 . E5 . A5 . G5 . E5 . C5 . .', 'A2 A2 . A2 A3 . A2 . A2 A2 . A2 A3 . G2 .'],
    ['D5 . D5 F5 . A5 . D5 . C5 . B4 . G4 . .', 'D3 D3 . D3 D4 . D3 . G2 G2 . G2 G3 . G2 .'],
    ['A4 . A4 C5 . E5 . A5 . B5 . C6 . B5 . A5 .', 'A2 A2 . A2 A3 . A2 . A2 A2 . A2 A3 . G2 .'],
    ['G5 . E5 . C5 . B4 . A4 - - - . . . .', 'F2 F2 . F2 E2 E2 . E2 A2 A2 . A2 A3 . . .']] },
  stage3: { bpm: 132, lead: 'square', vol: 0.032, bars: [
    ['E5 . . B4 E5 . G5 . F#5 . E5 . D5 . . .', 'E3 . B3 . E3 . B3 . E3 . B3 . E3 . B3 .'],
    ['C5 . . G4 C5 . E5 . D5 . C5 . B4 . . .', 'C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 .'],
    ['A4 . C5 . E5 . A5 . G5 . F#5 . E5 . D5 .', 'A2 . E3 . A2 . E3 . A2 . E3 . A2 . E3 .'],
    ['B4 . D#5 . F#5 . B5 . A5 . F#5 . D#5 . B4 .', 'B2 . F#3 . B2 . F#3 . B2 . F#3 . B2 . F#3 .']] },
  field: { bpm: 116, lead: 'square', vol: 0.03, bars: [
    ['F4 . . . A4 . C5 . F5 . . . E5 . D5 .', 'F3 . . . C3 . . . F3 . . . C3 . . .'],
    ['C5 . . . A4 . Bb4 . C5 . . . . . . .', 'F3 . . . C3 . . . F3 . . . A3 . . .'],
    ['D5 . . . C5 . Bb4 . A4 . . . G4 . A4 .', 'Bb2 . . . F3 . . . C3 . . . G3 . . .'],
    ['Bb4 . . . A4 . G4 . F4 . . . . . . .', 'C3 . . . C3 . . . F3 . . . . . . .']] },
  battle: { bpm: 176, lead: 'square', vol: 0.032, bars: [
    ['D5 D5 . D5 F5 . D5 . C5 C5 . C5 E5 . C5 .', 'D3 D3 D3 D3 D3 D3 D3 D3 C3 C3 C3 C3 C3 C3 C3 C3'],
    ['Bb4 . D5 . F5 . Bb5 . A5 . F5 . E5 . C#5 .', 'Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 A2 A2 A2 A2 A2 A2 A2 A2'],
    ['D5 D5 . D5 F5 . D5 . C5 C5 . C5 E5 . C5 .', 'D3 D3 D3 D3 D3 D3 D3 D3 C3 C3 C3 C3 C3 C3 C3 C3'],
    ['D5 . A4 . D5 . F5 . A5 - - - . . . .', 'D3 D3 D3 D3 A2 A2 A2 A2 D3 . . . . . . .']] },
  result: { bpm: 66, lead: 'sine', vol: 0.05, bars: [
    ['A4 . . . C5 . . . E5 . . . . . . .', 'A2 - - - - - - - - - - - - - - -'],
    ['G4 . . . B4 . . . D5 . . . . . . .', 'G2 - - - - - - - - - - - - - - -'],
    ['F4 . . . A4 . . . C5 . . . . . . .', 'F2 - - - - - - - - - - - - - - -'],
    ['E4 . . . G#4 . . . B4 . . . . . . .', 'E2 - - - - - - - - - - - - - - -']] }
};

function noteFreq(n) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n);
  if (!m) return 0;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (base + (Number(m[3]) + 1) * 12 - 69) / 12);
}

// 1小節の文字列を [{i, f, len}] に（len は16分音符の数）
function parseBar(str) {
  const t = str.trim().split(/\s+/);
  const out = [];
  t.forEach((tok, i) => {
    if (tok === '.' || tok === '-') return;
    let len = 1;
    while (t[i + len] === '-') len++;
    out.push({ i, f: noteFreq(tok), len });
  });
  return out;
}

const Music = {
  muted: false,
  name: null, song: null, timer: 0, step: 0, nextTime: 0, tempo: 1, out: null,
  load() { try { this.muted = localStorage.getItem('jinsei-bgm') === 'off'; } catch (e) { /* 保存できない環境 */ } },
  play(name) {
    if (this.name === name) { this.start(); return; }
    this.stop();
    this.name = name;
    this.tempo = 1;
    this.start();
  },
  start() {
    if (!this.name || !Sfx.ac || this.timer) return;
    const def = SONGS[this.name];
    this.song = { def, lead: def.bars.map(b => parseBar(b[0])), bass: def.bars.map(b => parseBar(b[1])) };
    this.out = Sfx.ac.createGain();
    this.out.gain.value = this.muted ? 0 : 1;
    this.out.connect(Sfx.master);
    this.step = 0;
    this.nextTime = Sfx.ac.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), 40);
    this.tick();
  },
  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    this.name = null;
    this.song = null;
    if (this.out) {
      const o = this.out;
      try { o.gain.setTargetAtTime(0, Sfx.ac.currentTime, 0.05); } catch (e) { /* 止まっている */ }
      setTimeout(() => o.disconnect(), 400);
      this.out = null;
    }
  },
  voice(f, t, dur, type, vol) {
    const ac = Sfx.ac;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur * 0.7));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  },
  tick() {
    if (!this.song || !Sfx.ac || !this.out) return;
    const { def, lead, bass } = this.song;
    const per = 60 / (def.bpm * this.tempo) / 4; // 16分音符の長さ
    const total = lead.length * 16;
    if (this.nextTime < Sfx.ac.currentTime - 0.5) this.nextTime = Sfx.ac.currentTime + 0.05; // 止まっていた後
    while (this.nextTime < Sfx.ac.currentTime + 0.2) {
      const bar = Math.floor(this.step / 16) % lead.length, i = this.step % 16;
      for (const n of lead[bar]) if (n.i === i && n.f) this.voice(n.f, this.nextTime, n.len * per * 0.95, def.lead, def.vol);
      for (const n of bass[bar]) if (n.i === i && n.f) this.voice(n.f, this.nextTime, n.len * per * 0.9, 'triangle', def.vol * 2.2);
      this.nextTime += per;
      this.step = (this.step + 1) % total;
    }
  },
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('jinsei-bgm', m ? 'off' : 'on'); } catch (e) { /* 保存できない環境 */ }
    if (this.out && Sfx.ac) this.out.gain.setTargetAtTime(m ? 0 : 1, Sfx.ac.currentTime, 0.05);
    muteBtn.classList.toggle('off', m);
  }
};
Music.load();

// 右上の音のボタン（M キーでも切り替え）
const muteBtn = document.createElement('button');
muteBtn.id = 'muteBtn';
muteBtn.type = 'button';
muteBtn.title = 'BGM のオン・オフ（M キー）';
muteBtn.textContent = '♪';
muteBtn.classList.toggle('off', Music.muted);
muteBtn.addEventListener('pointerdown', e => e.stopPropagation());
muteBtn.addEventListener('click', e => { e.stopPropagation(); Sfx.init(); Music.setMuted(!Music.muted); muteBtn.blur(); });
app.appendChild(muteBtn);
window.addEventListener('keydown', e => {
  if (e.code === 'KeyM' && !e.repeat && !(e.target && e.target.tagName === 'INPUT')) Music.setMuted(!Music.muted);
});

/* ---------- 大げさなエフェクト（爆発・花火・煽り） ---------- */
// 座標はすべて画面の座標（960×540）
const FIRE = ['#fff3a0', '#ffd23a', '#ff9a2a', '#ff4a2a', '#d02020'];
const FW_COLORS = ['#ff4a6a', '#ffd23a', '#4ae0ff', '#7aff6a', '#d07aff', '#ffffff', '#ff9a2a'];
const Fx = {
  parts: [], rings: [], texts: [], shakeT: 0, shakeMag: 0, flashA: 0, flashColor: '#fff', fwT: 0, fwNext: 0,
  clear() { this.parts = []; this.rings = []; this.texts = []; this.shakeT = 0; this.flashA = 0; this.fwT = 0; },
  shake(mag, dur) { this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, dur); },
  flash(a, color = '#fff') { this.flashA = Math.max(this.flashA, a); this.flashColor = color; },
  burst(x, y, n, colors, speed, life, size, grav = 300) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.4), max: life, color: colors[i % colors.length], size: size * (0.6 + Math.random() * 0.8), grav });
    }
  },
  // 敵を倒したときの爆発
  explode(x, y, k = 1, word = 'ドカーン！') {
    this.burst(x, y, Math.round(40 * k), FIRE, 420 * k, 0.8, 7 * k, 200);
    this.burst(x, y, Math.round(14 * k), ['#555', '#777', '#999'], 160 * k, 1.2, 14 * k, -40);
    this.rings.push({ x, y, r: 10, max: 120 * k, life: 0.45, t: 0, color: '#fff3a0' });
    this.rings.push({ x, y, r: 6, max: 80 * k, life: 0.35, t: 0, color: '#ff4a2a' });
    this.shake(10 * k, 0.35);
    this.flash(0.35 * Math.min(1, k));
    if (word) this.texts.push({ kind: 'pop', text: word, x, y: y - 30, t: 0, dur: 0.9 });
    Sfx.play('boom');
  },
  // 花火（dur 秒のあいだ打ち上げ続ける）
  fireworks(dur) { this.fwT = Math.max(this.fwT, dur); this.fwNext = 0; },
  firework(x, y) {
    const c1 = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)], c2 = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
    this.burst(x, y, 70, [c1, c1, c2, '#fff'], 380, 1.4, 4, 120);
    this.rings.push({ x, y, r: 8, max: 150, life: 0.5, t: 0, color: c1 });
    this.flash(0.12, c1);
    Sfx.play('firework');
  },
  // 失敗したときの煽り
  taunt(sub) {
    Music.stop();
    this.texts.push({ kind: 'taunt', text: '残念でしたあああああ', sub, t: 0, dur: 99 });
    this.shake(6, 0.5);
    Sfx.play('taunt');
  },
  // 成功したときの大きな文字
  big(text, color = '#ffd23a', dur = 99) {
    this.texts.push({ kind: 'big', text, color, t: 0, dur });
    Sfx.play('fanfare');
  },
  update(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (!this.shakeT) this.shakeMag = 0;
    this.flashA = Math.max(0, this.flashA - dt * 2.5);
    if (this.fwT > 0) {
      this.fwT -= dt;
      this.fwNext -= dt;
      while (this.fwNext <= 0) {
        this.firework(80 + Math.random() * (W - 160), 60 + Math.random() * 260);
        this.fwNext += 0.08 + Math.random() * 0.18;
      }
    }
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - dt * 1.2;
      p.vy *= 1 - dt * 0.6;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    if (this.parts.length > 1500) this.parts.splice(0, this.parts.length - 1500);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.life);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < t.dur);
  },
  offset() {
    if (!this.shakeT) return [0, 0];
    const m = this.shakeMag * Math.min(1, this.shakeT * 4);
    return [(Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m];
  },
  outlined(c, text, x, y, fill, lw) {
    c.lineJoin = 'round';
    c.strokeStyle = '#000';
    c.lineWidth = lw;
    c.strokeText(text, x, y);
    c.fillStyle = fill;
    c.fillText(text, x, y);
  },
  draw(c) {
    c.save();
    // 明るい背景でも色が飛ばないよう、ふつうの重ね方にする
    for (const p of this.parts) {
      c.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5));
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + p.life / p.max * 0.6), 0, Math.PI * 2); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    for (const r of this.rings) {
      const k = r.t / r.life;
      c.globalAlpha = 1 - k;
      c.strokeStyle = r.color;
      c.lineWidth = 8 * (1 - k) + 1;
      c.beginPath(); c.arc(r.x, r.y, r.r + (r.max - r.r) * k, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
    c.restore();
    if (this.flashA > 0) {
      c.fillStyle = this.flashColor;
      c.globalAlpha = this.flashA;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const t of this.texts) {
      if (t.kind === 'pop') {
        const k = Math.min(1, t.t / 0.15), s = 0.5 + k * 0.7 - Math.max(0, t.t - 0.6) * 1.5;
        c.save();
        c.translate(t.x, t.y - t.t * 40);
        c.rotate(-0.15);
        c.scale(s, s);
        c.font = `900 34px ${FONT}`;
        c.globalAlpha = Math.max(0, 1 - Math.max(0, t.t - 0.6) / 0.3);
        this.outlined(c, t.text, 0, 0, '#ffd23a', 7);
        c.restore();
      } else if (t.kind === 'taunt') {
        c.fillStyle = `rgba(0,0,0,${Math.min(0.45, t.t)})`;
        c.fillRect(0, 0, W, H);
        const chars = [...t.text];
        c.font = `900 62px ${FONT}`;
        const total = c.measureText(t.text).width;
        let x = W / 2 - total / 2;
        chars.forEach((ch, i) => {
          const w = c.measureText(ch).width;
          const appear = Math.min(1, Math.max(0, (t.t - i * 0.06) / 0.12));
          if (appear <= 0) { x += w; return; }
          const bob = Math.sin(t.t * 9 + i * 0.7) * 10;
          c.save();
          c.translate(x + w / 2, H / 2 - 30 + bob);
          c.rotate(Math.sin(t.t * 7 + i) * 0.12);
          c.scale(appear * (1 + Math.sin(t.t * 12 + i) * 0.06), appear);
          this.outlined(c, ch, 0, 0, i % 2 ? '#ff5a5a' : '#ff2a6a', 9);
          c.restore();
          x += w;
        });
        if (t.sub && t.t > 0.9) {
          c.font = `800 28px ${FONT}`;
          c.globalAlpha = Math.min(1, (t.t - 0.9) * 3);
          this.outlined(c, t.sub, W / 2 + Math.sin(t.t * 5) * 8, H / 2 + 50, '#fff', 6);
          c.globalAlpha = 1;
        }
      } else if (t.kind === 'big') {
        const k = Math.min(1, t.t / 0.35);
        const s = (3 - 2 * (1 - Math.pow(1 - k, 3))) * (1 + Math.sin(t.t * 6) * 0.04);
        c.save();
        c.translate(W / 2, H / 2 - 40);
        c.rotate((1 - k) * -0.6 + Math.sin(t.t * 3) * 0.03);
        c.scale(s, s);
        c.font = `900 66px ${FONT}`;
        c.globalAlpha = k;
        this.outlined(c, t.text, 0, 0, t.color, 10);
        c.restore();
      }
    }
  }
};

/* ---------- 共通描画：黒い棒人間 ---------- */
// (x, y) は足元。h は身長。pose: stand / walk / jump / cheer / down
function drawStick(c, x, y, h, o = {}) {
  const f = o.facing === -1 ? -1 : 1;
  const lw = o.lw || Math.max(2.5, h * 0.062);
  const color = o.color || '#111';
  const headR = h * 0.13;
  const hipY = y - h * 0.47;
  const shY = y - h * 0.74;
  const neckY = y - h * 0.79;
  const ph = o.phase || 0;
  const pose = o.pose || 'stand';
  const thigh = h * 0.24, shin = h * 0.24, upper = h * 0.17, lower = h * 0.16;

  let L1 = [0.17, 0.15], L2 = [-0.17, -0.15], A1 = [0.3, 0.14], A2 = [-0.3, -0.14];
  if (pose === 'walk') {
    const s = Math.sin(ph);
    L1 = [s * 0.55, s * 0.55 - Math.max(0, -s) * 0.5];
    L2 = [-s * 0.55, -s * 0.55 - Math.max(0, s) * 0.5];
    A1 = [-s * 0.5, -s * 0.5 + 0.3];
    A2 = [s * 0.5, s * 0.5 + 0.3];
  } else if (pose === 'jump') {
    L1 = [0.75, -0.25]; L2 = [-0.25, 0.3];
    A1 = [2.5, 2.7]; A2 = [-0.9, -0.5];
  } else if (pose === 'cheer') {
    L1 = [0.15, 0.15]; L2 = [-0.15, -0.15];
    A1 = [2.6, 2.9]; A2 = [-2.6, -2.9];
  } else if (pose === 'sword') {
    L1 = [0.22, 0.12]; L2 = [-0.18, -0.08];
    A1 = [1.25, 1.6]; A2 = [-0.25, -0.1];
  }

  c.save();
  c.translate(x, y);
  if (o.rot) { c.translate(0, -h * 0.45); c.rotate(o.rot); c.translate(0, h * 0.45); }
  c.translate(-x, -y);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const limb = (x0, y0, a1, l1, a2, l2) => {
    const x1 = x0 + Math.sin(a1) * l1 * f, y1 = y0 + Math.cos(a1) * l1;
    const x2 = x1 + Math.sin(a2) * l2 * f, y2 = y1 + Math.cos(a2) * l2;
    c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2);
    return [x2, y2];
  };
  c.beginPath();
  c.moveTo(x, neckY); c.lineTo(x, hipY);
  limb(x, hipY, L1[0], thigh, L1[1], shin);
  limb(x, hipY, L2[0], thigh, L2[1], shin);
  const hand = limb(x, shY, A1[0], upper, A1[1], lower);
  limb(x, shY, A2[0], upper, A2[1], lower);
  c.stroke();
  c.beginPath();
  c.arc(x, neckY - headR * 1.15, headR, 0, Math.PI * 2);
  c.fill();
  if (o.sword) {
    c.lineWidth = lw * 0.8;
    c.beginPath();
    c.moveTo(hand[0], hand[1]);
    c.lineTo(hand[0] + f * h * 0.42, hand[1] - h * 0.18);
    c.stroke();
    c.beginPath();
    c.moveTo(hand[0] + f * h * 0.04 - h * 0.05, hand[1] - h * 0.08);
    c.lineTo(hand[0] + f * h * 0.04 + h * 0.05, hand[1] + h * 0.08);
    c.stroke();
  }
  if (o.hat === 'helmet') {
    c.beginPath();
    c.arc(x, neckY - headR * 1.15, headR * 1.25, Math.PI, 0);
    c.fill();
    c.fillRect(x - headR * 0.15, neckY - headR * 3.1, headR * 0.3, headR * 0.8);
  } else if (o.hat === 'wizard') {
    c.beginPath();
    c.moveTo(x - headR * 1.6, neckY - headR * 1.7);
    c.lineTo(x + headR * 1.6, neckY - headR * 1.7);
    c.lineTo(x - f * headR * 0.8, neckY - headR * 4.6);
    c.closePath();
    c.fill();
  } else if (o.hat === 'straw') {
    c.beginPath();
    c.moveTo(x - headR * 2.2, neckY - headR * 1.5);
    c.lineTo(x + headR * 2.2, neckY - headR * 1.5);
    c.lineTo(x + headR * 0.9, neckY - headR * 2.8);
    c.lineTo(x - headR * 0.9, neckY - headR * 2.8);
    c.closePath();
    c.fill();
  } else if (o.hat === 'horns') {
    c.lineWidth = lw * 0.9;
    c.beginPath();
    c.moveTo(x - headR * 0.6, neckY - headR * 1.9);
    c.quadraticCurveTo(x - headR * 1.6, neckY - headR * 2.6, x - headR * 1.3, neckY - headR * 3.6);
    c.moveTo(x + headR * 0.6, neckY - headR * 1.9);
    c.quadraticCurveTo(x + headR * 1.6, neckY - headR * 2.6, x + headR * 1.3, neckY - headR * 3.6);
    c.stroke();
  }
  c.restore();
}

function clearCanvas(c, color = '#fff') {
  c.fillStyle = color;
  c.fillRect(0, 0, W, H);
}

// 文字を max 幅で折り返す（日本語は1文字ずつ）
function wrapText(c, text, maxW) {
  const out = [];
  String(text).split('\n').forEach(para => {
    let line = '';
    for (const ch of para) {
      if (c.measureText(line + ch).width > maxW && line) {
        if ('、。」）！？…'.includes(ch)) { line += ch; out.push(line); line = ''; continue; }
        out.push(line); line = ch;
      } else line += ch;
    }
    out.push(line);
  });
  return out;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}


/* ---------- スマホ用の操作ボタン ---------- */
// 指で画面に触ったら「タッチ操作」とみなし、ステージ中にボタンを出す
const PAD_LAYOUT = {
  1: { left: [['←', 'ArrowLeft'], ['→', 'ArrowRight']], right: [['ジャンプ', 'Space']] },
  2: { dpad: true, right: [['ショット', 'Space']] },
  3: { left: [['←', 'ArrowLeft'], ['↓', 'ArrowDown'], ['→', 'ArrowRight']], right: [['落とす', 'Space'], ['回転', 'ArrowUp']] },
  4: { dpad: true, right: [['決定', 'Enter']] }
};
const Pad = {
  touch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  el: null,
  stage: 0,
  init() {
    this.el = document.createElement('div');
    this.el.id = 'pad';
    app.appendChild(this.el);
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' && !this.touch) { this.touch = true; if (this.stage) this.show(this.stage); }
    }, true);
  },
  button(label, code, x, y, size) {
    const b = document.createElement('div');
    b.className = 'pad-btn' + (label.length > 1 ? ' word' : '');
    b.textContent = label;
    Object.assign(b.style, { left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px' });
    const ids = new Set();
    const press = e => {
      e.preventDefault();
      Sfx.init();
      if (Loop.paused && Loop.running()) { Loop.resume(); Input.clear(); }
      try { b.setPointerCapture(e.pointerId); } catch (_) { /* 古いブラウザ */ }
      if (!ids.size) { Input.down.add(code); Input.hit.add(code); }
      ids.add(e.pointerId);
      b.classList.add('down');
    };
    const release = e => {
      if (!ids.delete(e.pointerId)) return;
      if (!ids.size) { Input.down.delete(code); b.classList.remove('down'); }
    };
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', e => e.preventDefault());
    this.el.appendChild(b);
  },
  show(n) {
    this.stage = n;
    this.el.innerHTML = '';
    this.el.classList.remove('on');
    if (!this.touch) return;
    const L = PAD_LAYOUT[n];
    const S = 86, M = 22, GAP = 12;
    if (L.dpad) {
      const s = 74, cx = M + s * 1.5 + 6, cy = H - M - s * 1.5 - 6;
      [['↑', 'ArrowUp', 0, -1], ['↓', 'ArrowDown', 0, 1], ['←', 'ArrowLeft', -1, 0], ['→', 'ArrowRight', 1, 0]]
        .forEach(([t, c, dx, dy]) => this.button(t, c, cx - s / 2 + dx * (s + 4), cy - s / 2 + dy * (s + 4), s));
    } else {
      L.left.forEach(([t, c], i) => this.button(t, c, M + i * (S + GAP), H - M - S, S));
    }
    L.right.forEach(([t, c], i) => this.button(t, c, W - M - S - i * (S + GAP), H - M - S - (i % 2) * 50, S));
    this.el.classList.add('on');
  },
  hide() {
    this.stage = 0;
    if (!this.el) return;
    this.el.innerHTML = '';
    this.el.classList.remove('on');
  }
};
Pad.init();

/* ---------- 画面 ---------- */
const STAGES = { 1: () => window.Stage1, 2: () => window.Stage2, 3: () => window.Stage3, 4: () => window.Stage4 };
let currentStageApi = null;

const Screens = {
  primary: null,
  shownAt: 0,

  show(html, cls = '') {
    ui.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    ui.classList.add('on');
    this.shownAt = performance.now();
    this.primary = null;
    // 表示直後の誤クリック・押しっぱなしのキーでボタンが反応しないようにする
    const btns = ui.querySelectorAll('button');
    btns.forEach(b => { b.disabled = true; });
    setTimeout(() => btns.forEach(b => { if (!b.dataset.hold) b.disabled = false; }), 350);
  },

  hide() {
    ui.innerHTML = '';
    ui.classList.remove('on');
    this.primary = null;
  },

  bind(id, fn, primary) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      if (el.disabled) return;
      Sfx.init(); Sfx.play('button');
      fn();
    });
    if (primary) this.primary = el;
  },

  // HTML 画面で Enter を押したら主ボタンを押す（日本語入力の確定 Enter は無視）
  onKey(e) {
    if (e.code !== 'Enter' || e.repeat || e.isComposing || e.keyCode === 229) return;
    if (performance.now() - this.shownAt < 400) return;
    const p = this.primary;
    if (!p || p.disabled || !document.body.contains(p)) return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; // ボタン側の既定動作に任せる
    e.preventDefault();
    p.click();
  }
};

/* ---------- タイトル ---------- */
function showTitle() {
  stopStage();
  Music.play('title');
  let t = 0;
  Loop.run(dt => { t += dt; }, c => {
    clearCanvas(c);
    c.strokeStyle = '#d8d8d8';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(250, 392); c.lineTo(710, 392); c.stroke();
    const b = Math.sin(t * 1.6) * 1.5;
    c.fillStyle = 'rgba(0,0,0,0.07)';
    c.beginPath(); c.ellipse(480, 393, 34, 5, 0, 0, Math.PI * 2); c.fill();
    drawStick(c, 480, 392 + b * 0.2, 120 + b, { pose: 'stand' });
  });
  Screens.show(`
    <div class="title-wrap">
      <p class="title-kicker">LIFE DIAGNOSIS PROGRAM</p>
      <h1 class="title">私の人生、診断してください。</h1>
      <p class="subtitle">あなたは、どんな人生を歩んできましたか？</p>
    </div>
    <div class="title-buttons">
      <button id="bStart" class="btn primary">ゲーム開始</button>
      <button id="bHow" class="btn">操作説明</button>
    </div>
    <p class="foot">※入力内容はこの端末のブラウザ内だけで扱われ、どこにも送信されません。</p>
  `, 'title-screen');
  Screens.bind('bStart', showIntro, true);
  Screens.bind('bHow', showHowTo);
}

function showHowTo() {
  const box = document.createElement('div');
  box.className = 'modal';
  box.innerHTML = `
    <div class="modal-card">
      <h2>操作説明</h2>
      <table class="howto">
        <tr><th>ステージ1</th><td>横スクロールアクション</td><td>← → 移動　／　Space ジャンプ</td></tr>
        <tr><th>ステージ2</th><td>横スクロールシューティング</td><td>↑ ↓ ← → 移動　／　Space 攻撃<br><span class="note">右に寄るほど速く進みます</span></td></tr>
        <tr><th>ステージ3</th><td>落ち物パズル</td><td>← → 移動　／　↑ 回転　／　↓ 加速　／　Space 即落下</td></tr>
        <tr><th>ステージ4</th><td>コマンド式RPG</td><td>↑ ↓ ← → 歩く・選ぶ　／　Space・Enter 決定<br><span class="note">選択肢はマウスでも選べます</span></td></tr>
      </table>
      <p class="note">スマホでは、画面に出るボタンで操作できます。プレイ中に P キーで一時停止できます。ステージで失敗しても、診断は最後まで続きます。</p>
      <button id="bHowClose" class="btn primary">閉じる</button>
    </div>`;
  ui.querySelector('.screen').appendChild(box);
  const close = document.getElementById('bHowClose');
  const prev = Screens.primary;
  Screens.primary = close;
  close.addEventListener('click', () => { Sfx.play('button'); box.remove(); Screens.primary = prev; });
}

/* ---------- 説明文 ---------- */
function showIntro() {
  stopStage();
  Loop.run(() => {}, c => clearCanvas(c));
  const paras = [
    'これは、あなたが人生を振り返り、反省してそれを未来に活かすゲームです。',
    'さぞかしくだらない人生、そして取り返しのつかないことをしてきたことでしょう。',
    'まずは過去を入力して、あなたの人物像を登録してください。',
    '人生の分岐点を入力してください。',
    'その分岐点で、現実とは違う選択肢を選んでいたらどうなっていたか確認しましょう。'
  ];
  Screens.show(`
    <div class="intro">
      ${paras.map((p, i) => `<p class="fade-line" style="animation-delay:${0.3 + i * 1.1}s">${p}</p>`).join('')}
    </div>
    <div class="intro-next fade-line" style="animation-delay:${0.3 + paras.length * 1.1}s">
      <button id="bNext" class="btn primary">次へ</button>
    </div>
    <p class="skip-hint">クリックで全文を表示</p>
  `, 'intro-screen');
  const scr = ui.querySelector('.screen');
  const showAll = () => scr.querySelectorAll('.fade-line').forEach(el => { el.style.animationDelay = '0s'; });
  scr.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') showAll(); });
  Screens.bind('bNext', showProfile, true);
}

/* ---------- 人物像登録 ---------- */
function showProfile() {
  stopStage();
  Loop.run(() => {}, c => {
    clearCanvas(c);
    drawStick(c, 120, 470, 70, { pose: 'stand', color: '#cfcfcf' });
  });
  const v = k => esc(gameState[k] || '');
  Screens.show(`
    <h2 class="form-title">人物像の登録</h2>
    <p class="form-lead">すべて任意です。空欄のままでも分析できます。</p>
    <form id="profile" class="profile" autocomplete="off" onsubmit="return false">
      <label><span>名前、またはニックネーム</span><input id="fName" maxlength="20" value="${v('playerName')}" placeholder="例：たろう"></label>
      <label><span>人生で後悔していること</span><input id="fRegret" maxlength="60" value="${v('lifeRegret')}" placeholder="例：あのとき勉強しなかった"></label>
      <label><span>過去の分岐点</span><input id="fBranch" maxlength="60" value="${v('lifeReflection')}" placeholder="例：高校受験"></label>
      <label><span>そのとき選ばなかった選択肢</span><input id="fAlt" maxlength="60" value="${v('alternateChoice')}" placeholder="例：海外に行く"></label>
    </form>
    <div class="form-buttons"><button id="bAnalyze" class="btn primary">私の人生を分析する</button></div>
  `, 'profile-screen');
  Screens.bind('bAnalyze', () => {
    State.setProfile({
      playerName: document.getElementById('fName').value,
      lifeRegret: document.getElementById('fRegret').value,
      lifeReflection: document.getElementById('fBranch').value,
      alternateChoice: document.getElementById('fAlt').value
    });
    State.resetProgress();
    showAnalyzing(() => showStageIntro(1));
  }, true);
}

function showAnalyzing(next) {
  stopStage();
  let t = 0;
  Screens.hide();
  Loop.run(dt => {
    t += dt;
    if (t > 2.2) next();
  }, c => {
    clearCanvas(c);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#111';
    c.font = `22px ${FONT}`;
    c.fillText('入力内容を分析しています' + '．'.repeat(1 + (Math.floor(t * 3) % 3)), W / 2, H / 2 - 20);
    c.strokeStyle = '#111';
    c.lineWidth = 2;
    c.strokeRect(W / 2 - 160, H / 2 + 14, 320, 14);
    c.fillStyle = '#111';
    c.fillRect(W / 2 - 157, H / 2 + 17, 314 * Math.min(1, t / 2), 8);
    c.font = `14px ${FONT}`;
    c.fillStyle = '#999';
    c.fillText('結果は各ステージのプレイ内容から判定されます', W / 2, H / 2 + 60);
  });
}

/* ---------- ステージ ---------- */
const STAGE_HELP = {
  1: { genre: '横スクロールアクション', keys: '← → 移動　／　Space ジャンプ', note: 'ゴールを目指して右へ進んでください。' },
  2: { genre: '横スクロールシューティング', keys: '↑ ↓ ← → 移動　／　Space ショット', note: '40秒以内にゴールへ。右に寄るほど速く進みます。' },
  3: { genre: '落ち物パズル', keys: '← → 移動　／　↑ 回転　／　↓ 加速　／　Space 即落下', note: '60秒以内に 7ライン 消してください。通常の3倍の速さから始まり、だんだん速くなります。' },
  4: { genre: 'コマンド式RPG', keys: '↑ ↓ ← → 歩く・選ぶ　／　Space・Enter 決定', note: 'あなたは勇者です。東の魔王を倒してください。' }
};

function showStageIntro(n) {
  stopStage();
  gameState.currentStage = n;
  Loop.run(() => {}, c => clearCanvas(c));
  const info = STAGE_INFO[n], help = STAGE_HELP[n];
  Screens.show(`
    <p class="stage-no">STAGE ${n} / ${STAGE_COUNT}</p>
    <h2 class="stage-name">${info.short}</h2>
    <p class="stage-theme">${info.theme}</p>
    <div class="stage-help">
      <p class="genre">${help.genre}</p>
      <p class="keys">${Pad.touch ? '画面のボタンで操作します' : help.keys}</p>
      <p class="note">${help.note}</p>
    </div>
    <button id="bGo" class="btn primary">はじめる</button>
  `, 'stage-intro');
  Screens.bind('bGo', () => startStage(n), true);
}

function startStage(n) {
  stopStage();
  Screens.hide();
  Input.clear();
  Input.capture = true;
  Pad.show(n);
  if (document.activeElement) document.activeElement.blur();
  let ended = false;
  const api = {
    stageId: n,
    end(result) {
      if (ended) return;
      ended = true;
      const r = State.record(Object.assign({ stageId: n }, result));
      stopStage();
      showStageResult(r);
    }
  };
  const mod = STAGES[n]();
  const inst = mod.create(api);
  api.inst = inst;
  api.mod = mod;
  currentStageApi = api;
  Music.play(n === 4 ? 'field' : 'stage' + n);
  Fx.clear();
  Loop.run(dt => { inst.update(dt); Fx.update(dt); }, c => {
    const [sx, sy] = Fx.offset();
    c.save();
    c.translate(sx, sy);
    inst.draw(c);
    c.restore();
    Fx.draw(c);
  }, { pausable: true });
}

function stopStage() {
  Loop.stop();
  Fx.clear();
  Input.capture = false;
  Input.clear();
  if (currentStageApi && currentStageApi.inst && currentStageApi.inst.destroy) currentStageApi.inst.destroy();
  currentStageApi = null;
  Pad.hide();
}

/* ---------- ステージ終了時の診断 ---------- */
function showStageResult(r) {
  stopStage();
  Music.play('result');
  const info = STAGE_INFO[r.stageId];
  const last = r.stageId >= STAGE_COUNT;
  Sfx.play('tick');
  Loop.run(() => {}, c => clearCanvas(c));
  const lines = String(r.diagnosisText).split('\n').map(s => `<p>${esc(s)}</p>`).join('');
  Screens.show(`
    <div class="result-card">
      <div class="result-head">
        <span class="stage-no">${esc(info.name)}</span>
        <span class="badge ${r.cleared ? 'ok' : 'ng'}">${r.cleared ? 'クリア' : '失敗'}</span>
      </div>
      <p class="result-theme">${esc(info.theme)}</p>
      <dl class="result-play"><dt>プレイ結果</dt><dd>${esc(r.playResult)}</dd></dl>
      <div class="result-text${r.diagnosisText.length > 260 ? ' longest' : r.diagnosisText.length > 150 ? ' longer' : r.diagnosisText.length > 60 ? ' long' : ''}">${lines}</div>
      <p class="result-tag">診断タグ：<b>${esc(r.diagnosisTag)}</b></p>
    </div>
    <button id="bNextStage" class="btn primary">${last ? '最終診断へ' : (r.stageId === 1 ? '次の人生へ' : '次へ')}</button>
  `, 'result-screen');
  Screens.bind('bNextStage', () => {
    if (last) showFinal();
    else showStageIntro(r.stageId + 1);
  }, true);
}

/* ---------- 最終判定 ---------- */
function showFinal() {
  stopStage();
  const verdict = State.judge();
  Screens.hide();
  let t = 0;
  Loop.run(dt => {
    t += dt;
    if (t > 2.4) {
      if (verdict === 'all_clear') Results.showAllClear();
      else Results.showReceipt();
    }
  }, c => {
    clearCanvas(c);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#111';
    c.font = `22px ${FONT}`;
    c.fillText('全ステージの結果を集計しています' + '．'.repeat(1 + (Math.floor(t * 3) % 3)), W / 2, H / 2);
  });
}

function restartDiagnosis() {
  stopStage();
  State.resetProgress();
  showProfile();
}

function restartFromTitle() {
  stopStage();
  State.resetProgress();
  showTitle();
}

/* ---------- 確認用（?dbg） ---------- */
if (DBG) {
  window.dbg = {
    state: gameState,
    stage(n) { State.resetProgress(); startStage(n); },
    finish(cleared = true) {
      const a = currentStageApi;
      if (!a || !a.mod.debugResult) return 'not in stage';
      a.end(a.mod.debugResult(cleared));
    },
    final(results) { // 例 dbg.final([true,true,false,true])
      State.resetProgress();
      results.forEach((ok, i) => State.record(Object.assign({ stageId: i + 1 }, STAGES[i + 1]().debugResult(ok))));
      showFinal();
    },
    inst() { return currentStageApi && currentStageApi.inst; }
  };
}

showTitle();
