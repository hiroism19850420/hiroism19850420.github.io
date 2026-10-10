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
    mode: 'play',  // play / over（ゲームオーバー） / clear（ステージクリア）
    endT: 0,       // 終了画面を出してからの時間
    tapped: false,
    enemies: [],
    sentries: [],  // 監視カメラ
    rings: [],     // 物音の広がりを見せる輪
    bullets: [],
    items: [],
    stats: { time: 0, alerts: 0, kos: 0, sleeps: 0 },
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
    // 右上のボタン（無線、ポーズ）に隠れないよう、レーダーを左へ寄せる幅を測る
    const br = document.getElementById('btnRadio').getBoundingClientRect();
    view.rightInset = br.width > 0 ? (r.right - br.left) * dpr / s + 6 : 8;
    camera.update(0, player, view, map);
  }

  function snap(v) { return Math.round(v * view.scale) / view.scale; }

  // ---------- ポーズ ----------
  const pauseEl = document.getElementById('pause');
  const btnDebug = document.getElementById('btnDebug');
  const btnFull = document.getElementById('btnFull');

  const btnBgm = document.getElementById('btnBgm');

  function setPaused(v) {
    Game.paused = v;
    pauseEl.hidden = !v;
    NH.Audio.duck(v ? 0.3 : 1);
  }
  function showBgm() { btnBgm.textContent = 'BGM：' + (NH.Audio.bgmOn ? 'ON' : 'OFF'); }
  btnBgm.addEventListener('click', () => { NH.Audio.setBgmOn(!NH.Audio.bgmOn); showBgm(); });
  showBgm();

  // ---------- BGM ----------
  // 通常・疑念・警戒の3曲を、フロアの状態に合わせて切り替える
  let tenseT = 0; // 疑念の曲を保つ残り時間（「？」が一瞬で消えても、曲がばたばた変わらないように）
  function bgmFor(dt) {
    const A = NH.Alert;
    if (A.phase === 'alert') { tenseT = 2; return 'alert'; }
    if (A.phase === 'search' || Game.enemies.some((e) => e.state === 'suspicious')) tenseT = 2;
    else tenseT = Math.max(0, tenseT - dt);
    return tenseT > 0 ? 'suspect' : 'sneak';
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
    NH.Audio.duck(Game.mode === 'radio' ? 0.35 : 1);
    if (Game.mode === 'radio') {
      // 無線中はゲームを止め、決定キーかタップで文字を送る
      const adv = Input.pressed('action') || Input.pressed('radio') || Game.tapped;
      Game.tapped = false;
      NH.Radio.update(dt, adv);
      if (!NH.Radio.active) Game.mode = 'play';
      return;
    }
    if (Game.mode !== 'play') {
      // ゲームオーバー・クリア：少し待ってから、ボタンか画面タップでやり直し
      NH.Audio.bgm(null);
      Game.endT += dt;
      const go = Input.pressed('action') || Input.pressed('weapon') || Game.tapped;
      Game.tapped = false;
      if (Game.endT > 1.2 && go) reset();
      UI.update(dt, player, map);
      return;
    }
    Game.stats.time += dt;
    player.update(dt);
    for (const e of Game.enemies) e.update(dt, player);
    for (const c of Game.sentries) c.update(dt, player);
    separateEnemies();
    map.updateDoors(dt, player, Game.enemies);
    for (const d of map.doors) {
      if (d.sound && Math.hypot(d.x - player.x, d.y - player.y) < 320) NH.Audio.play(d.sound);
      d.sound = null;
    }
    updateBullets(dt);
    pickUpItems();
    for (const r of Game.rings) r.t += dt;
    Game.rings = Game.rings.filter((r) => r.t < r.life);
    updateButtons();
    NH.Alert.update(dt);
    NH.Audio.bgm(bgmFor(dt));
    camera.update(dt, player, view, map);
    UI.update(dt, player, map);

    checkRadio();

    if (player.life <= 0) {
      Game.mode = 'over';
      Game.endT = 0;
      NH.Audio.play('gameover');
    } else if (map.isGoal(player.x, player.y)) {
      const why = Game.goalBlocked();
      if (!why) {
        Game.mode = 'clear';
        Game.endT = 0;
        NH.Audio.play('clear');
      } else if (Game.goalMsgT <= 0) {
        Game.goalMsgT = 2.5;
        Game.toast(why);
        NH.Audio.play('locked');
      }
    }
    Game.goalMsgT = Math.max(0, Game.goalMsgT - dt);
  }

  // ---------- 無線 ----------
  // 決まった場所に来たとき（タイル座標の矩形、両端を含む）に自動で入る無線
  const RADIO_SPOTS = [
    { id: 'puddle', x0: 4, y0: 20, x1: 7, y1: 22 },
    { id: 'duct', x0: 11, y0: 20, x1: 13, y1: 22 }
  ];
  const RADIO_ZONES = { '第1倉庫': 'warehouse', '中央通路': 'corridor', '事務室': 'office', 'サーバールーム': 'server' };
  let wasAlerted = false;

  function openRadio() {
    Game.mode = 'radio';
    Game.tapped = false;
  }

  function checkRadio() {
    const R = NH.Radio, A = NH.Alert;
    if (A.phase !== 'none') { wasAlerted = true; if (Input.pressed('radio')) { R.call(); openRadio(); } return; }
    // 自分からかける
    if (Input.pressed('radio')) { R.call(); openRadio(); return; }
    // 警戒が解けた直後
    if (wasAlerted) { wasAlerted = false; if (R.play('escaped')) { openRadio(); return; } }
    if (!R.seen.intro) { R.play('intro'); openRadio(); return; }
    const tx = Math.floor(player.x / T), ty = Math.floor(player.y / T);
    for (const s of RADIO_SPOTS) {
      if (tx >= s.x0 && tx <= s.x1 && ty >= s.y0 && ty <= s.y1 && R.play(s.id)) { openRadio(); return; }
    }
    const z = map.zoneAt(player.x, player.y);
    if (z && RADIO_ZONES[z.name] && R.play(RADIO_ZONES[z.name])) openRadio();
  }

  // ---------- 弾 ----------
  // owner が 'player' なら麻酔弾、'enemy' なら敵の銃弾
  Game.fire = function (owner, x, y, angle) {
    const P = C.PLAYER, E = C.ENEMY;
    const speed = owner === 'player' ? P.DART_SPEED : E.BULLET_SPEED;
    const range = owner === 'player' ? P.DART_RANGE * T : E.SHOOT_RANGE * T * 1.6;
    Game.bullets.push({ owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, left: range });
    NH.Audio.play(owner === 'player' ? 'dart' : 'shot');
  };

  function updateBullets(dt) {
    for (const b of Game.bullets) {
      // 速い弾が壁をすり抜けないよう、細かく区切って進める
      const dist = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.ceil(dist / 6);
      for (let i = 0; i < steps && !b.dead; i++) {
        b.x += b.vx * dt / steps;
        b.y += b.vy * dt / steps;
        b.left -= dist / steps;
        if (b.left <= 0) { b.dead = true; break; }
        if (map.isOpaque(Math.floor(b.x / T), Math.floor(b.y / T))) {
          b.dead = true;
          // 外れた麻酔弾は、当たった場所で小さな音を立てる
          if (b.owner === 'player') Game.noise(b.x - b.vx * 0.01, b.y - b.vy * 0.01, C.PLAYER.DART_NOISE, 'ricochet');
          break;
        }
        if (b.owner === 'player') {
          // 監視カメラに当てると、しばらく止まる
          for (const c of Game.sentries) {
            if (c.offT > 0 || Math.hypot(c.x - b.x, c.y - b.y) > 12) continue;
            c.disable();
            NH.Audio.play('ricochet');
            b.dead = true;
            break;
          }
          if (b.dead) break;
          for (const e of Game.enemies) {
            if (e.state === 'stunned' || Math.hypot(e.x - b.x, e.y - b.y) > 13) continue;
            e.stun(true);
            Game.stats.sleeps++;
            b.dead = true;
            break;
          }
        } else if (Math.hypot(player.x - b.x, player.y - b.y) < 11) {
          player.hurt(C.ENEMY.BULLET_DAMAGE);
          b.dead = true;
        }
      }
    }
    Game.bullets = Game.bullets.filter((b) => !b.dead);
  }

  function drawBullets() {
    for (const b of Game.bullets) {
      const l = Math.hypot(b.vx, b.vy);
      const tx = b.vx / l, ty = b.vy / l;
      ctx.strokeStyle = b.owner === 'player' ? '#9fe8ff' : '#ffd36a';
      ctx.lineWidth = b.owner === 'player' ? 1.5 : 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 8);
      ctx.lineTo(b.x - tx * 8, b.y - 8 - ty * 8);
      ctx.stroke();
    }
  }

  // ---------- 落ちているアイテム ----------
  function pickUpItems() {
    const P = C.PLAYER;
    for (const it of Game.items) {
      if (it.dropT > 0) { it.dropT -= 1 / C.FPS; continue; } // 落とした直後は拾えない（倒した瞬間に拾ってしまわないように）
      if (it.taken || Math.hypot(it.x - player.x, it.y - player.y) > 20) continue;
      let msg = '';
      if (it.type === 'box') { player.hasBox = true; msg = '段ボール箱を手に入れた'; }
      else if (it.type === 'gun') { player.hasGun = true; player.ammo += P.GUN_AMMO; msg = '麻酔銃を手に入れた（弾 ' + P.GUN_AMMO + '）'; }
      else if (it.type === 'ammo') { player.ammo += P.AMMO_PACK; msg = '麻酔弾 +' + P.AMMO_PACK; }
      else if (it.type === 'key') { player.keyLevel = Math.max(player.keyLevel, it.level); msg = 'カードキー Lv' + it.level + ' を手に入れた'; }
      else if (it.type === 'ration') {
        if (player.life >= P.MAX_LIFE) continue; // 満タンなら置いておく
        player.life = Math.min(P.MAX_LIFE, player.life + P.RATION_HEAL);
        msg = 'ライフが回復した';
      }
      it.taken = true;
      Game.toast(msg);
      NH.Audio.play('pickup');
    }
  }

  function drawItems() {
    const S = NH.Sprites.SCALE, icons = NH.Sprites.icons;
    for (const it of Game.items) {
      if (it.taken) continue;
      const img = icons[it.type === 'key' ? 'key' + it.level : it.type];
      const bob = Math.round(Math.sin(Game.time * 3 + it.x) * 1.5);
      const w = img.width * S, h = img.height * S;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(it.x - w / 2 + 2, it.y + 6, w - 4, 3);
      // 目立つように、ゆっくり光らせる
      ctx.fillStyle = 'rgba(255,240,170,' + (0.10 + 0.08 * Math.sin(Game.time * 4)) + ')';
      ctx.fillRect(it.x - w / 2 - 3, it.y - h / 2 - 3 + bob, w + 6, h + 6);
      ctx.drawImage(img, Math.round(it.x - w / 2), Math.round(it.y - h / 2 + bob), w, h);
    }
  }

  Game.toast = function (text) { UI.toast(text); };

  // エレベーターを動かせない理由。動かせるなら空文字
  Game.goalMsgT = 0;
  Game.goalBlocked = function () {
    if (player.keyLevel < C.GOAL.KEY_LEVEL) return 'エレベーターにはカードキー Lv' + C.GOAL.KEY_LEVEL + ' が必要だ';
    if (C.GOAL.LOCK_ON_ALERT && NH.Alert.phase !== 'none') return '警戒中はエレベーターが動かない';
    return '';
  };

  // 倒した敵が持ち物を落とす
  Game.dropItem = function (carry, x, y) {
    Game.items.push({ type: carry.type, level: carry.level, x, y: y + 4, taken: false, dropT: 0.6 });
    Game.toast(carry.type === 'key' ? '敵がカードキー Lv' + carry.level + ' を落とした' : '敵が何か落とした');
  };

  // 終了画面で、画面のどこを触ってもやり直せるように
  window.addEventListener('pointerdown', () => { if (Game.mode !== 'play') Game.tapped = true; });

  // 敵どうしが1点に重ならないよう、近すぎる組を少し押し離す
  function separateEnemies() {
    const E = C.ENEMY, MIN = 16, list = Game.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.state === 'patrol' && b.state === 'patrol') continue;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= MIN) continue;
        if (d < 0.01) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
        const push = (MIN - d) / 2;
        for (const [e, s] of [[a, -1], [b, 1]]) {
          const nx = e.x + dx * push * s, ny = e.y + dy * push * s;
          if (!map.rectSolid(nx - E.HIT_W / 2, ny - E.HIT_H / 2, E.HIT_W, E.HIT_H)) { e.x = nx; e.y = ny; }
        }
      }
    }
  }

  // 物音を立てる。radius はタイル数。音の広がりを輪で見せ、範囲内の敵を呼び寄せる
  Game.noise = function (x, y, radius, sound) {
    const r = radius * T;
    NH.Alert.noise(x, y, r);
    Game.rings.push({ x, y, r, t: 0, life: 0.45 });
    NH.Audio.play(sound);
  };

  // ---------- 画面のボタン（タッチ用） ----------
  const btnAction = document.getElementById('btnAction');
  const btnCrawl = document.getElementById('btnCrawl');
  function bindButton(el, action) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Input.virtualPress(action);
      el.classList.add('down');
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      el.addEventListener(ev, () => {
        Input.virtualRelease(action);
        el.classList.remove('down');
      });
    }
  }
  const btnWeapon = document.getElementById('btnWeapon');
  const btnItem = document.getElementById('btnItem');
  bindButton(btnAction, 'action');
  bindButton(btnCrawl, 'crawl');
  bindButton(btnWeapon, 'weapon');
  bindButton(btnItem, 'item');
  bindButton(document.getElementById('btnRadio'), 'radio');

  // ボタンの表示を、いまできることや持ち物に合わせる（変わったときだけ書き換える）
  const ACTION_LABEL = { ko: '気絶', knock: '叩く', door: '開ける', locked: 'ロック' };
  let lastButtons = '';
  function updateButtons() {
    let a = player.action ? player.action.type : '';
    if (a === 'door' && !player.action.ok) a = 'locked';
    const key = [a, player.crawling, player.boxed, player.hasBox, player.hasGun, player.ammo].join();
    if (key === lastButtons) return;
    lastButtons = key;
    btnAction.textContent = ACTION_LABEL[a] || '';
    btnAction.classList.toggle('ready', !!a);
    btnAction.classList.toggle('ko', a === 'ko' || a === 'locked');
    btnCrawl.textContent = player.crawling ? '立つ' : 'ほふく';
    btnCrawl.classList.toggle('on', player.crawling);
    btnCrawl.classList.toggle('off', player.boxed);
    btnWeapon.hidden = !player.hasGun;
    btnWeapon.innerHTML = '撃つ<small>' + player.ammo + '</small>';
    btnWeapon.classList.toggle('off', player.ammo <= 0 || player.boxed);
    btnItem.hidden = !player.hasBox;
    btnItem.textContent = player.boxed ? '脱ぐ' : '箱';
    btnItem.classList.toggle('on', player.boxed);
  }

  function reset() {
    Game.mode = 'play';
    Game.endT = 0;
    Game.tapped = false;
    Game.rings = [];
    Game.bullets = [];
    Game.stats = { time: 0, alerts: 0, kos: 0, sleeps: 0 };
    Game.items = map.itemDefs.map((d) => ({ type: d.type, level: d.level, x: (d.x + 0.5) * T, y: (d.y + 0.5) * T, taken: false }));
    map.resetDoors();
    NH.Alert.reset();
    UI.clearToast();
    player.init(map);
    Game.enemies = map.enemyDefs.map((def) => new NH.Enemy(def));
    Game.sentries = map.sentryDefs.map((def) => new NH.Sentry(def));
    for (const e of Game.enemies) e.update(0, player);
    camera.snap(player, view, map);
    UI.zone = null;
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
    map.drawDoors(ctx, player.keyLevel);
    map.drawGoalLamps(ctx, !Game.goalBlocked(), Game.time);
    drawItems();

    // 画面の近くにいる敵だけ描く
    const margin = C.ENEMY.VIEW_DIST * T + 48;
    const near = Game.enemies.filter((e) =>
      e.x > cx - margin && e.x < cx + view.w + margin &&
      e.y > cy - margin && e.y < cy + view.h + margin);
    for (const c of Game.sentries) c.drawCone(ctx);
    for (const e of near) e.drawCone(ctx);
    for (const c of Game.sentries) c.draw(ctx, Game.time);
    for (const r of Game.rings) {
      const k = r.t / r.life;
      ctx.strokeStyle = 'rgba(255,240,170,' + (0.55 * (1 - k)) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + (r.r - 6) * (1 - (1 - k) * (1 - k)), 0, Math.PI * 2);
      ctx.stroke();
    }
    // 手前のものが上に重なるよう、足元の位置の順に描く
    const actors = near.concat(player).sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw(ctx, snap);
    for (const e of near) e.drawAim(ctx);
    drawBullets();
    for (const e of near) e.drawMark(ctx, snap);

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

    // 敵：巡回ルート、視界レイ、プレイヤーへの視線、状態名
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const e of Game.enemies) {
      ctx.strokeStyle = 'rgba(90,170,255,0.6)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      e.route.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (e.route.length > 2) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#5af';
      for (const p of e.route) ctx.fillRect(p.x - 2, p.y - 2, 4, 4);

      ctx.strokeStyle = 'rgba(255,255,120,0.28)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < e.cone.length; i += 3) {
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.cone[i], e.cone[i + 1]);
      }
      ctx.stroke();

      ctx.strokeStyle = e.sees ? '#f44' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(player.x, player.y);
      ctx.stroke();

      // A* の経路（これから通る部分）
      if (e.path && e.path.length) {
        ctx.strokeStyle = '#f0f';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        for (let i = e.pathI; i < e.path.length; i++) ctx.lineTo(e.path[i].x, e.path[i].y);
        ctx.stroke();
        const g = e.path[e.path.length - 1];
        ctx.fillStyle = '#f0f';
        ctx.fillRect(g.x - 2, g.y - 2, 4, 4);
      }

      const hot = e.state === 'spotted' || e.state === 'alert';
      const label = e.state + (hot ? '' : ':' + e.phase) + ' ' + Math.round(e.gauge * 100);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(e.x - 38, e.y - 50, 76, 10);
      ctx.fillStyle = hot ? '#f66' : e.state === 'patrol' ? '#9f9' : '#fd5';
      ctx.fillText(label, e.x, e.y - 40);
    }
  }

  function drawDebugText() {
    const z = map.zoneAt(player.x, player.y);
    const lines = [
      'FPS ' + Game.fps.toFixed(0) + (Game.paused ? '  [PAUSE]' : ''),
      'pos ' + player.x.toFixed(1) + ', ' + player.y.toFixed(1) +
        '  tile ' + Math.floor(player.x / T) + ', ' + Math.floor(player.y / T),
      'face ' + player.face + '  dir ' + player.dir.x.toFixed(2) + ', ' + player.dir.y.toFixed(2),
      'zone ' + (z ? z.name : '-') + '  life ' + player.life + '  key ' + player.keyLevel + '  ammo ' + player.ammo,
      'floor ' + NH.Alert.phase + ' ' + NH.Alert.timer.toFixed(1) +
        '  seeing ' + Game.enemies.filter((e) => e.sees).length,
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

  // コンソールから1コマずつ動かして確かめるための入口
  Game.update = update;
  Game.draw = draw;
  Game.resize = resize;

  // ---------- 起動 ----------
  map.load();
  resize();
  reset();
  setDebug(Game.debug);
  window.addEventListener('resize', resize);
  window.addEventListener('touchstart', () => setTimeout(resize, 0), { once: true, passive: true });
  window.addEventListener('orientationchange', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
})();
