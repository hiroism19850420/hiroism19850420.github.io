'use strict';
(() => {
  const Q = new URLSearchParams(location.search);
  const MOCK = Q.has('mock');          // 自動テスト・動画づくり用: 声の入出力を差し替える
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, MOCK && window.__fast ? Math.min(ms, 2) : ms));
  const LOG = window.__log = [];
  const log = (type, o) => LOG.push(Object.assign({ t: Date.now(), type }, o));

  // ================= かな の道具 =================
  const SMALL = { 'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ', 'っ': 'つ' };
  const SAME = { 'を': 'お', 'ぢ': 'じ', 'づ': 'ず' };
  const VOWEL = {};
  [['あ', 'あかさたなはまやらわがざだばぱぁゃゎ'], ['い', 'いきしちにひみりぎじぢびぴぃ'], ['う', 'うくすつぬふむゆるぐずづぶぷぅゅっゔ'],
   ['え', 'えけせてねへめれげぜでべぺぇ'], ['お', 'おこそとのほもよろをごぞどぼぽぉょ']].forEach(([v, s]) => [...s].forEach(c => VOWEL[c] = v));
  const CLEAR = {};
  'がか ぎき ぐく げけ ごこ ざさ じし ずす ぜせ ぞそ だた ぢち づつ でて どと ばは びひ ぶふ べへ ぼほ ぱは ぴひ ぷふ ぺへ ぽほ ゔう'
    .split(' ').forEach(p => CLEAR[p[0]] = p[1]);

  const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const kanaOnly = s => toHira(s).replace(/[^ぁ-ゖー]/g, '').replace(/^ー+/, '');
  // 比べるための形(長さは変えない): のばす音は母音に、を→お など
  function cmpKey(r) {
    let out = '';
    for (const c of r) out += c === 'ー' ? (VOWEL[out[out.length - 1]] || 'ー') : (SAME[c] || c);
    return out;
  }
  function lastKana(r) {
    let i = r.length - 1;
    while (i > 0 && r[i] === 'ー') i--;
    const c = r[i];
    return SMALL[c] || SAME[c] || c;
  }
  const firstKana = r => SMALL[r[0]] || SAME[r[0]] || r[0];
  const clear = c => CLEAR[SAME[c] || c] || SAME[c] || c;
  const sameStart = (a, b) => clear(SMALL[a] || a) === clear(SMALL[b] || b);   // 濁点・半濁点のちがいは許す

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

  // ================= 読みがな =================
  let tokenizer = null;
  function reading(text) {
    if (!tokenizer) return kanaOnly(text);
    const t = text.replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
    let out = '';
    for (const tk of tokenizer.tokenize(t)) out += (tk.reading && tk.reading !== '*') ? tk.reading : tk.surface_form;
    return kanaOnly(out);
  }
  const FILLER = /(えーっと|えーと|えっと|ええと|あのー|あのう|うーんと|うーん|んーと|えー)/g;
  function variants(text) {
    const r = reading(text), r2 = r.replace(FILLER, '');
    return r2 !== r && r2 ? [r, r2] : [r];
  }

  // 言った文字列 u を、言葉の列 keys と前から順に照らし合わせる(区切りは使わない。多少の聞きまちがいは許す)
  function matchChain(u, keys) {
    let pos = 0;
    for (let i = 0; i < keys.length; i++) {
      const e = keys[i], rest = u.length - pos;
      if (rest <= 0) return { status: 'partial', count: i, pos };
      const tol = e.length <= 2 ? 0 : e.length <= 4 ? 1 : 2;
      let best = null;
      for (let k = Math.max(1, e.length - tol); k <= Math.min(rest, e.length + tol); k++) {
        const d = lev(e, u.substr(pos, k));
        if (d > tol) continue;
        const cost = d * 10 + Math.abs(k - e.length);
        if (!best || cost < best.cost) best = { k, cost };
      }
      if (!best) return { status: 'wrong', count: i, pos };
      pos += best.k;
    }
    return { status: 'complete', count: keys.length, pos };
  }

  // ================= 言葉の辞書(コンピューター用) =================
  const DICT = new Map();
  {
    const seen = new Set();
    for (const w of WORD_SRC.split(/\s+/)) {
      if (w.length < 2 || seen.has(w) || /[んーぁぃぅぇぉゃゅょっ]$/.test(w)) continue;
      seen.add(w);
      const k = w[0];
      if (!DICT.has(k)) DICT.set(k, []);
      DICT.get(k).push(w);
    }
  }
  function pickWord(need) {
    if (window.__script && window.__script.length) return window.__script.shift();
    const free = k => (DICT.get(k) || []).filter(w => !G.used.has(cmpKey(w)));
    let c = free(need);
    if (!c.length) for (const k of DICT.keys()) if (k !== need && sameStart(k, need)) c = c.concat(free(k));
    return c.length ? c[Math.floor(Math.random() * c.length)] : null;
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
        u.lang = 'ja-JP'; u.rate = rate || 1.08; u.pitch = 1.05; u.volume = 1;
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
    } else {
      await TTS.speak(text, o.rate);
    }
    log('sayEnd', {});
  }

  // ================= 耳(音声認識) =================
  let waiter = null, queue = [], lastAct = 0;
  function deliver(x) {
    if (waiter) waiter(x); else queue.push(x);
  }
  const Ear = {
    rec: null, on: false, endP: null,
    start() {
      queue = []; lastAct = Date.now();
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
  // 次のひとことを待つ。maxMs のあいだ声がなければ null
  function hear(maxMs) {
    return new Promise(res => {
      if (queue.length) return res(queue.shift());
      lastAct = Date.now();
      const iv = setInterval(() => { if (!MOCK && Date.now() - lastAct > maxMs) fin(null); }, 250);
      const fin = x => { clearInterval(iv); if (waiter === fin) waiter = null; res(x); };
      waiter = fin;
    });
  }

  const CMDS = {
    again: ['もういっかい', 'もういちど', 'もっかい', 'ひんと', 'もういっかいいって'],
    stop: ['すとっぷ', 'いちじていし', 'ていし', 'ちょっとまって', 'きゅうけい', 'ひとやすみ'],
    resume: ['さいかい', 'つづき', 'つづける', 'すたーと', 'つづきから'],
    quit: ['おわり', 'おわる', 'やめる', 'しゅうりょう', 'おしまい'],
    giveup: ['わからない', 'わかんない', 'ぎぶあっぷ', 'ぱす', 'こうさん', 'わすれた', 'わすれました'],
  };
  const CMD_RAW = { again: /^もう(一|1|１|いっ)(回|かい)|^もう(一|1|１)度/, stop: /^(一時停止|ストップ)/, resume: /^再開/ };
  function detectCmd(alts, allow) {
    for (const alt of alts) {
      for (const name of allow) if (CMD_RAW[name] && CMD_RAW[name].test(alt.trim())) return name;
      const r = reading(alt).replace(/(して|する|です|おねがい|おねがいします|ください)$/, '');
      for (const name of allow) if (CMDS[name].includes(r)) return name;
    }
    return null;
  }

  // ================= 画面 =================
  const G = { chain: [], used: new Set(), lives: 3, hints: 3, need: '', mode: 'easy', best: +(localStorage.getItem('os_best') || 0), running: false, tapResume: null };
  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.8-9.4C.6 8.200 2.300 4.500 6 4.500c2.200 0 3.700 1.100 6 3.600 2.300-2.500 3.800-3.600 6-3.600 3.700 0 5.400 3.700 3.800 7.100C19.500 16.400 12 21 12 21Z"/></svg>';

  function setOrb(state, label) {
    $('#orb').dataset.s = state;
    if (label != null) $('#status').textContent = label;
  }
  function setHeard(t) {
    $('#heard').innerHTML = '';
    if (t) { const s = document.createElement('span'); s.textContent = t; $('#heard').appendChild(s); }
  }
  function renderLives(pop) {
    const el = $('#lives');
    el.innerHTML = HEART.repeat(3);
    [...el.children].forEach((h, i) => { if (i >= G.lives) h.classList.add('off'); if (pop && i === G.lives) h.classList.add('pop'); });
  }
  function renderBest() { $('#bestT').textContent = G.best; $('#bestG').textContent = G.best; }
  const cards = () => [...$('#chain').children];
  function addWord(r, by) {
    G.chain.push({ r, by }); G.used.add(cmpKey(r));
    const d = document.createElement('div');
    d.className = 'card' + (by === 'p' ? ' me' : '') + (r.length >= 6 ? ' long' : '');
    d.innerHTML = `<span class="n">${G.chain.length}</span><span class="q">？</span><span class="w"></span>`;
    d.lastChild.textContent = r;
    $('#chain').appendChild(d);
    $('#chain').scrollTop = 1e6;
    const c = $('#cnt');
    c.textContent = G.chain.length; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    return d;
  }
  function hideCards() { cards().forEach(c => c.classList.remove('show', 'hit', 'miss', 'new')); }
  function showCard(i, cls) {
    const c = cards()[i];
    if (!c) return;
    c.classList.remove('show', 'hit', 'miss', 'new');
    cls.split(' ').forEach(x => c.classList.add(x));
    c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  async function flipHits(from, to) {
    for (let i = from; i < to; i++) { showCard(i, 'hit'); play('tick', i); await sleep(95); }
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

  // ================= ゲームの流れ =================
  // コンピューターが言葉を読み上げる
  async function recite({ all, newIdx = -1 }) {
    const n = G.chain.length;
    hideCards();
    for (let i = all ? 0 : n - 1; i < n; i++) {
      const isNew = i === newIdx;
      if (isNew) { await sleep(160); play('newWord'); await sleep(240); } else play('tick', i);
      showCard(i, isNew ? 'show new' : 'show');
      await say(G.chain[i].r, { kind: 'word', rate: 0.98, label: isNew ? 'あたらしい ことば！' : 'おぼえてね' });
      await sleep(isNew ? 300 : 110);
    }
  }

  function checkNew(r) {
    if (r.length < 2 || r.length > 14) return { err: 'short', r };
    if (!sameStart(firstKana(r), G.need)) return { err: 'start', r };
    if (lastKana(r) === 'ん') return { err: 'n', r };
    if (G.used.has(cmpKey(r))) return { err: 'used', r };
    return { ok: true, r };
  }

  function judgeRecite(alts, keys, confirmed) {
    let best = null;
    for (const alt of alts) for (const r of variants(alt)) {
      const u = cmpKey(r);
      if (!u) continue;
      for (const from of (confirmed ? [confirmed, 0] : [0])) {   // 言い直して最初から、も受け付ける
        const m = matchChain(u, keys.slice(from));
        const res = { from, count: m.count, status: m.status, rest: r.slice(m.pos), len: u.length };
        if (m.status === 'complete') {
          res.word = res.rest ? checkNew(res.rest) : null;
          res.score = !res.rest ? 900 : res.word.ok ? 1000 : 800;
        } else res.score = (m.status === 'partial' ? 100 : 0) + from + m.count;
        if (from === 0 && confirmed) res.score -= 0.5;
        if (!best || res.score > best.score) best = res;
      }
    }
    return best;
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
    await Ear.stop();
    play('pause');
    await say(auto ? 'しばらく声が聞こえないので、一時停止します。「再開」と言うと、続きから始めます。' : '一時停止。「再開」と言うと、続きから始めます。', { label: 'ひとやすみ' });
    setOrb('pause', '「さいかい」で つづきから');
    Ear.start();
    for (;;) {
      const h = await hear(180000);
      if (!h || h.cmd === 'hide') { await deepPause(); return 'resume'; }
      if (h.cmd === 'tap') break;
      if (h.cmd === 'quit') return 'quit';
      const c = h.alts && detectCmd(h.alts, ['resume', 'quit']);
      if (c === 'resume') break;
      if (c === 'quit') return 'quit';
    }
    await Ear.stop();
    play('resume');
    await say('再開します。');
    return 'resume';
  }

  // プレイヤーの番。 'ok' / 'over' / 'quit' を返す
  async function playerTurn() {
    const n = G.chain.length, keys = G.chain.map(w => cmpKey(w.r));
    G.need = lastKana(G.chain[n - 1].r);
    let confirmed = 0, strikes = 0, nudges = 0, phase = 'recite';

    const open = () => {
      if (phase === 'recite' && !confirmed) hideCards();
      play('listen');
      setOrb('listen', phase === 'recite' ? 'あなたの番！ さいしょから' : `「${G.need}」から あたらしい ことば`);
      setHeard('');
      Ear.start();
    };
    const again = async lead => {
      await Ear.stop();
      if (lead) await say(lead);
      await recite({ all: true });
      await say(`つぎは、「${G.need}」。`);
      confirmed = 0; phase = 'recite';
      open();
    };
    const miss = async text => {
      await Ear.stop();
      G.lives--; renderLives(true);
      play('bad'); setOrb('bad', 'ざんねん…');
      await sleep(650);
      await say(text, { label: 'ざんねん…' });
      return G.lives > 0;
    };

    open();
    for (;;) {
      const h = await hear(phase === 'recite' ? 15000 : 11000);

      if (!h) {                                   // しばらく無言
        if (++nudges >= 3) {
          if (await pauseFlow(true) === 'quit') return 'quit';
          nudges = 0; await again(); continue;
        }
        await Ear.stop();
        await say(phase === 'newword' ? `「${G.need}」から始まる、新しい言葉を、どうぞ。` : confirmed ? '続きを、どうぞ。' : 'あなたの番です。最初から、どうぞ。');
        open(); continue;
      }
      nudges = 0;

      let cmd = h.cmd || detectCmd(h.alts, ['again', 'stop', 'quit', 'giveup']);
      if (cmd && !h.cmd && phase === 'newword' && checkNew(reading(h.alts[0])).ok) cmd = null;   // 命令と同じ言葉をしりとりで使った
      if (cmd === 'quit') { await Ear.stop(); return 'quit'; }
      if (cmd === 'hide') { await deepPause(); await again(); continue; }
      if (cmd === 'stop' || cmd === 'tap') {
        if (await pauseFlow(false) === 'quit') return 'quit';
        await again(); continue;
      }
      if (cmd === 'again') {
        if (G.hints > 0) { G.hints--; await again(`もう一度、言います。ヒントは、あと${G.hints}回。`); }
        else { await Ear.stop(); await say('ヒントは、もうありません。'); open(); }
        continue;
      }
      if (cmd === 'giveup') {
        showCard(confirmed < n ? confirmed : n - 1, 'miss');
        const alive = await miss(phase === 'recite' ? `${confirmed + 1}番目は、「${G.chain[confirmed].r}」でした。` : 'パスは、まちがい1回ぶんです。');
        if (!alive) return 'over';
        await again(`のこり、${G.lives}回。もう一度、言いますね。`); continue;
      }

      let word = null;
      if (phase === 'recite') {
        const j = judgeRecite(h.alts, keys, confirmed);
        if (!j) continue;
        if (j.status === 'wrong') {
          if (j.from + j.count === 0 && j.len <= 2) continue;        // 短い雑音は無視
          if (j.from === 0 && confirmed) hideCards();
          await flipHits(j.from, j.from + j.count);
          const at = j.from + j.count;
          showCard(at, 'miss');
          if (!await miss(`ざんねん。${at + 1}番目は、「${G.chain[at].r}」でした。`)) return 'over';
          await again(`のこり、${G.lives}回。もう一度、言いますね。`); continue;
        }
        if (j.from === 0 && confirmed) hideCards();
        await flipHits(j.from, j.from + j.count);
        confirmed = j.from + j.count;
        if (confirmed < n) { setOrb('listen', 'そのちょうし！ つづきを'); continue; }
        phase = 'newword';
        if (!j.rest) { play('chainOk'); setOrb('listen', `「${G.need}」から あたらしい ことば`); continue; }
        word = j.word;
      } else {
        const cs = h.alts.flatMap(variants).map(checkNew);
        word = cs.find(c => c.ok) || cs.find(c => c.err !== 'short') || cs[0];
        if (!word) continue;
      }

      if (word.ok) {
        await Ear.stop();
        addWord(word.r, 'p');
        showCard(G.chain.length - 1, 'hit new');
        play('ok'); setOrb('good', 'つながった！');
        await sleep(520);
        await say(`${word.r}！`, { kind: 'echo', label: 'つながった！' });
        return 'ok';
      }
      if (word.err === 'n' || word.err === 'used') {
        const alive = await miss(word.err === 'n' ? `「${word.r}」。「ん」が、ついてしまいました。` : `「${word.r}」は、もう出ました。`);
        if (!alive) return 'over';
        await say(`のこり、${G.lives}回。「${G.need}」から始まる、べつの言葉を、どうぞ。`);
        open(); continue;
      }
      await Ear.stop();                            // 始まりの文字がちがう・聞き取れない
      if (++strikes >= 3) {
        strikes = 0;
        if (!await miss('うまく、つながりませんでした。')) return 'over';
        await say(`のこり、${G.lives}回。「${G.need}」から始まる言葉を、どうぞ。`);
      } else {
        await say(word.err === 'start' ? `「${word.r}」と聞こえました。「${G.need}」から始まる言葉を、どうぞ。` : `もう一度。「${G.need}」から始まる言葉を、どうぞ。`);
      }
      open();
    }
  }

  const rank = n => n < 5 ? 'しりとり みならい' : n < 9 ? 'しりとり ドライバー' : n < 13 ? 'きおくの めいじん' : n < 19 ? 'きおくの たつじん' : 'でんせつの きおく王';

  async function gameOver(win) {
    await Ear.stop();
    const n = G.chain.length, newBest = n > G.best;
    if (newBest) { G.best = n; try { localStorage.setItem('os_best', n); } catch (e) {} renderBest(); }
    cards().forEach((c, i) => { c.classList.remove('miss', 'new', 'hit'); c.classList.add('show'); });
    if (win) {
      play('record'); setOrb('good', 'あなたの かち！');
      await say(`「${G.need}」から始まる言葉が、もう出てきません。まいりました！ あなたの勝ちです。`, { label: 'あなたの かち！' });
    } else {
      play('gameover'); setOrb('bad', 'ゲームオーバー');
      await sleep(1500);
      await say('ゲームオーバー。', { label: 'ゲームオーバー' });
    }
    $('#rTitle').textContent = win ? 'あなたの かち！' : 'きろく';
    $('#rNum').textContent = n; $('#rRank').textContent = rank(n); $('#rNew').hidden = !newBest;
    $('#result').classList.add('on');
    if (newBest) { play('record'); await sleep(500); }
    await say(`記録は、${n}個。${rank(n)}、です。` + (newBest ? '自己ベスト、更新！' : ''), { label: '' });
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

  async function playGame(first) {
    G.chain = []; G.used = new Set(); G.lives = 3; G.hints = 3;
    $('#chain').innerHTML = ''; renderLives(); renderBest(); setHeard('');
    addWord('しりとり', 'c');
    await say('最初の言葉は、', { label: 'おぼえてね' });
    await recite({ all: true });
    await say(first ? '「しりとり」のあとに、「り」から始まる言葉を、つなげてください。どうぞ。' : 'つぎは、「り」。');
    for (;;) {
      const r = await playerTurn();
      if (r === 'quit') return 'quit';
      if (r === 'over') return gameOver(false);
      if (G.chain.length % 10 === 0) { play('milestone'); await say(`${G.chain.length}個、達成！`, { label: `${G.chain.length}こ たっせい！` }); }
      setOrb('think', 'うーん…'); play('think');
      await sleep(620);
      const prev = G.chain[G.chain.length - 1].r, w = pickWord(lastKana(prev));
      if (!w) { G.need = lastKana(prev); return gameOver(true); }
      addWord(w, 'c');
      if (G.mode === 'easy') await recite({ all: true, newIdx: G.chain.length - 1 });
      else { await say(`「${prev}」の次は、`); await recite({ all: false, newIdx: G.chain.length - 1 }); }
      await say(`つぎは、「${lastKana(w)}」。`);
    }
  }

  async function startGame() {
    if (G.running) return;
    G.running = true;
    if (!MOCK) {
      try { const AC = window.AudioContext || window.webkitAudioContext; synth = synth || makeSynth(new AC()); } catch (e) {}
      try { speechSynthesis.cancel(); } catch (e) {}
      wakeLock();
    }
    view('game');
    $('#chain').innerHTML = ''; G.lives = 3; renderLives(); renderBest(); $('#cnt').textContent = '0';
    setOrb('speak', 'おぼえるしりとり');
    play('start');
    let first = false;
    try { first = !localStorage.getItem('os_seen'); localStorage.setItem('os_seen', '1'); } catch (e) {}
    if (window.__noIntro) first = false;
    const speech = say('おぼえるしりとり。');   // 最初の読み上げはタップの中で始める(端末の制限)
    await sleep(900); await speech;
    if (first) {
      await say('声だけで遊ぶ、記憶しりとりです。', { label: 'あそびかた' });
      await say('あなたの番では、それまでに出た言葉を、最初から全部言ってから、新しい言葉をひとつ、つなげてください。');
      await say('まちがいは、3回まで。忘れたら「もういっかい」、休むときは「ストップ」と言ってください。');
      await say('では、はじめます。');
    }
    for (let f = first; ; f = false) if (await playGame(f) === 'quit') break;
    await Ear.stop();
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

  renderBest(); renderLives(); TTS.init();
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
    if (!ok) { $('#support').hidden = false; $('#support').textContent = '辞書の読み込みに失敗しました。通信環境のよい場所で、開き直してください。'; }
    window.__ready = true;
  });

  // テスト・動画づくり用の入口
  window.__game = {
    G, start: startGame, feed: t => { const alts = [].concat(t); setHeard(alts[0]); deliver({ alts }); }, cmd: c => deliver({ cmd: c }),
    interim: setHeard, reading, cmpKey, matchChain, lastKana, DICT,
  };
})();
