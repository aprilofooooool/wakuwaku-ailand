(function (G) {
  'use strict';
  // Pure board-size math for the drop4 game screen. width/height = the game area below the header (px).
  // Portrait: chars row / ghost row + board / tools row. Landscape: chars | ghost row + board | chars | tools column.

  var SIDE = 16;        // horizontal gutter on each side
  var VPAD = 8;         // vertical padding above and below (portrait)
  var VPAD_L = 4;       // vertical padding above and below (landscape: height is scarce on phones)
  var GAP = 4;          // gap between cells
  var PAD = 6;          // board inner padding
  var DECOR_W = 6;      // board frame: 3px outline on both sides
  var DECOR_H = 12;     // board frame + drop shadow: 3px top, 9px bottom
  var TOOLS_H = 80;     // portrait tools row (16px space + 64px buttons)
  var TOOLS_W = 96;     // landscape tools column (8px space + 88px buttons)
  var CHARS_H = 112;    // portrait character row (face + name; the bubble floats over the board)
  var SIDE_W = 132;     // landscape character column, one on each side
  var CELL_MAX = 88;
  // Landscape seats: the bubble sits in the seat box (normal flow), so the face shrinks until
  // ceil(players / 2) seats fit the side column. Heights match drop4.css (.is-landscape rules).
  var FACE_P = 64;      // portrait face
  var FACE_MIN_L = 56;
  var FACE_MAX_L = 96;
  var NAME_H_L = 24;    // 2px margin + 22px name row
  var BUBBLE_H_L = 73;  // 2px margin + 2x2px border + 2x2px padding + 3 lines x 21px
  var SEAT_GAP_L = 2;   // gap between stacked seats

  // Space around the board (ghost row and board excluded) for an orientation.
  function reserved(orientation) {
    return orientation === 'landscape'
      ? { w: 2 * SIDE + 2 * SIDE_W + TOOLS_W + DECOR_W, h: 2 * VPAD_L + DECOR_H }
      : { w: 2 * SIDE + DECOR_W, h: 2 * VPAD + TOOLS_H + CHARS_H + DECOR_H };
  }

  function compute(o) {
    var orientation = o.width > o.height ? 'landscape' : 'portrait';
    var res = reserved(orientation);
    var availW = o.width - res.w;
    var availH = o.height - res.h;
    // The ghost row above the board is one cell high.
    var cellW = Math.floor((availW - (o.cols - 1) * GAP - 2 * PAD) / o.cols);
    var cellH = Math.floor((availH - (o.rows - 1) * GAP - 2 * PAD) / (o.rows + 1));
    var cell = Math.max(1, Math.min(cellW, cellH, CELL_MAX));
    var face = FACE_P;
    if (orientation === 'landscape') {
      var perSide = Math.ceil((o.players || 2) / 2);
      var slot = Math.floor((o.height - 2 * VPAD_L - (perSide - 1) * SEAT_GAP_L) / perSide);
      face = Math.max(FACE_MIN_L, Math.min(FACE_MAX_L, slot - NAME_H_L - BUBBLE_H_L));
    }
    return {
      orientation: orientation,
      cell: cell,
      face: face,
      seatH: face + NAME_H_L + BUBBLE_H_L,
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
    compute: compute, colAt: colAt, reserved: reserved,
    SIDE: SIDE, VPAD: VPAD, VPAD_L: VPAD_L, GAP: GAP, PAD: PAD, DECOR_W: DECOR_W, DECOR_H: DECOR_H,
    TOOLS_H: TOOLS_H, TOOLS_W: TOOLS_W, CHARS_H: CHARS_H, SIDE_W: SIDE_W, CELL_MAX: CELL_MAX,
    NAME_H_L: NAME_H_L, BUBBLE_H_L: BUBBLE_H_L, SEAT_GAP_L: SEAT_GAP_L
  };
})(Ailand.games.drop4);
