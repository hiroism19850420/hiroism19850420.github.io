// はしれ！とべ！ぜんしんダッシュ！ の はじまり（第6部、付録AG・AH・AS）
import * as THREE from 'three';
import { CFG } from './config.js';
import { $, wait, clamp, lerp, damp, fmtTime, smoothstep } from './util.js';
import { World } from './world.js';
import { Course3D, COURSES_BY } from './course3d.js';
import { COURSES, DISTS, DIFFS } from './courses.js';
import { RunnerRig, CHARS, CHAR_IDS, renderPortraits } from './models.js';
import { Race } from './race.js';
import { AutoPlayer } from './ai.js';
import { Cam } from './camera.js';
import { Input } from './input.js';
import { Detector, BodyState, synthPose, synthTwo, drawMirror } from './body.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Giongo, GIONGO, GIONGO_CHARS } from './giongo.js';
import { Audio, checkSongs } from './audio.js';
import { VOICE_PRIO } from './voicelines.js';
import { Save } from './save.js';
import { Screens } from './screens.js';
import { Stages } from './stages.js';
import { picSVG } from './pics.js';

const Q = new URLSearchParams(location.search);
const DBG = Q.has('dbg');
const V3 = THREE.Vector3;
const svgURL = name => `url("data:image/svg+xml,${encodeURIComponent(picSVG(name).replace('currentColor', '#ffd54a').replace(/currentColor/g, '#ffd54a'))}")`;

// ---------- アプリの 状態 ----------
const App = {
  state: 'boot', mode: 'solo', chars: ['mimi', 'kero'], course: 'c1', dist: 'mid', diff: 'easy',
  race: null, rigs: [], portraits: {}, views: [], t: 0, busy: false, paused: false, pauseKind: null,
  timeK: 1, timeTarget: 1, timeTau: 0.05, acc: 0, auto: null, inputMode: 'key', camKind: null,
  lastZ: -99, zAt: {}, cheer: 0, frameMs: 16, photoT: 0, c3d: null, prepDone: false
};
window.__zdash = App;

// ---------- よみこみ ----------
const loadBar = $('loadBar'), loadRunner = $('loadRunner'), loadMsg = $('loadMsg');
const progress = p => { loadBar.style.width = (p * 100) + '%'; loadRunner.style.left = (p * 100) + '%'; };
const slowT = setTimeout(() => { loadMsg.textContent = 'ネットが おそいかも。もう すこし まってね'; }, 15000);
Save.load();
if (Q.has('mute')) Audio.muted = true;
progress(0.15);
// 擬音の 字体（使う 字だけ）
{ const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap&text=' + encodeURIComponent(GIONGO_CHARS); document.head.appendChild(l); }
try { await Promise.race([Promise.all([document.fonts.load('800 40px "M PLUS Rounded 1c"'), document.fonts.load('40px "Dela Gothic One"', GIONGO_CHARS)]), wait(6000)]); } catch (e) {}
progress(0.35);
World.init($('gl'));
const S0 = Save.data.settings;
const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches;
document.body.classList.toggle('touch', TOUCH);
if (TOUCH && !S0._touchQ) { S0._autoLevel = 'low'; S0._touchQ = true; Save.save(); }
const qPick = () => Q.get('q') || (S0.quality === 'auto' ? (S0._autoLevel || 'mid') : S0.quality);
World.setQuality(qPick());
document.documentElement.style.setProperty('--handIcon', svgURL('handR'));
document.documentElement.style.setProperty('--flagIcon', `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M20 92V8" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M24 10h56l-12 18 12 18H24z" fill="#56d364" stroke="#1d2b53" stroke-width="5"/></svg>')}")`);
document.documentElement.style.setProperty('--goalIcon', `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M20 92V8" stroke="#fff" stroke-width="8" stroke-linecap="round"/><rect x="24" y="8" width="60" height="40" fill="#fff" stroke="#1d2b53" stroke-width="5"/><path d="M24 8h15v13H24zM54 8h15v13H54zM39 21h15v14H39zM69 21h15v14H69zM24 35h15v13H24zM54 35h15v13H54z" fill="#1d2b53"/></svg>')}")`);
const MainCam = new Cam(World.camera, 'land');
const cam2 = new THREE.PerspectiveCamera(60, 1, CFG.cam.NEAR, CFG.cam.FAR);
const Cam2 = new Cam(cam2, 'half');
Input.init(); Input.body = Detector.players;
HUD.init();
Screens.init(App);
Stages.init(MainCam);
FX.init(World.scene, World.quality);
const settings = () => Save.data.settings;
Giongo.init($('giongo'), {
  settings, uiK: () => Number(getComputedStyle(document.documentElement).getPropertyValue('--k')) || 1,
  portrait: () => document.body.classList.contains('portrait'),
  views: () => App.views.length ? App.views.map(v => ({ cam: v.cam.cam, rect: v.rect })) : [{ cam: World.camera, rect: { x: 0, y: 0, w: innerWidth, h: innerHeight } }],
  cueRect: i => HUD.cueRect(i), portraits: App.portraits,
  slowTo: (k, sec) => { App.timeTarget = k; App.timeTau = Math.max(0.01, sec / 3); },
  camCut: (r, sec, vi, kind) => { const v = App.views[vi] || App.views[0]; if (!v) return; if (kind === 'goal') v.cam.goalCut(r, App.c3d.H, sec); else v.cam.cut(r, App.c3d.H, sec, r.d > 0 ? -1 : 1); },
  flash: () => flash(0.35, 0.08), t: () => App.t
});
syncSens();
const L0 = Save.data.last;
Object.assign(App, { mode: L0.mode, course: L0.course, dist: L0.dist, diff: L0.diff, chars: [L0.char, L0.char2] });
await ensureCourse('c1', 'short');
progress(0.85);
App.portraits = renderPortraits(World.renderer);
Giongo.env.portraits = App.portraits;
progress(1);
clearTimeout(slowT);
$('scrLoad').classList.remove('on');
if (DBG) { const bad = checkSongs(); if (bad.length) console.warn('songs', bad); }

// ---------- コースを 作る ----------
async function ensureCourse(id, dist) {
  const L = CFG.course.DIST[dist];
  const key = id + ':' + L + ':' + World.quality;
  if (App.c3d && App.c3d.built === key) return App.c3d;
  const fade = $('fade'); fade.classList.add('busy');
  await wait(30);
  if (!App.c3d) App.c3d = new Course3D(FX);
  clearRace();
  App.c3d.build(id, dist, World.quality);
  FX.clear(); FX.setSnow(!!App.c3d.scenery.snowfall);
  fade.classList.remove('busy');
  return App.c3d;
}

// ---------- 画面の 切りかえ（6.4） ----------
async function go(next, data = {}) {
  if (App.busy) return;
  App.busy = true;
  const noFade = next === 'start' || (App.state === 'intro' && next === 'start');
  if (!noFade) { $('fade').classList.add('on'); await wait(300); }
  Screens.hideAll();
  const prev = App.state; App.state = next;
  try { await enter(next, prev, data); } catch (e) { console.error(e); }
  if (!noFade) { $('fade').classList.remove('on'); await wait(150); }
  App.busy = false;
}
const isRacing = () => ['start', 'race', 'finish'].includes(App.state);
async function enter(s, prev, data) {
  document.body.classList.toggle('racing', ['intro', 'start', 'race', 'finish'].includes(s));
  document.body.classList.toggle('two', App.mode === 'two' && ['intro', 'start', 'race', 'finish', 'result', 'two'].includes(s));
  Input.menuWho = 0;
  if (!['intro', 'start', 'race', 'finish', 'result'].includes(s)) { clearRace(); HUD.show(false); }
  const menuSong = () => Audio.music('title');
  switch (s) {
    case 'gate': {
      await ensureCourse('c1', 'short');
      Stages.title(App.c3d);
      Screens.gate(TOUCH, !TOUCH);
      break;
    }
    case 'prep': {
      await ensureCourse('c1', 'short');
      Stages.prep(App.c3d, App.chars[0], Detector.players[0]);
      Prep.start(data.first);
      Audio.music('prep');
      break;
    }
    case 'title': {
      await ensureCourse('c1', 'short');
      if (Detector.numPoses !== 1) await Detector.setNum(1);
      Stages.title(App.c3d);
      const canTwo = App.inputMode === 'cam' && !document.body.classList.contains('portrait');
      Screens.title(onTitle, canTwo, App.inputMode === 'cam');
      menuSong(); Audio.ambience('meadow');
      if (!App.saidTitle || Math.random() < 0.34) { App.saidTitle = true; setTimeout(() => sayV('m_title'), 400); }
      break;
    }
    case 'two': {
      await Detector.setNum(2);
      TwoPrep.start();
      menuSong();
      break;
    }
    case 'char': {
      await ensureCourse('c1', 'short');
      const pick = data.pick || 0, taken = pick === 1 ? App.chars[0] : null;
      const sel = Math.max(0, CHAR_IDS.indexOf(App.chars[pick]));
      if (Stages.mode !== 'char') Stages.charSelect(App.c3d, sel, taken); else { Stages.setTaken(taken); }
      Input.menuWho = App.mode === 'two' ? pick : 0;
      Screens.char(sel, pick, taken, App.mode === 'two', i => Stages.charSelectSet(i), i => {
        App.chars[pick] = CHAR_IDS[i]; Save.set(pick ? 'last.char2' : 'last.char', CHAR_IDS[i]);
        Stages.charPicked(i); Audio.play('pita');
        setTimeout(() => { if (App.mode === 'two' && pick === 0) go('char', { pick: 1 }); else go('course'); }, 800);
      }, () => { if (pick === 1) go('char', { pick: 0 }); else go(App.mode === 'two' ? 'two' : 'title'); });
      sayV(App.mode === 'two' ? (pick ? 'm_char2' : 'm_char1') : 'm_char');
      menuSong();
      break;
    }
    case 'course': {
      if (Stages.mode !== 'char') Stages.charSelect(App.c3d, CHAR_IDS.indexOf(App.chars[0]));
      Screens.course(App.course, App.dist, App.diff, c => { document.body.style.background = c.sky.horizon; }, id => { App.course = id; Save.set('last.course', id); go('dist'); }, () => go('char', { pick: App.mode === 'two' ? 1 : 0 }));
      sayV('m_course'); menuSong();
      break;
    }
    case 'dist': {
      if (Stages.mode !== 'char') Stages.charSelect(App.c3d, CHAR_IDS.indexOf(App.chars[0]));
      Screens.dist(App.dist, id => { App.dist = id; Save.set('last.dist', id); go('diff'); }, () => go('course'));
      sayV('m_dist'); menuSong();
      break;
    }
    case 'diff': {
      if (Stages.mode !== 'char') Stages.charSelect(App.c3d, CHAR_IDS.indexOf(App.chars[0]));
      Screens.diff(App.diff, id => { App.diff = id; Save.set('last.diff', id); go(App.mode === 'jama' ? 'jama' : 'intro'); }, () => go('dist'));
      sayV('m_diff'); menuSong();
      break;
    }
    case 'jama': {
      if (Stages.mode !== 'char') Stages.charSelect(App.c3d, CHAR_IDS.indexOf(App.chars[0]));
      Screens.jama(App.inputMode === 'cam', () => JamaPrep.start(), () => go('intro'), () => go('diff'));
      sayV('m_jama'); menuSong();
      break;
    }
    case 'intro': {
      Stages.clear();
      await ensureCourse(App.course, App.dist);
      newRace();
      break;
    }
    case 'result': showResult(); break;
    case 'rest': {
      Audio.stopMusic(1); Audio.ambience('rest');
      Screens.rest(() => { App.restDone = true; const f = App.afterRest; App.afterRest = null; f ? f() : go('title'); }, () => go('title'));
      sayV('m_rest');
      break;
    }
    case 'settings': {
      await ensureCourse('c1', 'short');
      if (!Stages.root) Stages.title(App.c3d);
      Screens.settings(onSetting, () => go('prep'), () => Save.resetRecords(), () => go('title'));
      menuSong();
      break;
    }
  }
}
function onTitle(act) {
  if (act === 'prep') return go('prep');
  if (act === 'settings') return go('settings');
  App.mode = act; Save.set('last.mode', act);
  if (act === 'two') go('two'); else go('char', { pick: 0 });
}
function onSetting(k, v) {
  const S = Save.data.settings;
  if (k === 'bgm' || k === 'sfx') Audio.setVolumes(S.bgm, S.sfx);
  if (k === 'voice') Audio.voiceOn = v;
  if (k === 'legSens' || k === 'shiftSens' || k === 'swap') syncSens();
  if (k === 'diff') { App.diff = v; Save.set('last.diff', v); }
  if (k === 'dist') { App.dist = v; Save.set('last.dist', v); }
  if (k === 'quality') { const q = v === 'auto' ? (S._autoLevel || 'mid') : v; World.setQuality(q); FX.setQuality(q); App.c3d.built = null; ensureCourse('c1', 'short').then(() => Stages.title(App.c3d)); }
}
function syncSens() {
  const S = Save.data.settings, portrait = document.body.classList.contains('portrait');
  Detector.players.forEach(B => B.setSens(S.legSens, S.shiftSens, S.swap, portrait));
}

// ---------- 入口（7.4） ----------
function goFull() {
  if (!TOUCH || document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement, rf = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!rf) return;
  try { const p = rf.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
let wakeLock = null;
async function keepAwake() {
  App.awake = true;
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && App.awake) keepAwake(); if (document.visibilityState === 'hidden' && isRacing() && !App.paused) pause('menu'); });
const gateMsg = t => { $('gateMsg').textContent = t; if (window.PhoneCam && App.camKind === 'phone' && PhoneCam.say) PhoneCam.say(t); };
const CAM_OPT = { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } };
$('gateCam').onclick = () => { goFull(); keepAwake(); startCam(); };
$('gatePhone').onclick = () => { keepAwake(); startPhone(); };
$('gateTouch').onclick = () => { goFull(); keepAwake(); startNoCam('touch'); };
$('gateKey').onclick = () => { startNoCam('key'); };
function setMode(m) {
  App.inputMode = m; Input.mode = m; Screens.mode = m;
  document.body.classList.toggle('cam', m === 'cam');
  $('inputBadge').textContent = m === 'touch' ? '👆 タッチ' : m === 'key' ? '⌨ キーボード' : '';
  $('inputBadge').classList.toggle('on', m !== 'cam');
}
function startNoCam(m) {
  Audio.init(); Audio.unlock(); afterAudio();
  App.camKind = null; Detector.mode = 'off'; setMode(m);
  go('title');
}
async function startCam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { gateMsg('この ひらきかたでは カメラを つかえません。https か localhost で ひらいてください。'); return; }
  gateMsg('カメラを じゅんび中…');
  const p = navigator.mediaDevices.getUserMedia(CAM_OPT);   // 許可を 先に
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
      const first = App.camKind !== 'phone', video = $('camVideo');
      App.camKind = 'phone';
      if (first && video.srcObject && video.srcObject.getTracks) video.srcObject.getTracks().forEach(t => t.stop());
      const vs = new MediaStream(remote.getVideoTracks());
      if (!first) { video.srcObject = vs; video.play().catch(() => {}); return; }
      $('pcamBadge').classList.add('on');
      await useStream(vs);
    }
  });
}
async function useStream(stream) {
  const video = $('camVideo');
  video.srcObject = stream;
  try { await Promise.race([video.play(), wait(3000)]); } catch (e) {}
  if (!(await Detector.start(video, gateMsg, 1))) return;
  setMode('cam');
  go(Save.data.prep.done ? 'title' : 'prep', { first: !Save.data.prep.done });
}
let audioReady = false;
function afterAudio() {
  if (audioReady) return; audioReady = true;
  const S = Save.data.settings;
  Audio.setVolumes(S.bgm, S.sfx); Audio.voiceOn = S.voice;
  Audio.loadVoices(window.ZDASH_VOICE || {});
  FX.onFirework = (kind, pos) => { const d = pos.distanceTo(World.camera.position); const v = clamp(1 / (1 + d / 60), 0.1, 1); if (kind === 'up') Audio.play('fireworkUp', { v }); else Audio.play('fireworkBoom', { v, delay: 0.3 }); };
  addEventListener('pointerdown', () => { if (Audio.ctx && Audio.ctx.state !== 'running') Audio.ctx.resume(); }, { passive: true });
}
$('audioTip').onclick = () => Audio.unlock();
// 体の できごとを いまの 係へ（れんしゅう・ふたりの じゅんび）
for (const B of Detector.players) for (const ev of ['jump', 'squat', 'banzai', 'handR', 'handL', 'armR', 'armL', 'legR', 'legL']) B.on(ev, (d, b) => App.bodyEvent && App.bodyEvent(ev, b));

