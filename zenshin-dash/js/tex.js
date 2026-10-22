// キャンバスで 絵を作る（21.16、付録AC）
import * as THREE from 'three';
import { rng, clamp } from './util.js';
import { drawPic } from './pics.js';

let MAX_ANISO = 8;
export function setAniso(n) { MAX_ANISO = n; }
const FONT = `'M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Yu Gothic',sans-serif`;

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function texture(c, { repeat = false, aniso = false, srgb = true, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (aniso) t.anisotropy = Math.min(8, MAX_ANISO);
  if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  t.needsUpdate = true;
  return t;
}
function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------- 道 ----------
export function roadTexture(courseId, width) {
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rng(101 + courseId.charCodeAt(1));
  const base = { c1: '#5b6273', c2: '#c9a874', c3: '#c9d8e8', c4: '#3a3f52' }[courseId];
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const n = courseId === 'c3' ? 4000 : 11000;
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, s = r() < 0.6 ? 1 : 2;
    if (courseId === 'c2') g.fillStyle = r() < 0.5 ? 'rgba(255,248,225,0.18)' : 'rgba(120,90,40,0.12)';
    else if (courseId === 'c3') g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(140,170,210,0.10)';
    else g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)';
    g.fillRect(x, y, s, s);
  }
  if (courseId === 'c3') {
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(150,180,220,0.08)'; ellipse(g, r() * S, r() * S, 30 + r() * 70, 30 + r() * 70); }
  }
  // タイヤのあと
  if (courseId === 'c2' || courseId === 'c3') {
    g.strokeStyle = courseId === 'c2' ? 'rgba(140,110,60,0.18)' : 'rgba(120,150,200,0.18)'; g.lineWidth = 9;
    for (const u of [0.33, 0.4, 0.6, 0.67]) { g.beginPath(); for (let y = 0; y <= S; y += 16) { const x = u * S + Math.sin(y / 60 + u * 9) * 6; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  }
  if (courseId === 'c2') for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; ellipse(g, r() * S, r() * S, 3, 2); }
  if (courseId === 'c4') for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(r() * S, r() * S, 1, 1); }
  // はしの線
  if (courseId === 'c1' || courseId === 'c4') {
    const e = Math.round(S * 0.4 / width), lw = Math.max(4, Math.round(S * 0.25 / width));
    g.fillStyle = '#f2f4f8'; g.fillRect(e, 0, lw, S); g.fillRect(S - e - lw, 0, lw, S);
  }
  if (courseId === 'c4') { g.fillStyle = '#f0c040'; g.fillRect(S / 2 - 4, 0, 8, S * 3 / 8); }
  return texture(c, { repeat: true, aniso: true });
}
export function plankTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = rng(7);
  for (let i = 0; i < 8; i++) {
    const y = i * 32, tone = 150 + r() * 30;
    g.fillStyle = `rgb(${tone + 20},${tone - 10},${tone - 55})`; g.fillRect(0, y, S, 32);
    for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(80,50,20,0.15)'; g.fillRect(r() * S, y + r() * 32, 20 + r() * 60, 1); }
    g.fillStyle = 'rgba(60,35,15,0.55)'; g.fillRect(0, y + 30, S, 2);
    const cut = r() * S; g.fillRect(cut, y, 2, 32);
  }
  return texture(c, { repeat: true, aniso: true });
}
export function checkerTexture(n = 8) {
  const S = 64, c = canvas(S, S), g = c.getContext('2d'), q = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = (i + j) % 2 ? '#1d2433' : '#ffffff'; g.fillRect(i * q, j * q, q, q); }
  const t = texture(c, { repeat: true }); t.magFilter = THREE.NearestFilter; return t;
}
export function stripeTexture(a = '#ffd54a', b = '#2b2f3a') {
  const S = 64, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, S, S); g.fillStyle = b;
  for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + S, S); g.lineTo(i * 32 + S, S); g.closePath(); g.fill(); }
  return texture(c, { repeat: true, aniso: true });
}
export function bannerTexture(color) {
  const c = canvas(1024, 160), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 160); grd.addColorStop(0, color); grd.addColorStop(1, '#1d2b53');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 160);
  for (const x0 of [0, 1024 - 120]) for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { g.fillStyle = (i + j) % 2 ? '#1d2433' : '#fff'; g.fillRect(x0 + i * 20, j * 40, 20, 40); }
  g.font = `800 76px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#1d2b53'; g.strokeText('ぜんしんグランプリ', 512, 84);
  g.fillStyle = '#fff'; g.fillText('ぜんしんグランプリ', 512, 84);
  return texture(c, { aniso: true });
}
export function numberTexture(no, color) {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
  g.font = `800 84px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1d2b53'; g.fillText(String(no), 64, 70);
  return texture(c);
}
export function cloudTexture(seed) {
  const c = canvas(256, 128), g = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < 10; i++) {
    const x = 40 + r() * 176, y = 58 + r() * 26, rad = 20 + r() * 30;
    const grd = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.62, 'rgba(255,255,255,0.92)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, 55, 0, 128); sh.addColorStop(0, 'rgba(190,205,230,0)'); sh.addColorStop(1, 'rgba(150,170,205,0.6)');
  g.fillStyle = sh; g.fillRect(0, 0, 256, 128);
  return texture(c, { mip: true });
}
// パーティクルの アトラス（2×2：けむり、キラキラ、まる、雪）
export function particleAtlas() {
  const c = canvas(128, 128), g = c.getContext('2d'), r = rng(9);
  // けむり
  for (let i = 0; i < 5; i++) {
    const x = 32 + (r() - 0.5) * 16, y = 32 + (r() - 0.5) * 16, rad = 14 + r() * 10;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, 'rgba(255,255,255,0.75)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  }
  // キラキラ
  let grd = g.createRadialGradient(96, 32, 0, 96, 32, 14); grd.addColorStop(0, '#fff'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(64, 0, 64, 64);
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineCap = 'round';
  for (const [w, l] of [[4, 28], [2, 18]]) { g.lineWidth = w; g.beginPath(); g.moveTo(96 - l, 32); g.lineTo(96 + l, 32); g.moveTo(96, 32 - l); g.lineTo(96, 32 + l); g.stroke(); g.lineWidth = w * 0.6; }
  // まる
  grd = g.createRadialGradient(32, 96, 0, 32, 96, 30); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 64, 64, 64);
  // 雪
  grd = g.createRadialGradient(96, 96, 0, 96, 96, 12); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(64, 64, 64, 64);
  return texture(c, { mip: true });
}
export function glowTexture() {
  const c = canvas(64, 64), g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return texture(c);
}
export function blobTexture() {
  const c = canvas(64, 64), g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return texture(c, { srgb: false });
}
export function noiseTexture(seed = 3, S = 256, amp = 0.12) {
  const c = canvas(S, S), g = c.getContext('2d'), r = rng(seed), img = g.createImageData(S, S);
  // かさねた 値ノイズ（くり返しても つなぎ目がない）
  const oct = [[8, 0.5], [16, 0.3], [64, 0.2]];
  const grids = oct.map(([n]) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); return a; });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    oct.forEach(([n, w], k) => {
      const u = x / S * n, vv = y / S * n, i = Math.floor(u), j = Math.floor(vv), fu = u - i, fv = vv - j;
      const G = grids[k], at = (a, b) => G[((b % n + n) % n) * n + ((a % n + n) % n)];
      const sx = fu * fu * (3 - 2 * fu), sy = fv * fv * (3 - 2 * fv);
      v += w * ((at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy);
    });
    const o = (y * S + x) * 4, c1 = clamp(1 - amp + v * amp * 2, 0, 1) * 255;
    img.data[o] = c1; img.data[o + 1] = c1; img.data[o + 2] = c1; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
export function detailTexture() { return texture(noiseTexture(3, 256, 0.07), { repeat: true, aniso: true }); }
export function waterNoiseTexture() {
  const c = canvas(256, 256), g = c.getContext('2d'), a = noiseTexture(41, 256, 0.5), b = noiseTexture(57, 256, 0.5), d = noiseTexture(73, 256, 0.5);
  const A = a.getContext('2d').getImageData(0, 0, 256, 256).data, B = b.getContext('2d').getImageData(0, 0, 256, 256).data, D = d.getContext('2d').getImageData(0, 0, 256, 256).data;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < A.length; i += 4) { img.data[i] = A[i]; img.data[i + 1] = B[i]; img.data[i + 2] = D[i]; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return texture(c, { repeat: true, srgb: false });
}
export function crackTexture() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rng(19);
  g.fillStyle = '#cfeaf8'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
  for (let i = 0; i < 30; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 80; y += (r() - 0.5) * 80; g.lineTo(x, y); } g.stroke(); }
  return texture(c, { repeat: true, aniso: true });
}
export function signTexture(kind) {
  const c = canvas(256, 192), g = c.getContext('2d');
  const edge = kind === 'jump' ? '#ff7a2f' : '#3fa9f5';
  g.fillStyle = edge; rrect(g, 0, 0, 256, 192, 24); g.fill();
  g.fillStyle = '#fff'; rrect(g, 14, 14, 228, 164, 14); g.fill();
  const pic = { jump: 'jump', gate: 'squat', ice: 'snow' }[kind];
  drawPic(g, pic, 78, 18, 100, '#1d2b53');
  g.font = `800 34px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#1d2b53';
  g.fillText({ jump: 'ジャンプ！', gate: 'しゃがめ！', ice: 'すべるよ' }[kind], 128, 160);
  return texture(c, { aniso: true });
}
export function chevronTexture(dir) {
  const c = canvas(128, 96), g = c.getContext('2d');
  g.fillStyle = '#d94a4a'; rrect(g, 0, 0, 128, 96, 12); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 14; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const o of [-18, 18]) { g.beginPath(); if (dir > 0) { g.moveTo(54 + o, 22); g.lineTo(78 + o, 48); g.lineTo(54 + o, 74); } else { g.moveTo(74 + o, 22); g.lineTo(50 + o, 48); g.lineTo(74 + o, 74); } g.stroke(); }
  return texture(c);
}
export function picnicTexture() {
  const c = canvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(230,70,70,0.8)';
  for (let i = 0; i < 4; i++) { g.fillRect(i * 16, 0, 8, 64); g.fillRect(0, i * 16, 64, 8); }
  return texture(c, { repeat: true });
}
export function ringTexture() {
  const c = canvas(64, 64), g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke();
  return texture(c);
}
export function labelTexture(text, color) {
  const c = canvas(256, 96), g = c.getContext('2d');
  g.font = `800 52px ${FONT}`;
  const w = Math.min(240, g.measureText(text).width + 44);
  const x = (256 - w) / 2;
  g.fillStyle = '#fff'; rrect(g, x - 4, 2, w + 8, 72, 22); g.fill();
  g.fillStyle = color; rrect(g, x, 6, w, 64, 18); g.fill();
  g.beginPath(); g.moveTo(118, 74); g.lineTo(138, 74); g.lineTo(128, 92); g.closePath(); g.fillStyle = '#fff'; g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#1d2b53'; g.lineJoin = 'round';
  g.strokeText(text, 128, 40); g.fillStyle = '#fff'; g.fillText(text, 128, 40);
  return texture(c);
}

// ================= ぜんしんダッシュ で 足したもの（付録AE） =================
const wrapY = (H, fn) => { for (const dy of [-H, 0, H]) fn(dy); };
function hex3c(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
const rgba = (h, a) => { const c = hex3c(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
function speckle(g, W, H, dark, light, n, r, s0 = 1, s1 = 3, a = 0.35) {
  const D = hex3c(dark), L = hex3c(light);
  for (let i = 0; i < n; i++) {
    const c = r() < 0.5 ? D : L, s = s0 + r() * (s1 - s0);
    g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a * (0.4 + r() * 0.6)).toFixed(3)})`;
    g.fillRect(r() * W, r() * H, s, s);
  }
}

