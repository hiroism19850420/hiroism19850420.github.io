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

  // ---------- 敵兵 ----------
  const PAL_ENEMY = {
    k: '#0a0d11',
    h: '#5d6650', // ヘルメット
    b: '#3c4334', // ヘルメットの縁
    m: '#22272b', // 覆面
    s: '#e2b48c',
    S: '#22272b',
    e: '#161a1f',
    u: '#8a8d69', // 戦闘服
    U: '#62664c',
    g: '#2b3226', // ベスト
    G: '#3f4838',
    r: '#444a52', // 小銃
    w: '#14181c'
  };

  const UPPER_ENEMY = {
    down: [
      '....kkkkkk....',
      '...khhhhhhk...',
      '..khhhhhhhhk..',
      '..khhhhhhhhk..',
      '..kbbbbbbbbk..',
      '..kmsessesmk..',
      '..kmmmmmmmmk..',
      '...kmmmmmmk...',
      '..kkummmmukk..',
      '.kuuugUUguuuk.',
      '.kuUugUUguUuk.',
      '.ksrrrrrrrrsk.',
      '.kkkuUUUUukkk.',
      '...kggggggk...'
    ],
    up: [
      '....kkkkkk....',
      '...khhhhhhk...',
      '..khhhhhhhhk..',
      '..khhhhhhhhk..',
      '..kbbbbbbbbk..',
      '..kmmmmmmmmk..',
      '..kmmmmmmmmk..',
      '...kmmmmmmk...',
      '..kkuummuukk..',
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
      '..khhhhhhhhk..',
      '..kbbbbbbbbbk.',
      '..khhmmsesmk..',
      '..khhmmmmmmk..',
      '...khmmmmmk...',
      '...kkummkk....',
      '...kuuuugk....',
      '...kuUuugkkkk.',
      '...kuUssrrrrk.',
      '...kkuUukkkk..',
      '....kgggk.....'
    ]
  };

  // 頭上の「！」
  const MARK_ALERT = [
    '.kkkk.',
    '.krwk.',
    '.krrk.',
    '.krrk.',
    '.krrk.',
    '.krrk.',
    '.krrk.',
    '.kkkk.',
    '.krwk.',
    '.krrk.',
    '.kkkk.'
  ];

  // 頭上の「？」
  const MARK_QUESTION = [
    '.kkkkk.',
    'kyyyyyk',
    'kykkkyk',
    'kkk.kyk',
    '..kkyyk',
    '..kyykk',
    '..kykk.',
    '..kkk..',
    '..kyk..',
    '..kyk..',
    '..kkk..'
  ];

  // ---------- 伏せた姿（匍匐、気絶） ----------
  // 各向き2コマ。右向きは頭が右、下向きは頭が下。
  const PRONE_SIDE = [
    [
      '............kkkkk.',
      '.kkkkkkkkkkkhhbssk',
      'kwwkuuuuggukhhbsek',
      'kwwkUUuuggukhhbssk',
      '.kkkkuUukkkkhhbssk',
      '.....ksskk..kkkkk.',
      '.....kkkk.........'
    ],
    [
      '............kkkkk.',
      '.kkkkkkkkkkkhhbssk',
      'kwwkuuuuggukhhbsek',
      'kwwkUUuuggukhhbssk',
      '.kkkkkkuUukkhhbssk',
      '.......ksskkkkkkk.',
      '.......kkkk.......'
    ]
  ];
  const PRONE_DOWN = [
    [
      '..kkkkkk..',
      '.kwwkkwwk.',
      '.kwwkkwwk.',
      '.kuukkuuk.',
      '.kuUkkUuk.',
      '.kuuuuuuk.',
      'kkuggggukk',
      'ksuggggusk',
      'kkuuUUuukk',
      '.kkuSSukk.',
      '.khhhhhhk.',
      '.kbbbbbbk.',
      '.ksessesk.',
      '.kssssssk.',
      '..kkkkkk..'
    ],
    [
      '..kkkkkk..',
      '.kwwkkwwk.',
      '.kwwkkwwk.',
      '.kuukkuuk.',
      '.kuUkkUuk.',
      '.kuuuuuuk.',
      'ksuggggukk',
      'kkuggggusk',
      'kkuuUUuukk',
      '.kkuSSukk.',
      '.khhhhhhk.',
      '.kbbbbbbk.',
      '.ksessesk.',
      '.kssssssk.',
      '..kkkkkk..'
    ]
  ];
  const PRONE_UP = [
    [
      '..kkkkkk..',
      '.khhhhhhk.',
      '.khhhhhhk.',
      '.kbbbbbbk.',
      '.kkhbbhkk.',
      'kkuubbuukk',
      'ksuggggusk',
      'kkuGGGGukk',
      '.kugggguk.',
      '.kuuuuuuk.',
      '.kuUkkUuk.',
      '.kuukkuuk.',
      '.kwwkkwwk.',
      '.kwwkkwwk.',
      '..kkkkkk..'
    ],
    [
      '..kkkkkk..',
      '.khhhhhhk.',
      '.khhhhhhk.',
      '.kbbbbbbk.',
      '.kkhbbhkk.',
      'ksuubbuukk',
      'kkuggggusk',
      'kkuGGGGukk',
      '.kugggguk.',
      '.kuuuuuuk.',
      '.kuUkkUuk.',
      '.kuukkuuk.',
      '.kwwkkwwk.',
      '.kwwkkwwk.',
      '..kkkkkk..'
    ]
  ];

  function buildProne(pal) {
    const right = PRONE_SIDE.map((r) => fromRows(r, pal));
    return {
      right,
      left: right.map(flip),
      down: PRONE_DOWN.map((r) => fromRows(r, pal)),
      up: PRONE_UP.map((r) => fromRows(r, pal))
    };
  }

  function buildCharacter(pal, upper) {
    const up = {};
    for (const k in upper) up[k] = fromRows(upper[k], pal);
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
    player: buildCharacter(PAL_PLAYER, UPPER),
    enemy: buildCharacter(PAL_ENEMY, UPPER_ENEMY),
    playerProne: buildProne(PAL_PLAYER),
    enemyProne: buildProne(PAL_ENEMY),
    markAlert: fromRows(MARK_ALERT, { k: '#1a0505', r: '#ff3b30', w: '#ffd0c8' }),
    markQuestion: fromRows(MARK_QUESTION, { k: '#1a1505', y: '#ffd23c' })
  };
})();
