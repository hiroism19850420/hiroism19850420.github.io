// 効果音。音声ファイルを使わず、その場で合成する(通常再生と、動画用の書き出しの両方で同じ音になる)。
function makeSynth(ctx) {
  const N = m => 440 * Math.pow(2, (m - 69) / 12);

  const bus = ctx.createGain();
  bus.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.003; comp.release.value = 0.22;
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  const conv = ctx.createConvolver();
  conv.buffer = impulse(1.7, 2.8);
  bus.connect(comp); bus.connect(conv); conv.connect(wet); wet.connect(comp); comp.connect(ctx.destination);

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    let s = 20251008;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = rnd() * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function voice(type, freq, t, { a = 0.004, d = 0.3, peak = 0.3, pan = 0, slide = 0, det = 0, lp = 0, lpTo = 0, hold = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + a + hold + d);
    o.detune.value = det;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
    let node = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(lp, t);
      if (lpTo) f.frequency.exponentialRampToValueAtTime(lpTo, t + a + hold + d);
      o.connect(f); node = f;
    }
    node.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan; g.connect(p); p.connect(bus);
    } else g.connect(bus);
    o.start(t); o.stop(t + a + hold + d + 0.05);
  }

  // 木琴: 基音 + 4倍音の短い打撃音
  function marimba(m, t, v = 0.5, pan = 0) {
    const f = N(m);
    voice('sine', f, t, { a: 0.003, d: 0.5, peak: v, pan });
    voice('sine', f * 4, t, { a: 0.002, d: 0.09, peak: v * 0.32, pan });
    voice('sine', f * 9.2, t, { a: 0.001, d: 0.03, peak: v * 0.1, pan });
  }
  // 鈴: 非整数倍音を重ねる
  function bell(m, t, v = 0.3, len = 1.3, pan = 0) {
    const f = N(m);
    [[1, 1, 1], [2.76, 0.42, 0.6], [5.4, 0.2, 0.35], [8.93, 0.09, 0.2]].forEach(([r, g, l]) =>
      voice('sine', f * r, t, { a: 0.002, d: len * l, peak: v * g, pan }));
  }
  // やわらかい音(三角波 + 1オクターブ上)
  function soft(m, t, v = 0.3, len = 0.35, pan = 0) {
    const f = N(m);
    voice('triangle', f, t, { a: 0.006, d: len, peak: v, pan });
    voice('sine', f * 2, t, { a: 0.006, d: len * 0.6, peak: v * 0.3, pan });
  }
  // 金管ふう(のこぎり波2本 + フィルターが開く)
  function brass(m, t, v = 0.2, len = 0.3) {
    const f = N(m);
    [-7, 7].forEach(det => voice('sawtooth', f, t, { a: 0.03, hold: len, d: 0.16, peak: v, det, lp: 700, lpTo: 2600, pan: det / 20 }));
    voice('triangle', f / 2, t, { a: 0.03, hold: len, d: 0.16, peak: v * 0.5 });
  }
  function swoosh(t, len = 0.4, from = 500, to = 5000, v = 0.12) {
    const n = Math.floor(ctx.sampleRate * len), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let s = 7;
    for (let i = 0; i < n; i++) d[i] = ((s = (s * 1103515245 + 12345) >>> 0) / 2147483648) - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = b; f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g); g.connect(bus); src.start(t);
  }

  const PENT = [0, 2, 4, 7, 9];
  const tickNote = i => 60 + PENT[i % 5] + 12 * (Math.floor(i / 5) % 3);

  const S = {
    // 言葉を1つ読む/当てるたびに、音階を1段ずつ上がる
    tick(t, i = 0) { marimba(tickNote(i), t, 0.42, ((i % 5) - 2) * 0.12); },
    start(t) {
      swoosh(t, 0.42);
      [60, 64, 67].forEach((m, k) => marimba(m, t + 0.1 + k * 0.09, 0.45, (k - 1) * 0.3));
      bell(72, t + 0.4, 0.34, 1.6); bell(76, t + 0.4, 0.16, 1.4, -0.3); bell(79, t + 0.4, 0.14, 1.4, 0.3);
    },
    newWord(t) { bell(88, t, 0.2, 0.9, -0.2); bell(95, t + 0.1, 0.22, 1.2, 0.2); },
    listen(t) { soft(79, t, 0.2, 0.16); soft(86, t + 0.1, 0.22, 0.3); },
    chainOk(t) { soft(84, t, 0.2, 0.2); soft(91, t + 0.08, 0.2, 0.3); },
    // 正解: ピンポンピンポン
    ok(t) {
      [0, 0.3].forEach(dt => {
        [[88, 0], [84, 0.13]].forEach(([m, d], k) => {
          bell(m, t + dt + d, 0.26, 0.55, k ? 0.2 : -0.2);
          soft(m, t + dt + d, 0.2, 0.2, k ? 0.2 : -0.2);
        });
      });
    },
    bad(t) {
      [0, 0.2].forEach((dt, k) => [-9, 9].forEach(det =>
        voice('sawtooth', N(k ? 46 : 51), t + dt, { a: 0.008, hold: k ? 0.22 : 0.1, d: 0.1, peak: 0.2, det, lp: 620 })));
      voice('sine', N(34), t + 0.2, { a: 0.01, d: 0.4, peak: 0.3 });
    },
    // お話のはじまり: ページをめくる音 + ハープふう
    page(t) {
      swoosh(t, 0.28, 3200, 700, 0.1);
      [60, 64, 67, 72, 76].forEach((m, k) => marimba(m, t + 0.16 + k * 0.07, 0.3, (k - 2) * 0.22));
      bell(84, t + 0.52, 0.16, 1.4);
    },
    // 絵をふせる: ぱたぱたと下がる
    hide(t) {
      [88, 84, 79, 76, 72, 67].forEach((m, k) => marimba(m, t + k * 0.05, 0.26, (2.5 - k) * 0.16));
      swoosh(t + 0.05, 0.35, 4200, 500, 0.08);
    },
    // 質問: デデン!
    question(t) {
      const hit = (at, ms, len, v) => {
        ms.forEach(m => brass(m, at, v, len));
        voice('sine', N(38), at, { a: 0.003, d: 0.28, peak: 0.5, slide: 0.55 });
        swoosh(at, 0.08, 1500, 500, 0.3);
      };
      hit(t, [50, 57, 62], 0.03, 0.13);
      hit(t + 0.17, [50, 57, 62, 65], 0.3, 0.16);
      bell(86, t + 0.19, 0.1, 0.9);
    },
    // その話の質問をぜんぶ正解
    perfect(t) {
      [72, 76, 79, 84, 88].forEach((m, k) => marimba(m, t + k * 0.06, 0.4, (k - 2) * 0.2));
      brass(72, t + 0.32, 0.13, 0.3); brass(76, t + 0.32, 0.1, 0.3); brass(79, t + 0.32, 0.1, 0.3);
      [96, 100, 103].forEach((m, k) => bell(m, t + 0.36 + k * 0.08, 0.13, 1.1, (k - 1) * 0.35));
    },
    levelup(t) {
      [67, 71, 74, 79, 83, 86].forEach((m, k) => soft(m, t + k * 0.065, 0.2, 0.22, (k - 2.5) * 0.15));
      bell(91, t + 0.42, 0.2, 1.3); swoosh(t, 0.45, 800, 6000, 0.05);
    },
    hint(t) { bell(86, t, 0.2, 0.8, -0.2); bell(93, t + 0.11, 0.22, 1.2, 0.2); },
    think(t) { [72, 72, 76].forEach((m, k) => soft(m, t + k * 0.13, 0.1, 0.12, (k - 1) * 0.4)); },
    milestone(t) { [84, 88, 91, 96].forEach((m, k) => bell(m, t + k * 0.08, 0.2, 1.1, (k - 1.5) * 0.25)); },
    // 手拍子(古今東西のかけ声用): 短い雑音を2回
    clap(t) {
      [0, 0.26].forEach((dt, k) => {
        swoosh(t + dt, 0.07, 1100, 2400, 0.5);
        swoosh(t + dt + 0.012, 0.09, 1800, 900, 0.3);
        voice('triangle', 190, t + dt, { a: 0.002, d: 0.06, peak: 0.25, slide: 0.6, pan: k ? 0.25 : -0.25 });
      });
    },
    // 残り時間の合図(木魚ふう)。n が小さいほど高い
    count(t, n = 3) { voice('sine', N(84 - n * 2), t, { a: 0.002, d: 0.09, peak: 0.26 }); voice('sine', N(84 - n * 2) * 2.4, t, { a: 0.001, d: 0.04, peak: 0.1 }); },
    timeup(t) { [76, 72, 67].forEach((m, k) => soft(m, t + k * 0.11, 0.24, 0.22)); },
    dup(t) { soft(55, t, 0.18, 0.12); soft(55, t + 0.1, 0.14, 0.12); },
    pause(t) { soft(79, t, 0.2, 0.2); soft(72, t + 0.12, 0.2, 0.4); },
    resume(t) { soft(72, t, 0.2, 0.2); soft(79, t + 0.12, 0.2, 0.4); },
    gameover(t) {
      [69, 65, 62].forEach((m, k) => { soft(m, t + k * 0.3, 0.3, 0.5); soft(m - 12, t + k * 0.3, 0.16, 0.5); });
      [50, 57, 62, 65].forEach(m => voice('triangle', N(m), t + 0.95, { a: 0.05, hold: 0.5, d: 1.1, peak: 0.12 }));
      bell(50, t + 0.95, 0.24, 2.2);
    },
    record(t) {
      [67, 72, 76].forEach((m, k) => brass(m, t + k * 0.13, 0.15, 0.08));
      brass(79, t + 0.39, 0.17, 0.62); brass(72, t + 0.39, 0.1, 0.62); brass(76, t + 0.39, 0.1, 0.62);
      [96, 100, 103, 108].forEach((m, k) => bell(m, t + 0.46 + k * 0.09, 0.12, 1.2, (k - 1.5) * 0.3));
      swoosh(t + 0.3, 0.5, 1500, 9000, 0.06);
    },
  };

  return {
    play(name, arg, at) {
      const fn = S[name];
      if (fn) fn((at == null ? ctx.currentTime : at) + 0.02, arg);
    },
  };
}

// 動画づくり用: 効果音1つを WAV(base64) に書き出す
async function renderSfxWav(name, arg) {
  const sr = 48000, off = new OfflineAudioContext(2, sr * 4, sr);
  makeSynth(off).play(name, arg, 0);
  const buf = await off.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let end = L.length - 1;
  while (end > 0 && Math.abs(L[end]) < 0.0004 && Math.abs(R[end]) < 0.0004) end--;
  const n = Math.min(L.length, end + 2400), bytes = new Uint8Array(44 + n * 4), v = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
