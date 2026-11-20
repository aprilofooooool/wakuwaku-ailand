(function (C) {
  'use strict';

  // Piece shape math. A shape is [[x, y], ...]; normalized = min x/y 0, sorted by y then x.
  // Orientation order: flip (x -> -x) first, then clockwise turns ((x, y) -> (-y, x)), normalizing each time.

  function normalize(cells) {
    var minX = Infinity, minY = Infinity, i;
    for (i = 0; i < cells.length; i++) {
      if (cells[i][0] < minX) { minX = cells[i][0]; }
      if (cells[i][1] < minY) { minY = cells[i][1]; }
    }
    var out = [];
    for (i = 0; i < cells.length; i++) { out.push([cells[i][0] - minX, cells[i][1] - minY]); }
    out.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
    return out;
  }

  // Clockwise once: (x, y) -> (-y, x).
  function rotate(cells) {
    return normalize(cells.map(function (c) { return [-c[1], c[0]]; }));
  }

  // Mirror left-right: x -> -x.
  function flip(cells) {
    return normalize(cells.map(function (c) { return [-c[0], c[1]]; }));
  }

  // Flip first (when flipOn is truthy), then rotate clockwise rot times.
  function orient(cells, rot, flipOn) {
    var r = normalize(cells);
    if (flipOn) { r = flip(r); }
    for (var i = 0; i < rot; i++) { r = rotate(r); }
    return r;
  }

  function same(a, b) {
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
  }

  // Distinct orientations as { rot, flip, cells }; the first in rot-then-flip order is kept.
  function orientations(cells) {
    var out = [], seen = {};
    for (var r = 0; r < 4; r++) {
      for (var f = 0; f < 2; f++) {
        var c = orient(cells, r, f), k = JSON.stringify(c);
        if (!seen[k]) { seen[k] = true; out.push({ rot: r, flip: f, cells: c }); }
      }
    }
    return out;
  }

  function place(cells, x, y) {
    return cells.map(function (c) { return [c[0] + x, c[1] + y]; });
  }

  C.Piece = { normalize: normalize, rotate: rotate, flip: flip, orient: orient, orientations: orientations, same: same, place: place };
})(window.Ailand.core);
