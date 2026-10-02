// ドナルゴクエスト 演出(パーティクル・稲妻・画面フラッシュ・揺れ・ダメージ数字)
window.FX = (function () {
  'use strict';
  let field, cv, g, flashEl, floatEl, W = 0, H = 0, dpr = 1;
  let ps = [], bolts = [], shakeT = 0, shakeDur = 1, shakeAmp = 0, dark = 0, darkTo = 0;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];

  function init() {
    field = document.getElementById('field'); cv = document.getElementById('fx'); g = cv.getContext('2d');
    flashEl = document.getElementById('flash'); floatEl = document.getElementById('floaters');
    resize(); window.addEventListener('resize', resize);
  }
  function resize() {
    const r = field.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function p(o) {
    if (ps.length > 900) return;
    ps.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 1, t: 0, size: 6, grow: 0, color: '#fff', shape: 'c', rot: 0, vr: 0, add: true, delay: 0, w: 3 }, o));
  }
  const U = () => Math.min(W, H) / 100;   // 画面サイズに比例する単位

  function flash(color = '#fff', a = 0.8, dur = 260) {
    flashEl.style.background = color;
    flashEl.animate([{ opacity: a }, { opacity: 0 }], { duration: dur, easing: 'ease-out' });
  }
  function shake(amp = 6, dur = 0.4) { shakeAmp = Math.max(shakeAmp, amp); shakeT = dur; shakeDur = dur; }
  function darken(v) { darkTo = v; }
  function floater(text, x, y, cls = '') {
    const d = document.createElement('div'); d.className = 'dmg ' + cls; d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    floatEl.appendChild(d); setTimeout(() => d.remove(), 1200);
  }

  // ---------- 呪文ごとの演出(pw: 0〜1 の威力) ----------
  function fire(x, y, pw) {
    const u = U(), n = 40 + pw * 70;
    for (let i = 0; i < n; i++) p({ x: x + R(-9, 9) * u, y: y + R(0, 14) * u, vx: R(-14, 14) * u, vy: R(-70, -20) * u * (1 + pw * .6), life: R(.45, .95), size: R(2.5, 6) * u * (1 + pw * .5), grow: -3 * u, color: pick(['#ffe14d', '#ff9a1c', '#ff4a1c', '#fff3a0']), delay: R(0, .18) });
    p({ x, y, life: .45, size: 4 * u, grow: 70 * u * (1 + pw), color: '#ff7a1c', shape: 'c' });
    p({ x, y, life: .5, size: 6 * u, grow: 90 * u * (1 + pw), color: '#ffd24a', shape: 'r', w: 1.2 * u });
    flash('#ff8a1c', .35 + pw * .25, 240); shake(3 + pw * 6, .3);
  }
  function ice(x, y, pw) {
    const u = U(), n = 14 + pw * 16;
    for (let i = 0; i < n; i++) { const a = R(0, Math.PI * 2), sp = R(20, 60) * u; p({ x, y: y - 6 * u, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R(.5, .9), size: R(3, 7) * u * (1 + pw * .4), color: pick(['#e6fbff', '#9fe8ff', '#5bc8ff']), shape: 'd', rot: R(0, 6), vr: R(-6, 6), drag: 2.2, delay: .12 }); }
    for (let i = 0; i < 6 + pw * 6; i++) p({ x: x + R(-16, 16) * u, y: -4 * u, vx: 0, vy: R(120, 170) * u, life: .22, size: R(5, 9) * u, color: '#cdf6ff', shape: 'd', rot: 0, delay: i * .015 });
    for (let i = 0; i < 30; i++) p({ x: x + R(-22, 22) * u, y: y + R(-22, 12) * u, vx: R(-6, 6) * u, vy: R(4, 16) * u, life: R(.7, 1.3), size: R(.6, 1.6) * u, color: '#fff', delay: R(.1, .4) });
    p({ x, y, life: .5, size: 5 * u, grow: 80 * u * (1 + pw), color: '#bff2ff', shape: 'r', w: 1.2 * u, delay: .12 });
    flash('#bff2ff', .4 + pw * .25, 300); shake(3 + pw * 5, .3);
  }
  function bolt(x0, y0, x1, y1, life = .3, color = '#ffe95a', w = 1) {
    const pts = [[x0, y0]], n = 9;
    for (let i = 1; i < n; i++) { const k = i / n; pts.push([x0 + (x1 - x0) * k + R(-7, 7) * U(), y0 + (y1 - y0) * k + R(-2, 2) * U()]); }
    pts.push([x1, y1]); bolts.push({ pts, life, t: 0, color, w });
  }
  function thunder(x, y, pw) {
    const u = U(), n = 2 + Math.round(pw * 3);
    for (let i = 0; i < n; i++) setTimeout(() => { bolt(x + R(-26, 26) * u, -2 * u, x + R(-5, 5) * u, y + R(-4, 8) * u, .28, '#ffe95a', 1 + pw); flash('#fffbd0', .55, 140); }, i * 90);
    for (let i = 0; i < 26 + pw * 30; i++) { const a = R(0, Math.PI * 2), sp = R(30, 90) * u; p({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R(.2, .5), size: R(1, 2.4) * u, color: pick(['#fff', '#ffe95a']), drag: 3, delay: .05 }); }
    shake(5 + pw * 7, .35);
  }
  function heal(x, y, pw) {
    const u = U();
    for (let i = 0; i < 36 + pw * 30; i++) p({ x: x + R(-34, 34) * u, y: y + R(-4, 10) * u, vx: R(-4, 4) * u, vy: R(-46, -16) * u, life: R(.7, 1.3), size: R(1.2, 3) * u, color: pick(['#7dffa0', '#d6ffe0', '#fff']), shape: pick(['c', 'x']), delay: R(0, .4) });
    p({ x, y, life: .7, size: 4 * u, grow: 70 * u, color: '#7dffa0', shape: 'r', w: 1 * u });
    flash('#7dffa0', .3, 400);
  }
  function burst(x, y, n, colors, sp, life, size) {
    const u = U();
    for (let i = 0; i < n; i++) { const a = R(0, Math.PI * 2), s = R(sp * .25, sp) * u; p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: R(life * .5, life), size: R(size * .5, size) * u, color: pick(colors), drag: 1.6 }); }
  }
  function destroy(x, y, pw) {
    const u = U();
    for (let i = 0; i < 40; i++) { const a = R(0, Math.PI * 2), d = R(40, 70) * u; p({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.2, vy: -Math.sin(a) * d * 2.2, life: .44, size: R(1.5, 3) * u, color: pick(['#c98aff', '#fff']) }); }
    setTimeout(() => {
      burst(x, y, 110 + pw * 60, ['#fff', '#e0b3ff', '#a34dff', '#ffd24a'], 150 + pw * 60, 1.1, 5 + pw * 3);
      for (let i = 0; i < 3; i++) p({ x, y, life: .7 + i * .12, size: 6 * u, grow: (130 + i * 40) * u * (1 + pw * .5), color: i ? '#c98aff' : '#fff', shape: 'r', w: (2.5 - i * .6) * u });
      p({ x, y, life: .5, size: 10 * u, grow: 160 * u, color: '#e9d0ff' });
      flash('#fff', .95, 520); shake(12 + pw * 10, .8);
    }, 450);
  }
  function ultimate(x, y, pw, big) {
    const u = U();
    darken(.75);
    for (let i = 0; i < 70; i++) { const a = R(0, Math.PI * 2), d = R(50, 110) * u; p({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * d * .85, vy: -Math.sin(a) * d * .85, life: 1.15, size: R(1.2, 3) * u, color: pick(big ? ['#ffe14d', '#ff5ad0', '#5bd6ff', '#fff'] : ['#ffe14d', '#fff']), delay: R(0, .25) }); }
    setTimeout(() => {
      darken(0);
      p({ x, y: H / 2, life: 1.1, size: (big ? 26 : 16) * u, grow: 20 * u, color: big ? '#fff6c8' : '#ffe9a0', shape: 'beam' });
      const n = big ? 5 : 3;
      for (let k = 0; k < n; k++) setTimeout(() => {
        const bx = x + R(-18, 18) * u * (k ? 1 : 0), by = y + R(-18, 14) * u * (k ? 1 : 0);
        burst(bx, by, 90, big ? ['#fff', '#ffe14d', '#ff5ad0', '#5bd6ff', '#ff8a1c'] : ['#fff', '#ffe14d', '#ff8a1c'], 190, 1.2, 6);
        p({ x: bx, y: by, life: .8, size: 6 * u, grow: 190 * u, color: '#fff', shape: 'r', w: 2.5 * u });
        p({ x: bx, y: by, life: .5, size: 12 * u, grow: 170 * u, color: '#fff3c0' });
        flash('#fff', .95, 420); shake(big ? 22 : 15, .7);
      }, k * (big ? 260 : 230));
      for (let i = 0; i < (big ? 5 : 2); i++) setTimeout(() => bolt(x + R(-40, 40) * u, -2 * u, x + R(-10, 10) * u, y, .3, '#fff', 2), 150 + i * 180);
    }, 1200);
  }
  // ---------- ながい呪文 ----------
  function dragon(x, y, pw) {
    // 炎の竜が うねりながら立ちのぼり、敵のところで はじける
    const u = U();
    for (let i = 0; i < 70; i++) {
      const t = i / 70, px = x + Math.sin(t * 9) * 20 * u * (1 - t * 0.6), py = H * 1.02 - (H * 1.02 - y) * t;
      p({ x: px, y: py, vx: R(-6, 6) * u, vy: R(-24, -8) * u, life: R(.35, .6), size: (2.5 + 5 * t) * u, grow: -3 * u, color: pick(['#ffe14d', '#ff9a1c', '#ff4a1c', '#fff3a0']), delay: t * 0.36 });
    }
    setTimeout(() => {
      fire(x, y, 1);
      burst(x, y, 90, ['#fff3a0', '#ffd24a', '#ff7a1c', '#ff3b1c'], 170, 1.0, 6);
      for (let i = 0; i < 3; i++) p({ x, y, life: .6 + i * .12, size: 6 * u, grow: (120 + i * 40) * u, color: i ? '#ff9a1c' : '#fff3a0', shape: 'r', w: (2.4 - i * .5) * u });
      flash('#ff7a1c', .75, 380); shake(13 + pw * 8, .6);
    }, 380);
  }
  function sfreeze(x, y, pw) {
    const u = U();
    ice(x, y, 1);
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, d = R(55, 80) * u; p({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.6, vy: -Math.sin(a) * d * 2.6, life: .36, size: R(4, 8) * u, color: pick(['#ffffff', '#cdf6ff', '#8fe4ff']), shape: 'd', rot: a + Math.PI / 2 }); }
    setTimeout(() => {
      for (let i = 0; i < 26; i++) { const a = R(0, Math.PI * 2), sp = R(60, 150) * u; p({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R(.6, 1.1), size: R(4, 9) * u, color: pick(['#ffffff', '#e6fbff', '#9fe8ff', '#5bc8ff']), shape: 'd', rot: R(0, 6), vr: R(-8, 8), drag: 2 }); }
      for (let i = 0; i < 3; i++) p({ x, y, life: .6 + i * .14, size: 6 * u, grow: (120 + i * 45) * u, color: i % 2 ? '#8fe4ff' : '#fff', shape: 'r', w: (2.2 - i * .5) * u });
      for (let i = 0; i < 40; i++) p({ x: R(0, W), y: R(-10, 0) * u, vx: R(-6, 6) * u, vy: R(40, 90) * u, life: R(.8, 1.4), size: R(.7, 1.8) * u, color: '#fff', delay: R(0, .3) });
      flash('#e6fbff', .8, 420); shake(12 + pw * 8, .6);
    }, 340);
  }
  function tbolt(x, y, pw) {
    const u = U();
    for (let i = 0; i < 7; i++) setTimeout(() => { bolt(x + R(-46, 46) * u, -2 * u, x + R(-8, 8) * u, y + R(-6, 10) * u, .3, i % 2 ? '#fff36b' : '#ffe95a', 2.2); flash('#fffbd0', .6, 120); }, i * 70);
    setTimeout(() => {
      burst(x, y, 80, ['#fff', '#fff36b', '#ffe14d'], 190, .7, 3);
      for (let i = 0; i < 2; i++) p({ x, y, life: .5 + i * .15, size: 6 * u, grow: (150 + i * 50) * u, color: i ? '#ffe14d' : '#fff', shape: 'r', w: (2.4 - i * .7) * u });
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; bolt(x, y, x + Math.cos(a) * 60 * u, y + Math.sin(a) * 60 * u, .22, '#fff', 1.2); }
      flash('#fff', .9, 380); shake(15 + pw * 8, .65);
    }, 280);
  }
  function meteor(x, y, pw) {
    // ほしが つぎつぎ ななめに ふってきて、さいごに 大きいのが おちる
    const u = U(), n = 6;
    const drop = (tx, ty, big) => {
      const sx = tx + R(34, 60) * u, sy = -8 * u, T = big ? 0.34 : 0.26;
      const vx = (tx - sx) / T, vy = (ty - sy) / T;
      p({ x: sx, y: sy, vx, vy, life: T, size: (big ? 8 : 4.5) * u, color: '#fff3c0' });
      for (let k = 1; k <= 7; k++) p({ x: sx, y: sy, vx, vy, life: T, size: (big ? 6.5 : 3.6) * u * (1 - k * .1), grow: -4 * u, color: pick(['#ffd24a', '#ff8a1c', '#c98aff']), delay: k * .022 });
      setTimeout(() => {
        burst(tx, ty, big ? 130 : 30, ['#fff', '#ffd24a', '#ff8a1c', '#c98aff'], big ? 200 : 110, big ? 1.2 : .7, big ? 7 : 4);
        p({ x: tx, y: ty, life: big ? .8 : .45, size: 5 * u, grow: (big ? 190 : 90) * u, color: '#fff', shape: 'r', w: (big ? 2.6 : 1.6) * u });
        if (big) { p({ x: tx, y: ty, life: .5, size: 10 * u, grow: 160 * u, color: '#ffe9c0' }); flash('#fff', .95, 520); shake(16 + pw * 10, .8); }
        else { flash('#ffd24a', .3, 140); shake(6, .2); }
      }, T * 1000);
    };
    for (let i = 0; i < n; i++) setTimeout(() => drop(x + R(-30, 30) * u, y + R(-16, 16) * u, false), i * 85);
    setTimeout(() => drop(x, y, true), n * 85 + 60);
  }
  function barrier(x, y) {
    const u = U();
    for (let i = 0; i < 3; i++) p({ x, y, life: .55 + i * .12, size: 8 * u, grow: (90 + i * 30) * u, color: i % 2 ? '#fff' : '#7fe7ff', shape: 'r', w: (1.8 - i * .4) * u, delay: i * .06 });
    for (let i = 0; i < 26; i++) { const a = Math.PI + i / 25 * Math.PI, d = 34 * u; p({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * .6, vx: 0, vy: R(-26, -10) * u, life: R(.5, .9), size: R(1, 2.4) * u, color: pick(['#7fe7ff', '#fff', '#bff2ff']), shape: pick(['c', 'd']), delay: R(0, .2) }); }
    flash('#7fe7ff', .28, 300);
  }
  function crit(x, y) {
    const u = U();
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; p({ x, y, vx: Math.cos(a) * 150 * u, vy: Math.sin(a) * 150 * u, life: .35, size: 9 * u, color: '#fff', shape: 'l', rot: a, drag: 3, w: 1.2 * u }); }
    p({ x, y, life: .3, size: 4 * u, grow: 150 * u, color: '#fff', shape: 'r', w: 2 * u });
    flash('#fff', .9, 200); shake(14, .45);
  }
  function chip(x, y) { burst(x, y, 16, ['#dfe8ff', '#fff'], 40, .5, 2); }
  function slash() {
    const u = U();
    for (let i = 0; i < 3; i++) p({ x: W * R(.2, .8), y: H * R(.3, .8), life: .28, size: 46 * u, color: '#ff4a3b', shape: 'l', rot: R(-.9, -.5) + (i % 2 ? 1.4 : 0), w: 1.6 * u, delay: i * .06 });
    flash('#ff2a1c', .5, 300); shake(10, .4);
  }
  function shoutSpark(x, y, lv) {
    const u = U();
    for (let i = 0; i < 1 + lv * 6; i++) { const a = R(0, Math.PI * 2), s = R(40, 150) * u * (0.4 + lv); p({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: R(.3, .7), size: R(1.5, 4) * u, color: pick(['#ffe14d', '#ff8a1c', '#fff', '#ff4a3b']), drag: 1.5 }); }
  }
  function shoutEnd(x, y, pw) {
    const u = U();
    burst(x, y, 160, ['#fff', '#ffe14d', '#ff8a1c', '#ff4a3b'], 220, 1.3, 7);
    for (let i = 0; i < 4; i++) p({ x, y, life: .7 + i * .15, size: 6 * u, grow: (150 + i * 50) * u, color: i % 2 ? '#ffe14d' : '#fff', shape: 'r', w: 2.4 * u });
    flash('#fff', 1, 600); shake(18 + pw * 10, .9);
  }
  function dieDust(x, y) { burst(x, y, 50, ['#fff', '#cfc6ff', '#8f87a6'], 70, 1.0, 3); }

  function update(dt) {
    dark += (darkTo - dark) * Math.min(1, dt * 8);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (dark > 0.01) { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(0,0,10,' + dark.toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      if (q.delay > 0) { q.delay -= dt; continue; }
      q.t += dt;
      if (q.t >= q.life) { ps.splice(i, 1); continue; }
      const dr = Math.max(0, 1 - q.drag * dt);
      q.vx *= dr; q.vy *= dr; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.size = Math.max(0.1, q.size + q.grow * dt); q.rot += q.vr * dt;
      const k = q.t / q.life, a = k < .15 ? k / .15 : 1 - (k - .15) / .85;
      g.globalAlpha = Math.max(0, a);
      g.globalCompositeOperation = q.add ? 'lighter' : 'source-over';
      g.fillStyle = g.strokeStyle = q.color;
      if (q.shape === 'c') { g.beginPath(); g.arc(q.x, q.y, q.size, 0, 6.2832); g.fill(); }
      else if (q.shape === 'r') { g.lineWidth = q.w; g.beginPath(); g.arc(q.x, q.y, q.size, 0, 6.2832); g.stroke(); }
      else if (q.shape === 'd') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.beginPath(); g.moveTo(0, -q.size * 1.5); g.lineTo(q.size * .7, 0); g.lineTo(0, q.size * 1.5); g.lineTo(-q.size * .7, 0); g.closePath(); g.fill(); g.restore(); }
      else if (q.shape === 'x') { g.fillRect(q.x - q.size * 1.6, q.y - q.size * .35, q.size * 3.2, q.size * .7); g.fillRect(q.x - q.size * .35, q.y - q.size * 1.6, q.size * .7, q.size * 3.2); }
      else if (q.shape === 'l') { g.lineWidth = q.w; g.lineCap = 'round'; g.beginPath(); g.moveTo(q.x - Math.cos(q.rot) * q.size, q.y - Math.sin(q.rot) * q.size); g.lineTo(q.x + Math.cos(q.rot) * q.size, q.y + Math.sin(q.rot) * q.size); g.stroke(); }
      else if (q.shape === 'beam') { const w = q.size * (1 - k * .4); const gr = g.createLinearGradient(q.x - w, 0, q.x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, q.color); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(q.x - w, 0, w * 2, H); }
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.t += dt;
      if (b.t >= b.life) { bolts.splice(i, 1); continue; }
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - b.t / b.life) * (Math.random() < .25 ? .4 : 1);
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const [lw, col] of [[U() * 2.4 * b.w, b.color], [U() * .9 * b.w, '#fff']]) {
        g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
        b.pts.forEach((q, j) => j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke();
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (shakeT > 0) {
      shakeT -= dt; const k = Math.max(0, shakeT / shakeDur), a = shakeAmp * k * U() * .12;
      field.style.transform = `translate(${R(-a, a).toFixed(1)}px,${R(-a, a).toFixed(1)}px)`;
      if (shakeT <= 0) { field.style.transform = ''; shakeAmp = 0; }
    }
  }
  function clear() { ps = []; bolts = []; dark = darkTo = 0; }

  return { init, resize, update, clear, flash, shake, darken, floater, fire, ice, thunder, heal, destroy, dragon, sfreeze, tbolt, meteor, barrier, ultimate, crit, chip, slash, shoutSpark, shoutEnd, dieDust, size: () => ({ W, H }) };
})();
