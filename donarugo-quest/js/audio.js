// ドナルゴクエスト 音まわり(BGM のループ再生と、効果音のシンセ)
window.AudioSys = (function () {
  'use strict';
  let ctx = null, master, bgmBus, sfxBus, noiseBuf;
  const bufs = {}, loading = {};
  let cur = null, token = 0, bgmVol = 0.45, duckV = 1;
  const MAN = window.BGM_MANIFEST || {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    bgmBus = ctx.createGain(); bgmBus.gain.value = bgmVol * 0.5; bgmBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function load(name) {
    if (bufs[name]) return Promise.resolve(bufs[name]);
    if (loading[name]) return loading[name];
    loading[name] = fetch('assets/bgm/' + name + '.mp3').then(r => r.arrayBuffer())
      .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then(b => (bufs[name] = b)).catch(() => null);
    return loading[name];
  }
  function preload(names) { if (ctx) names.forEach(load); }

  function stopBgm(fade = 0.4) {
    token++;
    if (!cur) return;
    const c = cur; cur = null;
    const t = ctx.currentTime;
    c.g.gain.cancelScheduledValues(t); c.g.gain.setValueAtTime(c.g.gain.value, t); c.g.gain.linearRampToValueAtTime(0, t + fade);
    try { c.src.stop(t + fade + 0.05); } catch (e) { }
  }
  async function playBgm(name, fade = 0.4, vol = 1) {
    if (!ctx) return;
    if (cur && cur.name === name) return;
    stopBgm(fade);
    const my = token;
    const b = await load(name);
    if (!b || my !== token) return;
    const src = ctx.createBufferSource(); src.buffer = b;
    const m = MAN[name] || {};
    if (m.loopEnd) { src.loop = true; src.loopStart = m.loopStart; src.loopEnd = Math.min(m.loopEnd, b.duration - 0.05); }
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(bgmBus);
    src.start();
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.25);
    cur = { name, src, g };
  }
  async function jingle(name, vol = 1) {
    if (!ctx) return 0;
    const b = await load(name);
    if (!b) return 0;
    const src = ctx.createBufferSource(); src.buffer = b;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(bgmBus); src.start();
    return b.duration;
  }
  function applyBgm(t = 0.2) { if (ctx) bgmBus.gain.linearRampToValueAtTime(bgmVol * 0.5 * duckV, ctx.currentTime + t); }
  function setBgmVol(v) { bgmVol = v; applyBgm(); }
  function duck(v, t = 0.2) { duckV = v; applyBgm(t); }
  function setSfxVol(v) { if (ctx) sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }

  // ---------- シンセ効果音 ----------
  function tone(f0, dur, o = {}) {
    const t = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f0, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const v = o.vol == null ? 0.25 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.atk || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, o = {}) {
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain(); const v = o.vol == null ? 0.35 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.atk || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
  const SFX = {
    cursor() { tone(880, 0.06, { vol: 0.14 }); },
    tick() { tone(1320, 0.03, { vol: 0.06 }); },
    cast() { [660, 880, 1100, 1320, 1100, 1320, 1650].forEach((f, i) => tone(f, 0.06, { at: i * 0.045, vol: 0.13 })); },
    miss() { tone(220, 0.16, { to: 110, vol: 0.2 }); },
    fire() { noise(0.7, { f0: 300, f1: 2600, vol: 0.5, atk: 0.05 }); tone(110, 0.6, { type: 'sawtooth', to: 50, vol: 0.25 }); noise(0.4, { at: 0.25, type: 'bandpass', f0: 900, f1: 300, vol: 0.3 }); },
    ice() { [2400, 3100, 3800, 2900, 4300].forEach((f, i) => tone(f, 0.22, { type: 'sine', at: i * 0.05, vol: 0.14 })); noise(0.35, { type: 'highpass', f0: 5000, vol: 0.28 }); tone(1800, 0.3, { type: 'triangle', at: 0.2, to: 600, vol: 0.15 }); },
    thunder() { noise(0.12, { type: 'highpass', f0: 2500, vol: 0.6 }); noise(0.9, { at: 0.05, f0: 1800, f1: 120, vol: 0.6 }); tone(90, 0.8, { type: 'sine', at: 0.05, to: 35, vol: 0.5 }); },
    heal() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'sine', at: i * 0.08, vol: 0.16 })); },
    hit() { noise(0.14, { type: 'bandpass', f0: 1200, vol: 0.4 }); tone(240, 0.14, { to: 80, vol: 0.2 }); },
    crit() { noise(0.1, { type: 'highpass', f0: 3000, vol: 0.55 }); tone(1760, 0.5, { type: 'sine', vol: 0.2 }); noise(0.3, { at: 0.08, type: 'bandpass', f0: 800, vol: 0.55 }); tone(160, 0.35, { at: 0.08, to: 50, vol: 0.4 }); },
    enemyAtk() { noise(0.22, { f0: 700, f1: 120, vol: 0.6 }); tone(140, 0.25, { type: 'sawtooth', to: 45, vol: 0.4 }); },
    hurt() { tone(330, 0.1, { vol: 0.2 }); tone(220, 0.14, { at: 0.09, vol: 0.2 }); tone(147, 0.2, { at: 0.2, vol: 0.2 }); },
    destroy() { tone(60, 0.5, { type: 'sawtooth', to: 240, vol: 0.3 }); noise(1.5, { at: 0.45, f0: 3200, f1: 70, vol: 0.8 }); tone(70, 1.3, { type: 'sine', at: 0.45, to: 28, vol: 0.7 }); },
    ultimate() { tone(80, 1.2, { type: 'sawtooth', to: 1400, vol: 0.28 }); noise(1.2, { type: 'bandpass', f0: 300, f1: 5000, vol: 0.3, atk: 0.8 });
      noise(2.4, { at: 1.2, f0: 5000, f1: 50, vol: 0.9 }); tone(60, 2.2, { type: 'sine', at: 1.2, to: 22, vol: 0.8 }); [0, 0.3, 0.55, 0.85].forEach(d => noise(0.5, { at: 1.5 + d, type: 'bandpass', f0: 500, vol: 0.5 })); },
    shout() { tone(440, 0.16, { type: 'sawtooth', vol: 0.25 }); tone(660, 0.16, { type: 'sawtooth', at: 0.14, vol: 0.25 }); tone(880, 0.4, { type: 'sawtooth', at: 0.28, vol: 0.28 }); },
    shoutEnd() { noise(1.3, { f0: 4000, f1: 80, vol: 0.8 }); tone(90, 1.2, { type: 'sine', to: 30, vol: 0.6 }); },
    wake() { tone(55, 1.8, { type: 'sawtooth', to: 38, vol: 0.5, atk: 0.3 }); noise(1.8, { f0: 200, f1: 900, vol: 0.5, atk: 0.6 }); tone(41, 2.2, { type: 'square', at: 0.4, to: 30, vol: 0.3 }); },
    die() { noise(0.9, { type: 'bandpass', f0: 2400, f1: 200, vol: 0.4 }); tone(600, 0.8, { to: 60, vol: 0.18 }); },
    appear() { tone(700, 0.25, { to: 160, vol: 0.18 }); },
    morph() { tone(120, 1.2, { type: 'sawtooth', to: 900, vol: 0.25 }); noise(1.2, { type: 'bandpass', f0: 400, f1: 3000, vol: 0.3 }); },
    call() { tone(300, 0.1, { vol: 0.18 }); tone(450, 0.1, { at: 0.1, vol: 0.18 }); tone(300, 0.1, { at: 0.2, vol: 0.18 }); },
    chip() { noise(0.1, { type: 'bandpass', f0: 1800, vol: 0.18 }); tone(500, 0.1, { to: 250, vol: 0.1 }); },
    word() { tone(990, 0.09, { vol: 0.16 }); tone(1485, 0.12, { at: 0.07, vol: 0.14 }); },
    stage() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, { at: i * 0.11, vol: 0.16 })); },
  };
  function sfx(name) { if (!ctx || !SFX[name]) return; try { SFX[name](); } catch (e) { } }

  return { init, get ctx() { return ctx; }, playBgm, stopBgm, jingle, preload, setBgmVol, duck, setSfxVol, sfx, current: () => cur && cur.name };
})();
