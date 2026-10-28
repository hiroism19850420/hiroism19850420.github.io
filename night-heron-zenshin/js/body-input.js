// ぜんしん版：うでで 行きたい方向を さし、その場で 足ぶみすると 進む。
// しゃがむ＝ほふく、手をたたく＝アクション、ジャンプ＝撃つ、りょう手を頭の上＝箱。
// ふたりで：ふたりで ひとりの スパイを うごかす。1P（画面の左の人）が 足（方向と 足ぶみ）、2P（右の人）が 手（アクション・ほふく・撃つ・箱）。
(function () {
  const Input = NH.Input;
  // 長さは肩はば＝1
  const POINT_R = 1.3;      // 手が 胸から これより外に出たら「さしている」
  const HANG_X = 0.9;       // 手が 体の線から これより内がわで 下がっているのは「ただ おろしている」だけ
  const WALK_KEEP = 0.7;    // 足ぶみが これ（秒）とぎれたら 止まる
  const POINT_HOLD = 0.25;  // 同じ方向を これ（秒）さしつづけたら 向きを変える（うでを おろす とちゅうの向きを ひろわない）
  const cam = () => Body.mode === 'cam';
  const tap = (a) => { Input.virtualPress(a); setTimeout(() => Input.virtualRelease(a), 120); };
  NH.twoP = false;
  Body.people = 2;          // 2人まで 読む（ひとりのときは 大きくうつる人が 主役）
  let picking = false;      // 人数を えらんでいる間

  // B：Body（ひとり）か Body.players[i]（ふたりで）。role：move＝足、act＝手。on()：この人の 入力を いま使うか
  function makeCtl(B, role, on) {
    const ctl = { B, dir: { x: 0, y: 1 }, lastStep: -9 };
    let handsUp = false, cand = '', candAt = 0;
    function point(x, y) {
      const k = x + ',' + y;
      if (k !== cand) { cand = k; candAt = B.now; }
      if (B.now - candAt >= POINT_HOLD) { ctl.dir.x = x; ctl.dir.y = y; }
    }
    B.on('pose', () => {
      if (!cam() || !on()) return;
      const h = B.hands;
      if (role.move) {
        // りょう手を そろえて 下に出す → 下へ
        if (B.both && B.gap < 0.7 && h[0].py > 0.8 && h[1].py > 0.8) point(0, 1);
        else {
          let best = null, br = POINT_R;
          h.forEach((hd, i) => {
            if (!hd.vis) return;
            const x = hd.px + (i ? 0.5 : -0.5), y = hd.py, r = Math.hypot(x, y);
            if (y > 0 && Math.abs(x) < HANG_X) return;
            if (r > br) { br = r; best = { x, y }; }
          });
          if (best) {
            const a = Math.round(Math.atan2(best.y, best.x) / (Math.PI / 4)) * (Math.PI / 4);
            point(Math.abs(Math.cos(a)) < 1e-6 ? 0 : Math.cos(a), Math.abs(Math.sin(a)) < 1e-6 ? 0 : Math.sin(a));
          } else cand = '';
        }
      }
      if (role.act) {
        if (B.crouch) Input.virtualPress('crawl'); else Input.virtualRelease('crawl');
        const up = B.both && h[0].py < -1.0 && h[1].py < -1.0;
        if (up && !handsUp) tap('item');
        handsUp = up;
      }
    });
    B.on('step', () => { ctl.lastStep = B.now; });
    B.on('clap', () => {
      if (!cam() || !on() || picking) return;
      if (role.act) tap('action');
      window.dispatchEvent(new Event('pointerdown'));   // 無線を すすめる・やりなおす（足の人も できる）
    });
    B.on('jump', () => { if (cam() && on() && role.act && !picking) tap('weapon'); });
    ctl.walking = () => B.ok && B.now - ctl.lastStep < WALK_KEEP;
    return ctl;
  }
  const solo = makeCtl(Body, { move: true, act: true }, () => !NH.twoP);
  const feet = makeCtl(Body.players[0], { move: true }, () => NH.twoP);   // 1P：足
  makeCtl(Body.players[1], { act: true }, () => NH.twoP);                 // 2P：手
  const mover = () => (NH.twoP ? feet : solo);

  const getMove0 = Input.getMove;
  Input.getMove = function () {
    const m = mover();
    if (cam() && m.walking()) return { x: m.dir.x, y: m.dir.y };
    return getMove0.call(Input);
  };
  NH.BodyDir = solo.dir;

  // 行きたい方向の矢印を 鏡の下に出す
  const arrow = document.createElement('div');
  arrow.style.cssText = 'position:fixed;top:6px;left:6px;z-index:9000;font:bold 34px sans-serif;color:#ffd54a;text-shadow:0 0 6px #000;pointer-events:none;display:none';
  document.body.appendChild(arrow);
  // ふたりで のときの しるし
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:6px;z-index:9000;font:bold 14px sans-serif;color:#fff;background:#0009;border-radius:10px;padding:3px 10px;pointer-events:none;display:none;white-space:nowrap';
  badge.innerHTML = '<span style="color:#2cb">1P 足</span> ＋ <span style="color:#f6c">2P 手</span>';
  document.body.appendChild(badge);
  setInterval(() => {
    badge.style.display = NH.twoP && !picking ? 'block' : 'none';
    if (!cam()) return;
    const m = mover();
    arrow.style.display = 'block';
    arrow.style.color = NH.twoP ? '#2cb' : '#ffd54a';
    arrow.textContent = '➤';
    arrow.style.transform = 'rotate(' + Math.atan2(m.dir.y, m.dir.x) + 'rad)';
    arrow.style.opacity = m.walking() ? 1 : 0.45;
  }, 80);

  // ---------- あそぶ人数を えらぶ ----------
  let seen2At = -9, pickEl = null;
  const people = () => (performance.now() / 1000 - seen2At < 1 ? 2 : 1);
  Body.on('poses', () => { if (Body.count >= 2) seen2At = performance.now() / 1000; });
  function choose(n) {
    if (!picking) return;
    picking = false;
    NH.twoP = n === 2;
    pickEl.remove();
    Input.endFrame();
    NH.Game.paused = false;
  }
  function showPicker(mode) {
    picking = true;
    NH.Game.paused = true;
    const btn = 'display:block;width:100%;margin:10px 0 0;padding:14px;border:0;border-radius:14px;font:bold 22px inherit;color:#fff;cursor:pointer';
    pickEl = document.createElement('div');
    pickEl.style.cssText = 'position:fixed;inset:0;z-index:9400;background:#102040ee;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;overflow:auto';
    pickEl.innerHTML = `<div style="max-width:440px;width:88%;text-align:center;padding:12px 0">
      <h2 style="margin:0 0 6px;font-size:24px">あそぶ人数</h2>
      <button id="nhOne" style="${btn};background:#2a9">ひとりで <small style="font-size:13px">（キー 1）</small></button>
      <button id="nhTwo" style="${btn};background:#c4c">ふたりで <small style="font-size:13px">（キー 2）</small></button>
      <div style="text-align:left;background:#fff2;border-radius:12px;padding:8px 12px;margin-top:12px;font-size:15px;line-height:1.7">
        ふたりで：ふたりで ひとりの スパイを うごかす<br>
        <b style="color:#2cb">1P（左の人）＝足</b> … ${mode === 'cam' ? 'うでで 方向を さして 足ぶみ' : 'W A S D で 移動（タッチは 左の スティック）'}<br>
        <b style="color:#f6c">2P（右の人）＝手</b> … ${mode === 'cam' ? '手をたたく＝アクション、しゃがむ＝ほふく、ジャンプ＝撃つ、りょう手を上＝箱' : 'J アクション、K 撃つ、L 箱、I ほふく（タッチは 右の ボタン）'}</div>
      <div id="nhHint" style="min-height:1.6em;margin-top:10px;font-size:17px;font-weight:bold"></div></div>`;
    document.body.appendChild(pickEl);
    pickEl.querySelector('#nhOne').onclick = () => choose(1);
    pickEl.querySelector('#nhTwo').onclick = () => choose(2);
    const hint = pickEl.querySelector('#nhHint');
    const tick = setInterval(() => {
      if (!picking) { clearInterval(tick); return; }
      if (!cam()) { hint.textContent = ''; return; }
      const two = people() >= 2;
      hint.style.color = two ? '#f6c' : '#fff';
      hint.textContent = two ? '👏 手をたたくと ふたりで スタート' : '👏 手をたたいて スタート（2人 うつれば ふたりで）';
    }, 150);
  }
  const clapPick = () => { if (picking && cam()) choose(people()); };
  Body.on('clap', clapPick);
  Body.players.forEach((P) => P.on('clap', clapPick));
  window.addEventListener('keydown', (e) => {
    if (!picking) return;
    if (e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'Enter') choose(1);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') choose(2);
  });
  NH.pickPlayers = showPicker;
  NH.people = people;

  Body.gate({ title: 'NIGHT HERON', corner: 'tr', needFull: true, onStart: showPicker, lines: [
    '👉 <b>うでを のばして</b> 行きたい方向を さす（8方向）',
    '⬇ 下へ行くときは りょう手を そろえて 下に',
    '🚶 その場で <b>足ぶみ</b> … さした方向へ 進む（止まると 止まる）',
    '🧎 <b>しゃがむ</b> … ほふく',
    '👏 <b>手を たたく</b> … アクション（とびら・カードなど）',
    '🦘 ジャンプ … 撃つ ／ 🙌 りょう手を 頭の上 … 箱',
    '👥 <b>2人</b> うつると ふたりで（左の人が 1P＝足、右の人が 2P＝手）'
  ] });
})();
