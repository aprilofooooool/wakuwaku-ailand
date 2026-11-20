(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var L = A.games.territory.Layout;
  var rect = { left: 100, top: 50, width: 280, height: 280 };

  describe('territory layout', function () {
    it('cellSize floors board px / size', function () {
      expect(L.cellSize(280, 14)).toBe(20);
      expect(L.cellSize(358, 14)).toBe(25);
      expect(L.cellSize(330, 11)).toBe(30);
    });
    it('toCell maps a point to its cell and is exact on cell edges', function () {
      expect(L.toCell(100, 50, rect, 14)).toEqual([0, 0]);
      expect(L.toCell(119, 69, rect, 14)).toEqual([0, 0]);
      expect(L.toCell(120, 70, rect, 14)).toEqual([1, 1]);
      expect(L.toCell(379, 329, rect, 14)).toEqual([13, 13]);
    });
    it('toCell returns null outside the board', function () {
      expect(L.toCell(99, 60, rect, 14)).toBe(null);
      expect(L.toCell(110, 49, rect, 14)).toBe(null);
      expect(L.toCell(380, 60, rect, 14)).toBe(null);
      expect(L.toCell(110, 330, rect, 14)).toBe(null);
    });
    it('lift is 40 px, the same as fill', function () {
      expect(L.LIFT_PX).toBe(40);
    });
    it('snap puts the piece centre above the finger by the offset', function () {
      var one = [[0, 0]];
      // finger at the middle of cell (5,5) (cell 20): piece lifted by 40 px = 2 cells -> cell (5,3).
      expect(L.snap({ x: 110, y: 110 }, one, 20, 40)).toEqual({ x: 5, y: 3 });
      // no lift
      expect(L.snap({ x: 110, y: 110 }, one, 20, 0)).toEqual({ x: 5, y: 5 });
    });
    it('snap centres a wide piece on the finger and rounds to the nearest cell', function () {
      var bar = [[0, 0], [1, 0], [2, 0]]; // 3 wide, 1 tall
      expect(L.snap({ x: 90, y: 50 }, bar, 20, 0)).toEqual({ x: 3, y: 2 });
      expect(L.snap({ x: 119, y: 50 }, bar, 20, 0)).toEqual({ x: 4, y: 2 });
      expect(L.snap({ x: 121, y: 50 }, bar, 20, 0)).toEqual({ x: 5, y: 2 });
    });
    it('snap can return cells outside the board (the engine rejects them)', function () {
      expect(L.snap({ x: 0, y: 0 }, [[0, 0]], 20, 40)).toEqual({ x: 0, y: -2 });
      expect(L.snap({ x: -30, y: 5 }, [[0, 0], [1, 0]], 20, 40).x < 0).toBe(true);
    });
    it('fits390: 14x14 gets 24 px or more on a 390 px wide phone, 11x11 too', function () {
      expect(L.fits390(14)).toBe(true);
      expect(L.fits390(11)).toBe(true);
      expect(L.fits390(16)).toBe(false);
    });
  });
})(Ailand);
