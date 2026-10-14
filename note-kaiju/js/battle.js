// BattleController / ShapeManager / AttackScheduler / CollisionResolver
// 描画から独立したゲームロジック。正本の体力・勝敗はここだけで決まる。
import { GAME, BAL, SHAPES, ATTACKS, PHASES, FAIL_TEXT } from './config.js';
import { recognize, strokeValidity, pointSegDist } from './recognizer.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 線分同士の最短距離と、1本目の線分上の位置 u
function segSeg(a, b, c, d) {
  const d1x = b.x - a.x, d1y = b.y - a.y, d2x = d.x - c.x, d2y = d.y - c.y;
  const rx = a.x - c.x, ry = a.y - c.y;
  const A = d1x * d1x + d1y * d1y, E = d2x * d2x + d2y * d2y, F = d2x * rx + d2y * ry;
  let s, t;
  if (A <= 1e-9 && E <= 1e-9) { s = t = 0; }
  else if (A <= 1e-9) { s = 0; t = Math.max(0, Math.min(1, F / E)); }
  else {
    const C = d1x * rx + d1y * ry;
    if (E <= 1e-9) { t = 0; s = Math.max(0, Math.min(1, -C / A)); }
    else {
      const B = d1x * d2x + d1y * d2y;
      const den = A * E - B * B;
      s = den !== 0 ? Math.max(0, Math.min(1, (B * F - C * E) / den)) : 0;
      t = (B * s + F) / E;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -C / A)); }
      else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (B - C) / A)); }
    }
  }
  const px = a.x + d1x * s, py = a.y + d1y * s, qx = c.x + d2x * t, qy = c.y + d2y * t;
  return { d: Math.hypot(px - qx, py - qy), u: s };
}

function closestU(a, b, p) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  return L2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
}

let SID = 1;

export class Battle {
  constructor(opt) {
    this.diff = opt.diff;
    this.mode = opt.mode || 'battle';      // battle | tutorial | practice
    this.emit = opt.emit || (() => {});
    this.anchors = opt.anchors || (() => ({ mouth: { x: 480, y: 100 }, mouthL: { x: 460, y: 100 }, mouthR: { x: 500, y: 100 }, chest: { x: 480, y: 150 }, headTop: { x: 480, y: 60 } }));
    this.rng = mulberry32(opt.seed ?? ((Math.random() * 1e9) | 0));
    this.seed = opt.seed;
    this.guideSetting = opt.shapeGuide !== false;

    const D = this.diff;
    this.player = { hp: D.playerHp, max: D.playerHp, ink: BAL.inkMax, focus: 0, invuln: 0 };
    this.boss = { hp: D.bossHp, max: D.bossHp, phase: 1, pending: 0 };
    this.thresholds = [Math.round(D.bossHp * 2 / 3), Math.round(D.bossHp / 3)];
    this.time = 0;
    this.state = 'run';           // run | transition | over
    this.result = null;
    this.transT = 0;
    this.shapes = [];
    this.attacks = [];
    this.tris = [];
    this.recentExpired = [];
    this.nextAttackIn = 1.0;
    this.suppress = 0;
    this.hitStop = 0;
    this.combo = 0;
    this.score = 0;
    this.history = [];            // 攻撃の履歴
    this.laneHist = [];
    this.seen = {};               // 攻撃種別の初回
    this.inkAttackCount = 0;
    this.lastInkShort = -99;
    this.lastRecogFail = -99;
    this.lastFocusShort = -99;
    this.pendingHits = [];
    this.timeWarned = { 30: false, 10: false };
    this.stats = {
      hits: 0, blocked: 0, unblocked: 0, strokes: 0, recognized: 0, maxCombo: 0,
      used: { line: 0, circle: 0, tri: 0 }, blockBy: { line: 0, circle: 0 }, triHits: 0,
      fails: { expired: 0, offset: 0, ink: 0, focus: 0, recog: 0, none: 0 },
      damageDealt: 0,
    };
  }

