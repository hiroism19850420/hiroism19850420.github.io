// プレイヤー。x, y は足元の当たり判定の中心。
(function () {
  const C = NH.CONFIG;
  const P = C.PLAYER;
  const WALK_SEQ = [1, 0, 2, 0];

  NH.Player = {
    x: 0, y: 0,
    dir: { x: 0, y: 1 },   // 向いている方向（長さ1）
    face: 'down',          // スプライトの向き（4方向）
    moving: false,
    animT: 0,

    init(map) {
      this.x = map.start.x;
      this.y = map.start.y;
      this.dir = { x: 0, y: 1 };
      this.face = 'down';
      this.moving = false;
      this.animT = 0;
    },

    hitbox() {
      return { x: this.x - P.HIT_W / 2, y: this.y - P.HIT_H / 2, w: P.HIT_W, h: P.HIT_H };
    },

    free(x, y) {
      return !NH.Map.rectSolid(x - P.HIT_W / 2, y - P.HIT_H / 2, P.HIT_W, P.HIT_H);
    },

    // 1軸ずつ動かす。ぶつかったら壁にぴったり寄せて true を返す
    moveX(dx) {
      if (!dx) return false;
      const T = C.TILE, hw = P.HIT_W / 2;
      const nx = this.x + dx;
      if (this.free(nx, this.y)) { this.x = nx; return false; }
      if (dx > 0) this.x = Math.floor((nx + hw) / T) * T - hw - 0.01;
      else this.x = (Math.floor((nx - hw) / T) + 1) * T + hw + 0.01;
      return true;
    },
    moveY(dy) {
      if (!dy) return false;
      const T = C.TILE, hh = P.HIT_H / 2;
      const ny = this.y + dy;
      if (this.free(this.x, ny)) { this.y = ny; return false; }
      if (dy > 0) this.y = Math.floor((ny + hh) / T) * T - hh - 0.01;
      else this.y = (Math.floor((ny - hh) / T) + 1) * T + hh + 0.01;
      return true;
    },

    // 角に少しだけ引っかかっているとき、空いている側へ滑らせる
    nudge(axis, sign, step) {
      for (let d = 1; d <= P.CORNER_NUDGE; d++) {
        for (const s of [-1, 1]) {
          const ok = axis === 'y'
            ? this.free(this.x + sign, this.y + s * d)
            : this.free(this.x + s * d, this.y + sign);
          if (!ok) continue;
          const m = s * Math.min(step, d);
          if (axis === 'y') this.moveY(m); else this.moveX(m);
          return;
        }
      }
    },

    updateFace(mv) {
      // 斜め移動では、いまの向きが進行方向の成分ならそのまま保つ
      const h = mv.x > 0 ? 'right' : mv.x < 0 ? 'left' : null;
      const v = mv.y > 0 ? 'down' : mv.y < 0 ? 'up' : null;
      if (this.face === h || this.face === v) return;
      this.face = h || v;
    },

    update(dt) {
      const mv = NH.Input.getMove();
      this.moving = mv.x !== 0 || mv.y !== 0;
      if (!this.moving) { this.animT = 0; return; }

      this.dir = mv;
      this.updateFace(mv);
      const step = P.SPEED * dt;
      const hitX = this.moveX(mv.x * step);
      const hitY = this.moveY(mv.y * step);
      if (hitX && mv.y === 0) this.nudge('y', Math.sign(mv.x), step);
      if (hitY && mv.x === 0) this.nudge('x', Math.sign(mv.y), step);
      this.animT += dt;
    },

    draw(ctx, snap) {
      const S = NH.Sprites.SCALE;
      const frame = this.moving ? WALK_SEQ[Math.floor(this.animT * P.ANIM_FPS) % WALK_SEQ.length] : 0;
      const img = NH.Sprites.player[this.face][frame];
      const w = img.width * S, h = img.height * S;
      const x = snap(this.x), y = snap(this.y);
      const feet = y + P.HIT_H / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(x, feet - 1, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(img, x - w / 2, feet - h, w, h);
    }
  };
})();
