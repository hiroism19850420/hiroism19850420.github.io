// あしぶみ ぼうけん：横スクロールを カメラの前で からだを動かして遊ぶ（「私の人生、診断してください。」のステージ1から作った）
// その場で足踏み → 前へ歩く／左手を横に出して足踏み → 後ろへ歩く／その場でジャンプ → ジャンプ
// 両手を上げて キープ → 画面のボタンを押す
'use strict';

const MP_VER = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// ---------- 調整用の数値（長さの単位は「どうの長さ（肩〜腰）」） ----------
const STEP_TH = 0.12;     // ひざが じっと立っている時より これだけ 上がったら「1歩」（腰からの 高さで 見る）
const STEP_GAP = 1.0;     // 左右 交互の 2歩が この秒数の 間に 来たら 歩きはじめる
const WALK_KEEP = 0.75;   // 最後の1歩から これだけ（秒）は 歩きつづける
const AIR_KEEP = 1.2;     // ジャンプ中は 最後の1歩から これだけ 歩く向きを たもつ（穴を こえられるように）
const JUMP_H = 0.18;      // からだが ふだんより これだけ 上がったら「ジャンプ」
const JUMP_HOLD = 0.35;   // ジャンプボタンを おしている ことにする 長さ（高く とぶ）
const ARM_OUT = 0.9;      // 手首が 肩から 肩はば × これ だけ 外に 出たら「手を 横に 出した」
const HANDS_HOLD = 1.5;   // 両手を上げて これだけ キープで ボタンを押す
const LOST_PAUSE = 0.6;   // 全身が これだけ 見えないと 一時停止

