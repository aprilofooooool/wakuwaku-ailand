(function (G) {
  'use strict';
  G.Constants = {
    SIZES: { 2: 11, 3: 14, 4: 14 },
    // Start corner per seat: tl = top-left, tr = top-right, br = bottom-right, bl = bottom-left.
    CORNERS: {
      2: { 1: 'tl', 2: 'br' },
      3: { 1: 'tl', 2: 'tr', 3: 'br' },
      4: { 1: 'tl', 2: 'tr', 3: 'br', 4: 'bl' }
    },
    CHARS: ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'],
    SLEEP_AFTER_MS: 20000,
    BLOCK_MIN: 3,
    TIP_MS: 2000,
    AI: {
      weak: { size: 1, mine: 1, opp: 1, noise: 75 },
      normal: { size: 3, mine: 1, opp: 1, noise: 38 },
      strong: { size: 3, mine: 1, opp: 1, noise: 0, budgetMs: 400, topK: 30, reply: 0.5 }
    }
  };
})(Ailand.games.territory);
