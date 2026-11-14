(function (G) {
  'use strict';
  G.Constants = {
    COLS: 10,
    ROWS: 20,
    HIDDEN: 2,
    LOCK_MS: 500,
    LOCK_RESETS: 15,
    SOFT_MS: 50,
    REPEAT_DELAY_MS: 170,
    REPEAT_MS: 50,
    SETTLE_MS: 250,
    COUNTDOWN_MS: 3000,
    ALMOST: 3,
    DANGER_ROWS: 4,
    SPEEDUP_LINES: 4,
    SPEEDUP: 0.92,
    DIFFICULTY: {
      easy: { fallMs: 900, minMs: 350, goal: 12 },
      normal: { fallMs: 650, minMs: 200, goal: 20 },
      hard: { fallMs: 450, minMs: 120, goal: 28 }
    }
  };
})(Ailand.games.blocks);