  get inkRegen() { return this.diff.inkRegen; }
  multiplier() { return this.combo >= 20 ? 2.0 : this.combo >= 10 ? 1.5 : 1.0; }

  // ---------------- 入力 ----------------
  // 描画確定。戻り値はUI表示用の結果。
  submitStroke(stroke) {
    const v = strokeValidity(stroke);
    if (!v.valid) return { ok: false, invalid: true, reason: v.reason };
    if (this.state === 'over') return { ok: false, invalid: true, reason: 'over' };
    this.stats.strokes++;
    const r = recognize(stroke.points);
    if (!r.type) {
      this.lastRecogFail = this.time;
      this.emit('recogFail', { cand: r.cand });
      return { ok: false, recogFail: true, rec: r };
    }
    this.stats.recognized++;
    const def = SHAPES[r.type];
    const infinite = this.mode === 'practice';
    if (r.type === 'tri') {
      if (this.state !== 'run') { this.emit('msg', { text: 'いまは使えない', kind: 'info' }); return { ok: false, rec: r, blocked: 'transition' }; }
      if (this.player.focus < def.focus && !infinite) {
        this.lastFocusShort = this.time;
        this.stats.fails.focus++;
        this.emit('focusShort', { need: def.focus - this.player.focus });
        return { ok: false, rec: r, lack: 'focus', need: def.focus - this.player.focus };
      }
      if (this.player.ink < def.ink && !infinite) {
        this.lastInkShort = this.time;
        this.emit('inkShort', { need: Math.ceil(def.ink - this.player.ink) });
        return { ok: false, rec: r, lack: 'ink', need: Math.ceil(def.ink - this.player.ink) };
      }
      if (!infinite) { this.player.ink -= def.ink; this.player.focus -= def.focus; }
      this.stats.used.tri++;
      const tri = { id: SID++, verts: r.verts, t: 0, hit: false, raw: stroke.points };
      this.tris.push(tri);
      this.emit('triFire', tri);
      return { ok: true, rec: r, shape: tri };
    }
    if (this.player.ink < def.ink && !infinite) {
      this.lastInkShort = this.time;
      this.emit('inkShort', { need: Math.ceil(def.ink - this.player.ink) });
      return { ok: false, rec: r, lack: 'ink', need: Math.ceil(def.ink - this.player.ink) };
    }
    if (!infinite) this.player.ink -= def.ink;
    this.stats.used[r.type]++;
    // 存在上限：古いものから消える
    while (this.shapes.length >= BAL.maxShapes) {
      const old = this.shapes.shift();
      this.expireShape(old, 'replaced');
    }
    const s = { id: SID++, type: r.type, born: this.time, life: def.life, maxLife: def.life, dur: def.durability, raw: stroke.points, age: 0 };
    if (r.type === 'line') { s.x1 = r.x1; s.y1 = r.y1; s.x2 = r.x2; s.y2 = r.y2; }
    else { s.cx = r.cx; s.cy = r.cy; s.r = Math.max(def.rMin, Math.min(def.rMax, r.r)); s.rawR = r.r; }
    this.shapes.push(s);
    this.emit('shape', s);
    return { ok: true, rec: r, shape: s };
  }

  expireShape(s, why) {
    this.recentExpired.push({ s, t: this.time, why });
    if (this.recentExpired.length > 8) this.recentExpired.shift();
    this.emit('shapeGone', { s, why });
  }

  // ---------------- 攻撃 ----------------
  pickAttack() {
    const ph = PHASES[this.boss.phase - 1];
    if (this.boss.phase === 1 && this.history.length < 3) return 'ink';
    const last = this.history[this.history.length - 1], last2 = this.history[this.history.length - 2];
    if (last && last2 && ATTACKS[last].heavy && ATTACKS[last2].heavy && ph.weights.ink) return 'ink';
    if (last === 'rain') return 'ink';
    const entries = Object.entries(ph.weights).filter(([k]) => !(k === last && k === last2));
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
    return entries[0][0];
  }

