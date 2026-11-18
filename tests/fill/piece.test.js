(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var P = A.games.fill.Piece;

  var L5 = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]];

  function rect(w, h) {
    var c = [];
    for (var y = 0; y < h; y++) { for (var x = 0; x < w; x++) { c.push([x, y]); } }
    return c;
  }

  function connected(cells) {
    var set = {}, i;
    for (i = 0; i < cells.length; i++) { set[cells[i][0] + ',' + cells[i][1]] = true; }
    var seen = {}, stack = [cells[0]], n = 0;
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

  describe('fill piece', function () {
    it('normalize shifts to zero and sorts', function () {
      expect(P.normalize([[2, 3], [1, 3], [1, 4]])).toEqual([[0, 0], [1, 0], [0, 1]]);
    });
    it('rotate four times returns the same', function () {
      var c = P.normalize(L5), r = c;
      for (var i = 0; i < 4; i++) { r = P.rotate(r); }
      expect(r).toEqual(c);
      expect(P.rotate([[0, 0], [0, 1], [0, 2], [1, 2]])).toEqual([[0, 0], [1, 0], [2, 0], [0, 1]]);
    });
    it('orient rotates clockwise and four turns equal normalize', function () {
      var c = [[3, 4], [3, 5], [3, 6], [4, 6]];
      expect(P.orient(c, 4)).toEqual(P.normalize(c));
      expect(P.orient(c, 0)).toEqual(P.normalize(c));
      expect(P.orient(c, 1)).toEqual(P.rotate(P.normalize(c)));
    });
    it('same compares after normalize', function () {
      expect(P.same([[5, 5], [6, 5]], [[0, 0], [1, 0]])).toBe(true);
      expect(P.same([[0, 0], [1, 0]], [[0, 0], [0, 1]])).toBe(false);
    });
    it('place moves to absolute cells', function () {
      expect(P.place([[0, 0], [1, 0]], 2, 3)).toEqual([[2, 3], [3, 3]]);
    });
    it('fits checks frame and overlap', function () {
      var frame = { w: 3, h: 2, on: [[true, true, false], [true, true, true]] };
      var occ = { '0,1': 'p1' };
      expect(P.fits(frame, {}, [[0, 0], [1, 0]], 0, 0)).toBe(true);
      expect(P.fits(frame, {}, [[0, 0], [1, 0]], 1, 0)).toBe(false);
      expect(P.fits(frame, {}, [[0, 0]], 3, 0)).toBe(false);
      expect(P.fits(frame, occ, [[0, 0], [1, 0]], 0, 1)).toBe(false);
      expect(P.fits(frame, occ, [[0, 0], [1, 0]], 1, 1)).toBe(true);
    });
    it('partition makes count connected pieces of even size', function () {
      var lShape = [];
      for (var y = 0; y < 10; y++) { for (var x = 0; x < 10; x++) { if (x < 4 || y >= 6) { lShape.push([x, y]); } } }
      var cases = [
        { cells: rect(12, 12), counts: [8, 12, 16] },
        { cells: lShape, counts: [4, 8] }
      ];
      cases.forEach(function (cs) {
        cs.counts.forEach(function (count) {
          var okCount = 0, avg = cs.cells.length / count;
          for (var seed = 1; seed <= 50; seed++) {
            var parts = P.partition(cs.cells, A.core.Rng.mulberry32(seed), count);
            if (!parts) { continue; }
            okCount++;
            var seen = {}, total = 0;
            expect(parts.length).toBe(count);
            parts.forEach(function (p) {
              expect(connected(p)).toBe(true);
              expect(p.length).toBeGreaterThanOrEqual(Math.ceil(0.5 * avg));
              expect(p.length).toBeLessThanOrEqual(Math.floor(1.5 * avg));
              p.forEach(function (c) {
                var k = c[0] + ',' + c[1];
                expect(seen[k]).toBeFalsy();
                seen[k] = true; total++;
              });
            });
            expect(total).toBe(cs.cells.length);
          }
          expect(okCount).toBeGreaterThanOrEqual(40);
        });
      });
    });
    it('partition is deterministic for the same rand', function () {
      var a = P.partition(rect(12, 12), A.core.Rng.mulberry32(7), 8);
      var b = P.partition(rect(12, 12), A.core.Rng.mulberry32(7), 8);
      expect(a).toEqual(b);
    });
  });
})(window.Ailand);
