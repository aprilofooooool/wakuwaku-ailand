(function (G) {
  'use strict';
  G.Constants = {
    COLS: 6,
    ROWS: 12,
    HIDDEN: 1,
    SPAWN_X: 2,
    SPAWN_Y: 1,
    LOCK_MS: 500,
    LOCK_RESETS: 15,
    SOFT_MS: 50,
    REPEAT_DELAY_MS: 170,
    REPEAT_MS: 50,
    POP_MIN: 4,
    WOBBLE_MS: 300,
    FALL_CELL_MS: 40,
    COUNTDOWN_MS: 3000,
    HURRY_MS: 10000,
    DANGER_ROWS: 3,
    MAX_PER_COLUMN: 2,
    TURN_WARN_MS: 2000,
    MAX_SLEEPERS: 12,
    CHARS: ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'],
    DIFFICULTY: {
      easy: { sleepers: 4, fallMs: 800, timeMs: 150000, wakeMs: 6000, turnMs: null },
      normal: { sleepers: 6, fallMs: 600, timeMs: 120000, wakeMs: 5000, turnMs: null },
      hard: { sleepers: 8, fallMs: 450, timeMs: 120000, wakeMs: 4000, turnMs: 15000 }
    }
  };
})(Ailand.games.chain);