  pickLane() {
    const h = this.laneHist;
    if (this.mode === 'battle' && this.inkAttackCount === 0) return 1;
    let lane;
    for (let i = 0; i < 10; i++) {
      lane = Math.floor(this.rng() * 3);
      if (!(h.length >= 2 && h[h.length - 1] === lane && h[h.length - 2] === lane)) break;
    }
    return lane;
  }

  // 攻撃開始（チュートリアルからも呼ばれる）
  spawnAttack(type, o = {}) {
    const def = ATTACKS[type];
    const ph = PHASES[this.boss.phase - 1];
    const first = !this.seen[type];
    this.seen[type] = true;
    let previewMul = ph.previewMul * this.diff.previewMul * (o.previewMul || 1);
    let preview = def.preview * previewMul;
    if (type === 'twin' && first) preview += def.firstExtra;
    const guide = this.mode === 'tutorial' || this.diff.guide === 'always' || first;
    const shapeIcon = this.diff.shapeIcon === 'always' || (this.diff.shapeIcon === 'setting' && this.guideSetting) || this.mode === 'tutorial';
    const a = { id: SID++, type, def, t: 0, windup: def.windup, preview, stage: 'windup', items: [], guide, shapeIcon, rest: def.rest, first, rec: 'line' };

    if (type === 'ink') {
      const lane = o.lane ?? this.pickLane();
      this.laneHist.push(lane);
      this.inkAttackCount++;
      a.lanes = [lane];
      a.items.push(this.mkProj({ lane, tx: GAME.LANES[lane], start: a.windup + preview, dur: def.travel, r: def.r, dmg: def.dmg, src: 'mouth' }));
      a.rec = 'line';
    } else if (type === 'twin') {
      let pat = o.pattern;
      if (!pat) { const r = this.rng(); pat = r < 0.4 ? 'same' : r < 0.75 ? 'spread' : 'converge'; }
      a.pattern = pat;
      const t0 = a.windup + preview;
      if (pat === 'same') {
        const lane = o.lane ?? Math.floor(this.rng() * 3);
        const tx = GAME.LANES[lane];
        a.items.push(this.mkProj({ lane, tx: tx - 6, start: t0, dur: def.travel, r: def.r, dmg: def.dmg, src: 'mouthL', num: 1 }));
        a.items.push(this.mkProj({ lane, tx: tx + 6, start: t0 + def.delay, dur: def.travel, r: def.r, dmg: def.dmg, src: 'mouthR', num: 2 }));
        a.rec = 'circle';
      } else if (pat === 'spread') {
        const l = Math.floor(this.rng() * 2);
        const order = this.rng() < 0.5;
        a.items.push(this.mkProj({ lane: order ? l : l + 1, tx: GAME.LANES[order ? l : l + 1], start: t0, dur: def.travel, r: def.r, dmg: def.dmg, src: order ? 'mouthL' : 'mouthR', num: 1 }));
        a.items.push(this.mkProj({ lane: order ? l + 1 : l, tx: GAME.LANES[order ? l + 1 : l], start: t0 + def.delay, dur: def.travel, r: def.r, dmg: def.dmg, src: order ? 'mouthR' : 'mouthL', num: 2 }));
        a.rec = 'line';
      } else {
        a.items.push(this.mkProj({ lane: 1, tx: 455, start: t0, dur: def.travel, r: def.r, dmg: def.dmg, src: 'mouthL', num: 1, cross: true }));
        a.items.push(this.mkProj({ lane: 1, tx: 505, start: t0 + def.delay, dur: def.travel, r: def.r, dmg: def.dmg, src: 'mouthR', num: 2, cross: true }));
        a.rec = 'circle';
      }
    } else if (type === 'scratch') {
      const lane = o.lane ?? Math.floor(this.rng() * 3);
      const angs = [0, 0.42, -0.42];
      const ang = o.ang ?? angs[Math.floor(this.rng() * 3)];
      a.gate = { gx: GAME.LANES[lane], gy: def.gateY, ang, w: def.gateW, judgeT: a.windup + preview, done: false, blocked: false };
      a.items.push(a.gate);
      a.gate.kind = 'gate';
      a.rec = 'line';
    } else if (type === 'rain') {
      const lanes = [];
      for (let i = 0; i < def.count; i++) {
        let l;
        for (let k = 0; k < 10; k++) {
          l = Math.floor(this.rng() * 3);
          if (!(lanes.length >= 2 && lanes[i - 1] === l && lanes[i - 2] === l)) break;
        }
        lanes.push(l);
      }
      a.lanes = lanes;
      lanes.forEach((l, i) => {
        const tx = GAME.LANES[l] + (this.rng() - 0.5) * 40;
        const p = this.mkProj({ lane: l, tx, start: a.windup + preview + i * def.interval, dur: def.fall, r: def.r, dmg: def.dmg, src: 'sky', num: i + 1, sx: tx, sy: 170, ty: 440 });
        a.items.push(p);
      });
      a.rec = lanes.some((l, i) => i > 0 && lanes[i - 1] === l) ? 'circle' : 'line';
    }
    this.attacks.push(a);
    this.history.push(type);
    this.emit('attackStart', a);
    return a;
  }

