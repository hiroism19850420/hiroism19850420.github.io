// 起動：素材の準備 → 3D と 2D の Canvas を重ねる → タイトル
import { GAME, QUALITY, DIFF, SHAPES, ZEN, STROKE, TUNE } from './config.js';
import { Save } from './save.js';
import { AudioManager } from './audio.js';
import { ThreeView } from './three-view.js';
import { UI } from './ui.js';
import { MainScene } from './scene.js';
import { recognize, pointSegDist } from './recognizer.js';
import { Battle } from './battle.js';
import { buildArt, isUsable, unpackStrokes, drawCustomDoodle, autoName } from './custom-monster.js';
import { Zen, Zens } from './zen.js';
import { Guide } from './guide.js';

const stage = document.getElementById('stage');
// ふたりで：カメラに 2人 うつす。画面の左に立つ人が 1P、右の人が 2P（それぞれ 自分の 右手首が ペン）
let seen2At = -9;
if (window.Body) window.Body.people = 2;
const Body = window.Body;
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const ctl = {
  view: null, audio: new AudioManager(), ui: null, scene: null, game: null,
  fixedSeed: null,
  people() { return performance.now() / 1000 - seen2At < 1 ? 2 : 1; },   // いま カメラに 2人 うつっているか
  isPortrait() { return isMobile && window.innerHeight > window.innerWidth; },
  applyQuality() {
    const q = Save.data.quality || ctl.autoQuality;
    ctl.view.setQuality(q);
    layout(true);
  },
  applyFx() {
    ctl.view.reduceFx = Save.data.reduceFx;
    if (ctl.scene && ctl.scene.battle) ctl.scene.battle.reduceFx = Save.data.reduceFx;
  },
  // 描いた怪獣 ⇔ 見本の怪獣
  applyMonster() {
    const D = Save.data;
    let strokes = D.useCustom && D.custom ? unpackStrokes(D.custom) : null;
    if (strokes && !isUsable(strokes)) strokes = null;
    const view = ctl.view;
    if (strokes) {
      try {
        const art = buildArt(strokes);
        view.setCustom(art);
        view.setDoodleDrawer((g, w, h, glow) => drawCustomDoodle(g, w, h, strokes, glow, art));
        ctl.art = art; ctl.strokes = strokes;
      } catch (e) { strokes = null; }
    }
    if (!strokes) { view.clearCustom(); view.setDoodleDrawer(null); ctl.art = null; ctl.strokes = null; }
    ctl.monsterName = strokes ? (D.customName || autoName(strokes)) : 'ラクガキドン';
    if (ctl.scene && ctl.scene.tBossName) ctl.scene.tBossName.setText(ctl.monsterName);
    if (ctl.scene && ctl.scene.state === 'TITLE') view.setMode('title');
  },
  onSceneReady(scene) {
    ctl.scene = scene;
    layout(true);
    finishBoot();
  },
};

Save.onError = () => {};
Save.load();
ctl.autoQuality = isMobile ? 'mid' : 'high';
ctl.audio.setVolume(Save.data.volume);
ctl.audio.setMuted(Save.data.muted);
ctl.ui = new UI(ctl);
ctl.ui.setStartEnabled(false);
ctl.guide = new Guide(stage);

