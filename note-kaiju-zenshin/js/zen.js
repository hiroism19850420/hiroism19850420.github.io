// ぜんしん版：カメラで読んだ体（../body.js の Body）から ペンを作る。
// 右手首 ＝ ペン先。左手を挙げている間だけ ペンが紙に下りる（書ける）。左手を下ろすと 紙から離れる。
// pen は「描くところ」の中の 0〜1（x：左→右、y：上→下）。戦い（battle）と 怪獣を描く画面（pad）で 写す範囲を変える。
// 調整する数値は config.js の ZEN。
import { ZEN } from './config.js';

const now = () => performance.now() / 1000;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// One Euro フィルタ：ゆっくり動かすと ぶれを消し、速く動かすと おくれを減らす（かきじゅん ぜんしん版と同じ）
function oneEuro(minC, beta) {
  let x = null, dx = 0, t0 = 0;
  const al = (c, dt) => { const r = 2 * Math.PI * c * dt; return r / (r + 1); };
  const f = (v, t) => {
    if (x === null || t - t0 > 0.5) { x = v; dx = 0; t0 = t; return v; }
    const dt = Math.max(1e-3, t - t0); t0 = t;
    dx += al(1, dt) * ((v - x) / dt - dx);
    x += al(minC + beta * Math.abs(dx), dt) * (v - x);
    return x;
  };
  f.reset = () => { x = null; };
  return f;
}
// 1人ぶんの 体のペンを作る。ふたりで あそぶときは Zens[0]（1P）・Zens[1]（2P）を それぞれの体で動かす
export function makeZen() {
const fX = oneEuro(ZEN.SMOOTH.minCutoff, ZEN.SMOOTH.beta), fY = oneEuro(ZEN.SMOOTH.minCutoff, ZEN.SMOOTH.beta);

return {
  on: false,            // カメラで遊んでいる（または ?dbg の nkz.zen() で 合成入力）
  ctx: 'battle',        // 'battle' | 'pad'
  fake: null,           // 合成入力 { x, y, left, lv, rv, both }
  pen: { x: 0.5, y: 0.6 },   // 画面に出す ペン先（なめらか）
  tgt: { x: 0.5, y: 0.6 },   // 読みとった ペン先（フィルタ後）
  leftRaw: false,       // 左手を挙げている（ヒステリシスつき。見えないときは 前の値のまま）
  leftUp: false,        // 左手を挙げていて、見えている
  writing: false,       // ペンが紙に下りている（左手が挙がっていて、右手が見えている）
  body: false, rVis: false, lVis: false,
  bothHigh: false, pauseHold: 0, pauseArmed: true, pauseReq: false,
  clock: 0, leftDownAt: -9,
  onUndo: null,
  u: null, ax: null, ay: null,
  rSeen: -9, lSeen: -9, poseSeen: -9,
  hist: [], undoAt: -9,

  setCtx(c) {
    if (c === this.ctx) return;
    this.ctx = c;
    fX.reset(); fY.reset();
    this.leftRaw = false; this.hist.length = 0;
  },

  // body.js の 'pose' ごとに呼ぶ。lm：MediaPipe の関節33個、asp：映像の 横÷縦
  feed(lm, asp) {
    const t = now();
    const P = i => ({ x: (1 - lm[i].x) * asp, y: lm[i].y, v: lm[i].visibility == null ? 1 : lm[i].visibility });
    const ls = P(11), rs = P(12);   // 鏡うつしなので 左肩（11）が 画面の左
    if (ls.v < 0.5 || rs.v < 0.5) return;
    this.poseSeen = t;
    const sw = Math.max(0.04, Math.hypot(ls.x - rs.x, ls.y - rs.y));
    this.u = this.u == null ? sw : this.u + (sw - this.u) * ZEN.UNIT;
    const u = this.u, cx = (ls.x + rs.x) / 2, cy = (ls.y + rs.y) / 2;
    // 紙の基準（肩の中心）は ゆっくり体についていく。書いている間は止めて、体がゆれても線がずれないように
    if (this.ax == null) { this.ax = cx; this.ay = cy; }
    else if (!this.writing) { this.ax += (cx - this.ax) * ZEN.ANCHOR; this.ay += (cy - this.ay) * ZEN.ANCHOR; }
    const seen = p => p.v > ZEN.VIS && p.x > -0.02 * asp && p.x < 1.02 * asp && p.y > -0.02 && p.y < 1.02;
    const rw = P(16), lw = P(15);
    const rOk = seen(rw), lOk = seen(lw);
    if (rOk) {
      this.rSeen = t;
      const R = this.ctx === 'pad' ? ZEN.PAD : ZEN.PEN;
      const nx = 0.5 + (rw.x - this.ax - R.cx * u) / (2 * R.x * u);
      const top = this.ay + (R.chest - R.up) * u, bot = this.ay + (R.chest + R.down) * u;
      this.setTarget(nx, (rw.y - top) / (bot - top), t);
      // 左手を挙げたまま 右手を 左へ大きく払う → ひとつもどす（怪獣を描く画面だけ）
      const hx = (rw.x - cx) / u;
      this.hist.push({ x: hx, t });
      while (this.hist.length && t - this.hist[0].t > ZEN.UNDO.time) this.hist.shift();
      if (this.ctx === 'pad' && this.leftUp && t - this.undoAt > ZEN.UNDO.rearm) {
        let mx = -Infinity;
        for (const h of this.hist) mx = Math.max(mx, h.x);
        if (mx - hx >= ZEN.UNDO.dist) { this.undoAt = t; this.hist.length = 0; if (this.onUndo) this.onUndo(); }
      }
    }
    if (lOk) {
      this.lSeen = t;
      const L = this.ctx === 'pad' ? ZEN.LEFT_PAD : ZEN.LEFT;
      const h = (ls.y - lw.y) / u;   // 肩より上が ＋
      this.leftRaw = this.leftRaw ? h > -L.out : h > L.in;
    }
    this.bothHigh = rOk && lOk && (ls.y - lw.y) / u > ZEN.PAUSE.up && (rs.y - rw.y) / u > ZEN.PAUSE.up;
  },

  setTarget(nx, ny, t) {
    this.tgt.x = fX(clamp01(nx) * 1000, t) / 1000;
    this.tgt.y = fY(clamp01(ny) * 1000, t) / 1000;
  },

  // 毎フレーム呼ぶ（シーンの update から。?dbg の早送りでも同じ時計で進む）
  tick(dt) {
    this.clock += dt;
    const t = now();
    const F = this.fake;
    if (F) {
      this.tgt.x = clamp01(F.x); this.tgt.y = clamp01(F.y);
      this.rSeen = F.rv ? t : -9; this.lSeen = F.lv ? t : -9;
      this.poseSeen = F.rv || F.lv ? t : -9;
      if (F.lv) this.leftRaw = !!F.left;
      this.bothHigh = !!F.both;
    }
    this.body = t - this.poseSeen < ZEN.LOST;
    const rWas = this.rVis;
    this.rVis = t - this.rSeen < ZEN.LOST;
    this.lVis = t - this.lSeen < ZEN.LOST;
    const up = this.leftRaw && this.lVis;   // 左手が見えないときは ペンを離した扱い
    if (!up && this.leftUp) this.leftDownAt = this.clock;
    this.leftUp = up;
    this.writing = up && this.rVis;
    // ペン先：見えはじめは すぐそこへ、あとは なめらかに追いつく
    if (this.rVis && !rWas) { this.pen.x = this.tgt.x; this.pen.y = this.tgt.y; }
    const k = F ? 1 : Math.min(1, dt * ZEN.SMOOTH.follow);
    this.pen.x += (this.tgt.x - this.pen.x) * k;
    this.pen.y += (this.tgt.y - this.pen.y) * k;
    // ポーズ：両手を高く上げて 1秒。いちど下ろすまで 次を受けつけない
    if (this.bothHigh && this.body) {
      if (this.pauseArmed) {
        this.pauseHold += dt / ZEN.PAUSE.hold;
        if (this.pauseHold >= 1) { this.pauseReq = true; this.pauseHold = 0; this.pauseArmed = false; }
      }
    } else { this.pauseHold = 0; this.pauseArmed = true; }
  },

  // 案内に出す状態
  status() {
    if (!this.body && !this.rVis && !this.lVis) return 'nobody';
    if (!this.lVis) return 'noLeft';
    if (!this.rVis) return 'noRight';
    return this.leftUp ? 'writing' : 'idle';
  },

  // 拍手を「できた」に使ってよいか（左手を挙げている間・下ろした直後は使わない）
  quiet() { return !this.leftUp && this.clock - this.leftDownAt >= ZEN.CLAP_QUIET; },
};
}
export const Zen = makeZen();
export const Zens = [makeZen(), makeZen()];