// ---------- 声 ----------
function sayV(id, opt) { return Audio.say(id, VOICE_PRIO(id), opt); }
// ずんだもん（付録AK）
function sayZ(id, gap = 0) {
  const S = Save.data.settings; if (!S.voice || !S.cheer) return false;
  const now = App.t, R = CFG.race;
  if (now - App.lastZ < R.COMMENT_GAP) return false;
  if (gap && now - (App.zAt[id] || -99) < gap) return false;
  if (App.race && App.race.players.some(p => App.race.cueEta(p) < R.CHEER_GAP_CUE + 1.6)) return false;
  if (Audio.voiceBusy(8)) return false;
  App.lastZ = now; App.zAt[id] = now;
  return Audio.say(id, 3);
}
// 合図の 声（2人対戦は 19.4）
function sayCue(id, who, beep) {
  const race = App.race;
  if (!race.two) { sayV(id, { cue: true }); if (beep) Audio.play(beep, { v: CFG.audio.BEEP / 0.5 }); return; }
  const me = who, other = race.players.find(p => p !== me), pan = me.who ? 0.7 : -0.7;
  const far = Math.abs(me.s - other.s) > CFG.two.VOICE_SEP;
  const otherCue = race.cueOf(other), same = otherCue && race.cueOf(me) && otherCue.id === race.cueOf(me).id && Math.abs(otherCue.eta - race.cueOf(me).eta) <= CFG.two.VOICE_SHARE;
  if (far) { sayV(id, { cue: true, pan }); if (beep) Audio.play(beep, { pan }); return; }
  if (same) { if (me.s >= other.s) { sayV(id, { cue: true }); if (beep) Audio.play(beep); } return; }
  if (me.s >= other.s) { sayV(id, { cue: true }); if (beep) Audio.play(beep, { pan }); }
  else if (beep) Audio.play(beep, { pan });
}

