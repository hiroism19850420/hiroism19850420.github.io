// SaveManager：ブラウザのローカルストレージのみ。個人情報・操作履歴は保存しない。
const KEY = 'noteKaijuZenshin.save';   // ぜんしん版は 元のゲームと記録を分ける（同じサイトの中なので）
const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    tutorialDone: false,
    volume: { master: 0.5, bgm: 0.4, se: 0.7 },
    muted: false,
    quality: null,          // null = 自動
    reduceFx: false,
    shapeGuide: true,       // 推奨図形アイコン（ふつう難易度）
    damageNumbers: true,
    zenGuide: true,         // ぜんしん版：操作の案内を出す
    lastDiff: 'easy',
    best: { easy: { score: 0, timeMs: 0 }, normal: { score: 0, timeMs: 0 } },
    plays: 0,
    wins: 0,
    custom: null,           // 描いた怪獣（点は0〜1000の整数）
    customName: '',
    useCustom: false,
  };
}

function sanitize(d) {
  const base = defaultSave();
  if (!d || typeof d !== 'object' || d.v !== SAVE_VERSION) return base;
  const num = (x, lo, hi, def) => (typeof x === 'number' && isFinite(x) ? Math.min(hi, Math.max(lo, x)) : def);
  const out = base;
  out.tutorialDone = !!d.tutorialDone;
  if (d.volume) {
    out.volume.master = num(d.volume.master, 0, 1, base.volume.master);
    out.volume.bgm = num(d.volume.bgm, 0, 1, base.volume.bgm);
    out.volume.se = num(d.volume.se, 0, 1, base.volume.se);
  }
  out.muted = !!d.muted;
  out.quality = ['high', 'mid', 'low'].includes(d.quality) ? d.quality : null;
  out.reduceFx = !!d.reduceFx;
  out.shapeGuide = d.shapeGuide !== false;
  out.damageNumbers = d.damageNumbers !== false;
  out.zenGuide = d.zenGuide !== false;
  out.lastDiff = d.lastDiff === 'normal' ? 'normal' : 'easy';
  for (const k of ['easy', 'normal']) {
    const b = d.best && d.best[k];
    if (b) { out.best[k].score = num(b.score, 0, 1e9, 0) | 0; out.best[k].timeMs = num(b.timeMs, 0, 1e9, 0) | 0; }
  }
  out.plays = num(d.plays, 0, 1e9, 0) | 0;
  out.wins = num(d.wins, 0, 1e9, 0) | 0;
  if (Array.isArray(d.custom) && d.custom.length && d.custom.length < 400) out.custom = d.custom;
  out.customName = typeof d.customName === 'string' ? d.customName.slice(0, 12) : '';
  out.useCustom = !!d.useCustom && !!out.custom;
  return out;
}

export const Save = {
  data: defaultSave(),
  available: true,
  onError: null,
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.data = sanitize(raw ? JSON.parse(raw) : null);
    } catch (e) {
      this.available = false;
      this.data = defaultSave();
    }
    return this.data;
  },
  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      this.available = false;
      if (this.onError) this.onError(e);
      return false;
    }
  },
  resetRecords() {
    this.data.best = defaultSave().best;
    this.data.plays = 0;
    this.data.wins = 0;
    this.data.tutorialDone = false;
    return this.write();
  },
};
