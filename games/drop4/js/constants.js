(function (G) {
  'use strict';
  G.Constants = {
    SIZES: { 2: { cols: 7, rows: 6 }, 3: { cols: 9, rows: 7 }, 4: { cols: 10, rows: 8 } },
    EMPTY: 0,
    BLOCK: 9,
    // B-3: on a human turn with no operation for this long, the waiting characters fall asleep.
    SLEEP_AFTER_MS: 20000,
    // CPU parameters per level (tuned with tests/tools/measure-drop4.js; see .claude/docs/reports/2026-11-08-drop4-ai-measure.md).
    AI: {
      weak: { winRate: 0.4, blockRate: 0.1, blockUseRate: 0.02 },
      normal: { depth: 4, noise: 500, missRate: 0.7 },
      strong: { budgetMs: 400, maxDepth2p: 10, maxDepthMulti: 5 }
    }
  };
})(Ailand.games.drop4);