// ---------- レース ----------
function clearRace() {
  for (const g of App.rigs) { World.scene.remove(g.root); if (g.ghostRoot) World.scene.remove(g.ghostRoot); g.dispose(); }
  App.rigs = []; App.race = null; App.views = []; App.auto = null; Input.race = null;
  if (App.c3d && App.c3d.obs) App.c3d.obs.clear();
  FX.removeTrails(); FX.clear();
  HUD.show(false); HUD.clearLines(); Giongo.clear();
  $('vignette').classList.remove('final'); $('btnPause').classList.remove('on'); $('touch').classList.remove('on'); document.body.classList.remove('photo');
  $('hNext').classList.remove('on'); App.orbitOn = false; App.nextTip = false; App.finalOn = false;
  World.setWarm(0);
  Audio.silenceLoops(); Audio.crowd(0); Audio.musicBoost(false);
  App.timeK = App.timeTarget = 1;
}
function newRace(retry = false) {
  clearRace();
  Input.clear();
  const c3d = App.c3d, course = c3d.c, two = App.mode === 'two';
  const playerChars = two ? [App.chars[0], App.chars[1]] : [App.chars[0]];
  const seed = Number(Q.get('seed')) || ((Date.now() & 0xffff) + 1);
  const race = App.race = new Race({ course, L: c3d.L, diff: App.diff, mode: App.mode, chars: CHAR_IDS, playerChars, seed });
  race.waitSeen = () => App.inputMode !== 'cam' || race.players.every(p => Detector.players[p.who].seen);
  c3d.obs.place(race.obstacles);
  c3d.obs.onWave = () => Audio.play('wave', { v: 0.8 });
  c3d.gates.close(); c3d.goal.tape.reset();
  const ghosts = CFG.quality[World.quality].after;
  App.rigs = race.runners.map(r => {
    const tag = r.isPlayer ? (two ? (r.who ? '2P' : '1P') : null) : CHARS[r.char].name;
    const g = new RunnerRig(r.char, { tag, ghosts: r.isPlayer ? (two ? 2 : ghosts) : 0 });
    r.rig = g;
    World.scene.add(g.root); if (g.ghostRoot) World.scene.add(g.ghostRoot);
    if (r.isPlayer) {
      g.aura = FX.makeAura(CHARS[r.char].kart); g.body.add(g.aura);
      if (course.special && course.special.footTrails) g.trails = [FX.addTrail(CHARS[r.char].kart), FX.addTrail(CHARS[r.char].kart)];
    }
    return g;
  });
  // うすく する 材質を 先に 作っておく（はじめて うすく なるときに 止まらないように）
  for (const g of App.rigs) g.setFade(0.5);
  try { World.renderer.compile(World.scene, World.camera); } catch (e) {}
  for (const g of App.rigs) g.setFade(1);
  // 見る 人（1人 か 2人）
  const portrait = document.body.classList.contains('portrait');
  MainCam.reset(); MainCam.setKind(two ? 'half' : portrait ? 'portrait' : 'land');
  App.views = race.players.map((p, i) => ({ who: i, runner: p, cam: i === 0 ? MainCam : Cam2, rect: { x: 0, y: 0, w: innerWidth, h: innerHeight } }));
  if (two) { Cam2.reset(); Cam2.setKind('half'); }
  layoutViews();
  HUD.setRace(race, App.portraits, World.quality);
  Input.race = race;
  // 統計の はじまり
  App.stats0 = race.players.map(p => { const B = Detector.players[p.who]; return { steps: B.steps, jumps: B.jumps, isteps: Input.players[p.who].steps }; });
  App.cheer = 0; App.fireT = 2; App.smokeT = 0; App.goalAt = 0; App.photo = null; App.photoT = 0; App.lastZ = -99; App.zAt = {}; App.fightSaid = false; App.restDue = false;
  App.acc = 0; App.introT = 0;
  // コースの 紹介（7.13、22.7）
  MainCam.intro(c3d.H, c3d.L, retry ? 2.5 : CFG.cam.INTRO_T);
  App.introEnd = App.t + (retry ? 2.5 : CFG.cam.INTRO_T);
  Screens.intro(course, App.dist, App.diff, () => toStart());
  HUD.show(false);
  Audio.music(course.music, { at: 0 }); Audio.musicVolume(0.7);
  Audio.ambience(course.biome);
  setTimeout(() => { if (App.race === race && App.state === 'intro') sayV(course.voice); }, 500);
  setTimeout(() => { if (App.race === race && App.state === 'intro') sayZ('z_go'); }, 3200);
  if (App.state !== 'intro') App.state = 'intro';
}
function layoutViews() {
  const W = innerWidth, H = innerHeight;
  if (App.views.length === 2) { App.views[0].rect = { x: 0, y: 0, w: W / 2, h: H }; App.views[1].rect = { x: W / 2, y: 0, w: W / 2, h: H }; }
  else if (App.views[0]) App.views[0].rect = { x: 0, y: 0, w: W, h: H };
}
// ゲートへ（紹介の あと）
function toStart() {
  const race = App.race; if (!race || App.state !== 'intro') return;
  Screens.hideAll();
  App.state = 'start';
  document.body.classList.add('racing');
  for (const v of App.views) { v.cam.gate(App.c3d.H); v.cam.init = false; }
  if (App.views[1]) { App.views[1].cam.pos.x -= 1.2; }
  HUD.show(true);
  $('btnPause').classList.add('on');
  if (App.inputMode === 'touch') $('touch').classList.add('on');
  Audio.musicVolume(1, 0.3);
  if (Detector.mode === 'cam') race.players.forEach(p => Detector.players[p.who].recenter());
  setTimeout(() => { if (App.race === race) sayZ('z_ready'); }, 300);
}

