// マップのデータ、当たり判定、タイルの描画。
(function () {
  const C = NH.CONFIG;
  const T = C.TILE;

  // 1文字 = 1タイル。全行を同じ長さにそろえること。
  //   # 壁        . コンクリ床   , 事務室の床
  //   C R コンテナ  B 木箱       D 机   T 端末つきの机
  //   K ロッカー   V サーバーラック  S プレイヤーの開始位置
  //   m 金属床（走ると足音）  ~ 水たまり（走ると足音）
  //   = 低い通気口（匍匐でだけ通れる。敵は通れず、中は見えない）
  //   1 2 ロック付きの扉（数字は必要なカードキーのレベル）  E エレベーター（ゴール）
  const FLOOR_1 = [
    '################################################',
    '#KK,,,,,,,,,,,,,,,KK#...#...................EE.#',
    '#,,,,,,,,,,,,,,,,,,,#...#..VV..VV..VV..........#',
    '#,,TDD,,,TDD,,,TDD,,#...2..VV..VV..VV..........#',
    '#,,,,,,,,,,,,,,,,,,,#...2......................#',
    '#,,,,,,,,,,,,,,,,,,,1...#......................#',
    '#,,DDT,,,DDT,,,DDT,,1mmm#..VV..VV..VV....RR....#',
    '#,,,,,,,,,,,,,,,,,,,#mmm#..VV..VV..VV....RR....#',
    '#,,,,,,,,,,,,,,,,,,,#...#......................#',
    '#,,TDD,,,TDD,,,,,,,,#...#......................#',
    '#,,,,,,,,,,,,,,,,,,,#...#.............BB.......#',
    '#BB,,,,,,,,,,,,,,,KK#...#.............mmmmmm...#',
    '########..###########...################..######',
    '########11###########...################22######',
    '#............BB...........mmmm.................#',
    '#.........................mmmm.................#',
    '#.........................mmmm....CC...........#',
    '#####..#############=#########..################',
    '#####..#############=#########..################',
    '#....~~.......#................................#',
    '#.........BB..#..CCCC....RRRR........CCCC......#',
    '#.........BB..=..CCCC....RRRR........CCCC......#',
    '#.............#................................#',
    '#..CCC........#................BB..............#',
    '#..CCC........#..RRRR..........BB....RRRR..BB..#',
    '#.............#..RRRR................RRRR......#',
    '#...................~~~........................#',
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

  // 鍵のかかった部屋。これらの区画の側からは、扉をカードキーなしで開けられる
  const SECURE_ZONES = ['事務室', 'サーバールーム'];

  // 敵兵の巡回ルート（タイル座標）。隣り合う地点の間は、障害物のない直線にすること。
  // 地点が1つだけなら、その場に立って face（度。右が0、下が90）の方向を見張る。
  const ENEMIES_1 = [
    { route: [[9, 20], [9, 23]] },                         // 搬入ドック：北の出口の前を往復
    { route: [[16, 22], [35, 22], [35, 26], [16, 26]] },    // 第1倉庫：西側を周回
    { route: [[45, 19], [45, 30], [30, 30], [30, 19]] },    // 第1倉庫：東側を周回（北の出口の前を通る）
    { route: [[2, 15], [22, 15]] },                         // 中央通路：西半分を往復
    { route: [[45, 15], [24, 15]] },                        // 中央通路：東半分を往復
    { route: [[7, 4], [18, 4], [18, 8], [7, 8]], carry: { type: 'key', level: 2 } }, // 事務室：机の間を周回。カードキー Lv2 を持っている
    { route: [[19, 10], [3, 10]] },                         // 事務室：南の出口の前を往復
    { route: [[22, 2], [22, 10]] },                         // 連絡通路を往復
    { route: [[26, 4], [45, 4], [45, 8], [26, 8]] },        // サーバールームを周回
    { route: [[41, 9]], face: 90 }                          // サーバールーム：南の出口を見張る
  ];

  // 落ちているアイテム（タイル座標）
  //   box 段ボール箱  gun 麻酔銃  ammo 麻酔弾  key カードキー（level）  ration 回復
  const ITEMS_1 = [
    { type: 'box', x: 12, y: 30 },
    { type: 'gun', x: 16, y: 30 },
    { type: 'key', level: 1, x: 38, y: 23 },
    { type: 'ration', x: 1, y: 14 },
    { type: 'ration', x: 2, y: 2 },
    { type: 'ammo', x: 18, y: 2 },
    { type: 'ammo', x: 22, y: 1 },
    { type: 'ration', x: 26, y: 10 }
  ];

  // 監視カメラ（タイル座標。そのタイルの上端に付く）。face は首振りの中心（度）、swing は左右に振る角度
  const SENTRIES_1 = [
    { x: 22, y: 19, face: 90, swing: 60 },   // 第1倉庫：北の壁から通路を見下ろす
    { x: 37, y: 14, face: 90, swing: 55 },   // 中央通路：サーバールーム南の扉の手前
    { x: 12, y: 1, face: 90, swing: 60 }     // 事務室：北の壁
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
    'V': { name: 'rack', solid: true, opaque: true },
    'm': { name: 'metal', solid: false, opaque: false, noisy: 'metal' },
    '~': { name: 'puddle', solid: false, opaque: false, noisy: 'water' },
    '=': { name: 'duct', solid: true, opaque: true, low: true },
    // 扉は開閉するので、通れるかどうかは扉の状態で決める（isSolid などを参照）
    '1': { name: 'door', solid: false, opaque: false, door: 1 },
    '2': { name: 'door', solid: false, opaque: false, door: 2 },
    'E': { name: 'elevator', solid: false, opaque: false, goal: true }
  };
  const FLOORS = '.,m~12E';
  const DOOR_COLOR = { 1: '#3aa0ff', 2: '#ff7a3a' };

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
      this.enemyDefs = ENEMIES_1;
      this.itemDefs = ITEMS_1;
      this.sentryDefs = SENTRIES_1;
      this.buildDoors();
      this.prerender();
    },

    // 隣り合う扉タイルを1枚の扉にまとめる
    buildDoors() {
      this.doors = [];
      this.doorGrid = new Array(this.w * this.h);
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          const level = TILES[this.rows[ty][tx]].door;
          if (!level || this.doorGrid[tx + ty * this.w]) continue;
          const horizontal = TILES[this.get(tx + 1, ty)].door === level;
          const door = { level, horizontal, tiles: [], open: 0, hold: 0, x: 0, y: 0 };
          let x = tx, y = ty;
          while (TILES[this.get(x, y)].door === level) {
            door.tiles.push({ tx: x, ty: y });
            this.doorGrid[x + y * this.w] = door;
            if (horizontal) x++; else y++;
          }
          const a = door.tiles[0], b = door.tiles[door.tiles.length - 1];
          door.x = (a.tx + b.tx + 1) / 2 * T;
          door.y = (a.ty + b.ty + 1) / 2 * T;
          // どちら側が鍵のかかった部屋の内側かを、区画から決める（内側からは鍵なしで開く）
          const secure = (x, y) => { const z = this.zoneAt((x + 0.5) * T, (y + 0.5) * T); return !!z && SECURE_ZONES.includes(z.name); };
          if (horizontal) door.inside = secure(a.tx, a.ty - 2) || secure(a.tx, a.ty - 1) ? { x: 0, y: -1 } : { x: 0, y: 1 };
          else door.inside = secure(a.tx - 1, a.ty) ? { x: -1, y: 0 } : { x: 1, y: 0 };
          this.doors.push(door);
        }
      }
    },

    resetDoors() {
      for (const d of this.doors) { d.open = 0; d.hold = 0; }
    },

    doorAt(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return null;
      return this.doorGrid[tx + ty * this.w] || null;
    },

    // 扉の開閉。敵が近づくと自動で開く。プレイヤーは Game 側でカードキーを確かめてから openDoor を呼ぶ
    updateDoors(dt, player, enemies) {
      const R = 48;
      for (const d of this.doors) {
        let near = false;
        for (const e of enemies) {
          if (e.state !== 'stunned' && Math.hypot(e.x - d.x, e.y - d.y) < R) { near = true; break; }
        }
        // 開いている間は、プレイヤーがそばにいても閉まらない（敵が開けた扉に便乗できる）
        if (!near && d.open > 0 && Math.hypot(player.x - d.x, player.y - d.y) < R) near = true;
        if (near) d.hold = Math.max(d.hold, 1.2);
        const was = d.open;
        d.hold -= dt;
        d.open = Math.max(0, Math.min(1, d.open + (d.hold > 0 ? dt : -dt) / 0.22));
        if (was === 0 && d.open > 0) d.sound = 'doorOpen';
        else if (was === 1 && d.open < 1) d.sound = 'doorClose';
      }
    },

    openDoor(d) { d.hold = 1.8; },

    // プレイヤーのそばにある閉じた扉
    doorNear(x, y) {
      for (const d of this.doors) {
        if (d.open < 0.5 && Math.abs(x - d.x) < (d.horizontal ? T + 6 : 30) && Math.abs(y - d.y) < (d.horizontal ? 42 : T + 6)) return d;
      }
      return null;
    },

    // 扉に対して、鍵のかかった部屋の内側にいるか
    insideOf(d, x, y) {
      return (x - d.x) * d.inside.x + (y - d.y) * d.inside.y > 0;
    },

    isGoal(x, y) {
      return !!TILES[this.get(Math.floor(x / T), Math.floor(y / T))].goal;
    },

    // マップ外は壁として扱う
    get(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#';
      return this.rows[ty][tx];
    },
    isSolid(tx, ty) {
      const t = TILES[this.get(tx, ty)];
      if (t.door) return this.doorGrid[tx + ty * this.w].open < 0.9;
      return t.solid;
    },
    isOpaque(tx, ty) {
      const t = TILES[this.get(tx, ty)];
      if (t.door) return this.doorGrid[tx + ty * this.w].open < 0.5;
      return t.opaque;
    },
    // 敵の経路探索用。扉は開けて通れるので、ふさがっていない扱い
    blocksEnemy(tx, ty) { return TILES[this.get(tx, ty)].solid; },

    // 矩形（ワールド座標）が通れないタイルに重なるか。crawl が true なら低い通気口は通れる
    rectSolid(x, y, w, h, crawl) {
      const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
      const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.001) / T);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const t = TILES[this.get(tx, ty)];
          if (t.door) { if (this.doorGrid[tx + ty * this.w].open < 0.9) return true; continue; }
          if (t.solid && !(crawl && t.low)) return true;
        }
      }
      return false;
    },

    // 矩形が低い通気口に重なるか（中では立ち上がれない）
    rectLow(x, y, w, h) {
      const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
      const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.001) / T);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (TILES[this.get(tx, ty)].low) return true;
        }
      }
      return false;
    },

    // その地点の床が音の出る種類なら 'metal' か 'water' を返す
    noisyAt(x, y) {
      return TILES[this.get(Math.floor(x / T), Math.floor(y / T))].noisy || null;
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
        if (ch === ',') return ch;
        if (FLOORS.includes(ch)) return '.';
      }
      return '.';
    },

    // ---------- 描画（起動時に1回だけ、1枚絵に焼く） ----------
    prerender() {
      const cv = this.canvas = NH.Sprites.makeCanvas(this.pxW, this.pxH);
      const g = cv.getContext('2d');
      this.leds = [];
      this.ducts = [];

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
          else if (ch === 'E') drawElevator(g, tx, ty);
          else if (TILES[ch].door) drawDoorSill(g, tx, ty);
          else if (ch === '=') {
            drawDuct(g, tx, ty);
            this.ducts.push({
              x: tx * T, y: ty * T,
              up: !this.isSolid(tx, ty - 1), down: !this.isSolid(tx, ty + 1),
              left: !this.isSolid(tx - 1, ty), right: !this.isSolid(tx + 1, ty)
            });
          }
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
      this.buildMini();
      // 壁の上面は光が届かないので描き直す
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          if (this.get(tx, ty) === '#') drawWallTop(g, tx, ty);
        }
      }
    },

    // 扉の板。開くと左右（縦の扉は上下）の壁の中へ引き込まれる
    drawDoors(ctx, keyLevel) {
      for (const d of this.doors) {
        const a = d.tiles[0];
        const x = a.tx * T, y = a.ty * T;
        const len = d.tiles.length * T / 2;       // 片側の板の長さ
        const vis = Math.round(len * (1 - d.open)); // 見えている長さ
        const color = DOOR_COLOR[d.level];
        const lamp = keyLevel >= d.level ? '#4dff8a' : '#ff3b30';
        if (vis > 0) {
          if (d.horizontal) {
            for (const [px, w] of [[x, vis], [x + len * 2 - vis, vis]]) {
              ctx.fillStyle = '#1b2026'; ctx.fillRect(px, y + 4, w, 28);
              ctx.fillStyle = '#6f7b87'; ctx.fillRect(px, y + 6, w, 22);
              ctx.fillStyle = '#8f9ba7'; ctx.fillRect(px, y + 6, w, 2);
              ctx.fillStyle = color; ctx.fillRect(px, y + 13, w, 4);
              ctx.fillStyle = '#4b5560'; ctx.fillRect(px, y + 24, w, 4);
            }
            ctx.fillStyle = '#1b2026';
            ctx.fillRect(x + vis - 1, y + 6, 1, 24);
            ctx.fillRect(x + len * 2 - vis, y + 6, 1, 24);
          } else {
            for (const [py, h] of [[y, vis], [y + len * 2 - vis, vis]]) {
              ctx.fillStyle = '#1b2026'; ctx.fillRect(x + 9, py, 14, h);
              ctx.fillStyle = '#6f7b87'; ctx.fillRect(x + 11, py, 10, h);
              ctx.fillStyle = color; ctx.fillRect(x + 14, py, 4, h);
            }
          }
        }
        // カード読み取り機のランプ（開けられるなら緑）
        ctx.fillStyle = '#12161a';
        if (d.horizontal) {
          ctx.fillRect(x - 9, y + 14, 6, 8);
          ctx.fillStyle = lamp; ctx.fillRect(x - 7, y + 16, 2, 2);
          ctx.fillStyle = color; ctx.fillRect(x - 7, y + 19, 2, 1);
        } else {
          ctx.fillRect(x + 4, y - 9, 6, 8);
          ctx.fillRect(x + T - 10, y - 9, 6, 8);
          ctx.fillStyle = lamp;
          ctx.fillRect(x + 6, y - 7, 2, 2);
          ctx.fillRect(x + T - 8, y - 7, 2, 2);
        }
      }
    },

    // レーダー用の縮小地図（1タイル = MINI px）
    MINI: 4,
    buildMini() {
      const k = this.MINI;
      const cv = this.mini = NH.Sprites.makeCanvas(this.w * k, this.h * k);
      const g = cv.getContext('2d');
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          const ch = this.rows[ty][tx], t = TILES[ch];
          let col = null;
          if (ch === '#') col = '#2f6b58';
          else if (t.low) col = '#b89a2a';
          else if (t.goal) col = '#7dffc4';
          else if (t.solid) col = t.opaque ? '#3f8a70' : '#28574a';
          else if (t.noisy) col = '#123a30';
          if (col) { g.fillStyle = col; g.fillRect(tx * k, ty * k, k, k); }
        }
      }
    },

    // エレベーターのランプ。動かせるなら緑、動かせないなら赤
    drawGoalLamps(ctx, usable, time) {
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          if (!TILES[this.rows[ty][tx]].goal) continue;
          ctx.fillStyle = usable ? '#4dff8a' : (Math.sin(time * 6) > 0 ? '#ff3b30' : '#7a1610');
          ctx.fillRect(tx * T + 12, (ty - 1) * T + 13, 8, 2);
        }
      }
    },

    // 毎フレーム描く小物（通気口のシャッター、ラックの点滅ランプ）
    drawDynamic(ctx, time, cam, view) {
      if (NH.Alert.ductLocked()) {
        const blink = Math.sin(time * 9) > 0;
        for (const d of this.ducts) {
          ctx.fillStyle = 'rgba(120,16,12,0.72)';
          ctx.fillRect(d.x + 2, d.y + 2, T - 4, T - 4);
          ctx.fillStyle = '#2a0806';
          for (let i = 5; i < T - 4; i += 5) ctx.fillRect(d.x + 2, d.y + i, T - 4, 2);
          ctx.fillStyle = blink ? '#ff4a3a' : '#a01d14';
          if (d.up) ctx.fillRect(d.x, d.y, T, 3);
          if (d.down) ctx.fillRect(d.x, d.y + T - 3, T, 3);
          if (d.left) ctx.fillRect(d.x, d.y, 3, T);
          if (d.right) ctx.fillRect(d.x + T - 3, d.y, 3, T);
        }
      }
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
    if (kind === 'm') {
      // 金属床：縞鋼板
      g.fillStyle = '#4a545e';
      g.fillRect(px, py, T, T);
      g.fillStyle = '#5c6772';
      for (let y = 0; y < T; y += 8) {
        for (let x = 0; x < T; x += 8) {
          const odd = ((x + y) / 8) & 1;
          if (odd) { g.fillRect(px + x + 1, py + y + 3, 6, 2); }
          else { g.fillRect(px + x + 3, py + y + 1, 2, 6); }
        }
      }
      g.fillStyle = '#353d45';
      g.fillRect(px, py, T, 1);
      g.fillRect(px, py, 1, T);
      g.fillStyle = '#6d7985';
      g.fillRect(px + 2, py + 2, 2, 2);
      g.fillRect(px + T - 4, py + 2, 2, 2);
      g.fillRect(px + 2, py + T - 4, 2, 2);
      g.fillRect(px + T - 4, py + T - 4, 2, 2);
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
    if (kind === '~') {
      // 水たまり：隣の水たまりとつながって見えるよう、端を少し欠く
      const wet = (x, y) => M.get(x, y) === '~';
      const l = wet(tx - 1, ty) ? 0 : 4, r = wet(tx + 1, ty) ? 0 : 4;
      const u = wet(tx, ty - 1) ? 0 : 5, d = wet(tx, ty + 1) ? 0 : 5;
      const il = l ? 3 : 0, ir = r ? 3 : 0;
      g.fillStyle = '#1c3344';
      g.fillRect(px + l, py + u + 2, T - l - r, T - u - d - 4);
      g.fillRect(px + l + il, py + u, T - l - r - il - ir, T - u - d);
      g.fillStyle = '#28495e';
      g.fillRect(px + l + il, py + u + 3, T - l - r - il - ir, T - u - d - 7);
      g.fillStyle = '#6fa3bd';
      g.fillRect(px + 8 + Math.floor(rnd(tx, ty, 90) * 6) * 2, py + 9, 8, 1);
      g.fillRect(px + 6 + Math.floor(rnd(tx, ty, 91) * 6) * 2, py + 18, 5, 1);
    }
  }

  // 扉の敷居（板そのものは毎フレーム描く）
  function drawDoorSill(g, tx, ty) {
    const px = tx * T, py = ty * T;
    const level = TILES[M.get(tx, ty)].door;
    g.fillStyle = '#1a1f24';
    g.fillRect(px, py, T, T);
    g.fillStyle = '#3d4852';
    if (M.doorAt(tx, ty).horizontal) {
      g.fillRect(px, py + 2, T, 2);
      g.fillRect(px, py + T - 4, T, 2);
      g.fillStyle = DOOR_COLOR[level];
      for (let i = 2; i < T; i += 8) g.fillRect(px + i, py + T - 2, 4, 2);
    } else {
      g.fillRect(px + 6, py, 2, T);
      g.fillRect(px + T - 8, py, 2, T);
      g.fillStyle = DOOR_COLOR[level];
      for (let i = 2; i < T; i += 8) { g.fillRect(px + 2, py + i, 2, 4); g.fillRect(px + T - 4, py + i, 2, 4); }
    }
  }

  // エレベーター：乗り場の床と、北の壁にある扉
  function drawElevator(g, tx, ty) {
    const px = tx * T, py = ty * T;
    g.fillStyle = '#39424b'; g.fillRect(px, py, T, T);
    g.fillStyle = '#c9a227';
    for (let i = 0; i < T; i += 8) { g.fillRect(px + i, py + T - 3, 4, 3); }
    // 上向きの矢印
    g.fillStyle = '#7de0b0';
    g.fillRect(px + 15, py + 6, 2, 2);
    g.fillRect(px + 13, py + 8, 6, 2);
    g.fillRect(px + 11, py + 10, 10, 2);
    g.fillRect(px + 14, py + 12, 4, 10);
    // 壁側の扉
    const wy = py - T;
    g.fillStyle = '#15191d'; g.fillRect(px, wy + 6, T, 26);
    g.fillStyle = '#7f8b97'; g.fillRect(px + 1, wy + 9, T - 2, 23);
    g.fillStyle = '#a3afbb'; g.fillRect(px + 1, wy + 9, T - 2, 2);
    g.fillStyle = '#15191d';
    g.fillRect(M.get(tx - 1, ty) === 'E' ? px : px + T - 1, wy + 9, 1, 23);
    g.fillStyle = '#4dff8a';
    g.fillRect(px + 12, wy + 13, 8, 2);
  }

  // 低い通気口：壁をくり抜いた暗い通り道
  function drawDuct(g, tx, ty) {
    const px = tx * T, py = ty * T;
    g.fillStyle = '#090b0e';
    g.fillRect(px, py, T, T);
    const vertical = isWall(tx - 1, ty) || isWall(tx + 1, ty); // 上下に抜ける向き
    g.fillStyle = '#171c21';
    for (let i = 2; i < T; i += 4) {
      if (vertical) g.fillRect(px + 3, py + i, T - 6, 1);
      else g.fillRect(px + i, py + 3, 1, T - 6);
    }
    g.fillStyle = '#3d4852';
    if (isWall(tx - 1, ty)) g.fillRect(px, py, 3, T);
    if (isWall(tx + 1, ty)) g.fillRect(px + T - 3, py, 3, T);
    if (isWall(tx, ty - 1)) g.fillRect(px, py, T, 3);
    if (isWall(tx, ty + 1)) g.fillRect(px, py + T - 3, T, 3);
    // 出入口の黄色い目印
    g.fillStyle = '#c9a227';
    const open = (x, y) => !M.isSolid(x, y);
    for (let i = 4; i < T - 4; i += 8) {
      if (open(tx, ty - 1)) g.fillRect(px + i, py, 4, 2);
      if (open(tx, ty + 1)) g.fillRect(px + i, py + T - 2, 4, 2);
      if (open(tx - 1, ty)) g.fillRect(px, py + i, 2, 4);
      if (open(tx + 1, ty)) g.fillRect(px + T - 2, py + i, 2, 4);
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
