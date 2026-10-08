'use strict';
(() => {
  const Q = new URLSearchParams(location.search);
  const MOCK = Q.has('mock');          // 自動テスト・動画づくり用: 声の入出力を差し替える
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, MOCK && window.__fast ? Math.min(ms, 2) : ms));
  const LOG = window.__log = [];
  const log = (type, o) => LOG.push(Object.assign({ t: Date.now(), type }, o));
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const FREE = CASES.map(C => C.f);   // 声で理由を答えるときの 決め手(cases.js)

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
  let tokenizer = null;
  function reading(text) {
    if (!tokenizer) return kanaOnly(text);
    let out = '';
    for (const tk of tokenizer.tokenize(text)) out += (tk.reading && tk.reading !== '*') ? tk.reading : tk.surface_form;
    return kanaOnly(out);
  }
  const FILLER = /(えーっと|えーと|えっと|ええと|あのー|あのう|うーんと|うーん|んーと|えー)/g;
  const kanaOf = alt => cmpKey(reading(alt).replace(FILLER, ''));
  const isKana = s => /^[ぁ-ゖー]+$/.test(s);
  const hit = (w, alt, kana) => alt.includes(w) || (isKana(w) && kana.includes(cmpKey(w)));
  const judgeFree = (i, alts) => alts.some(a => { const k = kanaOf(a); return FREE[i].every(g => g.some(w => hit(w, a, k))); });

  // 「2番」「さんばん」「ふたつめ」などから 番号を取り出す。わからなければ 0
  const DIG = { 1: 1, '１': 1, 一: 1, 2: 2, '２': 2, 二: 2, 3: 3, '３': 3, 三: 3, 4: 4, '４': 4, 四: 4 };
  const NUMK = { いち: 1, いっ: 1, ひとつ: 1, ひと: 1, さいしょ: 1, に: 2, ふたつ: 2, ふた: 2, さん: 3, みっつ: 3, みっ: 3, よん: 4, し: 4, よっつ: 4, よっ: 4, さいご: 4 };
  function pickNum(alts) {
    for (const a of alts) {
      const m = a.match(/([1-4１-４一二三四])\s*(番|ばん|つ目|つめ|個目|こめ)/) || a.trim().match(/^([1-4１-４一二三四])$/);
      if (m) return DIG[m[1]];
      const r = reading(a).replace(FILLER, '').replace(/(です|かな|だとおもう|だとおもいます|だ)$/, '').replace(/(ばんめ|ばん|つめ|め)$/, '');
      if (NUMK[r]) return NUMK[r];
    }
    return 0;
  }

  // ================= お話を 読み上げる単位に分ける =================
  const splitSent = t => (t.match(/[^。！？]*[。！？]+|[^。！？]+$/g) || [t]).map(s => s.trim()).filter(Boolean);
  // 段落 → [{text, quote}]。「」の中は せりふ(声の高さを変える)。かぎかっこは 段落をまたぐことがある
  function segments(paras) {
    let inQ = false;
    const out = [];
    paras.forEach((p, pi) => {
      let buf = '';
      const push = () => { splitSent(buf).forEach(text => out.push({ text, quote: inQ })); buf = ''; };
      for (const ch of p) {
        if (ch === '「') { push(); inQ = true; }
        else if (ch === '」') { push(); inQ = false; }
        else buf += ch;
      }
      push();
      if (pi < paras.length - 1) out.push({ gap: 380 });
    });
    return out;
  }
  // ヒント: 決め手の言葉を含む一文
  function hintLine(C, lv) {
    const kw = C.k[lv];
    for (const p of C.p) for (const s of splitSent(p.replace(/[「」]/g, ''))) if (s.includes(kw)) return s;
    return kw;
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
    speak(text, rate, pitch) {
      return new Promise(res => {
        if (!('speechSynthesis' in window)) return setTimeout(res, 500);
        const u = this.keep = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP'; u.rate = rate || 1.1; u.pitch = pitch || 1.05; u.volume = 1;
        if (this.voice) u.voice = this.voice;
        let done = false;
        const fin = () => { if (!done) { done = true; clearTimeout(tm); res(); } };
        const tm = setTimeout(fin, 2500 + text.length * 420);   // 終了の合図が来ない端末への備え
        u.onend = fin; u.onerror = fin;
        speechSynthesis.speak(u);
      });
    },
  };
  const sayDur = text => { const d = window.__dur && window.__dur[text]; return d != null ? d : 250 + text.length * 110; };
  async function say(text, o = {}) {
    setOrb('speak', o.label);
    log('say', { text, kind: o.kind || 'sys' });
    if (MOCK) await sleep(sayDur(text));
    else await TTS.speak(text, o.rate, o.pitch);
    log('sayEnd', {});
  }

  // ================= 耳(音声認識) =================
  let waiter = null, queue = [], lastAct = 0;
  function deliver(x) { if (waiter) waiter(x); else queue.push(x); }
  // 読み上げ中に届いた合図(タップ / 画面が隠れた)を取り出す
  function takeCmd() {
    const x = queue.find(q => q.cmd);
    if (!x) return null;
    queue = [];
    return x.cmd;
  }
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
    hint: ['ひんと', 'ひんとちょうだい', 'ひんとをください'],
    stop: ['すとっぷ', 'いちじていし', 'ていし', 'ちょっとまって', 'きゅうけい', 'ひとやすみ'],
    resume: ['さいかい', 'つづき', 'つづける', 'すたーと', 'つづきから'],
    again: ['もういっかい', 'もういちど', 'もっかい', 'しつもんをもういっかい', 'しつもんをもういちど'],
    story: ['さいしょから', 'はじめから', 'おはなしをもういっかい', 'おはなしをもういちど', 'はなしをもういっかい', 'じけんをもういっかい', 'さいしょからきく'],
    choices: ['よんたく', 'よたく', 'よんたくで', 'せんたくし', 'えらぶ'],
    next: ['つぎ', 'つぎへ', 'つぎのじけん', 'つぎにすすむ', 'すすむ', 'はい'],
    quit: ['おわり', 'おわる', 'やめる', 'しゅうりょう', 'おしまい'],
    giveup: ['わからない', 'わかんない', 'ぎぶあっぷ', 'ぱす', 'こうさん', 'こたえをおしえて'],
  };
  const CMD_RAW = { story: /最初から|はじめから|初めから/, again: /^もう(一|1|１|いっ)(回|かい)|^もう(一|1|１)度/, hint: /^ヒント/, stop: /^(一時停止|ストップ)/, resume: /^再開/,
    choices: /^(四択|4択|４択|選択肢)/, next: /^次/ };
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
  let save = {};
  try { save = JSON.parse(store('mm_save') || '{}') || {}; } catch (e) {}
  const G = { mode: 'cont', cur: -1, lp: 3, running: false, narr: false, told: false, tapResume: null, save };
  const LOUPE = '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6"/></svg>';
  const total = () => CASES.reduce((a, _, i) => a + (save[i] || 0), 0);
  const solvedN = () => CASES.filter((_, i) => save[i] != null).length;
  const allDone = () => CASES.every((_, i) => save[i] != null);
  const rank = n => { const r = n / (CASES.length * 3); return r >= 0.9 ? 'ひろ博士級' : r >= 0.7 ? '名探偵' : r >= 0.4 ? '探偵' : '見習い探偵'; };

  function setOrb(state, label) {
    $('#orb').dataset.s = state;
    if (label != null) $('#status').textContent = label;
  }
  function setHeard(t) {
    $('#heard').innerHTML = '';
    if (t) { const s = document.createElement('span'); s.textContent = t; $('#heard').appendChild(s); }
  }
  function setCap(t, quote) { const c = $('#cap'); c.textContent = t || ''; c.classList.toggle('q', !!quote); }
  function renderHud(pop) {
    const el = $('#loupes');
    el.innerHTML = LOUPE.repeat(3);
    [...el.children].forEach((h, i) => { if (i >= G.lp) h.classList.add('off'); if (pop && i === G.lp) h.classList.add('pop'); });
    $('#cno').textContent = G.cur + 1;
    $('#ctitle').textContent = G.cur >= 0 ? CASES[G.cur].t : '';
    $('#hsolved').textContent = solvedN(); $('#hall').textContent = CASES.length;
  }
  function renderTitle() {
    const c = solvedN();
    $('#prog').innerHTML = `解決 <b>${c}</b> / ${CASES.length}　虫めがね <b>${total()}</b> / ${CASES.length * 3}` + (c ? `<br>称号 <b>${rank(total())}</b>` : '');
    const sel = $('#pick'), keep = sel.value || 'cont';
    sel.innerHTML = '<option value="cont">つづきから（まだ解いていない事件）</option><option value="rand">おまかせ（ランダム）</option>' +
      CASES.map((C, i) => `<option value="${i}">No.${i + 1} ${C.t}${save[i] != null ? '　★' + save[i] : ''}</option>`).join('');
    sel.value = keep;
  }
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
  async function deepPause() {
    await Ear.stop();
    try { speechSynthesis.cancel(); } catch (e) {}
    setOrb('pause', 'タップで さいかい');
    await new Promise(r => { G.tapResume = r; });
    G.tapResume = null;
    play('resume');
    await say('再開します。');
  }
  async function pauseFlow() {
    await Ear.stop();
    play('pause');
    await say('一時停止。「再開」と言うと、続きから始めます。', { label: 'ひとやすみ' });
    setOrb('pause', '「さいかい」で つづきから');
    Ear.start();
    let r = 'resume';
    for (;;) {
      const h = await hear(180000);
      if (!h || h.cmd === 'hide') { await deepPause(); return 'resume'; }
      if (h.cmd === 'tap') break;
      if (h.cmd === 'quit') { r = 'quit'; break; }
      const c = h.alts && detectCmd(h.alts, ['resume', 'quit']);
      if (c === 'resume') break;
      if (c === 'quit') { r = 'quit'; break; }
    }
    await Ear.stop();
    if (r === 'resume') { play('resume'); await say('再開します。'); }
    return r;
  }
  // お話を 1文ずつ読む。読み上げ中は 耳を閉じているので、止めるのは タップで。 'ok' / 'quit'
  async function narrate(lines, label) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.gap) { await sleep(l.gap); continue; }
      setCap(l.text, l.quote);
      G.narr = true;
      await say(l.text, { kind: 'story', rate: 1.0, pitch: l.quote ? 1.28 : 0.98, label });
      G.narr = false;
      const c = takeCmd();
      if (!c) continue;
      if (c === 'quit') return 'quit';
      if (c === 'hide') await deepPause();
      else if (c === 'tap' && await pauseFlow() === 'quit') return 'quit';
      i--;   // 止めた文から 読み直す
    }
    return 'ok';
  }

  // ================= 1つの事件 =================
  const PRAISE = ['正解！', 'そのとおり！', 'おみごと！'];
  const RESULT = ['おしい！　また挑戦してみよう。', 'よく聞けました。', 'いい推理！', 'パーフェクト！　見事な推理です。'];
  function lose() { if (G.lp > 0) G.lp--; renderHud(true); }

  // 'next' / 'again' / 'quit'
  async function runCase(i, sc) {
    const C = CASES[i], no = i + 1;
    G.cur = i; G.lp = 3;
    renderHud(); setCap(''); setHeard(''); $('#nextBar').hidden = true;
    play('mystery'); setOrb('think', `事件ファイル No.${no}`);
    await sleep(1500);
    await say(`事件ファイル、ナンバー${no}。${C.t}。`, { kind: 'title', label: `事件ファイル No.${no}` });
    await sleep(450);
    const lines = segments(C.p);
    if (await narrate(lines, 'よく きいて…') === 'quit') return 'quit';
    await sleep(500);

    const order = (sc && sc.order) || (MOCK ? [2, 0, 3, 1] : shuffle([0, 1, 2, 3]));
    const wrong = new Set();
    let mode = 'free', tries = 0, strikes = 0, hintLv = 0;
    const sayQ = async () => { play('question'); setCap(C.q); await sleep(520); await say(C.q, { kind: 'q', label: 'しつもん' }); };
    const sayChoices = async () => {
      for (let n = 0; n < 4; n++) {
        if (wrong.has(order[n])) continue;
        setCap(`${n + 1}. ${C.c[order[n]]}`);
        await say(`${n + 1}番。${C.c[order[n]]}`, { kind: 'choice', rate: 1.0, label: 'ばんごうで こたえて' });
        await sleep(180);
      }
      setCap(C.q);
    };
    const goChoices = async () => {
      if (mode !== 'choice') { mode = 'choice'; lose(); }
      await say('四つの中から、番号で答えてください。', { label: 'よんたく' });
      await sayChoices();
    };
    const open = () => { play('listen'); setOrb('listen', mode === 'free' ? 'りゆうを こたえて！' : 'ばんごうで こたえて！'); setHeard(''); Ear.start(); };
    const replay = async () => { await sayQ(); if (mode === 'choice') await sayChoices(); };

    let got = false, lead = '';
    await sayQ();
    if (!G.told) { G.told = true; await say('わかったら、理由を声で答えてください。四択で答えるなら「よんたく」、困ったら「ヒント」と言ってください。'); }
    else await say('理由をどうぞ。四択なら「よんたく」。');
    open();
    for (;;) {
      const h = await hear(mode === 'free' ? 40000 : 25000, true);
      if (!h) {
        await Ear.stop(); play('timeup');
        if (mode === 'free') { await say('では、四択にしましょう。'); await goChoices(); open(); continue; }
        lead = '時間切れ。'; break;
      }
      const cmd = h.cmd || detectCmd(h.alts, ['story', 'again', 'hint', 'choices', 'stop', 'quit', 'giveup']);
      if (cmd === 'quit') { await Ear.stop(); return 'quit'; }
      if (cmd === 'hide') { await deepPause(); await replay(); open(); continue; }
      if (cmd === 'stop' || cmd === 'tap') {
        if (await pauseFlow() === 'quit') return 'quit';
        await replay(); open(); continue;
      }
      if (cmd === 'again') { await Ear.stop(); await replay(); open(); continue; }
      if (cmd === 'story') {
        await Ear.stop();
        await say('もう一度、お話を読みます。');
        if (await narrate(lines, 'よく きいて…') === 'quit') return 'quit';
        await replay(); open(); continue;
      }
      if (cmd === 'hint') {
        await Ear.stop();
        if (hintLv < Math.min(2, C.k.length)) {
          const line = hintLine(C, hintLv++);
          lose(); play('hint'); setCap(line);
          await say('ヒント。お話の、ここを もう一度 聞いてください。', { label: 'ヒント' });
          await say(line, { kind: 'hint', rate: 0.95, label: 'ヒント' });
          setCap(C.q);
        } else await say('ヒントは、もうありません。');
        open(); continue;
      }
      if (cmd === 'choices') { await Ear.stop(); await goChoices(); open(); continue; }
      if (cmd === 'giveup') {
        await Ear.stop();
        if (mode === 'free') { await goChoices(); open(); continue; }
        break;
      }

      if (mode === 'free') {
        if (judgeFree(i, h.alts)) { got = true; break; }
        if (kanaOf(h.alts[0]).length < 3) continue;   // 「えーっと」などは 聞き流す
        await Ear.stop();
        if (++tries >= 2) { await say('なるほど。では、四択で たしかめましょう。'); await goChoices(); }
        else await say('うーん、決め手とは ちがうようです。もう一度、どうぞ。四択にするなら「よんたく」。', { label: 'もういちど' });
        open(); continue;
      }
      const n = pickNum(h.alts);
      if (!n || wrong.has(order[n - 1])) {
        await Ear.stop();
        if (++strikes >= 3) { lead = '聞き取れませんでした。'; break; }
        await say('1番から4番の、番号で答えてください。', { label: 'ばんごうで' });
        open(); continue;
      }
      if (order[n - 1] === 0) { got = true; break; }
      await Ear.stop();
      wrong.add(order[n - 1]); lose();
      play('bad'); setOrb('bad', 'ざんねん！');
      await sleep(650);
      if (wrong.size >= 2) { lead = 'ざんねん。'; break; }
      await say(`${n}番では、ないようです。残りから、もう一度 選んでください。`, { label: 'もういちど' });
      open();
    }
    await Ear.stop();

    // 答え合わせ と 解説
    if (got) {
      play('ok'); setOrb('good', 'せいかい！');
      await sleep(520);
      await say(mode === 'free' ? 'おみごと！　名推理です。' : PRAISE[MOCK ? 0 : rnd(PRAISE.length)], { kind: 'praise', label: 'せいかい！' });
    } else {
      G.lp = 0; renderHud();
      setCap(C.c[0]);
      await say(`${lead}正解は、${C.c[0]}。`, { kind: 'answer', label: 'こたえ' });
    }
    await sleep(350);
    await say('ひろ博士の解説。', { label: 'かいせつ' });
    await narrate(splitSent(C.e).map(text => ({ text })), 'かいせつ');

    const wasAll = allDone();
    if (save[i] == null || G.lp > save[i]) { save[i] = G.lp; store('mm_save', JSON.stringify(save)); }
    renderHud();
    play(G.lp === 3 ? 'perfect' : 'stamp'); setOrb('good', '解決！'); setCap('');
    await sleep(600);
    await say(`事件、解決。虫めがね、${G.lp}個。${RESULT[G.lp]}`, { kind: 'result', label: '解決！' });
    if (!wasAll && allDone()) {
      play('record'); await sleep(400);
      await say(`全${CASES.length}話、解決！　虫めがねは、${total()}個。称号は、${rank(total())}、です。`, { kind: 'result', label: `称号 ${rank(total())}` });
    }

    await say(G.asked ? '「つぎ」、「もういっかい」、「おわり」の、どれかを言ってください。'
      : '次の事件へ進むなら「つぎ」、同じ事件をもう一度なら「もういっかい」、やめるなら「おわり」と言ってください。', { label: 'つぎは？' });
    G.asked = true;
    $('#nextBar').hidden = false;
    play('listen'); setOrb('listen', '「つぎ」 か 「おわり」'); Ear.start();
    let r = 'quit';
    for (;;) {
      const h = await hear(30000);
      if (!h || h.cmd === 'quit' || h.cmd === 'hide') break;
      if (h.cmd === 'next' || h.cmd === 'again') { r = h.cmd; break; }
      const c = h.alts && detectCmd(h.alts, ['next', 'again', 'quit', 'resume']);
      if (c === 'quit') break;
      if (c === 'again') { r = 'again'; break; }
      if (c) { r = 'next'; break; }
    }
    await Ear.stop();
    $('#nextBar').hidden = true;
    return r;
  }

  function nextIndex(cur) {
    const all = CASES.map((_, i) => i);
    if (G.mode === 'rand') {
      const un = all.filter(i => save[i] == null && i !== cur), pool = un.length ? un : all.filter(i => i !== cur);
      return pool[rnd(pool.length)];
    }
    for (let k = 1; k <= CASES.length; k++) { const i = (cur + k + CASES.length) % CASES.length; if (save[i] == null) return i; }
    return (cur + 1) % CASES.length;
  }

  async function startGame() {
    if (G.running) return;
    G.running = true;
    if (!MOCK) {
      try { const AC = window.AudioContext || window.webkitAudioContext; synth = synth || makeSynth(new AC()); } catch (e) {}
      try { speechSynthesis.cancel(); } catch (e) {}
      wakeLock();
    }
    const pick = $('#pick').value;
    G.mode = pick === 'rand' ? 'rand' : 'cont';
    G.cur = -1; G.lp = 3; G.told = G.asked = false;
    view('game'); renderHud(); setCap(''); setHeard('');
    setOrb('speak', '');
    const first = !store('mm_seen') && !window.__noIntro;
    store('mm_seen', '1');
    // 最初の読み上げは、このままタップの処理の中で始まる(端末の制限への対応)
    play('start'); await say('耳でとく、ひろ博士の、3分間ミステリー！', { label: '耳でとく 3分間ミステリー' });
    if (first) {
      await say('これから、短い事件のお話を読みます。お話の中に、おかしなところが ひとつ、かくれています。', { label: 'あそびかた' });
      await say('聞き終わったら、博士の質問に、声で答えてください。');
      await say('お話の途中で止めたいときは、画面のまん中を タップ。質問のあとなら「ストップ」と言えば、止まります。');
    }
    let i = /^\d+$/.test(pick) ? +pick : nextIndex(-1);
    for (;;) {
      const sc = window.__script && window.__script.length ? window.__script.shift() : null;
      if (sc && sc.case != null) i = sc.case;
      const r = await runCase(i, sc);
      if (r === 'quit') break;
      if (r === 'next') i = nextIndex(i);
    }
    await Ear.stop();
    G.narr = false;
    await say('おわります。おつかれさまでした。', { label: 'おつかれさま！' });
    try { wake && wake.release(); } catch (e) {}
    setOrb('idle', ''); renderTitle(); view('title'); G.running = false;
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

  renderTitle(); renderHud(); TTS.init();
  $('#startBtn').addEventListener('click', startGame);
  $('#orb').addEventListener('click', () => {
    if (G.tapResume) return G.tapResume();
    if (!G.running) return;
    deliver({ cmd: 'tap' });
    if (G.narr) try { speechSynthesis.cancel(); } catch (e) {}
  });
  $('#nNext').addEventListener('click', () => deliver({ cmd: 'next' }));
  $('#nAgain').addEventListener('click', () => deliver({ cmd: 'again' }));
  $('#nEnd').addEventListener('click', () => deliver({ cmd: 'quit' }));
  $('#dbg').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#dbgIn').value.trim();
    if (v) { setHeard(v); deliver({ alts: [v] }); }
    $('#dbgIn').value = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (G.running && !G.tapResume) { deliver({ cmd: 'hide' }); if (G.narr) try { speechSynthesis.cancel(); } catch (e) {} }
    } else if (G.running) wakeLock();
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
    if (!ok) { $('#support').hidden = false; $('#support').textContent = '読みがな辞書の読み込みに失敗しました。聞き取りの精度が下がります。通信環境のよい場所で開き直すと直ります。'; }
    window.__ready = true;
  });

  // テスト・動画づくり用の入口
  window.__game = {
    G, CASES, FREE, start: startGame, feed: t => { const alts = [].concat(t); setHeard(alts[0]); deliver({ alts }); }, cmd: c => deliver({ cmd: c }),
    interim: setHeard, reading, segments, hintLine, pickNum: a => pickNum([].concat(a)), judgeFree: (i, a) => judgeFree(i, [].concat(a)),
  };
})();
