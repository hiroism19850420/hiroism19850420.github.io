// 画面（第7部・付録E・V・X）。HTML は index.html、中身と 体の操作は ここ
import { $, fmtTime, clamp } from './util.js';
import { picSVG } from './pics.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { CHARS, CHAR_IDS } from './models.js';
import { COURSES } from './courses.js';
import { Save } from './save.js';
import { CFG } from './config.js';

const RING = '<svg viewBox="0 0 52 52"><circle class="bg" cx="26" cy="26" r="21" stroke-width="7"/><circle class="fg" cx="26" cy="26" r="21" fill="none" stroke-width="7" stroke-dasharray="132" stroke-dashoffset="132"/></svg><div class="pic"></div>';
const CUP = (lv) => { const c = ['#55607a', '#ffb37a', '#e6edf5', '#ffd54a'][lv]; return `<svg class="cup" viewBox="0 0 44 52"><path d="M10 6h24v10c0 9-5 15-12 15S10 25 10 16z" fill="${c}" stroke="#1d2b53" stroke-width="3"/><path d="M10 10H4c0 7 3 10 7 11M34 10h6c0 7-3 10-7 11" fill="none" stroke="${c}" stroke-width="3"/><rect x="18" y="31" width="8" height="8" fill="${c}" stroke="#1d2b53" stroke-width="2"/><rect x="12" y="39" width="20" height="7" rx="2" fill="${c}" stroke="#1d2b53" stroke-width="3"/></svg>`; };
const DIFFS = [['easy', 'のんびり', 'はじめての 人に。ライバルは ゆっくり'], ['normal', 'ふつう', 'なれてきたら。いい しょうぶ'], ['hard', 'はやい', 'おとなも ほんき。ずっと あしぶみ！']];

