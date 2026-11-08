(function (A) {
  'use strict';
  // Entry page BGM "ようこそパレード": bouncy G major, 132 bpm, 8 bars of 4/4 (32 beats).
  // Melody: a 2-bar motif (octave leap G4-G5, short notes with rests, dotted 8ths) repeated with variation,
  // then a rising answer and a happy ending. Bass: oom on beats 1 and 3 (root, fifth); chords: "pah" on 2 and 4.
  // Chords: G G C D | G Em C-D G. Played by core/bgm.js (triangle melody, sine bass, soft sine chord plucks).
  var G3 = 196, A3 = 220, B3 = 246.94, C4 = 261.63, D4 = 293.66, E4 = 329.63, FS4 = 369.99;
  var G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, FS5 = 739.99;
  var G5 = 783.99, A5 = 880, B5 = 987.77;
  var C3 = 130.81, D3 = 146.83, E3 = 164.81;

  // Per bar: [bass root, bass fifth, chord pah on beat 2, chord pah on beat 4]; all >= 100 Hz.
  var BARS = [
    [G3, D3, B3, D4], [G3, D3, B3, D4], [C3, G3, C4, E4], [D3, A3, A3, FS4],
    [G3, D3, B3, D4], [E3, B3, G3, B3], [C3, A3, E4, FS4], [G3, D3, B3, D4]
  ];
  var BASS = [], CHORDS = [];
  BARS.forEach(function (b) {
    BASS.push([b[0], 0.75], [0, 1.25], [b[1], 0.75], [0, 1.25]);
    CHORDS.push([0, 1], [b[2], 0.5], [0, 1.5], [b[3], 0.5], [0, 0.5]);
  });

  A.top = A.top || {};
  A.top.BGM_SCORE = {
    bpm: 132,
    wave: 'triangle',
    bass: BASS,
    chords: CHORDS,
    steps: [
      // motif (bars 1-2)
      [G4, 0.5], [G5, 0.5], [0, 0.5], [D5, 0.5], [B4, 0.75], [C5, 0.25], [D5, 1],
      [E5, 0.5], [0, 0.5], [D5, 0.5], [B4, 0.5], [A4, 0.5], [B4, 0.5], [G4, 1],
      // motif again, a step higher (bars 3-4)
      [G4, 0.5], [G5, 0.5], [0, 0.5], [E5, 0.5], [C5, 0.75], [D5, 0.25], [E5, 1],
      [FS5, 0.5], [0, 0.5], [E5, 0.5], [D5, 0.5], [A4, 0.5], [B4, 0.5], [A4, 1],
      // hopping answer (bars 5-6)
      [B4, 0.75], [D5, 0.25], [G5, 0.5], [0, 0.5], [B4, 0.75], [D5, 0.25], [G5, 0.5], [0, 0.5],
      [E5, 0.75], [G5, 0.25], [B5, 0.5], [0, 0.5], [A5, 0.5], [G5, 0.5], [E5, 1],
      // run up and land (bars 7-8)
      [C5, 0.5], [E5, 0.5], [G5, 0.5], [E5, 0.5], [D5, 0.5], [FS5, 0.5], [A5, 0.5], [FS5, 0.5],
      [G5, 0.5], [D5, 0.5], [B4, 0.5], [D5, 0.5], [G5, 1], [0, 1]
    ]
  };
})(window.Ailand);
