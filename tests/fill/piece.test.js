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
    it('flip twice returns the same', function () {
      var c = P.normalize(L5);
      expect(P.flip(P.flip(c))).toEqual(c);
      expect(P.flip(c)).toEqual([[1, 0], [1, 1], [1, 2], [0, 3], [1, 3]]);
    });
    it('orientations counts', function () {
      expect(P.orientations([[0, 0], [1, 0], [0, 1], [1, 1]]).length).toBe(1);
      expect(P.orientations([[0, 0], [0, 1], [0, 2], [0, 3]]).length).toBe(2);
      expect(P.orientations([[0, 0], [1, 0], [2, 0], [1, 1]]).length).toBe(4);
      expect(P.orientations([[0, 0], [0, 1], [0, 2], [1, 2]]).length).toBe(8);
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
    it('partition covers every cell once with connected pieces of 4 to 5', function () {
      var okCount = 0;
      for (var seed = 1; seed <= 50; seed++) {
        var parts = P.partition(rect(6, 5), A.core.Rng.mulberry32(seed), 4, 5);
        if (!parts) { continue; }
        okCount++;
        var seen = {}, total = 0;
        parts.forEach(function (p) {
          expect(p.length).toBeGreaterThanOrEqual(4);
          expect(p.length).toBeLessThanOrEqual(5);
          expect(connected(p)).toBe(true);
          p.forEach(function (c) {
            var k = c[0] + ',' + c[1];
            expect(seen[k]).toBeFalsy();
            seen[k] = true; total++;
          });
        });
        expect(total).toBe(30);
      }
      expect(okCount).toBeGreaterThanOrEqual(1);
    });
    it('partition is deterministic for the same rand', function () {
      var a = P.partition(rect(6, 5), A.core.Rng.mulberry32(7), 4, 5);
      var b = P.partition(rect(6, 5), A.core.Rng.mulberry32(7), 4, 5);
      expect(a).toEqual(b);
    });
  });
})(window.Ailand);
