// メニューの 画面（第7部、付録E・AN）。HTML は index.html、中身と 体の 操作は ここ
import { $, fmtTime, clamp } from './util.js';
import { picSVG } from './pics.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { CHARS, CHAR_IDS } from './models.js';
import { COURSES, DISTS, DIFFS } from './courses.js';
import { Save } from './save.js';

const RING = '<svg viewBox="0 0 52 52"><circle class="bg" cx="26" cy="26" r="21" stroke-width="7"/><circle class="fg" cx="26" cy="26" r="21" fill="none" stroke-width="7" stroke-dasharray="132" stroke-dashoffset="132" transform="rotate(-90 26 26)"/></svg><div class="pic"></div>';
const ringHTML = () => `<span class="holdRing">${RING}</span>`;
const OBS_PICS = ['hurdle', 'bar', 'block', 'paper', 'ball'];

export const Screens = {
  cur: null, focus: 0, items: [], opt: {}, mode: 'key',
  init(app) {
    this.app = app;
    $('backHold').innerHTML = 'もどる' + ringHTML();
    $('backHold').onclick = () => this.back();
    // 入口の 説明
    $('gateList').innerHTML = [['run', 'あしぶみ … はしる'], ['jump', 'ジャンプ … とびこえる'], ['squat', 'しゃがむ … くぐる'], ['dodgeR', 'よこに ずれる … よける'], ['banzai', 'てを あげる … やぶる・はじく']]
      .map(([p, t]) => `<div>${picSVG(p)}<span>${t}</span></div>`).join('');
    // ロゴの 1文字ずつ
    const chars = s => [...s].map(c => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    $('titleLogo').innerHTML = `<div class="l1">${chars('はしれ！ とべ！')}</div><div class="l2">${chars('ぜんしん')}<span class="sp"> </span><br class="pbr">${chars('ダッシュ！')}</div>`;
    setInterval(() => this.logoWave(), 3200);
  },
  logoWave() {
    if (this.cur !== 'scrTitle') return;
    document.querySelectorAll('#titleLogo .ch').forEach((c, i) => setTimeout(() => { c.classList.remove('wave'); void c.offsetWidth; c.classList.add('wave'); }, i * 55));
  },
  help(on) {
    const el = $('helpBar');
    el.classList.toggle('on', !!on);
    if (!on) return;
    if (this.mode === 'cam') el.innerHTML = `<span>${picSVG('handL')}${picSVG('handR')}みぎて・ひだりてで えらぶ</span><span>${picSVG('banzai')}りょうてを 1びょうで けってい</span><span>${picSVG('squat')}しゃがんで もどる</span>`;
    else if (this.mode === 'touch') el.innerHTML = `<span>ボタンを さわって えらぶ</span>`;
    else el.innerHTML = `<span>← → で えらぶ</span><span>エンターで けってい</span><span>エスケープで もどる</span>`;
  },
  hideAll() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); this.help(false); $('backHold').classList.remove('on'); this.cur = null; this.items = []; this.opt = {}; },
  // id の 画面を 出す。opt：{ items, focus, wrap, onOk(i, el), onBack, onFocus(i), help, left, right }
  open(id, opt = {}) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    this.cur = id; this.opt = opt;
    this.items = opt.items || [...document.querySelectorAll(`#${id} [data-nav]`)].filter(b => !b.classList.contains('hide')).sort((a, b) => a.dataset.nav - b.dataset.nav);
    this.items.forEach((b, i) => {
      if (!b.querySelector('.holdRing')) b.insertAdjacentHTML('beforeend', ringHTML());
      b.onclick = e => { e.stopPropagation(); if (b.classList.contains('off')) return; this.setFocus(i, true); this.ok(); };
    });
    this.focus = -1;
    let f = opt.focus || 0; if (this.items[f] && this.items[f].classList.contains('off')) f = this.items.findIndex(b => !b.classList.contains('off'));
    this.setFocus(Math.max(0, f), true);
    this.help(opt.help !== false);
    $('backHold').classList.toggle('on', !!opt.onBack && opt.backBtn !== false);
  },
  setFocus(i, silent = false) {
    if (!this.items.length) return;
    const n = this.items.length;
    i = this.opt.wrap ? (i + n) % n : clamp(i, 0, n - 1);
    // えらべない ボタンは とばす
    let guard = 0;
    while (this.items[i].classList.contains('off') && guard++ < n) { i = this.opt.wrap ? (i + (i >= this.focus ? 1 : -1) + n) % n : clamp(i + (i >= this.focus ? 1 : -1), 0, n - 1); }
    if (this.items[i].classList.contains('off')) return;
    this.items.forEach((b, k) => b.classList.toggle('focus', k === i));
    if (i !== this.focus && !silent) Audio.play('menuMove');
    this.focus = i;
    const row = this.items[i].closest('.setRow');
    if (row) row.scrollIntoView({ block: 'nearest', behavior: silent ? 'auto' : 'smooth' });
    this.opt.onFocus && this.opt.onFocus(i);
  },
  ok() { if (!this.opt || !this.opt.onOk) return; const b = this.items[this.focus]; if (b && b.classList.contains('off')) return; Audio.play('menuOk'); this.opt.onOk(this.focus, b); },
  back() { if (this.opt && this.opt.onBack) { Audio.play('menuBack'); this.opt.onBack(); } },
  // 毎コマ（メニューの とき）
  update(dt) {
    if (!this.cur) return;
    if (Input.take('menuR')) { if (this.opt.right) this.opt.right(); else this.setFocus(this.focus + 1); }
    if (Input.take('menuL')) { if (this.opt.left) this.opt.left(); else this.setFocus(this.focus - 1); }
    if (Input.take('ok')) this.ok();
    if (Input.take('back')) { Input.take('pause'); this.back(); }
    // けってい・もどるの 輪（体の 操作）
    const M = Input.menu, b = this.items[this.focus];
    document.querySelectorAll('.holdRing.on').forEach(r => { if (r.parentElement !== b && r.parentElement !== $('backHold')) r.classList.remove('on'); });
    if (b) {
      const r = b.querySelector('.holdRing');
      if (r) { r.classList.toggle('on', M.holdOk > 0.02); r.querySelector('.fg').style.strokeDashoffset = String(132 * (1 - M.holdOk)); const p = r.querySelector('.pic'); if (!p.innerHTML) p.innerHTML = picSVG('banzai'); }
    }
    const rb = $('backHold').querySelector('.holdRing');
    rb.classList.toggle('on', M.holdBack > 0.02); rb.querySelector('.fg').style.strokeDashoffset = String(132 * (1 - M.holdBack));
    if (!rb.querySelector('.pic').innerHTML) rb.querySelector('.pic').innerHTML = picSVG('squat');
    const tick = Math.floor(M.holdOk * 8);
    if (tick !== this._tick) { if (tick > 0) Audio.play('holdTick'); this._tick = tick; }
  },

  // ---------- 入口（AN.2） ----------
  gate(touch, pc) {
    const portrait = innerHeight > innerWidth;
    $('gateNotes').innerHTML = (touch ? (portrait ? 'スマホを たてにして 立てかけ、あたまから あしまで うつる所まで はなれてね（2mくらい）。' : 'スマホを よこにして 立てかけ、ぜんしんが うつる所まで はなれてね（2〜3m）。') : 'ぜんしんが うつる所まで はなれてね（2〜3m）。')
      + '<br>まわりに ぶつかる ものが ないか みてね。くつしたで すべらないように、はだしか くつで。';
    $('gateKey').classList.toggle('hide', touch);
    $('gateTouch').classList.toggle('hide', !touch);
    $('gatePhone').classList.toggle('hide', !pc);
    this.open('scrGate', { items: [], help: false });
  },
  // ---------- タイトル（AN.3） ----------
  title(onPick, canTwo, canPrep) {
    const two = document.querySelector('#titleMenu [data-act=two]');
    two.classList.toggle('off', !canTwo);
    $('titleTwoNote').textContent = ''; if (canTwo) delete two.dataset.note; else two.dataset.note = 'よこの がめんで カメラを つかうと あそべるよ';
    $('titlePrep').classList.toggle('hide', !canPrep);
    const btns = [...document.querySelectorAll('#titleMenu .btn')].filter(b => !b.classList.contains('hide'));
    btns.forEach((b, i) => b.dataset.nav = i);
    const T = Save.data.totals;
    $('titleBest').innerHTML = T.races ? `これまで ${T.races}かい はしったよ・あしぶみ ${T.steps.toLocaleString()}歩${T.firsts ? `・1い ${T.firsts}かい` : ''}` : '';
    const logo = $('titleLogo'); logo.classList.remove('in'); void logo.offsetWidth; logo.classList.add('in');
    const last = Save.data.last.mode;
    this.open('scrTitle', { items: btns, focus: Math.max(0, btns.findIndex(b => b.dataset.act === last && !b.classList.contains('off'))), onOk: (i, b) => onPick(b.dataset.act) });
  },
  // ---------- ふたりの じゅんび ----------
  two(text, onBack) { $('twoText').innerHTML = text; this.open('scrTwo', { items: [], onBack, help: false }); },
  twoText(text) { $('twoText').innerHTML = text; },
  // ---------- キャラえらび（AN.4） ----------
  char(sel, pick, taken, two, onMove, onPick, onBack) {
    $('charHead').textContent = pick === 1 ? '2P の キャラを えらんでね' : two ? '1P の キャラを えらんでね' : 'キャラクターを えらんでね';
    $('charHead').className = 'ol' + (pick === 1 ? ' p2' : two ? ' p1' : '');
    const show = i => { const c = CHARS[CHAR_IDS[i]]; $('charName').textContent = c.name; $('charName').style.color = c.kart; $('charSay').textContent = '「' + c.say + '」'; $('charOk').classList.toggle('off', CHAR_IDS[i] === taken); };
    let cur = sel; if (CHAR_IDS[cur] === taken) cur = (cur + 1) % 6;
    show(cur); onMove(cur);
    const move = d => { do { cur = (cur + d + 6) % 6; } while (CHAR_IDS[cur] === taken); show(cur); onMove(cur); Audio.play('menuMove'); };
    $('charPrev').onclick = e => { e.stopPropagation(); move(-1); }; $('charNext').onclick = e => { e.stopPropagation(); move(1); };
    this.open('scrChar', { items: [$('charOk')], onOk: () => { if (CHAR_IDS[cur] !== taken) onPick(cur); }, onBack, left: () => move(-1), right: () => move(1) });
  },
  // ---------- コース・長さ・むずかしさ（AN.5） ----------
  course(selId, dist, diff, onFocus, onPick, onBack) {
    $('courseCards').innerHTML = COURSES.map((c, i) => {
      const b = Save.getBest(c.id, dist, diff);
      return `<button class="card course" data-nav="${i}" style="--c1:${c.card[0]};--c2:${c.card[1]}"><div class="no ol">コース${c.no}</div><canvas class="pic" width="480" height="300"></canvas>
        <div class="name ol">${c.name.replace(' ', '<br>')}</div><div class="obs">${OBS_PICS.map(p => picSVG(p)).join('')}</div><div class="best">さいこう ${b ? fmtTime(b.time) + (b.cam ? '' : '<small>（タッチ）</small>') : '―'}</div></button>`;
    }).join('');
    [...$('courseCards').querySelectorAll('canvas')].forEach((cv, i) => drawCoursePic(cv, COURSES[i]));
    this.open('scrCourse', { focus: Math.max(0, COURSES.findIndex(c => c.id === selId)), onOk: i => onPick(COURSES[i].id), onBack, onFocus: i => onFocus && onFocus(COURSES[i]) });
  },
  dist(selId, onPick, onBack) {
    $('distCards').innerHTML = DISTS.map((d, i) => `<button class="card dist" data-nav="${i}"><div class="drops">${'<i></i>'.repeat(d.drops)}</div><div class="name ol">${d.name}</div><div class="m ol">${d.m}m</div><div class="note">${d.note}</div></button>`).join('');
    this.open('scrDist', { focus: Math.max(0, DISTS.findIndex(d => d.id === selId)), onOk: i => onPick(DISTS[i].id), onBack });
  },
  diff(selId, onPick, onBack) {
    $('diffCards').innerHTML = DIFFS.map((d, i) => `<button class="card diff d${i}" data-nav="${i}" style="--c1:${d.color}"><div class="name ol">${d.name}</div><div class="note">${d.note}</div></button>`).join('');
    this.open('scrDiff', { focus: Math.max(0, DIFFS.findIndex(d => d.id === selId)), onOk: i => onPick(DIFFS[i].id), onBack });
  },
  // ---------- じゃまモードの 注意 ----------
  jama(cam, onPractice, onStart, onBack) {
    $('jamaText').innerHTML = `となりの ライバルに てや あしを だして じゃましよう！<br>ライバルも じゃまして くるよ。<div class="jRows"><div>${picSVG('armR')}<b>うで</b> が くる → ${picSVG('squat')}<b>しゃがんで</b> よける</div><div>${picSVG('legR')}<b>あし</b> が くる → ${picSVG('jump')}<b>ジャンプで</b> よける</div></div>`;
    $('jamaPractice').classList.toggle('hide', !cam);
    $('jamaPrep').classList.add('hide');
    const btns = [...document.querySelectorAll('#jamaBtns .btn')].filter(b => !b.classList.contains('hide'));
    btns.forEach((b, i) => b.dataset.nav = i);
    this.open('scrJama', { items: btns, focus: btns.length - 1, onOk: (i, b) => (b.id === 'jamaPractice' ? onPractice : onStart)(), onBack });
  },
  jamaStep(pic, text) { $('jamaPrep').classList.remove('hide'); $('jamaPic').innerHTML = picSVG(pic); $('jamaStep').textContent = text; },
  // ---------- 紹介（AN.6） ----------
  intro(c, distId, diffId, onSkip) {
    const d = DISTS.find(x => x.id === distId), df = DIFFS.find(x => x.id === diffId);
    const card = $('introCard');
    card.querySelector('.no').textContent = 'コース' + c.no; card.querySelector('.name').textContent = c.name;
    card.querySelector('.sub').textContent = `${d.name} ${d.m}m ／ ${df.name}`;
    card.style.setProperty('--c', c.color);
    $('introObs').innerHTML = OBS_PICS.map(p => `<i>${picSVG(p)}</i>`).join('');
    $('introSkip').innerHTML = this.mode === 'cam' ? `${picSVG('banzai')}りょうてで とばす` : this.mode === 'touch' ? 'タップで とばす' : 'エンターで とばす';
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    this.open('scrIntro', { items: [], help: false, onOk: onSkip });
  },
  // ---------- 一時停止（AN.7） ----------
  pauseMenu(onResume, onRetry, onQuit) {
    $('pausePanel').innerHTML = `<h2>ひとやすみ</h2><button class="btn main" data-nav="0">つづける</button><button class="btn" data-nav="1">やりなおす</button><button class="btn sub" data-nav="2">メニューへ</button>`;
    this.open('scrPause', { onOk: i => [onResume, onRetry, onQuit][i](), onBack: onResume, backBtn: false });
  },
  pauseLost(two, onQuit) {
    $('pausePanel').innerHTML = `<div class="bigPic">${picSVG('cam')}</div><h2>${two ? 'ふたりとも うつってね' : 'カメラに うつってね'}</h2><p>からだが みえたら また はじまるよ</p><button class="btn sub" data-nav="0">メニューへ</button>`;
    this.open('scrPause', { onOk: () => onQuit(), help: false });
  },
  // ---------- けっか（AN.8） ----------
  result(head, rows, statsHTML, buttons, win) {
    $('resHead').textContent = head;
    $('resRows').innerHTML = rows.map((r, i) => `<div class="rRow ${r.cls}" style="animation-delay:${(rows.length - 1 - i) * 0.12}s">
      <span class="rk">${i + 1}</span><img src="${r.face || ''}"><span class="nm">${r.name}<small>${r.you}</small></span><span class="badge">${r.best ? '★さいこう きろく！' : ''}</span><span class="tm">${r.time}</span></div>`).join('');
    $('resStats').innerHTML = statsHTML;
    $('resBtns').innerHTML = buttons.map((b, i) => `<button class="btn ${i ? 'sub' : 'main'}" data-nav="${i}">${b.text}</button>`).join('');
    $('resWin').textContent = win || ''; $('resWin').classList.toggle('on', !!win);
    this.open('scrResult', { onOk: i => buttons[i].fn() });
    // 数字を 数え上げる
    document.querySelectorAll('#resStats [data-n]').forEach(el => {
      const n = Number(el.dataset.n), suf = el.dataset.suf || ''; let t = 0;
      const step = () => { t += 1 / 30; const k = Math.min(1, t / 1.2); el.textContent = Math.round(n * k).toLocaleString() + suf; if (k < 1) setTimeout(step, 33); };
      el.textContent = '0' + suf; setTimeout(step, 600);
    });
  },
  rest(onCont, onQuit) {
    this.open('scrRest', { onOk: i => (i ? onQuit : onCont)() });
  },
  // ---------- せってい（AN.9） ----------
  settings(onChange, onPrep, onReset, onBack) {
    const S = Save.data.settings;
    const ROWS = [
      ['diff', 'むずかしさ', [['easy', 'のんびり'], ['normal', 'ふつう'], ['hard', 'はやい']]],
      ['dist', 'ながさ', [['short', 'みじかい'], ['mid', 'ふつう'], ['long', 'ながい']]],
      ['bgm', 'きょくの おおきさ', [0, 2, 4, 6, 8, 10].map(v => [v, String(v)])],
      ['sfx', 'こうかおんの おおきさ', [0, 2, 4, 6, 8, 10].map(v => [v, String(v)])],
      ['voice', 'こえ', [[true, 'あり'], [false, 'なし']]],
      ['cheer', 'おうえんの こえ', [[true, 'あり'], [false, 'なし']]],
      ['giongo', 'ぎおん', [['loud', 'はで'], ['quiet', 'ひかえめ']]],
      ['cutin', 'カットイン', [[true, 'あり'], [false, 'なし']]],
      ['legSens', 'あしぶみの かんど', [['high', 'たかい'], ['mid', 'ふつう'], ['low', 'ひくい']]],
      ['shiftSens', 'よこの かんど', [['high', 'たかい'], ['mid', 'ふつう'], ['low', 'ひくい']]],
      ['quality', 'がしつ', [['auto', 'じどう'], ['high', 'きれい'], ['mid', 'ふつう'], ['low', 'かるい']]],
      ['swap', 'ひだりみぎを いれかえる', [[false, 'いれかえない'], [true, 'いれかえる']]],
      ['@prep', 'れんしゅうを やりなおす', 'やりなおす'],
      ['@reset', 'きろくを けす', 'けす']
    ];
    const box = $('setRows');
    box.innerHTML = ROWS.map(([k, label, vals], i) => typeof vals === 'string'
      ? `<div class="setRow"><span class="lb">${label}</span><button class="btn sub small setBtn" data-nav="${i}" data-k="${k}">${vals}</button></div>`
      : `<div class="setRow"><span class="lb">${label}</span><button class="setVal" data-nav="${i}" data-k="${k}"><span class="arr">◀</span><b></b><span class="arr">▶</span></button></div>`).join('')
      + `<div class="setRow ask hide" id="setAsk"><span class="lb">ほんとうに けす？</span><button class="btn small" id="setAskYes">けす</button><button class="btn sub small" id="setAskNo">やめる</button></div>`;
    const show = () => box.querySelectorAll('.setVal').forEach(b => { const row = ROWS.find(r => r[0] === b.dataset.k); const cur = row[2].find(v => v[0] === S[b.dataset.k]); b.querySelector('b').textContent = cur ? cur[1] : ''; });
    const step = (i, d) => {
      const row = ROWS[i]; if (typeof row[2] === 'string') return;
      const vals = row[2], k = row[0], j = Math.max(0, vals.findIndex(v => v[0] === S[k]));
      S[k] = vals[(j + d + vals.length) % vals.length][0]; Save.save(); show(); onChange(k, S[k]);
    };
    show();
    this.open('scrSettings', {
      onOk: (i, b) => { const k = b.dataset.k; if (k === '@prep') onPrep(); else if (k === '@reset') { $('setAsk').classList.remove('hide'); $('setAskYes').onclick = () => { onReset(); $('setAsk').classList.add('hide'); }; $('setAskNo').onclick = () => $('setAsk').classList.add('hide'); } else step(i, 1); },
      onBack, help: true
    });
    box.querySelectorAll('.setVal').forEach((b, n) => b.querySelectorAll('.arr').forEach((a, j) => { a.onclick = e => { e.stopPropagation(); const i = Number(b.dataset.nav); this.setFocus(i, true); step(i, j ? 1 : -1); }; }));
  }
};

