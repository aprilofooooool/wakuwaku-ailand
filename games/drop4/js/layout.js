(function (G) {
  'use strict';
  // Pure board-size math for the drop4 game screen. width/height = the game area below the header (px).

  var SIDE = 16;        // horizontal gutter on each side
  var VPAD = 8;         // vertical padding above and below
  var GAP = 4;          // gap between cells
  var PAD = 6;          // board inner padding
  var TOOLS_H = 72;     // mode buttons row (64px buttons + 8px)
  var CHARS_H = 112;    // portrait character row (face + name; the bubble floats over the board)
  var SIDE_W = 132;     // landscape character column, one on each side
  var CELL_MAX = 88;

  function compute(o) {
    var landscape = o.width > o.height;
    var availW = o.width - 2 * SIDE - (landscape ? 2 * SIDE_W : 0);
    var availH = o.height - 2 * VPAD - TOOLS_H - (landscape ? 0 : CHARS_H);
    // The ghost row above the board is one cell high.
    var cellW = Math.floor((availW - (o.cols - 1) * GAP - 2 * PAD) / o.cols);
    var cellH = Math.floor((availH - (o.rows - 1) * GAP - 2 * PAD) / (o.rows + 1));
    var cell = Math.max(1, Math.min(cellW, cellH, CELL_MAX));
    return {
      orientation: landscape ? 'landscape' : 'portrait',
      cell: cell,
      boardW: o.cols * cell + (o.cols - 1) * GAP + 2 * PAD,
      boardH: o.rows * cell + (o.rows - 1) * GAP + 2 * PAD,
      colHit: cell + GAP
    };
  }

  // Column under x (px from the board's left edge). Gaps and padding belong to the nearest column; outside = -1.
  function colAt(x, layout, cols) {
    if (x < 0 || x > layout.boardW) { return -1; }
    var c = Math.floor((x - PAD + GAP / 2) / layout.colHit);
    return Math.max(0, Math.min(cols - 1, c));
  }

  G.Layout = {
    compute: compute, colAt: colAt,
    SIDE: SIDE, VPAD: VPAD, GAP: GAP, PAD: PAD, TOOLS_H: TOOLS_H, CHARS_H: CHARS_H, SIDE_W: SIDE_W, CELL_MAX: CELL_MAX,
    PORTRAIT_RESERVED_H: 2 * VPAD + TOOLS_H + CHARS_H
  };
})(Ailand.games.drop4);
