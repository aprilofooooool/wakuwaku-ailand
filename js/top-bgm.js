(function (A) {
  'use strict';
  // Entry page BGM "ハッピー・パレード": a bouncy, cheerful D major pop song, 128 bpm, 8 bars of 4/4 (32 beats),
  // straight 8ths. Short square-wave lead with a syncopated hook (bars 1 and 5 are the same), bouncy bass
  // (root - root - octave - fifth), three-note triangle chords on every off-beat, and a pop beat:
  // kick on 1 and the "and" of 2 and 3, snare on 2 and 4, hi-hats on the other 8ths, a snare fill in the last bar.
  // Chords: D A Bm G | D A G A (the last A leads back to D). Played by core/bgm.js.
  var A2 = 110, B2 = 123.47, D3 = 146.83, E3 = 164.81, FS3 = 185, G3 = 196, A3 = 220;
  var E4 = 329.63, FS4 = 369.99, G4 = 392, A4 = 440, B4 = 493.88;
  var CS5 = 554.37, D5 = 587.33, E5 = 659.25, FS5 = 739.99, G5 = 783.99, A5 = 880, B5 = 987.77;
  var CS6 = 1108.73, D6 = 1174.66;

  // [root, fifth, chord]; bass notes >= 100 Hz, the octave is root * 2.
  var D = [D3, A3, [FS4, A4, D5]], AM = [A2, E3, [E4, A4, CS5]], BM = [B2, FS3, [FS4, B4, D5]];
  var GM = [G3, D3, [G4, B4, D5]];
  var BARS = [D, AM, BM, GM, D, AM, GM, AM];
  var BASS = [], CHORDS = [], DRUMS = [];
  BARS.forEach(function (b, i) {
    BASS.push([b[0], 0.75], [b[0], 0.25], [0, 0.5], [b[0] * 2, 0.5], [0, 0.5], [b[1], 0.5], [b[0], 0.5], [0, 0.5]);
    for (var k = 0; k < 4; k++) { CHORDS.push([0, 0.5], [b[2], 0.5]); }
    DRUMS.push(['k', 0.5], ['h', 0.5], ['s', 0.5], ['k', 0.5], ['k', 0.5], ['h', 0.5]);
    if (i < BARS.length - 1) { DRUMS.push(['s', 0.5], ['h', 0.5]); }
    else { DRUMS.push(['s', 0.25], ['s', 0.25], ['s', 0.25], ['s', 0.25]); }
  });

  var HOOK = [[FS5, 0.5], [A5, 0.5], [B5, 0.5], [A5, 1], [FS5, 0.5], [D5, 0.5], [E5, 0.5]];

  A.top = A.top || {};
  A.top.BGM_SCORE = {
    bpm: 128,
    wave: 'square',
    melodyPeak: 0.34,
    gate: 0.72,
    bassWave: 'sine',
    chordWave: 'triangle',
    chordLen: 0.1,
    bass: BASS,
    chords: CHORDS,
    drums: DRUMS,
    steps: [].concat(
      HOOK,                                                                                           // D
      [[E5, 0.5], [CS5, 0.5], [E5, 0.5], [A5, 1], [0, 0.5], [A5, 0.25], [B5, 0.25], [CS6, 0.5]],      // A
      [[D6, 0.5], [CS6, 0.5], [B5, 0.5], [FS5, 1], [0, 0.5], [B5, 0.5], [A5, 0.5]],                   // Bm
      [[G5, 0.5], [A5, 0.5], [B5, 0.5], [D6, 1], [B5, 0.5], [A5, 1]],                                 // G
      HOOK,                                                                                           // D
      [[CS5, 0.5], [E5, 0.5], [A5, 0.5], [CS6, 1], [B5, 0.5], [A5, 0.5], [B5, 0.5]],                  // A
      [[D6, 0.75], [B5, 0.25], [G5, 0.5], [B5, 0.5], [A5, 0.5], [G5, 0.5], [FS5, 0.5], [E5, 0.5]],    // G
      [[FS5, 0.5], [E5, 0.5], [D5, 0.5], [E5, 1], [0, 0.5], [A4, 0.25], [CS5, 0.25], [E5, 0.5]]       // A
    )
  };
})(window.Ailand);
