// ドナルゴクエスト 声まわり(音声認識・音量測定・叫びの録音)
// mode: 'both' = 認識と音量を同時に使う / 'swap' = 叫びの時だけ音量を測る / 'rec' = 認識のみ / 'none' = 認識なし(タップ操作)
window.Voice = (function () {
  'use strict';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const st = {
    supported: !!SR, recOn: false, wantRec: false, micOn: false, mode: 'none', pref: 'auto',
    raw: 0, level: 0, db: -100, floor: 0.1, lastErr: '', results: 0, lastText: '', lastResultAt: 0, recStartAt: 0,
    denied: false, simVol: 0, simUntil: 0, log: [],
  };
  let actx = null, rec = null, stream = null, analyser = null, srcNode = null, buf = null, recorder = null, chunks = [];
  let cons = { idx: -1, len: 0 }, cur = { idx: -1, len: 0 }, simConsumed = false;
  let utt = { active: false, start: 0, last: 0, peak: 0 }, lastUtt = null, uttSinceResult = 0, micPeakWin = 0, winStart = 0;
  const cb = { heard() { }, change() { } };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const note = (s) => { st.log.push(new Date().toTimeString().slice(0, 8) + ' ' + s); if (st.log.length > 30) st.log.shift(); cb.change(); };

  // ---------- 音声認識 ----------
  function buildRec() {
    rec = new SR();
    rec.lang = 'ja-JP'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 3;
    rec.onstart = () => { st.recOn = true; st.recStartAt = performance.now(); cons = { idx: -1, len: 0 }; cur = { idx: -1, len: 0 }; cb.change(); };
    rec.onresult = (e) => {
      st.results++; st.lastResultAt = performance.now(); uttSinceResult = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const full = r[0].transcript || '';
        let fresh = full, alts = [];
        if (i < cons.idx) continue;
        if (i === cons.idx) fresh = full.slice(cons.len);
        else for (let k = 1; k < r.length; k++) alts.push(r[k].transcript || '');
        cur = { idx: i, len: full.length };
        st.lastText = full;
        if (fresh.trim()) cb.heard({ text: fresh, alts, final: r.isFinal });
      }
    };
    rec.onerror = (e) => {
      st.lastErr = e.error;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { st.denied = true; st.wantRec = false; }
      if (e.error !== 'no-speech' && e.error !== 'aborted') note('にんしきエラー: ' + e.error);
    };
    rec.onend = () => { st.recOn = false; cb.change(); if (st.wantRec) setTimeout(() => { if (st.wantRec && !st.recOn) { try { rec.start(); } catch (e) { } } }, 120); };
  }
  function startRec() {
    if (!SR) return;
    st.wantRec = true;
    if (!rec) buildRec();
    if (!st.recOn) { try { rec.start(); } catch (e) { } }
  }
  function stopRec() { st.wantRec = false; if (rec) { try { rec.abort(); } catch (e) { } } }
  function consume() { cons = { idx: cur.idx, len: cur.len }; simConsumed = true; }

  // ---------- マイク音量 ----------
  async function startMic() {
    if (st.micOn) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { note('マイクAPIが ありません'); return false; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      srcNode = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0;
      buf = new Float32Array(analyser.fftSize);
      srcNode.connect(analyser);
      st.micOn = true; micPeakWin = 0; winStart = performance.now();
      cb.change();
      return true;
    } catch (e) { note('マイクが つかえません: ' + (e.name || e)); return false; }
  }
  function stopMic() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try { if (srcNode) srcNode.disconnect(); } catch (e) { }
    stream = null; analyser = null; srcNode = null; st.micOn = false; cb.change();
  }
  function thr() { return Math.max(0.3, st.floor + 0.15); }

  function update(now) {
    let raw = 0;
    if (analyser) {
      if (analyser.getFloatTimeDomainData) analyser.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      st.db = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-7);
      raw = clamp((st.db + 60) / 60);
    }
    if (now < st.simUntil) raw = Math.max(raw, st.simVol);
    st.raw = raw;
    st.level = raw > st.level ? raw : st.level + (raw - st.level) * 0.2;
    if (raw > micPeakWin) micPeakWin = raw;
    const th = thr();
    if (raw > th) {
      if (!utt.active) { utt = { active: true, start: now, last: now, peak: raw }; uttSinceResult++; }
      else { utt.last = now; if (raw > utt.peak) utt.peak = raw; if (now - utt.start > 7000) { st.floor = raw * 0.92; } }
    } else {
      if (utt.active && now - utt.last > 280) { utt.active = false; lastUtt = { start: utt.start, end: utt.last, peak: utt.peak }; }
      st.floor += raw < st.floor ? (raw - st.floor) * 0.3 : 0.0004;
    }
    // 認識と音量測定が同時に動かない端末を見つけて、叫びの時だけ測る方式に切り替える
    if (st.pref === 'auto' && st.mode === 'both' && now - winStart > 5000) {
      const recentResult = now - st.lastResultAt < 5000;
      if (recentResult && micPeakWin < 0.06) switchSwap('マイクの おとが とれないため');
      else if (uttSinceResult >= 3 && now - Math.max(st.lastResultAt, st.recStartAt) > 8000) switchSwap('にんしきが うごかないため');
      micPeakWin = 0; winStart = now;
    }
  }
  function switchSwap(why) {
    note(why + '「さけびの ときだけ はかる」に きりかえ');
    st.mode = 'swap'; stopMic();
    if (rec) { try { rec.abort(); } catch (e) { } }
    uttSinceResult = 0;
  }

  // ---------- 開始 ----------
  async function begin(audioCtx, pref) {
    actx = audioCtx; st.pref = pref || st.pref;
    stopRec(); stopMic();
    let mic = false;
    if (st.pref === 'auto' || st.pref === 'both') mic = await startMic();
    if (SR) { startRec(); st.mode = mic ? 'both' : (st.pref === 'swap' ? 'swap' : 'rec'); }
    else st.mode = 'none';
    note('かいし: mode=' + st.mode + (SR ? '' : '(おんせいにんしき ひたいおう)'));
    return st.mode;
  }
  // 叫びフェーズの出入り。swap 方式ではここで認識とマイクを入れ替える
  async function shoutPhase(on) {
    if (st.mode === 'swap' || (st.mode === 'none' && st.pref !== 'off')) {
      if (on) { stopRec(); await startMic(); }
      else { stopMic(); if (st.mode === 'swap') startRec(); }
    }
  }
  function recordStart() {
    recorder = null; chunks = [];
    if (!stream || !window.MediaRecorder) return false;
    try { recorder = new MediaRecorder(stream); recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); }; recorder.start(); return true; }
    catch (e) { recorder = null; note('ろくおん できません: ' + (e.name || e)); return false; }
  }
  function recordStop() {
    return new Promise((res) => {
      if (!recorder) return res(null);
      const r = recorder; recorder = null;
      const done = () => res(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: r.mimeType || 'audio/webm' })) : null);
      r.onstop = done;
      try { r.stop(); } catch (e) { done(); }
      setTimeout(done, 1500);
    });
  }

  // ---------- テスト用の擬似発声 ----------
  function sim(text, vol = 0.85, dur = 1400) {
    const now = performance.now();
    st.simVol = vol; st.simUntil = now + dur; simConsumed = false;
    st.lastText = text;
    setTimeout(() => cb.heard({ text, alts: [], final: false, sim: true }), Math.min(350, dur * 0.5));
    setTimeout(() => { if (!simConsumed) cb.heard({ text, alts: [], final: true, sim: true }); }, dur + 60);
  }
  function simLevel(vol, dur) { st.simVol = vol; st.simUntil = performance.now() + dur; }

  const volOK = () => (st.micOn && st.mode === 'both') || performance.now() < st.simUntil;
  const levelOK = () => st.micOn || performance.now() < st.simUntil;

  return {
    st, begin, startRec, stopRec, startMic, stopMic, consume, update, shoutPhase, recordStart, recordStop, sim, simLevel, volOK, levelOK, thr,
    utt: () => utt, lastUtt: () => lastUtt,
    on(k, f) { cb[k] = f; },
  };
})();