  mkProj(o) {
    return {
      kind: 'proj', id: SID++, lane: o.lane, tx: o.tx, ty: o.ty ?? GAME.ARRIVE_Y, start: o.start, dur: o.dur, r: o.r, dmg: o.dmg,
      src: o.src, num: o.num || 0, x0: o.sx ?? null, y0: o.sy ?? null, x: 0, y: 0, px: 0, py: 0,
      st: 'wait', blocked: false, warned: false, trail: [],
    };
  }

  // 予告開始時に発射口の位置で経路を確定する
  fixPaths(a) {
    const an = this.anchors();
    for (const it of a.items) {
      if (it.kind !== 'proj') continue;
      if (it.x0 === null) {
        const s = an[it.src] || an.mouth;
        it.x0 = s.x; it.y0 = s.y;
      }
      it.x = it.x0; it.y = it.y0; it.px = it.x0; it.py = it.y0;
    }
    a.pathsFixed = true;
  }

  // 経路上で Y=防御地点 となる位置（ガイド表示用）
  static pathAtY(p, y) {
    const u = (y - p.y0) / ((p.ty - p.y0) || 1);
    return { x: p.x0 + (p.tx - p.x0) * u, y };
  }

  // ---------------- 更新 ----------------
  update(dt) {
    if (this.state === 'over') { this.updateTris(dt); return; }
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    // サブステップ（低fps時のすり抜け防止）
    let remain = Math.min(dt, GAME.MAX_DT);
    this.pendingHits.length = 0;
    while (remain > 1e-6) {
      const h = Math.min(GAME.SUBSTEP, remain);
      this.step(h);
      remain -= h;
      if (this.state === 'over') break;
    }
    this.resolvePlayerHits();
    this.checkEnd();
  }

  step(h) {
    const P = this.player;
    if (this.state === 'transition') {
      this.transT -= h;
      if (this.transT <= 0) { this.state = 'run'; this.nextAttackIn = 0.8; this.emit('phaseEnd', { phase: this.boss.phase }); }
      return;
    }
    if (this.mode === 'battle') this.time += h;
    else this.time += h; // チュートリアル内部時計（制限時間には使わない）
    // インク回復
    P.ink = Math.min(BAL.inkMax, P.ink + this.inkRegen * h);
    if (P.invuln > 0) P.invuln -= h;
    if (this.suppress > 0) this.suppress -= h;

    // 図形の寿命
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      s.life -= h; s.age += h;
      if (s.life <= 0) { this.shapes.splice(i, 1); this.expireShape(s, 'expired'); }
    }
    this.updateTris(h);

    // 攻撃
    for (const a of this.attacks) this.stepAttack(a, h);
    this.attacks = this.attacks.filter(a => {
      if (a.done) { this.emit('attackEnd', a); if (this.mode === 'battle') this.nextAttackIn = Math.max(this.nextAttackIn, a.rest); return false; }
      return true;
    });

