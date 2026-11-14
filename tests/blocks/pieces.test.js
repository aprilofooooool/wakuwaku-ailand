(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var P = A.games.blocks.Pieces;

  function key(cells) {
    return cells.map(function (c) { return c[0] + ',' + c[1]; }).sort().join(' ');
  }

  describe('blocks pieces', function () {
    it('every shape has 4 cells in each of 4 rotations', function () {
      expect(P.SHAPES.length).toBe(7);
      P.SHAPES.forEach(function (s) {
        for (var r = 0; r < 4; r++) {
          var cells = P.cells(s, r);
          expect(cells.length).toBe(4);
          cells.forEach(function (c) {
            expect(c[0]).toBeGreaterThanOrEqual(0);
            expect(c[0]).toBeLessThanOrEqual(3);
            expect(c[1]).toBeGreaterThanOrEqual(0);
            expect(c[1]).toBeLessThanOrEqual(3);
          });
          expect(key(cells).split(' ').length).toBe(4);
        }
      });
    });
    it('rotation is clockwise (y down): T points right after one turn', function () {
      expect(key(P.cells('T', 1))).toBe(key([[1, 0], [1, 1], [1, 2], [2, 1]]));
    });

    it('rotation 0 fits in the top two rows', function () {
      P.SHAPES.forEach(function (s) {
        P.cells(s, 0).forEach(function (c) { expect(c[1] <= 1).toBeTruthy(); });
      });
    });
    it('four rotations return to the start', function () {
      P.SHAPES.forEach(function (s) {
        expect(key(P.cells(s, 4))).toBe(key(P.cells(s, 0)));
        expect(key(P.cells(s, -1))).toBe(key(P.cells(s, 3)));
        if (s === 'O') { return; }
        var seen = {};
        for (var r = 0; r < 4; r++) { seen[key(P.cells(s, r))] = true; }
        expect(Object.keys(seen).length).toBe(4);
      });
    });
    it('tryRotate tries no shift, left, right, up in order', function () {
      var piece = { shape: 'T', charId: 'a', x: 4, y: 5, rot: 0 };
      var seen = [];
      P.tryRotate(piece, function (c) { seen.push([c.x, c.y]); return false; });
      expect(seen).toEqual([[4, 5], [3, 5], [5, 5], [4, 4]]);
      var r = P.tryRotate(piece, function (c) { return c.x === 3; });
      expect(r.x).toBe(3);
      expect(r.y).toBe(5);
      expect(r.rot).toBe(1);
      expect(r.shape).toBe('T');
      expect(r.charId).toBe('a');
    });
    it('tryRotate keeps star', function () {
      expect(P.tryRotate({ shape: 'T', charId: 'a', x: 4, y: 5, rot: 0, star: 2 }, function () { return true; }).star).toBe(2);
      expect(P.tryRotate({ shape: 'T', charId: 'a', x: 4, y: 5, rot: 0, star: null }, function () { return true; }).star).toBe(null);
    });
    it('tryRotate wraps rot to 0..3', function () {
      var r = P.tryRotate({ shape: 'L', charId: 'a', x: 0, y: 0, rot: 3 }, function () { return true; });
      expect(r.rot).toBe(0);
    });
    it('tryRotate returns null when nothing fits', function () {
      var piece = { shape: 'J', charId: 'a', x: 4, y: 5, rot: 2 };
      expect(P.tryRotate(piece, function () { return false; })).toBe(null);
      expect(piece).toEqual({ shape: 'J', charId: 'a', x: 4, y: 5, rot: 2 });
    });
  });
})(Ailand);
