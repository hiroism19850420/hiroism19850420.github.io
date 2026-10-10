// 監視カメラ。壁に付いて首を振り、プレイヤーが映り続けると警戒を呼ぶ。
// 気絶はさせられないが、麻酔弾を当てるとしばらく止まる。
(function () {
  const C = NH.CONFIG;
  const S = C.SENTRY;
  const T = C.TILE;
  const AI = NH.AI;
  const RAD = Math.PI / 180;

  function Sentry(def) {
    this.x = (def.x + 0.5) * T;
    this.y = def.y * T + 6;                 // タイルの上端（壁ぎわ）に付く
    this.base = def.face * RAD;             // 首振りの中心の向き
    this.swing = (def.swing || 50) * RAD;   // 左右に振る角度
    this.period = def.period || 5;          // 1往復の秒数
    this.t = Math.random() * this.period;
    this.angle = this.base;
    this.gauge = 0;
    this.sees = false;
    this.offT = 0;                          // 止まっている残り時間
    this.cone = [];
  }

  Sentry.prototype.disable = function () {
    this.offT = S.OFF_TIME;
    this.gauge = 0;
    this.sees = false;
    this.cone.length = 0;
  };

  Sentry.prototype.update = function (dt, player) {
    if (this.offT > 0) {
      this.offT -= dt;
      return;
    }
    // 映っている間は首を止めて見つめる
    if (!this.sees) this.t += dt;
    this.angle = this.base + Math.sin(this.t / this.period * Math.PI * 2) * this.swing;

    const range = S.VIEW_DIST * T * (player.crawling ? C.ENEMY.CRAWL_VIEW_MULT : 1);
    this.sees = AI.inCone(this.x, this.y, this.angle, player.x, player.y, range, S.FOV * RAD);
    if (this.sees && player.boxed && !player.moving) this.sees = false; // 止まった箱は映っても気づかれない

    if (this.sees) this.gauge = Math.min(1, this.gauge + dt / S.SIGHT_TIME);
    else this.gauge = Math.max(0, this.gauge - dt * C.ENEMY.GAUGE_DECAY);

    if (this.sees && this.gauge >= 1) {
      if (NH.Alert.phase !== 'alert') NH.Alert.trigger(null, player);
      else NH.Alert.report(player.x, player.y);
    }
    AI.visionPolygon(this.x, this.y, this.angle, S.VIEW_DIST * T, S.FOV * RAD, 24, this.cone);
  };

  Sentry.prototype.drawCone = function (ctx) {
    const p = this.cone;
    if (this.offT > 0 || p.length < 6) return;
    const k = this.gauge;
    const rgb = 'rgba(' + Math.round(110 + 145 * k) + ',' + Math.round(190 - 120 * k) + ',' + Math.round(255 - 200 * k) + ',';
    const grad = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, S.VIEW_DIST * T);
    grad.addColorStop(0, rgb + '0.36)');
    grad.addColorStop(1, rgb + '0.08)');
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    for (let i = 0; i < p.length; i += 3) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = rgb + '0.3)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  };

  Sentry.prototype.draw = function (ctx, time) {
    const x = Math.round(this.x), y = Math.round(this.y);
    // 取り付け金具と本体
    ctx.fillStyle = '#0c0f12';
    ctx.fillRect(x - 2, y - 8, 4, 4);
    ctx.fillRect(x - 7, y - 5, 14, 8);
    ctx.fillStyle = '#59646e';
    ctx.fillRect(x - 6, y - 4, 12, 6);
    ctx.fillStyle = '#8b97a2';
    ctx.fillRect(x - 6, y - 4, 12, 1);
    // レンズ：向いている方へ寄せる
    const lx = Math.round(Math.cos(this.angle) * 3);
    ctx.fillStyle = '#0c0f12';
    ctx.fillRect(x - 2 + lx, y - 2, 4, 4);
    if (this.offT > 0) {
      // 止まっている間は火花。復帰する直前はランプが点滅
      if (Math.floor(time * 12) % 3 === 0) {
        ctx.fillStyle = '#ffe680';
        ctx.fillRect(x - 5 + (Math.floor(time * 12) % 5) * 2, y - 7, 2, 2);
      }
      if (this.offT < 3 && Math.floor(time * 6) % 2) {
        ctx.fillStyle = '#ffb436';
        ctx.fillRect(x + 4, y - 3, 2, 2);
      }
      return;
    }
    ctx.fillStyle = this.gauge > 0 ? '#ff3b30' : '#46e684';
    ctx.fillRect(x + 4, y - 3, 2, 2);
    ctx.fillStyle = this.gauge > 0 ? '#ff8a7a' : '#7fd0ff';
    ctx.fillRect(x - 1 + lx, y - 1, 2, 2);
  };

  NH.Sentry = Sentry;
})();