const Body = {
  cam: false, pose: null, lastVT: -1,
  full: false, seen: false, lm: null,
  baseY: null, lift: 0, T: 1,
  knee: [null, null], kbase: [null, null], kup: [false, false], lastLeg: -1, streak: 0,
  lastStep: -9, steps: 0, back: false, handsUp: false,
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
  if (!Body.seen) { Body.handsUp = false; Body.back = false; return; }
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
  // 足踏み：ひざごとに「腰から どれだけ 上がったか」を、じっと立っている時の 高さと くらべる
  // （からだの かたむきや ゆれ、ジャンプでは ふえない。ぶれは なめらかに する）
  const lift = [];
  [lk, rk].forEach((k, i) => {
    const rel = (hy - k.y) / Body.T;
    Body.knee[i] = Body.knee[i] == null ? rel : Body.knee[i] + (rel - Body.knee[i]) * 0.5;
    if (Body.kbase[i] == null) Body.kbase[i] = Body.knee[i];
    lift[i] = Body.knee[i] - Body.kbase[i];
    // ふだんの 高さは、下がっている間は 早めに、上がっている間は ゆっくり 合わせなおす
    Body.kbase[i] += (Body.knee[i] - Body.kbase[i]) * Math.min(1, dt / (lift[i] < STEP_TH * 0.4 ? 1.0 : 8));
  });
  for (let i = 0; i < 2; i++) {
    const o = 1 - i;
    if (!Body.kup[i] && lift[i] > STEP_TH && lift[o] < STEP_TH * 0.5 && Body.lift < JUMP_H) {
      Body.kup[i] = true;
      // 左右 交互に 来た 歩だけ つなげる（同じ足ばかり・間が あきすぎは 1歩目から やりなおし）
      Body.streak = i !== Body.lastLeg && Body.now - Body.lastStep < STEP_GAP ? Body.streak + 1 : 1;
      Body.lastLeg = i; Body.lastStep = Body.now; Body.steps++;
    } else if (Body.kup[i] && lift[i] < STEP_TH * 0.4) Body.kup[i] = false;
  }
  // 左手を 横に 出している（肩より 外へ、高さは 頭の上〜腰のあいだ）
  const out = (lw.x - ls.x) * Math.sign(ls.x - rs.x);
  Body.back = lw.v > 0.4 && out > unit * ARM_OUT && lw.y < hy && lw.y > nose.y - Body.T * 0.8;
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
  if (!playing) { setKey('ArrowLeft', false); setKey('ArrowRight', false); setKey('Space', false); return; }
  const p = api.inst && api.inst._dbg && api.inst._dbg.p;
  const since = Body.now - Body.lastStep;
  const walking = Body.streak >= 2 && (since < WALK_KEEP || (p && !p.onGround && since < AIR_KEEP));
  const dir = walking ? (Body.back ? -1 : 1) : 0;
  setKey('ArrowRight', dir > 0);
  setKey('ArrowLeft', dir < 0);
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
      if (Body.okT > 0.5) { Body.autoPaused = false; Body.baseY = null; Body.kbase = [null, null]; Body.streak = 0; Loop.resume(); }
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
  else if (Body.streak >= 2 && Body.now - Body.lastStep < WALK_KEEP) s = Body.back ? '◀ うしろへ' : 'まえへ ▶';
  else s = Body.back ? '（左手 → うしろ）' : 'あしぶみで すすむ';
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

/* ---------- 画面（タイトル → 説明 → ステージ1 → 診断） ---------- */
const HOWTO = `
  <table class="body-howto">
    <tr><th>その場で 足踏み</th><td>→ まえへ 歩く</td></tr>
    <tr><th>左手を 横に出して 足踏み</th><td>→ うしろへ 歩く</td></tr>
    <tr><th>その場で ジャンプ</th><td>→ ジャンプ</td></tr>
    <tr><th>両手を上げて キープ</th><td>→ ボタンを押す</td></tr>
  </table>`;

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
      <p class="subtitle">ゴールに着いたら、あなたの人生を 診断します。</p>
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
  const info = STAGE_INFO[1];
  Screens.show(`
    <p class="stage-no">ワールド 1-1</p>
    <h2 class="stage-name">あしぶみ ぼうけん</h2>
    <p class="stage-theme">${info.theme}</p>
    <div class="stage-help">
      ${Body.cam ? HOWTO : '<p class="keys">← → 移動　／　Space ジャンプ</p>'}
      <p class="note">${Body.cam ? 'ひざまで うつる ところに 立ってください。' : ''}ゴールを目指して 右へ進んでください。</p>
    </div>
    <button id="bGo" class="btn primary">はじめる</button>
  `, 'stage-intro');
  Screens.bind('bGo', () => {
    Body.baseY = null; Body.lastStep = -9; Body.streak = 0; Body.kbase = [null, null]; Body.jumpT = 0;
    startStage(1);
    if (Body.cam) Pad.hide();
  }, true);
}

// ステージの診断（次は ステージ2 では なく、もういちど か タイトルへ）
showStageResult = function (r) {
  stopStage();
  Music.play('result');
  const info = STAGE_INFO[r.stageId];
  Sfx.play('tick');
  Loop.run(() => {}, c => clearCanvas(c));
  const lines = String(r.diagnosisText).split('\n').map(s => `<p>${esc(s)}</p>`).join('');
  Screens.show(`
    <div class="result-card">
      <div class="result-head">
        <span class="stage-no">あしぶみ ぼうけん　診断結果</span>
        <span class="badge ${r.cleared ? 'ok' : 'ng'}">${r.cleared ? 'クリア' : '失敗'}</span>
      </div>
      <p class="result-theme">${esc(info.theme)}</p>
      <dl class="result-play"><dt>プレイ結果</dt><dd>${esc(r.playResult)}</dd></dl>
      <div class="result-text${r.diagnosisText.length > 260 ? ' longest' : r.diagnosisText.length > 150 ? ' longer' : r.diagnosisText.length > 60 ? ' long' : ''}">${lines}</div>
      <p class="result-tag">診断タグ：<b>${esc(r.diagnosisTag)}</b></p>
    </div>
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
