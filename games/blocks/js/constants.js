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
    STAR_MS: 15000,
    STAR_MIN: 12,
    STAR_MAX: 18,
    STAR_SETTLE_MS: 600,
    HURRY_MS: 10000,
    CHALLENGE_MS: 180000,
    DIFFICULTY: {
      easy: { fallMs: 900, minMs: 350, goal: 15, timeMs: 180000, faceMs: 3000 },
      normal: { fallMs: 650, minMs: 200, goal: 30, timeMs: 150000, faceMs: 3000 },
      hard: { fallMs: 450, minMs: 120, goal: 50, timeMs: 120000, faceMs: 2000 }
    }
  };
})(Ailand.games.blocks);
