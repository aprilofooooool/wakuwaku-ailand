(function (G) {
  'use strict';
  G.Constants = {
    DOTS_PER_CELL: 2,
    MAX_TRIES: 1000,
    HINT_MS: 2000,
    PLACE_REACT_RATE: 1 / 3,
    CHARS: ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'],
    LEVELS: ['easy', 'normal', 'hard'],
    LEVEL: {
      easy: { pieces: 8, rotate: false, guide: 0.45, maxDots: 24 },
      normal: { pieces: 12, rotate: true, guide: 0.2, maxDots: 28 },
      hard: { pieces: 16, rotate: true, guide: 0, maxDots: 32 }
    },
    MAX_COLORS: 8,
    PER_LEVEL: 8
  };
})(Ailand.games.fill);