// ---------- できごと → 表示・音・声・効果（付録AG） ----------
const _v = new V3(), _v2 = new V3();
const headPos = (r, out = new V3()) => out.set(r.d, App.c3d.H(r.s) + (r.h || 0) + 1.55, -r.s);
const footPos = (r, out = new V3()) => out.set(r.d, App.c3d.H(r.s) + (r.h || 0) + 0.05, -r.s);
const vcam = i => ((App.views[i] || App.views[0]) || { cam: MainCam }).cam;
const viewOf = r => { const i = App.views.findIndex(v => v.runner === r); return i < 0 ? 0 : i; };
const nearCam = (r, dist) => { const c = World.camera.position; return (c.x - r.d) ** 2 + (c.z + r.s) ** 2 < dist * dist; };
const panOf = r => { const me = App.views[0] && App.views[0].runner; return me ? clamp((r.d - me.d) / 4, -1, 1) : 0; };
function giongoAt(id, r, opt = {}) { return Giongo.show(id, opt.foot ? footPos(r) : headPos(r), { view: viewOf(r), ...opt }); }
function anyPlayerNear(r, dist) { return App.race.players.some(p => Math.abs(p.s - r.s) < dist); }
function rivalVisible(r) { return anyPlayerNear(r, 25) && App.views.some(v => { _v.copy(headPos(r)).project(v.cam.cam); return _v.z < 1 && Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1; }); }
function handleEvents(race) {
  const evs = race.events.splice(0);
  for (const e of evs) {
    switch (e.type) {
      case 'gateReady': HUD.big('いちについて', '', 1.2); sayV('s_ready'); break;
      case 'gateSet': HUD.big('よーい', '', 1.0); sayV('s_set'); Audio.stopMusic(0.3); Audio.loop('heart', true); for (const v of App.views) v.cam.toChase(1.2); break;
      case 'gateGo': {
        HUD.big(''); sayV('s_go'); Audio.loop('heart', false); Audio.play('gateOpen');
        App.c3d.gates.open();
        Giongo.show('don', new V3(0, App.c3d.H(0) + 1.6, 1.0));
        const hinges = CFG.course.GATE_D.flatMap(d => [new V3(d - 0.6, App.c3d.H(0) + 0.6, -0.65), new V3(d + 0.6, App.c3d.H(0) + 0.6, -0.65)]);
        FX.gateSparks(hinges, new V3(0, App.c3d.H(0) + 3.2, -1));
        for (const v of App.views) { v.cam.shake('gate'); v.cam.kickFov(CFG.cam.GO_FOV_KICK); }
        setTimeout(() => { if (App.race === race) Audio.music(App.c3d.c.music, { noIntro: true }); }, CFG.race.MUSIC_DELAY * 1000);
        App.state = 'race';
        break;
      }
      case 'rocket': giongoAt('zudon', e.who); FX.rocketBlast(footPos(e.who)); HUD.toast('ロケットスタート！', 'y'); sayV('s_rocket'); setTimeout(() => sayZ('z_rocket'), 1200); break;
      case 'cue': onCue(e); break;
      case 'cueOk': onCueOk(e); break;
      case 'cueMiss': onCueMiss(e); break;
      case 'rivalOk': case 'rivalMiss': {
        const ok = e.type === 'rivalOk', ob = e.ob;
        if (!ok) { App.c3d.obs.wobble(ob, 0.6); if (ob.base === 'banzai') App.c3d.obs.tearPaper(ob, false); }
        else if (ob.base === 'banzai') { App.c3d.obs.tearPaper(ob, true); if (nearCam(e.who, 40)) FX.paperBurst(headPos(e.who)); }
        if (ob.base === 'hand') App.c3d.obs.ballResult(ob, e.who, ok);
        if (rivalVisible(e.who)) giongoAt(ok ? { jump: 'zuba', crouch: 'zuza', dodge: 'shuba', banzai: 'bari', hand: 'bashi' }[ob.base] : { jump: 'gatsun', crouch: 'gochin', dodge: 'dogo', banzai: 'bofu', hand: 'boyon' }[ob.base], e.who, { size: 's', rival: true });
        break;
      }
      case 'ballThrow': App.c3d.obs.throwBall(e.ob, e.who, race.runners.indexOf(e.who)); if (e.who.isPlayer || anyPlayerNear(e.who, 12)) Audio.play('ballThrow', { v: e.who.isPlayer ? 1 : 0.4 }); break;
      case 'pass': giongoAt('shubaS', e.a, { size: 's' }); Audio.whooshPast(panOf(e.b)); if (Math.random() < 0.3) sayZ('z_pass_' + e.b.char, 15); break;
      case 'makuri': {
        if (!e.who.isPlayer || !Giongo.cutin('makuri', e.who, { word: 'gyun', face: 'effort', view: viewOf(e.who) })) giongoAt('gyun', e.who);
        e.who.ghostT = 1.2; sayZ('z_makuri_' + e.who.char);
        break;
      }
      case 'rivalMakuri': if (anyPlayerNear(e.who, 30)) sayZ('z_makuri_' + e.who.char, 12); break;
      case 'passed': HUD.passFlash(viewOf(e.b)); break;
      case 'contact': if (e.a.isPlayer || e.b.isPlayer) { const p = e.a.isPlayer ? e.a : e.b; Giongo.show('gotsu', headPos(p).add(_v2.set((e.b.d - e.a.d) * 0.5, -0.4, 0)), { view: viewOf(p) }); } break;
      case 'land': if (e.big && (e.who.isPlayer || nearCam(e.who, 25))) { if (e.who.isPlayer) giongoAt('donS', e.who, { foot: true }); FX.ring(footPos(e.who), 1.6, '#ffffff'); FX.footDust(footPos(e.who), surfOf(e.who), 1, CHARS[e.who.char].kart); if (e.who.isPlayer) vcam(viewOf(e.who)).shake('land'); } break;
      case 'jamaWindup': onWindup(e); break;
      case 'jamaHit': onJamaHit(e); break;
      case 'jamaDodge': onJamaDodge(e); break;
      case 'jamaWhiff': if (e.from.isPlayer) giongoAt('sukaS', e.from, { size: 's' }); else if (rivalVisible(e.from)) giongoAt('sukaS', e.from, { size: 's', rival: true }); break;
      case 'angry': if (e.first) sayZ('z_angry_' + e.who.char); break;
      case 'finalSoon': if (e.who === race.players[0] || !race.two) { Giongo.show('gogogo', { sx: 0.5, sy: 0.3 }, { view: viewOf(e.who) }); HUD.toast('このさき さいごの ちょくせん'); sayV('r_soon'); Audio.musicBreak(2); } break;
      case 'final': {
        if (!App.finalOn) { App.finalOn = true; HUD.banner('ラストスパート！'); sayV('r_final'); setTimeout(() => sayZ('z_final'), 1800); Audio.musicBoost(true); $('vignette').classList.add('final'); if (App.c3d.c.biome === 'beach') App.warmT = 0.001; }
        giongoAt('goo', e.who, { view: viewOf(e.who) });
        break;
      }
      case 'last100': sayV('r_100'); setTimeout(() => sayZ('z_almost'), 900); break;
      case 'topSpeed': giongoAt('dododo', e.who, { foot: true }); sayZ('z_fast'); break;
      case 'spurtFire': if (App.t - (e.who._fireSaid || -9) > 4) { e.who._fireSaid = App.t; giongoAt('gooS', e.who, { size: 's' }); } break;
      case 'tape': App.c3d.goal.tape.breakAt(e.who.d, e.who.v); Audio.play('tape'); flash(0.25, 0.08); break;
      case 'photo': App.photo = e; break;
      case 'finish': onFinish(e); break;
      case 'footstep': onFootstep(e.who); break;
      case 'cueAgain': if (e.who.isPlayer) sayV('c_again'); break;
      case 'lead': sayZ('z_lead_' + e.who.char, 10); break;
      case 'chaos': sayZ('z_chaos'); break;
    }
  }
}
const CUE_LEAD = { jump: 'c_jump', crouch: 'c_crouch', banzai: 'c_banzai' };
const CUE_GO = { jump: 'g_jump', crouch: 'g_crouch', dodge: 'g_dodge', banzai: 'g_banzai' };
function onCue(e) {
  const ob = e.ob, st = e.stage, base = ob.base;
  if (st === 'lead') {
    sayCue(CUE_LEAD[base] || (base === 'dodge' ? (ob.side > 0 ? 'c_dodgeR' : 'c_dodgeL') : (ob.side > 0 ? 'c_handR' : 'c_handL')), e.who);
    App.c3d.obs.mark(ob, true);
  } else if (st === 'go') sayCue(CUE_GO[base] || (ob.side > 0 ? 'g_handR' : 'g_handL'), e.who, 'beepGo');
  else if (st === 'next') sayCue('c_next', e.who);
  else if (!e.skipped || st === '1') sayCue('n' + st, e.who, 'beep');
}
function onCueOk(e) {
  const ob = e.ob, r = e.who, vi = viewOf(r);
  const big = ob.base === 'jump' && r.apex >= 1.5;
  giongoAt({ jump: 'zuba', crouch: 'zuza', dodge: 'shuba', banzai: 'bari', hand: 'bashi' }[ob.base], r, { perfect: e.perfect, size: big ? 'l' : 'm' });
  FX.stars(headPos(r), e.perfect ? CFG.fx.STARS_PERFECT : CFG.fx.STARS_OK, e.perfect);
  App.c3d.obs.mark(ob, false);
  if (ob.base === 'crouch') App.c3d.obs.wobble(ob, 0.25);
  if (ob.base === 'dodge') r.ghostT = 0.5;
  if (ob.base === 'banzai') { App.c3d.obs.tearPaper(ob, true); FX.paperBurst(headPos(r)); }
  if (ob.base === 'hand') App.c3d.obs.ballResult(ob, r, true);
  if (e.perfect) { HUD.toast('パーフェクト！', 'y'); sayZ('z_perfect'); $('vignette').classList.add('gold'); setTimeout(() => $('vignette').classList.remove('gold'), 220); }
  else sayZ({ jump: 'z_jump', crouch: 'z_slide', dodge: 'z_dodge', banzai: 'z_banzai', hand: 'z_swat' }[ob.base]);
  HUD.cueBurst(vi);
}
function onCueMiss(e) {
  const ob = e.ob, r = e.who, vi = viewOf(r);
  giongoAt({ jump: 'gatsun', crouch: 'gochin', dodge: 'dogo', banzai: 'bofu', hand: 'boyon' }[ob.base], r);
  vcam(vi).shake('stumble');
  App.c3d.obs.mark(ob, false);
  if (ob.base === 'jump' || ob.base === 'crouch' || ob.base === 'dodge') App.c3d.obs.wobble(ob, 1);
  if (ob.base === 'dodge') FX.puffCartoon(headPos(r).add(_v2.set(0, -0.4, -0.3)));
  if (ob.base === 'banzai') App.c3d.obs.tearPaper(ob, false);
  if (ob.base === 'hand') App.c3d.obs.ballResult(ob, r, false);
  if (ob.base === 'dodge') sayZ('z_ouch'); else if (Math.random() < 0.34) sayZ('z_donmai');
  HUD.cueFail(vi);
}
function onWindup(e) {
  if (!e.to.isPlayer) return;
  Giongo.show('gira', headPos(e.from).add(_v2.set(0, 0.3, 0)), { size: 's', view: viewOf(e.to) });
  if (App.t - (App.windSaidT || -9) > 3) { App.windSaidT = App.t; sayV(e.kind === 'arm' ? 'g_crouch' : 'g_jump', { cue: true }); }
}
function onJamaHit(e) {
  const a = e.from, b = e.to;
  if (a.isPlayer) {
    const word = e.kind === 'arm' ? 'donHit' : 'zute';
    if (!(e.cut && Giongo.cutin('jamaHit', a, { word, face: 'happy', view: viewOf(a) }))) giongoAt(word, b, { view: viewOf(a) });
    FX.hitSparks(headPos(b).add(_v2.set(0, -0.5, 0)));
    if (App.hitN = (App.hitN || 0) + 1, App.hitN % 2 === 1) sayZ('z_jama');
    flash(0.25, 0.08);
  } else if (b.isPlayer) {
    giongoAt(e.kind === 'arm' ? 'dogo' : 'zuteGot', b);
    FX.hitSparks(headPos(b).add(_v2.set(0, -0.5, 0)));
    vcam(viewOf(b)).shake('jamaGot'); flash(0.35, 0.08);
    sayZ('z_jamaGot');
  } else if (rivalVisible(b)) {
    giongoAt(e.kind === 'arm' ? 'donHit' : 'zute', b, { size: 's', rival: true });
    if (!App.fightSaid && anyPlayerNear(b, 30)) { App.fightSaid = true; sayZ('z_fight'); }
  }
}
function onJamaDodge(e) {
  const a = e.from, b = e.to;
  if (b.isPlayer) {
    const word = e.kind === 'arm' ? 'suka' : 'hyoi';
    if (!(e.cut && Giongo.cutin('jamaDodge', b, { word, face: 'happy', view: viewOf(b) }))) giongoAt(word, b);
    sayZ('z_jamaDodge');
  } else if (a.isPlayer) giongoAt('suka', b, { size: 's' });
  else if (rivalVisible(b)) giongoAt('sukaS', b, { size: 's', rival: true });
}
function onFinish(e) {
  const r = e.who, race = App.race;
  if (!r.isPlayer) { if (e.rank === 1) setTimeout(() => sayZ('z_win_' + r.char), 600); App.cheer = Math.max(App.cheer, 0.6); return; }
  const vi = viewOf(r);
  Giongo.cutin('goal', r, { word: e.rank === 1 ? 'dodon' : 'goal', face: e.rank <= 3 ? 'happy' : 'effort', rankText: `ゴール！ ${e.rank}い！`, view: vi });
  sayV('r_goal'); setTimeout(() => sayV('r_rank' + e.rank), 900);
  setTimeout(() => { if (App.race === race && App.views.length) vcam(vi).finish(r); }, 450);
  if (e.rank === 1) {
    const c3d = App.c3d;
    for (const c of c3d.goal.cannons) { const p = c.position.clone().add(_v2.set(0, 1.2, 0)); FX.confetti(p, Math.round(CFG.fx.CONFETTI_GOAL / 4), 1, 1, { x: -c.position.x * 0.5, y: 9, z: 1, spread: 3 }); }
    Audio.play('confetti'); Audio.play('cheer');
    for (let i = 0; i < 6; i++) setTimeout(() => FX.firework(new V3((Math.random() - 0.5) * 50, c3d.H(race.L) + 45 + Math.random() * 15, -(race.L + 25 + Math.random() * 30)), ['ball', 'heart', 'star'][i % 3]), 900 + i * 450);
  }
  if (App.c3d.scenery) App.c3d.scenery.cheer(4);
  App.cheer = 1.5;
  setTimeout(() => { if (App.race === race) Audio.music(e.rank === 1 ? 'goalWin' : 'goalPlay'); }, 1000);
  if (race.players.every(p => p.finished)) { App.state = 'finish'; App.goalAt = App.t; $('btnPause').classList.remove('on'); $('touch').classList.remove('on'); $('vignette').classList.remove('final'); }
}
// 足音と 土けむり
function surfOf(r) {
  const b = App.c3d.c.biome;
  if (b === 'beach' && r.d > 2.6) return 'wet';
  return b;
}
function onFootstep(r) {
  const spd = clamp(r.v / CFG.run.V_MAX, 0, 1.2);
  const near = r.isPlayer || nearCam(r, 32);
  if (near && Math.random() < (r.isPlayer ? 1 : 0.6)) {
    const foot = footPos(r, _v); foot.x += (r.phase < 0.5 ? 0.11 : -0.11);
    FX.footDust(foot, surfOf(r), spd, CHARS[r.char].kart);
    if (App.race.onIce(r)) FX.glowPuff(foot, [0.8, 0.95, 1], 0.5);
  }
  if (r.isPlayer) Audio.play('step', { k: spd, surf: App.c3d.c.biome, v: 1, pan: App.race.two ? (r.who ? 0.5 : -0.5) : null });
  else if (anyPlayerNear(r, CFG.audio.RIVAL_STEP_R) && Math.random() < 0.5) Audio.play('rivalStep', { k: spd, surf: App.c3d.c.biome, pan: panOf(r) });
}

