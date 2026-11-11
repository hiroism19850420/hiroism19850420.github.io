// 追加の あそび（第35部）：コイン・アイテム（カプセル）・タイムアタックの ゴースト
// アイテムは この ゲームだけの もの。当たっても くるっと 1回転して 遅くなるだけ（止まらない・泣かない）
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, rng } from './util.js';
import { Kart } from './kart.js';
import { KartModel } from './models.js';

const X = CFG.plus;
export const ITEMS = ['jet', 'bubble', 'pudding', 'shield', 'magnet'];
export const ITEM_NAME = { jet: 'ジェット', bubble: 'シャボンだま', pudding: 'プリン', shield: 'バリア', magnet: 'じしゃく' };

// ---------- アイテムの 絵（SVG） ----------
const OL = 'stroke="#1d2b53" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
export const ITEM_SVG = {
  jet: `<svg viewBox="0 0 100 100"><path d="M40 78 L50 98 L60 78 Z" fill="#ffd54a" ${OL}/><path d="M43 78 L50 90 L57 78 Z" fill="#ff7a2f"/>`
    + `<path d="M30 70 L22 84 L38 78 Z M70 70 L78 84 L62 78 Z" fill="#3f8cff" ${OL}/><path d="M50 6 C66 18 70 40 66 78 L34 78 C30 40 34 18 50 6 Z" fill="#ffffff" ${OL}/>`
    + `<circle cx="50" cy="40" r="10" fill="#8fd3ff" ${OL}/><path d="M38 64 L62 64" ${OL} stroke="#ff5a5a" stroke-width="6"/></svg>`,
  bubble: `<svg viewBox="0 0 100 100"><circle cx="50" cy="52" r="40" fill="#bfe9ff" fill-opacity=".75" ${OL}/><path d="M28 40 A24 24 0 0 1 46 24" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`
    + `<circle cx="64" cy="70" r="6" fill="#fff" fill-opacity=".8"/><circle cx="20" cy="20" r="7" fill="#d8f2ff" ${OL} stroke-width="3"/><circle cx="84" cy="22" r="5" fill="#d8f2ff" ${OL} stroke-width="3"/></svg>`,
  pudding: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="84" rx="40" ry="9" fill="#fff" ${OL}/><path d="M28 80 L34 34 Q50 26 66 34 L72 80 Q50 88 28 80 Z" fill="#ffd36b" ${OL}/>`
    + `<path d="M34 34 Q50 26 66 34 L64 46 Q50 40 36 46 Z" fill="#9a4f1c" ${OL} stroke-width="4"/><circle cx="50" cy="22" r="7" fill="#ff5a6e" ${OL} stroke-width="3"/><path d="M40 56 L42 70" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/></svg>`,
  shield: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#7fe9ff" fill-opacity=".35" ${OL}/><circle cx="50" cy="50" r="28" fill="none" stroke="#3fd0ff" stroke-width="8"/>`
    + `<path d="M50 30 L66 38 L66 54 Q64 68 50 74 Q36 68 34 54 L34 38 Z" fill="#3f8cff" ${OL}/><path d="M24 34 A30 30 0 0 1 40 18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>`,
  magnet: `<svg viewBox="0 0 100 100"><path d="M20 20 L40 20 L40 56 A10 10 0 0 0 60 56 L60 20 L80 20 L80 56 A30 30 0 0 1 20 56 Z" fill="#ff5a5a" ${OL}/>`
    + `<path d="M20 20 L40 20 L40 34 L20 34 Z M60 20 L80 20 L80 34 L60 34 Z" fill="#e6edf5" ${OL}/><path d="M12 8 L22 14 M88 8 L78 14 M50 92 L50 84" stroke="#ffd54a" stroke-width="5" stroke-linecap="round"/></svg>`,
  coin: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#ffd54a" ${OL}/><circle cx="50" cy="50" r="28" fill="none" stroke="#e8a817" stroke-width="7"/><path d="M50 30 L50 70" stroke="#e8a817" stroke-width="9" stroke-linecap="round"/><path d="M28 30 A28 28 0 0 1 44 20" fill="none" stroke="#fff6c8" stroke-width="6" stroke-linecap="round"/></svg>`
};

