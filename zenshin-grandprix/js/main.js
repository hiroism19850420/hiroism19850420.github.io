// こげ！まわせ！ぜんしんグランプリ！ のはじまり（第6部・付録P）
import * as THREE from 'three';
import { CFG } from './config.js';
import { $, wait, clamp, fmtTime, damp } from './util.js';
import { World } from './world.js';
import { Course3D } from './course3d.js';
import { COURSES } from './courses.js';
import { KartModel, CHARS, CHAR_IDS, renderPortraits } from './models.js';
import { Race } from './race.js';
import { Rival } from './ai.js';
import { Cam } from './camera.js';
import { Input } from './input.js';
import { Body, synthPose, drawMirror } from './body.js';
import { FX, FX_COLORS } from './fx.js';
import { HUD } from './hud.js';
import { Two } from './twop.js';
import { Audio, checkSongs } from './audio.js';
import { VOICE_PRIO } from './voicelines.js';
import { Save } from './save.js';
import { Screens } from './screens.js';
import { Stages } from './stages.js';
import { picSVG } from './pics.js';
import { ZONE } from './track.js';
import { PlusView, Ghost, ITEM_NAME } from './plus.js';

const Q = new URLSearchParams(location.search);
const DBG = Q.has('dbg');
const V3 = THREE.Vector3;

// ---------- アプリの 状態 ----------
const App = {
  state: 'boot', mode: null, char: 'mimi', diff: 'easy', course: 'c1', gp: null, race: null, models: [], portraits: {},
  camKind: null, two: false, char2: 'goro', hs: [{}, {}], busy: false, t: 0, paused: false, pauseKind: null, auto: null, frameMs: 16, qTimer: 0, qLow: 0, qHigh: 0,
  stats0: null, statsRace: null
};
window.__zgp = App;

// ---------- よみこみ ----------
const loadMsg = $('loadMsg'), loadBar = $('loadBar'), loadKart = $('loadKart');
const progress = p => { loadBar.style.width = (p * 100) + '%'; loadKart.style.left = (p * 100) + '%'; };
const slowT = setTimeout(() => { loadMsg.textContent = 'ネットが おそいかも。もう すこし まってね'; }, 15000);
Save.load();
if (Q.has('mute')) Audio.muted = true;
progress(0.3);
try { await document.fonts.load('800 40px "M PLUS Rounded 1c"'); } catch (e) {}
progress(0.4);
World.init($('gl'));
const S0 = Save.data.settings;
document.body.classList.toggle('easy', !!S0.easy);
// スマホ・タブレット（指で さわる 画面）。はじめは 軽い 画質から（はやければ 自動で 上がる）
const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches;
document.body.classList.toggle('touch', TOUCH);
if (TOUCH && !S0._touchQ) { S0._autoLevel = 'low'; S0._touchQ = true; Save.save(); }
const qPick = () => Q.get('q') || (S0.quality === 'auto' ? (S0._autoLevel || 'mid') : S0.quality);
World.setQuality(qPick());
Cam.init(World.camera);
// ふたりで はしるときの 右がわの カメラ（Cam と 同じ しくみ）
const Cam2 = Object.assign(Object.create(Cam), { cam: World.camera2, pos: new V3(), look: new V3(), yaw: 0, fov: 60, shakeT: 0, shakeA: 0, shakeKick: 0, tunnelK: 0, mode: 'chase' });
const camOf = k => (k && App.race && k === App.race.player2 ? Cam2 : Cam);
function camDist(p) { let d = p.distanceTo(World.camera.position); if (App.race && App.race.player2) d = Math.min(d, p.distanceTo(World.camera2.position)); return d; }
const hIdx = k => (App.race ? App.race.humans.indexOf(k) : -1);
Input.init(); Input.body = Body;
HUD.init(); Two.init();
Screens.init(App);
Body.setSens(S0.legSens, S0.steerSens, S0.swap);
Body.setNeutral(Save.data.prep.theta0 || 0);
App.char = Save.data.char; App.diff = Save.data.diff; App.course = Save.data.course;
await buildCourse(Q.get('course') || 'c1');
progress(0.85);
App.portraits = renderPortraits(World.renderer);
progress(1);
clearTimeout(slowT);
$('scrLoad').classList.remove('on');
if (DBG) { const bad = checkSongs(); if (bad.length) console.warn('songs', bad); }

// ---------- コースを 作る ----------
async function buildCourse(id) {
  const fade = $('fade');
  fade.classList.add('busy');
  await wait(30);
  const c = await Course3D.build(id, World.quality);
  Cam.setTrack(c.track, c.terrain.heightAt);
  FX.dispose && FX.scene && FX.dispose();
  if (!FX.scene) FX.init(World.scene, World.quality);
  FX.clear();
  FX.setSnow(!!(c.scenery && c.scenery.snowfall));
  c.ctx.smoke = null;
  App.course3d = c;
  fade.classList.remove('busy');
  return c;
}

// ---------- 画面の 切りかえ（付録P） ----------
async function go(next, data = {}) {
  if (App.busy) return;
  App.busy = true;
  const noFade = (App.state === 'grid' && next === 'race') || next === 'pause' || App.state === 'pause' && next === 'race';
  if (!noFade) { $('fade').classList.add('on'); await wait(300); }
  exit(App.state, next);
  const prev = App.state; App.state = next;
  try { await enter(next, prev, data); } catch (e) { console.error(e); }
  if (!noFade) { $('fade').classList.remove('on'); await wait(150); }
  App.busy = false;
}
function exit(s, next) {
  Screens.hideAll();
  if (s === 'title' || s === 'char' || s === 'prep' || s === 'podium') { if (next !== 'diff' && next !== 'course' && next !== 'settings') Stages.clear(); }
  if (['intro', 'grid', 'race'].includes(s) && !['grid', 'race', 'pause', 'result'].includes(next)) { /* そのまま */ }
}
async function startTwo() {
  if (Body.mode !== 'cam') return;
  const msg = $('twoMsg'); msg.textContent = 'ふたりぶんの じゅんび中…（すこし かかります）'; msg.classList.add('on');
  const ok = await Body.loadHalves();
  msg.classList.remove('on');
  if (!ok) { msg.textContent = 'ふたりで よみとる じゅんびに しっぱいしました'; msg.classList.add('on'); setTimeout(() => msg.classList.remove('on'), 3000); return; }
  App.mode = 'single'; App.two = true; go('char');
}
async function enter(s, prev, data) {
  const menuSong = () => Audio.music('title');
  switch (s) {
    case 'gate': {
      Stages.titleGrid(App.course3d, App.char);
      Screens.open('scrGate', { items: [], help: false });
      break;
    }
    case 'prep': {
      if (App.course3d.id !== 'c1') await buildCourse('c1');
      clearRace();
      Stages.prep(App.course3d, App.char); Stages.body = Body;
      Prep.start();
      menuSong();
      break;
    }
    case 'title': {
      if (App.course3d.id !== 'c1') await buildCourse('c1');
      clearRace();
      HUD.show(false);
      Stages.titleGrid(App.course3d, App.char);
      Screens.title(act => {
        if (act === 'gp') { App.mode = 'gp'; App.two = false; go('char'); }
        else if (act === 'single') { App.mode = 'single'; App.two = false; go('char'); }
        else if (act === 'ta') { App.mode = 'ta'; App.two = false; go('char'); }
        else if (act === 'two') startTwo();
        else if (act === 'easy') { Save.set('settings.easy', !Save.data.settings.easy); onSetting('easy', Save.data.settings.easy); Audio.play('menuMove'); $('titleEasyT').textContent = Save.data.settings.easy ? '🚗 かんたん：いま ON（アクセル じどう）' : '🚗 かんたん：ハンドルだけ'; }
        else if (act === 'prep') go('prep');
        else if (act === 'settings') go('settings');
      });
      menuSong();
      Audio.ambience('meadow');
      break;
    }
    case 'char': {
      if (App.course3d.id !== 'c1') await buildCourse('c1');
      const sel = Math.max(0, CHAR_IDS.indexOf(App.char));
      Stages.charSelect(App.course3d, sel);
      Screens.char(sel, i => Stages.charSelectSet(i), i => {
        App.char = CHAR_IDS[i]; Save.set('char', App.char);
        Stages.charPicked(i);
        Audio.say('go' + App.char[0].toUpperCase() + App.char.slice(1), 4);
        setTimeout(() => go(App.mode === 'gp' ? 'diff' : 'course'), 900);
      }, () => go('title'));
      Audio.say('pickChar', 2);
      menuSong();
      break;
    }
    case 'diff': {
      if (!Stages.root) Stages.titleGrid(App.course3d, App.char);
      Screens.diff(App.diff, k => { App.diff = k; Save.set('diff', k); startGP(); }, () => go('char'));
      Audio.say('pickDiff', 2);
      menuSong();
      break;
    }
    case 'course': {
      if (!Stages.root) Stages.titleGrid(App.course3d, App.char);
      Screens.course(App.course, Save.data.settings.laps, i => { document.body.style.background = COURSES[i].sky.horizon; }, id => { App.course = id; Save.set('course', id); App.diff = Save.data.settings.diffSingle; go('intro', { course: id }); }, () => go('char'));
      Audio.say('pickCourse', 2);
      menuSong();
      break;
    }
    case 'settings': {
      HUD.show(false);
      if (!Stages.root) Stages.titleGrid(App.course3d, App.char);
      Screens.settings(onSetting, () => go('prep'), () => { Save.resetRecords(); }, () => go('title'));
      menuSong();
      break;
    }
    case 'intro': {
      const id = data.course || App.course;
      if (App.course3d.id !== id) await buildCourse(id);
      Stages.clear();
      newRace(id, data.retry);
      break;
    }
    case 'grid': break;
    case 'race': break;
    case 'result': showResult(); break;
    case 'standings': showStandings(); break;
    case 'rest': {
      Audio.stopMusic(1); Audio.ambience('rest');
      Screens.rest(() => { Audio.ambience(App.course3d.course.biome); nextGPRace(); }, () => { App.gp = null; go('title'); });
      Audio.say('rest', 4);
      break;
    }
    case 'podium': await startPodium(); break;
    case 'summary': {
      const sum = App.gp ? App.gp.totals : { steps: 0, jumps: 0, squats: 0, banzais: 0, seconds: 0 };
      Screens.summary(sum, App.camKind == null, () => { App.gp = null; go('title'); });
      Audio.music('result');
      Audio.say('bye', 5);
      break;
    }
  }
}
function onSetting(k, v) {
  const S = Save.data.settings;
  if (k === 'easy') document.body.classList.toggle('easy', !!v);
  if (k === 'bgm' || k === 'sfx') Audio.setVolumes(S.bgm, S.sfx);
  if (k === 'voice') Audio.voiceOn = v;
  if (k === 'legSens' || k === 'steerSens' || k === 'swap') Body.setSens(S.legSens, S.steerSens, S.swap);
  if (k === 'quality') { const q = v === 'auto' ? (S._autoLevel || 'mid') : v; World.setQuality(q); FX.setQuality(q); Course3D.cur = null; buildCourse('c1').then(() => Stages.titleGrid(App.course3d, App.char)); }
}

