// AudioManager：WebAudio で全音源を合成（音声ファイルなし）。開始失敗時は無音で続行。
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.ok = false;
    this.vol = { master: 0.5, bgm: 0.4, se: 0.7 };
    this.muted = false;
    this.duck = 1;
    this.lastPlay = {};
    this.voices = {};
    this.song = null;
    this.layer3 = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain();
        this.bgmGain = c.createGain();
        this.seGain = c.createGain();
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        this.bgmGain.connect(this.master);
        this.seGain.connect(this.master);
        this.master.connect(comp); comp.connect(c.destination);
        // ノイズバッファ
        const len = c.sampleRate * 1;
        this.noise = c.createBuffer(1, len, c.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolume();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.ok = true;
    } catch (e) {
      this.ok = false;
    }
  }

  setVolume(v) { Object.assign(this.vol, v); this.applyVolume(); }
  setMuted(m) { this.muted = m; this.applyVolume(); }
  setDuck(d) { this.duck = d; this.applyVolume(); }
  applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.bgmGain.gain.setTargetAtTime(this.vol.bgm * 0.55 * this.duck, t, 0.08);
    this.seGain.gain.setTargetAtTime(this.vol.se, t, 0.03);
  }

  // --- 合成の部品 ---
  tone(dest, { f = 440, f2 = null, type = 'sine', t = 0, dur = 0.15, a = 0.005, g = 0.3, q = null, detune = 0 }) {
    const c = this.ctx;
    const t0 = c.currentTime + t;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    o.detune.value = detune;
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t0);
    e.gain.exponentialRampToValueAtTime(g, t0 + a);
    e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (q) { const fl = c.createBiquadFilter(); fl.type = q.type; fl.frequency.value = q.f; fl.Q.value = q.Q || 1; node.connect(fl); node = fl; }
    node.connect(e); e.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noiseHit(dest, { t = 0, dur = 0.1, g = 0.3, type = 'bandpass', f = 2000, f2 = null, Q = 1, a = 0.002 }) {
    const c = this.ctx;
    const t0 = c.currentTime + t;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const fl = c.createBiquadFilter();
    fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = Q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t0);
    e.gain.exponentialRampToValueAtTime(g, t0 + a);
    e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(e); e.connect(dest);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }

  // 効果音（同時再生数と連打間隔を制限）
  play(name, opt = {}) {
    if (!this.ok || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const minGap = { pen: 0.05, block: 0.04, tick: 0.05 }[name] ?? 0.03;
    if (this.lastPlay[name] && now - this.lastPlay[name] < minGap) return;
    this.lastPlay[name] = now;
    const D = this.seGain;
    try {
      switch (name) {
        case 'penStart': this.noiseHit(D, { dur: 0.04, g: 0.18, f: 4500, Q: 2 }); break;
        case 'pen': this.noiseHit(D, { dur: 0.05, g: 0.05 + Math.min(0.08, (opt.speed || 0) * 0.0001), f: 3000 + Math.random() * 1500, Q: 3 }); break;
        case 'recog':
          this.tone(D, { f: N(79), type: 'triangle', dur: 0.12, g: 0.18 });
          this.tone(D, { f: N(84), type: 'triangle', t: 0.06, dur: 0.18, g: 0.16 });
          break;
        case 'fail':
          this.tone(D, { f: 220, f2: 150, type: 'square', dur: 0.18, g: 0.05, q: { type: 'lowpass', f: 900 } });
          break;
        case 'inkShort':
          this.tone(D, { f: 140, f2: 90, type: 'sine', dur: 0.2, g: 0.3 });
          this.noiseHit(D, { dur: 0.08, g: 0.08, type: 'lowpass', f: 600 });
          break;
        case 'focusFull':
          [72, 76, 79, 84].forEach((m, i) => this.tone(D, { f: N(m), type: 'sine', t: i * 0.05, dur: 0.25, g: 0.12 }));
          break;
        case 'warn': this.tone(D, { f: N(88), type: 'sine', dur: 0.12, g: 0.07 }); break;
        case 'imminent': this.tone(D, { f: N(93), type: 'square', dur: 0.04, g: 0.03, q: { type: 'lowpass', f: 3000 } }); break;
        case 'fire':
          this.noiseHit(D, { dur: 0.09, g: 0.22, type: 'lowpass', f: 1200, f2: 300 });
          this.tone(D, { f: 180, f2: 70, type: 'sine', dur: 0.12, g: 0.25 });
          break;
        case 'swipe': this.noiseHit(D, { dur: 0.22, g: 0.25, type: 'bandpass', f: 800, f2: 4000, Q: 0.8 }); break;
        case 'drop': this.tone(D, { f: 900, f2: 300, type: 'sine', dur: 0.12, g: 0.12 }); break;
        case 'block': {
          const k = Math.min(12, opt.combo || 0);
          const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
          const m = 72 + scale[k];
          this.tone(D, { f: N(m), type: 'triangle', dur: 0.18, g: 0.2 });
          this.tone(D, { f: N(m + 12), type: 'sine', dur: 0.12, g: 0.08 });
          this.noiseHit(D, { dur: 0.06, g: 0.12, f: 5000, Q: 1 });
          break;
        }
        case 'tri':
          this.noiseHit(D, { dur: 0.3, g: 0.2, type: 'bandpass', f: 600, f2: 5000, Q: 0.7 });
          [60, 64, 67, 72].forEach((m) => this.tone(D, { f: N(m), type: 'sawtooth', t: 0.05, dur: 0.4, g: 0.05, q: { type: 'lowpass', f: 2400 } }));
          break;
        case 'bossHit':
          this.noiseHit(D, { dur: 0.12, g: 0.3, type: 'highpass', f: 1500 });
          this.noiseHit(D, { t: 0.03, dur: 0.1, g: 0.15, type: 'bandpass', f: 2500, Q: 4 });
          break;
        case 'bossHitBig':
          this.noiseHit(D, { dur: 0.35, g: 0.4, type: 'lowpass', f: 3000, f2: 400 });
          this.tone(D, { f: 110, f2: 50, type: 'sine', dur: 0.35, g: 0.4 });
          break;
        case 'playerHit':
          this.tone(D, { f: 160, f2: 60, type: 'sine', dur: 0.25, g: 0.45 });
          this.noiseHit(D, { dur: 0.18, g: 0.2, type: 'lowpass', f: 900 });
          break;
        case 'phase':
          this.tone(D, { f: 110, f2: 330, type: 'sawtooth', dur: 0.9, g: 0.08, q: { type: 'lowpass', f: 1200 } });
          this.noiseHit(D, { dur: 1.0, g: 0.12, type: 'bandpass', f: 300, f2: 2000, Q: 0.6, a: 0.3 });
          break;
        case 'roar':
          this.tone(D, { f: 140, f2: 90, type: 'sawtooth', dur: 0.6, g: 0.07, q: { type: 'lowpass', f: 700 } });
          break;
        case 'victory':
          [[72, 0], [76, 0.12], [79, 0.24], [84, 0.38], [88, 0.38]].forEach(([m, t]) => this.tone(D, { f: N(m), type: 'triangle', t, dur: 0.6, g: 0.16 }));
          break;
        case 'defeat':
          [[67, 0], [63, 0.25], [60, 0.5], [55, 0.8]].forEach(([m, t]) => this.tone(D, { f: N(m), type: 'triangle', t, dur: 0.5, g: 0.14 }));
          break;
        case 'button': this.tone(D, { f: N(81), type: 'sine', dur: 0.06, g: 0.12 }); break;
        case 'tick': this.tone(D, { f: N(96), type: 'square', dur: 0.05, g: 0.04, q: { type: 'lowpass', f: 4000 } }); break;
        case 'paper': this.noiseHit(D, { dur: 0.25, g: 0.18, type: 'bandpass', f: 1800, Q: 0.7, a: 0.03 }); break;
        case 'bulge': this.tone(D, { f: 60, f2: 120, type: 'sine', dur: 0.5, g: 0.3 }); break;
        case 'count': this.tone(D, { f: N(84), type: 'sine', dur: 0.08, g: 0.1 }); break;
      }
    } catch (e) { /* 音が出なくてもゲームは続行 */ }
  }

  // --- BGM：先読みスケジューラ ---
  playSong(name) {
    if (this.song === name) return;
    this.song = name;
    this.step = 0;
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }
  stopSong() { this.song = null; }
  setLayer3(v) { this.layer3 = v; }

  schedule() {
    if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
    const S = SONGS[this.song];
    if (!S) return;
    const spb = 60 / S.tempo / 4; // 16分音符
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const t = this.nextTime - this.ctx.currentTime;
      try { S.step(this, this.step, Math.max(0, t), spb, this.layer3); } catch (e) {}
      this.step++;
      this.nextTime += spb;
    }
  }
}

