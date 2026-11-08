(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Fx = A.games.drop4.Fx;

  describe('drop4 Fx.dropMs', function () {
    it('grows with the distance and stays within 400..900 ms', function () {
      expect(Fx.dropMs(1) < Fx.dropMs(6)).toBe(true);
      expect(Fx.dropMs(1) >= 400).toBe(true);
      expect(Fx.dropMs(99)).toBe(900);
    });
    it('treats 0 rows like 1', function () { expect(Fx.dropMs(0)).toBe(Fx.dropMs(1)); });
  });

  describe('drop4 Fx.drop (reduced motion / no DOM)', function () {
    it('play with null picked does nothing', function () { expect(Fx.play(null, {})).toBe(undefined); });
  });
})(Ailand);