// ---------- 入口 ----------
// スマホでは 全画面に して よこ向きに 固定する（できる 機種だけ。iPhone は できない）
function goFull() {
  if (!TOUCH || document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement, rf = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!rf) return;
  try {
    const p = rf.call(el, { navigationUI: 'hide' });
    const lock = () => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); };
    if (p && p.then) p.then(lock).catch(() => {}); else lock();
  } catch (e) {}
}
// 体で あそぶ 間は 画面を さわらないので、スマホが ねむらないように する
let wakeLock = null;
async function keepAwake() {
  App.awake = true;
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && App.awake) keepAwake(); });
if (TOUCH) {
  // 指の ボタンは 絵＋みじかい 名前
  for (const [id, pic, label] of [['tPedal', 'run', 'こぐ'], ['tJump', 'jump', 'ジャンプ'], ['tSquat', 'squat', 'しゃがむ'], ['tTurbo', 'star', 'ターボ'], ['tItem', 'clap', 'アイテム']]) $(id).innerHTML = picSVG(pic) + '<span>' + label + '</span>';
  $('gateNoCam').textContent = '👆 タッチで あそぶ';
  $('gateNoCam').classList.remove('small');
  $('gateNotes').innerHTML = 'スマホを よこにして 立てかけ、ぜんしんが うつる所まで はなれてね（2〜3m）。<br>まわりに ぶつかる ものが ないか みてね。';
}
$('gateCam').onclick = () => { goFull(); keepAwake(); startCam(); };
$('gatePhone').onclick = () => { keepAwake(); startPhone(); };
$('gateNoCam').onclick = () => { goFull(); keepAwake(); Audio.init(); Audio.unlock(); afterAudio(); App.camKind = null; Body.mode = 'nocam'; Screens.camMode = false; $('nocamBadge').classList.add('on'); $('touch').dataset.can = TOUCH ? '1' : ''; go('title'); };
const gateMsg = t => { $('gateMsg').textContent = t; if (window.PhoneCam && App.camKind === 'phone' && PhoneCam.say) PhoneCam.say(t); };
const CAM_OPT = { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } };
async function startCam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { gateMsg('この ひらきかたでは カメラを つかえません。https か localhost で ひらいてください。'); return; }
  gateMsg('カメラを じゅんび中…');
  const p = navigator.mediaDevices.getUserMedia(CAM_OPT);   // 許可を 先に（23.3）
  Audio.init(); Audio.unlock(); afterAudio();
  let stream;
  try { stream = await p; } catch (e) { gateMsg('カメラを つかえませんでした。ブラウザで カメラを きょかしてください。'); return; }
  if (window.PhoneCam) try { PhoneCam.stop(); } catch (e) {}
  App.camKind = 'pc';
  await useStream(stream);
}
function startPhone() {
  Audio.init(); Audio.unlock(); afterAudio();
  if (!window.PhoneCam) { gateMsg('つうしんの ぶひんが よみこめませんでした。ネットに つながっているか かくにんしてください。'); return; }
  gateMsg('');
  PhoneCam.open({
    mic: false,
    onStream: async remote => {
      const first = App.camKind !== 'phone';
      const video = $('camVideo');
      App.camKind = 'phone';
      if (first && video.srcObject && video.srcObject.getTracks) video.srcObject.getTracks().forEach(t => t.stop());
      const vs = new MediaStream(remote.getVideoTracks());
      watchPhone(remote);
      if (!first) { video.srcObject = vs; video.play().catch(() => {}); return; }
      await useStream(vs);
    }
  });
}
let phoneWatch = 0;
function watchPhone(remote) {
  clearInterval(phoneWatch);
  const video = $('camVideo'); let lastT = -1, still = 0;
  const badge = $('pcamBadge'); badge.classList.add('on'); badge.textContent = '📱 スマホカメラ';
  phoneWatch = setInterval(() => {
    if (App.camKind !== 'phone') { clearInterval(phoneWatch); return; }
    const vt = remote.getVideoTracks()[0];
    const moving = video.readyState >= 2 && video.currentTime !== lastT; lastT = video.currentTime;
    still = moving ? 0 : still + 1;
    if (still === 4) { video.srcObject = new MediaStream(remote.getVideoTracks()); video.play().catch(() => {}); }
    if (still >= 4) { badge.textContent = '📱 ' + (!vt ? '映像が ありません' : vt.readyState === 'ended' ? 'スマホの カメラが 止まりました' : vt.muted ? 'スマホから 映像が とどいていません' : '映像を 待っています'); badge.classList.add('ng'); }
    else if (still === 0) { badge.textContent = '📱 スマホカメラ'; badge.classList.remove('ng'); }
  }, 1000);
}
async function useStream(stream) {
  const video = $('camVideo');
  video.srcObject = stream;
  try { await Promise.race([video.play(), wait(3000)]); } catch (e) {}
  if (!(await Body.start(video, gateMsg))) return;
  Screens.camMode = true;
  $('mirror').classList.add('on');
  go(Save.data.prep.done ? 'title' : 'prep');
}
let audioReady = false;
function afterAudio() {
  if (audioReady) return; audioReady = true;
  const S = Save.data.settings;
  Audio.setVolumes(S.bgm, S.sfx); Audio.voiceOn = S.voice;
  Audio.loadVoices(window.ZGP_VOICE || {});
  FX.onFirework = (kind, pos) => { const d = camDist(pos); const vol = clamp(1 / (1 + d / 60), 0.1, 1); if (kind === 'up') Audio.play('fireworkUp', { vol }); else Audio.play('fireworkBoom', { vol, delay: 0.3 }); };
  // さわるたびに 音を 起こす
  addEventListener('pointerdown', () => { if (Audio.ctx && Audio.ctx.state !== 'running') Audio.ctx.resume(); }, { passive: true });
}
$('audioTip').onclick = () => { Audio.unlock(); };

