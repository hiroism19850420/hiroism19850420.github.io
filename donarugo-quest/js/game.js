// ドナルゴクエスト そして絶叫へ  ゲーム本体
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const R = (a, b) => a + Math.random() * (b - a);
  const RI = (a, b) => Math.round(R(a, b));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const Q = new URLSearchParams(location.search);
  const DEBUG = Q.has('debug');

  // ============================================================ 調整用の数字
  const CFG = {
    hp: 100, mp: 24,
    lenMin: 0.6, lenFull: 2.6,        // 語尾を伸ばす長さ(秒)。lenFull で満点
    volMin: 0.5, volFull: 0.92,       // 声の大きさ(0〜1)。volFull で満点
    critBase: 1 / 16, critVol: 1 / 16, critEstalos: 1 / 5, critMul: 3,
    shoutTime: 3.0, shoutNeed: 0.2, shoutFull: 1.4,
    noVolPower: 0.3,                  // 音量を測れない端末での固定威力(0〜1)
    healBase: 40, chipRate: 0.15, chipsToWake: 3,
    ultA: 60, ultB: 100,
  };
  const SPELLS = {
    fire: { name: 'ファイヤー', stem: 'ファイヤ', elem: 'fire', mp: 0, base: 10, al: ['ファイヤ', 'ファイア', 'フアイヤ', 'ハイヤ', 'fire'] },
    ice: { name: 'フリーザー', stem: 'フリーザ', elem: 'ice', mp: 0, base: 10, al: ['フリザ', 'フリイザ', 'プリザ', 'ブリザ', 'freezer', 'frieza'] },
    thunder: { name: 'サンダー', stem: 'サンダ', elem: 'thunder', mp: 0, base: 10, al: ['サンダ', 'thunder', 'サンダア'] },
    heal: { name: 'リカバー', stem: 'リカバ', mp: 3, al: ['リカバ', 'recover'] },
    destroy: { name: 'デストロイヤー', stem: 'デストロイヤ', mp: 8, base: 30, all: true, al: ['デストロイヤ', 'デストロイア', 'デストロイ', 'destroyer', 'destroy'] },
  };
  const SP_ORDER = ['fire', 'ice', 'thunder', 'heal', 'destroy'];
  const ELC = { fire: '#ff5a2a', ice: '#5bd6ff', thunder: '#ffe14d', heal: '#6bff9a', destroy: '#c98aff', ult: '#fff' };
  const UT = {
    eternal: { label: 'エターナル', al: ['エターナル', 'eternal'] },
    infinity: { label: 'インフィニティ', al: ['インフィニティ', 'インフィニテイ', 'インフィニチ', 'infinity'] },
    ultimate: { label: 'アルティメット', al: ['アルティメット', 'アルテメット', 'アルチメット', 'アルティメイト', 'ultimate'] },
    final: { label: 'ファイナル', al: ['ファイナル', 'final'] },
    destroyer: { label: 'デストロイヤー', al: SPELLS.destroy.al },
  };
  const UT_ORDER = ['eternal', 'infinity', 'ultimate', 'final', 'destroyer'];
  const UT_A = ['ultimate', 'final', 'destroyer'];
  const ULT_NAME = { A: 'アルティメット・ファイナル・デストロイヤー', B: 'エターナル・インフィニティ・アルティメット・ファイナル・デストロイヤー' };
  const LEARN_TEXT = {
    ice: 'こおりの じゅもん。<br>ほのおや どろの てきに よくきく。',
    heal: 'HPを かいふくする じゅもん。<br>MPを 3 つかう。',
    thunder: 'いかずちの じゅもん。<br>みずの てきに よくきく。',
    destroy: 'てき ぜんたいを ふきとばす だいまほう。<br>MPを 8 つかう。',
    ult: 'きゅうきょくの じゅもん。<br>1かいの たたかいで それぞれ 1どだけ。<br>ながく！ せいかくに！ さいだいおんりょうで！',
  };

  const ENEMIES = {
    pururin: { name: 'プルリン', art: 'pururin', hp: 34, gauge: 9, atk: [5, 7], weak: null, shoutAt: 0.3, learn: 'ice', bgm: 'battle', bg: 'field', h: 58 },
    dorohands: { name: 'ドロハンズ', art: 'dorohands', hp: 28, gauge: 6.5, atk: [6, 8], weak: 'ice', shoutAt: 0.3, group: true, max: 3, learn: 'heal', bgm: 'battle', bg: 'field',
      intro: ['どろの からだは こおらせると もろそうだ。'] },
    muza: { name: 'まおうムーザ', art: 'muza', hp: 520, gauge: 5.6, atk: [20, 25], big: { every: 3, atk: [34, 40], msg: 'は はげしい ほのおを はいた！' }, weak: 'ice', learn: 'thunder', bgm: 'boss', bg: 'castle', h: 88,
      intro: ['りょうてに ほのおを まとっている…'] },
    despierre: { name: 'デスピエール', resist: 0.5, learn: 'destroy', bgm: 'boss', bg: 'circus', h: 90, intro: ['みずの かめんを つけている…'],
      forms: [
        { art: 'despierre1', hp: 160, weak: 'thunder', gauge: 5.2, atk: [16, 20] },
        { art: 'despierre2', hp: 160, weak: 'fire', gauge: 4.8, atk: [19, 24], msg: ['かめんが われた！', 'こおりの かめんに かわった！'] },
        { art: 'despierre3', hp: 180, weak: 'ice', gauge: 4.4, atk: [22, 28], msg: ['デスピエールが しょうたいを あらわした！', 'ほのおの かめんが もえている！'] },
      ] },
    milgados: { name: 'だいまおうミルガドス', learn: 'ult', bg: 'makai', h: 92, intro: ['「わが まりょくの まえに ひれふすがよい…」'],
      forms: [
        { art: 'milgados1', hp: 260, weak: 'thunder', gauge: 5.2, atk: [14, 18], bgm: 'maou' },
        { art: 'milgados2', hp: 340, weak: null, gauge: 4.2, atk: [19, 24], big: { every: 4, atk: [28, 32], msg: 'は 4ほんの うでを ふりまわした！' }, bgm: 'maou2',
          msg: ['「おのれ… ほんとうの すがたを みせてやろう！」', 'ミルガドスが きょだいな まものに すがたを かえた！'] },
      ] },
    estalos: { name: 'ていおうエスタロス', art: 'estalos_sleep', artAwake: 'estalos', hp: 800, gauge: 4.2, atk: [40, 48], big: { every: 3, atk: [60, 70], msg: 'は きょだいな やいばを ふりおろした！' },
      sleep: true, estalos: true, shoutAt: 0.08, bg: 'abyss', h: 96, intro: ['…ねむっている ようだ。', 'おおごえを だすと おきてしまいそうだ…'] },
  };
  const STAGES = [
    { title: 'はじまりの そうげん', battles: ['pururin', 'dorohands'] },
    { title: 'まおうの しろ', battles: ['muza'] },
    { title: 'まよなかの サーカス', battles: ['despierre'] },
    { title: 'まかいの はて', battles: ['milgados', 'estalos'] },
  ];

  // ============================================================ 文字の正規化と呪文の判定
  const norm = (s) => (s || '').normalize('NFKC').toLowerCase()
    .replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[ー－―‐\-~〜\s・、。,.!！?？「」『』…]/g, '');
  Object.values(SPELLS).forEach(s => { s.al = s.al.map(norm); });
  Object.values(UT).forEach(s => { s.al = s.al.map(norm); });
  function findSpell(n) {
    let best = null, bi = 1e9;
    for (const id of P.spells) for (const a of SPELLS[id].al) { const i = n.indexOf(a); if (i >= 0 && i < bi) { bi = i; best = id; } }
    return best;
  }
  function lev(a, b) {
    const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  function fuzzy(n) {
    if (n.length < 2 || n.length > 12) return null;
    let best = null, bs = 0;
    for (const id of P.spells) { const a = SPELLS[id].al[0]; const s = 1 - lev(n, a) / Math.max(n.length, a.length); if (s > bs) { bs = s; best = id; } }
    return bs >= 0.5 ? best : null;
  }
  const hasUltPrefix = (n) => ['eternal', 'infinity', 'ultimate', 'final'].some(k => UT[k].al.some(a => n.includes(a)));

  // ============================================================ 状態
  const P = { name: 'ゆうしゃ', hp: CFG.hp, mp: CFG.mp, spells: ['fire'], ult: false };
  const stats = { maxVol: 0, maxDmg: 0, crits: 0 };
  const cal = { loud: 0 };
  let save = loadSave(), B = null, stageIdx = 0, lastShout = { url: null, text: '', peak: 0 }, newSpell = null;
  let nameWait = null, screamWait = null, tapMode = DEBUG, settingsOpen = false, started = false, runId = 0;
  const dbg = { vol: 0.85, dur: 1500 };
  const IMG = new Set(window.DQ_IMAGES || []);

  function loadSave() { try { return JSON.parse(localStorage.getItem('donarugo_save')) || null; } catch (e) { return null; } }
  function saveGame() { save = { name: P.name, stage: Math.max(stageIdx, save ? save.stage || 0 : 0), spells: P.spells, ult: P.ult, loud: cal.loud, cast: true }; try { localStorage.setItem('donarugo_save', JSON.stringify(save)); } catch (e) { } }

  // ============================================================ 表示
  const msgEl = $('#msg'), ov = $('#overlay'), fieldEl = $('#field');
  function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); if (id === 'game') FX.resize(); }
  function say(text, cls) {
    const p = document.createElement('p'); if (cls) p.className = cls; msgEl.appendChild(p);
    while (msgEl.children.length > 3) msgEl.firstChild.remove();
    const ch = [...text]; let i = 0;
    const id = setInterval(() => { i += 2; p.textContent = ch.slice(0, i).join(''); if (i >= ch.length) clearInterval(id); }, 22);
  }
  async function tell(text, wait = 800, cls) { say(text, cls); await sleep([...text].length * 12 + wait); }
  function showOv(html, cls = '') { ov.className = cls; ov.innerHTML = html; ov.hidden = false; }
  function hideOv() { ov.hidden = true; ov.innerHTML = ''; }
  const tapOn = (sel) => new Promise(res => { const el = typeof sel === 'string' ? $(sel) : sel; el.addEventListener('click', () => { AudioSys.sfx('cursor'); res(el.id); }, { once: true }); });

  function renderStatus() {
    $('#pname').textContent = P.name;
    const h = P.hp / CFG.hp, hf = $('#hp-fill');
    hf.style.width = (h * 100) + '%'; hf.className = h <= 0.25 ? 'low' : h <= 0.5 ? 'mid' : '';
    $('#hp-num').textContent = P.hp + '/' + CFG.hp;
    $('#mp-fill').style.width = (P.mp / CFG.mp * 100) + '%'; $('#mp-num').textContent = P.mp + '/' + CFG.mp;
    $('#status').classList.toggle('danger', h <= 0.25);
  }
  function renderSpells() {
    let h = '';
    const first = P.spells.length === 1 && !P.ult && !(save && save.cast);
    for (const id of SP_ORDER) {
      if (!P.spells.includes(id)) continue;
      const sp = SPELLS[id];
      h += `<div class="sp ${P.mp < sp.mp ? 'off' : ''} ${newSpell === id ? 'new' : ''} ${first ? 'first' : ''} ${tapMode ? 'tap' : ''}" data-say="${sp.name}"><i style="background:${ELC[id]}"></i>${sp.name}${sp.mp ? `<em>MP${sp.mp}</em>` : ''}</div>`;
    }
    if (P.ult) for (const t of ['A', 'B']) {
      const used = B && B.ultUsed[t];
      h += `<div class="sp wide ${used ? 'off' : ''} ${newSpell === 'ult' ? 'new' : ''} ${tapMode ? 'tap' : ''}" data-say="${ULT_NAME[t]}" data-long="1"><i style="background:${t === 'B' ? '#ffe14d' : '#fff'}"></i>${ULT_NAME[t]}<em>${used ? 'つかった' : '1かい'}</em></div>`;
    }
    $('#cmd').innerHTML = h;
  }
  $('#cmd').addEventListener('click', (e) => {
    const el = e.target.closest('.sp'); if (!el || !tapMode) return;
    Voice.sim(el.dataset.say, dbg.vol, el.dataset.long ? Math.max(3000, dbg.dur + 1800) : dbg.dur);
  });
  function artHTML(id) { return IMG.has(id) ? `<img src="assets/img/${id}.png" alt="">` : Monsters.draw(id); }
  function setBg(kind) { $('#bg').innerHTML = IMG.has('bg_' + kind) ? `<img src="assets/img/bg_${kind}.png" alt="">` : Monsters.bg(kind); }
  function showHeard(t) { const s = [...(t || '').trim()]; $('#heard').textContent = s.length > 18 ? '…' + s.slice(-18).join('') : s.join('') || '…'; }
  function updateMic() {
    $('#mic-fill').style.width = (Voice.st.level * 100).toFixed(1) + '%';
    const off = Voice.st.mode === 'none' || Voice.st.denied;
    $('#mic').classList.toggle('off', off);
  }
  const fdef = () => (B.d.forms ? Object.assign({}, B.d, B.d.forms[B.form]) : B.d);
  const alive = () => B.units.filter(u => u.hp > 0);
  const target = () => B.units.find(u => u.hp > 0) || B.units[B.units.length - 1];
  function center(u) {
    const fr = fieldEl.getBoundingClientRect(), r = u.el.getBoundingClientRect();
    return { x: r.left - fr.left + r.width / 2, y: r.top - fr.top + r.height * 0.52 };
  }
  function addUnit(f) {
    const u = { hp: f.hp, max: f.hp, el: document.createElement('div') };
    u.el.className = 'mon appear' + (B.d.group ? ' small' : '') + (B.sleeping ? ' sleeping' : '');
    if (!B.d.group && f.h) u.el.style.height = f.h + '%';
    u.el.innerHTML = `<div class="in">${artHTML(f.art)}</div>`;
    $('#mons').appendChild(u.el); B.units.push(u);
    setTimeout(() => u.el.classList.remove('appear'), 750);
    return u;
  }
  function anim(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }
  function renderEnemy() {
    if (!B) return;
    const t = target(), n = alive().length;
    $('#ename').textContent = B.d.name + (B.d.group && n > 1 ? ' ×' + n : '');
    $('#ehp').style.width = clamp(t.hp / t.max) * 100 + '%';
    B.units.forEach(u => u.el.classList.toggle('target', !!B.d.group && n > 1 && u === t));
  }
  function renderGauge() {
    const g = $('#gbar');
    $('#egauge').style.width = (B.sleeping ? 100 : clamp(B.gauge) * 100) + '%';
    g.classList.toggle('warn', !B.sleeping && B.gauge > 0.8);
    g.classList.toggle('sleep', !!B.sleeping);
  }

  // ============================================================ 戦闘
  function gaugeTime() { const f = fdef(); return B.d.group ? f.gauge / (1 + 0.3 * (alive().length - 1)) : f.gauge; }

  function runBattle(id) {
    return new Promise(async (resolve) => {
      const d = ENEMIES[id];
      B = { id, d, form: 0, gauge: 0, lock: 0, state: 'intro', actions: 0, units: [], charge: null, chant: null, pending: null,
        ultUsed: { A: false, B: false }, sleeping: !!d.sleep, chips: 0, loudT: 0, t0: 0, hintAt: 0, hintN: 0, resolve };
      const f = fdef();
      setBg(d.bg); $('#mons').innerHTML = ''; msgEl.innerHTML = ''; FX.clear();
      $('#chargeui').hidden = $('#chantui').hidden = $('#shoutui').hidden = true;
      addUnit(f); if (d.group) { addUnit(f); B.gauge = 0.55; }   // 群れは最初の「なかまを よぶ」が早めに来る
      renderEnemy(); renderGauge(); renderSpells(); renderStatus();
      AudioSys.sfx('appear');
      if (d.sleep) {
        AudioSys.playBgm('sleep'); AudioSys.setSfxVol(0.28);
        const ref = Math.max(cal.loud, stats.maxVol);
        B.wakeLine = ref ? clamp(ref * 0.66, 0.45, 0.62) : 0.58;
        $('#mic-line').hidden = false; $('#mic-line').style.left = (B.wakeLine * 100) + '%';
      } else { AudioSys.playBgm(f.bgm); AudioSys.setSfxVol(0.55); $('#mic-line').hidden = true; }
      const b = B;
      await tell(`${d.name}が あらわれた！`, 600);
      for (const line of (d.intro || [])) { if (B !== b) return; await tell(line, 500, 'hint'); }
      if (B !== b) return;
      B.state = 'active'; B.t0 = B.hintAt = performance.now();
    });
  }
  function endBattle(res) { if (!B || B.state === 'over') return; const r = B.resolve; B.state = 'over'; $('#mic-line').hidden = true; AudioSys.setSfxVol(0.55); r(res); }

  // ---------- 声を聞いたとき ----------
  Voice.on('heard', (h) => {
    showHeard(h.text);
    if (nameWait) { nameWait(h); return; }
    if (screamWait) { screamWait.text = h.text.trim(); return; }
    if (!B) return;
    if (B.state === 'shout') { if (B.shout) { B.shout.text = h.text.trim(); B.shout.chars = Math.max(B.shout.chars, norm(h.text).length); } return; }
    if (B.state !== 'active' || B.charge) return;
    if (B.lock > 0.25 || B.wantShout || B.wantMorph || B.wantWake) { B.pending = Object.assign({ t: performance.now() }, h); return; }
    hear(h);
  });
  function hear(h) {
    const ns = [h.text].concat(h.alts || []).map(norm);
    if (B.chant) { chantFeed(ns, h.final); return; }
    if (P.ult && (!B.ultUsed.A || !B.ultUsed.B) && ns.some(hasUltPrefix)) { startChant(); chantFeed(ns, h.final); return; }
    let hit = null;
    for (const n of ns) { hit = findSpell(n); if (hit) break; }
    if (hit) { cast(hit, 1); return; }
    if (!h.final || ns[0].length < 2) return;
    const fz = fuzzy(ns[0]);
    Voice.consume();
    if (fz) { say('じゅもんが すこし ずれた！', 'bad'); cast(fz, 0.5); }
    else { const s = [...h.text.trim()].slice(0, 8).join(''); say(`「${s}」…しかし なにも おこらなかった！`); AudioSys.sfx('miss'); B.lock = 0.3; }
  }
  function power(dur, peak) {
    const len = clamp((dur - CFG.lenMin) / (CFG.lenFull - CFG.lenMin)), vol = clamp((peak - CFG.volMin) / (CFG.volFull - CFG.volMin));
    return { len, vol, p: 0.5 * len + 0.5 * vol };
  }
  function cast(id, q) {
    const sp = SPELLS[id];
    if (P.mp < sp.mp) { Voice.consume(); say('MPが たりない！', 'bad'); AudioSys.sfx('miss'); B.lock = 0.4; return; }
    const now = performance.now(), u = Voice.utt(), lu = Voice.lastUtt();
    const c = { id, q, t0: now - 350, last: now, peak: 0, vol: Voice.volOK(), ended: false };
    if (c.vol) {
      if (u.active) { c.t0 = u.start; c.peak = u.peak; }
      else if (lu && now - lu.end < 1500) { c.t0 = lu.start; c.last = lu.end; c.peak = lu.peak; c.ended = true; }
      else c.ended = true;
    }
    B.charge = c;
    if (!B.sleeping) AudioSys.sfx('cast');
    $('#chargeui').hidden = false; drawCharge(c, (c.last - c.t0) / 1000);
    if (!c.vol || c.ended) releaseCast();
  }
  function drawCharge(c, dur) {
    const sp = SPELLS[c.id], pw = power(dur, c.peak), el = $('#charge-name');
    el.textContent = sp.stem + 'ー'.repeat(1 + Math.min(8, Math.floor(Math.max(0, dur - 0.5) * 3.5))) + '！';
    el.style.color = ELC[c.id]; el.style.transform = 'none';
    const fit = FX.size().W * 0.94 / Math.max(1, el.scrollWidth);
    el.style.transform = `scale(${Math.min(1 + pw.p * 0.35, fit).toFixed(2)})`;
    $('#charge-fill').style.width = (pw.p * 100).toFixed(0) + '%';
  }
  function updateCharge(now) {
    const c = B.charge, u = Voice.utt();
    if (u.active) { c.last = now; c.peak = Math.max(c.peak, u.peak); }
    drawCharge(c, (c.last - c.t0) / 1000);
    if (now - c.last > 300 || now - c.t0 > 4800) releaseCast();
  }
  function releaseCast() {
    const c = B.charge; B.charge = null; Voice.consume();
    setTimeout(() => { if (!B || !B.charge) $('#chargeui').hidden = true; }, 350);
    const sp = SPELLS[c.id];
    P.mp -= sp.mp;
    const pw = c.vol ? power((c.last - c.t0) / 1000, c.peak) : { len: CFG.noVolPower, vol: CFG.noVolPower, p: CFG.noVolPower };
    if (c.vol) stats.maxVol = Math.max(stats.maxVol, c.peak);
    if (!save || !save.cast) { save = save || {}; save.cast = true; setTimeout(() => say('（ごびを のばして おおきく さけぶと いりょくアップ！）', 'hint'), 1300); }
    say(`${P.name}は ${sp.name}を となえた！`);
    if (B.sleeping) {
      const loud = c.vol ? c.peak > B.wakeLine : c.id === 'destroy';
      if (loud) wake();
    }
    if (c.id === 'heal') doHeal(pw, c.q); else if (B.sleeping) chipHit(); else attack(sp, c.id, pw, c.q);
    renderStatus(); renderSpells();
  }
  function doHeal(pw, q) {
    const amt = Math.round(CFG.healBase * (1 + 0.6 * pw.p) * q), s = FX.size();
    P.hp = Math.min(CFG.hp, P.hp + amt);
    FX.heal(s.W / 2, s.H * 0.9, pw.p); AudioSys.sfx('heal'); FX.floater('+' + amt, s.W / 2, s.H * 0.82, 'heal');
    anim($('#status'), 'heal', 700);
    say(`HPが ${amt} かいふくした！`, 'good'); B.lock = Math.max(B.lock, 0.7);
  }
  function applyDmg(u, dmg) {
    const f = fdef(), lastForm = !B.d.forms || B.form === B.d.forms.length - 1;
    const others = B.units.filter(x => x !== u && x.hp > 0).length;
    let hp = u.hp - dmg;
    if (lastForm && others === 0) {
      const th = Math.ceil(u.max * (f.shoutAt == null ? 0.2 : f.shoutAt));
      if (hp <= th) { hp = Math.max(1, hp); B.wantShout = true; }
    } else if (hp <= 0) {
      hp = 0;
      if (!lastForm) B.wantMorph = true;
      else { u.el.classList.add('die'); const c = center(u); FX.dieDust(c.x, c.y); AudioSys.sfx('die'); setTimeout(() => u.el.remove(), 1000); }
    }
    u.hp = hp;
  }
  function attack(sp, id, pw, q) {
    const f = fdef(), targets = sp.all ? alive() : [target()];
    const fxAt = sp.all && targets.length > 1 ? { x: FX.size().W / 2, y: FX.size().H * 0.55 } : center(targets[0]);
    const delay = id === 'destroy' ? 480 : 90;
    if (id === 'fire') { FX.fire(fxAt.x, fxAt.y, pw.p); AudioSys.sfx('fire'); }
    else if (id === 'ice') { FX.ice(fxAt.x, fxAt.y, pw.p); AudioSys.sfx('ice'); }
    else if (id === 'thunder') { FX.thunder(fxAt.x, fxAt.y, pw.p); AudioSys.sfx('thunder'); }
    else { FX.destroy(fxAt.x, fxAt.y, pw.p); AudioSys.sfx('destroy'); }
    B.lock = Math.max(B.lock, id === 'destroy' ? 1.5 : 0.8);
    let tag = '';
    if (sp.elem && f.weak === sp.elem) tag = 'weak'; else if (sp.elem && f.weak && B.d.resist) tag = 'resist';
    const mul = tag === 'weak' ? 2 : tag === 'resist' ? B.d.resist : 1;
    let anyCrit = false;
    targets.forEach((u, i) => {
      const crit = Math.random() < (B.d.estalos ? CFG.critEstalos : CFG.critBase + CFG.critVol * pw.vol);
      const dmg = Math.max(1, Math.round(sp.base * (1 + pw.p) * mul * q * R(0.93, 1.07) * (crit ? CFG.critMul : 1)));
      anyCrit = anyCrit || crit;
      const c = center(u);
      applyDmg(u, dmg); stats.maxDmg = Math.max(stats.maxDmg, dmg);
      setTimeout(() => {
        anim(u.el, 'hit', 430);
        if (crit) { FX.crit(c.x, c.y); AudioSys.sfx('crit'); } else AudioSys.sfx('hit');
        FX.floater(dmg, c.x + R(-10, 10), c.y - i * 6, crit ? 'crit' : tag === 'weak' ? 'weak' : '');
        renderEnemy();
      }, delay + i * 70);
    });
    if (anyCrit) { stats.crits++; say('かいしんの いちげき！！', 'good'); }
    if (tag === 'weak') say('じゃくてんを ついた！', 'good'); else if (tag === 'resist') say('あまり きいていない…', 'bad');
  }
  function chipHit() {
    const u = target(), c = center(u), dmg = Math.ceil(u.max * CFG.chipRate);
    u.hp = Math.max(1, u.hp - dmg); B.chips++; stats.maxDmg = Math.max(stats.maxDmg, dmg);
    FX.chip(c.x, c.y); AudioSys.sfx('chip'); FX.floater(dmg, c.x, c.y, ''); renderEnemy();
    say('ねむっている すきに こっそり ダメージ！', 'good');
    B.lock = Math.max(B.lock, 0.9);
    if (B.chips >= CFG.chipsToWake) B.wantWake = true;
    else say(B.chips === 1 ? '…まだ ねむっている。' : '…ねいきが あらくなってきた。', 'hint');
  }
  function wake() {
    if (!B.sleeping) return;
    B.sleeping = false; B.wantWake = false; B.loudT = 0; B.gauge = 0; B.lock = 2.6;
    const u = B.units[0];
    $('#mic-line').hidden = true; AudioSys.setSfxVol(0.55); AudioSys.sfx('wake'); AudioSys.playBgm('estalos', 0.2);
    FX.flash('#ff2a1c', 0.85, 800); FX.shake(22, 1.3);
    u.el.classList.remove('sleeping'); anim(u.el, 'morph', 1400);
    setTimeout(() => { u.el.querySelector('.in').innerHTML = artHTML(B.d.artAwake); }, 500);
    say('ていおうエスタロスが めを さました！！', 'bad');
    if (B.chips < CFG.chipsToWake) say('けずりきる まえに おこしてしまった…！', 'bad');
    else say('いまだ！ きゅうきょくの じゅもんを さけべ！', 'hint');
    renderGauge();
  }
  function morph() {
    B.form++; const f = fdef(), u = B.units[0];
    B.lock = 2.0; B.gauge = 0;
    AudioSys.sfx('morph'); FX.flash('#fff', 0.9, 700); FX.shake(12, 0.8); anim(u.el, 'morph', 1400);
    setTimeout(() => { u.el.querySelector('.in').innerHTML = artHTML(f.art); if (f.h) u.el.style.height = f.h + '%'; u.hp = u.max = f.hp; renderEnemy(); }, 560);
    (f.msg || []).forEach((m, i) => setTimeout(() => say(m, 'bad'), i * 700));
    if (f.bgm) AudioSys.playBgm(f.bgm, 0.3);
  }

  // ---------- 究極呪文の詠唱 ----------
  function startChant() {
    const now = performance.now();
    B.chant = { t0: now, got: {}, last: now, voice: 0, peak: 0, vol: Voice.volOK(), fin: 0 };
    if (!B.sleeping) AudioSys.sfx('cast');
    const words = B.ultUsed.B ? UT_A : UT_ORDER;
    $('#chantui').innerHTML = `<div class="cap">きゅうきょくの じゅもん</div>` + words.map(k => `<span class="w" data-k="${k}">${UT[k].label}</span>`).join('') + `<div class="pbar"><i id="chant-fill"></i></div>`;
    $('#chantui').hidden = false; $('#chargeui').hidden = true;
  }
  function chantFeed(ns, final) {
    const c = B.chant, now = performance.now(); c.last = now;
    for (const k of UT_ORDER) if (!c.got[k] && ns.some(n => UT[k].al.some(a => n.includes(a)))) {
      c.got[k] = true; AudioSys.sfx('word');
      const el = $(`#chantui .w[data-k="${k}"]`); if (el) el.classList.add('on');
    }
    if (c.got.destroyer && !c.fin) c.fin = now;
  }
  function updateChant(now) {
    const c = B.chant, u = Voice.utt();
    if (c.vol && u.active) { c.voice = now; c.peak = Math.max(c.peak, u.peak); }
    if (c.fin) {
      const stretch = Math.max(0, (c.voice || c.fin) - c.fin) / 1000 + 0.6;
      const f = $('#chant-fill'); if (f) f.style.width = (power(stretch, c.peak).p * 100).toFixed(0) + '%';
      const quiet = c.vol ? now - Math.max(c.voice, c.fin) > 320 : now - c.fin > 250;
      if (quiet || now - c.fin > 3600) resolveChant();
    } else if (now - Math.max(c.last, c.voice) > 1700 || now - c.t0 > 13000) resolveChant();
  }
  function resolveChant() {
    const c = B.chant; B.chant = null; Voice.consume(); $('#chantui').hidden = true;
    const g = c.got;
    const type = (g.eternal || g.infinity) && !B.ultUsed.B ? 'B' : !B.ultUsed.A ? 'A' : 'B';
    const need = type === 'B' ? UT_ORDER : UT_A, hit = need.filter(k => g[k]).length;
    if (hit < 2) { say('じゅもんを かんでしまった！', 'bad'); say('（さいしょから となえなおそう）', 'hint'); AudioSys.sfx('miss'); B.lock = 0.5; return; }
    B.ultUsed[type] = true;
    const acc = hit / need.length;
    const stretch = c.fin ? Math.max(0, (c.voice || c.fin) - c.fin) / 1000 + 0.6 : 0;
    const pw = c.vol ? power(stretch, c.peak) : { len: CFG.noVolPower, vol: CFG.noVolPower, p: CFG.noVolPower };
    if (c.vol) stats.maxVol = Math.max(stats.maxVol, c.peak);
    if (B.sleeping) wake();
    say(`${P.name}は ${type === 'B' ? 'さいきょうの' : 'きゅうきょくの'} じゅもんを となえた！`);
    say(acc >= 1 ? 'かんぺきな えいしょう！' : `すこし かんだ…（せいかくさ ${Math.round(acc * 100)}%）`, acc >= 1 ? 'good' : 'bad');
    const u = target(), ct = center(u);
    const crit = Math.random() < (B.d.estalos ? CFG.critEstalos : CFG.critBase + CFG.critVol * pw.vol);
    const dmg = Math.max(1, Math.round((type === 'B' ? CFG.ultB : CFG.ultA) * acc * (1 + pw.p) * R(0.96, 1.04) * (crit ? CFG.critMul : 1)));
    FX.ultimate(ct.x, ct.y, pw.p, type === 'B'); AudioSys.sfx('ultimate');
    B.lock = Math.max(B.lock, 3.0);
    applyDmg(u, dmg); stats.maxDmg = Math.max(stats.maxDmg, dmg);
    setTimeout(() => {
      anim(u.el, 'hit', 430);
      if (crit) { FX.crit(ct.x, ct.y); AudioSys.sfx('crit'); stats.crits++; say('かいしんの いちげき！！', 'good'); }
      FX.floater(dmg, ct.x, ct.y, crit ? 'crit' : 'weak'); renderEnemy();
    }, 1500);
    renderSpells();
  }

  // ---------- 敵の行動 ----------
  function enemyAct() {
    B.gauge = 0; B.actions++;
    const f = fdef(), n = alive().length, s = FX.size();
    if (B.d.group && n < B.d.max && B.actions % 2 === 1) {
      AudioSys.sfx('call'); addUnit(f); renderEnemy(); say(`${B.d.name}は なかまを よんだ！`, 'bad'); B.lock = 0.5; return;
    }
    const big = f.big && B.actions % f.big.every === 0;
    let dmg = RI(...(big ? f.big.atk : f.atk)); if (B.d.group) dmg += 2 * (n - 1);
    alive().forEach(u => anim(u.el, 'atk', 500));
    FX.slash(); AudioSys.sfx('enemyAtk'); setTimeout(() => AudioSys.sfx('hurt'), 120);
    P.hp = Math.max(0, P.hp - dmg);
    FX.floater('-' + dmg, s.W / 2, s.H * 0.86, 'hurt'); anim($('#status'), 'shake', 500);
    say(big ? `${B.d.name}${f.big.msg}` : `${B.d.name}の こうげき！`);
    say(`${P.name}は ${dmg}の ダメージを うけた！`, 'bad');
    B.lock = Math.max(B.lock, 0.6); renderStatus();
    if (P.hp <= 0) {
      B.state = 'dead'; B.charge = B.chant = null; $('#chargeui').hidden = $('#chantui').hidden = true;
      AudioSys.stopBgm(0.4);
      setTimeout(() => say(`${P.name}は ちからつきた…`, 'bad'), 700);
      setTimeout(() => endBattle('dead'), 2000);
    }
  }

  // ---------- SHOUT フィニッシュ ----------
  async function startShout() {
    B.state = 'shout'; B.charge = B.chant = null; $('#chargeui').hidden = $('#chantui').hidden = true;
    const s = B.shout = { t: 0, score: 0, peak: 0, text: '', chars: 0, ready: false, ending: false };
    $('#shout-meter i').style.width = '0%'; $('#shout-time i').style.width = '100%'; $('#shoutui').hidden = false;
    AudioSys.duck(0.2); AudioSys.sfx('shout');
    say('いまだ！ とどめを さけべ！！', 'good');
    const b = B;
    await Voice.shoutPhase(true);
    if (B !== b) { Voice.shoutPhase(false); return; }
    Voice.recordStart();
    s.ready = true;
  }
  function updateShout(dt) {
    const s = B.shout; if (!s || !s.ready || s.ending) return;
    s.t += dt;
    const has = Voice.levelOK(), lv = has ? Voice.st.raw : 0, k = clamp((lv - 0.5) / 0.4);
    s.score += dt * k; s.peak = Math.max(s.peak, lv); s.has = s.has || has;
    $('#shout-meter i').style.width = (clamp(s.has ? s.score / CFG.shoutFull : s.chars / 8) * 100).toFixed(0) + '%';
    $('#shout-time i').style.width = (clamp(1 - s.t / CFG.shoutTime) * 100).toFixed(0) + '%';
    if (k > 0.1) { const c = center(target()); FX.shoutSpark(c.x, c.y, k); if (k > 0.5) FX.shake(5 * k, 0.12); }
    if (s.t >= CFG.shoutTime) endShout();
  }
  async function endShout() {
    const s = B.shout; s.ending = true;
    const b = B;
    const url = await Voice.recordStop();
    await Voice.shoutPhase(false);
    $('#shoutui').hidden = true; AudioSys.duck(1);
    if (B !== b) return;
    const sc = s.has ? clamp(s.score / CFG.shoutFull) : clamp(s.chars / 8);
    keepShout(url, s.text, s.peak);
    const u = target(), c = center(u);
    if (sc >= CFG.shoutNeed) {
      FX.shoutEnd(c.x, c.y, sc); AudioSys.sfx('shoutEnd'); FX.floater(Math.round(100 + 899 * sc), c.x, c.y, 'shout');
      u.hp = 0; renderEnemy(); win();
    } else {
      say('こえが とどかない！', 'bad'); say(`${B.d.name}は もちこたえた！`);
      B.state = 'active'; B.lock = 0.6;
    }
  }
  function keepShout(url, text, peak) {
    if (url && lastShout.url) { try { URL.revokeObjectURL(lastShout.url); } catch (e) { } }
    lastShout = { url: url || (text ? null : lastShout.url), text: text || '', peak };
    stats.maxVol = Math.max(stats.maxVol, peak);
  }
  async function win() {
    const b = B;
    B.state = 'win'; AudioSys.stopBgm(0.2);
    await sleep(350); if (B !== b) return;
    B.units.forEach(u => { if (u.el.isConnected) { u.el.classList.add('die'); const c = center(u); FX.dieDust(c.x, c.y); } });
    AudioSys.sfx('die');
    await sleep(1000); if (B !== b) return;
    say(`${B.d.name}を やっつけた！`, 'good');
    AudioSys.jingle('win');
    await sleep(4400); if (B !== b) return;
    endBattle('win');
  }

  // ---------- 毎フレーム ----------
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    Voice.update(now); updateMic(); FX.update(dt);
    if (settingsOpen) renderDiag();
    if (!B) return;
    if (B.state === 'active') {
      if (B.lock > 0) B.lock -= dt;
      else if (B.wantWake) wake();
      else if (B.wantMorph) { B.wantMorph = false; morph(); }
      else if (B.wantShout) { B.wantShout = false; startShout(); }
      else {
        if (!B.sleeping) { B.gauge += dt / gaugeTime(); if (B.gauge >= 1) enemyAct(); }
        if (B.state === 'active' && B.pending && !B.charge && !B.chant) { const h = B.pending; B.pending = null; if (now - h.t < 1500) hear(h); }
      }
      if (B.state === 'active' && B.charge) updateCharge(now);
      if (B.state === 'active' && B.chant) updateChant(now);
      if (B.state === 'active' && B.sleeping && B.lock <= 0 && Voice.volOK()) {
        B.loudT = Voice.st.raw > B.wakeLine ? B.loudT + dt : Math.max(0, B.loudT - dt * 2);
        if (B.loudT > 0.16) wake();
      }
      if (B.id === 'pururin' && !(save && save.cast) && B.hintN < 3 && now - B.hintAt > 6000) { B.hintAt = now; B.hintN++; say('（こえに だして 「ファイヤー」と となえよう）', 'hint'); }
      renderGauge();
    } else if (B.state === 'shout') updateShout(dt);
  }

  // ============================================================ 進行
  async function stageCard(i) {
    AudioSys.stopBgm(0.3);
    showOv(`<div class="stagecard"><p class="sub">ステージ ${i + 1}</p><h2>${STAGES[i].title}</h2></div>`);
    const my = runId;
    AudioSys.sfx('stage'); await sleep(1900); if (my === runId) hideOv();
  }
  async function learnCard(id) {
    newSpell = id; renderSpells();
    const name = id === 'ult' ? `${ULT_NAME.A}<br><br>${ULT_NAME.B}` : SPELLS[id].name;
    showOv(`<p>${P.name}は あたらしい じゅもんを おぼえた！</p><p class="big" style="${id === 'ult' ? 'font-size:1.05em' : ''}">${name}</p><p class="sub">${LEARN_TEXT[id]}</p><button class="btn" id="lc-ok">つぎへ</button>`, 'clear');
    AudioSys.jingle('learn');
    const my = runId;
    await Promise.race([tapOn('#lc-ok'), sleep(9000)]);
    if (my !== runId) return;
    hideOv(); setTimeout(() => { newSpell = null; }, 4000);
  }
  async function estalosIntro() {
    AudioSys.stopBgm(0.5);
    $('#mons').innerHTML = ''; msgEl.innerHTML = '';
    await tell('せかいに へいわが もどった…', 1200);
    await tell('……はず だった。', 1000);
    AudioSys.sfx('wake'); FX.shake(16, 1.4); $('#bg').style.filter = 'brightness(.2)';
    await tell('まかいの そこから おそろしい けはいが する…！', 1500, 'bad');
    $('#bg').style.filter = '';
  }
  async function runStage(i) {
    const my = ++runId;
    stageIdx = i; P.hp = CFG.hp; P.mp = CFG.mp; B = null;
    show('game'); msgEl.innerHTML = ''; $('#mons').innerHTML = ''; setBg(ENEMIES[STAGES[i].battles[0]].bg); renderStatus(); renderSpells();
    $('#ename').textContent = ''; $('#ehp').style.width = '0%'; $('#egauge').style.width = '0%';
    await stageCard(i);
    for (const id of STAGES[i].battles) {
      if (my !== runId) return;
      if (id === 'estalos') await estalosIntro();
      const res = await runBattle(id);
      if (my !== runId) return;
      if (res === 'dead') return onDeath(i, id);
      const d = ENEMIES[id];
      if (d.learn === 'ult') { if (!P.ult) { P.ult = true; await learnCard('ult'); } }
      else if (d.learn && !P.spells.includes(d.learn)) { P.spells.push(d.learn); await learnCard(d.learn); }
      if (my !== runId) return;
      saveGame();
    }
    if (i < STAGES.length - 1) {
      stageIdx = i + 1; saveGame();
      showOv(`<h2>ステージ ${i + 1} クリア！</h2><p class="sub">HPと MPが ぜんかいふくした</p>`, 'clear');
      await sleep(1800); if (my !== runId) return;
      hideOv();
      return runStage(i + 1);
    }
    msgEl.innerHTML = ''; AudioSys.playBgm('ending', 0.6);
    await tell('ていおうエスタロスは くずれおちた…', 1300, 'good');
    await tell('まかいに しずけさが もどった。', 1300);
    await tell(`${P.name}の ぜっきょうは せかいじゅうに ひびき…`, 1300);
    await tell('やがて でんせつと なった。', 1800, 'good');
    if (my !== runId) return;
    return result('true');
  }
  async function onDeath(i, id) {
    if (i < STAGES.length - 1) {
      AudioSys.jingle('lose');
      showOv(`<h2>${P.name}は<br>ちからつきた…</h2><p class="sub">おぼえた じゅもんは のこっている</p><button class="btn primary" id="go-retry">もういちど たたかう</button><button class="btn" id="go-title">タイトルへ</button>`);
      const my = runId;
      const b = await Promise.race([tapOn('#go-retry'), tapOn('#go-title')]);
      if (my !== runId) return;
      hideOv();
      return b === 'go-retry' ? runStage(i) : toTitle();
    }
    const my = runId;
    await lastScream();
    if (my !== runId) return;
    return result(id === 'estalos' ? 'normal' : 'bad');
  }
  async function lastScream() {
    showOv(`<h2>${P.name}は<br>ちからつきようとしている…</h2><p class="big">さいごに さけべ！！</p><div class="meter"><i id="ls-fill"></i></div>`, 'clear');
    AudioSys.sfx('shout'); AudioSys.duck(0.15);
    screamWait = { text: '' };
    await Voice.shoutPhase(true); Voice.recordStart();
    let peak = 0; const t0 = performance.now();
    while (performance.now() - t0 < 3200) {
      const lv = Voice.levelOK() ? Voice.st.raw : 0; peak = Math.max(peak, lv);
      const f = $('#ls-fill'); if (f) f.style.width = (lv * 100).toFixed(0) + '%';
      await sleep(40);
    }
    const my = runId;
    const url = await Voice.recordStop(); await Voice.shoutPhase(false);
    keepShout(url, screamWait.text, peak); screamWait = null; AudioSys.duck(1);
    if (my === runId) hideOv();
  }
  function rank() {
    const v = stats.maxVol;
    return v >= 0.9 ? 'ぜっきょうの でんせつ' : v >= 0.78 ? 'おたけびの ゆうしゃ' : v >= 0.62 ? 'こえの せんし' : v > 0 ? 'ささやきの たびびと' : 'なぞの たびびと';
  }
  async function result(kind) {
    B = null; show('game');
    const head = {
      true: ['しんの エンディング', `ていおうエスタロスを<br>たおした！<br>${P.name}の ぜっきょうは<br>でんせつと なった。`],
      normal: ['つうじょう エンディング', `だいまおうは たおれた。<br>しかし ていおうには<br>あと いっぽ とどかなかった…`],
      bad: ['ぜんめつ', `だいまおうの まえに<br>${P.name}は たおれた…`],
    }[kind];
    if (kind === 'bad') AudioSys.jingle('lose'); else AudioSys.playBgm('ending', 0.6);
    const t = lastShout.text ? [...lastShout.text].slice(0, 14).join('') : '';
    const hasVoice = !!lastShout.url;
    showOv(`<span class="stamp">${head[0]}</span><h2>${head[1]}</h2>
      <table class="res-table"><tr><td>しょうごう</td><td>${rank()}</td></tr>
      <tr><td>さいだい おんりょう</td><td>${stats.maxVol ? Math.round(stats.maxVol * 100) + ' / 100' : 'はかれず'}</td></tr>
      <tr><td>さいだい ダメージ</td><td>${stats.maxDmg}</td></tr></table>
      <div class="win card"><p>${P.name}は さけんだ！</p><p class="big" style="font-size:1.3em">『${t || 'ことばに ならない さけび'}』</p>
      ${hasVoice ? `<div class="wave" id="wave">${'<i></i>'.repeat(17)}</div><button class="btn" id="rs-play">▶ さいごの さけびを きく</button>` : ''}</div>
      <div class="row"><button class="btn" id="rs-retry">もういちど</button><button class="btn" id="rs-title">タイトルへ</button></div>`);
    let au = null;
    const play = () => {
      if (!hasVoice) return;
      try { if (au) au.pause(); au = new Audio(lastShout.url); AudioSys.duck(0.12); $('#wave').classList.add('play');
        au.onended = au.onerror = () => { AudioSys.duck(1); const w = $('#wave'); if (w) w.classList.remove('play'); };
        au.play().catch(() => { AudioSys.duck(1); const w = $('#wave'); if (w) w.classList.remove('play'); });
      } catch (e) { }
    };
    if (hasVoice) { $('#rs-play').addEventListener('click', play); setTimeout(play, 1400); }
    const b = await Promise.race([tapOn('#rs-retry'), tapOn('#rs-title')]);
    if (au) au.pause(); AudioSys.duck(1); hideOv();
    return b === 'rs-retry' ? runStage(STAGES.length - 1) : toTitle();
  }

  // ---------- なまえ ----------
  async function nameEntry() {
    await sleep(400);
    const typing = Voice.st.mode === 'none' || Voice.st.denied;
    for (;;) {
      showOv(`<h2>なまえを<br>さけんでください</h2><div class="meter"><i id="nm-fill"></i></div><p class="big" id="nm-heard">…</p>
        ${typing ? '<input id="nm-input" maxlength="6" placeholder="なまえ" style="font:inherit;width:70%;text-align:center;background:#000;color:#fff;border:.14em solid #fff;border-radius:.4em;padding:.4em"><button class="btn" id="nm-ok">けってい</button>' : '<p class="sub">マイクに むかって おおきな こえで どうぞ</p>'}
        <button class="btn" id="nm-skip">「ゆうしゃ」で はじめる</button>`);
      const meter = setInterval(() => { const f = $('#nm-fill'); if (f) f.style.width = (Voice.st.level * 100).toFixed(0) + '%'; }, 50);
      // 確定結果が来ない端末(iPhone など)では、途中結果が 1.6 秒変わらなければ採用する
      const heard = new Promise(res => { let tm = null; nameWait = (h) => { const s = cleanName(h.text); if (!s) return; $('#nm-heard').textContent = s; clearTimeout(tm); if (h.final) res(s); else tm = setTimeout(() => res(s), 1600); }; });
      const picks = [heard, tapOn('#nm-skip').then(() => 'ゆうしゃ')];
      if (typing) picks.push(tapOn('#nm-ok').then(() => cleanName($('#nm-input').value) || 'ゆうしゃ'));
      const name = await Promise.race(picks);
      nameWait = null; clearInterval(meter); Voice.consume();
      const lu = Voice.lastUtt(), u = Voice.utt();
      const peak = Math.max(u.active ? u.peak : 0, lu && performance.now() - lu.end < 4000 ? lu.peak : 0);
      showOv(`<p>ゆうしゃの なまえは</p><p class="big">${name}</p><p class="sub">${peak ? 'こえの おおきさ ' + Math.round(peak * 100) : ''}</p><div class="row"><button class="btn primary" id="nm-yes">これで いく</button><button class="btn" id="nm-no">もういちど</button></div>`);
      const b = await Promise.race([tapOn('#nm-yes'), tapOn('#nm-no')]);
      if (b === 'nm-yes') { P.name = name; if (peak) cal.loud = peak; hideOv(); return; }
    }
  }
  const cleanName = (s) => [...(s || '').normalize('NFKC').replace(/[\s、。,.!！?？「」『』…<>&"']/g, '')].slice(0, 6).join('');

  // ---------- タイトル ----------
  function toTitle() {
    runId++; B = null; hideOv(); show('title'); AudioSys.duck(1); AudioSys.playBgm('title', 0.5);
    save = loadSave(); $('#btn-cont').hidden = !(save && save.name && (save.stage > 0 || (save.spells && save.spells.length > 1)));
  }
  async function begin(cont) {
    AudioSys.init(); AudioSys.sfx('cursor');
    AudioSys.preload(['battle', 'win', 'learn', 'boss']);
    if (!started) {
      started = true;
      await Voice.begin(AudioSys.ctx, $('#set-mic').value);
      if (Voice.st.mode === 'none' && !DEBUG) {
        tapMode = true; $('#set-tap').checked = true;
        showOv(`<h2>この ブラウザは おんせいにんしきに たいおうしていません</h2><p class="sub">Chrome・Edge・Safari で ひらくと こえで あそべます。<br>このまま タップで じゅもんを だす テストモードで はじめます。</p><button class="btn" id="ns-ok">OK</button>`);
        await tapOn('#ns-ok'); hideOv();
      }
    }
    AudioSys.stopBgm(0.4);
    stats.maxVol = stats.maxDmg = stats.crits = 0;
    if (cont && save) {
      P.name = save.name; P.spells = save.spells.slice(); P.ult = !!save.ult; cal.loud = save.loud || 0;
      return runStage(Math.min(save.stage || 0, STAGES.length - 1));
    }
    P.spells = ['fire']; P.ult = false; save = null; stageIdx = 0;
    try { localStorage.removeItem('donarugo_save'); } catch (e) { }
    show('game'); setBg('field'); renderStatus(); renderSpells(); msgEl.innerHTML = '';
    await nameEntry();
    return runStage(0);
  }
  $('#title').addEventListener('pointerdown', (e) => { if (!e.target.closest('button') && !AudioSys.ctx) { AudioSys.init(); AudioSys.playBgm('title', 0.5); } });
  $('#btn-new').addEventListener('click', () => begin(false));
  $('#btn-cont').addEventListener('click', () => begin(true));

  // ---------- せってい / マイクテスト ----------
  function renderDiag() {
    const s = Voice.st;
    $('#diag').textContent = `にんしき: ${s.supported ? (s.recOn ? 'うごいている' : 'とまっている') : 'ひたいおう'} / マイク: ${s.micOn ? 'ON' : 'OFF'} / ほうしき: ${s.mode}\n` +
      `おんりょう: ${(s.raw * 100).toFixed(0)} (${s.db.toFixed(0)}dB) しきい: ${(Voice.thr() * 100).toFixed(0)} さいだい: ${(stats.maxVol * 100).toFixed(0)}\n` +
      `けっか: ${s.results}かい エラー: ${s.lastErr || 'なし'}\nきこえた: ${s.lastText}\n` + s.log.slice(-6).join('\n');
  }
  $('#gear').addEventListener('click', () => { settingsOpen = true; $('#settings').hidden = false; });
  $('#set-close').addEventListener('click', () => { settingsOpen = false; $('#settings').hidden = true; });
  $('#set-title').addEventListener('click', () => { settingsOpen = false; $('#settings').hidden = true; if (started) toTitle(); });
  $('#set-reset').addEventListener('click', () => { try { localStorage.removeItem('donarugo_save'); } catch (e) { } save = null; $('#btn-cont').hidden = true; });
  $('#set-bgm').addEventListener('input', (e) => AudioSys.setBgmVol(e.target.value / 100));
  $('#set-mic').addEventListener('change', (e) => { if (started) Voice.begin(AudioSys.ctx, e.target.value); });
  $('#set-tap').addEventListener('change', (e) => { tapMode = e.target.checked; renderSpells(); });

  // ---------- デバッグ ----------
  window.DQ = {
    P, CFG, stats, get B() { return B; }, say: (t, v = dbg.vol, d = dbg.dur) => Voice.sim(t, v, d), yell: (v = 0.95, d = 2500) => Voice.simLevel(v, d),
    stage: (i) => { P.spells = SP_ORDER.slice(0, [1, 3, 4, 5][i]); P.ult = false; runStage(i); },
    kill: () => { if (B && B.state === 'active') { const u = target(); applyDmg(u, u.hp); renderEnemy(); } },
    estalos: async () => { P.spells = SP_ORDER.slice(); P.ult = true; stageIdx = 3; show('game'); P.hp = CFG.hp; P.mp = CFG.mp; runId++; const my = runId; const r = await runBattle('estalos'); if (my !== runId) return; r === 'dead' ? onDeath(3, 'estalos') : result('true'); },
    result,
  };
  if (DEBUG) {
    const d = $('#debug'); d.hidden = false;
    d.innerHTML = `vol <input id="dv" type="number" step="0.05" value="${dbg.vol}"> ms <input id="dd" type="number" step="100" value="${dbg.dur}"><br>` +
      [0, 1, 2, 3].map(i => `<button data-st="${i}">S${i + 1}</button>`).join('') + `<button id="dk">kill</button><button id="de">estalos</button><button id="dy">yell</button>`;
    d.addEventListener('input', () => { dbg.vol = +$('#dv').value; dbg.dur = +$('#dd').value; });
    d.addEventListener('click', (e) => { const t = e.target; if (t.dataset.st) window.DQ.stage(+t.dataset.st); else if (t.id === 'dk') window.DQ.kill(); else if (t.id === 'de') window.DQ.estalos(); else if (t.id === 'dy') window.DQ.yell(); });
  }

  // ---------- 起動 ----------
  FX.init();
  $('#btn-cont').hidden = !(save && save.name && (save.stage > 0 || (save.spells && save.spells.length > 1)));
  let deniedShown = false;
  Voice.on('change', () => {
    if (!Voice.st.denied || deniedShown || DEBUG) return;
    deniedShown = true; tapMode = true; $('#set-tap').checked = true; renderSpells();
    const t = document.createElement('div');
    t.className = 'win'; t.style.cssText = 'position:absolute;left:5%;right:5%;top:12%;z-index:45;font-size:.8em;text-align:center';
    t.innerHTML = 'マイクが きょかされていません。<br>ブラウザの せっていで マイクを きょかして、よみこみなおしてね。<br>（いまは じゅもんを タップで だせます）<br><u>とじる</u>';
    t.addEventListener('click', () => t.remove()); $('#app').appendChild(t);
  });
  if (DEBUG) { const s = document.createElement('script'); s.src = 'tools/bot.js'; document.body.appendChild(s); }
  requestAnimationFrame(tick);
})();