export const Screens = {
  cur: null, focus: 0, items: [], wrap: false, handlers: {}, camMode: false,
  init(app) {
    this.app = app;
    $('helpBar').innerHTML = '';
    $('backHold').innerHTML = 'もどる<span class="holdRing">' + RING + '</span>';
    $('backHold').onclick = () => { Audio.play('menuBack'); this.back(); };
    // 入口の 説明
    $('gateList').innerHTML = [['run', 'あしぶみ … すすむ'], ['wheel', 'ハンドル … まがる'], ['jump', 'ジャンプ … ジャンプだい'], ['squat', 'しゃがむ … ゲートを くぐる'], ['banzai', 'バンザイ … ターボ']].map(([p, t]) => `<div>${picSVG(p)}<span>${t}</span></div>`).join('');
    // ロゴの 1文字ずつ
    const chars = s => [...s].map(c => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    $('logo1').innerHTML = chars('こげ！ まわせ！');
    $('logo2').innerHTML = chars('ぜんしん グランプリ！') + '<svg id="logoFlags" viewBox="0 0 90 60"><g transform="rotate(-18 30 40)"><rect x="28" y="6" width="4" height="50" fill="#fff" stroke="#1d2b53" stroke-width="2"/><path d="M32 6h26v18H32z" fill="#fff" stroke="#1d2b53" stroke-width="2"/><path d="M32 6h6.5v6H32zM45 6h6.5v6H45zM38.5 12H45v6h-6.5zM51.5 12H58v6h-6.5zM32 18h6.5v6H32zM45 18h6.5v6H45z" fill="#1d2b53"/></g><g transform="rotate(18 60 40)"><rect x="58" y="6" width="4" height="50" fill="#fff" stroke="#1d2b53" stroke-width="2"/><path d="M62 6h26v18H62z" fill="#fff" stroke="#1d2b53" stroke-width="2"/><path d="M62 6h6.5v6H62zM75 6h6.5v6H75zM68.5 12H75v6h-6.5zM81.5 12H88v6h-6.5zM62 18h6.5v6H62zM75 18h6.5v6H75z" fill="#1d2b53"/></g></svg>';
    // 体の操作の円（けってい）を ボタンへ
    document.querySelectorAll('[data-nav]').forEach(b => { if (!b.querySelector('.holdRing')) b.insertAdjacentHTML('beforeend', '<span class="holdRing">' + RING + '</span>'); });
    setInterval(() => this.logoWave(), 3000);
  },
  logoWave() {
    if (this.cur !== 'title') return;
    const chs = document.querySelectorAll('#logo .ch');
    chs.forEach((c, i) => setTimeout(() => { c.classList.remove('wave'); void c.offsetWidth; c.classList.add('wave'); }, i * 60));
  },
  help(on) {
    const el = $('helpBar');
    el.classList.toggle('on', !!on);
    if (!on) return;
    el.innerHTML = this.camMode
      ? `<span>${picSVG('wheel')}ハンドルで えらぶ</span><span>${picSVG('banzai')}バンザイで けってい</span><span>${picSVG('squat')}しゃがんで もどる</span>`
      : document.body.classList.contains('touch') ? `<span>ボタンを さわって えらぶ</span>`
      : `<span>← → で えらぶ</span><span>エンターで けってい</span><span>エスケープで もどる</span>`;
  },
  hideAll() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); this.help(false); $('backHold').classList.remove('on'); this.cur = null; this.items = []; },
  // name の 画面を 出す。opt：{ items（ボタンの 配列）, focus, wrap, onOk(i), onBack, onFocus(i), help, back }
  open(id, opt = {}) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    this.cur = opt.name || id; this.opt = opt;
    this.items = opt.items || [...document.querySelectorAll(`#${id} [data-nav]`)].filter(b => !b.classList.contains('hide') && b.offsetParent !== null).sort((a, b) => a.dataset.nav - b.dataset.nav);
    this.wrap = !!opt.wrap;
    this.items.forEach((b, i) => { b.onclick = () => { this.setFocus(i); this.ok(); }; });
    this.setFocus(opt.focus || 0, true);
    this.help(opt.help !== false);
    $('backHold').classList.toggle('on', !!opt.onBack && opt.backBtn !== false);
  },
  setFocus(i, silent = false) {
    if (!this.items.length) return;
    const n = this.items.length;
    i = this.wrap ? (i + n) % n : clamp(i, 0, n - 1);
    this.items.forEach((b, k) => b.classList.toggle('focus', k === i));
    if (i !== this.focus && !silent) Audio.play('menuMove');
    this.focus = i;
    // 長い 一覧（せってい）は えらんだ 行が 見えるように 送る
    const row = this.items[i].closest('.setRow') || this.items[i];
    if (row.closest('#setPanel')) row.scrollIntoView({ block: 'nearest', behavior: silent ? 'auto' : 'smooth' });
    this.opt.onFocus && this.opt.onFocus(i);
  },
  ok() { if (!this.opt || !this.opt.onOk) return; Audio.play('menuOk'); this.opt.onOk(this.focus, this.items[this.focus]); },
  back() { if (this.opt && this.opt.onBack) this.opt.onBack(); },
  // 毎コマ（メニューの とき）
  update(dt) {
    if (!this.cur) return;
    if (Input.take('menuR')) this.setFocus(this.focus + 1);
    if (Input.take('menuL')) this.setFocus(this.focus - 1);
    if (Input.take('ok')) { Input.take('banzai'); this.ok(); }
    if (Input.take('back')) { Input.take('pause'); if (this.opt.onBack) { Audio.play('menuBack'); this.back(); } }
    // けっていの 円
    const M = Input.menu, b = this.items[this.focus];
    document.querySelectorAll('.holdRing').forEach(r => { if (r.parentElement !== b && r.parentElement !== $('backHold')) r.classList.remove('on'); });
    if (b) {
      const r = b.querySelector('.holdRing');
      if (r) { r.classList.toggle('on', M.holdOk > 0.02); r.querySelector('.fg').style.strokeDashoffset = String(132 * (1 - M.holdOk)); if (!r.querySelector('.pic').innerHTML) r.querySelector('.pic').innerHTML = picSVG('banzai'); }
    }
    const rb = $('backHold').querySelector('.holdRing');
    rb.classList.toggle('on', M.holdBack > 0.02); rb.querySelector('.fg').style.strokeDashoffset = String(132 * (1 - M.holdBack));
    if (!rb.querySelector('.pic').innerHTML) rb.querySelector('.pic').innerHTML = picSVG('squat');
    const tick = Math.floor(M.holdOk * 8);
    if (tick !== this._tick) { if (tick > 0) Audio.play('holdTick'); this._tick = tick; }
  },

  // ---------- 各画面 ----------
  title(onPick) {
    const d = Save.data;
    $('titlePrep').classList.toggle('hide', !this.camMode);
    $('titleSteps').textContent = d.total.steps > 0 ? `これまでに ${d.total.steps.toLocaleString()} 歩` : '';
    $('titleCups').innerHTML = ['easy', 'normal', 'hard'].map(k => CUP(d.cups[k] || 0)).join('');
    const logo = $('logo'); logo.classList.remove('in'); void logo.offsetWidth; logo.classList.add('in');
    this.open('scrTitle', { onOk: (i, b) => onPick(b.dataset.act), focus: 0 });
  },
  char(sel, onFocus, onPick, onBack) {
    const show = i => { const C = CHARS[CHAR_IDS[i]]; $('charName').textContent = C.name; $('charSay').textContent = `「${C.say}」`; onFocus(i); };
    let idx = sel;
    this.open('scrChar', { items: [$('charOk')], onOk: () => onPick(idx), onBack });
    $('charPrev').onclick = () => { idx = (idx + 5) % 6; show(idx); Audio.play('menuMove'); };
    $('charNext').onclick = () => { idx = (idx + 1) % 6; show(idx); Audio.play('menuMove'); };
    // ハンドルの 左右で キャラを かえる（ボタンは 1つ）
    this.opt.onFocus = null;
    this.charStep = d => { idx = (idx + d + 6) % 6; show(idx); Audio.play('menuMove'); };
    show(idx);
  },
  charUpdate() {
    if (this.cur !== 'scrChar') return;
    if (Input.take('menuR')) this.charStep(1);
    if (Input.take('menuL')) this.charStep(-1);
  },
  diff(sel, onPick, onBack) {
    const box = $('diffCards');
    box.innerHTML = DIFFS.map(([k, n, d], i) => `<div class="diffCard d${i} btn nofocusicon" data-nav="${i}" style="height:380px;border-radius:30px;padding:26px;display:flex;font-size:24px"><div class="cupRow">${CUP(Save.data.cups[k] || 0)}</div><b>${n}</b><span>${d}</span><span class="holdRing">${RING}</span></div>`).join('');
    this.open('scrDiff', { onOk: i => onPick(DIFFS[i][0]), onBack, focus: Math.max(0, DIFFS.findIndex(d => d[0] === sel)) });
  },
  course(sel, laps, onFocus, onPick, onBack) {
    const box = $('courseCards');
    box.innerHTML = COURSES.map((c, i) => {
      const b = Save.getBest(c.id, laps);
      const bt = b ? `さいこう ${fmtTime(b.time)}${b.nocam ? '<br><small>（カメラなし）</small>' : ''}` : 'さいこう ―';
      return `<div class="courseCard btn nofocusicon" data-nav="${i}" style="height:400px;border-radius:26px;padding:16px;display:flex;background:linear-gradient(${c.sky.top},${c.sky.horizon})"><div class="no ol">コース ${c.no}</div><canvas class="courseMap" width="476" height="400"></canvas><div class="nm ol">${c.name.replace(' ', '<br>')}</div><div class="bt">${bt}</div><span class="holdRing">${RING}</span></div>`;
    }).join('');
    // コースの形
    const maps = box.querySelectorAll('canvas');
    COURSES.forEach((c, i) => drawCourseShape(maps[i], c));
    this.open('scrCourse', { onOk: i => onPick(COURSES[i].id), onBack, focus: Math.max(0, COURSES.findIndex(c => c.id === sel)), onFocus });
  },
  intro(course, laps) {
    $('introNo').textContent = `コース ${course.no}`; $('introName').textContent = course.name; $('introLaps').textContent = `${laps}しゅう`;
    $('introBand').style.background = course.color;
    $('introSkip').textContent = this.camMode ? 'バンザイで とばす' : 'エンターで とばす';
    const b = $('introBand'); b.classList.remove('in');
    this.open('scrIntro', { items: [], help: false });
    setTimeout(() => b.classList.add('in'), 50);
  },
  introOut() { $('introBand').classList.remove('in'); },
  pauseLost(onMenu) {
    $('pauseLost').classList.remove('hide'); $('pauseMenu').classList.add('hide'); $('pauseAsk').classList.add('hide');
    $('pausePic').innerHTML = picSVG('cam');
    $('pauseMenu2').onclick = onMenu;
    this.open('scrPause', { items: [], help: false });
  },
  pauseMenu(gp, onResume, onRetry, onQuit) {
    $('pauseLost').classList.add('hide'); $('pauseMenu').classList.remove('hide'); $('pauseAsk').classList.add('hide');
    this.open('scrPause', { onOk: i => [onResume, onRetry, () => gp ? this.pauseAsk(onQuit, () => this.pauseMenu(gp, onResume, onRetry, onQuit)) : onQuit()][i](), onBack: onResume, backBtn: false });
  },
  pauseAsk(onYes, onNo) {
    $('pauseMenu').classList.add('hide'); $('pauseAsk').classList.remove('hide');
    this.open('scrPause', { items: [$('pauseKeep'), $('pauseQuitYes')], onOk: i => (i ? onYes : onNo)(), onBack: onNo, backBtn: false });
  },
  result(course, rows, stats, buttons, portraits) {
    $('resultTitle').textContent = `けっか　${course.name}`;
    const box = $('resultRows');
    box.innerHTML = rows.map((r, i) => `<div class="rRow${r.you ? ' you' : ''}"><div class="pos">${i + 1}</div><img src="${portraits[r.id] ? portraits[r.id][i === 0 ? 'happy' : 'normal'] : ''}"><div class="nm">${CHARS[r.id].name}${r.you ? '（あなた）' : ''}</div><div class="best">${r.best ? '★さいこう きろく！' : ''}</div><div class="tm">${fmtTime(r.t)}</div></div>`).join('');
    [...box.children].forEach((el, i) => setTimeout(() => el.classList.add('in'), 120 * i + 100));
    $('resultStats').innerHTML = `<span>${picSVG('run')}あしぶみ ${stats.steps} 歩</span><span>${picSVG('jump')}ジャンプ ${stats.jumps} かい</span><span>いちばん はやい しゅう ${isFinite(stats.bestLap) ? fmtTime(stats.bestLap) : '―'}</span>`;
    const bb = $('resultBtns');
    bb.innerHTML = buttons.map((b, i) => `<button class="btn ${i === 0 ? 'main' : 'sub'}" data-nav="${i}">${b.text}<span class="holdRing">${RING}</span></button>`).join('');
    this.open('scrResult', { onOk: i => buttons[i].fn(), focus: 0 });
  },
  standings(after, rows, portraits, buttons) {
    $('standAfter').textContent = `（コース ${after} / 4 おわり）`;
    const box = $('standRows');
    const max = Math.max(1, ...rows.map(r => r.total));
    box.innerHTML = rows.map(r => `<div class="sRow${r.you ? ' you' : ''}" style="position:absolute;left:0;right:0;transform:translateY(${r.prevRank * 66}px)"><img src="${portraits[r.id] ? portraits[r.id].normal : ''}" style="width:50px;height:50px"><div style="width:220px">${CHARS[r.id].name}${r.you ? '（あなた）' : ''}</div><div class="barWrap"><div class="bar" style="width:${r.prev / max * 100}%"></div></div><div class="pts">${r.total} てん<small>+${r.add}</small></div></div>`).join('');
    const els = [...box.children];
    setTimeout(() => els.forEach((el, i) => { el.querySelector('.bar').style.width = (rows[i].total / max * 100) + '%'; }), 200);
    setTimeout(() => els.forEach((el, i) => { el.style.transform = `translateY(${rows[i].rank * 66}px)`; }), 1300);
    $('standBtns').innerHTML = buttons.map((b, i) => `<button class="btn ${i === 0 ? 'main' : 'sub'}" data-nav="${i}">${b.text}<span class="holdRing">${RING}</span></button>`).join('');
    this.open('scrStand', { onOk: i => buttons[i].fn(), focus: 0 });
  },
  rest(onGo, onQuit) { this.open('scrRest', { onOk: i => (i ? onQuit : onGo)(), focus: 0 }); },
  podiumText(text) { const el = $('podiumText'); el.textContent = text; el.classList.toggle('in', !!text); },
  podium(onNext) { $('podiumNext').classList.add('hide'); this.podiumText(''); this.open('scrPodium', { items: [], help: false }); this.podiumNextFn = onNext; },
  podiumShowNext() { $('podiumNext').classList.remove('hide'); this.open('scrPodium', { items: [$('podiumNext')], onOk: () => this.podiumNextFn() }); },
  summary(sum, nocam, onHome) {
    const rows = [['run', 'あしぶみ', sum.steps, '歩'], ['jump', 'ジャンプ', sum.jumps, 'かい'], ['squat', 'しゃがむ', sum.squats, 'かい'], ['banzai', 'バンザイ', sum.banzais, 'かい']];
    const box = $('sumRows');
    box.innerHTML = rows.map(([p, l, v, u], i) => `<div class="sumRow">${picSVG(p)}<span class="lb">${l}${i === 0 && nocam ? '<small>（カメラなし）</small>' : ''}</span><span class="v" data-v="${v}">0</span><span>${u}</span>${i === 0 ? '<span class="stamp">すごい！</span>' : ''}</div>`).join('')
      + `<div class="sumRow"><svg viewBox="0 0 100 100"><circle cx="50" cy="54" r="36" fill="none" stroke="#1d2b53" stroke-width="8"/><path d="M50 54V32M50 54l14 10M42 10h16" stroke="#1d2b53" stroke-width="8" stroke-linecap="round"/></svg><span class="lb">はしった じかん</span><span class="v">${Math.floor(sum.seconds / 60)} ふん ${Math.floor(sum.seconds % 60)} びょう</span></div>`;
    $('sumWalk').textContent = `ほんとうに あるいたら やく ${Math.round(sum.steps * 0.5)} メートル！`;
    const vs = box.querySelectorAll('.v[data-v]');
    let t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1200);
      vs.forEach(el => { el.textContent = Math.round(Number(el.dataset.v) * k).toLocaleString(); });
      if (k < 1) { Audio.play('countUp'); requestAnimationFrame(step); }
      else if (sum.steps >= 1000) { const s = box.querySelector('.stamp'); s.classList.add('in'); Audio.play('stamp'); }
    };
    requestAnimationFrame(step);
    this.open('scrSum', { onOk: onHome });
  },
  settings(onChange, onPrep, onReset, onBack) {
    const S = Save.data.settings;
    const ROWS = [
      ['diffSingle', 'むずかしさ（ひとつ はしる）', [['easy', 'のんびり'], ['normal', 'ふつう'], ['hard', 'はやい']]],
      ['laps', 'しゅうの かず', [[2, '2'], [3, '3'], [4, '4']]],
      ['assist', 'おまかせハンドル', [['auto', 'じどう'], ['strong', 'つよい'], ['some', 'すこし'], ['none', 'なし']]],
      ['legSens', 'あしぶみの かんど', [['high', 'たかい'], ['mid', 'ふつう'], ['low', 'ひくい']]],
      ['steerSens', 'ハンドルの かんど', [['high', 'たかい'], ['mid', 'ふつう'], ['low', 'ひくい']]],
      ['bgm', 'きょくの おおきさ', [[0, '0'], [2, '2'], [4, '4'], [6, '6'], [8, '8'], [10, '10']]],
      ['sfx', 'こうかおんの おおきさ', [[0, '0'], [2, '2'], [4, '4'], [6, '6'], [8, '8'], [10, '10']]],
      ['voice', 'じっきょうの こえ', [[true, 'あり'], [false, 'なし']]],
      ['quality', 'がしつ', [['auto', 'じどう'], ['high', 'きれい'], ['mid', 'ふつう'], ['low', 'かるい']]],
      ['swap', 'ひだりみぎを いれかえる', [[false, 'いれかえない'], [true, 'いれかえる']]],
      ['_prep', 'れんしゅうを やりなおす', null],
      ['_reset', 'きろくを けす', null]
    ];
    const box = $('setRows');
    box.innerHTML = ROWS.map(([k, l, vals]) => `<div class="setRow" data-key="${k}"><span>${l}</span>${vals ? `<span class="vals">${vals.map(([v, t]) => `<button class="val${S[k] === v ? ' on' : ''}" data-v='${JSON.stringify(v)}'>${t}</button>`).join('')}</span>` : `<button class="act">${k === '_prep' ? 'やりなおす' : 'けす'}</button>`}</div>`).join('');
    const rows = [...box.querySelectorAll('.setRow')];
    const apply = (row, v) => { const k = row.dataset.key; Save.set('settings.' + k, v); row.querySelectorAll('.val').forEach(b => b.classList.toggle('on', JSON.parse(b.dataset.v) === v)); onChange(k, v); };
    rows.forEach(row => {
      row.querySelectorAll('.val').forEach(b => b.onclick = e => { e.stopPropagation(); apply(row, JSON.parse(b.dataset.v)); Audio.play('menuMove'); });
      const act = row.querySelector('.act'); if (act) act.onclick = e => { e.stopPropagation(); row.dataset.key === '_prep' ? onPrep() : this.askReset(onReset); };
    });
    // 体の操作：行を 順に、けっていで 値を 1つ 進める
    const items = rows.map(r => { r.setAttribute('data-nav', ''); return r; });
    this.open('scrSettings', {
      items, onBack,
      onOk: i => {
        const row = rows[i], vals = [...row.querySelectorAll('.val')];
        if (!vals.length) { row.querySelector('.act').click(); return; }
        const cur = vals.findIndex(b => b.classList.contains('on'));
        apply(row, JSON.parse(vals[(cur + 1) % vals.length].dataset.v));
      }
    });
    rows.forEach(r => r.classList.remove('btn'));
  },
  askReset(onReset) {
    const ask = $('setAsk'); ask.classList.add('on');
    $('setAskNo').onclick = () => ask.classList.remove('on');
    $('setAskYes').onclick = () => { ask.classList.remove('on'); onReset(); };
  }
};

