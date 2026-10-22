// 障害物の 置き方・合図・判定（第15部・付録Y）。描画は obsmesh.js
import { CFG } from './config.js';
import { clamp, rng } from './util.js';

const O = CFG.obstacles;
export const BASE_OF = t => t.replace(/[LR]$/, '');

function pickWeighted(rnd, W) {
  const ks = Object.keys(W), sum = ks.reduce((a, k) => a + W[k], 0);
  let x = rnd() * sum;
  for (const k of ks) { x -= W[k]; if (x <= 0) return k; }
  return ks[ks.length - 1];
}

export class Obstacle {
  constructor(type, s, opt = {}) {
    const Z = O.SIZE, base = BASE_OF(type);
    Object.assign(this, { type, base, s, chained: !!opt.chained, prev: opt.prev || null, per: new Map(), id: opt.id });
    this.ds = (Z[base] && Z[base].ds) || 0.3;
    if (base === 'dodge') {
      const e = Z.dodge.gapEdge, side = type === 'dodgeR' ? 1 : -1;
      this.side = side; this.gap = side > 0 ? [e, 4.0] : [-4.0, -e];
      this.gapCenter = (this.gap[0] + this.gap[1]) / 2;
    }
    if (base === 'hand') this.side = type === 'handR' ? 1 : -1;
  }
  inGap(d) { const m = O.SIZE.dodge.gapMargin; return d > this.gap[0] + m && d < this.gap[1] - m; }
  pushToGap(d) { return clamp(d, this.gap[0] + 0.5, this.gap[1] - 0.5); }
  state(r) { let st = this.per.get(r); if (!st) { st = { stage: null, shown: -1, accepted: false, perfect: false, done: false, thrown: false }; this.per.set(r, st); } return st; }
}

// 置き方（付録Y Y.1）
export function planObstacles(L, diff, mode, seed) {
  const K = CFG.course, rnd = rng(seed);
  const distId = L <= 600 ? 'short' : L <= 1200 ? 'mid' : 'long';
  const s0 = K.START_CLEAR[distId];
  const fin = clamp(K.FINAL_K * L, K.FINAL_MIN, K.FINAL_MAX);
  const s1 = L - fin;
  const [g0, g1] = O.SPACING[diff];
  const gk = mode === 'jama' ? O.JAMA_SPACING_K : 1;
  const list = [];
  let s = s0 + rnd() * 10, prev = null, prev2 = null, lastDodge = null, special = 0;
  while (s < s1) {
    let type;
    if (!list.length) type = 'jump';
    else {
      for (let tries = 0; tries < 30; tries++) {
        type = pickWeighted(rnd, O.WEIGHTS);
        if (type === prev && type === prev2) continue;
        if ((type === 'banzai' || type === 'hand') && (special + 1) / (list.length + 1) > O.MAX_SPECIAL) continue;
        break;
      }
    }
    if (type === 'dodge') { type = lastDodge && rnd() < 0.5 ? (lastDodge === 'dodgeR' ? 'dodgeL' : 'dodgeR') : (rnd() < 0.5 ? 'dodgeR' : 'dodgeL'); lastDodge = type; }
    if (type === 'hand') type = rnd() < 0.5 ? 'handR' : 'handL';
    if (type === 'banzai' || type.startsWith('hand')) special++;
    const ob = new Obstacle(type, s, { id: list.length });
    list.push(ob);
    prev2 = prev; prev = BASE_OF(type);
    // つづけて 2つ（はやい・ながい の 後半）
    if (diff === 'hard' && distId === 'long' && s > L / 2 && rnd() < 0.12 && s + O.DOUBLE_GAP < s1 && (prev === 'jump' || prev === 'crouch')) {
      const t2 = prev === 'jump' ? 'crouch' : 'jump';
      list.push(new Obstacle(t2, s + O.DOUBLE_GAP, { chained: true, prev: ob, id: list.length }));
      s += O.DOUBLE_GAP; prev2 = prev; prev = t2;
    }
    s += (g0 + rnd() * (g1 - g0)) * gk;
  }
  return list;
}

const ORDER = ['lead', '3', '2', '1', 'go'];

// 合図（プレイヤーごと。付録Y Y.3）
export class CueTrack {
  constructor(race, runner, I) { this.race = race; this.r = runner; this.I = I; this.cur = null; this.log = []; this.stallT = 0; this.widen = {}; this.missRun = {}; }

  next() { const r = this.r; return this.race.obstacles.find(ob => !ob.state(r).done && ob.s + ob.ds > r.s - 0.5); }

