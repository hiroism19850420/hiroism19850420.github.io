// プレイヤー。x, y は足元の当たり判定の中心。
(function () {
  const C = NH.CONFIG;
  const P = C.PLAYER;
  const T = C.TILE;
  const RAD = Math.PI / 180;
  const WALK_SEQ = [1, 0, 2, 0];

  NH.Player = {
    x: 0, y: 0,
    dir: { x: 0, y: 1 },   // 向いている方向（長さ1）
    face: 'down',          // スプライトの向き（4方向）
    moving: false,
    crawling: false,
    animT: 0,
    stepT: 0,              // 次の足音までの時間
    knockT: 0,             // 壁叩きの待ち時間
    action: null,          // いまアクションキーでできること { type: 'ko' | 'knock', ... }

    init(map) {
      this.x = map.start.x;
      this.y = map.start.y;
      this.dir = { x: 0, y: 1 };
      this.face = 'down';
      this.moving = false;
      this.crawling = false;
      this.animT = 0;
      this.stepT = 0;
      this.knockT = 0;
      this.action = null;
    },

    hitbox() {
      return { x: this.x - P.HIT_W / 2, y: this.y - P.HIT_H / 2, w: P.HIT_W, h: P.HIT_H };
    },

    free(x, y) {
      return !NH.Map.rectSolid(x - P.HIT_W / 2, y - P.HIT_H / 2, P.HIT_W, P.HIT_H, this.crawling);
    },

    // 低い通気口の中にいるか
    inDuct() {
      return NH.Map.rectLow(this.x - P.HIT_W / 2, this.y - P.HIT_H / 2, P.HIT_W, P.HIT_H);
    },

    // 1軸ずつ動かす。ぶつかったら壁にぴったり寄せて true を返す
    moveX(dx) {
      if (!dx) return false;
      const hw = P.HIT_W / 2;
      const nx = this.x + dx;
      if (this.free(nx, this.y)) { this.x = nx; return false; }
      if (dx > 0) this.x = Math.floor((nx + hw) / T) * T - hw - 0.01;
      else this.x = (Math.floor((nx - hw) / T) + 1) * T + hw + 0.01;
      return true;
    },
    moveY(dy) {
      if (!dy) return false;
      const hh = P.HIT_H / 2;
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

    // アクションキーでいまできることを探す。気絶が壁叩きより優先
    findAction() {
      if (!this.crawling) {
        let best = null, bestD = P.KO_RANGE;
        for (const e of NH.Game.enemies) {
          if (e.state !== 'patrol' && e.state !== 'suspicious' && e.state !== 'search') continue;
          const d = Math.hypot(this.x - e.x, this.y - e.y);
          if (d >= bestD) continue;
          const toMe = Math.atan2(this.y - e.y, this.x - e.x);
          if (Math.abs(NH.AI.angleDiff(toMe, e.angle)) < P.KO_BEHIND * RAD) continue;
          if (!NH.AI.lineOfSight(this.x, this.y, e.x, e.y)) continue;
          best = e;
          bestD = d;
        }
        if (best) return { type: 'ko', enemy: best };
      }
      // 壁や障害物のすぐそば（通気口は叩けない）
      const m = 5;
      if (!this.inDuct() && NH.Map.rectSolid(this.x - P.HIT_W / 2 - m, this.y - P.HIT_H / 2 - m,
        P.HIT_W + m * 2, P.HIT_H + m * 2, true)) return { type: 'knock' };
      return null;
    },

    update(dt) {
      const Input = NH.Input;

      // 匍匐の切り替え（通気口の中では立てない）
      if (Input.pressed('crawl')) {
        if (!this.crawling) this.crawling = true;
        else if (!this.inDuct()) this.crawling = false;
      }

      const mv = Input.getMove();
      this.moving = mv.x !== 0 || mv.y !== 0;
      if (this.moving) {
        this.dir = mv;
        this.updateFace(mv);
        const step = (this.crawling ? P.CRAWL_SPEED : P.SPEED) * dt;
        const hitX = this.moveX(mv.x * step);
        const hitY = this.moveY(mv.y * step);
        if (hitX && mv.y === 0) this.nudge('y', Math.sign(mv.x), step);
        if (hitY && mv.x === 0) this.nudge('x', Math.sign(mv.y), step);
        this.animT += dt;
      } else {
        this.animT = 0;
      }

      // 足音：金属床や水たまりを立って移動すると鳴る。匍匐なら鳴らない
      const noisy = this.moving && !this.crawling ? NH.Map.noisyAt(this.x, this.y) : null;
      if (noisy) {
        this.stepT -= dt;
        if (this.stepT <= 0) {
          this.stepT = P.STEP_INTERVAL;
          NH.Game.noise(this.x, this.y, P.STEP_RADIUS, noisy === 'water' ? 'stepWater' : 'stepMetal');
        }
      } else {
        this.stepT = 0;
      }

      // アクション
      this.knockT = Math.max(0, this.knockT - dt);
      this.action = this.findAction();
      if (Input.pressed('action') && this.action) {
        if (this.action.type === 'ko') {
          this.action.enemy.stun();
        } else if (this.knockT <= 0) {
          this.knockT = P.KNOCK_COOLDOWN;
          NH.Game.noise(this.x, this.y, P.KNOCK_RADIUS, 'knock');
        }
      }
    },

    draw(ctx, snap) {
      const S = NH.Sprites.SCALE;
      const x = snap(this.x), y = snap(this.y);

      if (this.crawling) {
        const frame = this.moving ? Math.floor(this.animT * P.CRAWL_ANIM_FPS) % 2 : 0;
        const img = NH.Sprites.playerProne[this.face][frame];
        const w = img.width * S, h = img.height * S;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - w / 2 + 2, y - h / 2 + 3, w - 4, h - 2);
        ctx.drawImage(img, x - w / 2, y - h / 2 - 2, w, h);
        return;
      }

      const frame = this.moving ? WALK_SEQ[Math.floor(this.animT * P.ANIM_FPS) % WALK_SEQ.length] : 0;
      const img = NH.Sprites.player[this.face][frame];
      const w = img.width * S, h = img.height * S;
      const feet = y + P.HIT_H / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(x, feet - 1, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(img, x - w / 2, feet - h, w, h);
    }
  };
})();
