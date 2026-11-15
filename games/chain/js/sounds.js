(function (G) {
  'use strict';

  var S = Ailand.core.Sound;
  var note = S.note;
  var seq = S.seq;

  // Pop pitch per chain step (C major scale going up); step 5 and above share the last pitch.
  var POP_FREQS = [523, 587, 659, 784, 880];

  // Effect sounds. Short and soft; "move" is the quietest because it repeats while a button is held.
  var SOUNDS = {
    'chain-move': function (c, d, t) { note(c, d, t, 500, 0, 0.03, 'sine', 0.1); },
    'chain-rotate': function (c, d, t) { note(c, d, t, 540, 0, 0.06, 'sine', 0.2, 720); },
    // Pair lands: a soft low "puni".
    'chain-lock': function (c, d, t) { note(c, d, t, 240, 0, 0.1, 'sine', 0.3, 170); },
    // Balls pop: a bubbly "pu-pon". Play with { chain: n } (1-based); the pitch rises with each chain step.
    'chain-pop': function (c, d, t, o) {
      var n = Math.max(1, Math.min(POP_FREQS.length, Math.floor((o && o.chain) || 1)));
      var f = POP_FREQS[n - 1];
      note(c, d, t, f, 0, 0.09, 'sine', 0.35, f * 1.5);
      note(c, d, t, f * 2, 0.05, 0.12, 'triangle', 0.18);
    },
    // A sleeper wakes up: a small rising "mu-ku".
    'chain-wake': function (c, d, t) { seq(c, d, t, [440, 587], 0.07, 0.1, 'sine', 0.3); },
    // A pair arrives at the top.
    'chain-arrive': function (c, d, t) { note(c, d, t, 700, 0, 0.05, 'sine', 0.15); },
    // Turn-over warning: a soft two-note nudge.
    'chain-turnwarn': function (c, d, t) { seq(c, d, t, [660, 660], 0.12, 0.07, 'triangle', 0.25); },
    // Turn changes: a gentle low-to-high pair.
    'chain-turn': function (c, d, t) { seq(c, d, t, [392, 523], 0.08, 0.12, 'triangle', 0.3); },
    // Time bonus or time-up cue.
    'chain-time': function (c, d, t) { seq(c, d, t, [659, 523], 0.1, 0.14, 'triangle', 0.3); },
    // Last 10 seconds: a short soft tick.
    'chain-tick': function (c, d, t) { note(c, d, t, 960, 0, 0.03, 'sine', 0.12); },
    'chain-count': function (c, d, t) { note(c, d, t, 620, 0, 0.12, 'triangle', 0.4); },
    'chain-go': function (c, d, t) {
      note(c, d, t, 988, 0, 0.3, 'triangle', 0.45);
      note(c, d, t, 1319, 0.02, 0.28, 'sine', 0.18);
    },
    // All sleepers gone: a bright rising run with a shimmer.
    'chain-clear': function (c, d, t) {
      seq(c, d, t, [523, 659, 784, 1047], 0.09, 0.18, 'triangle', 0.4);
      note(c, d, t, 1568, 0.42, 0.45, 'sine', 0.15);
    },
    // Game over: gentle, slowly falling two notes (never harsh).
    'chain-over': function (c, d, t) { seq(c, d, t, [415, 349], 0.22, 0.3, 'triangle', 0.3); }
  };

  // Registers every effect sound on core Sound (safe to call again). Runs once at load.
  function register() { Object.keys(SOUNDS).forEach(function (name) { S.register(name, SOUNDS[name]); }); }
  register();

  // BGM "ぷるぷる・ステップ": a light, squishy C major tune, 116 bpm, 8 bars of 4/4 (32 beats).
  // Short square lead that bends up into each note ("puni"), dotted triangle bass, sine chord stabs on the
  // "and" of beats 2 and 4, and a syncopated "kick, hat, kick, snare, hat hat" drum bar.
  // Chords: C Am F G | C F G C.
  // After the "almost lost" warning: Bgm.setTempo(ALMOST_BPM); under 10 s left: Bgm.setTempo(HURRY_BPM).
  var C3 = 130.81, A2 = 110, F3 = 174.61, G3 = 196, E3 = 164.81, C4 = 261.63, D4 = 293.66;
  var A3 = 220, B3 = 246.94, E4 = 329.63, G4 = 392, F4 = 349.23;
  var C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5;

  // Per bar: [bass root, bass 5th, stab chord].
  var BARS = [
    [C3, G3, [E4, G4]], [A2, E3, [C4, E4]], [F3, C4, [A3, C4]], [G3, D4, [B3, D4]],
    [C3, G3, [E4, G4]], [F3, C4, [A3, C4]], [G3, D4, [B3, D4]], [C3, G3, [E4, G4]]
  ];
  var bass = [], chords = [], drums = [];
  BARS.forEach(function (b) {
    bass.push([b[0], 1.5], [b[0], 0.5], [b[1], 1], [b[0], 1]);
    chords.push([0, 1.5], [b[2], 0.5], [0, 1.5], [b[2], 0.5]);
    drums.push(['k', 1], ['h', 0.5], ['k', 0.5], ['s', 1], ['h', 0.5], ['h', 0.5]);
  });

  var steps = [
    [E5, 0.5], [G5, 0.5], [E5, 0.5], [C5, 0.5], [D5, 1], [0, 1],
    [C5, 0.5], [E5, 0.5], [A5, 1], [G5, 0.5], [E5, 0.5], [C5, 1],
    [F5, 0.5], [A5, 0.5], [F5, 0.5], [C5, 0.5], [A5, 1], [C5, 1],
    [D5, 0.5], [G5, 0.5], [B5, 1], [G5, 1], [0, 1],
    [E5, 0.5], [G5, 0.5], [C6, 1], [B5, 0.5], [G5, 0.5], [E5, 1],
    [F5, 0.5], [A5, 0.5], [C6, 1], [A5, 0.5], [F5, 0.5], [C5, 1],
    [D5, 0.5], [G5, 0.5], [B5, 0.5], [D5, 0.5], [G5, 1], [D5, 1],
    [E5, 1], [G5, 0.5], [E5, 0.5], [C5, 1], [0, 1]
  ];

  var BGM = {
    bpm: 116,
    wave: 'square',
    bend: 0.9,
    melodyPeak: 0.2,
    gate: 0.7,
    bassWave: 'triangle',
    chordWave: 'sine',
    chordLen: 0.12,
    bass: bass,
    chords: chords,
    drums: drums,
    steps: steps
  };

  G.Sounds = { register: register, BGM: BGM, ALMOST_BPM: 144, HURRY_BPM: 156, names: Object.keys(SOUNDS) };
})(Ailand.games.chain);
