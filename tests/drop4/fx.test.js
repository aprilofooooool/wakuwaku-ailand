(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Fx = A.games.drop4.Fx;

  describe('drop4 Fx.drop', function () {
    it('resolves at once under reduced motion', function () {
      var F = A.core.Effects, orig = F.isReduced, done = false;
      F.isReduced = function () { return true; };
      var p = Fx.drop({}, 3).then(function () { done = true; });
      F.isReduced = orig;
      return p.then(function () { expect(done).toBe(true); });
    });
    it('play with null picked does nothing', function () { expect(Fx.play(null, {})).toBe(undefined); });
    it('stop with nothing on screen is safe', function () { Fx.stop(); expect(true).toBe(true); });
  });

  describe('drop4 Fx.drop (reduced motion / no DOM)', function () {
    it('play with null picked does nothing', function () { expect(Fx.play(null, {})).toBe(undefined); });
  });
})(Ailand);
