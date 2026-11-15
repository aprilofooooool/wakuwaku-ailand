(function (G) {
  'use strict';
  var OFFSETS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function cells(pair) {
    var o = OFFSETS[pair.rot];
    return [
      { col: pair.x, row: pair.y, charId: pair.axis, role: 'axis' },
      { col: pair.x + o[0], row: pair.y + o[1], charId: pair.child, role: 'child' }
    ];
  }

  function make(pair, x, y, rot) {
    return { x: x, y: y, rot: rot, axis: pair.axis, child: pair.child };
  }

  // Rotate clockwise; try no shift, then away from the child, then up by one.
  function tryRotate(pair, fits) {
    var rot = (pair.rot + 1) % 4;
    var dx = -OFFSETS[rot][0];
    var tries = [[pair.x, pair.y]];
    if (dx !== 0) { tries.push([pair.x + dx, pair.y]); }
    tries.push([pair.x, pair.y - 1]);
    for (var i = 0; i < tries.length; i++) {
      var cand = make(pair, tries[i][0], tries[i][1], rot);
      if (fits(cand)) { return cand; }
    }
    return null;
  }

  G.Pair = { OFFSETS: OFFSETS, cells: cells, tryRotate: tryRotate };
})(Ailand.games.chain);
