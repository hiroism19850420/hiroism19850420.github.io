// 起動：素材の準備 → 3D と 2D の Canvas を重ねる → タイトル
import { GAME, QUALITY, DIFF } from './config.js';
import { Save } from './save.js';
import { AudioManager } from './audio.js';
import { ThreeView } from './three-view.js';
import { UI } from './ui.js';
import { MainScene } from './scene.js';
import { recognize } from './recognizer.js';
import { Battle } from './battle.js';
import { buildArt, isUsable, unpackStrokes, drawCustomDoodle, autoName } from './custom-monster.js';

const stage = document.getElementById('stage');
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const ctl = {
  view: null, audio: new AudioManager(), ui: null, scene: null, game: null,
  fixedSeed: null,
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
    input: { activePointers: 1, mouse: { preventDefaultWheel: false } },
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

// ---------- 確認用 ?dbg ----------
if (new URLSearchParams(location.search).has('dbg')) {
  import('../tools/recog-bench.js').then(m => { window.recogBench = m.recogBench; }).catch(() => {});
  window.dbg = {
    ctl, Save, recognize, Battle, DIFF,
    get scene() { return ctl.scene; },
    get battle() { return ctl.scene && ctl.scene.battle; },
    anchors: () => ctl.view.anchors(),
    seed(n) { ctl.fixedSeed = n; },
    // 早送り（タブが非表示でも進める）
    step(sec, fps = 60) { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) ctl.scene.update(0, 1000 / fps); return ctl.scene.state; },
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
  };
}

boot();
