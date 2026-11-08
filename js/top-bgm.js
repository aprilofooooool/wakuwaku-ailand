(function (A) {
  'use strict';
  // Entry page BGM "ようこそ": gentle F major pentatonic melody over F-Dm-Bb-C half-note bass,
  // 8 bars of 4/4 (32 beats) at 100 bpm. Same instruments as drop4 (core/bgm.js: triangle melody, sine bass).
  var F4 = 349.23, G4 = 392, A4 = 440, C5 = 523.25, D5 = 587.33, F5 = 698.46;
  // [root, fifth] per bar, all >= 100 Hz.
  var BARS = [[174.61, 130.81], [146.83, 110], [116.54, 174.61], [130.81, 196],
    [174.61, 130.81], [146.83, 110], [116.54, 174.61], [130.81, 196]];
  var BASS = [];
  BARS.forEach(function (b) { BASS.push([b[0], 2], [b[1], 2]); });

  A.top = A.top || {};
  A.top.BGM_SCORE = {
    bpm: 100,
    wave: 'triangle',
    bass: BASS,
    steps: [
      [A4, 1], [C5, 1], [D5, 1], [C5, 1],
      [A4, 1.5], [G4, 0.5], [F4, 2],
      [D5, 1], [C5, 1], [A4, 1], [G4, 1],
      [G4, 1], [A4, 1], [C5, 2],
      [A4, 1], [C5, 1], [F5, 1], [D5, 1],
      [C5, 1.5], [A4, 0.5], [D5, 2],
      [C5, 1], [A4, 1], [G4, 1], [A4, 0.5], [G4, 0.5],
      [F4, 2], [0, 2]
    ]
  };
})(window.Ailand);
