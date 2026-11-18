(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var L = A.games.fill.Layout;

  describe('fill layout', function () {
    it('cellSize fits the board', function () {
      expect(L.cellSize(300, 300, 6, 6)).toBe(50);
      expect(L.cellSize(300, 200, 8, 8)).toBe(25);
      expect(L.cellSize(50, 50, 8, 8)).toBe(16);
    });
    it('snap rounds to the nearest cell', function () {
      var r = { left: 100, top: 50 };
      expect(L.snap(r, 40, 159, 71)).toEqual({ x: 1, y: 1 });
      expect(L.snap(r, 40, 161, 69)).toEqual({ x: 2, y: 0 });
    });
    it('trayScale stays in range', function () {
      var many = [];
      for (var i = 0; i < 12; i++) { many.push({ w: 3, h: 3 }); }
      expect(L.trayScale(300, 200, [])).toBe(1);
      expect(L.trayScale(600, 400, [{ w: 2, h: 2 }])).toBe(1);
      expect(L.trayScale(100, 60, many)).toBe(0.4);
      var s = L.trayScale(300, 200, many);
      expect(s >= 0.4 && s <= 1).toBe(true);
    });
    it('trayScale shrinks as the tray gets smaller', function () {
      var many = [];
      for (var i = 0; i < 8; i++) { many.push({ w: 3, h: 2 }); }
      var big = L.trayScale(400, 300, many), small = L.trayScale(300, 120, many);
      expect(big >= small).toBe(true);
      expect(small < 1).toBe(true);
    });
  });
})(Ailand);
