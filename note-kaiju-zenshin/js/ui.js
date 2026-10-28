// DOM のメニュー（タイトル・設定・ポーズ・結果・確認）。HUD は Phaser 側。
import { DIFF, VERSION, ADVICE, FAIL_TEXT, QUALITY } from './config.js';
import { Save } from './save.js';
import { drawDoodle } from './three-view.js';
import { buildArt, isUsable, autoName, packStrokes, unpackStrokes, drawCustomDoodle } from './custom-monster.js';
import { Zen } from './zen.js';
import { figure } from './guide.js';

// 結果画面の「→ ○○で」：1つ上の むずかしさ（いちばん上なら やさしいへ）
const DIFF_ORDER = ['easy', 'normal', 'hard', 'oni'];
const nextDiff = d => DIFF_ORDER[(DIFF_ORDER.indexOf(d) + 1) % DIFF_ORDER.length];

const $ = (id) => document.getElementById(id);
const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pct = (x) => `${Math.round(x * 100)}%`;

export class UI {
  constructor(ctl) {
    this.ctl = ctl;
    this.busy = false;
    this.bind();
  }

  get scene() { return this.ctl.scene; }
  click() { this.ctl.audio.unlock(); this.ctl.audio.play('button'); }

  // 二重押し防止つきのボタン
  btn(id, fn) {
    const el = $(id);
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.busy || el.disabled) return;
      this.busy = true;
      setTimeout(() => { this.busy = false; }, 350);
      this.click();
      fn();
    });
  }

  bind() {
    this.btn('btnStart', () => this.startGame());
    this.btn('btnTwo', () => this.startGame(true));
    this.btn('btnHow', () => { if (this.ctl.isPortrait()) { this.showRotate(true); return; } this.scene.startTutorial(true); });
    this.btn('btnPractice', () => { if (this.ctl.isPortrait()) { this.showRotate(true); return; } this.scene.startPractice(); });
    this.btn('btnSettings', () => this.showSettings());
    this.btn('btnDraw', () => this.openDrawer());
    this.bindDrawer();
    document.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => {
      this.click();
      Save.data.lastDiff = b.dataset.diff;
      Save.write();
      this.refreshTitle();
    }));
    // 設定
    this.btn('btnSettingsClose', () => this.hideSettings());
    for (const k of ['master', 'bgm', 'se']) {
      $('vol_' + k).addEventListener('input', (e) => {
        Save.data.volume[k] = Number(e.target.value) / 100;
        this.ctl.audio.setVolume(Save.data.volume);
        $('volv_' + k).textContent = e.target.value;
      });
      $('vol_' + k).addEventListener('change', () => { Save.write(); this.ctl.audio.unlock(); this.ctl.audio.play('block', { combo: 3 }); });
    }
    document.querySelectorAll('[data-quality]').forEach(b => b.addEventListener('click', () => {
      this.click();
      const q = b.dataset.quality;
      Save.data.quality = q === 'auto' ? null : q;
      Save.write();
      this.ctl.applyQuality();
      this.refreshSettings();
    }));
    const toggle = (id, key, after) => $(id).addEventListener('change', (e) => { Save.data[key] = e.target.checked; Save.write(); after && after(); this.syncToggles(); });
    toggle('optReduce', 'reduceFx', () => this.ctl.applyFx());
    toggle('optGuide', 'shapeGuide', () => { if (this.scene.battle) this.scene.battle.guideSetting = Save.data.shapeGuide; });
    toggle('optDmg', 'damageNumbers');
    toggle('optZenGuide', 'zenGuide', () => this.refreshPadGuide());
    toggle('pOptZenGuide', 'zenGuide');
    toggle('pOptReduce', 'reduceFx', () => this.ctl.applyFx());
    toggle('pOptGuide', 'shapeGuide', () => { if (this.scene.battle) this.scene.battle.guideSetting = Save.data.shapeGuide; });
    $('pVol').addEventListener('input', (e) => { Save.data.volume.master = Number(e.target.value) / 100; this.ctl.audio.setVolume(Save.data.volume); });
    $('pVol').addEventListener('change', () => Save.write());
    this.btn('btnReset', () => this.confirm('記録を消しますか？', '最高スコア・最短勝利時間・プレイ回数・勝利回数・チュートリアル完了の記録が消えます。設定は残ります。', '消す', () => {
      const ok = Save.resetRecords();
      this.toast(ok ? '記録を消しました' : '保存領域が使えないため、この画面の間だけ消しました');
      this.refreshTitle();
    }));
    // ポーズ
    $('pauseBtn').addEventListener('click', (e) => { e.preventDefault(); this.click(); this.scene.togglePause(); });
    this.btn('btnResume', () => this.scene.resume());
    this.btn('btnRestart', () => { this.hidePause(); this.ctl.scene.retry(); });
    this.btn('btnPauseTitle', () => { this.hidePause(); this.scene.toTitle(); });
    // 結果
    this.btn('btnAgain', () => this.scene.retry());
    this.btn('btnDiff', () => {
      const next = nextDiff(Save.data.lastDiff);
      this.confirm('難易度を変えますか？', `「${DIFF[next].name}」で もう一度あそびます。`, `${DIFF[next].name}にする`, () => {
        Save.data.lastDiff = next; Save.write(); this.scene.retry();
      });
    });
    this.btn('btnResTitle', () => this.scene.toTitle());
    this.btn('btnImage', () => this.showImage());
    this.btn('btnImgClose', () => { $('imageModal').hidden = true; });
    // チュートリアルの選択
    this.btn('btnTutRetry', () => this.scene.tutRetry());
    this.btn('btnTutSkip', () => this.scene.tutSkip());
    this.btn('practiceBack', () => this.scene.toTitle());
    // 確認
    this.btn('btnConfirmNo', () => { $('confirm').hidden = true; });
    this.btn('btnConfirmYes', () => { $('confirm').hidden = true; const f = this._confirmFn; this._confirmFn = null; f && f(); });
    this.btn('btnRotateClose', () => this.showRotate(false));
    $('btnReload').addEventListener('click', () => location.reload());
  }

  // タイトルの「はじめる」と 拍手。カメラのときは 3・2・1 のあとで始める
  // two：ふたりで（同じ紙に 1P と 2P が 書いて、点数を きそう）
  startGame(two) {
    if (this.ctl.isPortrait()) { this.showRotate(true); return; }
    if (this.counting || !this.scene || this.scene.state !== 'TITLE') return;
    this.counting = true;
    const text = two ? 'ふたりで ならんで かまえてね<br>左の人が 1P、右の人が 2P' : 'はなれて かまえてね<br>左手を あげると、右手で かけるよ';
    const wait = window.Body ? window.Body.countdown(3, text) : Promise.resolve();
    wait.then(() => {
      this.counting = false;
      this.scene.startFromTitle(two);
    });
  }

  // 拍手（カメラ）：タイトル＝はじめる、怪獣を描く＝できた、ポーズ＝つづける、結果＝もう一度
  onClap() {
    const s = this.scene;
    if (!s || !$('confirm').hidden || !$('settings').hidden || !$('imageModal').hidden || !$('rotate').hidden) return;
    if (this.drawerOpen()) { this.zenDone(); return; }
    if (s.state === 'TITLE' && this.titleOpen()) { this.click(); this.startGame(this.ctl.people() >= 2); }   // 2人 うつっていれば ふたりで
    else if (s.state === 'PAUSED') { this.click(); s.resume(); }
    else if (s.state === 'RESULT') { this.click(); s.retry(); }
  }

  titleOpen() { return !$('title').hidden && $('settings').hidden && $('drawer').hidden && $('confirm').hidden; }
  drawerOpen() { return !$('drawer').hidden; }

  // ---------- 表示切替 ----------
  hideAll() {
    for (const id of ['title', 'settings', 'pause', 'result', 'confirm', 'imageModal', 'drawer']) $(id).hidden = true;
  }

  setLoading(p, text) {
    $('loadBar').style.width = `${Math.round(p * 100)}%`;
    if (text) $('loadText').textContent = text;
  }
  hideLoading() { $('loading').hidden = true; }

  showTitle() {
    this.hideAll();
    $('title').hidden = false;
    this.refreshTitle();
  }

  refreshTitle() {
    const d = Save.data;
    document.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('on', b.dataset.diff === d.lastDiff));
    const best = d.best[d.lastDiff];
    $('bestLine').textContent = best.score > 0
      ? `最高記録（${DIFF[d.lastDiff].name}）  ${best.score.toLocaleString()} 点${best.timeMs ? ` ／ 最短 ${fmtTime(best.timeMs)}` : ''}`
      : `最高記録（${DIFF[d.lastDiff].name}）  まだありません`;
    const two = Zen.on && this.ctl.people() >= 2;
    $('btnStart').textContent = Zen.on && !two ? 'はじめる 👏' : 'ひとりで';
    $('btnTwo').textContent = two ? 'ふたりで 👏' : 'ふたりで';
    $('twoNote').textContent = Zen.on ? (two ? '👏 はくしゅで ふたりで スタート' : '2人 うつれば ふたりで（左の人が 1P）') : 'マウス・タッチは 左半分が 1P、右半分が 2P';
    $('startNote').textContent = d.tutorialDone ? '' : 'はじめてなら、まず かんたんな練習から';
    $('foeLine').textContent = `いまの相手：${this.ctl.monsterName || 'ラクガキドン'}${d.useCustom ? '（きみの絵）' : ''}`;
    $('playCount').textContent = d.plays ? `あそんだ回数 ${d.plays} ／ 封印 ${d.wins}` : '';
  }

  setStartEnabled(on) { $('btnTwo').disabled = !on; $('btnStart').disabled = !on; $('btnHow').disabled = !on; $('btnPractice').disabled = !on; }

  showSettings() {
    $('settings').hidden = false;
    this.refreshSettings();
  }
  hideSettings() { $('settings').hidden = true; }
  refreshSettings() {
    const d = Save.data;
    for (const k of ['master', 'bgm', 'se']) { $('vol_' + k).value = Math.round(d.volume[k] * 100); $('volv_' + k).textContent = Math.round(d.volume[k] * 100); }
    const q = d.quality || 'auto';
    document.querySelectorAll('[data-quality]').forEach(b => b.classList.toggle('on', b.dataset.quality === q));
    $('qualityNow').textContent = d.quality ? '' : `（いまは ${QUALITY[this.ctl.view.quality].name}）`;
    this.syncToggles();
    $('saveState').textContent = Save.available ? '' : 'この環境では記録を保存できません（遊ぶことはできます）';
    $('version').textContent = `v${VERSION}`;
  }
  syncToggles() {
    const d = Save.data;
    $('optReduce').checked = d.reduceFx; $('pOptReduce').checked = d.reduceFx;
    $('optGuide').checked = d.shapeGuide; $('pOptGuide').checked = d.shapeGuide;
    $('optDmg').checked = d.damageNumbers;
    $('optZenGuide').checked = d.zenGuide; $('pOptZenGuide').checked = d.zenGuide;
  }

  showPause(reason) {
    $('pause').hidden = false;
    $('pVol').value = Math.round(Save.data.volume.master * 100);
    this.syncToggles();
    const msg = { resize: '画面の大きさが変わったので止めました', hidden: 'ほかの画面に移ったので止めました', rotate: '横向きに戻したら つづけられます', context: '描画が中断されました。つづけると再開します', gesture: '両手を あげたので 止めました' }[reason] || '';
    $('pauseReason').textContent = msg;
    $('pauseZen').hidden = !Zen.on;
  }
  hidePause() { $('pause').hidden = true; }

  setPauseButton(on) { $('pauseBtn').hidden = !on; }
  setPracticeBack(on) { $('practiceBack').hidden = !on; }
  showTutChoice() { $('tutChoice').hidden = false; }
  hideTutChoice() { $('tutChoice').hidden = true; }
  showRotate(on) { $('rotate').hidden = !on; }

  confirm(title, body, yes, fn) {
    $('confirmTitle').textContent = title;
    $('confirmBody').textContent = body;
    $('btnConfirmYes').textContent = yes;
    this._confirmFn = fn;
    $('confirm').hidden = false;
  }

  toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  showError(title, body) {
    $('errTitle').textContent = title;
    $('errBody').textContent = body;
    $('error').hidden = false;
  }

  // ---------- 怪獣を描く ----------
  // drawPad の座標は 0〜1。マウス・タッチ（pointer イベント）も 体のペン（zenPadTick）も 同じ padBegin / padMove / padEnd を使う
  bindDrawer() {
    const pad = $('drawPad');
    this.drawStrokes = [];
    this.padCur = null;
    this.padClock = 0;
    const pt = (e) => { const r = pad.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    pad.addEventListener('pointerdown', (e) => {
      if (this.padCur) return;
      e.preventDefault();
      this.ctl.audio.unlock();
      pad.setPointerCapture(e.pointerId);
      this.padBegin(pt(e), e.pointerId);
    });
    pad.addEventListener('pointermove', (e) => {
      if (!this.padCur || e.pointerId !== this.padCur.id) return;
      this.padMove(pt(e));
    });
    const end = (e) => {
      if (!this.padCur || e.pointerId !== this.padCur.id) return;
      this.padEnd();
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    this.btn('btnDrawUndo', () => { this.drawStrokes.pop(); this.redrawPad(); this.schedulePreview(); });
    this.btn('btnDrawClear', () => { this.padCur = null; this.drawStrokes = []; this.redrawPad(); this.schedulePreview(); });
    this.btn('btnDrawSample', () => {
      Save.data.useCustom = false; Save.write();
      this.ctl.applyMonster();
      this.padCur = null;
      $('drawer').hidden = true;
      this.refreshTitle();
      this.toast('見本の怪獣にもどしました');
    });
    this.btn('btnDrawCancel', () => { this.padCur = null; $('drawer').hidden = true; });
    this.btn('btnDrawDone', () => this.drawDone());
    // ぜんしん版：左手を挙げたまま 右手を左へ払う → ひとつもどす
    Zen.onUndo = () => { if (this.drawerOpen()) this.zenUndo(); };
    $('padGuideRows').innerHTML =
      `<div class="pgRow">${figure({ left: 'up', right: 'write' })}<span>左手を あげて 右手で かこう。<b>はくしゅ</b>で できた！</span></div>` +
      `<div class="pgRow">${figure({ left: 'up', right: 'swipe' })}<span>左手を あげて 右手を <b>ひだりへ ふる</b>と ひとつもどす</span></div>`;
  }

  drawDone() {
    if (!isUsable(this.drawStrokes)) { $('drawHint').textContent = 'もう少し大きく描いてね'; return; }
    this.padCur = null;
    Save.data.custom = packStrokes(this.drawStrokes.map(s => s.filter((_, i) => i % 2 === 0 || i === s.length - 1)));
    Save.data.customName = ($('drawName').value || '').trim().slice(0, 10) || autoName(this.drawStrokes);
    Save.data.useCustom = true;
    if (!Save.write()) this.toast('記録を保存できなかったので、この画面の間だけ使います');
    this.ctl.applyMonster();
    $('drawer').hidden = true;
    this.refreshTitle();
  }

  padBegin(p, id) {
    if (this.padCur) return;
    this.padCur = { id, pts: [p], t0: this.padClock };
    this.drawStrokes.push(this.padCur.pts);
    this.ctl.audio.play('penStart');
    this.redrawPad();
  }
  padMove(p) {
    const cur = this.padCur;
    if (!cur) return;
    const last = cur.pts[cur.pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004) return;
    if (cur.pts.length > 600) return;
    cur.pts.push(p);
    this.ctl.audio.play('pen', { speed: 200 });
    this.redrawPad();
  }
  padEnd() {
    if (!this.padCur) return;
    this.padCur = null;
    if (this.drawStrokes.length > 300) this.drawStrokes.shift();
    this.redrawPad();
    this.schedulePreview();
  }

  // ---------- 怪獣を描く：体のペン（ぜんしん版） ----------
  // 毎フレーム（シーンの update から）。左手を挙げている間だけ 書ける
  zenPadTick(dt) {
    this.padClock += dt;
    const p = [Zen.pen.x, Zen.pen.y];
    const cur = this.padCur;
    if (!Zen.leftUp) this.padLock = false;
    if (cur && cur.id === 'zen') { if (!Zen.writing) this.padEnd(); else this.padMove(p); }
    else if (!cur && Zen.writing && !this.padLock) this.padBegin(p, 'zen');
    // ペンの点が動いたときだけ 描きなおす
    const key = `${Math.round(p[0] * 400)},${Math.round(p[1] * 400)},${Zen.writing},${Zen.rVis},${this.drawStrokes.length}`;
    if (key !== this._padKey) { this._padKey = key; this.redrawPad(); }
    this.refreshPadGuide();
  }

  // 払った線は 書きかけの線に入っているので いっしょに消す。書きかけが短ければ その前の線を消す
  zenUndo() {
    const cur = this.padCur;
    let what = 'none';
    if (cur && cur.id === 'zen') {
      this.drawStrokes.splice(this.drawStrokes.indexOf(cur.pts), 1);
      this.padCur = null;
      if (this.padClock - cur.t0 > 0.6) what = 'cur';
    }
    if (what === 'none' && this.drawStrokes.length) { this.drawStrokes.pop(); what = 'last'; }
    this.padLock = true;
    this.ctl.audio.play('paper');
    $('drawHint').textContent = what === 'none' ? 'もどす線が ないよ' : 'ひとつ もどしたよ（左手を おろしてね）';
    this.redrawPad();
    this.schedulePreview();
    return what;
  }

  zenDone() {
    if (!Zen.quiet() || this.padCur) return;
    this.click();
    this.drawDone();
  }

  refreshPadGuide() {
    const g = $('padGuide');
    const show = Zen.on && Save.data.zenGuide;
    if (g.hidden !== !show) g.hidden = !show;
    if (!show) return;
    const s = Zen.status();
    const t = this.padLock && Zen.leftUp ? '左手を いちど おろしてね'
      : { writing: 'かいてる！', idle: '左手を あげると かけるよ', noLeft: '左手が うつってないよ', noRight: '右手が うつってないよ', nobody: 'からだが うつってないよ' }[s];
    const el = $('padStatus');
    if (el.textContent !== t) { el.textContent = t; el.className = s === 'writing' ? 'on' : ['noLeft', 'noRight', 'nobody'].includes(s) ? 'warn' : ''; }
  }

  openDrawer() {
    const D = Save.data;
    this.drawStrokes = (D.custom && unpackStrokes(D.custom)) || [];
    this.padCur = null; this.padLock = true;   // 開いたときに 左手が挙がっていても、いちど下ろすまで 書かない
    $('drawHint').textContent = '';
    $('drawName').value = D.customName || '';
    $('drawer').hidden = false;
    this.refreshPadGuide();
    // キャンバスの解像度を表示サイズに合わせる
    const pad = $('drawPad'), pv = $('drawPreview');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    requestAnimationFrame(() => {
      const r = pad.getBoundingClientRect();
      pad.width = Math.round(r.width * dpr); pad.height = Math.round(r.height * dpr);
      const r2 = pv.getBoundingClientRect();
      pv.width = Math.round(r2.width * dpr); pv.height = Math.round(r2.width * dpr);
      this.redrawPad();
      this.renderPreview();
    });
  }

  redrawPad() {
    const c = $('drawPad'), g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(95,150,215,0.35)'; g.lineWidth = Math.max(1, W / 400);
    for (let y = H / 14; y < H; y += H / 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = 'rgba(220,90,100,0.4)'; g.beginPath(); g.moveTo(W * 0.08, 0); g.lineTo(W * 0.08, H); g.stroke();
    // 足もとの目安
    g.setLineDash([W / 60, W / 60]); g.strokeStyle = 'rgba(29,42,68,0.25)';
    g.beginPath(); g.moveTo(W * 0.15, H * 0.92); g.lineTo(W * 0.85, H * 0.92); g.stroke(); g.setLineDash([]);
    if (!this.drawStrokes.length) {
      g.fillStyle = 'rgba(29,42,68,0.35)'; g.font = `700 ${Math.round(W / 22)}px "Zen Maru Gothic", sans-serif`; g.textAlign = 'center';
      g.fillText('ここに 怪獣を描いてね', W / 2, H * 0.45);
      g.font = `${Math.round(W / 30)}px "Zen Maru Gothic", sans-serif`;
      g.fillText('点線が地面です', W / 2, H * 0.89);
    }
    g.strokeStyle = '#1d2a44'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = W * 0.012;
    for (const s of this.drawStrokes) {
      g.beginPath();
      s.forEach((p, i) => { if (i) g.lineTo(p[0] * W, p[1] * H); else g.moveTo(p[0] * W, p[1] * H); });
      if (s.length === 1) g.lineTo(s[0][0] * W + 0.5, s[0][1] * H);
      g.stroke();
    }
    // 体のペンの点：書いていないときは 中が空いた うすい丸、書いているときは インク色の 太い丸
    if (Zen.on && Zen.rVis && !$('drawer').hidden) {
      const x = Zen.pen.x * W, y = Zen.pen.y * H;
      if (this.padCur && this.padCur.id === 'zen') {
        g.fillStyle = 'rgba(47,91,216,0.25)'; g.beginPath(); g.arc(x, y, W * 0.03, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2f5bd8'; g.beginPath(); g.arc(x, y, W * 0.017, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = W * 0.004; g.beginPath(); g.arc(x, y, W * 0.021, 0, Math.PI * 2); g.stroke();
      } else {
        g.strokeStyle = 'rgba(29,42,68,0.45)'; g.lineWidth = W * 0.005; g.beginPath(); g.arc(x, y, W * 0.02, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(29,42,68,0.35)'; g.beginPath(); g.arc(x, y, W * 0.004, 0, Math.PI * 2); g.fill();
      }
    }
  }

  schedulePreview() {
    clearTimeout(this._pvT);
    this._pvT = setTimeout(() => this.renderPreview(), 60);
  }

  renderPreview() {
    const c = $('drawPreview'), g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const ok = isUsable(this.drawStrokes);
    $('btnDrawDone').disabled = !ok;
    if (!ok) {
      $('drawHint').textContent = this.drawStrokes.length ? 'もう少し大きく描いてね' : '';
      $('drawName').placeholder = '';
      return;
    }
    let art;
    try { art = buildArt(this.drawStrokes); } catch (e) { $('drawHint').textContent = 'うまく色をつけられませんでした'; return; }
    $('drawHint').textContent = art.eyes ? '' : '';
    $('drawName').placeholder = autoName(this.drawStrokes);
    const a = art.aspect, m = 0.9;
    let w = W * m, h = w / a;
    if (h > H * m) { h = H * m; w = h * a; }
    const x = (W - w) / 2, y = (H - h) / 2;
    g.save(); g.globalAlpha = 0.25; g.drawImage(art.mask, x + W * 0.02, y + H * 0.03, w, h); g.restore();
    g.drawImage(art.mask, x, y, w, h);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1d2a44'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(art.color, x, y, w, h);
    // 弱点
    const wx = x + art.weak.u * w, wy = y + art.weak.v * h, wr = art.weak.r * h * 0.9;
    g.fillStyle = 'rgba(216,52,59,0.85)'; g.beginPath(); g.arc(wx, wy, wr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#9e1c22'; g.lineWidth = Math.max(1, wr * 0.15); g.beginPath();
    for (let i = 0; i < 20; i++) { const t = i * 0.7, r = wr * (0.2 + (i % 5) * 0.15); g.lineTo(wx + Math.cos(t) * r, wy + Math.sin(t) * r); }
    g.stroke();
  }

  // ---------- 結果 ----------
  showResult(s) {
    this.hideAll();
    this.summary = s;
    const win = s.result === 'win';
    $('result').hidden = false;
    $('result').classList.toggle('lose', !win);
    $('resHead').textContent = win ? '今日の落書き、封印完了' : (s.why === 'time' ? '時間切れ…' : 'インクがつきた…');
    $('resRank').textContent = win ? s.rank : '—';
    $('resRank').className = 'rank' + (win ? ' r' + s.rank : ' none');
    $('resScore').textContent = s.score.toLocaleString();
    $('resNew').hidden = !(s.newScore || s.newTime);
    $('resNew').textContent = s.newScore && s.newTime ? '最高スコア・最短記録 更新！' : s.newScore ? '最高スコア 更新！' : '最短記録 更新！';
    const rows = [
      ['難易度', DIFF[s.diff].name],
      ['戦闘時間', fmtTime(s.timeMs)],
      ['被弾回数', `${s.hits} 回`],
      ['防御成功率', pct(s.defRate)],
      ['認識成功率', pct(s.recRate)],
      ['最大コンボ', `${s.maxCombo}`],
      ['使った図形', `線 ${s.used.line} ／ 丸 ${s.used.circle} ／ 三角 ${s.used.tri}`],
    ];
    if (win) {
      const b = s.bonus;
      rows.push(['ボーナス', `撃破 ${b.kill} ＋ 耐久 ${b.hp} ＋ 時間 ${b.time}${b.noDamage ? ` ＋ ノーダメージ ${b.noDamage}` : ''}${b.recog ? ` ＋ 認識 ${b.recog}` : ''}`]);
    } else {
      rows.push(['怪獣の残り体力', `${s.bossHp} / ${s.bossMax}`]);
      if (s.topFail) rows.push(['いちばん多かった失敗', FAIL_TEXT[s.topFail]]);
    }
    $('resStats').innerHTML = rows.map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join('');
    $('resAdvice').hidden = win || !s.topFail;
    $('resAdvice').textContent = !win && s.topFail ? `ヒント：${ADVICE[s.topFail]}` : '';
    $('btnDiff').textContent = `→ ${DIFF[nextDiff(s.diff)].name}で`;
    $('resZen').hidden = !Zen.on;
    // ふたりで：勝ち負けを 上に、1P・2P の 点数を 出す
    const two = !!s.two;
    for (const id of ['btnDiff', 'btnImage']) $(id).hidden = two;
    $('btnAgain').textContent = two ? 'もういちど（R）' : 'もう一度（R）';
    $('btnResTitle').textContent = two ? 'タイトルへ（Esc）' : 'タイトルへ';
    if (two) {
      const w = s.winner;
      $('resHead').innerHTML = `<span style="color:${w < 0 ? '#1d2a44' : ['#1a9e90', '#d63c9a'][w]}">${w < 0 ? 'ひきわけ' : (w + 1) + 'P の勝ち!'}</span>`;
      $('resRank').textContent = w < 0 ? '＝' : (w + 1) + 'P';
      $('resRank').className = 'rank';
      $('resScore').innerHTML = `<span style="color:#1a9e90">${s.pts[0].toLocaleString()}</span> － <span style="color:#d63c9a">${s.pts[1].toLocaleString()}</span>`;
      $('resStats').innerHTML = [['1P の 点数', s.pts[0].toLocaleString()], ['2P の 点数', s.pts[1].toLocaleString()], ['怪獣', win ? '封印した！' : `残り ${s.bossHp} / ${s.bossMax}`], ['戦闘時間', fmtTime(s.timeMs)], ['点数の きまり', '守ると 線100・丸80、三角が 当たると 250']]
        .map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join('');
      $('resAdvice').hidden = true;
    }
    if (s.saveFailed) this.toast('記録を保存できませんでした');
  }

  // 結果画像（ブラウザ内で生成。自動送信なし）
  showImage() {
    const s = this.summary;
    if (!s) return;
    const W = 1200, H = 675;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#7a553a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fbf7ec'; roundRect(g, 40, 30, W - 80, H - 60, 18); g.fill();
    g.strokeStyle = 'rgba(95,150,215,0.5)'; g.lineWidth = 2;
    for (let y = 110; y < H - 40; y += 36) { g.beginPath(); g.moveTo(40, y); g.lineTo(W - 40, y); g.stroke(); }
    g.strokeStyle = 'rgba(220,90,100,0.6)'; g.beginPath(); g.moveTo(130, 30); g.lineTo(130, H - 30); g.stroke();
    // 落書きと筆跡
    const dc = document.createElement('canvas'); dc.width = dc.height = 512;
    if (this.ctl.strokes) drawCustomDoodle(dc.getContext('2d'), 512, 512, this.ctl.strokes, 0, this.ctl.art);
    else drawDoodle(dc.getContext('2d'), 512, 512, s.result !== 'win', 0);
    const strokes = this.scene.keptStrokes || [];
    g.save();
    g.translate(720, 120);
    g.strokeStyle = 'rgba(47,91,216,0.35)'; g.lineWidth = 3; g.lineCap = 'round';
    for (const st of strokes) {
      g.beginPath();
      st.forEach((p, i) => { const x = (p.x - 60) / 840 * 420, y = (p.y - 190) / 265 * 380 + 40; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    }
    g.drawImage(dc, 30, 20, 360, 360);
    g.restore();
    const win = s.result === 'win';
    g.fillStyle = '#1d2a44';
    g.font = '700 46px "Yomogi", "Zen Maru Gothic", sans-serif';
    g.fillText('ノートの怪獣', 160, 92);
    g.font = '700 30px "Zen Maru Gothic", sans-serif';
    g.fillText(win ? '今日の落書き、封印完了' : 'インクがつきた…', 160, 150);
    g.font = '700 26px "Zen Maru Gothic", sans-serif';
    const lines = [
      `スコア  ${s.score.toLocaleString()}`,
      `ランク  ${win ? s.rank : '—'}   （${DIFF[s.diff].name}）`,
      `時間  ${fmtTime(s.timeMs)}    被弾  ${s.hits}回`,
      `防御成功率  ${pct(s.defRate)}    認識成功率  ${pct(s.recRate)}`,
      `最大コンボ  ${s.maxCombo}`,
      `線 ${s.used.line}  丸 ${s.used.circle}  三角 ${s.used.tri}`,
    ];
    lines.forEach((t, i) => g.fillText(t, 160, 222 + i * 54));
    if (win) {
      g.save(); g.translate(1010, 540); g.rotate(-0.2);
      g.strokeStyle = '#d8343b'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#d8343b'; g.font = '700 80px "Zen Maru Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s.rank, 0, 4); g.restore();
    }
    const url = c.toDataURL('image/png');
    $('resImg').src = url;
    $('resImgDl').href = url;
    $('imageModal').hidden = false;
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
