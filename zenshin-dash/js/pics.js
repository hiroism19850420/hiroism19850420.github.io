// 操作の合図の ピクトグラム（4.11、付録AC.5）。viewBox 0 0 100 100、線の太さ 8
const P = {
  run: {
    heads: [[52, 14]],
    lines: ['M50 25 L46 55', 'M48 32 L62 42 L70 34', 'M48 32 L36 44 L30 38', 'M46 55 L62 62 L58 80', 'M46 55 L40 75 L44 92'],
    thin: ['M24 94 L34 94', 'M60 96 L70 96', 'M74 86 L82 86']
  },
  wheel: {
    heads: [[50, 14]],
    lines: ['M50 25 L50 60', 'M50 30 L36 38 L36 41', 'M50 30 L64 38 L64 41', 'M50 60 L42 92', 'M50 60 L58 92'],
    circles: [[50, 42, 16]]
  },
  wheelR: {
    heads: [[50, 14]],
    lines: ['M50 25 L50 60', 'M50 30 L38 31 L36 34', 'M50 30 L62 45 L62 48', 'M50 60 L42 92', 'M50 60 L58 92'],
    circles: [[50, 42, 16]], arrow: 'M74 30 A22 22 0 0 1 78 56', arrowHead: 'M78 56 L70 52 M78 56 L82 47'
  },
  wheelL: {
    heads: [[50, 14]],
    lines: ['M50 25 L50 60', 'M50 30 L62 31 L64 34', 'M50 30 L38 45 L38 48', 'M50 60 L42 92', 'M50 60 L58 92'],
    circles: [[50, 42, 16]], arrow: 'M26 30 A22 22 0 0 0 22 56', arrowHead: 'M22 56 L30 52 M22 56 L18 47'
  },
  jump: {
    heads: [[50, 10]],
    lines: ['M50 21 L50 50', 'M50 28 L34 18', 'M50 28 L66 18', 'M50 50 L40 64 L46 76', 'M50 50 L60 64 L54 76'],
    shadow: [50, 94, 18, 4]
  },
  squat: {
    heads: [[50, 42]],
    lines: ['M20 22 L80 22', 'M50 53 L52 72', 'M51 58 L66 66', 'M52 72 L68 76 L64 92', 'M52 72 L38 80 L42 92']
  },
  banzai: {
    heads: [[50, 30]],
    lines: ['M50 41 L50 70', 'M50 46 L36 26 L32 10', 'M50 46 L64 26 L68 10', 'M50 70 L42 94', 'M50 70 L58 94'],
    thin: ['M18 8 L26 8', 'M22 4 L22 12', 'M78 8 L86 8', 'M82 4 L82 12']
  },
  lean: {
    rot: 15,
    heads: [[50, 14]],
    lines: ['M50 25 L50 60', 'M50 32 L38 50', 'M50 32 L62 50', 'M50 60 L42 92', 'M50 60 L58 92'],
    arrow: 'M70 20 A30 30 0 0 1 84 46', arrowHead: 'M84 46 L76 43 M84 46 L87 37'
  },
  cam: {
    rects: [[18, 30, 64, 44, 10]], circles: [[50, 52, 13]], lines: ['M36 30 L42 20 L58 20 L64 30']
  },
  snow: {
    lines: ['M50 12 L50 88', 'M17 31 L83 69', 'M17 69 L83 31', 'M42 18 L50 26 L58 18', 'M42 82 L50 74 L58 82', 'M20 40 L28 35 L24 26', 'M80 60 L72 65 L76 74', 'M20 60 L28 65 L24 74', 'M80 40 L72 35 L76 26']
  },
  star: { fill: 'M50 6 L62 38 L96 38 L68 58 L79 92 L50 71 L21 92 L32 58 L4 38 L38 38 Z' }
};


