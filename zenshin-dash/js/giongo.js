// 擬音と カットイン（第25部、付録U・AC）
import * as THREE from 'three';
import { CFG } from './config.js';
import { rng, clamp } from './util.js';
import { Audio } from './audio.js';
import { CHARS } from './models.js';

export const GIONGO = {
  don:     { text: 'ドンッ！',   style: 'impact',  size: 'xl', sfx: 'don' },        // ゲートが 開く
  donS:    { text: 'ドンッ',     style: 'impact',  size: 's',  sfx: 'don' },        // 大ジャンプの 着地
  zudon:   { text: 'ズドンッ！', style: 'impact',  size: 'xl', sfx: 'zudon' },      // ロケットスタート
  zuba:    { text: 'ズバァッ！', style: 'impact',  size: 'm',  sfx: 'zuba' },       // ハードル（大ジャンプは l）
  zuza:    { text: 'ズザァッ！', style: 'whoosh',  size: 'm',  sfx: 'zuza' },       // くぐり棒
  shuba:   { text: 'シュバッ！', style: 'whoosh',  size: 'm',  sfx: 'shuba' },      // どっしり
  shubaS:  { text: 'シュバッ！', style: 'whoosh',  size: 's',  sfx: 'shuba' },      // 抜いた
  bari:    { text: 'バリィッ！', style: 'paper',   size: 'm',  sfx: 'bari' },       // 紙の門
  bashi:   { text: 'バシィッ！', style: 'impact',  size: 'm',  sfx: 'bashi' },      // ボール
  gatsun:  { text: 'ガツンッ！', style: 'oops',    size: 'm',  sfx: 'gatsun' },     // ハードル 失敗
  gochin:  { text: 'ゴチンッ！', style: 'oops',    size: 'm',  sfx: 'gochin' },     // くぐり棒 失敗
  dogo:    { text: 'ドゴォッ！', style: 'oops',    size: 'l',  sfx: 'dogo' },       // どっしり 失敗・じゃまされた
  bofu:    { text: 'ボフッ！',   style: 'oops',    size: 'm',  sfx: 'bofu' },       // 紙の門 失敗
  boyon:   { text: 'ボヨンッ！', style: 'oops',    size: 'm',  sfx: 'boyon' },      // ボール 失敗
  gyun:    { text: 'ギュンッ！', style: 'whoosh',  size: 'l',  sfx: 'gyun' },       // 捲り
  donHit:  { text: 'ドンッ！',   style: 'impact',  size: 'l',  sfx: 'don' },        // じゃまが 当たった
  zute:    { text: 'ズテッ！',   style: 'impact',  size: 'l',  sfx: 'zute' },       // 引っかけが 当たった
  zuteGot: { text: 'ズテッ！',   style: 'oops',    size: 'l',  sfx: 'zute' },       // 引っかけられた
  sukaS:   { text: 'スカッ',     style: 'small',   size: 's',  sfx: 'suka' },       // 空ぶり
  suka:    { text: 'スカッ！',   style: 'whoosh',  size: 'l',  sfx: 'suka' },       // じゃまを しゃがんで よけた
  hyoi:    { text: 'ヒョイッ！', style: 'whoosh',  size: 'l',  sfx: 'hyoi' },       // 引っかけを とんで よけた
  gira:    { text: 'ギラッ',     style: 'tension', size: 's',  sfx: 'gira' },       // ふりかぶり
  gogogo:  { text: 'ゴゴゴゴ…', style: 'tension', size: 'l',  sfx: 'gogogo', anim: 'oneByOne' },  // 最後の直線の 前
  goo:     { text: 'ゴォォッ！', style: 'fire',    size: 'xl', sfx: 'goo' },        // ラストスパート
  gooS:    { text: 'ゴォッ',     style: 'fire',    size: 's',  sfx: 'goo' },        // 腕ふり
  dododo:  { text: 'ドドドド',   style: 'small',   size: 's',  sfx: 'dododo', anim: 'trail' },     // 最高速
  dodon:   { text: 'ドドーン！', style: 'impact',  size: 'xl', sfx: 'dodon' },      // 1いで ゴール
  goal:    { text: 'ゴールッ！', style: 'impact',  size: 'xl', sfx: 'goal' },       // 2い以下で ゴール
  gotsu:   { text: 'ゴツッ',     style: 'small',   size: 's',  sfx: 'gotsu' },      // ぶつかり
  pita:    { text: 'ピタッ！',   style: 'success', size: 'm',  sfx: 'pita' },       // れんしゅうで できた
  kira:    { text: 'キラーン！', style: 'success', size: 'm',  sfx: 'pita' }        // 1いに なった
};
// 付録U の 全部の 字（フォントの 読みこみに 使う）
export const GIONGO_CHARS = [...new Set(Object.values(GIONGO).map(g => g.text).join('') + 'パーフェクト！まくりじゃませいこうかわしたゴール1234567い')].join('');

