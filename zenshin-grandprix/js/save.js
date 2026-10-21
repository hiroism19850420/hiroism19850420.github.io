// 保存（第26部）。localStorage が 使えなくても 遊べる
const KEY = 'zgp_v1';
const DEF = () => ({
  ver: 1,
  prep: { done: false, theta0: 0, legs: true, at: 0 },
  char: 'mimi', diff: 'easy', course: 'c1',
  best: {},
  cups: { easy: 0, normal: 0, hard: 0 },
  total: { steps: 0, jumps: 0, squats: 0, banzais: 0, races: 0, seconds: 0 },
  settings: { laps: 3, assist: 'auto', legSens: 'mid', steerSens: 'mid', bgm: 6, sfx: 8, voice: true, quality: 'auto', swap: false, diffSingle: 'easy', _autoLevel: 'mid' }
});
function merge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else if (b[k] !== undefined) a[k] = b[k]; } return a; }

export const Save = {
  data: DEF(),
  load() {
    try { const s = localStorage.getItem(KEY); if (s) { const d = JSON.parse(s); if (d && d.ver === 1) this.data = merge(DEF(), d); } } catch (e) { this.data = DEF(); }
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} },
  resetRecords() { const d = DEF(); d.settings = this.data.settings; d.prep = this.data.prep; d.char = this.data.char; this.data = d; this.save(); },
  bestKey(course, laps) { return laps === 3 ? course : `${course}_${laps}`; },
  getBest(course, laps) { return this.data.best[this.bestKey(course, laps)] || null; },
  // 最高記録なら 真
  setBest(course, laps, rec) {
    const k = this.bestKey(course, laps), cur = this.data.best[k];
    const better = !cur || (cur.nocam && !rec.nocam) || (!!cur.nocam === !!rec.nocam && rec.time < cur.time);
    if (better && !(cur && !cur.nocam && rec.nocam)) { this.data.best[k] = rec; this.save(); return true; }
    if (cur && rec.lap < (cur.lap || 1e9) && !!cur.nocam === !!rec.nocam) { cur.lap = rec.lap; this.save(); }
    return false;
  },
  addTotals(st, sec) {
    const t = this.data.total;
    t.steps += st.steps || 0; t.jumps += st.jumps || 0; t.squats += st.squats || 0; t.banzais += st.banzais || 0; t.races++; t.seconds += sec || 0;
    this.save();
  },
  setCup(diff, rank) { const v = rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0; if (v > (this.data.cups[diff] || 0)) { this.data.cups[diff] = v; this.save(); return true; } return false; },
  set(path, v) { const ks = path.split('.'); let o = this.data; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; this.save(); }
};