// ---------- じゅんび（付録V.1） ----------
const PREP_STEPS = [
  { pic: 'cam', text: 'カメラに うつってね', voice: 'p1', test: (B, st, dt) => (st.t = B.seen ? st.t + dt : 0) >= CFG.prep.SEEN_T, prog: st => st.t / CFG.prep.SEEN_T },
  { pic: 'wheel', text: 'ハンドルを まっすぐ にぎってね', voice: 'p2', test: holdStill, prog: st => st.t / CFG.prep.HOLD_T, pass: st => { Body.setNeutral(st.avg); Save.data.prep.theta0 = Body.neutral; } },
  { pic: 'wheelR', text: 'みぎに まわしてね', voice: 'p3', test: (B, st, dt) => (st.t = B.steer < -CFG.prep.TURN_S ? st.t + dt : 0) >= CFG.prep.TURN_T, prog: st => st.t / CFG.prep.TURN_T },
  { pic: 'wheelL', text: 'ひだりに まわしてね', voice: 'p4', test: (B, st, dt) => (st.t = B.steer > CFG.prep.TURN_S ? st.t + dt : 0) >= CFG.prep.TURN_T, prog: st => st.t / CFG.prep.TURN_T },
  { pic: 'run', text: 'その場で あしぶみ！', voice: 'p5', test: (B, st, dt) => (st.t += B.throttle > CFG.prep.RUN_THR ? dt : 0) >= CFG.prep.RUN_T, prog: st => st.t / CFG.prep.RUN_T, pass: () => { Save.data.prep.legs = Body.legs; } },
  { pic: 'jump', text: 'ジャンプ！', voice: 'jump', event: 'jump' },
  { pic: 'squat', text: 'しゃがんで！', voice: 'squat', event: 'squat' },
  { pic: 'banzai', text: 'バンザイ！', voice: 'p8', event: 'banzai' },
  { pic: 'clap', text: 'てを パン！と たたいてね（アイテム）', voice: 'pClap', event: 'clap' }
];
function holdStill(B, st, dt) {
  st.list = st.list || [];
  if (!B.hands || B.handGap < CFG.prep.HANDS_LO || B.handGap > CFG.prep.HANDS_HI) { st.t = 0; st.list = []; st.noHands = (st.noHands || 0) + dt; return false; }
  st.noHands = 0;
  st.list.push(B.rawDeg); st.t += dt;
  while (st.list.length > 60) st.list.shift();
  const span = Math.max(...st.list) - Math.min(...st.list);
  if (span > CFG.prep.HOLD_DEG) { st.t = 0; st.list = [B.rawDeg]; }
  st.avg = st.list.reduce((a, b) => a + b, 0) / st.list.length;
  return st.t >= CFG.prep.HOLD_T;
}
const Prep = {
  start() {
    this.i = 0; this.st = { t: 0 }; this.okT = 0; this.stepT = 0; this.ev = {};
    $('prepSteps').innerHTML = PREP_STEPS.map((s, i) => `<div class="prepDot">${i + 1}</div>`).join('');
    const slot = $('prepMirrorSlot'); slot.innerHTML = ''; this.cv = document.createElement('canvas'); slot.appendChild(this.cv);
    Screens.open('scrPrep', { onOk: i => i === 0 ? this.skip() : go('title'), onBack: () => go('title'), backBtn: false });
    this.show();
    this.offs = ['jump', 'squat', 'banzai', 'clap'].map(e => { const f = () => { this.ev[e] = true; }; Body.on(e, f); return [e, f]; });
  },
  show() {
    const s = PREP_STEPS[this.i];
    [...$('prepSteps').children].forEach((d, k) => { d.className = 'prepDot' + (k < this.i ? ' done' : k === this.i ? ' now' : ''); });
    $('prepPic').innerHTML = picSVG(s.pic); $('prepText').textContent = s.text; $('prepText').className = ''; $('prepBar').style.width = '0%';
    $('prepNote').textContent = '';
    $('prepSkip').classList.remove('glow');
    this.st = { t: 0 }; this.stepT = 0; this.ev = {};
    Stages.hold = this.i >= 1 && this.i <= 3;
    Audio.say(s.voice, 5);
  },
  update(dt) {
    if (App.state !== 'prep') return;
    drawMirror(this.cv, $('camVideo'), Body);
    if (this.okT > 0) { this.okT -= dt; if (this.okT <= 0) this.next(); return; }
    const s = PREP_STEPS[this.i];
    this.stepT += dt;
    let pass = false;
    if (s.event) pass = !!this.ev[s.event];
    else { pass = s.test(Body, this.st, dt); $('prepBar').style.width = (clamp(s.prog(this.st), 0, 1) * 100) + '%'; }
    if (this.i === 1 && (this.st.noHands || 0) > 5) $('prepNote').textContent = 'て が みえないよ。からだを かたむけても まがれるよ';
    if (this.stepT > CFG.prep.SKIP_GLOW) $('prepSkip').classList.add('glow');
    if (pass) {
      s.pass && s.pass(this.st);
      $('prepText').textContent = 'できた！'; $('prepText').className = 'ok'; $('prepBar').style.width = '100%';
      Audio.say('ok', 6); Audio.play('menuOk');
      this.okT = CFG.prep.OK_SHOW;
    }
    // バンザイの 手順のとき以外は、バンザイ 1秒で とばす（Input の けってい）
    if (this.i === 7) { Input.menu.holdOk = 0; Input.take('ok'); }
  },
  next() {
    this.i++;
    if (this.i >= PREP_STEPS.length) { this.done(); return; }
    this.show();
  },
  skip() { this.next(); },
  done() {
    Save.data.prep.done = true; Save.data.prep.at = Date.now(); Save.save();
    $('prepPic').innerHTML = picSVG('banzai'); $('prepText').textContent = 'じゅんび OK！ さあ、はしろう！'; $('prepText').className = 'ok';
    Audio.say('prepDone', 6);
    this.i = PREP_STEPS.length - 1; this.okT = 99;
    setTimeout(() => { if (App.state === 'prep') go('title'); }, CFG.prep.DONE_SHOW * 1000);
  }
};