// ---------- 置く 場所（しかけと かさならないように） ----------
function busy(tr, s0, s1, extra = []) {
  const near = (a, b0, b1) => { const x = tr.dsWrap(b0, a); return x >= 0 && x <= tr.dsWrap(b0, b1) + 1e-6; };
  const span = (a0, a1) => { for (let s = a0; s <= a1; s += 2) if (hit(tr.wrapS(s))) return true; return false; };
  const hit = s => {
    for (const r of tr.ramps) if (near(s, r.s - r.len - 12, r.s + 26)) return true;
    for (const g of tr.gates) if (near(s, g.s - 12, g.s + 8)) return true;
    for (const p of tr.pads) if (near(s, p.s - 8, p.s + 8)) return true;
    for (const g of tr.gaps) if (near(s, g.s0 - 30, g.s1 + 10)) return true;
    for (const st of tr.stars) if (Math.abs(tr.dsWrap(s, st.s)) < 8) return true;
    for (const c of tr.cones) if (Math.abs(tr.dsWrap(s, c.s)) < 8) return true;
    for (const p of tr.puddles) if (Math.abs(tr.dsWrap(s, p.s)) < 8) return true;
    for (const e of extra) if (Math.abs(tr.dsWrap(s, e)) < 14) return true;
    return false;
  };
  return span(s0, s1);
}
function buildBoxes(tr) {
  const out = [], at = [];
  for (const f of [0.2, 0.52, 0.8]) {
    let s = f * tr.L;
    for (let k = 0; k < 14 && busy(tr, s - 2, s + 2); k++) s += 6;
    if (busy(tr, s - 2, s + 2)) continue;
    s = tr.wrapS(s); at.push(s);
    const w = tr.wAt(s), sp = Math.min(3.4, (w - 3) / 3);
    for (const k of [-1.5, -0.5, 0.5, 1.5]) out.push({ s, d: k * sp, alive: true, back: 0, grow: 1, id: out.length });
  }
  return { boxes: out, at };
}
function buildCoins(tr, avoid) {
  const out = [];
  let row = 0;
  for (let s = 45; s < tr.L - 25; s += X.COIN_GAP) {
    let s0 = s;
    const len = (X.COIN_N - 1) * X.COIN_DS;
    for (let k = 0; k < 4 && busy(tr, s0, s0 + len, avoid); k++) s0 += 9;
    if (busy(tr, s0, s0 + len, avoid) || s0 + len > tr.L - 8) continue;
    const w = tr.wAt(s0), half = w / 2 - 1.6;
    const kind = row % 3, base = [-0.45, 0.45, 0][row % 3] * half;
    for (let i = 0; i < X.COIN_N; i++) {
      const ss = tr.wrapS(s0 + i * X.COIN_DS);
      const d = kind === 2 ? clamp(-half * 0.6 + (i / (X.COIN_N - 1)) * half * 1.2, -half, half) : clamp(base, -half, half);
      out.push({ s: ss, d, alive: true, back: 0, grow: 1, id: out.length });
    }
    row++;
  }
  return out;
}

// ---------- ゴースト（タイムアタック） ----------
const GKEY = (course, laps) => `zgp_ghost_${course}_${laps}`;
export const Ghost = {
  load(course, laps) { try { const g = JSON.parse(localStorage.getItem(GKEY(course, laps)) || 'null'); return g && g.v === 1 && g.p && g.p.length ? g : null; } catch (e) { return null; } },
  save(course, laps, g) { try { localStorage.setItem(GKEY(course, laps), JSON.stringify(g)); return true; } catch (e) { return false; } },
  // 時刻 t の 位置（前後の 記録を 比例で）
  at(g, t, L, out) {
    const n = g.p.length, f = clamp(t / g.dt, 0, n - 1), i = Math.min(n - 2, Math.floor(f)), k = n > 1 ? f - i : 0;
    const j = Math.min(n - 1, i + 1);
    const prog = g.p[i] + (g.p[j] - g.p[i]) * k;
    out.s = ((prog % L) + L) % L; out.d = g.d[i] + (g.d[j] - g.d[i]) * k; out.h = g.h[i] + (g.h[j] - g.h[i]) * k;
    let a = g.y[j] - g.y[i]; if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
    out.psi = g.y[i] + a * k;
    return out;
  }
};

