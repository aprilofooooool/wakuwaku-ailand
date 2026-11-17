(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var F = A.games.fill, C = F.Constants;

  // Frame cells counted here (not with Puzzle.frameOf) so this test can pass before Task 3.
  function frameCells(p) {
    var D = C.DOTS_PER_CELL, w = p.pixels[0].length / D, h = p.pixels.length / D, cells = [];
    for (var cy = 0; cy < h; cy++) {
      for (var cx = 0; cx < w; cx++) {
        var on = false;
        for (var j = 0; j < D && !on; j++) {
          for (var i = 0; i < D; i++) {
            if (p.pixels[cy * D + j].charAt(cx * D + i) !== '.') { on = true; break; }
          }
        }
        if (on) { cells.push([cx, cy]); }
      }
    }
    return cells;
  }

  function connected(cells) {
    var set = {}, seen = {}, i, n = 0;
    for (i = 0; i < cells.length; i++) { set[cells[i][0] + ',' + cells[i][1]] = true; }
    var stack = [cells[0]];
    seen[cells[0][0] + ',' + cells[0][1]] = true;
    while (stack.length) {
      var c = stack.pop(); n++;
      var d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (i = 0; i < 4; i++) {
        var k = (c[0] + d[i][0]) + ',' + (c[1] + d[i][1]);
        if (set[k] && !seen[k]) { seen[k] = true; stack.push([c[0] + d[i][0], c[1] + d[i][1]]); }
      }
    }
    return n === cells.length;
  }

  describe('fill pictures', function () {
    it('every picture follows the format', function () {
      var ids = {};
      expect(F.Pictures.length).toBe(C.PER_LEVEL * C.LEVELS.length);
      F.Pictures.forEach(function (p) {
        var lv = C.LEVEL[p.level], keys = Object.keys(p.palette), w = p.pixels[0].length, h = p.pixels.length;
        expect(/^[a-z0-9-]+$/.test(p.id)).toBe(true);
        expect(ids[p.id]).toBe(undefined);
        ids[p.id] = true;
        expect(typeof p.name === 'string' && p.name.length > 0).toBe(true);
        expect(w % C.DOTS_PER_CELL).toBe(0);
        expect(h % C.DOTS_PER_CELL).toBe(0);
        expect(w).toBeLessThanOrEqual(lv.maxDots);
        expect(h).toBeLessThanOrEqual(lv.maxDots);
        expect(keys.length).toBeLessThanOrEqual(C.MAX_COLORS);
        expect(p.palette['.']).toBe(undefined);
        p.pixels.forEach(function (row) {
          expect(row.length).toBe(w);
          for (var x = 0; x < row.length; x++) {
            var ch = row.charAt(x);
            if (ch !== '.' && !p.palette.hasOwnProperty(ch)) { expect(p.id + ' bad char ' + ch).toBe(''); }
          }
        });
      });
    });
    it('every frame is in range and connected', function () {
      F.Pictures.forEach(function (p) {
        var lv = C.LEVEL[p.level], cells = frameCells(p);
        expect(p.id + ':' + (cells.length >= lv.minCells && cells.length <= lv.maxCells)).toBe(p.id + ':true');
        expect(p.id + ':' + connected(cells)).toBe(p.id + ':true');
      });
    });
    it('eight pictures per level', function () {
      C.LEVELS.forEach(function (lv, li) {
        var n = 0;
        F.Pictures.forEach(function (p, i) {
          if (p.level === lv) { n++; expect(Math.floor(i / C.PER_LEVEL)).toBe(li); }
        });
        expect(n).toBe(C.PER_LEVEL);
      });
    });
  });
})(Ailand);
