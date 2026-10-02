// マップのデータ、当たり判定、タイルの描画。
(function () {
  const C = NH.CONFIG;
  const T = C.TILE;

  // 1文字 = 1タイル。全行を同じ長さにそろえること。
  //   # 壁        . コンクリ床   , 事務室の床
  //   C R コンテナ  B 木箱       D 机   T 端末つきの机
  //   K ロッカー   V サーバーラック  S プレイヤーの開始位置
  const FLOOR_1 = [
    '################################################',
    '#KK,,,,,,,,,,,,,,,KK#...#......................#',
    '#,,,,,,,,,,,,,,,,,,,#...#..VV..VV..VV..........#',
    '#,,TDD,,,TDD,,,TDD,,#......VV..VV..VV..........#',
    '#,,,,,,,,,,,,,,,,,,,#..........................#',
    '#,,,,,,,,,,,,,,,,,,,,...#......................#',
    '#,,DDT,,,DDT,,,DDT,,,...#..VV..VV..VV....RR....#',
    '#,,,,,,,,,,,,,,,,,,,#...#..VV..VV..VV....RR....#',
    '#,,,,,,,,,,,,,,,,,,,#...#......................#',
    '#,,TDD,,,TDD,,,,,,,,#...#......................#',
    '#,,,,,,,,,,,,,,,,,,,#...#.............BB.......#',
    '#BB,,,,,,,,,,,,,,,KK#...#......................#',
    '########..###########...################..######',
    '########..###########...################..######',
    '#............BB................................#',
    '#..............................................#',
    '#.................................CC...........#',
    '#####..#######################..################',
    '#####..#######################..################',
    '#.............#................................#',
    '#.........BB..#..CCCC....RRRR........CCCC......#',
    '#.........BB..#..CCCC....RRRR........CCCC......#',
    '#.............#................................#',
    '#..CCC........#................BB..............#',
    '#..CCC........#..RRRR..........BB....RRRR..BB..#',
    '#.............#..RRRR................RRRR......#',
    '#..............................................#',
    '#.........................CCCC.................#',
    '#..S......RRR.#..CC......CCCC......CCCCCC......#',
    '#.........RRR.#..CC................CCCCCC......#',
    '#BB...........#................................#',
    '################################################'
  ];

  // 区画名（タイル座標の矩形。両端を含む）
  const ZONES_1 = [
    { name: '搬入ドック', x0: 1, y0: 19, x1: 13, y1: 30 },
    { name: '第1倉庫', x0: 15, y0: 19, x1: 46, y1: 30 },
    { name: '中央通路', x0: 1, y0: 14, x1: 46, y1: 16 },
    { name: '事務室', x0: 1, y0: 1, x1: 19, y1: 11 },
    { name: '連絡通路', x0: 21, y0: 1, x1: 23, y1: 11 },
    { name: 'サーバールーム', x0: 25, y0: 1, x1: 46, y1: 11 }
  ];

  // 天井灯（タイル座標）。マップに焼き込む
  const LIGHTS_1 = [
    { x: 7, y: 24.5, r: 190 },
    { x: 23, y: 22.5, r: 200 }, { x: 39, y: 22.5, r: 200 },
    { x: 23, y: 28, r: 180 }, { x: 39, y: 28, r: 180 },
    { x: 8, y: 15.5, r: 150 }, { x: 24, y: 15.5, r: 150 }, { x: 40, y: 15.5, r: 150 },
    { x: 6, y: 5, r: 170 }, { x: 15, y: 5, r: 170 }, { x: 10, y: 10, r: 150 },
    { x: 22.5, y: 6, r: 130 },
    { x: 31, y: 5, r: 190, cold: true }, { x: 42, y: 6, r: 190, cold: true }
  ];

  // solid：通れない　opaque：視線を遮る（フェーズ2以降で使う）
  const TILES = {
    '#': { name: 'wall', solid: true, opaque: true },
    '.': { name: 'floor', solid: false, opaque: false },
    ',': { name: 'office', solid: false, opaque: false },
    'C': { name: 'container', solid: true, opaque: true },
    'R': { name: 'container', solid: true, opaque: true },
    'B': { name: 'crate', solid: true, opaque: true },
    'D': { name: 'desk', solid: true, opaque: false },
    'T': { name: 'desk', solid: true, opaque: false },
    'K': { name: 'locker', solid: true, opaque: true },
    'V': { name: 'rack', solid: true, opaque: true }
  };

  // タイル座標から決まる乱数（毎回同じ見た目になる）
  function rnd(x, y, i) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(i + 1, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const M = NH.Map = {
    w: 0, h: 0, pxW: 0, pxH: 0,
    rows: null, zones: null, canvas: null,
    start: { x: 0, y: 0 },
    leds: [],
    floorName: 'B1F',

    load() {
      const src = FLOOR_1;
      this.h = src.length;
      this.w = src[0].length;
      this.rows = src.map((row, y) => {
        if (row.length !== this.w) console.error('マップの ' + y + ' 行目の長さが ' + row.length + '（正しくは ' + this.w + '）');
        const sx = row.indexOf('S');
        if (sx >= 0) {
          this.start = { x: sx * T + T / 2, y: y * T + T / 2 };
          row = row.replace('S', '.');
        }
        return row;
      });
      this.pxW = this.w * T;
      this.pxH = this.h * T;
      this.zones = ZONES_1;
      this.prerender();
    },

    // マップ外は壁として扱う
    get(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#';
      return this.rows[ty][tx];
    },
    isSolid(tx, ty) { return TILES[this.get(tx, ty)].solid; },
    isOpaque(tx, ty) { return TILES[this.get(tx, ty)].opaque; },

    // 矩形（ワールド座標）が通れないタイルに重なるか
    rectSolid(x, y, w, h) {
      const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
      const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.001) / T);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (this.isSolid(tx, ty)) return true;
        }
      }
      return false;
    },

    zoneAt(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      for (const z of this.zones) {
        if (tx >= z.x0 && tx <= z.x1 && ty >= z.y0 && ty <= z.y1) return z;
      }
      return null;
    },

    // 障害物の下に敷く床の種類を、周りの床から決める
    floorUnder(tx, ty) {
      const around = [[0, 1], [0, -1], [-1, 0], [1, 0], [0, 2], [-2, 0], [2, 0], [0, -2]];
      for (const [dx, dy] of around) {
        const ch = this.get(tx + dx, ty + dy);
        if (ch === '.' || ch === ',') return ch;
      }
      return '.';
    },

    // ---------- 描画（起動時に1回だけ、1枚絵に焼く） ----------
    prerender() {
      const cv = this.canvas = NH.Sprites.makeCanvas(this.pxW, this.pxH);
      const g = cv.getContext('2d');
      this.leds = [];

      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          const ch = this.get(tx, ty);
          if (ch === '#') { drawWall(g, tx, ty); continue; }
          drawFloor(g, tx, ty, TILES[ch].solid ? this.floorUnder(tx, ty) : ch);
        }
      }
      // 床に落ちる影（障害物より先に描く）
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          if (this.get(tx, ty) !== '#') drawShadow(g, tx, ty);
        }
      }
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          const ch = this.get(tx, ty);
          if (ch === 'C' || ch === 'R') drawContainer(g, tx, ty, ch);
          else if (ch === 'B') drawCrate(g, tx, ty);
          else if (ch === 'D' || ch === 'T') drawDesk(g, tx, ty, ch);
          else if (ch === 'K') drawLocker(g, tx, ty);
          else if (ch === 'V') drawRack(g, tx, ty);
        }
      }

      // 照明：全体を少し沈めてから、灯りの下だけ明るくする
      g.fillStyle = 'rgba(3,7,16,0.26)';
      g.fillRect(0, 0, this.pxW, this.pxH);
      g.globalCompositeOperation = 'lighter';
      for (const l of LIGHTS_1) {
        const x = l.x * T, y = l.y * T;
        const gr = g.createRadialGradient(x, y, 8, x, y, l.r);
        gr.addColorStop(0, l.cold ? 'rgba(70,120,170,0.26)' : 'rgba(150,160,150,0.22)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
      }
      g.globalCompositeOperation = 'source-over';
      // 壁の上面は光が届かないので描き直す
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          if (this.get(tx, ty) === '#') drawWallTop(g, tx, ty);
        }
      }
    },

    // 毎フレーム描く小物（ラックの点滅ランプ）
    drawDynamic(ctx, time, cam, view) {
      for (const l of this.leds) {
        if (l.x < cam.x - 4 || l.y < cam.y - 4 || l.x > cam.x + view.w || l.y > cam.y + view.h) continue;
        if ((time + l.phase) % l.period < l.period * 0.5) {
          ctx.fillStyle = l.color;
          ctx.fillRect(l.x, l.y, 2, 1);
        }
      }
    }
  };

  // ---------- タイルごとの描画 ----------
  function isWall(tx, ty) { return M.get(tx, ty) === '#'; }
  function hasFace(tx, ty) { return ty + 1 < M.h && !isWall(tx, ty + 1); }

  function drawFloor(g, tx, ty, kind) {
    const px = tx * T, py = ty * T;
    if (kind === ',') {
      // 事務室：タイルカーペット
      g.fillStyle = ((tx + ty) & 1) ? '#3a4054' : '#353b4e';
      g.fillRect(px, py, T, T);
      for (let i = 0; i < 10; i++) {
        g.fillStyle = rnd(tx, ty, i) < 0.5 ? '#40475c' : '#31364a';
        g.fillRect(px + Math.floor(rnd(tx, ty, i + 20) * 16) * 2, py + Math.floor(rnd(tx, ty, i + 40) * 16) * 2, 2, 2);
      }
      g.fillStyle = '#2a2f40';
      g.fillRect(px + T - 1, py, 1, T);
      g.fillRect(px, py + T - 1, T, 1);
      return;
    }
    // コンクリート
    g.fillStyle = '#2c3138';
    g.fillRect(px, py, T, T);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = rnd(tx, ty, i) < 0.5 ? '#333941' : '#272c32';
      g.fillRect(px + Math.floor(rnd(tx, ty, i + 20) * 16) * 2, py + Math.floor(rnd(tx, ty, i + 40) * 16) * 2, 2, 2);
    }
    if (rnd(tx, ty, 60) < 0.08) {
      // 染み
      g.fillStyle = 'rgba(0,0,0,0.16)';
      const sx = px + 6 + Math.floor(rnd(tx, ty, 61) * 8) * 2;
      const sy = py + 6 + Math.floor(rnd(tx, ty, 62) * 8) * 2;
      g.fillRect(sx, sy + 2, 10, 4);
      g.fillRect(sx + 2, sy, 6, 8);
    }
    if (rnd(tx, ty, 63) < 0.05) {
      // ひび
      g.fillStyle = '#1f2328';
      let cx = px + 4 + Math.floor(rnd(tx, ty, 64) * 10) * 2, cy = py + 4;
      for (let i = 0; i < 9; i++) {
        g.fillRect(cx, cy, 2, 2);
        cy += 2;
        cx += (rnd(tx, ty, 70 + i) < 0.5 ? -2 : 2) * (rnd(tx, ty, 80 + i) < 0.6 ? 1 : 0);
      }
    }
    // 2タイルごとの目地
    if (tx % 2 === 0) {
      g.fillStyle = '#20252a'; g.fillRect(px, py, 1, T);
      g.fillStyle = '#343a42'; g.fillRect(px + 1, py, 1, T);
    }
    if (ty % 2 === 0) {
      g.fillStyle = '#20252a'; g.fillRect(px, py, T, 1);
      g.fillStyle = '#343a42'; g.fillRect(px, py + 1, T, 1);
    }
  }

  function drawWallTop(g, tx, ty) {
    const px = tx * T, py = ty * T;
    const h = hasFace(tx, ty) ? 8 : T;
    g.fillStyle = '#12161a';
    g.fillRect(px, py, T, h);
    g.fillStyle = '#28303a';
    if (!isWall(tx - 1, ty)) g.fillRect(px, py, 2, h);
    if (!isWall(tx + 1, ty)) g.fillRect(px + T - 2, py, 2, h);
    if (!isWall(tx, ty - 1)) g.fillRect(px, py, T, 2);
  }

  function drawWall(g, tx, ty) {
    const px = tx * T, py = ty * T;
    drawWallTop(g, tx, ty);
    if (!hasFace(tx, ty)) return;

    // 手前に見える壁面
    g.fillStyle = '#66727e'; g.fillRect(px, py + 8, T, 2);
    g.fillStyle = '#465059'; g.fillRect(px, py + 10, T, 9);
    g.fillStyle = '#3b444d'; g.fillRect(px, py + 19, T, 9);
    g.fillStyle = '#525d68'; g.fillRect(px, py + 18, T, 1);
    for (let i = 0; i < 2; i++) {
      const sx = px + i * 16;
      g.fillStyle = '#2d343b'; g.fillRect(sx, py + 10, 1, 18);
      g.fillStyle = '#515c66'; g.fillRect(sx + 1, py + 10, 1, 18);
      g.fillStyle = '#7a8692'; g.fillRect(sx + 4, py + 12, 2, 2);
      g.fillStyle = '#7a8692'; g.fillRect(sx + 11, py + 12, 2, 2);
    }
    g.fillStyle = '#1b2025'; g.fillRect(px, py + 28, T, 4);
    g.fillStyle = '#2a3138'; g.fillRect(px, py + 28, T, 1);

    const r = rnd(tx, ty, 5);
    if (r < 0.09) {
      // 通気口
      g.fillStyle = '#1a1f24'; g.fillRect(px + 9, py + 20, 14, 7);
      g.fillStyle = '#59646e';
      for (let i = 0; i < 3; i++) g.fillRect(px + 10, py + 21 + i * 2, 12, 1);
    } else if (r < 0.15) {
      // 警告プレート
      g.fillStyle = '#b89a2a'; g.fillRect(px + 11, py + 20, 10, 6);
      g.fillStyle = '#1a1a14';
      g.fillRect(px + 13, py + 20, 2, 6);
      g.fillRect(px + 17, py + 20, 2, 6);
    }
    // 壁の端
    g.fillStyle = '#262c33';
    if (!isWall(tx - 1, ty)) g.fillRect(px, py + 8, 2, 24);
    if (!isWall(tx + 1, ty)) g.fillRect(px + T - 2, py + 8, 2, 24);
  }

  function drawShadow(g, tx, ty) {
    const px = tx * T, py = ty * T;
    if (M.isSolid(tx, ty - 1)) {
      const a = [0.42, 0.31, 0.21, 0.13, 0.06];
      for (let i = 0; i < a.length; i++) {
        g.fillStyle = 'rgba(0,0,0,' + a[i] + ')';
        g.fillRect(px, py + i * 2, T, 2);
      }
    }
    if (M.isSolid(tx - 1, ty)) {
      const a = [0.24, 0.14, 0.06];
      for (let i = 0; i < a.length; i++) {
        g.fillStyle = 'rgba(0,0,0,' + a[i] + ')';
        g.fillRect(px + i * 2, py, 2, T);
      }
    }
  }

  const CONTAINER_PAL = {
    C: { roof: '#33756f', roofLo: '#2b6560', hi: '#4c9a92', face: '#27605b', faceLo: '#1d4a46', edge: '#102e2c' },
    R: { roof: '#93503a', roofLo: '#814531', hi: '#b56a50', face: '#763d2c', faceLo: '#5c2e21', edge: '#351a13' }
  };

  function drawContainer(g, tx, ty, ch) {
    const px = tx * T, py = ty * T;
    const p = CONTAINER_PAL[ch];
    const same = (x, y) => M.get(x, y) === ch;
    const front = !same(tx, ty + 1);
    const roofH = front ? 12 : T;

    // 上面（波板）
    for (let x = 0; x < T; x += 4) {
      g.fillStyle = p.roof; g.fillRect(px + x, py, 2, roofH);
      g.fillStyle = p.roofLo; g.fillRect(px + x + 2, py, 2, roofH);
    }
    if (front) {
      // 側面
      g.fillStyle = p.hi; g.fillRect(px, py + 12, T, 2);
      for (let x = 0; x < T; x += 4) {
        g.fillStyle = p.face; g.fillRect(px + x, py + 14, 2, 16);
        g.fillStyle = p.faceLo; g.fillRect(px + x + 2, py + 14, 2, 16);
      }
      g.fillStyle = p.edge; g.fillRect(px, py + 30, T, 2);
      // 扉のロックバー（左端）と管理ラベル
      if (!same(tx - 1, ty)) {
        g.fillStyle = '#9aa4a8';
        g.fillRect(px + 8, py + 15, 2, 14);
        g.fillRect(px + 20, py + 15, 2, 14);
        g.fillStyle = p.edge;
        g.fillRect(px + 7, py + 22, 4, 2);
        g.fillRect(px + 19, py + 22, 4, 2);
      } else if (rnd(tx, ty, 3) < 0.6) {
        g.fillStyle = 'rgba(230,230,220,0.75)';
        g.fillRect(px + 8, py + 18, 12, 2);
        g.fillRect(px + 8, py + 22, 8, 2);
      }
    }
    g.fillStyle = p.edge;
    if (!same(tx - 1, ty)) g.fillRect(px, py, 2, T);
    if (!same(tx + 1, ty)) g.fillRect(px + T - 2, py, 2, T);
    if (!same(tx, ty - 1)) {
      g.fillRect(px, py, T, 2);
      g.fillStyle = p.hi;
      g.fillRect(px + (same(tx - 1, ty) ? 0 : 2), py + 2, T - (same(tx - 1, ty) ? 0 : 2) - (same(tx + 1, ty) ? 0 : 2), 1);
    }
  }

  function drawCrate(g, tx, ty) {
    const x = tx * T + 2, y = ty * T + 1, w = 28;
    g.fillStyle = '#241a0f'; g.fillRect(x - 1, y - 1, w + 2, 31);
    // ふた
    g.fillStyle = '#a07e4c'; g.fillRect(x, y, w, 11);
    g.fillStyle = '#b8945c'; g.fillRect(x, y, w, 1);
    g.fillStyle = '#8a6a3c';
    for (let i = 7; i < w; i += 7) g.fillRect(x + i, y + 1, 1, 10);
    // 前面
    g.fillStyle = '#7c5c36'; g.fillRect(x, y + 11, w, 18);
    g.fillStyle = '#5a4126';
    g.fillRect(x, y + 11, w, 2);
    g.fillRect(x, y + 27, w, 2);
    g.fillRect(x, y + 11, 2, 18);
    g.fillRect(x + w - 2, y + 11, 2, 18);
    for (let i = 0; i < 12; i++) g.fillRect(x + 2 + i * 2, y + 14 + i, 3, 2);
    g.fillStyle = '#93703f';
    g.fillRect(x + 2, y + 13, w - 4, 1);
  }

  function drawDesk(g, tx, ty, ch) {
    const px = tx * T, py = ty * T;
    const isDesk = (x, y) => { const c = M.get(x, y); return c === 'D' || c === 'T'; };
    const L = !isDesk(tx - 1, ty), R = !isDesk(tx + 1, ty);
    const x0 = px + (L ? 1 : 0), x1 = px + T - (R ? 1 : 0), w = x1 - x0;

    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0, py + 27, w, 3);
    // 天板
    g.fillStyle = '#958d7b'; g.fillRect(x0, py + 3, w, 16);
    g.fillStyle = '#b1a995'; g.fillRect(x0, py + 3, w, 1);
    g.fillStyle = '#8a8271'; g.fillRect(x0, py + 17, w, 2);
    // 前板
    g.fillStyle = '#676151'; g.fillRect(x0, py + 19, w, 8);
    g.fillStyle = '#4a4538'; g.fillRect(x0, py + 26, w, 1);
    g.fillStyle = '#827b68'; g.fillRect(px + 12, py + 22, 8, 1);
    g.fillStyle = '#2b281f';
    if (L) { g.fillRect(x0, py + 3, 1, 24); g.fillRect(x0, py + 27, 2, 3); }
    if (R) { g.fillRect(x1 - 1, py + 3, 1, 24); g.fillRect(x1 - 2, py + 27, 2, 3); }
    g.fillRect(x0, py + 2, w, 1);

    if (ch === 'T') {
      // 端末
      g.fillStyle = '#14171b'; g.fillRect(px + 7, py + 1, 18, 13);
      g.fillStyle = '#17543a'; g.fillRect(px + 9, py + 3, 14, 9);
      g.fillStyle = '#4fd092';
      g.fillRect(px + 10, py + 4, 8, 1);
      g.fillRect(px + 10, py + 6, 11, 1);
      g.fillRect(px + 10, py + 8, 5, 1);
      g.fillStyle = '#2d3238'; g.fillRect(px + 13, py + 14, 6, 2);
      g.fillStyle = '#3a4047'; g.fillRect(px + 9, py + 16, 14, 2);
    } else {
      const r = rnd(tx, ty, 7);
      if (r < 0.6) {
        // 書類
        const ox = px + 5 + Math.floor(r * 20);
        g.fillStyle = '#d6d2c2'; g.fillRect(ox, py + 6, 8, 9);
        g.fillStyle = '#8f8b7c';
        g.fillRect(ox + 1, py + 8, 6, 1);
        g.fillRect(ox + 1, py + 10, 6, 1);
        g.fillRect(ox + 1, py + 12, 4, 1);
      }
      if (r > 0.45) {
        // マグカップ
        const ox = px + 22 - Math.floor(r * 14);
        g.fillStyle = '#2b281f'; g.fillRect(ox, py + 7, 5, 5);
        g.fillStyle = '#c7ccd0'; g.fillRect(ox + 1, py + 8, 3, 3);
      }
    }
  }

  function drawLocker(g, tx, ty) {
    const px = tx * T, py = ty * T;
    g.fillStyle = '#5b6870'; g.fillRect(px, py, T, 8);
    g.fillStyle = '#8b99a1'; g.fillRect(px, py + 8, T, 1);
    g.fillStyle = '#48545c'; g.fillRect(px, py + 9, T, 20);
    g.fillStyle = '#1e2429'; g.fillRect(px, py + 29, T, 3);
    for (let i = 0; i < 2; i++) {
      const x = px + i * 16;
      g.fillStyle = '#2e373d'; g.fillRect(x, py, 1, 29);
      g.fillStyle = '#566269'; g.fillRect(x + 1, py + 9, 1, 20);
      g.fillStyle = '#2e373d';
      for (let k = 0; k < 3; k++) g.fillRect(x + 5, py + 12 + k * 2, 7, 1);
      g.fillStyle = '#b0bac0'; g.fillRect(x + 12, py + 20, 2, 3);
    }
    g.fillStyle = '#2e373d'; g.fillRect(px + T - 1, py, 1, 29);
  }

  function drawRack(g, tx, ty) {
    const px = tx * T, py = ty * T;
    g.fillStyle = '#252b32'; g.fillRect(px, py, T, 8);
    g.fillStyle = '#414b55'; g.fillRect(px, py + 8, T, 1);
    g.fillStyle = '#0e1216'; g.fillRect(px, py + 9, T, 21);
    g.fillStyle = '#06080a'; g.fillRect(px, py + 30, T, 2);
    g.fillStyle = '#2a3138';
    g.fillRect(px, py, 2, 30);
    g.fillRect(px + T - 2, py, 2, 30);
    for (let row = 0; row < 5; row++) {
      const y = py + 11 + row * 4;
      g.fillStyle = '#1c2228'; g.fillRect(px + 10, y, 18, 2);
      const r = rnd(tx, ty, row);
      const color = r < 0.7 ? '#46e684' : '#ffb436';
      g.fillStyle = r < 0.7 ? '#1c5a36' : '#6b4a14';
      g.fillRect(px + 5, y, 2, 1);
      if (rnd(tx, ty, row + 10) < 0.55) {
        M.leds.push({
          x: px + 5, y, color,
          period: 0.25 + rnd(tx, ty, row + 20) * 1.6,
          phase: rnd(tx, ty, row + 30) * 3
        });
      }
    }
  }
})();
