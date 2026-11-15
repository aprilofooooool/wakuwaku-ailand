(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var P = A.games.chain.Pair;

  function pair(x, y, rot) { return { x: x, y: y, rot: rot, axis: 'a', child: 'b' }; }

  describe('chain pair', function () {
    it('cells follow the four rotations', function () {
      var expected = [[2, 4], [3, 5], [2, 6], [1, 5]];
      for (var r = 0; r < 4; r++) {
        var cells = P.cells(pair(2, 5, r));
        expect(cells.length).toBe(2);
        expect(cells[0]).toEqual({ col: 2, row: 5, charId: 'a', role: 'axis' });
        expect(cells[1]).toEqual({ col: expected[r][0], row: expected[r][1], charId: 'b', role: 'child' });
      }
    });
    it('kicks: opposite side then up', function () {
      var seen = [];
      P.tryRotate(pair(2, 5, 0), function (c) { seen.push([c.x, c.y]); return false; });
      expect(seen).toEqual([[2, 5], [1, 5], [2, 4]]);
      seen = [];
      P.tryRotate(pair(2, 5, 1), function (c) { seen.push([c.x, c.y]); return false; });
      expect(seen).toEqual([[2, 5], [2, 4]]);
      // right wall: child would be at x=6, so shift to x=4
      var r = P.tryRotate(pair(5, 5, 0), function (c) { return c.x + P.OFFSETS[c.rot][0] <= 5; });
      expect(r.x).toBe(4);
      expect(r.y).toBe(5);
      expect(r.rot).toBe(1);
      // floor: child would be at row 13, so move up
      var f = P.tryRotate(pair(2, 12, 1), function (c) { return c.y + P.OFFSETS[c.rot][1] <= 12; });
      expect(f.x).toBe(2);
      expect(f.y).toBe(11);
      expect(f.rot).toBe(2);
    });
    it('returns null when nothing fits', function () {
      var p = pair(2, 5, 0);
      expect(P.tryRotate(p, function () { return false; })).toBe(null);
      expect(p).toEqual(pair(2, 5, 0));
    });
  });
})(Ailand);
