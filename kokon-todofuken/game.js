'use strict';
(() => {
  const Q = new URLSearchParams(location.search);
  const MOCK = Q.has('mock');          // 自動テスト・動画づくり用: 声の入出力を差し替える
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, MOCK && window.__fast ? Math.min(ms, 2) : ms));
  const LOG = window.__log = [];
  const log = (type, o) => LOG.push(Object.assign({ t: Date.now(), type }, o));

  // ================= 都道府県 =================
  // 漢字, よみ, 県/都/府, 地方, 地図の列, 行, 別のよみ(聞きまちがい対策)
  const PREFS = `北海道,ほっかいどう,,北海道,12,0,
青森,あおもり,県,東北,12,1,
秋田,あきた,県,東北,11,2,
岩手,いわて,県,東北,12,2,
山形,やまがた,県,東北,11,3,
宮城,みやぎ,県,東北,12,3,
福島,ふくしま,県,東北,11,4,
茨城,いばらき,県,関東,12,5,いばらぎ
栃木,とちぎ,県,関東,11,5,
群馬,ぐんま,県,関東,10,5,
埼玉,さいたま,県,関東,10,6,
千葉,ちば,県,関東,12,6,
東京,とうきょう,都,関東,11,6,
神奈川,かながわ,県,関東,10,7,
新潟,にいがた,県,中部,10,4,
富山,とやま,県,中部,9,4,
石川,いしかわ,県,中部,8,4,
福井,ふくい,県,中部,7,5,
山梨,やまなし,県,中部,9,6,
長野,ながの,県,中部,9,5,
岐阜,ぎふ,県,中部,8,5,
静岡,しずおか,県,中部,9,7,
愛知,あいち,県,中部,8,6,
三重,みえ,県,近畿,7,7,
滋賀,しが,県,近畿,7,6,しか
京都,きょうと,府,近畿,6,6,
大阪,おおさか,府,近畿,5,7,
兵庫,ひょうご,県,近畿,5,6,
奈良,なら,県,近畿,6,7,
和歌山,わかやま,県,近畿,6,8,
鳥取,とっとり,県,中国,4,6,
島根,しまね,県,中国,3,6,
岡山,おかやま,県,中国,4,7,
広島,ひろしま,県,中国,3,7,
山口,やまぐち,県,中国,2,6,
徳島,とくしま,県,四国,4,9,
香川,かがわ,県,四国,4,8,
愛媛,えひめ,県,四国,3,8,
高知,こうち,県,四国,3,9,こおち
福岡,ふくおか,県,九州,1,6,
佐賀,さが,県,九州,0,6,
長崎,ながさき,県,九州,0,7,
熊本,くまもと,県,九州,0,8,
大分,おおいた,県,九州,1,7,
宮崎,みやざき,県,九州,1,8,
鹿児島,かごしま,県,九州,0,9,
沖縄,おきなわ,県,九州,0,10,`.split('\n').map(l => {
    const [k, r, suf, region, x, y, alias] = l.split(',');
    return { k, r, suf, region, x: +x, y: +y, full: k + suf, reads: [r].concat(alias ? alias.split('|') : []) };
  });
  const SUF_KANA = { '県': 'けん', '都': 'と', '府': 'ふ' };
  const REGIONS = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州'];
  const REGION_SAY = { '北海道': '北海道', '東北': '東北地方', '関東': '関東地方', '中部': '中部地方', '近畿': '近畿地方', '中国': '中国地方', '四国': '四国', '九州': '九州・沖縄' };

  // ================= かな の道具 =================
  const VOWEL = {};
  [['あ', 'あかさたなはまやらわがざだばぱぁゃゎ'], ['い', 'いきしちにひみりぎじぢびぴぃ'], ['う', 'うくすつぬふむゆるぐずづぶぷぅゅっゔ'],
   ['え', 'えけせてねへめれげぜでべぺぇ'], ['お', 'おこそとのほもよろをごぞどぼぽぉょ']].forEach(([v, s]) => [...s].forEach(c => VOWEL[c] = v));
  const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const kanaOnly = s => toHira(s).replace(/[^ぁ-ゖー]/g, '').replace(/^ー+/, '');
  function cmpKey(r) {   // のばす音を母音にそろえる
    let out = '';
    for (const c of r) out += c === 'ー' ? (VOWEL[out[out.length - 1]] || 'ー') : c;
    return out;
  }
  function lev(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  let tokenizer = null;
  function reading(text) {
    if (!tokenizer) return kanaOnly(text);
    let out = '';
    for (const tk of tokenizer.tokenize(text)) out += (tk.reading && tk.reading !== '*') ? tk.reading : tk.surface_form;
    return kanaOnly(out);
  }
  const FILLER = /(えーっと|えーと|えっと|ええと|あのー|あのう|うーんと|うーん|んーと|えー)/g;

  // かな での照合表: よみ(+けん/と/ふ) → 都道府県。長い順に並べる
  const FORMS = [];
  for (const p of PREFS) for (const r of p.reads) {
    const k = cmpKey(r);
    FORMS.push({ f: k, p, bare: true });
    if (p.suf) FORMS.push({ f: k + SUF_KANA[p.suf], p, bare: false });
  }
  FORMS.sort((a, b) => b.f.length - a.f.length);

  function scanKanji(text) {
    const out = [];
    for (let i = 0; i < text.length;) {
      const p = PREFS.find(p => text.startsWith(p.k, i));
      if (p) { out.push(p); i += p.k.length + ('都道府県'.includes(text[i + p.k.length] || '-') ? 1 : 0); } else i++;
    }
    return out;
  }
  function scanKana(u) {
    const out = [];
    let lastEnd = -1;
    for (let i = 0; i < u.length;) {
      // 2文字の県(しが・なら など)は、それだけを言ったときか、ほかの県に続けて言ったときに限る
      const m = FORMS.find(o => u.startsWith(o.f, i) && (o.f.length >= 3 || (i === 0 && o.f.length === u.length) || lastEnd === i));
      if (m) { out.push(m.p); i += m.f.length; lastEnd = i; } else i++;
    }
    return out;
  }
  // 聞き取った候補から都道府県を取り出す(漢字 → かな → 1文字ちがいまで許す、の順)
  function findPrefs(alts) {
    for (const alt of alts) {
      const a = scanKanji(alt);
      if (a.length) return a;
    }
    const us = alts.map(a => cmpKey(reading(a).replace(FILLER, '')));
    for (const u of us) {
      const a = scanKana(u);
      if (a.length) return a;
    }
    for (const u of us) {
      if (u.length < 4) continue;
      const hit = FORMS.filter(o => o.f.length >= 5 && lev(u, o.f) <= 1).map(o => o.p);
      if (hit.length && hit.every(p => p === hit[0])) return [hit[0]];
    }
    return [];
  }

  // ================= 音 =================
  let synth = null;
  function play(name, arg) {
    log('sfx', { name, arg });
    if (synth && !MOCK) synth.play(name, arg);
  }
  const TTS = {
    voice: null, keep: null,
    init() {
      if (!('speechSynthesis' in window)) return;
      const pick = () => {
        const vs = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
        const pref = ['Google 日本語', 'Nanami', 'Kyoko', 'O-Ren', 'Haruka'];
        this.voice = pref.map(n => vs.find(v => v.name.includes(n))).find(Boolean) || vs[0] || null;
      };
      pick();
      speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pick);
    },
    speak(text, rate) {
      return new Promise(res => {
        if (!('speechSynthesis' in window)) return setTimeout(res, 500);
        const u = this.keep = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP'; u.rate = rate || 1.1; u.pitch = 1.05; u.volume = 1;
        if (this.voice) u.voice = this.voice;
        let done = false;
        const fin = () => { if (!done) { done = true; clearTimeout(tm); res(); } };
        const tm = setTimeout(fin, 2500 + text.length * 420);   // 終了の合図が来ない端末への備え
        u.onend = fin; u.onerror = fin;
        speechSynthesis.speak(u);
      });
    },
  };
  async function say(text, o = {}) {
    setOrb('speak', o.label);
    log('say', { text, kind: o.kind || 'sys' });
    if (MOCK) {
      const d = window.__dur && window.__dur[text];
      await sleep(d != null ? d : 250 + text.length * 110);
    } else await TTS.speak(text, o.rate);
    log('sayEnd', {});
  }

  // ================= 耳(音声認識) =================
  let waiter = null, queue = [], lastAct = 0;
  function deliver(x) { if (waiter) waiter(x); else queue.push(x); }
  const Ear = {
    rec: null, on: false, endP: null,
    start() {
      queue = []; lastAct = 0;
      if (this.on) return;
      this.on = true; this._go();
    },
    _go() {
      if (!this.on || MOCK || !SR) return;
      const rec = this.rec = new SR();
      rec.lang = 'ja-JP'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 5;
      rec.onresult = e => {
        const r = e.results[e.results.length - 1];
        lastAct = Date.now();
        if (r.isFinal) {
          const alts = [...r].map(a => a.transcript.trim()).filter(Boolean);
          if (alts.length && this.on) { setHeard(alts[0]); deliver({ alts }); }
        } else setHeard(r[0].transcript);
      };
      rec.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.on = false; micDenied(); }
      };
      rec.onend = () => {
        if (this.rec === rec) this.rec = null;
        if (this.endP) { this.endP(); this.endP = null; }
        if (this.on) setTimeout(() => { if (this.on && !this.rec) this._go(); }, 150);
      };
      try { rec.start(); } catch (e) { this.rec = null; setTimeout(() => this._go(), 400); }
    },
    stop() {
      this.on = false; queue = [];
      const rec = this.rec;
      if (!rec) return Promise.resolve();
      return new Promise(res => {
        const t = setTimeout(res, 500);
        this.endP = () => { clearTimeout(t); res(); };
        try { rec.abort(); } catch (e) { clearTimeout(t); res(); }
      });
    },
  };
  // 次のひとことを待つ。limit=true は「答える制限時間」(残り3秒から合図が鳴る)、false は無言の長さで打ち切る
  function hear(maxMs, limit) {
    return new Promise(res => {
      if (queue.length) return res(queue.shift());
      const start = Date.now();
      let beeped = 4;
      if (!limit) lastAct = start;
      const bar = $('#tbar');
      bar.classList.toggle('on', !!limit && !MOCK);
      const iv = setInterval(() => {
        if (MOCK) return;
        const now = Date.now();
        if (!limit) { if (now - lastAct > maxMs) fin(null); return; }
        const left = maxMs - (now - start);
        bar.firstChild.style.transform = `scaleX(${Math.max(0, left / maxMs)})`;
        bar.classList.toggle('hot', left < 3500);
        const sec = Math.ceil(left / 1000);
        if (sec <= 3 && sec >= 1 && sec < beeped) { beeped = sec; play('count', sec); }
        if (left <= 0 && !(now - lastAct < 1300 && left > -3000)) fin(null);   // 話している途中なら少し待つ
      }, 100);
      const fin = x => { clearInterval(iv); bar.classList.remove('on'); if (waiter === fin) waiter = null; res(x); };
      waiter = fin;
    });
  }

  const CMDS = {
    hint: ['ひんと', 'もういっかい', 'もういちど', 'ひんとちょうだい', 'ひんとをください'],
    stop: ['すとっぷ', 'いちじていし', 'ていし', 'ちょっとまって', 'きゅうけい', 'ひとやすみ'],
    resume: ['さいかい', 'つづき', 'つづける', 'すたーと', 'つづきから'],
    again: ['もういっかい', 'もういちど', 'もっかい', 'りべんじ'],
    quit: ['おわり', 'おわる', 'やめる', 'しゅうりょう', 'おしまい'],
    giveup: ['わからない', 'わかんない', 'ぎぶあっぷ', 'ぱす', 'こうさん', 'でてこない'],
  };
  const CMD_RAW = { again: /^もう(一|1|１|いっ)(回|かい)|^もう(一|1|１)度/, hint: /^ヒント/, stop: /^(一時停止|ストップ)/, resume: /^再開/ };
  function detectCmd(alts, allow) {
    for (const alt of alts) {
      for (const name of allow) if (CMD_RAW[name] && CMD_RAW[name].test(alt.trim())) return name;
      const r = reading(alt).replace(/(して|する|です|おねがい|おねがいします|ください)$/, '');
      for (const name of allow) if (CMDS[name].includes(r)) return name;
    }
    return null;
  }

  // ================= 画面 =================
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const G = { mode: 'easy', used: new Map(), lives: 3, cl: 3, hints: 3, pc: 0, running: false, tapResume: null,
    best: +(store('kt_best') || 0), soloN: +(store('kt_solo_n') || 0), soloT: +(store('kt_solo_t') || 0), t0: 0, away: 0, timerIv: 0 };
  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.8-9.4C.6 8.2 2.3 4.5 6 4.5c2.2 0 3.7 1.1 6 3.600 2.300-2.500 3.800-3.600 6-3.600 3.700 0 5.400 3.700 3.800 7.100C19.500 16.400 12 21 12 21Z"/></svg>';
  const TILE = new Map();

  function buildMap() {
    const m = $('#map');
    m.innerHTML = ''; TILE.clear();
    for (const p of PREFS) {
      const d = document.createElement('div');
      d.className = 'tile' + (p.k.length >= 3 ? ' w3' : '');
      d.style.gridColumn = p.x + 1; d.style.gridRow = p.y + 1;
      d.textContent = p.k;
      m.appendChild(d); TILE.set(p.k, d);
    }
  }
  function light(p, who) {
    G.used.set(p.k, who);
    const d = TILE.get(p.k);
    d.classList.remove('pop'); void d.offsetWidth;
    d.classList.add(who, 'pop');
    const c = $('#cnt');
    c.textContent = 47 - G.used.size; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    $('#pc').textContent = G.pc;
  }
  function shake(p) { const d = TILE.get(p.k); d.classList.remove('ng'); void d.offsetWidth; d.classList.add('ng'); }
  function setOrb(state, label) {
    $('#orb').dataset.s = state;
    if (label != null) $('#status').textContent = label;
  }
  function setHeard(t) {
    $('#heard').innerHTML = '';
    if (t) { const s = document.createElement('span'); s.textContent = t; $('#heard').appendChild(s); }
  }
  function hearts(el, n, pop) {
    el.innerHTML = HEART.repeat(3);
    [...el.children].forEach((h, i) => { if (i >= n) h.classList.add('off'); if (pop && i === n) h.classList.add('pop'); });
  }
  function renderLives(popMe, popCpu) { hearts($('#lives'), G.lives, popMe); hearts($('#clives'), G.cl, popCpu); }
  function renderBest() { $('#bestT').textContent = G.best; $('#bestS').textContent = G.soloN; }
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const sayTime = s => (s >= 60 ? `${Math.floor(s / 60)}分` : '') + `${Math.floor(s % 60)}秒`;
  function view(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id)); }

  let wake = null;
  async function wakeLock() {
    try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {}
  }
  function micDenied() {
    setOrb('pause', 'マイクが使えません');
    setHeard('ブラウザの設定でマイクを許可してください');
    $('#dbg').hidden = false;
  }

  // ================= 共通の流れ =================
  function reset() {
    G.used = new Map(); G.lives = 3; G.cl = 3; G.hints = 3; G.pc = 0;
    buildMap(); renderLives(); renderBest(); setHeard('');
    $('#cnt').textContent = 47; $('#pc').textContent = 0;
    const solo = G.mode === 'solo';
    $('#lives').hidden = solo; $('#clives').hidden = solo; $('#timer').hidden = !solo;
    $('#whoR').textContent = solo ? 'タイム' : 'コンピューター';
    $('#timer').textContent = '0:00';
  }
  const left = () => PREFS.filter(p => !G.used.has(p.k));
  function hintText() {
    const rest = left();
    let best = null;
    for (const r of REGIONS) { const n = rest.filter(p => p.region === r).length; if (n && (!best || n > best.n)) best = { r, n }; }
    if (!best) return '';
    return best.r === '北海道' ? 'ヒント。北海道が、まだ出ていません。' : `ヒント。${REGION_SAY[best.r]}に、あと${best.n}個。`;
  }
  async function deepPause() {
    await Ear.stop();
    try { speechSynthesis.cancel(); } catch (e) {}
    setOrb('pause', 'タップで さいかい');
    await new Promise(r => { G.tapResume = r; });
    G.tapResume = null;
    play('resume');
    await say('再開します。');
  }
  async function pauseFlow(auto) {
    const t = Date.now();
    await Ear.stop();
    play('pause');
    await say(auto ? 'しばらく声が聞こえないので、一時停止します。「再開」と言うと、続きから始めます。' : '一時停止。「再開」と言うと、続きから始めます。', { label: 'ひとやすみ' });
    setOrb('pause', '「さいかい」で つづきから');
    Ear.start();
    let r = 'resume';
    for (;;) {
      const h = await hear(180000);
      if (!h || h.cmd === 'hide') { await deepPause(); G.away += Date.now() - t; return 'resume'; }
      if (h.cmd === 'tap') break;
      if (h.cmd === 'quit') { r = 'quit'; break; }
      const c = h.alts && detectCmd(h.alts, ['resume', 'quit']);
      if (c === 'resume') break;
      if (c === 'quit') { r = 'quit'; break; }
    }
    await Ear.stop();
    if (r === 'resume') { play('resume'); await say('再開します。'); }
    G.away += Date.now() - t;
    return r;
  }

  // ================= たいせん =================
  async function playerMiss(text) {
    await Ear.stop();
    G.lives--; renderLives(true, false);
    play('bad'); setOrb('bad', 'ミス！');
    await sleep(600);
    await say(text, { label: 'ミス！' });
    return G.lives > 0;
  }
  // 'ok'(答えた/ミスして交代) / 'over' / 'quit'
  async function playerTurn() {
    const limit = G.mode === 'hard' ? 8000 : 14000;
    let strikes = 0;
    const open = () => { play('listen'); setOrb('listen', 'あなたの番！'); setHeard(''); Ear.start(); };
    open();
    for (;;) {
      const h = await hear(limit, true);
      if (!h) {
        play('timeup');
        return await playerMiss('時間切れ！') ? 'ok' : 'over';
      }
      const cmd = h.cmd || detectCmd(h.alts, ['hint', 'stop', 'quit', 'giveup']);
      if (cmd === 'quit') { await Ear.stop(); return 'quit'; }
      if (cmd === 'hide') { await deepPause(); open(); continue; }
      if (cmd === 'stop' || cmd === 'tap') {
        if (await pauseFlow(false) === 'quit') return 'quit';
        open(); continue;
      }
      if (cmd === 'hint') {
        await Ear.stop();
        if (G.hints > 0) { G.hints--; await say(hintText() + `ヒントは、あと${G.hints}回。`, { label: 'ヒント' }); }
        else await say('ヒントは、もうありません。');
        open(); continue;
      }
      if (cmd === 'giveup') return await playerMiss('パス。') ? 'ok' : 'over';

      const p = findPrefs(h.alts)[0];
      if (!p) {
        await Ear.stop();
        if (++strikes >= 3) return await playerMiss('都道府県が、聞き取れませんでした。') ? 'ok' : 'over';
        await say('都道府県を、もう一度どうぞ。', { label: 'もういちど' });
        open(); continue;
      }
      if (G.used.has(p.k)) {
        shake(p);
        return await playerMiss(`${p.full}は、もう出ました。`) ? 'ok' : 'over';
      }
      await Ear.stop();
      G.pc++; light(p, 'p');
      play('ok'); setOrb('good', `${p.full}！`);
      await sleep(380);
      await say(`${p.full}！`, { kind: 'echo', label: `${p.full}！` });
      return 'ok';
    }
  }
  // 'ok' / 'dead'(コンピューターが3回ミス)
  async function computerTurn() {
    setOrb('think', 'コンピューターの番'); play('think');
    await sleep(620);
    const n = G.used.size;
    let fail = Math.random() < Math.min(0.32, Math.max(0, n - 7) * 0.013) * (G.mode === 'hard' ? 0.45 : 1.35);
    let pick = null;
    if (window.__script && window.__script.length) {
      const s = window.__script.shift();
      fail = s[0] === '!';
      pick = PREFS.find(p => p.k === s.replace('!', ''));
    }
    if (fail) {
      const usedList = PREFS.filter(p => G.used.has(p.k)), dup = pick || usedList[Math.floor(Math.random() * usedList.length)];
      await say(`えーっと……${dup.full}！`, { label: 'コンピューターの番' });
      shake(dup);
      G.cl--; renderLives(false, true);
      play('bad'); setOrb('good', 'コンピューターの ミス！');
      await sleep(600);
      await say(`あっ、${dup.full}は、もう出ていました。わたしのミスです。`, { label: 'コンピューターの ミス！' });
      return G.cl > 0 ? 'ok' : 'dead';
    }
    const rest = left();
    pick = pick || rest[Math.floor(Math.random() * rest.length)];
    light(pick, 'c'); play('tick', n);
    await say(`${pick.full}！`, { kind: 'word', label: `${pick.full}！` });
    return 'ok';
  }
  const rank = n => n < 5 ? 'ちりの みならい' : n < 10 ? 'ドライブ ちり名人' : n < 16 ? '都道府県 マスター' : n < 22 ? '日本地図の たつじん' : 'あるく 日本地図';

  async function versus(first) {
    reset();
    play('clap'); await say('古今東西！', { label: '古今東西！' });
    play('clap'); await say('都道府県！', { label: '都道府県！' });
    if (first) {
      await say('わたしと、かわりばんこに、都道府県を言っていきます。', { label: 'あそびかた' });
      await say('もう出た県を言ったり、時間切れになったら、ミス。先に3回ミスしたほうが負けです。');
      await say('困ったら「ヒント」、休むときは「ストップ」と言ってください。');
    }
    await say('あなたから、どうぞ。', { label: 'あなたの番！' });
    let end = null;
    for (;;) {
      const r = await playerTurn();
      if (r === 'quit') return 'quit';
      if (r === 'over') { end = 'over'; break; }
      if (G.used.size === 47) { end = 'all'; break; }
      if (await computerTurn() === 'dead') { end = 'win'; break; }
      if (G.used.size === 47) { end = 'all'; break; }
    }
    await Ear.stop();
    const n = G.pc, newBest = n > G.best;
    if (newBest) { G.best = n; store('kt_best', n); renderBest(); }
    if (end === 'over') {
      left().forEach(p => TILE.get(p.k).classList.add('rest'));
      play('gameover'); setOrb('bad', 'ゲームオーバー');
      await sleep(1500);
      await say('ゲームオーバー。', { label: 'ゲームオーバー' });
    } else {
      play('record'); setOrb('good', 'あなたの かち！');
      await sleep(700);
      await say(end === 'all' ? '47都道府県、ぜんぶ出ました！ おみごと、あなたの勝ちです！' : 'コンピューターが、3回ミスしました。あなたの勝ちです！', { label: 'あなたの かち！' });
    }
    return result({ title: end === 'over' ? 'きろく' : 'あなたの かち！', n, rank: rank(n), sub: `のこり ${47 - G.used.size} 都道府県`, newBest,
      speech: `あなたが言えたのは、${n}個。${rank(n)}、です。` + (newBest ? 'ベスト、更新！' : '') });
  }

  // ================= ひとりで47 =================
  async function solo() {
    reset();
    play('clap'); await say('ひとりで、47！', { label: 'ひとりで47' });
    await say('47都道府県を、ぜんぶ言ってください。続けていくつ言っても、大丈夫です。', { label: 'あそびかた' });
    await say('よーい、スタート！', { label: 'よーい…' });
    play('start');
    G.t0 = Date.now(); G.away = 0;
    const sec = () => (Date.now() - G.t0 - G.away) / 1000;
    clearInterval(G.timerIv);
    G.timerIv = setInterval(() => { if ($('#orb').dataset.s !== 'pause') $('#timer').textContent = mmss(sec()); }, 250);
    const open = () => { setOrb('listen', 'どんどん 言おう！'); Ear.start(); };
    let nudges = 0, end = 'quit', penalty = 0;
    open();
    for (;;) {
      const h = await hear(18000);
      if (!h) {
        if (++nudges >= 3) { if (await pauseFlow(true) === 'quit') break; nudges = 0; open(); continue; }
        await Ear.stop();
        await say(`のこり、${47 - G.used.size}個。「ヒント」と言うと、地方を教えます。`);
        open(); continue;
      }
      nudges = 0;
      const cmd = h.cmd || detectCmd(h.alts, ['hint', 'stop', 'quit', 'giveup']);
      if (cmd === 'quit' || cmd === 'giveup') break;
      if (cmd === 'hide') { const t = Date.now(); await deepPause(); G.away += Date.now() - t; open(); continue; }
      if (cmd === 'stop' || cmd === 'tap') { if (await pauseFlow(false) === 'quit') break; open(); continue; }
      if (cmd === 'hint') { await Ear.stop(); penalty += 10; await say(hintText() + 'プラス10秒。', { label: 'ヒント' }); open(); continue; }

      const ps = findPrefs(h.alts), fresh = [...new Set(ps)].filter(p => !G.used.has(p.k));
      if (!fresh.length) { if (ps.length) { play('dup'); ps.forEach(shake); setOrb('listen', 'それは もう言ったよ'); } continue; }
      const before = 47 - G.used.size;
      for (const p of fresh) { G.pc++; light(p, 'p'); play('tick', G.used.size - 1); await sleep(110); }
      const rem = 47 - G.used.size;
      setOrb('listen', 'いいぞ！ どんどん 言おう！');
      if (rem === 0) { end = 'all'; break; }
      const mark = [30, 20, 10, 5, 3, 1].find(m => before > m && rem <= m);
      if (mark) { await Ear.stop(); play('milestone'); await say(`のこり、${rem}！`, { label: `のこり ${rem}！` }); open(); }
    }
    await Ear.stop();
    clearInterval(G.timerIv);
    const n = G.pc, t = Math.round(sec() + penalty);
    $('#timer').textContent = mmss(t);
    const newBest = n > G.soloN || (n === G.soloN && n > 0 && (!G.soloT || t < G.soloT));
    if (newBest) { G.soloN = n; G.soloT = t; store('kt_solo_n', n); store('kt_solo_t', t); renderBest(); }
    if (end === 'all') {
      play('record'); setOrb('good', '47 コンプリート！');
      await sleep(700);
      await say('47都道府県、コンプリート！ おみごと！', { label: '47 コンプリート！' });
    } else {
      left().forEach(p => TILE.get(p.k).classList.add('rest'));
      play('gameover'); setOrb('bad', 'ここまで！');
      await sleep(1400);
      await say('ここまで！', { label: 'ここまで！' });
    }
    return result({ title: end === 'all' ? '47 コンプリート！' : 'きろく', n, rank: n === 47 ? 'あるく 日本地図' : rank(Math.floor(n / 2)), sub: `タイム ${mmss(t)}`, newBest,
      speech: `47個中、${n}個。タイムは、${sayTime(t)}。` + (newBest ? 'ベスト、更新！' : '') });
  }

  async function result(o) {
    $('#rTitle').textContent = o.title; $('#rNum').textContent = o.n; $('#rRank').textContent = o.rank; $('#rSub').textContent = o.sub; $('#rNew').hidden = !o.newBest;
    $('#result').classList.add('on');
    if (o.newBest) { play('milestone'); await sleep(300); }
    await say(o.speech, { label: '' });
    await say('もう一度遊ぶなら「もういっかい」、やめるなら「おわり」と言ってください。');
    play('listen'); setOrb('listen', ''); Ear.start();
    let r = 'quit';
    for (;;) {
      const h = await hear(25000);
      if (!h || h.cmd === 'quit' || h.cmd === 'hide') break;
      if (h.cmd === 'again') { r = 'again'; break; }
      const c = h.alts && detectCmd(h.alts, ['again', 'quit', 'resume']);
      if (c === 'quit') break;
      if (c) { r = 'again'; break; }
    }
    await Ear.stop();
    $('#result').classList.remove('on');
    return r;
  }

  async function startGame() {
    if (G.running) return;
    G.running = true;
    if (!MOCK) {
      try { const AC = window.AudioContext || window.webkitAudioContext; synth = synth || makeSynth(new AC()); } catch (e) {}
      try { speechSynthesis.cancel(); } catch (e) {}
      wakeLock();
    }
    view('game'); reset();
    setOrb('speak', '');
    let first = !store('kt_seen');
    store('kt_seen', '1');
    if (window.__noIntro) first = false;
    // 最初の読み上げは、このままタップの処理の中で始まる(端末の制限への対応)
    for (let f = first; ; f = false) if (await (G.mode === 'solo' ? solo() : versus(f)) === 'quit') break;
    await Ear.stop();
    clearInterval(G.timerIv);
    await say('おわります。おつかれさまでした。', { label: 'おつかれさま！' });
    try { wake && wake.release(); } catch (e) {}
    setOrb('idle', ''); view('title'); G.running = false;
  }

  // ================= 準備 =================
  function loadDict() {
    return new Promise(res => {
      let done = 0;
      const send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function () {
        this.addEventListener('loadend', () => { $('#loadBar b').style.width = Math.min(100, ++done / 12 * 100) + '%'; });
        return send.apply(this, arguments);
      };
      kuromoji.builder({ dicPath: 'dict/' }).build((err, t) => {
        XMLHttpRequest.prototype.send = send;
        if (!err) tokenizer = t;
        res(!err);
      });
    });
  }

  renderBest(); buildMap(); renderLives(); TTS.init();
  document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => {
    G.mode = b.dataset.mode;
    document.querySelectorAll('.modes button').forEach(x => x.classList.toggle('sel', x === b));
  }));
  $('#startBtn').addEventListener('click', startGame);
  $('#orb').addEventListener('click', () => {
    if (G.tapResume) G.tapResume(); else if (G.running) deliver({ cmd: 'tap' });
  });
  $('#rAgain').addEventListener('click', () => deliver({ cmd: 'again' }));
  $('#rEnd').addEventListener('click', () => deliver({ cmd: 'quit' }));
  $('#dbg').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#dbgIn').value.trim();
    if (v) { setHeard(v); deliver({ alts: [v] }); }
    $('#dbgIn').value = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.running && !G.tapResume) deliver({ cmd: 'hide' }); }
    else if (G.running) wakeLock();
  });

  if (!SR && !MOCK) {
    $('#support').hidden = false;
    $('#support').textContent = 'このブラウザは音声認識に対応していません。Chrome か Safari で開いてください。(下の入力欄から文字で試すことはできます)';
    $('#dbg').hidden = false;
  }
  if (Q.has('debug')) $('#dbg').hidden = false;

  loadDict().then(ok => {
    $('#loadBar').style.opacity = 0;
    const b = $('#startBtn');
    b.disabled = false; b.textContent = 'タップして スタート';
    if (!ok) { $('#support').hidden = false; $('#support').textContent = '読みがな辞書の読み込みに失敗しました。漢字で聞き取れた答えだけ判定します。通信環境のよい場所で開き直すと直ります。'; }
    window.__ready = true;
  });

  // テスト・動画づくり用の入口
  window.__game = {
    G, PREFS, start: startGame, feed: t => { const alts = [].concat(t); setHeard(alts[0]); deliver({ alts }); }, cmd: c => deliver({ cmd: c }),
    interim: setHeard, reading, findPrefs: a => findPrefs([].concat(a)).map(p => p.k),
  };
})();
