(function (G) {
  'use strict';

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function key(x, y) { return x + ',' + y; }

  // Shift min x/y to 0 and sort by y then x.
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

  // Horizontal mirror: x -> -x.
  function flip(cells) {
    return normalize(cells.map(function (c) { return [-c[0], c[1]]; }));
  }

  // Flip first, then rotate clockwise rot times.
  function orient(cells, rot, doFlip) {
    var r = normalize(cells);
    if (doFlip) { r = flip(r); }
    for (var i = 0; i < rot; i++) { r = rotate(r); }
    return r;
  }

  function same(a, b) {
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
  }

  // Distinct shapes among the 8 orientations.
  function orientations(cells) {
    var out = [];
    for (var f = 0; f < 2; f++) {
      for (var r = 0; r < 4; r++) {
        var c = orient(cells, r, f === 1);
        var dup = false;
        for (var i = 0; i < out.length; i++) {
          if (same(out[i].cells, c)) { dup = true; break; }
        }
        if (!dup) { out.push({ rot: r, flip: f === 1, cells: c }); }
      }
    }
    return out;
  }

  function place(cells, x, y) {
    return cells.map(function (c) { return [c[0] + x, c[1] + y]; });
  }

  function fits(frame, occupied, cells, x, y) {
    for (var i = 0; i < cells.length; i++) {
      var cx = cells[i][0] + x, cy = cells[i][1] + y;
      if (cx < 0 || cy < 0 || cx >= frame.w || cy >= frame.h) { return false; }
      if (!frame.on[cy] || !frame.on[cy][cx]) { return false; }
      if (occupied[key(cx, cy)] !== undefined) { return false; }
    }
    return true;
  }

  function freeCount(free, x, y) {
    var n = 0;
    for (var i = 0; i < 4; i++) {
      if (free[key(x + DIRS[i][0], y + DIRS[i][1])]) { n++; }
    }
    return n;
  }

  // true when every island of free cells has at least min cells.
  function islandsOk(free, cells, min) {
    var seen = {}, i, j;
    for (i = 0; i < cells.length; i++) {
      var k0 = key(cells[i][0], cells[i][1]);
      if (!free[k0] || seen[k0]) { continue; }
      var stack = [cells[i]], n = 0;
      seen[k0] = true;
      while (stack.length) {
        var c = stack.pop();
        n++;
        for (j = 0; j < 4; j++) {
          var nx = c[0] + DIRS[j][0], ny = c[1] + DIRS[j][1], k = key(nx, ny);
          if (free[k] && !seen[k]) { seen[k] = true; stack.push([nx, ny]); }
        }
      }
      if (n < min) { return false; }
    }
    return true;
  }

  // Split frameCells into connected pieces of min..max cells, or null on failure.
  function partition(frameCells, rand, min, max) {
    var free = {}, i, j;
    for (i = 0; i < frameCells.length; i++) { free[key(frameCells[i][0], frameCells[i][1])] = true; }
    var remaining = frameCells.length;
    var pieces = [];
    while (remaining > 0) {
      // Start: the free cell with the fewest free neighbours (first in frame order on ties).
      var start = null, best = 5;
      for (i = 0; i < frameCells.length; i++) {
        var fc = frameCells[i];
        if (!free[key(fc[0], fc[1])]) { continue; }
        var n = freeCount(free, fc[0], fc[1]);
        if (n < best) { best = n; start = fc; }
      }
      var size = min + Math.floor(rand() * (max - min + 1));
      var piece = [start];
      delete free[key(start[0], start[1])];
      while (piece.length < size) {
        var cands = [], seenC = {};
        for (i = 0; i < piece.length; i++) {
          for (j = 0; j < 4; j++) {
            var nx = piece[i][0] + DIRS[j][0], ny = piece[i][1] + DIRS[j][1], k = key(nx, ny);
            if (free[k] && !seenC[k]) { seenC[k] = true; cands.push([nx, ny]); }
          }
        }
        if (!cands.length) { break; }
        // Weighted pick: fewer free neighbours -> larger weight.
        var weights = [], total = 0;
        for (i = 0; i < cands.length; i++) {
          var w = 5 - freeCount(free, cands[i][0], cands[i][1]);
          weights.push(w);
          total += w;
        }
        var r = rand() * total, pick = cands.length - 1;
        for (i = 0; i < cands.length; i++) {
          r -= weights[i];
          if (r < 0) { pick = i; break; }
        }
        piece.push(cands[pick]);
        delete free[key(cands[pick][0], cands[pick][1])];
      }
      if (piece.length < min) { return null; }
      remaining -= piece.length;
      pieces.push(piece);
      if (remaining > 0 && !islandsOk(free, frameCells, min)) { return null; }
    }
    return pieces;
  }

  G.Piece = {
    normalize: normalize,
    rotate: rotate,
    flip: flip,
    orient: orient,
    orientations: orientations,
    same: same,
    place: place,
    fits: fits,
    partition: partition
  };
})(Ailand.games.fill);
