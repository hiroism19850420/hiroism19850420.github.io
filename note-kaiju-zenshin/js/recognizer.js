// ShapeRecognizer：点列の幾何学的特徴によるルールベース判定（端末内処理のみ）
import { STROKE } from './config.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// 均等間隔への再サンプリング
export function resample(pts, n) {
  const L = pathLength(pts);
  if (L <= 0 || pts.length < 2) return pts.map(p => ({ x: p.x, y: p.y }));
  const step = L / (n - 1);
  const out = [{ x: pts[0].x, y: pts[0].y }];
  let acc = 0;
  let prev = { x: pts[0].x, y: pts[0].y };
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i];
    let d = dist(prev, cur);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
      out.push(q);
      prev = q;
      d = dist(prev, cur);
      acc = 0;
    }
    acc += d;
    prev = { x: cur.x, y: cur.y };
  }
  while (out.length < n) out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return out;
}

export function pointSegDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function pointLineDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / L;
}

// 開いた折れ線の Douglas-Peucker
function dp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let maxD = -1, idx = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointSegDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const a = dp(pts.slice(0, idx + 1), eps);
    const b = dp(pts.slice(idx), eps);
    return a.slice(0, -1).concat(b);
  }
  return [pts[0], pts[pts.length - 1]];
}

// 閉じた輪郭の主要な角の数
function cornerCountClosed(rs, eps) {
  // 最も離れた2点で輪郭を分割して DP
  let a = 0, b = 0, best = -1;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const d = dist(rs[i], rs[j]);
    if (d > best) { best = d; a = i; b = j; }
  }
  const ring = rs.slice(0, -1); // 末尾は始点付近なので除外
  const n = ring.length;
  if (a >= n) a = n - 1;
  if (b >= n) b = n - 1;
  const half1 = [], half2 = [];
  for (let i = a; ; i = (i + 1) % n) { half1.push(ring[i]); if (i === b) break; }
  for (let i = b; ; i = (i + 1) % n) { half2.push(ring[i]); if (i === a) break; }
  const s1 = dp(half1, eps), s2 = dp(half2, eps);
  let verts = s1.slice(0, -1).concat(s2.slice(0, -1));
  // ほぼ一直線の頂点を除く
  let changed = true;
  while (changed && verts.length > 3) {
    changed = false;
    for (let i = 0; i < verts.length; i++) {
      const p = verts[(i - 1 + verts.length) % verts.length], c = verts[i], q = verts[(i + 1) % verts.length];
      const v1x = c.x - p.x, v1y = c.y - p.y, v2x = q.x - c.x, v2y = q.y - c.y;
      const ang = Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
      if (ang < 0.45) { verts.splice(i, 1); changed = true; break; }
    }
  }
  return verts;
}

// 鋭い曲がりの数（丸の「極端な角」チェック）
function sharpTurns(rs, th = 1.15) {
  const ring = rs.slice(0, -1);
  const n = ring.length;
  const k = 2;
  const turns = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i - k + n) % n], c = ring[i], q = ring[(i + k) % n];
    const v1x = c.x - p.x, v1y = c.y - p.y, v2x = q.x - c.x, v2y = q.y - c.y;
    turns.push(Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y)));
  }
  let count = 0;
  for (let i = 0; i < n; i++) {
    const t = turns[i];
    if (t > th && t >= turns[(i - 1 + n) % n] && t >= turns[(i + 1) % n]) count++;
  }
  return count;
}

// 角のある形（四角・五角形・一筆書きの星など）：鋭い曲がりが 3つ以上ある 閉じた形は 三角と同じ 攻撃にする
// 六角形（1つの角で 60° 曲がる）まで 拾えるように、丸の判定より ゆるい 0.8 rad（約46°）で 数える
const ANGULAR_MIN = 3, ANGULAR_TURN = 0.8;
// 攻撃の見た目用：描いた輪郭を 角だけの折れ線にする（三角なら3点、四角なら4点、星なら5点）
function outline(loop) {
  const bb = bbox(loop);
  const v = cornerCountClosed(loop, Math.max(6, 0.07 * Math.max(bb.w, bb.h)));
  return v.length >= 3 ? v.map(p => ({ x: p.x, y: p.y })) : null;
}
function isAngular(loop, tri) {
  return sharpTurns(loop, ANGULAR_TURN) >= ANGULAR_MIN && tri.area >= 1200;
}

function sweptAngle(rs, c) {
  let total = 0;
  for (let i = 1; i < rs.length; i++) {
    const a0 = Math.atan2(rs[i - 1].y - c.y, rs[i - 1].x - c.x);
    const a1 = Math.atan2(rs[i].y - c.y, rs[i].x - c.x);
    let d = a1 - a0;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    total += d;
  }
  return Math.abs(total);
}

