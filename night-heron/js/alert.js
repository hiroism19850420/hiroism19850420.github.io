// フロア全体の警戒状態。none（通常） → alert（警戒） → search（捜索） → none
//
// 警戒が始まると、最後に見た地点の近くにいる敵だけが駆けつける。
// 遠くの敵は持ち場に残り、目が鋭く、足が速い「厳戒態勢」で巡回を続ける。
(function () {
  const C = NH.CONFIG;
  const T = C.TILE;

  function isHot(e) { return e.state === 'alert' || e.state === 'spotted'; }

  NH.Alert = {
    phase: 'none',
    timer: 0,
    lastKnown: { x: 0, y: 0 },  // プレイヤーを最後に見た地点
    seen: false,                // このフレームで誰かが見ているか
    callT: 0,

    reset() {
      this.phase = 'none';
      this.timer = 0;
      this.seen = false;
      this.callT = 0;
    },

    // 通気口のシャッターが閉まっているか
    ductLocked() {
      return C.ALERT.DUCT_LOCK && this.phase !== 'none';
    },

    // 敵がプレイヤーを発見した
    trigger(by, player) {
      const was = this.phase;
      this.phase = 'alert';
      this.timer = C.ALERT.ALERT_TIME;
      this.lastKnown = { x: player.x, y: player.y };
      this.seen = true;
      if (was !== 'alert') NH.Audio.play('alert');
      this.callResponders(by);
    },

    // 最後に見た地点の近くにいる敵を呼び集める
    callResponders(by) {
      const A = C.ALERT, R = C.ENEMY.REACT_TIME;
      const k = this.lastKnown;
      const dist = (e) => Math.hypot(e.x - k.x, e.y - k.y);
      let hot = NH.Game.enemies.filter(isHot).length;
      const rest = NH.Game.enemies
        .filter((e) => !isHot(e) && e.state !== 'stunned')
        .sort((a, b) => dist(a) - dist(b));
      for (const e of rest) {
        if (e !== by && dist(e) > A.RESPOND_DIST * T && hot >= A.MIN_RESPONDERS) continue;
        e.enterSpotted(e === by ? R : R * 0.8 + Math.random() * 0.6);
        hot++;
      }
    },

    // 警戒中に、敵がプレイヤーを見ている
    report(x, y) {
      this.lastKnown.x = x;
      this.lastKnown.y = y;
      this.seen = true;
    },

    // 物音。半径内にいる通常・疑念の敵が見に来る
    noise(x, y, radius) {
      for (const e of NH.Game.enemies) {
        if (e.state !== 'patrol' && e.state !== 'suspicious') continue;
        if (Math.hypot(e.x - x, e.y - y) <= radius) e.suspect(x, y);
      }
    },

    update(dt) {
      if (this.phase === 'alert') {
        if (this.seen) {
          this.timer = C.ALERT.ALERT_TIME;
          // 逃げた先の近くにいる敵も、順に加わる
          this.callT -= dt;
          if (this.callT <= 0) {
            this.callT = 0.5;
            this.callResponders(null);
          }
        } else {
          this.timer -= dt;
        }
        if (this.timer <= 0) {
          this.phase = 'search';
          this.timer = C.ALERT.SEARCH_TIME;
          for (const e of NH.Game.enemies) if (isHot(e)) e.enterSearch();
        }
      } else if (this.phase === 'search') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = 'none';
          this.timer = 0;
          for (const e of NH.Game.enemies) if (e.state === 'search') e.toPatrol();
        }
      }
      this.seen = false;
    }
  };
})();