// ---------- 見た目（ランナー・効果） ----------
let shadowT = 0;
function updateRunners(race, dt, dtReal) {
  const R = CFG.race, gate = race.phase === 'gate';
  shadowT -= dtReal;
  const doShadow = shadowT <= 0 && CFG.quality[World.quality].shadow > 0; if (doShadow) shadowT = 0.5;
  const camPos = World.camera.position;
  race.runners.forEach(r => {
    const g = r.rig; if (!g) return;
    const w = race.jama && race.jama.wind.find(x => x.from === r);
    const windup = w ? 'windup' + (w.kind === 'arm' ? 'Arm' : 'Leg') + (w.side > 0 ? 'R' : 'L') : null;
    let mode = null;
    if (gate) mode = race.gateT > R.SET_T ? 'set' : race.gateT > R.READY_T ? 'ready' : null;
    else if (r.finished) mode = r.rank <= 3 ? (r.v > 1 ? null : 'cheer') : (r.v < 1 ? 'tired' : null);
    if (r.ghostT > 0) r.ghostT -= dt;
    const spd = r.v / CFG.run.V_MAX;
    const ghost = r.isPlayer && !r.finished && (spd > CFG.fx.AFTER_FROM || r.ghostT > 0);
    const mirror = r.isPlayer && App.inputMode === 'cam' ? Detector.players[r.who] : null;
    g.update(r, dt, App.t, race.H, { windup, mode, cheer: r.finished && r.rank <= 3, ghost, mirror });
    if (r.finished && r.rank <= 3 && r.v > 1) { /* 両手を あげて 走る */ g._h && 0; }
    // カメラと 自分の あいだの ライバルは うすく
    if (!r.isPlayer) {
      let want = 1;
      for (const v of App.views) {
        const c = v.cam.cam.position, camS = -c.z, dz = r.s - camS, lat = Math.abs(r.d - c.x);
        if (dz > -0.6 && r.s < v.runner.s - 0.6 && lat < 1.7) want = Math.min(want, lerp(0.3, 1, smoothstep(0.9, 1.7, lat)) + (dz > 3.5 ? 0.25 : 0));
      }
      g.fadeA = damp(g.fadeA ?? 1, Math.min(1, want), 0.08, dtReal);
      g.setFade(g.fadeA);
    }
    // 名前の 札
    if (g.tag) { const d = Math.hypot(camPos.x - r.d, camPos.z + r.s); g.tag.visible = !gate && d < CFG.hud.TAG_FAR && (d > CFG.hud.TAG_HIDE || race.two); g.tag.material.opacity = d < CFG.hud.TAG_NEAR ? 0.55 : 1; }
    // 影（アバターと 20m 以内）
    if (doShadow) g.setShadow(r.isPlayer || race.players.some(p => Math.abs(p.s - r.s) < 20));
    // 炎の オーラ
    if (g.aura) {
      const fin = race.inFinal(r.s) && !r.finished, a = fin ? smoothstep(CFG.fx.AURA_SWING, 1, r.spurt) * 0.9 : 0;
      g.auraA = damp(g.auraA || 0, a, 0.15, dt);
      g.aura.visible = g.auraA > 0.02; g.aura.material.uniforms.uA.value = g.auraA;
      g.aura.position.y = -g.hip;
      if (g.auraA > 0.2 && Math.random() < dt * 30) FX.embers(footPos(r, _v), CHARS[r.char].kart);
    }
    // よぞらの 光の すじ
    if (g.trails) for (let i = 0; i < 2; i++) { const L2 = g.c.leg[i]; L2.foot.getWorldPosition(_v); g.trails[i].push(_v); }
  });
  // 風の すじ（アバターの まわり）
  for (const v of App.views) { const r = v.runner; if (!r.finished && !gate) FX.windStreaks(headPos(r, _v).add(_v2.set(0, -1.0, 0)), r.v, dt, App.views.length > 1 ? 0.6 : 1); }
}

// ---------- 一時停止（付録CU） ----------
function pause(kind) {
  const race = App.race; if (!race || App.paused || !isRacing()) return;
  App.paused = true; App.pauseKind = kind; document.body.classList.add('paused');
  Audio.musicVolume(0.35); Audio.silenceLoops();
  if (kind === 'lost') { Screens.pauseLost(race.two, () => quitRace()); sayV(race.two ? 'm_lost2' : 'm_lost'); }
  else { Screens.pauseMenu(() => resume(), () => { unpause(); go('intro'); }, () => quitRace()); sayV('m_pause'); }
}
function unpause() { document.body.classList.remove('paused'); App.paused = false; Screens.hideAll(); Audio.musicVolume(1); HUD.count(0); }
function resume() {
  Screens.hideAll(); App.pauseKind = 'count';
  const steps = ['2', '1'];
  let i = 0;
  const next = () => {
    if (!App.paused) return;
    if (i >= steps.length) { HUD.count(0); unpause(); sayV('r_resume'); return; }
    HUD.count(steps[i]); Audio.play('beep'); sayV('n' + steps[i]); i++;
    setTimeout(next, 800);
  };
  next();
}
function quitRace() { unpause(); go('title'); }
$('btnPause').onclick = () => pause('menu');
Detector.players.forEach((B, i) => {
  B.on('lost', () => { if (Detector.mode === 'cam' && App.race && isRacing() && App.race.players.some(p => p.who === i) && App.state !== 'finish') pause('lost'); });
  B.on('found', () => { if (App.paused && App.pauseKind === 'lost' && App.race && App.race.players.every(p => !Detector.players[p.who].isLost)) resume(); });
});

// ---------- ゴールの あと（付録CW） ----------
function afterGoal() {
  const race = App.race, ft = App.t - App.goalAt;
  // 2秒から プレイヤーの まわりを 回るのは カメラの 'finish' が する
  // 3秒：けっかへの 案内
  if (ft > 3 && !App.nextTip) {
    App.nextTip = true;
    const m = App.inputMode;
    $('hNext').innerHTML = (m === 'cam' ? picSVG('banzai') + 'りょうてを あげて' : m === 'touch' ? picSVG('hand') + 'タップで' : 'エンターで') + ' けっかへ';
    $('hNext').classList.add('on');
  }
  const ok = ft > 3 && (Input.take('ok') || Input.take('bodyOk') || Input.take('tap') || Input.players.some(p => p.has('banzai')));
  if (ok || (ft > CFG.race.FINISH_WAIT && race.phase === 'done') || ft > CFG.race.FINISH_WAIT + 1.5) {
    if (race.phase !== 'done') { race.rescueRest(); race.phase = 'done'; }
    go('result');
  }
}

// ---------- けっか（付録AJ、7.15） ----------
function showResult() {
  const race = App.race; if (!race) { go('title'); return; }
  HUD.show(false); HUD.clearLines(); $('touch').classList.remove('on'); $('btnPause').classList.remove('on'); $('hNext').classList.remove('on');
  document.body.classList.remove('racing'); $('vignette').classList.remove('final');
  const c = App.c3d.c, d = DISTS.find(x => x.m === race.L) || DISTS[1], df = DIFFS.find(x => x.id === race.diff);
  const list = race.finishOrder.slice();
  for (const r of race.runners) if (!list.includes(r)) list.push(r);
  const cam = App.inputMode === 'cam';
  // 1人用の さいこう きろく
  let best = false;
  const me = race.players[0];
  if (!race.two && me.finished && !me.rescued) best = Save.setBest(c.id, d.id, race.diff, { time: me.finishTime, char: me.char, at: Date.now(), cam });
  const st = race.players.map((p, i) => {
    const s0 = App.stats0[i], B = Detector.players[p.who];
    const steps = cam ? B.steps - s0.steps : Input.players[p.who].steps - s0.isteps;
    return { ...p.stats, p, steps, jumps: cam ? B.jumps - s0.jumps : p.stats.jump[1], topKmh: Math.round(p.stats.topV * 3.6), ok: p.stats.ok, all: p.stats.ok + p.stats.miss };
  });
  for (const s of st) Save.addTotals({ steps: s.steps, jumps: s.jumps, seconds: Math.round(s.p.finishTime || race.time), rank: s.p.rank });
  const rows = list.map((r, i) => ({
    name: CHARS[r.char].name, face: App.portraits[r.char] ? App.portraits[r.char][i === 0 ? 'happy' : 'normal'] : '',
    you: r.isPlayer ? (race.two ? (r.who ? '（2P）' : '（1P）') : '（あなた）') : '', cls: r.isPlayer ? (race.two ? 'p' + (r.who + 1) : 'you') : '',
    time: fmtTime(r.finishTime) + (r.rescued ? '<small>?</small>' : ''), best: r === me && best
  }));
  const pic = n => picSVG(n);
  const col = s => `<div><div class="st">${pic('run')}<span class="lb">さいこうそく</span><b data-n="${s.topKmh}" data-suf="km/h">${s.topKmh}km/h</b></div>
    <div class="st">${pic('jump')}<span class="lb">あいず</span><b>${s.ok}/${s.all}</b></div>
    <div class="st">${pic('hurdle')}<span class="lb">ジャンプ</span><b>${s.jump[0]}/${s.jump[1]}</b></div>
    <div class="st">${pic('dodgeR')}<span class="lb">よけ</span><b>${s.dodge[0]}/${s.dodge[1]}</b></div>
    <div class="st">${pic('squat')}<span class="lb">しゃがみ</span><b>${s.crouch[0]}/${s.crouch[1]}</b></div>
    <div class="st">${pic('handR')}<span class="lb">て</span><b>${s.hand[0]}/${s.hand[1]}</b></div>
    <div class="st">${pic('arrowR')}<span class="lb">ぬいた</span><b data-n="${s.passes}" data-suf="かい">${s.passes}かい</b></div>
    <div class="st">${pic('foot')}<span class="lb">あしぶみ</span><b data-n="${s.steps}" data-suf="歩">${s.steps}歩</b></div>
    ${race.mode === 'jama' ? `<div class="st">${pic('armR')}<span class="lb">じゃま</span><b>した ${s.jamaHit}／された ${s.jamaGot}／よけた ${s.jamaDodge}</b></div>` : ''}</div>`;
  const ROWS = [['run', 'さいこうそく', s => s.topKmh + 'km/h'], ['jump', 'あいず', s => `${s.ok}/${s.all}`], ['hurdle', 'ジャンプ', s => `${s.jump[0]}/${s.jump[1]}`], ['dodgeR', 'よけ', s => `${s.dodge[0]}/${s.dodge[1]}`],
    ['squat', 'しゃがみ', s => `${s.crouch[0]}/${s.crouch[1]}`], ['handR', 'て', s => `${s.hand[0]}/${s.hand[1]}`], ['arrowR', 'ぬいた', s => s.passes + 'かい'], ['foot', 'あしぶみ', s => s.steps + '歩']];
  const table2 = () => `<table><tr><th></th><th class="p1">1P</th><th class="p2">2P</th></tr>${ROWS.map(([pc, lb, f]) => `<tr><td class="lb">${pic(pc)}${lb}</td><td>${f(st[0])}</td><td>${f(st[1])}</td></tr>`).join('')}</table>`;
  const statsHTML = race.two ? `<h3>きょうの はしり</h3>${table2()}` : `<h3>きょうの はしり</h3>${col(st[0])}`;
  const win = race.two ? (race.players[0].rank < race.players[1].rank ? '1P の かち！' : '2P の かち！') : '';
  const again = () => { const f = () => go('intro'); maybeRest(f); };
  const buttons = race.two
    ? [{ text: 'もういちど', fn: again }, { text: 'キャラを えらぶ', fn: () => maybeRest(() => go('char', { pick: 0 })) }, { text: 'タイトルへ', fn: () => maybeRest(() => go('title')) }]
    : [{ text: 'もういちど', fn: again }, { text: 'コースを えらぶ', fn: () => maybeRest(() => go('course')) }, { text: 'タイトルへ', fn: () => maybeRest(() => go('title')) }];
  Screens.result(`けっか　${c.name}・${d.name}・${df.name}`, rows, statsHTML, buttons, win);
  if (d.id === 'long') App.restDue = Save.noteLong();
  // 背景：ゴールの 先で よろこぶ
  const order = list.map(r => r.char);
  for (const g of App.rigs) { World.scene.remove(g.root); if (g.ghostRoot) World.scene.remove(g.ghostRoot); }
  Stages.result(App.c3d, order);
  App.views = [];
  document.body.classList.remove('two');
  Audio.music('result');
  setTimeout(() => {
    if (App.state !== 'result') return;
    const myRank = me.rank;
    if (race.two) { sayV(race.players[0].rank < race.players[1].rank ? 'r_win1' : 'r_win2'); setTimeout(() => sayZ(race.players[0].rank < race.players[1].rank ? 'z_win1' : 'z_win2'), 1500); }
    else if (best) Audio.say('z_best', 3);
    else if (race.mode === 'jama' && myRank === 1 && me.stats.jamaHit === 0) Audio.say('z_kind', 3);
    else Audio.say(myRank === 1 ? 'z_res1' : myRank <= 3 ? 'z_res23' : 'z_res4', 3);
    FX.confetti(Stages.center.clone().add(new V3(0, 0, 0)), 120, 4, 5);
  }, (list.length * 0.12 + 0.4) * 1000);
}
function maybeRest(f) { if (App.restDue && !App.restDone) { App.restDue = false; App.afterRest = f; go('rest'); } else f(); }

