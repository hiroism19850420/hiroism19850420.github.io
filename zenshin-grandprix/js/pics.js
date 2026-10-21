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
  if (p.shadow) { g.globalAlpha = 0.35; g.beginPath(); g.ellipse(p.shadow[0], p.shadow[1], p.shadow[2], p.shadow[3], 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
  if (p.arrow) { g.stroke(new Path2D(p.arrow)); g.stroke(new Path2D(p.arrowHead)); }
  if (p.fill) g.fill(new Path2D(p.fill));
  g.restore();
}