// 描き終わりの行き過ぎ（重なり）を切り取り、1周ぶんの輪郭にする
function trimLoop(rs) {
  const n = rs.length, k = Math.floor(n * 0.25);
  let best = Infinity, bi = 0, bj = n - 1;
  for (let i = 0; i <= k; i++) for (let j = n - 1 - k; j < n; j++) {
    const d = dist(rs[i], rs[j]);
    if (d < best - 1e-9 || (Math.abs(d - best) <= 1e-9 && j - i > bj - bi)) { best = d; bi = i; bj = j; }
  }
  if (bi === 0 && bj === n - 1) return rs;
  return resample(rs.slice(bi, bj + 1), n);
}

function triArea(A, B, C) { return Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2; }

function evalTriangle(rs, bb) {
  const cx = rs.reduce((s, p) => s + p.x, 0) / rs.length;
  const cy = rs.reduce((s, p) => s + p.y, 0) / rs.length;
  let A = rs[0], best = -1;
  for (const p of rs) { const d = Math.hypot(p.x - cx, p.y - cy); if (d > best) { best = d; A = p; } }
  let B = rs[0]; best = -1;
  for (const p of rs) { const d = dist(p, A); if (d > best) { best = d; B = p; } }
  let C = rs[0]; best = -1;
  for (const p of rs) { const d = pointLineDist(p, A, B); if (d > best) { best = d; C = p; } }
  const ab = dist(A, B), bc = dist(B, C), ca = dist(C, A);
  const maxSide = Math.max(ab, bc, ca);
  const area = triArea(A, B, C);
  let err = 0;
  for (const p of rs) err += Math.min(pointSegDist(p, A, B), pointSegDist(p, B, C), pointSegDist(p, C, A));
  err /= rs.length;
  const errRatio = err / (maxSide || 1);
  // 最小内角
  const ang = (P, Q, R) => { const a = Math.atan2(Q.y - P.y, Q.x - P.x), b = Math.atan2(R.y - P.y, R.x - P.x); let d = Math.abs(a - b); if (d > Math.PI) d = Math.PI * 2 - d; return d; };
  const minAng = Math.min(ang(A, B, C), ang(B, C, A), ang(C, A, B)) * 180 / Math.PI;
  const corners = cornerCountClosed(rs, Math.max(6, 0.09 * maxSide)).length;
  const ok = Math.min(ab, bc, ca) >= 45 && area >= 2000 && errRatio <= 0.12 && minAng >= 18 && (corners === 3 || (corners === 4 && errRatio <= 0.07));
  // 候補スコア（0〜1）
  const score = Math.max(0, 1 - errRatio / 0.2) * (corners === 3 ? 1 : corners === 4 ? 0.6 : 0.3);
  return { ok, score, verts: [A, B, C], errRatio, corners, minAng, area };
}

function evalCircle(rs, bb) {
  const aspect = bb.w / (bb.h || 1);
  const c = { x: bb.cx, y: bb.cy };
  const ds = rs.slice(0, -1).map(p => Math.hypot(p.x - c.x, p.y - c.y));
  const m = ds.reduce((s, d) => s + d, 0) / ds.length;
  const sd = Math.sqrt(ds.reduce((s, d) => s + (d - m) ** 2, 0) / ds.length);
  const cv = sd / (m || 1);
  const sharp = sharpTurns(rs);
  const swept = sweptAngle(rs, c) * 180 / Math.PI;
  const ok = aspect >= 0.65 && aspect <= 1.55 && cv <= 0.25 && sharp <= 2 && swept >= 290 && swept <= 430;
  const score = Math.max(0, 1 - cv / 0.35) * (sharp <= 2 ? 1 : 0.5);
  const r = (bb.w + bb.h) / 4;
  return { ok, score, cx: c.x, cy: c.y, r, cv, sharp, swept, aspect };
}

function evalLine(pts, rs, len, se) {
  const a = pts[0], b = pts[pts.length - 1];
  const ratio = se / (len || 1);
  let mean = 0;
  for (const p of rs) mean += pointLineDist(p, a, b);
  mean /= rs.length;
  // 折り返しの量
  const dx = (b.x - a.x) / (se || 1), dy = (b.y - a.y) / (se || 1);
  let back = 0, prevProj = 0;
  for (const p of rs) {
    const pr = (p.x - a.x) * dx + (p.y - a.y) * dy;
    if (pr < prevProj) back += prevProj - pr;
    prevProj = Math.max(prevProj, pr);
  }
  const ok = ratio >= 0.82 && se >= 70 && se <= 300 && mean <= 0.10 * se && back <= 0.08 * se;
  const score = ratio >= 0.7 ? Math.max(0, 1 - mean / (0.15 * se)) : 0;
  return { ok, score, x1: a.x, y1: a.y, x2: b.x, y2: b.y, ratio, mean, back, se };
}

// ストロークの有効性（認識対象かどうか）
export function strokeValidity(stroke) {
  const pts = stroke.points;
  if (pts.length < STROKE.minPoints) return { valid: false, reason: 'tap' };
  const len = pathLength(pts);
  const dur = (pts[pts.length - 1].t - pts[0].t);
  if (len < STROKE.minLen) return { valid: false, reason: 'small' };
  if (dur < STROKE.minTime) return { valid: false, reason: 'tap' };
  if (dur > STROKE.maxTime) return { valid: false, reason: 'long' };
  return { valid: true, len, dur };
}

