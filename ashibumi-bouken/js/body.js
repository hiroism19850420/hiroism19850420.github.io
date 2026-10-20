// あしぶみ ぼうけん：自動で歩く 横スクロールを、カメラの前で からだを動かして遊ぶ
// ジャンプ → ジャンプ／右手を上げる → ワイヤー／両手を くっつける → 剣／うでを すばやく 出す → パンチ／しゃがむ → 止まる
// 両手を上げて キープ → 画面のボタンを押す
'use strict';

const MP_VER = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// ---------- 調整用の数値（長さの単位は「どうの長さ（肩〜腰）」） ----------
const JUMP_H = 0.18;      // からだが ふだんより これだけ 上がったら「ジャンプ」
const JUMP_HOLD = 0.35;   // ジャンプボタンを おしている ことにする 長さ（高く とぶ）
const SQUAT_H = 0.25;     // からだが ふだんより これだけ 下がったら「しゃがむ」→ 止まる
const SWORD_GAP = 0.7;    // 両手首が 肩はば × これ より 近いと「くっつけた」→ 剣
const PUNCH_SPEED = 3.5;  // 手首が 1びょうに 肩はば × これ より 速く 動いたら「パンチ」
const PUNCH_CD = 0.35;    // パンチの あと これだけ（秒）は 次の パンチを 出さない
const HANDS_HOLD = 1.5;   // 両手を上げて これだけ キープで ボタンを押す
const LOST_PAUSE = 0.6;   // 全身が これだけ 見えないと 一時停止

const Body = {
  cam: false, pose: null, lastVT: -1,
  full: false, seen: false, lm: null,
  baseY: null, lift: 0, T: 1,
  handsUp: false, squat: false, wire: false, sword: false,
  prevW: null, prevT: 0, punchCD: 0, punchFx: 0,
  air: false, jumpT: 0, held: new Set(),
  lostT: 0, okT: 0, autoPaused: false,
  handsT: 0, handsCD: 0, now: 0
};
const video = document.getElementById('camVideo');
const camBox = document.getElementById('camBox');
const camView = document.getElementById('camView');
const camCtx = camView.getContext('2d');
const camState = document.getElementById('camState');
const handsBar = document.getElementById('handsBar');

/* ---------- からだの読みとり ---------- */
function readPose(lm, dt) {
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
  const pt = i => ({ x: lm[i].x * vw, y: lm[i].y * vh, v: lm[i].visibility ?? 1 });
  const ls = pt(11), rs = pt(12), lh = pt(23), rh = pt(24), lk = pt(25), rk = pt(26);
  const lw = pt(15), rw = pt(16), nose = pt(0);
  Body.lm = lm;
  Body.seen = ls.v > 0.5 && rs.v > 0.5;
  Body.full = Body.seen && lh.v > 0.5 && rh.v > 0.5 && lk.v > 0.5 && rk.v > 0.5;
  if (!Body.seen) { Body.handsUp = false; Body.wire = false; Body.sword = false; return; }
  const unit = Math.max(20, Math.hypot(ls.x - rs.x, ls.y - rs.y));
  // 両手を 頭より上
  Body.handsUp = lw.v > 0.4 && rw.v > 0.4 && lw.y < nose.y && rw.y < nose.y;
  if (!Body.full) return;
  const sx = (ls.x + rs.x) / 2, sy = (ls.y + rs.y) / 2, hx = (lh.x + rh.x) / 2, hy = (lh.y + rh.y) / 2;
  const T = Math.max(20, Math.hypot(sx - hx, sy - hy));
  Body.T += (T - Body.T) * 0.3;
  // からだの 上がり下がり（ふだんの高さは、じっとしている間は 早く、とんでいる間は ゆっくり 合わせなおす）
  const y = (sy + hy) / 2;
  if (Body.baseY == null) Body.baseY = y;
  Body.lift = (Body.baseY - y) / Body.T;
  Body.baseY += (y - Body.baseY) * Math.min(1, dt / (Math.abs(Body.lift) < 0.1 ? 0.8 : 8));
  // 右手だけ 頭より上 → ワイヤー
  Body.wire = rw.v > 0.4 && rw.y < nose.y && !(lw.v > 0.4 && lw.y < ls.y);
  // 両手を くっつける → 剣
  const both = lw.v > 0.4 && rw.v > 0.4;
  Body.sword = both && Math.hypot(lw.x - rw.x, lw.y - rw.y) < unit * SWORD_GAP;
  // しゃがむ → 止まる
  Body.squat = Body.lift < -SQUAT_H;
  // パンチ：手首が すばやく 動いた（剣を もっている時と、両手を 上げている時は 出さない）
  const pdt = Body.now - Body.prevT;
  if (Body.prevW && pdt > 0 && pdt < 0.2) {
    const sp = Math.max(Math.hypot(lw.x - Body.prevW[0].x, lw.y - Body.prevW[0].y), Math.hypot(rw.x - Body.prevW[1].x, rw.y - Body.prevW[1].y)) / pdt / unit;
    if (sp > PUNCH_SPEED && both && !Body.sword && !Body.handsUp && Body.now > Body.punchCD) {
      Body.punchCD = Body.now + PUNCH_CD; Body.punchFx = Body.now;
      if (currentStageApi && Input.capture) Input.hit.add('KeyC');
    }
  }
  Body.prevW = [lw, rw]; Body.prevT = Body.now;
  // ジャンプ
  if (!Body.air && Body.lift > JUMP_H) {
    Body.air = true; Body.jumpT = JUMP_HOLD;
    if (currentStageApi && Input.capture) { setKey('Space', true); Input.hit.add('Space'); }   // 押しっぱなしも 同時に（低い ジャンプに ならないように）
  }
  else if (Body.air && Body.lift < JUMP_H / 2) Body.air = false;
}