// 道：1024×512 が はば 8m × 長さ 4m（1m = 128 画素、縦も横も 同じ）
export function runRoadTexture(road, seed = 1) {
  const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'), r = rng(300 + seed);
  g.fillStyle = road.base; g.fillRect(0, 0, W, H);
  // ゆるい むら（大きな ぼかしの まる）
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = r() * H, rad = 40 + r() * 120, col = r() < 0.5 ? road.dark : road.light;
    wrapY(H, dy => { const grd = g.createRadialGradient(x, y + dy, 0, x, y + dy, rad); grd.addColorStop(0, rgba(col, 0.16)); grd.addColorStop(1, rgba(col, 0)); g.fillStyle = grd; g.fillRect(x - rad, y + dy - rad, rad * 2, rad * 2); });
  }
  speckle(g, W, H, road.dark, road.light, road.kind === 'snow' ? 6000 : 14000, r, 1, 3, road.kind === 'asphalt' ? 0.45 : 0.32);
  switch (road.kind) {
    case 'track': {
      // こすれの 筋（縦に 長い）
      for (let i = 0; i < 70; i++) {
        const x = r() * W, y = r() * H, len = 60 + r() * 260, w = 1 + r() * 3, col = r() < 0.6 ? road.light : road.dark, a = 0.10 + r() * 0.12;
        wrapY(H, dy => { g.fillStyle = rgba(col, a); g.fillRect(x, y + dy, w, len); });
      }
      // 小石
      for (let i = 0; i < 160; i++) {
        const x = r() * W, y = r() * H, rr = 1.5 + r() * 3.5, col = r() < 0.5 ? '#9a4a34' : '#e9a58a', k = 0.7 + r() * 0.4;
        wrapY(H, dy => { g.fillStyle = col; ellipse(g, x, y + dy, rr, rr * k); g.fillStyle = 'rgba(255,255,255,0.25)'; ellipse(g, x - rr * 0.3, y + dy - rr * 0.3, rr * 0.35, rr * 0.3); });
      }
      // はしの 白線（ずっと）と、内がわ 1.2m の 短い線（4m に 1m）
      g.fillStyle = road.line; g.fillRect(0, 0, 10, H); g.fillRect(W - 10, 0, 10, H);
      g.globalAlpha = 0.92; for (const u of [0.15, 0.85]) g.fillRect(u * W - 6, 0, 12, 128); g.globalAlpha = 1;
      break;
    }
    case 'sand': {
      // 波の あと（ゆるい 曲線）
      g.lineWidth = 3;
      for (let i = 0; i < 22; i++) {
        const y0 = r() * H, amp = 6 + r() * 10, ph = r() * 6, x0 = r() * W * 0.6, len = 200 + r() * 500;
        wrapY(H, dy => { g.strokeStyle = rgba(road.dark, 0.18); g.beginPath(); for (let x = x0; x < x0 + len; x += 12) { const y = y0 + dy + Math.sin(x / 70 + ph) * amp; x === x0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); });
      }
      // 足あと
      for (let i = 0; i < 26; i++) {
        const x = 120 + r() * (W - 240), y = r() * H, dir = r() < 0.5 ? 1 : -1;
        for (let k = 0; k < 4; k++) {
          const ox = (k % 2 ? 14 : -14), yy = y + k * 70 * dir;
          wrapY(H, dy => { g.fillStyle = rgba('#a88a5a', 0.28); ellipse(g, x + ox, yy + dy, 9, 16); g.fillStyle = rgba('#fff3d0', 0.18); ellipse(g, x + ox + 2, yy + dy - 3, 6, 10); });
        }
      }
      // 貝
      for (let i = 0; i < 16; i++) {
        const x = r() * W * 0.95, y = r() * H, s = 6 + r() * 6, col = r.pick(['#ffffff', '#ffd6e0', '#ffe9c4']), rot = r() * 6.28;
        wrapY(H, dy => {
          g.save(); g.translate(x, y + dy); g.rotate(rot); g.fillStyle = col; g.beginPath(); g.moveTo(0, s); g.arc(0, 0, s, Math.PI * 1.15, Math.PI * 1.85); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(160,120,90,0.5)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, s); g.lineTo(Math.sin(k * 0.3) * s, -Math.cos(k * 0.3) * s * 0.9); g.stroke(); }
          g.restore();
        });
      }
      // 海がわ 1.5m は ぬれた砂
      const wet = g.createLinearGradient(W * 0.76, 0, W, 0); wet.addColorStop(0, rgba(road.wet, 0)); wet.addColorStop(0.3, rgba(road.wet, 0.75)); wet.addColorStop(1, rgba(road.wet, 0.95));
      g.fillStyle = wet; g.fillRect(W * 0.76, 0, W * 0.24, H);
      for (let i = 0; i < 30; i++) { const y = r() * H, x = W * (0.82 + r() * 0.16); g.fillStyle = 'rgba(255,255,255,0.22)'; ellipse(g, x, y, 10 + r() * 30, 2 + r() * 3); }
      break;
    }
    case 'snow': {
      // そりの あと 2本（u 0.35 と 0.65 の まわり）
      for (const u of [0.33, 0.37, 0.63, 0.67]) {
        g.strokeStyle = rgba(road.dark, 0.55); g.lineWidth = 10;
        g.beginPath(); for (let y = -8; y <= H + 8; y += 8) { const x = u * W + Math.sin(y / H * Math.PI * 2 + u * 20) * 5; y < 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
        g.beginPath(); for (let y = -8; y <= H + 8; y += 8) { const x = u * W + 6 + Math.sin(y / H * Math.PI * 2 + u * 20) * 5; y < 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
      }
      // 青い 影
      for (let i = 0; i < 18; i++) { const x = r() * W, y = r() * H, rx = 40 + r() * 90, ry = 20 + r() * 60; wrapY(H, dy => { g.fillStyle = rgba('#a9c4e8', 0.10); ellipse(g, x, y + dy, rx, ry); }); }
      // きらきら
      for (let i = 0; i < 420; i++) { g.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`; const s = r() < 0.9 ? 1.5 : 3; g.fillRect(r() * W, r() * H, s, s); }
      // はしの 青い 線
      g.fillStyle = rgba(road.line, 0.55); g.fillRect(0, 0, 8, H); g.fillRect(W - 8, 0, 8, H);
      break;
    }
    case 'asphalt': {
      // つぶつぶ（明るい 石）
      for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(200,205,225,${0.08 + r() * 0.16})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
      // つぎはぎ と ひび
      for (let i = 0; i < 5; i++) { const x = r() * W, y = r() * H, w = 90 + r() * 160, h = 70 + r() * 150; wrapY(H, dy => { g.fillStyle = 'rgba(20,22,32,0.22)'; g.fillRect(x, y + dy, w, h); }); }
      g.strokeStyle = 'rgba(15,16,24,0.45)'; g.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        const x = r() * W, y = r() * H, steps = []; for (let k = 0; k < 7; k++) steps.push([(r() - 0.5) * 50, (r() - 0.3) * 40]);
        wrapY(H, dy => { let xx = x, yy = y + dy; g.beginPath(); g.moveTo(xx, yy); for (const [ax, ay] of steps) { xx += ax; yy += ay; g.lineTo(xx, yy); } g.stroke(); });
      }
      // まん中の 黄色の 点線（4m に 2m）と はしの 白線
      g.fillStyle = road.center; g.fillRect(W / 2 - 10, 0, 20, H / 2);
      g.fillStyle = road.line; for (const u of [0.035, 0.965]) g.fillRect(u * W - 8, 0, 16, H);
      // マンホール
      const mx = W * 0.72, my = H * 0.62, mr = 44;
      g.fillStyle = '#2a2d3a'; g.beginPath(); g.arc(mx, my, mr + 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a4f62'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2a2d3a'; g.lineWidth = 3;
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(mx - mr * 0.85, my + k * 11); g.lineTo(mx + mr * 0.85, my + k * 11); g.stroke(); }
      // あぶらの しみ
      for (let i = 0; i < 4; i++) {
        const x = W * (0.3 + r() * 0.4), y = r() * H, rad = 20 + r() * 30;
        wrapY(H, dy => { const grd = g.createRadialGradient(x, y + dy, 0, x, y + dy, rad); grd.addColorStop(0, 'rgba(10,10,18,0.35)'); grd.addColorStop(1, 'rgba(10,10,18,0)'); g.fillStyle = grd; g.fillRect(x - rad, y + dy - rad, rad * 2, rad * 2); });
      }
      break;
    }
  }
  const t = texture(c, { repeat: true, aniso: true });
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

// 縁石の しま（1m ごと、v = s / 2）
export function curbTexture(a, b) {
  const c = canvas(64, 128), g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; g.fillRect(0, 64, 64, 64);
  const grd = g.createLinearGradient(0, 0, 64, 0); grd.addColorStop(0, 'rgba(0,0,0,0.25)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.12)'); grd.addColorStop(0.6, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 128);
  return texture(c, { repeat: true, aniso: true });
}

// ゼッケン（AE.2）
export function bibTexture(color, no) {
  const c = canvas(256, 200), g = c.getContext('2d');
  rrect(g, 8, 8, 240, 184, 28); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 10; g.strokeStyle = color; g.stroke();
  for (const [x, y] of [[30, 30], [226, 30], [30, 170], [226, 170]]) { g.fillStyle = '#c8ced8'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
  g.font = `800 132px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.lineJoin = 'round'; g.strokeText(String(no), 128, 112);
  g.fillStyle = color; g.fillText(String(no), 128, 112);
  return texture(c);
}

// 紙の門の 紙（AE.3）：しま ＋ まん中に 文字
export function paperTexture(cl) {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? cl.b : cl.a; g.fillRect(i * 64, 0, 64, S); }
  const r = rng(77);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const x = r() * S, y = r() * S; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 160, y + (r() - 0.5) * 160); g.stroke(); }
  g.font = `800 ${cl.text.length > 3 ? 104 : 124}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 26; g.strokeStyle = '#ffffff'; g.strokeText(cl.text, S / 2, S * 0.46);
  g.lineWidth = 10; g.strokeStyle = '#1d2b53'; g.strokeText(cl.text, S / 2, S * 0.46);
  g.fillStyle = cl.b === '#ffffff' ? '#e8483b' : cl.b; g.fillText(cl.text, S / 2, S * 0.46);
  return texture(c, { aniso: true });
}

// 距離の 看板（AE.4）
export function distSignTexture(m, last) {
  const c = canvas(512, 224), g = c.getContext('2d');
  g.fillStyle = last ? '#e8483b' : '#1d2b53'; rrect(g, 0, 0, 512, 224, 28); g.fill();
  g.fillStyle = last ? '#ff6a5a' : '#ffffff'; rrect(g, 12, 12, 488, 200, 20); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 50px ${FONT}`; g.fillStyle = last ? '#ffffff' : '#1d2b53'; g.fillText('のこり', 256, 56);
  g.font = `900 120px ${FONT}`; g.fillText(`${m}m`, 256, 148);
  return texture(c, { aniso: true });
}