export const STYLES = {
  impact:  { fill: ['#fff27a', '#ff8a1c'], inner: '#2a0a12', outer: '#ffffff', shadow: '#e8213c' },
  whoosh:  { fill: ['#ffffff', '#7fe3ff'], inner: '#0b2a4a', outer: '#ffffff', shadow: '#2b6fff' },
  success: { fill: ['#fffbe0', '#ffc400'], inner: '#4a2a00', outer: '#ffffff', shadow: '#ff6a00' },
  oops:    { fill: ['#ffffff', '#ffb3c7'], inner: '#3a0a2a', outer: '#ffffff', shadow: '#8a2be2' },
  paper:   { fill: ['#ffffff', '#ffd1e0'], inner: '#5a1030', outer: '#ff4d8d', shadow: '#ffffff' },
  tension: { fill: ['#b9a3ff', '#4b2a9a'], inner: '#0d0420', outer: '#e9e0ff', shadow: '#000000' },
  fire:    { fill: ['#fff1a0', '#ff3b00'], inner: '#3a0800', outer: '#ffe08a', shadow: '#8a0000' },
  small:   { fill: ['#ffffff', '#dfe8ff'], inner: '#1d2b53', outer: null,      shadow: null }
};
const SMALL = 'ッァィゥェォャュョ';
const FONT = '"Dela Gothic One", "M PLUS Rounded 1c", sans-serif';