function setKey(code, on) {
  if (on && !Body.held.has(code)) { Body.held.add(code); Input.down.add(code); }
  else if (!on && Body.held.has(code)) { Body.held.delete(code); Input.down.delete(code); }
}

// ステージ中：からだの動きを キー入力に かえる
function applyInput(dt) {
  const api = currentStageApi;
  const playing = api && Input.capture && !Loop.paused;
  const keys = { ArrowDown: Body.squat, KeyX: Body.wire, KeyV: Body.sword };
  for (const k in keys) setKey(k, playing && Body.full && keys[k]);
  if (!playing) { setKey('Space', false); return; }
  Body.jumpT -= dt;
  setKey('Space', Body.jumpT > 0);
}

/* ---------- 全身が 見えないときは 一時停止 ---------- */
drawPause = function (c) {
  c.fillStyle = 'rgba(255,255,255,0.86)';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#111';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `bold 34px ${FONT}`;
  c.fillText(Body.cam ? '全身が うつっていません' : '一時停止中', W / 2, H / 2 - 18);
  c.font = `18px ${FONT}`;
  c.fillStyle = '#555';
  c.fillText(Body.cam ? 'ひざまで うつるように カメラから 下がってください。うつったら 自動で つづきます' : '何かキーを押すか、画面をクリックすると再開します', W / 2, H / 2 + 26);
};
function watchLost(dt) {
  if (!Body.cam || !Loop.running()) { Body.lostT = 0; Body.autoPaused = false; return; }
  if (!Body.full) {
    Body.okT = 0;
    Body.lostT += dt;
    if (Body.lostT > LOST_PAUSE && !Loop.paused) { Loop.paused = true; Body.autoPaused = true; Input.clear(); Body.held.clear(); }
  } else {
    Body.lostT = 0;
    if (Body.autoPaused && Loop.paused) {
      Body.okT += dt;
      if (Body.okT > 0.5) { Body.autoPaused = false; Body.baseY = null; Loop.resume(); }
    }
  }
}

/* ---------- 両手を上げて キープ → ボタン ---------- */
function watchHands(dt) {
  Body.handsCD -= dt;
  const btn = Screens.primary;
  const can = Body.cam && ui.classList.contains('on') && btn && !btn.disabled && document.body.contains(btn) && Body.handsCD <= 0;
  if (!can) { Body.handsT = 0; handsBar.classList.toggle('on', Body.cam && ui.classList.contains('on') && !!btn); handsBar.style.setProperty('--p', '0%'); return; }
  handsBar.classList.add('on');
  Body.handsT = Body.handsUp ? Body.handsT + dt : Math.max(0, Body.handsT - dt * 2);
  handsBar.style.setProperty('--p', Math.min(100, Body.handsT / HANDS_HOLD * 100) + '%');
  if (Body.handsT >= HANDS_HOLD) { Body.handsT = 0; Body.handsCD = 2; btn.click(); }
}

