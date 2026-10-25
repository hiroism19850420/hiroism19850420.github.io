// はしれ！とべ！ぜんしんダッシュ！ の 調整する数値
// 長さは m、時間は秒、体の長さは 肩はば（u）
export const CFG = {

  // ---------- 体の読みとり（第4部・第5部） ----------
  body: {
    VIS_SHOULDER: 0.5, VIS_WRIST: 0.4, VIS_ELBOW: 0.4, VIS_HIP: 0.5, VIS_KNEE: 0.3, VIS_ANKLE: 0.25, VIS_NOSE: 0.5,
    SMOOTH_U: 0.3,

    // 足ぶみ（グランプリと同じ）
    WIN: 0.6, K_LO: 0.04, K_HI: 0.22, ANKLE_K: 1.0, B_LO: 0.015, B_HI: 0.055,   // 2026-10-22 ユーザー「激甘に」
    STEP_TH: 0.04, STEP_GAP_SH: 0.15, CAD_WIN: 2.0, CAD_FULL: 2.0, CAD_W: 1.0,
    THR_UP: 0.08, THR_DOWN: 0.8, THR_DOWN_SQUAT: 1.2, THR_DOWN_BANZAI: 1.0, AIR_HOLD: true, SH_MASK: 0.4,
    LEG_SENS: { high: 0.7, mid: 1.0, low: 1.35 },
    STEP_RATE_WIN: 1.5,        // 歩数の速さを 数える窓（秒）

    // ジャンプ・しゃがみ（グランプリの 調整ずみの値）
    JUMP_H: 0.26, JUMP_VEL: 1.0, JUMP_GAP: 0.45, LAND_K: 0.4,
    BASE_FAST: 0.8, BASE_SLOW: 6.0, BASE_STILL: 0.12, BASE_FREEZE: -0.3,
    SQUAT_H: 0.42, STAND_K: 0.55,
    SQUAT_MAX: 2.0, BASE_UNSTICK: 0.3,   // 2026-10-25 しゃがみっぱなしの 誤判定：低いまま これだけ つづいたら 基準を 合わせなおす
    SWAP_JUMP: 0.2,                      // 1コマで 腰が これだけ（画像の はば）とんだら 別の人

    // 横にずれる（4.5）
    SHIFT_DEAD: 0.30,                                   // ここまでは まっすぐ（u）
    SHIFT_FULL: { high: 0.60, mid: 0.85, low: 1.10 },   // これで いっぱい（u）（調整）
    SHIFT_PORTRAIT_K: 0.82,                             // 縦の画面は せまいので かける（0.85 → 0.70）
    SHIFT_SMOOTH: 0.08,                                 // ならし（秒）
    BASE_X_T: 1.0,                                      // 基準の立ち位置を 決める 平均の時間
    BASE_X_TAU: 30,                                     // レース中に ゆっくり 合わせる 時定数
    BASE_X_OK: 0.3,                                     // |shift| が これより小さい時だけ 合わせる

    // 手（4.6〜4.9）
    HAND_UP: 0.10,             // 手首が 鼻より これだけ上（u）
    HAND_HOLD: 0.15,           // 片手：これだけ つづけたら（秒）
    BANZAI_UP: 0.10, BANZAI_HOLD: 0.20,
    HAND_DOWN: 0.0,            // 肩より これだけ下に もどったら 次を 数える（u）
    NOSE_FALLBACK: 1.0,
    SWING_WIN: 0.4, SWING_LO: 1.2, SWING_HI: 4.5,       // 腕ふり（u/秒）（調整）
    ARM_OUT: 1.15, ARM_ELBOW: 0.45, ARM_Y: 0.55, ARM_BACK: 0.6, ARM_HOLD: 0.08,   // 手を横に出す（調整）

    // 足を横に出す（4.10）
    LEG_OUT: 0.85, LEG_OTHER: 0.45, LEG_BACK: 0.5, LEG_KNEE_OUT: 0.75, LEG_HOLD: 0.08,  // （調整）
    LIMB_GAP: 1.8,             // 同じ 手（足）の 次まで（秒）

    // 見えなくなる
    LOST_T: 1.0, FOUND_T: 0.6, LOST_T_TWO: 1.5,

    // 2人（5.4）
    TWO_MIN_GAP: 1.2,          // 2人の 腰の 差が これより 近いと「はなれて」（u）
    ASSIGN_HYST: 0.15,         // 入れかわりを ふせぐ（画像の はばの 割合）

    // 読みとりの 間引き
    COST_K: 2.5, MAX_GAP: 125, FEED_DT_MAX: 0.2
  },

  // ---------- メニューの 体の操作（4.12） ----------
  menu: { HAND_REPEAT: 0.8, OK_HOLD: 1.0, BACK_HOLD: 1.0 },

  // ---------- タッチ（4.13） ----------
  touch: {
    TAP_MAP: [[0, 0], [1, 0.15], [3, 0.6], [5, 1.0]],   // たたく速さ（回/秒）→ こぐ量
    TAP_WIN: 1.2,              // 速さを 数える窓（秒）
    TAP_DECAY: 0.5,            // 最後の タップから 0 に なるまで（秒）
    SAME_FOOT: 0.5,            // 同じ足を つづけて たたいたときの 数え方
    SWIPE_PX: 40
  },

  // ---------- キーボード（4.14） ----------
  keys: { THR: 0.85, TAP_ADD: 0.08, SWING: 1.0 },

  // ---------- 走り（第9部） ----------
  run: {
    V_MAX: 21.0, V_FLOOR: 0.18, TH_POW: 0.5,            // 少しの 足ぶみでも 速く（2026-10-22）
    TAU_UP: 0.70, TAU_DOWN: 1.40, TAU_HOLD: 4.0, HOLD_T: 0.8, AIR_DRAG: 0.02,
    V_CARRY: 9.0, V_CWALK: 2.2,
    STUMBLE_K_OBS: 0.72, STUMBLE_K_JAMA: 0.85, STUMBLE_T: 0.8, STUMBLE_CAP: 0.6, SAFE_T: 1.4, STUMBLE_PUSH: 1.5,
    SPURT_MAX: 0.15,
    DRAFT: 0.04, DRAFT_MIN: 0.5, DRAFT_MAX: 4.0, DRAFT_DD: 0.9,
    BOOST_OK: 0.06, BOOST_PERFECT: 0.10, BOOST_T: 0.6,
    ROCKET_V: 0.55, ROCKET_K: 0.10, ROCKET_T: 1.0, ROCKET_PRE: 0.35, ROCKET_POST: 0.25, ROCKET_TH: 0.6,
    G: 26, T_JUMP: 0.55, T_MAX: 0.82, JUMP_EXTRA: 0.22, CLEAR_H: 0.75, LAND_FX_H: 1.2,
    LAT_K: 4.0, LAT_V: 3.2, LAT_V_ASSIST: 5.0, LAT_PASS: 2.4, LAT_TAU: 0.12, AIR_LAT_K: 0.5,
    D_MAX: 3.55, R: 0.42,
    FINISH_JOG: 6, FINISH_STOP: 30,
    ICE_LAT_K: 0.5
  },

  // ---------- コース（第10部） ----------
  course: {
    ROAD_W: 8.0, CURB: 0.6, SHOULDER: 3.0, PRE: 80, POST: 160,
    DIST: { short: 500, mid: 1000, long: 2000 },
    START_CLEAR: { short: 60, mid: 80, long: 80 },
    FINAL_K: 0.2, FINAL_MIN: 100, FINAL_MAX: 300,
    H_A1: 2.0, H_W1: 520, H_A2: 0.8, H_W2: 190, FLAT_START: 60, FLAT_END: 80,
    CHUNK: 150, VIEW_AHEAD: 450, VIEW_BEHIND: 40,
    GATE_D: [-3.125, -1.875, -0.625, 0.625, 1.875, 3.125],
    SIGN_EVERY: 100, LINE_EVERY: 50, FLAG_EVERY: 20, GARLAND_EVERY: 80,
    TERRAIN_X: 320, TERRAIN_NEAR: 60, TERRAIN_DX_NEAR: 3, TERRAIN_DX_FAR: 15, TERRAIN_DZ: 4, TERRAIN_BLEND: 30
  },

  // ---------- 障害物と 合図（第15部） ----------
  obstacles: {
    SPACING: { easy: [95, 120], normal: [88, 112], hard: [78, 100] },
    WEIGHTS: { jump: 30, crouch: 22, dodge: 25, banzai: 11, hand: 12 },
    MAX_SPECIAL: 0.3, NO_TRIPLE: true, JAMA_SPACING_K: 1.4, DOUBLE_GAP: 50,
    INTERVAL: { easy: 1.0, normal: 0.9, hard: 0.75 },   // 数字の 間 I（秒）（調整）
    LEAD_EXTRA: 1.2,
    SHIFT_T: { jump: 0.30, crouch: 0.45, dodge: 0.55, banzai: 0.35, hand: 0.40 },
    OPEN_EXTRA: { jump: 0.15, crouch: 0.15, banzai: 0.25, hand: 0.25 },
    CLOSE_AFTER: { jump: 0.10, crouch: 0.0, dodge: 0.0, banzai: 0.12, hand: 0.12 },
    PERFECT: 0.25, V_ETA_MIN: 4, STALL_V: 1, STALL_T: 2, MISS2_WIDEN: 0.2,
    SIZE: {
      jump:   { ds: 0.25, h: 0.70 },
      crouch: { ds: 0.40, bottom: 1.15 },
      dodge:  { ds: 1.20, gapEdge: 0.95, gapMargin: 0.35 },
      banzai: { ds: 0.30 },
      hand:   { side: 5.5, flight: 0.9 }
    },
    RIVAL_OK: { easy: 0.62, normal: 0.80, hard: 0.92 }, RIVAL_OK_SPREAD: 0.06,
    YIELD_R: 3.0
  },

  // ---------- 馬群（第16部） ----------
  pack: {
    BLOCK_DS0: 0.55, BLOCK_DS1: 1.15, OVERLAP_DD: 0.84, NEAR_DD: 1.2,
    BLOCK_DV: 0.3, PUSH_V: 0.6, CONTACT_LOSS: 0.015, CONTACT_GAP: 0.5, CONTACT_SOUND_DV: 1.2,
    LOOK0: 6, LOOK_K: 0.4, LOOK_DD: 0.95, WANT_DV: 0.6, CAND_OFF: 1.0,
    COST_CROWD: 4, COST_MOVE: 0.6, COST_EDGE: 2, EDGE_D: 3.0, COST_GAP: -1.5, COST_BLOCKED: 3, COST_OUT: -0.3,
    COST_WAIT0: 1.2, COST_WAIT_K: 1.5, DECIDE_HOLD: 0.8, PASS_DONE: 1.6, ESCAPE: 0.5,
    PASS_DD: 2.5, MAKURI_N: 2, MAKURI_T: 3, CHAOS_R: 3, CHAOS_N: 3, START_SPREAD: 30
  },

  // ---------- ライバル（第17部） ----------
  ai: {
    BASE: { easy: 15.6, normal: 18.5, hard: 19.0 },     // （調整）
    SPREAD: {
      easy:   [1.04, 1.02, 1.00, 0.98, 0.96],
      normal: [1.05, 1.02, 1.00, 0.98, 0.95],
      hard:   [1.05, 1.03, 1.01, 0.99, 0.97]
    },
    STYLES: {
      nige:   [1.06, 1.00, 0.97],
      senko:  [1.02, 1.00, 1.00],
      sashi:  [0.98, 1.00, 1.04],
      oikomi: [0.95, 0.99, 1.08]
    },
    STYLE_EDGES: [0.3, 0.8], STYLE_BLEND: 0.1,
    RB: { easy: [0.14, 0.04], normal: [0.10, 0.08], hard: [0.06, 0.12] },
    RB_AHEAD0: 25, RB_AHEAD_W: 50, RB_BEHIND0: 30, RB_BEHIND_W: 60,
    ROCKET_P: { easy: 0.2, normal: 0.4, hard: 0.7 },
    WOBBLE: 0.02, WOBBLE_T: 8,
    SPURT_SKILL: [0.5, 1.0], SPURT_K: 0.10,
    ACT_LATE: [0.2, 0.4], DODGE_REACT: [0.2, 0.8],
    TRAITS: {
      mimi:  { rocket: 0.1 },
      goro:  { push: 1.3, pushed: 0.7 },
      tama:  { crowd: 0.8 },
      kero:  { jumpOk: 0.05, jumpH: 1.2, legJama: 0.6 },
      pen:   { ice: true, crouchOk: 0.05 },
      pochi: { wave: true, jama: 0.7 }
    }
  },

  // ---------- じゃまモード（第18部） ----------
  jama: {
    RANGE_DS: 1.0, RANGE_DD0: 0.6, RANGE_DD1: 1.9,
    HIT_K: 0.85, HIT_T: 0.8, HIT_PUSH: 0.4,
    LAMBDA: { easy: 0.10, normal: 0.18, hard: 0.28 }, ANGRY_K: 3, ANGRY_T: 10, ANGRY_SIDE: -1.0,
    WINDUP: 1.0, ACCEPT: 0.8, AIR_H: 0.25,
    RIVAL_GAP: 5, PLAYER_GAP: 4, CUE_BLOCK: 2.5, END_FREE: 60,
    CPU_LAMBDA: 0.08, DODGE_P: { easy: 0.15, normal: 0.30, hard: 0.45 },
    ARM_P: 0.6, WHIFF_K: 0.92, DODGE_BOOST: 0.06,
    CUTIN_EVERY: 4
  },

  // ---------- ふたり（第19部） ----------
  two: { RB_GAP: 30, RB_FULL: 80, RB_MAX: 0.08, VOICE_SHARE: 0.5, VOICE_SEP: 40, LINE: 6 },

  // ---------- レース（第20部） ----------
  race: {
    READY_T: 0.8, SET_T: 2.8, GO_T: [3.9, 4.5], MUSIC_DELAY: 0.2,
    FINAL_SOON: 80, LAST100: 100,
    FINISH_WAIT: 8, PHOTO: 0.15, PHOTO_T: 1.2, RESCUE: 20,
    COMMENT_GAP: 8, CHEER_GAP_CUE: 1.2, CLOCK_FLASH: 30,
    REST_N: 2, REST_WINDOW: 300, REST_MIN_LEN: 'long'
  },

  // ---------- カメラ（第22部） ----------
  cam: {
    NEAR: 0.1, FAR: 3200,
    land:     { BACK0: 4.6, BACK_K: 0.04, UP0: 2.1, UP_K: 0.02, LOOK0: 7, LOOK_K: 0.25, LOOK_UP: 1.0, FOV0: 58, FOV1: 72, FOV_SPURT: 78 },
    portrait: { BACK0: 5.4, BACK_K: 0.05, UP0: 2.9, UP_K: 0.025, LOOK0: 9, LOOK_K: 0.30, LOOK_UP: 0.8, FOV0: 72, FOV1: 84, FOV_SPURT: 88 },
    half:     { BACK0: 4.4, BACK_K: 0.04, UP0: 2.3, UP_K: 0.0, LOOK0: 7, LOOK_K: 0.0, LOOK_UP: 1.0, FOV0: 62, FOV1: 72, FOV_SPURT: 76 },
    FOV_TAU: 0.3, LAT_TAU: 0.25, ROLL: 2, GROUND_CLEAR: 0.6,
    FINAL_DOWN: 0.3, FINAL_FOV: 3, FINAL_LOOK: 2,
    GO_FOV_KICK: 8,
    SHAKE: { stumble: [0.25, 0.4], jamaGot: [0.30, 0.4], land: [0.10, 0.2], gate: [0.12, 0.3], top: [0.02, 0], firework: [0.05, 0.5] },
    CUT_DIST: 3, CUT_H: 1.3, CUT_IN: 0.12, CUT_OUT: 0.25,
    INTRO_T: 6, ORBIT_R: 5, ORBIT_H: 2.2, ORBIT_T: 12
  },

  // ---------- 画面の表示（第21部） ----------
  hud: { TAG_FAR: 60, TAG_NEAR: 15, TAG_HIDE: 7, TAG_Y: 2.1, LIST_SLIDE: 0.3 },

  // ---------- 擬音とカットイン（第25部） ----------
  giongo: {
    SIZE: { s: 64, m: 112, l: 168, xl: 230 },
    MAX: 3, SAME_GAP: 0.5, LIFE: 1.0, TENSION_LIFE: 1.6, SMALL_RIVAL_GAP: 2,
    QUIET_K: 0.7, PORTRAIT_K: 0.9, HALF_K: 0.8, RING_PAD: 40, EDGE_PAD: 30,
    CACHE: 40,
    CUT_GAP: 8, CUT_MAX: 6, SLOW: 0.25, CUT_IN: 0.10, CUT_HOLD: 0.25, CUT_HOLD_GOAL: 0.9, CUT_OUT: 0.12
  },

  // ---------- エフェクト（第24部） ----------
  fx: {
    WIND_FROM: 0.5, WIND_MAX: 60, LINES_FROM: 0.6, AFTER_FROM: 0.92, AFTER_N: 3, AFTER_EVERY: 0.06,
    TOP_T: 2, AURA_SWING: 0.5, STARS_OK: 12, STARS_PERFECT: 24, CONFETTI_GATE: 40, CONFETTI_GOAL: 200,
    BIG_ADD_MAX: 12
  },

  // ---------- 音（第26部） ----------
  audio: {
    MASTER: 0.8, SFX: 0.9, AMB: 0.35, VOICE: 1.0, DUCK_IN: 0.12, DUCK_OUT: 0.4, REVERB_TUNNEL: 0.3,
    MUSIC: 0.55, DUCK_VOICE: 0.6, DUCK_CUE: 0.45, SFX_L: 0.9, SFX_M: 0.7, SFX_S: 0.35, BEEP: 0.5, STEP: 0.25,
    REVERB: 0.12, MUSIC_REVERB: 0.18, LOOKAHEAD: 0.12, TICK: 0.025,
    BOOST_TEMPO: 1.08, SAME_SFX_GAP: 0.03, VOICE_SAME_GAP: 4, VOICE_WAIT: 0.8,
    RIVAL_STEP_R: 10
  },

  // ---------- れんしゅう（7.5） ----------
  prep: { SEEN_T: 1.0, STEP_T: 2.5, STEP_TH: 0.5, SHIFT_ON: 0.6, SHIFT_ON_T: 0.3, CENTER_T: 0.4, OK_SHOW: 1.0, SKIP_GLOW: 12, DONE_SHOW: 2.5 },

  // ---------- 画質（第23部） ----------
  quality: {
    high: { pr: 2.0, aa: true,  shadow: 2048, shadowBox: 40, particles: 4000, after: 3, aura: 'full' },
    mid:  { pr: 1.5, aa: true,  shadow: 1024, shadowBox: 30, particles: 2500, after: 3, aura: 'full' },
    low:  { pr: 1.0, aa: false, shadow: 0,    shadowBox: 0,  particles: 1000, after: 2, aura: 'lite' },
    DOWN_MS: 24, DOWN_T: 3, UP_MS: 12, UP_T: 8, UP_POSE_MS: 20
  }
};
