(function (G) {
  'use strict';

  var S = Ailand.core.Sound;
  var note = S.note;
  var seq = S.seq;

  // Effect sounds. Soft and short; nothing harsh. Turn-based, so none of them repeats quickly.
  var SOUNDS = {
    // Pick up a piece: a tiny upward blip.
    'territory-grab': function (c, d, t) { note(c, d, t, 420, 0, 0.05, 'sine', 0.2, 520); },
    // Piece lands: a soft low "toton" with a clear tap on top.
    'territory-place': function (c, d, t) {
      note(c, d, t, 230, 0, 0.1, 'sine', 0.35, 180);
      note(c, d, t, 700, 0.025, 0.06, 'triangle', 0.15);
    },
    // Piece goes back to the tray: a gentle falling slide.
    'territory-back': function (c, d, t) { note(c, d, t, 500, 0, 0.12, 'sine', 0.22, 320); },
    'territory-rotate': function (c, d, t) { note(c, d, t, 500, 0, 0.06, 'sine', 0.2, 680); },
    // Flip: a short two-note "pi-po" going down.
    'territory-flip': function (c, d, t) { seq(c, d, t, [680, 540], 0.05, 0.06, 'sine', 0.2); },
    // Big piece placed: a warm three-note rise.
    'territory-big': function (c, d, t) { seq(c, d, t, [392, 494, 587], 0.08, 0.14, 'triangle', 0.35); },
    // Blocked a rival: a bouncy "pon-pon" with a small sparkle.
    'territory-block': function (c, d, t) {
      seq(c, d, t, [587, 784], 0.07, 0.1, 'triangle', 0.35);
      note(c, d, t, 1175, 0.16, 0.14, 'sine', 0.15);
    },
    // A seat has no move and rests: a soft low pair, like a yawn.
    'territory-rest': function (c, d, t) { seq(c, d, t, [330, 262], 0.2, 0.28, 'sine', 0.25); },
    // Win: a bright rising run with a shimmer.
    'territory-win': function (c, d, t) {
      seq(c, d, t, [523, 659, 784, 1047], 0.1, 0.2, 'triangle', 0.4);
      note(c, d, t, 1568, 0.46, 0.5, 'sine', 0.15);
    },
    // Lose: gentle, slowly falling two notes (never harsh).
    'territory-lose': function (c, d, t) { seq(c, d, t, [415, 349], 0.22, 0.3, 'triangle', 0.3); },
    // Draw: two level notes, then a small lift.
    'territory-draw': function (c, d, t) { seq(c, d, t, [440, 440, 523], 0.16, 0.22, 'triangle', 0.3); }
  };

  // Registers every effect sound on core Sound (safe to call again). Runs once at load.
  function register() { Object.keys(SOUNDS).forEach(function (name) { S.register(name, SOUNDS[name]); }); }
  register();

  // BGM "のんびり・じんとり": a calm-but-playful G major tune for thinking, 96 bpm, 8 bars of 4/4 (32 beats).
  // Triangle lead that bends up a little into each note, quarter-note sine bass (root, 5th, root, 5th),
  // soft sine chord taps on beat 2 and the "and" of beat 3, and a "kick, hat hat, snare 8th, kick 8th, hat" bar.
  // Chords: G Em Am D | Bm C D G.
  // Endgame: Bgm.setTempo(ENDGAME_BPM).
  var B2 = 123.47, A2 = 110, C3 = 130.81, D3 = 146.83, E3 = 164.81, G3 = 196, F3s = 185;
  var A3 = 220, B3 = 246.94, C4 = 261.63, D4 = 293.66, E4 = 329.63, F4s = 369.99, G4 = 392, A4 = 440;
  var B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5s = 739.99, G5 = 783.99, A5 = 880;

  // Per bar: [bass root, bass 5th, chord].
  var BARS = [
    [G3, D4, [B3, D4]], [E3, B3, [B3, E4]], [A2, E3, [C4, E4]], [D3, A3, [A3, D4]],
    [B2, F3s, [D4, F4s]], [C3, G3, [E4, G4]], [D3, A3, [A3, D4]], [G3, D4, [B3, D4]]
  ];
  var bass = [], chords = [], drums = [];
  BARS.forEach(function (b) {
    bass.push([b[0], 1], [b[1], 1], [b[0], 1.5], [b[1], 0.5]);
    chords.push([0, 1], [b[2], 1.5], [0, 0.5], [b[2], 1]);
    drums.push(['k', 1], ['h', 0.5], ['h', 0.5], ['s', 0.5], ['k', 0.5], ['h', 1]);
  });

  var steps = [
    [B4, 1], [D5, 0.5], [B4, 0.5], [G4, 1], [A4, 1],
    [E5, 1], [D5, 0.5], [B4, 0.5], [G4, 2],
    [A4, 1], [C5, 1], [E5, 1.5], [0, 0.5],
    [D5, 1], [F5s, 0.5], [A5, 0.5], [F5s, 1], [D5, 1],
    [D5, 1], [F5s, 1], [D5, 1], [B4, 1],
    [C5, 1], [E5, 1], [G5, 1.5], [E5, 0.5],
    [F5s, 1], [E5, 0.5], [D5, 0.5], [A4, 1], [0, 1],
    [B4, 1], [D5, 1], [G5, 1], [0, 1]
  ];

  var BGM = {
    bpm: 96,
    wave: 'triangle',
    bend: 0.5,
    melodyPeak: 0.3,
    gate: 0.85,
    bassWave: 'sine',
    chordWave: 'sine',
    chordLen: 0.3,
    bass: bass,
    chords: chords,
    drums: drums,
    steps: steps
  };

  G.Sounds = { register: register, BGM: BGM, ENDGAME_BPM: 120, names: Object.keys(SOUNDS) };
})(Ailand.games.territory);
