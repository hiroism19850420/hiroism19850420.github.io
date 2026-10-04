// 効果音。Web Audio API で合成する（フェーズ6で足音や扉の音を足す）。
(function () {
  let ctx = null, master = null;

  // ブラウザの制限で、最初の操作のあとでないと音を出せない
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
    window.addEventListener(ev, unlock, { passive: true });
  }

  // 1音。f1 を指定すると、鳴っている間に高さが f0 から f1 へ動く
  function tone(type, f0, f1, start, dur, vol) {
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    // 発見の「！」：鋭い立ち上がりと、濁った和音の余韻
    alert() {
      tone('sawtooth', 520, 1480, 0, 0.07, 0.5);
      tone('square', 1480, 0, 0.06, 0.55, 0.32);
      tone('square', 1976, 0, 0.06, 0.55, 0.22);
      tone('square', 1397, 0, 0.06, 0.45, 0.18);
      tone('sine', 120, 60, 0, 0.3, 0.7);
    },
    // 疑念の「？」
    suspect() {
      tone('sine', 620, 0, 0, 0.09, 0.35);
      tone('sine', 880, 0, 0.11, 0.16, 0.35);
    },
    // 壁を叩く
    knock() {
      tone('triangle', 240, 110, 0, 0.07, 0.8);
      tone('square', 520, 260, 0, 0.03, 0.2);
      tone('triangle', 240, 110, 0.15, 0.07, 0.8);
      tone('square', 520, 260, 0.15, 0.03, 0.2);
    },
    // 気絶させる
    ko() {
      tone('sine', 170, 50, 0, 0.22, 0.9);
      tone('square', 110, 60, 0, 0.06, 0.3);
    },
    // 金属床の足音
    stepMetal() {
      tone('square', 1250, 820, 0, 0.035, 0.16);
      tone('triangle', 330, 240, 0, 0.07, 0.4);
    },
    // 水たまりの足音
    stepWater() {
      tone('sine', 620, 240, 0, 0.09, 0.35);
      tone('triangle', 1400, 500, 0.02, 0.05, 0.12);
    },
    // ふつうの床の足音（敵には聞こえない、小さな音）
    step() {
      tone('triangle', 150, 90, 0, 0.035, 0.12);
    },
    // 無線：呼び出し、文字送り、終了
    radioOpen() {
      tone('square', 1175, 0, 0, 0.06, 0.2);
      tone('square', 1568, 0, 0.09, 0.06, 0.2);
      tone('square', 1175, 0, 0.18, 0.06, 0.2);
      tone('square', 1568, 0, 0.27, 0.1, 0.2);
    },
    radioBlip() {
      tone('square', 880, 0, 0, 0.018, 0.06);
    },
    radioClose() {
      tone('square', 1568, 784, 0, 0.12, 0.18);
    },
    // 被弾
    hurt() {
      tone('sawtooth', 300, 90, 0, 0.16, 0.5);
      tone('square', 160, 70, 0, 0.12, 0.3);
    },
    // 敵の銃声
    shot() {
      tone('square', 900, 120, 0, 0.09, 0.28);
      tone('sawtooth', 200, 60, 0, 0.12, 0.35);
    },
    // 麻酔銃（消音）
    dart() {
      tone('sine', 1500, 400, 0, 0.06, 0.25);
      tone('triangle', 260, 120, 0, 0.05, 0.25);
    },
    // 麻酔弾が壁に当たった
    ricochet() {
      tone('square', 2400, 1400, 0, 0.04, 0.12);
    },
    // 弾切れ
    empty() {
      tone('square', 180, 0, 0, 0.03, 0.25);
    },
    // アイテムを拾った
    pickup() {
      tone('square', 988, 0, 0, 0.07, 0.2);
      tone('square', 1319, 0, 0.07, 0.12, 0.2);
    },
    // 段ボール箱をかぶる・脱ぐ
    box() {
      tone('triangle', 200, 120, 0, 0.08, 0.5);
    },
    // 扉
    doorOpen() {
      tone('sawtooth', 140, 260, 0, 0.22, 0.12);
      tone('sine', 880, 0, 0, 0.05, 0.2);
    },
    doorClose() {
      tone('sawtooth', 260, 130, 0, 0.2, 0.12);
      tone('triangle', 110, 70, 0.18, 0.08, 0.4);
    },
    // カードキーが足りない
    locked() {
      tone('square', 220, 0, 0, 0.12, 0.25);
      tone('square', 180, 0, 0.14, 0.18, 0.25);
    },
    // ゲームオーバー
    gameover() {
      tone('sawtooth', 330, 80, 0, 1.2, 0.4);
      tone('square', 220, 55, 0.1, 1.2, 0.25);
    },
    // ステージクリア
    clear() {
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, 0, i * 0.11, 0.2, 0.22));
    },
    // 捕まった
    caught() {
      tone('sawtooth', 320, 70, 0, 0.6, 0.45);
      tone('sine', 90, 40, 0, 0.7, 0.7);
    }
  };

  NH.Audio = {
    unlock,
    play(name) {
      if (!ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
      SOUNDS[name]();
    }
  };
})();
