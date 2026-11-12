(function (A) {
  'use strict';
  // Entry page BGM "ようこそファンファーレ" (design 2026-11-12-bgm-variety §2): a bright D major march, 112 bpm,
  // 8 bars of 4/4 (32 beats), straight 8ths. Square-wave "trumpet" melody that opens with a rising fanfare
  // (A4-D5-F#5-A5), sine bass on beats 1 and 3, two-note triangle chords on 2 and 4, kick 1&3 / snare 2&4 with a
  // snare roll at the end. Chords: D G A D | Bm G A D. Played by core/bgm.js.
  var A2 = 110, B2 = 123.47, D3 = 146.83, E3 = 164.81, FS3 = 185, G3 = 196;
  var E4 = 329.63, FS4 = 369.99, G4 = 392, A4 = 440, B4 = 493.88, CS5 = 554.37, D5 = 587.33, E5 = 659.25;
  var FS5 = 739.99, G5 = 783.99, A5 = 880, B5 = 987.77, CS6 = 1108.73, D6 = 1174.66;

  // Per bar: [bass root, bass fifth, chord]; all >= 100 Hz.
  var BARS = [
    [D3, A2, [FS4, A4]], [G3, D3, [G4, B4]], [A2, E3, [E4, CS5]], [D3, A2, [FS4, A4]],
    [B2, FS3, [FS4, B4]], [G3, D3, [G4, B4]], [A2, E3, [E4, CS5]], [D3, A2, [FS4, A4]]
  ];
  var BASS = [], CHORDS = [], DRUMS = [];
  BARS.forEach(function (b, i) {
    BASS.push([b[0], 1], [0, 1], [b[1], 1], [0, 1]);
    CHORDS.push([0, 1], [b[2], 1], [0, 1], [b[2], 1]);
    if (i < BARS.length - 1) { DRUMS.push(['k', 1], ['s', 1], ['k', 1], ['s', 1]); }
    else { DRUMS.push(['k', 1], ['s', 1], ['k', 1], ['s', 0.25], ['s', 0.25], ['s', 0.25], ['s', 0.25]); }
  });

  A.top = A.top || {};
  A.top.BGM_SCORE = {
    bpm: 112,
    wave: 'square',
    melodyPeak: 0.36,
    gate: 0.85,
    bassWave: 'sine',
    chordWave: 'triangle',
    chordLen: 0.18,
    bass: BASS,
    chords: CHORDS,
    drums: DRUMS,
    steps: [
      // fanfare (bars 1-2)
      [A4, 0.5], [D5, 0.5], [FS5, 0.5], [A5, 1.5], [FS5, 0.5], [A5, 0.5],
      [B5, 1], [A5, 0.5], [G5, 0.5], [FS5, 0.5], [G5, 0.5], [B5, 1],
      // answer and landing (bars 3-4)
      [A5, 0.75], [G5, 0.25], [FS5, 0.5], [E5, 0.5], [CS5, 1], [E5, 1],
      [D5, 1], [A4, 0.5], [D5, 0.5], [FS5, 1], [0, 1],
      // march on (bars 5-6)
      [FS5, 0.5], [FS5, 0.5], [D5, 0.5], [FS5, 0.5], [B5, 1], [A5, 1],
      [G5, 0.5], [A5, 0.5], [B5, 0.5], [G5, 0.5], [D5, 1], [G5, 1],
      // climb to D6 and home (bars 7-8)
      [E5, 0.5], [FS5, 0.5], [G5, 0.5], [A5, 0.5], [B5, 0.5], [CS6, 0.5], [A5, 1],
      [D6, 1], [A5, 0.5], [FS5, 0.5], [D5, 1], [0, 1]
    ]
  };
})(window.Ailand);
