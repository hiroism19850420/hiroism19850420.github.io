// 無線画面。左右に顔、下にテキストウィンドウ。文字は1つずつ出る。
(function () {
  const FONT = '"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';
  const TYPE_SPEED = 32; // 1秒に出す文字数

  // ---------- 顔のドット絵（16×16） ----------
  // m は口。閉じたコマでは肌の影の色、開いたコマでは暗い色で塗る
  const FACE_HERON = [
    '................',
    '....kkkkkkkk....',
    '...khhhhhhhhk...',
    '..khhhhhhhhhhk..',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..khsssssssshk..',
    '..ksswesswessk..',
    '..kssssssssssk..',
    '..kssssSSssssk..',
    '..kSssssssssSk..',
    '...kssmmmmssk...',
    '...kSssssssSk...',
    '....kkSSSSkk....',
    '..kkuuugguuukk..',
    '.kuuuugggguuuuk.'
  ];
  const FACE_OPERATOR = [
    '................',
    '....kkkkkkkk....',
    '...khhhhhhhhk...',
    '..khhhhhhhhhhk..',
    '.gkhhhhhhhhhhkg.',
    '.gkhhssssssshkg.',
    '.gkhsswesswehkg.',
    '..khsssssssshk..',
    '..khssssSssshk..',
    '..khssssssssghk.',
    '..khhsmmmmsgghk.',
    '...khssssssshk..',
    '...khhkSSSkhhk..',
    '..kkuuuccuuukk..',
    '.kuuuuuccuuuuuk.',
    '.kuuuuuuuuuuuuk.'
  ];
  const PAL_HERON = {
    k: '#0a0d11', h: '#3b2c20', b: '#c9482b', s: '#e2b48c', S: '#b8845f',
    w: '#f4f4ec', e: '#161a1f', u: '#48687c', g: '#1d2830'
  };
  const PAL_OPERATOR = {
    k: '#0a0d11', h: '#b9c6d6', s: '#f0c9a8', S: '#c99a7c',
    w: '#f4f4ec', e: '#27405a', u: '#2c5a52', c: '#7de0b0', g: '#20262c'
  };

  function faces(rows, pal) {
    const mk = NH.Sprites.fromRows;
    return [
      mk(rows, Object.assign({}, pal, { m: pal.S })),      // 口を閉じたコマ
      mk(rows, Object.assign({}, pal, { m: '#5a2018' }))   // 口を開けたコマ
    ];
  }

  const WHO = {
    H: { name: 'ヘロン', color: '#ffb27a', side: 'left', img: faces(FACE_HERON, PAL_HERON) },
    S: { name: 'シラサギ', color: '#7de0b0', side: 'right', img: faces(FACE_OPERATOR, PAL_OPERATOR) }
  };

  // ---------- 台本 ----------
  // H = ヘロン（プレイヤー）、S = シラサギ（オペレーター）
  const SCRIPTS = {
    intro: [
      ['S', 'ヘロン、聞こえる？　クロガネ重工の地下物流区画に入ったわね。'],
      ['H', '搬入ドックだ。思ったより警備が厚い。'],
      ['S', '目標は奥のサーバールーム。そこのエレベーターで上の階へ抜けて。カードキーが2枚いるはずよ。'],
      ['S', '床に映る扇形が敵の視界。入り続けると気づかれる。右上のレーダーには、敵の位置と向きが出るわ。'],
      ['H', '了解。潜入を開始する。']
    ],
    puddle: [
      ['S', 'そこ、水たまりよ。走ると足音が出て、近くの兵が見に来る。'],
      ['S', 'ほふくなら音は出ない。見つかりにくくもなるわ。']
    ],
    duct: [
      ['S', '壁に黄色い印の穴があるでしょう。通気口よ。ほふくで通り抜けられる。'],
      ['S', '敵は入れないし、中は見えない。ただし警戒が出ると、シャッターが下りて外から入れなくなる。']
    ],
    warehouse: [
      ['S', '天井近くに監視カメラがある。青い扇に映り続けると警報が鳴るわ。'],
      ['H', '壊せるか？'],
      ['S', '麻酔銃を当てれば、しばらく止まる。倉庫のどこかに銃があるはずよ。']
    ],
    corridor: [
      ['S', '中央通路ね。金属の床は足音が響くから気をつけて。'],
      ['S', 'それと、巡回兵はときどき立ち止まって後ろを振り返る。背後を取るなら、振り返った直後が安全よ。']
    ],
    office: [
      ['S', '事務室に入ったわね。頭の上にオレンジのカードが見える兵がいない？'],
      ['S', 'そいつがカードキー Lv2 を持ってる。背後から気絶させるか、麻酔銃で眠らせれば落とすわ。']
    ],
    server: [
      ['S', 'サーバールームよ。エレベーターは右上。'],
      ['S', '警戒が出ている間は動かない。見つかったら、まず撒いてから乗って。']
    ],
    escaped: [
      ['S', '……撒いたみたいね。心臓に悪いわ。'],
      ['S', '見つかったら、まず物陰に入って視界を切ること。敵の弾は赤い線の方向に飛ぶ。止まらなければ当たらない。']
    ]
  };

  // 自分から無線をかけたときの返事。いまの状況に合うものを返す
  function adviceLines() {
    const p = NH.Player, A = NH.Alert;
    if (A.phase === 'alert') return [['S', '話してる場合じゃない！　物陰に入って視界を切って！']];
    if (A.phase === 'search') return [['S', 'まだ探してる。動かずにやり過ごすか、視界の外を回り込んで。']];
    if (!p.hasBox) return [['S', '搬入ドックの右下の隅に、段ボール箱があるはず。かぶって止まっていれば、目の前を通られても気づかれないわ。']];
    if (!p.hasGun) return [['S', '第1倉庫の左下の隅に麻酔銃がある。弾は少ないから、ここぞというときに。']];
    if (p.keyLevel < 1) return [['S', 'カードキー Lv1 は第1倉庫の右側、コンテナに挟まれた通路にある。青い扉が開くようになるわ。']];
    if (p.keyLevel < 2) return [['S', 'Lv2 は事務室を巡回している兵が持ってる。頭の上のオレンジのカードが目印。倒せば落とすわ。']];
    return [['S', 'カードはそろったわね。サーバールームの右上、エレベーターへ。警戒が出ていると動かないから、静かに。']];
  }

  NH.Radio = {
    active: false,
    lines: null,
    idx: 0,
    chars: 0,      // いま出ている文字数
    t: 0,
    seen: {},      // 一度流した台本（ページを開き直すまで覚えておく）
    wrapKey: '',
    wrapped: null,

    // 台本を流す。同じものは1回だけ。流したら true
    play(id) {
      if (this.seen[id] || !SCRIPTS[id]) return false;
      this.seen[id] = true;
      this.start(SCRIPTS[id]);
      return true;
    },

    // 自分からかける
    call() { this.start(adviceLines()); },

    start(lines) {
      this.active = true;
      this.lines = lines;
      this.idx = 0;
      this.chars = 0;
      this.t = 0;
      this.wrapKey = '';
      NH.Audio.play('radioOpen');
    },

    // advance：決定キーやタップが押された
    update(dt, advance) {
      if (!this.active) return;
      this.t += dt;
      const text = this.lines[this.idx][1];
      const before = Math.floor(this.chars);
      if (this.chars < text.length) {
        this.chars = Math.min(text.length, this.chars + dt * TYPE_SPEED);
        const now = Math.floor(this.chars);
        if (now > before && now % 2 === 0) NH.Audio.play('radioBlip');
        if (advance) this.chars = text.length; // 途中で押されたら全文を出す
      } else if (advance) {
        this.idx++;
        this.chars = 0;
        this.wrapKey = '';
        if (this.idx >= this.lines.length) {
          this.active = false;
          NH.Audio.play('radioClose');
        }
      }
    },

    // 1文字ずつ幅を測って、枠に収まるよう折り返す
    wrap(ctx, text, maxW) {
      const key = this.idx + ':' + maxW;
      if (key === this.wrapKey) return this.wrapped;
      const out = [];
      let line = '';
      for (const ch of text) {
        if (ctx.measureText(line + ch).width > maxW && line) {
          // 句読点が行頭に来ないよう、前の行にぶら下げる
          if ('、。！？」'.includes(ch)) { line += ch; continue; }
          out.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
      if (line) out.push(line);
      this.wrapKey = key;
      this.wrapped = out;
      return out;
    },

    draw(ctx, view) {
      if (!this.active) return;
      const [who, text] = this.lines[this.idx];
      const typing = this.chars < text.length;
      const w = view.w, h = view.h;

      // 背景と走査線
      ctx.save();
      ctx.fillStyle = 'rgba(0,10,8,0.93)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

      const boxH = Math.min(78, Math.round(h * 0.3));
      const boxY = h - boxH - 10;
      const top = boxY - 8;

      // 顔
      const ps = Math.max(2, Math.min(6, Math.floor((top - 34) / 16)));
      const size = 16 * ps;
      const gap = Math.min(70, Math.max(34, w * 0.1));
      const py = Math.round((top + 14 - size) / 2) + 6;
      ctx.imageSmoothingEnabled = false;
      for (const id in WHO) {
        const c = WHO[id];
        const speaking = id === who;
        const x = Math.round(c.side === 'left' ? w / 2 - gap - size : w / 2 + gap);
        ctx.fillStyle = '#04120e';
        ctx.fillRect(x - 4, py - 4, size + 8, size + 8);
        ctx.strokeStyle = speaking ? c.color : '#2c4a40';
        ctx.lineWidth = speaking ? 2 : 1;
        ctx.strokeRect(x - 4, py - 4, size + 8, size + 8);
        const mouth = speaking && typing && Math.floor(this.t * 9) % 2 ? 1 : 0;
        ctx.globalAlpha = speaking ? 1 : 0.4;
        ctx.drawImage(c.img[mouth], x, py, size, size);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let y = py; y < py + size; y += 2) ctx.fillRect(x, y, size, 1);
        ctx.font = 'bold 9px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = speaking ? c.color : '#4d6e62';
        ctx.fillText(c.name, x + size / 2, py + size + 7);
      }

      // 中央：周波数と音量の棒
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#4d8f78';
      ctx.fillText('CH', w / 2, py + 6);
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#9fffd6';
      ctx.fillText('147.30', w / 2, py + 20);
      const bars = 7, bw = 4;
      for (let i = 0; i < bars; i++) {
        const lv = typing ? 0.25 + 0.75 * Math.abs(Math.sin(this.t * 11 + i * 1.7)) : 0.12;
        const bh = Math.round(lv * Math.min(34, size * 0.45));
        ctx.fillStyle = i < 5 ? '#4de0a6' : '#ffd23c';
        ctx.fillRect(Math.round(w / 2 - bars * (bw + 2) / 2 + i * (bw + 2)), py + size - 4 - bh, bw, bh);
      }

      // テキストウィンドウ
      const bx = Math.round(Math.max(10, w * 0.06)), bwid = w - bx * 2;
      ctx.fillStyle = 'rgba(2,22,17,0.95)';
      ctx.fillRect(bx, boxY, bwid, boxH);
      ctx.strokeStyle = '#3d7a6a';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, boxY + 0.5, bwid - 1, boxH - 1);
      ctx.fillStyle = WHO[who].color;
      ctx.fillRect(bx, boxY, 3, boxH);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 9px ' + FONT;
      ctx.fillText(WHO[who].name, bx + 10, boxY + 6);

      ctx.font = 'bold 12px ' + FONT;
      ctx.fillStyle = '#e6fff6';
      const lines = this.wrap(ctx, text, bwid - 24);
      let left = Math.floor(this.chars);
      const lh = Math.min(17, (boxH - 24) / Math.max(3, lines.length));
      for (let i = 0; i < lines.length && left > 0; i++) {
        const chars = Array.from(lines[i]);
        ctx.fillText(chars.slice(0, left).join(''), bx + 12, boxY + 20 + i * lh);
        left -= chars.length;
      }

      // 送りの合図
      if (!typing && Math.floor(this.t * 3) % 2 === 0) {
        ctx.fillStyle = '#9fffd6';
        const tx = bx + bwid - 14, ty = boxY + boxH - 11;
        ctx.fillRect(tx, ty, 7, 2);
        ctx.fillRect(tx + 1, ty + 2, 5, 2);
        ctx.fillRect(tx + 3, ty + 4, 1, 2);
        ctx.fillRect(tx + 2, ty + 4, 3, 1);
      }

      ctx.font = 'bold 8px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4d8f78';
      ctx.fillText('無線通信', w / 2, 6);
      ctx.restore();
    }
  };
})();