// ---------- 字の 並びを 決める（AC.2） ----------
function layout(text, fs, seed) {
  const rnd = rng(seed), chars = [...text];
  const cs = chars.map((ch, i) => {
    let k = 1 + (rnd() * 2 - 1) * 0.12; if (SMALL.includes(ch)) k *= 0.7; if (ch === '！' && i === chars.length - 1) k *= 1.25; if (ch === '…') k *= 0.8;
    return { ch, size: fs * k, rot: ((rnd() * 2 - 1) * 8 + (ch === '！' ? 12 : 0)) * Math.PI / 180, dy: (rnd() * 2 - 1) * 0.08 * fs + (SMALL.includes(ch) ? fs * 0.12 : 0) };
  });
  const gap = -0.05 * fs, pad = 0.45 * fs;
  let x = pad; for (const c of cs) { c.x = x + c.size * 0.46; x += c.size * 0.92 + gap; }
  const W = Math.ceil(x - gap + pad), H = Math.ceil(fs * 1.6 + pad);
  return { cs, W, H, pad };
}
// 字を 描く（影 → 外の ふち → 内の ふち → 中 ＋ つや）
function paint(g, cs, H, S, fs, only = null) {
  const list = only ? [only] : cs;
  const each = (fn) => { for (const c of list) { g.save(); g.translate(only ? c.ox : c.x, H / 2 + c.dy); g.rotate(c.rot); g.font = `${Math.round(c.size)}px ${FONT}`; fn(c); g.restore(); } };
  g.lineJoin = 'round'; g.textBaseline = 'middle'; g.textAlign = 'center';
  if (S.shadow) each(c => { g.fillStyle = S.shadow; g.strokeStyle = S.shadow; g.lineWidth = 0.3 * fs; g.translate(0.06 * fs, 0.08 * fs); g.strokeText(c.ch, 0, 0); g.fillText(c.ch, 0, 0); });
  if (S.outer) each(c => { g.strokeStyle = S.outer; g.lineWidth = 0.3 * fs; g.strokeText(c.ch, 0, 0); });
  each(c => { g.strokeStyle = S.inner; g.lineWidth = 0.16 * fs; g.strokeText(c.ch, 0, 0); });
  // 中と つや：別の キャンバスで 字の 形だけに つやを かける
  const off = document.createElement('canvas'); off.width = g.canvas.width; off.height = g.canvas.height;
  const o = off.getContext('2d'); o.setTransform(g.getTransform()); o.lineJoin = 'round'; o.textBaseline = 'middle'; o.textAlign = 'center';
  for (const c of list) {
    o.save(); o.translate(only ? c.ox : c.x, H / 2 + c.dy); o.rotate(c.rot); o.font = `${Math.round(c.size)}px ${FONT}`;
    const gr = o.createLinearGradient(0, -c.size / 2, 0, c.size / 2); gr.addColorStop(0, S.fill[0]); gr.addColorStop(1, S.fill[1]);
    o.fillStyle = gr; o.fillText(c.ch, 0, 0);
    o.globalCompositeOperation = 'source-atop'; o.fillStyle = 'rgba(255,255,255,0.38)'; o.fillRect(-c.size, -c.size * 0.52, c.size * 2, c.size * 0.3);
    o.fillStyle = 'rgba(0,0,0,0.10)'; o.fillRect(-c.size, c.size * 0.22, c.size * 2, c.size * 0.4);
    o.globalCompositeOperation = 'source-over'; o.restore();
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(off, 0, 0); g.restore();
}
const cache = new Map();
function render(text, style, fs, seed = 7) {
  const key = text + '|' + style + '|' + Math.round(fs);
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const S = STYLES[style], dpr = Math.min(2, devicePixelRatio || 1);
  const { cs, W, H } = layout(text, fs, seed + text.length * 31);
  const cv = document.createElement('canvas'); cv.width = Math.min(2048, Math.round(W * dpr)); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  paint(g, cs, H, S, fs);
  const v = { cv, W, H, cs, dpr };
  cache.set(key, v);
  while (cache.size > CFG.giongo.CACHE) cache.delete(cache.keys().next().value);
  return v;
}
// 1字ずつの キャンバス（ゴゴゴゴ・ドドドド）
function renderEach(text, style, fs) {
  const S = STYLES[style], dpr = Math.min(2, devicePixelRatio || 1);
  const { cs, W, H } = layout(text, fs, 11);
  return { W, H, list: cs.map(c => {
    const w = Math.ceil(c.size * 1.6), cv = document.createElement('canvas'); cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); g.scale(dpr, dpr); c.ox = w / 2; paint(g, cs, H, S, fs, c);
    return { cv, x: c.x - w / 2, w };
  }) };
}
// 字の うしろの 集中線（AC.5）
function burstCanvas(W, H) {
  const cv = document.createElement('canvas'), s = Math.round(Math.max(W, H) * 1.4); cv.width = cv.height = s;
  const g = cv.getContext('2d'); g.translate(s / 2, s / 2); g.fillStyle = 'rgba(10,10,20,0.85)';
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2 + Math.random() * 0.05, r0 = s * (0.22 + Math.random() * 0.08), r1 = s * 0.5, w = 0.012 + Math.random() * 0.02;
    g.beginPath(); g.moveTo(Math.cos(a - w) * r1, Math.sin(a - w) * r1); g.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a + w) * r1, Math.sin(a + w) * r1); g.fill();
  }
  cv.className = 'burst'; cv.style.width = s + 'px'; cv.style.height = s + 'px'; cv.style.left = (W - s) / 2 + 'px'; cv.style.top = (H - s) / 2 + 'px';
  return cv;
}

