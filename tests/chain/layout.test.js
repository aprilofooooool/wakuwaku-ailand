(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var L = A.games.chain.Layout;

  describe('chain layout', function () {
    it('cellSize fits the board', function () {
      expect(L.cellSize(240, 600)).toBe(40);
      expect(L.cellSize(300, 240)).toBe(20);
      expect(L.cellSize(10, 10)).toBe(8);
    });
    it('cellCenter skips the hidden row', function () {
      var p = L.cellCenter({ left: 100, top: 50 }, 20, 0, 1);
      expect(p.x).toBe(110);
      expect(p.y).toBe(60);
    });
  });
})(Ailand);
