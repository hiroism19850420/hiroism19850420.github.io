// 旦那の仕事は妻を笑顔にすること  声まわり(音声認識・声の大きさ)
// 音声認識は「聞いている間だけ」動かす(妻の読み上げを拾わないため。Android の開始音も減らせる)
window.Voice = (function () {
  'use strict';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // Android の Chrome は、マイクを getUserMedia でつかんでいる間は音声認識に音が届かない
  const ANDROID = /Android/i.test(navigator.userAgent);
  const st = { supported: !!SR, recOn: false, want: false, micOn: false, volOK: false, denied: false, raw: 0, level: 0, lastErr: '' };
  let rec = null, sess = 0, stream = null, analyser = null, srcNode = null, buf = null, peak = 0, simPeak = null;
  const cb = { heard() { }, change() { } };
  const clamp = (v) => Math.max(0, Math.min(1, v));

  // ---------- 音声認識 ----------
  // 1回ごとに新しく作りなおす(使い回すと Android で再開に失敗することがある)
  function go() {
    if (!st.want || rec || !SR) return;
    const r = rec = new SR(), s = ++sess;
    r.lang = 'ja-JP'; r.continuous = !ANDROID; r.interimResults = true; r.maxAlternatives = 3;
    r.onstart = () => { st.recOn = true; cb.change(); };
    r.onresult = (e) => {
      if (rec !== r || !st.want) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const x = e.results[i], alts = [];
        for (let k = 1; k < x.length; k++) alts.push(x[k].transcript || '');
        const text = x[0].transcript || '';
        if (text.trim()) cb.heard({ id: s + '-' + i, text, alts, final: x.isFinal });
      }
    };
    r.onerror = (e) => {
      st.lastErr = e.error;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { st.denied = true; st.want = false; cb.change(); }
    };
    r.onend = () => { if (rec === r) rec = null; st.recOn = false; cb.change(); if (st.want) setTimeout(go, 150); };
    try { r.start(); } catch (e) { rec = null; st.lastErr = 'start: ' + (e.name || e); setTimeout(go, 400); }
  }
  function listen(on) {
    if (on) { peak = 0; simPeak = null; if (st.want) return; st.want = true; go(); }
    else { st.want = false; if (rec) { try { rec.abort(); } catch (e) { } } }
  }

  // ---------- 声の大きさ ----------
  async function startMic(actx) {
    if (st.micOn || ANDROID) return st.micOn;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      srcNode = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0;
      buf = new Float32Array(analyser.fftSize);
      srcNode.connect(analyser);
      st.micOn = true; st.volOK = true; cb.change();
      return true;
    } catch (e) {
      st.lastErr = 'mic: ' + (e.name || e);
      if (e && e.name === 'NotAllowedError') st.denied = true;
      return false;
    }
  }
  function stopMic() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try { if (srcNode) srcNode.disconnect(); } catch (e) { }
    stream = null; analyser = null; srcNode = null; st.micOn = false; st.volOK = false; cb.change();
  }
  function update() {
    let raw = 0;
    if (analyser) {
      analyser.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      raw = clamp((20 * Math.log10(Math.sqrt(s / buf.length) + 1e-7) + 60) / 60);
    }
    if (simPeak != null) raw = Math.max(raw, simPeak * 0.999);
    st.raw = raw;
    st.level = raw > st.level ? raw : st.level + (raw - st.level) * 0.2;
    if (raw > peak) peak = raw;
  }
  // 前回の呼び出しからの最大音量。測れない端末では null
  function takePeak() {
    const p = simPeak != null ? simPeak : (st.micOn && st.volOK ? peak : null);
    peak = 0; simPeak = null;
    return p;
  }
  function peekPeak() { return simPeak != null ? simPeak : peak; }

  return {
    st, ANDROID, listen, startMic, stopMic, update, takePeak, peekPeak,
    sim(v) { simPeak = v; },
    on(k, f) { cb[k] = f; },
  };
})();
