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

  // ================= お話の ことば =================
  // 画面の表示, 読み上げ, よみ(聞き取りの照合), 漢字など(照合), 絵
  const voc = rows => rows.trim().split('\n').map(l => {
    const [k, say, reads, forms, ico] = l.trim().split(',');
    return { k, say, reads: reads.split('|'), forms: forms ? forms.split('|') : [], ico: ico || '' };
  });
  const VOC = {
    who: voc(`
      ねこ,ねこさん,ねこ,猫,🐱
      いぬ,いぬさん,いぬ,犬,🐶
      うさぎ,うさぎさん,うさぎ,兎|兔,🐰
      ぞう,ぞうさん,ぞう,象,🐘
      くま,くまさん,くま,熊,🐻
      きつね,きつねさん,きつね,狐,🦊
      たぬき,たぬきさん,たぬき,狸,🦝
      パンダ,パンダさん,ぱんだ,,🐼
      ライオン,ライオンさん,らいおん,,🦁
      ペンギン,ペンギンさん,ぺんぎん,,🐧
      きりん,きりんさん,きりん,麒麟,🦒
      コアラ,コアラさん,こあら,,🐨`),
    day: voc(`
      月曜日,月曜日,げつよう,月曜,
      火曜日,火曜日,かよう,火曜,
      水曜日,水曜日,すいよう,水曜,
      木曜日,木曜日,もくよう,木曜,
      金曜日,金曜日,きんよう,金曜,
      土曜日,土曜日,どよう,土曜,
      日曜日,日曜日,にちよう,日曜,`),
    place: voc(`
      公園,公園,こうえん,公園,🌳
      駅,駅,えき,駅,🚉
      学校,学校,がっこう,学校,🏫
      図書館,図書館,としょかん,図書館,📚
      海,海,うみ,海,🌊
      山,山,やま,山,⛰️
      遊園地,遊園地,ゆうえんち,遊園地,🎡
      動物園,動物園,どうぶつえん,動物園,🦓
      神社,神社,じんじゃ,神社,⛩️
      空港,空港,くうこう,空港,✈️
      デパート,デパート,でぱーと|ひゃっかてん,百貨店,🏬
      水族館,水族館,すいぞくかん,水族館,🐟`),
    // 色は「読み上げ」が 形容する形(赤い / 緑の)
    color: voc(`
      あか,赤い,あか|れっど,赤|紅,#ff5a6e
      あお,青い,あお|ぶるー,青,#4aa3ff
      きいろ,黄色い,きいろ|いえろー,黄,#ffd83b
      みどり,緑の,みどり|ぐりーん,緑,#4fd67e
      しろ,白い,しろ|ほわいと,白,#ffffff
      くろ,黒い,くろ|ぶらっく,黒,#30303a
      ピンク,ピンクの,ぴんく|ももいろ,桃色,#ff8fc7
      むらさき,紫の,むらさき|ぱーぷる,紫,#a877ff
      オレンジ,オレンジの,おれんじ|だいだい,橙,#ff9a3c
      ちゃいろ,茶色い,ちゃいろ|ぶらうん,茶色,#a9713f`),
    item: voc(`
      かさ,傘,かさ,傘,☂️
      ぼうし,帽子,ぼうし,帽子,👒
      かばん,かばん,かばん|ばっぐ,鞄,👜
      くつ,靴,くつ,靴,👟
      ふうせん,風船,ふうせん,風船,🎈
      ボール,ボール,ぼーる,,⚽
      マフラー,マフラー,まふらー,,🧣
      てぶくろ,手袋,てぶくろ,手袋,🧤
      とけい,時計,とけい,時計,⌚
      めがね,めがね,めがね,眼鏡,👓
      えほん,絵本,えほん,絵本,📖
      リボン,リボン,りぼん,,🎀
      じてんしゃ,自転車,じてんしゃ,自転車,🚲
      カメラ,カメラ,かめら,,📷
      ギター,ギター,ぎたー,,🎸`),
  };
  const COLOR_NAME = { あか: '赤', あお: '青', きいろ: '黄色', みどり: '緑', しろ: '白', くろ: '黒', ピンク: 'ピンク', むらさき: '紫', オレンジ: 'オレンジ', ちゃいろ: '茶色' };
  const THEMES = [
    { past: '買いました', attr: '買った' },
    { past: '見つけました', attr: '見つけた' },
    { past: 'もらいました', attr: 'もらった' },
  ];
  // お話の長さ。n=登場する数, slots=1人ぶんの中身, q=質問の数
  const LEVELS = [
    { n: 1, slots: ['place', 'item'], q: 2 },
    { n: 1, slots: ['day', 'place', 'item'], q: 2 },
    { n: 1, slots: ['day', 'place', 'color', 'item'], q: 3 },
    { n: 2, slots: ['place', 'item'], q: 3 },
    { n: 2, slots: ['place', 'color', 'item'], q: 3 },
    { n: 2, slots: ['day', 'place', 'color', 'item'], q: 3 },
    { n: 3, slots: ['place', 'item'], q: 3 },
    { n: 3, slots: ['place', 'color', 'item'], q: 4 },
    { n: 3, slots: ['day', 'place', 'color', 'item'], q: 4 },
  ];
  const HARD_FROM = 3;   // チャレンジは 2人のお話から
  const ORDER = ['who', 'day', 'place', 'color', 'item'];
  const ansSay = (slot, v) => slot === 'color' ? COLOR_NAME[v.k] : v.say;

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
  for (const cat in VOC) for (const v of VOC[cat]) v.keys = v.reads.map(cmpKey);

  const kanaOf = alt => cmpKey(reading(alt).replace(FILLER, ''));
  const has = (v, alt, kana) => v.forms.some(f => alt.includes(f)) || v.keys.some(k => kana.includes(k));
  // 聞き取った候補から答えを判定する。 {ok:true} / {ok:false, said} / null(その種類の言葉が聞き取れない)
  function judge(q, alts) {
    const kanas = alts.map(kanaOf), list = VOC[q.cat];
    if (alts.some((a, i) => has(q.ans, a, kanas[i]))) return { ok: true };
    const other = list.find(v => v !== q.ans && has(v, alts[0], kanas[0]));
    if (other) return { ok: false, said: other };
    // 1文字ちがいまで許す(長い言葉だけ)
    for (const u of kanas) {
      if (u.length < 4) continue;
      const near = list.filter(v => v.keys.some(k => k.length >= 4 && lev(u, k) <= 1));
      if (near.includes(q.ans)) return { ok: true };
      if (near.length === 1) return { ok: false, said: near[0] };
    }
    return null;
  }

  // ================= お話づくり =================
  function makeStory(lv) {
    const sc = window.__script && window.__script.length ? window.__script.shift() : null;
    const theme = THEMES[sc ? sc.theme || 0 : rnd(THEMES.length)];
    const pool = {};
    for (const s of ORDER) pool[s] = shuffle(VOC[s]);
    const n = sc ? sc.chars.length : lv.n, slots = sc ? ORDER.filter(s => s !== 'who' && sc.chars[0][s]) : lv.slots;
    const chars = [];
    for (let i = 0; i < n; i++) {
      const c = {};
      for (const s of ['who'].concat(slots)) c[s] = sc ? VOC[s].find(v => v.k === sc.chars[i][s]) : pool[s][i];
      chars.push(c);
    }
    const text = c => `${c.who.say}は、` + (c.day ? `${c.day.say}に、` : '') + `${c.place.say}で、` + (c.color ? c.color.say : '') + `${c.item.say}を ${theme.past}。`;
    const st = { theme, chars, slots, lines: chars.map(text) };
    st.qs = sc && sc.qs ? sc.qs.map(([slot, ci, by]) => makeQ(st, slot, ci, by)) : pickQs(st, lv.q);
    return st;
  }
  // slot='who' は「○○したのは だれ?」(by で手がかりを決める)。それ以外は「△△さんは どこで?」など
  function makeQ(st, slot, ci, by) {
    const c = st.chars[ci], t = st.theme, w = c.who.say;
    let text;
    if (slot === 'who') {
      text = by === 'item' ? `${c.item.say}を ${t.attr}のは、だれ？`
        : by === 'place' ? `${c.place.say}で ${t.attr}のは、だれ？`
        : by === 'color' ? `${c.color.say} ものを ${t.attr}のは、だれ？`
        : by === 'day' ? `${c.day.say}に ${t.attr}のは、だれ？`
        : 'お話に 出てきたのは、だれ？';
    } else {
      text = slot === 'place' ? `${w}は、どこで ${t.past}か？`
        : slot === 'item' ? `${w}は、何を ${t.past}か？`
        : slot === 'color' ? `${w}が ${t.attr}ものは、何色？`
        : `${w}が ${t.attr}のは、何曜日？`;
    }
    return { text, cat: slot, ci, ans: c[slot], link: ci + ':' + (slot === 'who' ? by || 'who' : slot) };
  }
  function pickQs(st, n) {
    const cand = [];
    st.chars.forEach((c, ci) => {
      for (const s of st.slots) {
        cand.push(['direct', s, ci]);
        if (st.chars.length > 1) cand.push(['who', 'who', ci, s]);
      }
    });
    if (st.chars.length === 1 && st.slots.length === 2) cand.push(['who', 'who', 0, undefined]);
    const out = [], used = new Set();
    let wantWho = st.chars.length > 1;
    for (const [kind, slot, ci, by] of shuffle(cand).sort((a, b) => wantWho ? (b[0] === 'who') - (a[0] === 'who') : 0)) {
      if (out.length >= n) break;
      const q = makeQ(st, slot, ci, by);
      // 同じ組み合わせ(だれ×もの など)を 2回きかない。「だれ?」は 1人につき 1回
      if (used.has(q.link) || (kind === 'who' && used.has('w' + ci))) continue;
      if (kind === 'who' && out.filter(o => o.cat === 'who').length >= Math.max(1, n - 2)) continue;
      used.add(q.link); if (kind === 'who') used.add('w' + ci);
      out.push(q);
    }
    // 1人のお話で「だれ?」をきくときは、名前を言ってしまう前の 最初にきく
    return shuffle(out).sort((a, b) => st.chars.length === 1 ? (b.cat === 'who') - (a.cat === 'who') : 0);
  }
  function hintChoices(st, q) {
    const inStory = st.chars.map(c => c[q.cat]).filter(v => v && v !== q.ans);
    const rest = shuffle(VOC[q.cat].filter(v => v !== q.ans && !inStory.includes(v)));
    return shuffle([q.ans].concat(shuffle(inStory).concat(rest).slice(0, 2)));
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
  const sayDur = text => { const d = window.__dur && window.__dur[text]; return d != null ? d : 250 + text.length * 110; };
  async function say(text, o = {}) {
    setOrb('speak', o.label);
    log('say', { text, kind: o.kind || 'sys' });
    if (MOCK) await sleep(sayDur(text));
    else await TTS.speak(text, o.rate);
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
    hint: ['ひんと', 'ひんとちょうだい', 'ひんとをください', 'さんたく'],
    stop: ['すとっぷ', 'いちじていし', 'ていし', 'ちょっとまって', 'きゅうけい', 'ひとやすみ'],
    resume: ['さいかい', 'つづき', 'つづける', 'すたーと', 'つづきから'],
    again: ['もういっかい', 'もういちど', 'もっかい', 'りべんじ', 'しつもんをもういっかい', 'しつもんをもういちど'],
    quit: ['おわり', 'おわる', 'やめる', 'しゅうりょう', 'おしまい'],
    giveup: ['わからない', 'わかんない', 'ぎぶあっぷ', 'ぱす', 'こうさん', 'でてこない', 'わすれた', 'わすれました', 'おぼえてない'],
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
  const G = { mode: 'normal', lives: 3, score: 0, hints: 3, round: 0, running: false, tapResume: null, story: null,
    best: +(store('ko_best') || 0), bestH: +(store('ko_best_h') || 0) };
  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.8-9.4C.6 8.2 2.3 4.5 6 4.500c2.200 0 3.700 1.100 6 3.600 2.300-2.500 3.800-3.600 6-3.600 3.700 0 5.400 3.700 3.800 7.100C19.500 16.400 12 21 12 21Z"/></svg>';
  const SLOT_LABEL = { who: 'だれ', day: 'いつ', place: 'どこ', color: 'いろ', item: 'なに' };

  function chipFace(slot, v) {
    if (slot === 'color') return `<i class="dot" style="background:${v.ico}"></i><b>${v.k}</b>`;
    if (slot === 'day') return `<b class="day">${v.k[0]}<small>曜日</small></b>`;
    return `<i class="em">${v.ico}</i><b>${v.k}</b>`;
  }
  function buildBoard(st) {
    const b = $('#board');
    b.innerHTML = ''; b.dataset.n = st.chars.length; b.dataset.s = st.slots.length;
    st.chars.forEach((c, ci) => {
      const row = document.createElement('div');
      row.className = 'row';
      for (const s of ['who'].concat(st.slots)) {
        const d = document.createElement('div');
        d.className = 'chip ' + s; d.dataset.k = ci + ':' + s;
        d.innerHTML = `<span class="lb">${SLOT_LABEL[s]}</span><span class="f">${chipFace(s, c[s])}</span><span class="q">？</span>`;
        row.appendChild(d);
      }
      b.appendChild(row);
    });
  }
  const chip = (ci, s) => $(`#board .chip[data-k="${ci}:${s}"]`);
  const chips = () => [...document.querySelectorAll('#board .chip')];
  function setChip(el, cls) { el.classList.remove('in', 'hid', 'ask', 'hit', 'miss'); void el.offsetWidth; el.classList.add(...cls.split(' ')); }

  function setOrb(state, label) {
    $('#orb').dataset.s = state;
    if (label != null) $('#status').textContent = label;
  }
  function setHeard(t) {
    $('#heard').innerHTML = '';
    if (t) { const s = document.createElement('span'); s.textContent = t; $('#heard').appendChild(s); }
  }
  function renderHud(pop) {
    const el = $('#lives');
    el.innerHTML = HEART.repeat(3);
    [...el.children].forEach((h, i) => { if (i >= G.lives) h.classList.add('off'); if (pop && i === G.lives) h.classList.add('pop'); });
    $('#lv').textContent = G.round + 1;
    $('#hbest').textContent = G.mode === 'hard' ? G.bestH : G.best;
  }
  function bumpScore() {
    const c = $('#cnt');
    c.textContent = G.score; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
  }
  function renderBest() { $('#bestT').textContent = G.best; $('#bestS').textContent = G.bestH; }
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

  // ================= 1問 =================
  const PRAISE = ['正解！', 'そのとおり！', 'おみごと！', '正解！', 'ばっちり！'];
  async function miss(q, lead) {
    await Ear.stop();
    G.lives--; renderHud(true);
    setChip(chip(q.ci, q.cat), 'miss');
    play('bad'); setOrb('bad', 'ざんねん！');
    await sleep(650);
    await say(`${lead}正解は、${ansSay(q.cat, q.ans)}、でした。`, { label: `こたえは「${q.ans.k}」` });
    return G.lives > 0 ? 'ng' : 'over';
  }
  // 'ok' / 'ng' / 'over' / 'quit'
  async function ask(st, q, idx) {
    const el = chip(q.ci, q.cat);
    setChip(el, 'hid ask');
    play('question'); setOrb('speak', `しつもん ${idx + 1}`);
    await sleep(520);
    await say(q.text, { kind: 'q', label: `しつもん ${idx + 1}` });
    let strikes = 0;
    const open = () => { play('listen'); setOrb('listen', 'こたえて！'); setHeard(''); Ear.start(); };
    open();
    for (;;) {
      const h = await hear(15000, true);
      if (!h) { play('timeup'); return miss(q, '時間切れ。'); }
      const cmd = h.cmd || detectCmd(h.alts, ['hint', 'again', 'stop', 'quit', 'giveup']);
      if (cmd === 'quit') { await Ear.stop(); return 'quit'; }
      if (cmd === 'hide') { await deepPause(); await say(q.text, { kind: 'q' }); open(); continue; }
      if (cmd === 'stop' || cmd === 'tap') {
        if (await pauseFlow() === 'quit') return 'quit';
        await say(q.text, { kind: 'q', label: `しつもん ${idx + 1}` });
        open(); continue;
      }
      if (cmd === 'again') { await Ear.stop(); await say(q.text, { kind: 'q', label: `しつもん ${idx + 1}` }); open(); continue; }
      if (cmd === 'hint') {
        await Ear.stop();
        if (G.hints > 0) {
          G.hints--; play('hint');
          await say(`ヒント。${hintChoices(st, q).map(v => ansSay(q.cat, v)).join('、')}、の どれか。ヒントは、あと${G.hints}回。`, { label: 'ヒント' });
        } else await say('ヒントは、もうありません。');
        open(); continue;
      }
      if (cmd === 'giveup') return miss(q, '');

      const j = judge(q, h.alts);
      if (!j) {
        await Ear.stop();
        if (++strikes >= 3) return miss(q, '聞き取れませんでした。');
        await say('もう一度、どうぞ。', { label: 'もういちど' });
        open(); continue;
      }
      if (!j.ok) return miss(q, 'ざんねん。');
      await Ear.stop();
      G.score++; bumpScore();
      setChip(el, 'hit');
      play('ok'); setOrb('good', `${q.ans.k}！`);
      await sleep(520);
      await say(PRAISE[rnd(PRAISE.length)], { kind: 'praise', label: 'せいかい！' });
      return 'ok';
    }
  }

  // ================= 1話 =================
  const COUNT_SAY = { 2: 'ふたり', 3: '3人' };
  async function round(prevN) {
    const lv = LEVELS[Math.min(G.round, LEVELS.length - 1)];
    const st = G.story = makeStory(lv);
    buildBoard(st); renderHud(); setHeard('');
    play('page');
    await sleep(350);
    if (st.chars.length !== prevN && st.chars.length > 1) await say(`ここからは、${COUNT_SAY[st.chars.length]}の お話です。`, { label: `だい ${G.round + 1} わ` });
    await say(`第${G.round + 1}話。`, { label: `だい ${G.round + 1} わ` });
    await sleep(250);
    let tick = 0;
    for (let ci = 0; ci < st.chars.length; ci++) {
      // 読み上げに合わせて、絵を順にならべる
      const cells = ['who'].concat(st.slots).map(s => chip(ci, s)), dur = MOCK ? sayDur(st.lines[ci]) : 900 + st.lines[ci].length * 150;
      cells.forEach((el, k) => setTimeout(() => { setChip(el, 'in'); play('tick', tick++); }, MOCK && window.__fast ? 0 : dur * (0.04 + 0.8 * k / cells.length)));
      await say(st.lines[ci], { kind: 'story', rate: 0.98, label: 'よく きいて…' });
      await sleep(380);
    }
    await sleep(500);
    play('hide'); chips().forEach((el, k) => setTimeout(() => setChip(el, 'hid'), MOCK && window.__fast ? 0 : k * 45));
    setOrb('think', 'おぼえた？');
    await sleep(900);
    await say(G.round ? '質問です。' : 'では、質問です。', { label: 'しつもん' });
    let allOk = true, r = 'ok';
    for (let i = 0; i < st.qs.length; i++) {
      r = await ask(st, st.qs[i], i);
      if (r === 'quit' || r === 'over') break;
      if (r === 'ng') allOk = false;
    }
    // 答え合わせ: 残りのふせた絵を ひらく
    chips().filter(el => el.classList.contains('hid')).forEach((el, k) => setTimeout(() => setChip(el, 'in'), MOCK && window.__fast ? 0 : 120 + k * 60));
    if (r === 'quit' || r === 'over') return r;
    if (allOk) { play('perfect'); setOrb('good', 'パーフェクト！'); await sleep(450); await say('パーフェクト！', { kind: 'praise', label: 'パーフェクト！' }); }
    else await sleep(700);
    return 'ok';
  }
  const rank = n => n < 4 ? 'きおくの みならい' : n < 9 ? 'ドライブ きおく名人' : n < 15 ? 'ききみみ マスター' : n < 22 ? 'きおくの たつじん' : 'あるく ボイスレコーダー';

  async function game(first) {
    G.lives = 3; G.score = 0; G.hints = 3; G.round = G.mode === 'hard' ? HARD_FROM : 0;
    $('#board').innerHTML = ''; $('#cnt').textContent = 0; renderHud(); setHeard('');
    play('start'); await say('きいて、おぼえて、こたえて！', { label: 'きいて おぼえて こたえて' });
    if (first) {
      await say('これから、短いお話を読みます。よく聞いて、覚えてください。', { label: 'あそびかた' });
      await say('そのあと、お話について質問します。声で答えてください。');
      await say('まちがいは、3回まで。お話は、だんだん長くなります。');
      await say('質問をもう一度聞くときは「もういっかい」、困ったら「ヒント」、休むときは「ストップ」と言ってください。');
    }
    let end = 'over', prevN = 1;
    for (;;) {
      const r = await round(prevN);
      if (r === 'quit') return 'quit';
      if (r === 'over') break;
      prevN = G.story.chars.length;
      G.round++;
      play('levelup'); setOrb('good', `レベル ${G.round + 1}`); renderHud();
      await sleep(1100);
    }
    await Ear.stop();
    const hard = G.mode === 'hard', n = G.score, newBest = n > (hard ? G.bestH : G.best);
    if (newBest) { if (hard) { G.bestH = n; store('ko_best_h', n); } else { G.best = n; store('ko_best', n); } renderBest(); }
    play('gameover'); setOrb('bad', 'ゲームオーバー');
    await sleep(1500);
    await say('ゲームオーバー。', { label: 'ゲームオーバー' });
    return result({ title: 'きろく', n, rank: rank(n), sub: `レベル ${G.round + 1} まで すすんだ`, newBest,
      speech: `正解は、${n}問。${rank(n)}、です。` + (newBest ? 'ベスト、更新！' : '') });
  }

  async function result(o) {
    $('#rTitle').textContent = o.title; $('#rNum').textContent = o.n; $('#rRank').textContent = o.rank; $('#rSub').textContent = o.sub; $('#rNew').hidden = !o.newBest;
    $('#result').classList.add('on');
    if (o.newBest) { play('record'); await sleep(300); }
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
    view('game');
    setOrb('speak', '');
    let first = !store('ko_seen');
    store('ko_seen', '1');
    if (window.__noIntro) first = false;
    // 最初の読み上げは、このままタップの処理の中で始まる(端末の制限への対応)
    for (let f = first; ; f = false) if (await game(f) === 'quit') break;
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

  renderBest(); renderHud(); TTS.init();
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
    G, VOC, LEVELS, start: startGame, feed: t => { const alts = [].concat(t); setHeard(alts[0]); deliver({ alts }); }, cmd: c => deliver({ cmd: c }),
    interim: setHeard, reading, makeStory, judge: (q, a) => judge(q, [].concat(a)),
  };
})();
