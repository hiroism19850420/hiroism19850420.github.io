// 馬群：当たり、ふさがれ、おまかせ、抜いた（第16部・付録K）
import { CFG } from './config.js';
import { clamp, damp } from './util.js';

const P = CFG.pack;
const traitPush = r => (CFG.ai.TRAITS[r.char] && CFG.ai.TRAITS[r.char].push) || 1;
const traitPushed = r => (CFG.ai.TRAITS[r.char] && CFG.ai.TRAITS[r.char].pushed) || 1;

export function packStep(race, dt) {
  const rs = race.runners;
  for (const r of rs) r.blockedBy = null;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    if (a.finished && b.finished) continue;
    const ds = b.s - a.s, dd = b.d - a.d, ads = Math.abs(ds), add = Math.abs(dd);
    if (ads >= P.BLOCK_DS1 || add >= P.OVERLAP_DD) continue;
    if (Math.abs(a.h - b.h) > 0.6) continue;                 // 片方が 高く とんでいる
    if (ads >= P.BLOCK_DS0) {
      // 前後：後ろが ふさがれる
      const back = ds > 0 ? a : b, front = ds > 0 ? b : a;
      if (!race.yields(back, front)) { back.blockedBy = front; back.blockedT += dt; }
    } else {
      // 横並び：押しもどす
      const over = P.OVERLAP_DD - add, dir = Math.sign(dd) || (i % 2 ? 1 : -1);
      let ka = 0.5, kb = 0.5;
      if (race.protects(a)) { ka = 0; kb = 1; } else if (race.protects(b)) { ka = 1; kb = 0; }
      ka *= traitPushed(a) / traitPush(b); kb *= traitPushed(b) / traitPush(a);
      const kSum = ka + kb || 1;
      a.d -= dir * over * ka / kSum; b.d += dir * over * kb / kSum;
      a.vd -= dir * P.PUSH_V * ka; b.vd += dir * P.PUSH_V * kb;
      const key = a.id + '|' + b.id;
      if ((race.contactAt[key] ?? -9) + P.CONTACT_GAP < race.time) {
        race.contactAt[key] = race.time;
        a.v *= 1 - P.CONTACT_LOSS; b.v *= 1 - P.CONTACT_LOSS;
        const dv = Math.abs(a.vd - b.vd);
        if (dv > P.CONTACT_SOUND_DV) race.emit('contact', { a, b, power: dv });
      }
    }
  }
  for (const r of rs) if (!r.blockedBy) r.blockedT = 0;
  // 抜いた
  for (const a of rs) for (const b of rs) {
    if (a === b || a.finished || b.finished) continue;
    const pa = race.prevS[a.id], pb = race.prevS[b.id];
    if (pa == null || pb == null) continue;
    if (pa < pb && a.s >= b.s && Math.abs(a.d - b.d) < P.PASS_DD) race.onPass(a, b);
  }
  for (const r of rs) race.prevS[r.id] = r.s;
}

// おまかせ（16.3）：プレイヤーの shiftNorm が 0 の時と、ライバル
export function autoLine(r, race, dt, opt = {}) {
  r.decideT -= dt;
  if (r.decideT > 0) return;
  const look = P.LOOK0 + r.v * P.LOOK_K;
  let F = null;
  for (const o of race.runners) {
    if (o === r || o.finished) continue;
    const ds = o.s - r.s;
    if (ds > 0 && ds < look && Math.abs(o.d - r.d) < P.LOOK_DD && (!F || o.s < F.s)) F = o;
  }
  r.passing = false;
  if (!F || r.vt <= F.v + P.WANT_DV) {
    if (opt.prefer != null) r.dTarget = damp(r.dTarget, opt.prefer, 3, dt);
    escapeBehind(r, race);
    return;
  }
  const D = CFG.run.D_MAX;
  const cands = [clamp(F.d - P.CAND_OFF, -D, D), clamp(F.d + P.CAND_OFF, -D, D)];
  let best = null, bestCost = P.COST_WAIT0 + (r.blockedT || 0) * P.COST_WAIT_K;
  const ob = race.nextObstacleAhead(r, 40);
  for (const c of cands) {
    if (Math.abs(c - F.d) < 0.8) continue;                     // はしで 横に 出られない
    let cost = 0;
    for (const o of race.runners) {
      if (o === r || o === F) continue;
      const ds = o.s - r.s; if (ds < -2 || ds > 8) continue;
      cost += Math.max(0, 1.3 - Math.abs(o.d - c)) * P.COST_CROWD * (opt.crowdK || 1);
    }
    cost += Math.abs(c - r.d) * P.COST_MOVE;
    if (Math.abs(c) > P.EDGE_D) cost += P.COST_EDGE;
    if (ob && ob.base === 'dodge') cost += ob.inGap(c) ? P.COST_GAP : P.COST_BLOCKED;
    if (opt.outward && Math.abs(c) > Math.abs(r.d)) cost += P.COST_OUT;
    if (opt.target && Math.abs(c - opt.target.d) < 1.6) cost += CFG.jama.ANGRY_SIDE;
    if (cost < bestCost) { bestCost = cost; best = c; }
  }
  if (best != null) { r.dTarget = best; r.passing = true; r.decideT = P.DECIDE_HOLD; }
}

// 後ろから 速い ランナーが 来たら 少し よける
function escapeBehind(r, race) {
  for (const o of race.runners) {
    if (o === r) continue;
    const ds = r.s - o.s;
    if (ds > 0 && ds < 2.5 && Math.abs(o.d - r.d) < 0.8 && o.v > r.v + 1) { r.dTarget = r.d + (Math.sign(r.d - o.d) || 1) * P.ESCAPE; return; }
  }
}
