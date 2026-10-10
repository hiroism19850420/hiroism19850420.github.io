// 全身版ゲーム共通：カメラで体の動きを読む。各ゲームのフォルダに同じものをコピーして使う。
// 使い方：Body.gate({ title, lines, onStart }) で入口を出し、Body.on('swing' など, fn) で動きを受けとる。
// 座標は「鏡うつし」。x は 0（画面左）〜1（画面右）、y は 0（上）〜1（下）。手 0 は画面の左がわの手。
(function(){
'use strict';
const MP_VER = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// ---- 調整する数値（長さは肩はば＝1、速さは肩はば／秒） ----
const CFG = {
  SW_SPEED: 3.0,    // 手が これより速く動いていて、
  SW_DIST: 0.35,    // 動きだした所から これだけ進んだら「ふり」1回
  SW_REARM: 1.5,    // これより おそくなったら 次の「ふり」を受けつける
  SW_GAP: 0.1,      // 同じ手の「ふり」の最短間隔（秒）
  JUMP_UP: 0.2,     // 肩が ふだんより これだけ上がったら ジャンプ
  SQUAT: 0.55,      // 肩が ふだんより これだけ下がったら しゃがみ
  STEP: 0.12,       // 左右のひざの高さの差が これをこえたら 足ぶみ1歩
  STEP_ARM: 0.3,    // ひざが見えないときは 手首の高さの差で 足ぶみを見る
  CLAP_IN: 0.45,    // 両手の間が これより近づいたら 手をたたいた
  CLAP_OUT: 0.9,    // これより はなれたら 次の手たたきを受けつける
  LAG: 0.1          // カメラが動きを読むまでの おくれ（秒）。リズムゲームの判定で引く
};

const hand = () => ({ x: 0, y: 0, px: 0, py: 0, vis: false, up: false, p: null, org: null, armed: false, at: -9 });
const B = {
  cfg: CFG, mode: 'off', ok: false, full: false, now: 0, asp: 4 / 3,   // asp：カメラ映像の横÷縦
  hands: [hand(), hand()],
  head: { x: 0.5, y: 0.3 }, cx: 0.5, cy: 0.5, unit: 0.2,
  pos: 0,        // 体の左右の位置（-1 左はし 〜 1 右はし）
  lean: 0,       // 体のかたむき（腰に対する肩のずれ。右が＋）
  roll: 0,       // 肩の線のかたむき（ラジアン。右肩が下がると＋）
  up: 0,         // 肩の高さ（ふだんより上が＋）
  air: false, crouch: false,
  pace: 0,       // 直前1秒の 足ぶみの歩数
  both: false, gap: 9, angle: 0,   // 両手：見えているか、間のきょり、結んだ線のかたむき（右手が下がると＋）
  gx: 0.5, gy: 0.5                 // 両手のまん中
};
const subs = {};
B.on = (name, fn) => { (subs[name] = subs[name] || []).push(fn); return B; };
B.emit = (name, data) => { (subs[name] || []).forEach(fn => { try { fn(data || {}); } catch (e) { console.error(e); } }); };

let baseY = null, lastStep = '', stepTimes = [], clapArmed = false, asp = 4 / 3;
function clear(){
  B.ok = false; B.full = false; B.both = false;
  B.hands.forEach(h => { h.vis = false; h.p = null; });
}
// lm：MediaPipe の関節 33 個。dt：前の読み取りからの秒数
B.feed = function(lm, dt, t){
  dt = Math.max(dt || 0.033, 0.001);
  const now = B.now = t != null ? t : performance.now() / 1000;   // t はテスト用
  const P = i => ({ x: (1 - lm[i].x) * asp, y: lm[i].y, v: lm[i].visibility == null ? 1 : lm[i].visibility });
  const ls = P(11), rs = P(12);
  if (ls.v < 0.5 || rs.v < 0.5){ clear(); return; }
  B.ok = true;
  const unit = Math.max(0.04, Math.hypot(ls.x - rs.x, ls.y - rs.y));
  B.unit += (unit - B.unit) * 0.3;
  const u = B.unit, cx = (ls.x + rs.x) / 2, cy = (ls.y + rs.y) / 2;
  B.cx = cx / asp; B.cy = cy; B.pos = Math.max(-1, Math.min(1, (B.cx - 0.5) * 2));
  B.roll = Math.atan2(rs.y - ls.y, Math.abs(rs.x - ls.x) || 0.001);
  const nose = P(0); if (nose.v > 0.5){ B.head.x = nose.x / asp; B.head.y = nose.y; } else { B.head.x = B.cx; B.head.y = cy - u * 0.9; }
  const lh = P(23), rh = P(24);
  B.full = lh.v > 0.5 && rh.v > 0.5;
  B.lean = B.full ? (cx - (lh.x + rh.x) / 2) / u : 0;

  // 手：同じがわの肩から見た位置で追う（体ごと ゆれても「ふり」にならない）
  [[P(15), ls], [P(16), rs]].forEach(([w, sh], i) => {
    const h = B.hands[i];
    if (w.v < 0.4){ h.vis = false; h.p = null; return; }
    const p = [(w.x - sh.x) / u, (w.y - sh.y) / u];
    h.x = w.x / asp; h.y = w.y; h.up = w.y < sh.y;
    if (!h.vis || !h.p){ h.vis = true; h.p = p; h.org = p; h.armed = true; h.px = p[0]; h.py = p[1]; return; }
    const np = [h.p[0] + (p[0] - h.p[0]) * 0.75, h.p[1] + (p[1] - h.p[1]) * 0.75];
    const vx = (np[0] - h.p[0]) / dt, vy = (np[1] - h.p[1]) / dt, sp = Math.hypot(vx, vy);
    h.p = np; h.px = np[0]; h.py = np[1];
    const ox = np[0] - h.org[0], oy = np[1] - h.org[1], od = Math.hypot(ox, oy);
    if (sp < CFG.SW_REARM || vx * ox + vy * oy < 0){ h.org = np; h.armed = true; return; }
    if (h.armed && sp > CFG.SW_SPEED && od > CFG.SW_DIST && now - h.at > CFG.SW_GAP){
      h.armed = false; h.at = now;
      const dx = ox / od, dy = oy / od;
      B.emit('swing', { side: i ? 'R' : 'L', i, dx, dy, dir: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'), px: np[0], py: np[1], x: h.x, y: h.y, speed: sp });
    }
  });

  // 両手
  const h0 = B.hands[0], h1 = B.hands[1];
  B.both = h0.vis && h1.vis;
  if (B.both){
    const dx = (h1.x - h0.x) * asp, dy = h1.y - h0.y;
    B.gap = Math.hypot(dx, dy) / u; B.angle = Math.atan2(dy, dx);
    B.gx = (h0.x + h1.x) / 2; B.gy = (h0.y + h1.y) / 2;
    if (B.gap > CFG.CLAP_OUT) clapArmed = true;
    else if (clapArmed && B.gap < CFG.CLAP_IN){ clapArmed = false; B.clapAt = now; B.emit('clap', { x: B.gx, y: B.gy }); }
  }

  // ジャンプ・しゃがみ：肩の高さを「ふだんの高さ」とくらべる
  if (baseY == null) baseY = cy;
  const off = (baseY - cy) / u;
  baseY += (cy - baseY) * Math.min(1, dt / (Math.abs(off) < 0.15 ? 0.8 : 6));
  B.up = off;
  if (!B.air && off > CFG.JUMP_UP){ B.air = true; B.emit('jump', {}); }
  else if (B.air && off < CFG.JUMP_UP * 0.4){ B.air = false; B.emit('land', {}); }
  if (!B.crouch && -off > CFG.SQUAT){ B.crouch = true; B.emit('squat', {}); }
  else if (B.crouch && -off < CFG.SQUAT * 0.5){ B.crouch = false; B.emit('stand', {}); }

  // 足ぶみ：左右のひざ（見えなければ手首）が 入れかわりで 上がるたびに 1歩
  const lk = P(25), rk = P(26);
  let d = 0, th = CFG.STEP;
  if (lk.v > 0.5 && rk.v > 0.5) d = (rk.y - lk.y) / u;
  else if (B.both){ d = (h1.y - h0.y) / u; th = CFG.STEP_ARM; }
  const side = d > th ? 'L' : d < -th ? 'R' : '';
  if (side && side !== lastStep){ lastStep = side; stepTimes.push(now); B.emit('step', { side }); }
  while (stepTimes.length && now - stepTimes[0] > 1) stepTimes.shift();
  B.pace = stepTimes.length;
  B.lm = lm;
  B.emit('pose', B);
};

// ---- カメラと小さい鏡 ----
let video, cv, cx2, tip, pose = null, lastVT = -1, lastT = 0;
function buildMirror(corner){
  const box = document.createElement('div');
  const c = corner || 'tr';
  box.id = 'bodyMirror';
  box.style.cssText = `position:fixed;${c[0] === 't' ? 'top:6px' : 'bottom:6px'};${c[1] === 'r' ? 'right:6px' : 'left:6px'};width:min(26vw,170px);z-index:9000;pointer-events:none;border-radius:10px;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 8px #0006;background:#000;opacity:.9`;
  video = document.createElement('video'); video.playsInline = true; video.muted = true;
  video.style.cssText = 'display:block;width:100%;transform:scaleX(-1)';
  cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
  tip = document.createElement('div');
  tip.style.cssText = 'position:absolute;left:0;right:0;bottom:0;font:bold 11px sans-serif;color:#fff;background:#d33c;text-align:center;padding:2px;display:none';
  box.append(video, cv, tip); document.body.appendChild(box);
  cx2 = cv.getContext('2d');
}
const LINES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
function drawMirror(lm){
  const w = cv.width = video.videoWidth || 640, h = cv.height = video.videoHeight || 480;
  cx2.clearRect(0, 0, w, h);
  if (lm){
    cx2.strokeStyle = '#fff'; cx2.lineWidth = 6; cx2.lineCap = 'round';
    LINES.forEach(([a, b]) => { if ((lm[a].visibility || 0) > 0.4 && (lm[b].visibility || 0) > 0.4){ cx2.beginPath(); cx2.moveTo((1 - lm[a].x) * w, lm[a].y * h); cx2.lineTo((1 - lm[b].x) * w, lm[b].y * h); cx2.stroke(); } });
    [[15, '#3bf'], [16, '#f55']].forEach(([i, col]) => { if ((lm[i].visibility || 0) > 0.4){ cx2.fillStyle = col; cx2.beginPath(); cx2.arc((1 - lm[i].x) * w, lm[i].y * h, 22, 0, 7); cx2.fill(); } });
  }
  const t = !B.ok ? 'カメラに うつってね' : (B.needFull && !B.full) ? 'もう少し はなれてね' : '';
  tip.textContent = t; tip.style.display = t ? 'block' : 'none';
}
function loop(ts){
  requestAnimationFrame(loop);
  if (!pose || video.readyState < 2 || video.currentTime === lastVT) return;
  const now = ts / 1000, dt = lastT ? Math.min(0.2, now - lastT) : 0.033;
  lastVT = video.currentTime; lastT = now;
  let res = null;
  try { res = pose.detectForVideo(video, ts); } catch (e) { return; }
  const lm = res && res.landmarks && res.landmarks[0];
  if (lm) B.feed(lm, dt); else clear();
  drawMirror(lm);
}
B.start = async function(say, corner){
  say = say || (() => {});
  if (pose){ B.mode = 'cam'; return true; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ say('この ひらきかたでは カメラを つかえません。https か localhost で ひらいてください。'); return false; }
  say('カメラを じゅんび中…');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60 } } }); }
  catch (e){ say('カメラを つかえませんでした。ブラウザで カメラを きょかしてください。'); return false; }
  buildMirror(corner);
  video.srcObject = stream;
  await video.play();
  asp = B.asp = (video.videoWidth || 640) / (video.videoHeight || 480);
  say('うごきを 見る じゅんび中…（はじめは すこし かかります）');
  try {
    const { PoseLandmarker, FilesetResolver } = await import(`${MP_URL}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
    const make = delegate => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numPoses: 1 });
    try { pose = await make('GPU'); } catch (e){ pose = await make('CPU'); }
  } catch (e){ say('うごきを 見る しくみを よみこめませんでした。ネットに つながっているか かくにんしてください。'); return false; }
  say('');
  B.mode = 'cam';
  requestAnimationFrame(loop);
  return true;
};

// ---- 入口の画面 ----
// opt: { title, lines: ['うごき … なにが おきるか', ...], onStart(mode), corner, needFull }
B.gate = function(opt){
  B.needFull = !!opt.needFull;
  const g = document.createElement('div');
  g.id = 'bodyGate';
  g.style.cssText = 'position:fixed;inset:0;z-index:9500;background:#102040f2;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;overflow:auto';
  const btn = 'display:block;width:100%;margin:10px 0 0;padding:14px;border:0;border-radius:14px;font:bold 20px inherit;cursor:pointer';
  g.innerHTML = `<div style="max-width:460px;width:88%;padding:16px 0;text-align:center">
    <div style="font-size:14px;color:#ffd54a;font-weight:bold">ぜんしんで あそぶ</div>
    <h1 style="font-size:26px;margin:6px 0 12px;line-height:1.3">${opt.title}</h1>
    <div style="text-align:left;background:#fff2;border-radius:12px;padding:10px 14px;font-size:17px;line-height:1.8">${opt.lines.map(l => `<div>${l}</div>`).join('')}</div>
    <div style="font-size:13px;margin-top:8px;color:#cde">スマホや パソコンを 立てかけて、${opt.needFull ? 'ぜんしん' : 'こしから上'}が うつる所まで はなれてね。まわりに ぶつかる物が ないか たしかめよう。</div>
    <button id="bodyCam" style="${btn};background:#ff7a2f;color:#fff">📷 カメラで あそぶ</button>
    <button id="bodyNoCam" style="${btn};background:#fff3;color:#fff;font-size:15px;padding:10px">カメラなしで ためす（ゆび・キーボード）</button>
    <div id="bodyMsg" style="min-height:1.5em;margin-top:8px;color:#ffd54a;font-size:14px"></div></div>`;
  document.body.appendChild(g);
  const msg = g.querySelector('#bodyMsg');
  const go = mode => { g.remove(); B.mode = mode; if (opt.onStart) opt.onStart(mode); };
  g.querySelector('#bodyCam').onclick = async () => { if (await B.start(t => { msg.textContent = t; }, opt.corner)) go('cam'); };
  g.querySelector('#bodyNoCam').onclick = () => go('nocam');
};
// 3ボタンのゲーム用：左手をふる＝0、手をたたく か ジャンプ＝1、右手をふる＝2
// 手をたたく時の「内がわへの動き」、手を上げる動き、たたいた後に手がもどる動きは 数えない
B.three = function(fn){
  B.on('swing', e => { if ((e.i ? -e.dx : e.dx) > 0.5 || e.dy < -0.5 || B.now - (B.clapAt || -9) < 0.45) return; fn(e.i ? 2 : 0); });
  B.on('clap', () => fn(1));
  B.on('jump', () => fn(1));
};
// はじめる前に カメラから はなれる時間をとる。カメラなしのときは すぐ進む
B.countdown = function(sec, text){
  if (B.mode !== 'cam') return Promise.resolve();
  return new Promise(res => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:9400;background:#0009;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;font-weight:bold;text-align:center;pointer-events:none';
    document.body.appendChild(d);
    let n = sec;
    const tick = () => {
      if (n <= 0){ d.remove(); res(); return; }
      d.innerHTML = `<div style="font-size:22px">${text || 'カメラから はなれて、かまえてね'}</div><div style="font-size:120px;line-height:1.1">${n}</div>`;
      n--; setTimeout(tick, 1000);
    };
    tick();
  });
};
window.Body = B;
})();
