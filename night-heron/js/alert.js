// フロア全体の警戒状態。none（通常） → alert（警戒） → search（捜索） → none
(function () {
  const C = NH.CONFIG;

  NH.Alert = {
    phase: 'none',
    timer: 0,
    lastKnown: { x: 0, y: 0 },  // プレイヤーを最後に見た地点
    seen: false,                // このフレームで誰かが見ているか

    reset() {
      this.phase = 'none';
      this.timer = 0;
      this.seen = false;
    },

    // 敵がプレイヤーを発見した
    trigger(by, player) {
      const was = this.phase;
      this.phase = 'alert';
      this.timer = C.ALERT.ALERT_TIME;
      this.lastKnown = { x: player.x, y: player.y };
      this.seen = true;
      if (was !== 'alert') NH.Audio.play('alert');
      const R = C.ENEMY.REACT_TIME;
      for (const e of NH.Game.enemies) {
        if (e.state === 'alert' || e.state === 'spotted' || e.state === 'stunned') continue;
        e.enterSpotted(e === by ? R : R * 0.8 + Math.random() * 0.6);
      }
    },

    // 警戒中に、敵がプレイヤーを見ている
    report(x, y) {
      this.lastKnown.x = x;
      this.lastKnown.y = y;
      this.seen = true;
    },

    // 物音。半径内にいる通常・疑念の敵が見に来る（フェーズ4の壁叩きや足音で使う）
    noise(x, y, radius) {
      for (const e of NH.Game.enemies) {
        if (e.state !== 'patrol' && e.state !== 'suspicious') continue;
        if (Math.hypot(e.x - x, e.y - y) <= radius) e.suspect(x, y);
      }
    },

    update(dt) {
      if (this.phase === 'alert') {
        if (this.seen) this.timer = C.ALERT.ALERT_TIME;
        else this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = 'search';
          this.timer = C.ALERT.SEARCH_TIME;
          for (const e of NH.Game.enemies) if (e.state !== 'stunned') e.enterSearch();
        }
      } else if (this.phase === 'search') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = 'none';
          this.timer = 0;
          for (const e of NH.Game.enemies) if (e.state !== 'stunned') e.toPatrol();
        }
      }
      this.seen = false;
    }
  };
})();
