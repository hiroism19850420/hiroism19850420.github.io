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
    CORNER_NUDGE: 10,  // 角に引っかかったとき、この px 以内なら自動で滑り込む

    CRAWL_SPEED: 52,     // 匍匐の移動（px/秒）
    CRAWL_ANIM_FPS: 5,
    KO_RANGE: 40,        // 背後からこの距離まで近づくと気絶させられる（px）
    KO_BEHIND: 110,      // 敵の正面からこの角度（度）より後ろ側にいれば「背後」
    KNOCK_RADIUS: 7,     // 壁叩きの音が届く距離（タイル）
    KNOCK_COOLDOWN: 0.8, // 壁叩きの間隔（秒）
    STEP_RADIUS: 4.5,    // 金属床・水たまりの足音が届く距離（タイル）
    STEP_INTERVAL: 0.32, // 足音の間隔（秒）

    MAX_LIFE: 100,
    HURT_INVULN: 0.25,   // 被弾したあと無敵になる時間（秒）
    BOX_SPEED: 70,       // 段ボール箱をかぶったときの移動（px/秒）

    // 麻酔銃
    GUN_AMMO: 5,         // 拾ったときの弾数
    AMMO_PACK: 3,        // 弾薬を拾ったときに増える数
    FIRE_COOLDOWN: 0.5,  // 連射の間隔（秒）
    DART_SPEED: 420,     // 弾の速さ（px/秒）
    DART_RANGE: 9,       // 弾が届く距離（タイル）
    DART_NOISE: 2.5,     // 外れて壁に当たったときの音が届く距離（タイル）

    RATION_HEAL: 50      // 回復アイテムで戻るライフ
  },

  ENEMY: {
    SPEED: 66,         // 巡回の移動（px/秒）
    TURN_SPEED: 300,   // 向きを変える速さ（度/秒）
    FOV: 70,           // 視界の角度（度）　※仕様の初期値は 60
    VIEW_DIST: 6.5,    // 視界の距離（タイル）※仕様の初期値は 5
    WAIT_TIME: 2.2,    // 巡回地点で立ち止まる時間（秒）
    LOOK_SWING: 65,    // 立ち止まったとき左右に見回す角度（度）
    ANIM_FPS: 6,
    CONE_RAYS: 40,     // 視界の扇を描くレイの本数
    HIT_W: 18,         // 経路上の当たり判定の幅
    HIT_H: 12,

    // 気づくまでの時間。視界に入っている間ゲージがたまり、満タンで「発見」
    SIGHT_TIME_NEAR: 0.12, // 目の前にいるとき、発見までの秒数
    SIGHT_TIME_FAR: 0.55,  // 視界の端（最遠）にいるとき、発見までの秒数
    GAUGE_DECAY: 0.7,      // 視界から外れたときにゲージが減る速さ（/秒）
    SUSPECT_AT: 0.35,      // ゲージがここを超えると「疑念」
    TOUCH_DIST: 14,        // この距離まで近づくと、向きに関係なく気づかれる（px）
    CRAWL_VIEW_MULT: 0.5,  // 匍匐中のプレイヤーに対する視界距離の倍率
    STUN_TIME: 12,         // 気絶している時間（秒）

    // 疑念
    NOTICE_TIME: 0.7,      // 「？」を出して立ち止まる時間
    SUSPECT_SPEED: 80,     // 見に行く速さ
    SUSPECT_LOOK_TIME: 3,  // 着いてから見回す時間

    // 発見・警戒・捜索
    REACT_TIME: 0.5,       // 「！」を出してから走り出すまで
    ALERT_SPEED: 120,      // 追跡の速さ（プレイヤーは 132）
    SLEEP_TIME: 20,        // 麻酔弾で眠っている時間（秒）

    // 攻撃（警戒中、プレイヤーが見えていて射程内なら撃つ）
    SHOOT_RANGE: 6,        // 射程（タイル）
    SHOOT_KEEP: 3,         // 撃ちながら、この距離までは詰めてくる（タイル）
    SHOOT_FIRST: 0.5,      // 見つけてから最初の1発まで（秒）
    SHOOT_INTERVAL: 0.8,   // 発射の間隔（秒）
    BULLET_SPEED: 360,     // 弾の速さ（px/秒）
    BULLET_SPREAD: 0.07,   // 弾のばらつき（ラジアン）
    BULLET_DAMAGE: 10,
    SEARCH_SPEED: 92,      // 捜索中の速さ
    SEARCH_LOOK_TIME: 1.6, // 捜索中、1か所で見回す時間
    SEARCH_RADIUS: 6       // 最後に見た地点から、この範囲を探す（タイル）
  },

  ALERT: {
    ALERT_TIME: 10,    // 警戒の残り時間（秒）。見られている間は減らない
    SEARCH_TIME: 14,   // 捜索の残り時間（秒）

    // 持ち場を離れて駆けつけるのは近くの敵だけ。残りは持ち場で厳戒態勢になる
    RESPOND_DIST: 13,        // 最後に見た地点からこの距離までの敵が駆けつける（タイル）
    MIN_RESPONDERS: 3,       // 近くに誰もいなくても、最低この人数は駆けつける
    CAUTION_SIGHT_MULT: 2.5, // 厳戒中の敵が気づく速さの倍率
    CAUTION_SPEED_MULT: 1.25,// 厳戒中の巡回の速さの倍率
    DUCT_LOCK: true          // 警戒・捜索中は通気口のシャッターが閉まり、外から入れなくなる
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