// ---------- しくみ（Race から よぶ。THREE は つかわない部分） ----------
export class Plus {
  constructor(race, opts) {
    this.race = race; const tr = this.tr = race.track;
    this.ta = !!opts.ta;
    this.itemsOn = !this.ta && opts.items !== false;
    const B = this.itemsOn ? buildBoxes(tr) : { boxes: [], at: [] };
    this.boxes = B.boxes;
    this.coins = buildCoins(tr, B.at);
    this.shots = []; this.traps = [];
    this.rng = rng((opts.seed || 7) * 13 + 5);
    this.atk = X.RIVAL_ATK[race.diff] ?? 0.7;
    this.think = new Map();
    // ゴースト
    this.ghost = opts.ghost || null;
    this.rec = { v: 1, dt: X.GHOST_DT, p: [], d: [], h: [], y: [], next: 0 };
    this.gk = this.ghost ? new Kart(tr, this.ghost.char) : null;
    if (this.gk) { this.gk.frozen = true; this.gk.ground = true; }
  }

  update(dt) {
    const race = this.race, tr = this.tr, T = race.time;
    // コイン
    for (const c of this.coins) {
      if (!c.alive) { if (T >= c.back) { c.alive = true; c.grow = 0; } continue; }
      for (const k of race.karts) {
        const ds = tr.dsWrap(k.s, c.s); if (Math.abs(ds) > 2) continue;
        if (Math.hypot(ds, c.d - k.d, k.h) < X.COIN_R) {
          c.alive = false; c.back = T + X.COIN_BACK;
          if (k.coins < X.COIN_MAX) k.coins++;
          k.stats.coins++;
          race.event('coin', k, c); break;
        }
      }
    }
    // カプセル
    for (const b of this.boxes) {
      if (!b.alive) { if (T >= b.back) { b.alive = true; b.grow = 0; } continue; }
      if (b.grow < 1) continue;
      for (const k of race.karts) {
        if (k.finished) continue;
        const ds = tr.dsWrap(k.s, b.s); if (Math.abs(ds) > 2.5) continue;
        if (Math.hypot(ds, b.d - k.d) < X.BOX_R && k.h < 2.2) {
          b.alive = false; b.back = T + X.BOX_BACK;
          const got = !k.item && k.rollT <= 0;
          if (got) k.rollT = X.ROULETTE;
          race.event('boxGet', k, { box: b, got }); break;
        }
      }
    }
    // くじ
    for (const k of race.karts) if (k.rollT > 0) { k.rollT -= dt; if (k.rollT <= 0) { k.rollT = 0; k.item = this.pick(k); race.event('itemReady', k, k.item); } }
    // じしゃく：前の カートへ すいよせられる
    for (const k of race.karts) if (k.magnetT > 0) {
      k.magnetT -= dt;
      const t = k.magnetTo;
      if (t && !t.finished) { const gap = tr.dsWrap(k.s, t.s); if (gap > 1.5 && gap < 90) { const dd = clamp(t.d - k.d, -1, 1) * 4 * dt; k.d += dd; k.dAim = k.d; } else k.magnetT = Math.min(k.magnetT, 0.2); }
    }
    // シャボンだま
    for (const sh of this.shots) {
      sh.t += dt; sh.s = tr.wrapS(sh.s + sh.v * dt);
      const half = tr.wAt(sh.s) / 2 - 0.8;
      if (sh.target && !sh.target.finished) { const gap = tr.dsWrap(sh.s, sh.target.s); if (gap > -3 && gap < 120) sh.d += clamp(sh.target.d - sh.d, -1, 1) * Math.min(Math.abs(sh.target.d - sh.d), 6 * dt); }
      sh.d = clamp(sh.d, -half, half);
      for (const k of race.karts) {
        if (k === sh.owner && sh.t < 1.0) continue;
        const ds = tr.dsWrap(k.s, sh.s);
        if (Math.abs(ds) < X.BUBBLE_R + 0.6 && Math.abs(sh.d - k.d) < X.BUBBLE_R && k.h < 2) { sh.dead = true; k.hit(race, sh.owner); race.event('bubblePop', k, sh); break; }
      }
      if (sh.t > X.BUBBLE_LIFE && !sh.dead) { sh.dead = true; race.event('bubbleFade', null, sh); }
    }
    this.shots = this.shots.filter(s => !s.dead);
    // プリン
    for (const p of this.traps) {
      p.t += dt;
      if (p.t > X.PUDDING_LIFE) { p.dead = true; continue; }
      if (p.t < 0.5) continue;
      for (const k of race.karts) {
        if (!k.ground) continue;
        const ds = tr.dsWrap(k.s, p.s);
        if (Math.hypot(ds, p.d - k.d) < X.PUDDING_R) { p.dead = true; k.hit(race, p.owner); race.event('puddingSplat', k, p); break; }
      }
    }
    this.traps = this.traps.filter(p => !p.dead);
    // ライバルの アイテム
    if (this.itemsOn && race.phase === 'run') for (const rv of race.rivals) this.rivalItem(rv.k, dt);
    // ゴーストの 記録・再生
    this.ghostTick();
  }

