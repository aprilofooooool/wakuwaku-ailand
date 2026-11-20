(function (G) {
  'use strict';

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function key(x, y) { return x + ',' + y; }

  function fits(frame, occupied, cells, x, y) {
    for (var i = 0; i < cells.length; i++) {
      var cx = cells[i][0] + x, cy = cells[i][1] + y;
      if (cx < 0 || cy < 0 || cx >= frame.w || cy >= frame.h) { return false; }
      if (!frame.on[cy] || !frame.on[cy][cx]) { return false; }
      if (occupied[key(cx, cy)] !== undefined) { return false; }
    }
    return true;
  }

  // Grid (BFS) distance from src to every frame cell, keyed by key(x, y).
  function distancesFrom(inFrame, src) {
    var dist = {}, queue = [src], head = 0;
    dist[key(src[0], src[1])] = 0;
    while (head < queue.length) {
      var c = queue[head++], d = dist[key(c[0], c[1])];
      for (var j = 0; j < 4; j++) {
        var nx = c[0] + DIRS[j][0], ny = c[1] + DIRS[j][1], k = key(nx, ny);
        if (inFrame[k] && dist[k] === undefined) { dist[k] = d + 1; queue.push([nx, ny]); }
      }
    }
    return dist;
  }

  // Split connected frameCells into count connected pieces (each 0.5x to 1.5x the average size), or null.
  function partition(frameCells, rand, count) {
    var inFrame = {}, i, j, k;
    for (i = 0; i < frameCells.length; i++) { inFrame[key(frameCells[i][0], frameCells[i][1])] = true; }
    var avg = frameCells.length / count;
    var minSize = Math.ceil(0.5 * avg), maxSize = Math.floor(1.5 * avg);
    if (frameCells.length < count) { return null; }

    // Seeds: first at random, then the cell farthest from all chosen seeds (ties by rand).
    var seeds = [frameCells[Math.floor(rand() * frameCells.length)]];
    var minDist = distancesFrom(inFrame, seeds[0]);
    while (seeds.length < count) {
      var bestD = -1, ties = [];
      for (i = 0; i < frameCells.length; i++) {
        var d = minDist[key(frameCells[i][0], frameCells[i][1])];
        if (d > bestD) { bestD = d; ties = [frameCells[i]]; } else if (d === bestD) { ties.push(frameCells[i]); }
      }
      if (bestD <= 0) { return null; }
      var seed = ties[Math.floor(rand() * ties.length)], nd = distancesFrom(inFrame, seed);
      seeds.push(seed);
      for (k in nd) { if (nd[k] < minDist[k]) { minDist[k] = nd[k]; } }
    }

    // Grow all pieces together: the smallest piece takes a random free neighbouring cell.
    var owner = {}, pieces = [], remaining = frameCells.length - count;
    for (i = 0; i < count; i++) { pieces.push([seeds[i]]); owner[key(seeds[i][0], seeds[i][1])] = i; }
    while (remaining > 0) {
      var order = [];
      for (i = 0; i < count; i++) { order.push(i); }
      order.sort(function (a, b) { return pieces[a].length - pieces[b].length; });
      var grew = false;
      for (i = 0; i < count && !grew; i++) {
        // Among pieces of the same smallest size, start at a random one.
        var size = pieces[order[i]].length, n = 0;
        while (i + n < count && pieces[order[i + n]].length === size) { n++; }
        var off = Math.floor(rand() * n);
        for (j = 0; j < n && !grew; j++) {
          var pi = order[i + (j + off) % n], cands = [], seenC = {}, c;
          for (var m = 0; m < pieces[pi].length; m++) {
            for (k = 0; k < 4; k++) {
              var nx = pieces[pi][m][0] + DIRS[k][0], ny = pieces[pi][m][1] + DIRS[k][1], kk = key(nx, ny);
              if (inFrame[kk] && owner[kk] === undefined && !seenC[kk]) { seenC[kk] = true; cands.push([nx, ny]); }
            }
          }
          if (cands.length) {
            c = cands[Math.floor(rand() * cands.length)];
            pieces[pi].push(c);
            owner[key(c[0], c[1])] = pi;
            remaining--;
            grew = true;
          }
        }
        i += n - 1;
      }
      if (!grew) { return null; }
    }
    for (i = 0; i < count; i++) {
      if (pieces[i].length < minSize || pieces[i].length > maxSize) { return null; }
    }
    return pieces;
  }

  // Shape math lives in core; re-exported under the same names so the other fill files are unchanged.
  var K = Ailand.core.Piece;
  G.Piece = {
    normalize: K.normalize,
    rotate: K.rotate,
    flip: K.flip,
    orient: K.orient,
    orientations: K.orientations,
    same: K.same,
    place: K.place,
    fits: fits,
    distancesFrom: distancesFrom,
    partition: partition
  };
})(Ailand.games.fill);
