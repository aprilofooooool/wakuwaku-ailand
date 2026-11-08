(function () {
  'use strict';

  // Reference copy of the implementation in tests/othello/ai.test.js.
  function ref(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  describe('core/Rng', function () {
    it('mulberry32(1) first 3 values match the reference', function () {
      var r = Ailand.core.Rng.mulberry32(1);
      var e = ref(1);
      for (var i = 0; i < 3; i++) { expect(r()).toBe(e()); }
    });
    it('values are in [0,1) and deterministic per seed', function () {
      var a = Ailand.core.Rng.mulberry32(42);
      var b = Ailand.core.Rng.mulberry32(42);
      for (var i = 0; i < 100; i++) {
        var v = a();
        expect(v).toBe(b());
        expect(v >= 0 && v < 1).toBe(true);
      }
    });
  });
})();
