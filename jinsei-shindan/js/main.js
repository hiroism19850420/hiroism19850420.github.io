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
  play(name) {
    switch (name) {
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
  Loop.run(dt => inst.update(dt), c => inst.draw(c), { pausable: true });
}

function stopStage() {
  Loop.stop();
  Input.capture = false;
  Input.clear();
  if (currentStageApi && currentStageApi.inst && currentStageApi.inst.destroy) currentStageApi.inst.destroy();
  currentStageApi = null;
  Pad.hide();
}

/* ---------- ステージ終了時の診断 ---------- */
function showStageResult(r) {
  stopStage();
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
      <div class="result-text${r.diagnosisText.length > 150 ? ' longer' : r.diagnosisText.length > 60 ? ' long' : ''}">${lines}</div>
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
