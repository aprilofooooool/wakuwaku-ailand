(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var L = A.games.blocks.Layout;

  describe('blocks layout', function () {
    it('cellSize fits the board', function () {
      expect(L.cellSize(240, 600)).toBe(24);
      expect(L.cellSize(400, 400)).toBe(20);
      expect(L.cellSize(10, 10)).toBe(8);
    });
    it('cellCenter skips the hidden rows', function () {
      var p = L.cellCenter({ left: 100, top: 50 }, 20, 0, 2);
      expect(p.x).toBe(110);
      expect(p.y).toBe(60);
    });
  });
})(Ailand);