const SONGS = {
  title: {
    tempo: 84,
    step(a, s, t, spb) {
      const B = a.bgmGain;
      const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]];
      const bar = Math.floor(s / 16) % 4;
      const ch = chords[bar];
      const i = s % 16;
      if (i % 2 === 0) {
        const m = ch[(i / 2) % 4] + 12;
        a.tone(B, { f: N(m), type: 'sine', t, dur: 0.9, g: 0.09 });
        a.tone(B, { f: N(m + 24), type: 'sine', t, dur: 0.3, g: 0.015 });
      }
      if (i === 0) a.tone(B, { f: N(ch[0] - 12), type: 'triangle', t, dur: 2.2, g: 0.1 });
    },
  },
  battle: {
    tempo: 132,
    step(a, s, t, spb, layer3) {
      const B = a.bgmGain;
      const prog = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
      const bar = Math.floor(s / 16) % 4;
      const ch = prog[bar];
      const i = s % 16;
      // ベース
      if ([0, 3, 6, 8, 11, 14].includes(i)) a.tone(B, { f: N(ch[0] - 24 + (i === 14 ? 7 : 0)), type: 'triangle', t, dur: spb * 2.2, g: 0.2 });
      // ハイハット
      if (i % 2 === 0) a.noiseHit(B, { t, dur: 0.03, g: i % 4 === 2 ? 0.05 : 0.025, type: 'highpass', f: 7000 });
      // キック・スネア風（紙を叩く音）
      if (i === 0 || i === 8) a.tone(B, { f: 120, f2: 50, type: 'sine', t, dur: 0.12, g: 0.25 });
      if (i === 4 || i === 12) a.noiseHit(B, { t, dur: 0.08, g: 0.1, type: 'bandpass', f: 1800, Q: 0.8 });
      // プラック
      const mel = [0, null, 2, null, 1, null, 2, 0, null, 2, null, 1, 2, null, 1, null];
      const n = mel[i];
      if (n !== null) a.tone(B, { f: N(ch[n] + 12), type: 'square', t, dur: 0.12, g: 0.035, q: { type: 'lowpass', f: 2200 } });
      // フェーズ3：緊張のパート
      if (layer3) {
        if (i % 2 === 1) a.tone(B, { f: N(ch[(i >> 1) % 3] + 24), type: 'sawtooth', t, dur: 0.07, g: 0.018, q: { type: 'lowpass', f: 3000 } });
        if (i === 15) a.noiseHit(B, { t, dur: 0.06, g: 0.08, type: 'bandpass', f: 2600, Q: 1 });
        if (i === 0) a.tone(B, { f: N(ch[0] - 12), type: 'sawtooth', t, dur: spb * 15, g: 0.03, q: { type: 'lowpass', f: 500 } });
      }
    },
  },
};