// ---------- コースの 小さな 絵（AN.5） ----------
export function drawCoursePic(cv, c) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, hz = H * 0.46;
  const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, c.sky.top); sky.addColorStop(1, c.sky.horizon);
  g.fillStyle = sky; g.fillRect(0, 0, W, hz);
  const R = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(c.no * 77);
  if (c.sky.night) { g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) g.fillRect(R() * W, R() * hz * 0.8, 2, 2); g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(W * 0.8, hz * 0.3, 16, 0, 7); g.fill(); }
  else { g.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 3; i++) { const x = R() * W, y = R() * hz * 0.5 + 10; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 16, y + Math.sin(k) * 4, 14 + k % 2 * 6, 0, 7); g.fill(); } } }
  // 遠く
  const ground = { meadow: '#7ccf5a', beach: '#f2e0b0', snow: '#f2f6fb', city: '#2b2f40' }[c.biome];
  if (c.biome === 'meadow') { g.fillStyle = '#a9d6a0'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(i * W / 3, hz + 4, W * 0.28, 40, 0, Math.PI, 0); g.fill(); } }
  if (c.biome === 'snow') { g.fillStyle = '#d6e2f0'; for (let i = 0; i < 4; i++) { const x = i * W / 3 + 20; g.beginPath(); g.moveTo(x - 90, hz + 2); g.lineTo(x, hz - 90 - R() * 40); g.lineTo(x + 90, hz + 2); g.fill(); } }
  if (c.biome === 'city') { for (let i = 0; i < 18; i++) { const w = 18 + R() * 30, h = 30 + R() * 90, x = R() * W; g.fillStyle = '#141833'; g.fillRect(x, hz - h, w, h); g.fillStyle = '#ffd98a'; for (let k = 0; k < 8; k++) if (R() < 0.5) g.fillRect(x + 3 + R() * (w - 8), hz - h + 6 + R() * (h - 12), 4, 5); } }
  g.fillStyle = ground; g.fillRect(0, hz, W, H - hz);
  if (c.biome === 'beach') { g.fillStyle = '#45d6c8'; g.beginPath(); g.moveTo(W * 0.62, hz); g.lineTo(W, hz); g.lineTo(W, H); g.lineTo(W * 0.92, H); g.closePath(); g.fill(); g.fillStyle = '#2b8fd0'; g.fillRect(W * 0.62, hz, W * 0.38, 6); }
  // 道（遠近の 台形）
  g.fillStyle = c.road.base; g.beginPath(); g.moveTo(W * 0.47, hz); g.lineTo(W * 0.53, hz); g.lineTo(W * 0.86, H); g.lineTo(W * 0.14, H); g.closePath(); g.fill();
  g.strokeStyle = c.road.curb[1]; g.lineWidth = 6; g.beginPath(); g.moveTo(W * 0.47, hz); g.lineTo(W * 0.14, H); g.moveTo(W * 0.53, hz); g.lineTo(W * 0.86, H); g.stroke();
  if (c.road.center) { g.strokeStyle = c.road.center; g.lineWidth = 4; g.setLineDash([12, 12]); g.beginPath(); g.moveTo(W / 2, hz); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]); }
  // 道ぞいの 物
  const tree = (x, y, s) => {
    if (c.biome === 'meadow') { g.fillStyle = '#7a5230'; g.fillRect(x - 3 * s, y - 20 * s, 6 * s, 20 * s); g.fillStyle = '#4fae3a'; g.beginPath(); g.arc(x, y - 30 * s, 16 * s, 0, 7); g.fill(); }
    if (c.biome === 'beach') { g.strokeStyle = '#a07a4a'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6 * s, y - 25 * s, x + 12 * s, y - 45 * s); g.stroke(); g.fillStyle = '#3fae5a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + 12 * s + Math.cos(k * 1.3) * 12 * s, y - 45 * s + Math.sin(k * 1.3) * 4 * s, 14 * s, 4 * s, k * 1.3, 0, 7); g.fill(); } }
    if (c.biome === 'snow') { g.fillStyle = '#2f7a4a'; g.beginPath(); g.moveTo(x - 14 * s, y); g.lineTo(x, y - 46 * s); g.lineTo(x + 14 * s, y); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 6 * s, y - 28 * s); g.lineTo(x, y - 46 * s); g.lineTo(x + 6 * s, y - 28 * s); g.fill(); }
    if (c.biome === 'city') { g.fillStyle = '#4a5068'; g.fillRect(x - 2 * s, y - 50 * s, 4 * s, 50 * s); g.fillStyle = '#ffe6a0'; g.beginPath(); g.arc(x, y - 52 * s, 6 * s, 0, 7); g.fill(); g.fillStyle = 'rgba(255,230,160,0.25)'; g.beginPath(); g.arc(x, y - 52 * s, 16 * s, 0, 7); g.fill(); }
  };
  for (const [fx, fy, s] of [[0.08, 0.95, 1.4], [0.24, 0.66, 0.8], [0.35, 0.55, 0.5], [0.92, 0.95, 1.4], [0.76, 0.66, 0.8], [0.65, 0.55, 0.5]]) tree(W * fx, H * fy, s);
}
