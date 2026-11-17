(function (G) {
  'use strict';
  // Pure layout math for the fill screen (no DOM).
  var MIN_CELL = 16;
  var PIECE_CELL = 24; // tray piece cell size (px) at scale 1
  var GAP = 8;         // gap (px) between tray pieces at scale 1
  var MIN_SCALE = 0.4;
  var STEPS = 20;      // scale tried in 1/20 steps: 1, 0.95, ... 0.4

  // Cell size (px) that fits the whole board (w x h cells) in the play area; never below 16.
  function cellSize(areaW, areaH, w, h) {
    return Math.max(MIN_CELL, Math.floor(Math.min(areaW / w, areaH / h)));
  }

  // Board cell {x, y} nearest to the top-left corner (left, top) of a dragged piece.
  function snap(boardRect, cell, left, top) {
    return { x: Math.round((left - boardRect.left) / cell), y: Math.round((top - boardRect.top) / cell) };
  }

  // True when pieces flowed left to right, wrapping into rows, fit in the tray at this scale.
  function fits(trayW, trayH, sizes, scale) {
    var x = 0, y = 0, rowH = 0, gap = GAP * scale;
    for (var i = 0; i < sizes.length; i++) {
      var pw = sizes[i].w * PIECE_CELL * scale, ph = sizes[i].h * PIECE_CELL * scale;
      if (x > 0 && x + pw > trayW) { x = 0; y += rowH + gap; rowH = 0; }
      x += pw + gap;
      rowH = Math.max(rowH, ph);
    }
    return y + rowH <= trayH;
  }

  // Shrink ratio (0.4-1) that lets every piece sit in the tray at once.
  // sizes: array of { w, h } = piece bounding boxes in cells (1 cell = 24 px at ratio 1, 8 px gap).
  // Pieces flow left to right and wrap; returns the largest ratio that fits, or 0.4 if none does.
  function trayScale(trayW, trayH, sizes) {
    for (var i = STEPS; i > MIN_SCALE * STEPS; i--) {
      var s = i / STEPS;
      if (fits(trayW, trayH, sizes, s)) { return s; }
    }
    return MIN_SCALE;
  }

  G.Layout = { cellSize: cellSize, snap: snap, trayScale: trayScale };
})(Ailand.games.fill);
