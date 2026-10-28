// GameConfig / BalanceConfig / DifficultyConfig / AttackDefinition / ShapeDefinition
// 数値は仕様書 第1版の初期値。プレイテスト後の調整対象。

export const VERSION = '1.0.0-zenshin';

// ================= ぜんしん版（カメラ）の調整値 =================
// 長さは肩はば u が 1。本物のカメラで試して、ここの数字だけ直せばよい。
export const ZEN = {
  // 右手首（ペン）の動く範囲 → 戦いの描くところ（GAME.AREA）全体に写す
  //   左右：肩の中心から ±x u（cx で中心を右へずらせる）
  //   上下：胸の高さ（肩の線より chest u 下）から 上へ up u 〜 下へ down u
  PEN: { x: 1.6, cx: 0, chest: 0.45, up: 1.4, down: 0.6 },
  // 怪獣を描く画面（drawPad は正方形なので 範囲をせまくする）
  PAD: { x: 1.1, cx: 0, chest: 0.45, up: 1.25, down: 0.95 },
  // ペンのなめらかさ（かきじゅん ぜんしん版と同じ One Euro ＋ 追いつく速さ）
  SMOOTH: { minCutoff: 0.55, beta: 0.006, follow: 14 },
  ANCHOR: 0.06,   // 肩の中心（紙の基準）が体についていく速さ（1回の読みとりごと）。書いている間は止める
  UNIT: 0.05,     // 肩はばのならし
  VIS: 0.4,       // 手首が「見えている」とみなす確かさ
  LOST: 0.35,     // 見えなくなってから この秒数で「うつってない」
  // 左手を挙げている：手首が肩より in u 上で「挙げた」／肩より out u 下まで下ろしたら「下ろした」
  LEFT: { in: 0.15, out: 0.10 },
  LEFT_PAD: { in: 0.15, out: 0.40 },   // 怪獣を描く画面は 強め（線が途中で切れにくい）
  PAUSE: { up: 1.3, hold: 1.0 },       // 両手首が 肩より up u 上で hold 秒 → ポーズ
  UNDO: { dist: 1.1, time: 0.3, rearm: 0.8 },   // 左手を挙げたまま 右手を 左へ dist u を time 秒以内 → ひとつもどす
  CLAP_QUIET: 0.4,   // 左手を下ろしてから これだけたつまで 拍手を「できた」にしない
};

// 体は指より遅いので 判定をゆるめる
export const TUNE = {
  previewMul: 1.3,   // 攻撃の予告時間（1.3倍 ゆっくり）
  shapeLife: 1.4,    // 線と丸が消えるまで（1.4倍）
};

export const GAME = {
  VW: 960, VH: 540,
  AREA: { x0: 60, x1: 900, y0: 190, y1: 455 },
  LANES: [220, 480, 740],
  ARRIVE_Y: 460,
  DEF_Y: 350,
  MAX_DT: 0.1,          // 長いフレームの切り捨て
  SUBSTEP: 1 / 120,     // 判定用サブステップ
};

export const STROKE = {
  minStep: 3, maxPoints: 256,
  minLen: 30, minTime: 0.05, maxTime: 4.5, warnTime: 3.5, minPoints: 3,   // ぜんしん版：元 40 / 2.5 / 2.0
  resample: 32,
  closeRatio: 0.45,     // 丸と三角の「閉じる」判定。ぜんしん版：元 0.30
  // ぜんしん版：形が伝わらなかったら、いちばん近い形（線・丸・三角）に寄せて通す
  lenient: true,
  snapMin: 40,          // これより小さい落書きは 寄せない
  snapClose: 0.6,       // 始点と終点の間が 大きさの これ以下なら 丸か三角に寄せる
  snapLineMax: 320,     // 寄せた線の 長さの上限
};

// 2026-10-28 ユーザー指定「決まった時間だけでなく、書いたら どんどん 防御や攻撃が できると良い」：
// 攻撃に 集中は いらない（集中が3つ たまっていたら 1.5倍の 強い攻撃）、インクを 少なく・回復を 速く、線と丸を 長もち、6つまで 置ける
export const SHAPES = {
  line:   { ink: 8,  life: 3.0 * TUNE.shapeLife, durability: 1, dmg: 24, focus: 1, score: 100, width: 8, radius: 12 },
  circle: { ink: 14, life: 3.6 * TUNE.shapeLife, durability: 2, dmg: 12, focus: 1, score: 80, rMin: 35, rMax: 80 },
  tri:    { ink: 14, focus: 0, dmg: 40, power: 1.5, anim: 0.45, delay: 0.25, score: 250 },
};

