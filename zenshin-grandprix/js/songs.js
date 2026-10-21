export const SONGS = {

  title: {
    bpm: 124, swing: 0, intro: 2,
    lead: ['square', 'bell'], leadOct2: 0,
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:2 R:2 O:2 R:2 R:2 R:2 O:2 F:2',
    drums: {
      kick:  'x...x...x...x...',
      snare: '....x.......x...',
      hat:   '..x...x...x...x.'
    },
    drums2: { clap: '....x.......x...', shaker: 'x.x.x.x.x.x.x.x.' },
    arp: null,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'G'],
    melody: [
      'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4',
      'D5:2 G5:2 B5:4 A5:2 G5:2 D5:4',
      'C5:2 E5:2 A5:4 G5:2 E5:2 C5:2 E5:2',
      'F5:4 E5:2 D5:2 C5:6 r:2',
      'E5:2 G5:2 C6:4 D6:2 C6:2 G5:4',
      'B5:2 A5:2 G5:2 A5:2 B5:4 D6:4',
      'C6:3 A5:1 F5:4 G5:3 A5:1 G5:4',
      'D5:2 E5:2 F5:2 G5:2 B5:4 r:4',
      'A5:4 C6:2 A5:2 E5:4 C5:4',
      'B4:4 E5:2 G5:2 B5:6 r:2',
      'A5:2 G5:2 F5:2 A5:2 C6:4 A5:4',
      'G5:4 E5:2 C5:2 E5:6 r:2',
      'F5:2 E5:2 D5:2 F5:2 A5:4 F5:4',
      'G5:2 A5:2 B5:2 D6:2 C6:4 B5:4',
      'C6:6 G5:2 E5:4 G5:4',
      'D6:4 B5:2 G5:2 D5:4 G5:4'
    ]
  },

  meadow: {
    bpm: 140, swing: 0.15, intro: 2,
    lead: ['square', 'pluck'], leadOct2: 0,
    chordInst: 'pluck', chordRhythm: [[4, 1.5], [12, 1.5]], chordOct: 4, strum: 0.012,
    bassInst: 'bass', bass: 'R:4 L:4 R:4 L:4',
    drums: {
      kick:  'x.......x.......',
      snare: '....x.......x...',
      hat:   'x.x.x.x.x.x.x.x.'
    },
    drums2: { shaker: '.x.x.x.x.x.x.x.x' },
    arp: { inst: 'pluck', pattern: 'updown8', oct: 4, vol: 0.12 },
    chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'C', 'G', 'Am', 'D', 'C', 'D', 'G', 'G'],
    melody: [
      'D5:2 G5:2 G5:2 A5:2 B5:4 G5:4',
      'A5:2 F#5:2 D5:2 E5:2 F#5:4 A5:4',
      'G5:2 E5:2 B4:2 E5:2 G5:4 B5:4',
      'A5:4 G5:2 E5:2 G5:8',
      'D5:2 G5:2 G5:2 A5:2 B5:4 D6:4',
      'C6:2 B5:2 A5:2 B5:2 A5:4 F#5:4',
      'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4',
      'A5:4 B5:2 A5:2 F#5:4 D5:4',
      'E5:4 G5:4 C6:4 E6:4',
      'D6:4 B5:2 G5:2 D5:8',
      'C6:2 B5:2 A5:2 E5:2 A5:4 C6:4',
      'B5:2 A5:2 F#5:2 D5:2 F#5:4 A5:4',
      'G5:2 E5:2 C5:2 E5:2 G5:4 C6:4',
      'B5:2 A5:2 F#5:2 A5:2 D6:8',
      'B5:4 D6:2 B5:2 G5:4 A5:2 B5:2',
      'G5:8 r:2 D5:2 E5:2 F#5:2'
    ]
  },

  beach: {
    bpm: 128, swing: 0, intro: 2,
    lead: ['steel', 'bell'], leadOct2: 0,
    chordInst: 'organ', chordRhythm: [[2, 1.5], [6, 1.5], [10, 1.5], [14, 1.5]], chordOct: 4,
    bassInst: 'bass', bass: 'R:3 R:3 O:2 r:2 F:2 R:4',
    drums: {
      kick:   'x.....x...x.....',
      snare:  '....x.......x..x',
      shaker: 'xxxxxxxxxxxxxxxx',
      conga:  '..x..x....x..x..'
    },
    drums2: { hat: '..x...x...x...x.' },
    congaHigh: [5, 13],
    arp: null,
    chords: ['F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'C', 'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'C'],
    melody: [
      'C5:3 F5:3 A5:2 G5:2 F5:2 A5:4',
      'Bb5:3 A5:3 G5:2 F5:2 D5:2 F5:4',
      'E5:3 G5:3 C6:2 Bb5:2 A5:2 G5:4',
      'A5:6 G5:2 F5:8',
      'D5:3 F5:3 A5:2 C6:4 A5:4',
      'Bb5:3 D6:3 C6:2 Bb5:2 A5:2 F5:4',
      'G5:3 A5:3 Bb5:2 A5:2 G5:2 E5:4',
      'G5:8 r:4 C5:4',
      'D6:4 C6:2 Bb5:2 F5:4 D5:4',
      'E5:2 G5:2 C6:4 Bb5:2 A5:2 G5:4',
      'A5:3 C6:3 E6:2 C6:4 A5:4',
      'F5:3 A5:3 D6:2 C6:4 A5:4',
      'Bb5:3 G5:3 D5:2 G5:2 A5:2 Bb5:4',
      'C6:3 Bb5:3 A5:2 G5:4 E5:4',
      'F5:3 A5:3 C6:2 F6:8',
      'E6:2 D6:2 C6:2 Bb5:2 A5:2 G5:2 E5:4'
    ]
  },

  snow: {
    bpm: 150, swing: 0, intro: 2,
    lead: ['bell+saw', 'square'], leadOct2: 0,
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:2 R:2 R:2 R:2 R:2 R:2 O:2 R:2',
    drums: {
      kick:   'x...x...x...x...',
      snare:  '....x.......x...',
      hat:    'x.x.xxx.x.x.xxx.',
      sleigh: 'x.x.x.x.x.x.x.x.'
    },
    drums2: { clap: '....x.......x...' },
    arp: { inst: 'bell', pattern: 'up16', oct: 5, vol: 0.08 },
    chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'D', 'A'],
    melody: [
      'F#5:2 A5:2 D6:2 A5:2 F#5:2 A5:2 D6:4',
      'E6:2 C#6:2 A5:2 C#6:2 E6:4 C#6:4',
      'D6:2 B5:2 F#5:2 B5:2 D6:4 F#6:4',
      'E6:4 D6:2 B5:2 D6:8',
      'F#5:2 A5:2 D6:2 A5:2 F#5:2 A5:2 F#6:4',
      'E6:2 F#6:2 E6:2 C#6:2 A5:4 E5:4',
      'G5:2 B5:2 D6:2 G6:2 F#6:2 E6:2 D6:4',
      'C#6:4 E6:4 A6:8',
      'F#6:4 D6:2 B5:2 F#5:4 B5:4',
      'G6:4 D6:2 B5:2 G5:4 B5:4',
      'A5:2 D6:2 F#6:2 D6:2 A5:4 F#5:4',
      'E5:2 A5:2 C#6:2 E6:2 C#6:4 A5:4',
      'B5:2 D6:2 G6:4 F#6:2 E6:2 D6:4',
      'C#6:2 D6:2 E6:4 A5:2 B5:2 C#6:4',
      'D6:6 F#6:2 A6:8',
      'A5:2 B5:2 C#6:2 D6:2 E6:4 r:4'
    ]
  },

  city: {
    bpm: 118, swing: 0, intro: 2,
    lead: ['saw', 'ep'], leadOct2: 1,
    chordInst: 'ep', chordRhythm: [[0, 3], [6, 2], [10, 4]], chordOct: 4,
    bassInst: 'slap', bass: 'R:2 r:1 R:1 O:2 r:2 R:1 R:1 r:2 F:2 O:2',
    drums: {
      kick:    'x.....x...x.....',
      clap:    '....x.......x...',
      hat:     'XxxxXxxxXxxxXxxx',
      openhat: '..............x.'
    },
    drums2: {},
    sparkle: { inst: 'bell', step: 14, oct: 6 },   // 偶数回目のかざり
    arp: null,
    chords: ['Am7', 'D9', 'Am7', 'D9', 'Fmaj7', 'E7', 'Am7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Bm7b5', 'E7', 'Am7', 'E7'],
    melody: [
      'r:2 E5:2 G5:2 A5:2 C6:2 A5:2 G5:4',
      'F#5:2 A5:2 E5:4 r:4 D5:2 E5:2',
      'r:2 E5:2 G5:2 A5:2 C6:2 D6:2 E6:4',
      'D6:2 C6:2 A5:2 F#5:2 A5:8',
      'r:2 A5:2 C6:2 E6:2 D6:4 C6:4',
      'B5:2 G#5:2 E5:4 D6:4 B5:4',
      'C6:4 B5:2 A5:2 G5:2 E5:2 G5:4',
      'A5:8 r:8',
      'F5:2 A5:2 C6:2 D6:2 F6:4 E6:2 D6:2',
      'B5:2 D6:2 F6:4 E6:2 D6:2 B5:4',
      'C6:2 E6:2 G6:4 E6:2 D6:2 B5:4',
      'A5:4 C6:2 E6:2 D6:8',
      'D6:2 C6:2 B5:2 A5:2 F5:4 D5:4',
      'E5:2 G#5:2 B5:2 D6:2 E6:4 G#5:4',
      'A5:4 E6:4 C6:2 B5:2 A5:4',
      'G#5:4 B5:4 E6:4 D6:2 B5:2'
    ]
  },

  result: {
    bpm: 100, swing: 0, intro: 0,
    lead: ['ep', 'ep'], leadOct2: 0,
    chordInst: 'pad', chordRhythm: null, chordOct: 3, chordVol: 0.08,
    bassInst: 'bass', bass: 'R:16',
    drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.' },
    drums2: {},
    arp: null,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
    melody: [
      'E5:4 G5:4 C6:8',
      'B5:4 A5:4 E5:8',
      'F5:4 A5:4 C6:4 A5:4',
      'G5:8 D5:8',
      'E5:4 G5:4 C6:4 E6:4',
      'D6:4 C6:4 A5:8',
      'F5:4 A5:4 D6:4 C6:4',
      'B5:8 G5:8'
    ]
  },

  final: {
    bpm: 160, once: true, intro: 0,
    lead: ['brass', 'brass'], chordInst: 'brass', chordRhythm: [[0, 2]], chordOct: 4,
    bassInst: null, bass: null,
    drums: { timpani: 'x...x...x...x...' }, drumsLast: { timpani: 'x...............', crash: 'x...............' },
    chords: ['C', 'F|C'],
    melody: ['G4:2 C5:2 E5:2 G5:4 E5:2 G5:4', 'A5:4 G5:2 C6:10']
  },

  goalWin: {
    bpm: 140, once: true, intro: 0,
    lead: ['brass', 'brass'], layer: { inst: 'bell', oct: 1 },
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:4 R:4 R:4 R:4',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...' },
    end: 'crash',
    chords: ['C', 'G|C'],
    melody: ['C5:2 E5:2 G5:2 C6:4 G5:2 C6:4', 'D6:2 E6:2 D6:2 C6:2 G6:8']
  },

  goalPlay: {
    bpm: 120, once: true, intro: 0,
    lead: ['ep', 'ep'], layer: { inst: 'bell', oct: 1 },
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:8 R:8',
    drums: { kick: 'x.......x.......' },
    end: 'crashSoft',
    chords: ['F', 'C|F'],
    melody: ['A4:4 C5:4 F5:4 A5:4', 'G5:2 F5:2 E5:2 G5:2 F5:8']
  },

  podium: {
    bpm: 112, once: true, intro: 0,
    lead: ['brass', 'brass'],
    chordInst: 'pad', chordRhythm: null, chordOct: 3,
    bassInst: 'bass', bass: 'R:8 R:8',
    drums: { timpani: 'x.......x.......' },
    rolls: [3, 7],             // この小節（0 から）の後半に スネアのロール
    waitAfter: 3,              // この小節のあと、ドラムロール（7.15）が終わるまで待つ
    chords: ['C', 'F', 'C', 'G', 'C', 'F', 'G', 'C'],
    melody: [
      'G4:3 G4:1 G4:4 C5:8',
      'A4:3 A4:1 A4:4 F5:8',
      'E5:4 G5:4 C6:4 E6:4',
      'D6:12 r:4',
      'C6:4 E6:4 G6:8',
      'F6:4 E6:4 D6:4 C6:4',
      'D6:4 E6:4 F6:4 D6:4',
      'C6:16'
    ]
  }
};
