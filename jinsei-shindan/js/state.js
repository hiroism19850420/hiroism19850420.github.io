// ゲーム状態と診断結果の管理
'use strict';

// 共通の定数（画面は 960×540 の論理座標で描く）
const W = 960, H = 540;
const FONT = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic UI","Yu Gothic","Meiryo",sans-serif';
const FONT_MINCHO = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","MS PMincho",serif';

const STAGE_COUNT = 4;

const STAGE_INFO = {
  1: { name: 'ステージ1　基本診断', short: '基本診断', theme: 'あなたは、どんな人生を歩んできたのか？' },
  2: { name: 'ステージ2　リスクへの向き合い方', short: 'リスクへの向き合い方', theme: 'あなたは、リスクとどう向き合ってきたのか？' },
  3: { name: 'ステージ3　逆境への強さ・冷静さ', short: '逆境への強さ・冷静さ', theme: 'あなたは逆境に直面したとき、冷静でいられるのか？' },
  4: { name: 'ステージ4　人間関係', short: '人間関係', theme: 'あなたは、周囲の人間とどのように関わってきたのか？' }
};

const gameState = {
  currentStage: 0,
  // 人物像登録（再プレイ時も保持する）
  playerName: '',
  lifeRegret: '',       // 人生で後悔していること
  lifeReflection: '',   // 過去の分岐点
  alternateChoice: '',  // そのとき選ばなかった選択肢
  stageResults: [],
  allStagesCleared: false,
  finalJudgement: null  // 'all_clear' | 'receipt'
};

const State = {
  resetProgress() {
    gameState.currentStage = 0;
    gameState.stageResults = [];
    gameState.allStagesCleared = false;
    gameState.finalJudgement = null;
    gameState.startedAt = Date.now(); // レシートで「使った時間」を言うため
  },

  setProfile(p) {
    gameState.playerName = (p.playerName || '').trim().slice(0, 20);
    gameState.lifeRegret = (p.lifeRegret || '').trim().slice(0, 60);
    gameState.lifeReflection = (p.lifeReflection || '').trim().slice(0, 60);
    gameState.alternateChoice = (p.alternateChoice || '').trim().slice(0, 60);
  },

  // 同じステージの結果は上書きする（二重記録を防ぐ）
  record(result) {
    const r = {
      stageId: result.stageId,
      cleared: result.cleared === true,
      resultType: result.resultType,
      diagnosisTag: result.diagnosisTag,
      diagnosisText: result.diagnosisText,
      playResult: result.playResult || ''
    };
    gameState.stageResults = gameState.stageResults.filter(x => x.stageId !== r.stageId);
    gameState.stageResults.push(r);
    gameState.stageResults.sort((a, b) => a.stageId - b.stageId);
    return r;
  },

  get(stageId) {
    return gameState.stageResults.find(x => x.stageId === stageId) || null;
  },

  // 1〜4 のすべてが記録済みで、かつすべて cleared === true のときだけ true
  isAllCleared() {
    for (let id = 1; id <= STAGE_COUNT; id++) {
      const r = State.get(id);
      if (!r || r.cleared !== true) return false;
    }
    return true;
  },

  judge() {
    gameState.allStagesCleared = State.isAllCleared();
    gameState.finalJudgement = gameState.allStagesCleared ? 'all_clear' : 'receipt';
    return gameState.finalJudgement;
  },

  clearCount() {
    return gameState.stageResults.filter(r => r.cleared).length;
  }
};