/* ---------- カメラの小窓（鏡のように 左右反転） ---------- */
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
function drawCam() {
  const w = camView.width, h = camView.height;
  camCtx.save();
  camCtx.translate(w, 0); camCtx.scale(-1, 1);
  if (video.readyState >= 2) camCtx.drawImage(video, 0, 0, w, h);
  else { camCtx.fillStyle = '#222'; camCtx.fillRect(0, 0, w, h); }
  const lm = Body.lm;
  if (lm && Body.seen) {
    camCtx.strokeStyle = Body.full ? '#7dff8a' : '#ffb04a';
    camCtx.lineWidth = 3;
    camCtx.lineCap = 'round';
    camCtx.beginPath();
    for (const [a, b] of BONES) {
      if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) continue;
      camCtx.moveTo(lm[a].x * w, lm[a].y * h); camCtx.lineTo(lm[b].x * w, lm[b].y * h);
    }
    camCtx.stroke();
  }
  camCtx.restore();
  let s;
  if (!Body.seen) s = 'からだが 見えません';
  else if (!Body.full) s = 'ひざまで うつして';
  else if (Body.air) s = '⤴ ジャンプ！';
  else if (Body.wire) s = '🪝 ワイヤー';
  else if (Body.sword) s = '⚔️ 剣';
  else if (Body.now - Body.punchFx < 0.4) s = '👊 パンチ！';
  else if (Body.squat) s = '■ とまる';
  else s = 'じどうで あるく ▶';
  if (camState.textContent !== s) camState.textContent = s;
}

/* ---------- まいフレーム ---------- */
let lastT = performance.now();
function bodyLoop(t) {
  const dt = Math.min(0.1, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  Body.now = t / 1000;
  if (Body.cam && Body.pose && video.readyState >= 2 && video.currentTime !== Body.lastVT) {
    Body.lastVT = video.currentTime;
    try {
      const res = Body.pose.detectForVideo(video, t);
      if (res.landmarks && res.landmarks[0]) readPose(res.landmarks[0], Math.max(dt, 0.016));
      else { Body.seen = false; Body.full = false; Body.lm = null; Body.handsUp = false; }
    } catch (e) { /* 1コマ とばす */ }
  }
  if (Body.cam) { applyInput(dt); watchLost(dt); drawCam(); }
  watchHands(dt);
  requestAnimationFrame(bodyLoop);
}
requestAnimationFrame(bodyLoop);

/* ---------- カメラの じゅんび ---------- */
async function startCamera(msg) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg('この ひらきかたでは カメラを つかえません。https か localhost で ひらいてください。'); return false; }
  msg('カメラを じゅんび中…');
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60 } } });
    video.srcObject = st;
    try { await Promise.race([video.play(), new Promise(r => setTimeout(r, 3000))]); } catch (e) { /* 再生は あとで はじまる */ }
  } catch (e) { msg('カメラを つかえませんでした。ブラウザで カメラを 許可してください。'); return false; }
  if (!Body.pose) {
    msg('からだの動きを 見る じゅんび中…（はじめは すこし かかります）');
    try {
      const { PoseLandmarker, FilesetResolver } = await import(`${MP_URL}/vision_bundle.mjs`);
      const files = await FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
      const make = delegate => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numPoses: 1 });
      try { Body.pose = await make('GPU'); } catch (e) { Body.pose = await make('CPU'); }
    } catch (e) { msg('からだの動きを 見る しくみを 読みこめませんでした。ネットに つながっているか 確認してください。'); return false; }
  }
  Body.cam = true;
  Pad.touch = true;   // キーボードの 説明を 出さない
  camBox.classList.add('on');
  return true;
}

