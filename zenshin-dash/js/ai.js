// ライバルの 頭（第17部・付録K K.3）と、テスト用の 自動の プレイヤー（第31部 31.3）
import { CFG } from './config.js';
import { clamp, lerp } from './util.js';
import { autoLine } from './pack.js';

const A = CFG.ai;

export class RivalBrain {
  constructor(r, race, strength, style, rnd) {
    this.r = r; this.race = race; this.strength = strength; this.style = style; this.rnd = rnd;
    this.prefer = (rnd() * 2 - 1) * 2.5; this.preferT = 6 + rnd() * 6;
    this.wob = rnd() * 10;
    this.spurtSkill = lerp(A.SPURT_SKILL[0], A.SPURT_SKILL[1], rnd());
    this.trait = A.TRAITS[r.char] || {};
    r.trait = this.trait; r.jumpK = this.trait.jumpH || 1;
    this.plans = new Map();
    this.crouchNow = false;
  }

  think(dt) {
    const r = this.r, race = this.race, D = race.diff, L = race.L;
    // 速さ（型・強さ・ゴム・ゆらぎ）
    const p = clamp(r.s / L, 0, 1), st = A.STYLES[this.style];
    const [e0, e1] = A.STYLE_EDGES, b = A.STYLE_BLEND;
    const k = p < e0 - b ? st[0] : p < e0 + b ? lerp(st[0], st[1], (p - e0 + b) / (2 * b))
      : p < e1 - b ? st[1] : p < e1 + b ? lerp(st[1], st[2], (p - e1 + b) / (2 * b)) : st[2];
    this.wob += dt;
    let vt = A.BASE[D] * this.strength * k * (1 + A.WOBBLE * Math.sin(this.wob * 2 * Math.PI / A.WOBBLE_T));
    vt *= race.rubber(r);
    if (race.inFinal(r.s)) vt *= 1 + A.SPURT_K * this.spurtSkill;
    if (race.time - (race.runStart || 0) < 1.2) vt *= 0.96 + 0.04 * this.strength;   // 出だしは みんな 近い
    // 好きな 線を ときどき 変える
    this.preferT -= dt;
    if (this.preferT < 0) { this.prefer = (this.rnd() * 2 - 1) * 2.5; this.preferT = 6 + this.rnd() * 6; }
    // 横：どっしり が 近ければ すき間へ、それ以外は おまかせ
    const ob = race.nextObstacleAhead(r, 70);
    const plan = ob ? this.planFor(ob) : null;
    this.crouchNow = false;
    if (race.time - (race.runStart || 0) < 1.5) r.dTarget = r.d;            // スタート直後は まっすぐ
    else if (ob && ob.base === 'dodge' && plan && r.s >= ob.s - plan.reactS) r.dTarget = plan.ok ? ob.gapCenter + plan.offset : plan.lateD;
    else autoLine(r, race, dt, { prefer: this.prefer, crowdK: this.trait.crowd || 1, outward: this.style === 'oikomi' || this.style === 'sashi', target: race.jama && race.jama.targetFor(this) });
    if (ob && plan) this.doObstacle(ob, plan);
    return { vt, crouch: this.crouchNow };
  }

  planFor(ob) {
    let plan = this.plans.get(ob);
    if (plan) return plan;
    const D = this.race.diff;
    let okP = CFG.obstacles.RIVAL_OK[D] + (this.strength - 1) * 3 * CFG.obstacles.RIVAL_OK_SPREAD;
    if (ob.base === 'jump') okP += this.trait.jumpOk || 0;
    if (ob.base === 'crouch') okP += this.trait.crouchOk || 0;
    plan = { ok: this.rnd() < clamp(okP, 0.3, 0.98), late: lerp(A.ACT_LATE[0], A.ACT_LATE[1], this.rnd()),
      reactS: 22 + this.rnd() * 40, offset: (this.rnd() * 2 - 1) * 0.85, lateD: (this.rnd() * 2 - 1) * 1.4, done: false };
    this.plans.set(ob, plan);
    return plan;
  }

