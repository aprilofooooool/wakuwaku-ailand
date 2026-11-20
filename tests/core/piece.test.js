(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var P = A.core.Piece;

  var L5 = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]];

  describe('core piece', function () {
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
      expect(P.flip([[0, 0], [1, 0], [1, 1]])).toEqual([[0, 0], [1, 0], [0, 1]]);
    });
    it('orient rotates clockwise and four turns equal normalize', function () {
      var c = [[3, 4], [3, 5], [3, 6], [4, 6]];
      expect(P.orient(c, 4)).toEqual(P.normalize(c));
      expect(P.orient(c, 0)).toEqual(P.normalize(c));
      expect(P.orient(c, 1)).toEqual(P.rotate(P.normalize(c)));
    });
    it('orient applies flip before rotate', function () {
      var l4 = [[0, 0], [0, 1], [0, 2], [1, 2]];
      expect(P.orient(l4, 1, 1)).toEqual([[0, 0], [0, 1], [1, 1], [2, 1]]);   // flip, then one clockwise turn
      expect(P.orient(l4, 1, 1)).toEqual(P.rotate(P.flip(l4)));
      expect(P.orient(l4, 1, 0)).toEqual(P.orient(l4, 1));
    });
    it('orientations counts', function () {
      expect(P.orientations([[0, 0]]).length).toBe(1);
      expect(P.orientations([[0, 0], [1, 0]]).length).toBe(2);
      expect(P.orientations([[0, 0], [1, 0], [0, 1], [1, 1]]).length).toBe(1);
      expect(P.orientations([[0, 0], [1, 0], [2, 0], [1, 1]]).length).toBe(4);   // T4
      expect(P.orientations([[0, 0], [0, 1], [0, 2], [1, 2]]).length).toBe(8);   // L4
      expect(P.orientations([[1, 0], [2, 0], [0, 1], [1, 1]]).length).toBe(4);   // S4
      expect(P.orientations([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]).length).toBe(1);   // cross
      expect(P.orientations([[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]]).length).toBe(4);   // W5
      expect(P.orientations(L5).length).toBe(8);
    });
    it('orientations keeps the first of equal shapes in rot then flip order', function () {
      var o = P.orientations([[0, 0], [1, 0]]);
      expect(o[0].rot).toBe(0);
      expect(o[0].flip).toBe(0);
      expect(o[1].rot).toBe(1);
      expect(o[1].cells).toEqual([[0, 0], [0, 1]]);
      P.orientations(L5).forEach(function (x) {
        expect(x.cells).toEqual(P.orient(L5, x.rot, x.flip));
      });
    });
    it('same compares after normalize', function () {
      expect(P.same([[5, 5], [6, 5]], [[0, 0], [1, 0]])).toBe(true);
      expect(P.same([[0, 0], [1, 0]], [[0, 0], [0, 1]])).toBe(false);
    });
    it('place moves to absolute cells', function () {
      expect(P.place([[0, 0], [1, 0]], 2, 3)).toEqual([[2, 3], [3, 3]]);
    });
  });
})(window.Ailand);
