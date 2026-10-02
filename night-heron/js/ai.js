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

  // ---------- A* 経路探索用の作業領域 ----------
  let gCost = null, parent = null, closed = null;
  const heapI = [], heapF = [];
  let heapN = 0;

  function heapPush(i, f) {
    let n = heapN++;
    heapI[n] = i; heapF[n] = f;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (heapF[p] <= heapF[n]) break;
      const ti = heapI[p], tf = heapF[p];
      heapI[p] = heapI[n]; heapF[p] = heapF[n];
      heapI[n] = ti; heapF[n] = tf;
      n = p;
    }
  }
  function heapPop() {
    const top = heapI[0];
    heapN--;
    if (heapN > 0) {
      heapI[0] = heapI[heapN]; heapF[0] = heapF[heapN];
      let n = 0;
      for (;;) {
        const l = n * 2 + 1, r = l + 1;
        let m = n;
        if (l < heapN && heapF[l] < heapF[m]) m = l;
        if (r < heapN && heapF[r] < heapF[m]) m = r;
        if (m === n) break;
        const ti = heapI[m], tf = heapF[m];
        heapI[m] = heapI[n]; heapF[m] = heapF[n];
        heapI[n] = ti; heapF[n] = tf;
        n = m;
      }
    }
    return top;
  }

  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

  NH.AI = {
    angleDiff,

    // A*：ワールド座標の2点を結ぶ経路を、通過点（タイル中心）の並びで返す。行けなければ null
    findPath(sx, sy, tx, ty) {
      const map = NH.Map, W = map.w, H = map.h;
      const stx = Math.floor(sx / T), sty = Math.floor(sy / T);
      const gx = Math.floor(tx / T), gy = Math.floor(ty / T);
      if (map.isSolid(gx, gy)) return null;
      const start = stx + sty * W, goal = gx + gy * W;
      if (start === goal) return [{ x: tx, y: ty }];

      if (!gCost || gCost.length !== W * H) {
        gCost = new Float32Array(W * H);
        parent = new Int32Array(W * H);
        closed = new Uint8Array(W * H);
      }
      gCost.fill(Infinity);
      parent.fill(-1);
      closed.fill(0);
      heapN = 0;

      gCost[start] = 0;
      heapPush(start, 0);
      let found = false;
      while (heapN > 0) {
        const cur = heapPop();
        if (cur === goal) { found = true; break; }
        if (closed[cur]) continue;
        closed[cur] = 1;
        const cx = cur % W, cy = (cur - cx) / W;
        for (const [dx, dy, cost] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (map.isSolid(nx, ny)) continue;
          // 斜めは、角をかすめないときだけ通す
          if (dx && dy && (map.isSolid(cx + dx, cy) || map.isSolid(cx, cy + dy))) continue;
          const ni = nx + ny * W;
          if (closed[ni]) continue;
          const g = gCost[cur] + cost;
          if (g >= gCost[ni]) continue;
          gCost[ni] = g;
          parent[ni] = cur;
          const ax = Math.abs(nx - gx), ay = Math.abs(ny - gy);
          heapPush(ni, g + Math.max(ax, ay) + (Math.SQRT2 - 1) * Math.min(ax, ay));
        }
      }
      if (!found) return null;

      const path = [];
      for (let i = goal; i !== start; i = parent[i]) {
        const x = i % W, y = (i - x) / W;
        path.push({ x: (x + 0.5) * T, y: (y + 0.5) * T });
      }
      path.reverse();
      path[path.length - 1] = { x: tx, y: ty };
      return path;
    },

    // 敵の体の大きさで、2点の間をまっすぐ歩けるか
    clearLine(x0, y0, x1, y1) {
      const map = NH.Map;
      const w = C.ENEMY.HIT_W, h = C.ENEMY.HIT_H;
      const d = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.ceil(d / 6);
      for (let i = 1; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        if (map.rectSolid(x - w / 2, y - h / 2, w, h)) return false;
      }
      return true;
    },

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
