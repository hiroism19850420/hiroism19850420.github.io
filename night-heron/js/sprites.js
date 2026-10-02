// コード内のドット絵データから、描画用のキャンバスを作る。
(function () {
  // 1文字 = 1ドット。'.' は透明。
  const PAL_PLAYER = {
    k: '#0a0d11', // 輪郭
    h: '#3b2c20', // 髪
    b: '#c9482b', // 鉢巻き
    s: '#e2b48c', // 肌
    S: '#b8845f', // 肌の影
    e: '#161a1f', // 目
    u: '#48687c', // スーツ
    U: '#2f4757', // スーツの影
    g: '#1d2830', // 装備
    G: '#33434e', // 装備の明るい面
    w: '#14181c'  // ブーツ
  };

  const UPPER = {
    down: [
      '....kkkkkk....',
      '...khhhhhhk...',
      '..khhhhhhhhk..',
      '..kbbbbbbbbk..',
      '..khsssssshk..',
      '..kssessessk..',
      '..kssssssssk..',
      '...kSssssSk...',
      '..kkuSSSSukk..',
      '.kuuugUUguuuk.',
      '.kuUugUUguUuk.',
      '.ksUugggguUsk.',
      '.kkkuUUUUukkk.',
      '...kggggggk...'
    ],
    up: [
      '....kkkkkk....',
      '...khhhhhhk...',
      '..khhhhhhhhk..',
      '..kbbbbbbbbk..',
      '..khhhhhhhhk..',
      '..khhhhhhhhk..',
      '..khhhhhhhhk..',
      '...khhbbhhk...',
      '..kkuubbuukk..',
      '.kuugggggguuk.',
      '.kuUgGGGGgUuk.',
      '.ksUgGGGGgUsk.',
      '.kkkuggggukkk.',
      '...kggggggk...'
    ],
    side: [
      '....kkkkkk....',
      '...khhhhhhk...',
      '..khhhhhhhhk..',
      '.kbbbbbbbbbk..',
      'kbkhhhhssssk..',
      '..khhhsssesk..',
      '..khhsssssSk..',
      '...khsssssk...',
      '...kkuSSkk....',
      '...kuuuugk....',
      '...kuUuugk....',
      '...kuUssgk....',
      '...kkuUukk....',
      '....kgggk.....'
    ]
  };

  // 脚：0 = 直立、1 = 踏み出し、2 = もう片方（正面と背面は 1 の左右反転）
  const LEGS_FRONT = [
    [
      '...kuukkuuk...',
      '...kuUkkUuk...',
      '...kuUkkUuk...',
      '...kwwkkwwk...',
      '..kwwwkkwwwk..',
      '..kkkk..kkkk..'
    ],
    [
      '...kuukkuuk...',
      '...kuUkkUuk...',
      '...kuUkkwwk...',
      '...kwwkkwwk...',
      '..kwwwkkkkk...',
      '..kkkk........'
    ]
  ];
  const LEGS_SIDE = [
    [
      '....kuuk......',
      '....kuUk......',
      '....kuUk......',
      '....kwwk......',
      '....kwwwk.....',
      '....kkkkk.....'
    ],
    [
      '...kuukuuk....',
      '..kuUk.kuUk...',
      '..kuk...kuk...',
      '.kwwk...kwwk..',
      '.kwwwk..kwwwk.',
      '.kkkkk..kkkkk.'
    ],
    [
      '....kuuk......',
      '....kuUk......',
      '...kuUUk......',
      '...kwwwk......',
      '...kwwwk......',
      '...kkkkk......'
    ]
  ];

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function fromRows(rows, pal) {
    const c = makeCanvas(rows[0].length, rows.length);
    const g = c.getContext('2d');
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const col = pal[rows[y][x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  function flip(src) {
    const c = makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  // 上半身と脚を重ねて1コマにする。歩行コマは上半身を1ドット沈める。
  function compose(upper, legs, sink) {
    const c = makeCanvas(upper.width, 20);
    const g = c.getContext('2d');
    g.drawImage(legs, 0, 14);
    g.drawImage(upper, 0, sink ? 1 : 0);
    return c;
  }

  function buildCharacter(pal) {
    const up = {};
    for (const k in UPPER) up[k] = fromRows(UPPER[k], pal);
    const lf = LEGS_FRONT.map((r) => fromRows(r, pal));
    lf.push(flip(lf[1]));
    const ls = LEGS_SIDE.map((r) => fromRows(r, pal));

    const set = { down: [], up: [], right: [], left: [] };
    for (let i = 0; i < 3; i++) {
      set.down.push(compose(up.down, lf[i], i > 0));
      set.up.push(compose(up.up, lf[i], i > 0));
      const side = compose(up.side, ls[i], i > 0);
      set.right.push(side);
      set.left.push(flip(side));
    }
    return set;
  }

  NH.Sprites = {
    SCALE: 2, // ドット絵1ドットをワールドの何pxで描くか
    makeCanvas,
    fromRows,
    flip,
    buildCharacter,
    player: buildCharacter(PAL_PLAYER)
  };
})();