// ---------- ぜんしん版：カメラ ----------
// 入口（body.js）。カメラで あそぶ → 体のペン。カメラなし → 元のとおり マウス・タッチ
function zenOn() {
  Zen.on = true;
  document.body.classList.add('zen');
  placeMirror();
  ctl.ui.refreshTitle();
}
if (Body) {
  Body.gate({
    title: 'ノートの怪獣 ぜんしん版',
    corner: 'tr',
    lines: [
      '✍️ <b>右手の 手首</b> … ペン。画面の 点が 右手に ついてくる',
      '✋ <b>左手を あげている あいだ</b> … ペンが 紙について 線が かける',
      '👇 <b>左手を おろす</b> … ペンが はなれて、線が きまる（線・丸・三角や四角や星）',
      '👏 <b>はくしゅ</b> … はじめる・できた（怪獣を描く）・つづける',
      '🙌 <b>両手を 高く 1びょう</b> … ポーズ',
      '👥 <b>2人</b> うつると ふたりで 点数きそう（左の人が 1P）',
    ],
    onStart: (m) => { if (m === 'cam') zenOn(); },
  });
  Body.on('pose', (B) => { if (Body.mode === 'cam' && !Zen.fake && B.lm) Zen.feed(B.lm, B.asp); });
  Body.on('clap', () => { if (Body.mode === 'cam') ctl.ui.onClap(); });
  Body.players.forEach((P, i) => {
    P.on('pose', (B) => { if (Body.mode === 'cam' && !Zens[i].fake && B.lm) Zens[i].feed(B.lm, Body.asp || B.asp); });
    P.on('clap', () => { if (Body.mode === 'cam' && ctl.scene && ctl.scene.two) ctl.ui.onClap(); });   // ひとりの ときは 主役の 手たたきだけ
  });
  let two0 = false;
  Body.on('poses', () => {
    if (Body.count >= 2) seen2At = performance.now() / 1000;
    const two = ctl.people() >= 2;
    if (two !== two0) { two0 = two; if (ctl.ui.titleOpen()) ctl.ui.refreshTitle(); }   // タイトルの「ふたりで 👏」を 変える
  });
}

// カメラの小さな映像は 画面の右上（ポーズボタンの下）に、ゲームの大きさに合わせて置く
function placeMirror() {
  const m = document.getElementById('bodyMirror');
  if (!m) return;
  const u = stage.offsetWidth / GAME.VW, w = Math.max(96, 150 * u);
  Object.assign(m.style, {
    left: Math.round(stage.offsetLeft + (GAME.VW - 8) * u - w) + 'px', top: Math.round(stage.offsetTop + 52 * u) + 'px',
    right: 'auto', bottom: 'auto', width: Math.round(w) + 'px',
  });
}

// ---------- 画面サイズ（16:9 で等比） ----------
let lastSize = '';
function layout(force) {
  const vw = window.innerWidth, vh = window.innerHeight;
  let w = vw, h = vw * 9 / 16;
  if (h > vh) { h = vh; w = vh * 16 / 9; }
  w = Math.floor(w); h = Math.floor(h);
  const key = `${w}x${h}`;
  if (!force && key === lastSize) return false;
  lastSize = key;
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  stage.style.left = Math.floor((vw - w) / 2) + 'px';
  stage.style.top = Math.floor((vh - h) / 2) + 'px';
  stage.style.setProperty('--u', (w / GAME.VW) + 'px');
  if (ctl.view && ctl.view.ok) ctl.view.resize(w, h);
  if (ctl.game) {
    const pr = Math.min(window.devicePixelRatio || 1, QUALITY[ctl.view.quality].pr);
    const gw = Math.round(w * pr), gh = Math.round(h * pr);
    ctl.game.scale.resize(gw, gh);
    ctl.game.scale.setZoom(1 / pr);
    const cv = ctl.game.canvas;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctl.game.scale.updateBounds();
    if (ctl.scene) ctl.scene.applyCamera();
  }
  placeMirror();
  return true;
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const changed = layout(false);
    if (changed && ctl.scene) {
      ctl.scene.cancelStroke();
      if (['BATTLE', 'TUTORIAL', 'INTRO'].includes(ctl.scene.state)) ctl.scene.pause('resize');
    }
    checkRotate();
  }, 120);
});

function checkRotate() {
  const s = ctl.scene;
  if (!s) return;
  const portrait = ctl.isPortrait();
  if (portrait && ['BATTLE', 'TUTORIAL', 'INTRO', 'RESUMING'].includes(s.state)) { s.pause('rotate'); ctl.ui.showRotate(true); }
  else if (!portrait) ctl.ui.showRotate(false);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && ctl.scene) {
    ctl.scene.cancelStroke();
    ctl.scene.pause('hidden');
  }
});