// ---------- ぜんしんダッシュ で 足した 絵（付録BM）。左右は 鏡の 向き（プレイヤーの 右 ＝ 絵の 右） ----------
const ADD = {
  dodgeR: {
    heads: [[44, 14]],
    lines: ['M44 25 L48 58', 'M45 32 L32 44', 'M45 32 L60 40', 'M48 58 L40 90', 'M48 58 L64 86'],
    arrow: 'M62 20 L88 20', arrowHead: 'M88 20 L80 13 M88 20 L80 27'
  },
  handR: {
    heads: [[50, 26]],
    lines: ['M50 37 L50 66', 'M50 42 L64 24 L68 8', 'M50 42 L38 56 L36 66', 'M50 66 L42 94', 'M50 66 L58 94'],
    thin: ['M78 8 L86 8', 'M82 4 L82 12']
  },
  armR: {
    heads: [[40, 16]],
    lines: ['M40 27 L40 60', 'M40 33 L64 33 L88 33', 'M40 33 L30 50', 'M40 60 L32 92', 'M40 60 L48 92'],
    thin: ['M93 24 L98 19', 'M94 42 L99 47']
  },
  legR: {
    heads: [[44, 12]],
    lines: ['M44 23 L44 56', 'M44 30 L32 44', 'M44 30 L56 44', 'M44 56 L38 92', 'M44 56 L68 72 L88 80'],
    thin: ['M92 72 L97 67', 'M93 88 L98 92']
  },
  crouchRun: {
    heads: [[58, 34]],
    lines: ['M55 44 L40 62', 'M50 50 L64 58', 'M50 50 L36 50', 'M40 62 L56 74 L54 92', 'M40 62 L28 78 L34 92'],
    thin: ['M12 18 L88 18']
  },
  swing: {
    heads: [[50, 14]],
    lines: ['M50 25 L50 60', 'M50 32 L66 22 L74 30', 'M50 32 L34 46 L30 58', 'M50 60 L42 92', 'M50 60 L58 92'],
    thin: ['M80 12 A12 12 0 0 1 86 30', 'M22 50 A12 12 0 0 0 20 68']
  },
  foot: { fill: 'M42 34 C33 46 34 70 46 80 C55 88 66 79 62 62 C60 48 58 33 51 29 C47 27 44 30 42 34 Z M40 12 A6 6 0 1 1 40.1 12 Z M52 8 A5 5 0 1 1 52.1 8 Z M62 12 A4.5 4.5 0 1 1 62.1 12 Z M70 20 A4 4 0 1 1 70.1 20 Z' },
  ball: { circles: [[50, 50, 34]], lines: ['M18 50 Q50 32 82 50', 'M50 16 Q34 50 50 84'] },
  paper: { rects: [[16, 18, 68, 70, 4]], lines: ['M30 18 L50 60 L36 88', 'M70 18 L50 60 L64 88'] },
  hand: { lines: ['M40 88 L40 50', 'M40 50 L40 20', 'M50 48 L50 14', 'M60 50 L60 18', 'M70 56 L70 28', 'M40 66 Q30 58 24 48', 'M40 88 L70 88 L70 56'] },
  arrowR: { lines: ['M14 50 L80 50', 'M58 28 L82 50 L58 72'] },
  hurdle: { lines: ['M12 70 L88 70', 'M22 70 L22 90', 'M78 70 L78 90'], heads: [[50, 20]], thin: ['M50 31 L40 50', 'M50 31 L62 48'] },
  bar: { lines: ['M10 24 L90 24', 'M16 24 L16 92', 'M84 24 L84 92'], heads: [[50, 56]] },
  block: { rects: [[12, 34, 46, 54, 6]], arrow: 'M64 60 L90 60', arrowHead: 'M90 60 L82 53 M90 60 L82 67' },
  finish: { lines: ['M20 92 L20 8'], rects: [[20, 8, 62, 40, 2]], thin: ['M20 28 L82 28', 'M40 8 L40 48', 'M61 8 L61 48'] }
};
function mirrorPic(p) {
  const fx = d => d.replace(/([MLQCA])\s*([-\d.]+)\s+([-\d.]+)/g, (m, c, x, y) => `${c}${100 - +x} ${y}`);
  return {
    heads: (p.heads || []).map(([x, y]) => [100 - x, y]),
    lines: (p.lines || []).map(fx), thin: (p.thin || []).map(fx),
    circles: (p.circles || []).map(([x, y, r]) => [100 - x, y, r]),
    rects: (p.rects || []).map(([x, y, w, h, r]) => [100 - x - w, y, w, h, r]),
    arrow: p.arrow && fx(p.arrow), arrowHead: p.arrowHead && fx(p.arrowHead)
  };
}
for (const k of ['dodgeR', 'handR', 'armR', 'legR', 'arrowR']) ADD[k.replace(/R$/, 'L')] = mirrorPic(ADD[k]);
Object.assign(P, ADD);

// SVG の文字列（currentColor）
export function picSVG(name, cls = '') {
  const p = P[name]; if (!p) return '';
  let s = `<svg class="${cls}" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">`;
  if (p.rot) s += `<g transform="rotate(${p.rot} 50 50)">`;
  for (const [x, y] of p.heads || []) s += `<circle cx="${x}" cy="${y}" r="9" fill="currentColor" stroke="none"/>`;
  for (const d of p.lines || []) s += `<path d="${d}"/>`;
  for (const d of p.thin || []) s += `<path d="${d}" stroke-width="5"/>`;
  for (const [x, y, r] of p.circles || []) s += `<circle cx="${x}" cy="${y}" r="${r}" stroke-width="6"/>`;
  for (const [x, y, w, h, r] of p.rects || []) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  if (p.shadow) s += `<ellipse cx="${p.shadow[0]}" cy="${p.shadow[1]}" rx="${p.shadow[2]}" ry="${p.shadow[3]}" fill="currentColor" stroke="none" opacity=".35"/>`;
  if (p.arrow) s += `<path d="${p.arrow}" stroke-width="6"/><path d="${p.arrowHead}" stroke-width="6"/>`;
  if (p.fill) s += `<path d="${p.fill}" fill="currentColor" stroke="none"/>`;
  if (p.rot) s += `</g>`;
  return s + '</svg>';
}

// キャンバスに描く（看板の絵）
export function drawPic(g, name, x, y, size, color) {
  const p = P[name]; if (!p) return;
  g.save(); g.translate(x, y); g.scale(size / 100, size / 100);
  if (p.rot) { g.translate(50, 50); g.rotate(p.rot * Math.PI / 180); g.translate(-50, -50); }
  g.strokeStyle = color; g.fillStyle = color; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 8;
  for (const [hx, hy] of p.heads || []) { g.beginPath(); g.arc(hx, hy, 9, 0, Math.PI * 2); g.fill(); }
  for (const d of p.lines || []) g.stroke(new Path2D(d));
  g.lineWidth = 5; for (const d of p.thin || []) g.stroke(new Path2D(d));
  g.lineWidth = 6;
  for (const [cx, cy, r] of p.circles || []) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  for (const [rx, ry, rw, rh, rr] of p.rects || []) { g.beginPath(); g.roundRect ? g.roundRect(rx, ry, rw, rh, rr) : g.rect(rx, ry, rw, rh); g.stroke(); }
  if (p.shadow) { g.globalAlpha = 0.35; g.beginPath(); g.ellipse(p.shadow[0], p.shadow[1], p.shadow[2], p.shadow[3], 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
  if (p.arrow) { g.stroke(new Path2D(p.arrow)); g.stroke(new Path2D(p.arrowHead)); }
  if (p.fill) g.fill(new Path2D(p.fill));
  g.restore();
}