  // くじ（後ろほど 追いつく 道具が 出やすい）
  pick(k) {
    const race = this.race, n = race.karts.length;
    const pos = race.order.indexOf(k);
    const row = X.ODDS[clamp(Math.round(pos / Math.max(1, n - 1) * (X.ODDS.length - 1)), 0, X.ODDS.length - 1)];
    const sum = row.reduce((a, b) => a + b, 0);
    let r = this.rng() * sum, it = 'jet';
    for (let i = 0; i < row.length; i++) { r -= row[i]; if (r < 0) { it = ITEMS[i]; break; } }
    // ライバルは かんたんほど じゃまアイテムを ひかえる
    if (!k.isPlayer && (it === 'bubble' || it === 'pudding') && this.rng() > this.atk) it = this.rng() < 0.6 ? 'jet' : 'shield';
    return it;
  }
  ahead(k, range = 150) {
    let best = null, bd = range;
    for (const o of this.race.karts) { if (o === k || o.finished) continue; const g = this.tr.dsWrap(k.s, o.s); if (g > 1 && g < bd) { bd = g; best = o; } }
    return best;
  }
  behind(k, range = 30) {
    for (const o of this.race.karts) { if (o === k || o.finished) continue; const g = this.tr.dsWrap(o.s, k.s); if (g > 1 && g < range) return o; }
    return null;
  }
  use(k) {
    const race = this.race;
    if (!k.item) { race.event('noItem', k, k.rollT > 0); return false; }
    const it = k.item; k.item = null; k.clapT = 0.4; k.stats.items++;
    if (it === 'jet') k.startBoost('jet');
    else if (it === 'shield') k.shieldT = X.SHIELD_T;
    else if (it === 'magnet') { k.magnetT = X.MAGNET_T; k.magnetTo = this.ahead(k, 90); k.startBoost('magnet'); }
    else if (it === 'bubble') this.shots.push({ s: this.tr.wrapS(k.s + 2.2), d: k.d, v: Math.max(X.BUBBLE_V, k.v + 9), owner: k, target: this.ahead(k, 140), t: 0, id: Math.random() });
    else if (it === 'pudding') this.traps.push({ s: this.tr.wrapS(k.s - 2.6), d: k.d, owner: k, t: 0, id: Math.random(), wob: Math.random() * 6 });
    race.event('useItem', k, it);
    return true;
  }
  rivalItem(k, dt) {
    if (!k.item || k.finished) return;
    let st = this.think.get(k); if (!st) { st = { held: 0, next: 0.6 + this.rng() }; this.think.set(k, st); }
    st.held += dt; st.next -= dt; if (st.next > 0) return;
    st.next = 0.5 + this.rng() * 0.6;
    const tr = this.tr, it = k.item;
    const straight = tr.kMax(k.s, k.s + 50) < 1 / 55;
    let go = false;
    if (it === 'jet') go = straight || st.held > 6;
    else if (it === 'shield') go = st.held > 1.2;
    else if (it === 'magnet') go = !!this.ahead(k, 60);
    else if (it === 'bubble') { const a = this.ahead(k, 45); go = (a && this.rng() < this.atk) || st.held > 12; }
    else if (it === 'pudding') { const b = this.behind(k, 22); go = (b && this.rng() < this.atk) || st.held > 14; }
    if (go) { this.use(k); this.think.delete(k); }
  }

