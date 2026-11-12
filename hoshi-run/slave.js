// ふたりで あそぶ：同じゲームを 左右に 2つ ならべる ための 子がわの 部品（two.html の iframe の中で だけ 動く）
// ・カメラは 親（two.html）が 左右半分に 切って わたす（getUserMedia を すりかえる）
// ・乱数は 同じ たね（?seed=）にして 2人に 同じ ことが 起きるように する
// ・2P（?slave=1）の 音と 声は 消す
// ・ゲームの 最後に SLAVE.report({ score, higher, text }) を 呼ぶ と、親が かち・まけ を 出す
(function () {
  var q = new URLSearchParams(location.search), si = q.get('slave');
  if (si === null) { window.SLAVE = null; return; }
  var idx = +si || 0, seed = (+q.get('seed') || 1) >>> 0;
  var S = window.SLAVE = {
    idx: idx, lv: q.get('lv'), opt: q.get('opt'),
    report: function (d) { d = d || {}; d.type = 'twoReport'; d.idx = idx; try { parent.postMessage(d, '*'); } catch (e) {} },
    // 読みこみが すんだあと、条件が そろったら 1回だけ 実行する（ボタンが まだ 無い間は まつ）
    // ゲームが ほんとうに はじまった しゅんかんに 呼ぶ（親の ちょうせん時間の はかり はじめに つかう）
    started: function () { try { parent.postMessage({ type: 'twoStart', idx: idx }, '*'); } catch (e) {} },
    onEnd: null,   // 親から「じかん おわり」が 来たら 呼ばれる（ここで report する）
    when: function (cond, fn, tries) {
      var n = 0, t = setInterval(function () {
        var ok = false; try { ok = cond(); } catch (e) {}
        if (ok) { clearInterval(t); try { fn(); } catch (e) { console.error(e); } }
        else if (++n > (tries || 100)) clearInterval(t);
      }, 100);
    },
    click: function (sel, delay) {
      S.when(function () { var el = document.querySelector(sel); return document.readyState === 'complete' && el && !el.disabled; }, function () { setTimeout(function () { document.querySelector(sel).click(); }, 300 + (delay || 0)); });
    }
  };
  addEventListener('message', function (e) { if (e.data && e.data.type === 'twoEnd' && S.onEnd) { try { S.onEnd(); } catch (er) { console.error(er); } } });
  // セーブは 1P・2P で べつべつ（毎回 はじめから）
  try {
    var pre = '__2p' + idx + '_', sp = Storage.prototype, g0 = sp.getItem, s0 = sp.setItem, r0 = sp.removeItem;
    var ks = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(pre) === 0) ks.push(k); }
    ks.forEach(function (k) { r0.call(localStorage, k); });
    sp.getItem = function (k) { return this === localStorage ? g0.call(this, pre + k) : g0.call(this, k); };
    sp.setItem = function (k, v) { return this === localStorage ? s0.call(this, pre + k, v) : s0.call(this, k, v); };
    sp.removeItem = function (k) { return this === localStorage ? r0.call(this, pre + k) : r0.call(this, k); };
  } catch (e) {}
  // 同じ たねの 乱数
  var a = seed;
  Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // カメラ：親が 切った 半分の 映像
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = function (c) {
      var st = parent.__twoStreams && parent.__twoStreams[idx];
      if (!st) return Promise.reject(new DOMException('no camera', 'NotAllowedError'));
      if (c && c.audio && !c.video) return Promise.reject(new DOMException('no mic', 'NotAllowedError'));
      return Promise.resolve(st);
    };
  }
  // 2P は 音を 出さない
  if (idx === 1) {
    var oc = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (d) { if (d && d.constructor && d.constructor.name === 'AudioDestinationNode') return d; return oc.apply(this, arguments); };
    if (window.speechSynthesis) try { speechSynthesis.speak = function () {}; } catch (e) {}
    var op = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (this.tagName === 'AUDIO') { this.muted = true; } return op.apply(this, arguments); };
  }
  // 半分の 画面は たてに 近いので「よこにしてね」を 出さない
  var hs = document.createElement('style'); hs.textContent = '#rotate,#portraitTip,.rotate-tip{display:none!important}'; (document.head || document.documentElement).appendChild(hs);
  // 画面の 左右の はしに「1P」「2P」
  document.addEventListener('DOMContentLoaded', function () {
    var d = document.createElement('div');
    d.textContent = (idx + 1) + 'P';
    d.style.cssText = 'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:99999;padding:2px 14px;border-radius:999px;font:800 20px sans-serif;color:#fff;border:2px solid #fff;pointer-events:none;background:' + (idx ? '#e04a9b' : '#1fa7c9');
    document.body.appendChild(d);
  });
})();
