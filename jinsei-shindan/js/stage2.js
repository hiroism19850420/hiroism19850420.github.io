// ステージ2：リスクへの向き合い方（横スクロールシューティング）
'use strict';

window.Stage2 = (function () {
  const TOP = 48, BOT = H - 46;   // 飛べる範囲（下は山の地形）
  const LIMIT = 40;               // 制限時間（秒）
  const GATE = 7800;              // ゴールの位置（進んだ距離 + 画面上の位置）
  const SPEED_MIN = 140, SPEED_ADD = 300;

  // どの終わり方でも、撃ち方と前への出方は必ず言う
  const extras = i => [
    i.shots === 0
      ? 'あなたは一度も撃ちませんでした。戦わずに済むなら、何を失ってもいい人生です。'
      : i.kills === 0
        ? `あなたは${i.shots}発撃って、1機も落としませんでした。努力の量と成果がまったく比例しない人生です。`
        : `あなたは${i.shots}発撃って、${i.kills}機を撃ち落としました。命中率は${Math.round(i.kills / i.shots * 100)}%です。残りの弾は、どこかの誰かに当たっています。`,
    i.back >= 50
      ? `あなたは時間の${i.back}%を、画面の後ろ半分で過ごしました。「前に出ろ」と言われると、まず一歩下がる人生です。`
      : `あなたは時間の${100 - i.back}%を、画面の前のほうで過ごしました。前に出たがるくせに、前で何をするかは考えていません。`
  ];

  const RESULTS = {
    collision: i => ({
      cleared: false, resultType: 'collision', diagnosisTag: 'リスク軽視型',
      diagnosisText: [`あなたは出撃から${i.time}秒後、${i.what}に正面から突っ込みました。そのとき前進速度は最大の${i.spd}%でした。あなたは、危険を察知しても立ち止まれない人間です。「自分だけは大丈夫」と思って生きてきましたね。その根拠を、あなたは一度も示したことがありません。`].concat(extras(i)).join('\n'),
      playResult: `${i.what}に接触（進行度 ${i.pct}%）`
    }),
    clear: i => ({
      cleared: true, resultType: 'avoided_all', diagnosisTag: '慎重型',
      diagnosisText: [`あなたは${i.time}秒間、一度も被弾せずにゴールしました。あなたは危険を回避する能力に優れています。ただし、挑戦した記録はありません。避けるのが上手いのは、ぶつかるほど何かに本気になったことがないからです。`].concat(extras(i)).join('\n'),
      playResult: `無傷でゴール（タイム ${i.time}秒／撃墜 ${i.kills}機）`
    }),
    timeout: i => ({
      cleared: false, resultType: 'timeout', diagnosisTag: '機会損失型',
      diagnosisText: [`あなたは${LIMIT}秒かけて、ゴールまで${i.pct}%しか進めませんでした。あなたは慎重に検討した結果、機会を逃す傾向があります。「いつかやる」の「いつか」は、たぶん来ません。`].concat(extras(i)).join('\n'),
      playResult: `時間切れ（進行度 ${i.pct}%）`
    })
  };

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  function create(api) {
    const R = rng((Math.random() * 1e9) | 0);
    const pick = a => a[Math.floor(R() * a.length)];
    const objs = [];
    let wx = 1150, n = 0;
    while (wx < GATE - 700) {
      const k = n < 2 ? ['pillar', 'enemy'][n] : pick(['pillar', 'pillar', 'enemy', 'enemy', 'rock']);
      if (k === 'pillar') {
        const gap = 205, cy = TOP + 40 + gap / 2 + R() * (BOT - TOP - 80 - gap);
        const jag = [];
        for (let i = 0; i < 8; i++) jag.push(R() * 10);
        objs.push({ k, wx, w: 58, top: cy - gap / 2, bot: cy + gap / 2, jag });
        wx += 400 + R() * 80;
      } else if (k === 'enemy') {
        // 編隊（同じ高さで一列にやってきて、波打つ）
        const base = TOP + 80 + R() * (BOT - TOP - 160);
        const cnt = 4 + Math.floor(R() * 2);
        for (let i = 0; i < cnt; i++) objs.push({ k, wx: wx + i * 70, base, amp: 60, ph: -i * 0.55, r: 15, y: base, alive: true });
        wx += 420 + cnt * 50;
      } else {
        const y1 = TOP + 60 + R() * 110;
        const shape = () => { const a = []; for (let i = 0; i < 10; i++) a.push(0.82 + R() * 0.25); return a; };
        objs.push({ k, wx, cy: y1, r: 38, shape: shape() });
        objs.push({ k, wx: wx + 170, cy: y1 + 220 + R() * 50, r: 38, shape: shape() });
        wx += 460;
      }
      n++;
    }

    const p = { x: 160, y: (TOP + BOT) / 2, vy: 0, bank: 0 };
    let dist = 0, time = 0, backTime = 0, state = 'play', st = 0, kills = 0, shotsFired = 0, cool = 0, info = null;
    const stats = () => ({ kills, shots: shotsFired, back: Math.round(backTime / Math.max(0.1, time) * 100) });
    const shots = [], pops = [];
    const stars = [];
    for (let i = 0; i < 90; i++) stars.push({ x: R() * W, y: TOP + R() * (BOT - TOP), z: 0.2 + R() * 0.8 });
    const ridge = [];
    for (let i = 0; i < 60; i++) ridge.push(10 + R() * 34);

    const speedRate = () => Math.max(0, Math.min(1, (p.x - 60) / 840));
    const speed = () => SPEED_MIN + speedRate() * SPEED_ADD;
    const progress = () => Math.max(0, Math.min(1, (dist + p.x) / GATE));
    const pbox = () => ({ x: p.x - 32, y: p.y - 9, w: 66, h: 18 });
    const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const circleRect = (cx, cy, r, b) => {
      const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
      return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
    };
    function pillarRects(o) {
      const sx = o.wx - dist;
      return [{ x: sx, y: TOP - 60, w: o.w, h: o.top - TOP + 60 }, { x: sx, y: o.bot, w: o.w, h: H - o.bot + 60 }];
    }
    function hits(o, box) {
      const sx = o.wx - dist;
      if (o.k === 'pillar') return pillarRects(o).some(r => rectHit(box, r));
      if (o.k === 'rock') return circleRect(sx, o.cy, o.r * 0.9, box);
      return o.alive && circleRect(sx, o.y, o.r - 2, box);
    }

    function crash(o) {
      state = 'crash'; st = 0;
      const what = o.k === 'enemy' ? '敵機' : o.k === 'rock' ? '浮かぶ岩' : '岩の壁';
      info = Object.assign({ what, time: time.toFixed(1), spd: Math.round(speedRate() * 100), pct: Math.round(progress() * 100) }, stats());
      Fx.explode(p.x, p.y, 2.2, '');
      Fx.taunt('ぶつかっちゃいましたね〜〜');
    }

    function update(dt) {
      st += dt;
      if (state === 'play') {
        time += dt;
        if (p.x < W / 2) backTime += dt;
        const dx = (Input.isDown('ArrowRight') ? 1 : 0) - (Input.isDown('ArrowLeft') ? 1 : 0);
        const dy = (Input.isDown('ArrowDown') ? 1 : 0) - (Input.isDown('ArrowUp') ? 1 : 0);
        p.x = Math.max(50, Math.min(W - 80, p.x + dx * 300 * dt));
        p.y = Math.max(TOP + 14, Math.min(BOT - 14, p.y + dy * 300 * dt));
        p.bank += (dy * 0.25 - p.bank) * Math.min(1, dt * 10);
        dist += speed() * dt;

        cool -= dt;
        if (Input.isDown('Space', 'KeyZ') && cool <= 0) {
          shots.push({ x: p.x + 50, y: p.y - 10 });
          shotsFired++;
          cool = 0.2;
          Sfx.play('shoot');
        }

        for (const o of objs) {
          if (o.k !== 'enemy' || !o.alive) continue;
          const sx = o.wx - dist;
          if (sx < W + 60) o.wx -= 90 * dt; // 画面に入ったら向かってくる
          o.y = o.base + Math.sin(time * 2.6 + o.ph) * o.amp;
        }

        for (const s of shots) s.x += 760 * dt;
        for (const s of shots) {
          if (s.dead) continue;
          const sb = { x: s.x - 8, y: s.y - 2, w: 16, h: 4 };
          for (const o of objs) {
            const sx = o.wx - dist;
            if (sx < -100 || sx > W + 40) continue;
            if (!hits(o, sb)) continue;
            s.dead = true;
            if (o.k === 'enemy') {
              o.alive = false; kills++;
              Fx.explode(sx, o.y, 0.9, kills % 2 ? 'ドカーン！' : 'バコーン！');
            }
            break;
          }
        }
        for (let i = shots.length - 1; i >= 0; i--) if (shots[i].dead || shots[i].x > W + 20) shots.splice(i, 1);

        const pb = pbox();
        for (const o of objs) {
          const sx = o.wx - dist;
          if (sx < -120 || sx > W + 40) continue;
          if (hits(o, pb)) { crash(o); break; }
        }
        if (state === 'play' && GATE - dist <= p.x) { state = 'goal'; st = 0; Fx.fireworks(4.5); Fx.big('ステージクリア！！'); }
        if (state === 'play' && time >= LIMIT) {
          state = 'timeout'; st = 0; time = LIMIT;
          Fx.taunt('おそすぎ〜〜　時間切れで〜〜す');
          info = Object.assign({ pct: Math.round(progress() * 100) }, stats());
          Sfx.play('fail');
        }
      } else if (state === 'crash') {
        p.vy += 900 * dt;
        p.y += p.vy * dt;
        p.x -= 60 * dt;
        if (st > 3.4) api.end(RESULTS.collision(info));
      } else if (state === 'goal') {
        p.x += 520 * dt;
        dist += 140 * dt;
        if (st > 4.2) api.end(RESULTS.clear(Object.assign({ time: time.toFixed(1) }, stats())));
      } else if (state === 'timeout') {
        if (st > 3.4) api.end(RESULTS.timeout(info));
      }
      for (const q of pops) q.t += dt;
      while (pops.length && pops[0].t > 0.7) pops.shift();
    }

    // 黒い棒人間（宇宙で見えるように白いふちどり）
    function drawFlyer(c, x, y, rot, t) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.scale(1.35, 1.35);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      const fl = Math.sin(t * 18) * 5;
      const cape = () => {
        c.beginPath();
        c.moveTo(14, -4);
        c.quadraticCurveTo(-10, -18 + fl, -40, -12 + fl * 1.6);
        c.lineTo(-30, -2 + fl);
        c.quadraticCurveTo(-8, -2, 12, 2);
        c.closePath();
      };
      const body = () => {
        c.beginPath();
        c.moveTo(16, 0); c.lineTo(-14, 0);
        c.moveTo(-14, 0); c.lineTo(-30, -4); c.lineTo(-44, -2);
        c.moveTo(-14, 0); c.lineTo(-30, 5); c.lineTo(-43, 7);
        c.moveTo(14, -1); c.lineTo(30, -6); c.lineTo(44, -9);
        c.moveTo(12, 1); c.lineTo(2, 9); c.lineTo(-8, 10);
      };
      // ふちどり
      c.strokeStyle = '#fff';
      c.lineWidth = 8;
      cape(); c.stroke();
      body(); c.stroke();
      c.beginPath(); c.arc(26, -12, 11, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
      // 本体
      c.fillStyle = '#d02020';
      cape(); c.fill();
      c.strokeStyle = '#111';
      c.lineWidth = 4;
      body(); c.stroke();
      c.fillStyle = '#111';
      c.beginPath(); c.arc(26, -12, 8.5, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function drawFan(c, x, y, r) {
      c.save();
      c.translate(x, y);
      c.rotate(time * 10);
      for (let i = 0; i < 3; i++) {
        c.rotate(Math.PI * 2 / 3);
        c.fillStyle = i === 0 ? '#ff9a2a' : '#e8e8e8';
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(r * 1.1, -r * 0.5, r * 1.2, r * 0.2);
        c.quadraticCurveTo(r * 0.6, r * 0.2, 0, 0);
        c.fill();
      }
      c.fillStyle = '#3a6ee8';
      c.beginPath(); c.arc(0, 0, r * 0.38, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function rockPath(c, cx, cy, r, shape) {
      c.beginPath();
      shape.forEach((k, i) => {
        const a = i / shape.length * Math.PI * 2;
        c.lineTo(cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k);
      });
      c.closePath();
    }

    function draw(c) {
      clearCanvas(c, '#000');
      // 星
      for (const s of stars) {
        const x = ((s.x - dist * 0.25 * s.z) % W + W) % W;
        c.fillStyle = s.z > 0.7 ? '#fff' : s.z > 0.45 ? '#9ab' : '#456';
        c.fillRect(x, s.y, s.z > 0.7 ? 3 : 2, s.z > 0.7 ? 3 : 2);
      }

      // ゴールゲート
      const gx = GATE - dist;
      if (gx < W + 40) {
        for (let y = TOP; y < BOT; y += 24) {
          c.fillStyle = (Math.floor(y / 24 + time * 6) % 2) ? '#5cf' : '#fff';
          c.fillRect(gx - 5, y, 10, 14);
        }
      }

      for (const o of objs) {
        const sx = o.wx - dist;
        if (sx < -120 || sx > W + 60) continue;
        if (o.k === 'pillar') {
          // 上下から伸びる岩
          const seg = (y0, y1, down) => {
            c.fillStyle = '#7a5a3a';
            c.strokeStyle = '#c8a070';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(sx - 6, y0);
            const n = o.jag.length;
            for (let i = 0; i <= n; i++) {
              const t = i / n;
              c.lineTo(sx - 6 + o.jag[i % n] * 0.6, y0 + (y1 - y0) * t);
            }
            c.lineTo(sx + o.w / 2, y1 + (down ? 8 : -8));
            for (let i = n; i >= 0; i--) {
              const t = i / n;
              c.lineTo(sx + o.w + 6 - o.jag[(i + 3) % n] * 0.6, y0 + (y1 - y0) * t);
            }
            c.closePath();
            c.fill(); c.stroke();
            c.fillStyle = '#5a3e26';
            for (let i = 1; i < 4; i++) c.fillRect(sx + 10 + (i * 13) % 30, y0 + (y1 - y0) * i / 4, 8, 5);
          };
          seg(TOP - 10, o.top, true);
          seg(BOT + 50, o.bot, false);
        } else if (o.k === 'rock') {
          c.fillStyle = '#6a6060';
          c.strokeStyle = '#b0a8a0';
          c.lineWidth = 2;
          rockPath(c, sx, o.cy, o.r, o.shape);
          c.fill(); c.stroke();
          c.fillStyle = '#4a4242';
          c.beginPath(); c.arc(sx - 10, o.cy - 8, 8, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.arc(sx + 12, o.cy + 10, 6, 0, Math.PI * 2); c.fill();
        } else if (o.alive) {
          drawFan(c, sx, o.y, o.r);
        }
      }

      // 下の山なみ
      c.fillStyle = '#3a8a2a';
      c.strokeStyle = '#8ad85a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, H);
      const off = dist % 60, base = Math.floor(dist / 60);
      for (let i = 0; i <= 18; i++) {
        const h = ridge[(base + i) % ridge.length];
        c.lineTo(i * 60 - off, BOT + 46 - h);
      }
      c.lineTo(W, H);
      c.closePath();
      c.fill(); c.stroke();

      c.fillStyle = '#ffe85a';
      for (const s of shots) { c.fillRect(s.x - 8, s.y - 2, 16, 4); }
      for (const q of pops) {
        const k = q.t / 0.7, r = (q.big ? 40 : 22) * (0.4 + k);
        c.fillStyle = `rgba(255,${180 - k * 120},40,${1 - k})`;
        c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2); c.fill();
        c.fillStyle = `rgba(255,255,220,${1 - k})`;
        c.beginPath(); c.arc(q.x, q.y, r * 0.5, 0, Math.PI * 2); c.fill();
      }

      if (!(state === 'crash' && st > 0.15)) drawFlyer(c, p.x, p.y, p.bank, time);
      else if (st < 1.2) drawFlyer(c, p.x, p.y, st * 8, time);

      // HUD
      c.fillStyle = '#000';
      c.fillRect(0, 0, W, TOP - 6);
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.font = `bold 16px ${FONT}`;
      c.fillStyle = '#fff';
      c.fillText(`1P  ${String(kills * 100).padStart(7, '0')}`, 18, 21);
      const rest = Math.max(0, LIMIT - time);
      c.textAlign = 'center';
      c.font = `bold 18px ${FONT}`;
      c.fillStyle = rest < 10 ? '#ff6a4a' : '#fff';
      c.fillText(`のこり ${rest.toFixed(1)}`, 400, 21);
      c.textAlign = 'left';
      c.font = `12px ${FONT}`;
      c.fillStyle = '#9ab';
      c.fillText('スピード', 520, 21);
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i < Math.round(1 + speedRate() * 4) ? '#5cf' : '#234';
        c.fillRect(578 + i * 10, 14, 7, 14);
      }
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.strokeRect(W - 250, 14, 160, 14);
      c.fillStyle = '#fff';
      c.fillRect(W - 248, 16, 156 * progress(), 10);
      c.fillStyle = '#9ab';
      c.fillText('ゴール', W - 80, 21);
      if (time < 4.5 && state === 'play' && !Pad.touch) {
        c.globalAlpha = Math.min(1, 4.5 - time);
        c.textAlign = 'center';
        c.font = `bold 16px ${FONT}`;
        c.fillStyle = '#fff';
        c.fillText('↑↓←→ 移動　Space ショット　　右に寄るほど速く進みます', W / 2, BOT - 24);
        c.globalAlpha = 1;
      }
    }

    return { update, draw, _dbg: { p, objs, get dist() { return dist; }, get state() { return state; }, get time() { return time; } } };
  }

  return {
    create,
    debugResult(ok) { return ok ? RESULTS.clear({ time: '31.2', kills: 4, shots: 60, back: 20 }) : RESULTS.timeout({ pct: 82, back: 74, kills: 0, shots: 12 }); }
  };
})();
