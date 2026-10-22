// はしれ！とべ！ぜんしんダッシュ！ の 曲（付録H）
export const SONGS = {

  // タイトル：はしれ！（ヘ長調 148）
  title: {
    bpm: 148, swing: 0, intro: 2,
    lead: ['square', 'bell'], leadOct2: 0,
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:2 R:2 O:2 R:2 F:2 R:2 O:2 R:2',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
    drums2: { clap: '....x.......x...', shaker: 'x.x.x.x.x.x.x.x.' },
    arp: { inst: 'pluck', pattern: 'up8', oct: 4, vol: 0.08 },
    chords: ['F', 'C', 'Dm', 'A#', 'F', 'C', 'A#', 'C', 'Dm', 'Am', 'A#', 'F', 'Gm', 'C', 'F', 'C'],
    melody: [
      'A4:2 C5:2 F5:4 E5:2 F5:2 A5:4',
      'G5:2 E5:2 C5:4 E5:2 G5:2 C6:4',
      'A5:2 F5:2 D5:4 F5:2 A5:2 D6:4',
      'C6:3 A#5:1 A5:2 G5:2 F5:6 r:2',
      'A4:2 C5:2 F5:4 G5:2 A5:2 C6:4',
      'A#5:2 A5:2 G5:2 A5:2 G5:4 E5:4',
      'D5:2 F5:2 A#5:4 A5:2 G5:2 F5:4',
      'E5:2 F5:2 G5:2 A5:2 C6:4 r:4',
      'D6:4 C6:2 A5:2 F5:4 A5:4',
      'C6:4 A5:2 E5:2 C5:4 E5:4',
      'D6:2 C6:2 A#5:2 A5:2 G5:4 A#5:4',
      'A5:4 F5:2 C5:2 F5:6 r:2',
      'G5:2 A5:2 A#5:4 D6:4 A#5:4',
      'C6:2 A#5:2 A5:2 G5:2 E5:4 G5:4',
      'F5:4 A5:4 C6:4 F6:4',
      'E6:2 D6:2 C6:2 A#5:2 G5:4 r:4'
    ]
  },

  // コース1：はらっぱ ダッシュ（ハ長調 160、元気な ロック）
  harappa: {
    bpm: 160, swing: 0, intro: 1,
    lead: ['square', 'pluck'], leadOct2: 0,
    chordInst: 'pluck', chordRhythm: [[0, 1.5], [3, 1.5], [6, 1.5], [8, 1.5], [11, 1.5], [14, 1.5]], chordOct: 4, strum: 0.01,
    bassInst: 'bass', bass: 'R:2 R:2 R:2 R:2 F:2 F:2 O:2 R:2',
    drums: { kick: 'x.x...x.x.x...x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    drums2: { openhat: '..x...x...x...x.', clap: '....x.......x...' },
    arp: null,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'G'],
    melody: [
      'G5:2 G5:2 E5:2 G5:2 C6:4 G5:4',
      'B5:2 B5:2 G5:2 B5:2 D6:4 B5:4',
      'C6:2 B5:2 A5:2 E5:2 A5:4 C6:4',
      'A5:2 G5:2 F5:2 A5:2 G5:6 r:2',
      'E5:2 G5:2 C6:2 E6:2 D6:4 C6:4',
      'B5:2 D6:2 G6:4 F6:2 D6:2 B5:4',
      'C6:2 A5:2 F5:2 A5:2 C6:4 F6:4',
      'E6:2 D6:2 C6:2 B5:2 G5:4 r:4',
      'A5:3 A5:1 C6:4 E6:4 C6:4',
      'B5:3 B5:1 G5:4 E5:4 G5:4',
      'A5:2 C6:2 F6:4 E6:2 D6:2 C6:4',
      'E6:4 G5:2 C6:2 E6:6 r:2',
      'D6:2 F6:2 A6:4 F6:2 D6:2 A5:4',
      'B5:2 D6:2 G6:4 F6:2 D6:2 B5:4',
      'C6:2 E6:2 G6:4 E6:2 C6:2 G5:4',
      'A5:2 B5:2 C6:2 D6:2 G6:6 r:2'
    ]
  },

  // コース2：なみうち ダッシュ（ト長調 156、スチールドラム）
  nami: {
    bpm: 156, swing: 0.08, intro: 1,
    lead: ['steel', 'pluck'], leadOct2: 0,
    chordInst: 'pluck', chordRhythm: [[2, 1], [6, 1], [10, 1], [14, 1]], chordOct: 4, strum: 0.012,
    bassInst: 'bass', bass: 'R:3 F:3 O:2 R:3 F:3 R:2',
    drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: '..x...x...x...x.', conga: 'x..x..x...x..x..' },
    drums2: { congaHi: '..x....x..x...x.', shaker: 'x.x.x.x.x.x.x.x.' },
    arp: { inst: 'steel', pattern: 'updown8', oct: 5, vol: 0.07 },
    chords: ['G', 'C', 'D', 'G', 'Em', 'C', 'D', 'D', 'C', 'D', 'Bm', 'Em', 'Am', 'D', 'G', 'D'],
    melody: [
      'D5:2 G5:2 r:1 B5:3 A5:2 G5:2 B5:4',
      'C6:2 B5:2 r:1 A5:3 G5:2 E5:2 G5:4',
      'F#5:2 A5:2 r:1 D6:3 C6:2 A5:2 F#5:4',
      'G5:6 B5:2 D6:6 r:2',
      'E5:2 G5:2 r:1 B5:3 E6:2 D6:2 B5:4',
      'C6:2 E6:2 r:1 D6:3 C6:2 B5:2 A5:4',
      'A5:2 B5:2 r:1 C6:3 D6:2 E6:2 F#6:4',
      'A6:4 F#6:2 D6:2 A5:6 r:2',
      'E6:3 D6:1 C6:2 B5:2 A5:2 G5:2 E5:4',
      'F#5:3 G5:1 A5:2 B5:2 C6:2 D6:2 A5:4',
      'B5:3 A5:1 B5:2 D6:2 F#6:4 D6:4',
      'E6:6 B5:2 G5:6 r:2',
      'C6:2 B5:2 A5:2 C6:2 E6:4 C6:4',
      'D6:2 C6:2 B5:2 A5:2 F#5:4 A5:4',
      'G5:2 B5:2 D6:2 G6:2 F#6:2 E6:2 D6:4',
      'C6:2 B5:2 A5:2 F#5:2 D5:6 r:2'
    ]
  },

  // コース3：ゆきみち ダッシュ（ニ長調 164、鈴と のこぎり波）
  yuki: {
    bpm: 164, swing: 0, intro: 1,
    lead: ['saw', 'bell'], leadOct2: 0,
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:2 O:2 R:2 O:2 F:2 O:2 R:2 O:2',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    drums2: { sleigh: 'x.x.x.x.x.x.x.x.', openhat: '......x.......x.' },
    arp: { inst: 'bell', pattern: 'up16', oct: 5, vol: 0.06 },
    chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'Bm', 'F#m', 'G', 'D', 'Em', 'A', 'D', 'A'],
    melody: [
      'F#5:2 A5:2 D6:4 C#6:2 D6:2 A5:4',
      'E5:2 A5:2 C#6:4 B5:2 A5:2 E5:4',
      'F#5:2 B5:2 D6:4 C#6:2 B5:2 F#5:4',
      'G5:2 B5:2 D6:2 G6:2 F#6:6 r:2',
      'A5:2 D6:2 F#6:4 E6:2 D6:2 A5:4',
      'C#6:2 E6:2 A6:4 G6:2 E6:2 C#6:4',
      'B5:2 D6:2 G6:4 F#6:2 E6:2 D6:4',
      'C#6:2 D6:2 E6:2 F#6:2 A6:4 r:4',
      'B6:4 A6:2 F#6:2 D6:4 F#6:4',
      'A6:4 F#6:2 C#6:2 A5:4 C#6:4',
      'B5:2 D6:2 G6:2 B6:2 A6:4 G6:4',
      'F#6:4 D6:2 A5:2 D6:6 r:2',
      'E6:2 G6:2 B6:4 A6:2 G6:2 E6:4',
      'C#6:2 E6:2 A6:4 G6:2 E6:2 C#6:4',
      'D6:2 F#6:2 A6:2 D7:2 C#7:2 A6:2 F#6:4',
      'E6:2 F#6:2 G6:2 A6:2 E6:6 r:2'
    ]
  },

  // コース4：よぞら ダッシュ（イ短調 170、電子の 音）
  yozora: {
    bpm: 170, swing: 0, intro: 1,
    lead: ['saw', 'square'], leadOct2: 0,
    chordInst: 'saw', chordRhythm: [[0, 1], [3, 1], [6, 1], [10, 1], [12, 2]], chordOct: 4, chordVol: 0.07,
    bassInst: 'bass', bass: 'R:1 R:1 O:1 R:1 R:1 O:1 R:1 F:1 R:1 R:1 O:1 R:1 R:1 O:1 F:1 O:1',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x' },
    drums2: { clap: '....x.......x..x', openhat: '..x...x...x...x.' },
    arp: { inst: 'saw', pattern: 'up16', oct: 4, vol: 0.05 },
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G', 'F', 'G', 'Em', 'Am', 'Dm', 'E', 'Am', 'E'],
    melody: [
      'A5:2 C6:2 E6:2 A5:2 G6:4 E6:4',
      'F5:2 A5:2 C6:2 F5:2 E6:4 C6:4',
      'G5:2 C6:2 E6:2 G5:2 D6:4 C6:4',
      'B5:2 D6:2 G6:6 r:2 F6:2 D6:2',
      'E6:2 E6:2 A6:2 E6:2 C6:4 A5:4',
      'C6:2 C6:2 F6:2 C6:2 A5:4 F5:4',
      'D6:2 D6:2 G6:2 D6:2 B5:4 G5:4',
      'B5:2 C6:2 D6:2 E6:2 G6:4 r:4',
      'A6:3 G6:1 F6:2 E6:2 C6:4 F6:4',
      'G6:3 F6:1 E6:2 D6:2 B5:4 G6:4',
      'E6:2 G6:2 B6:4 G6:2 E6:2 B5:4',
      'C6:2 E6:2 A6:6 r:2 E6:4',
      'D6:2 F6:2 A6:2 D6:2 C6:2 A5:2 F5:4',
      'G#5:2 B5:2 E6:2 G#6:2 B6:4 G#6:4',
      'A6:2 E6:2 C6:2 A5:2 E6:2 C6:2 A5:4',
      'B5:2 C6:2 D6:2 E6:2 G#6:6 r:2'
    ]
  },

  // れんしゅう：じゅんび たいそう（ハ長調 120）
  prep: {
    bpm: 120, swing: 0, intro: 1,
    lead: ['pluck', 'ep'], leadOct2: 0,
    chordInst: 'pad', chordRhythm: null, chordOct: 3, chordVol: 0.07,
    bassInst: 'bass', bass: 'R:4 F:4 R:4 F:4',
    drums: { kick: 'x.......x.......', hat: '..x...x...x...x.', clap: '....x.......x...' },
    drums2: {},
    arp: null,
    chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'G'],
    melody: [
      'E5:4 G5:4 C6:4 G5:4',
      'F5:4 A5:4 C6:4 A5:4',
      'G5:4 B5:4 D6:4 B5:4',
      'C6:8 G5:8',
      'A5:4 C6:4 E6:4 C6:4',
      'A5:4 F5:4 A5:4 C6:4',
      'B5:4 G5:4 B5:4 D6:4',
      'G5:8 r:8'
    ]
  },

  // けっか（ハ長調 112）
  result: {
    bpm: 112, swing: 0, intro: 0,
    lead: ['ep', 'ep'], leadOct2: 0,
    chordInst: 'pad', chordRhythm: null, chordOct: 3, chordVol: 0.08,
    bassInst: 'bass', bass: 'R:8 F:8',
    drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.' },
    drums2: {},
    arp: null,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'],
    melody: [
      'G5:4 E5:4 C6:8',
      'B5:4 D6:4 G5:8',
      'C6:4 A5:4 E6:8',
      'A5:4 C6:4 F6:8',
      'E6:4 D6:4 C6:4 G5:4',
      'D6:4 B5:4 G5:4 B5:4',
      'A5:4 C6:4 F6:4 A6:4',
      'G6:8 r:8'
    ]
  },

  // 1いで ゴール（1回）
  goalWin: {
    bpm: 140, once: true, intro: 0,
    lead: ['brass', 'brass'], layer: { inst: 'bell', oct: 1 },
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:4 R:4 R:4 R:4',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...' },
    end: 'crash',
    chords: ['C', 'G|C'],
    melody: ['C5:2 E5:2 G5:2 C6:2 E6:4 C6:4', 'D6:2 G6:2 F6:2 D6:2 C7:8']
  },

  // 2い以下で ゴール（1回）
  goalPlay: {
    bpm: 120, once: true, intro: 0,
    lead: ['ep', 'ep'], layer: { inst: 'bell', oct: 1 },
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:8 R:8',
    drums: { kick: 'x.......x.......' },
    end: 'crashSoft',
    chords: ['F', 'C|F'],
    melody: ['C5:4 F5:4 A5:4 C6:4', 'A5:2 G5:2 F5:2 A5:2 F5:8']
  }
};