  // ---------- ゴースト ----------
  ghostTick() {
    const race = this.race, pl = race.player, L = this.tr.L, T = race.time;
    if (this.ta && race.phase === 'run' && !pl.finished) {
      const R = this.rec;
      while (T >= R.next) {
        const prog = (pl.lap < 0 ? pl.s - L : pl.lap * L + pl.s);
        R.p.push(+prog.toFixed(2)); R.d.push(+pl.d.toFixed(2)); R.h.push(+pl.h.toFixed(2)); R.y.push(+pl.psi.toFixed(3));
        R.next += R.dt;
      }
    }
    if (this.gk && (race.phase === 'run' || race.phase === 'finish' || race.phase === 'done')) {
      const g = this.gk, o = Ghost.at(this.ghost, T, L, this._go || (this._go = {}));
      g.prevPos.copy(g.wpos); g.prevQuat.copy(g.wquat);
      g.s = o.s; g.d = o.d; g.h = o.h; g.psi = o.psi; g.ground = o.h < 0.05;
      g.v = this.ghost.dt ? 20 : 0;
      g.computeWorld();
      this.ghostDone = T > this.ghost.time;
    }
  }
  // 線を こえたとき：ゴーストとの 差
  onLap(kart, lapIdx, tCross) {
    if (!this.ghost || !kart.isPlayer || !this.ghost.laps) return;
    let gT = 0; for (let i = 0; i <= lapIdx && i < this.ghost.laps.length; i++) gT += this.ghost.laps[i];
    if (lapIdx < this.ghost.laps.length) this.race.event('split', kart, tCross - gT);
  }
  // ゴールしたら 記録を のこす（はやければ）
  finishGhost(char, course, laps) {
    const pl = this.race.player;
    if (!this.ta || !pl.finished) return false;
    const old = this.ghost;
    if (old && old.time <= pl.finishTime) return false;
    const R = this.rec;
    const g = { v: 1, char, time: pl.finishTime, laps: pl.lapTimes.slice(), dt: R.dt, p: R.p, d: R.d, h: R.h, y: R.y, at: Date.now() };
    // ゴールの 先も 少し 走らせる（ゴーストが 線の上で 止まらないように）
    const last = R.p.length - 1, v = 18 * R.dt;
    for (let i = 1; i <= 40 && last >= 0; i++) { g.p.push(+(R.p[last] + v * i).toFixed(2)); g.d.push(R.d[last]); g.h.push(0); g.y.push(R.y[last] * 0.9); }
    return Ghost.save(course, laps, g);
  }
}