  doObstacle(ob, plan) {
    const r = this.r, eta = (ob.s - r.s) / Math.max(r.v, 4), st = ob.state(r);
    switch (ob.base) {
      case 'jump':
        if (!plan.done && eta < 0.42) { plan.done = true; if (plan.ok) r.jumpOver(eta); else if (this.rnd() < 0.5) { r.jump(); } }
        break;
      case 'crouch':
        if (plan.ok ? eta < 0.6 : eta < 0.08) this.crouchNow = plan.ok || eta > -0.2;
        break;
      case 'banzai':
        if (!plan.done && eta < 0.5) { plan.done = true; if (plan.ok) { st.accepted = true; r.pose('banzai'); r.act(); } }
        break;
      case 'hand':
        if (!plan.done && eta < 0.5) { plan.done = true; if (plan.ok) { st.accepted = true; r.pose(ob.side > 0 ? 'swatR' : 'swatL'); r.act(); } }
        break;
    }
  }
}

// テスト用の 自動の プレイヤー。level：0〜1
export class AutoPlayer {
  constructor(level, race) { this.level = level; this.race = race; this.done = new Set(); this.crouchUntil = [0, 0]; this.armNext = [0, 0]; this.seed = 7; }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  think(dt, players) {
    const race = this.race, lv = this.level, act = lv > 0.05;
    race.players.forEach((p, i) => {
      const inp = players[i], a = inp.auto || (inp.auto = {});
      a.th = clamp(lv < 0.05 ? 0.85 : lv, 0, 1); a.shift = 0; a.crouch = race.time < this.crouchUntil[i]; a.swing = race.inFinal(p.s) ? lv : 0;
      if (!act || race.phase !== 'run') return;
      const cue = race.cues[i].cur;
      if (cue) {
        const key = i + ':' + cue.id, sh = CFG.obstacles.SHIFT_T[cue.base];
        // 人の まね：強さが 低いほど ずれる・しない
        const h = ((cue.id * 7919 + i * 104729) % 1000) / 1000;
        const skip = h < (1 - lv) * 0.8;
        const jit = (1 - lv) * 1.2 * (((cue.id * 37 + i * 11) % 9) / 4 - 1);
        if (!skip) {
          if (cue.base === 'dodge' && cue.stage !== 'lead') a.shift = cue.side === 'R' ? 1 : -1;
          if (cue.base === 'crouch' && cue.eta <= sh + 0.15 + jit) { a.crouch = true; this.crouchUntil[i] = race.time + 0.15; }
          if (!this.done.has(key) && cue.eta <= sh + jit) {
            this.done.add(key);
            if (cue.base === 'jump') inp.push('jump');
            if (cue.base === 'banzai') inp.push('banzai');
            if (cue.base === 'hand') inp.push(cue.side === 'R' ? 'handR' : 'handL');
          }
        }
      }
      // じゃまモード
      const J = race.jama;
      if (J && J.on) {
        for (const side of [-1, 1]) {
          const k = side > 0 ? 1 : 0;
          if (race.time > this.armNext[k] && J.sideOf(p, side) && this.rnd() < lv * 0.5) { inp.push((this.rnd() < 0.6 ? 'arm' : 'leg') + (side > 0 ? 'R' : 'L')); this.armNext[k] = race.time + 2.5; }
        }
        for (const w of J.wind) if (w.to === p && this.rnd() < lv * dt * 30) {
          const left = CFG.jama.WINDUP - w.t;
          if (w.kind === 'arm' && left < 0.5) { this.crouchUntil[i] = race.time + left + 0.15; }
          if (w.kind === 'leg' && left < 0.32 && left > 0.2 && !p.air) inp.push('jump');
        }
      }
    });
  }
}