function drawCourseShape(cv, c) {
  const g = cv.getContext('2d');
  // 制御点を 細かく（見た目用。中心の線を 直線で つなぐ だけでも よいが、キャットマル–ロムで）
  const pts = [];
  const n = c.cps.length;
  for (let i = 0; i < n; i++) {
    const p0 = c.cps[(i - 1 + n) % n], p1 = c.cps[i], p2 = c.cps[(i + 1) % n], p3 = c.cps[(i + 2) % n];
    for (let k = 0; k < 10; k++) { const t = k / 10, t2 = t * t, t3 = t2 * t; const f = (a, b, cc, d) => 0.5 * ((2 * b) + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3); pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); }
  }
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const sc = Math.min(420 / (x1 - x0), 340 / (z1 - z0));
  const T = ([x, z]) => [238 + (x - (x0 + x1) / 2) * sc, 200 + (z - (z0 + z1) / 2) * sc];
  g.clearRect(0, 0, cv.width, cv.height);
  g.lineCap = g.lineJoin = 'round';
  for (const [w, col] of [[30, '#1d2b53aa'], [20, '#ffffff']]) { g.beginPath(); pts.forEach((p, i) => { const [x, y] = T(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
  const [sx, sy] = T(pts[0]);
  g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(sx, sy, 13, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
}