    // フェーズ移行の予約 → 現在の攻撃が終わってから
    if (this.boss.pending && this.attacks.length === 0 && this.tris.length === 0 && this.state === 'run' && this.boss.hp > 0) {
      this.boss.phase = this.boss.pending;
      this.boss.pending = 0;
      this.state = 'transition';
      this.transT = BAL.phaseTransition;
      for (const s of this.shapes) this.expireShape(s, 'phase');
      this.shapes.length = 0;
      this.emit('phaseStart', { phase: this.boss.phase });
      return;
    }

    // 次の攻撃
    if (this.mode === 'battle' && this.attacks.length === 0 && !this.boss.pending) {
      this.nextAttackIn -= h;
      if (this.nextAttackIn <= 0 && this.suppress <= 0 && this.boss.hp > 0) {
        this.spawnAttack(this.pickAttack());
      }
    }

    // 時間の警告
    if (this.mode === 'battle') {
      const left = BAL.timeLimit - this.time;
      for (const k of [30, 10]) if (!this.timeWarned[k] && left <= k) { this.timeWarned[k] = true; this.emit('timeWarn', { left: k }); }
    }
  }

  updateTris(h) {
    for (let i = this.tris.length - 1; i >= 0; i--) {
      const tr = this.tris[i];
      tr.t += h;
      if (!tr.hit && tr.t >= SHAPES.tri.delay) {
        tr.hit = true;
        if (this.state !== 'over' && this.mode !== 'practice') {
          this.stats.triHits++;
          this.score += Math.round(SHAPES.tri.score * this.multiplier());
          this.suppress = Math.max(this.suppress, BAL.triSuppress);
          this.nextAttackIn = Math.max(this.nextAttackIn, BAL.triMinRest);
          this.hitStop = this.reduceFx ? BAL.hitStop * 0.5 : BAL.hitStop;
          this.damageBoss(SHAPES.tri.dmg, true);
          this.emit('triHit', tr);
        } else if (this.mode === 'practice') this.emit('triHit', tr);
      }
      if (tr.t >= SHAPES.tri.anim) this.tris.splice(i, 1);
    }
  }

  stepAttack(a, h) {
    a.t += h;
    if (a.stage === 'windup' && a.t >= a.windup) {
      a.stage = 'preview';
      this.fixPaths(a);
      this.emit('attackPreview', a);
    }
    if (a.stage === 'windup') return;
    let allDone = true;
    for (const it of a.items) {
      if (it.kind === 'gate') { this.stepGate(a, it); if (!it.done) allDone = false; continue; }
      if (it.st === 'done') continue;
      allDone = false;
      const s = (a.t - it.start) / it.dur;
      if (s < 0) {
        if (!it.warnedPre && a.t >= it.start - 0.05) { it.warnedPre = true; }
        continue;
      }
      if (it.st === 'wait') { it.st = 'fly'; it.px = it.x0; it.py = it.y0; this.emit('fire', { a, p: it }); }
      const u = Math.min(1, s);
      it.px = it.x; it.py = it.y;
      it.x = it.x0 + (it.tx - it.x0) * u;
      it.y = it.y0 + (it.ty - it.y0) * u;
      it.trail.push({ x: it.x, y: it.y });
      if (it.trail.length > 8) it.trail.shift();
      if (!it.warned && (1 - s) * it.dur <= 0.2) { it.warned = true; this.emit('imminent', it); }
      // 防御接触
      if (this.collide(a, it)) continue;
      if (u >= 1) {
        it.st = 'done';
        this.arrive(a, it, { x: it.x0, y: it.y0 }, { x: it.tx, y: it.ty });
      }
    }
    if (a.type === 'scratch' && a.gate.done && a.t < a.gate.judgeT + a.def.active) allDone = false;
    if (allDone) a.done = true;
  }

  collide(a, it) {
    const A = { x: it.px, y: it.py }, B = { x: it.x, y: it.y };
    let best = null;
    for (const s of this.shapes) {
      let hit = null;
      if (s.type === 'line') {
        const r = segSeg(A, B, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
        if (r.d <= SHAPES.line.radius + it.r) hit = r.u;
      } else if (s.type === 'circle') {
        const d = pointSegDist({ x: s.cx, y: s.cy }, A, B);
        if (d <= s.r + it.r) {
          // 円に入った位置
          hit = closestU(A, B, { x: s.cx, y: s.cy });
          if (Math.hypot(A.x - s.cx, A.y - s.cy) <= s.r + it.r) hit = 0;
        }
      }
      if (hit !== null && (!best || hit < best.u - 1e-6 || (Math.abs(hit - best.u) <= 1e-6 && s.born < best.s.born))) best = { s, u: hit };
    }
    if (!best) return false;
    const x = A.x + (B.x - A.x) * best.u, y = A.y + (B.y - A.y) * best.u;
    it.st = 'done'; it.blocked = true; it.x = x; it.y = y;
    this.block(best.s, x, y, a, it);
    return true;
  }

  stepGate(a, g) {
    if (g.done) return;
    if (a.t < g.judgeT) return;
    g.done = true;
    this.emit('swipe', { a, g });
    // 判定時刻に存在する図形を確認
    const dirx = Math.cos(g.ang), diry = Math.sin(g.ang);
    const ga = { x: g.gx - dirx * g.w / 2, y: g.gy - diry * g.w / 2 }, gb = { x: g.gx + dirx * g.w / 2, y: g.gy + diry * g.w / 2 };
    let found = null;
    for (const s of this.shapes) {
      if (s.type === 'line') {
        let la = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
        let diff = Math.abs(la - g.ang) % Math.PI;
        if (diff > Math.PI / 2) diff = Math.PI - diff;
        const dd = pointSegDist({ x: g.gx, y: g.gy }, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
        if (diff * 180 / Math.PI <= a.def.angTol && dd <= 42) { found = s; break; }
      } else if (s.type === 'circle') {
        if (Math.hypot(s.cx - g.gx, s.cy - g.gy) <= s.r) { found = s; break; }
      }
    }
    if (found) {
      g.blocked = true;
      this.block(found, g.gx, g.gy, a, g);
    } else {
      this.arrive(a, g, ga, gb);
    }
  }

  block(s, x, y, a, it) {
    const def = SHAPES[s.type];
    s.dur -= 1;
    if (s.dur <= 0) {
      const i = this.shapes.indexOf(s);
      if (i >= 0) this.shapes.splice(i, 1);
      this.expireShape(s, 'used');
    }
    this.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.stats.blocked++;
    this.stats.blockBy[s.type]++;
    const prevFocus = this.player.focus;
    this.player.focus = Math.min(BAL.focusMax, this.player.focus + def.focus);
    if (this.mode !== 'practice') this.score += Math.round(def.score * this.multiplier());
    this.emit('block', { s, x, y, a, it, combo: this.combo, dmg: def.dmg });
    if (prevFocus < BAL.focusMax && this.player.focus >= BAL.focusMax) this.emit('focusFull', {});
    this.damageBoss(def.dmg, false);
  }

  damageBoss(dmg, big) {
    if (this.mode === 'tutorial') {
      // チュートリアルでは見た目だけ減らす（0にはしない）
      this.boss.hp = Math.max(1, this.boss.hp - dmg);
      this.emit('bossDamage', { dmg, big });
      return;
    }
    const B = this.boss;
    B.hp = Math.max(0, B.hp - dmg);
    this.stats.damageDealt += dmg;
    this.emit('bossDamage', { dmg, big });
    if (B.hp > 0) {
      const target = B.hp <= this.thresholds[1] ? 3 : B.hp <= this.thresholds[0] ? 2 : 1;
      if (target > B.phase && target > (B.pending || 0)) B.pending = target;
    }
  }

  // 防御できずに到達
  arrive(a, it, pa, pb) {
    const reason = this.failReason(pa, pb);
    this.stats.unblocked++;
    this.stats.fails[reason]++;
    this.pendingHits.push({ dmg: it.dmg ?? a.def.dmg, a, it, reason, x: it.kind === 'gate' ? it.gx : it.tx, y: it.kind === 'gate' ? it.gy : it.ty });
  }

  failReason(pa, pb) {
    const now = this.time;
    if (now - this.lastInkShort < 2.0) return 'ink';
    if (now - this.lastRecogFail < 2.0) return 'recog';
    const distTo = (s) => s.type === 'line'
      ? segSeg(pa, pb, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }).d
      : Math.max(0, pointSegDist({ x: s.cx, y: s.cy }, pa, pb) - s.r);
    for (const e of this.recentExpired) {
      if (e.why === 'expired' && now - e.t < 1.0 && distTo(e.s) <= 45) return 'expired';
    }
    for (const s of this.shapes) if (distTo(s) <= 110) return 'offset';
    for (const e of this.recentExpired) if (now - e.t < 1.2 && e.why !== 'used' && distTo(e.s) <= 110) return 'offset';
    return 'none';
  }

  // 同一更新内の被弾は最大1件のみ適用
  resolvePlayerHits() {
    if (!this.pendingHits.length) return;
    const hits = this.pendingHits.slice();
    this.pendingHits.length = 0;
    hits.sort((a, b) => b.dmg - a.dmg);
    const top = hits[0];
    if (this.mode !== 'battle') { this.emit('tutMiss', top); return; }
    if (this.player.invuln > 0) { this.emit('miss', { ...top, invuln: true }); return; }
    const dmg = Math.round(top.dmg * this.diff.dmgMul);
    this.player.hp = Math.max(0, this.player.hp - dmg);
    this.player.invuln = BAL.invuln;
    this.stats.hits++;
    this.combo = 0;
    this.emit('playerHit', { ...top, dmg });
  }

  checkEnd() {
    if (this.mode !== 'battle' || this.state === 'over') return;
    if (this.boss.hp <= 0) return this.finish('win');
    if (this.player.hp <= 0) return this.finish('lose', 'hp');
    if (this.time >= BAL.timeLimit) return this.finish('lose', 'time');
  }

  finish(res, why) {
    this.state = 'over';
    this.result = res;
    this.attacks.length = 0;
    this.shapes.length = 0;
    const st = this.stats;
    const reached = st.blocked + st.unblocked;
    const defRate = reached ? st.blocked / reached : 1;
    const recRate = st.strokes ? st.recognized / st.strokes : 1;
    let bonus = { kill: 0, hp: 0, time: 0, noDamage: 0, recog: 0 };
    if (res === 'win') {
      bonus.kill = BAL.score.kill;
      bonus.hp = this.player.hp * BAL.score.hpBonus;
      bonus.time = Math.floor(Math.max(0, BAL.timeLimit - this.time)) * BAL.score.timeBonus;
      bonus.noDamage = st.hits === 0 ? BAL.score.noDamage : 0;
      bonus.recog = recRate >= 0.9 ? BAL.score.recogBonus : 0;
    }
    const total = this.score + bonus.kill + bonus.hp + bonus.time + bonus.noDamage + bonus.recog;
    let rank = null;
    if (res === 'win') rank = defRate >= 0.95 && st.hits <= 1 ? 'S' : defRate >= 0.85 ? 'A' : defRate >= 0.70 ? 'B' : 'C';
    const failSorted = Object.entries(st.fails).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    this.summary = {
      result: res, why, score: total, base: this.score, bonus, rank, timeMs: Math.round(this.time * 1000),
      hits: st.hits, defRate, recRate, maxCombo: st.maxCombo, used: { ...st.used }, bossHp: this.boss.hp, bossMax: this.boss.max,
      topFail: failSorted.length ? failSorted[0][0] : null, diff: this.diff.key,
    };
    this.emit('end', this.summary);
  }
}

export { FAIL_TEXT };