// 横断幕（文字つき）
export function textBannerTexture(text, color, w = 1024, h = 160) {
  const c = canvas(w, h), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, color); grd.addColorStop(1, '#1d2b53');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const q = h / 4;
  for (const x0 of [0, w - q * 3]) for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) { g.fillStyle = (i + j) % 2 ? '#1d2433' : '#fff'; g.fillRect(x0 + i * q, j * q, q, q); }
  let fs = Math.round(h * 0.5);
  g.font = `800 ${fs}px ${FONT}`;
  const maxW = w - q * 8;
  while (g.measureText(text).width > maxW && fs > 20) { fs -= 2; g.font = `800 ${fs}px ${FONT}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = fs * 0.22; g.strokeStyle = '#1d2b53'; g.strokeText(text, w / 2, h * 0.54);
  g.fillStyle = '#fff'; g.fillText(text, w / 2, h * 0.54);
  return texture(c, { aniso: true });
}

// ネオンの 文字（加算の 板に はる）
export function neonTexture(text, color) {
  const c = canvas(512, 192), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 192);
  g.font = `800 112px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = color; g.lineWidth = 6; g.lineJoin = 'round';
  g.shadowColor = color; g.shadowBlur = 28;
  for (let i = 0; i < 3; i++) g.strokeText(text, 256, 100);
  g.shadowBlur = 8; g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.strokeText(text, 256, 100);
  g.strokeStyle = color; g.lineWidth = 5; g.shadowColor = color; g.shadowBlur = 18; rrect(g, 14, 14, 484, 164, 26); g.stroke();
  g.shadowBlur = 0;
  return texture(c);
}

