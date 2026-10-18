// ステージ3：逆境への強さ・冷静さ（落ち物パズル）
'use strict';

window.Stage3 = (function () {
  const COLS = 10, ROWS = 20, CELL = 23;
  const FX = Math.round((W - COLS * CELL) / 2), FY = 40;
  const LIMIT = 60, TARGET = 7;  // 60秒以内に7ライン消したら勝ち
  const START_SPEED = 3, END_SPEED = 6; // 通常の何倍で落ちるか（だんだん速くなる）
  const DROP = 0.8, SOFT = 0.04, LOCK = 0.5, DAS = 0.17, ARR = 0.05;

  // 4マスのブロック7種（正方形の枠の中で回す）
  const PIECES = [
    { n: 'I', m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#2ad4e6' },
    { n: 'O', m: [[1, 1], [1, 1]], color: '#f2d22e' },
    { n: 'T', m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#a648d8' },
    { n: 'S', m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#4cc94a' },
    { n: 'Z', m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#e63c3c' },
    { n: 'J', m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#3a5ee6' },
    { n: 'L', m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#f08c26' }
  ];

  // どの終わり方でも、縦の棒のことは必ず言う
  const barLine = i => (i.bars === 0
    ? `縦の棒は${i.pieces}個中、1本も来ませんでした。あなたが待っているものは、だいたい来ません。`
    : `縦の棒は${i.pieces}個中${i.bars}本しか来ませんでした。あなたが待っているものは、だいたい来ません。来ても、もう遅いです。`);

  const RESULTS = {
    clear: i => ({
      cleared: true, resultType: 'lines_cleared', diagnosisTag: '冷静型',
      diagnosisText: [`あなたは、だんだん速くなるブロックの中、${i.time}秒で${TARGET}ラインを消しました。あなたは混乱した状況でも、冷静に問題を整理できるようです。その冷静さを、なぜ現実の部屋の片付けに使わないのでしょうか。`, barLine(i)].join('\n'),
      playResult: `${TARGET}ライン消去（タイム ${i.time}秒／縦の棒 ${i.bars}本）`
    }),
    timeout: i => ({
      cleared: false, resultType: 'timeout', diagnosisTag: '決断遅延型',
      diagnosisText: [`あなたは${LIMIT}秒で${i.lines}ラインしか消せませんでした。あと${TARGET - i.lines}ラインでした。縦の棒を待ってすき間を空けていた時間は、合計${i.wait}秒です。あなたは正解を探し続けた結果、決断する機会を失いました。人生で一番長く待っているものを思い出してください。それは、まだ来ていないはずです。`, barLine(i)].join('\n'),
      playResult: `時間切れ（消去 ${i.lines}／${TARGET}ライン）`
    }),
    topout: i => ({
      cleared: false, resultType: 'field_full', diagnosisTag: '視野狭窄型',
      diagnosisText: [`あなたは${i.time}秒で天井に届きました。積み上げたブロックは${i.pieces}個、消せたラインは${i.lines}本です。あなたは目の前の問題を処理することに集中しすぎて、全体を見失う傾向があります。積み上げてきたのはブロックだけではないはずです。未読のメール、返していない連絡、先延ばしにした用事。`, barLine(i)].join('\n'),
      playResult: `${i.time}秒でフィールドが埋まった（消去 ${i.lines}／${TARGET}ライン）`
    })
  };

  const rotCW = m => m[0].map((_, x) => m.map(row => row[x]).reverse());
  const cellsOf = m => {
    const out = [];
    m.forEach((row, y) => row.forEach((v, x) => { if (v) out.push([x, y]); }));
    return out;
  };

  function create(api) {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let cur = null, next = null, sinceBar = 0, bars = 0, waitTime = 0;
    let time = 0, lines = 0, pieces = 0, state = 'play', st = 0;
    let dropT = 0, lockT = 0, dasT = 0, dasDir = 0, clearing = null, clearT = 0;

    // 縦の棒を入れる「たて穴」が3段以上あるか（棒を待っている状態）
    function hasWell() {
      for (let x = 0; x < COLS; x++) {
        let depth = 0;
        for (let y = 0; y < ROWS; y++) {
          if (grid[y][x] !== null) break;
          const l = x === 0 || grid[y][x - 1] !== null, r = x === COLS - 1 || grid[y][x + 1] !== null;
          depth = l && r ? depth + 1 : 0;
        }
        if (depth >= 3) return true;
      }
      return false;
    }

    // わざと少しイライラさせる抽選：縦の棒（I）は出にくく、待っているときはもっと出にくい。
    // ただし 12個 来なかったら必ず出す
    function takePiece(prev) {
      let id;
      if (sinceBar >= 12) id = 0;
      else {
        const wBar = hasWell() ? 0.12 : 0.45;
        const weights = PIECES.map((_, i) => (i === 0 ? wBar : i === prev ? 0.5 : 1));
        let r = Math.random() * weights.reduce((a, b) => a + b, 0);
        id = weights.findIndex(w => (r -= w) < 0);
        if (id < 0) id = 6;
      }
      if (id === 0) sinceBar = 0; else sinceBar++;
      return id;
    }
    const fits = (m, px, py) => cellsOf(m).every(([x, y]) => {
      const gx = px + x, gy = py + y;
      return gx >= 0 && gx < COLS && gy < ROWS && (gy < 0 || !grid[gy][gx]);
    });

    const speedNow = () => START_SPEED + (END_SPEED - START_SPEED) * Math.min(1, time / LIMIT);

    function topout() { state = 'topout'; st = 0; Fx.taunt('積みすぎました〜〜'); }

    function spawn() {
      const id = next == null ? takePiece(-1) : next;
      next = takePiece(id);
      if (id === 0) bars++;
      const m = PIECES[id].m;
      cur = { id, m, x: Math.floor((COLS - m.length) / 2), y: id === 0 ? -1 : 0 };
      dropT = 0; lockT = 0;
      if (!fits(cur.m, cur.x, cur.y)) topout();
    }

    function tryMove(dx, dy) {
      if (fits(cur.m, cur.x + dx, cur.y + dy)) { cur.x += dx; cur.y += dy; return true; }
      return false;
    }

    function rotate() {
      if (cur.id === 1) return; // 正方形は回しても同じ
      const r = rotCW(cur.m);
      for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]]) {
        if (fits(r, cur.x + kx, cur.y + ky)) {
          cur.m = r; cur.x += kx; cur.y += ky;
          lockT = 0;
          Sfx.play('rotate');
          return;
        }
      }
    }

    function lock() {
      for (const [x, y] of cellsOf(cur.m)) {
        const gy = cur.y + y;
        if (gy < 0) { topout(); return; }
        grid[gy][cur.x + x] = cur.id;
      }
      pieces++;
      Sfx.play('lock');
      const full = [];
      for (let y = 0; y < ROWS; y++) if (grid[y].every(v => v !== null)) full.push(y);
      cur = null;
      if (full.length) { clearing = full; clearT = 0; Sfx.play('line'); } else spawn();
    }

    function ghostY() {
      let y = cur.y;
      while (fits(cur.m, cur.x, y + 1)) y++;
      return y;
    }

    spawn();

    function update(dt) {
      st += dt;
      if (state === 'play') {
        time += dt;
        Music.tempo = 1 + (speedNow() - START_SPEED) / 6; // 落ちる速さに合わせて曲も速くなる
        if (time >= LIMIT) { time = LIMIT; state = 'timeout'; st = 0; Fx.taunt('おそすぎ〜〜　時間切れで〜〜す'); return; }
        if (cur && hasWell()) waitTime += dt;
        if (clearing) {
          clearT += dt;
          if (clearT > 0.35) {
            for (const y of clearing) { grid.splice(y, 1); grid.unshift(Array(COLS).fill(null)); }
            lines += clearing.length;
            // 消えた列が 大げさに爆発する
            const n = clearing.length;
            clearing.forEach(y => { for (let x = 0; x < COLS; x += 3) Fx.explode(FX + x * CELL + CELL, FY + y * CELL + CELL / 2, 0.7, ''); });
            Fx.texts.push({ kind: 'pop', text: ['ナイス！', 'すごい！！', 'すばらしい！！！', '天才！！！！'][Math.min(3, n - 1)], x: FX + COLS * CELL / 2, y: FY + clearing[0] * CELL, t: 0, dur: 1.1 });
            Fx.shake(6 + n * 4, 0.4);
            clearing = null;
            if (lines >= TARGET) { state = 'clear'; st = 0; Fx.fireworks(4.5); Fx.big('クリア！！！'); return; }
            spawn();
          }
          return;
        }
        if (!cur) return;

        const dir = (Input.isDown('ArrowRight') ? 1 : 0) - (Input.isDown('ArrowLeft') ? 1 : 0);
        if (Input.pressed('ArrowLeft') || Input.pressed('ArrowRight')) {
          const d = Input.pressed('ArrowLeft') ? -1 : 1;
          if (tryMove(d, 0)) { Sfx.play('move'); lockT = 0; }
          dasDir = d; dasT = 0;
        } else if (dir && dir === dasDir) {
          dasT += dt;
          while (dasT > DAS) {
            if (tryMove(dir, 0)) { Sfx.play('move'); lockT = 0; }
            dasT -= ARR;
          }
        } else { dasDir = dir; dasT = 0; }

        if (Input.pressed('ArrowUp', 'KeyX')) rotate();
        if (Input.pressed('Space')) { cur.y = ghostY(); lock(); return; }

        const interval = Input.isDown('ArrowDown') ? SOFT : DROP / speedNow();
        dropT += dt;
        while (dropT >= interval) {
          dropT -= interval;
          if (!tryMove(0, 1)) { dropT = 0; break; }
        }
        if (!fits(cur.m, cur.x, cur.y + 1)) {
          lockT += dt;
          if (lockT >= LOCK) lock();
        } else lockT = 0;
      } else if (state === 'clear') {
        if (st > 4.2) api.end(RESULTS.clear({ time: time.toFixed(1), pieces, bars }));
      } else if (state === 'timeout') {
        if (st > 3.4) api.end(RESULTS.timeout({ lines, wait: waitTime.toFixed(1), pieces, bars }));
      } else if (state === 'topout') {
        if (st > 3.4) api.end(RESULTS.topout({ lines, pieces, bars, time: time.toFixed(1) }));
      }
    }

    function drawCell(c, x, y, color, s = CELL) {
      c.fillStyle = color;
      c.fillRect(x, y, s, s);
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fillRect(x, y, s, 3);
      c.fillRect(x, y, 3, s);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(x, y + s - 3, s, 3);
      c.fillRect(x + s - 3, y, 3, s);
      c.strokeStyle = '#000';
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    }

    function draw(c) {
      clearCanvas(c, '#1d1d2b');
      // 背景の模様
      c.fillStyle = '#25253a';
      for (let y = 0; y < H; y += 30) for (let x = (y / 30) % 2 * 30; x < W; x += 60) c.fillRect(x, y, 30, 30);

      // フィールド
      c.fillStyle = '#000';
      c.fillRect(FX - 6, FY - 6, COLS * CELL + 12, ROWS * CELL + 12);
      c.strokeStyle = '#bbb';
      c.lineWidth = 3;
      c.strokeRect(FX - 6, FY - 6, COLS * CELL + 12, ROWS * CELL + 12);
      c.strokeStyle = '#151515';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 1; x < COLS; x++) { c.moveTo(FX + x * CELL + 0.5, FY); c.lineTo(FX + x * CELL + 0.5, FY + ROWS * CELL); }
      for (let y = 1; y < ROWS; y++) { c.moveTo(FX, FY + y * CELL + 0.5); c.lineTo(FX + COLS * CELL, FY + y * CELL + 0.5); }
      c.stroke();

      const grayRows = state === 'topout' ? Math.min(ROWS, Math.floor(st * 18)) : 0;
      for (let y = 0; y < ROWS; y++) {
        const flash = clearing && clearing.includes(y);
        for (let x = 0; x < COLS; x++) {
          const v = grid[y][x];
          const px = FX + x * CELL, py = FY + y * CELL;
          if (flash) {
            c.fillStyle = Math.floor(clearT * 20) % 2 ? '#fff' : '#888';
            c.fillRect(px, py, CELL, CELL);
          } else if (v !== null) drawCell(c, px, py, grayRows && y >= ROWS - grayRows ? '#777' : PIECES[v].color);
        }
      }
      if (cur && state === 'play') {
        const gy = ghostY();
        c.strokeStyle = PIECES[cur.id].color;
        c.globalAlpha = 0.5;
        c.lineWidth = 2;
        for (const [x, y] of cellsOf(cur.m)) if (gy + y >= 0) c.strokeRect(FX + (cur.x + x) * CELL + 2, FY + (gy + y) * CELL + 2, CELL - 4, CELL - 4);
        c.globalAlpha = 1;
        for (const [x, y] of cellsOf(cur.m)) if (cur.y + y >= 0) drawCell(c, FX + (cur.x + x) * CELL, FY + (cur.y + y) * CELL, PIECES[cur.id].color);
      }

      // 左右のパネル
      const panel = (x, y, w, h) => {
        c.fillStyle = '#000';
        c.fillRect(x, y, w, h);
        c.strokeStyle = '#bbb';
        c.lineWidth = 2;
        c.strokeRect(x, y, w, h);
      };
      c.textBaseline = 'top';
      c.textAlign = 'left';
      const LX = 120;
      panel(LX, 40, 200, 110);
      c.fillStyle = '#fff';
      c.font = `bold 14px ${FONT}`;
      c.fillText('ライン', LX + 16, 54);
      c.font = `bold 36px ${FONT}`;
      c.fillText(`${lines} / ${TARGET}`, LX + 16, 82);
      panel(LX, 166, 200, 110);
      c.fillStyle = '#fff';
      c.font = `bold 14px ${FONT}`;
      c.fillText('のこり時間', LX + 16, 180);
      const rest = Math.max(0, LIMIT - time);
      c.font = `bold 36px ${FONT}`;
      c.fillText(rest.toFixed(1), LX + 16, 208);
      if (!Pad.touch) { // スマホでは操作ボタンと重なるので出さない
        panel(LX, 292, 200, 150);
        c.font = `13px ${FONT}`;
        c.fillStyle = '#ccc';
        ['← →　移動', '↑　回転', '↓　加速', 'Space　すぐ落とす'].forEach((s, i) => c.fillText(s, LX + 16, 308 + i * 30));
      }

      const RX = FX + COLS * CELL + 46;
      panel(RX, 40, 150, 120);
      c.fillStyle = '#fff';
      c.font = `bold 14px ${FONT}`;
      c.fillText('ネクスト', RX + 14, 52);
      if (next != null) {
        const cells = cellsOf(PIECES[next].m);
        const minx = Math.min(...cells.map(q => q[0])), maxx = Math.max(...cells.map(q => q[0]));
        const miny = Math.min(...cells.map(q => q[1])), maxy = Math.max(...cells.map(q => q[1]));
        const s = 22, w = (maxx - minx + 1) * s, h = (maxy - miny + 1) * s;
        for (const [x, y] of cells) drawCell(c, RX + 75 - w / 2 + (x - minx) * s, 112 - h / 2 + (y - miny) * s, PIECES[next].color, s);
      }
      panel(RX, 176, 150, 80);
      c.fillStyle = '#fff';
      c.font = `bold 14px ${FONT}`;
      c.fillText('スピード', RX + 14, 188);
      c.font = `bold 28px ${FONT}`;
      c.fillText(`×${speedNow().toFixed(1)}`, RX + 14, 212);

      c.fillStyle = '#bbb';
      c.font = `bold 14px ${FONT}`;
      c.textAlign = 'left';
      if (!Pad.touch) c.fillText(STAGE_INFO[3].name, 20, H - 30);

    }

    return { update, draw, _debug: { grid, get lines() { return lines; }, get cur() { return cur; }, cellsOf } };
  }

  return {
    create,
    debugResult(ok) { return ok ? RESULTS.clear({ time: '52.3', pieces: 31, bars: 2 }) : RESULTS.topout({ lines: 2, pieces: 31, bars: 1, time: '34.2' }); }
  };
})();
