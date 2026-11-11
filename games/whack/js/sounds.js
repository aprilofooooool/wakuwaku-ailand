(function (G) {
  'use strict';

  var S = Ailand.core.Sound;
  var note = S.note;
  var seq = S.seq;

  // Effect sounds (design 5.5). Names are prefixed so they never clash with other games on the shared registry.
  var SOUNDS = {
    // Own character: a short bright "pop" going up.
    'whack-self': function (c, d, t) {
      note(c, d, t, 660, 0, 0.09, 'sine', 0.5, 1320);
      note(c, d, t, 1320, 0.06, 0.08, 'triangle', 0.25);
    },
    // Rare card: a quick sparkling arpeggio with a high shimmer.
    'whack-rare': function (c, d, t) {
      seq(c, d, t, [784, 988, 1175, 1568], 0.05, 0.14, 'triangle', 0.4);
      note(c, d, t, 1976, 0.22, 0.35, 'sine', 0.18);
      note(c, d, t, 2349, 0.3, 0.3, 'sine', 0.12);
    },
    // Forbidden character: a low, sly "boing" going down.
    'whack-ng': function (c, d, t) {
      note(c, d, t, 330, 0, 0.22, 'square', 0.25, 140);
      note(c, d, t, 196, 0.16, 0.18, 'triangle', 0.3, 165);
    },
    'whack-count': function (c, d, t) { note(c, d, t, 660, 0, 0.12, 'triangle', 0.45); },
    'whack-go': function (c, d, t) {
      note(c, d, t, 1047, 0, 0.3, 'triangle', 0.5);
      note(c, d, t, 1319, 0.02, 0.28, 'sine', 0.2);
    },
    // Last 10 seconds: two quick high beeps.
    'whack-final': function (c, d, t) { seq(c, d, t, [988, 988], 0.13, 0.1, 'square', 0.22); },
    // End whistle: a held high tone with a short second blow.
    'whack-whistle': function (c, d, t) {
      note(c, d, t, 1760, 0, 0.18, 'sine', 0.35, 1700);
      note(c, d, t, 1760, 0.24, 0.5, 'sine', 0.35, 1650);
    },
    'whack-record': function (c, d, t) {
      seq(c, d, t, [523, 659, 784, 1047], 0.1, 0.18, 'triangle', 0.45);
      seq(c, d, t + 0.45, [784, 1047, 1319, 1568], 0.08, 0.2, 'triangle', 0.4);
      note(c, d, t, 2093, 0.85, 0.5, 'sine', 0.15);
    },
    'whack-win': function (c, d, t) { seq(c, d, t, [523, 659, 784, 659, 784, 1047], 0.13, 0.26, 'triangle', 0.5); },
    'whack-draw': function (c, d, t) {
      seq(c, d, t, [440, 554], 0.18, 0.16, 'triangle', 0.4);
      seq(c, d, t + 0.45, [440, 554], 0.18, 0.16, 'triangle', 0.4);
    },
    // main.js plays 'button' on every button click (same tone as drop4).
    button: function (c, d, t) { note(c, d, t, 900, 0, 0.04, 'square', 0.15); }
  };

  // Registers every effect sound on core Sound (safe to call again). Runs once at load.
  function register() { Object.keys(SOUNDS).forEach(function (name) { S.register(name, SOUNDS[name]); }); }
  register();

  // BGM: a bouncy C major pentatonic tune over a C-Am-F-G bass, 8 bars of 4/4 (32 beats) at 132 bpm.
  // The last 10 seconds play the same score with Bgm.setTempo(FINAL_BPM).
  var C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5;
  var MELODY_BARS = [
    [[E5, 0.5], [G5, 0.5], [A5, 0.5], [G5, 0.5], [E5, 1], [C5, 1]],
    [[D5, 0.5], [E5, 0.5], [G5, 1], [E5, 1], [0, 1]],
    [[A5, 0.5], [G5, 0.5], [E5, 0.5], [G5, 0.5], [A5, 1], [C6, 1]],
    [[A5, 0.5], [G5, 0.5], [E5, 1], [D5, 1], [0, 1]],
    [[E5, 0.5], [G5, 0.5], [A5, 0.5], [G5, 0.5], [E5, 1], [C5, 1]],
    [[D5, 0.5], [E5, 0.5], [G5, 1], [A5, 1], [G5, 1]],
    [[C6, 0.5], [A5, 0.5], [G5, 0.5], [E5, 0.5], [D5, 1], [E5, 1]],
    [[C5, 2], [0, 2]]
  ];
  var ROOTS = [130.81, 110, 174.61, 196, 130.81, 110, 174.61, 196];       // C3 A2 F3 G3
  var FIFTHS = [196, 164.81, 261.63, 293.66, 196, 164.81, 261.63, 293.66]; // G3 E3 C4 D4
  var THIRDS = [329.63, 261.63, 440, 493.88, 329.63, 261.63, 440, 493.88]; // E4 C4 A4 B4

  var steps = [], bass = [], chords = [];
  MELODY_BARS.forEach(function (bar) { bar.forEach(function (n) { steps.push(n); }); });
  ROOTS.forEach(function (root, i) {
    bass.push([root, 1], [0, 1], [FIFTHS[i], 1], [0, 1]);
    for (var k = 0; k < 4; k++) { chords.push([0, 0.5], [THIRDS[i], 0.5]); }   // off-beat "pah"
  });

  var BGM = { bpm: 132, wave: 'triangle', bass: bass, chords: chords, steps: steps };

  G.Sounds = { register: register, BGM: BGM, FINAL_BPM: 168, names: Object.keys(SOUNDS) };
})(Ailand.games.whack);
