(function (G) {
  'use strict';
  // Pure layout math for the territory board (no DOM).
  var LIFT_PX = 40;          // a dragged piece floats this far above the finger (same as fill)
  var MIN_CELL_390 = 24;     // smallest cell (px) allowed on a 390 px wide phone (design 4.4)
  var BOARD_PX_390 = 358;    // 390 px screen minus a 16 px gutter on each side

  // Cell size (px) for a board that is boardPx wide with size x size cells.
  function cellSize(boardPx, size) { return Math.floor(boardPx / size); }

  // Board cell [x, y] under the point (px, py) (page coordinates); null outside the board.
  // rect: DOMRect-like { left, top, width, height } of the board square.
  function toCell(px, py, rect, size) {
    var cell = rect.width / size;
    var x = Math.floor((px - rect.left) / cell), y = Math.floor((py - rect.top) / cell);
    if (x < 0 || y < 0 || x >= size || y >= size) { return null; }
    return [x, y];
  }

  // Top-left board cell {x, y} of a dragged piece. dragPoint {x, y} is the finger in board-local px
  // (page point minus the board's left/top). The piece is centred on the finger and lifted by offset px.
  // The result may lie outside the board; the engine rejects such moves.
  function snap(dragPoint, pieceCells, cell, offset) {
    var w = 0, h = 0;
    pieceCells.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); });
    var left = dragPoint.x - (w * cell) / 2;
    var top = dragPoint.y - offset - (h * cell) / 2;
    return { x: Math.round(left / cell), y: Math.round(top / cell) };
  }

  // True when a size x size board gets cells of 24 px or more on a 390 px wide screen.
  function fits390(size) { return cellSize(BOARD_PX_390, size) >= MIN_CELL_390; }

  G.Layout = { LIFT_PX: LIFT_PX, cellSize: cellSize, toCell: toCell, snap: snap, fits390: fits390 };
})(Ailand.games.territory);