const _v = new THREE.Vector3();
export const Giongo = {
  layer: null, live: [], last: {}, side: 1, cutAt: -99, cutN: 0, rivalAt: -9, env: null,
  // env：{ settings(), uiK(), portrait(), views（[{ cam, rect }]）, cueRect(view), portraits, slowTo(k, sec), camCut(runner, sec, view), flash(), t() }
  init(layer, env) { this.layer = layer; this.env = env; },
  clear() { for (const g of this.live) g.el.remove(); this.live = []; this.last = {}; this.cutN = 0; this.cutAt = -99; },
  // at：世界の 点（Vector3）または 画面の 点 { sx, sy }。opt：{ size, perfect, view, rival, gap }
  show(id, at, opt = {}) {
    const G = GIONGO[id]; if (!G || !this.layer) return false;
    const E = this.env, S = CFG.giongo, set = E.settings();
    const quiet = set.giongo === 'quiet';
    const size = opt.size || G.size;
    if (quiet && size === 's') { Audio.play(G.sfx, { v: CFG.audio.SFX_S }); return false; }
    const now = performance.now() / 1000;
    if ((this.last[G.text] || -9) + S.SAME_GAP > now) return false;
    if (size === 's' && this.live.some(g => g.small && now - g.t < 0.5)) return false;
    if (opt.rival) { if (now - this.rivalAt < S.SMALL_RIVAL_GAP) return false; this.rivalAt = now; }
    this.last[G.text] = now;
    const view = E.views()[opt.view || 0] || E.views()[0];
    const two = E.views().length > 1;
    const k = (quiet ? S.QUIET_K : 1) * (E.portrait() ? S.PORTRAIT_K : 1) * (two ? S.HALF_K : 1);
    const fs = S.SIZE[size] * k * E.uiK();
    const style = opt.perfect ? 'success' : G.style;
    // 置き場所
    const R = view.rect;
    let px, py;
    if (at && at.isVector3) {
      _v.copy(at).project(view.cam);
      if (_v.z > 1) { px = R.x + R.w / 2; py = R.y + R.h * 0.4; }
      else { px = R.x + (_v.x * 0.5 + 0.5) * R.w; py = R.y + (-_v.y * 0.5 + 0.5) * R.h; }
    } else if (at) { px = R.x + at.sx * R.w; py = R.y + at.sy * R.h; }
    else { px = R.x + R.w / 2; py = R.y + R.h * 0.35; }
    const el = document.createElement('div');
    let W, H;
    if (G.anim === 'oneByOne' || G.anim === 'trail') {
      const r = renderEach(G.text, style, fs); W = r.W; H = r.H;
      el.className = 'gio ' + G.anim;
      r.list.forEach((c, i) => { c.cv.style.left = c.x + 'px'; c.cv.style.width = c.w + 'px'; c.cv.style.height = H + 'px'; c.cv.style.animationDelay = (i * (G.anim === 'trail' ? 0.06 : 0.08)) + 's'; el.appendChild(c.cv); });
    } else {
      const r = render(G.text, style, fs); W = r.W; H = r.H;
      el.className = 'gio pop ' + size;
      if ((size === 'l' || size === 'xl') && !quiet) el.appendChild(burstCanvas(W, H));
      r.cv.className = 'word'; el.appendChild(r.cv.cloneNode ? cloneCanvas(r.cv) : r.cv);
    }
    this.side = -this.side;
    let x = px + this.side * W * 0.4 - W / 2, y = py - H * 0.9;
    // 合図の 輪を さける・画面の ふちから 出ない
    const ring = E.cueRect(opt.view || 0), pad = S.RING_PAD * E.uiK(), edge = S.EDGE_PAD * E.uiK();
    if (ring && x < ring.x + ring.w + pad && x + W > ring.x - pad && y < ring.y + ring.h + pad && y + H > ring.y - pad) y = ring.y - pad - H;
    x = clamp(x, R.x + edge, R.x + R.w - edge - W); y = clamp(y, R.y + edge, R.y + R.h - edge - H);
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: W + 'px', height: H + 'px' });
    el.style.setProperty('--rot', (this.side * (4 + Math.random() * 8)) + 'deg');
    el.style.setProperty('--dx', (this.side * (30 + Math.random() * 30) * E.uiK()) + 'px');
    this.layer.appendChild(el);
    const life = G.anim === 'oneByOne' ? S.TENSION_LIFE : S.LIFE;
    this.live.push({ el, t: now, life, small: size === 's' });
    const max = quiet ? 1 : S.MAX;
    while (this.live.length > max) this.kill(this.live.shift());
    Audio.play(G.sfx, { v: { s: CFG.audio.SFX_S, m: CFG.audio.SFX_M, l: CFG.audio.SFX_L, xl: 1 }[size], gap: opt.gap });
    return true;
  },
  kill(g) { g.el.style.transition = 'opacity .1s'; g.el.style.opacity = '0'; setTimeout(() => g.el.remove(), 120); },
  update() {
    const now = performance.now() / 1000;
    this.live = this.live.filter(g => { if (now - g.t > g.life + 0.05) { g.el.remove(); return false; } return true; });
  },

  // ---------- カットイン（25.7、AC.6） ----------
  // kind：makuri / jamaHit / jamaDodge / goal。opt：{ word, face, rankText, view }
  cutin(kind, runner, opt = {}) {
    const E = this.env, S = CFG.giongo, set = E.settings();
    if (!set.cutin) return false;
    const now = E.t();
    if (kind !== 'goal' && (now - this.cutAt < S.CUT_GAP || this.cutN >= S.CUT_MAX)) return false;
    if (kind !== 'goal') { this.cutAt = now; this.cutN++; }
    const C = CHARS[runner.char];
    const face = E.portraits[runner.char];
    const img = document.getElementById('cutinFace');
    if (face) img.src = face[opt.face === 'effort' ? 'normal' : 'happy'];
    drawCutBg(document.getElementById('cutinBg'), C.kart);
    const G = GIONGO[opt.word] || GIONGO.don;
    const wc = document.getElementById('cutinWord'), r = render(G.text, opt.perfect ? 'success' : G.style, S.SIZE.l * 1.4);
    wc.width = r.cv.width; wc.height = r.cv.height; wc.getContext('2d').drawImage(r.cv, 0, 0);
    wc.style.aspectRatio = r.W + ' / ' + r.H;
    document.getElementById('cutinCap').textContent = { makuri: 'まくり！', jamaHit: 'じゃま せいこう！', jamaDodge: 'かわした！', goal: opt.rankText || 'ゴール！' }[kind] || '';
    const el = document.getElementById('cutin'), half = E.views().length > 1 ? ' half' + (opt.view || 0) : '';
    el.className = 'on' + half;
    E.slowTo(S.SLOW, S.CUT_IN);
    clearTimeout(this.cutT1); clearTimeout(this.cutT2);
    const hold = kind === 'goal' ? S.CUT_HOLD_GOAL : S.CUT_HOLD;   // ゴールは ながめに 見せる
    this.cutT1 = setTimeout(() => { el.className = 'out' + half; E.slowTo(1, S.CUT_OUT); }, (S.CUT_IN + hold) * 1000);
    this.cutT2 = setTimeout(() => { el.className = ''; }, (S.CUT_IN + hold + S.CUT_OUT) * 1000 + 60);
    E.camCut(runner, S.CUT_IN + hold, opt.view || 0, kind);
    E.flash();
    Audio.play('jakin');
    Audio.play(G.sfx, { v: 1, delay: 0.05 });
    return true;
  }
};
function cloneCanvas(src) { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); c.className = src.className; return c; }
// カットインの 地：チームの 色の 放射 ＋ 黒い 集中線
function drawCutBg(cv, color) {
  const w = 1024, h = 420; if (cv.width !== w) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(w * 0.6, h * 0.5, 10, w * 0.6, h * 0.5, w * 0.7); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, color); gr.addColorStop(1, shade(color, -0.35));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.save(); g.translate(w * 0.62, h * 0.5); g.fillStyle = 'rgba(8,8,18,0.55)';
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2 + Math.random() * 0.04, r0 = 120 + Math.random() * 60, r1 = 900, ww = 0.008 + Math.random() * 0.014; g.beginPath(); g.moveTo(Math.cos(a - ww) * r1, Math.sin(a - ww) * r1); g.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a + ww) * r1, Math.sin(a + ww) * r1); g.fill(); }
  g.restore();
  // スクリーントーンの 点
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = 8; y < h; y += 14) for (let x = (y / 14 % 2) * 7; x < w * 0.45; x += 14) { const r = 3.2 * (1 - x / (w * 0.45)); if (r > 0.4) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } }
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const f = v => Math.round(clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255)); return `rgb(${f(r)},${f(g)},${f(b)})`; }
