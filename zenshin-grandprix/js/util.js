// 数学の 小さな 道具
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// x を target へ 時定数 tau で 近づける
export const damp = (x, target, tau, dt) => tau <= 0 ? target : x + (target - x) * (1 - Math.exp(-dt / tau));
export const wrapAngle = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const toDeg = r => r * 180 / Math.PI;
export const toRad = d => d * Math.PI / 180;

// 整数から 0〜1 の 決まった 数
export function hash(...a) {
  let h = 2166136261 >>> 0;
  for (const v of a) { h ^= (v | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// 決まった 順の 乱数（mulberry32）
export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  return f;
}
// なめらかな 値ノイズ（-1〜1）
function vgrid(ix, iy, s) { return hash(ix, iy, s) * 2 - 1; }
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = vgrid(ix, iy, seed), b = vgrid(ix + 1, iy, seed), c = vgrid(ix, iy + 1, seed), d = vgrid(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

// 1ユーロ フィルター（ゆっくりは ぶれを へらし、速いときは おくれを へらす）
export class OneEuro {
  constructor(minCutoff = 1.2, beta = 0.04, dCutoff = 1.0) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff; this.reset(); }
  reset() { this.x = null; this.dx = 0; this.t = null; }
  alpha(fc, dt) { const r = 2 * Math.PI * fc * dt; return r / (r + 1); }
  filter(x, t) {
    if (this.x == null) { this.x = x; this.t = t; return x; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const dx = (x - this.x) / dt;
    this.dx += (dx - this.dx) * this.alpha(this.dCutoff, dt);
    const fc = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += (x - this.x) * this.alpha(fc, dt);
    return this.x;
  }
}

// ばね（目標 0 のまわりで ゆれる）
export class Spring {
  constructor(k = 90, c = 7, max = 0.9) { this.k = k; this.c = c; this.max = max; this.x = 0; this.v = 0; this.target = 0; }
  kick(v) { this.v += v; }
  step(dt, force = 0) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.k * (this.x - this.target) - this.c * this.v + force;
      this.v += a * h; this.x += this.v * h;
      if (this.x > this.max) { this.x = this.max; this.v *= -0.3; }
      if (this.x < -this.max) { this.x = -this.max; this.v *= -0.3; }
    }
    return this.x;
  }
}

// 時刻と値の 輪のバッファ（直前 何秒かの 最大−最小）
export class History {
  constructor(n = 64) { this.t = new Float64Array(n); this.v = new Float32Array(n); this.n = n; this.i = 0; this.len = 0; }
  push(t, v) { this.t[this.i] = t; this.v[this.i] = v; this.i = (this.i + 1) % this.n; this.len = Math.min(this.n, this.len + 1); }
  range(t0) {
    let mn = Infinity, mx = -Infinity;
    for (let k = 0; k < this.len; k++) { const j = (this.i - 1 - k + this.n) % this.n; if (this.t[j] < t0) break; const v = this.v[j]; if (v < mn) mn = v; if (v > mx) mx = v; }
    return mx > mn ? mx - mn : 0;
  }
  last(k = 0) { const j = (this.i - 1 - k + this.n * 2) % this.n; return k < this.len ? this.v[j] : 0; }
  lastT(k = 0) { const j = (this.i - 1 - k + this.n * 2) % this.n; return k < this.len ? this.t[j] : -1e9; }
  countSince(t0) { let c = 0; for (let k = 0; k < this.len; k++) { const j = (this.i - 1 - k + this.n) % this.n; if (this.t[j] < t0) break; c++; } return c; }
  clear() { this.len = 0; this.i = 0; }
}

export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60), s = sec - m * 60;
  const ss = Math.floor(s), d = Math.floor((s - ss) * 10);
  return `${m}:${String(ss).padStart(2, '0')}.${d}`;
}

// 色（'#rrggbb'）→ [r, g, b]（0〜1、sRGB のまま）
export function hex3(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
// sRGB → 線形（頂点の色に入れるとき）
export const s2l = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
export function hexLin(h) { return hex3(h).map(s2l); }
export function mixHex(a, b, t) { const A = hex3(a), B = hex3(b); return A.map((v, i) => lerp(v, B[i], t)); }

export const $ = id => document.getElementById(id);
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