// ---------- レース ----------
function clearRace() {
  for (const m of App.models) World.scene.remove(m.group);
  if (App.plusView) { App.plusView.dispose(); App.plusView = null; }
  document.body.classList.remove('ta');
  App.models = []; App.race = null; HUD.show(false); HUD.clearLines(); $('vignette').classList.remove('strong');
  $('btnPause').classList.remove('on'); $('touch').classList.remove('on');
  document.body.classList.remove('two', 'splitOn'); Body.twoOn = false; Two.clear();
  Audio.silenceLoops(); Audio.crowd(0);
}
function newRace(id, retry) {
  clearRace();
  Input.clear();
  const c = App.course3d, S = Save.data.settings;
  const laps = Number(Q.get('laps')) || S.laps;
  const gp = App.gp;
  const two = !!App.two && !gp;
  const ta = App.mode === 'ta' && !gp && !two;
  if (two) App.char2 = CHAR_IDS[(CHAR_IDS.indexOf(App.char) + 1) % CHAR_IDS.length];
  const order = ta ? [] : gp ? CHAR_IDS.filter(x => x !== App.char).sort((a, b) => (gp.points[a] || 0) - (gp.points[b] || 0)) : two ? CHAR_IDS.filter(x => x !== App.char && x !== App.char2) : null;
  const assist = S.assist === 'auto' ? null : S.assist;
  const race = App.race = new Race(c.course, c.track, { laps, diff: App.diff, playerChar: App.char, playerChar2: two ? App.char2 : null, order, assist, seed: (Date.now() & 0xfff) + 1, points: gp ? gp.points : null, ta, ghost: ta ? Ghost.load(id, laps) : null });
  document.body.classList.toggle('ta', ta);
  if (two) { document.body.classList.add('two'); Body.twoOn = Body.mode === 'cam'; Body.resetPlayers(); App.hs = [{}, {}]; Two.setup(race); Cam2.mode = 'chase'; }
  App.models = race.karts.map(k => { const m = new KartModel(k.id, { night: !!c.course.night }); World.scene.add(m.group); m.tag = makeTag(k); if (m.tag) World.scene.add(m.tag); return m; });
  if (c.course.night) {
    for (const h of race.humans) {
      const pm = App.models[race.karts.indexOf(h)];
      const sl = new THREE.SpotLight('#fff2cc', 30, 40, 0.55, 0.6); sl.position.set(0, 1.0, 0.8); sl.target.position.set(0, 0, 10); pm.body.add(sl, sl.target);
    }
  }
  HUD.setRace(race, App.portraits, World.quality);
  App.plusView = new PlusView(race.plus, World.scene, App.models, World.quality);
  HUD.setItemHint(Body.mode === 'cam' ? '👏 てを パン！' : TOUCH ? 'アイテム ボタン' : 'X キーで つかう');
  App.itemTips = 0; App.coinCombo = 0; App.mtSaid = false; App.noItemTips = 0;
  if (ta) setTimeout(() => { if (App.race === race && App.state === 'intro') sayV('taStart'); }, 2400);
  c.trackMesh.setLights(0);
  // 統計の 始まり
  App.stats0 = { steps: Body.steps, jumps: Body.jumps, squats: Body.squats, banzais: Body.banzais, isteps: Input.steps };
  App.tipNoStar = 0; App.firstGauge = false; App.fireT = 6; App.smokeT = 0; App.lightsHideAt = 0; App.goalAt = 0; App.cheer = 0;
  // コースしょうかい
  const first = !App.seenCourse || !App.seenCourse[id];
  App.seenCourse = App.seenCourse || {}; App.seenCourse[id] = true;
  const dur = retry ? CFG.race.INTRO_T.retry : first ? CFG.race.INTRO_T.first : CFG.race.INTRO_T.again;
  const path = c.course.intro.slice(retry ? 3 : first ? 0 : 1);
  Cam.setIntro(path.length > 1 ? path : c.course.intro.slice(2), dur);
  App.introEnd = App.t + dur;
  Screens.intro(c.course, laps);
  HUD.show(false);
  Audio.music(c.course.music, { at: 0 });
  Audio.ambience(c.course.biome);
  setTimeout(() => { if (App.race === race && App.state === 'intro') Audio.say(c.course.id, 5); }, 600);
  if (App.state !== 'intro') App.state = 'intro';
}
function makeTag(k) {
  if (k.isPlayer) return null;
  const tex = labelTex(CHARS[k.id].name, CHARS[k.id].kart);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sp.scale.set(2.2, 0.82, 1); sp.renderOrder = 5;
  return sp;
}
const tagCache = {};
function labelTex(text, color) {
  if (tagCache[text]) return tagCache[text];
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.font = `800 50px 'M PLUS Rounded 1c', sans-serif`;
  const w = Math.min(230, g.measureText(text).width + 44), x = (256 - w) / 2;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.fillStyle = '#fff'; rr(x - 4, 2, w + 8, 70, 24); g.fill(); g.fillStyle = color; rr(x, 6, w, 62, 20); g.fill();
  g.beginPath(); g.moveTo(116, 72); g.lineTo(140, 72); g.lineTo(128, 90); g.closePath(); g.fillStyle = '#fff'; g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 9; g.strokeStyle = '#1d2b53'; g.lineJoin = 'round'; g.strokeText(text, 128, 38); g.fillStyle = '#fff'; g.fillText(text, 128, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tagCache[text] = t; return t;
}
function toGrid() {
  const race = App.race; if (!race) return;
  Screens.introOut(); Screens.hideAll();
  race.toGrid(); Cam.toGrid(race.player);
  if (race.player2) { Cam2.snapChase(race.player2); }
  HUD.show(true); HUD.lights(0, true);
  App.state = 'grid';
  $('btnPause').classList.add('on');
  if (Body.mode !== 'cam' && $('touch').dataset.can) $('touch').classList.add('on');
}

// ---------- できごと → 表示・音・声・効果 ----------
function sayV(id) { Audio.say(id, VOICE_PRIO[id] || 5); }
function handleEvents(race) {
  const pl = race.player, models = App.models, c3 = App.course3d, two = !!race.player2;
  const toast = (k, text, cls) => { if (two) Two.say(hIdx(k), text); else HUD.toast(text, cls); };
  for (const e of race.takeEvents()) {
    const k = e.kart, isP = !!(k && k.isPlayer), mi = k ? race.karts.indexOf(k) : -1, m = models[mi];
    const near = k ? camDist(k.wpos) : 0;
    const pan = k ? panOf(k.wpos) : 0, vol = k ? clamp(1 / (1 + near / 10), 0.05, 1) : 1;
    switch (e.type) {
      case 'light': {
        c3.trackMesh.setLights(e.v); HUD.lights(e.v, true);
        if (e.v < 4) { Audio.play('beep'); sayV(['n3', 'n2', 'n1'][e.v - 1]); }
        else { Audio.play('beepGo'); sayV('go'); App.lightsHideAt = App.t + 0.8; }
        break;
      }
      case 'go': Cam.mode = 'chase'; App.state = 'race'; break;
      case 'rocket': if (isP) { toast(k, 'ロケットスタート！'); sayV('rocket'); Audio.play('rocket'); camOf(k).kick(0.25); const back = backDir(k); FX.rocketSmoke(k.wpos, back); } break;
      case 'rocketRival': Audio.play('boost', { vol: vol * 0.5, pan }); break;
      case 'pad': Audio.play('boost', { vol: isP ? 1 : vol * 0.5, pan }); break;
      case 'slide': if (isP) { toast(k, 'スライディング！'); sayV('slide'); Audio.play('whoosh'); Audio.play('boost'); (two || HUD.cueBurst()); } break;
      case 'gateMiss': if (isP) Audio.play('gatePass'); break;
      case 'gateWobble': c3.trackMesh.wobbleGate(e.v, k.crouch ? 0.4 : 1); break;
      case 'launch': if (isP) { Audio.play(e.v ? 'superJump' : 'jump'); if (e.v) { toast(k, 'スーパージャンプ！'); sayV('super'); } (two || HUD.cueBurst()); } else Audio.play('jump', { vol: vol * 0.5, pan }); break;
      case 'super': if (isP) { toast(k, 'スーパージャンプ！'); sayV('super'); Audio.play('superJump'); } break;
      case 'hop': if (isP) Audio.play('jump', { vol: 0.6 }); break;
      case 'land': if (m) m.land(e.v); if (e.v > 4 && near < 60) FX.landRing(k.wpos, k.surf); if (isP) { Audio.play('land', { imp: e.v }); camOf(k).shake(Math.min(0.12, e.v * 0.012), 0.2); } else if (near < 30) Audio.play('land', { imp: e.v, vol: vol * 0.6, pan }); break;
      case 'trickLand': if (isP) { toast(k, 'トリック！'); sayV('trick'); Audio.play('boost'); } break;
      case 'turbo': if (isP) { toast(k, 'ターボ！', 'y'); sayV('turbo'); Audio.play('turbo'); camOf(k).kick(0.25); } else Audio.play('boost', { vol: vol * 0.6, pan }); break;
      case 'noStar': if (isP && App.tipNoStar < 3 && App.t - (App.noStarT || -9) > 2) { App.tipNoStar++; App.noStarT = App.t; toast(k, 'ほしを あつめよう'); } break;
      case 'star': {
        const st = e.v, p = c3.track.pos(st.s, st.d, st.y, new V3());
        if (near < 80) FX.sparkle(p);
        if (isP) { App.combo = App.t - (App.comboT || -9) < 1 ? Math.min(12, (App.combo || 0) + 1) : 0; App.comboT = App.t; Audio.play('star', { combo: App.combo }); }
        break;
      }
      case 'gauge': if (isP) { Audio.play('gaugeFull'); if (!App.firstGauge) { App.firstGauge = true; setTimeout(() => { HUD.turboTip(); sayV('banzaiTurbo'); }, 300); } } break;
      case 'turboTip': if (two) break; HUD.turboTip(); sayV('banzaiTurbo'); break;
      case 'wall': if (isP) { Audio.play('bumpWall', { imp: e.v }); if (e.v > CFG.phys.WALL_SHAKE) { camOf(k).shake(0.06, 0.15); FX.sparks(k.wpos, sideDir(k)); } } else if (near < 25) Audio.play('bumpWall', { imp: e.v, vol: vol * 0.5, pan }); break;
      case 'scrape': if (isP) Audio.play('scrape'); break;
      case 'bump': if (isP || (e.v && e.v.isPlayer)) { Audio.play('bumpCar'); camOf(k).shake(0.04, 0.12); } else if (near < 25) Audio.play('bumpCar', { vol: vol * 0.5, pan }); break;
      case 'cone': Audio.play('cone', { vol: isP ? 1 : vol, pan }); break;
      case 'slip': if (isP) Audio.play('whoosh'); break;
      case 'lap': if (two) { Two.say(hIdx(k), `${e.v}しゅうめ`); Audio.play('lap'); break; } HUD.big(`${e.v}しゅうめ`, 'font-size:64px;color:#fff'); Audio.play('lap'); setTimeout(() => { if (App.race === race && race.phase === 'run') HUD.big(''); }, 1200); break;
      case 'final': if (two) { Two.say(hIdx(k), 'ファイナル ラップ！'); Audio.play('lap'); break; } HUD.banner(); sayV('final'); Audio.musicVolume(0.4, 0.1); Audio.music('final', { onEnd: () => {} }); setTimeout(() => { if (App.race === race) { Audio.music(c3.course.music, { tempo: CFG.audio.FINAL_TEMPO }); Audio.musicTempo(CFG.audio.FINAL_TEMPO); } }, 3000); break;
      case 'up': Audio.play('overtake'); break;
      // ---- 第35部 ----
      case 'coin': {
        if (near < 60) FX.sparkle(App.plusView.coinPos(e.v, _tmpV2), FX_COLORS.gold, 6);
        if (isP) { App.coinCombo = App.t - (App.coinT || -9) < 0.6 ? Math.min(12, App.coinCombo + 1) : 0; App.coinT = App.t; Audio.play('coin', { combo: App.coinCombo }); }
        break;
      }
      case 'boxGet': {
        if (near < 70) { const bp = App.plusView.boxPos(e.v.box, _tmpV2); FX.sparkle(bp, FX_COLORS.white, 16); FX.glowPuff(bp, FX_COLORS.turbo0, 2); }
        if (isP && e.v.got) Audio.play('boxGet'); else if (near < 30) Audio.play('boxGet', { vol: vol * 0.4, pan });
        break;
      }
      case 'itemReady':
        if (isP) {
          Audio.play('itemReady');
          if (two) Two.say(hIdx(k), ITEM_NAME[e.v] + '！');
          else if (App.itemTips < 2) { App.itemTips++; toast(k, Body.mode === 'cam' ? '👏 てを パン！で つかう' : TOUCH ? 'アイテム ボタンで つかう' : 'X キーで つかう', 'y'); if (Body.mode === 'cam') sayV('clapItem'); }
        }
        break;
      case 'noItem': if (isP && !e.v && race.plus.itemsOn && App.noItemTips < 2 && App.t - (App.noItemT || -9) > 3) { App.noItemTips++; App.noItemT = App.t; toast(k, 'カプセルを とってね'); } break;
      case 'useItem': {
        const it = e.v;
        if (isP) Audio.play('clap');
        if (it === 'jet') { if (isP) { toast(k, 'ジェット！', 'y'); Audio.play('jet'); camOf(k).kick(0.25); FX.rocketSmoke(k.wpos, backDir(k)); } else Audio.play('boost', { vol: vol * 0.6, pan }); }
        else if (it === 'shield') { if (isP) { toast(k, 'バリア！', 'b'); Audio.play('shieldOn'); } if (near < 50) FX.sparkle(_tmpV2.copy(k.wpos).setY(k.wpos.y + 0.8), FX_COLORS.turbo0, 20); }
        else if (it === 'magnet') { if (isP) { toast(k, 'じしゃく！', 'y'); Audio.play('magnet'); } }
        else if (it === 'bubble') Audio.play('bubbleShoot', isP ? {} : { vol: vol * 0.7, pan });
        else if (it === 'pudding') Audio.play('puddingDrop', isP ? {} : { vol: vol * 0.7, pan });
        break;
      }
      case 'hit': {
        Audio.play('spin', isP ? {} : { vol: vol * 0.7, pan });
        if (near < 60) { FX.sparkle(_tmpV2.copy(k.wpos).setY(k.wpos.y + 1.6), FX_COLORS.white, 10); for (let i = 0; i < (e.v.lost || 0); i++) FX.sparkle(_tmpV2.copy(k.wpos).add(new V3((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2)), FX_COLORS.gold, 5); }
        if (isP) { toast(k, 'くるりん！'); sayV('kururin'); camOf(k).shake(0.05, 0.25); }
        break;
      }
      case 'shieldBlock': Audio.play('shieldBlock', isP ? {} : { vol, pan }); if (near < 60) FX.sparkle(_tmpV2.copy(k.wpos).setY(k.wpos.y + 0.8), FX_COLORS.turbo0, 24); if (isP) { toast(k, 'バリアで ふせいだ！', 'b'); sayV('shieldOk'); } break;
      case 'bubblePop': case 'bubbleFade': {
        const sp = App.plusView.shotPos(e.v, _tmpV2);
        if (camDist(sp) < 70) { FX.sparkle(sp, FX_COLORS.turbo0, 18); FX.glowPuff(sp, FX_COLORS.white, 1.6); }
        if (e.type === 'bubblePop') Audio.play('bubblePop', isP ? {} : { vol, pan });
        break;
      }
      case 'puddingSplat': {
        Audio.play('puddingSplat', isP ? {} : { vol, pan });
        if (near < 60) { const pp = k.track.pos(e.v.s, e.v.d, 0.4, _tmpV2); for (let i = 0; i < 12; i++) FX.add.spawn({ x: pp.x, y: pp.y, z: pp.z, vx: (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 6, g: 14, life: 0.6, s0: 0.35, s1: 0.2, c0: [1, 0.83, 0.42], a0: 1, a1: 0, frame: 2 }); }
        break;
      }
      case 'driftStart': if (isP) Audio.play('drift'); break;
      case 'driftLv': if (isP) Audio.play('driftLv', { lv: e.v }); break;
      case 'miniTurbo':
        if (isP) { Audio.play('boost'); camOf(k).kick(e.v === 2 ? 0.2 : 0.12); if (e.v === 2) toast(k, 'スーパー ミニターボ！', 'y'); else if (!App.mtSaid) toast(k, 'ミニターボ！'); if (!App.mtSaid) { App.mtSaid = true; sayV('miniTurbo'); } }
        else if (near < 25) Audio.play('boost', { vol: vol * 0.4, pan });
        break;
      case 'split': { const d = e.v, good = d < 0; HUD.toast(`👻 ${good ? '−' : '＋'}${Math.abs(d).toFixed(2)}びょう`, good ? 'g' : 'r'); Audio.play('split', { good }); break; }
      case 'top': sayV('top'); break;
      case 'cueVoice': if (two) break; sayV(e.v === 'jump' ? 'jump' : e.v === 'squat' ? 'squat' : 'run'); break;
      case 'goal': if (two) onGoalTwo(race, k, e.v); else onGoal(race, e.v); break;
      case 'allGoal': onAllGoal(race); break;
      case 'rescue': if (two) { race.humans.forEach((hh, ii) => { if (!hh.finished) Two.say(ii, 'あと すこし！', 2500); }); break; } HUD.almost(true); sayV('almost'); App.cheer = 1; break;
      case 'done': if (App.state === 'race' || App.state === 'finish') go('result'); break;
      case 'slowmoEnd': if (Cam.mode !== 'goal') Cam.setGoal(pl); break;
    }
  }
}
const _tmpV = new V3(), _tmpV2 = new V3();
function panOf(p) { const cam = World.camera; _tmpV.copy(p).applyMatrix4(cam.matrixWorldInverse); return clamp(_tmpV.x / 12, -1, 1); }
function backDir(k) { return new V3(-Math.sin(k.yawW), 0, -Math.cos(k.yawW)); }
function sideDir(k) { const f = k.track.frame(k.s, {}); const s = -Math.sign(k.d); return new V3(f.lfx * s, 0, f.lfz * s); }
function onGoal(race, pos) {
  App.state = 'finish';
  HUD.big('ゴール！', 'font-size:120px');
  HUD.almost(false);
  FX.confetti(new V3().copy(World.camera.position).add(new V3(0, 0, -6).applyQuaternion(World.camera.quaternion)), 400, 6, 4);
  Audio.play('confetti'); App.cheer = 1.5;
  sayV('goal');
  Audio.stopMusic(0.3);
  setTimeout(() => Audio.music(pos <= 3 ? 'goalWin' : 'goalPlay', { onEnd: () => setTimeout(() => { if (App.state === 'finish' || App.state === 'result') Audio.music('result'); }, 1000) }), 350);
  setTimeout(() => { if (App.race !== race) return; HUD.big(`${pos}い！`, `font-size:160px;color:${pos === 1 ? '#ffd54a' : pos === 2 ? '#e6edf5' : pos === 3 ? '#ffb37a' : '#ffffff'}`, true); sayV('r' + pos); }, 1500);
  if (App.course3d.scenery && App.course3d.scenery.fireworksAt) for (let i = 0; i < 5; i++) setTimeout(() => FX.firework(new V3().copy(race.player.wpos).add(new V3((Math.random() - 0.5) * 60, 55 + Math.random() * 20, (Math.random() - 0.5) * 60)), ['ball', 'heart', 'star'][i % 3]), i * 600 + 400);
  // 統計
  const s0 = App.stats0;
  const cam = Body.mode === 'cam';
  App.statsRace = {
    steps: cam ? Body.steps - s0.steps : Input.steps - s0.isteps,
    jumps: cam ? Body.jumps - s0.jumps : race.player.stats.jumps || 0,
    squats: cam ? Body.squats - s0.squats : 0,
    banzais: cam ? Body.banzais - s0.banzais : 0,
    bestLap: race.stats.bestLap, time: race.player.finishTime, cam, coins: race.player.stats.coins
  };
  if (race.ta) {
    const old = race.plus.ghost;
    App.statsRace.ghostOld = old ? old.time : null;
    App.statsRace.ghostNew = race.plus.finishGhost(App.char, race.course.id, race.laps);
    if (old && App.statsRace.ghostNew) setTimeout(() => sayV('ghostWin'), 2600);
  }
  $('btnPause').classList.remove('on'); $('touch').classList.remove('on');
}

function onGoalTwo(race, k, pos) {
  Two.goal(hIdx(k), pos);
  FX.confetti(new V3().copy(k.wpos).add(new V3(0, 3, 0)), 220, 6, 4);
  Audio.play('confetti'); App.cheer = 1;
  sayV('goal');
}
function onAllGoal(race) {
  App.state = 'finish';
  Audio.stopMusic(0.3);
  const first = race.finishOrder.find(k => k.isPlayer);
  setTimeout(() => Audio.music(race.finishOrder.indexOf(first) < 3 ? 'goalWin' : 'goalPlay', { onEnd: () => setTimeout(() => { if (App.state === 'finish' || App.state === 'result') Audio.music('result'); }, 1000) }), 350);
  App.statsRace = { two: true, time: Math.max(...race.humans.map(h => h.finishTime)), cam: true, steps: 0, jumps: 0, bestLap: Infinity };
  $('btnPause').classList.remove('on'); $('touch').classList.remove('on');
}

// ---------- けっか・グランプリ ----------
function showResult() {
  HUD.show(false); HUD.clearLines();
  const race = App.race, c = App.course3d.course, laps = race.laps;
  const list = race.results();
  const st = App.statsRace || { steps: 0, jumps: 0, bestLap: Infinity };
  if (race.player2) {
    const rows2 = list.map(r => ({ id: r.k.id, t: r.t, you: r.k.isPlayer, tag: r.k === race.player ? '1P' : r.k === race.player2 ? '2P' : '' }));
    Screens.result(c, rows2, { html: `<span>1P　${fmtTime(race.player.finishTime)}</span><span>2P　${fmtTime(race.player2.finishTime)}</span>` }, [
      { text: 'もういちど', fn: () => go('intro', { course: c.id }) },
      { text: 'コースを えらぶ', fn: () => go('course') },
      { text: 'タイトルへ', fn: () => go('title') }
    ], App.portraits);
    App.lastPos = 1;
    return;
  }
  const rec = { time: race.player.finishTime, lap: st.bestLap, char: App.char, laps, at: Date.now(), nocam: !st.cam };
  const best = Save.data.settings.easy ? false : Save.setBest(c.id, laps, rec);
  if (st.cam) Save.addTotals(st, race.player.finishTime);
  if (best) setTimeout(() => sayV('best'), 1600);
  const rows = list.map(r => ({ id: r.k.id, t: r.t, you: r.k.isPlayer, best: r.k.isPlayer && best }));
  const pos = list.findIndex(r => r.k.isPlayer) + 1;
  if (race.ta) {
    const g = st.ghostOld, me = race.player.finishTime;
    const html = `<span>⏱ タイム ${fmtTime(me)}</span><span>👻 ${g ? 'ゴースト ' + fmtTime(g) + (me < g ? '　かった！' : '') : 'ゴースト ―'}</span><span>${st.ghostNew ? 'あたらしい ゴーストを のこしたよ' : 'いちばん はやい しゅう ' + (isFinite(st.bestLap) ? fmtTime(st.bestLap) : '―')}</span>`;
    Screens.result(c, rows, { html }, [
      { text: 'もういちど', fn: () => go('intro', { course: c.id }) },
      { text: 'コースを えらぶ', fn: () => go('course') },
      { text: 'タイトルへ', fn: () => go('title') }
    ], App.portraits);
    App.lastPos = 1;
    return;
  }
  if (App.gp) {
    const gp = App.gp;
    gp.results.push(list.map(r => r.k.id));
    gp.prev = { ...gp.points };
    list.forEach((r, i) => { gp.points[r.k.id] = (gp.points[r.k.id] || 0) + CFG.race.POINTS[i]; });
    gp.add = Object.fromEntries(list.map((r, i) => [r.k.id, CFG.race.POINTS[i]]));
    for (const k of ['steps', 'jumps', 'squats', 'banzais']) gp.totals[k] += st[k] || 0;
    gp.totals.seconds += race.player.finishTime;
    Screens.result(c, rows, st, [{ text: 'つぎへ', fn: () => go('standings') }], App.portraits);
  } else {
    Screens.result(c, rows, st, [
      { text: 'もういちど', fn: () => go('intro', { course: c.id }) },
      { text: 'コースを えらぶ', fn: () => go('course') },
      { text: 'タイトルへ', fn: () => go('title') }
    ], App.portraits);
  }
  App.lastPos = pos;
}
function gpRanking(gp) {
  const last = gp.results[gp.results.length - 1] || CHAR_IDS;
  return CHAR_IDS.map(id => ({ id, total: gp.points[id] || 0, lastPos: last.indexOf(id) })).sort((a, b) => b.total - a.total || a.lastPos - b.lastPos);
}
function showStandings() {
  const gp = App.gp;
  const now = gpRanking(gp);
  const prevOrder = CHAR_IDS.map(id => ({ id, total: gp.prev[id] || 0 })).sort((a, b) => b.total - a.total);
  const rows = now.map((r, i) => ({ id: r.id, total: r.total, prev: gp.prev[r.id] || 0, add: gp.add[r.id] || 0, rank: i, prevRank: prevOrder.findIndex(p => p.id === r.id), you: r.id === App.char }));
  const done = gp.idx >= COURSES.length - 1;
  Screens.standings(gp.idx + 1, rows, App.portraits, done ? [{ text: 'ひょうしょうしきへ', fn: () => go('podium') }] : [{ text: 'つぎの コースへ', fn: () => nextGPRace() }, { text: 'やすむ', fn: () => go('rest') }]);
  Audio.music('result');
}
function startGP() {
  App.gp = { idx: 0, points: {}, prev: {}, add: {}, results: [], totals: { steps: 0, jumps: 0, squats: 0, banzais: 0, seconds: 0 } };
  go('intro', { course: COURSES[0].id });
}
function nextGPRace() { const gp = App.gp; gp.idx++; go('intro', { course: COURSES[gp.idx].id }); }
async function startPodium() {
  const gp = App.gp;
  if (App.course3d.id !== 'c4') await buildCourse('c4');
  clearRace();
  const rank = gpRanking(gp);
  Stages.podium(App.course3d, rank, App.char);
  Screens.podium(() => go('summary'));
  const myRank = rank.findIndex(r => r.id === App.char) + 1;
  const T = [
    [0.0, () => { Audio.music('podium', { onEnd: () => {} }); sayV('podium'); }],
    [0.5, () => { Stages.climb(3); Audio.play('jump'); }],
    [1.5, () => { Stages.climb(2); Audio.play('jump'); }],
    [2.5, () => Audio.play('drumroll')],
    [4.0, () => { Stages.climb(1); Audio.play('cymbal'); Audio.musicHoldRelease(); FX.confetti(Stages.center.clone().add(new V3(0, 0, 1)), 400, 5, 7); Audio.play('confetti'); Stages.trophyDown(); for (let i = 0; i < 4; i++) setTimeout(() => FX.firework(Stages.center.clone().add(new V3((i - 1.5) * 18, 50, -30)), ['heart', 'ball', 'star', 'ball'][i]), i * 500); }],
    [5.0, () => Stages.camShot(2)],
    [8.0, () => { Screens.podiumText(myRank <= 3 ? `グランプリ ${myRank}い！` : `グランプリ ${myRank}い！ さいごまで はしったね！`); sayV(myRank === 1 ? 'gp1' : myRank === 2 ? 'gp2' : myRank === 3 ? 'gp3' : 'gpx'); if (myRank <= 3) Save.setCup(App.diff, myRank); }],
    [12.0, () => Screens.podiumShowNext()]
  ];
  App.podiumT0 = App.t; App.podiumQ = T.slice();
}

// ---------- 一時停止 ----------
function pause(kind) {
  const race = App.race; if (!race || App.paused) return;
  if (!['grid', 'race'].includes(App.state)) return;
  App.paused = true; App.pauseKind = kind; race.paused = true; document.body.classList.add('paused');
  Audio.musicVolume(0.35); Audio.silenceLoops();
  if (kind === 'lost') Screens.pauseLost(() => quitRace());
  else Screens.pauseMenu(!!App.gp, () => resume(), () => { unpause(); go('intro', { course: App.course3d.id, retry: true }); }, () => quitRace());
  sayV(kind === 'lost' ? 'p1' : 'pause');
}
function unpause() { document.body.classList.remove('paused'); App.paused = false; if (App.race) App.race.paused = false; Screens.hideAll(); Audio.musicVolume(1); HUD.count(0); }
function resume() {
  Screens.hideAll(); App.pauseKind = 'count';
  const steps = [['2', 'n2'], ['1', 'n1']];
  let i = 0;
  const next = () => {
    if (!App.paused) return;
    if (i >= steps.length) { HUD.count(0); unpause(); return; }
    HUD.count(steps[i][0]); Audio.play('beep'); Audio.say(steps[i][1], 9); i++;
    setTimeout(next, CFG.race.RESUME_COUNT * 1000);
  };
  next();
}
function quitRace() { unpause(); App.gp = null; go('title'); }
$('btnPause').onclick = () => pause('menu');
Body.on('lost', () => { if (Body.mode === 'cam' && (App.state === 'race' || App.state === 'grid')) { if (App.state === 'grid' && App.race) App.race.holdGrid = true; pause('lost'); } });
Body.on('found', () => { if (App.paused && App.pauseKind === 'lost') { if (App.race) App.race.holdGrid = false; resume(); } });
Body.on('jump', () => Input.queue.push('jump'));
Body.on('banzai', () => Input.queue.push('banzai'));
Body.on('clap', () => Input.queue.push('item'));

// ---------- 鏡 ----------
let mirrorTick = 0;
function updateMirror() {
  if (Body.mode !== 'cam') return;
  const box = $('mirrorBox');
  drawMirror($('mirrorCv'), $('camVideo'), Body);
  if (Body.twoOn) {
    const ok = Body.players.map(p => p.seen);
    box.classList.toggle('lost', !(ok[0] && ok[1]));
    const tip2 = $('mirrorTip'); const t2 = !ok[0] && !ok[1] ? 'ふたり うつってね' : !ok[0] ? '1P（左）が うつってないよ' : !ok[1] ? '2P（右）が うつってないよ' : '';
    tip2.textContent = t2; tip2.style.display = t2 ? 'block' : 'none';
    return;
  }
  box.classList.toggle('lost', !Body.seen);
  const tip = $('mirrorTip');
  const t = !Body.seen ? 'カメラに うつってね' : (!Body.legs && !Body.hands) ? 'もう すこし はなれてね' : (!Body.hands && Body.handsLostT > 0.3) ? 'ハンドルを むねの まえで にぎってね' : '';
  tip.textContent = t; tip.style.display = t ? 'block' : 'none';
  const f = $('mirrorLegFill'), th = Body.throttle;
  f.style.width = (th * 100) + '%'; f.style.background = th < 0.5 ? '#56d364' : th < 0.8 ? '#ffd54a' : '#ff7a2f';
  $('mirrorLegSrc').textContent = Body.legs ? '' : 'かた';
  const w = $('mirrorWheel'); w.style.color = Body.steerSrc === 'hands' ? '#ffffff' : Body.steerSrc === 'lean' ? '#8fd3ff' : '#777';
  $('mirrorWheelG').setAttribute('transform', `rotate(${-Body.steer * 120} 50 50)`);
}

// ---------- 画面の 大きさ ----------
function fit() {
  // 1280×720 を 基準に 縮めて、横長・縦長の 画面では 箱を 画面の 形に のばす（すみの 表示が 画面の すみに 来る）
  const W = innerWidth, H = innerHeight, k = Math.min(W / 1280, H / 720, 2);
  const st = document.documentElement.style;
  st.setProperty('--k', String(k));
  st.setProperty('--uw', Math.max(1280, Math.round(W / k)) + 'px');
  st.setProperty('--uh', Math.max(720, Math.round(H / k)) + 'px');
  $('portraitTip').classList.toggle('can', true);
  // スマホを たてにしたら レースを 止める（よこに もどしたら 「つづける」で 再開）
  if (TOUCH && H > W && ['grid', 'race'].includes(App.state) && !App.paused) pause('menu');
}
addEventListener('resize', fit); fit();
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => setTimeout(fit, 120));
// iPhone の ピンチで 画面が 大きくならないように
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------- 1コマ ----------
let last = performance.now(), loopPaused = false, dbgSpeed = 1;
const _p = new V3(), _q = new THREE.Quaternion();
function frame(dt, ts) {
  App.t += dt;
  const t = App.t;
  if (Body.mode === 'cam' && Body.tick(ts)) { if (++mirrorTick % 1 === 0) updateMirror(); }
  const menu = !['intro', 'grid', 'race', 'finish'].includes(App.state) || App.paused;
  Input.update(dt, menu);
  if (Input.take('pause') && !menu) { pause('menu'); Input.take('back'); }
  if (menu && !App.busy) { Screens.update(dt); Screens.charUpdate(); Input.take('jump'); Input.take('tap'); Input.take('item'); if (App.state !== 'prep') Input.take('banzai'); }
  if (!menu) { for (const n of App.state === 'intro' ? ['menuL', 'menuR', 'back', 'tap'] : ['ok', 'menuL', 'menuR', 'back', 'tap', 'bodyOk']) Input.take(n); }
  $('mirror').classList.toggle('on', Body.mode === 'cam' && App.state !== 'prep' && App.state !== 'gate');
  Prep.update(dt);
  const race = App.race;
  if (race) {
    const pl = race.player;
    if (race.player2) { humanInputs(race, dt); Input.take('item'); }
    else if (App.auto) { App.auto.think(dt); if (race.plus.itemsOn && race.phase === 'run') race.plus.rivalItem(pl, dt); }
    else {
      pl.input.throttle = Save.data.settings.easy ? 1 : Input.throttle; pl.input.steer = Input.steer; pl.input.crouch = Input.crouch; pl.input.legPhase = Input.legPhase;
      if (Input.take('jump')) pl.input.jump = true;
      if (Input.take('banzai')) pl.input.banzai = true;
      if (Input.take('item')) pl.input.item = true;
      pl.banzaiHold = Input.banzaiHeld;
    }
    if (race.player2 && App.state === 'intro' && Body.players.some(p => p.banzaiT > 0.3)) toGrid();
    if (App.state === 'intro' && (App.t >= App.introEnd || Input.take('ok') || Input.take('banzai') || Input.take('bodyOk'))) toGrid();
    if (!App.paused) race.update(dt * dbgSpeed);
    if (App.lightsHideAt && App.t > App.lightsHideAt) { App.lightsHideAt = 0; HUD.lightsAway(); }
    handleEvents(race);
    if (App.plusView) App.plusView.update(dt, t, race);
    // カートの 見た目
    const a = race.alpha || 0;
    race.karts.forEach((k, i) => {
      const m = App.models[i]; if (!m) return;
      m.group.position.lerpVectors(k.prevPos, k.wpos, a); m.group.quaternion.slerpQuaternions(k.prevQuat, k.wquat, a);
      const far = camDist(k.wpos) > 80;
      m.pose({ v: k.v, steer: k.steerShown, throttle: race.phase === 'intro' ? 0.05 : k.input.throttle, pedalA: k.pedalA, roll: k.rollShown, bob: k.bob, boost: k.boostT > 0, trickA: k.trickA, crouch: k.crouchShown, banzai: k.banzaiShown, face: k.face, accelY: k.accelY, accelX: k.accelX * 0.05, wave: k.finished && !k.faceHappy && !k.isPlayer, clap: k.clapT > 0, far }, dt, t);
      if (m.tag) { m.tag.position.copy(m.group.position).add(new V3(0, 2.1, 0)); const d = camDist(k.wpos); m.tag.visible = d < CFG.hud.TAG_FAR && d > CFG.hud.TAG_HIDE && race.phase !== 'intro'; m.tag.material.opacity = d < CFG.hud.TAG_NEAR ? 0.5 : 1; }
      kartFX(k, m, dt, race);
    });
    if (['grid', 'race', 'finish'].includes(App.state) || race.phase === 'done') { HUD.update(dt, race, t); }
    // 音
    if (!App.paused) {
      const rivals = race.karts.filter(k => !k.isPlayer).map(k => ({ k, d: k.wpos.distanceTo(pl.wpos) })).filter(r => r.d < CFG.audio.RIVAL_SOUND_R).sort((a, b) => a.d - b.d).map(r => ({ k: r.k, pan: panOf(r.k.wpos), vol: 1 / (1 + r.d / 6) }));
      Audio.updateLoops(pl, dt, { pre: race.phase === 'grid', rivals });
      // 観客
      const sc = App.course3d.scenery;
      if (sc && sc.crowd) { const d = pl.wpos.distanceTo(sc.crowd.center); App.cheer = Math.max(0, App.cheer - dt * 0.3); Audio.crowd(clamp(1 - d / 90, 0, 1) * 0.6 + App.cheer * 0.4); sc.cheer = App.cheer > 0.5; }
    }
    // トンネル
    const tk = Math.max(Cam.tunnelK || 0, race.player2 ? Cam2.tunnelK || 0 : 0);
    World.setTunnel(tk * 0.85);
    if ((tk > 0.5) !== !!App.inTunnel) { App.inTunnel = tk > 0.5; Audio.setTunnel(App.inTunnel); }
    $('vignette').classList.toggle('strong', pl.boostT > 0);
    // 花火（コース4）
    const sc = App.course3d.scenery;
    if (sc && sc.fireworksAt && ['grid', 'race', 'finish', 'intro'].includes(App.state)) {
      App.fireT -= dt;
      if (App.fireT <= 0) { const n = race.finalLap ? 2 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) setTimeout(() => FX.firework(sc.fireworksAt.clone().add(new V3((Math.random() - 0.5) * 80, Math.random() * 20, (Math.random() - 0.5) * 60)), ['ball', 'ball', 'heart', 'star'][Math.floor(Math.random() * 4)]), i * 350); App.fireT = race.finalLap ? 3 + Math.random() * 2 : 8 + Math.random() * 6; }
    }
    if (sc && sc.smokes && sc.smokes.length) { App.smokeT -= dt; if (App.smokeT <= 0) { App.smokeT = 0.25; for (const s of sc.smokes) FX.smoke(new V3(s.x + 1.6, s.y, s.z + 0.8)); } }
    // 画質の 自動調整
    autoQuality(dt);
  }
  // 表彰式の 予定
  if (App.podiumQ && App.state === 'podium') { const tt = App.t - App.podiumT0; while (App.podiumQ.length && App.podiumQ[0][0] <= tt) App.podiumQ.shift()[1](); }
  Stages.update(dt, t);
  Cam.update(dt, { kart: race ? race.player : null });
  const split = !!(race && race.player2 && ['grid', 'race', 'finish'].includes(App.state));
  if (split) Cam2.update(dt, { kart: race.player2 });
  document.body.classList.toggle('splitOn', split);
  World.update(dt);
  World.sky.position.copy(World.camera.position);
  Course3D.update(dt, t, race ? race.karts : [], World.camera);
  FX.update(dt, World.camera);
  const fp = race ? race.player.wpos : Cam.look;
  World.followShadow(fp.x, fp.y, fp.z);
  Audio.ambTick(dt, t);
  if (Audio.ctx) $('audioTip').classList.toggle('on', Audio.ctx.state !== 'running' && App.state !== 'gate');
  if (split) { World.renderSplit(race.player.wpos, race.player2.wpos); if (['grid', 'race'].includes(App.state)) Two.update(race); }
  else World.render();
  if (DBG) dbgInfo(dt);
}
const _bk = new V3(), _nz = new V3();
// ふたりで はしる：ひとりずつ の 体から 入力を 作る
function humanInputs(race, dt) {
  const easy = Save.data.settings.easy;
  race.humans.forEach((k, i) => {
    const P = Body.players[i], st = App.hs[i], o = App.override2 && App.override2[i];
    k.input.throttle = easy ? 1 : P.throttle; k.input.steer = P.steer; k.input.crouch = P.crouch; k.input.legPhase = P.legs && P.throttle > 0.05 ? P.legPhase : null;
    if (P.air && !st.air) k.input.jump = true;
    if (P.banzai && !st.banzai) k.input.banzai = true;
    if (st.claps != null && P.claps !== st.claps) k.input.item = true;
    st.air = P.air; st.banzai = P.banzai; st.claps = P.claps;
    k.banzaiHold = P.banzaiT > 0.05;
    if (o) { for (const key of ['throttle', 'steer', 'crouch']) if (o[key] != null) k.input[key] = o[key]; if (o.jump) { k.input.jump = true; o.jump = false; } if (o.banzai) { k.input.banzai = true; o.banzai = false; } if (o.item) { k.input.item = true; o.item = false; } }
    const a = App.autos && App.autos[i]; if (a) a.think(dt);
  });
  // どちらかが 見えなく なったら ひとやすみ
  const lost = Body.twoOn && Body.players.some(p => p.isLost);
  if (lost && !App.paused && ['grid', 'race'].includes(App.state)) { if (App.state === 'grid') race.holdGrid = true; pause('lost'); }
  else if (!lost && App.paused && App.pauseKind === 'lost') { race.holdGrid = false; resume(); }
}
function kartFX(k, m, dt, race) {
  const near = camDist(k.wpos);
  if (near > 70) return;
  const back = _bk.set(-Math.sin(k.yawW), 0, -Math.cos(k.yawW));
  if (k.ground && k.v > 3) {
    const off = ['grass', 'sand', 'snow'].includes(k.surf) || (k.surf === 'snowroad' && Math.random() < 0.25) || (k.surf === 'packed' && Math.random() < 0.2);
    const rate = off ? k.v * 2.5 : 0;
    k._dustAcc = (k._dustAcc || 0) + rate * dt;
    while (k._dustAcc > 1) { k._dustAcc -= 1; FX.dust(_nz.copy(k.wpos).addScaledVector(back, 0.7), k.surf, k.v, back); }
    if (k.surf === 'puddle') { k._spAcc = (k._spAcc || 0) + 70 * dt; while (k._spAcc > 1) { k._spAcc -= 1; FX.splash(k.wpos, k.v); } if (!k._inPuddle && k.isPlayer) Audio.play('splash'); k._inPuddle = true; } else k._inPuddle = false;
  }
  if (k.boostT > 0 || k.boostFadeT > 0) {
    k._flAcc = (k._flAcc || 0) + 60 * dt;
    while (k._flAcc > 1) { k._flAcc -= 1; for (let i = 0; i < 2; i++) FX.flame(m.nozzleWorld(i, _nz), back, k.turbo); }
  }
  // ドリフトの 火花（白 → 青 → オレンジ）
  if (k.drift && k.ground && k.v > 4) {
    k._dfAcc = (k._dfAcc || 0) + (k.driftLv ? 70 : 30) * dt;
    const col = k.driftLv === 2 ? [1, 0.42, 0.05] : k.driftLv === 1 ? [0.15, 0.55, 1] : [1, 0.9, 0.55];
    while (k._dfAcc > 1) {
      k._dfAcc -= 1;
      for (const wi of [2, 3]) {
        const wp = m.wheels[wi].steer.getWorldPosition(_nz); wp.y -= 0.2;
        FX.add.spawn({ x: wp.x, y: wp.y, z: wp.z, vx: back.x * 3 + (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2.5, vz: back.z * 3 + (Math.random() - 0.5) * 3, g: 12, life: 0.28, s0: k.driftLv ? 0.42 : 0.22, s1: 0.08, c0: col, c1: col, a0: 1, a1: 0, frame: k.driftLv ? 2 : 1 });
      }
    }
  }
  if (k.isPlayer && k.slipping) { k._wAcc = (k._wAcc || 0) + 30 * dt; while (k._wAcc > 1) { k._wAcc -= 1; FX.wind(k.wpos, _nz.set(-back.x, 0, -back.z)); } }
}
let qAcc = 0, qN = 0, qLowT = 0, qHighT = 0;
function autoQuality(dt) {
  const S = Save.data.settings;
  if (S.quality !== 'auto' || App.state !== 'race' || Q.get('q')) return;
  qAcc += App.frameMs; qN++;
  if (qN < 30) return;
  const avg = qAcc / qN; qAcc = 0; qN = 0;
  const C = CFG.quality;
  if (avg > C.DOWN_MS) qLowT += 0.5; else qLowT = 0;
  if (avg < C.UP_MS && Body.cost < C.UP_POSE_MS) qHighT += 0.5; else qHighT = 0;
  const order = ['low', 'mid', 'high'], i = order.indexOf(World.quality);
  if (qLowT >= C.DOWN_T && i > 0) { const q = order[i - 1]; World.setQuality(q); FX.setQuality(q); S._autoLevel = q; Save.save(); qLowT = 0; if (DBG) console.log('quality down', q); }
  if (qHighT >= C.UP_T && i < 2) { S._autoLevel = order[i + 1]; Save.save(); qHighT = 0; }   // 次の コースから
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  App.frameMs = App.frameMs * 0.9 + (now - last) * 0.1;
  last = now;
  if (!loopPaused) frame(dt, now);
}
requestAnimationFrame(loop);

// ---------- はじめの 画面 ----------
if (DBG && Q.has('course')) {
  // ?dbg&course=… ：入口と タイトルを とばす
  Audio.init(); Audio.unlock(); afterAudio();
  Body.mode = 'nocam'; App.char = Q.get('char') || App.char; App.diff = Q.get('diff') || 'easy'; App.mode = Q.has('ta') ? 'ta' : 'single';
  $('nocamBadge').classList.add('on');
  App.state = 'intro';
  App.two = Q.has('two');
  newRace(Q.get('course'));
  if (Q.has('skip')) toGrid();
  if (Q.has('auto')) setAuto(Number(Q.get('auto')) || 0.9);
} else {
  App.state = 'boot';
  go('gate');
}

// ---------- ?dbg（第29部） ----------
function setAuto(level) {
  const race = App.race; if (!race) return;
  if (level == null) { App.auto = null; return; }
  const mk = (k, n) => { const a = new Rival(k, race, level, 99 + n); a.D = { ...a.D, base: 21.6, alat: 16, sjump: 1, slide: 1, trick: 0.5, rocket: 1, turbo: 'smart' }; a.person = {}; return a; };
  if (race.player2) { App.autos = race.humans.map(mk); return; }
  App.auto = mk(race.player, 0);
}
function dbgInfo(dt) {
  const el = $('dbgInfo'); if (!el.dataset.on) return;
  const r = World.renderer.info.render, race = App.race, p = race ? race.player : null;
  el.textContent = `fps ${(1000 / App.frameMs).toFixed(1)}  ms ${App.frameMs.toFixed(1)}  draw ${r.calls}  tri ${(r.triangles / 1000).toFixed(0)}k  q ${World.quality}\n`
    + `pose ${Body.cost.toFixed(0)}ms every ${Body.every.toFixed(0)}ms legs ${Body.legs ? '✔' : '－'} hands ${Body.hands ? '✔' : '－'}\n`
    + (p ? `s ${p.s.toFixed(1)} d ${p.d.toFixed(2)} v ${p.v.toFixed(1)} psi ${p.psi.toFixed(2)} lap ${p.lap} pos ${race.playerPos}\nthr ${p.input.throttle.toFixed(2)} steer ${p.input.steer.toFixed(2)} src ${Body.steerSrc} stars ${p.stars} state ${App.state}` : `state ${App.state}`);
}
if (DBG) {
  const dbgApi = {
    get ready() { return App.state !== 'boot' && !App.busy; }, App, World, Cam, Body, Input, Audio, FX, HUD, Save, THREE, CFG, Stages, Screens,
    get race() { return App.race; },
    state() { const r = App.race, p = r && r.player; return { app: App.state, phase: r && r.phase, time: r && +r.time.toFixed(2), lap: p && p.lap, s: p && +p.s.toFixed(1), d: p && +p.d.toFixed(2), v: p && +p.v.toFixed(2), pos: r && r.playerPos, stars: p && p.stars, coins: p && p.coins, item: p && (p.item || (p.rollT > 0 ? 'roll' : null)), drift: p && p.driftLv, order: r && r.order.map(k => k.id), fin: r && r.finishOrder.map(k => [k.id, +k.finishTime.toFixed(2)]) }; },
    go(name, opt) { return go(name, opt); },
    course(id) { return buildCourse(id); },
    step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) frame(dt, performance.now()); return this.state(); },
    run(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) frame(1 / 60, performance.now()); return this.state(); },
    sim(sec) { const r = App.race; const n = Math.round(sec * 120); for (let i = 0; i < n; i++) { if (App.auto) App.auto.think(1 / 120); r.update(1 / 120); handleEvents(r); if (App.state === 'intro') toGrid(); } frame(1 / 60, performance.now()); return this.state(); },
    pause(v) { loopPaused = v; },
    input(o) { Input.override = o; },
    auto(level) { setAuto(level); },
    in2(a) { App.override2 = a; },
    warp(s, lap = 0) { const p = App.race.player; p.s = p.track.wrapS(s); p.lap = lap; p.d = 0; p.psi = 0; p.computeWorld(); p.prevPos.copy(p.wpos); p.prevQuat.copy(p.wquat); Cam.snapChase(p); },
    finish() { const r = App.race; this.warp(r.track.L - 15, r.laps - 1); },
    feed(lm, dt, t) { Body.feed(lm, dt, t); },
    pose(spec, t) { return synthPose(spec, t); },
    body() { return { throttle: Body.throttle, steer: Body.steer, steerSrc: Body.steerSrc, jumps: Body.jumps, squats: Body.squats, banzais: Body.banzais, steps: Body.steps, legs: Body.legs, seen: Body.seen, lost: Body.isLost }; },
    bodyReset() { Body.reset(); Body.resetCounts(); },
    quality(q) { World.setQuality(q); FX.setQuality(q); },
    cam(mode) { Cam.mode = mode; },
    view(s, d, h, ls, lh = 0) { const tr = App.course3d.track, p = tr.pos(tr.wrapS(s), d, h, new V3()), l = tr.pos(tr.wrapS(ls), 0, lh, new V3()); Cam.setFixed(p, l, 60); frame(1 / 60, performance.now()); },
    checkTrack() { return App.course3d.track.check(); },
    info(on = true) { const el = $('dbgInfo'); el.dataset.on = on ? '1' : ''; el.style.display = on ? 'block' : 'none'; return { calls: World.renderer.info.render.calls, tris: World.renderer.info.render.triangles, times: Course3D.times }; },
    voice(id) { Audio.say(id, 9); }, song(id) { Audio.music(id); }, sfx(n) { Audio.play(n); },
    speed(k) { dbgSpeed = k; },
    give(it) { const p = App.race.player; p.item = it; p.rollT = 0; return it; },
    use() { App.race.player.input.item = true; },
    plus() { const P = App.race.plus; return { coins: P.coins.length, boxes: P.boxes.length, shots: P.shots.length, traps: P.traps.length, ghost: !!P.ghost, rec: P.rec.p.length, karts: App.race.karts.map(k => ({ id: k.id, coins: k.coins, item: k.item, mts: k.stats.mts, items: k.stats.items, hits: k.stats.hits })) }; },
    ghost(id, laps = 3) { return Ghost.load(id, laps); },
    checkSongs, shot() { World.render(); return World.renderer.domElement.toDataURL('image/png'); }
  };
  // MediaPipe の 中で「dbg」という 名前の 関数を よぶ 所が あるので、よべる 形に しておく（ただの 物だと カメラが 動かない）
  window.dbg = Object.defineProperties((...a) => console.debug(...a), Object.getOwnPropertyDescriptors(dbgApi));
  window.dbg.info(true);
}
