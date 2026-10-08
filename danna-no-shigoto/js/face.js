// 旦那の仕事は妻を笑顔にすること  妻の顔(機嫌 -1〜+1 でなめらかに表情が変わる)
window.Face = (function () {
  'use strict';
  const W = 360;
  const S = { m: 0, target: 0, talking: false, t: 0, burst: null, bt: 0, blink: 0, nextBlink: 2.5, hearts: [], spawn: 0 };
  let cv = null, c = null;

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function mix(a, b, t) { const x = hex(a), y = hex(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; }
  // 機嫌が悪い色・ふつうの色・ごきげんな色を、機嫌の値でまぜる
  function mix3(bad, mid, good, m) { return m < 0 ? mix(mid, bad, Math.min(1, -m)) : mix(mid, good, Math.min(1, m)); }

  function init(canvas) {
    cv = canvas; c = cv.getContext('2d');
    const d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = W * d; c.setTransform(d, 0, 0, d, 0, 0);
  }
  function burst(kind, dur) { S.burst = kind; S.bt = dur || 1.1; }

  function update(dt) {
    S.t += dt;
    let tg = S.target;
    if (S.bt > 0) { S.bt -= dt; if (S.burst === 'angry') tg = -1; else if (S.burst === 'happy') tg = 1; } else S.burst = null;
    S.m += (tg - S.m) * Math.min(1, dt * 6);
    S.nextBlink -= dt;
    if (S.nextBlink <= 0) { S.blink = 0.14; S.nextBlink = 2 + Math.random() * 3; }
    if (S.blink > 0) S.blink -= dt;
    if (S.m > 0.55) {
      S.spawn -= dt;
      if (S.spawn <= 0) { S.spawn = 0.5 - 0.3 * S.m; S.hearts.push({ x: 30 + Math.random() * 300, y: 370, v: 40 + Math.random() * 40, s: 8 + Math.random() * 10, w: Math.random() * 6 }); }
    }
    for (const h of S.hearts) h.y -= h.v * dt;
    S.hearts = S.hearts.filter(h => h.y > -30);
  }

  function ell(x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  function heart(x, y, s) {
    c.beginPath(); c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.6, y - s * 0.3, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
    c.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.3, x, y + s * 0.9); c.fill();
  }

  function draw() {
    if (!c) return;
    const m = S.m, t = S.t, am = Math.max(0, -m), hm = Math.max(0, m);
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.roundRect ? c.roundRect(0, 0, W, W, 30) : c.rect(0, 0, W, W); c.clip();
    const g = c.createLinearGradient(0, 0, 0, W);
    g.addColorStop(0, mix3('#241530', '#fff3da', '#ffe6ee', m));
    g.addColorStop(1, mix3('#6b1d3a', '#ffdcae', '#ffb9cf', m));
    c.fillStyle = g; c.fillRect(0, 0, W, W);

    // ごきげん: 後光
    if (m > 0.45) {
      c.save(); c.translate(180, 190); c.rotate(t * 0.25); c.fillStyle = 'rgba(255,255,255,' + ((m - 0.45) * 0.55) + ')';
      for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(-22, -330); c.lineTo(22, -330); c.fill(); }
      c.restore();
    }
    // 不機嫌: 黒いオーラとゴゴゴ
    if (m < -0.4) {
      const a = (am - 0.4) / 0.6;
      c.fillStyle = 'rgba(15,0,25,' + (0.6 * a) + ')';
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const an = i / 40 * Math.PI * 2, r = (i % 2 ? 150 : 178) + Math.sin(t * 7 + i * 1.9) * 12 * a;
        c[i ? 'lineTo' : 'moveTo'](180 + Math.cos(an) * r, 185 + Math.sin(an) * r * 1.02);
      }
      c.fill();
      c.font = '900 30px sans-serif'; c.fillStyle = 'rgba(255,90,90,' + a + ')';
      [[22, 60], [292, 96], [16, 300], [300, 318]].forEach((p, i) => c.fillText('ゴ', p[0] + Math.sin(t * 23 + i * 2) * 2.5 * a, p[1] + Math.cos(t * 19 + i) * 2.5 * a));
    }
    for (const h of S.hearts) { c.fillStyle = 'rgba(255,95,140,' + Math.min(0.85, h.y / 120) + ')'; heart(h.x + Math.sin(t * 2 + h.w) * 8, h.y, h.s); }

    // 怒りで小きざみにふるえる
    const sh = S.burst === 'angry' ? 5 : am > 0.7 ? 1.2 : 0;
    c.translate(Math.sin(t * 61) * sh, Math.cos(t * 53) * sh * 0.6 + Math.sin(t * 2) * 1.5 + (S.burst === 'happy' ? -Math.abs(Math.sin(t * 9)) * 7 : 0));

    const HAIR = '#4b2e1f', HAIR2 = '#6a4530', SKIN = mix('#ffe2c8', '#ffb9a4', Math.max(0, (am - 0.5) * 1.6)), SKIN2 = '#f3c3a4', LINE = '#3a2218';
    // うしろ髪
    c.fillStyle = HAIR; ell(180, 176, 124, 126); c.fill();
    c.beginPath(); c.moveTo(58, 170); c.quadraticCurveTo(46, 280, 92, 302); c.lineTo(268, 302); c.quadraticCurveTo(314, 280, 302, 170); c.fill();
    // 首と肩
    c.fillStyle = SKIN2; c.fillRect(158, 270, 44, 50);
    c.fillStyle = mix3('#7c4a63', '#f08a7b', '#ff7f9c', m); ell(180, 384, 158, 82); c.fill();
    c.fillStyle = '#fff8ef'; c.beginPath(); c.moveTo(150, 304); c.quadraticCurveTo(180, 338, 210, 304); c.lineTo(222, 312); c.quadraticCurveTo(180, 362, 138, 312); c.fill();
    // 顔
    c.fillStyle = SKIN2; ell(92, 204, 12, 18); c.fill(); ell(268, 204, 12, 18); c.fill();
    c.fillStyle = SKIN; ell(180, 198, 90, 100); c.fill();
    // 目もとの影(激怒)
    if (am > 0.7) {
      c.save(); ell(180, 198, 90, 100); c.clip();
      const sg = c.createLinearGradient(0, 100, 0, 215);
      sg.addColorStop(0, 'rgba(40,10,60,' + ((am - 0.7) * 2.2) + ')'); sg.addColorStop(1, 'rgba(40,10,60,0)');
      c.fillStyle = sg; c.fillRect(80, 90, 200, 130); c.restore();
    }
    // ほお
    c.fillStyle = 'rgba(255,120,130,' + (0.22 + 0.45 * hm) + ')'; ell(126, 228, 20, 12); c.fill(); ell(234, 228, 20, 12); c.fill();
    // 前髪
    c.fillStyle = HAIR;
    c.beginPath(); c.moveTo(84, 214); c.bezierCurveTo(74, 100, 134, 74, 180, 74); c.bezierCurveTo(226, 74, 286, 100, 276, 214);
    c.quadraticCurveTo(272, 160, 244, 138); c.quadraticCurveTo(206, 168, 150, 132); c.quadraticCurveTo(100, 150, 84, 214); c.fill();
    c.strokeStyle = HAIR2; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(150, 92); c.quadraticCurveTo(138, 112, 140, 130); c.moveTo(205, 90); c.quadraticCurveTo(222, 112, 220, 146); c.stroke();

    // まゆ
    const ba = m < 0 ? am * 13 : -hm * 3, by = 160 - hm * 5 + am * 5;
    c.strokeStyle = LINE; c.lineWidth = 5 + am * 2;
    c.beginPath(); c.moveTo(122, by - ba); c.lineTo(160, by + ba); c.moveTo(238, by - ba); c.lineTo(200, by + ba); c.stroke();

    // 目
    const blink = S.blink > 0;
    [[142, 1], [218, -1]].forEach(([ex, dir]) => {
      const ey = 192;
      if (m > 0.5 || (blink && m > -0.5)) {
        c.strokeStyle = LINE; c.lineWidth = 5; c.beginPath();
        if (m > 0.5) { c.moveTo(ex - 15, ey + 4); c.quadraticCurveTo(ex, ey - 14, ex + 15, ey + 4); }
        else { c.moveTo(ex - 12, ey); c.lineTo(ex + 12, ey); }
        c.stroke();
      } else if (m < -0.45) {
        c.fillStyle = '#fff'; ell(ex, ey, 16, 12); c.fill();
        c.fillStyle = LINE; ell(ex + dir * 3, ey + 2, 6 - am * 1.5, 7); c.fill();
        // ジト目のまぶた
        c.fillStyle = SKIN; c.beginPath(); c.moveTo(ex - 20, ey - 16); c.lineTo(ex + 20, ey - 16); c.lineTo(ex + 20, ey - 3 + dir * am * 6); c.lineTo(ex - 20, ey - 3 - dir * am * 6); c.fill();
        c.strokeStyle = LINE; c.lineWidth = 4; c.beginPath(); c.moveTo(ex - 18, ey - 3 - dir * am * 6); c.lineTo(ex + 18, ey - 3 + dir * am * 6); c.stroke();
      } else {
        c.fillStyle = LINE; ell(ex, ey, 10, 13); c.fill();
        c.fillStyle = '#fff'; ell(ex + 3, ey - 5, 3.5, 4.5); c.fill();
      }
    });

    // 口
    const mx = 180, my = 244, mw = 24 + Math.abs(m) * 10;
    if (S.talking) {
      const o = 5 + Math.abs(Math.sin(t * 14)) * 11;
      c.fillStyle = '#9c2f3a'; ell(mx, my + (m < -0.3 ? 2 : 0), 13 + hm * 6, o); c.fill();
    } else if (m > 0.7) {
      c.fillStyle = '#9c2f3a'; c.beginPath(); c.moveTo(mx - mw, my - 6); c.quadraticCurveTo(mx, my + 40, mx + mw, my - 6); c.closePath(); c.fill();
      c.fillStyle = '#ff8f9c'; ell(mx, my + 12, 12, 6); c.fill();
    } else {
      c.strokeStyle = LINE; c.lineWidth = 5; c.beginPath();
      c.moveTo(mx - mw, my - m * 6); c.quadraticCurveTo(mx, my + m * 26, mx + mw, my - m * 6); c.stroke();
    }
    // 怒りマーク
    if (m < -0.45) {
      const s = 1 + Math.sin(t * 9) * 0.12; c.save(); c.translate(262, 112); c.scale(s, s);
      c.strokeStyle = '#ff3b3b'; c.lineWidth = 5; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(5, 16); c.quadraticCurveTo(5, 5, 16, 5); c.stroke(); }
      c.restore();
    }
    c.restore();
  }

  return { S, init, update, draw, burst };
})();
