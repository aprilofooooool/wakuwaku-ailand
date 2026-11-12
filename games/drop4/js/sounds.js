(function (G) {
  'use strict';

  var S = Ailand.core.Sound;
  var note = S.note;
  var seq = S.seq;

  // The drop animation (fx.js, css d4-drop) lands at 55% and lands again at 86% of dropMs,
  // so the second bounce sound is 0.31 * dropMs after the first. Callers pass { rows } (or { gapMs }).
  var BOUNCE_RATIO = 0.31;
  var DEFAULT_GAP_S = 0.14;

  function bounceGap(opts) {
    if (typeof opts.gapMs === 'number') { return opts.gapMs / 1000; }
    if (typeof opts.rows === 'number' && G.Fx) { return BOUNCE_RATIO * G.Fx.dropMs(opts.rows) / 1000; }
    return DEFAULT_GAP_S;
  }

  var SOUNDS = {
    drop: function (c, d, t, o) {
      note(c, d, t, 520, 0, 0.08, 'sine', 0.6, 260);
      note(c, d, t, 440, bounceGap(o), 0.06, 'sine', 0.3, 230);
    },
    pop: function (c, d, t) { note(c, d, t, 300, 0, 0.12, 'triangle', 0.5, 700); },
    reach: function (c, d, t) { seq(c, d, t, [523, 659, 784], 0.09, 0.16, 'triangle', 0.5); },
    block: function (c, d, t) {
      note(c, d, t, 120, 0, 0.18, 'square', 0.35, 70);
      note(c, d, t, 1397, 0.05, 0.22, 'sine', 0.3);
    },
    double: function (c, d, t) {
      seq(c, d, t, [523, 659, 784, 1047, 1319], 0.055, 0.14, 'triangle', 0.45);
      note(c, d, t, 1568, 0.3, 0.3, 'sine', 0.22);
      note(c, d, t, 1319, 0.36, 0.3, 'sine', 0.16);
    },
    win: function (c, d, t) { seq(c, d, t, [523, 659, 784, 659, 784, 1047], 0.13, 0.26, 'triangle', 0.5); },
    lose: function (c, d, t) { seq(c, d, t, [392, 330], 0.3, 0.45, 'sine', 0.4); },
    draw: function (c, d, t) {
      seq(c, d, t, [440, 440], 0.18, 0.16, 'triangle', 0.4);
      seq(c, d, t + 0.5, [440, 440], 0.18, 0.16, 'triangle', 0.4);
    },
    button: function (c, d, t) { note(c, d, t, 900, 0, 0.04, 'square', 0.15); }
  };

  Object.keys(SOUNDS).forEach(function (name) { S.register(name, SOUNDS[name]); });

  // BGM "ぽよんぽよんシャッフル" (design 2026-11-12-bgm-variety §2): a bouncy Bb major shuffle, 100 bpm,
  // 8 bars of 4/4 (32 beats). Off-beat 8ths swing to the triplet position (swing 1/6). Sine melody that boings up
  // into each note (bend 0.82) with big leaps; triangle bass hopping by octaves, soft sine off-beat chords,
  // kick 1&3 and swung hi-hats. Chords: Bb Gm Cm F | Bb Gm Eb-F Bb. Endgame: Bgm.setTempo(ENDGAME_BPM).
  var C3 = 130.81, D3 = 146.83, EB3 = 155.56, F3 = 174.61, G3 = 196, A3 = 220, BB2 = 116.54, BB3 = 233.08;
  var C4 = 261.63, D4 = 293.66, EB4 = 311.13, F4 = 349.23, G4 = 392;
  var BB4 = 466.16, C5 = 523.25, D5 = 587.33, EB5 = 622.25, F5 = 698.46, G5 = 783.99, A5 = 880, BB5 = 932.33;
  var C6 = 1046.5, D6 = 1174.66;

  // Per bar: [bass root, bass octave or fifth, chord]; bar 7 (null) is split Eb | F. All >= 100 Hz.
  var BARS = [
    [BB2, BB3, [D4, F4]], [G3, D3, [BB3, D4]], [C3, C4, [EB4, G4]], [F3, C3, [A3, C4]],
    [BB2, BB3, [D4, F4]], [G3, D3, [BB3, D4]], null, [BB2, BB3, [D4, F4]]
  ];
  var BASS = [], CHORDS = [], DRUMS = [];
  BARS.forEach(function (b) {
    if (!b) {
      BASS.push([EB3, 0.5], [0, 0.5], [EB4, 0.5], [0, 0.5], [F3, 0.5], [0, 0.5], [F3, 0.5], [C3, 0.5]);
      CHORDS.push([0, 0.5], [[G3, BB3], 0.5], [0, 0.5], [[G3, BB3], 0.5], [0, 0.5], [[A3, C4], 0.5], [0, 0.5], [[A3, C4], 0.5]);
    } else {
      BASS.push([b[0], 0.5], [0, 0.5], [b[1], 0.5], [b[0], 0.5], [0, 0.5], [b[0], 0.5], [b[1], 1]);
      CHORDS.push([0, 0.5], [b[2], 0.5], [0, 0.5], [b[2], 0.5], [0, 0.5], [b[2], 0.5], [0, 0.5], [b[2], 0.5]);
    }
    DRUMS.push(['k', 0.5], ['h', 0.5], [0, 0.5], ['h', 0.5], ['k', 0.5], ['h', 0.5], [0, 0.5], ['h', 0.5]);
  });

  var NORMAL = {
    bpm: 100,
    wave: 'sine',
    melodyPeak: 0.336,
    gate: 0.7,
    bend: 0.82,
    swing: 1 / 6,
    bassWave: 'triangle',
    chordWave: 'sine',
    chordLen: 0.1,
    bass: BASS,
    chords: CHORDS,
    drums: DRUMS,
    steps: [
      // boing up and leap (bars 1-2)
      [F5, 0.5], [D5, 0.5], [F5, 0.5], [BB5, 1], [0, 0.5], [F5, 0.5], [G5, 0.5],
      [BB5, 0.5], [G5, 0.5], [0, 0.5], [D5, 0.5], [G5, 1], [F5, 1],
      // up to C6 and land on A5 (bars 3-4)
      [EB5, 0.5], [G5, 0.5], [C6, 1], [BB5, 0.5], [G5, 0.5], [EB5, 1],
      [F5, 0.5], [0, 0.5], [C5, 0.5], [F5, 0.5], [A5, 1], [0, 1],
      // falling hops from D6 (bars 5-6)
      [D6, 0.5], [BB5, 0.5], [F5, 0.5], [D5, 0.5], [F5, 0.5], [BB5, 0.5], [0, 1],
      [G5, 0.5], [A5, 0.5], [BB5, 0.5], [G5, 0.5], [D5, 1], [G5, 1],
      // Eb-F and home (bars 7-8)
      [EB5, 0.5], [G5, 0.5], [BB5, 1], [C6, 0.5], [A5, 0.5], [F5, 1],
      [BB5, 0.5], [F5, 0.5], [D5, 0.5], [F5, 0.5], [BB4, 1], [0, 1]
    ]
  };

  G.Sounds = { NORMAL: NORMAL, ENDGAME_BPM: 126, names: Object.keys(SOUNDS) };
})(Ailand.games.drop4);
