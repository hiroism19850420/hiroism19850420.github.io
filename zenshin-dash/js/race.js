// レースの 流れ・順位・できごと（第20部・付録AF）。描画は 知らない
import { CFG } from './config.js';
import { clamp, lerp, rng } from './util.js';
import { Runner } from './runner.js';
import { packStep, autoLine } from './pack.js';
import { RivalBrain } from './ai.js';
import { planObstacles, CueTrack, checkPass } from './obstacles.js';
import { Jama } from './jama.js';
import { makeHeight } from './height.js';

function shuffle(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export class Race {
  // opt：{ course, L, diff, mode, chars（6匹）, playerChars（1〜2）, seed }
  constructor(opt) {
    Object.assign(this, opt);
    this.time = 0; this.phase = 'gate'; this.gateT = 0; this.events = []; this.contactAt = {}; this.prevS = {};
    this.finishOrder = []; this.two = opt.mode === 'two';
    this.final = clamp(CFG.course.FINAL_K * opt.L, CFG.course.FINAL_MIN, CFG.course.FINAL_MAX);
    this.H = makeHeight(opt.course, opt.L);
    const rnd = rng(opt.seed);
    this.rnd = rnd;
    // ゲート：プレイヤーは まん中寄り
    const pg = this.two ? [2, 3] : [rnd() < 0.5 ? 2 : 3];
    const rest = shuffle([0, 1, 2, 3, 4, 5].filter(g => !pg.includes(g)), rnd);
    this.runners = [];
    opt.playerChars.forEach((c, i) => this.runners.push(new Runner({ id: 'p' + i, char: c, isPlayer: true, who: i, gate: pg[i] })));
    opt.chars.filter(c => !opt.playerChars.includes(c)).forEach((c, i) => this.runners.push(new Runner({ id: 'r' + i, char: c, isPlayer: false, gate: rest[i] })));
    this.players = this.runners.filter(r => r.isPlayer);
    // 強さの くじ・型の くじ
    const rivals = this.rivals();
    const spread = CFG.ai.SPREAD[opt.diff].slice(0, rivals.length);
    const styles = shuffle(['nige', 'senko', 'senko', 'sashi', 'oikomi'], rnd);
    shuffle(rivals, rnd).forEach((r, i) => { r.brain = new RivalBrain(r, this, spread[i], styles[i], rng(opt.seed * 31 + i + 1)); });
    // 障害物と 合図
    this.obstacles = planObstacles(opt.L, opt.diff, opt.mode, opt.seed);
    this.cues = this.players.map(p => new CueTrack(this, p, CFG.obstacles.INTERVAL[opt.diff]));
    this.jama = new Jama(this, rng(opt.seed * 7 + 3));
    this.goT = lerp(CFG.race.GO_T[0], CFG.race.GO_T[1], rnd());
    this.ice = ((opt.course.special && opt.course.special.ice) || []).map(z => [z.f * opt.L, z.f * opt.L + z.len]);
    this.order = this.runners.slice();
    this.rocketPre = this.players.map(() => false);
    this.lead = null; this.leadSince = 0; this.leadSaid = null; this.chaosT = 0; this.chaosSaid = false;
    this.inputs = [];
  }

  rivals() { return this.runners.filter(r => !r.isPlayer); }
  emit(type, d = {}) { this.events.push({ type, ...d, t: this.time }); }
  inFinal(s) { return s >= this.L - this.final && s < this.L; }
  heightAt(s) { return this.H(s); }
  inputOf(r) { return this.inputs[r.who]; }
  rankOf(r) { return this.order.indexOf(r) + 1; }
  cueOf(r) { const c = this.cues[r.who]; return c ? c.cur : null; }
  cueEta(r) { const c = this.cueOf(r); return c ? c.eta : Infinity; }
  onIce(r) { return this.ice.some(([a, b]) => r.s >= a && r.s <= b); }
  drafting(r) {
    const R = CFG.run;
    for (const o of this.runners) { if (o === r) continue; const ds = o.s - r.s; if (ds > R.DRAFT_MIN && ds < R.DRAFT_MAX && Math.abs(o.d - r.d) < R.DRAFT_DD) return true; }
    return false;
  }
  // プレイヤーが どっしりの 合図中は、まわりの ライバルは ゆずる（15.6）
  dodgeGuard(p) { const c = this.cueOf(p); return c && c.base === 'dodge' ? c : null; }
  yields(back, front) { return !front.isPlayer && back.isPlayer && this.dodgeGuard(back) && Math.abs(front.s - back.s) < CFG.obstacles.YIELD_R; }
  protects(r) { return r.isPlayer && !!this.dodgeGuard(r); }
  nextObstacleAhead(r, dist) { for (const ob of this.obstacles) { const ds = ob.s - r.s; if (ds > -ob.ds && ds < dist && !ob.state(r).done) return ob; } return null; }
  nearestTo(ob) { let best = null; for (const r of this.runners) { const ds = ob.s - r.s; if (ds > -1 && (!best || ds < ob.s - best.s)) best = r; } return best; }

  update(dt, inputs) {
    this.inputs = inputs;
    this.time += dt;
    if (this.phase === 'gate') this.gate(dt, inputs);
    // ---- プレイヤー ----
    for (const p of this.players) {
      const inp = inputs[p.who];
      if (p.finished) { p.dTarget = p.d; continue; }
      const c = this.cues[p.who];
      c.update(dt);
      if (this.phase === 'run') {
        if (inp.took('jump')) p.jump();
        if (inp.took('banzai')) { p.pose('banzai'); p.act(); }
        for (const h of ['handR', 'handL']) if (inp.took(h)) { p.pose(h === 'handR' ? 'swatR' : 'swatL'); p.act(); }
        for (const [ev, kind, side] of [['armL', 'arm', -1], ['armR', 'arm', 1], ['legL', 'leg', -1], ['legR', 'leg', 1]]) if (inp.took(ev)) this.jama.playerAct(p, kind, side);
        p.spurt = this.inFinal(p.s) ? clamp(inp.swing || 0, 0, 1) : 0;
        if (!p.assistLat) {
          if (inp.shiftNorm) { p.dTarget = p.d + inp.shiftNorm * CFG.run.LAT_V * 0.25; p.passing = false; p.decideT = 0; }
          else autoLine(p, this, dt);
        }
      }
    }
    // ---- ライバル ----
    for (const r of this.rivals()) r.ctl = this.phase === 'gate' ? { vt: 0 } : r.brain.think(dt);
    // ---- 走る ----
    for (const r of this.runners) r.step(dt, this, r.isPlayer ? inputs[r.who] : r.ctl);
    if (this.phase !== 'gate') packStep(this, dt);
    for (const r of this.runners) checkPass(this, r);
    this.jama.update(dt);
    this.order = this.runners.slice().sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : b.s - a.s));
    this.watchLead(dt); this.milestones(dt);
    if (this.phase === 'run' && this.players.every(p => p.finished)) { this.phase = 'finish'; this.finishAt = this.time; }
    if (this.phase === 'finish' && (this.runners.every(r => r.finished) || this.time - this.finishAt > CFG.race.FINISH_WAIT)) { this.rescueRest(); this.phase = 'done'; }
  }

  gate(dt, inputs) {
    const R = CFG.race, t0 = this.gateT;
    if (this.waitSeen && !this.waitSeen()) return;                 // 見えるまで 待つ
    this.gateT += dt;
    const at = x => t0 < x && this.gateT >= x;
    if (at(R.READY_T)) this.emit('gateReady');
    if (at(R.SET_T)) this.emit('gateSet');
    if (this.gateT > this.goT - CFG.run.ROCKET_PRE) this.players.forEach((p, i) => { if ((inputs[p.who].th || 0) >= CFG.run.ROCKET_TH) this.rocketPre[i] = true; });
    if (at(this.goT)) {
      this.phase = 'run'; this.runStart = this.time; this.emit('gateGo');
      for (const r of this.runners) {
        const rocket = r.isPlayer ? this.rocketPre[this.players.indexOf(r)] : this.rnd() < CFG.ai.ROCKET_P[this.diff] + ((CFG.ai.TRAITS[r.char] || {}).rocket || 0);
        if (rocket) { r.v = CFG.run.ROCKET_V * CFG.run.V_MAX; r.boost(CFG.run.ROCKET_K, CFG.run.ROCKET_T); if (r.isPlayer) this.emit('rocket', { who: r }); }
      }
    }
  }

  crossLine(r, s0, dt) {
    const k = (this.L - s0) / Math.max(1e-6, r.s - s0);
    r.finished = true; r.finishTime = Math.max(0, this.time - dt + k * dt - (this.runStart || 0));
    this.finishOrder.push(r);
    const rank = this.finishOrder.length;
    r.rank = rank;
    if (rank === 1) this.emit('tape', { who: r });
    if (rank >= 2) {
      const a = this.finishOrder[rank - 2];
      if (Math.abs(a.finishTime - r.finishTime) <= CFG.race.PHOTO && (r.isPlayer || a.isPlayer)) this.emit('photo', { a, b: r });
    }
    this.emit('finish', { who: r, rank, time: r.finishTime });
  }

  rescueRest() {
    const rest = this.runners.filter(r => !r.finished).map(r => ({ r, t: this.time - (this.runStart || 0) + (this.L - r.s) / Math.max(r.v, 6) })).sort((a, b) => a.t - b.t);
    for (const { r, t } of rest) { r.finished = true; r.finishTime = t; r.rescued = true; this.finishOrder.push(r); r.rank = this.finishOrder.length; }
    this.order = this.finishOrder.slice();
  }

  onObstacle(r, ob, ok, perfect) {
    if (r.isPlayer) {
      r.stats[ok ? 'ok' : 'miss']++; if (ok && perfect) r.stats.perfect++;
      const key = ob.base === 'banzai' ? 'hand' : ob.base;
      if (r.stats[key]) { r.stats[key][1]++; if (ok) r.stats[key][0]++; }
      const c = this.cues[r.who];
      if (!ok) { c.missRun[ob.base] = (c.missRun[ob.base] || 0) + 1; if (c.missRun[ob.base] >= 2) c.widen[ob.base] = CFG.obstacles.MISS2_WIDEN; }
      else { c.missRun[ob.base] = 0; c.widen[ob.base] = 0; }
    }
    if (ok) { r.boost(perfect ? CFG.run.BOOST_PERFECT : CFG.run.BOOST_OK); r.happyT = 0.8; }
    else r.stumble('obs', ob.base === 'dodge' ? (ob.side > 0 ? -4 : 4) : null);
    this.emit(r.isPlayer ? (ok ? 'cueOk' : 'cueMiss') : (ok ? 'rivalOk' : 'rivalMiss'), { who: r, ob, perfect });
  }

  rubber(r) {
    const A = CFG.ai, [ahead, behind] = A.RB[this.diff];
    let ref = this.players[0];
    for (const p of this.players) if (Math.abs(p.s - r.s) < Math.abs(ref.s - r.s)) ref = p;
    if (ref.finished) return 1;
    const d = r.s - ref.s, fin = this.inFinal(r.s) ? 0.5 : 1;
    if (d > A.RB_AHEAD0) return 1 - ahead * fin * clamp((d - A.RB_AHEAD0) / A.RB_AHEAD_W, 0, 1);
    if (d < -A.RB_BEHIND0) return 1 + behind * clamp((-d - A.RB_BEHIND0) / A.RB_BEHIND_W, 0, 1);
    return 1;
  }
  twoRB(p) {
    if (!this.two || !p.isPlayer) return 1;
    const o = this.players.find(q => q !== p), gap = o.s - p.s, T = CFG.two;
    return gap > T.RB_GAP ? 1 + T.RB_MAX * clamp((gap - T.RB_GAP) / (T.RB_FULL - T.RB_GAP), 0, 1) : 1;
  }

  onPass(a, b) {
    if (a.isPlayer) {
      a.stats.passes++;
      a.lastPassTimes.push(this.time); a.lastPassTimes = a.lastPassTimes.filter(t => this.time - t <= CFG.pack.MAKURI_T);
      const tookLead = this.order[0] === b;
      if (a.lastPassTimes.length >= CFG.pack.MAKURI_N || tookLead) { this.emit('makuri', { who: a, victim: b }); a.lastPassTimes = []; }
      else this.emit('pass', { a, b });
    } else if (b.isPlayer) this.emit('passed', { a, b });
    else if (this.rnd() < 0.15 && Math.abs(a.d) > 1.8) this.emit('rivalMakuri', { who: a, victim: b });
  }

  watchLead(dt) {
    const L = this.order[0];
    if (L !== this.lead) { this.lead = L; this.leadSince = this.time; }
    else if (this.phase === 'run' && this.time - this.leadSince > 3 && this.leadSaid !== L && !L.finished) { this.leadSaid = L; this.emit('lead', { who: L }); }
  }

  chaosOf(p) {
    let n = 0;
    for (const o of this.runners) if (o !== p && Math.abs(o.s - p.s) < CFG.pack.CHAOS_R && Math.abs(o.d - p.d) < CFG.pack.CHAOS_R) n++;
    return n >= CFG.pack.CHAOS_N;
  }

  milestones(dt) {
    if (this.phase !== 'run') return;
    for (const p of this.players) {
      const fs = this.L - this.final;
      if (!p._soon && p.s >= fs - CFG.race.FINAL_SOON) { p._soon = true; this.emit('finalSoon', { who: p }); }
      if (!p._final && p.s >= fs) { p._final = true; this.emit('final', { who: p }); }
      if (!p._l100 && p.s >= this.L - CFG.race.LAST100) { p._l100 = true; this.emit('last100', { who: p }); }
      if (p.v > CFG.run.V_MAX * 0.95) { p._topT = (p._topT || 0) + dt; if (p._topT > CFG.fx.TOP_T && !p._topSaid) { p._topSaid = true; this.emit('topSpeed', { who: p }); } } else p._topT = 0;
      if (p.spurt > CFG.fx.AURA_SWING && this.inFinal(p.s)) { if (!p._fireOn) { p._fireOn = true; this.emit('spurtFire', { who: p }); } } else p._fireOn = false;
    }
    const me = this.players[0];
    if (me && this.chaosOf(me)) { this.chaosT += dt; if (this.chaosT > 5 && !this.chaosSaid) { this.chaosSaid = true; this.emit('chaos', { who: me }); } } else this.chaosT = 0;
  }
}