// 道に はる 光る 矢印（加算）
export function chevronGlowTexture() {
  const c = canvas(128, 256), g = c.getContext('2d');
  g.strokeStyle = '#ffffff'; g.lineWidth = 22; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = '#ffffff'; g.shadowBlur = 16;
  for (const y of [40, 120, 200]) { g.beginPath(); g.moveTo(24, y + 28); g.lineTo(64, y - 12); g.lineTo(104, y + 28); g.stroke(); }
  return texture(c);
}
// 予告の 光る 線（加算、横に 長い）
export function lineGlowTexture() {
  const c = canvas(32, 64), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.42, 'rgba(255,255,255,0.7)'); grd.addColorStop(0.5, 'rgba(255,255,255,1)'); grd.addColorStop(0.58, 'rgba(255,255,255,0.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 64);
  return texture(c, { mip: false });
}
// ゲートの とびらの 数字
export function gateNumTexture(no, color) {
  const c = canvas(128, 160), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 160);
  g.fillStyle = color; rrect(g, 14, 18, 100, 124, 18); g.fill();
  g.font = `900 96px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.fillText(String(no), 64, 86);
  return texture(c);
}
// 縦の 光の すじ（ぬれた 道の 映りこみ）
export function streakTexture() {
  const c = canvas(64, 256), g = c.getContext('2d');
  const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, 256); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.35, 'rgba(0,0,0,1)'); gy.addColorStop(0.65, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0, 0, 64, 256);
  return texture(c, { mip: false });
}
