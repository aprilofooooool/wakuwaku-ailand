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

  // Normal BGM: C major pentatonic melody over a C-Am-F-G bass, 8 bars of 4/4 (32 beats) = 16 s at 120 bpm.
  // Endgame uses the same score with Bgm.setTempo(150).
  var BAR_ROOTS = [130.81, 110, 87.31, 98, 130.81, 110, 87.31, 98];
  var BAR_FIFTHS = [98, 164.81, 130.81, 146.83, 98, 164.81, 130.81, 146.83];
  var BASS = [];
  BAR_ROOTS.forEach(function (root, i) { BASS.push([root, 1], [0, 1], [BAR_FIFTHS[i], 1], [0, 1]); });

  var NORMAL = {
    bpm: 120,
    wave: 'triangle',
    bass: BASS,
    steps: [
      [659.25, 1], [783.99, 0.5], [659.25, 0.5], [587.33, 1], [523.25, 1],
      [523.25, 0.5], [587.33, 0.5], [659.25, 1], [783.99, 1], [659.25, 1],
      [880, 1], [783.99, 0.5], [659.25, 0.5], [783.99, 1], [880, 1],
      [783.99, 1.5], [659.25, 0.5], [587.33, 1], [0, 1],
      [659.25, 0.5], [783.99, 0.5], [1046.5, 1], [880, 1], [783.99, 1],
      [880, 1], [783.99, 0.5], [659.25, 0.5], [587.33, 1], [659.25, 1],
      [587.33, 0.5], [659.25, 0.5], [783.99, 1], [659.25, 1], [587.33, 1],
      [523.25, 1], [587.33, 1], [659.25, 1], [0, 1]
    ]
  };

  G.Sounds = { NORMAL: NORMAL, names: Object.keys(SOUNDS) };
})(Ailand.games.drop4);
