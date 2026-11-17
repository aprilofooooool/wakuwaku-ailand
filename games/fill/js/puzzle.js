(function (G) {
  'use strict';

  var C = G.Constants, P = G.Piece;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // A cell is on when any dot in its DOTS_PER_CELL square is not '.'.
  function frameOf(picture) {
    var n = C.DOTS_PER_CELL, rows = picture.pixels;
    var w = Math.ceil(rows[0].length / n), h = Math.ceil(rows.length / n);
    var on = [], cells = [], x, y, dx, dy;
    for (y = 0; y < h; y++) {
      on.push([]);
      for (x = 0; x < w; x++) {
        var any = false;
        for (dy = 0; dy < n && !any; dy++) {
          var row = rows[y * n + dy] || '';
          for (dx = 0; dx < n; dx++) {
            var ch = row.charAt(x * n + dx);
            if (ch !== '' && ch !== '.') { any = true; break; }
          }
        }
        on[y].push(any);
        if (any) { cells.push([x, y]); }
      }
    }
    return { w: w, h: h, on: on, cells: cells, count: cells.length };
  }

  // Assign colors 0..3, biggest pieces first, avoiding colors of already colored neighbours.
  function colorPieces(pieces) {
    var owner = {}, i, j, k;
    pieces.forEach(function (p, idx) {
      P.place(p.cells, p.answer.x, p.answer.y).forEach(function (c) { owner[c[0] + ',' + c[1]] = idx; });
    });
    var nbrs = pieces.map(function (p) {
      var set = {};
      P.place(p.cells, p.answer.x, p.answer.y).forEach(function (c) {
        for (var d = 0; d < 4; d++) {
          var o = owner[(c[0] + DIRS[d][0]) + ',' + (c[1] + DIRS[d][1])];
          if (o !== undefined && o !== owner[c[0] + ',' + c[1]]) { set[o] = true; }
        }
      });
      return Object.keys(set).map(Number);
    });
    var order = pieces.map(function (p, idx) { return idx; });
    order.sort(function (a, b) { return pieces[b].cells.length - pieces[a].cells.length || a - b; });
    var n = C.CHARS.length;
    for (i = 0; i < order.length; i++) {
      var idx = order[i], used = [];
      for (k = 0; k < n; k++) { used.push(0); }
      for (j = 0; j < nbrs[idx].length; j++) {
        var nc = pieces[nbrs[idx][j]].color;
        if (nc >= 0) { used[nc]++; }
      }
      var best = 0;
      for (k = 1; k < n; k++) { if (used[k] < used[best]) { best = k; } }
      pieces[idx].color = best;
    }
  }

  function shuffle(arr, rand) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1)), t = arr[i];
      arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function make(picture, seed) {
    var frame = frameOf(picture), rand = null, parts = null, used = seed;
    for (var t = 0; t < C.MAX_TRIES; t++) {
      used = seed + t;
      rand = Ailand.core.Rng.mulberry32(used);
      parts = P.partition(frame.cells, rand, C.PIECE_MIN, C.PIECE_MAX);
      if (parts) { break; }
    }
    if (!parts) { throw new Error('fill: cannot make puzzle for ' + picture.id + ' seed ' + seed); }
    var pieces = parts.map(function (abs, i) {
      var cells = P.normalize(abs), minX = Infinity, minY = Infinity;
      abs.forEach(function (c) { minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]); });
      var o = Math.floor(rand() * 8);
      return { id: 'p' + i, cells: cells, answer: { x: minX, y: minY },
        start: { rot: o % 4, flip: o >= 4 ? 1 : 0 }, color: -1 };
    });
    colorPieces(pieces);
    var tray = shuffle(pieces.map(function (p) { return p.id; }), rand);
    return { frame: frame, seed: used, pieces: pieces, tray: tray };
  }

  G.Puzzle = { frameOf: frameOf, make: make };
})(Ailand.games.fill);
