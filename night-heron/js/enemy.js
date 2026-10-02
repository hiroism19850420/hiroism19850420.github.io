// 敵兵。x, y は足元の中心。angle は向いている方向（ラジアン、右が0、下が+）。
//
// 状態： patrol（通常） → suspicious（疑念） → spotted（発見） → alert（警戒） → search（捜索） → patrol
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
    this.homeAngle = (def.face != null ? def.face : 90) * RAD;  // 立ち番が見張る向き
    this.angle = this.route.length > 1 ? Math.atan2(n.y - this.y, n.x - this.x) : this.homeAngle;
    this.wantAngle = this.angle;
    this.baseAngle = this.angle;

    this.state = 'patrol';
    this.phase = this.route.length > 1 ? 'walk' : 'look';
    this.timer = 0;

    this.sees = false;       // いまプレイヤーが見えているか
    this.gauge = 0;          // 気づきゲージ 0〜1
    this.lastSeen = null;
    this.investigate = null; // 疑念で見に行く地点
    this.searchPt = null;    // 捜索で向かう地点
    this.mark = null;        // 頭上の記号 '!' か '?'
    this.markT = 99;

    this.path = null;        // A* の経路
    this.pathI = 0;
    this.pathKey = -1;
    this.pathT = 0;

    this.moving = false;
    this.animT = 0;
    this.face = 'down';
    this.cone = [];          // 視界の扇の頂点 [x, y, 距離, ...]
    this.updateFace();
  }

  // ---------- 状態の切り替え ----------
  Enemy.prototype.suspect = function (x, y) {
    this.wakeTarget = null;
    if (this.state !== 'suspicious') {
      this.state = 'suspicious';
      this.phase = 'notice';
      this.timer = 0;
      this.mark = '?';
      this.markT = 0;
      this.path = null;
      const p = NH.Player;
      if (Math.hypot(p.x - this.x, p.y - this.y) < 420) NH.Audio.play('suspect');
    } else if (this.phase === 'look') {
      // 見回している最中に別の物音がしたら、そちらへ向かい直す
      this.phase = 'go';
      this.timer = 0;
      this.path = null;
    }
    this.investigate = { x, y };
  };

  // 背後から倒されて気絶する
  Enemy.prototype.stun = function () {
    this.state = 'stunned';
    this.discovered = false;
    this.wakeTarget = null;
    this.timer = E.STUN_TIME;
    this.gauge = 0;
    this.sees = false;
    this.moving = false;
    this.mark = null;
    this.path = null;
    this.cone.length = 0;
    NH.Audio.play('ko');
  };

  // 気絶から起き上がる。フロアが警戒・捜索中ならそれに加わり、そうでなければ疑念
  Enemy.prototype.wake = function () {
    this.state = 'patrol';
    this.discovered = false;
    const A = NH.Alert;
    const near = Math.hypot(this.x - A.lastKnown.x, this.y - A.lastKnown.y) <= C.ALERT.RESPOND_DIST * T;
    if (A.phase === 'alert' && near) this.enterSpotted(E.REACT_TIME);
    else if (A.phase === 'search' && near) this.enterSearch();
    else this.suspect(this.x, this.y);
  };

  // 視界に気絶した仲間がいれば、疑念を抱いて駆け寄る（着いたら起こす）
  Enemy.prototype.noticeBodies = function () {
    if (this.state !== 'patrol') return;
    const range = E.VIEW_DIST * T, fov = E.FOV * RAD;
    for (const o of NH.Game.enemies) {
      if (o.state !== 'stunned' || o.discovered) continue;
      if (!AI.inCone(this.x, this.y, this.angle, o.x, o.y, range, fov)) continue;
      o.discovered = true;
      this.suspect(o.x, o.y);
      this.wakeTarget = o;
      return;
    }
  };

  Enemy.prototype.enterSpotted = function (delay) {
    this.state = 'spotted';
    this.timer = delay;
    this.gauge = 1;
    this.mark = '!';
    this.markT = 0;
    this.path = null;
  };

  Enemy.prototype.enterSearch = function () {
    this.state = 'search';
    this.phase = 'go';
    this.timer = 0;
    this.gauge = 0;
    this.searchPt = null;
    this.path = null;
  };

  Enemy.prototype.toPatrol = function () {
    this.state = 'patrol';
    this.phase = 'walk';
    this.timer = 0;
    this.gauge = 0;
    this.path = null;
  };

  // ---------- 毎フレームの処理 ----------
  Enemy.prototype.update = function (dt, player) {
    if (this.state === 'stunned') {
      this.timer -= dt;
      this.markT += dt;
      if (this.timer <= 0) this.wake();
      return;
    }
    this.perceive(dt, player);
    this.noticeBodies();
    this.moving = false;

    switch (this.state) {
      case 'patrol': this.patrol(dt); break;
      case 'suspicious': this.suspicious(dt); break;
      case 'spotted': {
        // 「！」を出して一瞬固まり、それから走り出す
        const k = NH.Alert.lastKnown;
        this.wantAngle = Math.atan2(k.y - this.y, k.x - this.x);
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'alert';
          this.timer = 0;
        }
        break;
      }
      case 'alert': this.chase(dt, player); break;
      case 'search': this.search(dt); break;
    }

    this.turn(dt);
    this.updateFace();
    this.markT += dt;
    this.animT = this.moving ? this.animT + dt : 0;
    AI.visionPolygon(this.x, this.y, this.angle, E.VIEW_DIST * T, E.FOV * RAD, E.CONE_RAYS, this.cone);
  };

  // 視界の判定と、気づきゲージの増減
  Enemy.prototype.perceive = function (dt, player) {
    // 匍匐中のプレイヤーは、遠くからは見つけにくい
    const range = E.VIEW_DIST * T * (player.crawling ? E.CRAWL_VIEW_MULT : 1);
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const touch = dist < E.TOUCH_DIST;
    this.sees = touch || AI.inCone(this.x, this.y, this.angle, player.x, player.y, range, E.FOV * RAD);
    const hot = this.state === 'alert' || this.state === 'spotted';

    if (this.sees) {
      this.lastSeen = { x: player.x, y: player.y };
      if (hot || touch) {
        this.gauge = 1;
      } else {
        // 近いほど早く気づく。疑念・捜索中は目が鋭くなる
        const k = Math.min(1, dist / range);
        const time = E.SIGHT_TIME_NEAR + (E.SIGHT_TIME_FAR - E.SIGHT_TIME_NEAR) * k;
        const caution = NH.Alert.phase !== 'none' ? C.ALERT.CAUTION_SIGHT_MULT : 1;
        const mult = this.state === 'search' ? 4 : this.state === 'suspicious' ? 1.5 * caution : caution;
        this.gauge = Math.min(1, this.gauge + dt / time * mult);
      }
    } else if (!hot) {
      this.gauge = Math.max(0, this.gauge - dt * E.GAUGE_DECAY);
    }

    if (hot) {
      if (this.sees) NH.Alert.report(player.x, player.y);
    } else if (this.gauge >= 1) {
      NH.Alert.trigger(this, player);
    } else if (this.sees && this.gauge >= E.SUSPECT_AT && (this.state === 'patrol' || this.state === 'suspicious')) {
      this.suspect(player.x, player.y);
    }
  };

  // 通常：次の地点まで歩き、着いたら立ち止まって左右を見回す
  Enemy.prototype.patrol = function (dt) {
    if (this.phase === 'walk') {
      const wp = this.route[this.wp];
      // フロアが警戒・捜索中は、持ち場に残った敵も足を速める
      const speed = E.SPEED * (NH.Alert.phase !== 'none' ? C.ALERT.CAUTION_SPEED_MULT : 1);
      if (this.goTo(wp.x, wp.y, speed, dt) === true) {
        this.phase = 'look';
        this.timer = 0;
        this.baseAngle = this.route.length > 1 ? this.wantAngle : this.homeAngle;
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

  // 疑念：「？」を出して立ち止まり、気になった地点まで見に行って見回す
  Enemy.prototype.suspicious = function (dt) {
    const p = this.investigate;
    this.timer += dt;
    if (this.phase === 'notice') {
      this.wantAngle = Math.atan2(p.y - this.y, p.x - this.x);
      if (this.timer >= E.NOTICE_TIME) { this.phase = 'go'; this.timer = 0; }
    } else if (this.phase === 'go') {
      // 気絶した仲間のところへ行くときは、手前で止まる
      const w = this.wakeTarget;
      const reached = w && Math.hypot(w.x - this.x, w.y - this.y) < 22;
      if (reached || this.goTo(p.x, p.y, E.SUSPECT_SPEED, dt) !== false || this.timer > 10) {
        this.phase = 'look';
        this.timer = 0;
        this.baseAngle = this.angle;
        if (w && w.state === 'stunned') w.timer = Math.min(w.timer, 0.8); // 仲間を起こす
        this.wakeTarget = null;
      }
    } else {
      this.wantAngle = this.baseAngle + Math.sin(this.timer * 2.4) * 80 * RAD;
      if (this.timer >= E.SUSPECT_LOOK_TIME) this.toPatrol();
    }
  };

  // 警戒：見えていればプレイヤーへ、見えなければ最後に見た地点へ走る
  Enemy.prototype.chase = function (dt, player) {
    const t = this.sees ? player : NH.Alert.lastKnown;
    if (this.goTo(t.x, t.y, E.ALERT_SPEED, dt) !== false) {
      // 着いたのに見当たらない：その場で見回す
      this.timer += dt;
      this.wantAngle = this.baseAngle + Math.sin(this.timer * 4) * 100 * RAD;
    } else {
      this.timer = 0;
      this.baseAngle = this.angle;
    }
    if (Math.hypot(player.x - this.x, player.y - this.y) < E.CATCH_DIST) NH.Game.capture();
  };

  // 捜索：最後に見た地点の周りを、場所を変えながら探す
  Enemy.prototype.search = function (dt) {
    this.timer += dt;
    if (!this.searchPt) this.pickSearchPoint();
    if (this.phase === 'go') {
      const p = this.searchPt;
      if (this.goTo(p.x, p.y, E.SEARCH_SPEED, dt) !== false || this.timer > 8) {
        this.phase = 'look';
        this.timer = 0;
        this.baseAngle = this.angle;
      }
    } else {
      this.wantAngle = this.baseAngle + Math.sin(this.timer * 3.2) * 90 * RAD;
      if (this.timer >= E.SEARCH_LOOK_TIME) {
        this.pickSearchPoint();
        this.phase = 'go';
        this.timer = 0;
      }
    }
  };

  Enemy.prototype.pickSearchPoint = function () {
    const k = NH.Alert.lastKnown, R = E.SEARCH_RADIUS;
    const kx = Math.floor(k.x / T), ky = Math.floor(k.y / T);
    for (let i = 0; i < 16; i++) {
      const tx = kx + Math.round((Math.random() * 2 - 1) * R);
      const ty = ky + Math.round((Math.random() * 2 - 1) * R);
      if (NH.Map.isSolid(tx, ty)) continue;
      this.searchPt = { x: (tx + 0.5) * T, y: (ty + 0.5) * T };
      this.path = null;
      return;
    }
    this.searchPt = { x: k.x, y: k.y };
    this.path = null;
  };

  // 目標へ向かって進む。着いたら true、行けないときは 'fail'、移動中は false
  Enemy.prototype.goTo = function (tx, ty, speed, dt) {
    const step = speed * dt;
    if (Math.hypot(tx - this.x, ty - this.y) <= step) {
      this.x = tx;
      this.y = ty;
      return true;
    }

    let nx = tx, ny = ty;
    if (AI.clearLine(this.x, this.y, tx, ty)) {
      this.path = null;
    } else {
      // 目標のタイルが変わったら（少し間をおいて）経路を引き直す
      const key = Math.floor(tx / T) + Math.floor(ty / T) * NH.Map.w;
      this.pathT -= dt;
      if (!this.path || (key !== this.pathKey && this.pathT <= 0)) {
        this.path = AI.findPath(this.x, this.y, tx, ty);
        this.pathI = 0;
        this.pathKey = key;
        this.pathT = 0.35;
      }
      const path = this.path;
      if (!path || !path.length) return 'fail';
      // まっすぐ行ける先の通過点まで飛ばして、角ばった動きを減らす
      while (this.pathI + 1 < path.length &&
        AI.clearLine(this.x, this.y, path[this.pathI + 1].x, path[this.pathI + 1].y)) this.pathI++;
      let n = path[this.pathI];
      if (Math.hypot(n.x - this.x, n.y - this.y) <= step && this.pathI + 1 < path.length) n = path[++this.pathI];
      nx = n.x;
      ny = n.y;
    }

    const dx = nx - this.x, dy = ny - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return false;
    this.wantAngle = Math.atan2(dy, dx);
    // 進む方向へだいたい向き終えてから歩き出す（追跡中は構わず走る）
    const loose = this.state === 'alert' ? 1.6 : 0.5;
    if (Math.abs(AI.angleDiff(this.wantAngle, this.angle)) < loose) {
      const m = Math.min(step, d);
      this.x += dx / d * m;
      this.y += dy / d * m;
      this.moving = true;
    }
    return false;
  };

  Enemy.prototype.turn = function (dt) {
    const d = AI.angleDiff(this.wantAngle, this.angle);
    const fast = this.state === 'alert' || this.state === 'spotted' ? 2.2 : 1;
    const max = E.TURN_SPEED * fast * RAD * dt;
    this.angle += Math.max(-max, Math.min(max, d));
  };

  Enemy.prototype.updateFace = function () {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    // 斜めのあたりでは今の向きを保ち、ちらつきを防ぐ
    if (Math.abs(c) > Math.abs(s) * 1.25) this.face = c > 0 ? 'right' : 'left';
    else if (Math.abs(s) > Math.abs(c) * 1.25) this.face = s > 0 ? 'down' : 'up';
  };

  // ---------- 描画 ----------
  // 視界の色：通常は緑。気づきゲージがたまるほど黄色へ。警戒は赤
  Enemy.prototype.coneColor = function () {
    if (this.state === 'alert' || this.state === 'spotted') return [255, 70, 55, 1.3];
    if (this.state === 'suspicious' || this.state === 'search') return [255, 205, 70, 1.15];
    const k = Math.min(1, this.gauge / E.SUSPECT_AT);
    return [120 + 135 * k, 235 - 30 * k, 195 - 125 * k, 1];
  };

  Enemy.prototype.drawCone = function (ctx) {
    const p = this.cone;
    if (p.length < 6) return;
    const [r, g, b, k] = this.coneColor();
    const rgb = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',';
    const grad = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, E.VIEW_DIST * T);
    grad.addColorStop(0, rgb + (0.34 * k) + ')');
    grad.addColorStop(1, rgb + (0.08 * k) + ')');
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    for (let i = 0; i < p.length; i += 3) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = rgb + (0.22 * k) + ')';
    ctx.lineWidth = 0.75;
    ctx.stroke();
    // 匍匐中は、実際に見つかる範囲（半分の距離）を線で示す
    if (NH.Player.crawling) {
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.arc(this.x, this.y, E.VIEW_DIST * T * E.CRAWL_VIEW_MULT, 0, Math.PI * 2);
      ctx.strokeStyle = rgb + '0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }
  };

  Enemy.prototype.draw = function (ctx, snap) {
    const S = NH.Sprites.SCALE;
    if (this.state === 'stunned') {
      const side = this.face === 'left' ? 'left' : this.face === 'right' ? 'right' : this.face;
      const img = NH.Sprites.enemyProne[side][0];
      const w = img.width * S, h = img.height * S;
      const x = snap(this.x), y = snap(this.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x - w / 2 + 2, y - h / 2 + 3, w - 4, h - 2);
      ctx.drawImage(img, x - w / 2, y - h / 2 - 2, w, h);
      return;
    }
    const fps = this.state === 'alert' ? E.ANIM_FPS * 1.8 : E.ANIM_FPS;
    const frame = this.moving ? WALK_SEQ[Math.floor(this.animT * fps) % WALK_SEQ.length] : 0;
    const img = NH.Sprites.enemy[this.face][frame];
    const w = img.width * S, h = img.height * S;
    const x = snap(this.x), feet = snap(this.y) + E.HIT_H / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(x, feet - 1, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, x - w / 2, feet - h, w, h);
  };

  // 頭上の「！」「？」
  Enemy.prototype.drawMark = function (ctx, snap) {
    if (this.state === 'stunned') {
      // 気絶：頭の上を星が回る。起き上がる直前は点滅する
      if (this.timer < 2 && Math.floor(this.timer * 8) % 2) return;
      const x = snap(this.x), y = snap(this.y) - 16;
      for (let i = 0; i < 3; i++) {
        const a = this.markT * 4 + i * Math.PI * 2 / 3;
        ctx.fillStyle = i ? '#ffe680' : '#ffffff';
        ctx.fillRect(Math.round(x + Math.cos(a) * 9) - 1, Math.round(y + Math.sin(a) * 3) - 1, 3, 3);
      }
      return;
    }
    if (!this.mark || this.markT > (this.mark === '!' ? 1.3 : 1.9)) return;
    const S = NH.Sprites.SCALE;
    const img = this.mark === '!' ? NH.Sprites.markAlert : NH.Sprites.markQuestion;
    const pop = Math.sin(Math.min(1, this.markT / 0.22) * Math.PI) * 7;
    const x = snap(this.x), y = snap(this.y + E.HIT_H / 2 - 40 - 26 - pop);
    ctx.drawImage(img, x - img.width * S / 2, y, img.width * S, img.height * S);
  };

  NH.Enemy = Enemy;
})();
