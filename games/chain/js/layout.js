(function (G) {
  'use strict';
  // Pure layout math for the chain screen (no DOM).
  var K = G.Constants;
  var MIN_CELL = 8;

  // Cell size (px) that fits the whole visible board (COLS x ROWS) in the play area.
  function cellSize(areaW, areaH) {
    return Math.max(MIN_CELL, Math.floor(Math.min(areaW / K.COLS, areaH / K.ROWS)));
  }

  // Page-space center of a cell. row counts the hidden row too, so the first visible row is row HIDDEN.
  function cellCenter(canvasRect, cell, col, row) {
    return { x: canvasRect.left + (col + 0.5) * cell, y: canvasRect.top + (row - K.HIDDEN + 0.5) * cell };
  }

  G.Layout = { cellSize: cellSize, cellCenter: cellCenter };
})(Ailand.games.chain);