// ぜんしん版の許容：形が伝わらなかったとき、線・丸・三角のうち いちばん近いものに寄せる。
// 閉じかけなら 丸か三角（スコアの高いほう。三角には 集中が足りないとき用の 丸 alt をつける）、
// 開いていれば 始点と終点を結ぶ線。小さすぎる落書きは寄せない
function snap(pts, rs, se, maxSide, gap) {
  if (maxSide < STROKE.snapMin) return null;
  if (maxSide >= 50 && gap <= STROKE.snapClose * maxSide) {
    const loop = trimLoop(rs);
    const lbb = bbox(loop);
    const tri = evalTriangle(loop, lbb), cir = evalCircle(loop, lbb);
    const circle = { type: 'circle', cx: cir.cx, cy: cir.cy, r: cir.r };
    if (tri.score > cir.score && tri.area >= 1200) return { type: 'tri', verts: tri.verts, shape: outline(loop), alt: circle };
    if (isAngular(loop, tri)) return { type: 'tri', verts: tri.verts, shape: outline(loop), alt: circle, angular: true };
    return circle;
  }
  let a = pts[0], b = pts[pts.length - 1];
  if (se < 40) {
    // 始点と終点が近いのに閉じていない（くの字・うずまき）→ 大きさに合わせた丸
    const bb = bbox(pts);
    return { type: 'circle', cx: bb.cx, cy: bb.cy, r: (bb.w + bb.h) / 4 };
  }
  if (se > STROKE.snapLineMax) {
    const k = STROKE.snapLineMax / se, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    a = { x: mx + (a.x - mx) * k, y: my + (a.y - my) * k }; b = { x: mx + (b.x - mx) * k, y: my + (b.y - my) * k };
  }
  return { type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

// 認識本体。同じ点列には必ず同じ結果を返す（乱数・画面サイズに依存しない）
// opt.lenient：ぜんしん版。判定できなかった形を 近い形に寄せて通す（結果に lenient: true）
export function recognize(pts, opt) {
  const r = recognizeStrict(pts);
  if (r.type || !(opt && opt.lenient) || pts.length < 3) return r;
  const bb = bbox(pts);
  const maxSide = Math.max(bb.w, bb.h);
  const se = dist(pts[0], pts[pts.length - 1]);
  const rs = resample(pts, STROKE.resample);
  let gap = se;
  const n = rs.length, k = Math.floor(n * 0.2);
  for (let i = 0; i <= k; i++) gap = Math.min(gap, dist(rs[n - 1], rs[i]), dist(rs[0], rs[n - 1 - i]));
  const s = snap(pts, rs, se, maxSide, gap);
  if (!s) return r;
  return Object.assign(s, { cand: s.type, lenient: true, strict: r });
}

function recognizeStrict(pts) {
  if (pts.length < 3) return { type: null, why: 'few' };
  const len = pathLength(pts);
  const bb = bbox(pts);
  const maxSide = Math.max(bb.w, bb.h);
  const se = dist(pts[0], pts[pts.length - 1]);
  const rs = resample(pts, STROKE.resample);
  // 閉じ具合：行き過ぎて重なった場合も「閉じた」とみなす（始点付近と終点付近の最短距離）
  let gap = se;
  const n = rs.length, k = Math.floor(n * 0.2);
  for (let i = 0; i <= k; i++) {
    gap = Math.min(gap, dist(rs[n - 1], rs[i]), dist(rs[0], rs[n - 1 - i]));
  }
  const closed = maxSide >= 70 && gap <= STROKE.closeRatio * maxSide;
  if (closed) {
    const loop = trimLoop(rs);
    const lbb = bbox(loop);
    const tri = evalTriangle(loop, lbb);
    if (tri.ok) return { type: 'tri', verts: tri.verts, shape: outline(loop), cand: 'tri', detail: tri };
    const cir = evalCircle(loop, lbb);
    if (isAngular(loop, tri)) return { type: 'tri', verts: tri.verts, shape: outline(loop), cand: 'tri', angular: true, detail: tri };
    if (cir.ok) return { type: 'circle', cx: cir.cx, cy: cir.cy, r: cir.r, cand: 'circle', detail: cir };
    return { type: null, why: 'closed', cand: tri.score > cir.score ? 'tri' : 'circle', detail: { tri, cir } };
  }
  const line = evalLine(pts, rs, len, se);
  if (line.ok) return { type: 'line', x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, cand: 'line', detail: line };
  // 開いているが閉じかけ → 閉図形の候補表示用
  let cand = null;
  if (line.score > 0.5 && se < 70) cand = null;
  else if (line.ratio > 0.75) cand = 'line';
  else if (maxSide >= 60 && se <= 0.45 * maxSide) cand = 'circle';
  return { type: null, why: 'open', cand, detail: line };
}

// 描画途中の候補（アイコン表示用）
export function candidate(pts) {
  if (pts.length < 4) return null;
  const r = recognize(pts);
  if (r.type) return r.type;
  return null;
}