// ---------- れんしゅう（付録AI、7.5） ----------
const P = CFG.prep;
function shiftTest(side) {
  return (B, st, dt) => {
    if (!st.out) {
      st.t = Math.sign(B.shiftNorm) === side && Math.abs(B.shiftNorm) >= P.SHIFT_ON ? (st.t || 0) + dt : 0;
      st.k = Math.min(0.5, (st.t || 0) / P.SHIFT_ON_T * 0.5);
      if (st.t >= P.SHIFT_ON_T) { st.out = true; st.t = 0; sayV('p_center'); $('prepText').textContent = 'まんなかに もどって'; }
      return false;
    }
    st.t = B.shiftNorm === 0 ? st.t + dt : 0; st.k = 0.5 + Math.min(0.5, st.t / P.CENTER_T * 0.5);
    return st.t >= P.CENTER_T;
  };
}
const PREP_STEPS = [
  { pic: 'cam', text: 'カメラに うつってね', voice: 'm_lost', test: (B, st, dt) => (st.t = B.seen && B.headOk && B.anklesOk ? (st.t || 0) + dt : 0) >= P.SEEN_T, prog: st => (st.t || 0) / P.SEEN_T,
    hint: B => !B.seen ? null : !B.anklesOk ? ['もうすこし はなれてね', 'p_far'] : !B.headOk ? ['カメラを すこし うえに むけてね', 'p_up'] : null, pass: B => B.recenter() },
  { pic: 'run', text: 'その場で あしぶみ！', voice: 'p_step', test: (B, st, dt) => (st.t = (st.t || 0) + (B.throttle > P.STEP_TH ? dt : 0)) >= P.STEP_T, prog: st => (st.t || 0) / P.STEP_T },
  { pic: 'jump', text: 'ジャンプ！', voice: 'g_jump', event: 'jump' },
  { pic: 'squat', text: 'しゃがんで！', voice: 'g_crouch', event: 'squat' },
  { pic: 'dodgeR', text: 'みぎに ずれて！', voice: 'p_right', test: shiftTest(1), prog: st => st.k || 0, hold: true },
  { pic: 'dodgeL', text: 'ひだりに ずれて！', voice: 'p_left', test: shiftTest(-1), prog: st => st.k || 0, hold: true },
  { pic: 'banzai', text: 'りょうてを あげて！', voice: 'p_banzai', event: 'banzai', hold: true },
  { pic: 'handR', text: 'みぎてを あげて！', voice: 'p_handR', event: 'handR', hold: true },
  { pic: 'handL', text: 'ひだりてを あげて！', voice: 'p_handL', event: 'handL', hold: true }
];
const Prep = {
  start(first) {
    this.first = !!first; this.i = 0; this.okT = 0; this.ev = {}; this.active = true;
    $('prepSteps').innerHTML = PREP_STEPS.map((s, i) => `<div class="prepDot">${i + 1}</div>`).join('');
    const slot = $('prepMirrorSlot'); slot.innerHTML = ''; this.cv = document.createElement('canvas'); slot.appendChild(this.cv);
    Screens.open('scrPrep', { onOk: i => i === 0 ? this.skip() : this.leave(), onBack: () => this.leave(), backBtn: false, help: false });
    App.bodyEvent = (ev) => { if (App.state === 'prep') this.ev[ev] = true; };
    this.show();
  },
  leave() { this.active = false; App.bodyEvent = null; go(this.first ? 'title' : 'title'); },
  show() {
    const s = PREP_STEPS[this.i];
    [...$('prepSteps').children].forEach((d, k) => { d.className = 'prepDot' + (k < this.i ? ' done' : k === this.i ? ' now' : ''); });
    $('prepPic').innerHTML = picSVG(s.pic); $('prepText').textContent = s.text; $('prepText').className = ''; $('prepBar').style.width = '0%';
    $('prepNote').textContent = ''; $('prepSkip').classList.remove('glow');
    this.st = {}; this.stepT = 0; this.ev = {}; this.hintT = 0;
    Stages.hold = !!s.hold;
    sayV(s.voice);
  },
  update(dt) {
    if (App.state !== 'prep' || !this.active) return;
    const B = Detector.players[0];
    if (this.cv) drawMirror(this.cv, $('camVideo'), [B]);
    if (this.okT > 0) { this.okT -= dt; if (this.okT <= 0) this.next(); return; }
    const s = PREP_STEPS[this.i]; if (!s) return;
    this.stepT += dt;
    let pass = false;
    if (s.event) pass = !!this.ev[s.event];
    else { pass = s.test(B, this.st, dt); $('prepBar').style.width = (clamp(s.prog(this.st), 0, 1) * 100) + '%'; }
    if (s.hint) { const h = s.hint(B); if (h) { this.hintT += dt; $('prepNote').textContent = h[0]; if (this.hintT > 2.5) { this.hintT = -4; sayV(h[1]); } } else $('prepNote').textContent = B.seen ? '' : 'カメラに うつってね'; }
    if (this.stepT > P.SKIP_GLOW) $('prepSkip').classList.add('glow');
    if (pass) {
      s.pass && s.pass(B);
      $('prepText').textContent = 'できた！'; $('prepText').className = 'ok'; $('prepBar').style.width = '100%';
      Giongo.show('pita', { sx: 0.5, sy: 0.55 }); Audio.say('z_ok', 4); Audio.play('menuOk');
      this.okT = P.OK_SHOW;
    }
  },
  next() { this.i++; if (this.i >= PREP_STEPS.length) { this.done(); return; } this.show(); },
  skip() { if (this.i < PREP_STEPS.length) this.next(); },
  done() {
    Save.data.prep.done = true; Save.data.prep.at = Date.now(); Save.save();
    $('prepPic').innerHTML = picSVG('banzai'); $('prepText').textContent = 'じゅんび OK！ さあ、はしろう！'; $('prepText').className = 'ok';
    sayV('p_done');
    this.i = PREP_STEPS.length; this.okT = 99;
    setTimeout(() => { if (App.state === 'prep') { this.active = false; App.bodyEvent = null; go('title'); } }, P.DONE_SHOW * 1000);
  }
};

// ---------- ふたりの じゅんび（7.7） ----------
const TwoPrep = {
  start() {
    this.t = 0; this.done = false;
    const slot = $('twoMirrorSlot'); [...slot.querySelectorAll('canvas')].forEach(c => c.remove());
    this.cv = document.createElement('canvas'); slot.prepend(this.cv);
    Screens.two('ふたりで ならんで、1m あけて たってね。<br>ひだりの ひとが 1P、みぎの ひとが 2P', () => go('title'));
    sayV('m_two');
    if (!Stages.root) Stages.title(App.c3d);
  },
  update(dt) {
    if (App.state !== 'two' || this.done) return;
    const [A, B] = Detector.players;
    drawMirror(this.cv, $('camVideo'), [A, B], { two: true, w: 900 });
    const okA = A.seen && A.hipX < 0.55, okB = B.seen && B.hipX > 0.45;
    const slot = $('twoMirrorSlot'); slot.querySelector('.h1').classList.toggle('ok', okA); slot.querySelector('.h2').classList.toggle('ok', okB);
    const near = okA && okB && Math.abs(B.hipX - A.hipX) * (A.asp || 4 / 3) / Math.max(0.05, (A.u + B.u) / 2) < CFG.body.TWO_MIN_GAP;
    if (near) Screens.twoText('もうすこし はなれて たってね');
    this.t = okA && okB && !near ? this.t + dt : 0;
    if (this.t >= 1.0) { this.done = true; Screens.twoText('OK！'); Audio.play('pita'); setTimeout(() => go('char', { pick: 0 }), 700); }
  }
};

