// 画面に重ねる表示（区画名、操作ヒント、周辺の減光）。
(function () {
  const FONT = '"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';

  NH.UI = {
    zone: null,
    bannerT: 99,
    movedT: 0,
    hintAlpha: 1,
    vignette: null,
    vignetteKey: '',

    update(dt, player, map) {
      const z = map.zoneAt(player.x, player.y);
      if (z && z !== this.zone) {
        this.zone = z;
        this.bannerT = 0;
      }
      this.bannerT += dt;
      if (player.moving) this.movedT += dt;
      if (this.movedT > 1.2) this.hintAlpha = Math.max(0, this.hintAlpha - dt * 1.5);
    },

    draw(ctx, view, map) {
      this.drawVignette(ctx, view);
      this.drawAlert(ctx, view);
      this.drawBanner(ctx, map);
      this.drawHint(ctx, view);
      this.drawCaptured(ctx, view);
    },

    // 警戒：画面端の赤い点滅と残り時間。捜索：黄色の残り時間
    drawAlert(ctx, view) {
      const A = NH.Alert;
      if (A.phase === 'none') return;
      const alert = A.phase === 'alert';
      const t = NH.Game.time;

      const key = view.w + 'x' + view.h;
      if (key !== this.edgeKey) {
        const mk = (rgb) => {
          const g = ctx.createRadialGradient(
            view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.42,
            view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.62);
          g.addColorStop(0, 'rgba(' + rgb + ',0)');
          g.addColorStop(1, 'rgba(' + rgb + ',1)');
          return g;
        };
        this.edgeRed = mk('255,30,20');
        this.edgeYellow = mk('255,200,40');
        this.edgeKey = key;
      }
      ctx.save();
      ctx.globalAlpha = alert ? 0.3 + 0.28 * Math.sin(t * 9) : 0.16;
      ctx.fillStyle = alert ? this.edgeRed : this.edgeYellow;
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.restore();

      // 残り時間
      const label = alert ? '警戒' : '捜索';
      const num = Math.max(0, A.timer).toFixed(2).padStart(5, '0');
      const w = 104, h = 22, x = Math.round(view.w / 2 - w / 2), y = 8;
      const blink = alert && Math.sin(t * 9) > 0;
      ctx.save();
      ctx.fillStyle = alert ? (blink ? '#d3231a' : '#8e120d') : '#8a6a08';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + 40, y + 2, w - 42, h - 4);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + 20, y + h / 2 + 0.5);
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = alert ? '#ff8a7a' : '#ffd95a';
      ctx.fillText(num, x + 40 + (w - 42) / 2, y + h / 2 + 1);
      ctx.restore();
    },

    // 捕まったときの暗転
    drawCaptured(ctx, view) {
      const G = NH.Game;
      if (G.captureT <= 0) return;
      const k = Math.min(1, (1.8 - G.captureT) / 0.4);
      ctx.save();
      ctx.fillStyle = 'rgba(20,0,0,' + (0.78 * k) + ')';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.globalAlpha = k;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 30px ' + FONT;
      ctx.fillStyle = '#ff5a4a';
      ctx.fillText('捕まった', view.w / 2, view.h / 2 - 8);
      ctx.font = 'bold 11px ' + FONT;
      ctx.fillStyle = '#e8c8c0';
      ctx.fillText('開始位置に戻ります', view.w / 2, view.h / 2 + 20);
      ctx.restore();
    },

    drawVignette(ctx, view) {
      const key = view.w + 'x' + view.h;
      if (key !== this.vignetteKey) {
        const g = ctx.createRadialGradient(
          view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.38,
          view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.78);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.6)');
        this.vignette = g;
        this.vignetteKey = key;
      }
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, view.w, view.h);
    },

    // 区画に入ったときの名前表示
    drawBanner(ctx, map) {
      const t = this.bannerT;
      const HOLD = 3.2, FADE = 0.6;
      if (!this.zone || t > HOLD + FADE) return;
      const inK = Math.min(1, t / 0.25);
      const alpha = t < HOLD ? inK : 1 - (t - HOLD) / FADE;
      const x = 10 - (1 - inK) * 12, y = 10;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 9px ' + FONT;
      const fw = Math.ceil(ctx.measureText(map.floorName).width) + 8;
      ctx.font = 'bold 12px ' + FONT;
      const nw = Math.ceil(ctx.measureText(this.zone.name).width);

      ctx.fillStyle = 'rgba(0,10,8,0.6)';
      ctx.fillRect(x, y, fw + nw + 16, 18);
      ctx.fillStyle = '#6fe0b8';
      ctx.fillRect(x, y, fw, 18);
      ctx.fillRect(x, y + 19, (fw + nw + 16) * Math.min(1, t / 0.5), 1);

      ctx.font = 'bold 9px ' + FONT;
      ctx.fillStyle = '#04201a';
      ctx.fillText(map.floorName, x + 4, y + 9.5);
      ctx.font = 'bold 12px ' + FONT;
      ctx.fillStyle = '#d8fff0';
      ctx.fillText(this.zone.name, x + fw + 8, y + 9.5);
      ctx.restore();
    },

    drawHint(ctx, view) {
      if (this.hintAlpha <= 0) return;
      const touch = document.body.classList.contains('touch');
      const text = touch
        ? '画面の左側をドラッグして移動'
        : '矢印キー / WASD：移動　　Esc：ポーズ　　F1：デバッグ';
      ctx.save();
      ctx.globalAlpha = this.hintAlpha;
      ctx.font = 'bold 10px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = Math.ceil(ctx.measureText(text).width) + 20;
      const x = view.w / 2, y = view.h - 18;
      ctx.fillStyle = 'rgba(0,10,8,0.65)';
      ctx.fillRect(x - w / 2, y - 9, w, 18);
      ctx.fillStyle = '#bff5e0';
      ctx.fillText(text, x, y + 0.5);
      ctx.restore();
    }
  };
})();
