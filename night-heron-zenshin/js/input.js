// キーボードとタッチの入力をまとめ、「アクション名」で問い合わせられるようにする。
(function () {
  const C = NH.CONFIG;

  const BIND = {
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    crawl: ['ShiftLeft', 'ShiftRight'],
    action: ['KeyZ'],
    weapon: ['KeyX'],
    item: ['KeyC'],
    radio: ['Space'],
    pause: ['Escape'],
    debug: ['F1']
  };

  const codeToAction = {};
  for (const a in BIND) for (const code of BIND[a]) codeToAction[code] = a;

  const downCodes = new Set();   // 押されているキー
  const virtual = {};            // 画面ボタンで押されているアクション
  const pressed = {};            // このフレームで押された瞬間
  const stick = { x: 0, y: 0 };

  function isHeld(a) {
    if (virtual[a]) return true;
    for (const code of BIND[a]) if (downCodes.has(code)) return true;
    return false;
  }

  window.addEventListener('keydown', (e) => {
    const a = codeToAction[e.code];
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return;
    if (!isHeld(a)) pressed[a] = true;
    downCodes.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    downCodes.delete(e.code);
  });
  window.addEventListener('blur', () => {
    downCodes.clear();
    for (const a in virtual) virtual[a] = false;
  });

  // ---------- タッチ：移動スティック ----------
  function enableTouch() {
    document.body.classList.add('touch');
  }
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) enableTouch();
  window.addEventListener('touchstart', enableTouch, { once: true, passive: true });

  const zone = document.getElementById('stickZone');
  const base = document.getElementById('stickBase');
  const knob = document.getElementById('stickKnob');
  let stickId = null;
  let ox = 0, oy = 0;

  function placeBase() {
    base.style.left = ox + 'px';
    base.style.top = oy + 'px';
  }

  function stickMove(e) {
    const r = zone.getBoundingClientRect();
    const R = C.TOUCH.STICK_RADIUS;
    let dx = e.clientX - r.left - ox;
    let dy = e.clientY - r.top - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      // 倒しきった先へ指が進んだら、土台ごとついていく
      ox += dx / d * (d - R);
      oy += dy / d * (d - R);
      dx = dx / d * R;
      dy = dy / d * R;
      placeBase();
    }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    stick.x = dx / R;
    stick.y = dy / R;
  }

  function stickEnd(e) {
    if (e.pointerId !== stickId) return;
    stickId = null;
    stick.x = stick.y = 0;
    knob.style.transform = '';
    base.style.left = base.style.top = '';
    base.classList.remove('active');
  }

  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    e.preventDefault();
    stickId = e.pointerId;
    try { zone.setPointerCapture(stickId); } catch (err) { /* 古い端末では無視 */ }
    const r = zone.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    placeBase();
    base.classList.add('active');
    stickMove(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) stickMove(e);
  });
  zone.addEventListener('pointerup', stickEnd);
  zone.addEventListener('pointercancel', stickEnd);

  // ブラウザ側のジェスチャー（拡大、長押しメニューなど）を止める
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  NH.Input = {
    held: isHeld,

    // 押された瞬間だけ true
    pressed(a) { return !!pressed[a]; },

    // 押された瞬間を読んで、その場で消す（ポーズなど update の外で扱うキー用）
    consume(a) {
      const v = !!pressed[a];
      pressed[a] = false;
      return v;
    },

    // update を1回終えるたびに呼ぶ
    endFrame() { for (const a in pressed) pressed[a] = false; },

    // 画面ボタン用
    virtualPress(a) {
      if (!isHeld(a)) pressed[a] = true;
      virtual[a] = true;
    },
    virtualRelease(a) { virtual[a] = false; },

    // 移動方向を長さ1（または0）のベクトルで返す
    getMove() {
      let x = (isHeld('right') ? 1 : 0) - (isHeld('left') ? 1 : 0);
      let y = (isHeld('down') ? 1 : 0) - (isHeld('up') ? 1 : 0);
      if (x || y) {
        const l = Math.hypot(x, y);
        return { x: x / l, y: y / l };
      }
      const m = Math.hypot(stick.x, stick.y);
      if (m < C.TOUCH.DEAD_ZONE) return { x: 0, y: 0 };
      let ang = Math.atan2(stick.y, stick.x);
      if (C.TOUCH.SNAP_8DIR) ang = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
      x = Math.cos(ang);
      y = Math.sin(ang);
      if (Math.abs(x) < 1e-6) x = 0;
      if (Math.abs(y) < 1e-6) y = 0;
      return { x, y };
    }
  };
})();
