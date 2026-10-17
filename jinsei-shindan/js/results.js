// 診断結果：レシートと一行エンディング
'use strict';

const Results = (function () {
  const RESULT_LABEL = {
    enemy_collision: '敵に接触', pit_fall: '穴に転落', goal: 'ゴール',
    collision: '接触', avoided_all: '回避してゴール', timeout: '時間切れ',
    lines_cleared: '目標達成', field_full: 'フィールド満杯',
    events_completed: '全イベント終了'
  };

  const OVERALL = {
    3: { grade: '惜しい人生', text: 'あなたは、あと一歩のところで何かを取りこぼしてきたようです。' },
    2: { grade: '要反省', text: 'あなたは複数の局面で課題を抱えていたようです。' },
    1: { grade: '要再検査', text: 'あなたはほとんどの局面で、想定どおりにいかなかったようです。' },
    0: { grade: '判定保留', text: 'あなたの人生は、本診断の想定を超えています。' }
  };

  function pad2(n) { return String(n).padStart(2, '0'); }

  function buildLines() {
    const d = new Date();
    const date = `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const L = [];
    const add = (text, cls = '') => L.push({ text, cls });
    const rule = () => add('', 'rule');

    add('私の人生、診断してください。', 'center small');
    add('人 生 診 断 書', 'center big');
    add('（お客様控え）', 'center small');
    rule();
    add(`診断日時　${date}`);
    add(`受診者　　${gameState.playerName ? gameState.playerName + ' 様' : '（無記名）様'}`);
    add(`診断番号　No.${String(Math.floor(Math.random() * 900000) + 100000)}`);
    rule();

    for (let id = 1; id <= STAGE_COUNT; id++) {
      const r = State.get(id);
      const info = STAGE_INFO[id];
      add(`[${id}] ${info.short}`, 'item');
      if (!r) { add('未受診', 'right'); continue; }
      add(`${RESULT_LABEL[r.resultType] || r.resultType}　…　${r.cleared ? 'クリア' : '失敗'}`, 'right');
      add(`タグ：${r.diagnosisTag}`, 'indent');
      String(r.diagnosisText).split('\n').forEach(s => add(s, 'indent text'));
      L.push({ text: '', cls: 'gap' });
    }
    rule();

    const regret = gameState.lifeRegret, branch = gameState.lifeReflection, alt = gameState.alternateChoice;
    if (regret || branch || alt) {
      add('ご記入いただいた人生', 'item');
      if (regret) add(`後悔：${regret}`, 'indent');
      if (branch) add(`分岐点：${branch}`, 'indent');
      if (alt) add(`選ばなかった選択肢：${alt}`, 'indent');
      add('※本診断では参照しておりません。', 'indent small');
      rule();
    }

    const cleared = State.clearCount();
    const ov = OVERALL[Math.min(3, cleared)];
    add(`クリア　${cleared} / ${STAGE_COUNT}`, 'right');
    add(`主な傾向　${gameState.stageResults.map(r => r.diagnosisTag.split('・')[0]).join('／')}`, 'small');
    add(`総合評価：${ov.grade}`, 'total');
    add(ov.text, 'text');
    add('しかし、これらの結果は短時間のゲームプレイから生成されたものです。今後の人生に活かすかどうかは、あなた次第です。', 'text');
    rule();
    add('※本診断は娯楽を目的としたものであり、実際の人格評価ではありません。', 'small');
    add('またのご来店をお待ちしております。', 'center small');
    add('|| ||| | |||| || | ||| |||| | || |||', 'center barcode');
    return L;
  }

  function showReceipt() {
    stopStage();
    Loop.run(() => {}, c => clearCanvas(c, '#f2f2f2'));
    Screens.show(`
      <div class="receipt-area" id="rArea">
        <div class="receipt" id="receipt"><div class="receipt-body" id="rBody"></div></div>
      </div>
      <div class="receipt-side">
        <button id="bSkip" class="btn small">演出をスキップ</button>
        <div id="rButtons" class="receipt-buttons hidden">
          <button id="bAgain" class="btn primary" data-hold="1">もう一度診断する</button>
          <button id="bTitle" class="btn" data-hold="1">タイトルに戻る</button>
        </div>
      </div>
    `, 'receipt-screen');

    const lines = buildLines();
    const body = document.getElementById('rBody');
    const area = document.getElementById('rArea');
    let i = 0, timer = 0, done = false;

    function emit(animate) {
      const l = lines[i++];
      const el = document.createElement('div');
      el.className = 'rl ' + l.cls + (animate ? ' printing' : '');
      el.textContent = l.text;
      body.appendChild(el);
    }
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      while (i < lines.length) emit(false);
      area.scrollTop = area.scrollHeight;
      document.getElementById('bSkip').classList.add('hidden');
      const box = document.getElementById('rButtons');
      box.classList.remove('hidden');
      box.querySelectorAll('button').forEach(b => { b.disabled = false; });
      Screens.primary = document.getElementById('bAgain');
      Screens.shownAt = performance.now();
      Sfx.play('tick');
    }
    function step() {
      if (done) return;
      if (i >= lines.length) { finish(); return; }
      emit(true);
      Sfx.play('print');
      area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
      const l = lines[i - 1];
      timer = setTimeout(step, l.cls.includes('rule') || l.cls.includes('gap') ? 160 : 230);
    }
    timer = setTimeout(step, 500);

    Screens.bind('bSkip', finish);
    Screens.bind('bAgain', () => { clearTimeout(timer); restartDiagnosis(); }, true);
    Screens.bind('bTitle', () => { clearTimeout(timer); restartFromTitle(); });
    // 印刷中に Enter を押したらスキップ。印刷が終わったら Enter で「もう一度診断する」
    Screens.primary = document.getElementById('bSkip');
  }

  function showAllClear() {
    stopStage();
    Loop.run(() => {}, c => clearCanvas(c));
    Screens.show(`
      <p class="allclear fade-line" style="animation-delay:0.4s">あなたはゲームが上手！よかったね！</p>
      <div class="allclear-btn fade-line" style="animation-delay:2.2s"><button id="bReplay" class="btn">もう一度プレイする</button></div>
    `, 'allclear-screen');
    Screens.bind('bReplay', restartFromTitle, true);
  }

  return { showReceipt, showAllClear, buildLines };
})();
