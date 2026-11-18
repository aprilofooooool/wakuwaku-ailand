(function (G) {
  'use strict';

  var C = G.Constants, P = G.Piece;

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
      parts = P.partition(frame.cells, rand, C.LEVEL[picture.level].pieces);
      if (parts) { break; }
    }
    if (!parts) { throw new Error('fill: cannot make puzzle for ' + picture.id + ' seed ' + seed); }
    var pieces = parts.map(function (abs, i) {
      var cells = P.normalize(abs), minX = Infinity, minY = Infinity;
      abs.forEach(function (c) { minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]); });
      var rot = C.LEVEL[picture.level].rotate ? Math.floor(rand() * 4) : 0;
      return { id: 'p' + i, cells: cells, answer: { x: minX, y: minY }, start: { rot: rot } };
    });
    var tray = shuffle(pieces.map(function (p) { return p.id; }), rand);
    return { frame: frame, seed: used, pieces: pieces, tray: tray };
  }

  G.Puzzle = { frameOf: frameOf, make: make };
})(Ailand.games.fill);
