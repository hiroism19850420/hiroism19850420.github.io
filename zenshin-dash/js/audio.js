// 音（第26〜28部・付録H・O・AQ）。曲も 効果音も その場で 作る。声だけ mp3
import { CFG } from './config.js';
import { SONGS } from './songs.js';
import { clamp, lerp } from './util.js';

const A = CFG.audio;
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) { const m = /^([A-G])(#|b)?(-?\d)$/.exec(name); if (!m) return null; return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12; }
const freq = n => 440 * Math.pow(2, (n - 69) / 12);
const CHORD = { '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11], '9': [0, 4, 7, 10, 14], 'm7b5': [0, 3, 6, 10], 'sus4': [0, 5, 7] };
function chordOf(name) { const m = /^([A-G])(#|b)?(.*)$/.exec(name); const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return { root: (root + 12) % 12, tones: CHORD[m[3]] || CHORD[''] }; }
// 'E5:2 G5:2' → [{ step, midi, len }]
function parseLine(str) {
  const out = []; let step = 0;
  for (const tok of str.trim().split(/\s+/)) { const [n, l] = tok.split(':'); const len = Number(l); if (n !== 'r') out.push({ step, midi: midi(n), len }); step += len; }
  return { notes: out, total: step };
}
function parseBass(str) {
  const out = []; let step = 0;
  for (const tok of str.trim().split(/\s+/)) { const [n, l] = tok.split(':'); const len = Number(l); if (n !== 'r') out.push({ step, kind: n, len }); step += len; }
  return out;
}
// 曲の データの 確かめ
export function checkSongs() {
  const bad = [];
  for (const [id, S] of Object.entries(SONGS)) {
    S.melody.forEach((m, i) => { const p = parseLine(m); if (p.total !== 16) bad.push(`${id} bar ${i + 1}: ${p.total}`); if (p.notes.some(n => n.midi == null)) bad.push(`${id} bar ${i + 1}: note`); });
    if (S.bass) { const t = S.bass.trim().split(/\s+/).reduce((a, x) => a + Number(x.split(':')[1]), 0); if (t !== 16) bad.push(`${id} bass ${t}`); }
    if (S.chords.length !== S.melody.length) bad.push(`${id} chords ${S.chords.length} vs ${S.melody.length}`);
  }
  return bad;
}
// 擬音の 効果音の 大きさ（第26部 26.5）
const BIG = new Set(['zudon', 'dogo', 'dodon', 'gogogo', 'goo']);

export const Audio = {
  ctx: null, on: false, muted: false, vol: { bgm: 6, sfx: 8 }, voiceOn: true,
  init() {
    if (this.ctx || this.muted) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { console.warn('no audio', e); return; }
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 4; this.comp.attack.value = 0.005; this.comp.release.value = 0.2;
    this.master = c.createGain(); this.master.gain.value = A.MASTER;
    this.master.connect(this.comp).connect(c.destination);
    const bus = g => { const n = c.createGain(); n.gain.value = g; n.connect(this.master); return n; };
    this.musicBus = bus(A.MUSIC * this.vol.bgm / 10); this.sfxBus = bus(A.SFX * this.vol.sfx / 10); this.ambBus = bus(A.AMB * this.vol.sfx / 10); this.voiceBus = bus(A.VOICE);
    this.duckGain = c.createGain(); this.duckGain.gain.value = 1; this.duckGain.connect(this.musicBus);
    this.punchGain = c.createGain(); this.punchGain.gain.value = 1;          // 大きな 効果音の とき 曲を 一瞬 下げる
    this.duckGain.disconnect(); this.duckGain.connect(this.punchGain).connect(this.musicBus);
    // 残響
    this.rev = c.createConvolver(); this.rev.buffer = this.makeIR(1.8);
    this.revRet = c.createGain(); this.revRet.gain.value = A.REVERB;
    this.rev.connect(this.revRet).connect(this.master);
    this.sfxRev = c.createGain(); this.sfxRev.gain.value = 0.25; this.sfxBus.connect(this.sfxRev); this.sfxRev.connect(this.rev);
    this.musRev = c.createGain(); this.musRev.gain.value = A.MUSIC_REVERB; this.duckGain.connect(this.musRev); this.musRev.connect(this.rev);
    // ノイズ
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, len, c.sampleRate); const bd = this.brown.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    // 矩形波 25%
    const N = 32, re = new Float32Array(N), im = new Float32Array(N);
    for (let k = 1; k < N; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    this.pulse = c.createPeriodicWave(re, im);
    this.on = true;
    this.buildLoops();
    this.startScheduler();
  },
  unlock() {
    if (!this.ctx) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!this.silent) {
      try {
        // 無音の 短い wav を くり返す（iPhone の 消音スイッチ 対策）
        const a = new window.Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
        a.loop = true; a.volume = 0.01; a.play().catch(() => {}); this.silent = a;
      } catch (e) {}
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  },
  setVolumes(bgm, sfx) {
    this.vol.bgm = bgm; this.vol.sfx = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(A.MUSIC * bgm / 10, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(A.SFX * sfx / 10, t, 0.05);
    this.ambBus.gain.setTargetAtTime(A.AMB * sfx / 10, t, 0.05);
  },
  makeIR(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (i < 100 ? i / 100 : 1); } }
    return b;
  },
  setTunnel(on) { if (!this.ctx) return; this.revRet.gain.setTargetAtTime(on ? A.REVERB_TUNNEL : A.REVERB, this.ctx.currentTime, 0.2); },
  get now() { return this.ctx ? this.ctx.currentTime : 0; },
  get running() { return this.on && this.ctx && this.ctx.state === 'running'; },

  // ---------- 小さな 道具 ----------
  osc(type, f, t0) { const o = this.ctx.createOscillator(); if (type === 'pulse') o.setPeriodicWave(this.pulse); else o.type = type; o.frequency.setValueAtTime(f, t0); o.start(t0); return o; },
  env(t0, peak, a, dur) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0005, t0 + a + dur); return g; },
  filt(type, f, q = 0.7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
  noiseSrc(t0, len, buf = this.noise) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.start(t0, Math.random() * 1.5); s.stop(t0 + len + 0.1); return s; },
  noiseBurst(t0, dur, vol, type, f, out, q = 0.7) {
    const s = this.noiseSrc(t0, dur), fl = this.filt(type, f, q), g = this.env(t0, vol, 0.002, dur);
    s.connect(fl).connect(g).connect(out);
  },
  tone(f, t0, dur, vol, out, type = 'sine') { const o = this.osc(type, f, t0), g = this.env(t0, vol, 0.004, dur); o.connect(g).connect(out); o.stop(t0 + dur + 0.1); },
  sweepTone(type, f0, f1, t0, dur, vol, out) { const o = this.osc(type, f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur); const g = this.env(t0, vol, 0.005, dur); o.connect(g).connect(out); o.stop(t0 + dur + 0.1); },
  sweepNoise(t0, dur, f0, f1, vol, out, type = 'bandpass') {
    const s = this.noiseSrc(t0, dur);
    const fl = this.filt(type, f0, 1.2); fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    s.connect(fl).connect(g).connect(out);
  },
  bell(f, t0, vol, out) {
    for (const [m, a, d] of [[1, 1, 0.6], [2.76, 0.4, 0.3], [5.4, 0.2, 0.15]]) { const o = this.osc('sine', f * m, t0), g = this.ctx.createGain(); g.gain.setValueAtTime(vol * a, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + d); o.connect(g).connect(out); o.stop(t0 + d + 0.05); }
  },
  // ランダムに 切った ノイズ（紙が やぶれる、パチパチ）
  crackle(t0, dur, vol, out, f = 3000, rate = 60) {
    const n = Math.floor(dur * rate);
    for (let i = 0; i < n; i++) {
      const tt = t0 + (i + Math.random() * 0.6) / rate, len = 0.004 + Math.random() * 0.012;
      this.noiseBurst(tt, len, vol * (0.4 + Math.random() * 0.6) * (1 - i / n * 0.6), 'highpass', f * (0.7 + Math.random() * 0.6), out);
    }
  },
  // FM の 金属音（鐘、刀、頭の ゴチン）
  fm(fc, ratio, index, t0, dur, vol, out, fc1 = null) {
    const car = this.osc('sine', fc, t0), mod = this.osc('sine', fc * ratio, t0), mg = this.ctx.createGain();
    mg.gain.setValueAtTime(fc * index, t0); mg.gain.exponentialRampToValueAtTime(fc * index * 0.05, t0 + dur);
    if (fc1) car.frequency.exponentialRampToValueAtTime(fc1, t0 + dur);
    mod.connect(mg).connect(car.frequency);
    const g = this.env(t0, vol, 0.002, dur); car.connect(g).connect(out);
    car.stop(t0 + dur + 0.1); mod.stop(t0 + dur + 0.1);
  },
  // ゆれながら 下がる 音（ボヨン）
  wobble(f0, f1, wobHz, depth, t0, dur, vol, out, type = 'sine') {
    const o = this.osc(type, f0, t0), lfo = this.osc('sine', wobHz, t0), lg = this.ctx.createGain();
    lg.gain.setValueAtTime(f0 * depth, t0); lg.gain.linearRampToValueAtTime(0, t0 + dur);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    lfo.connect(lg).connect(o.frequency);
    const g = this.env(t0, vol, 0.005, dur); o.connect(g).connect(out);
    o.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
  },
  // こまかく 刻む ノイズ（砂を すべる）
  grain(t0, dur, rate, f, vol, out) {
    const n = Math.floor(dur * rate);
    for (let i = 0; i < n; i++) this.noiseBurst(t0 + i / rate, 1 / rate * 0.8, vol * (1 - i / n), 'bandpass', f * (0.8 + Math.random() * 0.4), out, 1.2);
  },
  // 地鳴り（低い ノイズ ＋ ゆれる サイン波）
  rumble(t0, dur, vol, out, f = 120, tremHz = 6) {
    const src = this.noiseSrc(t0, dur + 0.2), lp = this.filt('lowpass', f, 0.9), g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.7); g.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(lp).connect(g).connect(out);
    const s = this.osc('sine', 40, t0), tg = this.ctx.createGain(), trem = this.osc('sine', tremHz, t0), tdep = this.ctx.createGain();
    tg.gain.setValueAtTime(vol * 0.6, t0); tdep.gain.setValueAtTime(vol * 0.4, t0);
    trem.connect(tdep).connect(tg.gain); s.connect(tg).connect(g);
    s.stop(t0 + dur + 0.1); trem.stop(t0 + dur + 0.1);
  },
  // 左右に ふる 出口
  panned(pan, out) { if (!this.ctx.createStereoPanner) return out; const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(out); return p; },
  drum(name, t0, vel, out) {
    switch (name) {
      case 'kick': { const o = this.osc('sine', 150, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12); const g = this.env(t0, vel, 0.001, 0.35); o.connect(g).connect(out); o.stop(t0 + 0.45); this.noiseBurst(t0, 0.004, vel * 0.3, 'highpass', 3000, out); break; }
      case 'snare': this.noiseBurst(t0, 0.15, vel * 0.8, 'bandpass', 1800, out, 0.8); this.tone(180, t0, 0.08, vel * 0.5, out); break;
      case 'clap': [0, 0.01, 0.02].forEach((d, i) => this.noiseBurst(t0 + d, i < 2 ? 0.012 : 0.12, vel * 0.8, 'bandpass', 1200, out, 1.2)); break;
      case 'hat': this.noiseBurst(t0, 0.04, vel * 0.6, 'highpass', 7000, out); break;
      case 'openhat': this.noiseBurst(t0, 0.2, vel * 0.5, 'highpass', 7000, out); break;
      case 'shaker': this.noiseBurst(t0, 0.06, vel * 0.4, 'bandpass', 5000, out, 2); break;
      case 'sleigh': [0, 0.02, 0.04].forEach(d => this.noiseBurst(t0 + d, 0.03, vel * 0.35, 'highpass', 6000, out)); this.tone(4200, t0, 0.05, vel * 0.08, out); this.tone(5600, t0, 0.05, vel * 0.06, out); break;
      case 'conga': case 'congaHi': { const f = name === 'congaHi' ? 330 : 220; const o = this.osc('sine', f * 1.3, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.04); o.connect(this.env(t0, vel * 0.7, 0.002, 0.18)).connect(out); o.stop(t0 + 0.25); break; }
      case 'timpani': this.tone(98, t0, 1.0, vel * 0.9, out); this.noiseBurst(t0, 0.3, vel * 0.3, 'lowpass', 300, out); break;
      case 'crash': this.noiseBurst(t0, 1.2, vel * 0.5, 'highpass', 4000, out); break;
      case 'crashSoft': this.noiseBurst(t0, 0.9, vel * 0.25, 'highpass', 4500, out); break;
    }
  },
  // 楽器の 1音
  voice(inst, f, t0, dur, vel, out) {
    const c = this.ctx;
    if (inst === 'bell+saw') { this.voice('bell', f, t0, dur, vel, out); this.voice('saw', f, t0, dur, vel * 0.5, out); return; }
    if (inst === 'bell') { this.bell(f, t0, vel * 0.5, out); return; }
    const ENV = { square: [0.005, 0.08, 0.6, 0.08, 0.22], pluck: [0.002, 0.2, 0, 0.05, 0.35], steel: [0.002, 0.35, 0, 0.1, 0.5], saw: [0.01, 0.2, 0.7, 0.12, 0.16], brass: [0.03, 0.1, 0.8, 0.15, 0.18], pad: [0.08, 0.3, 0.6, 0.4, 0.08], organ: [0.005, 0.05, 0.5, 0.04, 0.12], ep: [0.005, 0.6, 0.3, 0.3, 0.3], bass: [0.004, 0.15, 0.5, 0.06, 0.45], slap: [0.002, 0.12, 0.3, 0.05, 0.5] }[inst] || [0.01, 0.1, 0.5, 0.1, 0.2];
    const [a, d, s, r, vv] = ENV;
    const g = c.createGain(); const peak = vel * vv;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.setTargetAtTime(peak * s, t0 + a, d / 3);
    const tOff = t0 + Math.max(dur, a + 0.01); g.gain.setTargetAtTime(0, tOff, r / 3);
    const srcs = [];
    switch (inst) {
      case 'square': { const o = this.osc('pulse', f, t0); const lfo = this.osc('sine', 5.5, t0), lg = c.createGain(); lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * 0.0035, t0 + 0.2); lfo.connect(lg).connect(o.frequency); srcs.push(o, lfo); o.connect(this.filt('lowpass', 3500)).connect(g); break; }
      case 'pluck': { const o1 = this.osc('triangle', f, t0), o2 = this.osc('sawtooth', f, t0), g2 = c.createGain(); g2.gain.value = 0.25; const lp = this.filt('lowpass', 2400); lp.frequency.setValueAtTime(2400, t0); lp.frequency.exponentialRampToValueAtTime(900, t0 + 0.15); o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(g); srcs.push(o1, o2); break; }
      case 'steel': for (const [m, am] of [[1, 1], [2.0, 0.5], [3.01, 0.25]]) { const o = this.osc('sine', f * m * 1.06, t0); o.frequency.exponentialRampToValueAtTime(f * m, t0 + 0.02); const ga = c.createGain(); ga.gain.value = am; o.connect(ga).connect(g); srcs.push(o); } break;
      case 'saw': case 'brass': case 'pad': {
        const det = inst === 'pad' ? [-8, 0, 8] : inst === 'brass' ? [-5, 5] : [-7, 7];
        const lp = this.filt('lowpass', 1400, 0.8);
        if (inst !== 'pad') { const [f0, f1, tt] = inst === 'brass' ? [600, 2600, 0.05] : [1200, 3200, 0.2]; lp.frequency.setValueAtTime(f0, t0); lp.frequency.linearRampToValueAtTime(f1, t0 + tt); }
        for (const cents of det) { const o = this.osc('sawtooth', f, t0); o.detune.value = cents; o.connect(lp); srcs.push(o); }
        lp.connect(g); break;
      }
      case 'organ': { const o1 = this.osc('square', f, t0), o2 = this.osc('sine', f * 2, t0), lp = this.filt('lowpass', 2200); o1.connect(lp); o2.connect(lp); lp.connect(g); srcs.push(o1, o2); break; }
      case 'ep': { const o1 = this.osc('sine', f, t0), o2 = this.osc('sine', f * 2, t0), g2 = c.createGain(); g2.gain.setValueAtTime(0.3, t0); g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4); o2.connect(g2).connect(g); const trem = c.createGain(); trem.gain.value = 1; const lfo = this.osc('sine', 4.5, t0), lg = c.createGain(); lg.gain.value = 0.15; lfo.connect(lg).connect(trem.gain); o1.connect(trem).connect(g); srcs.push(o1, o2, lfo); break; }
      case 'bass': case 'slap': { const o = this.osc('sawtooth', f, t0), lp = this.filt('lowpass', 900, 1.2); const [h, l, tt] = inst === 'slap' ? [2400, 400, 0.08] : [900, 300, 0.12]; lp.frequency.setValueAtTime(h, t0); lp.frequency.exponentialRampToValueAtTime(l, t0 + tt); o.connect(lp).connect(g); srcs.push(o); break; }
      default: { const o = this.osc('triangle', f, t0); o.connect(g); srcs.push(o); }
    }
    g.connect(out);
    const stopAt = tOff + r * 2 + 0.05;
    srcs.forEach(o => o.stop(stopAt));
  },

  // ---------- 効果音（付録O） ----------
  lastPlay: {},
  // o：{ v（大きさの 倍率）, pan, delay, k, surf, gap }
  play(name, o = {}) {
    if (!this.running) return;
    const t = this.ctx.currentTime + 0.01 + (o.delay || 0);
    const gap = name === 'step' || name === 'rivalStep' ? 0.02 : A.SAME_SFX_GAP;
    if (this.lastPlay[name] && t - this.lastPlay[name] < gap) return;
    this.lastPlay[name] = t;
    let out = this.sfxBus;
    if (o.pan != null && name !== 'shuba') out = this.panned(o.pan, out);
    const v = o.v ?? o.vol ?? 1;
    const T = this;
    if (BIG.has(name)) { this.punchGain.gain.setTargetAtTime(0.7, t, 0.01); this.punchGain.gain.setTargetAtTime(1, t + 0.1, 0.08); }
    switch (name) {
      // ---- 擬音に 合わせた 効果音（O.2） ----
      case 'don':     T.sweepTone('sine', 120, 40, t, 0.22, 0.9 * v, out); T.noiseBurst(t, 0.06, 0.35 * v, 'lowpass', 1500, out); break;
      case 'zudon':   T.sweepTone('sine', 120, 40, t, 0.25, 0.9 * v, out); T.sweepTone('sine', 80, 30, t + 0.03, 0.4, 0.8 * v, out);
                      T.noiseBurst(t, 0.4, 0.45 * v, 'lowpass', 900, out); T.sweepNoise(t + 0.05, 0.35, 600, 2500, 0.25 * v, out); break;
      case 'zuba':    T.sweepNoise(t, 0.28, 400, 3200, 0.55 * v, out); T.noiseBurst(t + 0.18, 0.08, 0.3 * v, 'highpass', 4000, out); T.drum('kick', t, 0.35 * v, out); break;
      case 'zuza':    T.grain(t, 0.38, 30, 900, 0.45 * v, out); T.noiseBurst(t, 0.3, 0.15 * v, 'highpass', 2500, out); break;
      case 'shuba':   T.sweepNoise(t, 0.12, 1500, 5000, 0.5 * v, T.panned(-0.5, out)); T.sweepNoise(t + 0.06, 0.12, 1800, 6000, 0.45 * v, T.panned(0.5, out)); break;
      case 'bari':    T.crackle(t, 0.32, 0.55 * v, out, 3000, 70); T.noiseBurst(t + 0.28, 0.05, 0.4 * v, 'highpass', 5000, out); break;
      case 'bashi':   T.noiseBurst(t, 0.04, 0.7 * v, 'highpass', 2000, out); T.tone(900, t, 0.08, 0.3 * v, out, 'triangle'); T.sweepTone('sine', 420, 220, t + 0.02, 0.12, 0.35 * v, out); break;
      case 'gatsun':  T.tone(180, t, 0.12, 0.6 * v, out, 'triangle'); T.noiseBurst(t, 0.02, 0.5 * v, 'bandpass', 3000, out); T.sweepTone('sine', 110, 50, t, 0.2, 0.5 * v, out); break;
      case 'gochin':  T.fm(1100, 1.41, 2.5, t, 0.4, 0.45 * v, out); T.bell(2637, t + 0.02, 0.18 * v, out); break;
      case 'dogo':    T.sweepTone('sine', 90, 35, t, 0.38, 1.0 * v, out); T.noiseBurst(t, 0.18, 0.55 * v, 'lowpass', 1200, out); T.rumble(t + 0.05, 0.45, 0.3 * v, out, 90, 9); break;
      case 'bofu':    T.noiseBurst(t, 0.18, 0.55 * v, 'lowpass', 600, out); T.sweepTone('sine', 200, 120, t, 0.12, 0.3 * v, out); break;
      case 'boyon':   T.wobble(320, 160, 9, 0.18, t, 0.45, 0.5 * v, out); T.tone(640, t, 0.05, 0.15 * v, out, 'triangle'); break;
      case 'gyun': {
        const os = T.osc('sawtooth', 300, t), f = T.filt('lowpass', 1800, 4), g = T.env(t, 0.32 * v, 0.02, 0.38);
        os.frequency.exponentialRampToValueAtTime(900, t + 0.15); os.frequency.exponentialRampToValueAtTime(500, t + 0.38);
        os.connect(f).connect(g).connect(out); os.stop(t + 0.5);
        T.sweepNoise(t, 0.35, 800, 4000, 0.3 * v, out); break;
      }
      case 'zute':    T.sweepTone('sine', 140, 70, t, 0.1, 0.6 * v, out); T.sweepTone('sine', 100, 50, t + 0.09, 0.14, 0.55 * v, out); T.noiseBurst(t + 0.05, 0.15, 0.25 * v, 'bandpass', 1200, out); break;
      case 'suka':    T.sweepNoise(t, 0.09, 2500, 7000, 0.45 * v, out, 'highpass'); T.sweepTone('sine', 1800, 2600, t + 0.02, 0.08, 0.12 * v, out); break;
      case 'hyoi':    T.sweepTone('sine', 600, 1400, t, 0.12, 0.35 * v, out); T.bell(2093, t + 0.08, 0.2 * v, out); break;
      case 'gira':    T.fm(2400, 3.5, 1.5, t, 0.3, 0.25 * v, out); T.tone(110, t, 0.3, 0.12 * v, out, 'sawtooth'); break;
      case 'gogogo':  T.rumble(t, 1.6, 0.55 * v, out, 120, 6); break;
      case 'goo':     T.sweepNoise(t, 1.0, 400, 1200, 0.45 * v, out, 'lowpass'); T.rumble(t, 1.0, 0.25 * v, out, 200, 11); break;
      case 'dododo':  for (let i = 0; i < 5; i++) T.drum('kick', t + i * (o.gap || 0.11), 0.3 * v, out); break;
      case 'dodon':   T.drum('kick', t, 0.9 * v, out); T.drum('kick', t + 0.18, 1.0 * v, out); T.drum('crash', t + 0.18, 0.7 * v, out);
                      [523.25, 659.25, 783.99, 1046.5].forEach(f => T.voice('brass', f, t + 0.18, 1.2, 0.9 * v, out)); break;
      case 'goal':    T.drum('kick', t, 0.8 * v, out); T.drum('crashSoft', t, 0.5 * v, out); [349.23, 440, 523.25].forEach(f => T.voice('brass', f, t, 0.8, 0.75 * v, out)); break;
      case 'gotsu':   T.sweepTone('sine', 160, 90, t, 0.08, 0.5 * v, out); T.noiseBurst(t, 0.03, 0.25 * v, 'bandpass', 900, out); break;
      case 'pita':    T.bell(1318.5, t, 0.4 * v, out); T.bell(1975.5, t + 0.07, 0.4 * v, out); break;
      case 'jakin':   T.fm(900, 2.01, 3, t, 0.4, 0.4 * v, out, 2400); T.sweepNoise(t, 0.25, 3000, 9000, 0.25 * v, out, 'highpass'); break;
      // ---- そのほか（O.3） ----
      case 'step': case 'rivalStep': {
        const k = o.k ?? 0.5, f = 1200 + k * 1800, sf = { meadow: 1, beach: 0.8, snow: 0.7, city: 1.3 }[o.surf || 'meadow'] || 1;
        const vv = (name === 'rivalStep' ? 0.5 : 1) * v;
        T.noiseBurst(t, 0.035 - k * 0.012, 0.25 * vv, 'bandpass', f * sf, out, 1.4);
        if (o.surf === 'snow') T.noiseBurst(t + 0.01, 0.05, 0.1 * vv, 'lowpass', 700, out);
        if (o.surf === 'meadow' || !o.surf) T.tone(90 + k * 30, t, 0.04, 0.12 * vv, out);
        break;
      }
      case 'beep':      T.tone(880, t, 0.08, 0.5 * v, out); T.tone(880, t, 0.08, 0.05 * v, out, 'square'); break;
      case 'beepGo':    T.tone(1318.5, t, 0.25, 0.5 * v, out); T.tone(2637, t, 0.1, 0.2 * v, out); break;
      case 'heart':     T.drum('kick', t, 0.5 * v, out); T.drum('kick', t + 0.16, 0.35 * v, out); break;
      case 'gateOpen':  T.fm(320, 1.7, 2.2, t, 0.25, 0.5 * v, out); T.noiseBurst(t, 0.08, 0.45 * v, 'bandpass', 2500, out); T.wobble(240, 160, 14, 0.2, t + 0.05, 0.35, 0.25 * v, out, 'triangle'); break;
      case 'tape':      T.sweepNoise(t, 0.12, 1200, 4000, 0.3 * v, out); T.noiseBurst(t + 0.02, 0.02, 0.5 * v, 'highpass', 6000, out); break;
      case 'ballThrow': T.sweepNoise(t, 0.2, 600, 2200, 0.2 * v, out); T.fm(700, 1.5, 1.2, t, 0.1, 0.1 * v, out, 1000); break;
      case 'wave':      T.sweepNoise(t, 1.8, 300, 1200, 0.35 * v, out, 'lowpass'); break;
      case 'bump':      T.tone(260, t, 0.04, 0.2 * v, out, 'triangle'); break;
      case 'cheer':     [500, 900, 1500, 2400].forEach((f, i) => { const s = T.noiseSrc(t, 2.2), fl = T.filt('bandpass', f, 3 + i), g = T.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * v / (1 + i * 0.3), t + 0.25); g.gain.linearRampToValueAtTime(0, t + 2.1); s.connect(fl).connect(g).connect(out); }); break;
      case 'whoosh':    T.noiseBurst(t, 0.25, 0.4 * v, 'bandpass', 2000, out); break;
      case 'splash':    T.sweepNoise(t, 0.3, 1200, 600, 0.35 * v, out); break;
      case 'menuMove':  T.tone(1046.5, t, 0.05, 0.14 * v, out, 'triangle'); break;
      case 'menuOk':    [1046.5, 1568, 2093].forEach((f, i) => T.bell(f, t + i * 0.05, 0.32 * v, out)); break;
      case 'menuBack':  T.sweepTone('triangle', 784, 523, t, 0.15, 0.2 * v, out); break;
      case 'holdTick':  T.tone(1800, t, 0.015, 0.05 * v, out); break;
      case 'countUp':   T.tone(2600, t, 0.015, 0.07 * v, out); break;
      case 'stamp':     T.drum('kick', t, 0.7 * v, out); T.noiseBurst(t, 0.05, 0.3 * v, 'bandpass', 2500, out); break;
      case 'fireworkUp': T.sweepNoise(t, 0.8, 800, 2500, 0.1 * v, out); break;
      case 'fireworkBoom': T.drum('kick', t, 0.55 * v, out); T.noiseBurst(t, 1.2, 0.32 * v, 'lowpass', 1500, out); break;
      case 'confetti':  T.crackle(t, 0.5, 0.18 * v, out, 5000, 50); T.bell(2093, t + 0.02, 0.3 * v, out); break;
      case 'cymbal':    T.noiseBurst(t, 1.5, 0.45 * v, 'highpass', 4000, out); break;
      case 'chirp': { const f = 2000 + Math.random() * 2000; T.sweepTone('sine', f, f * (1.2 + Math.random() * 0.4), t, 0.07, 0.05, this.ambBus); T.sweepTone('sine', f * 1.1, f * 0.9, t + 0.09, 0.06, 0.04, this.ambBus); break; }
      case 'gull':      T.sweepTone('sawtooth', 900, 600, t, 0.25, 0.025, this.ambBus); break;
      case 'bells':     T.drum('sleigh', t, 0.4, this.ambBus); break;
    }
  },
  // 抜いた ライバルの 足音が 前から 後ろへ（AQ）
  whooshPast(pan) {
    this.play('rivalStep', { pan, v: 1.2 }); setTimeout(() => this.play('rivalStep', { pan, v: 0.7 }), 120);
    this.play('shuba', { v: 0.4 });
  },

  // ---------- 続く音（AQ） ----------
  buildLoops() {
    const c = this.ctx;
    const loop = (buf, type, f, q = 0.7, out = this.sfxBus) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = this.filt(type, f, q), g = c.createGain(); g.gain.value = 0;
      s.connect(fl).connect(g).connect(out); s.start(0, Math.random());
      return { s, filter: fl, gain: g };
    };
    this.L = {
      wind: loop(this.noise, 'bandpass', 800, 0.6),
      wind2: loop(this.noise, 'highpass', 3000, 0.5),
      pack: loop(this.brown, 'lowpass', 160, 0.8),
      waves: loop(this.brown, 'lowpass', 500, 0.5, this.ambBus),
      mwind: loop(this.noise, 'bandpass', 600, 2, this.ambBus),
      city: loop(this.brown, 'lowpass', 160, 0.5, this.ambBus),
      crowd: [loop(this.noise, 'bandpass', 500, 4, this.ambBus), loop(this.noise, 'bandpass', 1500, 5, this.ambBus), loop(this.noise, 'bandpass', 2500, 6, this.ambBus)]
    };
  },
  set(param, v, tau = 0.05) { if (this.ctx) param.setTargetAtTime(v, this.ctx.currentTime, tau); },
  silenceLoops() {
    if (!this.L) return;
    for (const k of ['wind', 'wind2', 'pack']) this.set(this.L[k].gain.gain, 0, 0.1);
    this.loop('heart', false);
  },
  // spd：アバターの 速さの 割合、chaos：ゴチャゴチャ
  updateLoops(spd, chaos, dt) {
    if (!this.on || !this.L) return;
    const L = this.L;
    this.set(L.wind.gain.gain, 0.02 + spd * spd * 0.22, 0.1);
    this.set(L.wind.filter.frequency, 500 + spd * 2000, 0.1);
    this.set(L.wind2.gain.gain, spd > 0.8 ? (spd - 0.8) * 0.25 : 0, 0.15);
    this.set(L.pack.gain.gain, chaos ? 0.2 : 0, 0.3);
  },
  loop(name, on) {
    if (name === 'heart') { clearInterval(this.heartT); this.heartT = 0; if (on) { this.play('heart'); this.heartT = setInterval(() => this.play('heart'), 520); } }
  },
  // 環境音（AQ）
  ambience(kind) {
    this.ambKind = kind;
    if (!this.L) return;
    const L = this.L;
    this.set(L.waves.gain.gain, kind === 'beach' ? 0.5 : 0, 0.5);
    this.set(L.mwind.gain.gain, kind === 'snow' ? 0.18 : kind === 'meadow' ? 0.05 : 0, 0.5);
    this.set(L.city.gain.gain, kind === 'city' ? 0.4 : 0, 0.5);
  },
  crowd(level) { if (!this.L) return; this.L.crowd.forEach((c, i) => this.set(c.gain.gain, level * [0.25, 0.18, 0.1][i], 0.3)); },
  ambTick(dt, t) {
    if (!this.on) return;
    const k = this.ambKind;
    if (k === 'beach' && this.L) { this.set(this.L.waves.gain.gain, 0.35 + 0.25 * Math.sin(t * 0.75), 0.3); if (Math.random() < dt * 0.15) this.play('gull'); }
    if (k === 'snow' && this.L) { this.set(this.L.mwind.filter.frequency, 500 + 300 * Math.sin(t * 0.3), 0.3); if (Math.random() < dt * 0.08) this.play('bells'); }
    if ((k === 'meadow' || k === 'rest') && Math.random() < dt * 0.35) this.play('chirp');
    if (this.L) this.L.crowd.forEach((c, i) => this.set(c.filter.frequency, [500, 1500, 2500][i] * (1 + 0.1 * Math.sin(t * (1.3 + i)))));
  },

  // ---------- 曲（付録H） ----------
  song: null, tempo: 1, boost: false, breakUntil: -1,
  prepare(S) {
    if (S._p) return S._p;
    const p = { mel: S.melody.map(m => parseLine(m).notes), bass: S.bass ? parseBass(S.bass) : [], chords: S.chords.map(c => c.split('|').map(chordOf)) };
    S._p = p; return p;
  },
  // at：はじめるまでの 秒、noIntro：前奏なし
  music(id, { at = 0, tempo = 1, onEnd = null, noIntro = false } = {}) {
    if (!this.on) return;
    if (this.song && this.songId === id && !SONGS[id].once) return;
    this.stopMusic(0.05);
    const S = SONGS[id]; if (!S) return;
    this.prepare(S);
    this.songId = id; this.song = S; this.tempo = tempo; this.step = noIntro ? (S.intro || 0) * 16 : 0; this.onEnd = onEnd; this.hold = false; this.waited = false;
    this.boost = false; this.breakUntil = -1;
    this.nextT = this.ctx.currentTime + 0.06 + at;
    this.songGain = this.ctx.createGain(); this.songGain.gain.value = 1; this.songGain.connect(this.duckGain);
  },
  stopMusic(fade = 0.4) {
    if (!this.song) return;
    const g = this.songGain;
    if (g && this.ctx) { g.gain.setTargetAtTime(0, this.ctx.currentTime, Math.max(0.01, fade / 3)); setTimeout(() => g.disconnect(), fade * 1000 + 600); }
    this.song = null; this.songId = null;
  },
  musicTempo(k) { this.tempo = k; },
  // 最後の直線：テンポ ×1.08、drums2 と arp を はじめから、太鼓 ×1.2（27.3）
  musicBoost(on) { this.boost = on; this.tempo = on ? A.BOOST_TEMPO : 1; },
  // 2小節 メロディーと 和音を 止めて 太鼓だけ（ため）
  musicBreak(bars = 2) { if (!this.song) return; this.breakUntil = (this.curBar || 0) + bars; },
  musicHoldRelease() { this.hold = false; if (this.ctx) this.nextT = this.ctx.currentTime + 0.05; },
  musicVolume(k, tau = 0.3) { if (this.songGain) this.set(this.songGain.gain, k, tau); },
  startScheduler() { setInterval(() => this.tick(), A.TICK * 1000); },
  tick() {
    if (!this.on || !this.song || this.ctx.state !== 'running' || this.hold) return;
    const ahead = this.ctx.currentTime + A.LOOKAHEAD;
    if (this.nextT < this.ctx.currentTime - 0.5) this.nextT = this.ctx.currentTime + 0.02;   // タブが 止まっていた
    while (this.song && !this.hold && this.nextT < ahead) {
      const S = this.song, stepDur = 60 / (S.bpm * this.tempo) / 4;
      const sw = (this.step % 4 === 2) ? (S.swing || 0) * stepDur : 0;
      this.scheduleStep(this.step, this.nextT + sw, stepDur);
      this.nextT += stepDur; this.step++;
    }
  },
  scheduleStep(i, t, sd) {
    const S = this.song, P = S._p, intro = (S.intro || 0) * 16, nb = S.chords.length;
    const out = this.songGain;
    const inIntro = i < intro;
    const j = i - intro, barAbs = Math.floor(j / 16), bar = inIntro ? 0 : barAbs % nb, pass = inIntro ? 0 : Math.floor(barAbs / nb), st = (inIntro ? i : j) % 16;
    this.curBar = inIntro ? -1 : barAbs;
    if (S.once && barAbs >= nb) { this.song = null; const e = this.onEnd; this.onEnd = null; if (S.end) this.drum(S.end, t, 0.8, out); if (e) setTimeout(e, 50); return; }
    if (S.waitAfter != null && !inIntro && barAbs === S.waitAfter + 1 && st === 0 && !this.waited) { this.waited = true; this.hold = true; this.step--; return; }
    const even = pass % 2 === 1 || this.boost, fill = (!inIntro && (bar === 7 || bar === 15) && nb === 16) || (inIntro && i >= intro - 8 && intro > 0);
    const brk = !inIntro && barAbs < this.breakUntil;
    const chs = P.chords[bar], ch = chs.length > 1 && st >= 8 ? chs[1] : chs[0];
    // ドラム
    let D = fill ? { kick: 'x.......x.......', snare: '....x...x.x.xxxx', hat: 'x.x.x.x.........' } : { ...S.drums, ...(even ? S.drums2 : {}) };
    if (brk) D = { kick: 'x...x...x...x...', snare: st >= 8 && barAbs === this.breakUntil - 1 ? 'xxxxxxxxxxxxxxxx' : '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' };
    if (S.drumsLast && barAbs === nb - 1) D = S.drumsLast;
    if (this.tempo > 1.03 && D.hat && !fill) D = { ...D, hat: 'xxxxxxxxxxxxxxxx' };
    const DV = { kick: 0.45, snare: 0.3, clap: 0.3, hat: 0.12, openhat: 0.12, shaker: 0.1, sleigh: 0.14, conga: 0.2, timpani: 0.4, crash: 0.3 };
    const dk = this.boost ? 1.2 : 1;
    for (const [name, pat] of Object.entries(D)) {
      const c = pat[st]; if (c !== 'x' && c !== 'X') continue;
      let nm = name;
      if (name === 'conga' && S.congaHigh && S.congaHigh.includes(st)) nm = 'congaHi';
      this.drum(nm, t, (DV[name] || 0.2) * (c === 'X' ? 1.4 : 1) * dk * (brk && name === 'snare' && st >= 8 && barAbs === this.breakUntil - 1 ? 0.4 + (st - 8) * 0.08 : 1), out);
    }
    if (fill && st === 0 && !inIntro && (bar === 8 || bar === 0)) this.drum('crash', t, 0.25, out);
    if (!inIntro && barAbs === this.breakUntil && st === 0) this.drum('crash', t, 0.35, out);
    if (S.rolls && S.rolls.includes(bar) && st >= 8) this.drum('snare', t, 0.12 + (st - 8) * 0.03, out), this.drum('snare', t + sd / 2, 0.12 + (st - 8) * 0.03, out);
    if (brk) return;
    // コード
    const chordNotes = () => {
      const base = 12 * ((S.chordOct ?? 4) + 1) + ch.root;
      return ch.tones.map(tn => { let n = base + tn; while (n > 67 + 5) n -= 12; return n; });
    };
    const cv = S.chordVol ?? 0.16;
    if (!S.chordRhythm) { if (st === 0 || (chs.length > 1 && st === 8)) chordNotes().forEach(n => this.voice(S.chordInst, freq(n), t, sd * (chs.length > 1 ? 8 : 16), cv * 1.6, out)); }
    else for (const [p, len] of S.chordRhythm) if (p === st) chordNotes().forEach((n, k) => this.voice(S.chordInst, freq(n), t + (S.strum || 0) * k, sd * len, cv * 2, out));
    if (inIntro) return;
    // ベース
    if (S.bassInst) for (const b of P.bass) if (b.step === st) {
      const r = 36 + ch.root; let n = r;
      if (b.kind === 'F') n = r + 7; else if (b.kind === 'L') n = r - 5; else if (b.kind === 'O') n = r + 12; else if (b.kind === 'T') n = r + ch.tones[1];
      this.voice(S.bassInst, freq(n), t, sd * b.len * 0.9, 0.3 * 2, out);
    }
    // メロディー
    for (const nt of P.mel[bar]) if (nt.step === st) {
      const inst = S.lead[even ? 1 : 0], oct = even ? (S.leadOct2 || 0) : 0;
      let m = nt.midi + oct * 12; if (m > 96) m -= 12;
      this.voice(inst, freq(m), t, sd * nt.len * 0.92, 0.3 * 2.2, out);
      if (S.layer) this.voice(S.layer.inst, freq(m + 12 * S.layer.oct), t, sd * nt.len, 0.15 * 2, out);
    }
    // かざり
    if (S.arp || this.boost) {
      const tones = chordNotes(), A2 = S.arp || { inst: 'pluck', pattern: 'up16', oct: 5, vol: 0.07 };
      const every = A2.pattern === 'up16' ? 1 : 2;
      if (st % every === 0) {
        const k = st / every, seq = A2.pattern === 'updown8' ? [0, 1, 2, 1] : [0, 1, 2, 3];
        const idx = seq[k % seq.length] % tones.length, oct = (A2.oct - 4) * 12;
        this.voice(A2.inst, freq(tones[idx] + oct + 12), t, sd * every, (A2.vol || 0.12) * 2, out);
      }
    }
    if (S.sparkle && even && st === S.sparkle.step) { const tones = chordNotes(); this.bell(freq(tones[tones.length - 1] + 12 * (S.sparkle.oct - 4)), t, 0.12, out); }
  },

  // ---------- 声 ----------
  voices: {}, voiceQueue: [], voiceNow: null, voiceLast: {}, voiceList: {},
  async loadVoices(list, base = 'voice/') {
    if (!this.on || !list) return;
    this.voiceList = list;
    const ids = Object.keys(list);
    // 合図の 声を 先に（すぐ 使う）
    ids.sort((a, b) => (/^[cgn]_|^n\d|^s_/.test(b) ? 1 : 0) - (/^[cgn]_|^n\d|^s_/.test(a) ? 1 : 0));
    const load = async id => { try { const r = await fetch(base + id + '.mp3'); if (!r.ok) return; const ab = await r.arrayBuffer(); this.voices[id] = await this.ctx.decodeAudioData(ab); } catch (e) {} };
    for (let i = 0; i < ids.length; i += 12) await Promise.all(ids.slice(i, i + 12).map(load));
  },
  // prio：9 合図、8 No.7 の 実況、3 ずんだもん。pan：2人対戦の 左右
  say(id, prio = 5, { pan = null, cue = false } = {}) {
    if (!this.running || !this.voiceOn) return false;
    const buf = this.voices[id]; if (!buf) return false;
    const now = this.ctx.currentTime;
    const same = this.voiceLast[id];
    if (same != null && now - same < A.VOICE_SAME_GAP && !/^n\d|^g_|^c_|^n_/.test(id)) return false;
    if (this.voiceNow && this.voiceNow.end > now) {
      if (prio > this.voiceNow.prio || (prio >= 9 && this.voiceNow.prio >= 9)) { try { this.voiceNow.g.gain.setTargetAtTime(0, now, 0.02); this.voiceNow.src.stop(now + 0.06); } catch (e) {} this.voiceNow = null; }
      else { this.voiceQueue.push({ id, prio, pan, cue, until: now + A.VOICE_WAIT }); return true; }
    }
    this.voiceLast[id] = now;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 1;
    src.connect(g).connect(pan != null ? this.panned(pan, this.voiceBus) : this.voiceBus); src.start(now + 0.01);
    const vn = this.voiceNow = { src, g, prio, id, end: now + buf.duration + 0.02 };
    // 曲を 小さく（合図は もっと 小さく）
    const duck = cue || prio >= 9 ? A.DUCK_CUE : A.DUCK_VOICE;
    this.duckGain.gain.setTargetAtTime(duck, now, A.DUCK_IN / 3);
    this.duckGain.gain.setTargetAtTime(1, now + buf.duration, A.DUCK_OUT / 3);
    src.onended = () => { if (this.voiceNow === vn) this.voiceNow = null; this.nextVoice(); };
    return true;
  },
  voiceBusy(prio = 9) { return !!(this.voiceNow && this.voiceNow.end > this.now && this.voiceNow.prio >= prio); },
  voiceLen(id) { const b = this.voices[id]; return b ? b.duration : 0; },
  nextVoice() {
    const now = this.ctx.currentTime;
    this.voiceQueue = this.voiceQueue.filter(v => v.until > now);
    this.voiceQueue.sort((a, b) => b.prio - a.prio);
    const v = this.voiceQueue.shift();
    if (v) this.say(v.id, v.prio, v);
  },
  stopVoice() { if (this.voiceNow) { try { this.voiceNow.src.stop(); } catch (e) {} this.voiceNow = null; } this.voiceQueue = []; }
};
