(function (O) {
  'use strict';
  // オセロっち BGM: relaxed D major pentatonic melody over a D-Bm-G-A bass, 8 bars of 4/4 (32 beats) at 96 bpm.
  // Played by core/bgm.js (triangle melody, sine bass; same gains as drop4). Othello's own SE stay in sound-synthesizer.js.
  var D4 = 293.66, E4 = 329.63, FS4 = 369.99, A4 = 440, B4 = 493.88, D5 = 587.33, E5 = 659.25, FS5 = 739.99;
  // [root, fifth] per bar, all >= 100 Hz.
  var BARS = [[146.83, 110], [123.47, 185], [196, 146.83], [110, 164.81],
    [146.83, 110], [123.47, 185], [196, 164.81], [146.83, 110]];
  var BASS = [];
  BARS.forEach(function (b) { BASS.push([b[0], 1], [0, 1], [b[1], 1], [0, 1]); });

  O.BGM_SCORE = {
    bpm: 96,
    wave: 'triangle',
    bass: BASS,
    steps: [
      [FS4, 1], [A4, 1], [B4, 1], [A4, 1],
      [D5, 1.5], [B4, 0.5], [A4, 2],
      [B4, 1], [D5, 1], [E5, 1], [D5, 1],
      [E5, 1.5], [D5, 0.5], [B4, 1], [0, 1],
      [A4, 1], [FS5, 1], [E5, 1], [D5, 1],
      [B4, 1], [D5, 0.5], [B4, 0.5], [A4, 2],
      [B4, 1], [A4, 1], [E4, 1], [FS4, 1],
      [D4, 2], [0, 2]
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
