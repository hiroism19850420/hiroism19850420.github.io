// 視線の判定（レイキャスト）。フェーズ3で経路探索もここに足す。
(function () {
  const C = NH.CONFIG;
  const T = C.TILE;

  function angleDiff(a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  NH.AI = {
    angleDiff,

    // (x, y) から ang の向きへ進み、視線を遮るタイルに当たるまでの距離を返す。最大 maxDist
    castRay(x, y, ang, maxDist) {
      const map = NH.Map;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let tx = Math.floor(x / T), ty = Math.floor(y / T);
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
      const stepX = dx !== 0 ? Math.abs(T / dx) : Infinity;
      const stepY = dy !== 0 ? Math.abs(T / dy) : Infinity;
      let nextX = dx !== 0 ? (dx > 0 ? (tx + 1) * T - x : x - tx * T) / Math.abs(dx) : Infinity;
      let nextY = dy !== 0 ? (dy > 0 ? (ty + 1) * T - y : y - ty * T) / Math.abs(dy) : Infinity;
      for (;;) {
        let d;
        if (nextX < nextY) { d = nextX; nextX += stepX; tx += sx; }
        else { d = nextY; nextY += stepY; ty += sy; }
        if (d >= maxDist) return maxDist;
        if (map.isOpaque(tx, ty)) return d;
      }
    },

    // 2点の間に視線を遮るものがないか
    lineOfSight(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0);
      if (d < 0.001) return true;
      return this.castRay(x0, y0, Math.atan2(y1 - y0, x1 - x0), d) >= d;
    },

    // 扇形の視界に点 (px, py) が入っているか。range は px、fov はラジアン
    inCone(ex, ey, eang, px, py, range, fov) {
      const d = Math.hypot(px - ex, py - ey);
      if (d > range) return false;
      if (d > 1 && Math.abs(angleDiff(Math.atan2(py - ey, px - ex), eang)) > fov / 2) return false;
      return this.lineOfSight(ex, ey, px, py);
    },

    // 壁で切り取った視界の扇を、頂点の並びで返す（描画用）
    visionPolygon(x, y, ang, range, fov, rays, out) {
      out.length = 0;
      for (let i = 0; i <= rays; i++) {
        const a = ang - fov / 2 + fov * i / rays;
        const d = this.castRay(x, y, a, range);
        out.push(x + Math.cos(a) * d, y + Math.sin(a) * d, d);
      }
      return out;
    }
  };
})();