// キーボード
window.addEventListener('keydown', (e) => {
  const s = ctl.scene;
  if (!s) return;
  if (s.state === 'TITLE' && ctl.ui.titleOpen() && (e.key === '1' || e.key === '2')) { ctl.audio.unlock(); ctl.ui.startGame(e.key === '2'); return; }
  if (e.key === 'Escape' && s.state === 'RESULT' && s.two) { s.toTitle(); e.preventDefault(); return; }
  if (e.key === 'Escape') { s.togglePause(); e.preventDefault(); }
  else if (e.key === 'm' || e.key === 'M') {
    Save.data.muted = !Save.data.muted; Save.write();
    ctl.audio.setMuted(Save.data.muted);
    ctl.ui.toast(Save.data.muted ? '音を消しました（M）' : '音を出します（M）');
  } else if ((e.key === 'r' || e.key === 'R') && s.state === 'RESULT') { ctl.audio.unlock(); s.retry(); }
});
// 初回のユーザー操作で音声開始
const unlock = () => ctl.audio.unlock();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

// ピンチ・ダブルタップ拡大の抑制（ゲーム領域内）
stage.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---------- 起動 ----------
async function boot() {
  ctl.ui.setLoading(0.1, 'ノートをひらいています…');
  if (typeof Phaser === 'undefined') {
    ctl.ui.showError('読み込みに失敗しました', 'ゲームの部品（Phaser）を読み込めませんでした。通信状態を確かめて、再読み込みしてください。');
    return;
  }
  // フォント（失敗しても続行）
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 20px "Zen Maru Gothic"'),
        document.fonts.load('400 20px "Yomogi"'),
      ]),
      new Promise(r => setTimeout(r, 3500)),
    ]);
  } catch (e) {}
  ctl.ui.setLoading(0.4, '怪獣を描いています…');
  await new Promise(r => setTimeout(r, 30));

  const view = new ThreeView(stage);
  ctl.view = view;
  if (!view.init()) {
    ctl.ui.showError('3D表示を始められませんでした', 'このブラウザまたは端末では WebGL が使えないようです。Chrome・Edge・Safari の最新版でお試しください。');
    return;
  }
  view.quality = Save.data.quality || ctl.autoQuality;
  view.setQuality(view.quality);
  view.reduceFx = Save.data.reduceFx;
  view.onContextLost = () => { if (ctl.scene) ctl.scene.pause('context'); };
  view.onContextRestored = () => { ctl.ui.toast('描画を復旧しました'); };
  ctl.applyMonster();
  view.setMode('title');
  ctl.ui.setLoading(0.75, 'ペンを用意しています…');
  layout(true);

  const pr = Math.min(window.devicePixelRatio || 1, QUALITY[view.quality].pr);
  const w = parseInt(stage.style.width, 10), h = parseInt(stage.style.height, 10);
  ctl.game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: stage,
    width: Math.round(w * pr), height: Math.round(h * pr),
    transparent: true,
    banner: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / pr },
    input: { activePointers: 2, mouse: { preventDefaultWheel: false } },   // ふたりで：指2本で 1P・2P
    render: { antialias: true, roundPixels: false },
    callbacks: { preBoot: (game) => game.registry.set('ctl', ctl) },
    scene: [MainScene],
  });
  ctl.game.canvas.classList.add('phaser-canvas');
}

let perfDone = false;
function finishBoot() {
  ctl.ui.setLoading(1, 'じゅんびOK');
  setTimeout(() => {
    ctl.ui.hideLoading();
    ctl.ui.setStartEnabled(true);
    ctl.scene.toTitle();
    // 開始時の短い性能確認（自動画質のときだけ）
    if (!Save.data.quality && !perfDone) {
      perfDone = true;
      let frames = 0; const t0 = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
        else {
          const fps = frames / ((performance.now() - t0) / 1000);
          const cur = ctl.view.quality;
          if (fps < 40 && cur !== 'low') {
            ctl.autoQuality = cur === 'high' ? 'mid' : 'low';
            ctl.applyQuality();
          }
        }
      };
      requestAnimationFrame(tick);
    }
    checkRotate();
  }, 250);
}

