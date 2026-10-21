// 道の点、フレネ座標、しかけの判定、道までの距離の場（第10部・付録S・付録I）
import { clamp, lerp, smoothstep, wrapAngle } from './util.js';

export const ZONE = { ground: 0, bridge: 1, pier: 2, tunnel: 3, viaduct: 4 };

// セントリペタル キャットマル–ロム（閉じた輪）。p は [x, z, y]
function crPoint(p0, p1, p2, p3, u, out) {
  const tj = (ti, a, b) => ti + Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])) + 1e-6;
  const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
  const t = t1 + (t2 - t1) * u;
  for (let j = 0; j < 3; j++) {
    const A1 = (t1 - t) / (t1 - t0) * p0[j] + (t - t0) / (t1 - t0) * p1[j];
    const A2 = (t2 - t) / (t2 - t1) * p1[j] + (t - t1) / (t2 - t1) * p2[j];
    const A3 = (t3 - t) / (t3 - t2) * p2[j] + (t - t2) / (t3 - t2) * p3[j];
    const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
    const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
    out[j] = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
  }
  return out;
}

function smoothArr(a, win, wrap = true) {
  const N = a.length, h = Math.floor(win / 2), out = new Float32Array(N);
  let sum = 0;
  for (let k = -h; k <= h; k++) sum += a[(k + N) % N];
  for (let i = 0; i < N; i++) {
    out[i] = sum / (2 * h + 1);
    sum += a[(i + h + 1) % N] - a[(i - h + N) % N];
  }
  a.set(out);
}

export class Track {
  constructor(course) {
    this.course = course;
    this.build();
    this.buildGimmicks();
  }