// ---------- じゃまの れんしゅう（7.12） ----------
const JAMA_STEPS = [['armR', 'みぎに てを だして！', 'jp_armR', 1], ['armL', 'ひだりに てを だして！', 'jp_armL', -1], ['legR', 'みぎに あしを だして！', 'jp_legR', 1], ['legL', 'ひだりに あしを だして！', 'jp_legL', -1]];
const JamaPrep = {
  start() {
    this.i = 0; this.active = true;
    Stages.prep(App.c3d, App.chars[0], Detector.players[0], true);
    App.bodyEvent = (ev) => {
      if (!this.active || App.state !== 'jama') return;
      const s = JAMA_STEPS[this.i]; if (!s || ev !== s[0]) return;
      const g = Stages.hitDummy(s[3]);
      Giongo.show(ev.startsWith('arm') ? 'donHit' : 'zute', g ? g.getWorldPosition(new V3()).add(_v2.set(0, 1.2, 0)) : null);
      this.i++;
      if (this.i >= JAMA_STEPS.length) { Screens.jamaStep('banzai', 'できた！ さあ、はじめよう！'); Audio.say('z_ok', 4); this.active = false; App.bodyEvent = null; }
      else setTimeout(() => this.show(), 700);
    };
    this.show();
  },
  show() { const s = JAMA_STEPS[this.i]; Screens.jamaStep(s[0], s[1] + '（すこし だせば いいよ）'); sayV(s[2]); }
};

// ---------- 鏡（5.7） ----------
function updateMirror() {
  if (Detector.mode !== 'cam') return;
  const two = App.mode === 'two' && App.race && App.race.two;
  const show = !['prep', 'gate', 'two', 'boot'].includes(App.state) && !(App.state === 'jama' && JamaPrep.active);
  $('mirror').classList.toggle('on', show);
  if (!show) return;
  const players = two ? Detector.players.slice(0, 2) : [Detector.players[0]];
  drawMirror($('mirrorCv'), $('camVideo'), players, { two });
  const lost = players.some(B => !B.seen);
  $('mirrorBox').classList.toggle('lost', lost);
  const tip = $('mirrorTip'); tip.textContent = lost ? 'うつってね' : ''; tip.style.display = lost ? 'block' : 'none';
  const B = players[0];
  $('mirrorShift').querySelector('b').style.left = (50 + clamp(B.shiftNorm || 0, -1, 1) * 42) + '%';
  const cue = App.race && App.race.cueOf(App.race.players[0]);
  $('mirrorShift').querySelector('i').className = cue && cue.base === 'dodge' ? (cue.side === 'R' ? 'goR' : 'goL') : '';
}

// ---------- タッチの うごきボタン（4.13.2） ----------
const ACT_LABEL = { jump: ['jump', 'ジャンプ'], crouch: ['squat', 'しゃがむ'], dodgeR: ['arrowR', 'よける'], dodgeL: ['arrowL', 'よける'], banzai: ['banzai', 'バンザイ'], handR: ['handR', 'みぎて'], handL: ['handL', 'ひだりて'], spurt: ['swing', 'れんだ！'] };
function updateTouchUI() {
  if (!$('touch').classList.contains('on') || !App.race) return;
  const k = Input.actKind(), race = App.race, me = race.players[0];
  if (k !== App.actKind) { App.actKind = k; const [p, t] = ACT_LABEL[k] || ACT_LABEL.jump; $('tActPic').innerHTML = picSVG(p); $('tActText').textContent = t; }
  const cue = race.cueOf(me), jw = race.jama && race.jama.windFor(me);
  $('tAct').classList.toggle('cue', !!(cue || jw || (race.inFinal(me.s) && !me.finished)));
  if (race.mode === 'jama') { const [l, r] = race.jama.sidesOf(me); const on = !!(l || r); $('tJamaArm').classList.toggle('on', on); $('tJamaLeg').classList.toggle('on', on); }
}
Input.onFoot = foot => {
  const el = $(foot === 'L' ? 'tFootL' : 'tFootR'), r = el.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'footPop'; d.innerHTML = picSVG('foot'); d.style.left = (r.left + r.width / 2 - 30) + 'px'; d.style.top = (r.top + 10) + 'px';
  if (foot === 'L') d.style.transform = 'scaleX(-1)';
  document.body.appendChild(d); setTimeout(() => d.remove(), 420);
};
$('tFootL').innerHTML = picSVG('foot') + '<span>あし</span>'; $('tFootR').innerHTML = picSVG('foot') + '<span>あし</span>';
$('tActPic').innerHTML = picSVG('jump');
// 紹介を タップで とばす
$('gl').addEventListener('pointerdown', () => { if (App.state === 'intro') toStart(); else if (App.state === 'finish') Input.queue.push('tap'); });

// ---------- 画面の 白い光 ----------
let flashT = 0, flashA = 0, flashLen = 0.08;
function flash(a, sec) { flashA = Math.max(flashA, a); flashT = sec; flashLen = sec; }

// ---------- 画面の 大きさ（7.1） ----------
function fit() {
  const W = innerWidth, H = innerHeight, portrait = H > W;
  document.body.classList.toggle('portrait', portrait);
  const bw = portrait ? 720 : 1280, bh = portrait ? 1280 : 720;
  const k = Math.min(W / bw, H / bh, 2);
  const st = document.documentElement.style;
  st.setProperty('--k', String(k));
  st.setProperty('--uw', Math.max(bw, Math.round(W / k)) + 'px');
  st.setProperty('--uh', Math.max(bh, Math.round(H / k)) + 'px');
  const two = App.mode === 'two' && ['two', 'char', 'course', 'dist', 'diff', 'intro', 'start', 'race', 'finish'].includes(App.state);
  document.body.classList.toggle('needLand', two && portrait);
  if (two && portrait && isRacing() && !App.paused) pause('menu');
  syncSens();
  if (App.views.length === 1 && !App.race?.two) MainCam.setKind(portrait ? 'portrait' : 'land');
  layoutViews();
  if (Stages.mode === 'prep') Stages.placeCam();
  if (Stages.mode === 'char' && App.c3d) { const s = Stages.sel; Stages.charSelect(App.c3d, s, Stages.taken); }
}
addEventListener('resize', () => setTimeout(fit, 60)); fit();
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => setTimeout(fit, 150));
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------- 1コマ（付録AH） ----------
let last = performance.now(), loopPaused = false;
function frame(dtReal, ts) {
  App.t += dtReal;
  if (Detector.mode === 'cam' && Detector.tick(ts)) updateMirror();
  const racing = isRacing();
  const menu = !racing || App.paused;
  // れんしゅうでは しゃがむ・バンザイが 手順なので、からだの メニュー操作（もどる・けってい）を 止める
  const bodyMenu = !['intro', 'prep'].includes(App.state) && !(App.state === 'jama' && JamaPrep.active);
  Input.update(dtReal, menu && bodyMenu);
  if (!menu && Input.take('pause')) { pause('menu'); Input.take('back'); }
  if (menu && !App.busy) Screens.update(dtReal);
  if (App.state === 'intro' && !App.busy && (App.t >= App.introEnd || Input.take('ok') || Input.take('bodyOk') || Input.players[0].has('banzai'))) toStart();
  if (App.state === 'finish' && !App.busy) afterGoal();
  Prep.update(dtReal); TwoPrep.update(dtReal);
  if (!menu) for (const n of ['menuL', 'menuR', 'ok', 'back', 'tap', 'bodyOk']) Input.take(n);
  // スロー（カットイン）と 写真判定
  App.timeK = damp(App.timeK, App.timeTarget, App.timeTau, dtReal);
  let dt = dtReal * App.timeK;
  const race = App.race;
  if (App.photo && race) {
    if (App.photoT === 0) { document.body.classList.add('photo'); HUD.photo(true); flash(0.6, 0.1); Audio.play('tick'); sayV('r_photo'); setTimeout(() => sayZ('z_photo'), 300); }
    App.photoT += dtReal; dt = 0;
    if (App.photoT > CFG.race.PHOTO_T) { App.photo = null; App.photoT = 0; document.body.classList.remove('photo'); HUD.photo(false); }
  }
  if (race && !App.paused && racing && dt > 0) {
    App.acc += dt; let n = 0;
    while (App.acc >= 1 / 120 && n++ < 8) {
      if (App.auto) { App.auto.think(1 / 120, Input.players); for (const p of Input.players) if (p.auto) { p.th = p.auto.th || 0; p.shiftNorm = p.auto.shift || 0; p.crouch = !!p.auto.crouch; p.swing = p.auto.swing || 0; } }
      race.update(1 / 120, Input.players); App.acc -= 1 / 120;
    }
    if (n >= 8) App.acc = 0;
    handleEvents(race);
    if (race.phase === 'gate' && !race.waitSeen()) HUD.big('カメラに うつってね', '', 0);

  }
  // 見た目
  const c3d = App.c3d;
  if (race && App.views.length) {
    updateRunners(race, dt, dtReal);
    for (const v of App.views) v.cam.update(dtReal, { runner: v.runner, H: c3d.H, race });
    if (racing) HUD.update(race, dtReal, App.t, App.views.map(v => v.rect));
    updateTouchUI();
    if (App.warmT) { App.warmT = Math.min(1, App.warmT + dtReal / 6); World.setWarm(App.warmT); }
  } else MainCam.update(dtReal, {});
  Stages.update(dtReal, App.t);
  FX.update(dt, World.camera);
  Giongo.update();
  World.update(dt);
  if (c3d) {
    const v0 = App.views[0], v1 = App.views[1];
    const camS = v0 ? Math.min(v0.runner.s, -World.camera.position.z) : -World.camera.position.z;
    const ps = race ? race.players[0].s : camS;
    c3d.update(dt, App.t, race, { camS, camS2: v1 ? v1.runner.s : undefined, cam: World.camera, viewH: v1 ? innerHeight : innerHeight,
      hide: App.views.map(v => ({ c: -v.cam.cam.position.z, p: v.runner.s })),
      nearRunner: (x, s, r) => race ? race.runners.some(o => Math.abs(o.s - s) < r && Math.abs(o.d - x) < r) : false, playerS: ps, final: race ? race.inFinal(race.players[0].s) : false });
    // 観客の 声・花火・けむり
    if (race) {
      const me = race.players[0], dStart = me.s, dGoal = Math.abs(race.L - me.s);
      App.cheer = Math.max(0, App.cheer - dtReal * 0.3);
      Audio.crowd(clamp(1 - Math.min(dStart, dGoal) / 90, 0, 1) * 0.6 + App.cheer * 0.4);
      if (racing && !App.paused) Audio.updateLoops(clamp(me.v / CFG.run.V_MAX, 0, 1.2), race.chaosOf(me), dtReal);
      const fw = c3d.scenery.fireworksAt;
      if (fw && racing && Math.abs(me.s - fw.s) < 400) { App.fireT -= dtReal; if (App.fireT <= 0) { App.fireT = race.inFinal(me.s) ? 2.5 + Math.random() * 2 : 6 + Math.random() * 5; const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) setTimeout(() => FX.firework(new V3(fw.x + (Math.random() - 0.5) * 80, fw.y + Math.random() * 20, -(fw.s + (Math.random() - 0.5) * 60)), ['ball', 'ball', 'heart', 'star'][Math.floor(Math.random() * 4)]), i * 350); } }
    }
    const sm = c3d.scenery.smokes;
    if (sm && sm.length) { App.smokeT -= dtReal; if (App.smokeT <= 0) { App.smokeT = 0.3; for (const s of sm) if (Math.abs(-s.z - (App.views[0] ? App.views[0].runner.s : 0)) < 250) FX.smoke(s); } }
  }
  Audio.ambTick(dtReal, App.t);
  if (Audio.ctx) $('audioTip').classList.toggle('on', Audio.ctx.state !== 'running' && App.state !== 'gate');
  // 白い 光
  if (flashT > 0) { flashT -= dtReal; $('flash').style.opacity = String(flashA * Math.max(0, flashT / flashLen)); if (flashT <= 0) { flashA = 0; $('flash').style.opacity = '0'; } }
  renderViews(dtReal);
  autoQuality(dtReal);
  if (DBG) dbgInfo();
}
// 描く（付録AH AH.2）
function renderViews(dtReal) {
  const R = World.renderer;
  if (App.views.length < 2) {
    if (App.views[0]) App.views[0].cam.apply(dtReal); else MainCam.apply(dtReal);
    const fp = App.views[0] ? App.views[0].runner : null;
    if (fp) World.followShadow(fp.d, App.c3d.H(fp.s), -fp.s); else if (Stages.center) World.followShadow(Stages.center.x, Stages.center.y, Stages.center.z);
    World.sky.position.copy(World.camera.position);
    FX.scale(World.camera);
    R.render(World.scene, World.camera);
    return;
  }
  const W = innerWidth, H = innerHeight;
  R.setScissorTest(true);
  App.views.forEach((v, i) => {
    const x = i * W / 2;
    R.setViewport(x, 0, W / 2, H); R.setScissor(x, 0, W / 2, H);
    v.cam.cam.aspect = (W / 2) / H; v.cam.cam.updateProjectionMatrix();
    v.cam.apply(dtReal);
    World.followShadow(v.runner.d, App.c3d.H(v.runner.s), -v.runner.s);
    World.sky.position.copy(v.cam.cam.position);
    R.render(World.scene, v.cam.cam);
  });
  R.setScissorTest(false); R.setViewport(0, 0, W, H);
  World.camera.aspect = W / H; World.camera.updateProjectionMatrix();
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
  if (avg < C.UP_MS && Detector.cost < C.UP_POSE_MS) qHighT += 0.5; else qHighT = 0;
  const order = ['low', 'mid', 'high'], i = order.indexOf(World.quality);
  if (qLowT >= C.DOWN_T && i > 0) { const q = order[i - 1]; World.setQuality(q); FX.setQuality(q); S._autoLevel = q; Save.save(); qLowT = 0; if (DBG) console.log('quality down', q); }
  if (qHighT >= C.UP_T && i < 2) { S._autoLevel = order[i + 1]; Save.save(); qHighT = 0; }
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
  // ?dbg&course=c1&dist=mid&diff=normal&mode=solo&auto=0.9&skip
  Audio.init(); Audio.unlock(); afterAudio();
  setMode(Q.get('input') || 'key');
  App.course = Q.get('course'); App.dist = Q.get('dist') || 'short'; App.diff = Q.get('diff') || 'normal'; App.mode = Q.get('mode') || 'solo';
  if (Q.get('char')) App.chars[0] = Q.get('char');
  App.state = 'intro';
  document.body.classList.toggle('two', App.mode === 'two');
  await ensureCourse(App.course, App.dist);
  newRace();
  if (Q.has('skip')) toStart();
  if (Q.has('auto')) App.auto = new AutoPlayer(Number(Q.get('auto')) || 0.9, App.race);
} else {
  App.state = 'boot';
  go('gate');
}

