// じゃまモード（第18部・付録Z）。1人用だけ
import { CFG } from './config.js';

const J = CFG.jama;

export class Jama {
  constructor(race, rnd) {
    this.race = race; this.rnd = rnd; this.on = race.mode === 'jama';
    this.wind = []; this.nextPlayer = 0; this.angry = new Map(); this.firstHit = true; this.hitN = 0;
  }

  // 横に いる 相手（18.2）。side：−1 左、1 右
  sideOf(a, side) {
    let best = null, bd = 9;
    for (const b of this.race.runners) {
      if (b === a || b.finished) continue;
      const ds = Math.abs(b.s - a.s), dd = (b.d - a.d) * side;
      if (ds < J.RANGE_DS && dd > J.RANGE_DD0 && dd < J.RANGE_DD1 && dd < bd) { best = b; bd = dd; }
    }
    return best;
  }
  sidesOf(a) { return this.on ? [this.sideOf(a, -1), this.sideOf(a, 1)] : [null, null]; }
  windFor(p) { return this.wind.find(w => w.to === p) || null; }
  targetFor(brain) { const a = brain.r; return this.on && (this.angry.get(a) || 0) > this.race.time ? this.race.players[0] : null; }
  isAngry(r) { return (this.angry.get(r) || 0) > this.race.time; }

  // プレイヤーの 手・足（できごと armL/armR/legL/legR）
  playerAct(p, kind, side) {
    p.pose((kind === 'arm' ? 'arm' : 'leg') + (side > 0 ? 'R' : 'L')); p.act(0.4);
    if (!this.on) return;
    const b = this.sideOf(p, side);
    if (!b || b.safeT > 0) { this.race.emit('jamaWhiff', { from: p, kind, side }); return; }
    if (this.rnd() < J.DODGE_P[this.race.diff]) {
      if (kind === 'arm') b.forceCrouch = 0.5; else b.jump();
      this.race.emit('jamaDodge', { from: p, to: b, kind, cut: false });
      return;
    }
    this.hit(p, b, kind, side);
  }

  hit(a, b, kind, side) {
    if (!b.stumble('jama', a.d)) return;
    b.vd += side * J.HIT_PUSH * 4;
    if (a.isPlayer) {
      a.stats.jamaHit++;
      const first = !b._angered; b._angered = true;
      this.angry.set(b, this.race.time + J.ANGRY_T);
      this.race.emit('angry', { who: b, first });
    }
    if (b.isPlayer) b.stats.jamaGot++;
    const cut = a.isPlayer && (this.firstHit || ++this.hitN % J.CUTIN_EVERY === 0);
    if (a.isPlayer) this.firstHit = false;
    this.race.emit('jamaHit', { from: a, to: b, kind, side, cut });
  }

  update(dt) {
    if (!this.on) return;
    const race = this.race, t = race.time, D = race.diff;
    for (const w of this.wind.slice()) {
      w.t += dt;
      if (w.t >= J.WINDUP) { this.wind.splice(this.wind.indexOf(w), 1); this.strike(w); }
    }
    if (race.phase !== 'run') return;
    for (const a of race.runners) {
      if (a.isPlayer || a.finished || a.stumbleT > 0 || this.wind.some(w => w.from === a)) continue;
      if ((a.jamaNext || 0) > t) continue;
      for (const side of [-1, 1]) {
        const b = this.sideOf(a, side); if (!b) continue;
        let lam;
        if (b.isPlayer) {
          if (t < this.nextPlayer || race.cueEta(b) <= J.CUE_BLOCK || race.L - b.s < J.END_FREE || b.finished) continue;
          lam = J.LAMBDA[D] * (this.isAngry(a) ? J.ANGRY_K : 1) * ((CFG.ai.TRAITS[a.char] || {}).jama || 1);
        } else lam = J.CPU_LAMBDA;
        if (this.rnd() < lam * dt) { this.windup(a, b, side); break; }
      }
    }
  }

  windup(a, b, side) {
    const legP = (CFG.ai.TRAITS[a.char] || {}).legJama ?? (1 - J.ARM_P);
    const kind = this.rnd() < legP ? 'leg' : 'arm';
    a.pose('windup' + (kind === 'arm' ? 'Arm' : 'Leg') + (side > 0 ? 'R' : 'L'));
    a.jamaNext = this.race.time + J.RIVAL_GAP;
    if (b.isPlayer) this.nextPlayer = this.race.time + J.PLAYER_GAP;
    const w = { from: a, to: b, side, kind, t: 0 };
    this.wind.push(w);
    this.race.emit('jamaWindup', w);
  }

  strike(w) {
    const a = w.from, b = w.to;
    a.pose(w.kind + (w.side > 0 ? 'R' : 'L')); a.act(0.4);
    if (this.sideOf(a, w.side) !== b) { this.race.emit('jamaWhiff', { from: a, kind: w.kind, side: w.side }); return; }
    const dodged = b.isPlayer ? (w.kind === 'arm' ? !!b.crouch : b.h > J.AIR_H) : this.rnd() < J.DODGE_P[this.race.diff];
    if (!b.isPlayer && dodged) { if (w.kind === 'arm') b.forceCrouch = 0.4; else b.jump(); }
    if (dodged) {
      a.v *= J.WHIFF_K;
      if (b.isPlayer) { b.stats.jamaDodge++; b.boost(J.DODGE_BOOST); }
      this.race.emit('jamaDodge', { from: a, to: b, kind: w.kind, cut: b.isPlayer });
    } else this.hit(a, b, w.kind, w.side);
    this.angry.delete(a);
  }
}
