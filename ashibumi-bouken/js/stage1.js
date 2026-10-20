// ステージ1：基本診断（横スクロールアクション）
'use strict';

window.Stage1 = (function () {
  const T = 40;          // タイル
  const GY = 460;        // 地面の上面
  const GRAV = 1900, RUN = 270, JUMP = 760;

  // 地面（タイル番号の範囲。すき間が穴）
  const GROUND = [[0, 24], [27, 45], [49, 70], [73, 88], [92, 140]];
  // 土管 [タイル, 高さ]
  const PIPES = [[17, 2], [37, 3], [58, 2], [66, 3], [100, 2], [107, 3]];
  // ブロック [タイル, 段, 種類]  b=レンガ q=？ブロック h=かたいブロック
  const BLOCKS = [
    [8, 4, 'q'], [11, 4, 'b'], [12, 4, 'q'], [13, 4, 'b'], [14, 4, 'q'], [15, 4, 'b'], [13, 8, 'q'],
    [29, 4, 'b'], [30, 4, 'q'], [31, 4, 'b'], [32, 4, 'q'],
    [52, 4, 'q'], [53, 4, 'b'], [54, 4, 'q'],
    [89, 2, 'h'], [90, 2, 'h'], [91, 2, 'h'],
    [95, 4, 'b'], [96, 4, 'q'], [97, 4, 'b']
  ];
  // 階段（ゴール前）
  const STAIRS = [[112, 1], [113, 2], [114, 3], [115, 4], [116, 4]];
  const ENEMIES = [12, 21, 33, 42, 55, 62, 80, 85, 98, 104, 119];
  const LIVES = 3;       // ライフ。0 になるまでは 失敗しても その場の少し先から つづける
  const POLE_X = 124 * T + T / 2;
  const CASTLE_X = 128 * T;
  const WORLD_W = 141 * T;

  // どの終わり方でも、踏んだ敵とコインのことは必ず言う
  const extras = i => [
    i.stomps > 0
      ? `あなたは敵を${i.stomps}匹、踏み潰しました。周りの人を犠牲にして成り立つ人生です。`
      : 'あなたは敵を1匹も踏みませんでした。誰も犠牲にしなかったのではなく、誰とも関わらなかっただけです。',
    i.coins > 0
      ? `あなたはコインを${i.coins}枚取りました。落ちているものを自分の懐に入れる人生です。`
      : 'あなたはコインを1枚も取りませんでした。目の前に落ちている幸運にすら手を伸ばせない人生です。'
  ].concat(i.misses > 0
    ? [`あなたは${i.misses}回失敗して、そのたびに何事もなかったような顔で、少し先からやり直しました。`]
    : []);

  const RESULTS = {
    enemy: i => ({
      cleared: false, resultType: 'enemy_collision', diagnosisTag: '衝突型',
      diagnosisText: [`あなたはスタートから${i.m}m地点で、敵に正面からぶつかって終わりました。上から踏めば越えられる相手でした。あなたは壁にぶつかり玉砕するタイプです。そして、そこから何も学びません。`].concat(extras(i)).join('\n'),
      playResult: `敵に接触（${i.m}m地点／踏み潰した敵 ${i.stomps}匹／コイン ${i.coins}枚）`
    }),
    pit: i => ({
      cleared: false, resultType: 'pit_fall', diagnosisTag: '後悔型',
      diagnosisText: [(i.jumps > 0
        ? `あなたは${i.m}m地点で、穴に落ちました。ジャンプは${i.jumps}回もしていたのに、肝心なところで跳びませんでした。`
        : `あなたは${i.m}m地点で、一度も跳ばずにそのまま穴に落ちました。`)
        + '穴があったら入りたい人生を送ってきました。そして本当に入りました。'].concat(extras(i)).join('\n'),
      playResult: `穴に転落（${i.m}m地点／踏み潰した敵 ${i.stomps}匹／コイン ${i.coins}枚）`
    }),
    goal: i => ({
      cleared: true, resultType: 'goal', diagnosisTag: '成功至上型',
      diagnosisText: [`あなたは${i.time}秒でゴールし、旗を一人で下ろしました。いろんなものを踏み台にして、一人勝ちしてきた人生です。`].concat(extras(i)).join('\n'),
      playResult: `ゴール到達（タイム ${i.time}秒／踏み潰した敵 ${i.stomps}匹／コイン ${i.coins}枚）`
    })
  };

  function create(api) {
    const solids = [];
    GROUND.forEach(([a, b]) => solids.push({ x: a * T, y: GY, w: (b - a + 1) * T, h: 200, k: 'ground' }));
    PIPES.forEach(([tx, h]) => solids.push({ x: tx * T, y: GY - h * T, w: T * 2, h: h * T, k: 'pipe' }));
    BLOCKS.forEach(([tx, r, k]) => solids.push({ x: tx * T, y: GY - r * T, w: T, h: T, k, used: false, bump: 0 }));
    STAIRS.forEach(([tx, h]) => { for (let r = 1; r <= h; r++) solids.push({ x: tx * T, y: GY - r * T, w: T, h: T, k: 'h' }); });
    solids.push({ x: 124 * T, y: GY - T, w: T, h: T, k: 'h' }); // 旗竿の台

    const enemies = ENEMIES.map(tx => ({ x: tx * T, y: GY - 32, w: 32, h: 32, vx: -55, vy: 0, alive: true, flat: 0, awake: false, gone: false }));
    const p = { x: 80, y: GY - 54, w: 22, h: 54, vx: 0, vy: 0, onGround: false, face: 1, phase: 0, coyote: 0, buffer: 0, inv: 0 };
    let cam = 0, time = 0, state = 'play', st = 0, stomps = 0, coins = 0, jumps = 0, failInfo = null, lives = LIVES, misses = 0;
    let flagY = 0, inCastle = false;
    const puffs = [], coinFx = [];

    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const meters = () => Math.max(0, Math.round((p.x - 80) / T));

    function moveBody(b, dt, onHead) {
      b.x += b.vx * dt;
      let hitX = false;
      for (const s of solids) {
        if (!overlap(b, s)) continue;
        if (b.vx > 0) b.x = s.x - b.w; else if (b.vx < 0) b.x = s.x + s.w;
        hitX = true;
      }
      b.y += b.vy * dt;
      b.onGround = false;
      let head = null;
      for (const s of solids) {
        if (!overlap(b, s)) continue;
        if (b.vy > 0) { b.y = s.y - b.h; b.onGround = true; } else if (b.vy < 0) {
          b.y = s.y + s.h;
          if (!head || Math.abs(s.x + s.w / 2 - (b.x + b.w / 2)) < Math.abs(head.x + head.w / 2 - (b.x + b.w / 2))) head = s;
        }
        b.vy = 0;
      }
      if (head && onHead) onHead(head);
      return hitX;
    }

    function hitBlock(s) {
      if (s.k !== 'q' && s.k !== 'b') return;
      s.bump = 0.15;
      if (s.k === 'q' && !s.used) {
        s.used = true;
        coins++;
        coinFx.push({ x: s.x + T / 2, y: s.y, t: 0 });
        Fx.burst(s.x + T / 2 - cam, s.y - 10, 26, ['#ffd23a', '#fff3a0', '#ffffff'], 260, 0.7, 4, 400);
        Fx.texts.push({ kind: 'pop', text: 'チャリーン！', x: s.x + T / 2 - cam, y: s.y - 50, t: 0, dur: 0.9 });
        Sfx.play('coin');
      } else Sfx.play('bump');
      // ブロックの上にいる敵は ひっくり返る
      for (const e of enemies) {
        if (e.alive && !e.gone && e.x + e.w > s.x && e.x < s.x + s.w && Math.abs(e.y + e.h - s.y) < 4) {
          e.alive = false; e.flat = 0; stomps++;
          Fx.explode(e.x + e.w / 2 - cam, e.y + e.h / 2, 1.2);
        }
      }
    }

    // ライフが のこっていれば、穴なら その穴の すこし右、敵なら その場で つづける
    function loseLife(kind) {
      lives--; misses++;
      Sfx.play(kind === 'enemy' ? 'hit' : 'fail');
      Fx.shake(8, 0.3);
      if (kind === 'pit') {
        const seg = GROUND.find(([a]) => a * T > p.x - T);
        if (seg) p.x = Math.max(p.x, (seg[0] + 1) * T);
        p.y = GY - p.h - 80;
        p.vx = 0;
        p.vy = 0;
      } else {
        p.vy = -420;
      }
      p.inv = 2;
      Fx.texts.push({ kind: 'pop', text: `ライフ -1（のこり ${lives}）`, x: p.x + p.w / 2 - cam, y: Math.min(p.y, GY - 120) - 30, t: 0, dur: 1.4 });
    }

    function fail(kind) {
      if (state !== 'play') return;
      if (lives > 1) { loseLife(kind); return; }
      lives = 0; misses++;
      state = kind;
      st = 0;
      failInfo = { m: meters(), jumps, stomps, coins, misses };
      Fx.taunt(kind === 'enemy' ? '上から踏めばよかったのに〜〜' : '穴があったら、本当に入っちゃいましたね〜〜');
      Sfx.play(kind === 'enemy' ? 'hit' : 'fail');
      if (kind === 'enemy') { p.vy = -560; p.vx = 0; }
    }

    function update(dt) {
      st += dt;
      for (const s of solids) if (s.bump > 0) s.bump = Math.max(0, s.bump - dt);
      if (state === 'play') {
        time += dt;
        if (p.inv > 0) p.inv -= dt;
        const dir = (Input.isDown('ArrowRight') ? 1 : 0) - (Input.isDown('ArrowLeft') ? 1 : 0);
        const acc = p.onGround ? 2200 : 1300;
        const target = dir * RUN;
        if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt);
        else if (p.vx > target) p.vx = Math.max(target, p.vx - acc * dt);
        if (dir) p.face = dir;

        if (Input.pressed('Space', 'ArrowUp', 'KeyZ')) p.buffer = 0.12;
        p.buffer -= dt;
        p.coyote = p.onGround ? 0.09 : p.coyote - dt;
        if (p.buffer > 0 && p.coyote > 0) {
          p.vy = -JUMP; p.buffer = 0; p.coyote = 0; jumps++;
          Sfx.play('jump');
        }
        if (!Input.isDown('Space', 'ArrowUp', 'KeyZ') && p.vy < -300) p.vy = -300; // 短く押すと低く跳ぶ
        p.vy = Math.min(950, p.vy + GRAV * dt);

        const prevBottom = p.y + p.h;
        moveBody(p, dt, hitBlock);
        if (p.x < cam) { p.x = cam; p.vx = Math.max(0, p.vx); } // 戻れない
        p.phase += Math.abs(p.vx) * dt * 0.045;

        for (const e of enemies) {
          if (e.gone) continue;
          if (!e.alive) { e.flat += dt; if (e.flat > 0.6) e.gone = true; continue; }
          if (!e.awake && e.x < cam + W + 120) e.awake = true;
          if (!e.awake) continue;
          e.vy = Math.min(950, e.vy + GRAV * dt);
          if (moveBody(e, dt)) e.vx = -e.vx;
          if (e.y > H + 100) { e.gone = true; continue; }
          if (overlap(p, e)) {
            if (p.vy > 0 && prevBottom <= e.y + 14) {
              e.alive = false; e.flat = 0; e.gone = true; stomps++;
              p.vy = Input.isDown('Space', 'ArrowUp', 'KeyZ') ? -620 : -430;
              Fx.explode(e.x + e.w / 2 - cam, e.y + e.h / 2, 1.3, ['ドカーン！', 'ボカーン！', 'ズドーン！'][stomps % 3]);
              Sfx.play('stomp');
            } else if (p.inv <= 0) fail('enemy');
          }
        }

        if (p.y > H + 20) fail('pit');
        if (state === 'play' && p.x + p.w >= POLE_X - 4) {
          state = 'pole'; st = 0;
          Fx.fireworks(5);
          Fx.big('ゴール！！！');
          p.x = POLE_X - p.w + 2; p.vx = 0; p.vy = 0;
          flagY = 0;
          Sfx.play('clear');
        }
      } else if (state === 'enemy') {
        p.vy += GRAV * 0.8 * dt;
        p.y += p.vy * dt;
        if (st > 3.4) api.end(RESULTS.enemy(failInfo));
      } else if (state === 'pit') {
        if (st > 3.4) api.end(RESULTS.pit(failInfo));
      } else if (state === 'pole') {
        // 旗竿をすべり降りる
        const bottom = GY - T - p.h;
        p.y = Math.min(bottom, p.y + 260 * dt);
        flagY = Math.min(1, flagY + dt * 1.1);
        if (p.y >= bottom && flagY >= 1) { state = 'walk'; st = 0; p.x = POLE_X + 10; }
      } else if (state === 'walk') {
        p.vx = 150; p.face = 1;
        p.vy = Math.min(950, p.vy + GRAV * dt);
        moveBody(p, dt);
        p.phase += p.vx * dt * 0.045;
        if (p.x > CASTLE_X + 2.5 * T - p.w / 2) inCastle = true;
        if (st > 3.4) api.end(RESULTS.goal({ time: time.toFixed(1), stomps, coins, misses }));
      }

      const want = p.x - W * 0.38;
      cam = Math.max(cam, Math.max(0, Math.min(WORLD_W - W, want)));
      for (const f of puffs) f.t += dt;
      while (puffs.length && puffs[0].t > 0.5) puffs.shift();
      for (const f of coinFx) f.t += dt;
      while (coinFx.length && coinFx[0].t > 0.6) coinFx.shift();
    }

    /* ----- 描画 ----- */
    function drawBackground(c) {
      clearCanvas(c, '#6b8cff');
      // 山
      c.save();
      c.translate(-cam * 0.5, 0);
      for (let i = 0; i < 10; i++) {
        const x = i * 760 + 40, big = i % 2 === 0, r = big ? 120 : 70;
        c.fillStyle = '#3c9c3c';
        c.beginPath(); c.moveTo(x - r * 1.4, GY); c.quadraticCurveTo(x, GY - r * 1.6, x + r * 1.4, GY); c.fill();
        c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#1e6e1e';
        c.fillRect(x - 12, GY - r * 0.55, 5, 14); c.fillRect(x + 8, GY - r * 0.4, 5, 14);
      }
      c.restore();
      // 雲としげみ（同じ形を色ちがいで）
      const puff = (x, y, n, fill) => {
        // ふちを太く描いてから中を塗り、こぶの境目の線を消す
        const shape = () => {
          for (let k = 0; k < n; k++) { c.beginPath(); c.arc(x + k * 32, y - (k % 2 ? 14 : 6), 22, 0, Math.PI * 2); c.fill(); c.stroke(); }
          c.beginPath(); c.rect(x - 22, y - 6, (n - 1) * 32 + 44, 16); c.fill(); c.stroke();
        };
        c.lineWidth = 4;
        c.strokeStyle = '#111';
        c.fillStyle = '#111';
        shape();
        c.lineWidth = 0.01;
        c.strokeStyle = fill;
        c.fillStyle = fill;
        shape();
      };
      c.save();
      c.translate(-cam * 0.25, 0);
      for (let i = 0; i < 14; i++) puff(200 + i * 330, 90 + (i * 47) % 70, 1 + (i % 3), '#fff');
      c.restore();
      c.save();
      c.translate(-cam, 0);
      for (let i = 0; i < 20; i++) {
        const x = 460 + i * 600;
        if (GROUND.some(([a, b]) => x - 40 > a * T && x + 120 < (b + 1) * T)) puff(x, GY - 10, 1 + (i % 3), '#5ccc30');
      }
      c.restore();
    }

    function drawGround(c, s) {
      c.fillStyle = '#c84c0c';
      c.fillRect(s.x, s.y, s.w, s.h);
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      for (let x = s.x; x < s.x + s.w; x += T) {
        for (let y = s.y; y < H; y += T) {
          c.fillStyle = '#e07c3c';
          c.fillRect(x + 2, y + 2, T - 6, 4);
          c.strokeRect(x + 1, y + 1, T - 2, T - 2);
          c.beginPath();
          c.moveTo(x + 1, y + T / 2); c.lineTo(x + T * 0.6, y + T / 2);
          c.moveTo(x + T * 0.6, y + 1); c.lineTo(x + T * 0.6, y + T - 1);
          c.stroke();
        }
      }
    }

    function drawBlock(c, s) {
      const y = s.y - (s.bump > 0 ? Math.sin(s.bump / 0.15 * Math.PI) * 10 : 0);
      const x = s.x;
      c.lineWidth = 2;
      c.strokeStyle = '#000';
      if (s.k === 'q' && !s.used) {
        const blink = Math.floor(time * 4) % 4 === 3;
        c.fillStyle = blink ? '#c86c0c' : '#f8a830';
        c.fillRect(x, y, T, T);
        c.strokeRect(x + 1, y + 1, T - 2, T - 2);
        c.fillStyle = '#000';
        [[4, 4], [T - 8, 4], [4, T - 8], [T - 8, T - 8]].forEach(([a, b]) => c.fillRect(x + a, y + b, 4, 4));
        c.fillStyle = '#fff';
        c.font = `bold 26px ${FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('?', x + T / 2 + 1, y + T / 2 + 2);
        c.fillStyle = '#000';
        c.fillText('?', x + T / 2 + 3, y + T / 2 + 4);
        c.fillStyle = '#fff';
        c.fillText('?', x + T / 2 + 1, y + T / 2 + 2);
      } else if (s.k === 'q' || s.k === 'h') {
        c.fillStyle = s.k === 'h' ? '#c86c3c' : '#9c4a1c';
        c.fillRect(x, y, T, T);
        c.strokeRect(x + 1, y + 1, T - 2, T - 2);
        c.fillStyle = 'rgba(255,255,255,0.3)';
        c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + T - 3, y + 3); c.lineTo(x + T - 9, y + 9); c.lineTo(x + 9, y + 9); c.closePath(); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath(); c.moveTo(x + 3, y + T - 3); c.lineTo(x + T - 3, y + T - 3); c.lineTo(x + T - 9, y + T - 9); c.lineTo(x + 9, y + T - 9); c.closePath(); c.fill();
      } else if (s.k === 'b') {
        c.fillStyle = '#c84c0c';
        c.fillRect(x, y, T, T);
        c.strokeRect(x + 1, y + 1, T - 2, T - 2);
        c.beginPath();
        for (let r = 1; r < 4; r++) { c.moveTo(x, y + r * 10); c.lineTo(x + T, y + r * 10); }
        for (let r = 0; r < 4; r++) {
          const off = r % 2 ? 10 : 0;
          for (let k = off; k < T; k += 20) { c.moveTo(x + k, y + r * 10); c.lineTo(x + k, y + r * 10 + 10); }
        }
        c.stroke();
      }
    }

    function drawPipe(c, s) {
      const lip = 6;
      c.lineWidth = 2.5;
      c.strokeStyle = '#000';
      const body = (x, y, w, h) => {
        const g = c.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#2a8a10'); g.addColorStop(0.3, '#8ae05a'); g.addColorStop(0.5, '#3cb81c'); g.addColorStop(1, '#1a6a08');
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
        c.strokeRect(x, y, w, h);
      };
      body(s.x + 4, s.y + 32, s.w - 8, s.h - 32);
      body(s.x - lip + 4, s.y, s.w + lip * 2 - 8, 32);
    }

    function drawEnemy(c, e) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      if (!e.alive) {
        c.globalAlpha = Math.max(0, 1 - e.flat / 0.6);
        c.fillStyle = '#8c4a14';
        c.beginPath(); c.ellipse(cx, by - 5, 18, 6, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        return;
      }
      const step = Math.floor(time * 6 + e.x) % 2 === 0;
      c.lineWidth = 2;
      c.strokeStyle = '#000';
      // 足
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(cx - (step ? 10 : 7), by - 4, 9, 5, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(cx + (step ? 7 : 10), by - 4, 9, 5, 0, 0, Math.PI * 2); c.fill();
      // 体（きのこ形）
      c.fillStyle = '#f0c8a0';
      c.fillRect(cx - 9, by - 16, 18, 10);
      c.fillStyle = '#9c4a14';
      c.beginPath();
      c.moveTo(cx - 19, by - 12);
      c.quadraticCurveTo(cx - 20, by - 34, cx, by - 34);
      c.quadraticCurveTo(cx + 20, by - 34, cx + 19, by - 12);
      c.closePath();
      c.fill(); c.stroke();
      // 目とまゆ
      c.fillStyle = '#fff';
      c.fillRect(cx - 9, by - 25, 6, 9);
      c.fillRect(cx + 3, by - 25, 6, 9);
      c.fillStyle = '#000';
      c.fillRect(cx - 7, by - 22, 3, 5);
      c.fillRect(cx + 5, by - 22, 3, 5);
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(cx - 12, by - 30); c.lineTo(cx - 3, by - 26);
      c.moveTo(cx + 12, by - 30); c.lineTo(cx + 3, by - 26);
      c.stroke();
    }

    function drawGoal(c) {
      const top = GY - T - 330;
      c.fillStyle = '#5ccc30';
      c.fillRect(POLE_X - 3, top, 6, GY - T - top);
      c.strokeStyle = '#000';
      c.lineWidth = 1.5;
      c.strokeRect(POLE_X - 3, top, 6, GY - T - top);
      c.fillStyle = '#1a8a1a';
      c.beginPath(); c.arc(POLE_X, top - 6, 9, 0, Math.PI * 2); c.fill(); c.stroke();
      // 旗
      const fy = top + 14 + flagY * (GY - T - top - 60);
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(POLE_X - 3, fy); c.lineTo(POLE_X - 52, fy + 20); c.lineTo(POLE_X - 3, fy + 40); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2a9a2a';
      c.beginPath(); c.arc(POLE_X - 20, fy + 20, 7, 0, Math.PI * 2); c.fill();
      // 城
      const x = CASTLE_X, w = 5 * T;
      const brick = (bx, by, bw, bh) => {
        c.fillStyle = '#c84c0c';
        c.fillRect(bx, by, bw, bh);
        c.strokeStyle = '#000';
        c.lineWidth = 1.5;
        c.strokeRect(bx, by, bw, bh);
        c.beginPath();
        for (let yy = by + 10; yy < by + bh; yy += 10) { c.moveTo(bx, yy); c.lineTo(bx + bw, yy); }
        c.stroke();
      };
      brick(x, GY - 2 * T, w, 2 * T);
      brick(x + T, GY - 4 * T, 3 * T, 2 * T);
      for (let k = 0; k < 5; k++) brick(x + k * T + 6, GY - 2 * T - 14, 28, 14);
      for (let k = 0; k < 3; k++) brick(x + T + k * T + 6, GY - 4 * T - 14, 28, 14);
      c.fillStyle = '#000';
      c.beginPath(); c.moveTo(x + 2 * T, GY); c.lineTo(x + 2 * T, GY - 40); c.arc(x + 2.5 * T, GY - 40, T / 2, Math.PI, 0); c.lineTo(x + 3 * T, GY); c.fill();
      c.fillRect(x + 1.6 * T, GY - 3.6 * T, 12, 28);
      c.fillRect(x + 3.1 * T, GY - 3.6 * T, 12, 28);
    }

    function draw(c) {
      drawBackground(c);
      c.save();
      c.translate(-Math.round(cam), 0);
      const vis = s => s.x + s.w > cam - 10 && s.x < cam + W + 10;
      solids.forEach(s => {
        if (!vis(s)) return;
        if (s.k === 'ground') drawGround(c, s);
        else if (s.k === 'pipe') drawPipe(c, s);
      });
      drawGoal(c);
      enemies.forEach(e => { if (!e.gone && e.x > cam - 60 && e.x < cam + W + 60) drawEnemy(c, e); });
      for (const f of coinFx) {
        const y = f.y - 20 - Math.sin(Math.min(1, f.t / 0.6) * Math.PI) * 70;
        c.fillStyle = '#f8c830';
        c.strokeStyle = '#000';
        c.lineWidth = 2;
        c.beginPath(); c.ellipse(f.x, y, 7 * Math.abs(Math.cos(f.t * 14)) + 2, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      solids.forEach(s => { if (vis(s) && (s.k === 'b' || s.k === 'q' || s.k === 'h')) drawBlock(c, s); });
      for (const f of puffs) {
        c.strokeStyle = `rgba(255,255,255,${0.8 - f.t})`;
        c.lineWidth = 3;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI + i * Math.PI / 5, r1 = 10 + f.t * 40, r2 = 18 + f.t * 50;
          c.moveTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1 * 0.6);
          c.lineTo(f.x + Math.cos(a) * r2, f.y + Math.sin(a) * r2 * 0.6);
        }
        c.stroke();
      }
      if (!inCastle) {
        const fx = p.x + p.w / 2, fy = p.y + p.h;
        let pose = 'stand';
        if (state === 'enemy' || !p.onGround) pose = 'jump';
        else if (Math.abs(p.vx) > 20) pose = 'walk';
        if (state === 'pole') pose = 'jump';
        if (!(p.inv > 0 && Math.floor(p.inv * 10) % 2)) drawStick(c, fx, fy, 58, { pose, phase: p.phase, facing: p.face });
      }
      c.restore();

      // 上のHUD
      c.fillStyle = '#fff';
      c.font = `bold 18px ${FONT}`;
      c.textBaseline = 'top';
      const hud = (label, val, x) => {
        c.textAlign = 'left';
        c.fillText(label, x, 12);
        c.fillText(val, x, 34);
      };
      hud('ゆうしゃ', String(stomps * 100 + coins * 200).padStart(6, '0'), 60);
      hud('コイン', `×${String(coins).padStart(2, '0')}`, 290);
      hud('ワールド', ' 1-1', 470);
      hud('ライフ', '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(LIVES - Math.max(0, lives)), 620);
      hud('タイム', String(Math.max(0, 400 - Math.floor(time * 2.5))).padStart(3, ' '), 760);
      if (time < 4 && state === 'play' && !Pad.touch) {
        c.globalAlpha = Math.min(1, 4 - time);
        c.textAlign = 'center';
        c.font = `bold 16px ${FONT}`;
        c.fillStyle = '#fff';
        c.fillText('← → 移動　　Space ジャンプ', W / 2, H - 32);
        c.globalAlpha = 1;
      }
    }

    return { update, draw, _dbg: { p, enemies, solids, get state() { return state; } } };
  }

  return {
    create,
    debugResult(ok) { return ok ? RESULTS.goal({ time: '42.0', stomps: 5, coins: 3 }) : RESULTS.enemy({ m: 30, jumps: 8, stomps: 3, coins: 2 }); }
  };
})();
