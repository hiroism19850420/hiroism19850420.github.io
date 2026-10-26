// Phaser 側：状態管理、入力、筆跡、2D判定の可視化、HUD。3D は ThreeView に要求を送るだけ。
import { GAME, BAL, SHAPES, ATTACKS, DIFF, COLORS, FAIL_TEXT, QUALITY, STROKE, TUNE } from './config.js';
import { Battle } from './battle.js';
import { candidate, recognize, pathLength } from './recognizer.js';
import { Save } from './save.js';
import { Zen } from './zen.js';

const { VW, VH, AREA } = GAME;
const FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';
const HAND = '"Yomogi", "Zen Maru Gothic", sans-serif';
const PLAY_STATES = ['BATTLE', 'TUTORIAL', 'INTRO', 'PRACTICE'];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export class MainScene extends Phaser.Scene {
  constructor() { super('main'); }

  init() {
    this.ctl = this.registry.get('ctl');
    this.view = this.ctl.view;
    this.audio = this.ctl.audio;
    this.ui = this.ctl.ui;
  }

  create() {
    this.texts = [];
    this.textRes = 1;
    this.state = 'TITLE';
    this.battle = null;
    this.stroke = null;
    this.fading = [];
    this.ghosts = [];
    this.splashes = [];
    this.ripples = [];
    this.shots = [];
    this.triFx = [];
    this.cracks = [];
    this.dmgNums = [];
    this.claws = [];
    this.edgeHit = 0;
    this.inkFlash = 0;
    this.focusPulse = 0;
    this.bossBarLag = 1;
    this.msg = { text: '', t: 0 };
    this.bigText = { text: '', t: 0, dur: 1 };
    this.keptStrokes = [];
    this.tut = null;
    this.resumeT = 0;
    this.endT = 0;
    this.fpsAcc = { t: 0, n: 0, low: 0, suggested: false };
    this.recogFailCount = 0;
    this.clock = 0;          // 筆跡の時刻（?dbg の早送りでも 同じように進む）
    this.zenLock = false;    // 体のペン：線が途中で切られたら、左手を いちど下ろすまで 書かない
    this.zenPos = { x: 480, y: 330 };
    this.zenBot = null;
    this.gArea = this.add.graphics().setDepth(1);
    this.gKept = this.add.graphics().setDepth(1.5);
    this.gPaths = this.add.graphics().setDepth(2);
    this.gShapes = this.add.graphics().setDepth(3);
    this.gEnemy = this.add.graphics().setDepth(4);
    this.gStroke = this.add.graphics().setDepth(5);
    this.gFx = this.add.graphics().setDepth(6);
    this.gHud = this.add.graphics().setDepth(10);
    this.gOver = this.add.graphics().setDepth(20);
    this.gZen = this.add.graphics().setDepth(17);

    // HUD テキスト
    this.tScore = this.txt(20, 26, '', { fontSize: '17px', color: '#fdf6e3' }, 0, 0.5);
    this.tBossName = this.txt(300, 9, this.ctl.monsterName || 'ラクガキドン', { fontSize: '12px', color: '#fdf6e3' }, 0, 0.5);
    this.tPhase = this.txt(670, 27, '', { fontSize: '15px', color: '#fdf6e3' }, 0, 0.5);
    this.tTime = this.txt(846, 26, '', { fontSize: '26px', color: '#fdf6e3' }, 1, 0.5);
    this.tHp = this.txt(70, 495, '', { fontSize: '22px', color: '#1d2a44' }, 0, 0.5);
    this.tInkLabel = this.txt(330, 485, 'インク', { fontSize: '15px', color: '#1d2a44' }, 0, 0.5);
    this.tInk = this.txt(630, 485, '', { fontSize: '15px', color: '#1d2a44' }, 1, 0.5);
    this.tInkNeed = this.txt(0, 527, '', { fontSize: '12px', color: '#2f5bd8' }, 0.5, 0.5);
    this.tFocus = this.txt(744, 507, '集中', { fontSize: '15px', color: '#1d2a44' }, 1, 0.5);
    this.tCombo = this.txt(895, 442, '', { fontSize: '16px', color: '#2f5bd8' }, 1, 0.5);
    this.tMsg = this.txt(480, 172, '', { fontSize: '17px', color: '#1d2a44' }, 0.5, 0.5).setDepth(13);
    this.tBig = this.txt(480, 300, '', { fontSize: '40px', color: '#1d2a44', fontFamily: HAND, stroke: '#fbf7ec', strokeThickness: 6 }, 0.5, 0.5).setDepth(14);
    this.tTut = this.txt(480, 432, '', { fontSize: '22px', color: '#1d2a44', stroke: '#fbf7ec', strokeThickness: 5 }, 0.5, 0.5).setDepth(13);
    this.tCand = this.txt(0, 0, '', { fontSize: '11px', color: '#1d2a44' }, 0.5, 0.5).setDepth(16);
    this.tZen = this.txt(480, 118, '', { fontSize: '20px', color: '#1d2a44', fontFamily: HAND, stroke: '#fbf7ec', strokeThickness: 5 }, 0.5, 0.5).setDepth(21);
    this.numPool = [];
    for (let i = 0; i < 10; i++) this.numPool.push(this.txt(0, 0, '', { fontSize: '13px', color: '#ffffff' }, 0.5, 0.5).setDepth(7));
    this.dmgPool = [];
    for (let i = 0; i < 8; i++) this.dmgPool.push(this.txt(0, 0, '', { fontSize: '16px', color: '#d8343b', stroke: '#fbf7ec', strokeThickness: 4 }, 0.5, 0.5).setDepth(12));
    this.hudTexts = [this.tScore, this.tBossName, this.tPhase, this.tTime, this.tHp, this.tInkLabel, this.tInk, this.tInkNeed, this.tFocus, this.tCombo];

    // 入力
    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    const notZen = () => this.stroke && this.stroke.id !== 'zen';
    this.input.on('pointerupoutside', () => { if (notZen()) this.cancelStroke(); });
    this.input.on('gameout', () => { if (notZen()) this.cancelStroke(); });
    this.game.canvas.addEventListener('pointercancel', () => { if (notZen()) this.cancelStroke(); });
    window.addEventListener('blur', () => this.cancelStroke());

    this.applyCamera();
    this.ctl.onSceneReady(this);
  }

  // 文字は「大きなフォントで描いて縮小」して高解像度でもくっきり表示する
  txt(x, y, s, style, ox = 0.5, oy = 0.5) {
    const t = this.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontStyle: 'bold' }, style)).setOrigin(ox, oy).setDepth(11);
    t._fs = parseFloat(style.fontSize) || 16;
    t._st = style.strokeThickness || 0;
    t._sc = 1;
    this.texts.push(t);
    this.applyTextRes(t);
    return t;
  }
  applyTextRes(t) {
    const r = this.textRes;
    t.setFontSize(Math.round(t._fs * r) + 'px');
    if (t._st) t.setStroke(t.style.stroke, t._st * r);
    t.setScale(t._sc / r);
  }
  // 見た目の拡大率（解像度ぶんを差し引く）
  tscale(t, s) { t._sc = s; t.setScale(s / this.textRes); return t; }

  applyCamera() {
    const cam = this.cameras.main;
    const z = this.scale.width / VW;
    cam.setZoom(z);
    cam.centerOn(VW / 2, VH / 2);
    const res = Math.max(1, z);
    if (Math.abs(res - this.textRes) > 0.01) {
      this.textRes = res;
      for (const t of this.texts) this.applyTextRes(t);
    }
  }

  // ================= 状態遷移 =================
  toTitle() {
    this.clearPlay();
    this.state = 'TITLE';
    this.view.setMode('title');
    this.audio.playSong('title');
    this.audio.setLayer3(false);
    this.ui.showTitle();
  }

  clearPlay() {
    this.battle = null;
    this.stroke = null;
    this.tut = null;
    this.fading.length = 0; this.ghosts.length = 0; this.splashes.length = 0; this.ripples.length = 0;
    this.shots.length = 0; this.triFx.length = 0; this.cracks.length = 0; this.dmgNums.length = 0; this.claws.length = 0;
    this.inkBlobs = null;
    this.edgeHit = 0; this.msg.t = 0; this.bigText.t = 0;
    this.tTut.setText('');
    this.view.eyeGlow = 0;
    this.view.resetDamage();
    this.ui.setPauseButton(false);
    this.ui.hideTutChoice();
    this.ui.setPracticeBack(false);
  }

  get diff() { return DIFF[Save.data.lastDiff] || DIFF.easy; }

  startFromTitle() {
    if (this.state !== 'TITLE') return;
    if (!Save.data.tutorialDone) this.startTutorial(false);
    else this.startIntro(false);
  }

  startIntro(short) {
    this.clearPlay();
    this.keptStrokes = [];
    this.state = 'INTRO';
    this.introT = 0;
    this.introDur = short ? 1.25 : 2.4;
    this.view.setMode('intro', { short });
    this.view.onIntroPop = () => { this.audio.play('paper'); this.audio.play('roar'); this.view.shake(0.5, 0.3); };
    this.audio.play('bulge');
    this.audio.playSong('battle');
    this.audio.setLayer3(false);
    this.ui.hideAll();
    this.ui.setPauseButton(true);
  }

  newBattle(mode) {
    const b = new Battle({
      diff: this.diff, mode, emit: (n, d) => this.onEvent(n, d),
      anchors: () => this.view.anchors(), shapeGuide: Save.data.shapeGuide,
      seed: this.ctl.fixedSeed ?? undefined,
    });
    b.reduceFx = Save.data.reduceFx;
    return b;
  }

  startBattle() {
    this.battle = this.newBattle('battle');
    this.state = 'BATTLE';
    this.view.setMode('battle');
    this.view.setPhase(1);
    this.bossBarLag = 1;
    this.showBig('スタート！', 0.9);
    Save.data.plays++;
    Save.write();
  }

  retry() {
    this.ui.hideAll();
    this.startIntro(true);
  }

  // ---------- チュートリアル ----------
  startTutorial(fromTitle) {
    this.clearPlay();
    this.state = 'TUTORIAL';
    this.view.setMode('intro', { short: true });
    this.view.onIntroPop = () => { this.audio.play('paper'); };
    this.audio.playSong('battle');
    this.audio.setLayer3(false);
    this.ui.hideAll();
    this.ui.setPauseButton(true);
    this.battle = this.newBattle('tutorial');
    this.battle.diff = Object.assign({}, this.diff, { inkRegen: 30 });
    this.tut = { step: 0, fromTitle, fails: 0, t: 0, wait: 1.4, attack: null, blocks: 0, circleBlocks: 0, success: false, nextAt: 0, demoT: 0, travel: 0 };
    // ぜんしん版：カメラのときは まず ペンが動くことを確かめる（ステップ0）
    this.tutEnter(Zen.on ? 0 : 1);
  }

  tutEnter(step) {
    const T = this.tut;
    T.step = step; T.fails = 0; T.success = false; T.attack = null; T.blocks = 0; T.circleBlocks = 0; T.spawnIn = step === 1 ? 1.6 : 0.8;
    T.demoT = 0; T.travel = 0;
    this.ui.hideTutChoice();
    const P = this.battle.player;
    P.ink = BAL.inkMax;
    const texts = { 0: '', 1: Zen.on ? '線を描いて、左手を おろす' : '線を描いて、はなす', 2: '丸なら2回守れる', 3: '守ると、力がたまる', 4: '三角で反撃' };
    this.tTut.setText(texts[step]);
    if (step === 0) T.spawnIn = 99;
    if (step === 3) { P.focus = 0; T.focusT = 0; T.spawnIn = 99; }
    if (step === 4) { P.focus = 3; T.spawnIn = 99; }
  }

  tutUpdate(dt) {
    const T = this.tut;
    if (!T) return;
    T.t += dt;
    T.demoT += dt;
    const B = this.battle;
    if (this.view.mode !== 'battle' && this.view.modeT > 1.3) this.view.setMode('battle');
    if (T.success) {
      T.nextAt -= dt;
      if (T.nextAt <= 0) {
        if (T.step < 4) this.tutEnter(T.step + 1);
        else this.finishTutorial();
      }
      return;
    }
    if (T.step === 0) {
      // 左手を挙げて 右手を動かし、ペンが ある程度 動いたら できた
      if (T.travel >= 220) {
        T.success = true; T.nextAt = 1.6;
        this.cancelStroke();
        this.audio.play('focusFull');
      }
      return;
    }
    if (T.step === 3) {
      T.focusT += dt;
      const n = Math.min(3, Math.floor(T.focusT / 0.45));
      if (n > B.player.focus) { B.player.focus = n; this.audio.play(n === 3 ? 'focusFull' : 'recog'); this.focusPulse = 1; }
      if (T.focusT > 2.6) { T.success = true; T.nextAt = 0.2; }
      return;
    }
    if (T.step === 4) { B.player.focus = 3; B.player.ink = Math.max(B.player.ink, 40); }
    if (T.spawnIn < 90 && !T.attack) {
      T.spawnIn -= dt;
      if (T.spawnIn <= 0 && this.view.mode === 'battle') {
        T.blocks = 0; T.circleBlocks = 0;
        if (T.step === 1) T.attack = B.spawnAttack('ink', { lane: 1, previewMul: 0.85 * TUNE.previewMul / this.diff.previewMul });
        if (T.step === 2) T.attack = B.spawnAttack('twin', { pattern: 'same', lane: 1, previewMul: 0.7 * TUNE.previewMul / this.diff.previewMul });
      }
    }
  }

  tutAttackEnd(a) {
    const T = this.tut;
    if (!T || !T.attack || a.id !== T.attack.id) return;
    T.attack = null;
    const ok = T.step === 1 ? T.blocks >= 1 : T.circleBlocks >= 2;
    if (ok) this.tutSuccess();
    else this.tutFail();
  }

  tutSuccess() {
    const T = this.tut;
    T.success = true;
    T.nextAt = 1.3;
    this.showBig('できた！', 1.0);
    this.audio.play('focusFull');
  }

  tutFail() {
    const T = this.tut;
    T.fails++;
    if (T.step !== 4) T.spawnIn = 1.2;
    T.demoT = 0;
    if (T.fails === 2) this.showMsg('見本を大きくしたよ');
    if (T.fails === 4) this.showMsg('ゆっくり なぞってみよう');
    if (T.fails >= 6) {
      T.spawnIn = 99;
      this.ui.showTutChoice();
    }
  }

  tutRetry() { this.ui.hideTutChoice(); this.tut.fails = 4; if (this.tut.step !== 4) this.tut.spawnIn = 1.0; }
  tutSkip() { this.ui.hideTutChoice(); this.finishTutorial(); }

  finishTutorial() {
    Save.data.tutorialDone = true;
    Save.write();
    const fromTitle = this.tut && this.tut.fromTitle;
    this.tTut.setText('');
    this.showBig('準備OK！', 1.0);
    this.battle = null;
    this.tut = null;
    this.state = 'TUT_DONE';
    this.endT = 0;
    this.afterTut = fromTitle ? 'title' : 'battle';
  }

  // ---------- 練習 ----------
  startPractice() {
    this.clearPlay();
    this.state = 'PRACTICE';
    this.view.setMode('battle');
    this.battle = this.newBattle('practice');
    this.ui.hideAll();
    this.ui.setPracticeBack(true);
    this.tTut.setText('線・丸・三角を自由に描いてみよう');
  }

  // ---------- ポーズ ----------
  pause(reason) {
    if (!PLAY_STATES.includes(this.state) && this.state !== 'RESUMING') return;
    if (this.state === 'PRACTICE') return;
    this.cancelStroke();
    this.pausedFrom = this.state === 'RESUMING' ? this.resumeTo : this.state;
    this.state = 'PAUSED';
    this.audio.setDuck(0.35);
    this.ui.showPause(reason);
  }
  resume() {
    if (this.state !== 'PAUSED') return;
    this.ui.hidePause();
    this.state = 'RESUMING';
    this.resumeTo = this.pausedFrom;
    this.resumeT = 0.6;
    this.audio.setDuck(1);
    this.audio.play('count');
  }
  togglePause() {
    if (this.state === 'PAUSED') this.resume();
    else this.pause();
  }

  // ================= 入力 =================
  canDraw() {
    if (this.state === 'BATTLE') return this.battle && this.battle.state === 'run';
    if (this.state === 'TUTORIAL') return this.battle && this.view.mode === 'battle';
    if (this.state === 'PRACTICE') return true;
    return false;
  }

  worldOf(p) { return this.cameras.main.getWorldPoint(p.x, p.y); }

  // マウス・タッチ（本物のポインタ）→ 下の beginStroke / moveStroke / endStroke へ
  onDown(p) {
    this.audio.unlock();
    const w = this.worldOf(p);
    this.beginStroke(w.x, w.y, p.id);
  }

  onMove(p) {
    if (this.state === 'TITLE' && p.pointerType !== 'touch') {
      this.view.setParallax((p.x / this.scale.width - 0.5) * 2, (p.y / this.scale.height - 0.5) * 2);
    }
    const S = this.stroke;
    if (!S || p.id !== S.id) return;
    if (!p.isDown) { this.onUp(p); return; }
    const w = this.worldOf(p);
    this.moveStroke(w.x, w.y);
  }

  onUp(p) {
    const S = this.stroke;
    if (!S || p.id !== S.id) return;
    this.endStroke();
  }

  // ゲームの座標（960×540）で 書く。体のペンは id 'zen'
  beginStroke(x, y, id) {
    if (this.stroke || !this.canDraw()) return false;
    if (x < AREA.x0 || x > AREA.x1 || y < AREA.y0 || y > AREA.y1) return false;
    this.stroke = { id, points: [{ x, y, t: this.clock }], t0: this.clock, cand: null, candT: 0 };
    this.audio.play('penStart');
    return true;
  }

  moveStroke(wx, wy) {
    const S = this.stroke;
    if (!S) return;
    const x = clamp(wx, AREA.x0, AREA.x1), y = clamp(wy, AREA.y0, AREA.y1);
    const last = S.points[S.points.length - 1];
    const d = Math.hypot(x - last.x, y - last.y);
    if (d < 3) return;
    S.points.push({ x, y, t: this.clock });
    if (S.points.length > 256) S.points = S.points.filter((_, i) => i % 2 === 0 || i === S.points.length - 1);
    if (this.tut && this.tut.step === 0 && !this.tut.success) this.tut.travel += d;
    this.audio.play('pen', { speed: d * 60 });
  }

  endStroke() {
    const S = this.stroke;
    if (!S) return;
    this.stroke = null;
    if (this.tut && this.tut.step === 0) { this.fadeStroke(S.points, COLORS.ink); return; }   // ペンの確かめは 図形にしない
    if (!this.battle || !this.canDraw()) { this.fadeStroke(S.points, 0x9aa3b5); return; }
    const res = this.battle.submitStroke({ points: S.points });
    this.lastResult = res;
    if (res.invalid) {
      this.fadeStroke(S.points, 0x8fa0c8);
      if (S.id === 'zen' && res.reason === 'small') this.showMsg('もうすこし 大きく かこう');
      return;
    }
    if (!res.ok) {
      this.fadeStroke(S.points, res.lack === 'ink' ? 0xb0b0b0 : 0x8fa0c8);
      if (this.state === 'PRACTICE') this.practiceFeedback(res);
      if (this.tut && this.tut.step === 4 && !this.tut.success) this.tutFail();
      return;
    }
    if (this.state === 'PRACTICE') this.practiceFeedback(res);
    if (this.tut && this.tut.step === 4 && res.rec.type !== 'tri' && !this.tut.success) { this.showMsg('三角を描いてみよう'); this.tutFail(); }
    if (res.shape && res.shape.raw && this.state === 'BATTLE') {
      this.keptStrokes.push(res.shape.raw.map(q => ({ x: q.x, y: q.y })));
      if (this.keptStrokes.length > 40) this.keptStrokes.shift();
    }
  }

  cancelStroke() {
    if (!this.stroke) return;
    if (this.stroke.id === 'zen' && Zen.leftUp) this.zenLock = true;
    this.fadeStroke(this.stroke.points, 0x9aa3b5);
    this.stroke = null;
  }

  // ================= 体のペン（ぜんしん版） =================
  // 左手を挙げている間 = ポインタを押している間。右手首の位置を 描くところ（AREA）に写して 同じ処理へ渡す
  zenUpdate(dt) {
    if (!Zen.on) return;
    if (this.zenBot) this.zenBot(dt);
    const drawer = this.ui.drawerOpen();
    Zen.setCtx(drawer ? 'pad' : 'battle');
    Zen.tick(dt);
    if (Zen.pauseReq) {
      Zen.pauseReq = false;
      if (['BATTLE', 'TUTORIAL', 'INTRO', 'RESUMING'].includes(this.state)) this.pause('gesture');
    }
    if (drawer) { this.ui.zenPadTick(dt); return; }
    const w = this.zenPos;
    w.x = AREA.x0 + Zen.pen.x * (AREA.x1 - AREA.x0);
    w.y = AREA.y0 + Zen.pen.y * (AREA.y1 - AREA.y0);
    if (!Zen.leftUp) this.zenLock = false;
    const S = this.stroke;
    if (S && S.id === 'zen') {
      if (!Zen.writing) this.endStroke();
      else this.moveStroke(w.x, w.y);
    } else if (!S && Zen.writing && !this.zenLock) {
      this.beginStroke(w.x, w.y, 'zen');
    }
  }

  zenStatus() {
    const s = Zen.status();
    if (s === 'writing' && this.zenLock) return 'relift';
    return s;
  }

  // 操作の案内（DOM）と 隅のアイコン
  updateGuide() {
    const G = this.ctl.guide;
    if (!G) return;
    if (!Zen.on) { G.update('hidden', '', null); return; }
    const st = this.state;
    const drawer = this.ui.drawerOpen();
    const live = ['BATTLE', 'TUTORIAL', 'PRACTICE', 'INTRO', 'RESUMING', 'TUT_DONE'].includes(st);
    let mode = 'hidden';
    if (drawer) mode = 'hidden';
    else if (st === 'TITLE') mode = this.ui.titleOpen() ? 'title' : 'hidden';
    else if (live) mode = this.tut && this.tut.step === 0 ? (this.tut.success ? 'done' : 'big') : 'corner';
    // 設定で 案内を消せる（はじめての練習の 大きな案内だけは 出す）
    if (!Save.data.zenGuide && mode !== 'big' && mode !== 'done') mode = 'hidden';
    const s = this.zenStatus();
    const icon = drawer || !(live || st === 'TITLE') ? null : s === 'writing' ? 'up' : ['noLeft', 'nobody'].includes(s) ? 'lost' : 'down';
    G.update(mode, s, icon);
  }

  // ペンの点：書いていないときは 中が空いた うすい丸、書いているときは 濃いインク色の 太い丸
  drawZenPen() {
    const g = this.gZen;
    if (!Zen.on || !Zen.rVis) return;
    const { x, y } = this.zenPos;
    if (this.stroke && this.stroke.id === 'zen') {
      g.fillStyle(COLORS.ink, 0.25); g.fillCircle(x, y, 17);
      g.fillStyle(COLORS.ink, 1); g.fillCircle(x, y, 10);
      g.lineStyle(2.5, 0xffffff, 0.9); g.strokeCircle(x, y, 12.5);
    } else {
      g.lineStyle(2.5, 0x1d2a44, 0.45); g.strokeCircle(x, y, 12);
      g.fillStyle(0x1d2a44, 0.35); g.fillCircle(x, y, 2.5);
    }
  }

  // 両手を上げている間：ポーズまでの輪
  drawZenPause() {
    const h = Zen.pauseHold;
    const on = Zen.on && h > 0.05 && ['BATTLE', 'TUTORIAL', 'INTRO'].includes(this.state);
    this.tZen.setVisible(on);
    if (!on) return;
    const g = this.gZen;
    g.fillStyle(0xfbf7ec, 0.9); g.fillCircle(480, 84, 22);
    g.lineStyle(5, COLORS.ink, 0.95);
    g.beginPath(); g.arc(480, 84, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * h, false); g.strokePath();
    this.tZen.setText('そのまま で ポーズ');
  }

  fadeStroke(points, color) { this.fading.push({ points, color, t: 0.25 }); }

  practiceFeedback(res) {
    const names = { line: '線（インクシールド）', circle: '丸（まるバリア）', tri: '三角（トライアタック）' };
    if (res.rec && res.rec.type) { this.showMsg(`${names[res.rec.type]}！${res.rec.lenient ? '（ちかい形に したよ）' : ''}`); return; }
    const r = res.rec;
    let hint = 'かたちが わからない';
    if (r && r.why === 'closed') hint = r.cand === 'tri' ? '三角の角をはっきり描こう' : '丸はなめらかに、つぶしすぎないで';
    else if (r && r.detail && r.detail.se > 300) hint = '線が長すぎます（短めに）';
    else if (r && r.detail && r.detail.ratio < 0.82) hint = '線はまっすぐ。丸と三角は始点に戻って閉じよう';
    this.showMsg(hint);
  }

  // ================= イベント（BattleController → 演出） =================
  onEvent(name, d) {
    const V = this.view, A = this.audio;
    switch (name) {
      case 'attackStart': {
        const pose = { ink: 'chargeMouth', twin: 'chargeTwin', scratch: 'chargeArm', rain: 'chargeSpray' }[d.type];
        V.motion(pose, d.windup + d.preview);
        break;
      }
      case 'attackPreview': A.play('warn'); break;
      case 'fire': {
        if (d.a.type === 'rain') {
          if (d.p.num === 1) V.motion('spray', 0.4 + d.a.def.interval * 2);
          A.play('drop');
        } else {
          V.motion('fire', 0.35);
          V.puff(V.worldOf(d.p.src === 'mouthL' ? V.mouthL : d.p.src === 'mouthR' ? V.mouthR : V.mouthAnchor), 5);
          A.play('fire');
        }
        break;
      }
      case 'swipe': {
        V.motion('swipe', 0.35);
        A.play('swipe');
        this.claws.push({ g: d.g, t: 0, blocked: false });
        break;
      }
      case 'imminent': A.play('imminent'); break;
      case 'block': {
        A.play('block', { combo: d.combo });
        this.splash(d.x, d.y, COLORS.ink, 12);
        this.ripples.push({ x: d.x, y: d.y, t: 0, dur: 0.4, max: 44 });
        this.flashAt = { x: d.x, y: d.y, t: 0.08 };
        const ch = V.anchors().chest;
        this.shots.push({ x0: d.x, y0: d.y, x1: ch.x, y1: ch.y, t: 0, dur: 0.22, trail: [] });
        V.shake(0.12, 0.12);
        if (d.s.type === 'circle') d.s.gapAng = Math.atan2(d.y - d.s.cy, d.x - d.s.cx);
        if (this.tut && this.tut.attack && d.a.id === this.tut.attack.id) { this.tut.blocks++; if (d.s.type === 'circle') this.tut.circleBlocks++; }
        for (const c of this.claws) if (c.g === d.it) c.blocked = true;
        break;
      }
      case 'bossDamage': {
        const B = this.battle;
        V.setDamage(1 - B.boss.hp / B.boss.max, d.big ? 1 : 0);
        if (Save.data.damageNumbers) this.dmgNums.push({ v: d.dmg, t: 0, delay: d.big ? 0 : 0.2, big: d.big });
        if (!d.big) this.pendingHurt = (this.pendingHurt || 0) + 1;
        break;
      }
      case 'triFire': {
        A.play('tri');
        this.triFx.push({ tri: d, t: 0 });
        break;
      }
      case 'triHit': {
        V.hurt(true);
        A.play('bossHitBig');
        V.shake(0.6, 0.3);
        const ch = V.anchors().chest;
        this.cracks.push({ x: ch.x, y: ch.y, t: 0, seed: Math.random() * 1000 });
        this.splash(ch.x, ch.y, COLORS.red, 18);
        V.spawnChips(16, V.worldOf(V.chestAnchor), 1.2, 3);
        if (this.tut && this.tut.step === 4 && !this.tut.success) this.tutSuccess();
        break;
      }
      case 'shape': A.play('recog'); break;
      case 'shapeGone': {
        if (d.why === 'used') { this.ghosts.push({ s: d.s, t: 0, dur: 0.3, burst: true }); this.splash(d.s.type === 'line' ? (d.s.x1 + d.s.x2) / 2 : d.s.cx, d.s.type === 'line' ? (d.s.y1 + d.s.y2) / 2 : d.s.cy, COLORS.inkLight, 6); }
        else this.ghosts.push({ s: d.s, t: 0, dur: 0.25, burst: false });
        break;
      }
      case 'recogFail': {
        A.play('fail');
        this.recogFailCount++;
        if (this.recogFailCount === 1 && this.state !== 'PRACTICE') this.showMsg('線はまっすぐ／丸と三角は閉じて描こう', 1.6);
        else if (this.state !== 'PRACTICE') this.showMsg('かたちが わからない');
        break;
      }
      case 'inkShort': A.play('inkShort'); this.inkFlash = 0.8; this.showMsg(`インク不足 あと${d.need}`); break;
      case 'focusShort': A.play('fail'); this.showMsg(`あと${d.need}回ガード`); break;
      case 'focusFull': A.play('focusFull'); this.focusPulse = 1; break;
      case 'playerHit': {
        A.play('playerHit');
        this.edgeHit = 1;
        this.edgeSeed = Math.random() * 1000;
        V.shake(0.35, 0.25);
        V.motion('happy', 0.6);
        this.splash(d.x, d.y, 0x14161c, 10);
        this.showMsg(FAIL_TEXT[d.reason] + `  -${d.dmg}`);
        break;
      }
      case 'miss': this.splash(d.x, d.y, 0x14161c, 6); break;
      case 'tutMiss': {
        this.splash(d.x, d.y, 0x14161c, 8);
        this.showMsg(FAIL_TEXT[d.reason]);
        V.motion('happy', 0.5);
        break;
      }
      case 'phaseStart': {
        V.motion('roar', 1.3);
        V.setPhase(d.phase);
        V.spawnChips(50, V.worldOf(V.chestAnchor), 2.4, 3);
        V.shake(0.4, 0.5);
        A.play('phase');
        A.play('roar');
        this.showBig(`PHASE ${d.phase}`, 1.3);
        if (d.phase === 3) A.setLayer3(true);
        this.cancelStroke();
        break;
      }
      case 'timeWarn': A.play('tick'); setTimeout(() => A.play('tick'), 160); break;
      case 'attackEnd': if (this.tut) this.tutAttackEnd(d); break;
      case 'end': this.onEnd(d); break;
    }
  }

  onEnd(sum) {
    this.cancelStroke();
    this.endT = 0;
    this.summary = sum;
    this.ui.setPauseButton(false);
    // 記録
    const D = Save.data;
    const best = D.best[sum.diff];
    sum.newScore = sum.score > best.score;
    sum.newTime = sum.result === 'win' && (best.timeMs === 0 || sum.timeMs < best.timeMs);
    sum.prevBest = { ...best };
    if (sum.newScore) best.score = sum.score;
    if (sum.newTime) best.timeMs = sum.timeMs;
    if (sum.result === 'win') D.wins++;
    if (!Save.write()) sum.saveFailed = true;
    if (sum.result === 'win') {
      this.state = 'VICTORY';
      this.view.setMode('sealed');
      this.audio.stopSong();
      this.audio.play('bossHitBig');
      setTimeout(() => this.audio.play('paper'), 500);
      setTimeout(() => this.audio.play('victory'), 1500);
    } else {
      this.state = 'DEFEAT';
      this.view.setMode('won');
      this.audio.stopSong();
      this.audio.play('defeat');
      this.inkBlobs = [];
      for (let i = 0; i < 16; i++) {
        const side = i % 4;
        const x = side === 0 ? 0 : side === 1 ? VW : Math.random() * VW;
        const y = side === 2 ? 0 : side === 3 ? VH : Math.random() * VH;
        this.inkBlobs.push({ x, y, r: 0, max: 120 + Math.random() * 160, delay: Math.random() * 0.8 });
      }
    }
  }

  splash(x, y, color, n) {
    const q = this.particleScale();
    n = Math.max(2, Math.round(n * q));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
      this.splashes.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.5 + Math.random() * 3.5, t: 0, dur: 0.35 + Math.random() * 0.25, color });
    }
  }
  particleScale() { return QUALITY[this.view.quality].particles * (Save.data.reduceFx ? 0.4 : 1); }

  showMsg(text, dur = 1.0) { this.msg.text = text; this.msg.t = dur; this.msg.dur = dur; }
  showBig(text, dur) { this.bigText.text = text; this.bigText.t = dur; this.bigText.dur = dur; }

  // ================= 更新 =================
  update(time, delta) {
    let dt = Math.min(delta / 1000, GAME.MAX_DT);
    const V = this.view;
    this.clock += dt;
    this.zenUpdate(dt);

    // fps 計測（継続的に低い時のみ提案）
    if (this.state === 'BATTLE') {
      this.fpsAcc.t += delta / 1000; this.fpsAcc.n++;
      if (this.fpsAcc.t >= 5) {
        const fps = this.fpsAcc.n / this.fpsAcc.t;
        this.fpsAcc.low = fps < 24 ? this.fpsAcc.low + 1 : 0;
        if (this.fpsAcc.low >= 2 && !this.fpsAcc.suggested && V.quality !== 'low') { this.fpsAcc.suggested = true; this.showMsg('重いときは 設定で画質を下げられます', 2.0); }
        this.fpsAcc.t = 0; this.fpsAcc.n = 0;
      }
    }

    const frozen = this.state === 'PAUSED';
    switch (this.state) {
      case 'INTRO':
        this.introT += dt;
        V.eyeGlow = Math.min(1, this.introT / 0.6);
        if (this.introT >= this.introDur) { V.eyeGlow = 0; this.startBattle(); }
        break;
      case 'BATTLE':
        this.battle.update(dt);
        this.strokeTimeout();
        break;
      case 'TUTORIAL':
        V.eyeGlow = Math.max(0, V.eyeGlow - dt);
        this.battle.update(dt);
        this.tutUpdate(dt);
        if (this.tut && this.tut.step !== 0) this.strokeTimeout();
        break;
      case 'PRACTICE':
        this.battle.update(dt);
        this.battle.player.ink = BAL.inkMax;
        this.strokeTimeout();
        break;
      case 'RESUMING':
        this.resumeT -= dt;
        if (this.resumeT <= 0) this.state = this.resumeTo;
        break;
      case 'TUT_DONE':
        this.endT += dt;
        if (this.endT > 1.2) {
          if (this.afterTut === 'title') this.toTitle();
          else this.startIntro(false);
        }
        break;
      case 'VICTORY':
      case 'DEFEAT':
        this.endT += dt;
        if (this.battle) this.battle.update(dt);
        if (this.state === 'VICTORY' && this.endT > 2.0 && this.bigText.t <= 0 && !this.sealedShown) { this.sealedShown = true; this.showBig('封印完了！', 1.4); }
        if (this.endT > (this.state === 'VICTORY' ? 3.6 : 3.0)) {
          this.state = 'RESULT';
          this.sealedShown = false;
          this.audio.playSong('title');
          this.ui.showResult(this.summary);
        }
        break;
    }

    if (!frozen) {
      this.updateFx(dt);
      V.update(this.state === 'RESUMING' ? 0 : dt);
    }
    this.draw();
    this.updateGuide();
    if (!this.ctl.noRender) V.render();   // ?dbg の早送りの間は 3D を描かない
  }

  // 長すぎる線は 取り消す（ぜんしん版は STROKE.maxTime まで待つ）
  strokeTimeout() {
    if (this.stroke && this.clock - this.stroke.t0 >= STROKE.maxTime) {
      const zen = this.stroke.id === 'zen';
      this.cancelStroke();
      this.showMsg(zen ? '短く描こう（左手を おろす）' : '短く描こう');
    }
  }

  updateFx(dt) {
    for (const f of this.fading) f.t -= dt;
    this.fading = this.fading.filter(f => f.t > 0);
    for (const g of this.ghosts) g.t += dt;
    this.ghosts = this.ghosts.filter(g => g.t < g.dur);
    for (const s of this.splashes) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - dt * 5; s.vy *= 1 - dt * 5; }
    this.splashes = this.splashes.filter(s => s.t < s.dur);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < r.dur);
    for (const s of this.shots) {
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      s.x = lerp(s.x0, s.x1, u); s.y = lerp(s.y0, s.y1, u) - Math.sin(u * Math.PI) * 40;
      s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 7) s.trail.shift();
      if (u >= 1 && !s.hit) {
        s.hit = true;
        this.view.hurt(false);
        this.audio.play('bossHit');
        this.splash(s.x1, s.y1, COLORS.ink, 6);
      }
    }
    this.shots = this.shots.filter(s => s.t < s.dur + 0.05);
    for (const t of this.triFx) t.t += dt;
    this.triFx = this.triFx.filter(t => t.t < SHAPES.tri.anim);
    for (const c of this.cracks) c.t += dt;
    this.cracks = this.cracks.filter(c => c.t < 0.6);
    for (const n of this.dmgNums) n.t += dt;
    this.dmgNums = this.dmgNums.filter(n => n.t < 0.8 + n.delay);
    for (const c of this.claws) c.t += dt;
    this.claws = this.claws.filter(c => c.t < 0.5);
    if (this.flashAt) { this.flashAt.t -= dt; if (this.flashAt.t <= 0) this.flashAt = null; }
    this.edgeHit = Math.max(0, this.edgeHit - dt * 1.6);
    this.inkFlash = Math.max(0, this.inkFlash - dt);
    this.focusPulse = Math.max(0, this.focusPulse - dt * 1.2);
    if (this.msg.t > 0) this.msg.t -= dt;
    if (this.bigText.t > 0) this.bigText.t -= dt;
    if (this.inkBlobs) for (const b of this.inkBlobs) { if (this.endT > b.delay) b.r = Math.min(b.max, b.r + dt * b.max * 0.9); }
    if (this.battle) {
      const target = this.battle.boss.hp / this.battle.boss.max;
      this.bossBarLag = this.bossBarLag > target ? Math.max(target, this.bossBarLag - dt * 0.5) : target;
    }
  }

  // ================= 描画 =================
  draw() {
    const showPlay = ['BATTLE', 'TUTORIAL', 'PRACTICE', 'PAUSED', 'RESUMING', 'VICTORY', 'DEFEAT', 'INTRO', 'TUT_DONE'].includes(this.state);
    const st = this.state === 'PAUSED' || this.state === 'RESUMING' ? this.pausedFrom || this.resumeTo : this.state;
    [this.gArea, this.gKept, this.gPaths, this.gShapes, this.gEnemy, this.gStroke, this.gFx, this.gHud, this.gOver, this.gZen].forEach(g => g.clear());
    for (const t of this.numPool) t.setVisible(false);
    for (const t of this.dmgPool) t.setVisible(false);
    this.tCand.setVisible(false);
    this.drawZenPause();

    if (this.state === 'RESULT' && this.summary && this.summary.result === 'win') this.drawKept();
    if (!showPlay) { this.hudVisible(false); this.tMsg.setVisible(false); this.tBig.setVisible(false); this.tTut.setVisible(false); return; }
    this.tTut.setVisible(st === 'TUTORIAL' || st === 'PRACTICE');

    // 描画領域
    if (['BATTLE', 'TUTORIAL', 'PRACTICE'].includes(st)) {
      const g = this.gArea;
      g.lineStyle(2, 0x5aa0ff, 0.38);
      g.strokeRoundedRect(AREA.x0, AREA.y0, AREA.x1 - AREA.x0, AREA.y1 - AREA.y0, 14);
      g.fillStyle(0x5aa0ff, 0.035);
      g.fillRoundedRect(AREA.x0, AREA.y0, AREA.x1 - AREA.x0, AREA.y1 - AREA.y0, 14);
    }
    if (this.battle) {
      this.drawAttacks();
      this.drawShapes();
    }
    if (this.tut) this.drawTutGuide();
    this.drawStroke();
    if (['BATTLE', 'TUTORIAL', 'PRACTICE', 'RESUMING'].includes(this.state)) this.drawZenPen();
    this.drawFx();
    this.drawHud(st);
    this.drawOverlay();
  }

  hudVisible(v) { for (const t of this.hudTexts) t.setVisible(v); }

  dash(g, x1, y1, x2, y2, on = 10, off = 7, phase = 0) {
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 1) return;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    let d = -((phase % (on + off)) + (on + off)) % (on + off);
    while (d < L) {
      const a = Math.max(0, d), b = Math.min(L, d + on);
      if (b > a) g.lineBetween(x1 + ux * a, y1 + uy * a, x1 + ux * b, y1 + uy * b);
      d += on + off;
    }
  }

  dashCircle(g, x, y, r, n = 18) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n;
      g.beginPath(); g.arc(x, y, r, a0, a1, false); g.strokePath();
    }
  }

  num(x, y, s, color = '#ffffff') {
    const t = this.numPool.find(q => !q.visible);
    if (!t) return;
    t.setText(String(s)).setPosition(x, y).setColor(color).setVisible(true);
  }

  drawAttacks() {
    const g = this.gPaths, e = this.gEnemy;
    const B = this.battle;
    const tnow = this.time.now / 1000;
    for (const a of B.attacks) {
      const strong = a.type === 'scratch';
      if (!a.pathsFixed && a.type !== 'scratch') {
        // 予備動作中：発射口の近くに種類アイコン
        continue;
      }
      const fade = Math.min(1, (a.t - a.windup) / 0.15);
      if (a.type === 'scratch') {
        const gt = a.gate;
        if (a.t < a.windup) continue;
        const dx = Math.cos(gt.ang), dy = Math.sin(gt.ang);
        const nx = -dy, ny = dx;
        if (!gt.done) {
          // 扇形の予告（強攻撃：赤・太い）
          const pr = clamp((a.t - a.windup) / a.preview, 0, 1);
          g.fillStyle(COLORS.strong, 0.10 + 0.12 * pr);
          const apex = { x: gt.gx - nx * 150, y: gt.gy - ny * 150 };
          const pts = [apex];
          for (let i = 0; i <= 10; i++) {
            const k = (i / 10 - 0.5) * 1.0;
            pts.push({ x: gt.gx + dx * k * 120 + nx * 40, y: gt.gy + dy * k * 120 + ny * 40 });
          }
          g.fillPoints(pts, true);
          g.lineStyle(5, COLORS.strong, 0.85 * fade);
          for (let k = -1; k <= 1; k++) this.dash(g, gt.gx - nx * 140 + dx * k * 26, gt.gy - ny * 140 + dy * k * 26, gt.gx + nx * 90 + dx * k * 26, gt.gy + ny * 90 + dy * k * 26, 14, 8, -tnow * 60);
          // 防御ゲート（青）
          g.lineStyle(6, COLORS.guide, 0.5 + 0.3 * Math.sin(tnow * 8));
          g.lineBetween(gt.gx - dx * gt.w / 2, gt.gy - dy * gt.w / 2, gt.gx + dx * gt.w / 2, gt.gy + dy * gt.w / 2);
          g.fillStyle(COLORS.guide, 0.9);
          g.fillCircle(gt.gx - dx * gt.w / 2, gt.gy - dy * gt.w / 2, 4);
          g.fillCircle(gt.gx + dx * gt.w / 2, gt.gy + dy * gt.w / 2, 4);
          // 残り時間のリング
          g.lineStyle(3, COLORS.strong, 0.9);
          g.beginPath(); g.arc(gt.gx + dx * 74, gt.gy + dy * 74 - 18, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pr), false); g.strokePath();
          this.drawTypeIcon(g, 'scratch', gt.gx - nx * 160, gt.gy - ny * 160 - 6);
          if (a.shapeIcon) this.drawShapeIcon(g, 'line', gt.gx + dx * 74, gt.gy + dy * 74 + 16, 0.9);
        }
        continue;
      }
      for (const p of a.items) {
        if (p.kind !== 'proj' || p.st === 'done') continue;
        const col = COLORS.danger;
        const fromX = p.st === 'fly' ? p.x : p.x0, fromY = p.st === 'fly' ? p.y : p.y0;
        if (a.type === 'rain') {
          g.lineStyle(2, col, 0.7 * fade);
          this.dash(g, p.x0, p.y0 + (p.st === 'fly' ? (p.y - p.y0) : 0), p.tx, p.ty, 4, 6, -tnow * 40);
          // 落下先の番号付きマーク
          g.lineStyle(3, col, 0.9 * fade);
          g.strokeCircle(p.tx, p.ty - 8, 13);
          g.fillStyle(col, 0.9 * fade);
          g.fillCircle(p.tx, p.ty - 8, 9);
          this.num(p.tx, p.ty - 8, p.num);
        } else {
          g.lineStyle(3, col, 0.85 * fade);
          this.dash(g, fromX, fromY, p.tx, p.ty, 12, 8, -tnow * 70);
          // 着弾点
          g.lineStyle(3, col, 0.9 * fade);
          g.lineBetween(p.tx - 9, p.ty - 9, p.tx + 9, p.ty + 9);
          g.lineBetween(p.tx - 9, p.ty + 9, p.tx + 9, p.ty - 9);
          if (p.num) {
            const q = Battle.pathAtY(p, 250);
            g.fillStyle(col, 0.95 * fade); g.fillCircle(q.x, q.y, 10);
            this.num(q.x, q.y, p.num);
          }
        }
        // ガイド（防御推奨地点）
        if (a.guide && p.st !== 'done') {
          const gy = a.type === 'rain' ? a.def.defY : GAME.DEF_Y;
          const q = Battle.pathAtY(p, gy);
          // 今描けば間に合うときだけ明るくなる（早すぎる描画の目安）
          const uDef = clamp((gy - p.y0) / ((p.ty - p.y0) || 1), 0, 1);
          const tArrive = p.start + p.dur * uDef - a.t;
          const ready = tArrive <= (a.rec === 'circle' ? SHAPES.circle.life : SHAPES.line.life) - 0.25;
          g.lineStyle(ready ? 6 : 4, COLORS.guide, (ready ? 0.7 + 0.25 * Math.sin(tnow * 10) : 0.28) * fade);
          if (a.rec === 'circle' && a.type === 'twin') {
            if (p.num === 1) this.dashCircle(g, (a.items[0].tx + a.items[1].tx) / 2 + (Battle.pathAtY(a.items[0], gy).x - a.items[0].tx + Battle.pathAtY(a.items[1], gy).x - a.items[1].tx) / 2, gy, 50, 16);
          } else {
            g.lineBetween(q.x - 34, q.y, q.x + 34, q.y);
          }
        }
      }
      // 種類アイコンと推奨図形
      const first = a.items.find(p => p.kind === 'proj');
      if (first && a.stage === 'preview') {
        const live = a.items.filter(p => p.st !== 'done');
        if (live.length) {
          if (a.type === 'rain') { if (first.st === 'wait') this.drawTypeIcon(g, a.type, first.tx + 28, first.y0 + 30); }
          else { const q = Battle.pathAtY(first, AREA.y0 + 16); this.drawTypeIcon(g, a.type, q.x + (first.tx >= first.x0 ? -30 : 30), q.y); }
          if (a.shapeIcon) {
            const q = a.type === 'rain' ? { x: live[0].tx, y: a.def.defY } : Battle.pathAtY(live[0], GAME.DEF_Y);
            this.drawShapeIcon(g, a.rec, q.x + (a.rec === 'circle' && a.type === 'twin' ? 72 : 56), q.y - 4, 0.9);
          }
        }
      }
      // 敵弾
      for (const p of a.items) {
        if (p.kind !== 'proj' || p.st !== 'fly') continue;
        for (let i = 0; i < p.trail.length; i++) {
          const q = p.trail[i];
          e.fillStyle(COLORS.enemy, 0.08 + 0.3 * i / p.trail.length);
          e.fillCircle(q.x, q.y, p.r * (0.3 + 0.5 * i / p.trail.length));
        }
        if (a.type === 'rain') {
          e.fillStyle(COLORS.enemy, 1);
          e.fillTriangle(p.x - p.r * 0.8, p.y - 1, p.x + p.r * 0.8, p.y - 1, p.x, p.y - p.r * 2.4);
          e.fillCircle(p.x, p.y, p.r);
          e.lineStyle(3, COLORS.danger, 1);
          e.strokeCircle(p.x, p.y, p.r + 1.5);
        } else {
          e.fillStyle(COLORS.enemy, 1);
          e.fillCircle(p.x, p.y, p.r);
          e.lineStyle(3, COLORS.danger, 1);
          e.strokeCircle(p.x, p.y, p.r + 1.5);
          e.fillStyle(0xffffff, 0.5);
          e.fillCircle(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.25);
          if (p.num) this.num(p.x, p.y, p.num);
        }
      }
    }
    // ひっかき爪痕
    for (const c of this.claws) {
      const gt = c.g;
      const dx = Math.cos(gt.ang), dy = Math.sin(gt.ang), nx = -dy, ny = dx;
      const u = Math.min(1, c.t / 0.15);
      const al = 1 - Math.max(0, (c.t - 0.15) / 0.35);
      e.lineStyle(7, c.blocked ? COLORS.inkLight : 0x14161c, al);
      for (let k = -1; k <= 1; k++) {
        const sx = gt.gx - nx * 140 + dx * k * 22, sy = gt.gy - ny * 140 + dy * k * 22;
        const len = c.blocked ? 140 : 250;
        e.lineBetween(sx, sy, sx + nx * len * u, sy + ny * len * u);
      }
    }
  }

  drawTypeIcon(g, type, x, y) {
    g.fillStyle(type === 'scratch' ? COLORS.strong : COLORS.danger, 0.95); g.fillRoundedRect(x - 13, y - 13, 26, 26, 6);
    g.fillStyle(0xfbf7ec, 1); g.fillRoundedRect(x - 10, y - 10, 20, 20, 4);
    g.fillStyle(0x14161c, 1);
    if (type === 'ink') g.fillCircle(x, y, 5);
    else if (type === 'twin') { g.fillCircle(x - 4, y, 4); g.fillCircle(x + 4, y, 4); }
    else if (type === 'scratch') { g.lineStyle(2.5, 0x14161c, 1); for (let k = -1; k <= 1; k++) g.lineBetween(x - 6 + k * 4, y - 6, x + k * 4, y + 6); }
    else if (type === 'rain') { g.fillTriangle(x - 4, y + 1, x + 4, y + 1, x, y - 8); g.fillCircle(x, y + 2, 4); }
  }

  drawShapeIcon(g, type, x, y, a = 1) {
    g.fillStyle(0xffffff, 0.92 * a); g.fillRoundedRect(x - 14, y - 12, 28, 24, 6);
    g.lineStyle(2, COLORS.ink, a);
    if (type === 'line') g.lineBetween(x - 8, y + 4, x + 8, y - 4);
    else if (type === 'circle') g.strokeCircle(x, y, 7);
    else if (type === 'tri') g.strokeTriangle(x, y - 8, x - 8, y + 6, x + 8, y + 6);
  }

  drawShapes() {
    const g = this.gShapes;
    const B = this.battle;
    for (const s of B.shapes) {
      const formed = Math.min(1, s.age / 0.12);
      let al = 1;
      if (s.life < 0.4) al = 0.45 + 0.55 * Math.abs(Math.sin(s.life * 18));
      // 元の筆跡の薄い残像
      this.polyline(g, s.raw, 3, COLORS.ink, 0.22 + 0.5 * (1 - formed));
      if (s.type === 'line') {
        const cx = (s.x1 + s.x2) / 2, cy = (s.y1 + s.y2) / 2;
        const k = 0.85 + 0.15 * formed;
        const x1 = cx + (s.x1 - cx) * k, y1 = cy + (s.y1 - cy) * k, x2 = cx + (s.x2 - cx) * k, y2 = cy + (s.y2 - cy) * k;
        g.lineStyle(SHAPES.line.width + 6, COLORS.inkLight, 0.25 * al * formed);
        g.lineBetween(x1, y1, x2, y2);
        g.lineStyle(SHAPES.line.width, COLORS.ink, al * formed);
        g.lineBetween(x1, y1, x2, y2);
        g.fillStyle(COLORS.ink, al * formed);
        g.fillCircle(x1, y1, SHAPES.line.width / 2); g.fillCircle(x2, y2, SHAPES.line.width / 2);
        g.lineStyle(2, COLORS.inkCore, 0.9 * al * formed);
        g.lineBetween(x1, y1, x2, y2);
      } else {
        const r = s.r * (0.8 + 0.2 * formed);
        g.fillStyle(COLORS.inkLight, 0.16 * al * formed);
        g.fillCircle(s.cx, s.cy, r);
        g.lineStyle(5, COLORS.ink, al * formed);
        if (s.dur >= 2) g.strokeCircle(s.cx, s.cy, r);
        else {
          const ga = s.gapAng ?? -Math.PI / 2;
          g.beginPath(); g.arc(s.cx, s.cy, r, ga + 0.9, ga + Math.PI * 2 - 0.9, false); g.strokePath();
        }
        g.lineStyle(1.5, COLORS.inkCore, 0.8 * al * formed);
        g.strokeCircle(s.cx, s.cy, r - 1);
      }
    }
    for (const gh of this.ghosts) {
      const u = gh.t / gh.dur, s = gh.s;
      const al = 1 - u;
      if (s.type === 'line') {
        const cx = (s.x1 + s.x2) / 2, cy = (s.y1 + s.y2) / 2, k = gh.burst ? 1 + u * 0.4 : 1;
        g.lineStyle(SHAPES.line.width * (gh.burst ? 1 - u : 1), gh.burst ? COLORS.inkLight : COLORS.ink, al * 0.8);
        g.lineBetween(cx + (s.x1 - cx) * k, cy + (s.y1 - cy) * k, cx + (s.x2 - cx) * k, cy + (s.y2 - cy) * k);
      } else if (s.type === 'circle') {
        g.lineStyle(5 * (1 - u), gh.burst ? COLORS.inkLight : COLORS.ink, al * 0.8);
        g.strokeCircle(s.cx, s.cy, s.r * (gh.burst ? 1 + u * 0.4 : 1));
      }
    }
  }

  polyline(g, pts, w, color, alpha) {
    if (!pts || pts.length < 2) return;
    g.lineStyle(w, color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokePath();
  }

  // 筆跡（見た目用の軽い平滑化）
  smoothLine(g, pts, w, color, alpha) {
    if (pts.length < 2) { if (pts.length) { g.fillStyle(color, alpha); g.fillCircle(pts[0].x, pts[0].y, w / 2); } return; }
    g.lineStyle(w, color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      // 二次ベジエを短い線分で近似
      const p0 = i === 1 ? pts[0] : { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
      for (let k = 1; k <= 3; k++) {
        const t = k / 3;
        g.lineTo((1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * pts[i].x + t * t * mx, (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * pts[i].y + t * t * my);
      }
    }
    g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.strokePath();
    g.fillStyle(color, alpha);
    g.fillCircle(pts[0].x, pts[0].y, w / 2);
    g.fillCircle(pts[pts.length - 1].x, pts[pts.length - 1].y, w / 2);
  }

  drawStroke() {
    const g = this.gStroke;
    for (const f of this.fading) this.smoothLine(g, f.points, 4, f.color, Math.max(0, f.t / 0.25) * 0.8);
    const S = this.stroke;
    if (!S) return;
    const el = this.clock - S.t0;
    // 候補の判定（間引き）
    S.candT -= 1;
    if (S.candT <= 0) { S.cand = candidate(S.points); S.candT = 4; }
    const B = this.battle;
    let color = COLORS.ink;
    if (S.cand && B && this.state !== 'PRACTICE') {
      const need = SHAPES[S.cand].ink;
      if (B.player.ink < need) color = 0xa8a8a8;
    }
    this.smoothLine(g, S.points, 5, color, 0.95);
    const last = S.points[S.points.length - 1];
    let tipA = 1;
    if (el > STROKE.warnTime) tipA = 0.3 + 0.7 * Math.abs(Math.sin(el * 14));
    g.fillStyle(COLORS.ink, tipA); g.fillCircle(last.x, last.y, 5);
    g.lineStyle(2, 0xffffff, tipA * 0.8); g.strokeCircle(last.x, last.y, 7);
    if (el > STROKE.warnTime) { g.lineStyle(2, COLORS.danger, tipA); g.strokeCircle(last.x, last.y, S.id === 'zen' ? 20 : 12); }
    // 指の少し上に候補アイコン
    if (S.cand) {
      const ix = clamp(last.x, 30, 930), iy = Math.max(AREA.y0 - 20, last.y - 54);
      g.fillStyle(0x1d2a44, 0.2); g.fillRoundedRect(ix - 17, iy - 13, 36, 28, 7);
      this.drawShapeIcon(g, S.cand, ix, iy, 1);
    }
  }

  drawFx() {
    const g = this.gFx;
    for (const s of this.splashes) {
      const u = s.t / s.dur;
      g.fillStyle(s.color, 1 - u);
      g.fillCircle(s.x, s.y, s.r * (1 - u * 0.5));
    }
    for (const r of this.ripples) {
      const u = r.t / r.dur;
      g.lineStyle(3 * (1 - u), COLORS.ink, 1 - u);
      g.strokeCircle(r.x, r.y, 8 + r.max * u);
      g.lineStyle(2 * (1 - u), COLORS.inkLight, (1 - u) * 0.6);
      g.strokeCircle(r.x, r.y, 4 + r.max * 0.6 * u);
    }
    if (this.flashAt) { g.fillStyle(0xffffff, this.flashAt.t / 0.08 * 0.9); g.fillCircle(this.flashAt.x, this.flashAt.y, 26); }
    for (const s of this.shots) {
      if (s.t > s.dur) continue;
      s.trail.forEach((q, i) => { g.fillStyle(COLORS.ink, 0.15 + 0.5 * i / s.trail.length); g.fillCircle(q.x, q.y, 3 + 4 * i / s.trail.length); });
      g.fillStyle(COLORS.ink, 1); g.fillCircle(s.x, s.y, 7);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(s.x - 2, s.y - 2, 2);
    }
    // 三角：結晶化 → 自動照準 → 飛翔
    const ch = this.view.anchors().chest;
    for (const t of this.triFx) {
      const v = t.tri.verts;
      const cx = (v[0].x + v[1].x + v[2].x) / 3, cy = (v[0].y + v[1].y + v[2].y) / 3;
      const fly = clamp((t.t - 0.08) / (SHAPES.tri.delay - 0.08), 0, 1);
      const k = fly < 1 ? 1 - 0.6 * fly : 0.4;
      const pulse = t.t < 0.08 ? 1 + 0.15 * Math.sin(t.t / 0.08 * Math.PI) : 1;
      const px = lerp(cx, ch.x, fly * fly), py = lerp(cy, ch.y, fly * fly);
      const rot = fly * 2.5;
      const P = v.map(q => {
        const dx = (q.x - cx) * k * pulse, dy = (q.y - cy) * k * pulse;
        return { x: px + dx * Math.cos(rot) - dy * Math.sin(rot), y: py + dx * Math.sin(rot) + dy * Math.cos(rot) };
      });
      const al = t.t > SHAPES.tri.delay ? Math.max(0, 1 - (t.t - SHAPES.tri.delay) / 0.2) : 1;
      if (t.t < SHAPES.tri.delay) {
        g.lineStyle(2, COLORS.red, 0.5);
        this.dash(g, px, py, ch.x, ch.y, 6, 6, -t.t * 200);
      }
      g.fillStyle(COLORS.red, 0.75 * al); g.fillTriangle(P[0].x, P[0].y, P[1].x, P[1].y, P[2].x, P[2].y);
      const inner = P.map(q => ({ x: px + (q.x - px) * 0.55, y: py + (q.y - py) * 0.55 }));
      g.fillStyle(COLORS.ink, 0.8 * al); g.fillTriangle(inner[0].x, inner[0].y, inner[1].x, inner[1].y, inner[2].x, inner[2].y);
      g.lineStyle(3, 0xffffff, 0.9 * al); g.strokeTriangle(P[0].x, P[0].y, P[1].x, P[1].y, P[2].x, P[2].y);
      g.lineStyle(1.5, 0xffffff, 0.6 * al);
      for (const q of P) g.lineBetween(px, py, q.x, q.y);
    }
    // 大きな鉛筆線の亀裂
    for (const c of this.cracks) {
      const u = c.t / 0.6;
      g.lineStyle(4, 0x1d2a44, 1 - u);
      let seed = c.seed;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 6; i++) {
        let x = c.x, y = c.y, a = i / 6 * Math.PI * 2 + rnd();
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { a += (rnd() - 0.5); x += Math.cos(a) * 14 * Math.min(1, u * 4); y += Math.sin(a) * 14 * Math.min(1, u * 4); g.lineTo(x, y); }
        g.strokePath();
      }
    }
    // ダメージ数字
    let di = 0;
    for (const n of this.dmgNums) {
      const t = n.t - n.delay;
      if (t < 0) continue;
      const tx = this.dmgPool[di++];
      if (!tx) break;
      tx.setText(`-${n.v}`).setPosition(ch.x + 40 + (n.big ? 10 : 0), ch.y - 10 - t * 40).setAlpha(1 - t / 0.8).setVisible(true);
      this.tscale(tx, n.big ? 1.4 : 1);
    }
    // 被弾：画面周辺の赤い鉛筆線
    if (this.edgeHit > 0) {
      const a = this.edgeHit;
      g.lineStyle(5, COLORS.red, a * 0.8);
      let seed = this.edgeSeed;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 26; i++) {
        const side = i % 4;
        let x, y, dx, dy;
        if (side === 0) { x = rnd() * VW; y = 6 + rnd() * 16; dx = 30 + rnd() * 40; dy = (rnd() - 0.5) * 10; }
        else if (side === 1) { x = rnd() * VW; y = VH - 6 - rnd() * 16; dx = 30 + rnd() * 40; dy = (rnd() - 0.5) * 10; }
        else if (side === 2) { x = 6 + rnd() * 16; y = rnd() * VH; dx = (rnd() - 0.5) * 10; dy = 30 + rnd() * 40; }
        else { x = VW - 6 - rnd() * 16; y = rnd() * VH; dx = (rnd() - 0.5) * 10; dy = 30 + rnd() * 40; }
        g.lineBetween(x, y, x + dx, y + dy);
      }
    }
  }

  drawTutGuide() {
    const T = this.tut;
    if (!T || T.success) return;
    const g = this.gFx;
    const big = T.fails >= 2;
    const s = big ? 1.35 : 1;
    let path = null;
    if (T.step === 1) path = [{ x: 480 - 80 * s, y: 350 }, { x: 480 + 80 * s, y: 350 }];
    else if (T.step === 2) { path = []; for (let i = 0; i <= 32; i++) { const a = -Math.PI / 2 + i / 32 * Math.PI * 2; path.push({ x: 480 + Math.cos(a) * 55 * s, y: 350 + Math.sin(a) * 55 * s }); } }
    else if (T.step === 4) path = [{ x: 480, y: 330 - 70 * s }, { x: 480 - 75 * s, y: 330 + 55 * s }, { x: 480 + 75 * s, y: 330 + 55 * s }, { x: 480, y: 330 - 70 * s }];
    if (!path) return;
    const tnow = this.time.now / 1000;
    g.lineStyle(big ? 5 : 3, COLORS.guide, 0.55 + 0.2 * Math.sin(tnow * 4));
    for (let i = 1; i < path.length; i++) this.dash(g, path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, 8, 8, -tnow * 30);
    // 始点
    g.fillStyle(COLORS.guide, 0.9); g.fillCircle(path[0].x, path[0].y, big ? 8 : 6);
    // 実演：ペン先がゆっくりなぞる
    if (T.fails >= 4 || T.step === 4) {
      const dur = T.fails >= 4 ? 2.4 : 1.6;
      const u = (T.demoT % (dur + 0.8)) / dur;
      if (u <= 1) {
        const L = pathLength(path);
        let d = u * L, i = 1;
        for (; i < path.length; i++) { const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); if (d <= seg) break; d -= seg; }
        i = Math.min(i, path.length - 1);
        const a = path[i - 1], b = path[i];
        const seg = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const px = a.x + (b.x - a.x) * d / seg, py = a.y + (b.y - a.y) * d / seg;
        const partial = path.slice(0, i).concat([{ x: px, y: py }]);
        this.polyline(g, partial, 4, COLORS.ink, 0.45);
        g.fillStyle(0x24365e, 0.9); g.fillTriangle(px, py, px + 8, py - 20, px + 16, py - 14);
        g.lineStyle(10, 0x24365e, 0.9); g.lineBetween(px + 12, py - 17, px + 40, py - 52);
      }
    }
  }

  drawHud(st) {
    const B = this.battle;
    const inPlay = B && ['BATTLE', 'TUTORIAL', 'VICTORY', 'DEFEAT'].includes(st) && st !== 'PRACTICE';
    this.hudVisible(!!inPlay);
    const g = this.gHud;
    // メッセージ（同時1件）
    if (this.msg.t > 0 && st !== 'INTRO') {
      const a = Math.min(1, this.msg.t / 0.2);
      this.tMsg.setText(this.msg.text).setAlpha(a).setVisible(true);
      const w = this.tMsg.width / (this.textRes || 1) + 28;
      g.fillStyle(0xfbf7ec, 0.92 * a); g.fillRoundedRect(480 - w / 2, 156, w, 32, 16);
      g.lineStyle(2, 0x1d2a44, 0.5 * a); g.strokeRoundedRect(480 - w / 2, 156, w, 32, 16);
    } else this.tMsg.setVisible(false);
    if (this.bigText.t > 0) {
      const u = 1 - this.bigText.t / this.bigText.dur;
      const sc = u < 0.15 ? 0.7 + 2 * u : 1;
      this.tscale(this.tBig, sc).setText(this.bigText.text).setAlpha(Math.min(1, this.bigText.t / 0.25)).setVisible(true);
    } else this.tBig.setVisible(false);
    if (!inPlay) return;
    const P = B.player, Bo = B.boss;
    // 上部の帯
    g.fillStyle(0x1d2a44, 0.42); g.fillRect(0, 0, VW, 46);
    // 怪獣体力
    const bx = 300, by = 20, bw = 360, bh = 14;
    g.fillStyle(0x0d1322, 0.85); g.fillRoundedRect(bx - 3, by - 3, bw + 6, bh + 6, 5);
    g.fillStyle(0xf6b5b8, 1); g.fillRect(bx, by, bw * this.bossBarLag, bh);
    const ratio = Bo.hp / Bo.max;
    g.fillStyle(COLORS.red, 1); g.fillRect(bx, by, bw * ratio, bh);
    g.fillStyle(0xffffff, 0.25); g.fillRect(bx, by, bw * ratio, 4);
    g.lineStyle(2, 0xfbf7ec, 0.9);
    for (const th of B.thresholds) { const x = bx + bw * th / Bo.max; g.lineBetween(x, by - 4, x, by + bh + 4); }
    this.tPhase.setText(`PHASE ${Bo.phase}`);
    this.tScore.setText(st === 'TUTORIAL' ? 'れんしゅう' : `SCORE ${B.score}`);
    // 時間
    if (st === 'TUTORIAL') this.tTime.setText('');
    else {
      const left = Math.max(0, Math.ceil(BAL.timeLimit - B.time));
      this.tTime.setText(String(left));
      this.tTime.setColor(left <= 30 ? '#ff7a6b' : left <= 60 ? '#f5a442' : '#fdf6e3');
    }
    // 下部の帯（紙の帯）
    g.fillStyle(0xfbf7ec, 0.9); g.fillRoundedRect(14, 468, VW - 28, 66, 14);
    g.lineStyle(2, 0x1d2a44, 0.35); g.strokeRoundedRect(14, 468, VW - 28, 66, 14);
    // 耐久値：紙のハート
    const low = P.hp <= 30;
    const hx = 46, hy = 497;
    const hs = 1 + (low ? 0.06 * Math.sin(this.time.now / 300) : 0);
    g.fillStyle(low ? COLORS.red : 0xe86a7a, 1);
    g.fillCircle(hx - 6 * hs, hy - 3 * hs, 8 * hs); g.fillCircle(hx + 6 * hs, hy - 3 * hs, 8 * hs);
    g.fillTriangle(hx - 13.5 * hs, hy, hx + 13.5 * hs, hy, hx, hy + 14 * hs);
    g.lineStyle(2, 0x1d2a44, 0.6); g.strokeCircle(hx - 6 * hs, hy - 3 * hs, 8 * hs);
    this.tHp.setText(String(P.hp)).setColor(low ? '#d8343b' : '#1d2a44');
    g.fillStyle(0x1d2a44, 0.15); g.fillRoundedRect(40, 515, 200, 8, 4);
    g.fillStyle(low ? COLORS.red : 0xe86a7a, 1); g.fillRoundedRect(40, 515, Math.max(0.01, 200 * P.hp / P.max), 8, 4);
    if (P.invuln > 0) { g.lineStyle(2, COLORS.red, 0.5); g.strokeRoundedRect(36, 480, 210, 48, 8); }
    // インク
    const ix = 330, iy = 499, iw = 300, ih = 14;
    g.fillStyle(0x1d2a44, 0.15); g.fillRoundedRect(ix, iy, iw, ih, 7);
    g.fillStyle(COLORS.ink, 1); g.fillRoundedRect(ix, iy, Math.max(0.01, iw * P.ink / BAL.inkMax), ih, 7);
    g.fillStyle(0xffffff, 0.3); g.fillRect(ix + 4, iy + 2, Math.max(0, iw * P.ink / BAL.inkMax - 8), 3);
    for (const k of [12, 24, 30]) { const x = ix + iw * k / BAL.inkMax; g.lineStyle(1, 0x1d2a44, 0.25); g.lineBetween(x, iy, x, iy + ih); }
    this.tInk.setText(`${Math.floor(P.ink)} / ${BAL.inkMax}`);
    if (this.inkFlash > 0) { g.lineStyle(3, COLORS.red, Math.min(1, this.inkFlash * 2)); g.strokeRoundedRect(ix - 4, iy - 4, iw + 8, ih + 8, 9); }
    const cand = this.stroke && this.stroke.cand;
    if (cand) {
      const need = SHAPES[cand].ink;
      const x = ix + iw * need / BAL.inkMax;
      g.lineStyle(3, P.ink >= need ? 0x1d2a44 : COLORS.red, 1); g.lineBetween(x, iy - 5, x, iy + ih + 5);
      this.tInkNeed.setText(`${need}`).setPosition(x, 524).setColor(P.ink >= need ? '#1d2a44' : '#d8343b');
    } else this.tInkNeed.setText('');
    // 集中：ペン先アイコン×3
    for (let i = 0; i < 3; i++) {
      const x = 764 + i * 34, y = 509;
      const lit = P.focus > i;
      const pul = lit && this.focusPulse > 0 ? 1 + 0.25 * this.focusPulse : 1;
      g.fillStyle(lit ? COLORS.ink : 0xd7d2c6, 1);
      g.fillTriangle(x - 9 * pul, y - 8 * pul, x + 9 * pul, y - 8 * pul, x, y + 13 * pul);
      g.fillRect(x - 9 * pul, y - 16 * pul, 18 * pul, 8 * pul);
      g.lineStyle(1.5, 0x1d2a44, 0.6); g.strokeTriangle(x - 9 * pul, y - 8 * pul, x + 9 * pul, y - 8 * pul, x, y + 13 * pul);
      g.fillStyle(0xffffff, lit ? 0.9 : 0.6); g.fillCircle(x, y - 1, 2);
    }
    const full = P.focus >= 3;
    const tx = 885, ty = 504;
    const tp = full ? 1 + 0.08 * Math.sin(this.time.now / 120) : 1;
    g.fillStyle(full ? COLORS.red : 0xd7d2c6, full ? 1 : 0.8);
    g.fillTriangle(tx, ty - 16 * tp, tx - 15 * tp, ty + 11 * tp, tx + 15 * tp, ty + 11 * tp);
    g.lineStyle(2, full ? 0xffffff : 0x1d2a44, full ? 0.9 : 0.3);
    g.strokeTriangle(tx, ty - 16 * tp, tx - 15 * tp, ty + 11 * tp, tx + 15 * tp, ty + 11 * tp);
    if (full) { g.lineStyle(3, COLORS.red, 0.3 + 0.2 * Math.sin(this.time.now / 120)); g.strokeCircle(tx, ty, 26); }
    // コンボ
    if (B.combo >= 2 && st === 'BATTLE') {
      const m = B.multiplier();
      this.tCombo.setText(`${B.combo} コンボ${m > 1 ? `  ×${m.toFixed(1)}` : ''}`).setVisible(true);
    } else this.tCombo.setText('');
    // フェーズ移行中の暗転
    if (B.state === 'transition') { g.fillStyle(0x1d2a44, 0.12); g.fillRect(AREA.x0, AREA.y0, AREA.x1 - AREA.x0, AREA.y1 - AREA.y0); }
  }

  drawOverlay() {
    const g = this.gOver;
    if (this.state === 'RESUMING') {
      const u = this.resumeT / 0.6;
      g.fillStyle(0x1d2a44, 0.25 * u); g.fillRect(0, 0, VW, VH);
      g.lineStyle(6, 0xfbf7ec, 0.9);
      g.beginPath(); g.arc(480, 300, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u, false); g.strokePath();
    }
    if (this.inkBlobs) {
      for (const b of this.inkBlobs) {
        if (b.r <= 0) continue;
        g.fillStyle(0x0d1220, 0.82);
        g.fillCircle(b.x, b.y, b.r);
        g.fillCircle(b.x + b.r * 0.6, b.y + b.r * 0.3, b.r * 0.5);
        g.fillCircle(b.x - b.r * 0.4, b.y - b.r * 0.5, b.r * 0.4);
      }
    }
  }

  drawKept() {
    const g = this.gKept;
    for (const s of this.keptStrokes) this.polyline(g, s, 3, COLORS.ink, 0.28);
  }
}