/* ---------- 画面（タイトル → 説明 → あそぶ → けっか） ---------- */
const HOWTO = `
  <table class="body-howto">
    <tr><th>（なにもしない）</th><td>→ 自動で 右へ 歩く</td></tr>
    <tr><th>その場で ジャンプ</th><td>→ ジャンプ</td></tr>
    <tr><th>右手を 上げる</th><td>→ ワイヤー（下ろすと はなす）</td></tr>
    <tr><th>両手を くっつける</th><td>→ 剣</td></tr>
    <tr><th>うでを すばやく 出す</th><td>→ パンチ</td></tr>
    <tr><th>しゃがむ</th><td>→ 止まる</td></tr>
    <tr><th>両手を上げて キープ</th><td>→ ボタンを押す</td></tr>
  </table>`;
const KEYS_HELP = '自動で 歩きます　／　Space ジャンプ　／　X ワイヤー（おしている間）　／　V 剣（おしている間）　／　C パンチ　／　↓ 止まる';

showTitle = function () {
  stopStage();
  Music.play('title');
  let t = 0;
  Loop.run(dt => { t += dt; }, c => {
    clearCanvas(c);
    c.strokeStyle = '#d8d8d8';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(60, 500); c.lineTo(220, 500); c.stroke();
    // 足踏みする 棒人間
    drawStick(c, 140, 500, 120, { pose: 'walk', phase: t * 6 });
  });
  Screens.show(`
    <div class="title-wrap">
      <p class="title-kicker">全身で あそぶ よこスクロール</p>
      <h1 class="title">あしぶみ ぼうけん</h1>
    </div>
    ${HOWTO}
    <div class="body-buttons">
      <button id="bCam" class="btn primary">カメラで はじめる</button>
      <button id="bKey" class="btn">カメラなしで ためす</button>
    </div>
    <p id="bodyMsg" class="body-msg"></p>
    <p class="foot">※カメラの映像は この端末の中だけで使い、どこにも送信しません。</p>
  `, 'title-screen');
  const msg = s => { const el = document.getElementById('bodyMsg'); if (el) el.textContent = s; };
  let busy = false;
  Screens.bind('bCam', async () => {
    if (busy) return;
    busy = true;
    const ok = await startCamera(msg);
    busy = false;
    if (ok) bodyIntro();
  }, true);
  Screens.bind('bKey', () => { Body.cam = false; camBox.classList.remove('on'); bodyIntro(); });
};

function bodyIntro() {
  stopStage();
  State.resetProgress();
  gameState.currentStage = 1;
  Loop.run(() => {}, c => clearCanvas(c));
  Screens.show(`
    <p class="stage-no">ワールド 1-1</p>
    <h2 class="stage-name">あしぶみ ぼうけん</h2>
    <div class="stage-help">
      ${Body.cam ? HOWTO : `<p class="keys">${KEYS_HELP}</p>`}
      <p class="note">${Body.cam ? 'ひざまで うつる ところに 立ってください。' : ''}ゴールの 旗を めざそう。ライフは 3つ。</p>
    </div>
    <button id="bGo" class="btn primary">はじめる</button>
  `, 'stage-intro');
  Screens.bind('bGo', () => {
    Body.baseY = null; Body.jumpT = 0;
    startStage(1);
    if (Body.cam) Pad.hide();
  }, true);
}

// おわった時：ゴール／ゲームオーバーと 数字だけ
showStageResult = function () {
  stopStage();
  Music.play('result');
  Sfx.play('tick');
  Loop.run(() => {}, c => clearCanvas(c));
  const r = window.lastRun || {};
  const row = (k, v) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`;
  Screens.show(`
    <h2 class="stage-name">${r.cleared ? 'ゴール！' : 'ゲームオーバー'}</h2>
    <table class="body-howto">
      ${row('タイム', `${r.time}びょう`)}
      ${row('たおした 敵', `${r.kills}ひき`)}
      ${row('コイン', `${r.coins}まい`)}
      ${row('ワイヤー', `${r.wires}かい`)}
      ${row('へった ライフ', `${r.misses}`)}
    </table>
    <div class="body-buttons">
      <button id="bAgain" class="btn primary">もういちど あそぶ</button>
      <button id="bTop" class="btn">タイトルへ</button>
    </div>
  `, 'result-screen');
  Screens.bind('bAgain', bodyIntro, true);
  Screens.bind('bTop', showTitle);
};

window.__body = { Body, readPose, bodyIntro };
showTitle();
