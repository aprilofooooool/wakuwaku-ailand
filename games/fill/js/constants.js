(function (G) {
  'use strict';
  G.Constants = {
    DOTS_PER_CELL: 4,
    PIECE_MIN: 4,
    PIECE_MAX: 5,
    MAX_TRIES: 1000,
    HINT_MS: 2000,
    PLACE_REACT_RATE: 1 / 3,
    CHARS: ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'],
    LEVELS: ['easy', 'normal', 'hard'],
    LEVEL: {
      easy: { minCells: 20, maxCells: 30, maxDots: 24 },
      normal: { minCells: 30, maxCells: 40, maxDots: 28 },
      hard: { minCells: 40, maxCells: 50, maxDots: 32 }
    },
    MAX_COLORS: 8,
    PER_LEVEL: 8
  };
})(Ailand.games.fill);
