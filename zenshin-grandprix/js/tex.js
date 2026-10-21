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
