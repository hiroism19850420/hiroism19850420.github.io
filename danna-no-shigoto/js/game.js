// 旦那の仕事は妻を笑顔にすること  本体(進行・判定・画面)
(function () {
  'use strict';
  const D = window.DATA, $ = (id) => document.getElementById(id);
  const DEBUG = /[?&]debug=1/.test(location.search);

  // 調整用の数値
  const C = {
    START: 40,                                                        // 笑顔ゲージの初期値
    PTS: { best: 10, good: 6, meh: -4, bad: -8, worst: -14, silent: -10 },
    FAST: 1.8, SLOW: 4.5,                                             // 即答・おそい返事の境目(秒)
    LOUD: 0.8, QUIET: 0.5,                                            // 大声・小声の境目(0〜1)
    LIMIT: 8,                                                         // 返事の制限時間(秒)
    SCENES: 4,                                                        // 1回に出る場面の数
    TRIES: 8,                                                         // なぞで声をかけられる回数
    RUSH: 20, RUSH_RATE: 0.4,                                         // ラッシュの秒数と、得点→ゲージの倍率
  };
  const LABEL = { best: '大正解！', good: '正解', meh: 'びみょう…', bad: '地雷！', worst: '大地雷！！', silent: '無言…' };
  const OVER = { over: true };

  const G = {
    clock: 0, smile: C.START, h: null, rush: null, talk: null, bar: null, grump: false,
    tts: true, ttsBusy: false, ttsDead: 0, unlocked: false, skip: false, volMiss: 0, recMiss: 0,
    stats: { best: 0, mine: 0 }, mail: [], praise: [],
  };
  const el = {};
  ['chapter', 'fill', 'num', 'pops', 'verdict', 'card', 'cap', 'wife', 'you', 'mic', 'youText', 'timer', 'vol', 'typeForm', 'typeIn',
    'title', 'startBtn', 'titleVoice', 'titleHeard', 'titleSkip', 'ttsBtn', 'titleNote',
    'result', 'rank', 'rsmile', 'rstats', 'rsay', 'mailHead', 'mailSub', 'mailBody', 'mailSend', 'lineSend', 'mailCopy', 'resultHeard', 'retryBtn'].forEach(k => el[k] = $(k));
  const wifeP = el.wife.querySelector('p');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const norm = (t) => (t || '').replace(/[\s、。，．,.！？!?「」『』…・]/g, '').replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
  const canVoice = () => Voice.st.supported && !Voice.st.denied;

  // ---------- ゲーム内の時計で待つ ----------
  let waits = [];
  const until = (f) => new Promise(r => waits.push({ f, r }));
  const sleep = (s) => { const t = G.clock + s; return until(() => G.clock >= t); };

  // ---------- 効果音 ----------
  let actx = null;
  function tone(f, d, type, v, at) {
    if (!actx) return;
    const t = actx.currentTime + (at || 0), o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v || 0.15, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
  }
  const SFX = {
    best() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.08)); },
    good() { tone(880, 0.16, 'triangle', 0.15); tone(1175, 0.25, 'triangle', 0.15, 0.13); },
    meh() { tone(330, 0.25, 'sine', 0.12); tone(294, 0.3, 'sine', 0.12, 0.18); },
    bad() { tone(130, 0.4, 'sawtooth', 0.14); tone(123, 0.4, 'sawtooth', 0.14, 0.02); },
    worst() { tone(98, 0.8, 'sawtooth', 0.2); tone(92, 0.8, 'square', 0.12, 0.03); tone(55, 1.0, 'sawtooth', 0.2, 0.1); },
    silent() { tone(196, 0.5, 'sine', 0.1); },
    go() { tone(1320, 0.08, 'sine', 0.08); },
    hit() { tone(1047 + Math.random() * 500, 0.12, 'triangle', 0.12); },
    card() { [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13, i * 0.1)); },
  };

  // ---------- 妻の声(読み上げ) ----------
  let jaVoice = null;
  function findVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
    jaVoice = vs.find(v => /Nanami|Kyoko|O-Ren|Haruka|Sayaka|Ayumi|Google/i.test(v.name)) || vs[0] || null;
  }
  if (window.speechSynthesis) { findVoice(); speechSynthesis.onvoiceschanged = findVoice; }
  function speak(text) {
    if (!G.tts || !window.speechSynthesis) return;
    const s = text.replace(/[（(][^）)]*[）)]/g, '').replace(/[♡…“”]/g, '').trim();
    if (!s) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(s);
      u.lang = 'ja-JP'; u.pitch = 1.3; u.rate = 1.12; if (jaVoice) u.voice = jaVoice;
      G.ttsBusy = true; G.ttsDead = G.clock + s.length * 0.22 + 2;
      u.onend = u.onerror = () => { G.ttsBusy = false; };
      speechSynthesis.speak(u);
    } catch (e) { G.ttsBusy = false; }
  }

  // ---------- 画面 ----------
  function setSmile() {
    const v = Math.round(G.smile);
    el.fill.style.width = v + '%'; el.num.textContent = v;
  }
  function addSmile(d) { G.smile = clamp(G.smile + d, 0, 100); setSmile(); }
  function pop(text, cls) {
    const p = document.createElement('div');
    p.className = 'pop ' + (cls || ''); p.textContent = text;
    p.style.left = (6 + Math.random() * 52) + '%'; p.style.top = (12 + Math.random() * 62) + '%';
    el.pops.appendChild(p); setTimeout(() => p.remove(), 1500);
  }
  function verdict(g, pts, notes) {
    const v = el.verdict; v.className = pts >= 0 ? 'plus' : 'minus';
    v.children[0].textContent = LABEL[g]; v.children[1].textContent = (pts >= 0 ? '+' : '') + Math.round(pts);
    v.children[2].textContent = notes.join(' ／ ');
  }
  async function card(title, desc, sec) {
    el.card.children[0].textContent = title; el.card.children[1].textContent = desc;
    el.card.classList.remove('hidden'); SFX.card();
    await sleep(sec || 3);
    el.card.classList.add('hidden');
  }
  async function wife(text, hold) {
    G.talk = { text, t0: G.clock };
    speak(text); Face.S.talking = true;
    await until(() => G.clock - G.talk.t0 > text.length / 16 + 0.15 && (!G.ttsBusy || G.clock > G.ttsDead));
    Face.S.talking = false; G.talk = null; wifeP.textContent = text;
    await sleep(hold != null ? hold : 0.35 + (G.tts && window.speechSynthesis ? 0 : text.length * 0.04));
  }

  // ---------- 返事を聞く ----------
  // 戻り値: text / alts / silent / delay(聞きはじめから話しだすまでの秒) / peak(声の大きさ。測れなければ null) / typed
  async function hear(limit, o) {
    o = o || {};
    if (!canVoice()) limit *= 4;
    const h = G.h = { text: '', alts: [], first: null, last: 0, final: false, open: false, t0: 0, typed: false, out: o.out || el.youText };
    h.out.textContent = ''; el.mic.textContent = '';
    Voice.listen(true);
    const w0 = G.clock;
    await until(() => Voice.st.recOn || !canVoice() || G.clock - w0 > 1.5);
    h.t0 = G.clock; h.open = true;
    if (!o.quiet) { el.mic.textContent = '🎤 どうぞ！'; SFX.go(); G.bar = { t0: G.clock, dur: limit, h }; }
    await until(() => h.final || G.skip || (h.first != null && G.clock - h.last > 1.6) || (h.first == null && G.clock - h.t0 > limit) || G.clock - h.t0 > limit + 10);
    h.open = false; G.h = null; G.bar = null; el.mic.textContent = ''; el.timer.firstElementChild.style.width = '0';
    Voice.listen(false);
    let peak = Voice.takePeak();
    const silent = !h.text.trim();
    // 声の大きさが取れない端末・マイクが音声認識をじゃまする端末を見きわめる
    if (!silent && !h.typed && Voice.st.volOK && peak != null && peak < 0.06) { peak = null; if (++G.volMiss >= 2) Voice.st.volOK = false; }
    if (silent && Voice.st.micOn && peak != null && peak > 0.6) { if (++G.recMiss >= 2) Voice.stopMic(); } else if (!silent) G.recMiss = 0;
    return { text: h.text, alts: h.alts, silent, delay: silent ? limit : Math.max(0, h.first - h.t0), peak: h.typed && !h.sim ? null : peak, typed: h.typed && !h.sim };
  }
  let evN = 0;
  function onHeard(ev) {
    if (G.rush && G.rush.on) { el.youText.textContent = ev.text; rushHeard(ev); return; }
    const h = G.h; if (!h || !h.open) return;
    h.text = ev.text; h.alts = ev.alts || []; h.out.textContent = ev.text;
    if (h.first == null) {
      // 途中経過が来ない端末では、言い終わってから結果が届く。文字数から話しはじめを逆算する
      h.first = ev.final && !ev.typed ? Math.max(h.t0, G.clock - ev.text.length * 0.13) : G.clock;
    }
    h.last = G.clock; if (ev.typed) h.typed = true; if (ev.sim) h.sim = true;
    if (ev.final) h.final = true;
  }
  Voice.on('heard', onHeard);
  Voice.on('change', () => { el.typeForm.classList.toggle('hidden', canVoice() && !DEBUG); });
  function inject(text, sim) { onHeard({ id: 't' + (++evN), text, alts: [], final: true, typed: true, sim }); }

  // ---------- 判定 ----------
  function judge(rules, r, sc) {
    if (r.silent) return { g: 'silent', say: sc.silent };
    for (const t of [r.text].concat(r.alts)) {
      const n = norm(t);
      for (const ru of rules) if (ru.re.test(n)) return { g: ru.g, say: ru.say };
    }
    return { g: 'meh', say: sc.other };
  }
  // 言葉の判定に、返事のはやさと声の大きさを足す
  function feel(res, r, sc) {
    let g = res.g, say = res.say; const notes = [];
    let pos = g === 'best' || g === 'good';
    if (pos && sc && sc.fast && !r.typed && r.delay > sc.fast) { g = 'bad'; say = sc.slowSay; pos = false; notes.push('間があいた…'); }
    let pts = C.PTS[g];
    if (!r.silent && pos && !r.typed) {
      if (r.delay < C.FAST) { pts *= 1.25; notes.push('即答！'); }
      else if (r.delay > C.SLOW) { pts *= 0.6; notes.push('返事がおそい…'); }
    }
    if (!r.silent && r.peak != null) {
      if (pos) {
        if (r.peak >= C.LOUD) { pts *= 1.25; notes.push('気持ちがこもってる！'); }
        else if (r.peak < C.QUIET) { pts *= 0.7; notes.push('声が小さい…'); }
      } else if ((g === 'bad' || g === 'worst') && r.peak >= C.LOUD) { pts *= 1.25; notes.push('大声で言った…'); }
    }
    return { g, say, pts, notes };
  }
  async function react(f) {
    verdict(f.g, f.pts, f.notes); SFX[f.g]();
    if (f.g === 'best') G.stats.best++;
    if (f.g === 'bad' || f.g === 'worst') G.stats.mine++;
    addSmile(f.pts);
    if (f.pts > 0) Face.burst('happy', f.g === 'best' ? 1.6 : 0.9); else if (f.g !== 'meh') Face.burst('angry', f.g === 'worst' ? 2 : 1.2);
    await wife(f.say, 1.1);
    el.verdict.className = 'hidden';
    if (G.smile <= 0) throw OVER;
  }

  // ---------- 第1章: 場面に声で返す ----------
  async function scene(sc, i, n) {
    el.chapter.textContent = '第1章　' + sc.when + '（' + (i + 1) + '/' + n + '）';
    el.cap.textContent = sc.cap; el.youText.textContent = '';
    await wife(sc.say);
    let r = await hear(C.LIMIT), f = feel(judge(sc.rules, r, sc), r, sc);
    // 「好き？」は、声が小さいと言いなおし
    if (sc.loud && f.pts > 0 && r.peak != null && r.peak < C.LOUD) {
      Face.burst('angry', 0.8);
      await wife('聞こえなーい！ もっと大きな声で！');
      const r2 = await hear(6);
      if (r2.silent) f = { g: 'bad', say: '……言えないんだ。もういい。', pts: C.PTS.bad, notes: ['言いなおせなかった'] };
      else if (r2.peak != null && r2.peak >= C.LOUD) f = { g: 'best', say: 'ちょっ……ご近所に聞こえるでしょ！ ……もう一回言って？', pts: C.PTS.best * 1.5, notes: ['全力で言った！'] };
      else f = { g: 'good', say: '……まあ、ゆるしてあげる。', pts: C.PTS.good, notes: ['まだ小さい…'] };
    }
    if (f.pts > 0) G.mail.push(sc.id);
    await react(f);
  }

  // ---------- 第2章: 不機嫌の原因を探る ----------
  async function mystery() {
    const m = pick(D.MYSTERIES);
    el.chapter.textContent = '第2章　不機嫌のなぞ'; el.cap.textContent = ''; wifeP.textContent = ''; el.youText.textContent = '';
    G.grump = true;
    await card('第2章　不機嫌のなぞ', '夜。なぜか妻のきげんが悪い……。\n声をかけて、原因をつきとめろ！\n（声をかけられるのは ' + C.TRIES + '回まで）', 4);
    await wife('…………おかえり。');
    let tries = 0, hint = 0, miss = 0, solved = false;
    const giveHint = async () => { if (hint < m.hints.length) { pop('ヒント', 'dim'); await wife(m.hints[hint++], 0.6); } };
    while (tries < C.TRIES) {
      el.cap.textContent = '原因を当てよう（のこり ' + (C.TRIES - tries) + '回）';
      const r = await hear(9); tries++;
      if (r.silent) { addSmile(-3); await wife(D.MYST_SILENT, 0.5); }
      else {
        const n = norm(r.text);
        if (m.cause.test(n) || r.alts.some(a => m.cause.test(norm(a)))) { solved = true; break; }
        let a = null;
        const ex = (m.extra || []).find(x => x.re.test(n));
        const mine = D.MYST_COMMON.find(x => x.mine && x.re.test(n));
        const other = D.MYSTERIES.find(x => x !== m && x.cause.test(n));
        const cat = Object.keys(D.CATS).find(k => D.CATS[k].test(n));
        if (ex) a = ex;
        else if (mine) a = mine;
        else if (other) a = { say: other.wrong, pts: -3 };
        else if (cat === m.cat) a = { say: m.warm, pts: 0, warm: true };
        else if (cat) a = { say: D.COLD[cat], pts: -2 };
        else a = D.MYST_COMMON.find(x => x.re.test(n)) || { say: pick(D.MYST_OTHER), pts: -2 };
        if (a.warm) { pop('ピクッ…！'); SFX.good(); } else if (a.mine) { G.stats.mine++; Face.burst('angry', 1.4); SFX.bad(); } else SFX.meh();
        addSmile(a.pts);
        await wife(a.say, 0.6);
        if (G.smile <= 0) throw OVER;
        if (a.hint) await giveHint();
        else if (!a.warm && ++miss % 3 === 0) await giveHint();
      }
      if (G.smile <= 0) throw OVER;
    }
    el.cap.textContent = '';
    if (!solved) {
      verdict('bad', -12, ['原因がわからなかった']); SFX.worst(); Face.burst('angry', 2); G.stats.mine++;
      addSmile(-12); await wife(m.fail, 1.2); el.verdict.className = 'hidden'; G.grump = false;
      if (G.smile <= 0) throw OVER;
      return;
    }
    const bonus = 6 + (C.TRIES - tries);
    verdict('good', bonus, ['原因をつきとめた！（' + tries + '回目）']); SFX.good(); addSmile(bonus);
    await wife(m.reveal, 0.4); el.verdict.className = 'hidden';
    // しあげの一言
    el.cap.textContent = '（しあげの ひとこと！）';
    const r = await hear(C.LIMIT), n = norm(r.text), F = D.FINISH;
    const sorry = F.sorry.test(n), act = m.action.test(n);
    let g = r.silent ? 'silent' : F.excuse.test(n) ? 'worst' : sorry && act ? 'best' : sorry ? 'good' : 'meh';
    const say = r.silent ? F.say.silent : g === 'meh' ? (act ? F.say.meh : F.say.other) : F.say[g];
    const f = feel({ g, say }, r, null);
    G.grump = false;
    if (f.pts > 0) G.mail.push(m.id);
    await react(f);
  }

  // ---------- 第3章: ほめ言葉ラッシュ ----------
  function rushHeard(ev) {
    const R = G.rush, n = norm(ev.text);
    let m = R.cur.get(ev.id); if (!m) R.cur.set(ev.id, m = {});
    for (const w of D.PRAISE.concat(D.RUSH_MINES)) {
      const c = (n.match(w.re) || []).length, p = m[w.k] || 0;
      if (c > p) { m[w.k] = c; for (let i = p; i < c; i++) rushHit(w); }
    }
  }
  function rushHit(w) {
    const R = G.rush;
    if (w.mine) { addSmile(-6); pop('は？', 'bad'); Face.burst('angry', 0.9); SFX.bad(); G.stats.mine++; return; }
    const seen = R.used[w.k] || 0; R.used[w.k] = seen + 1;
    let pts = seen ? 1 : w.p;
    const peak = Voice.takePeak();
    if (peak != null && peak >= C.LOUD) pts *= 1.5;
    if (!seen) { R.hits++; G.praise.push(w.t); }
    R.pts += pts; addSmile(pts * C.RUSH_RATE); SFX.hit();
    if (seen) pop('それ、さっき聞いた', 'dim'); else { pop('「' + w.t + '」 +' + Math.round(pts)); Face.burst('happy', 0.6); }
  }
  async function rush() {
    el.chapter.textContent = '第3章　ほめ言葉ラッシュ'; el.cap.textContent = ''; el.youText.textContent = '';
    await card('第3章　ほめ言葉ラッシュ', '寝る前。' + C.RUSH + '秒で、妻をほめまくれ！\n同じ言葉は 2回目から効かない。\nよけいな一言は、命とり。', 4);
    await wife('じゃあ最後に。わたしのいいところ、言えるだけ言ってみて。');
    for (const s of ['3', '2', '1']) { el.cap.textContent = s; tone(660, 0.12, 'sine', 0.12); await sleep(0.7); }
    const dur = canVoice() ? C.RUSH : C.RUSH * 2;
    const R = G.rush = { on: false, used: {}, cur: new Map(), hits: 0, pts: 0 };
    Voice.listen(true);
    const w0 = G.clock;
    await until(() => Voice.st.recOn || !canVoice() || G.clock - w0 > 1.5);
    R.on = true; SFX.go(); el.mic.textContent = '🎤 ほめて！';
    const t0 = G.clock; G.bar = { t0, dur, rush: true };
    await until(() => { el.cap.textContent = 'のこり ' + Math.max(0, Math.ceil(dur - (G.clock - t0))) + '秒 ／ ' + R.hits + 'こ'; return G.clock - t0 >= dur; });
    R.on = false; G.bar = null; el.mic.textContent = ''; el.timer.firstElementChild.style.width = '0';
    Voice.listen(false);
    el.cap.textContent = 'ほめ言葉 ' + R.hits + 'こ';
    const say = R.hits >= 10 ? '……もう、わかったってば♡ ……ありがと。' : R.hits >= 5 ? 'ふふ。まあまあ言えるじゃない。' : R.hits >= 1 ? '……え、それだけ？' : '…………ひとつも、ないの？';
    if (R.hits === 0) { addSmile(-10); Face.burst('angry', 1.5); SFX.worst(); } else SFX.best();
    await wife(say, 1.4);
    G.rush = null;
    if (G.smile <= 0) throw OVER;
  }

  // ---------- クリア後のメール ----------
  function buildMail(over) {
    if (over) {
      return {
        head: '妻に送る 謝罪メールが できました', sub: 'ごめんなさい',
        body: 'ごめんなさい。\n\n今日のぼくは、言ってはいけないことを言いました。\n「なんでもいい」も「ふつう」も、もう言いません。\n\nプリンを買って待っています。\n帰ってきてください。',
      };
    }
    const sceneIds = D.SCENES.map(s => s.id);
    const lines = G.mail.filter(id => sceneIds.includes(id)).map(id => D.MAIL[id]);
    const sorry = G.mail.filter(id => !sceneIds.includes(id)).map(id => D.MAIL[id]);
    let b = 'いつもありがとう。\n面と向かうとうまく言えないので、メールにします。\n\n';
    b += (lines.length ? lines.join('\n') : 'うまく言えないことばかりだけど、いつも感謝しています。') + '\n\n';
    if (G.praise.length) b += '君のいいところを、数えてみました。\n' + G.praise.slice(0, 10).map(p => '・' + p).join('\n') + '\nまだまだあるけど、続きは直接言います。\n\n';
    if (sorry.length) b += sorry.join('\n') + '\n\n';
    b += 'これからも、君を笑顔にするのがぼくの仕事です。';
    return { head: '妻に送るメールが できました', sub: 'いつもありがとう', body: b };
  }
  function mailLinks() {
    const s = encodeURIComponent(el.mailSub.value), b = encodeURIComponent(el.mailBody.value);
    el.mailSend.href = 'mailto:?subject=' + s + '&body=' + b;
    el.lineSend.href = 'https://line.me/R/share?text=' + b;
  }

  // ---------- 進行 ----------
  async function title() {
    el.title.classList.remove('hidden');
    await until(() => G.unlocked);
    el.startBtn.classList.add('hidden'); el.titleVoice.classList.remove('hidden');
    if (!canVoice()) { el.titleVoice.querySelector('.sayit').textContent = 'この端末では音声認識が使えません'; el.titleSkip.textContent = 'タップして はじめる（文字で返事）'; }
    G.skip = false;
    while (!G.skip) {
      const r = await hear(20, { out: el.titleHeard, quiet: true });
      if (/ただいま|スタート|始め|はじめ|帰った|かえった|帰りました/.test(norm(r.text))) break;
    }
    G.skip = false; el.title.classList.add('hidden');
  }
  async function play() {
    G.smile = C.START; G.stats = { best: 0, mine: 0 }; G.mail = []; G.praise = []; G.grump = false; G.rush = null;
    setSmile(); wifeP.textContent = ''; el.youText.textContent = ''; el.cap.textContent = ''; el.verdict.className = 'hidden';
    const order = ['朝', '昼', '夕方'];
    const list = D.SCENES.slice().sort(() => Math.random() - 0.5).slice(0, C.SCENES).sort((a, b) => order.indexOf(a.when) - order.indexOf(b.when));
    try {
      el.chapter.textContent = '第1章　妻のひとこと';
      await card('第1章　妻のひとこと', '妻のひとことに、声で返事をしよう。\nはやく、はっきり、気持ちをこめて。', 3.5);
      for (let i = 0; i < list.length; i++) await scene(list[i], i, list.length);
      await mystery();
      await rush();
      return false;
    } catch (e) { if (e !== OVER) throw e; return true; }
  }
  async function result(over) {
    G.grump = false; el.verdict.className = 'hidden'; el.card.classList.add('hidden'); Voice.listen(false);
    const rk = D.RANKS.find(x => Math.round(G.smile) >= x.min);
    if (over) { el.chapter.textContent = 'ゲームオーバー'; el.cap.textContent = ''; await wife(rk.say, 1.8); }
    el.rank.textContent = rk.name;
    el.rsmile.textContent = '笑顔ゲージ ' + Math.round(G.smile) + ' / 100';
    el.rstats.textContent = '大正解 ' + G.stats.best + '　地雷 ' + G.stats.mine + '　ほめ言葉 ' + G.praise.length + 'こ';
    el.rsay.textContent = '妻「' + rk.say + '」';
    const ml = buildMail(over);
    el.mailHead.textContent = ml.head; el.mailSub.value = ml.sub; el.mailBody.value = ml.body; mailLinks();
    el.result.classList.remove('hidden'); el.result.scrollTop = 0;
    if (!over) { SFX.best(); speak(rk.say); }
    G.skip = false;
    // 聞きつづけると開始音がうるさい端末があるので、声で受けつけるのは最初の30秒だけ
    const t0 = G.clock;
    while (!G.skip && canVoice() && G.clock - t0 < 30) {
      const r = await hear(10, { out: el.resultHeard, quiet: true });
      if (/もう(一|1|いっ)(回|かい)|もう一度|もういちど|リトライ|再挑戦/.test(norm(r.text))) { G.skip = true; break; }
    }
    await until(() => G.skip);
    G.skip = false; el.result.classList.add('hidden');
  }
  async function main() {
    await title();
    for (;;) { const over = await play(); await result(over); }
  }

  // ---------- 毎フレーム ----------
  let bgKey = '';
  function update(dt) {
    G.clock += dt;
    Voice.update();
    if (G.talk) wifeP.textContent = G.talk.text.slice(0, Math.floor((G.clock - G.talk.t0) * 16));
    if (G.bar) {
      const b = G.bar, started = b.h && b.h.first != null;
      if (!started) {
        const left = clamp(1 - (G.clock - b.t0) / b.dur, 0, 1);
        el.timer.firstElementChild.style.width = (left * 100) + '%';
        el.timer.classList.toggle('hot', left < 0.35);
      }
    }
    const showVol = Voice.st.volOK && (G.h || G.rush);
    el.vol.classList.toggle('hidden', !Voice.st.volOK);
    if (Voice.st.volOK) el.vol.firstElementChild.style.width = (showVol ? Voice.st.level * 100 : 0) + '%';
    let tg = (G.smile - 50) / 50;
    if (G.grump) tg = Math.min(tg, -0.55);
    Face.S.target = tg;
    Face.update(dt);
    // ページの地色も機嫌に合わせる
    const k = Math.round(Face.S.m * 10);
    if (k !== bgKey) {
      bgKey = k;
      const dark = k <= -5;
      document.body.style.setProperty('--bg', dark ? '#3a2140' : k >= 6 ? '#ffe3ec' : '#fbe6c8');
      document.body.style.setProperty('--ink', dark ? '#fff' : '#3a2218');
    }
    const ws = waits; waits = [];
    for (const w of ws) { let ok = false; try { ok = w.f(); } catch (e) { ok = true; } if (ok) w.r(); else waits.push(w); }
  }
  let last = performance.now(), lastFrame = 0;
  function frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now; lastFrame = now;
    update(dt); Face.draw();
  }
  function raf() { frame(); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  // 画面が裏にあるなどで描画が止まっても、進行だけは止めない
  setInterval(() => { if (performance.now() - lastFrame > 180) frame(); }, 60);

  // ---------- 起動 ----------
  function ttsLabel() { el.ttsBtn.textContent = '妻の声（読み上げ）: ' + (G.tts ? 'あり' : 'なし') + '　タップで切りかえ'; }
  try { G.tts = localStorage.getItem('danna_tts') !== '0'; } catch (e) { }
  ttsLabel();
  el.ttsBtn.onclick = () => { G.tts = !G.tts; try { localStorage.setItem('danna_tts', G.tts ? '1' : '0'); } catch (e) { } ttsLabel(); };
  el.startBtn.onclick = async () => {
    el.startBtn.disabled = true;
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { }
    if (window.speechSynthesis) { try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { } }
    if (actx) await Voice.startMic(actx);
    el.titleNote.textContent = !Voice.st.supported ? 'このブラウザは音声認識に対応していません。Chrome か Safari で開いてください。'
      : Voice.st.micOn ? '' : '※ この端末では声の大きさは測りません（言葉と返事のはやさで判定します）';
    el.vol.querySelector('.q').style.left = (C.QUIET * 100) + '%'; el.vol.querySelector('.l').style.left = (C.LOUD * 100) + '%';
    el.typeForm.classList.toggle('hidden', canVoice() && !DEBUG);
    G.unlocked = true;
  };
  el.titleSkip.onclick = el.retryBtn.onclick = () => { G.skip = true; };
  el.typeForm.onsubmit = (e) => { e.preventDefault(); const t = el.typeIn.value.trim(); el.typeIn.value = ''; if (t) inject(t, false); };
  el.mailSub.oninput = el.mailBody.oninput = mailLinks;
  el.mailCopy.onclick = async () => {
    const t = el.mailBody.value;
    try { await navigator.clipboard.writeText(t); } catch (e) { el.mailBody.select(); document.execCommand('copy'); }
    el.mailCopy.textContent = 'コピーしました'; setTimeout(() => { el.mailCopy.textContent = 'コピー'; }, 1500);
  };

  Face.init($('face'));
  setSmile();
  main().catch(e => console.error(e));

  // 確認用: DS.say('似合ってるよ', 0.9) で声のかわりに返事ができる(第2引数は声の大きさ 0〜1)
  // DS.step(秒) は、描画が止まっている確認用ブラウザで時間を進める
  const tick = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = r; ch.port2.postMessage(0); });
  window.DS = {
    G, C, say(text, vol) { if (vol != null) Voice.sim(vol); inject(text, true); }, skip() { G.skip = true; },
    async step(sec) { for (let t = 0; t < sec; t += 1 / 30) { update(1 / 30); await tick(); } Face.draw(); },
  };
})();
