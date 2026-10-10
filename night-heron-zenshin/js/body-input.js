// ぜんしん版：うでで 行きたい方向を さし、その場で 足ぶみすると 進む。
// しゃがむ＝ほふく、手をたたく＝アクション、ジャンプ＝撃つ、りょう手を頭の上＝箱。
(function () {
  const Input = NH.Input;
  // 長さは肩はば＝1
  const POINT_R = 1.3;      // 手が 胸から これより外に出たら「さしている」
  const HANG_X = 0.9;       // 手が 体の線から これより内がわで 下がっているのは「ただ おろしている」だけ
  const WALK_KEEP = 0.7;    // 足ぶみが これ（秒）とぎれたら 止まる
  const POINT_HOLD = 0.25;  // 同じ方向を これ（秒）さしつづけたら 向きを変える（うでを おろす とちゅうの向きを ひろわない）
  const dir = { x: 0, y: 1 };
  let lastStep = -9, handsUp = false, cand = '', candAt = 0;
  function point(x, y) {
    const k = x + ',' + y;
    if (k !== cand) { cand = k; candAt = Body.now; }
    if (Body.now - candAt >= POINT_HOLD) { dir.x = x; dir.y = y; }
  }
  const cam = () => Body.mode === 'cam';
  const tap = (a) => { Input.virtualPress(a); setTimeout(() => Input.virtualRelease(a), 120); };

  Body.on('pose', () => {
    if (!cam()) return;
    const h = Body.hands;
    // りょう手を そろえて 下に出す → 下へ
    if (Body.both && Body.gap < 0.7 && h[0].py > 0.8 && h[1].py > 0.8) point(0, 1);
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
    if (Body.crouch) Input.virtualPress('crawl'); else Input.virtualRelease('crawl');
    const up = Body.both && h[0].py < -1.0 && h[1].py < -1.0;
    if (up && !handsUp) tap('item');
    handsUp = up;
  });
  Body.on('step', () => { lastStep = Body.now; });
  Body.on('clap', () => { if (cam()) { tap('action'); window.dispatchEvent(new Event('pointerdown')); } });
  Body.on('jump', () => { if (cam()) tap('weapon'); });

  const getMove0 = Input.getMove;
  Input.getMove = function () {
    if (cam() && Body.ok && Body.now - lastStep < WALK_KEEP) return { x: dir.x, y: dir.y };
    return getMove0.call(Input);
  };
  NH.BodyDir = dir;

  // 行きたい方向の矢印を 鏡の下に出す
  const arrow = document.createElement('div');
  arrow.style.cssText = 'position:fixed;top:6px;left:6px;z-index:9000;font:bold 34px sans-serif;color:#ffd54a;text-shadow:0 0 6px #000;pointer-events:none;display:none';
  document.body.appendChild(arrow);
  setInterval(() => {
    if (!cam()) return;
    arrow.style.display = 'block';
    const walking = Body.now - lastStep < WALK_KEEP;
    arrow.textContent = '➤';
    arrow.style.transform = 'rotate(' + Math.atan2(dir.y, dir.x) + 'rad)';
    arrow.style.opacity = walking ? 1 : 0.45;
  }, 80);

  Body.gate({ title: 'NIGHT HERON', corner: 'tr', needFull: true, lines: [
    '👉 <b>うでを のばして</b> 行きたい方向を さす（8方向）',
    '⬇ 下へ行くときは りょう手を そろえて 下に',
    '🚶 その場で <b>足ぶみ</b> … さした方向へ 進む（止まると 止まる）',
    '🧎 <b>しゃがむ</b> … ほふく',
    '👏 <b>手を たたく</b> … アクション（とびら・カードなど）',
    '🦘 ジャンプ … 撃つ ／ 🙌 りょう手を 頭の上 … 箱'
  ] });
})();