// ---------- 見た目 ----------
const V3 = THREE.Vector3;
let GEO = null;
function geos() {
  if (GEO) return GEO;
  const coin = new THREE.CylinderGeometry(0.42, 0.42, 0.11, 28).rotateX(Math.PI / 2);
  const coinIn = new THREE.CylinderGeometry(0.27, 0.27, 0.14, 24).rotateX(Math.PI / 2);
  const capTop = new THREE.SphereGeometry(0.62, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const capBot = new THREE.SphereGeometry(0.62, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const band = new THREE.TorusGeometry(0.62, 0.06, 8, 36).rotateX(Math.PI / 2);
  const core = new THREE.OctahedronGeometry(0.22, 0);
  GEO = { coin, coinIn, capTop, capBot, band, core };
  return GEO;
}
export class PlusView {
  constructor(plus, scene, models, quality) {
    this.plus = plus; this.scene = scene; this.models = models;
    const G = geos(), tr = plus.tr;
    this.root = new THREE.Group(); scene.add(this.root);
    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.frustumCulled = false; m.castShadow = quality !== 'low'; this.root.add(m); return m; };
    // コイン
    const nC = plus.coins.length;
    this.coinM = mk(G.coin, new THREE.MeshStandardMaterial({ color: '#ffd23a', metalness: 0.3, roughness: 0.3, emissive: '#ff9d00', emissiveIntensity: 0.38 }), nC);
    this.coinIn = mk(G.coinIn, new THREE.MeshStandardMaterial({ color: '#fff1a0', metalness: 0.25, roughness: 0.25, emissive: '#ffc21a', emissiveIntensity: 0.4 }), nC);
    // カプセル
    const nB = plus.boxes.length;
    this.capTop = mk(G.capTop, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0.05, emissive: '#222244', emissiveIntensity: 0.2 }), nB);
    this.capBot = mk(G.capBot, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }), nB);
    this.capBand = mk(G.band, new THREE.MeshStandardMaterial({ color: '#ffd54a', roughness: 0.3, metalness: 0.4 }), nB);
    this.capCore = mk(G.core, new THREE.MeshBasicMaterial({ color: '#ffffff' }), nB);
    this.capCore.castShadow = false;
    const col = new THREE.Color();
    for (let i = 0; i < nB; i++) { this.capTop.setColorAt(i, col.setHSL((i * 0.23) % 1, 0.85, 0.62)); this.capCore.setColorAt(i, col.setHSL((i * 0.23 + 0.5) % 1, 1, 0.75)); }
    // シャボンだま・プリン・バリア（使いまわし）
    this.bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#bfeaff', transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, emissive: '#62c6ff', emissiveIntensity: 0.55, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600], depthWrite: false });
    this.rimMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
    this.shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
    this.shieldMat = new THREE.MeshStandardMaterial({ color: '#8ff0ff', transparent: true, opacity: 0.22, roughness: 0.1, emissive: '#3fd0ff', emissiveIntensity: 0.6, depthWrite: false, side: THREE.DoubleSide });
    this.bubbles = []; this.puddings = []; this.shields = new Map();
    this.ghostM = null;
    if (plus.gk) this.makeGhost(plus.gk.id);
    this._d = new THREE.Object3D(); this._p = new V3();
  }
  makeGhost(id) {
    const m = new KartModel(id);
    m.group.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cl = mats.map(mt => { const c = mt.clone(); c.transparent = true; c.opacity = 0.42; c.depthWrite = false; if (c.color) c.color.lerp(new THREE.Color('#9fe4ff'), 0.5); if (c.emissive) { c.emissive.set('#5fd0ff'); c.emissiveIntensity = 0.7; } return c; });
      o.material = Array.isArray(o.material) ? cl : cl[0]; o.castShadow = false; o.renderOrder = 3;
    });
    this.ghostM = m; this.scene.add(m.group);
  }
  bubbleMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.82, 28, 18), this.bubbleMat));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), this.rimMat));
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), this.shineMat); sh.position.set(-0.32, 0.36, 0.3); sh.scale.set(1, 0.6, 1); g.add(sh);
    g.renderOrder = 4; this.root.add(g); return g;
  }
  puddingMesh() {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.05, 28), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 0.52, 28), new THREE.MeshStandardMaterial({ color: '#ffd36b', roughness: 0.35, emissive: '#5a3a00', emissiveIntensity: 0.1 }));
    body.position.y = 0.3;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.1, 28), new THREE.MeshStandardMaterial({ color: '#8a4214', roughness: 0.2 }));
    top.position.y = 0.58;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: '#ff3b55', roughness: 0.3 }));
    berry.position.y = 0.7;
    [plate, body, top, berry].forEach(m => { m.castShadow = true; g.add(m); });
    g.userData.body = [body, top, berry];
    this.root.add(g); return g;
  }
  update(dt, t, race) {
    const P = this.plus, tr = P.tr, D = this._d, p = this._p;
    // コイン
    P.coins.forEach((c, i) => {
      if (c.alive && c.grow < 1) c.grow = Math.min(1, c.grow + dt * 3);
      const sc = c.alive ? c.grow : 0;
      tr.pos(c.s, c.d, 0.75 + Math.sin(t * 3 + i * 0.7) * 0.08, p);
      D.position.copy(p); D.rotation.set(0, t * 2.2 + i * 0.5, 0); D.scale.setScalar(sc + 1e-4); D.updateMatrix();
      this.coinM.setMatrixAt(i, D.matrix); this.coinIn.setMatrixAt(i, D.matrix);
    });
    this.coinM.instanceMatrix.needsUpdate = this.coinIn.instanceMatrix.needsUpdate = true;
    // カプセル
    P.boxes.forEach((b, i) => {
      if (b.alive && b.grow < 1) b.grow = Math.min(1, b.grow + dt * 2.5);
      const sc = b.alive ? (b.grow < 1 ? b.grow * (1 + Math.sin(b.grow * Math.PI) * 0.3) : 1) : 0;
      tr.pos(b.s, b.d, 1.15 + Math.sin(t * 2.2 + i) * 0.12, p);
      D.position.copy(p); D.rotation.set(0.35, t * 1.6 + i, 0.15); D.scale.setScalar(sc + 1e-4); D.updateMatrix();
      this.capTop.setMatrixAt(i, D.matrix); this.capBot.setMatrixAt(i, D.matrix); this.capBand.setMatrixAt(i, D.matrix);
      D.rotation.set(t * 2, t * 3, 0); D.scale.setScalar((sc + 1e-4) * (1 + Math.sin(t * 6 + i) * 0.15)); D.updateMatrix(); this.capCore.setMatrixAt(i, D.matrix);
    });
    for (const m of [this.capTop, this.capBot, this.capBand, this.capCore]) m.instanceMatrix.needsUpdate = true;
    // シャボンだま
    while (this.bubbles.length < P.shots.length) this.bubbles.push(this.bubbleMesh());
    this.bubbles.forEach((g, i) => {
      const sh = P.shots[i]; g.visible = !!sh; if (!sh) return;
      tr.pos(sh.s, sh.d, 0.95 + Math.sin(sh.t * 7) * 0.12, p); g.position.copy(p);
      const k = 1 + Math.sin(sh.t * 11) * 0.06; g.scale.set(k, 2 - k, k); g.rotation.y = sh.t * 2;
    });
    // プリン
    while (this.puddings.length < P.traps.length) this.puddings.push(this.puddingMesh());
    this.puddings.forEach((g, i) => {
      const pd = P.traps[i]; g.visible = !!pd; if (!pd) return;
      tr.pos(pd.s, pd.d, 0.02, p); g.position.copy(p); g.rotation.y = tr.yawAt(pd.s) + pd.wob;
      const j = Math.sin(t * 9 + pd.wob) * 0.07 * (pd.t < 1 ? 2 : 1), sIn = Math.min(1, pd.t * 4);
      g.scale.set(sIn * (1 - j * 0.5), sIn * (1 + j), sIn * (1 - j * 0.5));
    });
    // バリア
    race.karts.forEach((k, i) => {
      let s = this.shields.get(k);
      if (k.shieldT > 0) {
        if (!s) { s = new THREE.Mesh(new THREE.SphereGeometry(1.55, 28, 18), this.shieldMat); s.renderOrder = 4; this.root.add(s); this.shields.set(k, s); }
        const m = this.models[i]; s.visible = true;
        s.position.copy(m ? m.group.position : k.wpos); s.position.y += 0.75;
        const blink = k.shieldT < 2 ? (Math.sin(t * 20) > 0 ? 1 : 0.3) : 1;
        s.scale.setScalar(1 + Math.sin(t * 5) * 0.03); s.material.opacity = 0.22 * blink;
      } else if (s) s.visible = false;
    });
    // ゴースト
    if (this.ghostM && P.gk) {
      const g = P.gk, a = race.alpha || 0, m = this.ghostM;
      const show = race.phase === 'run' || race.phase === 'finish' || race.phase === 'done';
      m.group.visible = show;
      if (show) {
        m.group.position.lerpVectors(g.prevPos, g.wpos, a); m.group.quaternion.slerpQuaternions(g.prevQuat, g.wquat, a);
        m.pose({ v: 18, steer: 0, throttle: 0.8, pedalA: t * 12, roll: 0, bob: 0, boost: false, trickA: 0, crouch: false, banzai: P.ghostDone, face: 'normal', accelY: 0, accelX: 0, far: false }, dt, t);
      }
    }
  }
  coinPos(c, out) { return this.plus.tr.pos(c.s, c.d, 0.75, out); }
  boxPos(b, out) { return this.plus.tr.pos(b.s, b.d, 1.15, out); }
  shotPos(s, out) { return this.plus.tr.pos(s.s, s.d, 0.95, out); }
  dispose() {
    this.scene.remove(this.root);
    if (this.ghostM) this.scene.remove(this.ghostM.group);
    this.root.traverse(o => { if (o.isMesh && o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); });
  }
}
