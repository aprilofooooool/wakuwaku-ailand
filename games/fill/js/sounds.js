(function (G) {
  'use strict';

  var S = Ailand.core.Sound;
  var note = S.note;
  var seq = S.seq;

  // Effect sounds. Soft and short; nothing harsh.
  var SOUNDS = {
    // Pick up a piece: a tiny upward blip.
    'fill-grab': function (c, d, t) { note(c, d, t, 440, 0, 0.05, 'sine', 0.2, 540); },
    // Piece snaps into place: a soft low "pata" with a clear tap on top.
    'fill-place': function (c, d, t) {
      note(c, d, t, 260, 0, 0.09, 'sine', 0.35, 200);
      note(c, d, t, 780, 0.02, 0.06, 'triangle', 0.15);
    },
    // Piece goes back to the tray: a gentle falling slide.
    'fill-return': function (c, d, t) { note(c, d, t, 520, 0, 0.12, 'sine', 0.22, 330); },
    'fill-rotate': function (c, d, t) { note(c, d, t, 520, 0, 0.06, 'sine', 0.2, 700); },
    // Hint: two soft chimes.
    'fill-hint': function (c, d, t) { seq(c, d, t, [880, 1175], 0.12, 0.2, 'sine', 0.22); },
    // Picture complete: a bright rising run with a shimmer.
    'fill-clear': function (c, d, t) {
      seq(c, d, t, [523, 659, 784, 1047], 0.1, 0.2, 'triangle', 0.4);
      note(c, d, t, 1568, 0.46, 0.5, 'sine', 0.15);
    },
    'fill-sparkle': function (c, d, t) {
      note(c, d, t, 1319, 0, 0.1, 'sine', 0.15);
      note(c, d, t, 1760, 0.06, 0.14, 'sine', 0.1);
    }
  };

  // Registers every effect sound on core Sound (safe to call again). Runs once at load.
  function register() { Object.keys(SOUNDS).forEach(function (name) { S.register(name, SOUNDS[name]); }); }
  register();

  // BGM "ゆったり・パズル": a calm F major tune for thinking, 88 bpm, 8 bars of 4/4 (32 beats).
  // Plain sine lead (no bend, no sparkle) in long notes, half-note sine bass, long soft
  // triangle chords on beats 1 and 3, and a sparse "kick, hat, rest, hat" drum bar.
  // Chords: F Dm Bb C | F Am Bb C.
  var A2 = 110, Bb2 = 116.54, C3 = 130.81, D3 = 146.83, F3 = 174.61, A3 = 220, C4 = 261.63, D4 = 293.66;
  var E4 = 329.63, F4 = 349.23, G4 = 392, A4 = 440, Bb4 = 466.16, C5 = 523.25, D5 = 587.33, E5 = 659.25;
  var F5 = 698.46, G5 = 783.99, A5 = 880, Bb5 = 932.33;
  var G3 = 196;

  // Per bar: [bass root, bass 5th, chord].
  var BARS = [
    [F3, C4, [A3, C4]], [D3, A3, [A3, D4]], [Bb2, F3, [D4, F4]], [C3, G3, [E4, G4]],
    [F3, C4, [A3, C4]], [A2, E4, [C4, E4]], [Bb2, F3, [D4, F4]], [C3, G3, [E4, G4]]
  ];
  var bass = [], chords = [], drums = [];
  BARS.forEach(function (b) {
    bass.push([b[0], 2], [b[1], 2]);
    chords.push([b[2], 2], [b[2], 2]);
    drums.push(['k', 1], ['h', 1], [0, 1], ['h', 1]);
  });

  var steps = [
    [A4, 1], [C5, 1], [F5, 1.5], [E5, 0.5],
    [D5, 2], [C5, 1], [A4, 1],
    [Bb4, 1], [D5, 1], [F5, 1], [D5, 1],
    [E5, 1.5], [D5, 0.5], [C5, 2],
    [A4, 1], [C5, 1], [F5, 1], [A5, 1],
    [G5, 1.5], [E5, 0.5], [C5, 1], [E5, 1],
    [D5, 1], [F5, 1], [Bb5, 1], [A5, 1],
    [E5, 1], [D5, 1], [C5, 2]
  ];

  var BGM = {
    bpm: 88,
    wave: 'sine',
    melodyPeak: 0.32,
    gate: 0.95,
    bassWave: 'sine',
    chordWave: 'triangle',
    chordLen: 0.6,
    bass: bass,
    chords: chords,
    drums: drums,
    steps: steps
  };

  G.Sounds = { register: register, BGM: BGM, names: Object.keys(SOUNDS) };
})(Ailand.games.fill);
