// はしれ！とべ！ぜんしんダッシュ！ の コース（付録G）
// 世界の座標：x = 横（右が正）、z = −s（ゴールへ 向かって z が へる）
export const COURSES = [
{
  id: 'c1', no: 1, name: 'はらっぱ ストレート', short: 'はらっぱ', color: '#56d364', card: ['#9be37a', '#4fb84a'],
  biome: 'meadow', music: 'harappa', voice: 'i_c1', amb: 'meadow',
  sky: { top: '#3d8fe0', horizon: '#c4e8ff' },
  sun: { dir: [0.45, 0.78, 0.43], color: '#fff3d6', intensity: 2.3 },
  hemi: { sky: '#cfe9ff', ground: '#5a8f3a', intensity: 0.62 },
  fog: { color: '#cfe9ff', density: 0.0024 },
  exposure: 0.92,
  hPhase: [0.0, 1.3],
  road: { kind: 'track', base: '#c8664a', dark: '#a8523a', light: '#d98466', line: '#ffffff', curb: ['#ffffff', '#e8483b'], cross: '#ffffff' },
  edge: { kind: 'fence', color: '#ffffff', post: '#e8e2d4' },
  terrain: {
    kind: 'meadow', amp: [6.0, 2.5, 0.6], scale: [140, 55, 18],
    colors: { low: '#6cbf4a', high: '#8fd060', steep: '#7aa84a', mown: '#8ad46a', flower: '#9bdc6e' }
  },
  water: null,
  far: { kind: 'hills', color: '#a9d6a0', n: 14 },
  clouds: 24,
  scenery: {
    trees: { kind: 'broadleaf', per100: [28, 20, 10], minX: 12, maxX: 140, group: [3, 9] },
    bushes: { per100: [26, 18, 8], minX: 7.8, maxX: 22, group: [2, 5] },
    flowers: { per100: [520, 330, 110], minX: 7.5, maxX: 40, group: [25, 70] },
    grass: { per100: [1400, 800, 200], minX: 7.2, maxX: 60 },
    rocks: { per100: [2, 1.5, 1], minX: 9, maxX: 80 },
    flags: { every: 20, x: 6.2, colors: ['#ff5a4a', '#ffd54a', '#3fa9f5', '#56d364', '#ff6fa8'] },
    garland: { every: 80, h: 6.5 },
    crowd: { every: 120, n: [3, 8], x: [7.5, 10] },
    props: [
      { kind: 'windmill', x: -150, f: 0.35, every: 700 },
      { kind: 'barn', x: -85, f: 0.2, rot: 0.5, every: 900 },
      { kind: 'sheep', x: -60, f: 0.5, r: 22, n: 10, every: 800 },
      { kind: 'pond', x: 70, f: 0.62, r: 16, ducks: 3, every: 1100 },
      { kind: 'picnic', x: 9, every: 230, side: 1 },
      { kind: 'sunflowers', x: -8.5, every: 160, len: 40 },
      { kind: 'balloons', n: 3 },
      { kind: 'butterflies', n: 30 },
      { kind: 'stands', at: 'start' }, { kind: 'stands', at: 'goal' }
    ]
  },
  obstacles: {
    jump:   { kind: 'log',    colors: { wood: '#9a6a3a', end: '#d9b07a', stand: '#7a5230' } },
    crouch: { kind: 'branch', colors: { trunk: '#7a5230', leaf: '#4fae3a', leaf2: '#7ccf4a' } },
    dodge:  { kind: 'hay',    colors: { hay: '#e8c25a', band: '#c89a3a', dark: '#b8902e' } },
    banzai: { kind: 'paper',  colors: { a: '#ffffff', b: '#e8483b', frame: '#c8a060', text: 'がんばれ' } },
    hand:   { kind: 'cannon', colors: { body: '#8a5a30', ring: '#d4a14a' }, balls: ['#ff5a4a', '#ffd54a', '#3fa9f5', '#ff6fa8'] }
  },
  special: {}
},
{
  id: 'c2', no: 2, name: 'なみうち ビーチ', short: 'ビーチ', color: '#3fa9f5', card: ['#8fe3ff', '#3fa9f5'],
  biome: 'beach', music: 'nami', voice: 'i_c2', amb: 'beach',
  sky: { top: '#3a8fe0', horizon: '#ffe0b2' },
  sun: { dir: [-0.5, 0.55, 0.6], color: '#ffe7c4', intensity: 2.4 },
  hemi: { sky: '#d4efff', ground: '#d9c79a', intensity: 0.62 },
  fog: { color: '#f5dcc0', density: 0.0019 },
  exposure: 0.92,
  hPhase: [1.1, 0.4], hAmp: 0.3,
  road: { kind: 'sand', base: '#e2c48e', dark: '#c9a874', light: '#efd8a8', wet: '#b89a6a', line: '#ffffff', curb: ['#ffffff', '#ffffff'], cross: '#a07a4a' },
  edge: { kind: 'rope', color: '#ffffff', post: '#c9a070' },
  terrain: {
    kind: 'beach', shoreX: 13, shoreWig: [3, 120, 1.2, 37], landX: -14,
    land: { base: 1.2, a1: 2.0, s1: 80, a2: 0.6, s2: 25 }, seaSlope: 0.12, seaMin: -10,
    colors: { sea: '#e8d3a0', seaDeep: '#b9a87a', wet: '#cdb682', beach: '#f2e0b0', landLow: '#c8d77a', landHigh: '#8fc06a' }
  },
  water: { level: -1.6, shallow: '#45d6c8', deep: '#1f6fb3', foam: true, side: 1 },
  far: { kind: 'islands', n: 3, side: 1 },
  clouds: 20,
  scenery: {
    palms: { per100: [10, 7, 4], minX: -40, maxX: -8, avenue: { every: 24, x: -8.5 } },
    grass: { per100: [320, 190, 50], minX: -60, maxX: -9, kind: 'beachgrass' },
    rocks: { per100: [1.5, 1, 0.5], minX: 14, maxX: 40, shore: true },
    flags: { every: 24, x: -6.4, colors: ['#ff7a2f', '#ffd54a', '#45d6c8', '#ff6fa8'] },
    garland: { every: 100, h: 6.5 },
    crowd: { every: 150, n: [2, 6], x: [-10, -7.5] },
    props: [
      { kind: 'umbrellas', x: [-30, -10], every: 90, n: 4 },
      { kind: 'beachhouse', x: -26, f: 0.45, every: 800 },
      { kind: 'lighthouse', x: 160, f: 0.85 },
      { kind: 'yachts', n: 4 },
      { kind: 'buoys', n: 14, x: [30, 90] },
      { kind: 'gulls', n: 10 },
      { kind: 'crabs', x: [-12, 12], every: 60, n: 2 },
      { kind: 'surfboards', x: -11, every: 140, n: 3 },
      { kind: 'shells', per100: 30, x: [-4, 4] },
      { kind: 'stands', at: 'start' }, { kind: 'stands', at: 'goal' }
    ]
  },
  obstacles: {
    jump:   { kind: 'wave',     colors: { water: '#45c8e0', foam: '#ffffff', deep: '#2b8fd0' } },
    crouch: { kind: 'palmArch', colors: { trunk: '#a07a4a', leaf: '#3fae5a', leaf2: '#6cd06a' } },
    dodge:  { kind: 'castle',   colors: { sand: '#e8c890', dark: '#c9a070', flag: '#ff5a4a' } },
    banzai: { kind: 'paper',    colors: { a: '#ffffff', b: '#ff7a2f', frame: '#45c8e0', text: 'なつだ！' } },
    hand:   { kind: 'crab',     colors: { body: '#e8483b', claw: '#ff6a4a' }, balls: ['#ffffff|#ff5a4a', '#ffffff|#3fa9f5', '#ffffff|#ffd54a'] }
  },
  special: { shoreSplash: true }
},
{
  id: 'c3', no: 3, name: 'ゆきみち ロード', short: 'ゆきみち', color: '#8fd3ff', card: ['#e6f4ff', '#8fc3ee'],
  biome: 'snow', music: 'yuki', voice: 'i_c3', amb: 'snow',
  sky: { top: '#7fa6d6', horizon: '#d3e4f5' },
  sun: { dir: [0.6, 0.55, -0.58], color: '#ffe8c8', intensity: 2.0 },
  hemi: { sky: '#cfe0f5', ground: '#8fa6c4', intensity: 0.58 },
  fog: { color: '#d3e4f5', density: 0.0030 },
  exposure: 0.84,
  hPhase: [2.2, 3.0],
  road: { kind: 'snow', base: '#e9f2fb', dark: '#c9d8ea', light: '#ffffff', line: '#7fb2e5', curb: ['#ffffff', '#e8483b'], cross: '#7fb2e5', ice: '#bfe3ff' },
  edge: { kind: 'snowbank', color: '#f2f6fb', h: 1.2 },
  terrain: {
    kind: 'snow', amp: [14, 5, 1.2], scale: [160, 60, 20],
    colors: { snow: '#f2f6fb', shade: '#bfd2e8', rock: '#8a93a3', lake: '#bfe3f5', low: '#dfe9f4' }
  },
  water: null,
  far: { kind: 'snowpeaks', n: 9 },
  clouds: 14,
  scenery: {
    firs: { per100: [40, 28, 14], minX: 10, maxX: 150, group: [5, 14] },
    rocks: { per100: [3, 2, 1], minX: 10, maxX: 90 },
    flags: { every: 16, x: 5.4, kind: 'pole', colors: ['#e8483b', '#ffffff'] },
    garland: { every: 120, h: 6.5, kind: 'lights' },
    crowd: { every: 180, n: [2, 5], x: [7.5, 10] },
    props: [
      { kind: 'snowmen', x: [-14, 14], every: 140 },
      { kind: 'cabins', x: [-60, -30], f: 0.3, every: 600, n: 3 },
      { kind: 'skilift', x: 60, f: 0.55, every: 1000 },
      { kind: 'skiflags', x: 9, every: 12 },
      { kind: 'stands', at: 'start' }, { kind: 'stands', at: 'goal' },
      { kind: 'snowfall' }
    ]
  },
  obstacles: {
    jump:   { kind: 'snowbank', colors: { snow: '#f7fbff', shade: '#c9dcf0' } },
    crouch: { kind: 'icicle',   colors: { wood: '#7a5230', snow: '#ffffff', ice: '#bfe8ff' } },
    dodge:  { kind: 'snowman',  colors: { snow: '#ffffff', scarf: '#e8483b', bucket: '#5a6a7a', nose: '#ff9f1c' } },
    banzai: { kind: 'paper',    colors: { a: '#ffffff', b: '#7fb2e5', frame: '#e8483b', text: 'ゆき！' } },
    hand:   { kind: 'snowmanSmall', colors: { snow: '#ffffff', hat: '#3f8ff5' }, balls: ['#ffffff'] }
  },
  special: { ice: [{ f: 0.28, len: 30 }, { f: 0.55, len: 40 }, { f: 0.78, len: 25 }] }
},
{
  id: 'c4', no: 4, name: 'よぞら ストリート', short: 'よぞら', color: '#9b6bff', card: ['#3a3f9a', '#151840'],
  biome: 'city', music: 'yozora', voice: 'i_c4', amb: 'city',
  sky: { top: '#0b1030', horizon: '#33307a', night: true },
  sun: { dir: [-0.4, 0.7, -0.6], color: '#b8c8ff', intensity: 0.9, moon: true },
  hemi: { sky: '#3a4a9a', ground: '#151828', intensity: 0.55 },
  fog: { color: '#1d1f4a', density: 0.0030 },
  exposure: 1.15,
  hPhase: [0.6, 2.0],
  road: { kind: 'asphalt', base: '#3a3f52', dark: '#2e3242', light: '#4a5066', line: '#ffffff', center: '#ffd23f', curb: ['#ffd23f', '#1d2433'], cross: '#ffffff', wet: true },
  edge: { kind: 'guard', color: '#c8d0e0' },
  terrain: { kind: 'city', colors: { ground: '#2b2f40', park: '#1f3a2a', walk: '#585e70' } },
  water: null,
  far: { kind: 'skyline', n: 160 },
  clouds: 0,
  scenery: {
    buildings: { per100: [9, 6, 4], minX: 14, maxX: 120, h: [12, 70] },
    lamps: { every: 20, x: 6.0 },
    flags: null,
    garland: { every: 80, h: 7, kind: 'lights' },
    crowd: { every: 140, n: [2, 6], x: [7.5, 10], penlights: true },
    props: [
      { kind: 'neon', every: 45, x: [10, 16] },
      { kind: 'lighttunnel', f: 0.45, len: 200, step: 15 },
      { kind: 'ferris', x: 150, f: 0.7 },
      { kind: 'fireworks', x: 120, f: 0.8 },
      { kind: 'parktrees', x: [-20, -12], every: 120, n: 4 },
      { kind: 'stands', at: 'start', penlights: true }, { kind: 'stands', at: 'goal', penlights: true }
    ]
  },
  obstacles: {
    jump:   { kind: 'barrier',  colors: { a: '#ffd23f', b: '#1d2433', lamp: '#ff3b30' } },
    crouch: { kind: 'beam',     colors: { a: '#ffd23f', b: '#1d2433', post: '#8a93a3', lamp: '#ffb000' } },
    dodge:  { kind: 'crates',   colors: { list: ['#ff5a4a', '#3fa9f5', '#56d364', '#ffd54a', '#9b6cf0'], band: '#ffffff' } },
    banzai: { kind: 'paper',    colors: { a: '#ffffff', b: '#9b6bff', frame: '#ff3bd0', text: 'はしれ！', neon: true } },
    hand:   { kind: 'robot',    colors: { body: '#c8d0e0', eye: '#3bf0ff', arm: '#8a93a3' }, balls: ['#ff3bd0', '#3bf0ff', '#ffd23f'], glow: true }
  },
  special: { footTrails: true, wetRoad: true }
}
];

export const DISTS = [
  { id: 'short', name: 'みじかい', m: 500,  note: '30びょう くらい。はじめての ひとに', drops: 1 },
  { id: 'mid',   name: 'ふつう',   m: 1000, note: '1ぷん くらい', drops: 2 },
  { id: 'long',  name: 'ながい',   m: 2000, note: '2ふん くらい。たくさん あせを かくよ', drops: 3 }
];

export const DIFFS = [
  { id: 'easy',   name: 'のんびり', color: '#56d364', note: 'はじめての 人に。ライバルは ゆっくり。手は どちらでも OK' },
  { id: 'normal', name: 'ふつう',   color: '#ff7a2f', note: 'なれてきたら。いい しょうぶ' },
  { id: 'hard',   name: 'はやい',   color: '#ff4d4d', note: 'おとなも ほんき。ずっと あしぶみ！' }
];

export const MODES = [
  { id: 'solo', name: 'ひとりで はしる', icon: '🏃' },
  { id: 'jama', name: 'じゃまモード',   icon: '😈' },
  { id: 'two',  name: 'ふたりで たいせん', icon: '👫' }
];
