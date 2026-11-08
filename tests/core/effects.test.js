(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var F = A.core.Effects;

  describe('Effects.particlesFor', function () {
    it('confetti is at most 40', function () { expect(F.particlesFor('confetti', false) <= 40).toBe(true); });
    it('confetti is at most 10 when reduced', function () { expect(F.particlesFor('confetti', true) <= 10).toBe(true); });
    it('reduced is a quarter (rounded up) and at least 1', function () {
      expect(F.particlesFor('confetti', true)).toBe(10);
      expect(F.particlesFor('sparkle', false)).toBe(12);
      expect(F.particlesFor('sparkle', true)).toBe(3);
    });
    it('unknown kind gives 0', function () { expect(F.particlesFor('nope', false)).toBe(0); });
  });

  describe('Effects.budget', function () {
    it('never exceeds the layer cap', function () {
      expect(F.budget(40, 0)).toBe(40);
      expect(F.budget(40, 30)).toBe(10);
      expect(F.budget(12, 45)).toBe(0);
    });
  });

  describe('Effects.specs', function () {
    it('returns n specs inside the box with finite numbers', function () {
      var list = F.specs('confetti', 25, 400, 800);
      expect(list.length).toBe(25);
      list.forEach(function (p) {
        expect(p.x >= 0 && p.x <= 400).toBe(true);
        expect(isFinite(p.dx) && isFinite(p.dy) && isFinite(p.delay)).toBe(true);
      });
    });
    it('is deterministic', function () {
      expect(F.specs('sparkle', 8, 100, 100)).toEqual(F.specs('sparkle', 8, 100, 100));
    });
    it('returns an empty list for 0', function () { expect(F.specs('confetti', 0, 100, 100).length).toBe(0); });
  });

  describe('Effects.glyph', function () {
    it('covers every mark kind', function () {
      ['sweat', 'bang', 'sparkle', 'zzz', 'steam', 'shield'].forEach(function (k) {
        expect(typeof F.glyph(k)).toBe('string');
        expect(F.glyph(k).length > 0).toBe(true);
      });
    });
    it('unknown or null gives an empty string', function () {
      expect(F.glyph(null)).toBe('');
      expect(F.glyph('x')).toBe('');
    });
  });

  describe('Effects.isReduced', function () {
    it('is false without matchMedia', function () { expect(F.isReduced()).toBe(false); });
  });
})(Ailand);
