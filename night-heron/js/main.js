// 起動、画面サイズの管理、メインループ。
(function () {
  const C = NH.CONFIG;
  const T = C.TILE;
  const STEP = 1 / C.FPS;
  const { Input, Map: map, Player: player, Camera: camera, UI } = NH;

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const Game = NH.Game = {
    paused: false,
    debug: C.DEBUG,
    time: 0,
    fps: 60,
    view: { w: 640, h: 360, scale: 1 } // w, h は画面に映るワールドの大きさ
  };
  const view = Game.view;

  // 端末の実ピクセルに合わせ、ドットが必ず整数倍になるように拡大率を決める
  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.max(1, Math.round(r.width * dpr));
    const bh = Math.max(1, Math.round(r.height * dpr));
    let s = Math.max(1, Math.round(Math.min(bw, bh) / C.VIEW.TARGET_SHORT));
    s = Math.max(s, Math.ceil(Math.max(bw, bh) / C.VIEW.MAX_LONG));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    view.scale = s;
    view.w = bw / s;
    view.h = bh / s;
    camera.update(0, player, view, map);
  }

  function snap(v) { return Math.round(v * view.scale) / view.scale; }

  // ---------- ポーズ ----------
  const pauseEl = document.getElementById('pause');
  const btnDebug = document.getElementById('btnDebug');
  const btnFull = document.getElementById('btnFull');

  function setPaused(v) {
    Game.paused = v;
    pauseEl.hidden = !v;
  }
  function setDebug(v) {
    Game.debug = v;
    btnDebug.textContent = 'デバッグ表示：' + (v ? 'ON' : 'OFF');
  }
  document.getElementById('btnPause').addEventListener('click', () => setPaused(true));
  document.getElementById('btnResume').addEventListener('click', () => setPaused(false));
  btnDebug.addEventListener('click', () => setDebug(!Game.debug));
  if (document.documentElement.requestFullscreen) {
    btnFull.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
  } else {
    btnFull.hidden = true; // iPhone の Safari など、対応していない環境
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true);
  });

  // ---------- update / draw ----------
  function update(dt) {
    Game.time += dt;
    player.update(dt);
    camera.update(dt, player, view, map);
    UI.update(dt, player, map);
  }

  function draw() {
    const s = view.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = snap(camera.x), cy = snap(camera.y);
    ctx.setTransform(s, 0, 0, s, -Math.round(cx * s), -Math.round(cy * s));
    ctx.imageSmoothingEnabled = false;

    // 焼いておいたマップから、映る範囲だけを描く
    const sx = Math.max(0, Math.floor(cx)), sy = Math.max(0, Math.floor(cy));
    const sw = Math.min(map.pxW - sx, Math.ceil(view.w) + 2);
    const sh = Math.min(map.pxH - sy, Math.ceil(view.h) + 2);
    if (sw > 0 && sh > 0) ctx.drawImage(map.canvas, sx, sy, sw, sh, sx, sy, sw, sh);

    map.drawDynamic(ctx, Game.time, { x: cx, y: cy }, view);
    player.draw(ctx, snap);
    if (Game.debug) drawDebugWorld(cx, cy);

    ctx.setTransform(s, 0, 0, s, 0, 0);
    UI.draw(ctx, view, map);
    if (Game.debug) drawDebugText();
  }

  // ---------- デバッグ表示（F1） ----------
  function drawDebugWorld(cx, cy) {
    const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(map.w - 1, Math.floor((cx + view.w) / T));
    const y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(map.h - 1, Math.floor((cy + view.h) / T));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (map.isSolid(tx, ty)) {
          ctx.fillStyle = map.isOpaque(tx, ty) ? 'rgba(255,60,60,0.22)' : 'rgba(255,190,60,0.25)';
          ctx.fillRect(tx * T, ty * T, T, T);
        }
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let tx = x0; tx <= x1 + 1; tx++) ctx.fillRect(tx * T, y0 * T, 0.5, (y1 - y0 + 1) * T);
    for (let ty = y0; ty <= y1 + 1; ty++) ctx.fillRect(x0 * T, ty * T, (x1 - x0 + 1) * T, 0.5);

    const hb = player.hitbox();
    ctx.strokeStyle = '#5f5';
    ctx.lineWidth = 1;
    ctx.strokeRect(hb.x + 0.5, hb.y + 0.5, hb.w - 1, hb.h - 1);
    ctx.strokeStyle = '#ff5';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + player.dir.x * 20, player.y + player.dir.y * 20);
    ctx.stroke();
  }

  function drawDebugText() {
    const z = map.zoneAt(player.x, player.y);
    const lines = [
      'FPS ' + Game.fps.toFixed(0) + (Game.paused ? '  [PAUSE]' : ''),
      'pos ' + player.x.toFixed(1) + ', ' + player.y.toFixed(1) +
        '  tile ' + Math.floor(player.x / T) + ', ' + Math.floor(player.y / T),
      'face ' + player.face + '  dir ' + player.dir.x.toFixed(2) + ', ' + player.dir.y.toFixed(2),
      'zone ' + (z ? z.name : '-'),
      'view ' + view.w.toFixed(0) + 'x' + view.h.toFixed(0) + '  x' + view.scale +
        '  canvas ' + canvas.width + 'x' + canvas.height
    ];
    ctx.font = '9px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, 36, 236, lines.length * 11 + 6);
    ctx.fillStyle = '#9f9';
    lines.forEach((l, i) => ctx.fillText(l, 12, 40 + i * 11));
  }

  // ---------- メインループ（update は 60FPS 固定、draw は画面の更新ごと） ----------
  let last = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let el = (now - last) / 1000;
    last = now;
    if (el > 0.1) el = 0.1;                       // タブ復帰時などの飛びを抑える
    if (el > 0) Game.fps += (1 / el - Game.fps) * 0.05;
    if (Math.abs(el - STEP) < 0.004) el = STEP;   // 60Hz 画面でのコマ飛びを防ぐ

    if (Input.consume('pause')) setPaused(!Game.paused);
    if (Input.consume('debug')) setDebug(!Game.debug);

    if (!Game.paused) {
      acc += el;
      while (acc >= STEP - 1e-9) {
        update(STEP);
        Input.endFrame();
        acc -= STEP;
      }
    }
    draw();
  }

  // ---------- 起動 ----------
  map.load();
  player.init(map);
  setDebug(Game.debug);
  resize();
  camera.snap(player, view, map);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
})();
