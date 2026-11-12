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

  // BGM "ドタバタ・ダッシュ" (design 2026-11-12-bgm-variety §2): a busy, cheerful E major dash, 150 bpm,
  // 8 bars of 4/4 (32 beats). Short sawtooth "pico" lead running in 16ths, triangle bass jumping octaves on every
  // 8th, short square two-note stabs, four-on-the-floor kick with snare on 2 and 4 and off-beat hi-hats.
  // Chords (IV-V-iii-vi): A B G#m C#m | A B C#m B. The last 10 seconds: Bgm.setTempo(FINAL_BPM).
  var GS2 = 103.83, A2 = 110, B2 = 123.47, CS3 = 138.59, GS3 = 207.65, A3 = 220, B3 = 246.94;
  var CS4 = 277.18, DS4 = 311.13, E4 = 329.63, FS4 = 369.99, GS4 = 415.3;
  var B4 = 493.88, CS5 = 554.37, DS5 = 622.25, E5 = 659.25, FS5 = 739.99, GS5 = 830.61, A5 = 880, B5 = 987.77;
  var CS6 = 1108.73;

  var AMAJ = [A2, A3, [CS4, E4]], BMAJ = [B2, B3, [DS4, FS4]], GSM = [GS2, GS3, [B3, DS4]], CSM = [CS3, CS4, [E4, GS4]];
  // Per bar: [bass root, bass octave, stab chord]; all >= 100 Hz.
  var BARS = [AMAJ, BMAJ, GSM, CSM, AMAJ, BMAJ, CSM, BMAJ];
  var bass = [], chords = [], drums = [];
  BARS.forEach(function (b) {
    for (var k = 0; k < 4; k++) { bass.push([b[0], 0.5], [b[1], 0.5]); }
    chords.push([0, 1.5], [b[2], 0.5], [0, 1.5], [b[2], 0.5]);
    drums.push(['k', 0.5], ['h', 0.5], ['ks', 0.5], ['h', 0.5], ['k', 0.5], ['h', 0.5], ['ks', 0.5], ['h', 0.5]);
  });

  var RUN_A = [[E5, 0.25], [FS5, 0.25], [GS5, 0.5], [E5, 0.5], [CS5, 0.5], [E5, 0.5], [A5, 0.5], [GS5, 0.5], [E5, 0.5]];
  var RUN_B = [[FS5, 0.25], [GS5, 0.25], [A5, 0.5], [FS5, 0.5], [DS5, 0.5], [FS5, 0.5], [B5, 0.5], [A5, 0.5], [FS5, 0.5]];
  var steps = [].concat(RUN_A, RUN_B, [
    [GS5, 0.5], [B5, 0.5], [GS5, 0.25], [FS5, 0.25], [E5, 0.5], [DS5, 0.5], [E5, 0.5], [FS5, 0.5], [GS5, 0.5],
    [CS6, 0.5], [B5, 0.5], [GS5, 0.5], [E5, 0.5], [CS5, 1], [0, 1]
  ], RUN_A, RUN_B, [
    [E5, 0.25], [GS5, 0.25], [CS6, 0.5], [B5, 0.5], [GS5, 0.5], [A5, 0.5], [B5, 0.5], [CS6, 0.5], [B5, 0.5],
    [B5, 0.5], [0, 0.25], [B5, 0.25], [A5, 0.25], [GS5, 0.25], [FS5, 0.5], [DS5, 0.5], [FS5, 0.5], [B4, 0.5], [0, 0.5]
  ]);

  var BGM = {
    bpm: 150,
    wave: 'sawtooth',
    melodyPeak: 0.176,
    gate: 0.6,
    bassWave: 'triangle',
    chordWave: 'square',
    chordLen: 0.08,
    bass: bass,
    chords: chords,
    drums: drums,
    steps: steps
  };

  G.Sounds = { register: register, BGM: BGM, FINAL_BPM: 180, names: Object.keys(SOUNDS) };
})(Ailand.games.whack);
