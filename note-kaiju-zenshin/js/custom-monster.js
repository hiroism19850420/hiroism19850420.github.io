// ユーザーが描いた絵 → 自動で色をつけた「紙の切り抜き怪獣」の素材を作る
// strokes: [[[x,y], ...], ...]（描画キャンバス上の 0〜1 座標）

const TAU = Math.PI * 2;

function hashStrokes(strokes) {
  let h = 2166136261;
  for (const s of strokes) for (const p of s) { h ^= Math.round(p[0] * 997 + p[1] * 991); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function strokesBBox(strokes) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0, n = 0;
  for (const s of strokes) for (const p of s) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); n++; }
  return { x0, y0, x1, y1, w: Math.max(0.001, x1 - x0), h: Math.max(0.001, y1 - y0), n };
}

export function inkLength(strokes) {
  let L = 0;
  for (const s of strokes) for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
  return L;
}

// 絵として成立しているか（小さすぎ・少なすぎを除外）
export function isUsable(strokes) {
  if (!strokes || !strokes.length) return false;
  const b = strokesBBox(strokes);
  return inkLength(strokes) > 0.6 && Math.max(b.w, b.h) > 0.25;
}

function dilate(src, w, h, r) {
  if (r <= 0) return src.slice();
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let cnt = 0;
    const row = y * w;
    for (let x = -r; x < w; x++) {
      const add = x + r; if (add < w && src[row + add]) cnt++;
      const rem = x - r - 1; if (rem >= 0 && src[row + rem]) cnt--;
      if (x >= 0) tmp[row + x] = cnt > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = -r; y < h; y++) {
      const add = y + r; if (add < h && tmp[add * w + x]) cnt++;
      const rem = y - r - 1; if (rem >= 0 && tmp[rem * w + x]) cnt--;
      if (y >= 0) out[y * w + x] = cnt > 0 ? 1 : 0;
    }
  }
  return out;
}
function erode(src, w, h, r) {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = src[i] ? 0 : 1;
  const d = dilate(inv, w, h, r);
  for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

// 手描き風の線（2回なぞる）
function sketchStroke(g, pts, w, col, rnd) {
  g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.lineWidth = w * (pass ? 0.55 : 1);
    g.globalAlpha = pass ? 0.5 : 0.95;
    g.beginPath();
    pts.forEach((p, i) => {
      const j = pass ? 1.2 : 0.4;
      const x = p[0] + (rnd() - 0.5) * j, y = p[1] + (rnd() - 0.5) * j;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    if (pts.length === 1) g.lineTo(pts[0][0] + 0.1, pts[0][1]);
    g.stroke();
  }
  g.globalAlpha = 1;
}

const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360},${s}%,${l}%)`;

// メイン：色つきの切り抜き画像・輪郭マスク・弱点などの位置
export function buildArt(strokes) {
  const seed = hashStrokes(strokes);
  const rnd = rng(seed);
  const bb = strokesBBox(strokes);
  const maxD = Math.max(bb.w, bb.h);
  const pad = maxD * 0.08;
  const fw = bb.w + pad * 2, fh = bb.h + pad * 2;
  // 作業解像度
  const WM = 256;
  const s = WM / Math.max(fw, fh);
  const w = Math.max(16, Math.round(fw * s)), h = Math.max(16, Math.round(fh * s));
  const toW = (p) => [(p[0] - bb.x0 + pad) * s, (p[1] - bb.y0 + pad) * s];
  const lineW = Math.max(3, 0.022 * Math.max(w, h));

  // 線のマスク
  const wc = document.createElement('canvas'); wc.width = w; wc.height = h;
  const wg = wc.getContext('2d');
  wg.strokeStyle = '#000'; wg.lineCap = 'round'; wg.lineJoin = 'round'; wg.lineWidth = lineW;
  for (const st of strokes) {
    wg.beginPath();
    st.forEach((p, i) => { const q = toW(p); if (i) wg.lineTo(q[0], q[1]); else wg.moveTo(q[0], q[1]); });
    if (st.length === 1) { const q = toW(st[0]); wg.lineTo(q[0] + 0.5, q[1]); }
    wg.stroke();
  }
  const id = wg.getImageData(0, 0, w, h).data;
  const S = new Uint8Array(w * h);
  for (let i = 0; i < S.length; i++) S[i] = id[i * 4 + 3] > 60 ? 1 : 0;

  // すき間を少し閉じてから外側を塗りつぶし → 内側 = シルエット
  const R1 = Math.max(3, Math.round(w * 0.018 + 2));
  const D = dilate(S, w, h, R1);
  const outside = new Uint8Array(w * h);
  const q = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const push = (i) => { if (!outside[i] && !D[i]) { outside[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) {
    const i = q[qh++], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  let sil = new Uint8Array(w * h);
  for (let i = 0; i < sil.length; i++) sil[i] = outside[i] ? 0 : 1;
  sil = erode(sil, w, h, R1);
  for (let i = 0; i < sil.length; i++) if (S[i]) sil[i] = 1;

  // 囲まれた領域に番号をふる
  const Sd = dilate(S, w, h, 1);
  const label = new Int32Array(w * h).fill(-1);
  const regions = [];
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || !sil[i] || Sd[i]) continue;
    const r = { id: regions.length, area: 0, sx: 0, sy: 0, x0: w, y0: h, x1: 0, y1: 0 };
    qh = 0; qt = 0; q[qt++] = i; label[i] = r.id;
    while (qh < qt) {
      const j = q[qh++], x = j % w, y = (j / w) | 0;
      r.area++; r.sx += x; r.sy += y;
      if (x < r.x0) r.x0 = x; if (x > r.x1) r.x1 = x; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y;
      const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
      for (const k of nb) if (k >= 0 && label[k] === -1 && sil[k] && !Sd[k]) { label[k] = r.id; q[qt++] = k; }
    }
    r.cx = r.sx / r.area; r.cy = r.sy / r.area;
    regions.push(r);
  }
  let silArea = 0, scx = 0, scy = 0, top = h, bottom = 0;
  for (let i = 0; i < sil.length; i++) if (sil[i]) { silArea++; const x = i % w, y = (i / w) | 0; scx += x; scy += y; if (y < top) top = y; if (y > bottom) bottom = y; }
  scx /= silArea || 1; scy /= silArea || 1;
  const silH = Math.max(1, bottom - top);

  // 配色（絵ごとに自動）
  const hue = Math.floor(rnd() * 360);
  const palette = [
    hsl(hue, 55, 70), hsl(hue + 35, 62, 78), hsl(hue - 40, 48, 64), hsl(hue + 180, 45, 78),
    hsl(hue + 90, 50, 74), hsl(hue, 35, 86), hsl(hue - 90, 55, 72),
  ];
  const sorted = regions.slice().sort((a, b) => b.area - a.area);
  const colorOf = new Map();
  const eyes = [];
  let pi = 1;
  sorted.forEach((r, k) => {
    const rw = r.x1 - r.x0 + 1, rh = r.y1 - r.y0 + 1;
    const round = rw / rh > 0.5 && rw / rh < 2 && r.area / (rw * rh) > 0.5;
    const small = r.area < silArea * 0.04 && r.area > 6;
    const upper = r.cy < top + silH * 0.55;
    if (k > 0 && small && round && upper) { colorOf.set(r.id, '#ffffff'); eyes.push(r); }
    else if (k === 0) colorOf.set(r.id, palette[0]);
    else colorOf.set(r.id, palette[(pi++) % palette.length]);
  });
  const parse = (c) => { const cc = document.createElement('canvas').getContext('2d'); cc.fillStyle = c; cc.fillRect(0, 0, 1, 1); return cc.getImageData(0, 0, 1, 1).data; };
  const base = parse(palette[0]);
  const rgbCache = new Map();
  const rgb = (c) => { if (!rgbCache.has(c)) rgbCache.set(c, parse(c)); return rgbCache.get(c); };

  // 作業解像度の色画像
  const cimg = wg.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    if (!sil[i]) continue;
    const c = label[i] >= 0 ? rgb(colorOf.get(label[i])) : base;
    cimg.data[i * 4] = c[0]; cimg.data[i * 4 + 1] = c[1]; cimg.data[i * 4 + 2] = c[2]; cimg.data[i * 4 + 3] = 255;
  }
  wg.clearRect(0, 0, w, h);
  wg.putImageData(cimg, 0, 0);

  // 512 へ拡大して仕上げ
  const K = 512 / Math.max(w, h);
  const cw = Math.round(w * K), ch = Math.round(h * K);
  const color = document.createElement('canvas'); color.width = cw; color.height = ch;
  const g = color.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(wc, 0, 0, cw, ch);
  // クレヨンの質感
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 900; i++) {
    const x = rnd() * cw, y = rnd() * ch, L = 6 + rnd() * 18;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(40,30,60,0.07)';
    g.lineWidth = 1 + rnd() * 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + L * 0.8, y - L * 0.5); g.stroke();
  }
  // ふちの影
  g.globalCompositeOperation = 'source-over';
  // 目の黒目
  for (const e of eyes) {
    const ex = e.cx * K, ey = e.cy * K, er = Math.sqrt(e.area / Math.PI) * K;
    g.fillStyle = '#1d2a44';
    g.beginPath(); g.arc(ex + er * 0.15, ey + er * 0.1, Math.max(3, er * 0.45), 0, TAU); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(ex - er * 0.05, ey - er * 0.12, Math.max(1.2, er * 0.14), 0, TAU); g.fill();
  }
  // 描いた線
  const toC = (p) => [(p[0] - bb.x0 + pad) * s * K, (p[1] - bb.y0 + pad) * s * K];
  for (const st of strokes) sketchStroke(g, st.map(toC), lineW * K * 0.9, '#1d2a44', rnd);

  // 輪郭マスク（少し太らせる）
  const mw = dilate(sil, w, h, Math.max(2, Math.round(w * 0.012)));
  const mc = document.createElement('canvas'); mc.width = w; mc.height = h;
  const mg = mc.getContext('2d');
  const mimg = mg.createImageData(w, h);
  for (let i = 0; i < w * h; i++) if (mw[i]) { mimg.data[i * 4] = mimg.data[i * 4 + 1] = mimg.data[i * 4 + 2] = 255; mimg.data[i * 4 + 3] = 255; }
  mg.putImageData(mimg, 0, 0);
  const mask = document.createElement('canvas'); mask.width = cw; mask.height = ch;
  const mk = mask.getContext('2d'); mk.imageSmoothingEnabled = true; mk.drawImage(mc, 0, 0, cw, ch);

  // 弱点：いちばん大きな塗り領域（なければ全体）の重心
  const body = sorted.find(r => !eyes.includes(r) && r.area > silArea * 0.05);
  let wx = body ? body.cx : scx, wy = body ? body.cy : scy;
  if (wy < top + silH * 0.35) wy = top + silH * 0.5;
  // 口：頭（上の35%）の中心
  let hx = 0, hn = 0;
  for (let y = top; y < top + silH * 0.35; y++) for (let x = 0; x < w; x++) if (sil[y * w + x]) { hx += x; hn++; }
  hx = hn ? hx / hn : w / 2;
  const headRows = [];
  for (let y = top; y < top + silH * 0.35; y++) { let a = w, b = -1; for (let x = 0; x < w; x++) if (sil[y * w + x]) { if (x < a) a = x; b = x; } if (b >= 0) headRows.push(b - a); }
  const headW = headRows.length ? Math.max(...headRows) : w * 0.4;

  return {
    color, mask, aspect: cw / ch, seed, hue,
    weak: { u: wx / w, v: wy / h, r: Math.min(0.16, Math.max(0.07, 0.12 * Math.min(1, silH / h))) },
    mouth: { u: hx / w, v: (top + silH * 0.24) / h },
    mouthSpread: Math.min(0.2, (headW / w) * 0.3),
    headTop: { u: hx / w, v: top / h },
    neckV: (top + silH * 0.42) / h,
    bottomV: bottom / h,
    eyes: eyes.length,
  };
}

// ノートに描かれた平面の落書き（タイトル・封印後）
export function drawCustomDoodle(g, W, H, strokes, glow = 0, art = null) {
  g.clearRect(0, 0, W, H);
  if (!strokes || !strokes.length) return;
  const bb = strokesBBox(strokes);
  const m = Math.max(bb.w, bb.h);
  const sc = (W * 0.86) / m;
  const ox = W / 2 - (bb.x0 + bb.w / 2) * sc, oy = H / 2 - (bb.y0 + bb.h / 2) * sc;
  const rnd = rng(hashStrokes(strokes));
  const col = glow > 0 ? `rgb(${Math.round(36 + 200 * glow)},${Math.round(54 + 30 * glow)},${Math.round(94 - 40 * glow)})` : '#24365e';
  for (const st of strokes) sketchStroke(g, st.map(p => [p[0] * sc + ox, p[1] * sc + oy]), W / 512 * 7, col, rnd);
  if (art) {
    // 胸の赤い消し残し
    const fx = (u) => ((bb.x0 - m * 0.08 + u * (bb.w + m * 0.16)) * sc + ox);
    const fy = (v) => ((bb.y0 - m * 0.08 + v * (bb.h + m * 0.16)) * sc + oy);
    const x = fx(art.weak.u), y = fy(art.weak.v), r = W * 0.05;
    g.fillStyle = 'rgba(216,52,59,0.75)';
    g.beginPath(); g.ellipse(x, y, r, r * 0.85, 0.2, 0, TAU); g.fill();
    g.strokeStyle = '#b8222a'; g.lineWidth = W / 512 * 4; g.beginPath();
    for (let i = 0; i < 30; i++) { const a = i * 0.55, rr = r * (0.2 + (i % 7) * 0.12); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); }
    g.stroke();
  }
}

const NAME_A = ['モジャ', 'グルグ', 'トゲト', 'ペタペ', 'ギザギ', 'ポコポ', 'ニョロ', 'ガブガ', 'クネク', 'ドスド'];
const NAME_B = ['ドン', 'ゴン', 'ラス', 'ザウルス', 'ボン', 'ガー'];
export function autoName(strokes) {
  const r = rng(hashStrokes(strokes) + 3);
  return NAME_A[Math.floor(r() * NAME_A.length)] + NAME_B[Math.floor(r() * NAME_B.length)];
}

// 保存用に点を間引いて整数化
export function packStrokes(strokes) {
  return strokes.map(s => s.map(p => [Math.round(p[0] * 1000), Math.round(p[1] * 1000)]));
}
export function unpackStrokes(packed) {
  if (!Array.isArray(packed)) return null;
  const out = [];
  for (const s of packed) {
    if (!Array.isArray(s)) return null;
    const st = [];
    for (const p of s) {
      if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return null;
      st.push([Math.min(1, Math.max(0, p[0] / 1000)), Math.min(1, Math.max(0, p[1] / 1000))]);
    }
    if (st.length) out.push(st);
  }
  return out.length ? out : null;
}