export const BAL = {
  playerMax: 100, inkMax: 100, focusMax: 3,
  timeLimit: 240,
  invuln: 0.65,
  maxShapes: 6, maxAttacks: 6,
  phaseTransition: 1.5,
  triSuppress: 0.35,
  triMinRest: 0.6,
  hitStop: 0,           // ぜんしん版：画面を止めない（元 0.10）
  score: { kill: 2000, hpBonus: 10, timeBonus: 5, noDamage: 1000, recogBonus: 500 },
};

export const ATTACKS = {
  ink:     { name: 'インクだん', windup: 0.35, preview: 1.20, travel: 0.65, r: 12, dmg: 16, rest: 0.90, heavy: false },
  twin:    { name: 'ツインだん', windup: 0.40, preview: 1.35, delay: 0.30, travel: 0.70, r: 10, dmg: 12, rest: 1.10, firstExtra: 0.30, heavy: true },
  scratch: { name: 'ひっかき線', windup: 0.45, preview: 1.50, active: 0.15, dmg: 20, rest: 1.20, gateW: 100, gateY: 350, angTol: 35, heavy: true },
  rain:    { name: 'にじみ雨',   windup: 0.50, preview: 1.60, count: 3, interval: 0.55, fall: 0.45, dmg: 10, r: 9, rest: 1.40, defY: 340, heavy: true },
};

export const PHASES = [
  { weights: { ink: 70, twin: 30 }, previewMul: 1.00 },
  { weights: { ink: 35, twin: 35, scratch: 30 }, previewMul: 0.95 },
  { weights: { ink: 20, twin: 30, scratch: 25, rain: 25 }, previewMul: 0.90 },
];

export const DIFF = {
  // ぜんしん版の やさしい：元（bossHp 540 / dmgMul 0.70 / previewMul 1.25 / inkRegen 10）をさらにゆるめた
  easy:   { key: 'easy',   name: 'やさしい', bossHp: 480, playerHp: 100, dmgMul: 0.55, previewMul: 1.25 * TUNE.previewMul, inkRegen: 22, guide: 'always', shapeIcon: 'always' },
  normal: { key: 'normal', name: 'ふつう',   bossHp: 720, playerHp: 100, dmgMul: 1.00, previewMul: 1.00 * TUNE.previewMul, inkRegen: 16, guide: 'first',  shapeIcon: 'setting' },
  // 敵が どんどん攻撃してくる 2段階。restMul：攻撃のあとの 休みの倍率。concurrent：同時に出す 攻撃の数、gap：重ねて出す 間かく（秒）
  hard:   { key: 'hard',   name: 'むずかしい', bossHp: 840, playerHp: 100, dmgMul: 1.10, previewMul: 0.95 * TUNE.previewMul, inkRegen: 18, guide: 'first', shapeIcon: 'setting', restMul: 0.3, concurrent: 2, gap: 1.6 },
  oni:    { key: 'oni',    name: 'げきむず',   bossHp: 960, playerHp: 100, dmgMul: 1.20, previewMul: 0.90 * TUNE.previewMul, inkRegen: 20, guide: 'first', shapeIcon: 'setting', restMul: 0.15, concurrent: 3, gap: 0.9 },
};

export const QUALITY = {
  high: { name: '高', shadow: 1024, particles: 1.0, pr: 2 },
  mid:  { name: '中', shadow: 512,  particles: 0.6, pr: 1.5 },
  low:  { name: '低', shadow: 0,    particles: 0.3, pr: 1 },
};

export const COLORS = {
  ink: 0x2f5bd8, inkLight: 0x8fb0ff, inkCore: 0xffffff,
  danger: 0xf08a24, strong: 0xd8343b, guide: 0x5aa0ff,
  enemy: 0x14161c, paper: 0xfbf7ec, red: 0xd8343b,
};

export const FAIL_TEXT = {
  expired: 'じかんぎれ',
  offset: 'ずれた',
  ink: 'インク不足',
  focus: '集中不足',
  recog: 'かたちが伝わらなかった',
  none: 'ガードなし',
};

export const ADVICE = {
  expired: '線は4秒ほどで消えます。いつでも描きなおせるので、どんどん描きましょう。',
  offset: 'オレンジの予告線の上を横切るように描きましょう。',
  ink: 'インクは毎秒回復します。丸は線の2倍インクを使います。',
  focus: '三角・四角・星など 角のある形は いつでも攻撃できます。ガードで集中が3つたまると 1.5倍の強さになります。',
  recog: '線はまっすぐ、丸と三角は始点と終点を近づけて閉じましょう。',
  none: '攻撃の予告が出たら、通り道に線を描いてみましょう。',
};
