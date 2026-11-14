(function (G) {
  'use strict';
  // Rotation 0 cells live in the top two rows of the box. I uses a 4x4 box, O never moves,
  // the others rotate inside a 3x3 box (x, y) -> (size-1-y, x), clockwise with y down.
  var BASE = {
    I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { size: 4, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
    T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }
  };
  var KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1]];

  function cells(shape, rot) {
    var b = BASE[shape];
    var n = ((rot % 4) + 4) % 4;
    var out = b.cells.map(function (c) { return [c[0], c[1]]; });
    if (shape === 'O') { return out; }
    for (var i = 0; i < n; i++) {
      out = out.map(function (c) { return [b.size - 1 - c[1], c[0]]; });
    }
    return out;
  }

  function tryRotate(piece, fits) {
    var rot = (((piece.rot + 1) % 4) + 4) % 4;
    for (var i = 0; i < KICKS.length; i++) {
      var cand = { shape: piece.shape, charId: piece.charId, x: piece.x + KICKS[i][0], y: piece.y + KICKS[i][1], rot: rot };
      if (fits(cand)) { return cand; }
    }
    return null;
  }

  G.Pieces = {
    SHAPES: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
    KICKS: KICKS,
    cells: cells,
    tryRotate: tryRotate
  };
})(Ailand.games.blocks);
