// 音（第23〜25部・付録H・O・AD）。曲も 効果音も その場で 作る
import { CFG } from './config.js';
import { SONGS } from './songs.js';
import { clamp, lerp } from './util.js';

const A = CFG.audio;
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) { const m = /^([A-G])(#|b)?(-?\d)$/.exec(name); if (!m) return null; return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12; }
const freq = n => 440 * Math.pow(2, (n - 69) / 12);
const CHORD = { '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11], '9': [0, 4, 7, 10, 14], 'm7b5': [0, 3, 6, 10] };
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
// 曲の データの 確かめ（T-AUDIO-01）
export function checkSongs() {
  const bad = [];
  for (const [id, S] of Object.entries(SONGS)) {
    S.melody.forEach((m, i) => { const p = parseLine(m); if (p.total !== 16) bad.push(`${id} bar ${i + 1}: ${p.total}`); if (p.notes.some(n => n.midi == null)) bad.push(`${id} bar ${i + 1}: note`); });
    if (S.bass) { const t = S.bass.trim().split(/\s+/).reduce((a, x) => a + Number(x.split(':')[1]), 0); if (t !== 16) bad.push(`${id} bass ${t}`); }
    if (S.chords.length !== S.melody.length) bad.push(`${id} chords ${S.chords.length} vs ${S.melody.length}`);
  }
  return bad;
}

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
    for (let k = 1; k < N; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25) * 1;
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

  // ---------- 小さな 道具 ----------
  osc(type, f, t0) { const o = this.ctx.createOscillator(); if (type === 'pulse') o.setPeriodicWave(this.pulse); else o.type = type; o.frequency.setValueAtTime(f, t0); o.start(t0); return o; },
  env(t0, peak, a, dur) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0005, t0 + a + dur); return g; },
  filt(type, f, q = 0.7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
  noiseBurst(t0, dur, vol, type, f, out, q = 0.7) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const fl = this.filt(type, f, q), g = this.env(t0, vol, 0.002, dur);
    s.connect(fl).connect(g).connect(out); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.1);
  },
  tone(f, t0, dur, vol, out, type = 'sine') { const o = this.osc(type, f, t0), g = this.env(t0, vol, 0.004, dur); o.connect(g).connect(out); o.stop(t0 + dur + 0.1); },
  sweepTone(type, f0, f1, t0, dur, vol, out) { const o = this.osc(type, f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur); const g = this.env(t0, vol, 0.005, dur); o.connect(g).connect(out); o.stop(t0 + dur + 0.1); },
  sweepNoise(t0, dur, f0, f1, vol, out, type = 'bandpass') {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const fl = this.filt(type, f0, 1.2); fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    s.connect(fl).connect(g).connect(out); s.start(t0, Math.random()); s.stop(t0 + dur + 0.1);
  },
  bell(f, t0, vol, out) {
    for (const [m, a, d] of [[1, 1, 0.6], [2.76, 0.4, 0.3], [5.4, 0.2, 0.15]]) { const o = this.osc('sine', f * m, t0), g = this.ctx.createGain(); g.gain.setValueAtTime(vol * a, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + d); o.connect(g).connect(out); o.stop(t0 + d + 0.05); }
  },
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
    }
    g.connect(out);
    const stopAt = tOff + r * 2 + 0.05;
    srcs.forEach(o => o.stop(stopAt));
  },

  // ---------- 効果音（付録AD） ----------
  lastPlay: {},
  play(name, o = {}) {
    if (!this.on || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + (o.delay || 0);
    if (name !== 'star' && this.lastPlay[name] && t - this.lastPlay[name] < A.SAME_SFX_GAP) return;
    this.lastPlay[name] = t;
    let out = this.sfxBus;
    if (o.pan != null || o.vol != null) {
      const g = this.ctx.createGain(); g.gain.value = o.vol ?? 1;
      if (o.pan != null && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p).connect(this.sfxBus); } else g.connect(this.sfxBus);
      out = g;
    }
    const v = o.vol ?? 1;
    const T = this;
    switch (name) {
      case 'tick': T.noiseBurst(t, 0.01, 0.5, 'highpass', 4000, out); T.tone(2400, t, 0.02, 0.3, out); break;
      case 'beep': T.tone(880, t, 0.12, 0.5, out); T.tone(880, t, 0.12, 0.06, out, 'square'); break;
      case 'beepGo': { const os = T.osc('sine', 1760, t); os.frequency.setValueAtTime(1760, t + 0.4); os.frequency.linearRampToValueAtTime(1600, t + 0.55); os.connect(T.env(t, 0.45, 0.005, 0.55)).connect(out); os.stop(t + 0.65); T.tone(880, t, 0.5, 0.25, out); break; }
      case 'star': { const k = Math.pow(2, (o.combo || 0) / 12); T.tone(1318.5 * k, t, 0.12, 0.3, out); T.tone(1975.5 * k, t + 0.03, 0.15, 0.25, out, 'triangle'); break; }
      case 'gaugeFull': [1046.5, 1318.5, 1568, 2093].forEach((f, i) => T.bell(f, t + i * 0.04, 0.35, out)); break;
      case 'boost': T.sweepNoise(t, 0.3, 600, 3000, 0.35, out); T.sweepTone('sawtooth', 200, 600, t, 0.3, 0.1, out); break;
      case 'turbo': T.sweepNoise(t, 0.8, 500, 3500, 0.45, out); T.sweepTone('sawtooth', 150, 700, t, 0.8, 0.12, out); T.tone(70, t + 0.75, 0.15, 0.5, out); break;
      case 'rocket': T.play('turbo', o); T.drum('kick', t, 0.9, out); break;
      case 'jump': T.sweepTone('sine', 400, 900, t, 0.12, 0.32, out); T.sweepTone('triangle', 400, 900, t, 0.12, 0.08, out); break;
      case 'superJump': T.sweepTone('sine', 400, 900, t, 0.12, 0.3, out); T.sweepTone('sine', 600, 1350, t + 0.05, 0.12, 0.28, out); [2093, 2637, 3136].forEach((f, i) => T.bell(f, t + 0.1 + i * 0.05, 0.18, out)); break;
      case 'land': { const s = clamp((o.imp || 5) / 10, 0.2, 1); const os = T.osc('sine', 120, t); os.frequency.exponentialRampToValueAtTime(50, t + 0.12); os.connect(T.env(t, 0.55 * s, 0.002, 0.25)).connect(out); os.stop(t + 0.3); T.noiseBurst(t, 0.12, 0.3 * s, 'lowpass', 800, out); break; }
      case 'bumpWall': { const s = clamp((o.imp || 3) / 6, 0.3, 1); const os = T.osc('sine', 260, t); os.frequency.linearRampToValueAtTime(180, t + 0.1); os.frequency.linearRampToValueAtTime(220, t + 0.25); os.connect(T.env(t, 0.42 * s, 0.005, 0.3)).connect(out); os.stop(t + 0.35); T.noiseBurst(t, 0.05, 0.1 * s, 'lowpass', 1200, out); break; }
      case 'bumpCar': { const os = T.osc('sine', 190, t); os.frequency.linearRampToValueAtTime(130, t + 0.1); os.frequency.linearRampToValueAtTime(160, t + 0.25); os.connect(T.env(t, 0.38, 0.005, 0.3)).connect(out); os.stop(t + 0.35); break; }
      case 'cone': T.tone(1200, t, 0.05, 0.35, out); T.tone(2800, t, 0.03, 0.15, out); break;
      case 'splash': T.sweepNoise(t, 0.3, 1200, 600, 0.35, out); break;
      case 'gatePass': { const os = T.osc('sine', 300, t); os.frequency.linearRampToValueAtTime(240, t + 0.1); os.frequency.linearRampToValueAtTime(300, t + 0.2); os.connect(T.env(t, 0.2, 0.005, 0.2)).connect(out); os.stop(t + 0.25); break; }
      case 'whoosh': T.noiseBurst(t, 0.25, 0.4, 'bandpass', 2000, out); break;
      case 'overtake': T.sweepTone('triangle', 1046.5, 1568, t, 0.08, 0.22, out); break;
      case 'lap': T.bell(1318.5, t, 0.4, out); T.bell(1760, t + 0.08, 0.4, out); break;
      case 'menuMove': T.tone(1046.5, t, 0.05, 0.14, out, 'triangle'); break;
      case 'menuOk': [1046.5, 1568, 2093].forEach((f, i) => T.bell(f, t + i * 0.05, 0.32, out)); break;
      case 'menuBack': T.sweepTone('triangle', 784, 523, t, 0.15, 0.2, out); break;
      case 'holdTick': T.tone(1800, t, 0.015, 0.05, out); break;
      case 'countUp': T.tone(2600, t, 0.015, 0.07, out); break;
      case 'stamp': T.drum('kick', t, 0.7, out); T.noiseBurst(t, 0.05, 0.3, 'bandpass', 2500, out); break;
      case 'fireworkUp': T.sweepNoise(t, 0.8, 800, 2500, 0.1 * v, out); break;
      case 'fireworkBoom': T.drum('kick', t, 0.55 * v, out); T.noiseBurst(t, 1.2, 0.32 * v, 'lowpass', 1500, out); break;
      case 'confetti': T.noiseBurst(t, 0.08, 0.4, 'highpass', 2000, out); T.bell(2093, t + 0.02, 0.3, out); break;
      case 'drumroll': for (let i = 0; i < 36; i++) T.drum('snare', t + i / 24, 0.15 + i / 36 * 0.55, out); break;
      case 'cymbal': T.noiseBurst(t, 1.5, 0.45, 'highpass', 4000, out); break;
      case 'plank': T.tone(180, t, 0.04, 0.22, out); T.noiseBurst(t, 0.02, 0.1, 'bandpass', 800, out); break;
      case 'snowStep': T.noiseBurst(t, 0.05, 0.22 * v, 'bandpass', 1800, out, 1.5); break;
      case 'curb': T.tone(90, t, 0.03, 0.28, out); break;
      case 'scrape': T.noiseBurst(t, 0.08, 0.07, 'bandpass', 3000, out); break;
      case 'chirp': { const f = 2000 + Math.random() * 2000; T.sweepTone('sine', f, f * (1.2 + Math.random() * 0.4), t, 0.07, 0.05, this.ambBus); T.sweepTone('sine', f * 1.1, f * 0.9, t + 0.09, 0.06, 0.04, this.ambBus); break; }
      case 'gull': T.sweepTone('sawtooth', 900, 600, t, 0.25, 0.025, this.ambBus); break;
    }
  },

  // ---------- たえず 鳴る音（23.4） ----------
  buildLoops() {
    const c = this.ctx;
    const loop = (buf, type, f, q = 0.7, out = this.sfxBus) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = this.filt(type, f, q), g = c.createGain(); g.gain.value = 0;
      s.connect(fl).connect(g).connect(out); s.start(0, Math.random());
      return { s, filter: fl, gain: g };
    };
    this.L = {
      wind: loop(this.noise, 'bandpass', 400, 0.6),
      roll: loop(this.brown, 'lowpass', 180),
      grass: loop(this.noise, 'bandpass', 2500, 1.2),
      sand: loop(this.noise, 'highpass', 3000),
      ice: loop(this.noise, 'highpass', 5000),
      puddle: loop(this.noise, 'bandpass', 900, 0.8),
      hum: loop(this.brown, 'lowpass', 300),
      rival: [loop(this.noise, 'bandpass', 500, 0.6), loop(this.noise, 'bandpass', 500, 0.6)],
      waves: loop(this.brown, 'lowpass', 500, 0.5, this.ambBus),
      mwind: loop(this.noise, 'bandpass', 600, 2, this.ambBus),
      city: loop(this.brown, 'lowpass', 160, 0.5, this.ambBus),
      crowd: [loop(this.noise, 'bandpass', 500, 4, this.ambBus), loop(this.noise, 'bandpass', 1500, 5, this.ambBus), loop(this.noise, 'bandpass', 2500, 6, this.ambBus)]
    };
    // しっぽの 低い うなり（スタート前の 空回り）
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 80; const lp = this.filt('lowpass', 300), g = c.createGain(); g.gain.value = 0; o.connect(lp).connect(g).connect(this.sfxBus); o.start();
    this.L.rev = { osc: o, gain: g };
    if (c.createStereoPanner) this.L.rival.forEach(r => { const p = c.createStereoPanner(); r.gain.disconnect(); r.gain.connect(p).connect(this.sfxBus); r.pan = p; });
  },
  set(param, v, tau = 0.05) { if (this.ctx) param.setTargetAtTime(v, this.ctx.currentTime, tau); },
  silenceLoops() {
    if (!this.L) return;
    for (const k of ['wind', 'roll', 'grass', 'sand', 'ice', 'puddle', 'hum']) this.set(this.L[k].gain.gain, 0, 0.1);
    this.L.rival.forEach(r => this.set(r.gain.gain, 0, 0.1));
    this.set(this.L.rev.gain.gain, 0, 0.1);
  },
  // p：プレイヤーの カート。pre：スタート前（空回り）
  updateLoops(p, dt, { pre = false, rivals = [], camYaw = 0 } = {}) {
    if (!this.on || !this.L) return;
    const L = this.L, v = clamp(p.v / CFG.phys.VMAX, 0, 1.4);
    this.set(L.wind.gain.gain, 0.02 + v * v * 0.22 + (p.boostT > 0 ? 0.08 : 0));
    this.set(L.wind.filter.frequency, 400 + p.v * 40);
    this.set(L.roll.gain.gain, p.ground ? v * 0.25 : 0);
    this.set(L.roll.filter.frequency, 180 + p.v * 12);
    const SV = { grass: 0.08, sand: 0.1, ice: 0.12, puddle: 0.16 };
    for (const k of ['grass', 'sand', 'ice', 'puddle']) this.set(L[k].gain.gain, p.ground && (p.surf === k || (k === 'sand' && p.surf === 'snow')) ? SV[k] * Math.max(0.3, v) : 0);
    this.set(L.rev.gain.gain, pre ? 0.08 * p.input.throttle : 0);
    this.set(L.rev.osc.frequency, 80 + p.input.throttle * 60);
    // 区切りの ある 音
    p._dist = (p._dist || 0) + p.v * dt;
    if (p.ground && p.surf === 'plank' && p._dist > 0.6) { p._dist = 0; this.play('plank', { vol: 0.5 }); }
    else if (p.ground && (p.surf === 'snowroad' || p.surf === 'snow') && p._dist > 0.3) { p._dist = 0; this.play('snowStep', { vol: p.surf === 'snow' ? 0.55 : 0.3 }); }
    else if (p.ground && p.track.curbAt(p.s) && Math.abs(p.d) > p.track.wAt(p.s) / 2 - 0.1 && Math.abs(p.d) < p.track.wAt(p.s) / 2 + 1 && p._dist > 1.2) { p._dist = 0; this.play('curb', { vol: 0.6 }); }
    // チェーン：ペダルが 半回転するごと
    const half = Math.floor(p.pedalA / Math.PI);
    if (half !== p._half) { p._half = half; if (p.input.throttle > 0.05) this.play('tick', { vol: 0.12 * Math.min(1, p.input.throttle * 1.5) }); }
    // ほかの カート（近い 2台）
    rivals.slice(0, 2).forEach((r, i) => {
      const L2 = L.rival[i]; if (!L2) return;
      this.set(L2.gain.gain, r ? 0.08 * (r.k.v / 22) * r.vol : 0, 0.1);
      if (r && L2.pan) this.set(L2.pan.pan, r.pan, 0.1);
    });
  },
  // 環境音（23.6）
  ambience(kind) {
    this.ambKind = kind;
    if (!this.L) return;
    const L = this.L;
    this.set(L.waves.gain.gain, kind === 'beach' ? 0.5 : 0, 0.5);
    this.set(L.mwind.gain.gain, kind === 'snow' ? 0.18 : 0, 0.5);
    this.set(L.city.gain.gain, kind === 'city' ? 0.4 : 0, 0.5);
  },
  crowd(level) { if (!this.L) return; this.L.crowd.forEach((c, i) => this.set(c.gain.gain, level * [0.25, 0.18, 0.1][i], 0.3)); },
  ambTick(dt, t) {
    if (!this.on) return;
    const k = this.ambKind;
    if (k === 'beach' && this.L) { this.set(this.L.waves.gain.gain, 0.35 + 0.25 * Math.sin(t * 0.75), 0.3); if (Math.random() < dt * 0.15) this.play('gull'); }
    if (k === 'snow' && this.L) this.set(this.L.mwind.filter.frequency, 500 + 300 * Math.sin(t * 0.3), 0.3);
    if ((k === 'meadow' || k === 'rest') && Math.random() < dt * 0.6) this.play('chirp');
    if (this.L) this.L.crowd.forEach((c, i) => this.set(c.filter.frequency, [500, 1500, 2500][i] * (1 + 0.1 * Math.sin(t * (1.3 + i)))));
  },

  // ---------- 曲（付録H） ----------
  song: null, tempo: 1,
  prepare(S) {
    if (S._p) return S._p;
    const p = { mel: S.melody.map(m => parseLine(m).notes), bass: S.bass ? parseBass(S.bass) : [], chords: S.chords.map(c => c.split('|').map(chordOf)) };
    S._p = p; return p;
  },
  music(id, { at = 0, tempo = 1, onEnd = null } = {}) {
    if (!this.on) return;
    if (this.song && this.songId === id && !SONGS[id].once) return;
    this.stopMusic(0.05);
    const S = SONGS[id]; if (!S) return;
    this.prepare(S);
    this.songId = id; this.song = S; this.tempo = tempo; this.step = 0; this.onEnd = onEnd; this.hold = false;
    this.nextT = this.ctx.currentTime + 0.06 + at;
    this.songGain = this.ctx.createGain(); this.songGain.gain.value = 1; this.songGain.connect(this.duckGain);
  },
  stopMusic(fade = 0.4) {
    if (!this.song) return;
    const g = this.songGain;
    if (g && this.ctx) { g.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3); setTimeout(() => g.disconnect(), fade * 1000 + 600); }
    this.song = null; this.songId = null;
  },
  musicTempo(k) { this.tempo = k; },
  musicHoldRelease() { this.hold = false; if (this.ctx) this.nextT = this.ctx.currentTime + 0.05; },
  musicVolume(k, tau = 0.3) { if (this.songGain) this.set(this.songGain.gain, k, tau); },
  startScheduler() {
    setInterval(() => this.tick(), A.TICK * 1000);
  },
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
    if (S.once && barAbs >= nb) { this.song = null; const e = this.onEnd; this.onEnd = null; if (S.end) this.drum(S.end, t, 0.8, out); if (e) setTimeout(e, 50); return; }
    if (S.waitAfter != null && !inIntro && barAbs === S.waitAfter + 1 && st === 0 && !this.waited) { this.waited = true; this.hold = true; this.step--; return; }
    const even = pass % 2 === 1, fill = (!inIntro && (bar === 7 || bar === 15) && nb === 16) || (inIntro && i >= intro - 8 && intro > 0);
    const chs = P.chords[bar], ch = chs.length > 1 && st >= 8 ? chs[1] : chs[0];
    // ドラム
    let D = fill ? { kick: 'x.......x.......', snare: '....x...x.x.xxxx', hat: 'x.x.x.x.........' } : { ...S.drums, ...(even ? S.drums2 : {}) };
    if (S.drumsLast && barAbs === nb - 1) D = S.drumsLast;
    if (this.tempo > 1.03 && D.hat && !fill) D = { ...D, hat: 'xxxxxxxxxxxxxxxx' };
    const DV = { kick: 0.45, snare: 0.3, clap: 0.3, hat: 0.12, openhat: 0.12, shaker: 0.1, sleigh: 0.14, conga: 0.2, timpani: 0.4, crash: 0.3 };
    for (const [name, pat] of Object.entries(D)) {
      const c = pat[st]; if (c !== 'x' && c !== 'X') continue;
      let nm = name;
      if (name === 'conga' && S.congaHigh && S.congaHigh.includes(st)) nm = 'congaHi';
      this.drum(nm, t, (DV[name] || 0.2) * (c === 'X' ? 1.4 : 1), out);
    }
    if (fill && st === 0 && !inIntro && (bar === 8 || bar === 0)) this.drum('crash', t, 0.25, out);
    if (S.rolls && S.rolls.includes(bar) && st >= 8) this.drum('snare', t, 0.12 + (st - 8) * 0.03, out), this.drum('snare', t + sd / 2, 0.12 + (st - 8) * 0.03, out);
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
    if (S.arp) {
      const tones = chordNotes(), A2 = S.arp;
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
  voices: {}, voiceQueue: [], voiceNow: null, voiceLast: {},
  async loadVoices(list, base = 'voice/') {
    if (!this.on || !list) return;
    const ids = Object.keys(list);
    await Promise.all(ids.map(async id => {
      try { const r = await fetch(base + id + '.mp3'); if (!r.ok) return; const ab = await r.arrayBuffer(); this.voices[id] = await this.ctx.decodeAudioData(ab); } catch (e) {}
    }));
  },
  say(id, prio = 5) {
    if (!this.on || !this.voiceOn) return false;
    const buf = this.voices[id]; if (!buf) return false;
    const now = this.ctx.currentTime;
    const same = this.voiceLast[id];
    if (same != null && now - same < A.VOICE_SAME_GAP && !/^n\d$|^go$/.test(id)) return false;
    if (this.voiceNow && this.voiceNow.end > now) {
      if (prio > this.voiceNow.prio) { try { this.voiceNow.g.gain.setTargetAtTime(0, now, 0.03); this.voiceNow.src.stop(now + 0.1); } catch (e) {} }
      else { this.voiceQueue.push({ id, prio, until: now + A.VOICE_WAIT }); return true; }
    }
    this.voiceLast[id] = now;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 1;
    src.connect(g).connect(this.voiceBus); src.start(now + 0.01);
    this.voiceNow = { src, g, prio, end: now + buf.duration + 0.02 };
    // 曲を 小さく
    this.duckGain.gain.setTargetAtTime(A.DUCK, now, A.DUCK_IN / 3);
    this.duckGain.gain.setTargetAtTime(1, now + buf.duration, A.DUCK_OUT / 3);
    src.onended = () => { this.voiceNow = null; this.nextVoice(); };
    return true;
  },
  nextVoice() {
    const now = this.ctx.currentTime;
    this.voiceQueue = this.voiceQueue.filter(v => v.until > now);
    this.voiceQueue.sort((a, b) => b.prio - a.prio);
    const v = this.voiceQueue.shift();
    if (v) this.say(v.id, v.prio);
  },
  stopVoice() { if (this.voiceNow) { try { this.voiceNow.src.stop(); } catch (e) {} this.voiceNow = null; } this.voiceQueue = []; }
};
