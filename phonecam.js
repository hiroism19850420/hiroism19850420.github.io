// スマホを PC のカメラにする（全身ゲーム共通）
// 使い方：<script src="https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js"></script>
//         <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
//         <script src="../phonecam.js"></script>
//   PhoneCam.open({ onStream: stream => { video.srcObject = stream; ... }, onLost: () => {...} })
// PC 側に QR を出し、スマホ（/phonecam/）から 送られてくる 映像を うけとる。
(function () {
  const PREFIX = 'hiro-pcam-';
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const SRC = document.currentScript ? document.currentScript.src : location.href;
  let peer = null, box = null, call = null, retry = 0, data = null, keep = null;

  function css() {
    if (document.getElementById('pcamCss')) return;
    const s = document.createElement('style'); s.id = 'pcamCss';
    s.textContent = `
#pcamBox{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(6,10,30,.88);font-family:"Hiragino Maru Gothic ProN","BIZ UDPGothic","Yu Gothic UI",sans-serif;color:#fff;padding:16px;box-sizing:border-box;overflow-y:auto}
#pcamBox .in{background:#fff;color:#23306b;border-radius:18px;padding:20px 24px;max-width:560px;width:100%;display:flex;gap:20px;align-items:center;flex-wrap:wrap;justify-content:center;box-shadow:0 8px 30px #0008}
#pcamBox .qr{background:#fff;padding:8px;border-radius:10px;border:3px solid #23306b;width:190px;height:190px;box-sizing:content-box;display:flex;align-items:center;justify-content:center}
#pcamBox .qr img,#pcamBox .qr canvas{display:block}
#pcamBox .tx{flex:1;min-width:220px;text-align:left;font-size:15px;line-height:1.6}
#pcamBox h2{margin:0 0 6px;font-size:21px}
#pcamBox ol{margin:6px 0;padding-left:1.3em}
#pcamBox .code{font-size:13px;opacity:.75}
#pcamBox .code b{font-size:20px;letter-spacing:.15em;opacity:1}
#pcamBox .mic{display:flex;align-items:center;gap:8px;margin:8px 0 2px;font-weight:700;cursor:pointer}
#pcamBox .mic input{width:22px;height:22px}
#pcamBox .st{margin-top:8px;font-weight:700;color:#d2481e;min-height:1.6em}
#pcamBox button{font:inherit;font-weight:700;font-size:15px;margin-top:6px;border:0;border-radius:999px;padding:9px 20px;background:#cfe0ff;color:#23306b;box-shadow:0 4px 0 #7a8fc4;cursor:pointer}
#pcamBadge{position:fixed;left:8px;bottom:8px;transition:opacity .6s;z-index:9998;font:700 12px "Hiragino Maru Gothic ProN","BIZ UDPGothic",sans-serif;background:rgba(0,0,0,.55);color:#9ff5b0;padding:4px 10px;border-radius:999px;pointer-events:none}
#pcamBadge.ng{color:#ffb0a0}`;
    document.head.appendChild(s);
  }
  function badge(txt, ng) {
    let b = document.getElementById('pcamBadge');
    if (!txt) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'pcamBadge'; document.body.appendChild(b); }
    b.textContent = txt; b.classList.toggle('ng', !!ng); b.style.opacity = 1;
    clearTimeout(badge.t); if (!ng) badge.t = setTimeout(() => { b.style.opacity = 0; }, 4000);
  }
  function say(t) { const st = box && box.querySelector('.st'); if (st) st.textContent = t; }
  function close() {
    if (box) { box.remove(); box = null; }
  }
  function stop() {
    try { call && call.close(); } catch (e) {}
    try { peer && peer.destroy(); } catch (e) {}
    call = null; peer = null; data = null; PhoneCam.micOn = false; badge('');
  }

  // opt.onStream(stream)：映像が とどいたとき（つなぎ直しでも また よばれる）
  // opt.onLost()：スマホと きれたとき
  // opt.onCancel()：「やめる」を おしたとき
  // opt.mic：true なら「マイクも スマホを つかう」を 出す。えらぶと 音が べつの つなぎで とどき、opt.onAudio(stream) が よばれ、PhoneCam.micOn が true になる
  // opt.onData(obj)：スマホから とどいた データ（音声にんしきの 結果など）。PhoneCam.send(obj) で スマホへ おくる
  function open(opt) {
    opt = opt || {};
    css(); close(); stop();
    if (typeof Peer === 'undefined') { alert('つうしんの ぶひんが よみこめませんでした。ネットに つながっているか たしかめてください。'); return; }
    let code = '';
    for (let i = 0; i < 5; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
    let mic = false;
    try { mic = localStorage.getItem('pcamMic') === '1'; } catch (e) {}
    const url = () => new URL('phonecam/?r=' + code + (opt.mic && mic ? '&mic=1' : ''), SRC).href;
    box = document.createElement('div'); box.id = 'pcamBox';
    box.innerHTML = `<div class="in"><div class="qr"></div><div class="tx">
<h2>📱 スマホを カメラにする</h2>
<ol><li>スマホの カメラで この QR を よみとる</li><li>ひらいた ページで カメラを きょかする</li><li>スマホを <b>横向き</b>に たてかけて、<b>ぜんしん</b>が うつる ところに おく</li></ol>
${opt.mic ? '<label class="mic"><input type="checkbox"> 🎤 マイクも スマホを つかう</label>' : ''}
<div class="code">PC と スマホは <b>おなじ Wi-Fi</b> に つないでね。　あいことば <b>${code}</b></div>
<div class="st">PC の じゅんび中…</div>
<button class="cancel">やめる</button></div></div>`;
    document.body.appendChild(box);
    const st = box.querySelector('.st');
    box.querySelector('.cancel').onclick = () => { close(); stop(); opt.onCancel && opt.onCancel(); };
    const drawQr = () => {
      const q = box.querySelector('.qr'); q.innerHTML = '';
      if (typeof QRCode !== 'undefined') new QRCode(q, { text: url(), width: 190, height: 190, correctLevel: QRCode.CorrectLevel.M });
      else q.textContent = url();
    };
    drawQr();
    const cb = box.querySelector('.mic input');
    if (cb) {
      cb.checked = mic;
      // PC に マイクが ひとつも ないときは、さいしょから スマホの マイクに する
      if (!mic && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(ds => {
          if (box && !ds.some(d => d.kind === 'audioinput')) { mic = cb.checked = true; drawQr(); }
        }).catch(() => {});
      }
      cb.onchange = () => { mic = cb.checked; try { localStorage.setItem('pcamMic', mic ? '1' : '0'); } catch (e) {} drawQr(); };
    }

    const start = () => {
      peer = new Peer(PREFIX + code);
      peer.on('open', () => { retry = 0; if (st) st.textContent = 'スマホを まっています…'; });
      peer.on('error', e => {
        if (e.type === 'unavailable-id' && retry++ < 3) { setTimeout(() => open(opt), 300); return; }
        retry = 0;
        if (box) st.textContent = 'つうしんエラー（' + (e.type || e) + '）。もういちど ためしてね';
        else badge('📱 つうしんエラー', true);
      });
      peer.on('call', c => {
        // 音だけの つなぎ（スマホの マイク）
        if (c.metadata && c.metadata.kind === 'audio') {
          c.answer();
          c.on('stream', st => {
            PhoneCam.micOn = st.getAudioTracks().length > 0;
            // Chrome は WebRTC の 音を いちど audio 要素に つながないと WebAudio に 流れないことがある
            keep = keep || new Audio(); keep.muted = true; keep.srcObject = st; keep.play().catch(() => {});
            opt.onAudio && opt.onAudio(st);
          });
          c.on('error', () => {});
          return;
        }
        try { call && call.close(); } catch (e) {}
        call = c;
        if (box) st.textContent = 'つないでいます…';
        c.answer();
        c.on('stream', stream => {
          if (call !== c) return;
          PhoneCam.wantMic = !!(opt.mic && mic);   // スマホの マイクを えらんだか（音は べつの つなぎで くる）
          say('✅ スマホと つながった！ ゲームを じゅんび中…');
          badge('📱 スマホカメラ');
          // ゲームの じゅんびが おわるまで パネルを 出したまま、ようすを 見せる
          Promise.resolve(opt.onStream && opt.onStream(stream)).then(ok => { if (ok !== false) close(); }, e => say('ゲームを はじめられませんでした（' + (e && e.message || e) + '）'));
        });
        const lost = () => { if (call === c && !c.lostShown) { c.lostShown = true; badge('📱 スマホと きれた。スマホの ページを ひらき直してね', true); opt.onLost && opt.onLost(); } };
        c.on('close', lost);
        const pc = c.peerConnection;
        if (pc) pc.addEventListener('iceconnectionstatechange', () => {
          const s = pc.iceConnectionState;
          if (s === 'failed' || s === 'closed' || s === 'disconnected') lost();
          else if ((s === 'connected' || s === 'completed') && c.lostShown) { c.lostShown = false; badge('📱 スマホカメラ'); }
        });
        c.on('error', () => {});
      });
      peer.on('connection', dc => {
        data = dc;
        dc.on('data', d => { if (data === dc && opt.onData) opt.onData(d); });
        dc.on('close', () => { if (data === dc) data = null; });
      });
      // スマホが つなぎ直しを したときに そなえて、きれても PC は まちつづける
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    };
    start();
  }

  function send(o) { try { data && data.open && data.send(o); } catch (e) {} }
  window.PhoneCam = { open, stop, close, say, send, micOn: false, wantMic: false };
})();
