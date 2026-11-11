(function (G) {
  'use strict';
  G.Constants = {
    DURATION_MS: 50000,
    FINAL_MS: 10000,
    COUNTDOWN_MS: 3000,
    HOLES: 9,
    REACT_MS: 600,
    COOLDOWN_MS: 300,
    FIRST_SPAWN_MS: 600,
    RARE_GAP_MS: 2000,
    POINTS: { self: 1, rare: 5, ng: -3 },
    DIFFICULTY: {
      easy: { intervalStart: 1100, intervalEnd: 700, upStart: 1600, upEnd: 1100, finalFactor: 0.8, maxStart: 2, maxFinal: 3, ngRate: 0.15, rareCount: 2 },
      normal: { intervalStart: 900, intervalEnd: 500, upStart: 1300, upEnd: 850, finalFactor: 0.8, maxStart: 2, maxFinal: 4, ngRate: 0.20, rareCount: 3 },
      hard: { intervalStart: 700, intervalEnd: 380, upStart: 1050, upEnd: 650, finalFactor: 0.8, maxStart: 3, maxFinal: 4, ngRate: 0.25, rareCount: 5 }
    }
  };
})(Ailand.games.whack);
