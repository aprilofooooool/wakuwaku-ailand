(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var L = A.games.whack.Layout;

  describe('whack Layout.decideMode', function () {
    it('decideMode follows the device', function () {
      expect(L.decideMode(2, { width: 1024, height: 768, maxTouchPoints: 5 })).toBe('together');
      expect(L.decideMode(2, { width: 768, height: 1024, maxTouchPoints: 5 })).toBe('turns');
      expect(L.decideMode(2, { width: 844, height: 390, maxTouchPoints: 5 })).toBe('turns');
      expect(L.decideMode(2, { width: 1920, height: 1080, maxTouchPoints: 0 })).toBe('turns');
      expect(L.decideMode(1, { width: 1024, height: 768, maxTouchPoints: 5 })).toBe('solo');
    });
  });

  describe('whack Layout.holeSize', function () {
    it('holeSize keeps 64px and fits', function () {
      expect(L.holeSize(390, 600)).toBe(114);
      expect(L.holeSize(100, 100)).toBe(64);
      expect(L.GAP).toBe(12);
      expect(L.HIT_PAD).toBe(8);
    });
  });

  describe('whack Layout.hitHole', function () {
    // A: x 0..100 (center 50), B: x 112..212 (center 162). Padded: A -8..108, B 104..220.
    var A_RECT = { left: 0, top: 0, width: 100, height: 100 };
    var B_RECT = { left: 112, top: 0, width: 100, height: 100 };

    it('hitHole picks the nearest padded rect', function () {
      var rects = [A_RECT, B_RECT];
      expect(L.hitHole(105, 50, rects)).toBe(0);
      expect(L.hitHole(107, 50, rects)).toBe(1);
      expect(L.hitHole(-5, 50, rects)).toBe(0);
      expect(L.hitHole(-9, 50, rects)).toBe(-1);
      expect(L.hitHole(221, 50, rects)).toBe(-1);
      expect(L.hitHole(50, -8, rects)).toBe(0);
      expect(L.hitHole(50, -9, rects)).toBe(-1);
    });

    it('hitHole ignores null holes', function () {
      expect(L.hitHole(150, 50, [null, B_RECT])).toBe(1);
      expect(L.hitHole(50, 50, [null, B_RECT])).toBe(-1);
      expect(L.hitHole(50, 50, [A_RECT, null])).toBe(0);
    });
  });
})(Ailand);
