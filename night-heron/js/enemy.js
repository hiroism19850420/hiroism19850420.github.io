// 敵兵。x, y は足元の中心。angle は向いている方向（ラジアン、右が0、下が+）。
(function () {
  const C = NH.CONFIG;
  const E = C.ENEMY;
  const T = C.TILE;
  const AI = NH.AI;
  const RAD = Math.PI / 180;
  const WALK_SEQ = [1, 0, 2, 0];

  function Enemy(def) {
    // 巡回地点はタイル座標で受け取り、タイルの中心に直す
    this.route = def.route.map((p) => ({ x: (p[0] + 0.5) * T, y: (p[1] + 0.5) * T }));
    this.x = this.route[0].x;
    this.y = this.route[0].y;
    this.wp = this.route.length > 1 ? 1 : 0;

    const n = this.route[this.wp];
    this.angle = this.route.length > 1
      ? Math.atan2(n.y - this.y, n.x - this.x)
      : (def.face || 90) * RAD;
    this.wantAngle = this.angle;
    this.baseAngle = this.angle;

    this.state = 'patrol';   // patrol（通常） / spotted（発見）
    this.phase = this.route.length > 1 ? 'walk' : 'look';
    this.timer = 0;
    this.lostT = 0;
    this.markT = 99;
    this.sees = false;

    this.moving = false;
    this.animT = 0;
    this.face = 'down';
    this.cone = [];          // 視界の扇の頂点 [x, y, 距離, ...]
    this.updateFace();
  }

  Enemy.prototype.update = function (dt, player) {
    const range = E.VIEW_DIST * T, fov = E.FOV * RAD;
    this.sees = AI.inCone(this.x, this.y, this.angle, player.x, player.y, range, fov);
    this.moving = false;

    if (this.sees) {
      if (this.state !== 'spotted') {
        this.state = 'spotted';
        this.markT = 0;
      }
      this.lostT = 0;
      this.wantAngle = Math.atan2(player.y - this.y, player.x - this.x);
    } else if (this.state === 'spotted') {
      this.lostT += dt;
      if (this.lostT >= E.LOSE_TIME) this.state = 'patrol';
    }
    if (this.state === 'patrol') this.patrol(dt);

    this.turn(dt);
    this.updateFace();
    this.markT += dt;
    this.animT = this.moving ? this.animT + dt : 0;
    AI.visionPolygon(this.x, this.y, this.angle, range, fov, E.CONE_RAYS, this.cone);
  };

  // 巡回：次の地点まで歩き、着いたら立ち止まって左右を見回す
  Enemy.prototype.patrol = function (dt) {
    const wp = this.route[this.wp];
    if (this.phase === 'walk') {
      const dx = wp.x - this.x, dy = wp.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = E.SPEED * dt;
      if (d <= step) {
        this.x = wp.x;
        this.y = wp.y;
        this.phase = 'look';
        this.timer = 0;
        this.baseAngle = this.wantAngle;
        return;
      }
      this.wantAngle = Math.atan2(dy, dx);
      // 進む方向へだいたい向き終えてから歩き出す
      if (Math.abs(AI.angleDiff(this.wantAngle, this.angle)) < 0.5) {
        this.x += dx / d * step;
        this.y += dy / d * step;
        this.moving = true;
      }
    } else {
      this.timer += dt;
      this.wantAngle = this.baseAngle +
        Math.sin(this.timer / E.WAIT_TIME * Math.PI * 2) * E.LOOK_SWING * RAD;
      if (this.timer >= E.WAIT_TIME && this.route.length > 1) {
        this.wp = (this.wp + 1) % this.route.length;
        this.phase = 'walk';
      }
    }
  };

  Enemy.prototype.turn = function (dt) {
    const d = AI.angleDiff(this.wantAngle, this.angle);
    const max = E.TURN_SPEED * RAD * dt;
    this.angle += Math.max(-max, Math.min(max, d));
  };

  Enemy.prototype.updateFace = function () {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    // 斜めのあたりでは今の向きを保ち、ちらつきを防ぐ
    if (Math.abs(c) > Math.abs(s) * 1.25) this.face = c > 0 ? 'right' : 'left';
    else if (Math.abs(s) > Math.abs(c) * 1.25) this.face = s > 0 ? 'down' : 'up';
  };

  Enemy.prototype.drawCone = function (ctx) {
    const p = this.cone;
    if (p.length < 6) return;
    const range = E.VIEW_DIST * T;
    const hot = this.state === 'spotted';
    const g = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, range);
    if (hot) {
      g.addColorStop(0, 'rgba(255,70,55,0.46)');
      g.addColorStop(1, 'rgba(255,70,55,0.12)');
    } else {
      g.addColorStop(0, 'rgba(120,235,195,0.34)');
      g.addColorStop(1, 'rgba(120,235,195,0.07)');
    }
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    for (let i = 0; i < p.length; i += 3) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(255,120,100,0.35)' : 'rgba(160,255,220,0.18)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  };

  Enemy.prototype.draw = function (ctx, snap) {
    const S = NH.Sprites.SCALE;
    const frame = this.moving ? WALK_SEQ[Math.floor(this.animT * E.ANIM_FPS) % WALK_SEQ.length] : 0;
    const img = NH.Sprites.enemy[this.face][frame];
    const w = img.width * S, h = img.height * S;
    const x = snap(this.x), feet = snap(this.y) + 6;

    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(x, feet - 1, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, x - w / 2, feet - h, w, h);
  };

  // 頭上の「！」
  Enemy.prototype.drawMark = function (ctx, snap) {
    if (this.state !== 'spotted') return;
    const S = NH.Sprites.SCALE;
    const img = NH.Sprites.markAlert;
    const pop = Math.sin(Math.min(1, this.markT / 0.22) * Math.PI) * 7;
    const x = snap(this.x), y = snap(this.y + 6 - 40 - 26 - pop);
    ctx.drawImage(img, x - img.width * S / 2, y, img.width * S, img.height * S);
  };

  NH.Enemy = Enemy;
})();
