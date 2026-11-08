(function (O) {
  'use strict';
  // オセロっち BGM "ぴょこぴょこポルカ": cheerful F major, 120 bpm, 8 bars of 4/4 (32 beats).
  // Melody: a 2-bar call-and-answer motif (dotted 8ths, syncopated rests, octave leap) repeated a step higher,
  // then a climbing Dm-Bb phrase and a run up to C6 that falls home. Bass walks root-fifth on every beat
  // (staccato); chords tick softly on every off-beat ("oom-pah" polka). Chords: F Bb C F | Dm Bb C F.
  // Played by core/bgm.js (triangle melody, sine bass, soft sine chord plucks; same gains as drop4).
  // Othello's own SE stay in sound-synthesizer.js.
  var F4 = 349.23, G4 = 392, A4 = 440, BB4 = 466.16, C5 = 523.25, D5 = 587.33, E5 = 659.25;
  var F5 = 698.46, G5 = 783.99, A5 = 880, C6 = 1046.5;
  var BB2 = 116.54, C3 = 130.81, D3 = 146.83, F3 = 174.61, G3 = 196, A3 = 220, BB3 = 233.08;
  var C4 = 261.63, D4 = 293.66, E4 = 329.63;

  // Per bar: [bass root, bass fifth, off-beat chord tone 1, off-beat chord tone 2]; all >= 100 Hz.
  var BARS = [
    [F3, C3, A3, C4], [BB2, F3, BB3, D4], [C3, G3, C4, E4], [F3, C3, A3, C4],
    [D3, A3, A3, D4], [BB2, F3, BB3, D4], [C3, G3, C4, E4], [F3, C3, A3, C4]
  ];
  var BASS = [], CHORDS = [];
  BARS.forEach(function (b) {
    BASS.push([b[0], 0.5], [0, 0.5], [b[1], 0.5], [0, 0.5], [b[0], 0.5], [0, 0.5], [b[1], 0.5], [0, 0.5]);
    CHORDS.push([0, 0.5], [b[2], 0.5], [0, 0.5], [b[3], 0.5], [0, 0.5], [b[2], 0.5], [0, 0.5], [b[3], 0.5]);
  });

  O.BGM_SCORE = {
    bpm: 120,
    wave: 'triangle',
    bass: BASS,
    chords: CHORDS,
    steps: [
      // call and answer (bars 1-2)
      [C5, 0.75], [A4, 0.25], [C5, 0.5], [F5, 0.5], [0, 0.5], [F5, 0.5], [E5, 0.5], [F5, 0.5],
      [D5, 0.5], [0, 0.25], [D5, 0.25], [BB4, 0.5], [D5, 0.5], [C5, 1], [0, 1],
      // the same, a step higher (bars 3-4)
      [C5, 0.75], [G4, 0.25], [C5, 0.5], [E5, 0.5], [0, 0.5], [G5, 0.5], [F5, 0.5], [E5, 0.5],
      [F5, 0.5], [0, 0.25], [C5, 0.25], [A4, 0.5], [C5, 0.5], [F4, 1], [0, 1],
      // climbing phrase (bars 5-6)
      [A4, 0.5], [D5, 0.5], [F5, 0.5], [A5, 0.5], [0, 0.5], [A5, 0.25], [G5, 0.25], [F5, 0.5], [D5, 0.5],
      [BB4, 0.5], [D5, 0.5], [F5, 1], [0, 0.5], [D5, 0.5], [F5, 0.5], [D5, 0.5],
      // run up to C6 and fall home with an octave leap (bars 7-8)
      [E5, 0.75], [F5, 0.25], [G5, 0.5], [C5, 0.5], [E5, 0.75], [F5, 0.25], [G5, 0.5], [C6, 0.5],
      [A5, 0.5], [F5, 0.5], [C5, 0.5], [A4, 0.5], [F4, 0.5], [F5, 0.5], [0, 1]
    ]
  };
})(Ailand.games.othello);

(function (O) {
  'use strict';
  // Page wiring for the BGM (called from index.html and main.js; never from game logic).
  // Plays only while othello's own sound setting AND the shared core sound + BGM settings are all ON.
  var playing = false;

  function wanted() {
    var C = Ailand.core;
    var own = false;
    try { own = !!(O.UI && O.UI.isSoundOn()); } catch (e) { own = false; } // UI not initialised yet
    return own && C.Sound.isEnabled() && C.Sound.isBgmOn();
  }

  O.BgmLink = {
    sync: function () {
      var want = wanted();
      if (want && !playing) { Ailand.core.Bgm.start(O.BGM_SCORE); playing = true; }
      else if (!want && playing) { Ailand.core.Bgm.stop(); playing = false; }
    },
    stop: function () { Ailand.core.Bgm.stop(); playing = false; }
  };
})(Ailand.games.othello);
