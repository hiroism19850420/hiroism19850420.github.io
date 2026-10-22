// 保存（第29部、付録AR）。localStorage が 使えなくても 遊べる
import { CFG } from './config.js';

const KEY = 'zdash_v1';
const DEF = () => ({
  v: 1,
  prep: { done: false, at: 0 },
  last: { mode: 'solo', char: 'mimi', char2: 'kero', course: 'c1', dist: 'mid', diff: 'easy' },
  best: {},
  totals: { races: 0, steps: 0, jumps: 0, seconds: 0, firsts: 0 },
  longRuns: [],
  settings: { diff: 'easy', dist: 'mid', bgm: 6, sfx: 8, voice: true, cheer: true, giongo: 'loud', cutin: true,
    legSens: 'mid', shiftSens: 'mid', quality: 'auto', swap: false, _autoLevel: 'mid', _touchQ: false }
});
function merge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]); else if (b[k] !== undefined) a[k] = b[k]; } return a; }

export const Save = {
  data: DEF(),
  load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) this.data = merge(DEF(), s); } catch (e) { this.data = DEF(); }
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} },
  set(path, v) { const ks = path.split('.'); let o = this.data; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; this.save(); },
  bestKey(c, dist, diff) { return `${c}/${dist}/${diff}`; },
  getBest(c, dist, diff) { return this.data.best[this.bestKey(c, dist, diff)] || null; },
  // 最高記録なら 真（カメラの きろくを タッチより 先に する）
  setBest(c, dist, diff, rec) {
    const k = this.bestKey(c, dist, diff), b = this.data.best[k];
    const better = !b || (!b.cam && rec.cam) || (!!b.cam === !!rec.cam && rec.time < b.time);
    if (better) { this.data.best[k] = rec; this.save(); return true; }
    return false;
  },
  addTotals(st) { const T = this.data.totals; T.races++; T.steps += st.steps || 0; T.jumps += st.jumps || 0; T.seconds += st.seconds || 0; if (st.rank === 1) T.firsts++; this.save(); },
  // ながい を 5分の間に 2回 → すこし やすもう
  noteLong() { const now = Date.now(); this.data.longRuns = this.data.longRuns.filter(t => now - t < CFG.race.REST_WINDOW * 1000); this.data.longRuns.push(now); this.save(); return this.data.longRuns.length >= CFG.race.REST_N; },
  resetRecords() { this.data.best = {}; this.data.totals = DEF().totals; this.save(); }
};