// ---------- ?dbg（付録AS） ----------
function dbgInfo() {
  const el = $('dbgInfo'); if (!el.dataset.on) return;
  const r = World.renderer.info.render, race = App.race, p = race ? race.players[0] : null;
  el.textContent = `fps ${(1000 / App.frameMs).toFixed(1)}  ms ${App.frameMs.toFixed(1)}  draw ${r.calls}  tri ${(r.triangles / 1000).toFixed(0)}k  q ${World.quality}\n`
    + `pose ${Detector.cost.toFixed(0)}ms  state ${App.state}` + (p ? `\ns ${p.s.toFixed(1)} d ${p.d.toFixed(2)} v ${p.v.toFixed(1)} h ${p.h.toFixed(2)} rank ${race.rankOf(p)} th ${Input.players[0].th.toFixed(2)} sh ${Input.players[0].shiftNorm.toFixed(2)}` : '');
}
if (DBG) {
  const api = {
    get ready() { return App.state !== 'boot' && !App.busy; },
    get race() { return App.race; },
    App, World, MainCam, Cam2, Detector, Input, Audio, FX, HUD, Save, THREE, CFG, Stages, Screens, Giongo, BodyState,
    state() {
      const r = App.race, me = r && r.players[0];
      return { app: App.state, phase: r && r.phase, time: r && +r.time.toFixed(2), s: me && +me.s.toFixed(1), d: me && +me.d.toFixed(2), v: me && +me.v.toFixed(2), h: me && +me.h.toFixed(2),
        pos: r && r.rankOf(me), cue: r && r.cues[0].cur && { type: r.cues[0].cur.type, stage: r.cues[0].cur.stage },
        order: r && r.order.map(k => k.char), fin: r && r.finishOrder.map(k => [k.char, +k.finishTime.toFixed(2)]) };
    },
    go: (n, o) => go(n, o),
    course: (id, dist) => ensureCourse(id, dist),
    step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) frame(dt, performance.now()); return this.state(); },
    run(sec) { for (let i = 0; i < Math.round(sec * 60); i++) frame(1 / 60, performance.now()); return this.state(); },
    sim(sec) {
      const r = App.race; if (!r) return this.state();
      if (App.state === 'intro') toStart();
      for (let i = 0; i < Math.round(sec * 120); i++) {
        if (App.auto) { App.auto.think(1 / 120, Input.players); for (const p of Input.players) if (p.auto) { p.th = p.auto.th || 0; p.shiftNorm = p.auto.shift || 0; p.crouch = !!p.auto.crouch; p.swing = p.auto.swing || 0; } }
        r.update(1 / 120, Input.players); handleEvents(r);
      }
      frame(1 / 60, performance.now()); return this.state();
    },
    toStart() { toStart(); return this.state(); },
    pause(v) { loopPaused = v; },
    input(o, who = 0) { Input.override = Input.override || {}; Input.override[who] = o; },
    auto(level) { App.auto = level == null ? null : new AutoPlayer(level, App.race); },
    warp(s) { const p = App.race.players[0]; p.s = s; p.d = 0; p.v = Math.max(p.v, 12); for (const v of App.views) v.cam.init = false; },
    finish() { this.warp(App.race.L - 15); },
    feed(lm, dt, t, who = 0) { Detector.players[who].feed(lm, dt, t); },
    feedTwo(L, dt, t) { Detector.numPoses = 2; Detector.feedAll(L, dt, t); },
    pose: (spec, t) => synthPose(spec, t),
    synthTwo: (a, b, t) => synthTwo(a, b, t),
    body: (who = 0) => { const B = Detector.players[who]; return { thr: +B.throttle.toFixed(3), shift: +B.shiftNorm.toFixed(3), swing: +B.swing.toFixed(3), crouch: B.crouch, air: B.air, seen: B.seen, lost: B.isLost, steps: B.steps, jumps: B.jumps, squats: B.squats, banzais: B.banzais, hands: B.hands, arms: B.arms, legs: B.legs2 }; },
    bodyReset: (who = 0) => { const B = Detector.players[who]; B.reset(); B.resetCounts(); },
    camMode() { Detector.mode = 'cam'; setMode('cam'); },
    giongo: (id, at) => Giongo.show(id, at || (App.views[0] ? headPos(App.views[0].runner) : null)),
    cutin: kind => Giongo.cutin(kind, App.views[0].runner, { word: { makuri: 'gyun', jamaHit: 'donHit', jamaDodge: 'suka', goal: 'dodon' }[kind], rankText: 'ゴール！ 1い！' }),
    obstacles: () => App.race.obstacles.map(o => ({ type: o.type, s: Math.round(o.s) })),
    quality: q => { World.setQuality(q); FX.setQuality(q); },
    view(s, d, h, ls, lh = 1) { const H = App.c3d.H; MainCam.setFixed(new V3(d, H(s) + h, -s), new V3(0, H(ls) + lh, -ls), 60); App.views = []; frame(1 / 60, performance.now()); },
    voice: id => Audio.say(id, 9), song: id => Audio.music(id), sfx: id => Audio.play(id),
    info(on = true) { const el = $('dbgInfo'); el.dataset.on = on ? '1' : ''; el.style.display = on ? 'block' : 'none'; return { calls: World.renderer.info.render.calls, tris: World.renderer.info.render.triangles }; },
    checkSongs, shot() { return World.renderer.domElement.toDataURL('image/png'); }
  };
  // MediaPipe の 中で dbg() を よぶので、よべる 関数に（第5部 5.1）
  window.dbg = Object.defineProperties((...a) => console.debug(...a), Object.getOwnPropertyDescriptors(api));
  window.dbg.info(true);
}
