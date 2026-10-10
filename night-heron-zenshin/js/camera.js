// プレイヤーを追うカメラ。x, y は画面左上のワールド座標。
(function () {
  const C = NH.CONFIG;

  function clampAxis(v, viewLen, mapLen) {
    if (viewLen >= mapLen) return (mapLen - viewLen) / 2; // マップの方が小さければ中央に置く
    return Math.max(0, Math.min(mapLen - viewLen, v));
  }

  NH.Camera = {
    x: 0, y: 0,

    target(player, view, map) {
      const la = C.CAMERA.LOOK_AHEAD;
      const lx = player.moving ? player.dir.x * la : 0;
      const ly = player.moving ? player.dir.y * la : 0;
      return {
        x: clampAxis(player.x + lx - view.w / 2, view.w, map.pxW),
        y: clampAxis(player.y - 10 + ly - view.h / 2, view.h, map.pxH)
      };
    },

    snap(player, view, map) {
      const t = this.target(player, view, map);
      this.x = t.x;
      this.y = t.y;
    },

    update(dt, player, view, map) {
      const t = this.target(player, view, map);
      const k = 1 - Math.exp(-C.CAMERA.FOLLOW * dt);
      this.x += (t.x - this.x) * k;
      this.y += (t.y - this.y) * k;
      this.x = clampAxis(this.x, view.w, map.pxW);
      this.y = clampAxis(this.y, view.h, map.pxH);
    }
  };
})();