// ---------- 確認用 ?dbg → window.nkz（window.dbg は MediaPipe が使うので使わない） ----------
if (new URLSearchParams(location.search).has('dbg')) {
  import('../tools/recog-bench.js').then(m => { window.recogBench = m.recogBench; }).catch(() => {});
  const { AREA } = GAME;
  const S = () => ctl.scene;
  // manual(true) のときは Phaser の時計を止め、1コマずつ（描画もふくめて）進める。確かめの結果が 速さに左右されない
  let manual = false, mt = 0;
  // 早送りの間は 3D を描かない（最後の1コマだけ 描く）
  const one = (ms, last = true) => {
    if (!manual) { S().update(0, ms); return; }
    if (last) { ctl.noRender = false; ctl.game.step(mt += ms, ms); }
    else { ctl.noRender = true; mt += ms; S().update(mt, ms); ctl.noRender = false; }
  };
  const frame = (n = 1) => { for (let i = 0; i < n; i++) one(1000 / 60, i === n - 1); };
  // ゲームの座標 → 描くところの 0〜1
  const toN = (x, y) => [(x - AREA.x0) / (AREA.x1 - AREA.x0), (y - AREA.y0) / (AREA.y1 - AREA.y0)];
  // 形の点列（ゲームの座標）。step ピクセルごと
  const path = (kind, cx, cy, s, step = 7) => {
    const out = [];
    const seg = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
    if (kind === 'line') { seg([cx - s, cy], [cx + s, cy]); out.push([cx + s, cy]); }
    else if (kind === 'circle') { const n = Math.round(2 * Math.PI * s / step); for (let i = 0; i <= n + 2; i++) { const a = -Math.PI / 2 + i / n * Math.PI * 2; out.push([cx + Math.cos(a) * s, cy + Math.sin(a) * s]); } }
    else if (kind === 'tri') { const A = [cx, cy - s], B = [cx - s * 1.07, cy + s * 0.8], C = [cx + s * 1.07, cy + s * 0.8]; seg(A, B); seg(B, C); seg(C, A); out.push(A); }
    return out;
  };
  window.nkz = {
    ctl, Save, recognize, Battle, DIFF, Zen, ZEN, STROKE, TUNE,
    get scene() { return ctl.scene; },
    get battle() { return ctl.scene && ctl.scene.battle; },
    anchors: () => ctl.view.anchors(),
    seed(n) { ctl.fixedSeed = n; },
    step(sec, fps = 60) { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) one(1000 / fps, i === n - 1); return ctl.scene.state; },
    manual(on = true) { manual = on; if (on) { mt = performance.now(); ctl.game.loop.sleep(); } else ctl.game.loop.wake(); },
    setBossHp(n) { const b = ctl.scene.battle; b.boss.hp = n; b.damageBoss(0); },
    win() { const b = ctl.scene.battle; b.boss.hp = 1; b.damageBoss(1); },
    lose() { const b = ctl.scene.battle; b.player.hp = 0; },
    spawn(type, o) { return ctl.scene.battle.spawnAttack(type, o); },
    focus(n = 3) { ctl.scene.battle.player.focus = n; },
    // 点列を直接投入（認識とゲーム処理の確認）
    draw(points, dur = 0.4) {
      const t0 = performance.now() / 1000;
      const pts = points.map((p, i) => ({ x: p[0], y: p[1], t: t0 + dur * i / Math.max(1, points.length - 1) }));
      return ctl.scene.battle.submitStroke({ points: pts });
    },
    // ---- 体のペンを 合成する（カメラなしで） ----
    // zen()：合成入力を始める。hand(x, y)：右手の位置（描くところの 0〜1）。left(true/false)：左手を挙げる・下ろす
    // see(左, 右)：手が うつっているか。both(true)：両手を高く（ポーズ）。clap()：拍手。swipe()：右手を左へ払う（怪獣を描く画面）
    zen(on = true) {
      if (on) { Zen.fake = { x: 0.5, y: 0.6, left: false, lv: true, rv: true, both: false }; if (!Zen.on) zenOn(); }
      else { Zen.fake = null; Zen.on = false; document.body.classList.remove('zen'); }
      return Zen.on;
    },
    hand(x, y) { Zen.fake.x = x; Zen.fake.y = y; },
    left(on = true) { Zen.fake.left = on; },
    see(l = true, r = true) { Zen.fake.lv = l; Zen.fake.rv = r; },
    both(on = true) { Zen.fake.both = on; },
    clap() { ctl.ui.onClap(); },
    swipe() { if (Zen.onUndo) return ctl.ui.zenUndo(); },
    // body.js へ 関節を入れて 写し方まで確かめる（右手首・左手首は 映像の 0〜1、鏡うつし後の x）
    feed({ rw = [0.6, 0.5], lw = [0.35, 0.75], sh = 0.3, cy = 0.45, lvis = 1, rvis = 1 } = {}) {
      const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      const m = (i, x, y, v = 0.95) => { lm[i] = { x: 1 - x, y, visibility: v }; };   // x は 鏡うつし後
      m(11, 0.5 - sh / 2, cy); m(12, 0.5 + sh / 2, cy); m(0, 0.5, cy - sh * 0.8);
      m(15, lw[0], lw[1], lvis); m(16, rw[0], rw[1], rvis);
      Zen.feed(lm, 1); return { pen: { ...Zen.tgt }, leftRaw: Zen.leftRaw };
    },
    // 状態：案内の文字、ペン、左手
    state() {
      return { scene: S().state, tutStep: S().tut ? S().tut.step : null, guide: ctl.guide.text, guideMode: ctl.guide.mode, icon: ctl.guide.iconKey,
        status: S().zenStatus(), leftUp: Zen.leftUp, writing: Zen.writing, pen: { x: +Zen.pen.x.toFixed(3), y: +Zen.pen.y.toFixed(3) }, stroke: !!S().stroke,
        pad: document.getElementById('padStatus').textContent, padStrokes: ctl.ui.drawStrokes.length };
    },
    // 体のペンで 形をかく（早送りで）：左手を挙げる → 右手でなぞる → 左手を下ろす。結果を返す
    trace(kind, cx = 480, cy = 340, s = 70) {
      const pts = Array.isArray(kind) ? kind : path(kind, cx, cy, s);
      const F = Zen.fake;
      [F.x, F.y] = toN(pts[0][0], pts[0][1]); F.left = false; frame(2);
      F.left = true; frame(1);
      for (const p of pts) { [F.x, F.y] = toN(p[0], p[1]); frame(1); }
      S().lastResult = null;
      F.left = false; frame(2);
      const r = S().lastResult;
      return r ? { ok: r.ok, type: r.rec && r.rec.type, lenient: !!(r.rec && r.rec.lenient), lack: r.lack, invalid: r.invalid, reason: r.reason } : null;
    },
    // 怪獣を描く画面で なぞる（点は drawPad の 0〜1）
    padTrace(pts) {
      const F = Zen.fake;
      [F.x, F.y] = pts[0]; F.left = false; frame(2);
      F.left = true; frame(1);
      for (const p of pts) { [F.x, F.y] = p; frame(1); }
      F.left = false; frame(2);
      return ctl.ui.drawStrokes.length;
    },
    frame,
    // ---- ふたりで ----
    // two()：ふたりで はじめる（タイトルから）。zen2()：1P・2P の 体のペンを 合成する
    // hand2(i, x, y)・left2(i, on)：i 番の人の 右手・左手。trace2(i, 'line'|'circle'|'tri', cx, cy, s)
    two() { ctl.scene.startFromTitle(true); return ctl.scene.state; },
    zen2(on = true) { Zens.forEach(Z => { Z.fake = on ? { x: 0.5, y: 0.6, left: false, lv: true, rv: true, both: false } : null; }); if (on && !Zen.on) zenOn(); return Zen.on; },
    hand2(i, x, y) { Zens[i].fake.x = x; Zens[i].fake.y = y; },
    left2(i, on = true) { Zens[i].fake.left = on; },
    trace2(i, kind, cx = 480, cy = 340, s = 70) {
      const pts = Array.isArray(kind) ? kind : path(kind, cx, cy, s);
      const F = Zens[i].fake;
      [F.x, F.y] = toN(pts[0][0], pts[0][1]); F.left = false; frame(2);
      F.left = true; frame(1);
      for (const p of pts) { [F.x, F.y] = toN(p[0], p[1]); frame(1); }
      S().lastResult = null;
      F.left = false; frame(2);
      const r = S().lastResult;
      return r ? { ok: r.ok, type: r.rec && r.rec.type, who: r.shape ? r.shape.who : null } : null;
    },
    // 2人ぶんの 関節を body.js へ 入れる（a・b：{ rw:[x,y], lw:[x,y] }、x は 画面の 0〜1。a は 画面の 左の人）
    feed2(a, b) {
      const mk = ({ rw, lw, cx }) => {
        const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
        const m = (k, x, y, v = 0.95) => { lm[k] = { x: 1 - x, y, visibility: v }; };
        m(11, cx - 0.08, 0.45); m(12, cx + 0.08, 0.45); m(0, cx, 0.32); m(23, cx - 0.06, 0.75); m(24, cx + 0.06, 0.75);
        m(15, lw[0], lw[1]); m(16, rw[0], rw[1]); return lm;
      };
      const A = mk({ cx: 0.27, ...a }), B = mk({ cx: 0.73, ...b });
      Body.feedPlayers([A, B], 0.033); Body.emit('poses', { all: [A, B], dt: 0.033, asp: 4 / 3 });
      return Zens.map(Z => ({ pen: { ...Z.tgt }, leftRaw: Z.leftRaw }));
    },
    // 自動で戦う（体のペンの合成入力で）。予告線の通り道に 線か丸、集中3つで三角
    bot(on = true) {
      const sc = S();
      if (!on) { sc.zenBot = null; return; }
      let job = null;
      const covered = (B, x, y) => B.shapes.some(s => s.type === 'line' ? pointSegDist({ x, y }, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }) < 24 : Math.hypot(s.cx - x, s.cy - y) < s.r);
      sc.zenBot = () => {
        const F = Zen.fake, B = sc.battle;
        if (!F) return;
        if (job) {
          if (job.i < 0) { F.left = false; [F.x, F.y] = toN(job.pts[0][0], job.pts[0][1]); job.i++; return; }
          if (job.i < job.pts.length) { const p = job.pts[job.i++]; [F.x, F.y] = toN(p[0], p[1]); F.left = true; return; }
          F.left = false; if (++job.i > job.pts.length + 3) job = null; return;
        }
        if (!B || !sc.canDraw()) return;
        if (sc.tut && sc.tut.step === 0) { job = { pts: path('line', 480, 330, 150), i: -2 }; return; }
        let best = null;
        for (const a of B.attacks) {
          if (a.type === 'scratch') {
            const g = a.gate;
            if (g.done || a.t < a.windup) continue;
            const tl = g.judgeT - a.t;
            if (!B.shapes.some(s => s.type === 'line' && pointSegDist({ x: g.gx, y: g.gy }, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }) < 30)) if (!best || tl < best.tl) best = { tl, gate: g };
            continue;
          }
          if (!a.pathsFixed) continue;
          const gy = a.type === 'rain' ? a.def.defY : GAME.DEF_Y;
          const live = a.items.filter(p => p.kind === 'proj' && p.st !== 'done');
          for (const p of live) {
            const q = Battle.pathAtY(p, gy);
            const uDef = Math.max(0, Math.min(1, (gy - p.y0) / ((p.ty - p.y0) || 1)));
            const tl = p.start + p.dur * uDef - a.t;
            if (covered(B, q.x, q.y)) continue;
            let x = q.x;
            const circle = a.rec === 'circle' && a.type === 'twin';
            if (circle) x = live.reduce((s2, r) => s2 + Battle.pathAtY(r, gy).x, 0) / live.length;
            if (!best || tl < best.tl) best = { tl, x, y: gy, circle };
          }
        }
        const P = B.player;
        if (best && best.tl < SHAPES.line.life - 0.7 && best.tl > 0.25) {
          if (best.gate) { const g = best.gate, dx = Math.cos(g.ang) * 65, dy = Math.sin(g.ang) * 65; job = { pts: [], i: -2 }; for (let k = 0; k <= 18; k++) job.pts.push([g.gx - dx + 2 * dx * k / 18, g.gy - dy + 2 * dy * k / 18]); }
          else job = { pts: best.circle ? path('circle', best.x, best.y, 50) : path('line', best.x, best.y, 70), i: -2 };
          return;
        }
        if (P.focus >= 3 && P.ink >= SHAPES.tri.ink && (!best || best.tl > 1.6)) job = { pts: path('tri', 480, 320, 62), i: -2 };
      };
    },
  };
}

boot();
