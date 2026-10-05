// 効果音。Web Audio API で合成する（フェーズ6で足音や扉の音を足す）。
(function () {
  let ctx = null, master = null;

  // ブラウザの制限で、最初の操作のあとでないと音を出せない
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
      bgmBus = ctx.createGain();
      bgmBus.gain.value = BGM_GAIN;
      bgmBus.connect(ctx.destination);
      for (const name in BGM_VOL) loadBgm(name);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // ---------- BGM（通常 sneak / 疑念 suspect / 警戒 alert） ----------
  // 曲は tools/music.py で作る。ループの位置は js/bgm_manifest.js にある
  const MAN = window.NH_BGM_MANIFEST || {};
  const BGM_GAIN = 0.3;                                       // BGM 全体の音量
  const BGM_VOL = { sneak: 0.8, suspect: 0.9, alert: 1 };     // 曲ごとの音量
  let bgmBus = null, bgmOn = true, duckV = 1;
  let want = null;   // 鳴らしたい曲
  let cur = null;    // 鳴っている曲 { name, src, gain } か { name, el }
  const bufs = {}, loading = {};
  try { bgmOn = localStorage.getItem('nh_bgm') !== 'off'; } catch (e) { /* 保存できない環境では毎回 ON */ }

  function loadBgm(name) {
    if (loading[name]) return loading[name];
    const url = 'assets/bgm/' + name + '.mp3';
    loading[name] = fetch(url).then((r) => r.arrayBuffer())
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((b) => { bufs[name] = b; })
      // file:// で開いたときは fetch できないので、audio 要素で鳴らす（つなぎ目に少し間が空く）
      .catch(() => { const el = new Audio(url); el.loop = true; bufs[name] = el; })
      .then(() => { if (want === name && !cur) startBgm(name); });
    return loading[name];
  }

  function stopBgm(fade) {
    const c = cur;
    cur = null;
    if (!c) return;
    if (c.el) { c.el.pause(); return; }
    const t = ctx.currentTime;
    c.gain.gain.cancelScheduledValues(t);
    c.gain.gain.setValueAtTime(c.gain.gain.value, t);
    c.gain.gain.linearRampToValueAtTime(0, t + fade);
    c.src.stop(t + fade + 0.05);
  }

  function startBgm(name) {
    const b = bufs[name];
    if (!b || !bgmOn) return;
    const vol = BGM_VOL[name];
    if (b instanceof HTMLAudioElement) {
      b.currentTime = 0;
      b.volume = Math.min(1, vol * BGM_GAIN * duckV);
      b.play().catch(() => {});
      cur = { name, el: b };
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = b;
    const m = MAN[name];
    if (m && m.loopEnd) {
      src.loop = true;
      src.loopStart = m.loopStart;
      src.loopEnd = Math.min(m.loopEnd, b.duration - 0.05);
    }
    const g = ctx.createGain();
    const t = ctx.currentTime;
    // 警戒の曲は、発見の瞬間にすぐ立ち上げる
    const rise = name === 'alert' ? 0.06 : 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + rise);
    src.connect(g);
    g.connect(bgmBus);
    src.start();
    cur = { name, src, gain: g };
  }

  // 鳴らす曲を選ぶ。null で止める。毎フレーム呼んでよい
  function bgm(name) {
    want = name;
    if (!ctx || (cur && cur.name === name) || (!cur && !name)) return;
    stopBgm(name === 'alert' ? 0.15 : 0.8);
    if (name) startBgm(name);
  }

  // 無線やポーズの間、BGM を小さくする（1 で元の音量）
  function duck(v) {
    if (v === duckV) return;
    duckV = v;
    if (!ctx) return;
    bgmBus.gain.setTargetAtTime(BGM_GAIN * v, ctx.currentTime, 0.12);
    if (cur && cur.el) cur.el.volume = Math.min(1, BGM_VOL[cur.name] * BGM_GAIN * v);
  }

  function setBgmOn(v) {
    bgmOn = v;
    try { localStorage.setItem('nh_bgm', v ? 'on' : 'off'); } catch (e) { /* 保存できなくても動かす */ }
    if (!ctx) return;
    if (!v) stopBgm(0.2);
    else if (want && !cur) startBgm(want);
  }
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
    window.addEventListener(ev, unlock, { passive: true });
  }

  // 1音。f1 を指定すると、鳴っている間に高さが f0 から f1 へ動く
  function tone(type, f0, f1, start, dur, vol) {
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    // 発見の「！」：鋭い立ち上がりと、濁った和音の余韻
    alert() {
      tone('sawtooth', 520, 1480, 0, 0.07, 0.5);
      tone('square', 1480, 0, 0.06, 0.55, 0.32);
      tone('square', 1976, 0, 0.06, 0.55, 0.22);
      tone('square', 1397, 0, 0.06, 0.45, 0.18);
      tone('sine', 120, 60, 0, 0.3, 0.7);
    },
    // 疑念の「？」
    suspect() {
      tone('sine', 620, 0, 0, 0.09, 0.35);
      tone('sine', 880, 0, 0.11, 0.16, 0.35);
    },
    // 壁を叩く
    knock() {
      tone('triangle', 240, 110, 0, 0.07, 0.8);
      tone('square', 520, 260, 0, 0.03, 0.2);
      tone('triangle', 240, 110, 0.15, 0.07, 0.8);
      tone('square', 520, 260, 0.15, 0.03, 0.2);
    },
    // 気絶させる
    ko() {
      tone('sine', 170, 50, 0, 0.22, 0.9);
      tone('square', 110, 60, 0, 0.06, 0.3);
    },
    // 金属床の足音
    stepMetal() {
      tone('square', 1250, 820, 0, 0.035, 0.16);
      tone('triangle', 330, 240, 0, 0.07, 0.4);
    },
    // 水たまりの足音
    stepWater() {
      tone('sine', 620, 240, 0, 0.09, 0.35);
      tone('triangle', 1400, 500, 0.02, 0.05, 0.12);
    },
    // ふつうの床の足音（敵には聞こえない、小さな音）
    step() {
      tone('triangle', 150, 90, 0, 0.035, 0.12);
    },
    // 無線：呼び出し、文字送り、終了
    radioOpen() {
      tone('square', 1175, 0, 0, 0.06, 0.2);
      tone('square', 1568, 0, 0.09, 0.06, 0.2);
      tone('square', 1175, 0, 0.18, 0.06, 0.2);
      tone('square', 1568, 0, 0.27, 0.1, 0.2);
    },
    radioBlip() {
      tone('square', 880, 0, 0, 0.018, 0.06);
    },
    radioClose() {
      tone('square', 1568, 784, 0, 0.12, 0.18);
    },
    // 被弾
    hurt() {
      tone('sawtooth', 300, 90, 0, 0.16, 0.5);
      tone('square', 160, 70, 0, 0.12, 0.3);
    },
    // 敵の銃声
    shot() {
      tone('square', 900, 120, 0, 0.09, 0.28);
      tone('sawtooth', 200, 60, 0, 0.12, 0.35);
    },
    // 麻酔銃（消音）
    dart() {
      tone('sine', 1500, 400, 0, 0.06, 0.25);
      tone('triangle', 260, 120, 0, 0.05, 0.25);
    },
    // 麻酔弾が壁に当たった
    ricochet() {
      tone('square', 2400, 1400, 0, 0.04, 0.12);
    },
    // 弾切れ
    empty() {
      tone('square', 180, 0, 0, 0.03, 0.25);
    },
    // アイテムを拾った
    pickup() {
      tone('square', 988, 0, 0, 0.07, 0.2);
      tone('square', 1319, 0, 0.07, 0.12, 0.2);
    },
    // 段ボール箱をかぶる・脱ぐ
    box() {
      tone('triangle', 200, 120, 0, 0.08, 0.5);
    },
    // 扉
    doorOpen() {
      tone('sawtooth', 140, 260, 0, 0.22, 0.12);
      tone('sine', 880, 0, 0, 0.05, 0.2);
    },
    doorClose() {
      tone('sawtooth', 260, 130, 0, 0.2, 0.12);
      tone('triangle', 110, 70, 0.18, 0.08, 0.4);
    },
    // カードキーが足りない
    locked() {
      tone('square', 220, 0, 0, 0.12, 0.25);
      tone('square', 180, 0, 0.14, 0.18, 0.25);
    },
    // ゲームオーバー
    gameover() {
      tone('sawtooth', 330, 80, 0, 1.2, 0.4);
      tone('square', 220, 55, 0.1, 1.2, 0.25);
    },
    // ステージクリア
    clear() {
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, 0, i * 0.11, 0.2, 0.22));
    },
    // 捕まった
    caught() {
      tone('sawtooth', 320, 70, 0, 0.6, 0.45);
      tone('sine', 90, 40, 0, 0.7, 0.7);
    }
  };

  NH.Audio = {
    unlock,
    bgm,
    duck,
    setBgmOn,
    get bgmOn() { return bgmOn; },
    get bgmName() { return cur ? cur.name : null; }, // いま鳴っている曲（確認用）
    play(name) {
      if (!ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
      SOUNDS[name]();
    }
  };
})();