  build() {
    const C = this.course, cps = C.cps, n = cps.length;
    // 1. 細かい点
    const SUB = 200, dense = new Float64Array(n * SUB * 3), tmp = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const p0 = cps[(i - 1 + n) % n], p1 = cps[i], p2 = cps[(i + 1) % n], p3 = cps[(i + 2) % n];
      for (let k = 0; k < SUB; k++) {
        crPoint(p0, p1, p2, p3, k / SUB, tmp);
        const o = (i * SUB + k) * 3; dense[o] = tmp[0]; dense[o + 1] = tmp[1]; dense[o + 2] = tmp[2];
      }
    }
    const M = n * SUB, cum = new Float64Array(M + 1);
    for (let i = 1; i <= M; i++) {
      const a = (i - 1) * 3, b = (i % M) * 3;
      cum[i] = cum[i - 1] + Math.hypot(dense[b] - dense[a], dense[b + 1] - dense[a + 1]);
    }
    const L = cum[M], N = Math.floor(L), ds = L / N;
    this.L = L; this.N = N; this.ds = ds;
    const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i * ds;
      while (cum[j + 1] < s) j++;
      const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      const a = j * 3, b = ((j + 1) % M) * 3;
      px[i] = lerp(dense[a], dense[b], f); pz[i] = lerp(dense[a + 1], dense[b + 1], f); py[i] = lerp(dense[a + 2], dense[b + 2], f);
    }
    smoothArr(py, 15); smoothArr(py, 15);
    this.px = px; this.py = py; this.pz = pz;

    // 2. 区間・幅・路肩
    const zone = new Uint8Array(N), w = new Float32Array(N), sh = new Float32Array(N);
    const inR = (s, a, b) => a <= b ? (s >= a && s < b) : (s >= a || s < b);
    for (let i = 0; i < N; i++) {
      const s = i * ds;
      let z = ZONE.ground;
      for (const b of C.bridges || []) if (inR(s, b.s0, b.s1)) z = b.kind === 'pier' ? ZONE.pier : b.kind === 'viaduct' ? ZONE.viaduct : ZONE.bridge;
      for (const t of C.tunnels || []) if (inR(s, t.s0, t.s1)) z = ZONE.tunnel;
      zone[i] = z;
      w[i] = C.width;
      sh[i] = z === ZONE.ground ? C.shoulder : z === ZONE.tunnel ? 2.0 : 0.8;
    }
    // 幅の上書き（12m かけて なめらかに）
    for (const o of C.widthOver || []) {
      for (let i = 0; i < N; i++) {
        const s = i * ds;
        const t = smoothstep(o.s0 - 12, o.s0, s) * (1 - smoothstep(o.s1, o.s1 + 12, s));
        w[i] = lerp(w[i], o.w, t);
      }
    }
    smoothArr(sh, 9);
    this.zone = zone; this.w = w; this.sh = sh;

    // 3. 向き・曲率・バンク・坂
    const tx = new Float32Array(N), ty = new Float32Array(N), tz = new Float32Array(N), yaw = new Float32Array(N);
    const lfx = new Float32Array(N), lfz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let dx = px[b] - px[a], dy = py[b] - py[a], dz = pz[b] - pz[a];
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      tx[i] = dx; ty[i] = dy; tz[i] = dz;
      yaw[i] = Math.atan2(dx, dz);
      const lh = Math.hypot(dx, dz) || 1;
      lfx[i] = dz / lh; lfz[i] = -dx / lh;
    }
    const k = new Float32Array(N), slope = new Float32Array(N), bank = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      k[i] = wrapAngle(yaw[(i + 3) % N] - yaw[(i - 3 + N) % N]) / (6 * ds);
      slope[i] = (py[(i + 1) % N] - py[(i - 1 + N) % N]) / (2 * ds);
    }
    smoothArr(k, 9);
    const bankK = new Float32Array(N);
    for (let i = 0; i < N; i++) bankK[i] = zone[i] === ZONE.ground || zone[i] === ZONE.viaduct ? 1 : 0;
    smoothArr(bankK, 21);
    for (let i = 0; i < N; i++) bank[i] = clamp(k[i] * 4.0, -0.09, 0.09) * bankK[i];
    smoothArr(bank, 25);
    const ux = new Float32Array(N), uy = new Float32Array(N), uz = new Float32Array(N);
    const lbx = new Float32Array(N), lby = new Float32Array(N), lbz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // 道の面の 左（バンクで 左が下がる）：Lf を T のまわりに回す。左が下がる＝左の向きの y が負
      const b = bank[i], c = Math.cos(b), s = Math.sin(b);
      // 水平の左 Lf と 上 Y と 進む向き T（坂ぬき）で 回す
      lbx[i] = lfx[i] * c; lby[i] = -s; lbz[i] = lfz[i] * c;
      // 上 = T × Lb の向き（Lb × T の逆）。坂を ふくめた 面の上
      const Tx = tx[i], Ty = ty[i], Tz = tz[i];
      let Ux = Tz * lby[i] - Ty * lbz[i], Uy = Tx * lbz[i] - Tz * lbx[i], Uz = Ty * lbx[i] - Tx * lby[i];
      // 上を向くように
      if (Uy < 0) { Ux = -Ux; Uy = -Uy; Uz = -Uz; }
      const ul = Math.hypot(Ux, Uy, Uz) || 1;
      ux[i] = Ux / ul; uy[i] = Uy / ul; uz[i] = Uz / ul;
    }
    Object.assign(this, { tx, ty, tz, yaw, lfx, lfz, k, slope, bank, ux, uy, uz, lbx, lby, lbz });

    // 4. 縁石（|k| > 1/70 の所、直線にもどったら 6m で消す）
    const curb = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (Math.abs(k[i]) > 1 / 70 && zone[i] !== ZONE.pier) curb[i] = 1;
    const curb2 = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (curb[i]) for (let d = -6; d <= 6; d++) curb2[(i + d + N) % N] = 1;
    this.curb = curb2;

    // 外接の四角
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < N; i++) { x0 = Math.min(x0, px[i]); x1 = Math.max(x1, px[i]); z0 = Math.min(z0, pz[i]); z1 = Math.max(z1, pz[i]); }
    this.box = { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
  }

  // ---------- 値を読む ----------
  idx(i) { const N = this.N; return ((i % N) + N) % N; }
  wrapS(s) { const L = this.L; return ((s % L) + L) % L; }
  dsWrap(a, b) { let d = b - a; const L = this.L; d = ((d % L) + L) % L; if (d > L / 2) d -= L; return d; }
  _f(arr, s) {
    const u = this.wrapS(s) / this.ds, i = Math.floor(u), f = u - i;
    return lerp(arr[i % this.N], arr[(i + 1) % this.N], f);
  }
  kAt(s) { return this._f(this.k, s); }
  wAt(s) { return this._f(this.w, s); }
  shoulderAt(s) { return this._f(this.sh, s); }
  slopeAt(s) { return this._f(this.slope, s); }
  bankAt(s) { return this._f(this.bank, s); }
  yawAt(s) {
    const u = this.wrapS(s) / this.ds, i = Math.floor(u), f = u - i;
    const a = this.yaw[i % this.N], b = this.yaw[(i + 1) % this.N];
    return a + wrapAngle(b - a) * f;
  }
  zoneAt(s) { return this.zone[Math.floor(this.wrapS(s) / this.ds) % this.N]; }
  curbAt(s) { return this.curb[Math.floor(this.wrapS(s) / this.ds) % this.N] === 1; }
  kMax(s0, s1) {
    let m = 0; for (let s = s0; s <= s1; s += this.ds) m = Math.max(m, Math.abs(this.kAt(s))); return m;
  }
  // 道の点の値を out に まぜて入れる
  frame(s, o) {
    const u = this.wrapS(s) / this.ds, i0 = Math.floor(u) % this.N, i1 = (i0 + 1) % this.N, f = u - Math.floor(u);
    const L = (a) => lerp(a[i0], a[i1], f);
    o.x = L(this.px); o.y = L(this.py); o.z = L(this.pz);
    o.lfx = L(this.lfx); o.lfz = L(this.lfz);
    o.lbx = L(this.lbx); o.lby = L(this.lby); o.lbz = L(this.lbz);
    o.ux = L(this.ux); o.uy = L(this.uy); o.uz = L(this.uz);
    o.tx = L(this.tx); o.ty = L(this.ty); o.tz = L(this.tz);
    o.w = L(this.w); o.yaw = this.yawAt(s);
    return o;
  }
  // フレネ (s, d, h) → 世界の位置（10.5）
  pos(s, d, h, out) {
    const f = this.frame(s, this._fr || (this._fr = {}));
    const half = f.w / 2, dr = clamp(d, -half, half), de = d - dr;
    out.x = f.x + f.lbx * dr + f.lfx * de + f.ux * h;
    out.y = f.y + f.lby * dr + f.uy * h;
    out.z = f.z + f.lbz * dr + f.lfz * de + f.uz * h;
    return out;
  }
  surfaceY(s, d) { const o = this._py || (this._py = {}); return this.pos(s, d, 0, o).y; }

  // 世界の点 → いちばん近い s・d（hint：前の s）
  nearest(x, z, hint) {
    const N = this.N, px = this.px, pz = this.pz;
    let best = -1, bd = Infinity;
    if (hint != null) {
      const c = Math.round(this.wrapS(hint) / this.ds);
      for (let k = -40; k <= 40; k++) { const i = (c + k + N) % N; const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    } else {
      for (let i = 0; i < N; i += 2) { const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      for (let k = -3; k <= 3; k++) { const i = (best + k + N) % N; const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    }
    // となりとの間を 比例で
    const i = best, a = (i - 1 + N) % N, b = (i + 1) % N;
    const tx = px[b] - px[a], tz = pz[b] - pz[a], tl = Math.hypot(tx, tz) || 1;
    const t = ((x - px[i]) * tx + (z - pz[i]) * tz) / tl;
    const s = this.wrapS(i * this.ds + t);
    const f = this.frame(s, this._fn || (this._fn = {}));
    const d = (x - f.x) * f.lfx + (z - f.z) * f.lfz;
    return { s, d };
  }

  // ---------- しかけ ----------
  buildGimmicks() {
    const G = this.course.gimmicks || [];
    this.ramps = G.filter(g => g.type === 'ramp').map(g => ({ ...g, width: g.width || this.course.width }));
    this.gates = G.filter(g => g.type === 'gate').map(g => ({ ...g }));
    this.pads = G.filter(g => g.type === 'pad').map(g => ({ ...g }));
    this.puddles = G.filter(g => g.type === 'puddle').map(g => ({ ...g }));
    this.gaps = (this.course.gaps || []).map(g => ({ ...g }));
    for (const r of this.ramps) if (r.gap) r.gapRef = this.gaps.find(g => g.s0 >= r.s - 1 && g.s0 - r.s < 20);
    // 星：列を 1こずつに
    this.stars = [];
    for (const g of G.filter(g => g.type === 'stars')) {
      const n = g.n || 5;
      for (let i = 0; i < n; i++) {
        const s = this.wrapS(g.s + i * 4);
        this.stars.push({ s, d: g.d + (g.dd || 0) * i, y: g.y ? g.y[i] : 1.0, sky: !!g.y, alive: true, respawnAt: 0, takenBy: null, id: this.stars.length });
      }
    }
    // コーン
    this.cones = [];
    for (const g of G.filter(g => g.type === 'cones')) {
      for (let i = 0; i < g.n; i++) this.cones.push({ s: this.wrapS(g.s + i * (g.ds || 3)), d: g.d + (g.dd || 0) * i, state: 'stand', t: 0, id: this.cones.length });
    }
    this.surfaces = (this.course.surfaces || []).map(o => ({ ...o }));
  }
  inRangeS(s, a, b) { s = this.wrapS(s); return a <= b ? (s >= a && s < b) : (s >= a || s < b); }
  surface(s, d) {
    const C = this.course;
    for (const p of this.puddles) {
      const a = this.dsWrap(p.s, s) / (p.rz || 3), b = (d - p.d) / (p.rx || 2);
      if (a * a + b * b < 1) return 'puddle';
    }
    for (const o of this.surfaces) if (this.inRangeS(s, o.s0, o.s1) && d >= o.d0 && d <= o.d1) return o.type;
    const z = this.zoneAt(s), half = this.wAt(s) / 2;
    const roadType = z === ZONE.pier ? 'plank' : C.road;
    if (Math.abs(d) > half) {
      if (z !== ZONE.ground) return roadType;
      if (this.curbAt(s) && Math.abs(d) < half + 1.0) return roadType;
      return C.offroad;
    }
    return roadType;
  }
  rampHeight(s, d) {
    for (const r of this.ramps) {
      const x = this.dsWrap(r.s - r.len, s);
      if (x >= 0 && x <= r.len && Math.abs(d - (r.d || 0)) < r.width / 2) return r.h * Math.pow(x / r.len, 1.4);
    }
    return 0;
  }
  rampEndCrossed(s0, s1, d) {
    for (const r of this.ramps) {
      const a = this.dsWrap(r.s, s0), b = this.dsWrap(r.s, s1);
      if (a < 0 && b >= 0 && b < 5 && Math.abs(d - (r.d || 0)) < r.width / 2 + 0.3) return r;
    }
    return null;
  }
  nextRamp(s, d, ahead = 80) {
    let best = null, bd = ahead;
    for (const r of this.ramps) { const x = this.dsWrap(s, r.s); if (x >= 0 && x < bd) { bd = x; best = r; } }
    return best;
  }
  nextGate(s, ahead = 80) {
    let best = null, bd = ahead;
    for (const g of this.gates) { const x = this.dsWrap(s, g.s); if (x >= 0 && x < bd) { bd = x; best = g; } }
    return best;
  }
  gateCrossed(s0, s1) {
    for (const g of this.gates) { const a = this.dsWrap(g.s, s0), b = this.dsWrap(g.s, s1); if (a < 0 && b >= 0 && b < 5) return g; }
    return null;
  }
  padAt(s, d) {
    for (const p of this.pads) if (Math.abs(this.dsWrap(p.s, s)) < 1.3 && Math.abs(d - p.d) < 1.6) return p;
    return null;
  }
  inGap(s) { for (const g of this.gaps) if (this.inRangeS(s, g.s0, g.s1)) return g; return null; }

  // ---------- 道までの距離の場（付録I） ----------
  buildField(margin = 260, cell = 4) {
    const B = this.box, x0 = B.x0 - margin, z0 = B.z0 - margin;
    const nx = Math.ceil((B.x1 - B.x0 + margin * 2) / cell) + 1, nz = Math.ceil((B.z1 - B.z0 + margin * 2) / cell) + 1;
    const N = this.N, px = this.px, pz = this.pz, py = this.py;
    const dAll = new Float32Array(nx * nz), dG = new Float32Array(nx * nz);
    const hard = new Float32Array(nx * nz), soft = new Float32Array(nx * nz), iG = new Int32Array(nx * nz), sideG = new Float32Array(nx * nz);
    const step = 3;
    const coarse = [], coarseG = [];
    const isG = i => this.zone[i] === ZONE.ground || this.zone[i] === ZONE.tunnel;
    for (let i = 0; i < N; i += step) { coarse.push(i); if (isG(i)) coarseG.push(i); }
    const LAMBDA = 6;
    const ySurf = (i, side) => { const half = this.w[i] / 2, dr = clamp(side, -half, half); return py[i] + this.lby[i] * dr; };
    for (let gz = 0; gz < nz; gz++) for (let gx = 0; gx < nx; gx++) {
      const x = x0 + gx * cell, z = z0 + gz * cell, o = gz * nx + gx;
      // 全部の道
      let bd = Infinity, bi = 0;
      for (const i of coarse) { const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
      for (let k = -step; k <= step; k++) { const i = (bi + k + N) % N; const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
      dAll[o] = Math.sqrt(bd);
      // 地面の区間だけ ＋ やわらかい高さ
      let gd = Infinity, gi = 0;
      for (const i of coarseG) { const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < gd) { gd = d; gi = i; } }
      for (let k = -step; k <= step; k++) { const i = (gi + k + N) % N; if (!isG(i)) continue; const d = (px[i] - x) ** 2 + (pz[i] - z) ** 2; if (d < gd) { gd = d; gi = i; } }
      gd = Math.sqrt(gd);
      dG[o] = gd; iG[o] = gi;
      const side = (x - px[gi]) * this.lfx[gi] + (z - pz[gi]) * this.lfz[gi];
      sideG[o] = side;
      hard[o] = ySurf(gi, side);
      let sw = 0, sy = 0;
      const lim = gd + 40;
      if (gd < 75) for (const i of coarseG) {
        const d = Math.hypot(px[i] - x, pz[i] - z);
        if (d > lim) continue;
        const wgt = Math.exp(-(d - gd) / LAMBDA);
        const sd = (x - px[i]) * this.lfx[i] + (z - pz[i]) * this.lfz[i];
        sw += wgt; sy += wgt * ySurf(i, sd);
      }
      soft[o] = sw > 0 ? sy / sw : hard[o];
    }
    this.field = { x0, z0, nx, nz, cell, dAll, dG, hard, soft, iG, sideG };
  }
  _bil(arr, x, z) {
    const F = this.field;
    const u = clamp((x - F.x0) / F.cell, 0, F.nx - 1.001), v = clamp((z - F.z0) / F.cell, 0, F.nz - 1.001);
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, o = j * F.nx + i;
    return lerp(lerp(arr[o], arr[o + 1], fu), lerp(arr[o + F.nx], arr[o + F.nx + 1], fu), fv);
  }
  distAll(x, z) { return this._bil(this.field.dAll, x, z); }
  distGround(x, z) { return this._bil(this.field.dG, x, z); }
  roadHardY(x, z) { return this._bil(this.field.hard, x, z); }
  roadSoftY(x, z) { return this._bil(this.field.soft, x, z); }
  nearestGroundIndex(x, z) {
    const F = this.field;
    const i = clamp(Math.round((x - F.x0) / F.cell), 0, F.nx - 1), j = clamp(Math.round((z - F.z0) / F.cell), 0, F.nz - 1);
    return F.iG[j * F.nx + i];
  }

  // 検証（10.15）
  check() {
    const out = { L: this.L, rmin: Infinity, rminS: 0, grade: 0, sep: Infinity, sepAt: null, notes: [] };
    for (let i = 0; i < this.N; i++) {
      const r = 1 / Math.max(1e-6, Math.abs(this.k[i]));
      if (r < out.rmin) { out.rmin = r; out.rminS = i * this.ds; }
      out.grade = Math.max(out.grade, Math.abs(this.slope[i]));
    }
    for (let i = 0; i < this.N; i += 3) for (let j = i + 150; j < this.N - 150 + i && j < this.N; j += 3) {
      const d = Math.hypot(this.px[i] - this.px[j], this.pz[i] - this.pz[j]);
      const dy = Math.abs(this.py[i] - this.py[j]);
      if (d < out.sep && dy < 7) { out.sep = d; out.sepAt = [i * this.ds, j * this.ds]; }
    }
    for (const st of this.stars) if (Math.abs(st.d) > this.wAt(st.s) / 2 - 1 + 1e-6) out.notes.push(`star s ${st.s.toFixed(0)} d ${st.d}`);
    return out;
  }
}
