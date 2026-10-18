// ステージ4：人間関係（コマンド選択式RPG）
'use strict';

window.Stage4 = (function () {
  const TS = 40, MAP_Y = 10;
  // M=山 T=森 ~=川 ==橋 C=王様の城 V=村 D=魔王の城 $=宝箱
  const MAP = [
    'MMMMMMMMMMMMMMMMMMMMMMMM',
    'MMM.....TTTT...~~~MMMMMM',
    'MM.C....TTTT...~~~..MMMM',
    'MM......TT.....~~~...MMM',
    'M....V.........~~~....MM',
    'M..............===...DMM',
    'M.....TTTT.....~~~....MM',
    'MM....TTTT.....~~~..TMMM',
    'MM.....TT......~~~.TTMMM',
    'MMM....$.......~~~MMMMMM',
    'MMMMM.....MMM..~~~MMMMMM',
    'MMMMMMMMMMMMMMM~~~MMMMMM',
    'MMMMMMMMMMMMMMMMMMMMMMMM'
  ];
  const WALKABLE = new Set(['.', 'T', 'V', '$', '=', 'D']);
  const MSG_WIDE = { x: 36, y: 372, w: 888, h: 150 };
  const MSG_TOUCH = { x: 250, y: 372, w: 470, h: 150 }; // スマホ：十字ボタンと決定ボタンの間
  const CPS = 32; // 1秒あたりの文字数
  const STEP = 0.17;

  const FORCED = 'あなたは自分を勇者にしました。自分が世界の主人公だと思う節があります。周りを見ましょう。';
  const CLOSING = 'あなたは画面の中で世界を救いました。現実のあなたは、今日、誰かを助けましたか。';

  const DIAG = {
    e1: {
      help: { tag: '協調型', reason: 'あなたは、橋の前で困っている村人を助けると約束しました。', text: 'あなたは他人への配慮を重視する傾向があります。ただし、断れないだけかもしれません。「いい人」と呼ばれる人の多くは、ただ都合のいい人です。' },
      ignore: { tag: '不干渉型', reason: 'あなたは、助けを求める村人の前を、聞こえないふりをして通り過ぎようとしました。', text: 'あなたは他人の問題を自分の問題として扱わない傾向があります。あなたが困ったときも、たぶん誰も来ません。' },
      reward: { tag: '対価要求型', reason: 'あなたは、困っている村人にまず報酬の額を聞きました。', text: 'あなたは善意にも費用対効果を求める人間です。しなびた薬草1つで動く程度の正義感です。' }
    },
    e2: {
      cheer: { tag: '寛容型', reason: 'あなたは、攻撃を外して転んだ仲間を励ましました。', text: 'あなたは他人の失敗を許容できる人間です。そのぶん、自分の失敗にもだいぶ甘いはずです。' },
      blame: { tag: '原因究明型', reason: 'あなたは、転んだ仲間に理由を3つ挙げさせ、その場で2時間を使いました。', text: 'あなたは失敗の原因を明確にすることを重視します。その2時間で、魔物は遠くへ逃げました。あなたの会議も、だいたいそうです。' },
      self: { tag: '抱え込み型', reason: 'あなたは、仲間が逃がした魔物を一人で追いかけて倒しました。', text: 'あなたは他人に任せるより、自分でやった方が早いと考える傾向があります。そうやって仕事を抱え込み、「誰も手伝ってくれない」と言う人生です。' }
    },
    e3: {
      share: { tag: '分かち合い型', reason: 'あなたは、魔王を倒した喜びを仲間と分かち合いました。', text: 'あなたは成果を分かち合える人間です。ただし、早く帰りたかった仲間もいました。あなたは空気を読めているつもりですが、読めていません。' },
      praise: { tag: '主人公型', reason: 'あなたは、魔王を倒したあと、自分だけが称賛されることを望みました。', text: 'あなたは自分を勇者、周囲を脇役だと思ってきた人生です。拍手が少し遅れた理由を、あなたは一生考えません。' },
      check: { tag: '明細重視型', reason: 'あなたは、魔王を倒したあと、まっさきに報酬の明細を確認しました。', text: 'あなたは感動よりも、明細を信じてきた人生です。経験値3では、レベルは上がりません。' }
    }
  };
  const LABELS = {
    e1: { help: '助ける', ignore: '無視する', reward: '報酬を要求する' },
    e2: { cheer: '励ます', blame: '責任を追及する', self: '自分が代わりに解決する' },
    e3: { share: '仲間と喜びを分かち合う', praise: '自分だけが称賛されることを望む', check: '報酬を確認する' }
  };

  function buildResult(ch) {
    const d = ['e1', 'e2', 'e3'].map(k => DIAG[k][ch[k]]);
    return {
      cleared: true,
      resultType: 'events_completed',
      diagnosisTag: ['勇者型'].concat(d.map(x => x.tag)).join('・'),
      diagnosisText: [FORCED].concat(d.map(x => x.reason + x.text), [CLOSING]).join('\n'),
      playResult: `村人に：${LABELS.e1[ch.e1]}／仲間の失敗に：${LABELS.e2[ch.e2]}／魔王討伐後：${LABELS.e3[ch.e3]}`
    };
  }

  function create(api) {
    const MSG = Pad.touch ? MSG_TOUCH : MSG_WIDE;
    const N = (gameState.playerName || 'ゆうしゃ').slice(0, 8);
    const map = MAP.map(r => r.split(''));
    const ch = {};
    const flags = { e1Done: false, mobDone: false, chest: false, village: false, warriorDown: false, enemyGone: 0, bossLeave: 0 };
    let view = 'map', battle = 'mob';
    const party = [
      { x: 3, y: 3, fx: 3, fy: 3, hat: null, sword: true },
      { x: 3, y: 3, fx: 3, fy: 3, hat: 'helmet' },
      { x: 3, y: 3, fx: 3, fy: 3, hat: 'wizard' }
    ];
    const npc = { x: 14, y: 5 };
    let moveT = 1, face = 1;

    const say = text => ({ t: 'say', text });
    const set = (k, v) => ({ t: 'set', k, v });
    const scene = v => ({ t: 'view', v });
    const choice = (key, prompt, opts) => ({ t: 'choice', key, prompt, opts });
    const cmd = () => choice('cmd', 'コマンド？', [
      { v: 'fight', label: 'たたかう', then: [() => say(`${N}の　こうげき！　${battle === 'boss' ? 'まおう' : 'まもの'}に　${battle === 'boss' ? 1 : 3}の　ダメージ！`)] },
      { v: 'spell', label: 'じゅもん', then: [say(`${N}は　じゅもんを　となえた！　しかし　MPが　たりない！`)] },
      { v: 'run', label: 'にげる', then: [say(`${N}は　にげだした！　しかし　まわりこまれて　しまった！`)] }
    ]);

    let queue = [
      say('おうさま「おお　' + N + 'よ。　ひがしの　まおうを　たおしてまいれ」'),
      say(`${N}は　ゆうしゃに　なった。（ことわる　せんたくしは　なかった）`),
      say('なかまの　せんしと　まほうつかいが　ついてきた。'),
      say('（やじるしキーで　あるけます。　まおうの　しろは　ひがし）')
    ];

    const events = {
      villager: () => [
        say('むらびと「たびの　おかた！　はしの　むこうに　まものが　でて、はたけに　いけません。どうか　おたすけを……」'),
        choice('e1', `${N}は　どうする？`, [
          { v: 'help', label: '助ける', then: [say(`${N}は　まものを　たいじすると　やくそくした。`), say('むらびと「ありがとうございます！　このごおんは　いっしょう　わすれません！」')] },
          { v: 'ignore', label: '無視する', then: [say(`${N}は　きこえない　ふりをして　とおりすぎようとした。`)] },
          { v: 'reward', label: '報酬を要求する', then: [say(`${N}「で、　いくら　でる？」`), say('むらびとは　しなびた　やくそうを　さしだした。'), say(`${N}は　しなびた　やくそうを　てにいれた。`)] }
        ]),
        set('e1Done', true),
        { t: 'fn', fn: () => { npc.y = 4; } },
        say('むらびとは　みちを　あけた。')
      ],
      mob: () => [
        scene('battle'), { t: 'fn', fn: () => { battle = 'mob'; flags.enemyGone = 0; } },
        say('まものが　あらわれた！'),
        cmd(),
        say('せんしの　こうげき！'),
        set('warriorDown', true),
        say('……ミス！　せんしは　ころんで　しまった。'),
        set('enemyGone', 0.001),
        say('まものは　にげだした。'),
        say('せんし「す、すまない……」'),
        choice('e2', `${N}は　どうする？`, [
          { v: 'cheer', label: '励ます', then: [say(`${N}「だいじょうぶ。　つぎが　ある」`), say('せんしは　すこし　なみだぐんだ。')] },
          { v: 'blame', label: '責任を追及する', then: [say(`${N}「なぜ　ころんだのか、　りゆうを　３つ　あげてくれ」`), say('せんしは　はんせいぶんを　かきはじめた。'), say('その場で　２じかんが　たった。')] },
          { v: 'self', label: '自分が代わりに解決する', then: [say(`${N}は　ひとりで　まものを　おいかけ、　たおした。`), say('せんしは　なにも　いえなかった。')] }
        ]),
        set('warriorDown', false),
        set('mobDone', true),
        scene('map')
      ],
      boss: () => [
        scene('battle'), { t: 'fn', fn: () => { battle = 'boss'; flags.enemyGone = 0; } },
        say('まおうが　あらわれた！'),
        say('まおう「よくぞ　きた。　だが　ここで　おわりだ」'),
        cmd(),
        say('まおう「……む。　もう　ていじか」'),
        set('bossLeave', 0.001),
        say('まおうは　かえりじたくを　はじめた。'),
        say('まおうを　たおした！（ことに　なった）'),
        scene('after'),
        say('せかいに　へいわが　もどった。'),
        choice('e3', `${N}は　どうする？`, [
          { v: 'share', label: '仲間と喜びを分かち合う', then: [say(`${N}たちは　かたを　くんで　よろこんだ。`), say('まほうつかい「（つかれたから　はやく　かえりたい……）」')] },
          { v: 'praise', label: '自分だけが称賛されることを望む', then: [say(`${N}「みんな！　わたしを　みて！」`), say('なかまたちは　はくしゅを　した。　すこし　おくれて。')] },
          { v: 'check', label: '報酬を確認する', then: [say(`${N}は　ほうしゅうの　めいさいを　ねんいりに　かくにんした。`), () => say(`めいさい：けいけんち　３　／　ゴールド　１２${ch.e1 === 'reward' ? '　／　しなびた　やくそう　１' : ''}${flags.chest ? '　／　やくそう　１' : ''}`)] }
        ]),
        say('──　こうして　でんせつは　はじまった。'),
        { t: 'end' }
      ]
    };

    let cur = null, shown = 0, cursor = 0, time = 0, typeTick = 0, ending = 0;
    const confetti = [];
    for (let i = 0; i < 60; i++) confetti.push({ x: Math.random() * W, y: -Math.random() * 400, v: 40 + Math.random() * 60, r: Math.random() * 6, s: 5 + Math.random() * 5, col: ['#e63c3c', '#f2d22e', '#3a5ee6', '#4cc94a', '#fff'][i % 5] });

    function advance() {
      for (;;) {
        let s = queue.shift();
        if (typeof s === 'function') s = s();
        if (!s) { cur = null; return; }
        if (s.t === 'view') { view = s.v; Music.play(view === 'battle' ? 'battle' : 'field'); continue; }
        if (s.t === 'set') { flags[s.k] = s.v; continue; }
        if (s.t === 'fn') { s.fn(); continue; }
        if (s.t === 'end') { cur = s; ending = 0.001; return; }
        cur = s; shown = 0; cursor = 0;
        return;
      }
    }
    function runEvent(list) { queue = list.concat(queue); advance(); }
    advance();

    const fullText = () => cur.t === 'choice' ? cur.prompt : cur.text;
    const typing = () => shown < [...fullText()].length;

    function menuRect() {
      ctx.font = `20px ${FONT}`;
      const longest = Math.max(...cur.opts.map(o => ctx.measureText(o.label).width));
      const n = cur.opts.length, w = Math.max(200, Math.ceil(longest) + 90), h = n * 44 + 26;
      return { x: MSG.x, y: MSG.y - h - 10, w, h };
    }

    function pick(i) {
      const o = cur.opts[i];
      ch[cur.key] = o.v;
      Sfx.play('select');
      queue.unshift(...o.then);
      advance();
    }

    const tileAt = (x, y) => (map[y] && map[y][x]) || 'M';

    function arrive() {
      const h = party[0], t = tileAt(h.x, h.y);
      if (t === 'V' && !flags.village) {
        flags.village = true;
        runEvent([say('ここは　はじまりの　むら。　むらびとは　みんな　はしの　ほうへ　でかけている。')]);
      } else if (t === '$') {
        map[h.y][h.x] = '.';
        flags.chest = true;
        Sfx.play('coin');
        runEvent([say(`${N}は　たからばこを　あけた！`), say(`${N}は　やくそうを　てにいれた。`)]);
      } else if (h.x >= 18 && !flags.mobDone) {
        Sfx.play('hit');
        runEvent(events.mob());
      } else if (t === 'D') {
        Sfx.play('hit');
        runEvent(events.boss());
      }
    }

    function updateMap(dt) {
      if (moveT < 1) {
        moveT = Math.min(1, moveT + dt / STEP);
        if (moveT >= 1) {
          party.forEach(m => { m.fx = m.x; m.fy = m.y; });
          arrive();
        }
        return;
      }
      let dx = 0, dy = 0;
      if (Input.isDown('ArrowLeft')) dx = -1;
      else if (Input.isDown('ArrowRight')) dx = 1;
      else if (Input.isDown('ArrowUp')) dy = -1;
      else if (Input.isDown('ArrowDown')) dy = 1;
      if (!dx && !dy) return;
      if (dx) face = dx;
      const h = party[0], nx = h.x + dx, ny = h.y + dy;
      if (nx === npc.x && ny === npc.y) {
        if (!flags.e1Done) runEvent(events.villager());
        return;
      }
      if (!WALKABLE.has(tileAt(nx, ny))) return;
      for (let i = party.length - 1; i > 0; i--) { party[i].fx = party[i].x; party[i].fy = party[i].y; party[i].x = party[i - 1].x; party[i].y = party[i - 1].y; }
      h.fx = h.x; h.fy = h.y; h.x = nx; h.y = ny;
      moveT = 0;
      Sfx.play('move');
    }

    function update(dt) {
      time += dt;
      for (const p of confetti) { p.y += p.v * dt; p.r += dt * 3; if (p.y > H) p.y = -10; }
      if (flags.enemyGone) flags.enemyGone = Math.min(1, flags.enemyGone + dt * 2);
      if (flags.bossLeave) flags.bossLeave = Math.min(2, flags.bossLeave + dt);
      if (ending) {
        ending += dt;
        if (ending > 1.0) api.end(buildResult(ch));
        return;
      }
      if (!cur) { Input.takeClick(); updateMap(dt); return; }
      const total = [...fullText()].length;
      if (typing()) {
        const before = Math.floor(shown);
        shown = Math.min(total, shown + CPS * dt);
        typeTick += dt;
        if (Math.floor(shown) !== before && typeTick > 0.05) { Sfx.play('type'); typeTick = 0; }
      }
      const ok = Input.pressed('Space', 'Enter', 'KeyZ');
      const click = Input.takeClick();

      if (cur.t === 'say') {
        if (ok || click) {
          if (typing()) shown = total;
          else { Sfx.play('cursor'); advance(); }
        }
      } else if (cur.t === 'choice') {
        if (typing()) { if (ok || click) shown = total; return; }
        if (Input.pressed('ArrowUp')) { cursor = (cursor + cur.opts.length - 1) % cur.opts.length; Sfx.play('cursor'); }
        if (Input.pressed('ArrowDown')) { cursor = (cursor + 1) % cur.opts.length; Sfx.play('cursor'); }
        if (click) {
          const r = menuRect();
          const i = Math.floor((click.y - r.y - 13) / 44);
          if (click.x >= r.x && click.x <= r.x + r.w && i >= 0 && i < cur.opts.length) { cursor = i; pick(i); return; }
        }
        if (ok) pick(cursor);
      }
    }

    /* ----- 描画：フィールド ----- */
    function drawTile(c, t, x, y) {
      const px = x * TS, py = MAP_Y + y * TS;
      if (t === '~') {
        c.fillStyle = '#2a5ad8';
        c.fillRect(px, py, TS, TS);
        c.strokeStyle = '#8ab4ff';
        c.lineWidth = 2;
        const o = Math.floor(time * 2 + x + y) % 2 ? 6 : 0;
        c.beginPath();
        c.moveTo(px + 4 + o, py + 12); c.quadraticCurveTo(px + 10 + o, py + 7, px + 16 + o, py + 12);
        c.moveTo(px + 18 - o, py + 28); c.quadraticCurveTo(px + 24 - o, py + 23, px + 30 - o, py + 28);
        c.stroke();
        return;
      }
      c.fillStyle = '#58b048';
      c.fillRect(px, py, TS, TS);
      c.fillStyle = '#3e9030';
      c.fillRect(px + ((x * 7 + y * 3) % 5) * 6 + 4, py + 10, 3, 5);
      c.fillRect(px + ((x * 3 + y * 5) % 5) * 6 + 8, py + 26, 3, 5);
      if (t === 'T') {
        for (const [ox, oy] of [[12, 16], [28, 16], [20, 30]]) {
          c.fillStyle = '#6a3a14';
          c.fillRect(px + ox - 2, py + oy, 4, 7);
          c.fillStyle = '#1e6a1e';
          c.beginPath(); c.moveTo(px + ox, py + oy - 13); c.lineTo(px + ox + 9, py + oy + 2); c.lineTo(px + ox - 9, py + oy + 2); c.closePath(); c.fill();
          c.strokeStyle = '#0a3a0a'; c.lineWidth = 1.5; c.stroke();
        }
      } else if (t === 'M') {
        c.fillStyle = '#8a7a5a';
        c.beginPath(); c.moveTo(px - 2, py + TS); c.lineTo(px + 14, py + 8); c.lineTo(px + 30, py + TS); c.closePath(); c.fill();
        c.fillStyle = '#a8987a';
        c.beginPath(); c.moveTo(px + 12, py + TS); c.lineTo(px + 28, py + 4); c.lineTo(px + 44, py + TS); c.closePath(); c.fill();
        c.strokeStyle = '#3a2e1a'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = '#fff';
        c.beginPath(); c.moveTo(px + 28, py + 4); c.lineTo(px + 33, py + 12); c.lineTo(px + 23, py + 12); c.closePath(); c.fill();
      } else if (t === '=') {
        c.fillStyle = '#2a5ad8';
        c.fillRect(px, py, TS, TS);
        c.fillStyle = '#a8703a';
        c.fillRect(px, py + 4, TS, TS - 8);
        c.strokeStyle = '#5a3a1a';
        c.lineWidth = 2;
        for (let k = 0; k < TS; k += 10) { c.beginPath(); c.moveTo(px + k, py + 4); c.lineTo(px + k, py + TS - 4); c.stroke(); }
      } else if (t === 'C' || t === 'D') {
        const wall = t === 'C' ? '#d8d8d8' : '#4a3a5a', roof = t === 'C' ? '#3a5ee6' : '#a02020';
        c.fillStyle = wall;
        c.fillRect(px + 4, py + 14, 32, 24);
        c.fillRect(px + 2, py + 6, 10, 32);
        c.fillRect(px + 28, py + 6, 10, 32);
        c.strokeStyle = '#111'; c.lineWidth = 1.5;
        c.strokeRect(px + 4, py + 14, 32, 24); c.strokeRect(px + 2, py + 6, 10, 32); c.strokeRect(px + 28, py + 6, 10, 32);
        c.fillStyle = roof;
        for (const ox of [7, 33]) { c.beginPath(); c.moveTo(px + ox - 7, py + 7); c.lineTo(px + ox, py - 4); c.lineTo(px + ox + 7, py + 7); c.closePath(); c.fill(); c.stroke(); }
        c.fillStyle = '#111';
        c.fillRect(px + 15, py + 26, 10, 12);
      } else if (t === 'V') {
        for (const [ox, oy] of [[4, 14], [20, 22]]) {
          c.fillStyle = '#f0e0c0';
          c.fillRect(px + ox, py + oy, 16, 12);
          c.strokeStyle = '#111'; c.lineWidth = 1.5; c.strokeRect(px + ox, py + oy, 16, 12);
          c.fillStyle = '#c83a2a';
          c.beginPath(); c.moveTo(px + ox - 3, py + oy); c.lineTo(px + ox + 8, py + oy - 9); c.lineTo(px + ox + 19, py + oy); c.closePath(); c.fill(); c.stroke();
        }
      } else if (t === '$') {
        c.fillStyle = '#b8742a';
        c.fillRect(px + 10, py + 16, 20, 14);
        c.strokeStyle = '#111'; c.lineWidth = 1.5; c.strokeRect(px + 10, py + 16, 20, 14);
        c.fillStyle = '#f2d22e';
        c.fillRect(px + 18, py + 20, 4, 5);
        c.beginPath(); c.moveTo(px + 10, py + 22); c.lineTo(px + 30, py + 22); c.stroke();
      }
    }

    function drawField(c) {
      clearCanvas(c, '#000');
      for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) drawTile(c, map[y][x], x, y);
      const people = [];
      const k = moveT;
      party.forEach(m => {
        const x = (m.fx + (m.x - m.fx) * k) * TS + TS / 2, y = MAP_Y + (m.fy + (m.y - m.fy) * k) * TS + TS - 3;
        people.push({ y, draw: () => drawStick(c, x, y, 32, { hat: m.hat, sword: m.sword, pose: moveT < 1 ? 'walk' : 'stand', phase: (m.x + m.y) * Math.PI + k * Math.PI, facing: face, lw: 2.6 }) });
      });
      const nx = npc.x * TS + TS / 2, ny = MAP_Y + npc.y * TS + TS - 3;
      people.push({ y: ny, draw: () => drawStick(c, nx, ny, 32, { hat: 'straw', facing: -1, lw: 2.6, pose: !flags.e1Done && Math.sin(time * 6) > 0 ? 'cheer' : 'stand' }) });
      people.sort((a, b) => a.y - b.y).forEach(p => p.draw());
      if (!flags.e1Done) {
        const bx = nx, by = MAP_Y + npc.y * TS - 14 + Math.sin(time * 4) * 2;
        c.fillStyle = '#fff';
        c.strokeStyle = '#111';
        c.lineWidth = 2;
        c.beginPath(); c.arc(bx, by, 10, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#111';
        c.font = `bold 14px ${FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('!', bx, by + 1);
      }
    }

    /* ----- 描画：戦闘 ----- */
    function drawBattle(c) {
      clearCanvas(c, '#000');
      const cx = W / 2, by = 330;
      if (battle === 'mob') {
        const g = 1 - flags.enemyGone;
        if (g > 0) {
          c.save();
          c.globalAlpha = g;
          c.translate(cx + flags.enemyGone * 300, 0);
          const sq = 1 + Math.sin(time * 5) * 0.04;
          c.fillStyle = '#3a8ae8';
          c.strokeStyle = '#fff';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(0, by - 110 * sq);
          c.quadraticCurveTo(14, by - 70, 60, by - 30);
          c.quadraticCurveTo(70, by, 0, by);
          c.quadraticCurveTo(-70, by, -60, by - 30);
          c.quadraticCurveTo(-14, by - 70, 0, by - 110 * sq);
          c.fill(); c.stroke();
          c.fillStyle = '#fff';
          c.beginPath(); c.ellipse(-20, by - 48, 9, 12, 0, 0, Math.PI * 2); c.ellipse(20, by - 48, 9, 12, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#111';
          c.beginPath(); c.arc(-18, by - 46, 5, 0, Math.PI * 2); c.arc(22, by - 46, 5, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#111';
          c.beginPath(); c.arc(0, by - 26, 18, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
          c.restore();
        }
      } else {
        const leave = Math.max(0, flags.bossLeave - 1);
        c.save();
        c.globalAlpha = 1 - leave;
        c.translate(leave * 200, 0);
        c.fillStyle = '#5a2a7a';
        c.beginPath(); c.moveTo(cx - 16, by - 125); c.lineTo(cx - 75, by); c.lineTo(cx + 75, by); c.lineTo(cx + 16, by - 125); c.closePath(); c.fill();
        drawStick(c, cx, by, 165, { hat: 'horns', color: '#e8e8e8', lw: 8, facing: leave > 0 ? 1 : -1, pose: leave > 0 ? 'walk' : 'stand', phase: time * 8 });
        c.restore();
        if (flags.bossLeave > 0 && flags.bossLeave < 1.4) {
          c.fillStyle = '#fff';
          c.font = `bold 22px ${FONT}`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('（ていじ）', cx + 170, 200);
        }
      }
      // 仲間のステータス
      [N, 'せんし', 'まほう'].forEach((nm, i) => {
        const r = { x: 150 + i * 230, y: 16, w: 200, h: 96 };
        windowBox(c, r);
        c.fillStyle = i === 1 && flags.warriorDown ? '#f2d22e' : '#fff';
        c.font = `bold 18px ${FONT}`;
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillText(nm, r.x + 20, r.y + 14);
        c.font = `16px ${FONT}`;
        c.fillText(`H　${[24, 31, 15][i]}`, r.x + 20, r.y + 42);
        c.fillText(`M　${[0, 0, 12][i]}`, r.x + 20, r.y + 64);
      });
    }

    /* ----- 描画：討伐後 ----- */
    function drawAfter(c) {
      clearCanvas(c, '#d8d8e0');
      c.strokeStyle = '#b8b8c6';
      c.lineWidth = 2;
      for (let y = 20; y < 300; y += 30) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
        for (let x = (y / 30 % 2) * 30; x < W; x += 60) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 30); c.stroke(); }
      }
      c.fillStyle = '#8a7a6a';
      c.fillRect(0, 300, W, 72);
      c.fillStyle = '#b02a2a';
      c.fillRect(500, 300, 300, 72);
      const hop = k => Math.abs(Math.sin(time * 5 + k)) * 10;
      drawStick(c, 650, 336 - hop(0), 80, { pose: 'cheer' });
      drawStick(c, 570, 336 - hop(1), 74, { hat: 'helmet', pose: Math.sin(time * 5) > 0 ? 'cheer' : 'stand' });
      drawStick(c, 740, 336, 70, { hat: 'wizard', facing: -1 });
      for (const p of confetti) {
        c.save(); c.translate(p.x, p.y); c.rotate(p.r);
        c.fillStyle = p.col;
        c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        c.restore();
      }
    }

    function windowBox(c, r) {
      c.fillStyle = '#000';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = '#fff';
      c.lineWidth = 3;
      c.strokeRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
    }

    function draw(c) {
      if (view === 'map') drawField(c);
      else if (view === 'battle') drawBattle(c);
      else drawAfter(c);

      if (view === 'map' && !cur && moveT >= 1) {
        const sr = { x: 16, y: 16, w: 170, h: 100 };
        windowBox(c, sr);
        c.fillStyle = '#fff';
        c.font = `bold 17px ${FONT}`;
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillText(N, sr.x + 20, sr.y + 16);
        c.font = `15px ${FONT}`;
        c.fillText('H　24　M　0', sr.x + 20, sr.y + 44);
        c.fillText('Lv　1', sr.x + 20, sr.y + 68);
      }

      if (cur && cur.t !== 'end') {
        windowBox(c, MSG);
        const all = [...fullText()];
        const vis = all.slice(0, Math.floor(shown)).join('');
        c.font = `21px ${FONT}`;
        c.fillStyle = '#fff';
        c.textAlign = 'left';
        c.textBaseline = 'top';
        const lines = wrapText(c, vis, MSG.w - 70);
        lines.slice(0, 4).forEach((s, i) => c.fillText(s, MSG.x + 32, MSG.y + 26 + i * 30));
        if (!typing() && cur.t === 'say' && Math.floor(time * 3) % 2) {
          c.beginPath();
          c.moveTo(MSG.x + MSG.w / 2 - 8, MSG.y + MSG.h - 30);
          c.lineTo(MSG.x + MSG.w / 2 + 8, MSG.y + MSG.h - 30);
          c.lineTo(MSG.x + MSG.w / 2, MSG.y + MSG.h - 20);
          c.fill();
        }
        if (cur.t === 'choice' && !typing()) {
          const r = menuRect();
          windowBox(c, r);
          c.font = `20px ${FONT}`;
          c.textBaseline = 'middle';
          cur.opts.forEach((o, i) => {
            const y = r.y + 13 + i * 44 + 22;
            c.fillStyle = '#fff';
            c.fillText(o.label, r.x + 54, y);
            if (i === cursor && Math.floor(time * 4) % 4 !== 0) {
              c.beginPath();
              c.moveTo(r.x + 26, y - 9); c.lineTo(r.x + 40, y); c.lineTo(r.x + 26, y + 9);
              c.fill();
            }
          });
        }
      }
      if (ending) {
        c.fillStyle = `rgba(255,255,255,${Math.min(1, ending)})`;
        c.fillRect(0, 0, W, H);
      }
    }

    return { update, draw, _dbg: { party, flags, npc, get view() { return view; }, get cur() { return cur; } } };
  }

  return {
    create,
    debugResult() { return buildResult({ e1: 'reward', e2: 'blame', e3: 'praise' }); }
  };
})();
