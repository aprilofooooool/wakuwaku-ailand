(function (O) {
  'use strict';
  // オセロっち BGM "ひなたぼっこワルツ" (design 2026-11-12-bgm-variety §2): a gentle, happy Eb major waltz,
  // 3/4 at 144 bpm (one bar = 1.25 s), 16 bars (48 beats), no drums. Music-box melody: sine with a quiet sine an
  // octave up (sparkle). Sine bass on beat 1, two-note triangle chords on beats 2 and 3 ("oom-pah-pah").
  // Chords: Eb Eb Ab Bb | Cm Ab Bb Eb | Ab Bb Gm Cm | Ab Bb Eb Eb. Played by core/bgm.js.
  // Othello's own SE stay in sound-synthesizer.js.
  var AB2 = 103.83, BB2 = 116.54, C3 = 130.81, EB3 = 155.56, G3 = 196, AB3 = 207.65, BB3 = 233.08;
  var C4 = 261.63, D4 = 293.66, EB4 = 311.13;
  var AB4 = 415.3, BB4 = 466.16, C5 = 523.25, D5 = 587.33, EB5 = 622.25, F5 = 698.46, G5 = 783.99;
  var AB5 = 830.61, BB5 = 932.33, C6 = 1046.5;

  var EB = [EB3, [G3, BB3]], AB = [AB2, [AB3, C4]], BB = [BB2, [AB3, D4]], CM = [C3, [G3, EB4]], GM = [G3, [BB3, D4]];
  // Per bar: [bass on beat 1, chord on beats 2 and 3]; all >= 100 Hz.
  var BARS = [EB, EB, AB, BB, CM, AB, BB, EB, AB, BB, GM, CM, AB, BB, EB, EB];
  var BASS = [], CHORDS = [];
  BARS.forEach(function (b) {
    BASS.push([b[0], 1], [0, 2]);
    CHORDS.push([0, 1], [b[1], 1], [b[1], 1]);
  });

  O.BGM_SCORE = {
    bpm: 144,
    wave: 'sine',
    melodyPeak: 0.32,
    gate: 0.8,
    sparkle: true,
    bassWave: 'sine',
    chordWave: 'triangle',
    chordLen: 0.14,
    bass: BASS,
    chords: CHORDS,
    steps: [
      // sunny opening (bars 1-4)
      [G5, 1.5], [F5, 0.5], [EB5, 1],
      [BB4, 1], [EB5, 1], [G5, 1],
      [AB5, 1.5], [G5, 0.5], [F5, 1],
      [D5, 1], [F5, 1], [BB5, 1],
      // up to C6 and back home (bars 5-8)
      [C6, 1.5], [BB5, 0.5], [G5, 1],
      [AB5, 1], [F5, 1], [C5, 1],
      [D5, 1], [EB5, 0.5], [F5, 0.5], [BB4, 1],
      [EB5, 2], [0, 1],
      // second phrase (bars 9-12)
      [C5, 0.5], [EB5, 0.5], [AB5, 1], [C6, 1],
      [BB5, 1.5], [AB5, 0.5], [F5, 1],
      [G5, 0.5], [BB5, 0.5], [D5, 1], [G5, 1],
      [EB5, 1.5], [D5, 0.5], [C5, 1],
      // rise and the opening again, then home (bars 13-16)
      [AB4, 1], [C5, 1], [EB5, 1],
      [F5, 1], [G5, 0.5], [AB5, 0.5], [BB5, 1],
      [G5, 1.5], [F5, 0.5], [EB5, 1],
      [EB5, 2], [BB4, 1]
    ]
  };
})(Ailand.games.othello);

(function (O) {
  'use strict';
  // Page wiring for the BGM (called from index.html and main.js; never from game logic).
  // Plays only while the shared core sound and BGM settings are both ON.
  var playing = false;

  function wanted() {
    var C = Ailand.core;
    return C.Sound.isEnabled() && C.Sound.isBgmOn();
  }

  O.BgmLink = {
    wanted: wanted,
    sync: function () {
      var want = wanted();
      if (want && !playing) { Ailand.core.Bgm.start(O.BGM_SCORE); playing = true; }
      else if (!want && playing) { Ailand.core.Bgm.stop(); playing = false; }
    },
    stop: function () { Ailand.core.Bgm.stop(); playing = false; }
  };
})(Ailand.games.othello);
