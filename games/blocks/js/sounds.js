(function (G) {
  'use strict';

  var S = Ailand.core.Sound;
  var note = S.note;
  var seq = S.seq;

  // Effect sounds. Short and soft; "move" is the quietest because it repeats while a button is held.
  var SOUNDS = {
    'blocks-move': function (c, d, t) { note(c, d, t, 520, 0, 0.03, 'sine', 0.1); },
    'blocks-rotate': function (c, d, t) { note(c, d, t, 560, 0, 0.06, 'triangle', 0.2, 760); },
    // Piece lands: a soft low "pon".
    'blocks-lock': function (c, d, t) { note(c, d, t, 260, 0, 0.09, 'sine', 0.3, 190); },
    'blocks-line': function (c, d, t) { seq(c, d, t, [659, 784], 0.07, 0.12, 'triangle', 0.35); },
    'blocks-multi': function (c, d, t) { seq(c, d, t, [523, 659, 784], 0.07, 0.14, 'triangle', 0.38); },
    // Four lines at once: a sparkling arpeggio with a high shimmer.
    'blocks-quad': function (c, d, t) {
      seq(c, d, t, [523, 659, 784, 1047, 1319], 0.07, 0.16, 'triangle', 0.4);
      note(c, d, t, 2093, 0.3, 0.35, 'sine', 0.12);
    },
    // A face flies to the counter.
    'blocks-collect': function (c, d, t) { note(c, d, t, 880, 0, 0.07, 'sine', 0.25, 1175); },
    'blocks-count': function (c, d, t) { note(c, d, t, 660, 0, 0.12, 'triangle', 0.4); },
    'blocks-go': function (c, d, t) {
      note(c, d, t, 1047, 0, 0.3, 'triangle', 0.45);
      note(c, d, t, 1319, 0.02, 0.28, 'sine', 0.18);
    },
    'blocks-goal': function (c, d, t) {
      seq(c, d, t, [523, 659, 784, 1047], 0.1, 0.2, 'triangle', 0.42);
      note(c, d, t, 1568, 0.45, 0.45, 'sine', 0.15);
    },
    // Game over: gentle, slowly falling two notes (never harsh).
    'blocks-over': function (c, d, t) { seq(c, d, t, [440, 392], 0.22, 0.3, 'triangle', 0.3); },
    // main.js plays 'button' on every button click outside the play pad (same tone as drop4 and whack).
    button: function (c, d, t) { note(c, d, t, 900, 0, 0.04, 'square', 0.15); }
  };

  // Registers every effect sound on core Sound (safe to call again). Runs once at load.
  function register() { Object.keys(SOUNDS).forEach(function (name) { S.register(name, SOUNDS[name]); }); }
  register();

  // BGM "つみつみ・ステップ" (design 2026-11-12-bgm-variety §2 rules): a light G major stack-and-fall tune, 132 bpm,
  // 8 bars of 4/4 (32 beats). Plain triangle lead (no bend, no sparkle) in 8ths that dips down and climbs back up,
  // triangle bass alternating root and 5th on each beat, sine stabs on beats 2 and 4,
  // and a "kick, hat hat, snare, hat kick" drum bar. Chords (I-V-vi-IV, I-ii-V-I): G D Em C | G Am D G.
  // After the "almost full" warning: Bgm.setTempo(ALMOST_BPM).
  var G3 = 196, D3 = 146.83, E3 = 164.81, C3 = 130.81, A2 = 110, D4 = 293.66, B3 = 246.94, A3 = 220;
  var G4 = 392, E4 = 329.63, C4 = 261.63, FS4 = 369.99, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25;
  var FS5 = 739.99, G5 = 783.99, A4 = 440, A5 = 880, B5 = 987.77;

  // Per bar: [bass root, bass 5th, stab chord].
  var BARS = [
    [G3, D4, [B3, D4]], [D3, A3, [A3, FS4]], [E3, B3, [G4, B4]], [C3, G3, [E4, G4]],
    [G3, D4, [B3, D4]], [A2, E3, [C4, E4]], [D3, A3, [A3, FS4]], [G3, D4, [B3, D4]]
  ];
  var bass = [], chords = [], drums = [];
  BARS.forEach(function (b) {
    bass.push([b[0], 1], [b[1], 1], [b[0], 1], [b[1], 1]);
    chords.push([0, 1], [b[2], 1], [0, 1], [b[2], 1]);
    drums.push(['k', 1], ['h', 0.5], ['h', 0.5], ['s', 1], ['h', 0.5], ['k', 0.5]);
  });

  var steps = [
    [D5, 0.5], [B4, 0.5], [D5, 0.5], [G5, 0.5], [B5, 1], [A5, 0.5], [G5, 0.5],
    [A5, 0.5], [FS5, 0.5], [A5, 0.5], [D5, 0.5], [FS5, 1], [E5, 0.5], [D5, 0.5],
    [E5, 0.5], [G5, 0.5], [B5, 0.5], [G5, 0.5], [E5, 1], [B4, 1],
    [C5, 0.5], [E5, 0.5], [G5, 0.5], [E5, 0.5], [D5, 1], [0, 1],
    [D5, 0.5], [B4, 0.5], [D5, 0.5], [G5, 0.5], [B5, 1], [A5, 0.5], [B5, 0.5],
    [A5, 1], [E5, 0.5], [C5, 0.5], [E5, 1], [A4, 1],
    [D5, 0.5], [FS5, 0.5], [A5, 0.5], [FS5, 0.5], [D5, 0.5], [A4, 0.5], [D5, 1],
    [G5, 1], [B5, 0.5], [A5, 0.5], [G5, 1], [0, 1]
  ];

  var BGM = {
    bpm: 132,
    wave: 'triangle',
    melodyPeak: 0.3,
    gate: 0.85,
    bassWave: 'triangle',
    chordWave: 'sine',
    chordLen: 0.14,
    bass: bass,
    chords: chords,
    drums: drums,
    steps: steps
  };

  G.Sounds = { register: register, BGM: BGM, ALMOST_BPM: 160, names: Object.keys(SOUNDS) };
})(Ailand.games.blocks);
