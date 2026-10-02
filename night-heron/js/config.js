// 調整用の数値はすべてここに集める。
const NH = window.NH = {};

NH.CONFIG = {
  TILE: 32,            // タイル1枚の大きさ（ワールド座標のpx）
  FPS: 60,             // update の固定レート

  VIEW: {
    TARGET_SHORT: 310, // 画面の短辺に映すワールドの長さの目安（px）。小さいほど拡大される
    MAX_LONG: 760      // 画面の長辺に映すワールドの長さの上限（px）
  },

  PLAYER: {
    SPEED: 132,        // 通常移動（px/秒）
    HIT_W: 18,         // 当たり判定の幅（足元の箱）
    HIT_H: 12,         // 当たり判定の高さ
    ANIM_FPS: 8,       // 歩行アニメの速さ
    CORNER_NUDGE: 10   // 角に引っかかったとき、この px 以内なら自動で滑り込む
  },

  ENEMY: {
    SPEED: 58,         // 巡回の移動（px/秒）
    TURN_SPEED: 300,   // 向きを変える速さ（度/秒）
    FOV: 60,           // 視界の角度（度）
    VIEW_DIST: 5,      // 視界の距離（タイル）
    WAIT_TIME: 2.6,    // 巡回地点で立ち止まる時間（秒）
    LOOK_SWING: 50,    // 立ち止まったとき左右に見回す角度（度）
    LOSE_TIME: 1.5,    // 見失ってから巡回に戻るまで（秒）※フェーズ3で警戒状態に置き換える
    ANIM_FPS: 6,
    CONE_RAYS: 40      // 視界の扇を描くレイの本数
  },

  CAMERA: {
    FOLLOW: 7,         // 追従の速さ（大きいほど機敏）
    LOOK_AHEAD: 26     // 進行方向へ先回りして映す距離（px）
  },

  TOUCH: {
    STICK_RADIUS: 48,  // スティックを倒しきる距離（CSS px）
    DEAD_ZONE: 0.25,   // これ未満の倒し量は無視
    SNAP_8DIR: true    // true で8方向に丸める。false でアナログ方向
  },

  DEBUG: false         // 起動時のデバッグ表示（F1 で切り替え）
};
