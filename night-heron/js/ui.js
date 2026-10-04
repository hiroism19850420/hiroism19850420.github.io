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
      this.toastT += dt;
      if (player.moving) this.movedT += dt;
      if (this.movedT > 1.2) this.hintAlpha = Math.max(0, this.hintAlpha - dt * 1.5);
    },

    toastText: '',
    toastT: 99,
    toast(text) { this.toastText = text; this.toastT = 0; },
    clearToast() { this.toastT = 99; },

    draw(ctx, view, map) {
      this.drawVignette(ctx, view);
      this.drawHurt(ctx, view);
      this.drawAlert(ctx, view);
      this.drawLife(ctx);
      this.drawEquip(ctx);
      this.drawRadar(ctx, view);
      this.drawBanner(ctx, map);
      this.drawHint(ctx, view);
      this.drawToast(ctx, view);
      this.drawEnd(ctx, view);
      NH.Radio.draw(ctx, view);
    },

    // 被弾したときの赤い明滅
    drawHurt(ctx, view) {
      const p = NH.Player;
      if (p.hurtT <= 0) return;
      ctx.fillStyle = 'rgba(255,20,10,' + (0.35 * p.hurtT / NH.CONFIG.PLAYER.HURT_INVULN) + ')';
      ctx.fillRect(0, 0, view.w, view.h);
    },

    // ライフゲージ（左上）
    drawLife(ctx) {
      const p = NH.Player, max = NH.CONFIG.PLAYER.MAX_LIFE;
      const k = p.life / max;
      const x = 10, y = 8, w = 92, h = 7;
      ctx.save();
      ctx.font = 'bold 8px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,10,8,0.6)';
      ctx.fillRect(x - 2, y - 2, w + 34, h + 4);
      ctx.fillStyle = '#9fe0c6';
      ctx.fillText('LIFE', x, y + h / 2 + 0.5);
      ctx.fillStyle = '#1a0e0c';
      ctx.fillRect(x + 26, y, w, h);
      const low = k < 0.3 && Math.sin(NH.Game.time * 10) > 0;
      ctx.fillStyle = k > 0.5 ? '#5fe08f' : k > 0.25 ? '#ffd23c' : (low ? '#ff8070' : '#e8402e');
      ctx.fillRect(x + 26, y, Math.round(w * k), h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 26, y, Math.round(w * k), 2);
      ctx.restore();
    },

    // 持ち物（ライフの下）：麻酔銃の弾数、段ボール箱、カードキー
    drawEquip(ctx) {
      const p = NH.Player;
      const S = NH.Sprites.SCALE, icons = NH.Sprites.icons;
      let x = 8;
      const y = 24;
      const slot = (img, label, on) => {
        ctx.font = 'bold 9px monospace';
        const tw = label ? Math.ceil(ctx.measureText(label).width) + 4 : 0;
        const w = img.width * S / 2 + 10 + tw;
        ctx.fillStyle = on ? 'rgba(90,70,20,0.75)' : 'rgba(0,10,8,0.6)';
        ctx.fillRect(x, y - 2, w, 16);
        ctx.drawImage(img, x + 4, y + 6 - img.height * S / 4, img.width * S / 2, img.height * S / 2);
        if (label) {
          ctx.fillStyle = '#d8fff0';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + 8 + img.width * S / 2, y + 6.5);
        }
        x += w + 4;
      };
      ctx.save();
      if (p.hasGun) slot(icons.gun, String(p.ammo), false);
      if (p.hasBox) slot(icons.box, '', p.boxed);
      if (p.keyLevel > 0) slot(icons['key' + p.keyLevel], 'Lv' + p.keyLevel, false);
      ctx.restore();
    },

    // レーダー（右上）：周囲の地形、敵の位置と視界。警戒・捜索中はノイズで使えない
    drawRadar(ctx, view) {
      const G = NH.Game, map = NH.Map, p = NH.Player;
      const T = NH.CONFIG.TILE, k = map.MINI / T;
      const W = 88, H = 60;
      const x0 = Math.round(view.w - (view.rightInset || 8) - W), y0 = 8;
      const cx = x0 + W / 2, cy = y0 + H / 2;

      ctx.save();
      ctx.fillStyle = 'rgba(0,16,12,0.78)';
      ctx.fillRect(x0, y0, W, H);
      ctx.beginPath();
      ctx.rect(x0, y0, W, H);
      ctx.clip();

      if (NH.Alert.phase !== 'none') {
        // 妨害：砂嵐と流れる帯
        for (let i = 0; i < 70; i++) {
          const g = 60 + Math.floor(Math.random() * 150);
          ctx.fillStyle = 'rgba(' + g + ',' + (g + 30) + ',' + g + ',' + (0.25 + Math.random() * 0.5) + ')';
          ctx.fillRect(x0 + Math.random() * W, y0 + Math.random() * H, 2 + Math.random() * 14, 1);
        }
        ctx.fillStyle = 'rgba(200,255,220,0.18)';
        ctx.fillRect(x0, y0 + (G.time * 40) % H, W, 5);
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = Math.sin(G.time * 8) > 0 ? '#ff6a5a' : '#a02a20';
        ctx.fillText('JAMMING', cx, cy);
      } else {
        const ox = cx - p.x * k, oy = cy - p.y * k; // ワールド座標をレーダー上に写す
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(map.mini, Math.round(ox), Math.round(oy));
        // 扉（閉まっているものだけ）
        for (const d of map.doors) {
          if (d.open > 0.5) continue;
          ctx.fillStyle = d.level === 1 ? '#3aa0ff' : '#ff7a3a';
          for (const t of d.tiles) ctx.fillRect(Math.round(ox + t.tx * map.MINI), Math.round(oy + t.ty * map.MINI), map.MINI, map.MINI);
        }
        // 落ちているアイテム
        ctx.fillStyle = '#ffe680';
        for (const it of G.items) if (!it.taken) ctx.fillRect(Math.round(ox + it.x * k) - 1, Math.round(oy + it.y * k) - 1, 2, 2);
        // 監視カメラと敵の視界
        const cone = (c, color) => {
          const q = c.cone;
          if (!q || q.length < 6) return;
          ctx.beginPath();
          ctx.moveTo(ox + c.x * k, oy + c.y * k);
          for (let i = 0; i < q.length; i += 3) ctx.lineTo(ox + q[i] * k, oy + q[i + 1] * k);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        };
        for (const c of G.sentries) {
          if (c.offT > 0) continue;
          cone(c, 'rgba(110,190,255,0.4)');
          ctx.fillStyle = '#7fd0ff';
          ctx.fillRect(Math.round(ox + c.x * k) - 1, Math.round(oy + c.y * k) - 1, 2, 2);
        }
        for (const e of G.enemies) {
          if (e.state === 'stunned') {
            ctx.fillStyle = '#6a7a74';
          } else {
            cone(e, e.state === 'patrol' ? 'rgba(120,235,195,0.35)' : 'rgba(255,205,70,0.45)');
            ctx.fillStyle = '#ff5a4a';
          }
          ctx.fillRect(Math.round(ox + e.x * k) - 1, Math.round(oy + e.y * k) - 1, 3, 3);
        }
        // 自分
        ctx.fillStyle = Math.sin(G.time * 8) > -0.4 ? '#ffffff' : '#9fffd6';
        ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
      }
      ctx.restore();
      ctx.strokeStyle = NH.Alert.phase !== 'none' ? '#a02a20' : '#3d7a6a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, W - 1, H - 1);
    },

    // アイテムを拾ったときなどの短いお知らせ
    drawToast(ctx, view) {
      if (this.toastT > 2.6) return;
      const a = Math.min(1, this.toastT / 0.15, (2.6 - this.toastT) / 0.4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = Math.ceil(ctx.measureText(this.toastText).width) + 24;
      const y = view.h * 0.72;
      ctx.fillStyle = 'rgba(0,14,12,0.8)';
      ctx.fillRect(view.w / 2 - w / 2, y - 11, w, 22);
      ctx.fillStyle = '#6fe0b8';
      ctx.fillRect(view.w / 2 - w / 2, y - 11, 2, 22);
      ctx.fillStyle = '#e6fff6';
      ctx.fillText(this.toastText, view.w / 2, y + 0.5);
      ctx.restore();
    },

    // ゲームオーバー・ステージクリア
    drawEnd(ctx, view) {
      const G = NH.Game;
      if (G.mode === 'play') return;
      const clear = G.mode === 'clear';
      const k = Math.min(1, G.endT / 0.6);
      ctx.save();
      ctx.fillStyle = clear ? 'rgba(0,12,10,' + (0.82 * k) + ')' : 'rgba(24,0,0,' + (0.82 * k) + ')';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.globalAlpha = k;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = view.w / 2, cy = view.h / 2;
      ctx.font = 'bold 28px ' + FONT;
      ctx.fillStyle = clear ? '#7dffc4' : '#ff5a4a';
      ctx.fillText(clear ? 'STAGE CLEAR' : 'GAME OVER', cx, cy - 34);
      if (clear) {
        const s = G.stats;
        const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
        const lines = [
          'クリアタイム　' + m + '分' + String(sec).padStart(2, '0') + '秒',
          '発見された回数　' + s.alerts + '回',
          '気絶させた数　' + s.kos + '　眠らせた数　' + s.sleeps
        ];
        ctx.font = 'bold 11px ' + FONT;
        ctx.fillStyle = '#d8fff0';
        lines.forEach((l, i) => ctx.fillText(l, cx, cy + 2 + i * 16));
      } else {
        ctx.font = 'bold 11px ' + FONT;
        ctx.fillStyle = '#e8c8c0';
        ctx.fillText('ライフが尽きた', cx, cy + 4);
      }
      if (G.endT > 1.2 && Math.sin(G.time * 5) > -0.3) {
        const touch = document.body.classList.contains('touch');
        ctx.font = 'bold 10px ' + FONT;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(touch ? '画面をタッチしてもう一度' : 'Z キーでもう一度', cx, cy + (clear ? 58 : 30));
      }
      ctx.restore();
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
      // 画面が狭いとき（縦持ち）は、レーダーと重ならないよう一段下げる
      const w = 104, h = 22, x = Math.round(view.w / 2 - w / 2), y = view.w < 430 ? 74 : 8;
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
      const x = 8 - (1 - inK) * 12, y = 42;

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
      const touch = document.body.classList.contains('touch');
      // キーボード操作のとき、アクションキーでいまできることを出す（タッチではボタンの表示が変わる）
      const act = NH.Player.action;
      if (!touch && act && this.hintAlpha <= 0) {
        const label = act.type === 'ko' ? 'Z：気絶させる' : act.type === 'door' ? (act.ok ? 'Z：扉を開ける' : 'カードキー Lv' + act.door.level + ' が必要') : 'Z：壁を叩く';
        ctx.save();
        ctx.font = 'bold 10px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = Math.ceil(ctx.measureText(label).width) + 16;
        ctx.fillStyle = act.type === 'ko' ? 'rgba(90,20,14,0.75)' : 'rgba(0,10,8,0.65)';
        ctx.fillRect(view.w / 2 - w / 2, view.h - 27, w, 18);
        ctx.fillStyle = act.type === 'ko' ? '#ffd0c8' : '#fff1b8';
        ctx.fillText(label, view.w / 2, view.h - 17.5);
        ctx.restore();
      }
      if (this.hintAlpha <= 0) return;
      const text = touch
        ? '画面の左側をドラッグして移動'
        : '移動：矢印/WASD　Shift：ほふく　Z：アクション　X：撃つ　C：箱　Space：無線';
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