  update(dt) {
    const r = this.r, race = this.race;
    if (r.finished || race.phase === 'gate') { this.cur = null; return; }
    const ob = this.next();
    if (!ob) { this.cur = null; return; }
    const st = ob.state(r), I = this.I, sh = O.SHIFT_T[ob.base];
    const eta = (ob.s - r.s) / Math.max(r.v, O.V_ETA_MIN);
    const tLead = 3 * I + O.LEAD_EXTRA + sh;
    // 止まってしまったら やりなおし
    this.stallT = r.v < O.STALL_V ? this.stallT + dt : 0;
    if (this.stallT > O.STALL_T && st.shown > 0 && !ob.chained) { st.shown = 0; st.stage = 'lead'; this.stallT = 0; race.emit('cueAgain', { who: r, ob }); }
    if (ob.chained) {
      // つづけて 2つ：前の 障害物を 通ったら「つぎ！」、そのあと いま！
      const pst = ob.prev ? ob.prev.state(r) : { done: true };
      if (!pst.done) { this.cur = null; return; }
      if (st.shown < 0) { st.shown = 0; st.stage = 'next'; race.emit('cue', { who: r, ob, stage: 'next' }); }
      if (eta <= sh && st.shown < 4) { st.shown = 4; st.stage = 'go'; st.goAt = race.time; race.emit('cue', { who: r, ob, stage: 'go' }); }
    } else {
      let want = null;
      if (eta <= sh) want = 'go';
      else if (eta <= 1 * I + sh) want = '1';
      else if (eta <= 2 * I + sh) want = '2';
      else if (eta <= 3 * I + sh) want = '3';
      else if (eta <= tLead) want = 'lead';
      if (want && ORDER.indexOf(want) > st.shown) {
        const from = st.shown;
        st.shown = ORDER.indexOf(want); st.stage = want; if (want === 'go') st.goAt = race.time;
        // 1コマで 2段 進んだら、とばした 数字は 言わない
        race.emit('cue', { who: r, ob, stage: want, skipped: st.shown - from > 1 && from >= 0 });
        this.log.push({ ob: ob.id, stage: want, t: race.time });
      }
    }
    if (st.shown < 0) { this.cur = null; return; }
    const open = ob.base === 'dodge' ? true : ob.chained ? true : eta <= I + (O.OPEN_EXTRA[ob.base] || 0.15) + (this.widen[ob.base] || 0);
    this.cur = { id: ob.id, type: ob.type, base: ob.base, stage: st.stage, eta, open, ob,
      k: clamp(1 - eta / tLead, 0, 1), side: ob.side ? (ob.side > 0 ? 'R' : 'L') : null };
    if (open) this.accept(ob, st, eta);
  }

  // 受けつけ（入力の できごと・状態を 見る）
  accept(ob, st, eta) {
    if (st.accepted) return;
    const r = this.r, inp = this.race.inputOf(r), easy = this.race.diff === 'easy';
    let hit = false;
    switch (ob.base) {
      case 'jump':
        hit = inp.took('jump') || r.air && r.h > 0.3;
        if (hit && !r.air) r.jumpOver(eta);
        break;
      case 'crouch':
        if (r.crouch && st.crouchAt == null) st.crouchAt = this.race.time;
        return;                                              // 通過の 瞬間に 見る（checkPass）
      case 'dodge':
        hit = (Math.sign(inp.shiftNorm) === ob.side && Math.abs(inp.shiftNorm) >= 0.35) || inp.took(ob.side > 0 ? 'dodgeR' : 'dodgeL') || ob.inGap(r.d);
        if (hit) { r.assistLat = true; r.dTarget = ob.gapCenter; r.assistOb = ob; }
        break;
      case 'banzai':
        hit = inp.took('banzai') || inp.bothUp;
        if (hit) { r.pose('banzai'); r.act(); }
        break;
      case 'hand': {
        const want = ob.side > 0 ? 'handR' : 'handL', other = ob.side > 0 ? 'handL' : 'handR';
        hit = inp.took(want) || (easy && inp.took(other));
        if (hit) { r.pose(ob.side > 0 ? 'swatR' : 'swatL'); r.act(); }
        break;
      }
    }
    if (hit) { st.accepted = true; st.perfect = Math.abs(eta - O.SHIFT_T[ob.base]) <= O.PERFECT; }
  }
}

// 通過の 判定（毎コマ、ランナーごと。付録K K.4）
export function checkPass(race, r) {
  for (const ob of race.obstacles) {
    if (Math.abs(ob.s - r.s) > 4) continue;
    const st = ob.state(r);
    if (st.done) continue;
    const inS = r.s >= ob.s - ob.ds && r.s <= ob.s + ob.ds, past = r.s > ob.s + ob.ds;
    // ボールを 投げる（着く 0.9 秒前）
    if (ob.base === 'hand' && !st.thrown) { const eta = (ob.s - r.s) / Math.max(r.v, 4); if (eta < O.SIZE.hand.flight) { st.thrown = true; race.emit('ballThrow', { who: r, ob }); } }
    let res = null;
    switch (ob.base) {
      case 'jump':   if (inS && r.h < CFG.run.CLEAR_H) res = false; else if (past) res = true; break;
      case 'crouch': if (inS && !r.crouch) res = false; else if (past) res = true; break;
      case 'dodge':  if (inS && !ob.inGap(r.d)) { res = false; r.d = ob.pushToGap(r.d); r.dTarget = r.d; } else if (past) res = true; break;
      default:       if (r.s >= ob.s) res = st.accepted; break;
    }
    if (res == null) continue;
    st.done = true;
    if (ob.base === 'crouch' && res) st.perfect = st.crouchAt != null && st.goAt != null && Math.abs(st.crouchAt - st.goAt) <= O.PERFECT;
    if (r.assistOb === ob) { r.assistLat = false; r.assistOb = null; }
    race.onObstacle(r, ob, res, st.perfect);
  }
}
