(function (G, C) {
  'use strict';

  // Twelve pieces per player (44 cells). Order is the tray order.
  var RAW = [
    ['p1', [[0, 0]]],
    ['i2', [[0, 0], [1, 0]]],
    ['i3', [[0, 0], [1, 0], [2, 0]]],
    ['l3', [[0, 0], [0, 1], [1, 1]]],
    ['i4', [[0, 0], [1, 0], [2, 0], [3, 0]]],
    ['o4', [[0, 0], [1, 0], [0, 1], [1, 1]]],
    ['t4', [[0, 0], [1, 0], [2, 0], [1, 1]]],
    ['l4', [[0, 0], [0, 1], [0, 2], [1, 2]]],
    ['s4', [[1, 0], [2, 0], [0, 1], [1, 1]]],
    ['x5', [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]],
    ['l5', [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]]],
    ['w5', [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]]]
  ];

  var LIST = RAW.map(function (r) { return { id: r[0], cells: C.Piece.normalize(r[1]) }; });
  var BY_ID = {};
  var total = 0;
  LIST.forEach(function (p) { BY_ID[p.id] = p; total += p.cells.length; });

  G.Pieces = {
    LIST: LIST,
    TOTAL_CELLS: total,
    byId: function (id) { return BY_ID[id] || null; }
  };
})(Ailand.games.territory, Ailand.core);
