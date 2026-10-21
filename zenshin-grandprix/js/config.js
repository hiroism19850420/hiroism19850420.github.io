// こげ！まわせ！ぜんしんグランプリ！ の 調整する数値
// 長さは m、時間は秒、体の長さは 肩はば（u）
export const CFG = {

  // ---------- 体の読みとり（第4部） ----------
  body: {
    VIS_SHOULDER: 0.5,     // 肩が「見えている」とする visibility
    VIS_WRIST: 0.4,        // 手首
    VIS_HIP: 0.5,          // 腰
    VIS_KNEE: 0.5,         // ひざ
    VIS_ANKLE: 0.4,        // 足首
    VIS_NOSE: 0.5,         // 鼻
    SMOOTH_U: 0.3,         // 肩はばの平滑化（1コマで近づく割合）

    // こぐ
    WIN: 0.5,              // 振れ幅を見る窓（秒）
    K_LO: 0.10,            // ひざの差の振れ幅：これより小さいと いきおい 0（調整）
    K_HI: 0.75,            // これで いきおい 1（調整）
    ANKLE_K: 0.8,          // 足首の振れ幅にかける倍率
    B_LO: 0.035,           // 肩のゆれ：これより小さいと 0（調整）
    B_HI: 0.16,            // これで 1（調整）
    STEP_TH: 0.12,         // ひざの高さの差が これをこえたら 1歩
    STEP_GAP_SH: 0.18,     // 肩のゆれで数える歩の 最短の間（秒）
    CAD_WIN: 2.0,          // ケイデンスを数える窓（秒）
    CAD_FULL: 3.6,         // このケイデンス（歩/秒）で 後押しが いっぱい
    CAD_W: 0.9,            // ケイデンスの後押しの 最大
    THR_UP: 0.12,          // いきおいが上がる時定数
    THR_DOWN: 0.45,        // 下がる時定数（調整）
    THR_DOWN_SQUAT: 1.2,   // しゃがんでいる間の 下がる時定数
    THR_DOWN_BANZAI: 1.0,  // バンザイ中の 下がる時定数
    AIR_HOLD: true,        // ジャンプ中は いきおいを下げない
    SH_MASK: 0.4,          // ジャンプ・しゃがみの前後 この秒数は 肩のゆれを こぐに数えない
    LEG_SENS: { high: 0.7, mid: 1.0, low: 1.35 },   // あしぶみの かんど（しきい値にかける）

    // まわす
    STEER_FULL: { high: 24, mid: 32, low: 40 },     // この角度（度）で いっぱい（調整）
    STEER_DEAD: 3,         // あそび（度）
    STEER_POW: 1.25,       // まんなかを おだやかにする
    HANDS_MIN: 0.45,       // 両手の間が これより近いと 角度を使わない（u）
    HANDS_MAX: 3.5,        // これより遠いと 使わない
    LEAN_ROLL_K: 1.6,      // 体の傾きの倍率
    LEAN_SHIFT_K: 40,      // 肩の横のずれ（u）を 度に直す倍率
    EURO_MIN: 1.2,         // 1ユーロ フィルター minCutoff（Hz）
    EURO_BETA: 0.04,       // beta
    EURO_D: 1.0,           // dCutoff
    SRC_SWITCH: 0.3,       // 手が この秒数 見えないと 傾きへ切りかえ
    SRC_BLEND: 0.25,       // 切りかえを まぜる秒数
    STEER_RELAX: 0.4,      // どちらも使えないとき 0 にもどす秒数
    NEUTRAL_MAX: 12,       // まっすぐの角度の 最大（度）

    // ジャンプ
    JUMP_H: 0.26,          // 体が これだけ上がったら ジャンプ（u）（調整）
    JUMP_VEL: 1.0,         // 上へ動く速さ（u/秒）がこれより速い
    JUMP_GAP: 0.45,        // ジャンプの 最短の間（秒）
    LAND_K: 0.4,           // JUMP_H × これより下がったら 着地
    BASE_FAST: 0.8,        // じっとしているときに 基準を合わせる時定数
    BASE_SLOW: 6.0,        // 動いているときの 時定数
    BASE_STILL: 0.12,      // |lift| がこれより小さいと「じっとしている」
    BASE_FREEZE: -0.3,     // lift がこれより小さい（しゃがんでいる）間は 基準を合わせない

    // しゃがむ
    SQUAT_H: 0.42,         // 体が これだけ下がったら しゃがみ（u）（調整）
    STAND_K: 0.55,         // SQUAT_H × これより上がったら 立った

    // バンザイ
    BANZAI_UP: 0.1,        // 手首が 鼻より これだけ上（u）
    BANZAI_HOLD: 0.25,     // これだけ続けたら バンザイ（秒）（調整）
    NOSE_FALLBACK: 1.0,    // 鼻が見えないとき、肩のまん中の これだけ上を 鼻とする（u）

    // 見えなくなる
    LOST_T: 1.0,           // 肩が この秒数 見えないと lost
    FOUND_T: 0.6,          // この秒数 見えたら found

    // 読みとりの間引き（第5部）
    COST_K: 2.5,           // 次の読みとりまで cost × これ（ms）あける
    MAX_GAP: 125,          // あけるのは 最大これ（ms）
    FEED_DT_MAX: 0.2       // feed の dt の 最大
  },

  // ---------- メニューでの体の操作（4.7） ----------
  menu: {
    STEER_TH: 0.55,        // ハンドルを これより切ると 動く
    STEER_REL: 0.3,        // これより もどすと 次は すぐ動く
    REPEAT: 0.55,          // 切りつづけると この秒数ごとに動く
    OK_HOLD: 1.0,          // バンザイを この秒数で けってい
    BACK_HOLD: 1.0,        // しゃがむ この秒数で もどる
    OK_LOCK: 0.8,          // けっていのあと 受けつけない秒数
    HOLD_RELAX: 0.25       // やめたとき 円が もどる秒数
  },

  // ---------- キーボード・タッチ（4.9） ----------
  keys: {
    THR_RISE: 0.15,        // ↑ で いきおいが 1 になる秒数
    TAP_ADD: 0.22,         // スペース 1回で 足す いきおい
    TAP_FALL: 0.45,        // スペースの いきおいが 下がる時定数
    HOLD_STEPS: 3,         // ↑ を押す間の 1秒あたりの歩数（数えるだけ）
    STEER_RISE: 0.18,      // ←→ で いっぱいになる秒数
    STEER_FALL: 0.12,      // はなして 0 になる秒数
    TOUCH_THR: 0.8         // 「こぐ」を押しつづけたときの いきおい
  },

  // ---------- じゅんび（4.10） ----------
  prep: {
    SEEN_T: 1.0,           // 手順1：肩が見えている秒数
    HOLD_T: 1.2,           // 手順2：手が安定している秒数
    HOLD_DEG: 6,           // 手順2：その間の 角度の変化の 最大（度）
    HANDS_LO: 0.6,         // 手順2：両手の間（u）
    HANDS_HI: 3.0,
    TURN_S: 0.6,           // 手順3・4：この きれ を
    TURN_T: 0.4,           //            この秒数
    RUN_THR: 0.6,          // 手順5：この いきおいを
    RUN_T: 1.5,            //        合わせて この秒数
    OK_SHOW: 0.8,          // 「できた！」を出す秒数
    SKIP_GLOW: 15,         // この秒数で「とばす」を光らせる
    DONE_SHOW: 1.6
  },

  // ---------- 物理（第11部） ----------
  phys: {
    DT: 1 / 120,           // 物理の きざみ
    MAX_SUB: 8,            // 1コマで進める最大の回数
    VMIN: 4.0,             // のろのろ（m/s）
    VMIN_RESCUE: 14.0,     // ライバルが全員ゴールしたあと
    VMAX: 22.0,            // 全力の最高速（調整）
    TAU_UP: 1.0,           // 速くなる時定数
    TAU_DOWN: 1.5,         // 遅くなる時定数
    TAU_UP_RECOVER: 1.6,   // 路面が変わった直後の TAU_UP
    RECOVER_T: 0.5,        // その長さ
    SURF_BLEND: 0.3,       // 路面の倍率を まぜる秒数
    SLOPE_K: 28,           // 坂の影響
    OMEGA_MAX: 1.55,       // いちばん速い 向きの変え方（rad/s）
    R_MIN: 8.5,            // いちばん小さく回る半径（m）
    AIR_STEER: 0.3,        // 空中の ハンドルの効き
    AIR_DRAG: 0.02,        // 空中の 空気の抵抗
    PSI_MAX: 1.2,          // 道に対する向きの最大（rad）
    PSI_BACK: 0.5,         // こえた分を もどす速さ
    KD_MIN: 0.2,           // 1 − k·d の 最小
    G: 24,                 // 重力
    HOP_V: 4.6,            // ぴょん
    RAMP_K: 0.36,          // ジャンプ台の とび上がり（vh = v × これ）
    RAMP_POW: 1.4,         // ジャンプ台の面の形
    SUPER_K: 1.35,         // スーパージャンプの倍率
    SUPER_PRE: 0.6,        // 台の終わりの この秒数前から
    SUPER_POST: 0.25,      // この秒数後まで
    SUPER_LATE_K: 0.35,    // 台を出たあとの スーパー：vh に v × RAMP_K × これを足す
    GAP_VMIN: 15,          // すきまを とぶ最低の速さ
    GAP_EXTRA: 4,          // すきまの向こうに 余分に とぶ長さ（m）
    TRICK_MIN: 0.25,       // 着地まで これ以上あれば トリック
    TRICK_TIME: 0.45,      // トリックの1回転の時間
    KICK: 2.5,             // 加速の始まりの ひと押し
    BOOST_FADE: 0.4,       // 加速の終わりを なめらかにする秒数
    BOOST_FLOOR: 0.7,      // 加速中の 目標の速さの下限（VMAX × これ ＋ boostV）
    BOOSTS: {              // [長さ（秒）, 最高速の上乗せ（m/s）]
      pad: [1.2, 7.0], slide: [1.0, 6.0], trick: [1.0, 6.0],
      rocket: [1.5, 7.0], slip: [0.8, 4.0], turbo: [2.5, 8.0]
    },
    GATE_PRE: 0.5,         // ゲートの この秒数前から しゃがんでいれば
    GATE_POST: 0.3,        // この秒数後まで
    ROCKET_PRE: 0.25,      // 青信号の この秒数前から
    ROCKET_POST: 0.3,      // この秒数後まで
    ROCKET_THR: 0.6,       // いきおいが これより大きい
    WALL_HALF: 0.65,       // カートの半分の幅
    WALL_BOUNCE: 1.4,      // かべで はね返る強さ
    WALL_LOSS_K: 0.04,     // かべへ向かう速さ 1m/s あたりの 速さの減り
    WALL_LOSS_MAX: 0.35,
    WALL_SHAKE: 3,         // この強さ以上で カメラをゆらす
    CAR_R: 0.9,            // カートの当たりの半径
    CAR_PUSH_D: 0.6,
    CAR_PUSH_S: 0.2,
    CAR_LOSS_BACK: 0.94,
    CAR_LOSS_FRONT: 0.99,
    CAR_PSI: 0.08,
    CAR_DH: 0.8,           // 高さの差が これ以上なら 当たらない
    CONE_FRONT: 0.8,       // カートの前の点（中心から）
    CONE_HIT: 0.7,         // コーンに当たる きょり
    CONE_LOSS: 0.93,
    CONE_LIFE: 3,          // とんだコーンが 消えるまで
    CONE_RESET: 12,        // 元にもどるまで
    SLIP_S0: 2, SLIP_S1: 9, SLIP_D: 1.4,   // 風よけの範囲
    SLIP_T: 1.0,           // これだけ ためると 加速
    SLIP_DECAY: 2,         // 外れたとき へる速さ
    STAR_R: 1.3,           // 星を取る きょり（カートの中心＋0.6m から）
    STARS_MAX: 15,
    STARS_PER_TURBO: 5,
    STAR_RESPAWN_AHEAD: 60, // プレイヤーの この m 手前で 星を出しなおす
    STAR_RIVAL_BACK: 4,    // ライバルが取った星を 出しなおす秒数
    ASSIST: { strong: 0.85, some: 0.45, none: 0.0 },   // おまかせハンドル（調整）
    ASSIST_LOOK: 0.35,     // 先を見る秒数
    ASSIST_PSI: 1.6,
    ASSIST_D: 0.5,
    ASSIST_STEER_CUT: 0.6, // 自分で切ると 助けを へらす
    ASSIST_CENTER: 0.98,   // まっすぐのとき d を まんなかへ寄せる（1秒あたり）
    GRIP_RATE: 14,         // グリップの効き
    ICE_LAG: 0.25          // 氷の上で 進む向きが おくれる秒数
  },

  // 路面（10.8）：[速さの倍率, グリップ]
  surf: {
    road: [1.00, 1.00], packed: [1.00, 0.95], plank: [1.00, 1.00], snowroad: [1.00, 0.92],
    ice: [1.05, 0.40], puddle: [0.60, 0.85], grass: [0.62, 0.85], sand: [0.55, 0.80],
    snow: [0.58, 0.80], walk: [0.80, 0.95]
  },

  // ---------- ライバル（第16部） ----------
  ai: {
    LINE_K: 380,           // 曲がり具合 → すじ のずれ
    LINE_MARGIN: 1.6,      // かべからの余白
    LINE_SMOOTH: 31,       // すじを なめらかにする幅（m）
    BIAS_MAX: 2.0,         // 直線での 好きなずれ
    BIAS_T: [6, 12],       // 選びなおす間隔（秒）
    BIAS_CURVE: 0.3,       // カーブで ずれを へらす
    LOOK_MIN: 6, LOOK_K: 0.6,   // 見る先
    PSI_GAIN: 3.2,
    STEER_SMOOTH: 0.12,
    AVOID_D: 2.4, AVOID_IN: 1.0, AVOID_OUT: 1.5, AVOID_AHEAD: 10, AVOID_LANE: 1.6, AVOID_DV: 0.5,
    NO_PUSH_BACK: 4, NO_PUSH_DV: 0.3,
    START_TAU: 1.5, START_T: 6,
    THR_WOBBLE: 0.05,
    DIFF: {
      easy:   { base: 15.2, alat: 8.5,  spread: [1.06, 1.03, 1.00, 0.97, 0.94], rocket: 0.20, sjump: 0.30, slide: 0.30, trick: 0.20, turbo: 'full',  rbAhead: 0.25, rbBehind: 0.05, assist: 'strong' },
      normal: { base: 17.4, alat: 11.0, spread: [1.06, 1.03, 1.00, 0.97, 0.94], rocket: 0.40, sjump: 0.55, slide: 0.55, trick: 0.35, turbo: 'straight', rbAhead: 0.15, rbBehind: 0.10, assist: 'some' },
      hard:   { base: 18.5, alat: 12.6, spread: [1.04, 1.02, 1.00, 0.98, 0.96], rocket: 0.70, sjump: 0.80, slide: 0.80, trick: 0.55, turbo: 'smart', rbAhead: 0.10, rbBehind: 0.12, assist: 'none' }
    },
    RB_AHEAD0: 20, RB_AHEAD_DIV: 220, RB_BEHIND0: 30, RB_BEHIND_DIV: 260,
    PERSON: {
      mimi:  { rocket: 0.30 },
      goro:  { speed: 1.03, alat: 0.90 },
      tama:  { alat: 1.15 },
      kero:  { sjump: 0.25, trick: 0.25 },
      pen:   { iceGrip: 0.9 },
      pochi: { stars: true, turbo: 'often' }
    }
  },

  // ---------- レース（第17部） ----------
  race: {
    LAPS: 3,
    GRID: [[-7, 2.6], [-10, -2.6], [-16, 2.6], [-19, -2.6], [-25, 2.6], [-28, -2.6]],
    LIGHTS: [1.8, 2.8, 3.8, 4.8],   // 赤1・赤2・赤3・青 の時刻
    LIGHTS_HIDE: 5.6,
    CAM_TO_GRID: 1.2,
    CUE_T: 1.6,            // 合図を出す 秒数前
    CUE_NOW: 0.6,          // 「今！」の光
    CUE_VOICE_LAPS: 2,     // 合図の声を言う周の数
    RUN_CUE_T: 3,          // いきおい < 0.15 が この秒数で 足ぶみの合図
    RUN_CUE_VOICE: 2,
    TURBO_CUE_IDLE: 8, TURBO_CUE_MAX: 3, TURBO_CUE_CLEAR: 60, TURBO_CUE_R: 50,
    SLOWMO: 0.3, SLOWMO_T: 0.8,
    RESULT_AT: 4.0, RANK_AT: 1.5,
    PREDICT_K: 0.98, PREDICT_MINV: 10, PREDICT_GAP: 0.3,
    RESUME_COUNT: 0.7,
    POINTS: [10, 8, 6, 4, 2, 1],
    INTRO_T: { first: 5.5, again: 3.5, retry: 1.5 }
  },

  // ---------- カメラ（第20部） ----------
  cam: {
    DIST0: 5.4, DIST_K: 0.07,
    H0: 2.5, H_K: 0.03,
    LOOK0: 6, LOOK_K: 0.2, LOOK_UP: 1.0,
    YAW_LAG: 0.22,
    TAU_LONG: 0.06, TAU_LAT: 0.12, TAU_UP: 0.18,
    AIR_FOLLOW: 0.5, AIR_LOOK: 0.7,
    FOV0: 58, FOV_V: 10, FOV_BOOST: 6, FOV_MAX: 78, FOV_TAU: 0.3, FOV_PORTRAIT: 14,
    GROUND_CLEAR: 0.8,
    TUNNEL_DIST: 4.6, TUNNEL_H: 1.7, TUNNEL_TAU: 0.4,
    ORBIT_R: 6.5, ORBIT_H: 2.2, ORBIT_W: 0.45,
    TITLE_R: 18, TITLE_H: 5, TITLE_T: 40,
    NEAR: 0.1, FAR: 1800
  },

  // ---------- HUD（第19部） ----------
  hud: {
    W: 1280, H: 720,
    SPEED_LINES_V0: 18, SPEED_LINES_MAX: 14, SPEED_LINES_BOOST: 16, SPEED_LINES_TURBO: 24,
    SPEED_LINES_LIFE: 0.18, SPEED_LINES_INNER: 0.38,
    TOAST_IN: 0.25, TOAST_HOLD: 0.9, TOAST_OUT: 0.25, TOAST_GAP: 0.3,
    TAG_FAR: 60, TAG_NEAR: 15, TAG_HIDE: 7
  },

  // ---------- 音（第23部） ----------
  audio: {
    MASTER: 0.8, MUSIC: 0.55, SFX: 0.9, AMB: 0.35, VOICE: 1.0,
    DUCK: 0.6, DUCK_IN: 0.15, DUCK_OUT: 0.4,
    REVERB: 0.12, REVERB_TUNNEL: 0.45, MUSIC_REVERB: 0.18,
    LOOKAHEAD: 0.12, TICK: 0.025,
    FINAL_TEMPO: 1.06,
    SAME_SFX_GAP: 0.03,
    VOICE_SAME_GAP: 4, VOICE_WAIT: 0.8,
    RIVAL_SOUND_R: 25, RIVAL_SOUND_N: 2
  },

  // ---------- 画質（第28部） ----------
  quality: {
    high: { pr: 2.0, aa: true,  shadow: 2048, shadowBox: 45, particles: 4000, grid: 2.5, lines: 'all' },
    mid:  { pr: 1.5, aa: true,  shadow: 1024, shadowBox: 32, particles: 2500, grid: 2.5, lines: 'all' },
    low:  { pr: 1.0, aa: false, shadow: 0,    shadowBox: 0,  particles: 1000, grid: 5.0, lines: 'boost' },
    DOWN_MS: 24, DOWN_T: 3, UP_MS: 12, UP_T: 8, UP_POSE_MS: 20
  }
};
