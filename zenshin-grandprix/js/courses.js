// コースのデータ。第12〜15部。cps は [x, z, y]（y は高さ）
// gimmicks の s は道にそった位置（m）、d は横のずれ（左が正）
// intro は [s, 高さ, 横, 見る s, 見る高さ]。見る先に at:[x,y,z] を書くと そこを見る
export const COURSES = [
{
  id: 'c1', no: 1, name: 'はらっぱ サーキット', color: '#56d364', biome: 'meadow', music: 'meadow',
  cps: [[0,0,0],[80,0,0],[140,-10,0],[175,-45,0],[180,-95,0],[160,-135,0],[115,-150,0],[70,-130,1],
        [40,-100,2],[0,-95,4],[-40,-120,6],[-90,-130,5],[-130,-105,3],[-145,-60,1],[-125,-20,0],[-80,5,0],[-40,8,0]],
  width: 14, shoulder: 5, road: 'road', offroad: 'grass', wall: 'fence', curbWall: 'hay',
  widthOver: [], bridges: [], tunnels: [], surfaces: [],
  gimmicks: [
    { type: 'stars', s: 30, d: 3, dd: 0 },
    { type: 'pad', s: 70, d: 0 },
    { type: 'stars', s: 200, d: 3, dd: 0.3 },
    { type: 'puddle', s: 300, d: -4.5, rx: 2.6, rz: 4.0 },
    { type: 'cones', s: 392, d: -6.0, n: 4, ds: 3, dd: 0 },
    { type: 'ramp', s: 505, d: 0, len: 8, h: 1.3, width: 14 },
    { type: 'stars', s: 509, d: 0, dd: 0, n: 3, y: [3.4, 3.9, 3.4] },
    { type: 'stars', s: 640, d: 4, dd: 0 },
    { type: 'gate', s: 750 },
    { type: 'puddle', s: 775, d: 4.5, rx: 2.4, rz: 3.6 },
    { type: 'pad', s: 815, d: 3 }
  ],
  signs: [{ kind: 'jump', s: 478, side: -1 }, { kind: 'gate', s: 722, side: -1 }],
  sky: { top: '#3d8fe0', horizon: '#c4e8ff' },
  sun: { dir: [0.45, 0.78, 0.43], color: '#fff3d6', intensity: 2.3 },
  hemi: { sky: '#cfe9ff', ground: '#5a8f3a', intensity: 0.62 },
  fog: { color: '#cfe9ff', density: 0.0026 },
  exposure: 0.92,
  intro: [[400, 70, 90, 300, 0], [470, 35, 40, 505, 2], [700, 22, -30, 750, 2], [-40, 6, 0, 10, 1]],
  terrain: {
    kind: 'meadow', amp: [6.0, 2.5, 0.6], scale: [140, 55, 18], rimFrom: 120, rimK: 0.08,
    colors: { low: '#6cbf4a', high: '#8fd060', steep: '#7aa84a', mown: '#8ad46a', flower: '#9bdc6e' }
  },
  scenery: {
    trees: { kind: 'broadleaf', n: [420, 300, 150], minD: 12, group: [5, 12], insideK: 0.5 },
    flowers: { n: [4000, 2400, 800], minD: 7, group: [60, 150], r: [6, 14] },
    grass: { n: [7000, 3500, 0], minD: 6 },
    rocks: { n: [40, 30, 15], minD: 10 },
    props: [
      { kind: 'windmill', at: [218, -92] },
      { kind: 'barn', at: [55, -55], rot: 0.5 },
      { kind: 'sheep', center: [90, -80], r: 28, n: 12, fence: true },
      { kind: 'pond', center: [-70, -70], r: 18, ducks: 3 },
      { kind: 'balloons', n: 3 },
      { kind: 'stands', s0: -20, s1: 40 },
      { kind: 'flags', s0: -30, s1: 60, step: 5 },
      { kind: 'picnic', s: [180, 230, 270, 320], side: -1 },
      { kind: 'butterflies', n: 30 }
    ],
    far: { kind: 'hills', color: '#a9d6a0', n: 14 },
    clouds: 24
  }
},
{
  id: 'c2', no: 2, name: 'なみのり ビーチ', color: '#3fa9f5', biome: 'beach', music: 'beach',
  cps: [[0,0,1],[70,0,1],[120,15,1],[150,50,1.5],[162,100,2.5],[157,145,2.5],[130,170,2.5],[92,170,2.5],
        [72,145,2.5],[66,115,2.5],[56,92,1.5],[20,79,1],[-40,78,1],[-95,73,1],[-140,50,2],[-155,5,4],
        [-135,-35,3],[-90,-40,2],[-55,-15,1],[-30,0,1]],
  width: 13, shoulder: 6, road: 'packed', offroad: 'sand', wall: 'rope',
  widthOver: [{ s0: 200, s1: 425, w: 11 }],
  bridges: [{ s0: 200, s1: 425, kind: 'pier' }],
  tunnels: [], surfaces: [],
  gaps: [{ s0: 230, s1: 243 }],
  gimmicks: [
    { type: 'stars', s: 40, d: 0, dd: 0.5 },
    { type: 'pad', s: 80, d: -3 },
    { type: 'stars', s: 150, d: -4, dd: 0 },
    { type: 'ramp', s: 228, d: 0, len: 8, h: 1.2, width: 11, gap: true },
    { type: 'stars', s: 232, d: 0, dd: 0, n: 4, y: [3.0, 3.6, 3.6, 3.0] },
    { type: 'pad', s: 262, d: 0 },
    { type: 'stars', s: 320, d: -3, dd: 0 },
    { type: 'pad', s: 395, d: 0 },
    { type: 'gate', s: 500 },
    { type: 'stars', s: 512, d: 0, dd: 0 },
    { type: 'puddle', s: 548, d: 4, rx: 2.4, rz: 3.5 },
    { type: 'puddle', s: 572, d: -3.5, rx: 2.2, rz: 3.2 },
    { type: 'stars', s: 650, d: -3, dd: -0.3 },
    { type: 'cones', s: 722, d: 5.5, n: 4, ds: 3, dd: 0 },
    { type: 'pad', s: 810, d: 0 }
  ],
  signs: [{ kind: 'jump', s: 203, side: -1 }, { kind: 'gate', s: 476, side: -1 }],
  sky: { top: '#2f86d6', horizon: '#c9ecff' },
  sun: { dir: [-0.3, 0.82, 0.48], color: '#fff6e2', intensity: 2.4 },
  hemi: { sky: '#d4efff', ground: '#d9c79a', intensity: 0.62 },
  fog: { color: '#d4efff', density: 0.0021 },
  exposure: 0.92,
  water: { level: 0, shallow: '#45d6c8', deep: '#1f6fb3', foam: true },
  intro: [[300, 60, -80, 236, 2], [215, 12, -18, 240, 2], [520, 18, 30, 500, 2], [-40, 6, 0, 10, 1]],
  terrain: {
    kind: 'beach', shore: { base: 88, a1: 6, f1: 40, a2: 3, f2: 13 },
    land: { base: 1.5, a1: 2.5, s1: 90, a2: 0.8, s2: 25 },
    hills: [{ c: [-188, 2], r: 45, h: 10 }],
    toShore: 25, beachY: -1.5, seaSlope: 0.12, seaMin: -12,
    colors: { sea: '#e8d3a0', seaDeep: '#b9a87a', wet: '#cdb682', beach: '#f2e0b0', landLow: '#c8d77a', landHigh: '#8fc06a' }
  },
  scenery: {
    palms: { n: [160, 110, 60], avenue: { s0: -40, s1: 100, step: 10 }, minD: 9 },
    grass: { n: [2500, 1200, 0], minD: 7, kind: 'beachgrass' },
    rocks: { n: [60, 40, 20], minD: 9, shoreK: 0.7 },
    props: [
      { kind: 'umbrellas', s0: 455, s1: 600, n: 26, side: 1 },
      { kind: 'beachhouse', s: 500, side: -1 },
      { kind: 'lighthouse', at: [-188, 2] },
      { kind: 'yachts', n: 4 },
      { kind: 'buoys', n: 10, around: [110, 140], r: 70 },
      { kind: 'gulls', n: 8 },
      { kind: 'crabs', s0: 460, s1: 600, n: 12, side: 1 },
      { kind: 'surfboards', s0: 470, s1: 590, n: 8, side: 1 },
      { kind: 'stands', s0: -20, s1: 30 },
      { kind: 'flags', s0: -30, s1: 50, step: 6 }
    ],
    far: { kind: 'islands', n: 3 },
    clouds: 20
  }
},
{
  id: 'c3', no: 3, name: 'ゆきやま エイト', color: '#8fd3ff', biome: 'snow', music: 'snow',
  cps: [[-25.5,21.2,0],[0,0,0],[38.2,-38.2,2],[76.5,-68,6],[123.2,-76.5,11],[157.2,-46.8,16],[161.5,0,20],
        [140.2,42.5,21],[97.8,59.5,18],[51,42.5,14],[0,0,11],[-51,-42.5,9],[-97.8,-63.8,7],[-140.2,-51,5],
        [-161.5,-8.5,3.5],[-148.8,38.2,2],[-106.2,59.5,1],[-51,42.5,0]],
  width: 13, shoulder: 4, road: 'snowroad', offroad: 'snow', wall: 'snowbank',
  widthOver: [],
  bridges: [{ s0: 468, s1: 514, kind: 'bridge', under: [20, 48] }],
  tunnels: [{ s0: 285, s1: 335 }],
  surfaces: [{ s0: 420, s1: 452, d0: -6.5, d1: 6.5, type: 'ice' }, { s0: 648, s1: 680, d0: 0, d1: 6.5, type: 'ice' }],
  gimmicks: [
    { type: 'stars', s: 60, d: 3, dd: 0 },
    { type: 'gate', s: 100 },
    { type: 'pad', s: 230, d: -2 },
    { type: 'stars', s: 298, d: 0, dd: 0 },
    { type: 'pad', s: 530, d: 0 },
    { type: 'stars', s: 543, d: 0, dd: 0 },
    { type: 'ramp', s: 565, d: 0, len: 8, h: 1.3, width: 13 },
    { type: 'stars', s: 569, d: 0, dd: 0, n: 3, y: [3.4, 3.9, 3.4] },
    { type: 'stars', s: 700, d: 4, dd: 0 },
    { type: 'pad', s: 850, d: 0 }
  ],
  signs: [{ kind: 'gate', s: 72, side: -1 }, { kind: 'ice', s: 405, side: -1 }, { kind: 'jump', s: 538, side: -1 }, { kind: 'ice', s: 633, side: -1 }],
  sky: { top: '#3f86d6', horizon: '#d3e4f5' },
  sun: { dir: [0.6, 0.55, -0.58], color: '#ffe8c8', intensity: 2.1 },
  hemi: { sky: '#cfe0f5', ground: '#8fa6c4', intensity: 0.55 },
  fog: { color: '#d3e4f5', density: 0.0022 },
  exposure: 0.78,
  intro: [[491, 45, 60, 491, 11], [270, 30, -25, 300, 22], [545, 10, 15, 565, 9], [-40, 6, 0, 10, 1]],
  terrain: {
    kind: 'snow', amp: [14, 5, 1.2], scale: [160, 60, 20],
    bumps: [{ c: [105, -5], r: 70, h: 18 }, { c: [175, 30], r: 45, h: 16 }],
    lake: { c: [-100, 0], r: 32, y: 0.2 },
    colors: { snow: '#f2f6fb', shade: '#bfd2e8', rock: '#8a93a3', lake: '#bfe3f5', low: '#dfe9f4' }
  },
  scenery: {
    firs: { n: [700, 480, 240], minD: 10, group: [6, 16], highK: 1.6 },
    rocks: { n: [50, 35, 15], minD: 10 },
    props: [
      { kind: 'snowmen', n: 8, dSide: 12 },
      { kind: 'cabins', at: [[-62, 88], [-88, 100], [-35, 78], [60, 95], [20, 90]] },
      { kind: 'skilift', from: [90, -30], to: [112, 0], towers: 6, chairs: 14 },
      { kind: 'lake', c: [-100, 0], r: 32 },
      { kind: 'tunnelgate', s: [285, 335] },
      { kind: 'skiflags', n: 40, d: 9, step: 8 },
      { kind: 'stands', s0: -20, s1: 30 },
      { kind: 'snowfall' }
    ],
    far: { kind: 'snowpeaks', n: 9 },
    clouds: 14
  }
},
{
  id: 'c4', no: 4, name: 'ほしぞら シティ', color: '#9b6bff', biome: 'city', music: 'city',
  cps: [[0,0,0],[108,0,0],[131.8,-4,0],[149,-18,0],[154.4,-40,0],[154.4,-110,0],[149,-132,0],[131.8,-146,0],
        [108,-151,0],[43.2,-151,5],[19.4,-146,6],[6.5,-131,6],[2.2,-110,6],[2.2,-85,5],[-2.2,-68,4],[-16.2,-56,2],
        [-41,-52,0],[-102.6,-52,0],[-130,-52,0],[-146,-47.5,0],[-157,-36,0],[-161,-23,0],[-157,-9,0],[-146,2,0],
        [-130,6.5,0],[-86.4,8,0],[-43.2,4,0]],
  width: 14, shoulder: 1.5, road: 'road', offroad: 'walk', wall: 'guard', night: true,
  widthOver: [],
  bridges: [{ s0: 203, s1: 231, kind: 'bridge', arch: true }, { s0: 352, s1: 522, kind: 'viaduct' }],
  tunnels: [], surfaces: [],
  gimmicks: [
    { type: 'stars', s: 40, d: 3, dd: 0 },
    { type: 'pad', s: 60, d: -3 },
    { type: 'pad', s: 175, d: 0 },
    { type: 'stars', s: 213, d: 0, dd: 0 },
    { type: 'pad', s: 315, d: 0 },
    { type: 'stars', s: 345, d: 0, dd: 0 },
    { type: 'pad', s: 540, d: 0 },
    { type: 'ramp', s: 575, d: 0, len: 8, h: 1.3, width: 14 },
    { type: 'stars', s: 579, d: 0, dd: 0, n: 3, y: [3.4, 3.9, 3.4] },
    { type: 'cones', s: 606, d: -6.2, n: 5, ds: 2.5, dd: 0 },
    { type: 'stars', s: 650, d: 4, dd: 0.2 },
    { type: 'pad', s: 740, d: 0 },
    { type: 'gate', s: 760 },
    { type: 'stars', s: 790, d: 0, dd: 0 }
  ],
  signs: [{ kind: 'jump', s: 548, side: -1 }, { kind: 'gate', s: 735, side: -1 }],
  sky: { top: '#0b1030', horizon: '#33307a', night: true },
  sun: { dir: [-0.4, 0.7, -0.6], color: '#b8c8ff', intensity: 0.9, moon: true },
  hemi: { sky: '#3a4a9a', ground: '#151828', intensity: 0.55 },
  fog: { color: '#1d1f4a', density: 0.0032 },
  exposure: 1.15,
  water: { level: -1.2, shallow: '#1a2a4a', deep: '#0a1020', river: { z: -80, half: 10 } },
  intro: [[120, 70, -120, 0, 0, { at: [80, 20, -115] }], [420, 25, 30, 440, 6], [750, 8, 12, 790, 3], [-40, 6, 0, 10, 1]],
  terrain: {
    kind: 'city', river: { z: -80, half: 10, bank: 3, depth: -3 },
    park: { x0: 20, x1: 140, z0: -135, z1: -93 },
    colors: { ground: '#2b2f40', park: '#1f3a2a', riverbed: '#101828' }
  },
  scenery: {
    buildings: { n: [260, 180, 110], minD: 17.5, h: [12, 60], avoidPark: true, avoidRiver: 13 },
    props: [
      { kind: 'lamps', step: 18, d: 9 },
      { kind: 'neon', n: 30 },
      { kind: 'ferris', at: [80, -115], r: 20 },
      { kind: 'fireworks', at: [80, 75, -115] },
      { kind: 'lighttunnel', s0: 765, s1: 815, step: 5 },
      { kind: 'parktrees', n: 40 },
      { kind: 'stands', s0: -20, s1: 30, penlights: true }
    ],
    far: { kind: 'skyline', n: 160 },
    clouds: 0
  }
}
];
