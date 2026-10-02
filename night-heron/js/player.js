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
    canDuct: false,        // いま通気口を通れるか
    action: null,          // いまアクションキーでできること { type: 'door' | 'ko' | 'knock', ... }

    life: 0,
    hurtT: 0,              // 被弾後の無敵時間
    keyLevel: 0,           // 持っているカードキーのレベル
    hasBox: false,
    boxed: false,          // 段ボール箱をかぶっているか
    hasGun: false,
    ammo: 0,
    fireT: 0,
    lockedT: 0,            // 「カードキーが必要」を出したあとの待ち時間

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
      this.life = P.MAX_LIFE;
      this.hurtT = 0;
      this.keyLevel = 0;
      this.hasBox = false;
      this.boxed = false;
      this.hasGun = false;
      this.ammo = 0;
      this.fireT = 0;
      this.lockedT = 0;
    },

    hitbox() {
      return { x: this.x - P.HIT_W / 2, y: this.y - P.HIT_H / 2, w: P.HIT_W, h: P.HIT_H };
    },

    free(x, y) {
      return !NH.Map.rectSolid(x - P.HIT_W / 2, y - P.HIT_H / 2, P.HIT_W, P.HIT_H, this.canDuct);
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

    // アクションキーでいまできることを探す。扉、気絶、壁叩きの順に優先
    findAction() {
      if (this.boxed) return null;
      const door = NH.Map.doorNear(this.x, this.y);
      if (door && !this.crawling) return { type: 'door', door, ok: this.keyLevel >= door.level };
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

    hurt(damage) {
      if (this.hurtT > 0 || this.life <= 0) return;
      this.life = Math.max(0, this.life - damage);
      this.hurtT = P.HURT_INVULN;
      NH.Audio.play('hurt');
    },

    update(dt) {
      const Input = NH.Input;
      const G = NH.Game;
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.knockT = Math.max(0, this.knockT - dt);
      this.fireT = Math.max(0, this.fireT - dt);
      this.lockedT = Math.max(0, this.lockedT - dt);

      // 匍匐の切り替え（通気口の中では立てない。箱をかぶっている間はできない）
      if (Input.pressed('crawl') && !this.boxed) {
        if (!this.crawling) this.crawling = true;
        else if (!this.inDuct()) this.crawling = false;
      }

      // 段ボール箱をかぶる・脱ぐ
      if (Input.pressed('item') && this.hasBox) {
        if (this.boxed) {
          this.boxed = false;
          NH.Audio.play('box');
        } else if (!this.crawling || !this.inDuct()) {
          this.crawling = false;
          this.boxed = true;
          NH.Audio.play('box');
        }
      }

      // 通気口を通れるのは匍匐中だけ。シャッターが閉まっている間は、すでに中にいる場合だけ動ける
      this.canDuct = this.crawling && (!NH.Alert.ductLocked() || this.inDuct());

      const mv = Input.getMove();
      this.moving = mv.x !== 0 || mv.y !== 0;
      if (this.moving) {
        this.dir = mv;
        this.updateFace(mv);
        const speed = this.boxed ? P.BOX_SPEED : this.crawling ? P.CRAWL_SPEED : P.SPEED;
        const step = speed * dt;
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
          G.noise(this.x, this.y, P.STEP_RADIUS, noisy === 'water' ? 'stepWater' : 'stepMetal');
        }
      } else {
        this.stepT = 0;
      }

      // アクション
      this.action = this.findAction();
      if (Input.pressed('action') && this.action) {
        const a = this.action;
        if (a.type === 'door') {
          if (a.ok) {
            NH.Map.openDoor(a.door);
          } else if (this.lockedT <= 0) {
            this.lockedT = 1;
            NH.Audio.play('locked');
            G.toast('カードキー Lv' + a.door.level + ' が必要だ');
          }
        } else if (a.type === 'ko') {
          a.enemy.stun();
          G.stats.kos++;
        } else if (this.knockT <= 0) {
          this.knockT = P.KNOCK_COOLDOWN;
          G.noise(this.x, this.y, P.KNOCK_RADIUS, 'knock');
        }
      }

      // 麻酔銃
      if (Input.pressed('weapon') && this.hasGun && !this.boxed && this.fireT <= 0) {
        if (this.ammo > 0) {
          this.ammo--;
          this.fireT = P.FIRE_COOLDOWN;
          G.fire('player', this.x, this.y, Math.atan2(this.dir.y, this.dir.x));
        } else {
          this.fireT = P.FIRE_COOLDOWN;
          NH.Audio.play('empty');
          G.toast('麻酔弾がない');
        }
      }
    },

    draw(ctx, snap) {
      // 被弾直後は点滅させる
      if (this.hurtT > 0 && Math.floor(this.hurtT * 30) % 2) return;
      const S = NH.Sprites.SCALE;
      const x = snap(this.x), y = snap(this.y);

      if (this.boxed) {
        const img = NH.Sprites.boxWorn;
        const w = img.width * S, h = img.height * S;
        const feet = y + P.HIT_H / 2;
        const step = this.moving ? Math.floor(this.animT * 10) % 2 : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x - w / 2 + 1, feet - 4, w - 2, 5);
        if (this.moving) {
          // 箱の下から足がのぞく
          ctx.fillStyle = '#0a0d11';
          ctx.fillRect(x - 7 + step * 2, feet - 3, 5, 3);
          ctx.fillRect(x + 2 - step * 2, feet - 3, 5, 3);
        }
        ctx.drawImage(img, x - w / 2, feet - h - 2 - (this.moving ? step : 0), w, h);
        return;
      }

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
